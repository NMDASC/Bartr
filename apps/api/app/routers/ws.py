"""WS /ws/markets/{id} at the app root (contract: MarketEvent frames book | batch | trade | flag | halt)."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.deps import engine, hub, store

router = APIRouter()


@router.websocket("/ws/markets/{mid}")
async def ws_market(ws: WebSocket, mid: str):
    if not store.get_market(mid):
        await ws.close(code=4004)
        return
    await ws.accept()
    hub.subscribe(mid, ws)
    try:
        await ws.send_json({"type": "book", "book": engine.book(mid)})
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(mid, ws)
