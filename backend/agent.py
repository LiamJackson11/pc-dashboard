"""
agent.py – Resource Monitor + Screenshot Agent (Windows-safe)
--------------------------------------------------------------
All psutil calls that don't exist on Windows are guarded.
Every section is wrapped in try/except so one failure can't
kill the whole monitoring loop.
"""

import asyncio
import base64
import io
import logging
import os
import platform
import subprocess
import time
from dataclasses import dataclass
from typing import Optional

import mss
import psutil
from PIL import Image

logger = logging.getLogger("agent")
SYSTEM = platform.system()


# ── Data containers ───────────────────────────────────────────

@dataclass
class CPUStats:
    percent: float
    per_core: list
    freq_mhz: float
    temp_celsius: Optional[float]
    load_avg_1m: float
    load_avg_5m: float
    load_avg_15m: float

@dataclass
class RAMStats:
    total_gb: float
    used_gb: float
    available_gb: float
    percent: float
    swap_total_gb: float
    swap_used_gb: float
    swap_percent: float

@dataclass
class DiskStats:
    path: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float
    read_mb_s: float
    write_mb_s: float

@dataclass
class NetworkStats:
    bytes_sent_mb: float
    bytes_recv_mb: float
    send_rate_kb_s: float
    recv_rate_kb_s: float
    connections: int

@dataclass
class ProcessInfo:
    pid: int
    name: str
    cpu_percent: float
    mem_mb: float
    status: str

@dataclass
class AgentSnapshot:
    timestamp: float
    cpu: CPUStats
    ram: RAMStats
    disks: list
    network: NetworkStats
    top_processes: list
    window_titles: list
    screenshot_b64: Optional[str]
    rdp_screenshot_b64: Optional[str]


# ── CPU ────────────────────────────────────────────────────────

def _get_cpu_temp() -> Optional[float]:
    """Windows does not expose sensors_temperatures — always returns None."""
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None
        for key in ("coretemp", "k10temp", "acpitz", "cpu_thermal"):
            if key in temps and temps[key]:
                return temps[key][0].current
        first = next(iter(temps))
        if temps[first]:
            return temps[first][0].current
    except (AttributeError, NotImplementedError, StopIteration):
        # Windows raises AttributeError for sensors_temperatures
        pass
    return None


def _get_load_avg():
    try:
        avg = psutil.getloadavg()
        return avg[0], avg[1], avg[2]
    except (AttributeError, OSError):
        # Windows has no getloadavg — use CPU % as approximation
        c = psutil.cpu_percent(interval=None)
        return c, c, c


def collect_cpu() -> CPUStats:
    try:
        # interval=1 gives accurate reading (blocks 1s in thread executor)
        percent = psutil.cpu_percent(interval=1)
        per_core = psutil.cpu_percent(percpu=True, interval=None)
    except Exception:
        percent = 0.0
        per_core = []

    try:
        freq = psutil.cpu_freq()
        freq_mhz = freq.current if freq else 0.0
    except Exception:
        freq_mhz = 0.0

    la1, la5, la15 = _get_load_avg()

    return CPUStats(
        percent=percent,
        per_core=per_core,
        freq_mhz=freq_mhz,
        temp_celsius=_get_cpu_temp(),
        load_avg_1m=la1,
        load_avg_5m=la5,
        load_avg_15m=la15,
    )


# ── RAM ────────────────────────────────────────────────────────

def collect_ram() -> RAMStats:
    try:
        vm = psutil.virtual_memory()
        sw = psutil.swap_memory()
        return RAMStats(
            total_gb=round(vm.total / 1e9, 2),
            used_gb=round(vm.used / 1e9, 2),
            available_gb=round(vm.available / 1e9, 2),
            percent=vm.percent,
            swap_total_gb=round(sw.total / 1e9, 2),
            swap_used_gb=round(sw.used / 1e9, 2),
            swap_percent=sw.percent,
        )
    except Exception as e:
        logger.warning(f"RAM collect error: {e}")
        return RAMStats(0,0,0,0,0,0,0)


# ── Disk ───────────────────────────────────────────────────────

_prev_disk_io: dict = {}
_prev_disk_time: float = time.monotonic()

def collect_disks() -> list:
    global _prev_disk_io, _prev_disk_time

    now = time.monotonic()
    elapsed = max(0.001, now - _prev_disk_time)
    _prev_disk_time = now

    try:
        io_counters = psutil.disk_io_counters(perdisk=True) or {}
    except Exception:
        io_counters = {}

    results = []
    try:
        partitions = psutil.disk_partitions(all=False)
    except Exception:
        return results

    for part in partitions:
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except (PermissionError, OSError):
            continue

        # Normalise device name for Windows (\\.\PhysicalDrive0 etc)
        device = part.device.replace("\\\\?\\", "").replace("\\.\\", "")
        device_key = device.rstrip("\\").split("\\")[-1]

        read_rate = 0.0
        write_rate = 0.0
        for k in (device_key, device, part.device):
            if k in io_counters:
                curr = io_counters[k]
                prev = _prev_disk_io.get(k)
                if prev:
                    read_rate = max(0.0, (curr.read_bytes - prev.read_bytes) / elapsed / 1e6)
                    write_rate = max(0.0, (curr.write_bytes - prev.write_bytes) / elapsed / 1e6)
                _prev_disk_io[k] = curr
                break

        results.append(DiskStats(
            path=part.mountpoint,
            total_gb=round(usage.total / 1e9, 2),
            used_gb=round(usage.used / 1e9, 2),
            free_gb=round(usage.free / 1e9, 2),
            percent=usage.percent,
            read_mb_s=round(read_rate, 2),
            write_mb_s=round(write_rate, 2),
        ))
    return results


# ── Network ────────────────────────────────────────────────────

_prev_net_io = None
_prev_net_time: float = time.monotonic()

def collect_network() -> NetworkStats:
    global _prev_net_io, _prev_net_time

    now = time.monotonic()
    elapsed = max(0.001, now - _prev_net_time)
    _prev_net_time = now

    try:
        curr = psutil.net_io_counters()
    except Exception:
        return NetworkStats(0, 0, 0, 0, 0)

    send_rate = 0.0
    recv_rate = 0.0
    if _prev_net_io:
        send_rate = max(0.0, (curr.bytes_sent - _prev_net_io.bytes_sent) / elapsed / 1024)
        recv_rate = max(0.0, (curr.bytes_recv - _prev_net_io.bytes_recv) / elapsed / 1024)
    _prev_net_io = curr

    try:
        # Requires admin on Windows — gracefully degrade
        connections = len(psutil.net_connections())
    except (PermissionError, OSError, AttributeError):
        connections = -1

    return NetworkStats(
        bytes_sent_mb=round(curr.bytes_sent / 1e6, 2),
        bytes_recv_mb=round(curr.bytes_recv / 1e6, 2),
        send_rate_kb_s=round(send_rate, 2),
        recv_rate_kb_s=round(recv_rate, 2),
        connections=connections,
    )


# ── Processes ──────────────────────────────────────────────────

def collect_top_processes(n: int = 8) -> list:
    procs = []
    try:
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info", "status"]):
            try:
                mi = p.info.get("memory_info")
                procs.append(ProcessInfo(
                    pid=p.info["pid"],
                    name=p.info.get("name") or "?",
                    cpu_percent=p.info.get("cpu_percent") or 0.0,
                    mem_mb=round(mi.rss / 1e6, 1) if mi else 0.0,
                    status=p.info.get("status") or "unknown",
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except Exception as e:
        logger.warning(f"Process list error: {e}")
    return sorted(procs, key=lambda x: x.cpu_percent, reverse=True)[:n]


# ── Window titles ──────────────────────────────────────────────

def get_window_titles() -> list:
    titles = []
    if SYSTEM == "Windows":
        try:
            import pygetwindow as gw
            for w in gw.getAllWindows():
                if w.title and w.title.strip():
                    titles.append(w.title.strip())
        except Exception as e:
            logger.warning(f"pygetwindow error: {e}")
    elif SYSTEM == "Linux":
        for cmd in [["wmctrl", "-l"], ["xdotool", "search", "--name", ""]]:
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
                if result.returncode == 0 and result.stdout:
                    for line in result.stdout.splitlines():
                        parts = line.split(None, 3)
                        if len(parts) >= 4:
                            titles.append(parts[3].strip())
                    break
            except Exception:
                continue
    return titles[:20]


# ── Screenshots ────────────────────────────────────────────────

def _capture_screenshot_b64(quality: int = 50, max_dim: int = 1280) -> Optional[str]:
    try:
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            raw = sct.grab(monitor)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
        w, h = img.size
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        logger.warning(f"Screenshot error: {e}")
        return None


def _find_rdp_window_coords() -> Optional[dict]:
    rdp_hint = os.getenv("RDP_WINDOW_TITLE", "Remote Desktop").lower()
    if SYSTEM == "Windows":
        try:
            import pygetwindow as gw
            matches = [w for w in gw.getAllWindows()
                       if rdp_hint in w.title.lower() and w.width > 0]
            if matches:
                w = matches[0]
                # Make sure window has valid dimensions
                if w.width > 10 and w.height > 10:
                    return {"left": w.left, "top": w.top,
                            "width": w.width, "height": w.height}
        except Exception as e:
            logger.warning(f"RDP window find error: {e}")
    elif SYSTEM == "Linux":
        try:
            result = subprocess.run(["wmctrl", "-lG"], capture_output=True, text=True, timeout=2)
            for line in result.stdout.splitlines():
                if rdp_hint in line.lower():
                    parts = line.split()
                    if len(parts) >= 7:
                        return {"left": int(parts[2]), "top": int(parts[3]),
                                "width": int(parts[4]), "height": int(parts[5])}
        except Exception:
            pass
    return None


def _capture_rdp_b64(quality: int = 55, max_dim: int = 960) -> Optional[str]:
    coords = _find_rdp_window_coords()
    if not coords:
        return None
    try:
        with mss.mss() as sct:
            raw = sct.grab(coords)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
        w, h = img.size
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        logger.warning(f"RDP capture error: {e}")
        return None


# ── Main loop ──────────────────────────────────────────────────

async def run_agent(queue: asyncio.Queue, interval: float = 3.0) -> None:
    logger.info(f"Agent started (interval={interval}s, platform={SYSTEM})")

    # Prime CPU counter — first call always returns 0.0
    try:
        psutil.cpu_percent(interval=None)
        psutil.cpu_percent(percpu=True, interval=None)
    except Exception:
        pass
    await asyncio.sleep(1.0)

    while True:
        loop_start = asyncio.get_event_loop().time()
        loop = asyncio.get_event_loop()

        try:
            # Run all blocking collectors in thread pool concurrently
            cpu, ram, disks, net, procs, titles = await asyncio.gather(
                loop.run_in_executor(None, collect_cpu),
                loop.run_in_executor(None, collect_ram),
                loop.run_in_executor(None, collect_disks),
                loop.run_in_executor(None, collect_network),
                loop.run_in_executor(None, collect_top_processes),
                loop.run_in_executor(None, get_window_titles),
            )
        except Exception as e:
            logger.error(f"Agent gather error: {e}")
            await asyncio.sleep(interval)
            continue

        try:
            screenshot = await loop.run_in_executor(None, _capture_screenshot_b64)
        except Exception as e:
            logger.warning(f"Screenshot failed: {e}")
            screenshot = None

        try:
            rdp_shot = await loop.run_in_executor(None, _capture_rdp_b64)
        except Exception as e:
            logger.warning(f"RDP capture failed: {e}")
            rdp_shot = None

        snapshot = AgentSnapshot(
            timestamp=time.time(),
            cpu=cpu,
            ram=ram,
            disks=disks,
            network=net,
            top_processes=procs,
            window_titles=titles,
            screenshot_b64=screenshot,
            rdp_screenshot_b64=rdp_shot,
        )

        # Non-blocking queue put — drop oldest if full
        if queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        await queue.put(snapshot)

        elapsed = asyncio.get_event_loop().time() - loop_start
        await asyncio.sleep(max(0.0, interval - elapsed))
