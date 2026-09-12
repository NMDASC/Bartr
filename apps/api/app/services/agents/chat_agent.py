"""Transport-agnostic chat. Deterministic tools always; Grok tool loop when configured."""
from __future__ import annotations

import json
import math
import re

from app.llm import Completion, complete, is_configured
from app.schemas import AgentMessage, ToolCallCard
from app.services.discovery.intent import parse_intent
from app.services.discovery.ranking import rank_companies
from app.services.market.kelly import size_portfolio
from app.services.market.treasury import SHARES

TOOLS = [
    {"type": "function", "function": {
        "name": "search_companies",
        "description": "Find listed companies matching a natural language query",
        "parameters": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]},
    }},
    {"type": "function", "function": {
        "name": "get_company",
        "description": "Company profile and last price",
        "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
    }},
    {"type": "function", "function": {
        "name": "get_book",
        "description": "Live order book for a market",
        "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
    }},
    {"type": "function", "function": {
        "name": "place_order",
        "description": "Place a limit order",
        "parameters": {"type": "object", "properties": {
            "id": {"type": "string"}, "side": {"type": "string"}, "qty": {"type": "number"}, "limit": {"type": "number"},
        }, "required": ["id", "side", "qty", "limit"]},
    }},
    {"type": "function", "function": {
        "name": "suggest_portfolio",
        "description": "Half Kelly suggestions",
        "parameters": {"type": "object", "properties": {}},
    }},
]

SYSTEM = (
    "You are JB, a discovery and trading agent. Short plain lines, no markdown. "
    "Use tools. Never invent a price; read it from the tool result."
)


def _find(store, name: str) -> dict | None:
    q = name.lower()
    hits = [c for c in store.list_companies() if q in c["name"].lower() or q in c["id"]]
    return hits[0] if hits else None


def _line(c: dict, engine) -> str:
    m = engine.store.get_market(c["id"]) or {}
    last = m.get("last_price") or m.get("ref_price")
    where = ", ".join(x for x in (c.get("city"), c.get("state")) if x)
    value = f"${(last * 10_000):,.0f}" if last else "unpriced"
    px = f", last ${last:,.2f}" if last else ""
    return f"{c['name']}, {where}. {value}{px}."


def search_companies(engine, store, q: str) -> tuple[str, list[dict], int]:
    ranked = rank_companies(q, parse_intent(q), store.list_companies())
    picks = [c for c, _ in ranked[:3]]
    if not picks:
        return "Nothing matched.", [], 0
    return "\n".join(_line(c, engine) for c in picks), picks, len(ranked)


def run_tool(name: str, args: dict, uid: str, engine, store) -> tuple[str, int]:
    if name == "search_companies":
        text, _, n = search_companies(engine, store, str(args.get("q") or ""))
        return text, n
    if name == "get_company":
        c = store.get_company(args.get("id") or "") or _find(store, str(args.get("id") or ""))
        if not c:
            return "No such company.", 0
        return _line(c, engine), 1
    if name == "get_book":
        mid = args.get("id") or ""
        try:
            book = engine.book(mid)
        except Exception:
            return "No book.", 0
        bid = book["bids"][0]["price"] if book["bids"] else None
        ask = book["asks"][0]["price"] if book["asks"] else None
        return f"bid {bid} ask {ask} last {book.get('last')}", 1
    if name == "place_order":
        mid = args.get("id") or args.get("market_id") or ""
        c = store.get_company(mid) or _find(store, str(mid))
        if not c:
            return "No such company.", 0
        o = engine.place_order(uid, c["id"], str(args.get("side") or "buy"), float(args["qty"]), float(args.get("limit") or args.get("limit_price")), origin="agent")
        if o["status"] == "rejected":
            return f"Rejected: {o.get('reason')}.", 0
        return f"Placed. {o['side']} {o['qty']} @ ${o['limit_price']:.2f} on {c['name']}.", 1
    if name == "suggest_portfolio":
        u = engine.user(uid)
        cands = []
        for c in store.list_companies():
            m = store.get_market(c["id"])
            if not m:
                continue
            price = m["last_price"] or m["ref_price"]
            value = math.exp(m["prior"]["mu"]) / SHARES
            cands.append({"id": c["id"], "c": c, "price": price, "value": value, "sigma": m["belief"]["sigma"]})
        sized = [s for s in size_portfolio(cands, u["cash"]) if s["usd"] > 0][:3]
        if not sized:
            return "No positive edge right now.", 0
        lines = [f"{s['c']['name']}: ${s['usd']:,.0f} ({s['f']*100:.1f}% Kelly)" for s in sized]
        return "\n".join(lines), len(sized)
    return "Unknown tool.", 0


def local_reply(message: str, uid: str, engine, store) -> AgentMessage:
    buy = re.search(r"buy\s+([\d.]+)\s+(?:shares?\s+)?(?:of\s+)?(.+?)\s+at\s+\$?([\d.]+)", message, re.I)
    if buy:
        qty, name, px = float(buy.group(1)), buy.group(2).strip(), float(buy.group(3))
        text, n = run_tool("place_order", {"id": name, "side": "buy", "qty": qty, "limit": px}, uid, engine, store)
        return AgentMessage(role="assistant", content=text, tool_calls=[ToolCallCard(name="place_order", args={"id": name, "qty": qty, "limit": px}, result_count=n)])
    if re.search(r"\b(hold|portfolio|kelly|suggest|allocat)\b", message, re.I):
        text, n = run_tool("suggest_portfolio", {}, uid, engine, store)
        return AgentMessage(role="assistant", content=text, tool_calls=[ToolCallCard(name="suggest_portfolio", args={}, result_count=n)])
    text, picks, n = search_companies(engine, store, message)
    if n == 0:
        return AgentMessage(role="assistant", content="Nothing listed that matches. Try a city and a business type.")
    tail = "\n\nWant the order book on one of these?"
    return AgentMessage(
        role="assistant",
        content=text + tail,
        tool_calls=[ToolCallCard(name="search_companies", args={"q": message}, result_count=len(picks))],
    )


async def reply(message: str, uid: str, engine, store) -> AgentMessage:
    if not is_configured("xai"):
        return local_reply(message, uid, engine, store)
    messages: list[dict] = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": message}]
    cards: list[ToolCallCard] = []
    try:
        for _ in range(4):
            result = await complete(messages, tools=TOOLS)
            if not isinstance(result, Completion) or not result.tool_calls:
                content = result.content if isinstance(result, Completion) else str(result)
                return AgentMessage(role="assistant", content=content.strip() or local_reply(message, uid, engine, store).content, tool_calls=cards or None)
            messages.append({
                "role": "assistant",
                "content": result.content or None,
                "tool_calls": [{
                    "id": tc.id, "type": "function",
                    "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
                } for tc in result.tool_calls],
            })
            for tc in result.tool_calls:
                text, n = run_tool(tc.name, tc.arguments, uid, engine, store)
                cards.append(ToolCallCard(name=tc.name, args=tc.arguments, result_count=n))
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": text})
    except Exception:
        return local_reply(message, uid, engine, store)
    return local_reply(message, uid, engine, store)
