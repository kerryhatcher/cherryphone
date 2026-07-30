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

# 3. Update database_id in wrangler.jsonc with the returned ID

# 4. Apply the schema
npx wrangler d1 execute cherryphone --file=schema.sql

# 5. Generate and set the encryption key
openssl rand -hex 16 | npx wrangler secret put ENCRYPTION_KEY

# 6. Set up Cloudflare Access
#    Dashboard → Zero Trust → Access → Applications → Add Application
#    Domain: phone.kerryhatcher.com
#    Policy: Email OTP or Google SSO

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
   - Auth Token
   - Twilio Phone Number
4. Go to **Dialer**, enter a number, tap the green call button
5. Call goes directly from your browser via WebRTC

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Get user's Twilio config |
| `/api/config` | POST | Save user's Twilio config |
| `/api/token` | POST | Generate Twilio Access Token |
| `/api/logs` | GET | Get call history |
| `/api/logs` | POST | Log a call event |

## Tech Stack

- **Runtime:** Cloudflare Workers (TypeScript)
- **Frontend:** Vanilla JS + Twilio Voice JS SDK
- **Database:** D1 (SQLite)
- **Auth:** Cloudflare Access
- **Voice:** Twilio Programmable Voice
- **Encryption:** Web Crypto API (AES-GCM)
