/**
 * components/RdpFeed.jsx
 * -----------------------
 * Displays the live screenshot feed (full screen + optional RDP window crop).
 * Shows a frosted-glass overlay with timestamp and connection info.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Maximize2, Minimize2, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useDashboardStore } from "../store/useDashboardStore";

function formatTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ScreenFrame({ b64, ts, label, accent = "#00d4ff" }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  if (!b64) {
    return (
      <div className="glass-card flex flex-col items-center justify-center h-48 text-white/20 gap-2">
        <Monitor size={28} />
        <span className="text-xs">{label} – no signal</span>
      </div>
    );
  }

  const src = `data:image/jpeg;base64,${b64}`;

  return (
    <>
      <motion.div
        className="glass-card overflow-hidden"
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span className="text-xs font-mono text-white/60">{label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30">{formatTs(ts)}</span>
            <button
              onClick={() => setShowOverlay((v) => !v)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-white/40"
              title="Toggle overlay"
            >
              {showOverlay ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="p-1 rounded hover:bg-white/10 transition-colors text-white/40"
              title="Fullscreen"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative">
          <img
            src={src}
            alt={label}
            className="w-full h-auto block"
            style={{ maxHeight: "420px", objectFit: "contain", background: "#000" }}
          />
          {/* Scanline effect overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
            }}
          />
          {/* Corner timestamp when overlay is visible */}
          <AnimatePresence>
            {showOverlay && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  border: `1px solid ${accent}40`,
                  color: accent,
                }}
              >
                LIVE · {formatTs(ts)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
            onClick={() => setFullscreen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src}
                alt={label}
                className="max-w-[95vw] max-h-[90vh] rounded-xl object-contain"
                style={{ boxShadow: `0 0 60px ${accent}30` }}
              />
              <button
                onClick={() => setFullscreen(false)}
                className="absolute top-3 right-3 p-2 rounded-xl text-white/60 hover:text-white transition-colors"
                style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Minimize2 size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function RdpFeed() {
  const screenshotB64 = useDashboardStore((s) => s.screenshotB64);
  const screenshotTs = useDashboardStore((s) => s.screenshotTs);
  const rdpB64 = useDashboardStore((s) => s.rdpB64);
  const rdpTs = useDashboardStore((s) => s.rdpTs);

  const hasAny = screenshotB64 || rdpB64;

  return (
    <div className="space-y-4">
      {!hasAny && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/30">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-sm">Waiting for first screenshot…</span>
          <span className="text-xs text-white/20">
            Screenshots require a display session (X11 / VNC / Windows desktop)
          </span>
        </div>
      )}

      <div className={`grid gap-4 ${rdpB64 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
        <ScreenFrame
          b64={screenshotB64}
          ts={screenshotTs}
          label="Full Screen"
          accent="#00d4ff"
        />
        {rdpB64 && (
          <ScreenFrame
            b64={rdpB64}
            ts={rdpTs}
            label="RDP Window"
            accent="#a855f7"
          />
        )}
      </div>
    </div>
  );
}
