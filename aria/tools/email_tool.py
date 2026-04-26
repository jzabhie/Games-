"""
ARIA — Email tools
Provides two LangChain tools:
  • read_emails  — fetch recent unread emails via IMAP
  • reply_email  — send a reply via SMTP
"""

from __future__ import annotations

import email
import imaplib
import json
import smtplib
import textwrap
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from aria.config import Config


# ── Input schemas ─────────────────────────────────────────────────────────────

class ReadEmailsInput(BaseModel):
    limit: int = Field(default=5, ge=1, le=50, description="Maximum number of unread emails to fetch")
    mailbox: str = Field(default="INBOX", description="Mailbox / folder to read from")


class ReplyEmailInput(BaseModel):
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Plain-text body of the email")
    reply_to_message_id: str = Field(
        default="",
        description="Optional Message-ID of the email being replied to (for threading)",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_header_value(raw: str) -> str:
    parts = email.header.decode_header(raw)
    decoded_parts = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded_parts.append(part)
    return "".join(decoded_parts)


def _get_plain_text(msg: email.message.Message) -> str:
    """Extract plain-text body from an email message."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))
            if content_type == "text/plain" and "attachment" not in disposition:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                return payload.decode(charset, errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
    return ""


# ── Tool factory ──────────────────────────────────────────────────────────────

def build_email_tools(cfg: "Config") -> list:
    """Return a list of LangChain tools for email reading and replying."""

    if not cfg.email_address or not cfg.email_password:
        # Return stub tools that explain the missing config rather than crashing
        def _not_configured(*_args, **_kwargs) -> str:
            return (
                "Email tools are not configured. "
                "Please set EMAIL_ADDRESS and EMAIL_PASSWORD in your .env file."
            )

        read_stub = StructuredTool.from_function(
            func=_not_configured,
            name="read_emails",
            description="Fetch recent unread emails. (Not configured — see .env.example)",
            args_schema=ReadEmailsInput,
        )
        reply_stub = StructuredTool.from_function(
            func=_not_configured,
            name="reply_email",
            description="Send an email reply. (Not configured — see .env.example)",
            args_schema=ReplyEmailInput,
        )
        return [read_stub, reply_stub]

    # ── Real implementations ──────────────────────────────────────────────────

    def read_emails(limit: int = 5, mailbox: str = "INBOX") -> str:
        """Fetch the most recent unread emails and return a JSON summary."""
        try:
            with imaplib.IMAP4_SSL(cfg.imap_host, cfg.imap_port) as imap:
                imap.login(cfg.email_address, cfg.email_password)
                imap.select(mailbox)
                _, data = imap.search(None, "UNSEEN")
                uids = data[0].split()
                uids = uids[-limit:]  # take the most recent N
                messages = []
                for uid in reversed(uids):
                    _, msg_data = imap.fetch(uid, "(RFC822)")
                    raw = msg_data[0][1]
                    msg = email.message_from_bytes(raw)
                    messages.append(
                        {
                            "uid": uid.decode(),
                            "from": _decode_header_value(msg.get("From", "")),
                            "subject": _decode_header_value(msg.get("Subject", "(no subject)")),
                            "date": msg.get("Date", ""),
                            "message_id": msg.get("Message-ID", ""),
                            "body_preview": textwrap.shorten(
                                _get_plain_text(msg), width=300, placeholder="…"
                            ),
                        }
                    )
        except imaplib.IMAP4.error as exc:
            return f"IMAP error: {exc}"
        return json.dumps(messages, ensure_ascii=False, indent=2)

    def reply_email(
        to: str,
        subject: str,
        body: str,
        reply_to_message_id: str = "",
    ) -> str:
        """Compose and send an email; returns a status string."""
        msg = MIMEMultipart("alternative")
        msg["From"] = cfg.email_address
        msg["To"] = to
        import re as _re  # noqa: PLC0415
        clean_subject = _re.sub(r"^(re:\s*)+", "", subject, flags=_re.IGNORECASE).strip()
        msg["Subject"] = f"Re: {clean_subject}"
        if reply_to_message_id:
            msg["In-Reply-To"] = reply_to_message_id
            msg["References"] = reply_to_message_id

        msg.attach(MIMEText(body, "plain"))

        try:
            with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.login(cfg.email_address, cfg.email_password)
                smtp.sendmail(cfg.email_address, to, msg.as_string())
        except smtplib.SMTPException as exc:
            return f"SMTP error: {exc}"

        return f"Email sent to {to} with subject '{msg['Subject']}'."

    return [
        StructuredTool.from_function(
            func=read_emails,
            name="read_emails",
            description=(
                "Fetch recent unread emails from the configured inbox. "
                "Returns a JSON array with sender, subject, date, message-id, and body preview."
            ),
            args_schema=ReadEmailsInput,
        ),
        StructuredTool.from_function(
            func=reply_email,
            name="reply_email",
            description=(
                "Send an email reply. Provide the recipient address, subject, and body. "
                "Optionally supply the original message-id for proper threading."
            ),
            args_schema=ReplyEmailInput,
        ),
    ]
