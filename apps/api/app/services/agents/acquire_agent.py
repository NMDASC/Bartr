"""Acquisition documents with Grok: LOI drafted from the profile, checklist researched on the web
with citations. routers/acquire.py keeps its templates as the fallback."""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.services.agents import grok

LOI_SYSTEM = ("Draft a non-binding letter of intent in markdown for an asset purchase of a small business. Sections: title line "
              "'# Non-Binding Letter of Intent', Buyer, Seller, Target, Date, then numbered sections 1 Proposed consideration, 2 Structure, "
              "3 Diligence period, 4 Exclusivity, 5 Transition, 6 Non-binding, 7 Confidentiality. Use the exact price given. "
              "Tailor section 2 and 3 to the business type (what assets, what records). No disclaimers, no placeholders in brackets.")

CHECK_SYSTEM = ("You turn research notes into a due diligence checklist for buying a specific small business in a specific city and state. "
                "8 to 12 items. Each item names one concrete document, permit, license, filing or check; `why` says what goes wrong if skipped; "
                "`citation` is a URL and title taken from the notes (null if none). Put jurisdiction specific items first.")


class Citation(BaseModel):
    url: str
    title: str


class Item(BaseModel):
    item: str
    why: str
    citation: Citation | None = None


class Checklist(BaseModel):
    items: list[Item] = Field(min_length=4)


async def loi(c: dict, buyer: str, seller: str, where: str, price_per_share: float, total: float, date_str: str) -> str | None:
    user = (f"Buyer: {buyer}\nSeller: {seller}, owner of {c['name']}\nTarget: {c['name']}, {where}\nDate: {date_str}\n"
            f"Business type: {c['category']}. Description: {c.get('description')}\n"
            f"Price: ${total:,.0f} for 100 percent of the assets, from the exchange's last clearing price of ${price_per_share:.2f} per share across 10,000 shares.")
    out = await grok.text("loi", LOI_SYSTEM, user, temperature=0.3)
    return out.strip() if out and out.strip().startswith("#") else None


async def checklist(c: dict) -> list[dict] | None:
    q = (f"What permits, licenses, tax clearances, filings and inspections does a buyer need to transfer or obtain when buying a "
         f"{c['category'].replace('_', ' ')} business in {c.get('city')}, {c.get('state')} (asset purchase)? Include city, county and state "
         f"requirements with the official URLs (city finance department, county health department, state department of revenue and "
         f"secretary of state), plus industry specific items.")
    notes = await grok.researched("checklist.research", q)
    if not notes:
        return None
    out = await grok.structured("checklist", Checklist, CHECK_SYSTEM,
                                f"Business: {c['name']}, {c['category']}, {c.get('city')}, {c.get('state')}.\n\nNotes:\n{notes[:12000]}")
    if out is None:
        return None
    return [{"item": i.item, "why": i.why, "citation": i.citation.model_dump() if i.citation else None, "done": False} for i in out.items]
