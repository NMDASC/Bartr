"""Market routes. Owner: Nico. STUBS -- replace bodies, keep signatures.

`place_order` echoes a constructed order so the order ticket round-trips in the
UI before the engine exists. The WebSocket route is transport only; publish
into it from the batch scheduler with `hub.publish(...)`.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Response, WebSocket, WebSocketDisconnect, status

from ..examples import example
from ..identity import get_current_user
from ..schemas import Batch, Book, Order, OrderRequest, OrderStatus, Trade
from ..ws import hub

router = APIRouter(tags=["market"])
ws_router = APIRouter()


@router.get("/markets/{market_id}/book", response_model=Book)
async def get_book(market_id: str) -> dict:
    # TODO(Nico): aggregate open orders + house quotes into levels.
    return {**example("book"), "market_id": market_id}


@router.post("/markets/{market_id}/orders", response_model=Order, status_code=status.HTTP_201_CREATED)
async def place_order(
    market_id: str,
    body: OrderRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict:
    # TODO(Nico): persist, enforce section 8.5 limits, queue for next batch.
    return {
        "id": f"ord_{uuid.uuid4().hex[:12]}",
        "market_id": market_id,
        "user_id": str(user["_id"]),
        "side": body.side,
        "qty": body.qty,
        "limit_price": body.limit_price,
        "status": OrderStatus.open,
        "filled_qty": 0,
        "origin": "user",
        "created_at": datetime.now(timezone.utc),
    }


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_order(
    order_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    # TODO(Nico): cancel is an append-only event, not an update (section 8.5).
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/markets/{market_id}/batches", response_model=list[Batch])
async def list_batches(market_id: str, limit: int = 50) -> list[dict]:
    # TODO(Nico): price history for the chart.
    return [{**b, "market_id": market_id} for b in example("batches")][:limit]


@router.get("/markets/{market_id}/trades", response_model=list[Trade])
async def list_trades(market_id: str, limit: int = 50) -> list[dict]:
    # TODO(Nico): the tape.
    return [{**t, "market_id": market_id} for t in example("trades")][:limit]


@ws_router.websocket("/ws/markets/{market_id}")
async def market_socket(websocket: WebSocket, market_id: str) -> None:
    await hub.join(market_id, websocket)
    try:
        await websocket.send_json(
            {"type": "book", "market_id": market_id, "data": {**example("book"), "market_id": market_id}}
        )
        while True:
            # Client sends nothing; this keeps the connection open and detects drops.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(market_id, websocket)
