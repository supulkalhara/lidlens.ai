# LidLens — Multi-stage Docker Build
#
# Targets:
#   pipeline      — Python watcher only (K8s sidecar)
#   dashboard     — Next.js only (K8s main container)
#   all-in-one    — Both pipeline + dashboard in one container (laptop / Docker Compose)
#
# Docker Hub:
#   docker pull 190482/lidlenslabs:latest          (all-in-one for laptops)
#   docker pull 190482/lidlenslabs-pipeline:latest  (K8s sidecar)

# ═══════════════════════════════════════════════════════════════
# Stage 1: Python pipeline (with uv)
# ═══════════════════════════════════════════════════════════════
FROM python:3.11-slim AS pipeline-base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Deps layer — cached unless pyproject.toml changes
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

ENV PATH="/app/.venv/bin:$PATH"

COPY pipeline/ pipeline/
COPY config.yaml config.yaml

RUN mkdir -p data/card_statements_locked \
    data/card_statements_unlocked \
    data/card_statements_structured \
    data/card_statements_csv \
    data/chromadb

# Pipeline-only image (used as K8s sidecar)
FROM pipeline-base AS pipeline
CMD ["python", "pipeline/watcher.py"]

# ═══════════════════════════════════════════════════════════════
# Stage 2: Dashboard build (Node.js)
# ═══════════════════════════════════════════════════════════════
FROM node:18-alpine AS dashboard-build

WORKDIR /app

# Deps layer — cached unless package.json changes
COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

# ═══════════════════════════════════════════════════════════════
# Stage 3: Dashboard-only runtime (K8s main container)
# ═══════════════════════════════════════════════════════════════
FROM node:18-alpine AS dashboard

WORKDIR /app

RUN addgroup -S lidlens && adduser -S lidlens -G lidlens

COPY --from=dashboard-build --chown=lidlens:lidlens /app/.next        .next
COPY --from=dashboard-build --chown=lidlens:lidlens /app/node_modules node_modules
COPY --from=dashboard-build --chown=lidlens:lidlens /app/package.json package.json
COPY --from=dashboard-build --chown=lidlens:lidlens /app/public        public
COPY --from=dashboard-build --chown=lidlens:lidlens /app/next.config.js next.config.js

COPY --chown=lidlens:lidlens config.yaml config.yaml

RUN mkdir -p data/card_statements_structured data/chromadb && chown -R lidlens:lidlens data

EXPOSE 3000
USER lidlens
ENV NODE_ENV=production
CMD ["npm", "start"]

# ═══════════════════════════════════════════════════════════════
# Stage 4: All-in-one (laptop / single-container Docker Compose)
# Runs dashboard + pipeline watcher via supervisord
# ═══════════════════════════════════════════════════════════════
FROM python:3.11-slim AS all-in-one

# Install Node.js 18 into the Python base image
RUN apt-get update && apt-get install -y \
    curl supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Python deps (cached)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache
ENV PATH="/app/.venv/bin:$PATH"

# Node deps (cached)
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy everything
COPY . .

# Build Next.js
RUN npm run build

# Pipeline code
COPY pipeline/ pipeline/

# Pre-create data dirs
RUN mkdir -p data/card_statements_locked \
    data/card_statements_unlocked \
    data/card_statements_structured \
    data/card_statements_csv \
    data/chromadb

# supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/lidlens.conf

EXPOSE 3000

ENV NODE_ENV=production

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
