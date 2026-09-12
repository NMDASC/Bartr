"""Provider response and retained-history regressions. No network or shared state."""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app import deps, llm
from app.routers import security_console
from app.services.agents import grok
from app.store import MemoryStore


@pytest.fixture
def isolated_store(monkeypatch):
    store = MemoryStore()
    monkeypatch.setattr(deps, "store", store)
    monkeypatch.setattr(security_console, "store", store)
    return store


class SDKResponse(SimpleNamespace):
    def model_dump(self, **kwargs):
        return self.raw


def chat_response(content="Complete answer", *, parsed=None, refusal=None, tool_calls=None):
    raw = {"id": "provider-response", "created": 100, "model": "provider-model",
           "choices": [{"finish_reason": "stop", "message": {"content": content,
                       "reasoning_content": "Provider rationale", "refusal": refusal,
                       "tool_calls": tool_calls or []}}],
           "usage": {"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20}}
    message = SimpleNamespace(content=content, parsed=parsed, refusal=refusal,
                              tool_calls=[SimpleNamespace(id=t["id"], function=SimpleNamespace(**t["function"])) for t in tool_calls or []])
    return SDKResponse(raw=raw, choices=[SimpleNamespace(message=message)])


@pytest.mark.asyncio
async def test_raw_tool_reply_survives_normalization_and_redaction(isolated_store, monkeypatch):
    secret = "private-provider-key-123456"
    monkeypatch.setenv("XAI_API_KEY", secret)
    response = chat_response("Answer " + secret, tool_calls=[{"id": "tool-1", "function": {"name": "place_order", "arguments": "{not-valid-json"}}])
    response.raw["api_key"] = "independent-private-key"
    async def create(**kwargs):
        assert kwargs["model"] == "requested-fast-model"
        assert "audit_feature" not in kwargs
        return response
    monkeypatch.setattr(llm, "client", lambda provider: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    result = await llm.complete([{"role": "user", "content": "Check this trade"}], model="requested-fast-model",
                                tools=[{"type": "function"}], audit_feature="trade-review")
    assert result.tool_calls[0].arguments == {}
    records = isolated_store.audit_log()
    assert len(records) == 1
    payload = records[0]["payload"]
    assert payload["feature"] == "trade-review" and payload["status"] == "success"
    assert payload["output"]["content"] == "Answer [redacted]"
    raw = payload["raw_response"]
    assert raw["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"] == "{not-valid-json"
    assert raw["usage"]["total_tokens"] == 20
    assert raw["api_key"] == "[redacted]" and secret not in str(records)


@pytest.mark.asyncio
async def test_structured_reply_and_refusal_keep_provider_body(isolated_store, monkeypatch):
    class Opinion(BaseModel):
        severity: str
    reply = chat_response('{"severity":"high"}', parsed=Opinion(severity="high"))
    async def parse(**kwargs):
        return reply
    monkeypatch.setattr(llm, "client", lambda provider: SimpleNamespace(beta=SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))))
    result = await llm.complete([], provider="ifm", schema=Opinion)
    assert result.severity == "high"
    reply = chat_response(None, refusal="Cannot complete this request")
    with pytest.raises(RuntimeError, match="no parsed content"):
        await llm.complete([], provider="ifm", schema=Opinion)
    good, refused = [e["payload"] for e in isolated_store.audit_log()]
    assert good["output"] == {"severity": "high"}
    assert good["raw_response"]["choices"][0]["message"]["reasoning_content"] == "Provider rationale"
    assert refused["status"] == "error" and refused["output"] is None
    assert refused["raw_response"]["choices"][0]["message"]["refusal"] == "Cannot complete this request"


@pytest.mark.asyncio
async def test_concurrent_calls_do_not_share_raw_responses(isolated_store, monkeypatch):
    def client(provider):
        async def create(**kwargs):
            await asyncio.sleep(0)
            return chat_response(provider)
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(llm, "client", client)
    await asyncio.gather(llm.complete([], provider="xai"), llm.complete([], provider="ifm"))
    assert len(isolated_store.audit_log()) == 2
    for event in isolated_store.audit_log():
        payload = event["payload"]
        assert payload["provider"] == payload["output"] == payload["raw_response"]["choices"][0]["message"]["content"]


@pytest.mark.parametrize("mode", ["success", "empty", "failed", "cancelled"])
@pytest.mark.asyncio
async def test_research_records_each_attempt_once(isolated_store, monkeypatch, mode):
    monkeypatch.setattr(grok, "configured", lambda provider: True)
    raw = {"id": "research-response", "output": [{"type": "web_search_call", "status": "completed"}],
           "usage": {"input_tokens": 11, "output_tokens": 17}}
    async def create(**kwargs):
        if mode == "failed":
            error = RuntimeError("provider rejected request")
            error.body = {"error": "provider validation response"}
            raise error
        if mode == "cancelled":
            raise asyncio.CancelledError()
        return SDKResponse(raw=raw, output=[], output_text="Cited result" if mode == "success" else "")
    monkeypatch.setattr(llm, "client", lambda provider: SimpleNamespace(responses=SimpleNamespace(create=create)))
    if mode == "cancelled":
        with pytest.raises(asyncio.CancelledError):
            await grok.researched("security-research", "Research this business", cache=False)
    else:
        result = await grok.researched("security-research", "Research this business", cache=False)
        assert result == ("Cited result" if mode == "success" else None)
    records = isolated_store.audit_log()
    assert len(records) == 1
    payload = records[0]["payload"]
    assert payload["status"] == ("success" if mode == "success" else "error")
    if mode in ("success", "empty"):
        assert payload["raw_response"] == raw
    if mode == "failed":
        assert payload["raw_response"] == {"error": "provider validation response"}


def case_record():
    return {"id": "case-old", "status": "open", "note": "", "history": [], "occurrences": 1,
            "first_seen": 100, "last_seen": 100, "evidence": {"trades": [], "orders": [], "batches": []},
            "flag": {"id": "case-old", "market_id": "co_old", "batch_id": "batch-old", "rule": "wash_trading",
                     "subjects": ["alice"], "severity": "high", "reviews": [], "reviewer": "rules", "disputed": False,
                     "explanation": "Retained investigation", "t": 100}}


def test_case_and_user_links_survive_unrelated_archive_growth(isolated_store, monkeypatch):
    store = isolated_store
    store.put_case(case_record())
    store.put_user({"id": "alice", "positions": {}})
    store.audit({"id": "old-review", "t": 100, "actor": "system", "action": "agent_call", "flag_id": "case-old", "payload": {"output": "Original opinion"}})
    store.audit({"id": "old-chat", "t": 101, "actor": "alice", "action": "agent_call", "market_id": "co_old", "payload": {"output": "User response"}})
    store.audit({"id": "old-trade", "t": 102, "actor": "exchange", "action": "trade", "market_id": "co_old", "payload": {"buyer_id": "alice", "seller_id": "bob"}})
    store.audit({"id": "other-market", "t": 103, "actor": "alice", "action": "cancel_order", "market_id": "co_unrelated", "payload": {}})
    for i in range(10010):
        store.audit({"id": f"unrelated-{i}", "t": 1000 + i, "actor": "unrelated", "action": "agent_call", "payload": {}})
    monkeypatch.setenv("ADMIN_API_TOKEN", "audit-test-admin")
    app = FastAPI()
    app.include_router(security_console.router, prefix="/api/v1")
    with TestClient(app) as client:
        headers = {"X-Admin-Token": "audit-test-admin"}
        detail = client.get("/api/v1/security/cases/case-old", headers=headers)
        assert detail.status_code == 200
        assert [e["id"] for e in detail.json()["audit"]] == ["old-review", "old-chat", "old-trade"]
        profile = client.get("/api/v1/security/users/alice", headers=headers)
        assert profile.status_code == 200
        assert [e["id"] for e in profile.json()["calls"]] == ["old-review", "old-chat"]
        assert "latest 100" in detail.json()["evidence_window"]
        assert client.get("/api/v1/security/users/alice").status_code == 403


def test_user_totals_cover_all_trades_and_recent_list_is_global(isolated_store):
    store = isolated_store
    store.put_user({"id": "alice", "positions": {}})
    for i in range(1105):
        store.add_trade({"id": f"trade-{i:05}", "market_id": "co_one" if i % 2 else "co_two", "batch_id": "b",
                         "buyer_id": "alice", "seller_id": "bob", "qty": 2, "price": 3, "t": i})
    for i in range(2000):
        store.add_trade({"id": f"other-{i}", "market_id": "co_two", "batch_id": "b", "buyer_id": "carol",
                         "seller_id": "david", "qty": 1, "price": 1, "t": 2000 + i})
    profile = security_console.user_profile("alice")
    assert profile["summary"]["trades"] == 1105
    assert profile["summary"]["traded_notional"] == 6630
    assert len(profile["trades"]) == 100
    assert profile["trades"][0]["_id"] == "trade-01005"
    assert profile["trades"][-1]["_id"] == "trade-01104"
    assert "Totals cover all stored history" in profile["evidence_window"]
    assert store.user_trade_summary("unknown") == {"trades": 0, "traded_notional": 0}
