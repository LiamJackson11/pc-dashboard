/**
 * components/DiscordChat.jsx
 * ---------------------------
 * Displays messages from the configured Discord channel.
 * Shows bot connection status, avatar initials, reactions, and attachments.
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Wifi, WifiOff, Hash, Paperclip, ExternalLink } from "lucide-react";
import { useDashboardStore } from "../store/useDashboardStore";

function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "??:??";
  }
}

function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// Auto-link URLs in message content
function Linkify({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-cyan hover:underline inline-flex items-center gap-0.5"
          >
            {part.length > 40 ? part.slice(0, 40) + "…" : part}
            <ExternalLink size={10} />
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Avatar({ author, avatarUrl }) {
  const initials = author
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Deterministic pastel colour from username hash
  const hue = [...author].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={author}
        className="w-8 h-8 rounded-full flex-shrink-0"
        onError={(e) => { e.target.style.display = "none"; }}
      />
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
      style={{
        background: `hsl(${hue}, 60%, 25%)`,
        border: `1px solid hsl(${hue}, 60%, 40%)`,
        color: `hsl(${hue}, 80%, 75%)`,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function MessageBubble({ msg, prevAuthor }) {
  const isGrouped = prevAuthor === msg.author;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isGrouped ? "mt-0.5" : "mt-4"}`}
    >
      {/* Avatar column – only on first message in a group */}
      <div className="w-8 flex-shrink-0">
        {!isGrouped && <Avatar author={msg.author} avatarUrl={msg.author_avatar} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-sm font-semibold"
              style={{
                color: `hsl(${[...msg.author].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 70%)`,
              }}
            >
              {msg.author}
            </span>
            <span className="text-[10px] text-white/25 font-mono">{formatTime(msg.timestamp)}</span>
          </div>
        )}

        {msg.content && (
          <p className="text-sm text-white/75 leading-relaxed break-words">
            <Linkify text={msg.content} />
          </p>
        )}

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {msg.attachments.map((url, i) => {
              const isImg = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
              return isImg ? (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt="attachment"
                    className="max-h-32 max-w-xs rounded-lg border border-white/10 hover:border-accent-cyan/40 transition-colors"
                  />
                </a>
              ) : (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <Paperclip size={10} />
                  attachment
                </a>
              );
            })}
          </div>
        )}

        {/* Reactions */}
        {msg.reactions?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {msg.reactions.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {r.emoji} <span className="text-white/40">{r.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[10px] text-white/30 font-mono px-2">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

export default function DiscordChat() {
  const messages = useDashboardStore((s) => s.discordMessages);
  const botStatus = useDashboardStore((s) => s.discordBotStatus);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Group messages by date
  const grouped = [];
  let lastDate = null;
  let lastAuthor = null;
  for (const msg of [...messages].reverse()) {
    const date = formatDate(msg.timestamp);
    if (date !== lastDate) {
      grouped.push({ type: "divider", label: date });
      lastDate = date;
      lastAuthor = null;
    }
    grouped.push({ type: "msg", msg, prevAuthor: lastAuthor });
    lastAuthor = msg.author;
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Status bar */}
      <div className="glass-card flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Hash size={14} className="text-white/40" />
          <span className="text-sm text-white/60 font-mono">channel feed</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30 font-mono">
            {messages.length} msg{messages.length !== 1 ? "s" : ""}
          </span>
          {botStatus.latency_ms !== null && (
            <span className="text-xs text-white/30 font-mono">
              {botStatus.latency_ms} ms
            </span>
          )}
          <div className="flex items-center gap-1.5">
            {botStatus.ready ? (
              <Wifi size={12} className="text-accent-green" />
            ) : (
              <WifiOff size={12} className="text-white/25" />
            )}
            <span
              className="text-[10px] font-mono"
              style={{ color: botStatus.ready ? "#00ff88" : "rgba(255,255,255,0.25)" }}
            >
              {botStatus.ready ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Message feed */}
      {messages.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center h-64 gap-3 text-white/20">
          <MessageSquare size={28} />
          <span className="text-sm">
            {botStatus.ready ? "No messages in channel" : "Discord bot not configured"}
          </span>
          {!botStatus.ready && (
            <span className="text-xs text-white/15 text-center max-w-xs px-4">
              Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in your .env file
              and enable "Message Content Intent" in the Discord Developer Portal.
            </span>
          )}
        </div>
      ) : (
        <div
          className="glass-card flex-1 px-4 py-3 overflow-y-auto"
          style={{ maxHeight: "600px" }}
        >
          <AnimatePresence mode="popLayout">
            {grouped.map((item, i) =>
              item.type === "divider" ? (
                <DateDivider key={`div-${item.label}-${i}`} label={item.label} />
              ) : (
                <MessageBubble
                  key={item.msg.id}
                  msg={item.msg}
                  prevAuthor={item.prevAuthor}
                />
              )
            )}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
