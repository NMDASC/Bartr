"""WebSocket hub: per market subscribers, in process. One uvicorn worker."""
from __future__ import annotations

import asyncio
import json


class Hub:
    def __init__(self):
        self.subs: dict[str, set] = {}

    def subscribe(self, mid: str, ws) -> None:
        self.subs.setdefault(mid, set()).add(ws)

    def unsubscribe(self, mid: str, ws) -> None:
        self.subs.get(mid, set()).discard(ws)

    def publish(self, mid: str, event: dict) -> None:
        """Called from sync engine code that runs inside the event loop (handlers, scheduler).
        Outside a loop (tests, scripts) it is a no-op."""
        conns = list(self.subs.get(mid, ()))
        if not conns:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        msg = json.dumps(event, default=float)
        for ws in conns:
            loop.create_task(self._send(ws, msg))

    async def _send(self, ws, msg: str) -> None:
        try:
            await ws.send_text(msg)
        except Exception:
            for mid, conns in self.subs.items():
                conns.discard(ws)
