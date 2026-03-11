# ── Frontend Dockerfile ─────────────────────────────────────────────────────
# Multi-stage: build the Vite app, then serve via nginx.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
# VITE_WS_BASE_URL is intentionally left unset so the frontend uses
# window.location.host at runtime (works behind cloudflared).
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config that:
#   - serves the SPA
#   - proxies /api and /ws to the backend
COPY nginx.conf /etc/nginx/conf.d/dashboard.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]