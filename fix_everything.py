"""
fix_everything.py  - run from C:\\pc-dashboard\\
    python fix_everything.py
"""

import os
import subprocess

ROOT     = os.path.dirname(os.path.abspath(__file__))
BACKEND  = os.path.join(ROOT, "backend")
SRC      = os.path.join(ROOT, "frontend", "src")
HOOKS    = os.path.join(SRC, "hooks")
VENV_PIP = os.path.join(BACKEND, ".venv", "Scripts", "pip.exe")
VENV_PY  = os.path.join(BACKEND, ".venv", "Scripts", "python.exe")

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("  OK  " + os.path.relpath(path, ROOT))

print()
print("=" * 60)
print("  PC Dashboard - Master Fix")
print("=" * 60)


# ─────────────────────────────────────────────────────────────
# FIX 1: Remove React StrictMode
# ─────────────────────────────────────────────────────────────
print("\n[1/6] Removing React StrictMode from main.jsx...")

write(os.path.join(SRC, "main.jsx"),
'import { createRoot } from "react-dom/client";\n'
'import "./index.css";\n'
'import App from "./App.jsx";\n'
'\n'
'// StrictMode removed: it double-mounts in dev which causes\n'
'// WebSocket to open, immediately close, then reopen = reconnect loop\n'
'createRoot(document.getElementById("root")).render(<App />);\n'
)


# ─────────────────────────────────────────────────────────────
# FIX 2: Rewrite useWebSocket.js
# ─────────────────────────────────────────────────────────────
print("\n[2/6] Rewriting useWebSocket.js...")

write(os.path.join(HOOKS, "useWebSocket.js"), "\n".join([
"/**",
" * useWebSocket.js - stable version, runs exactly once",
" */",
"",
"import { useEffect, useRef } from \"react\";",
"import { useDashboardStore } from \"../store/useDashboardStore\";",
"",
"const proto   = window.location.protocol === \"https:\" ? \"wss\" : \"ws\";",
"const BASE    = import.meta.env.VITE_WS_BASE_URL || `${proto}://${window.location.host}`;",
"const STATS   = `${BASE}/ws/stats`;",
"const SCREENS = `${BASE}/ws/screenshot`;",
"",
"function createSocket(url, msgRef, onStatus, label) {",
"  let ws = null, backoff = 500, retry = null, ping = null, pingTs = null, alive = true;",
"",
"  function stop() { clearTimeout(retry); clearInterval(ping); retry = null; ping = null; }",
"",
"  function connect() {",
"    if (!alive) return;",
"    if (label === \"stats\") onStatus(\"connecting\");",
"    ws = new WebSocket(url);",
"",
"    ws.onopen = () => {",
"      if (!alive) { ws.close(); return; }",
"      backoff = 500;",
"      if (label === \"stats\") onStatus(\"connected\");",
"      ping = setInterval(() => {",
"        if (ws && ws.readyState === WebSocket.OPEN) {",
"          pingTs = performance.now();",
"          try { ws.send(JSON.stringify({ type: \"ping\" })); } catch(_) {}",
"        }",
"      }, 2000);",
"    };",
"",
"    ws.onmessage = (e) => {",
"      if (!alive) return;",
"      let f; try { f = JSON.parse(e.data); } catch(_) { return; }",
"      if (f.type === \"pong\" && pingTs !== null) {",
"        useDashboardStore.getState().setWsLatency(Math.round(performance.now() - pingTs));",
"        pingTs = null; return;",
"      }",
"      if (f.type === \"heartbeat\") {",
"        useDashboardStore.getState().setLastHeartbeat(Date.now()); return;",
"      }",
"      if (msgRef.current) msgRef.current(f);",
"    };",
"",
"    ws.onerror = () => {};",
"",
"    ws.onclose = () => {",
"      stop();",
"      if (!alive) return;",
"      if (label === \"stats\") onStatus(\"disconnected\");",
"      retry = setTimeout(() => { if (alive) { backoff = Math.min(backoff * 1.5, 5000); connect(); } }, backoff);",
"    };",
"  }",
"",
"  function teardown() {",
"    alive = false; stop();",
"    if (ws) { ws.onclose = null; ws.close(1000, \"teardown\"); ws = null; }",
"    if (label === \"stats\") onStatus(\"disconnected\");",
"  }",
"",
"  connect();",
"  return teardown;",
"}",
"",
"export function useWebSocket() {",
"  const statsRef  = useRef(null);",
"  const screenRef = useRef(null);",
"",
"  statsRef.current = (f) => {",
"    const s = useDashboardStore.getState();",
"    if (f.type === \"snapshot\" && f.data) { s.setSnapshot(f.data); s.pushHistory(f.data); }",
"    else if (f.type === \"discord\" && f.data) { s.setDiscord(f.data.messages ?? [], f.data.bot_status ?? {}); }",
"  };",
"",
"  screenRef.current = (f) => {",
"    const s = useDashboardStore.getState();",
"    if (f.type === \"screenshot\" && f.data) s.setScreenshot(f.data, f.ts);",
"    else if (f.type === \"rdp\" && f.data)   s.setRdp(f.data, f.ts);",
"  };",
"",
"  // Empty deps [] means this runs exactly ONCE on mount",
"  useEffect(() => {",
"    const { setWsStatus } = useDashboardStore.getState();",
"    const t1 = createSocket(STATS,   statsRef,  setWsStatus, \"stats\");",
"    const t2 = createSocket(SCREENS, screenRef, () => {},    \"screenshot\");",
"    return () => { t1(); t2(); };",
"  }, []);",
"}",
""
]))


# ─────────────────────────────────────────────────────────────
# FIX 3: Rewrite main.py
# ─────────────────────────────────────────────────────────────
print("\n[3/6] Rewriting main.py...")

MAIN_PY = [
'"""',
'main.py - FastAPI WebSocket Server',
'"""',
'',
'import asyncio',
'import dataclasses',
'import json',
'import logging',
'import os',
'import time',
'from contextlib import asynccontextmanager',
'from typing import Optional, Set',
'',
'from dotenv import load_dotenv',
'load_dotenv()',
'',
'from fastapi import FastAPI, WebSocket, WebSocketDisconnect',
'from fastapi.middleware.cors import CORSMiddleware',
'from fastapi.responses import JSONResponse',
'',
'from agent import run_agent, AgentSnapshot',
'from discord_bot import start_discord_bot, get_discord_messages, get_bot_status',
'',
'logging.basicConfig(level=logging.INFO,',
'    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")',
'logger = logging.getLogger("main")',
'',
'SCREENSHOT_INTERVAL = float(os.getenv("SCREENSHOT_INTERVAL", "2"))',
'WS_HEARTBEAT        = float(os.getenv("WS_HEARTBEAT", "2"))',
'',
'_latest_snapshot: Optional[AgentSnapshot] = None',
'_agent_queue: asyncio.Queue = asyncio.Queue(maxsize=4)',
'_stats_clients:      Set[WebSocket] = set()',
'_screenshot_clients: Set[WebSocket] = set()',
'',
'',
'def _snap_to_dict(snap: AgentSnapshot) -> dict:',
'    def _cvt(obj):',
'        if dataclasses.is_dataclass(obj):',
'            return {k: _cvt(v) for k, v in dataclasses.asdict(obj).items()}',
'        if isinstance(obj, list):',
'            return [_cvt(i) for i in obj]',
'        return obj',
'    d = _cvt(snap)',
'    d.pop("screenshot_b64", None)',
'    d.pop("rdp_screenshot_b64", None)',
'    return d',
'',
'',
'async def _broadcast(clients: Set[WebSocket], payload: str):',
'    dead = set()',
'    for ws in list(clients):',
'        try:',
'            await ws.send_text(payload)',
'        except Exception:',
'            dead.add(ws)',
'    clients -= dead',
'',
'',
'async def _agent_dispatcher():',
'    global _latest_snapshot',
'    while True:',
'        try:',
'            snap: AgentSnapshot = await _agent_queue.get()',
'            _latest_snapshot = snap',
'            await _broadcast(_stats_clients, json.dumps({',
'                "type": "snapshot", "ts": snap.timestamp,',
'                "data": _snap_to_dict(snap),',
'            }))',
'            if snap.screenshot_b64 and _screenshot_clients:',
'                await _broadcast(_screenshot_clients, json.dumps({',
'                    "type": "screenshot", "ts": snap.timestamp,',
'                    "data": snap.screenshot_b64,',
'                }))',
'            if snap.rdp_screenshot_b64 and _screenshot_clients:',
'                await _broadcast(_screenshot_clients, json.dumps({',
'                    "type": "rdp", "ts": snap.timestamp,',
'                    "data": snap.rdp_screenshot_b64,',
'                }))',
'        except Exception as e:',
'            logger.error(f"Dispatcher error: {e}")',
'',
'',
'async def _heartbeat_task():',
'    while True:',
'        await asyncio.sleep(WS_HEARTBEAT)',
'        p = json.dumps({"type": "heartbeat", "ts": time.time()})',
'        await _broadcast(_stats_clients, p)',
'        await _broadcast(_screenshot_clients, p)',
'',
'',
'async def _discord_push_task():',
'    while True:',
'        await asyncio.sleep(3)',
'        if not _stats_clients:',
'            continue',
'        try:',
'            await _broadcast(_stats_clients, json.dumps({',
'                "type": "discord", "ts": time.time(),',
'                "data": {"messages": get_discord_messages()[:50],',
'                         "bot_status": get_bot_status()},',
'            }))',
'        except Exception as e:',
'            logger.error(f"Discord push error: {e}")',
'',
'',
'@asynccontextmanager',
'async def lifespan(app: FastAPI):',
'    logger.info("Starting PC Dashboard backend...")',
'    loop = asyncio.get_event_loop()',
'    tasks = [',
'        loop.create_task(run_agent(_agent_queue, SCREENSHOT_INTERVAL), name="agent"),',
'        loop.create_task(_agent_dispatcher(),  name="dispatcher"),',
'        loop.create_task(_heartbeat_task(),    name="heartbeat"),',
'        loop.create_task(_discord_push_task(), name="discord-push"),',
'        loop.create_task(start_discord_bot(),  name="discord-bot"),',
'    ]',
'    yield',
'    logger.info("Shutting down...")',
'    for t in tasks: t.cancel()',
'    await asyncio.gather(*tasks, return_exceptions=True)',
'',
'',
'app = FastAPI(title="PC Dashboard", lifespan=lifespan)',
'app.add_middleware(CORSMiddleware,',
'    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])',
'',
'',
'@app.get("/")',
'async def root():',
'    age = round(time.time() - _latest_snapshot.timestamp, 1) if _latest_snapshot else None',
'    return {"status": "ok", "snapshot_age_s": age,',
'            "stats_clients": len(_stats_clients),',
'            "screenshot_clients": len(_screenshot_clients),',
'            "discord": get_bot_status()}',
'',
'@app.get("/api/stats")',
'async def api_stats():',
'    if not _latest_snapshot:',
'        return JSONResponse({"error": "warming up"}, status_code=503)',
'    return _snap_to_dict(_latest_snapshot)',
'',
'@app.get("/api/discord")',
'async def api_discord():',
'    return {"messages": get_discord_messages(), "bot_status": get_bot_status()}',
'',
'',
'@app.websocket("/ws/stats")',
'async def ws_stats(websocket: WebSocket):',
'    await websocket.accept()',
'    _stats_clients.add(websocket)',
'    logger.info(f"Stats WS connected (total={len(_stats_clients)})")',
'    try:',
'        if _latest_snapshot:',
'            await websocket.send_text(json.dumps({',
'                "type": "snapshot", "ts": _latest_snapshot.timestamp,',
'                "data": _snap_to_dict(_latest_snapshot),',
'            }))',
'        await websocket.send_text(json.dumps({',
'            "type": "discord", "ts": time.time(),',
'            "data": {"messages": get_discord_messages()[:50],',
'                     "bot_status": get_bot_status()},',
'        }))',
'    except Exception:',
'        pass',
'    try:',
'        while True:',
'            try:',
'                raw = await asyncio.wait_for(websocket.receive_text(), timeout=15)',
'                if json.loads(raw).get("type") == "ping":',
'                    await websocket.send_text(json.dumps({"type": "pong", "ts": time.time()}))',
'            except asyncio.TimeoutError:',
'                pass',
'    except (WebSocketDisconnect, Exception) as e:',
'        logger.info(f"Stats WS closed ({type(e).__name__})")',
'    finally:',
'        _stats_clients.discard(websocket)',
'',
'',
'@app.websocket("/ws/screenshot")',
'async def ws_screenshot(websocket: WebSocket):',
'    await websocket.accept()',
'    _screenshot_clients.add(websocket)',
'    logger.info(f"Screenshot WS connected (total={len(_screenshot_clients)})")',
'    try:',
'        if _latest_snapshot and _latest_snapshot.screenshot_b64:',
'            await websocket.send_text(json.dumps({',
'                "type": "screenshot", "ts": _latest_snapshot.timestamp,',
'                "data": _latest_snapshot.screenshot_b64,',
'            }))',
'        if _latest_snapshot and _latest_snapshot.rdp_screenshot_b64:',
'            await websocket.send_text(json.dumps({',
'                "type": "rdp", "ts": _latest_snapshot.timestamp,',
'                "data": _latest_snapshot.rdp_screenshot_b64,',
'            }))',
'    except Exception:',
'        pass',
'    try:',
'        while True:',
'            try:',
'                raw = await asyncio.wait_for(websocket.receive_text(), timeout=15)',
'                if json.loads(raw).get("type") == "ping":',
'                    await websocket.send_text(json.dumps({"type": "pong", "ts": time.time()}))',
'            except asyncio.TimeoutError:',
'                pass',
'    except (WebSocketDisconnect, Exception) as e:',
'        logger.info(f"Screenshot WS closed ({type(e).__name__})")',
'    finally:',
'        _screenshot_clients.discard(websocket)',
'',
'',
'if __name__ == "__main__":',
'    import uvicorn',
'    uvicorn.run("main:app",',
'        host=os.getenv("HOST", "0.0.0.0"),',
'        port=int(os.getenv("PORT", "8000")),',
'        reload=False, log_level="info",',
'        ws_ping_interval=10, ws_ping_timeout=20)',
]

write(os.path.join(BACKEND, "main.py"), "\n".join(MAIN_PY) + "\n")


# ─────────────────────────────────────────────────────────────
# FIX 4: Rewrite discord_bot.py
# ─────────────────────────────────────────────────────────────
print("\n[4/6] Rewriting discord_bot.py...")

DISCORD_PY = [
'"""',
'discord_bot.py - compatible with py-cord and discord.py',
'"""',
'',
'import asyncio',
'import logging',
'import os',
'from collections import deque',
'from dataclasses import dataclass, asdict',
'from typing import Optional',
'',
'logger = logging.getLogger("discord_bot")',
'',
'@dataclass',
'class DiscordMessage:',
'    id: str',
'    author: str',
'    author_avatar: Optional[str]',
'    content: str',
'    timestamp: str',
'    attachments: list',
'    reactions: list',
'',
'_store:     deque = deque(maxlen=100)',
'_bot_ready: asyncio.Event = asyncio.Event()',
'_client    = None',
'',
'',
'def get_discord_messages() -> list:',
'    return [asdict(m) for m in reversed(_store)]',
'',
'',
'def get_bot_status() -> dict:',
'    latency = None',
'    if _client and _bot_ready.is_set():',
'        try: latency = round(_client.latency * 1000, 1)',
'        except Exception: pass',
'    return {"ready": _bot_ready.is_set(), "latency_ms": latency,',
'            "message_count": len(_store)}',
'',
'',
'def _build_msg(msg) -> DiscordMessage:',
'    avatar = None',
'    try:',
'        if msg.author.avatar: avatar = str(msg.author.avatar.url)',
'    except Exception: pass',
'    return DiscordMessage(',
'        id=str(msg.id), author=str(msg.author.display_name),',
'        author_avatar=avatar, content=msg.content or "",',
'        timestamp=msg.created_at.isoformat(),',
'        attachments=[a.url for a in msg.attachments],',
'        reactions=[{"emoji": str(r.emoji), "count": r.count} for r in msg.reactions],',
'    )',
'',
'',
'async def start_discord_bot() -> None:',
'    global _client',
'    token   = os.getenv("DISCORD_BOT_TOKEN", "").strip()',
'    ch_str  = os.getenv("DISCORD_CHANNEL_ID", "").strip()',
'    history = int(os.getenv("DISCORD_HISTORY_LIMIT", "50"))',
'',
'    if not token or token == "your_discord_bot_token_here":',
'        logger.warning("DISCORD_BOT_TOKEN not set - Discord disabled.")',
'        return',
'    if not ch_str:',
'        logger.warning("DISCORD_CHANNEL_ID not set - Discord disabled.")',
'        return',
'',
'    ch_id = int(ch_str)',
'',
'    try:',
'        import discord',
'        logger.info(f"Discord lib version: {discord.__version__}")',
'    except ImportError as e:',
'        logger.error(f"Discord import failed: {e}")',
'        logger.error("Run: backend\\\\.venv\\\\Scripts\\\\pip install py-cord==2.6.1")',
'        return',
'',
'    intents = discord.Intents.default()',
'    intents.message_content = True',
'    intents.guilds = True',
'    intents.messages = True',
'',
'    client = discord.Client(intents=intents)',
'    _client = client',
'',
'    @client.event',
'    async def on_ready():',
'        logger.info(f"Discord bot online as {client.user}")',
'        ch = client.get_channel(ch_id)',
'        if ch is None:',
'            try: ch = await client.fetch_channel(ch_id)',
'            except Exception as e:',
'                logger.error(f"Channel {ch_id} not found: {e}")',
'                _bot_ready.set(); return',
'        try:',
'            async for msg in ch.history(limit=history, oldest_first=True):',
'                _store.append(_build_msg(msg))',
'            logger.info(f"Loaded {len(_store)} messages from #{ch.name}")',
'        except Exception as e:',
'            logger.error(f"History error: {e}")',
'        _bot_ready.set()',
'',
'    @client.event',
'    async def on_message(message):',
'        if message.channel.id == ch_id:',
'            _store.append(_build_msg(message))',
'',
'    logger.info("Connecting Discord bot...")',
'    try:',
'        await client.start(token)',
'    except Exception as e:',
'        logger.error(f"Discord bot failed: {type(e).__name__}: {e}")',
]

write(os.path.join(BACKEND, "discord_bot.py"), "\n".join(DISCORD_PY) + "\n")


# ─────────────────────────────────────────────────────────────
# FIX 5: Reinstall py-cord
# ─────────────────────────────────────────────────────────────
print("\n[5/6] Reinstalling Discord library (py-cord)...")

if not os.path.exists(VENV_PIP):
    print("  ERROR: venv not found. Run setup.bat first.")
else:
    for pkg in ["discord.py", "py-cord", "discord"]:
        subprocess.run([VENV_PIP, "uninstall", pkg, "-y"], capture_output=True)

    r = subprocess.run([VENV_PIP, "install", "py-cord==2.6.1"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        print("  py-cord 2.6.1 installed OK")
    else:
        print("  ERROR: " + r.stderr[-300:])

    r2 = subprocess.run(
        [VENV_PY, "-c", "import discord; print('  discord import OK, version:', discord.__version__)"],
        capture_output=True, text=True)
    if r2.returncode == 0:
        print(r2.stdout.strip())
    else:
        print("  Import test FAILED: " + r2.stderr.strip())


# ─────────────────────────────────────────────────────────────
# FIX 6: Update .env intervals
# ─────────────────────────────────────────────────────────────
print("\n[6/6] Updating .env...")

env_path = os.path.join(BACKEND, ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    new_lines = []
    has_i = has_h = False
    for line in lines:
        if line.startswith("SCREENSHOT_INTERVAL="):
            new_lines.append("SCREENSHOT_INTERVAL=2\n"); has_i = True
        elif line.startswith("WS_HEARTBEAT="):
            new_lines.append("WS_HEARTBEAT=2\n"); has_h = True
        else:
            new_lines.append(line)
    if not has_i: new_lines.append("SCREENSHOT_INTERVAL=2\n")
    if not has_h: new_lines.append("WS_HEARTBEAT=2\n")
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("  .env updated. Discord settings:")
    for line in new_lines:
        if line.startswith("DISCORD_"):
            k, _, v = line.strip().partition("=")
            if "TOKEN" in k and len(v) > 14:
                v = v[:10] + "..." + v[-4:]
            print(f"    {k}={v}")
else:
    print("  .env not found - run setup.bat first")


print()
print("=" * 60)
print("  ALL FIXES DONE!")
print()
print("  What was fixed:")
print("    1. StrictMode removed  (was causing reconnect loop)")
print("    2. WebSocket rewritten (stable, 500ms reconnect)")
print("    3. main.py rewritten   (clean broadcast, no collisions)")
print("    4. discord_bot.py      (py-cord compatible)")
print("    5. py-cord 2.6.1       (Python 3.13 compatible)")
print("    6. .env intervals      (2 second refresh)")
print()
print("  -> Double-click Startup_start.bat to launch")
print("  -> Open http://localhost:3000")
print("=" * 60)
input("\nPress Enter to close...")
