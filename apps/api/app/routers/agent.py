"""Chat agent. Owner: Zhiyuan. STUB: replace the body, keep the signature.

Transport agnostic and deliberately not streaming: decision 006 requires a JSON
terminal response because `apps/imessage` cannot consume a token stream. It
posts here with `session_id` and `X-Demo-User` both set to the sender's phone,
and reads `{content, tool_calls?}`.

Replies are short plain lines with no markdown, since the same text renders in
a chat bubble.
"""

from fastapi import APIRouter, Depends

from app.deps import current_user, engine, store
from app.schemas import AgentChatRequest, AgentMessage, ToolCallCard

router = APIRouter(prefix="/agent", tags=["agent"])

TOOLS = ("search_companies", "get_company", "get_book", "place_order", "suggest_portfolio")


@router.post("/chat", response_model=AgentMessage)
def chat(body: AgentChatRequest, uid: str = Depends(current_user)):
    # TODO(Zhiyuan): llm.complete with these tools, loop on tool calls, keep
    # session state keyed by session_id.
    companies = store.list_companies()
    if not companies:
        return AgentMessage(role="assistant", content="Nothing listed yet.")

    picks = companies[:3]
    lines = []
    for c in picks:
        market = store.get_market(c["id"]) or {}
        last = market.get("last_price") or market.get("ref_price")
        where = c.get("city") or c.get("state") or ""
        value = f"${(last * 10_000):,.0f}" if last else "not yet priced"
        per_share = f", last ${last:,.2f}" if last else ""
        lines.append(f"{c['name']}, {where}. {value}{per_share}.")

    lines.append("")
    lines.append("Want the order book on one of these?")

    return AgentMessage(
        role="assistant",
        content="\n".join(lines),
        tool_calls=[
            ToolCallCard(name="search_companies", args={"q": body.message}, result_count=len(picks))
        ],
    )
