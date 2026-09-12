"""Acquisition routes. Owner: Zhiyuan. STUBS: replace the bodies, keep the signatures.

Options are out of scope (decision 002), so this is the LOI plus a state and
category specific diligence checklist, each item cited.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.deps import current_user, engine, store
from app.schemas import Acquisition, ChecklistItem

router = APIRouter(prefix="/acquire", tags=["acquire"])


@router.post("/{cid}/start", response_model=Acquisition)
def start(cid: str, uid: str = Depends(current_user)):
    company = store.get_company(cid)
    if not company:
        raise HTTPException(404, "no such company")

    # TODO(Zhiyuan): one Grok call for the LOI filled from the profile, one for
    # the checklist with a web_search citation per item.
    market = store.get_market(cid) or {}
    last = market.get("last_price") or market.get("ref_price")
    price = f"${last * 10_000:,.0f}" if last else "the last clearing price"

    return Acquisition(
        acquisition_id=f"a_{uuid.uuid4().hex[:8]}",
        market_id=cid,
        loi_md=(
            f"# Non-Binding Letter of Intent\n\n"
            f"**Buyer:** {uid}\n"
            f"**Target:** {company['name']}, {company.get('address') or company.get('city', '')}\n\n"
            f"## 1. Proposed consideration\n"
            f"Purchase price of **{price}** for 100 percent of the assets, derived from the "
            f"exchange's last clearing price across 10,000 shares.\n\n"
            f"## 2. Structure\nAsset purchase, free of liens, premises lease assumed subject to "
            f"landlord consent.\n\n"
            f"## 3. Diligence period\n45 days from execution.\n\n"
            f"## 4. Exclusivity\n30 days, no-shop.\n\n"
            f"## 5. Non-binding\nThis letter states intent only.\n\n"
            f"---\n_Play money. Not legal advice._\n"
        ),
        checklist=[
            ChecklistItem(
                item="Obtain landlord consent to lease assignment",
                why="Value is tied to the site. A landlord who can refuse or reset rent erases the multiple.",
            ),
            ChecklistItem(
                item="Run a UCC-1 lien search on the equipment",
                why="Equipment is commonly financed, and liens survive an asset sale unless released at closing.",
            ),
            ChecklistItem(
                item=f"Transfer the {company.get('state') or 'state'} sales tax permit and request a clearance letter",
                why="Many states hold a successor liable for the seller's unpaid sales tax.",
            ),
        ],
        status="draft",
    )
