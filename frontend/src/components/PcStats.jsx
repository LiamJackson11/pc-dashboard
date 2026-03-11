/**
 * components/PcStats.jsx
 * -----------------------
 * Displays CPU, RAM, Disk, Network, and Top Processes.
 * Uses Recharts for sparklines and Framer Motion for entrance animations.
 */

import { motion } from "framer-motion";
import {
  AreaChart, Area, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Cpu, MemoryStick, HardDrive, Wifi, Activity,
  Thermometer, ArrowUpRight, ArrowDownLeft, RefreshCw,
} from "lucide-react";
import { useDashboardStore } from "../store/useDashboardStore";

// ── Helpers ────────────────────────────────────────────────────────────────

function pct2Color(pct) {
  if (pct >= 90) return "#ff4757";
  if (pct >= 70) return "#ffb300";
  return "#00ff88";
}

function fmtBytes(kb) {
  if (kb < 1024) return `${kb.toFixed(0)} KB/s`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB/s`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB/s`;
}

function fmtGB(val) {
  return `${val.toFixed(1)} GB`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, accent = "#00d4ff" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} style={{ color: accent }} />
      <span className="text-xs font-mono uppercase tracking-widest" style={{ color: accent }}>
        {label}
      </span>
    </div>
  );
}

function ProgressBar({ value, color }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${Math.min(100, value)}%`, background: color }}
      />
    </div>
  );
}

function Sparkline({ data, color, dataKey = "v" }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${color.replace("#", "")})`}
          isAnimationActive={false}
          dot={false}
        />
        <Tooltip
          content={() => null}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── CPU Card ───────────────────────────────────────────────────────────────

function CpuCard({ cpu, history }) {
  if (!cpu) return null;
  const color = pct2Color(cpu.percent);

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <SectionHeader icon={Cpu} label="CPU" accent={color} />

      <div className="flex items-end justify-between mb-2">
        <span className="metric-value text-3xl font-semibold" style={{ color }}>
          {cpu.percent.toFixed(1)}
          <span className="text-base text-white/40 ml-1">%</span>
        </span>
        <div className="text-right">
          {cpu.temp_celsius && (
            <div className="flex items-center gap-1 text-xs text-white/50 mb-1">
              <Thermometer size={10} />
              <span className="metric-value">{cpu.temp_celsius.toFixed(0)}°C</span>
            </div>
          )}
          <div className="text-xs text-white/40 metric-value">
            {cpu.freq_mhz.toFixed(0)} MHz
          </div>
        </div>
      </div>

      <ProgressBar value={cpu.percent} color={color} />
      <div className="mt-3">
        <Sparkline data={history} color={color} />
      </div>

      {/* Per-core mini bars */}
      {cpu.per_core.length > 0 && (
        <div className="mt-3 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(cpu.per_core.length, 16)}, 1fr)` }}>
          {cpu.per_core.slice(0, 16).map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: "20px",
                  background: `linear-gradient(to top, ${pct2Color(c)}80 ${c}%, rgba(255,255,255,0.04) ${c}%)`,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              />
              <span className="text-[8px] text-white/25 metric-value">{i}</span>
            </div>
          ))}
        </div>
      )}

      {/* Load averages */}
      <div className="mt-3 flex gap-3 text-xs text-white/40">
        {[
          ["1m", cpu.load_avg_1m],
          ["5m", cpu.load_avg_5m],
          ["15m", cpu.load_avg_15m],
        ].map(([label, val]) => (
          <div key={label} className="flex flex-col items-center">
            <span className="metric-value text-white/70">{val.toFixed(2)}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── RAM Card ───────────────────────────────────────────────────────────────

function RamCard({ ram, history }) {
  if (!ram) return null;
  const color = pct2Color(ram.percent);

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <SectionHeader icon={MemoryStick} label="Memory" accent="#a855f7" />

      <div className="flex items-end justify-between mb-2">
        <span className="metric-value text-3xl font-semibold" style={{ color }}>
          {ram.percent.toFixed(1)}
          <span className="text-base text-white/40 ml-1">%</span>
        </span>
        <div className="text-right text-xs text-white/40">
          <div className="metric-value">{fmtGB(ram.used_gb)} / {fmtGB(ram.total_gb)}</div>
          <div className="metric-value text-white/25">{fmtGB(ram.available_gb)} free</div>
        </div>
      </div>

      <ProgressBar value={ram.percent} color={color} />
      <div className="mt-3">
        <Sparkline data={history} color="#a855f7" />
      </div>

      {/* Swap */}
      {ram.swap_total_gb > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Swap</span>
            <span className="metric-value">{fmtGB(ram.swap_used_gb)} / {fmtGB(ram.swap_total_gb)}</span>
          </div>
          <ProgressBar value={ram.swap_percent} color="#6366f1" />
        </div>
      )}
    </motion.div>
  );
}

// ── Disk Card ──────────────────────────────────────────────────────────────

function DiskCard({ disks }) {
  if (!disks?.length) return null;

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <SectionHeader icon={HardDrive} label="Disks" accent="#00d4ff" />

      <div className="space-y-3">
        {disks.map((disk, i) => {
          const color = pct2Color(disk.percent);
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/60 font-mono truncate max-w-[120px]">{disk.path}</span>
                <div className="flex gap-3 text-white/40">
                  <span className="metric-value">{fmtGB(disk.used_gb)}/{fmtGB(disk.total_gb)}</span>
                  <span className="metric-value" style={{ color }}>{disk.percent.toFixed(0)}%</span>
                </div>
              </div>
              <ProgressBar value={disk.percent} color={color} />
              <div className="flex gap-3 mt-1 text-[10px] text-white/30">
                <span className="metric-value">↑ {disk.write_mb_s.toFixed(1)} MB/s</span>
                <span className="metric-value">↓ {disk.read_mb_s.toFixed(1)} MB/s</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Network Card ───────────────────────────────────────────────────────────

function NetworkCard({ network, sendHistory, recvHistory }) {
  if (!network) return null;

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <SectionHeader icon={Wifi} label="Network" accent="#00ff88" />

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Upload */}
        <div className="text-center">
          <ArrowUpRight size={12} className="mx-auto mb-1 text-accent-cyan" />
          <div className="metric-value text-lg text-accent-cyan">{fmtBytes(network.send_rate_kb_s)}</div>
          <div className="text-[10px] text-white/30 metric-value">
            Total: {network.bytes_sent_mb.toFixed(0)} MB
          </div>
        </div>
        {/* Download */}
        <div className="text-center">
          <ArrowDownLeft size={12} className="mx-auto mb-1 text-accent-green" />
          <div className="metric-value text-lg text-accent-green">{fmtBytes(network.recv_rate_kb_s)}</div>
          <div className="text-[10px] text-white/30 metric-value">
            Total: {network.bytes_recv_mb.toFixed(0)} MB
          </div>
        </div>
      </div>

      {/* Dual sparkline */}
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netSend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="netRecv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area data={sendHistory} type="monotone" dataKey="v" stroke="#00d4ff" strokeWidth={1.5}
            fill="url(#netSend)" isAnimationActive={false} dot={false} />
          <Area data={recvHistory} type="monotone" dataKey="v" stroke="#00ff88" strokeWidth={1.5}
            fill="url(#netRecv)" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-2 text-[10px] text-white/30 metric-value">
        {network.connections >= 0 ? `${network.connections} open connections` : "Connection count unavailable"}
      </div>
    </motion.div>
  );
}

// ── Process Table ──────────────────────────────────────────────────────────

function ProcessTable({ processes }) {
  if (!processes?.length) return null;

  return (
    <motion.div
      className="glass-card p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <SectionHeader icon={Activity} label="Top Processes" accent="#ffb300" />

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/5">
              <th className="text-left pb-2 font-normal">PID</th>
              <th className="text-left pb-2 font-normal">Name</th>
              <th className="text-right pb-2 font-normal">CPU%</th>
              <th className="text-right pb-2 font-normal">MEM</th>
              <th className="text-right pb-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="py-1.5 metric-value text-white/30">{p.pid}</td>
                <td className="py-1.5 text-white/70 max-w-[120px] truncate">{p.name}</td>
                <td className="py-1.5 text-right metric-value" style={{ color: pct2Color(p.cpu_percent) }}>
                  {p.cpu_percent.toFixed(1)}
                </td>
                <td className="py-1.5 text-right metric-value text-white/50">
                  {p.mem_mb.toFixed(0)} MB
                </td>
                <td className="py-1.5 text-right">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px]"
                    style={{
                      background: p.status === "running" ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.05)",
                      color: p.status === "running" ? "#00ff88" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function PcStats() {
  const snapshot = useDashboardStore((s) => s.snapshot);
  const cpuHistory = useDashboardStore((s) => s.cpuHistory);
  const ramHistory = useDashboardStore((s) => s.ramHistory);
  const netSendHistory = useDashboardStore((s) => s.netSendHistory);
  const netRecvHistory = useDashboardStore((s) => s.netRecvHistory);
  const snapshotAge = useDashboardStore((s) => s.snapshotAge);

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/30">
        <RefreshCw size={24} className="animate-spin" />
        <span className="text-sm">Waiting for first snapshot…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stale indicator */}
      {snapshotAge !== null && snapshotAge > 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20"
        >
          <RefreshCw size={12} className="animate-spin" />
          Data is {snapshotAge}s old – reconnecting…
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CpuCard cpu={snapshot.cpu} history={cpuHistory} />
        <RamCard ram={snapshot.ram} history={ramHistory} />
        <DiskCard disks={snapshot.disks} />
        <NetworkCard
          network={snapshot.network}
          sendHistory={netSendHistory}
          recvHistory={netRecvHistory}
        />
      </div>

      <ProcessTable processes={snapshot.top_processes} />
    </div>
  );
}
