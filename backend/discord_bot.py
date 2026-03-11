"""
discord_bot.py - compatible with py-cord and discord.py
"""

import asyncio
import logging
import os
from collections import deque
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger("discord_bot")

@dataclass
class DiscordMessage:
    id: str
    author: str
    author_avatar: Optional[str]
    content: str
    timestamp: str
    attachments: list
    reactions: list

_store:     deque = deque(maxlen=100)
_bot_ready: asyncio.Event = asyncio.Event()
_client    = None


def get_discord_messages() -> list:
    return [asdict(m) for m in reversed(_store)]


def get_bot_status() -> dict:
    latency = None
    if _client and _bot_ready.is_set():
        try: latency = round(_client.latency * 1000, 1)
        except Exception: pass
    return {"ready": _bot_ready.is_set(), "latency_ms": latency,
            "message_count": len(_store)}


def _build_msg(msg) -> DiscordMessage:
    avatar = None
    try:
        if msg.author.avatar: avatar = str(msg.author.avatar.url)
    except Exception: pass
    return DiscordMessage(
        id=str(msg.id), author=str(msg.author.display_name),
        author_avatar=avatar, content=msg.content or "",
        timestamp=msg.created_at.isoformat(),
        attachments=[a.url for a in msg.attachments],
        reactions=[{"emoji": str(r.emoji), "count": r.count} for r in msg.reactions],
    )


async def start_discord_bot() -> None:
    global _client
    token   = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    ch_str  = os.getenv("DISCORD_CHANNEL_ID", "").strip()
    history = int(os.getenv("DISCORD_HISTORY_LIMIT", "50"))

    if not token or token == "your_discord_bot_token_here":
        logger.warning("DISCORD_BOT_TOKEN not set - Discord disabled.")
        return
    if not ch_str:
        logger.warning("DISCORD_CHANNEL_ID not set - Discord disabled.")
        return

    ch_id = int(ch_str)

    try:
        import discord
        logger.info(f"Discord lib version: {discord.__version__}")
    except ImportError as e:
        logger.error(f"Discord import failed: {e}")
        logger.error("Run: backend\\.venv\\Scripts\\pip install py-cord==2.6.1")
        return

    intents = discord.Intents.default()
    intents.message_content = True
    intents.guilds = True
    intents.messages = True

    client = discord.Client(intents=intents)
    _client = client

    @client.event
    async def on_ready():
        logger.info(f"Discord bot online as {client.user}")
        ch = client.get_channel(ch_id)
        if ch is None:
            try: ch = await client.fetch_channel(ch_id)
            except Exception as e:
                logger.error(f"Channel {ch_id} not found: {e}")
                _bot_ready.set(); return
        try:
            async for msg in ch.history(limit=history, oldest_first=True):
                _store.append(_build_msg(msg))
            logger.info(f"Loaded {len(_store)} messages from #{ch.name}")
        except Exception as e:
            logger.error(f"History error: {e}")
        _bot_ready.set()

    @client.event
    async def on_message(message):
        if message.channel.id == ch_id:
            _store.append(_build_msg(message))

    logger.info("Connecting Discord bot...")
    try:
        await client.start(token)
    except Exception as e:
        logger.error(f"Discord bot failed: {type(e).__name__}: {e}")
