"""Offers on discovered businesses (not yet on the exchange)."""
import time

from fastapi import APIRouter, Depends, HTTPException

from app import views
from app.deps import current_user, engine, store
from app.schemas import Offer, OfferIn
from app.services import offers as svc

router = APIRouter(tags=["offers"])


def _out(o: dict) -> dict:
    return {**o, "_id": o["id"], "created_at": views.iso(o["created_at"])}


@router.post("/companies/{cid}/offer", response_model=Offer, status_code=201, response_model_by_alias=True)
def make_offer(cid: str, body: OfferIn, uid: str = Depends(current_user)):
    """Buyer asks to buy a discovered business. We write to the owner. Returns the letter as sent or queued."""
    c = store.get_company(cid)
    if not c:
        raise HTTPException(404, "no such company")
    if c.get("listed", True):
        raise HTTPException(409, "this business is on the exchange: buy shares or use the acquire flow")
    if body.price is not None and not (0.2 * c["valuation"]["v0"] <= body.price <= 5 * c["valuation"]["v0"]):
        raise HTTPException(422, "price must be within 0.2x to 5x of our estimate")
    o = svc.make_offer(store, c, uid, body.buyer_name, body.buyer_email, body.buyer_phone, body.price, body.message, body.owner_email)
    return _out(o)


@router.get("/offers/mine", response_model=list[Offer], response_model_by_alias=True)
def my_offers(uid: str = Depends(current_user)):
    return [_out(o) for o in store.list_offers(user_id=uid)]


@router.get("/offers/{oid}", response_model=Offer, response_model_by_alias=True)
def get_offer(oid: str):
    o = store.get_offer(oid)
    if not o:
        raise HTTPException(404, "no such offer")
    return _out(o)


@router.post("/offers/{oid}/accept", response_model=Offer, response_model_by_alias=True)
def accept(oid: str):
    """Demo: the owner accepts. The business lists on the exchange with quotes from the current posterior."""
    o = store.get_offer(oid)
    if not o:
        raise HTTPException(404, "no such offer")
    o["status"] = "accepted"
    o["accepted_at"] = time.time()
    store.put_offer(o)
    engine.list_on_exchange(o["company_id"])
    return _out(o)


@router.post("/offers/{oid}/decline", response_model=Offer, response_model_by_alias=True)
def decline(oid: str):
    o = store.get_offer(oid)
    if not o:
        raise HTTPException(404, "no such offer")
    o["status"] = "declined"
    store.put_offer(o)
    return _out(o)
