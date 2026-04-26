# 🤖 ARIA — Autonomous Replying & Intelligent Agent

ARIA is a **ready-to-deploy agentic AI** that automates everyday tasks through natural language.
Point it at your inbox and ask it anything — it will figure out the right tools to use and get the job done.

---

## ✨ What ARIA can do out of the box

| Capability | Example prompt |
|---|---|
| 📧 Read emails | `"Read my last 5 unread emails and summarise them"` |
| 📨 Reply to emails | `"Reply to alice@example.com: I'll join the 3 PM call"` |
| 🔍 Search the web | `"What's the latest news on renewable energy?"` |
| 🧩 Combine tools | `"Find John's last email and draft a polite follow-up"` |

More tools can be added by dropping a new file into `aria/tools/` and registering it in `aria/agent.py`.

---

## 🚀 Quick start (local)

### 1 — Clone & configure

```bash
cd aria
cp .env.example .env
# Edit .env and fill in OPENAI_API_KEY (and optionally your email credentials)
```

### 2 — Install dependencies

```bash
pip install -r aria/requirements.txt
```

### 3 — Run the server

```bash
python -m aria.server
```

Open **http://localhost:8000/docs** to explore the interactive API.

---

## 🐳 Deploy with Docker

```bash
# Build
docker build -t aria:latest .

# Run (pass your .env file)
docker run --rm -p 8000:8000 --env-file aria/.env aria:latest
```

### docker-compose (recommended for production)

```yaml
version: "3.9"
services:
  aria:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - aria/.env
    restart: unless-stopped
```

```bash
docker compose up -d
```

---

## 📡 API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/`        | Welcome info |
| `GET`  | `/health`  | Liveness / readiness check |
| `POST` | `/run`     | Run a task   |

### POST /run — example

```bash
curl -X POST http://localhost:8000/run \
     -H "Content-Type: application/json" \
     -d '{"task": "Read my last 3 unread emails and summarise them"}'
```

```json
{
  "result": "You have 3 unread emails: ...",
  "status": "ok"
}
```

Interactive docs: **http://localhost:8000/docs**

---

## 🏗️ Project structure

```
aria/
├── __init__.py         # package marker
├── config.py           # env-based configuration
├── agent.py            # LangChain ReAct agent + tool wiring
├── server.py           # FastAPI REST server
├── requirements.txt    # Python dependencies
├── .env.example        # copy to .env and fill in your credentials
└── tools/
    ├── __init__.py
    ├── email_tool.py   # IMAP read + SMTP reply tools
    └── search_tool.py  # DuckDuckGo / SerpAPI search tool
Dockerfile              # container image
```

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | **required** | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name |
| `AGENT_TEMPERATURE` | `0.2` | LLM temperature |
| `AGENT_MAX_ITERATIONS` | `10` | Max agent reasoning steps |
| `EMAIL_ADDRESS` | — | Your email address |
| `EMAIL_PASSWORD` | — | App password (not your login password) |
| `IMAP_HOST` | `imap.gmail.com` | IMAP server |
| `IMAP_PORT` | `993` | IMAP port |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `EMAIL_FETCH_LIMIT` | `10` | Max emails fetched per request |
| `SERPAPI_KEY` | — | Optional SerpAPI key (Google search) |
| `ARIA_HOST` | `0.0.0.0` | Server bind host |
| `ARIA_PORT` | `8000` | Server port |

> **Gmail tip**: enable 2-factor auth and generate an **App Password** at  
> Google Account → Security → 2-Step Verification → App Passwords.

---

## 🔌 Adding new tools

1. Create `aria/tools/my_tool.py` with a `build_my_tool(cfg)` function that returns a `StructuredTool`.
2. Import and append it to the `tools` list in `aria/agent.py`.
3. Restart the server — ARIA will start using the new tool automatically.

---

## 📜 License

MIT
