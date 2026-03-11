# 🖥️ PC Monitoring Dashboard

A real-time system monitoring dashboard with a **Dark Glassmorphism** React frontend, FastAPI + WebSocket backend, Discord integration, and Cloudflare Tunnel deployment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐   ┌────────────┐ │
│  │  Python Backend  │    │  React Frontend   │   │ cloudflared│ │
│  │  (FastAPI)       │◄──►│  (nginx + Vite)   │◄──│  Tunnel    │ │
│  │                  │    │                   │   │            │ │
│  │  • psutil stats  │    │  • Glassmorphism  │   │ Public URL │ │
│  │  • mss screenshots│   │  • Framer Motion  │   └────────────┘ │
│  │  • discord.py    │    │  • Recharts       │                  │
│  │  • WebSocket WS  │    │  • Zustand store  │                  │
│  └─────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Features

| Module | Description |
|--------|-------------|
| **PC Stats** | CPU (per-core bars, temp, load avg), RAM + swap, Disk I/O, Network rates, Top processes |
| **RDP Feed** | Live full-screen + RDP-window-crop screenshots at 3-second intervals |
| **Terminals** | Active window/terminal title enumeration with auto-categorisation |
| **Discord** | Real-time channel message feed with avatars, reactions, attachments |

All modules can be toggled on/off from the top navigation bar. New modules are added by dropping in a component and registering a tab.

---

## Quick Start (Local, No Docker)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Discord token and channel ID

python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python main.py
# Server starts at http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App starts at http://localhost:3000
```

---

## Docker Compose Deployment

### Prerequisites

- Docker + Docker Compose v2
- A Cloudflare account with a domain (for tunnel)
- A display session or X11 socket (for screenshots)

### Step 1: Configure Environment

```bash
cd backend
cp .env.example .env
# Fill in:
#   DISCORD_BOT_TOKEN=<your bot token>
#   DISCORD_CHANNEL_ID=<channel snowflake ID>
```

### Step 2: Set Up Cloudflare Tunnel

```bash
# Authenticate
cloudflared login

# Create the tunnel
cloudflared tunnel create pc-dashboard
# → Outputs a UUID like: a1b2c3d4-e5f6-...

# Copy credentials JSON into the cloudflared/ directory
cp ~/.cloudflared/<UUID>.json cloudflared/credentials.json

# Edit cloudflared/config.yml:
#   Replace YOUR_TUNNEL_UUID with the UUID
#   Replace your.domain.com with your actual domain

# Add DNS record in Cloudflare dashboard:
#   Type: CNAME
#   Name: dashboard
#   Target: <UUID>.cfargotunnel.com
#   Proxied: ✓
```

### Step 3: X11 Socket (Linux screenshot access)

```bash
# Allow Docker containers to use your display
xhost +local:docker

# Verify your DISPLAY is set
echo $DISPLAY   # typically :0 or :1
```

### Step 4: Launch

```bash
docker compose up --build
```

The dashboard will be available at:
- **Local**: http://localhost:3000
- **Public**: https://dashboard.your.domain.com (via cloudflared)

---

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new Application → Bot
3. Enable **Message Content Intent** under Bot → Privileged Gateway Intents
4. Copy the bot token → `DISCORD_BOT_TOKEN` in `.env`
5. Invite the bot to your server with `Read Messages` + `Read Message History` permissions
6. Copy the channel ID (right-click channel → Copy ID) → `DISCORD_CHANNEL_ID`

---

## Adding a New Module

1. **Create the component:**
   ```jsx
   // frontend/src/components/MyModule.jsx
   export default function MyModule() {
     return <div>Hello from my module</div>;
   }
   ```

2. **Register the tab** in `store/useDashboardStore.js`:
   ```js
   const DEFAULT_TABS = [
     // ... existing tabs ...
     { id: "my_module", label: "My Module", icon: "cpu", visible: true },
   ];
   ```

3. **Map the component** in `App.jsx`:
   ```js
   const TAB_COMPONENTS = {
     // ... existing ...
     my_module: MyModule,
   };
   ```

Or at **runtime** (no rebuild needed):
```js
useDashboardStore.getState().registerTab({
  id: "my_module",
  label: "My Module",
  icon: "cpu",
  visible: true,
});
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | — | Discord bot token |
| `DISCORD_CHANNEL_ID` | — | Channel to read from |
| `DISCORD_HISTORY_LIMIT` | `50` | Messages to fetch on startup |
| `SCREENSHOT_INTERVAL` | `3` | Seconds between screenshots |
| `WS_HEARTBEAT` | `5` | WebSocket heartbeat interval |
| `HOST` | `0.0.0.0` | FastAPI bind host |
| `PORT` | `8000` | FastAPI bind port |
| `RDP_WINDOW_TITLE` | `Remote Desktop` | Substring to find RDP window |

---

## WebSocket API

### `/ws/stats`
Receives JSON frames:

```json
{ "type": "snapshot", "ts": 1720000000, "data": { "cpu": {...}, "ram": {...}, ... } }
{ "type": "discord",  "ts": 1720000000, "data": { "messages": [...], "bot_status": {...} } }
{ "type": "heartbeat","ts": 1720000000 }
```

Send `{ "type": "ping" }` to measure latency (server replies with `pong`).

### `/ws/screenshot`
Receives JSON frames:

```json
{ "type": "screenshot", "ts": 1720000000, "data": "<base64 JPEG>" }
{ "type": "rdp",        "ts": 1720000000, "data": "<base64 JPEG>" }
{ "type": "heartbeat",  "ts": 1720000000 }
```

---

## Headless / CI Mode (No Display)

If you want screenshots in a headless environment, add a virtual framebuffer:

```yaml
# Add to docker-compose.yml
  xvfb:
    image: ubuntu:24.04
    command: Xvfb :99 -screen 0 1920x1080x24
    environment:
      - DISPLAY=:99

# In backend service:
  backend:
    depends_on: [xvfb]
    environment:
      DISPLAY: ":99"
```

---

## License

MIT
