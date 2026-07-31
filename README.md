# CherryPhone

A WebRTC softphone dialer powered by **Cloudflare Workers** + **Twilio Voice**.

**URL:** [https://phone.kerryhatcher.com](https://phone.kerryhatcher.com)

## Architecture

```
Browser ──► Cloudflare Access ──► Worker ──► D1 (encrypted configs, call logs)
                │                    │            │
                │  (email OTP / SSO) │            └─ AES-GCM encrypted Twilio creds
                │                    │
                └─ Cf-Access-Jwt-Assertion header
                     (verified against Access JWKS; email read from
                      the verified payload, not from a plain header)

Twilio ──► /voice (Access bypass) ──► Worker ──► D1 (config lookup by identity)
             │
             └─ X-Twilio-Signature header
                  (HMAC-SHA1 over URL + sorted POST params, keyed with
                   the account's Auth Token — Twilio can't present an
                   Access login, so this route authenticates itself)
```

- **Frontend:** Vanilla HTML/CSS/JS with Twilio Voice JS SDK
- **Backend:** Cloudflare Worker (TypeScript)
- **Auth:** Cloudflare Access (email OTP / Google SSO)
- **Database:** D1 (SQLite) for encrypted configs + call logs
- **Calling:** Twilio Voice JS SDK — WebRTC directly from browser to phone network

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com) with `phone.kerryhatcher.com` zone
- [Twilio account](https://twilio.com) with a purchased phone number
- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the D1 database
npx wrangler d1 create cherryphone

# 3. Update database_id in wrangler.jsonc with the returned ID.
#    wrangler.jsonc ships with a placeholder
#    ("REPLACE_ME-run-wrangler-d1-create-cherryphone") that cannot be
#    mistaken for a real database — deploys will fail until you replace
#    it with the UUID that `wrangler d1 create` prints out. This step
#    only affects `wrangler deploy` (remote); `wrangler dev` (local)
#    works fine with the placeholder since miniflare simulates D1
#    locally without needing a real database_id.

# 4. Apply the schema to the remote (production) database
npx wrangler d1 execute cherryphone --remote --file=schema.sql
#    For local development instead, use `just db-schema-local`, which
#    targets miniflare's local D1 and needs no real database_id.

# 5. Generate and set the encryption key
openssl rand -hex 32 | npx wrangler secret put ENCRYPTION_KEY

# 6. Set up Cloudflare Access
#    Dashboard → Zero Trust → Access → Applications → Add Application
#    Domain: phone.kerryhatcher.com
#    Policy: Email OTP or Google SSO
#
#    IMPORTANT — add a second, Bypass policy scoped to the path
#    phone.kerryhatcher.com/voice. Twilio's servers POST to /voice
#    whenever the browser client places an outbound call, and they
#    cannot present a Cloudflare Access login — without a bypass policy
#    Access returns its login page to Twilio and every call fails.
#    /voice authenticates the caller itself instead, by validating the
#    X-Twilio-Signature header against your Auth Token (see Architecture
#    below), so bypassing Access on this one path does not weaken auth.

# 7. Configure Access JWT verification
#    The Worker verifies the Cloudflare Access JWT itself rather than
#    trusting the Cf-Access-Authenticated-User-Email header, since that
#    header is only trustworthy on a hostname sitting behind Access.
#    Set these two (non-secret) vars in wrangler.jsonc:
#      - ACCESS_TEAM_DOMAIN — your Zero Trust team domain, e.g.
#        "https://your-team.cloudflareaccess.com"
#      - ACCESS_AUD — the Access Application's Audience (AUD) tag, found
#        at Zero Trust dashboard → Access → Applications → your app →
#        Overview → "Application Audience (AUD) Tag"
#    If either is left unset, the Worker fails closed and rejects all
#    API requests with 401.

# 8. Deploy
npx wrangler deploy

# 9. Create a Twilio API Key and TwiML App (needed for WebRTC calling)
#    Console → Account → API keys & tokens → Create API key (Standard)
#      → note the SID (SKxxxx) and Secret (shown once)
#    Console → Voice → TwiML → TwiML Apps → Create new TwiML App
#      → Voice → "A call comes in" → Webhook
#      → Voice URL: https://phone.kerryhatcher.com/voice  (HTTP POST)
#      → note the TwiML App SID (APxxxx)
```

## Development

```bash
npx wrangler dev
```

## Usage

1. Visit [phone.kerryhatcher.com](https://phone.kerryhatcher.com)
2. Authenticate via Cloudflare Access (email OTP)
3. Go to **Settings** and enter your Twilio credentials:
   - Account SID
   - API Key SID + API Key Secret (signs the WebRTC Access Token)
   - TwiML App SID (its Voice URL must point at `/voice`, see Setup step 9)
   - Auth Token (validates the `/voice` webhook only — not used to sign calls)
   - Twilio Phone Number (caller ID)
4. Go to **Dialer**, enter a number, tap the green call button
5. The browser opens a WebRTC connection to Twilio using an Access Token;
   Twilio calls back to `/voice` to get TwiML telling it who to dial

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Get user's Twilio config |
| `/api/config` | POST | Save user's Twilio config |
| `/api/token` | POST | Generate Twilio Access Token |
| `/api/logs` | GET | Get call history |
| `/api/logs` | POST | Log a call event |
| `/voice` | POST | TwiML App Voice URL — called by Twilio, not the browser. Unauthenticated by Cloudflare Access (needs a bypass policy, see Setup); authenticated instead via `X-Twilio-Signature`. |

## Tech Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Frontend:** Vanilla JS + Twilio Voice JS SDK
- **Database:** D1 (SQLite)
- **Auth:** Cloudflare Access
- **Voice:** Twilio Programmable Voice
- **Encryption:** Web Crypto API (AES-GCM)
