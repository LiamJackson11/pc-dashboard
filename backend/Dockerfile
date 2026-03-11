# ── Backend Dockerfile ──────────────────────────────────────────────────────
# Uses Python 3.12 slim. Runs uvicorn behind a non-root user.
# Screenshot capture works in a desktop session (or VNC) – not in pure headless
# unless you add a virtual framebuffer (Xvfb). See docker-compose.yml notes.
# ────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# System deps:
#   libgl1            – PIL / mss need OpenGL stubs on some distros
#   wmctrl / xdotool  – window enumeration on Linux X11
#   scrot             – fallback screenshot tool
#   procps            – ps / top (for debugging)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        wmctrl \
        xdotool \
        scrot \
        procps \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -s /bin/bash dashboard
USER dashboard
WORKDIR /home/dashboard/app

# Copy & install requirements first (layer caching)
COPY --chown=dashboard:dashboard requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application code
COPY --chown=dashboard:dashboard . .

# Expose the FastAPI port
EXPOSE 8000

# Health check via the root endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')"

# Start the server
CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--ws-ping-interval", "20", \
     "--ws-ping-timeout", "30"]
