from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.deps import current_user, engine, hub, store
from app.schemas import BatchOut, BookOut, MarketOut, OrderIn, OrderOut, TradeOut

router = APIRouter(prefix="/markets", tags=["markets"])


def _market(mid: str) -> dict:
    m = store.get_market(mid)
    if not m:
        raise HTTPException(404, "no such market")
    return m


@router.get("/{mid}", response_model=MarketOut)
def get_market(mid: str):
    return engine.market_out(_market(mid))


@router.get("/{mid}/book", response_model=BookOut)
def get_book(mid: str):
    _market(mid)
    return engine.book(mid)


@router.post("/{mid}/orders", response_model=OrderOut, status_code=201)
def place_order(mid: str, body: OrderIn, uid: str = Depends(current_user)):
    _market(mid)
    o = engine.place_order(uid, mid, body.side, body.qty, body.limit_price)
    if o["status"] == "rejected":
        raise HTTPException(422, o["reason"])
    return o


@router.get("/{mid}/orders/mine", response_model=list[OrderOut])
def my_orders(mid: str, uid: str = Depends(current_user)):
    return sorted(store.user_orders(uid, mid), key=lambda o: -o["created_at"])[:50]


@router.delete("/orders/{oid}", response_model=OrderOut)
def cancel_order(oid: str, uid: str = Depends(current_user)):
    try:
        return engine.cancel_order(uid, oid)
    except KeyError:
        raise HTTPException(404, "no such order")


@router.get("/{mid}/batches", response_model=list[BatchOut])
def batches(mid: str, limit: int = 50):
    _market(mid)
    return store.batches(mid, limit)


@router.get("/{mid}/trades", response_model=list[TradeOut])
def trades(mid: str, limit: int = 50):
    _market(mid)
    return store.trades(mid, limit)


@router.post("/{mid}/batch/run", response_model=BatchOut)
def run_batch_now(mid: str):
    """Force a round to clear now. Demo and test convenience."""
    _market(mid)
    return engine.run_batch(mid)


@router.websocket("/ws/{mid}")
async def ws_market(ws: WebSocket, mid: str):
    if not store.get_market(mid):
        await ws.close(code=4004)
        return
    await ws.accept()
    hub.subscribe(mid, ws)
    try:
        await ws.send_json({"type": "book", "book": engine.book(mid)})
        while True:
            await ws.receive_text()  # keepalive / ignore client messages
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(mid, ws)
