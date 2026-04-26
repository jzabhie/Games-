"""
ARIA — FastAPI server
Exposes a simple REST API so ARIA can be deployed as a microservice.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from aria.agent import build_agent
from aria.config import load_config

# Load .env file if it exists (handy for local development)
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aria")

# ── State shared across requests ──────────────────────────────────────────────
_agent_executor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _agent_executor  # noqa: PLW0603
    try:
        cfg = load_config()
        _agent_executor = build_agent(cfg)
        logger.info("ARIA is ready 🚀  model=%s", cfg.openai_model)
    except EnvironmentError as exc:
        logger.warning("ARIA started in limited mode: %s", exc)
    yield


app = FastAPI(
    title="ARIA — Autonomous Replying & Intelligent Agent",
    description=(
        "A ready-to-deploy agentic AI that can reply to emails, "
        "search the web, and automate everyday tasks."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ── Request / response models ─────────────────────────────────────────────────

class TaskRequest(BaseModel):
    task: str


class TaskResponse(BaseModel):
    result: Any
    status: str = "ok"


class HealthResponse(BaseModel):
    status: str
    agent_ready: bool
    version: str = "1.0.0"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health():
    """Liveness / readiness check."""
    return HealthResponse(status="ok", agent_ready=_agent_executor is not None)


@app.post("/run", response_model=TaskResponse, tags=["agent"])
async def run_task(request: TaskRequest):
    """
    Run any natural-language task through ARIA.

    **Examples**
    - `"Read my last 3 unread emails and summarise them"`
    - `"Reply to john@example.com saying I'll join the 3 PM meeting"`
    - `"Search the web for the latest news about renewable energy"`
    """
    if _agent_executor is None:
        raise HTTPException(
            status_code=503,
            detail="ARIA is not ready. Check that OPENAI_API_KEY is set.",
        )
    try:
        output = _agent_executor.invoke({"input": request.task})
        return TaskResponse(result=output.get("output", output))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Agent error for task: %s", request.task)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/", tags=["system"])
async def root():
    return {
        "name": "ARIA",
        "full_name": "Autonomous Replying & Intelligent Agent",
        "docs": "/docs",
        "health": "/health",
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    load_dotenv()
    cfg_port = int(os.environ.get("ARIA_PORT", "8000"))
    cfg_host = os.environ.get("ARIA_HOST", "0.0.0.0")
    uvicorn.run("aria.server:app", host=cfg_host, port=cfg_port, reload=False)
