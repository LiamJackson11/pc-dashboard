/**
 * components/Terminals.jsx
 * -------------------------
 * Lists active window/terminal titles sourced from the live snapshot.
 * Shows a filter input and animates new entries in.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Search, RefreshCw, MonitorDot } from "lucide-react";
import { useDashboardStore } from "../store/useDashboardStore";

// Heuristic: categorise window titles
function categorise(title) {
  const t = title.toLowerCase();
  if (/terminal|bash|zsh|sh|konsole|xterm|alacritty|kitty|wezterm|hyper|iterm/.test(t))
    return { type: "terminal", color: "#00ff88", icon: ">" };
  if (/code|vscode|vim|nvim|emacs|jetbrains|pycharm|intellij|webstorm|cursor/.test(t))
    return { type: "editor", color: "#a855f7", icon: "{}" };
  if (/remote desktop|rdp|mstsc|vnc/.test(t))
    return { type: "rdp", color: "#00d4ff", icon: "⊞" };
  if (/browser|chrome|firefox|edge|safari|opera/.test(t))
    return { type: "browser", color: "#ffb300", icon: "⬡" };
  return { type: "other", color: "rgba(255,255,255,0.3)", icon: "□" };
}

export default function Terminals() {
  const snapshot = useDashboardStore((s) => s.snapshot);
  const [filter, setFilter] = useState("");

  const titles = snapshot?.window_titles ?? [];

  const filtered = useMemo(() => {
    if (!filter.trim()) return titles;
    return titles.filter((t) => t.toLowerCase().includes(filter.toLowerCase()));
  }, [titles, filter]);

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/30">
        <RefreshCw size={24} className="animate-spin" />
        <span className="text-sm">Waiting for snapshot…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="glass-card flex items-center gap-3 px-4 py-3">
        <Search size={14} className="text-white/30 flex-shrink-0" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter windows…"
          className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
        <span className="text-xs text-white/30 flex-shrink-0 font-mono">
          {filtered.length} / {titles.length}
        </span>
      </div>

      {/* Window list */}
      {filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-32 text-white/20 gap-2">
          <MonitorDot size={20} />
          <span className="text-xs">No windows found</span>
          {titles.length === 0 && (
            <span className="text-[10px] text-white/10 text-center max-w-xs">
              Window enumeration requires a desktop session (X11/Wayland/Windows).
              Check that wmctrl or xdotool is installed.
            </span>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((title, i) => {
              const cat = categorise(title);
              return (
                <motion.div
                  key={title + i}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="glass-card-hover flex items-center gap-3 px-4 py-3 cursor-default"
                >
                  {/* Type badge */}
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono"
                    style={{
                      background: `${cat.color}15`,
                      border: `1px solid ${cat.color}30`,
                      color: cat.color,
                    }}
                  >
                    {cat.icon}
                  </span>

                  <div className="min-w-0">
                    <p
                      className="text-sm text-white/80 truncate"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }}
                    >
                      {title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: cat.color }}>
                      {cat.type}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Summary footer */}
      <div className="glass-card px-4 py-3 grid grid-cols-4 gap-4 text-center">
        {["terminal", "editor", "rdp", "browser"].map((type) => {
          const count = titles.filter((t) => categorise(t).type === type).length;
          const cat = categorise(type); // reuse colour mapping
          return (
            <div key={type}>
              <div
                className="metric-value text-xl font-semibold"
                style={{ color: cat.color }}
              >
                {count}
              </div>
              <div className="text-[10px] text-white/30 capitalize">{type}s</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
