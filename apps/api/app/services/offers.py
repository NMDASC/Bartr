"""Offers to owners of discovered businesses.

The letter is written once, by hand, for a reader who did not ask to be contacted and may be
seventy. Short, specific, respectful, easy to say no to. Variable fields are the buyer's name
and contact, the business, the price, and an optional paragraph in the buyer's own words.
No model writes this.

Delivery: SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM are set (works with Gmail app
passwords), Resend when RESEND_API_KEY is set, else the offer is stored as queued and the
letter is returned as a preview. We rarely know the owner's email; the request may carry one
(demo), otherwise the letter waits for a phone call or a printed copy.
"""
from __future__ import annotations

import os
import smtplib
import ssl
import time
import uuid
from email.message import EmailMessage

import httpx

from app.services.market.treasury import SHARES


def _money(x: float) -> str:
    return f"${x:,.0f}"


def _place(c: dict) -> str:
    if c.get("address"):
        return c["address"]
    return ", ".join(x for x in (c.get("city"), c.get("state")) if x)


def compose(c: dict, price: float, buyer_name: str, buyer_email: str, buyer_phone: str | None, message: str | None) -> tuple[str, str]:
    owner = (c.get("owners") or [None])[0]
    greeting = f"Dear {owner}," if owner else f"To the owner of {c['name']},"
    cat = c["category"].replace("_", " ")
    area = c.get("city") or c.get("state") or "your area"
    contact = f"reply to this email or call me at {buyer_phone}" if buyer_phone else "reply to this email"
    own_words = f"\n{message.strip()}\n" if message and message.strip() else ""
    body = f"""{greeting}

My name is {buyer_name}. I came across {c['name']} at {_place(c)} and I would like to make you an offer to buy the business.

I am prepared to offer {_money(price)} for the business as it stands today. I arrived at that number from what is publicly known about {c['name']} (its location, its reviews, and what comparable {cat} businesses around {area} have sold for), so it is a starting point rather than a final word. If your books show the business is worth more, I would like to hear that.
{own_words}
There is no obligation on your side. If you are open to a conversation, you can {contact}. If you would rather not hear about this again, reply with the word "no" and I will not contact you further.

Thank you for your time, and for building something worth asking about.

Sincerely,
{buyer_name}
{buyer_email}{(chr(10) + buyer_phone) if buyer_phone else ''}

This letter was sent through Bartr, a marketplace that helps buyers find and make offers on independently owned businesses. Bartr does not represent you and charges you nothing.
"""
    subject = f"An offer for {c['name']}"
    return subject, body


def _send_smtp(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = os.environ["SMTP_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    host, port = os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as s:
        s.starttls(context=ssl.create_default_context())
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        s.send_message(msg)


def _send_resend(to: str, subject: str, body: str) -> None:
    r = httpx.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
                   json={"from": os.getenv("RESEND_FROM", "Bartr <offers@bartr.app>"), "to": [to], "subject": subject, "text": body}, timeout=20)
    r.raise_for_status()


def deliver(to: str | None, subject: str, body: str) -> str:
    """Returns the delivery mode used: smtp | resend | queued | preview."""
    if not to:
        return "queued"
    if all(os.getenv(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM")):
        _send_smtp(to, subject, body)
        return "smtp"
    if os.getenv("RESEND_API_KEY"):
        _send_resend(to, subject, body)
        return "resend"
    return "preview"


def make_offer(store, c: dict, buyer_id: str, buyer_name: str, buyer_email: str, buyer_phone: str | None,
               price: float | None, message: str | None, owner_email: str | None) -> dict:
    price = price or c["valuation"]["v0"]
    subject, body = compose(c, price, buyer_name, buyer_email, buyer_phone, message)
    to = owner_email or c.get("owner_email")
    try:
        delivery = deliver(to, subject, body)
    except Exception:  # noqa: BLE001
        delivery = "queued"
    offer = {"id": f"off_{uuid.uuid4().hex[:10]}", "company_id": c["id"], "company_name": c["name"], "buyer_id": buyer_id,
             "buyer_name": buyer_name, "buyer_email": buyer_email, "buyer_phone": buyer_phone, "price": round(price, 2),
             "status": "sent" if delivery in ("smtp", "resend") else "queued", "delivery": delivery,
             "email": {"to": to, "subject": subject, "body": body}, "created_at": time.time()}
    store.put_offer(offer)
    store.audit({"t": offer["created_at"], "actor": buyer_id, "action": "offer", "payload": {"company": c["id"], "price": price, "delivery": delivery}})
    return offer
