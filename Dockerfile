# syntax=docker/dockerfile:1
FROM python:3.12-slim

LABEL name="aria" \
      description="ARIA — Autonomous Replying & Intelligent Agent" \
      version="1.0.0"

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── App directory ─────────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies (cached layer) ───────────────────────────────────────
COPY aria/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Source code ───────────────────────────────────────────────────────────────
COPY aria/ ./aria/

# ── Runtime settings ─────────────────────────────────────────────────────────
ENV ARIA_HOST=0.0.0.0
ENV ARIA_PORT=8000
EXPOSE 8000

# ── Health check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# ── Start server ──────────────────────────────────────────────────────────────
CMD ["python", "-m", "aria.server"]
