"""Chat agent. Owner: Zhiyuan. STUB: replace the body, keep the signature.

Transport agnostic, and deliberately NOT streaming: decision 006 requires a
JSON terminal response because the iMessage bridge cannot consume a token
stream. The web chat page and the bridge hit this same endpoint, with
`session_id` the Auth0 sub on web and an E.164 phone over iMessage.
"""

from fastapi import APIRouter, Depends

from app.deps import current_user, engine, store
from app.schemas import AgentChatRequest, AgentMessage, ToolCallCard

router = APIRouter(prefix="/agent", tags=["agent"])

TOOLS = ("search_companies", "get_company", "get_book", "place_order", "suggest_portfolio")


@router.post("/chat", response_model=AgentMessage)
def chat(body: AgentChatRequest, uid: str = Depends(current_user)):
    # TODO(Zhiyuan): llm.complete with these tools, loop on tool calls, keep
    # session state keyed by session_id. Replies must stay short lines with no
    # markdown so they read well over iMessage.
    companies = store.list_companies()[:3]
    if not companies:
        return AgentMessage(role="assistant", content="No companies loaded yet. Try a search first.")

    lines = ["Three to look at.", ""]
    for c in companies:
        card = engine.card(c)
        last = card.get("last_price")
        price = f"last ${last:,.2f}/share" if last else "no trades yet"
        lines.append(f"{c['name']}, {c.get('city', '')}. {price}.")
    lines += ["", "Want the order book on one of them?"]

    return AgentMessage(
        role="assistant",
        content="\n".join(lines),
        tool_calls=[
            ToolCallCard(
                name="search_companies",
                args={"q": body.message},
                result_count=len(companies),
            )
        ],
    )
