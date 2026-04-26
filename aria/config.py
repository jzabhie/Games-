"""
ARIA — Autonomous Replying & Intelligent Agent
Configuration loader: reads all settings from environment variables.
"""

import os
from dataclasses import dataclass


@dataclass
class Config:
    # ── LLM ──────────────────────────────────────────────────────────────────
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    agent_temperature: float = 0.2
    agent_max_iterations: int = 10

    # ── Email (IMAP + SMTP) ───────────────────────────────────────────────────
    email_address: str = ""
    email_password: str = ""
    imap_host: str = "imap.gmail.com"
    imap_port: int = 993
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    email_fetch_limit: int = 10

    # ── Web Search ────────────────────────────────────────────────────────────
    serpapi_key: str = ""          # optional — used by the search tool

    # ── API server ───────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False


def load_config() -> Config:
    """Build a Config from environment variables, raising if required vars are missing."""
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_key:
        raise EnvironmentError(
            "OPENAI_API_KEY is not set. "
            "Please copy .env.example to .env and fill in your credentials."
        )

    return Config(
        openai_api_key=openai_key,
        openai_model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        agent_temperature=float(os.environ.get("AGENT_TEMPERATURE", "0.2")),
        agent_max_iterations=int(os.environ.get("AGENT_MAX_ITERATIONS", "10")),
        email_address=os.environ.get("EMAIL_ADDRESS", ""),
        email_password=os.environ.get("EMAIL_PASSWORD", ""),
        imap_host=os.environ.get("IMAP_HOST", "imap.gmail.com"),
        imap_port=int(os.environ.get("IMAP_PORT", "993")),
        smtp_host=os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        smtp_port=int(os.environ.get("SMTP_PORT", "587")),
        email_fetch_limit=int(os.environ.get("EMAIL_FETCH_LIMIT", "10")),
        serpapi_key=os.environ.get("SERPAPI_KEY", ""),
        host=os.environ.get("ARIA_HOST", "0.0.0.0"),
        port=int(os.environ.get("ARIA_PORT", "8000")),
        debug=os.environ.get("ARIA_DEBUG", "false").lower() == "true",
    )
