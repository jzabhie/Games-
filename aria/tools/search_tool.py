"""
ARIA — Web-search tool
Wraps DuckDuckGo (no API key needed) with an optional fallback to SerpAPI.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from aria.config import Config


class SearchInput(BaseModel):
    query: str = Field(..., description="The search query string")
    max_results: int = Field(default=5, ge=1, le=20, description="Maximum number of results to return")


def build_search_tool(cfg: "Config") -> StructuredTool:
    """Return a web-search LangChain tool (DuckDuckGo by default)."""

    def web_search(query: str, max_results: int = 5) -> str:
        # ── Try SerpAPI if key is provided ────────────────────────────────────
        if cfg.serpapi_key:
            try:
                import requests  # noqa: PLC0415

                params = {
                    "q": query,
                    "api_key": cfg.serpapi_key,
                    "num": max_results,
                    "engine": "google",
                }
                resp = requests.get(
                    "https://serpapi.com/search", params=params, timeout=10
                )
                resp.raise_for_status()
                data = resp.json()
                results = []
                for r in data.get("organic_results", [])[:max_results]:
                    results.append(
                        {
                            "title": r.get("title", ""),
                            "link": r.get("link", ""),
                            "snippet": r.get("snippet", ""),
                        }
                    )
                return json.dumps(results, ensure_ascii=False, indent=2)
            except Exception as exc:  # noqa: BLE001
                # fall through to DuckDuckGo on any error
                fallback_note = f"SerpAPI error ({exc}); falling back to DuckDuckGo. "
        else:
            fallback_note = ""

        # ── DuckDuckGo (no API key required) ──────────────────────────────────
        try:
            from duckduckgo_search import DDGS  # noqa: PLC0415

            with DDGS() as ddgs:
                hits = list(ddgs.text(query, max_results=max_results))
            results = [
                {"title": h.get("title", ""), "link": h.get("href", ""), "snippet": h.get("body", "")}
                for h in hits
            ]
            return fallback_note + json.dumps(results, ensure_ascii=False, indent=2)
        except ImportError:
            return (
                fallback_note
                + "duckduckgo_search package is not installed. "
                "Run: pip install duckduckgo-search"
            )
        except Exception as exc:  # noqa: BLE001
            return fallback_note + f"Search error: {exc}"

    return StructuredTool.from_function(
        func=web_search,
        name="web_search",
        description=(
            "Search the web for up-to-date information. "
            "Returns a JSON array with title, link, and snippet for each result."
        ),
        args_schema=SearchInput,
    )
