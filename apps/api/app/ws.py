"""In-process WebSocket fan-out for market events. Owner: Vir (transport),
consumed by Nico's batch scheduler.

RUN WITH ONE UVICORN WORKER. The subscriber registry lives in this process, so
with `--workers 2` a batch cleared in worker A never reaches clients attached
to worker B and half the demo silently stops updating. Plan.md section 4 calls
this out; the Dockerfile pins a single worker.

Publishers call `hub.publish(market_id, "batch", payload)` from anywhere in the
process. No Redis, no broker.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)

EventType = str  # "book" | "batch" | "trade" | "flag"


class Hub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def join(self, market_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[market_id].add(ws)
        log.info("ws join market=%s subscribers=%d", market_id, len(self._rooms[market_id]))

    async def leave(self, market_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[market_id].discard(ws)
            if not self._rooms[market_id]:
                self._rooms.pop(market_id, None)

    def subscriber_count(self, market_id: str) -> int:
        return len(self._rooms.get(market_id, ()))

    async def publish(self, market_id: str, event: EventType, payload: Any) -> None:
        """Broadcast to everyone watching one market. Never raises."""
        async with self._lock:
            targets = list(self._rooms.get(market_id, ()))
        if not targets:
            return
        message = {"type": event, "market_id": market_id, "data": payload}
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001 - a dropped client must not break a batch
                dead.append(ws)
        for ws in dead:
            await self.leave(market_id, ws)


hub = Hub()
