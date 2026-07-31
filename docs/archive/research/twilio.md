> **Archived — do not use as an implementation reference.** This document describes a different calling architecture (server-side conference bridge via the Twilio REST API) with a different credential model (Account SID + Auth Token) than what was built (browser-native WebRTC via the Twilio Voice JS SDK, using an API Key pair + TwiML Application). See [`docs/archive/README.md`](../README.md) for details.

# Twilio Python SDK — Voice Call Integration for CherryPhone

> **GitHub:** [github.com/twilio/twilio-python](https://github.com/twilio/twilio-python)  
> **PyPI:** `twilio`  
> **Version:** 9.10.9 (July 2026)  
> **License:** MIT  
> **Stars:** ~2,100

---

## Overview

Twilio's Python SDK provides a full-featured client for the Twilio REST API, including Programmable Voice for making and receiving phone calls. CherryPhone uses Twilio to bridge calls between the user and their destination using the **conference bridge pattern**.

---

## How Twilio Voice Works

Twilio doesn't make calls *from* your app directly. Instead, your app tells Twilio's servers to initiate calls, and Twilio handles the actual telephony. The flow is:

```
┌──────────────┐     1. API call       ┌──────────────┐
│  CherryPhone  │ ──────────────────►  │  Twilio API   │
│  (your code)  │                      │  (REST)       │
└──────────────┘                      └──────┬───────┘
                                             │
                    ┌────────────────────────┼────────────────────┐
                    │ 2. Call destination    │ 3. Call user's     │
                    │    number              │    phone            │
                    ▼                       ▼                    ▼
             ┌──────────────┐       ┌──────────────┐
             │  Destination   │       │  User's Phone │
             │  (e.g. +1 555) │       │  (e.g. +1 555)│
             └──────┬───────┘       └──────┬───────┘
                    │                      │
                    └──────────┬───────────┘
                               │
                        ┌──────▼──────┐
                        │  Conference  │
                        │  Room        │
                        │  (bridged)   │
                        └─────────────┘
```

### Conference Bridge Pattern

CherryPhone uses the **conference bridge** pattern:

1. User enters a phone number in the dialer and taps Call
2. CherryPhone calls the Twilio API to create two call legs:
   - **Leg 1:** Calls the destination number, joins to a conference room
   - **Leg 2:** Calls the user's phone, joins to the same conference room
3. Both parties are connected via the conference bridge
4. When either party hangs up, the conference ends

---

## Twilio Python SDK Installation

```bash
uv add twilio
```

### Minimal Call Example

```python
from twilio.rest import Client

client = Client(account_sid, auth_token)

call = client.calls.create(
    twiml="<Response><Say>Hello!</Say></Response>",
    to="+14155551212",
    from_="+18885551212",
)
print(call.sid)
```

### TwiML Generation

```python
from twilio.twiml.voice_response import VoiceResponse

response = VoiceResponse()
dial = response.dial()
dial.conference("RoomName", beep=False)
print(str(response))
# <?xml version="1.0" encoding="UTF-8"?>
# <Response><Dial><Conference>RoomName</Conference></Dial></Response>
```

---

## CherryPhone Integration

### Architecture

```
src/cherryphone/
├── calling.py     # Twilio call logic (TwilioConfig, initiate_call, make_twiml_conference)
├── settings.py    # Settings UI + cross-platform storage for Twilio credentials
├── dialer.py      # Dialer UI with call button wired to Twilio
└── __main__.py    # App entry point with navigation
```

### `calling.py` — Core Call Logic

- **`TwilioConfig`** — Named tuple holding Account SID, Auth Token, Twilio number, user number
- **`make_twiml_conference(name)`** — Generates TwiML that joins a call to a conference room
- **`initiate_call(config, to_number)`** — Creates two call legs (destination + user) bridged via conference
- **`check_credentials(sid, token)`** — Verifies Twilio credentials with a lightweight API call

### `settings.py` — Credential Storage

Stores four values using Flet's `page.shared_preferences`:

| Key | Description | Example |
|-----|-------------|---------|
| `cherryphone.account_sid` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `cherryphone.auth_token` | Twilio Auth Token | `your_auth_token` |
| `cherryphone.twilio_number` | Purchased Twilio phone number | `+18885551212` |
| `cherryphone.user_number` | User's verified phone number | `+14155551212` |

Storage is **cross-platform**:
- **iOS:** NSUserDefaults
- **macOS/Windows/Linux:** JSON file
- **Web:** localStorage

### `dialer.py` — Call Button

The call button:
1. Reads the dialed number
2. Loads Twilio config from storage
3. Calls `initiate_call()` which creates the conference bridge
4. Shows status feedback (success/error)

---

## Prerequisites for Users

To use CherryPhone calling, users need:

1. **Twilio Account** — Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. **Twilio Phone Number** — Purchase a number with voice capabilities (~$1/mo)
3. **Verified Caller ID** — Add their personal phone number as a verified caller ID in the Twilio Console
4. **Account SID + Auth Token** — Found in the Twilio Console dashboard

---

## Cost Estimates

| Item | Cost |
|------|------|
| Twilio phone number | ~$1.00/month |
| Outbound call (per minute, US) | ~$0.013/min |
| Outbound call (per minute, international) | Varies by country |

---

## Pros & Cons

### Pros
- ✅ **Industry standard** — Used by millions of developers
- ✅ **Reliable** — Carrier-grade telephony infrastructure
- ✅ **Well-documented** — Excellent docs, SDKs, and community
- ✅ **Python SDK** — First-class Python support
- ✅ **Pay-as-you-go** — No monthly minimums
- ✅ **Conference bridge** — Simple pattern for connecting two parties

### Cons
- ❌ **Requires Twilio account** — Users must sign up
- ❌ **Cost per call** — Not free (though very cheap)
- ❌ **Requires a phone number** — Users need a Twilio number + their own verified number
- ❌ **Not a softphone** — Can't make calls directly from the app; uses the user's actual phone
- ❌ **Conference bridge** — Both parties get called; not a direct dial-out

---

## Future Improvements

- **Twilio Client SDK (WebRTC)** — Build a softphone directly in the app so calls don't need the user's physical phone
- **Call recording** — Record calls via Twilio's recording API
- **SMS integration** — Send/receive texts via Twilio's Messaging API
- **Call logs** — Store call history locally
- **DTMF detection** — Detect keypresses during calls for IVR navigation

---

*See the [index](./index.md) for a full comparison of all frameworks.*
