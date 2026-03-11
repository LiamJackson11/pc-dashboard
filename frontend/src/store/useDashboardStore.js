/**
 * store/useDashboardStore.js
 * --------------------------
 * Central Zustand store.
 * Holds:
 *   - WebSocket connection state
 *   - Latest system snapshot
 *   - Historical sparkline data (rolling windows)
 *   - Screenshot buffers
 *   - Discord messages
 *   - UI state (active tabs, visibility)
 */

import { create } from "zustand";

// How many data points to retain for sparkline history
const HISTORY_LEN = 60;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function appendHistory(arr, val) {
  const next = [...arr, val];
  if (next.length > HISTORY_LEN) next.shift();
  return next;
}

const DEFAULT_TABS = [
  { id: "pc_stats",  label: "PC Stats",     icon: "cpu",       visible: true  },
  { id: "rdp_feed",  label: "RDP Feed",     icon: "monitor",   visible: true  },
  { id: "terminals", label: "Terminals",    icon: "terminal",  visible: true  },
  { id: "discord",   label: "Discord",      icon: "message",   visible: true  },
  // New tabs can be pushed here at runtime – the nav renders them automatically
];

export const useDashboardStore = create((set, get) => ({
  // ── Connection ────────────────────────────────────────────────────────
  wsStatus: "disconnected",   // "connecting" | "connected" | "disconnected" | "error"
  wsLatency: null,             // ms
  lastHeartbeat: null,

  setWsStatus: (s) => set({ wsStatus: s }),
  setWsLatency: (ms) => set({ wsLatency: ms }),
  setLastHeartbeat: (ts) => set({ lastHeartbeat: ts }),

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabs: DEFAULT_TABS,
  activeTabId: "pc_stats",

  setActiveTab: (id) => set({ activeTabId: id }),

  toggleTabVisibility: (id) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)),
    })),

  /**
   * Register a new tab at runtime.
   * Idempotent: does nothing if a tab with that id already exists.
   */
  registerTab: (tab) =>
    set((state) => {
      if (state.tabs.find((t) => t.id === tab.id)) return {};
      return { tabs: [...state.tabs, { visible: true, ...tab }] };
    }),

  // ── System snapshot ───────────────────────────────────────────────────
  snapshot: null,         // latest raw snapshot from WS
  snapshotAge: null,      // seconds since last snapshot

  setSnapshot: (snap) => set({ snapshot: snap, snapshotAge: 0 }),
  tickSnapshotAge: () =>
    set((s) => ({ snapshotAge: s.snapshotAge !== null ? s.snapshotAge + 1 : null })),

  // ── Sparkline / history ───────────────────────────────────────────────
  cpuHistory: [],        // [{ t, v }]
  ramHistory: [],
  netSendHistory: [],
  netRecvHistory: [],

  pushHistory: (snap) => {
    const now = snap.timestamp * 1000; // ms
    set((s) => ({
      cpuHistory: appendHistory(s.cpuHistory, { t: now, v: snap.cpu.percent }),
      ramHistory: appendHistory(s.ramHistory, { t: now, v: snap.ram.percent }),
      netSendHistory: appendHistory(s.netSendHistory, { t: now, v: clamp(snap.network.send_rate_kb_s, 0, 1e6) }),
      netRecvHistory: appendHistory(s.netRecvHistory, { t: now, v: clamp(snap.network.recv_rate_kb_s, 0, 1e6) }),
    }));
  },

  // ── Screenshots ───────────────────────────────────────────────────────
  screenshotB64: null,      // full screen
  screenshotTs: null,
  rdpB64: null,             // RDP window crop
  rdpTs: null,

  setScreenshot: (b64, ts) => set({ screenshotB64: b64, screenshotTs: ts }),
  setRdp: (b64, ts) => set({ rdpB64: b64, rdpTs: ts }),

  // ── Discord ───────────────────────────────────────────────────────────
  discordMessages: [],
  discordBotStatus: { ready: false, latency_ms: null, message_count: 0 },

  setDiscord: (messages, botStatus) =>
    set({ discordMessages: messages, discordBotStatus: botStatus }),
}));
