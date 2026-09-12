"""Real lifecycle checks for the new account/security boundaries. No network."""
import asyncio
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app, load_seeds
from app.deps import engine, store
from app.routers import security_console
from app.security import context
from app import llm
from app.store import MemoryStore

CID = "co_squirrel_hill_wash"
ADMIN = {"X-Admin-Token": "workspace-test-admin"}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SECURITY_AUTO_REVIEW", "0")
    monkeypatch.setenv("XAI_API_KEY", "")
    monkeypatch.setenv("IFM_API_KEY", "")
    monkeypatch.setenv("ADMIN_API_TOKEN", "workspace-test-admin")
    monkeypatch.setenv("BRIDGE_API_TOKEN", "workspace-test-bridge")
    monkeypatch.setenv("IMESSAGE_NUMBER", "+12025550100")
    monkeypatch.setattr(llm, "is_configured", lambda provider: False)
    load_seeds()
    with TestClient(app) as c:
        yield c


def test_admin_boundary_fails_closed(client, monkeypatch):
    for path in ("/security/overview", "/surveillance/flags", "/surveillance/audit", "/surveillance/report"):
        assert client.get("/api/v1"+path).status_code == 403
        assert client.get("/api/v1"+path, headers={"X-Admin-Token":"wrong"}).status_code == 403
    assert client.get("/api/v1/security/overview", headers=ADMIN).status_code == 200
    monkeypatch.delenv("ADMIN_API_TOKEN")
    assert client.get("/api/v1/security/overview", headers=ADMIN).status_code == 503


def test_overview_is_personal_and_cancellation_releases_cash(client):
    first={"X-Demo-User":"workspace-order-user"}
    second={"X-Demo-User":"workspace-other-user"}
    ask=client.get(f"/api/v1/markets/{CID}/book").json()["asks"][0]["price"]
    placed=client.post(f"/api/v1/markets/{CID}/orders", headers=first, json={"side":"buy","qty":2,"limit_price":ask}).json()
    pf=client.get("/api/v1/portfolio/overview",headers=first).json()
    assert pf["user_id"]=="workspace-order-user"
    assert any(o["_id"]==placed["_id"] for o in pf["orders"])
    assert pf["reserved_cash"]>=ask*2
    other=client.get("/api/v1/portfolio/overview",headers=second).json()
    assert not any(o["_id"]==placed["_id"] for o in other["orders"])
    assert client.delete(f"/api/v1/markets/orders/{placed['_id']}",headers=second).status_code in (403,404)
    assert client.delete(f"/api/v1/markets/orders/{placed['_id']}",headers=first).json()["status"]=="cancelled"
    after=client.get("/api/v1/portfolio/overview",headers=first).json()
    assert after["reserved_cash"]==0
    assert after["open_orders"]==0


def test_shared_phone_history_and_bridge_auth(client):
    h={"X-Demo-User":"+1 (202) 555-0112", "X-Bridge-Token":"workspace-test-bridge"}
    res=client.post("/api/v1/agent/chat",headers=h,json={"session_id":"ignored-other-user", "message":"laundromat in Pittsburgh"})
    assert res.status_code==200
    web={"X-Demo-User":"2025550112"}
    history=client.get("/api/v1/agent/messages",headers=web).json()
    assert history[-1]["channel"]=="imessage"
    assert history[-2]["content"]=="laundromat in Pittsburgh"
    assert client.get("/api/v1/agent/messages",headers={"X-Demo-User":"unrelated-user"}).json()==[]
    assert client.post("/api/v1/agent/heartbeat").status_code==403
    assert client.post("/api/v1/agent/heartbeat",headers={"X-Bridge-Token":"workspace-test-bridge"}).status_code==200
    state=client.get("/api/v1/agent/channel",headers=web).json()
    assert state["connected"] and state["identity"]=="+12025550112"


def test_case_evidence_review_reopen_and_persistence(client,tmp_path):
    now=time.time()
    flag={"id":"workspace-case", "market_id":CID,"batch_id":"workspace-batch","rule":"wash_trading","severity":"high","subjects":["workspace-subject-a","workspace-subject-b"],"explanation":"Repeated reciprocal trades.","reviewer":"rules","reviews":[{"reviewer":"rules","severity":"high"}],"disputed":False,"t":now}
    trade={"id":"workspace-trade","market_id":CID,"batch_id":"workspace-batch","buyer_id":"workspace-subject-a","seller_id":"workspace-subject-b","qty":3,"price":55,"t":now}
    store.add_trade(trade)
    security_console.capture([flag])
    detail=client.get("/api/v1/security/cases/workspace-case",headers=ADMIN).json()
    assert any(t["_id"]=="workspace-trade" for t in detail["trades"])
    assert client.patch("/api/v1/security/cases/workspace-case",headers=ADMIN,json={"status":"resolved","note":" "}).status_code==422
    res=client.patch("/api/v1/security/cases/workspace-case",headers=ADMIN,json={"status":"resolved","note":"Evidence reviewed; escalation complete."})
    assert res.status_code==200 and res.json()["status"]=="resolved"
    security_console.capture([flag])
    assert client.get("/api/v1/security/cases/workspace-case",headers=ADMIN).json()["status"]=="resolved"
    security_console.capture([{**flag,"t":now+1}])
    case=client.get("/api/v1/security/cases/workspace-case",headers=ADMIN).json()
    assert case["status"]=="open" and case["occurrences"]==2 and len(case["history"])==2
    mem=MemoryStore(str(tmp_path/"state.json"))
    mem.put_case({"id":"persisted","status":"resolved"})
    mem.audit({"t":now,"action":"case_review"})
    mem.save()
    restored=MemoryStore(str(tmp_path/"state.json"))
    assert restored.list_cases()[0]["status"]=="resolved"
    assert restored.audit_log()[0]["action"]=="case_review"


def test_full_llm_output_audited_and_secrets_redacted(client,monkeypatch):
    secret="sensitive-test-key-123456"
    monkeypatch.setenv("XAI_API_KEY",secret)
    async def fake(messages,**kw):return "Complete opinion with "+secret
    monkeypatch.setattr(llm,"_complete",fake)
    token=context.set({"actor":"workspace-actor","market_id":CID,"flag_id":"workspace-case","feature":"compliance_review"})
    try:asyncio.run(llm.complete([{"role":"user","content":"input "+secret}]))
    finally:context.reset(token)
    result=client.get("/api/v1/security/overview",headers=ADMIN).json()
    call=next(c for c in result["calls"] if c["actor"]=="workspace-actor")
    assert call["payload"]["output"]=="Complete opinion with [redacted]"
    assert call["flag_id"]=="workspace-case" and call["market_id"]==CID
    assert secret not in str(call)


def test_acquisition_draft_is_personal_saved_and_not_regenerated(client, monkeypatch):
    from app.services.agents import acquire_agent
    async def no_model(*args, **kwargs): return None
    monkeypatch.setattr(acquire_agent, "loi", no_model)
    monkeypatch.setattr(acquire_agent, "checklist", no_model)
    owner = {"X-Demo-User": "workspace-buyer"}
    other = {"X-Demo-User": "workspace-not-buyer"}
    path = f"/api/v1/acquire/{CID}"
    assert client.get(path+"/draft", headers=owner).json() is None
    draft = client.post(path+"/start", headers=owner).json()
    draft["loi_md"] = "# My edited draft"
    draft["checklist"][0]["done"] = True
    saved = client.put(path+"/draft", headers=owner, json=draft)
    assert saved.status_code == 200
    assert client.get(path+"/draft", headers=owner).json()["checklist"][0]["done"] is True
    assert client.post(path+"/start", headers=owner).json()["loi_md"] == "# My edited draft"
    assert client.get(path+"/draft", headers=other).json() is None
    assert client.get("/api/v1/acquire/"+draft["acquisition_id"], headers=other).status_code == 404


def test_message_retries_do_not_duplicate_orders_and_status_and_cancel_work(client, monkeypatch):
    from app.services.agents import chat_agent
    monkeypatch.setattr(chat_agent, "is_configured", lambda p: False)
    headers = {"X-Demo-User": "workspace-chat-trader"}
    ref = store.get_market(CID)["ref_price"]
    body = {"session_id": "ignored", "request_id": "delivery-1", "message": f"buy 1 of {CID} at {ref:.2f}"}
    first = client.post("/api/v1/agent/chat", headers=headers, json=body)
    second = client.post("/api/v1/agent/chat", headers=headers, json=body)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    orders = store.user_orders("workspace-chat-trader")
    assert len(orders) == 1
    status = client.post("/api/v1/agent/chat", headers=headers, json={"session_id": "x", "message": "my orders"}).json()
    assert orders[0]["id"] in status["content"] and "filled" in status["content"]
    cancel = client.post("/api/v1/agent/chat", headers=headers, json={"session_id": "x", "message": f"cancel order {orders[0]['id']}"}).json()
    assert "cancelled" in cancel["content"]
    conflict = client.post("/api/v1/agent/chat", headers=headers, json={**body, "message": "my portfolio"})
    assert conflict.status_code == 409


def test_tool_loop_failure_after_order_does_not_execute_fallback_order(client, monkeypatch):
    from app.services.agents import chat_agent
    from app.llm import Completion, ToolCall
    calls = 0
    async def fake(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls > 1: raise TimeoutError("provider interrupted")
        return Completion(content="", tool_calls=[ToolCall(id="tool-1", name="place_order", arguments={"id": CID, "side": "buy", "qty": 1, "limit": store.get_market(CID)["ref_price"]})])
    monkeypatch.setattr(chat_agent, "is_configured", lambda p: True)
    monkeypatch.setattr(chat_agent, "complete", fake)
    answer = asyncio.run(chat_agent.reply(f"buy 1 of {CID} at {store.get_market(CID)['ref_price']}", "workspace-interrupted", engine, store))
    assert "interrupted" in answer.content
    assert len(store.user_orders("workspace-interrupted")) == 1


def test_archive_search_and_pagination_reach_older_records(client):
    now = time.time()
    for i in range(6):
        store.audit({"id": f"archive-{i}", "t": now+i/100, "actor": "workspace-archive", "action": "agent_call",
                     "payload": {"provider": "xai", "model": "test", "feature": "test", "status": "success", "duration_ms": 1,
                                 "input": "old search phrase" if i == 0 else "prompt", "output": f"answer {i}", "error": None}})
    params = {"query": "workspace-archive", "limit": 2, "before": now+1}
    first = client.get("/api/v1/security/events", headers=ADMIN, params=params).json()
    assert [e["id"] for e in first["items"]] == ["archive-5", "archive-4"]
    store.audit({"id": "new-after-anchor", "t": now+2, "actor": "workspace-archive", "action": "agent_call", "payload": {}})
    second = client.get("/api/v1/security/events", headers=ADMIN, params={**params, "offset": first["next_offset"]}).json()
    assert [e["id"] for e in second["items"]] == ["archive-3", "archive-2"]
    found = client.get("/api/v1/security/events", headers=ADMIN, params={"query": "old search phrase", "before": now+3}).json()
    assert found["items"][0]["id"] == "archive-0"
    assert client.get("/api/v1/security/events").status_code == 403


def test_missing_reviewer_retries_without_exposing_peer_opinion(client, monkeypatch):
    import json
    from app.services.agents import compliance
    compliance._CACHE.clear()
    monkeypatch.setattr(compliance, "is_configured", lambda provider: True)
    attempts = {"xai": 0, "ifm": 0}
    packets = []
    async def model(messages, provider, **kwargs):
        attempts[provider] += 1
        packets.append(json.loads(messages[1]["content"]))
        if provider == "ifm" and attempts[provider] == 1:
            raise TimeoutError("transient outage")
        return compliance.ReviewOpinion(severity="high" if provider == "xai" else "low", explanation="private peer conclusion " + provider)
    monkeypatch.setattr(compliance, "complete", model)
    flag = {"id": "review-retry", "market_id": CID, "batch_id": "b", "rule": "wash_trading", "severity": "high", "subjects": ["a", "b"],
            "explanation": "Original deterministic evidence", "reviews": [{"reviewer": "rules", "severity": "high"}], "reviewer": "rules", "disputed": False, "t": time.time()}
    first = asyncio.run(compliance.review_flags([flag]))[0]
    second = asyncio.run(compliance.review_flags([first]))[0]
    assert attempts == {"xai": 1, "ifm": 2}
    assert second["disputed"] and second["reviewer"] == "grok"
    assert len(second["reviews"]) == 3
    for packet in packets:
        assert "reviews" not in packet["flag"]
        assert packet["flag"]["explanation"] == "Original deterministic evidence"


def test_acquisition_background_preserves_edits_and_duplicate_start(client, monkeypatch, tmp_path):
    from app.routers import acquire
    from app.services.agents import acquire_agent
    monkeypatch.setattr(acquire, "CHECKLISTS", {})
    uid = "workspace-background-buyer"
    starts = 0
    async def scenario():
        nonlocal starts
        research_started, research_release = asyncio.Event(), asyncio.Event()
        async def loi(*args):
            nonlocal starts
            starts += 1
            await asyncio.sleep(0)
            return "# Buyer draft"
        async def checklist(*args):
            research_started.set()
            await research_release.wait()
            return [{"item": "Researched requirement", "why": "Official record", "citation": None, "done": False}]
        monkeypatch.setattr(acquire_agent, "loi", loi)
        monkeypatch.setattr(acquire_agent, "checklist", checklist)
        first, second = await asyncio.gather(acquire.start(CID, uid), acquire.start(CID, uid))
        assert first["acquisition_id"] == second["acquisition_id"] and starts == 1
        await research_started.wait()
        first["checklist"][0]["done"] = True
        acquire.save_draft(CID, acquire.DraftIn(loi_md="# Edited letter", checklist=first["checklist"]), uid)
        research_release.set()
        await asyncio.gather(*list(acquire._research_tasks))
        saved = store.get_draft(uid, CID)
        assert saved["loi_md"] == "# Edited letter" and saved["checklist"][0]["done"]
        assert saved["checklist_status"] == "kept"
        mem = MemoryStore(str(tmp_path / "draft-state.json"))
        mem.put_draft(uid, CID, saved)
        mem.save()
        assert MemoryStore(str(tmp_path / "draft-state.json")).get_draft(uid, CID) == saved
        assert store.get_draft("different-buyer", CID) is None
    asyncio.run(scenario())


def test_compliance_uses_captured_order_evidence_not_later_trades(client, monkeypatch):
    import json
    from app.services.agents import compliance
    now = time.time()
    uid = "workspace-frozen-subject"
    flag = {"id": "frozen-review-packet", "market_id": CID, "batch_id": "frozen-batch", "rule": "spoofing", "severity": "high", "subjects": [uid],
            "explanation": "Three cancelled unfilled orders", "reviews": [{"reviewer": "rules", "severity": "high"}], "reviewer": "rules", "disputed": False, "t": now}
    order = {"id": "frozen-cancel", "market_id": CID, "user_id": uid, "side": "buy", "qty": 1, "limit_price": 50,
             "status": "cancelled", "filled_qty": 0, "origin": "user", "created_at": now, "cancelled_at": now}
    store.put_order(order)
    security_console.capture([flag])
    store.add_trade({"id": "later-unrelated", "market_id": CID, "batch_id": "future", "buyer_id": uid, "seller_id": "other", "qty": 4, "price": 55, "t": now+10})
    packets = []
    async def model(messages, **kwargs):
        packets.append(json.loads(messages[1]["content"]))
        return compliance.ReviewOpinion(severity="high", explanation="Cancelled orders support the flag.")
    monkeypatch.setattr(compliance, "is_configured", lambda provider: True)
    monkeypatch.setattr(compliance, "complete", model)
    compliance._CACHE.clear()
    asyncio.run(compliance.review_flags([flag]))
    assert len(packets) == 2 and packets[0] == packets[1]
    assert packets[0]["orders"][0]["_id"] == "frozen-cancel"
    assert all(t["_id"] != "later-unrelated" for t in packets[0]["trades"])


def test_old_active_orders_remain_visible_after_recent_history(client):
    uid = "workspace-long-order-history"
    now = time.time()
    for i in range(55):
        store.put_order({"id": f"history-{i}", "market_id": CID, "user_id": uid, "side": "sell", "qty": 2,
                         "limit_price": 55, "status": "open" if i == 0 else "cancelled", "filled_qty": 0,
                         "origin": "user", "seq": i, "created_at": now+i, "cancelled_at": None if i == 0 else now+i+1})
    response = client.get(f"/api/v1/markets/{CID}/orders/mine", headers={"X-Demo-User": uid})
    assert response.status_code == 200
    assert any(o["_id"] == "history-0" for o in response.json())
