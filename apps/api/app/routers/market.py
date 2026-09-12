from fastapi import APIRouter, Depends, HTTPException

from app import views
from app.deps import current_user, engine, store
from app.schemas import Batch, Book, MarketSummary, Order, OrderIn, Trade

router = APIRouter(prefix="/markets", tags=["markets"])


def _market(mid: str) -> dict:
    m = store.get_market(mid)
    if not m:
        raise HTTPException(404, "no such market")
    return m


@router.get("/{mid}", response_model=MarketSummary)
def get_market(mid: str):
    return engine.market_out(_market(mid))


@router.get("/{mid}/book", response_model=Book)
def get_book(mid: str):
    _market(mid)
    return engine.book(mid)


@router.post("/{mid}/orders", response_model=Order, status_code=201, response_model_by_alias=True)
def place_order(mid: str, body: OrderIn, uid: str = Depends(current_user)):
    _market(mid)
    o = engine.place_order(uid, mid, body.side, body.qty, body.limit_price)
    if o["status"] == "rejected":
        raise HTTPException(422, o["reason"])
    return views.order(o)


@router.get("/{mid}/orders/mine", response_model=list[Order], response_model_by_alias=True)
def my_orders(mid: str, uid: str = Depends(current_user)):
    os_ = [o for o in store.user_orders(uid, mid) if o["status"] != "rejected"]
    return [views.order(o) for o in sorted(os_, key=lambda o: -o["created_at"])[:50]]


@router.delete("/orders/{oid}", response_model=Order, response_model_by_alias=True)
def cancel_order(oid: str, uid: str = Depends(current_user)):
    try:
        return views.order(engine.cancel_order(uid, oid))
    except KeyError:
        raise HTTPException(404, "no such order")


@router.get("/{mid}/batches", response_model=list[Batch], response_model_by_alias=True)
def batches(mid: str, limit: int = 60, snapshot: bool = False):
    _market(mid)
    return [views.batch(b, snapshot) for b in store.batches(mid, limit)]


@router.get("/{mid}/trades", response_model=list[Trade], response_model_by_alias=True)
def trades(mid: str, limit: int = 50):
    _market(mid)
    return [views.trade(t) for t in store.trades(mid, limit)]


@router.post("/{mid}/batch/run", response_model=Batch, response_model_by_alias=True)
def run_batch_now(mid: str):
    """Force a round to clear now. Demo and test convenience."""
    _market(mid)
    return views.batch(engine.run_batch(mid), True)
