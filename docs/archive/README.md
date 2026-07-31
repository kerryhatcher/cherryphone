# Archive

This directory holds documentation from a superseded design direction. It's kept for historical rationale, not as a reference for the current implementation.

**Archived:** 2026-07-30

## What's here

`research/` — framework and integration research written 2025-07-29 through 2026-07-30, before the current implementation existed:

- `index.md`, `flet.md`, `kivy.md`, `beeware-toga.md`, `nicegui.md`, `reflex.md`, `pyside-pyqt.md` — a comparison of six Python cross-platform UI frameworks, recommending **Flet**.
- `twilio.md` — documents the **Python** Twilio SDK and a **conference-bridge** calling architecture, where the server places two call legs via the REST API and joins them in a conference room.

## What was actually built instead

CherryPhone is a **TypeScript Cloudflare Worker** serving a **vanilla JS** frontend:

| Area | Original plan (archived) | Actual implementation |
|------|---------------------------|------------------------|
| Language | Python | TypeScript |
| Frontend | Cross-platform UI framework (Flet) | Vanilla HTML/CSS/JS |
| Backend | Not specified beyond the UI framework | Cloudflare Worker |
| Storage | Not specified | D1 (SQLite), encrypted configs + call logs |
| Calling | Twilio REST API, conference-bridge pattern | Twilio Voice JS SDK 2.x, browser-native WebRTC |
| Call endpoint | Server (two call legs joined in a conference) | Browser (the browser itself is the call endpoint) |
| Auth | Not specified | Cloudflare Access (email OTP / Google SSO) |

## Warning: `research/twilio.md` describes a different architecture

`research/twilio.md` documents the conference-bridge pattern, which needs only Twilio REST API credentials (Account SID + Auth Token). The implemented WebRTC pattern needs a different credential set entirely — an API Key pair (SID + Secret) plus a TwiML Application — and a different request flow (Access Tokens issued to the browser, not REST calls that place call legs).

Do not use `research/twilio.md` as an implementation reference. See the main [README.md](../../README.md) for the current architecture and setup.
