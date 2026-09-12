# Backlog

Ideas we are not building yet. Each one is a post-MVP option, not a commitment.

## Chat with the owner

A direct message thread between a buyer and the real owner of a listed company.
Lives on `/company/[id]` next to the order ticket, so interest in a business can
turn into a conversation without leaving the page.

- Thread per (user, company), backed by a `messages` collection.
- Owner side needs an identity path: claim-your-listing flow, email verification.
- Buyer sees owner response rate / last active, so dead listings are obvious.
- Open question: does the owner get a full account, or a magic-link inbox only?

## Scheduled outreach pipeline

A CRM-style pipeline for contacting owners at scale instead of one at a time.
The user picks a set of companies, writes (or generates) a first-touch message,
and the system sends it on a schedule with follow-ups.

- Stages: Sourced -> Contacted -> Replied -> In diligence -> Offer -> Closed.
- Drag a company between stages; each stage has its own default cadence.
- Sequence builder: day 0 email, day 3 follow-up, day 7 break-up, stop on reply.
- Grok drafts the message from the `CompanyProfile` so it cites real details.
- Needs a sending backend (Resend/Postmark), unsubscribe handling, and rate caps
  so this does not become a spam cannon.

## Talk to the AI version of the company

An AI persona per company that a user can interview like a human, to learn about
the business before ever contacting the real owner. Grounded in the same
extracted `CompanyProfile`, sources, and valuation, so it can answer "what does
this place actually do", "who are your customers", "why are you selling" and
cite where the answer came from.

- Text first: a chat panel on the company page over the profile + sources.
- Must refuse or say "not in my sources" instead of inventing financials.
- Persona sheet per company: tone, tenure, what the owner would and would not say.

### Voice, possibly ElevenLabs

Same persona, but as a phone-style call, so the interview feels like a real
conversation with a business owner.

- ElevenLabs Agents for speech-to-speech, with our profile data as the knowledge
  base and a webhook tool back into our API for valuation and market numbers.
- One voice per company, picked deterministically from the profile (region, age,
  gender) so the same business always sounds the same.
- Alternative if ElevenLabs does not fit: Grok voice API, or browser TTS as a
  cheap fallback.
- Also lines up with the MLH ElevenLabs prize track, which we currently skip.
- Unknowns: latency on a laptop over conference wifi, cost per minute, and
  whether a live demo call is too risky on stage versus a recorded clip.
