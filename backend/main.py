"""
main.py - FastAPI WebSocket Server
"""

import asyncio
import dataclasses
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional, Set

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agent import run_agent, AgentSnapshot
from discord_bot import start_discord_bot, get_discord_messages, get_bot_status

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("main")

SCREENSHOT_INTERVAL = float(os.getenv("SCREENSHOT_INTERVAL", "2"))
WS_HEARTBEAT        = float(os.getenv("WS_HEARTBEAT", "2"))

_latest_snapshot: Optional[AgentSnapshot] = None
_agent_queue: asyncio.Queue = asyncio.Queue(maxsize=4)
_stats_clients:      Set[WebSocket] = set()
_screenshot_clients: Set[WebSocket] = set()


def _snap_to_dict(snap: AgentSnapshot) -> dict:
    def _cvt(obj):
        if dataclasses.is_dataclass(obj):
            return {k: _cvt(v) for k, v in dataclasses.asdict(obj).items()}
        if isinstance(obj, list):
            return [_cvt(i) for i in obj]
        return obj
    d = _cvt(snap)
    d.pop("screenshot_b64", None)
    d.pop("rdp_screenshot_b64", None)
    return d


async def _broadcast(clients: Set[WebSocket], payload: str):
    dead = set()
    for ws in list(clients):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    clients -= dead


async def _agent_dispatcher():
    global _latest_snapshot
    while True:
        try:
            snap: AgentSnapshot = await _agent_queue.get()
            _latest_snapshot = snap
            await _broadcast(_stats_clients, json.dumps({
                "type": "snapshot", "ts": snap.timestamp,
                "data": _snap_to_dict(snap),
            }))
            if snap.screenshot_b64 and _screenshot_clients:
                await _broadcast(_screenshot_clients, json.dumps({
                    "type": "screenshot", "ts": snap.timestamp,
                    "data": snap.screenshot_b64,
                }))
            if snap.rdp_screenshot_b64 and _screenshot_clients:
                await _broadcast(_screenshot_clients, json.dumps({
                    "type": "rdp", "ts": snap.timestamp,
                    "data": snap.rdp_screenshot_b64,
                }))
        except Exception as e:
            logger.error(f"Dispatcher error: {e}")


async def _heartbeat_task():
    while True:
        await asyncio.sleep(WS_HEARTBEAT)
        p = json.dumps({"type": "heartbeat", "ts": time.time()})
        await _broadcast(_stats_clients, p)
        await _broadcast(_screenshot_clients, p)


async def _discord_push_task():
    while True:
        await asyncio.sleep(3)
        if not _stats_clients:
            continue
        try:
            await _broadcast(_stats_clients, json.dumps({
                "type": "discord", "ts": time.time(),
                "data": {"messages": get_discord_messages()[:50],
                         "bot_status": get_bot_status()},
            }))
        except Exception as e:
            logger.error(f"Discord push error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PC Dashboard backend...")
    loop = asyncio.get_event_loop()
    tasks = [
        loop.create_task(run_agent(_agent_queue, SCREENSHOT_INTERVAL), name="agent"),
        loop.create_task(_agent_dispatcher(),  name="dispatcher"),
        loop.create_task(_heartbeat_task(),    name="heartbeat"),
        loop.create_task(_discord_push_task(), name="discord-push"),
        loop.create_task(start_discord_bot(),  name="discord-bot"),
    ]
    yield
    logger.info("Shutting down...")
    for t in tasks: t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="PC Dashboard", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
async def root():
    age = round(time.time() - _latest_snapshot.timestamp, 1) if _latest_snapshot else None
    return {"status": "ok", "snapshot_age_s": age,
            "stats_clients": len(_stats_clients),
            "screenshot_clients": len(_screenshot_clients),
            "discord": get_bot_status()}

@app.get("/api/stats")
async def api_stats():
    if not _latest_snapshot:
        return JSONResponse({"error": "warming up"}, status_code=503)
    return _snap_to_dict(_latest_snapshot)

@app.get("/api/discord")
async def api_discord():
    return {"messages": get_discord_messages(), "bot_status": get_bot_status()}


@app.websocket("/ws/stats")
async def ws_stats(websocket: WebSocket):
    await websocket.accept()
    _stats_clients.add(websocket)
    logger.info(f"Stats WS connected (total={len(_stats_clients)})")
    try:
        if _latest_snapshot:
            await websocket.send_text(json.dumps({
                "type": "snapshot", "ts": _latest_snapshot.timestamp,
                "data": _snap_to_dict(_latest_snapshot),
            }))
        await websocket.send_text(json.dumps({
            "type": "discord", "ts": time.time(),
            "data": {"messages": get_discord_messages()[:50],
                     "bot_status": get_bot_status()},
        }))
    except Exception:
        pass
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=15)
                if json.loads(raw).get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": time.time()}))
            except asyncio.TimeoutError:
                pass
    except (WebSocketDisconnect, Exception) as e:
        logger.info(f"Stats WS closed ({type(e).__name__})")
    finally:
        _stats_clients.discard(websocket)


@app.websocket("/ws/screenshot")
async def ws_screenshot(websocket: WebSocket):
    await websocket.accept()
    _screenshot_clients.add(websocket)
    logger.info(f"Screenshot WS connected (total={len(_screenshot_clients)})")
    try:
        if _latest_snapshot and _latest_snapshot.screenshot_b64:
            await websocket.send_text(json.dumps({
                "type": "screenshot", "ts": _latest_snapshot.timestamp,
                "data": _latest_snapshot.screenshot_b64,
            }))
        if _latest_snapshot and _latest_snapshot.rdp_screenshot_b64:
            await websocket.send_text(json.dumps({
                "type": "rdp", "ts": _latest_snapshot.timestamp,
                "data": _latest_snapshot.rdp_screenshot_b64,
            }))
    except Exception:
        pass
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=15)
                if json.loads(raw).get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "ts": time.time()}))
            except asyncio.TimeoutError:
                pass
    except (WebSocketDisconnect, Exception) as e:
        logger.info(f"Screenshot WS closed ({type(e).__name__})")
    finally:
        _screenshot_clients.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=False, log_level="info",
        ws_ping_interval=10, ws_ping_timeout=20)
