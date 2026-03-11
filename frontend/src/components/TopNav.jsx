/**
 * components/TopNav.jsx
 * ----------------------
 * Persistent navigation bar.
 * Renders a tab for every entry in the store's `tabs` array.
 * Tabs can be toggled visible/hidden via the visibility toggle button.
 * New tabs added to the store automatically appear here.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Monitor, Terminal, MessageSquare,
  LayoutDashboard, Eye, EyeOff, Settings,
  Wifi, WifiOff, AlertCircle, Plus,
} from "lucide-react";
import { useDashboardStore } from "../store/useDashboardStore";

// Icon map – extend this when registering new tabs
const ICON_MAP = {
  cpu: Cpu,
  monitor: Monitor,
  terminal: Terminal,
  message: MessageSquare,
  dashboard: LayoutDashboard,
};

function TabIcon({ iconKey, size = 14 }) {
  const Icon = ICON_MAP[iconKey] ?? LayoutDashboard;
  return <Icon size={size} />;
}

function WsIndicator() {
  const status = useDashboardStore((s) => s.wsStatus);
  const latency = useDashboardStore((s) => s.wsLatency);

  const config = {
    connected: { color: "#00ff88", Icon: Wifi, label: "Live" },
    connecting: { color: "#ffb300", Icon: Wifi, label: "Connecting" },
    disconnected: { color: "rgba(255,255,255,0.25)", Icon: WifiOff, label: "Offline" },
    error: { color: "#ff4757", Icon: AlertCircle, label: "Error" },
  }[status] ?? { color: "rgba(255,255,255,0.25)", Icon: WifiOff, label: status };

  const { color, Icon, label } = config;

  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color }} />
      <span className="text-xs font-mono" style={{ color }}>
        {label}
        {status === "connected" && latency !== null && ` · ${latency}ms`}
      </span>
      {status === "connected" && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
      )}
    </div>
  );
}

function VisibilityToggle({ tabs }) {
  const [open, setOpen] = useState(false);
  const toggleTabVisibility = useDashboardStore((s) => s.toggleTabVisibility);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass-btn flex items-center gap-2"
        title="Manage tabs"
      >
        <Settings size={12} />
        <span className="hidden sm:inline text-xs">Tabs</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-40 w-52 glass-card p-2 rounded-xl"
              style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
            >
              <p className="px-3 py-1.5 text-[10px] text-white/30 font-mono uppercase tracking-widest">
                Toggle Modules
              </p>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => toggleTabVisibility(tab.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-2 text-white/70">
                    <TabIcon iconKey={tab.icon} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.visible ? (
                    <Eye size={12} className="text-accent-cyan" />
                  ) : (
                    <EyeOff size={12} className="text-white/25" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TopNav() {
  const tabs = useDashboardStore((s) => s.tabs);
  const activeTabId = useDashboardStore((s) => s.activeTabId);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <nav
      className="glass-nav sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-14"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(168,85,247,0.2))",
            border: "1px solid rgba(0,212,255,0.3)",
          }}
        >
          <LayoutDashboard size={14} style={{ color: "#00d4ff" }} />
        </div>
        <span
          className="text-sm font-semibold tracking-tight hidden sm:block"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: "rgba(255,255,255,0.85)" }}
        >
          PC Dashboard
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 mx-4">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`glass-btn flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${isActive ? "active" : ""}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <TabIcon iconKey={tab.icon} size={12} />
              <span className="hidden sm:inline">{tab.label}</span>
            </motion.button>
          );
        })}

        {/* "Add tab" hint – clicking does nothing by default; dev should wire up registerTab() */}
        <button
          className="glass-btn flex items-center gap-1.5 flex-shrink-0 text-white/20 hover:text-white/50"
          title="Register new tabs via useDashboardStore.getState().registerTab({ id, label, icon })"
          onClick={() => {
            // Example of adding a custom tab programmatically:
            // useDashboardStore.getState().registerTab({ id: 'custom', label: 'Custom', icon: 'cpu' });
          }}
        >
          <Plus size={11} />
          <span className="hidden md:inline text-xs">Add</span>
        </button>
      </div>

      {/* Right side: WS status + visibility toggle */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <WsIndicator />
        <VisibilityToggle tabs={tabs} />
      </div>
    </nav>
  );
}
