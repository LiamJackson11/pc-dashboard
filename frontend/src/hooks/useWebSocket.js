/**
 * useWebSocket.js - stable version, runs exactly once
 */

import { useEffect, useRef } from "react";
import { useDashboardStore } from "../store/useDashboardStore";

const proto   = window.location.protocol === "https:" ? "wss" : "ws";
const BASE    = import.meta.env.VITE_WS_BASE_URL || `${proto}://${window.location.host}`;
const STATS   = `${BASE}/ws/stats`;
const SCREENS = `${BASE}/ws/screenshot`;

function createSocket(url, msgRef, onStatus, label) {
  let ws = null, backoff = 500, retry = null, ping = null, pingTs = null, alive = true;

  function stop() { clearTimeout(retry); clearInterval(ping); retry = null; ping = null; }

  function connect() {
    if (!alive) return;
    if (label === "stats") onStatus("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      if (!alive) { ws.close(); return; }
      backoff = 500;
      if (label === "stats") onStatus("connected");
      ping = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          pingTs = performance.now();
          try { ws.send(JSON.stringify({ type: "ping" })); } catch(_) {}
        }
      }, 2000);
    };

    ws.onmessage = (e) => {
      if (!alive) return;
      let f; try { f = JSON.parse(e.data); } catch(_) { return; }
      if (f.type === "pong" && pingTs !== null) {
        useDashboardStore.getState().setWsLatency(Math.round(performance.now() - pingTs));
        pingTs = null; return;
      }
      if (f.type === "heartbeat") {
        useDashboardStore.getState().setLastHeartbeat(Date.now()); return;
      }
      if (msgRef.current) msgRef.current(f);
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      stop();
      if (!alive) return;
      if (label === "stats") onStatus("disconnected");
      retry = setTimeout(() => { if (alive) { backoff = Math.min(backoff * 1.5, 5000); connect(); } }, backoff);
    };
  }

  function teardown() {
    alive = false; stop();
    if (ws) { ws.onclose = null; ws.close(1000, "teardown"); ws = null; }
    if (label === "stats") onStatus("disconnected");
  }

  connect();
  return teardown;
}

export function useWebSocket() {
  const statsRef  = useRef(null);
  const screenRef = useRef(null);

  statsRef.current = (f) => {
    const s = useDashboardStore.getState();
    if (f.type === "snapshot" && f.data) { s.setSnapshot(f.data); s.pushHistory(f.data); }
    else if (f.type === "discord" && f.data) { s.setDiscord(f.data.messages ?? [], f.data.bot_status ?? {}); }
  };

  screenRef.current = (f) => {
    const s = useDashboardStore.getState();
    if (f.type === "screenshot" && f.data) s.setScreenshot(f.data, f.ts);
    else if (f.type === "rdp" && f.data)   s.setRdp(f.data, f.ts);
  };

  // Empty deps [] means this runs exactly ONCE on mount
  useEffect(() => {
    const { setWsStatus } = useDashboardStore.getState();
    const t1 = createSocket(STATS,   statsRef,  setWsStatus, "stats");
    const t2 = createSocket(SCREENS, screenRef, () => {},    "screenshot");
    return () => { t1(); t2(); };
  }, []);
}
