"""WebSocket hub: per market subscribers, in process. One uvicorn worker."""
from __future__ import annotations

import asyncio
import json


class Hub:
    def __init__(self):
        self.subs: dict[str, set] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        """Remember the server loop, so engine code on a worker thread can still publish."""
        self.loop = loop

    def subscribe(self, mid: str, ws) -> None:
        self.subs.setdefault(mid, set()).add(ws)

    def unsubscribe(self, mid: str, ws) -> None:
        self.subs.get(mid, set()).discard(ws)

    def publish(self, mid: str, event: dict) -> None:
        """Called from sync engine code, on the event loop (async handlers) or on a worker
        thread (sync handlers in the threadpool, the scheduler's tick). Sends are always
        scheduled on the server loop. Outside a server (tests, scripts) it is a no-op."""
        conns = list(self.subs.get(mid, ()))
        if not conns:
            return
        msg = json.dumps(event, default=float)
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop is not None:
            for ws in conns:
                loop.create_task(self._send(ws, msg))
            return
        server = self.loop
        if server is None or server.is_closed():
            return
        for ws in conns:
            server.call_soon_threadsafe(self._spawn, ws, msg)

    def _spawn(self, ws, msg: str) -> None:
        asyncio.get_running_loop().create_task(self._send(ws, msg))

    async def _send(self, ws, msg: str) -> None:
        try:
            await ws.send_text(msg)
        except Exception:
            for mid, conns in self.subs.items():
                conns.discard(ws)
