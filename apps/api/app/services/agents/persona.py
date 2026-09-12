"""Owner persona (Backlog: talk to the AI version of the company). Grok answers as the owner,
grounded in the profile, valuation and sources on file, and says so when something is not on file."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.agents import grok

SYSTEM = ("You are role playing the owner of a specific small business, answering a prospective buyer's questions before a call. "
          "You know only what is in the FILE below. If the answer is not in the file, say 'that is not in my file' and suggest what "
          "document the buyer should ask for. Never invent revenue, profit, leases, or names. Speak in first person, warm, brief, no markdown. "
          "Set grounded=false whenever any part of the answer goes beyond the file.")


class Answer(BaseModel):
    answer: str
    grounded: bool
    used: list[str] = Field(default_factory=list, description="which file fields or source URLs the answer used")


def _file(c: dict, m: dict | None) -> str:
    o = c["observables"]
    v = c["valuation"]
    lines = [f"Name: {c['name']}", f"Category: {c['category']}", f"Address: {c.get('address')}, {c.get('city')}, {c.get('state')}",
             f"Owners: {c.get('owners')}", f"Description: {c.get('description')}", f"Website: {c.get('website')}",
             f"Revenue on file: {o.get('revenue')}", f"SDE on file: {o.get('sde')}", f"Asking price on file: {o.get('asking_price')}",
             f"Employees: {o.get('employees')}", f"Years operating: {o.get('years_operating')}", f"Rating: {o.get('rating')} from {o.get('review_count')} reviews",
             f"Model valuation: ${v['v0']:,.0f} (range ${v['low']:,.0f} to ${v['high']:,.0f}), method {v['method']}",
             f"Estimator notes: {[e['note'] for e in v['estimates']]}", f"Sources: {o.get('sources')}"]
    if m:
        lines.append(f"Market: last ${m['last_price']}, owner floor ${m['treasury']['floor_price']}, unsold float {m['treasury']['unsold_float']:.0f} of 10,000 shares")
    return "\n".join(lines)


def fallback(c: dict, question: str) -> dict:
    o = c["observables"]
    ql = question.lower()
    if "revenue" in ql or "make" in ql or "sales" in ql:
        a = f"Revenue on file is ${o['revenue']:,.0f} a year." if o.get("revenue") else "Revenue is not in my file. Ask for three years of tax returns."
    elif "profit" in ql or "earn" in ql or "cash flow" in ql or "sde" in ql:
        a = f"Owner's discretionary earnings on file are ${o['sde']:,.0f}." if o.get("sde") else "Earnings are not in my file. Ask for the P&L."
    elif "why" in ql and "sell" in ql:
        a = "That is not in my file. It is the first question to ask on the call."
    elif "long" in ql or "since" in ql or "year" in ql:
        a = f"About {o['years_operating']} years." if o.get("years_operating") else "Tenure is not in my file."
    else:
        a = c.get("description") or "That is not in my file."
    return {"answer": a, "grounded": True, "used": ["file"]}


async def ask(c: dict, m: dict | None, question: str, history: list[dict] | None = None) -> dict:
    convo = "\n".join(f"{h['role']}: {h['content']}" for h in (history or [])[-6:])
    user = f"FILE:\n{_file(c, m)}\n\nConversation so far:\n{convo}\n\nBuyer asks: {question}"
    out = await grok.structured("persona", Answer, SYSTEM, user, temperature=0.5, cache=False)
    if out is None:
        return {**fallback(c, question), "reviewer": "fallback"}
    return {**out.model_dump(), "reviewer": "grok"}
