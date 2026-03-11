/**
 * App.jsx – Root component
 * -------------------------
 * Orchestrates:
 *   - WebSocket connections (via useWebSocket hook)
 *   - Top navigation bar
 *   - Animated tab content pane
 *   - Animated background
 *
 * To add a new module:
 *   1. Create your component in src/components/MyModule.jsx
 *   2. Register the tab in useDashboardStore.js DEFAULT_TABS array
 *      (or at runtime with: useDashboardStore.getState().registerTab({...}))
 *   3. Add a case in the TAB_COMPONENTS map below.
 *   That's it. The nav renders it automatically.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useDashboardStore } from "./store/useDashboardStore";
import { useWebSocket } from "./hooks/useWebSocket";

import TopNav from "./components/TopNav";
import PcStats from "./components/PcStats";
import RdpFeed from "./components/RdpFeed";
import Terminals from "./components/Terminals";
import DiscordChat from "./components/DiscordChat";

// ── Tab → Component mapping ────────────────────────────────────────────────
// Drop a new entry here when adding a module.
const TAB_COMPONENTS = {
  pc_stats: PcStats,
  rdp_feed: RdpFeed,
  terminals: Terminals,
  discord: DiscordChat,
  // example: custom_tab: MyCustomModule,
};

// ── Animated background ────────────────────────────────────────────────────
function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base */}
      <div className="absolute inset-0" style={{ background: "#020408" }} />

      {/* Grid */}
      <div className="absolute inset-0 bg-grid opacity-60" />

      {/* Gradient orbs */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full -top-64 -left-64 animate-float"
        style={{
          background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full -bottom-32 -right-32"
        style={{
          background: "radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDelay: "3s",
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(circle, rgba(0,255,136,0.03) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
}

// ── Tab content panel ──────────────────────────────────────────────────────
const TAB_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

function TabContent({ activeTabId }) {
  const Component = TAB_COMPONENTS[activeTabId];

  if (!Component) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-white/20">
        <span className="text-2xl">🧩</span>
        <p className="text-sm">Tab "{activeTabId}" has no registered component.</p>
        <p className="text-xs text-white/10">
          Add it to TAB_COMPONENTS in App.jsx.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTabId}
        variants={TAB_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Component />
      </motion.div>
    </AnimatePresence>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
export default function App() {
  // Start both WebSocket connections as a side-effect at the root level
  useWebSocket();

  const activeTabId = useDashboardStore((s) => s.activeTabId);
  const tabs = useDashboardStore((s) => s.tabs);

  // Tick snapshot age every second to detect stale data
  const tickSnapshotAge = useDashboardStore((s) => s.tickSnapshotAge);
  useEffect(() => {
    const id = setInterval(tickSnapshotAge, 1000);
    return () => clearInterval(id);
  }, [tickSnapshotAge]);

  // If the active tab becomes hidden, auto-switch to the first visible one
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);
  useEffect(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && !activeTab.visible) {
      const firstVisible = tabs.find((t) => t.visible);
      if (firstVisible) setActiveTab(firstVisible.id);
    }
  }, [tabs, activeTabId, setActiveTab]);

  return (
    <div className="min-h-screen scan-overlay">
      <Background />
      <TopNav />

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
        <TabContent activeTabId={activeTabId} />
      </main>
    </div>
  );
}
