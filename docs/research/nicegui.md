# NiceGUI — Web-Based Python UI Framework

> **Website:** [nicegui.io](https://nicegui.io)  
> **GitHub:** [github.com/zauberzeug/nicegui](https://github.com/zauberzeug/nicegui)  
> **Version:** 2.x (stable)  
> **License:** MIT  
> **Package:** `nicegui` on PyPI  
> **Stars:** ~10,000

---

## Overview

NiceGUI is a **web-based** Python UI framework that renders interfaces in the browser. It sits on top of **FastAPI** with a **Vue.js/Quasar** frontend, providing real-time UI updates over WebSockets. It can also run in **native mode** as a desktop application (essentially a web view).

NiceGUI is pronounced "Nice Guy" and is designed for developers who want to build interactive UIs quickly without writing HTML, CSS, or JavaScript.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ❌ | No native iOS support. Can be accessed via mobile browser. |
| **macOS** | ✅* | Via native mode (web view wrapper) or browser. |
| **Windows** | ✅* | Via native mode (web view wrapper) or browser. |
| **Linux** | ✅* | Via native mode (web view wrapper) or browser. |
| **Web** | ✅ | Primary target. Full support. |
| **Android** | ❌ | No native Android support. Can be accessed via mobile browser. |

> \* Native mode uses a web view — it's not a truly native desktop app.

---

## Key Features

- **Web-based** — Renders in any browser, no installation needed
- **Real-time updates** — WebSocket-based, no page reloads
- **Rich widget set** — Buttons, dialogs, tables, charts, 3D scenes, plots, Markdown
- **Native mode** — Can run as a standalone desktop app (via web view)
- **FastAPI integration** — Full ASGI support
- **Vue.js/Quasar frontend** — Modern, responsive UI
- **No JavaScript required** — All logic in Python
- **Auto-refresh** — Hot reload during development
- **Theming** — Customizable with Quasar themes

---

## Architecture

```
┌─────────────────────────────────┐
│  Browser / Web View             │
│  ┌───────────────────────────┐  │
│  │  Vue.js + Quasar (UI)     │  │
│  │  WebSocket client          │  │
│  └───────────────────────────┘  │
└──────────────┬──────────────────┘
               │ WebSocket
┌──────────────▼──────────────────┐
│  Python Backend                  │
│  ┌───────────────────────────┐  │
│  │  FastAPI + Uvicorn         │  │
│  │  NiceGUI event loop        │  │
│  │  Your application code     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Getting Started

```bash
# Install with UV
uv add nicegui

# Minimal example
uv run python -c "
from nicegui import ui

ui.label('Hello, NiceGUI!')
ui.button('Click me', on_click=lambda: ui.notify('Clicked!'))

ui.run()
"
```

### Native Mode

```python
from nicegui import ui

ui.label('Running as native app')
ui.button('Exit', on_click=ui.app.shutdown)

# native=True opens a native window (web view)
ui.run(native=True, window_size=(400, 700))
```

---

## Pros & Cons

### Pros
- ✅ **Easy to learn** — simple, intuitive API
- ✅ **Rich web widgets** — charts, plots, 3D scenes, tables
- ✅ **Real-time updates** — WebSocket-based reactivity
- ✅ **FastAPI integration** — full ASGI power
- ✅ **Hot reload** — instant feedback during development
- ✅ **Good for dashboards** and data-heavy UIs
- ✅ **MIT license** — permissive

### Cons
- ❌ **No mobile support** — no iOS or Android native apps
- ❌ **Web-only rendering** — not suitable for phone dialer UI
- ❌ **Native mode is a web view** — not truly native
- ❌ **Requires a browser** — can't run as a standalone mobile app
- ❌ **Latency** — WebSocket-based, not instant
- ❌ **Not suitable for CherryPhone** — can't target iOS or Android

---

## Comparison to Flet

| Aspect | NiceGUI | Flet |
|--------|:-------:|:----:|
| iOS | ❌ | ✅ |
| macOS | ✅ (web view) | ✅ (native) |
| Web | ✅ | ✅ |
| Native widgets | ❌ (browser) | ❌ (Flutter) |
| Mobile support | ❌ | ✅ (iOS + Android) |
| Best for | Dashboards, web apps | Cross-platform apps |
| Real-time | ✅ (WebSocket) | ✅ (WebSocket) |
| Learning curve | Low | Low |

---

## Verdict

NiceGUI is an **excellent choice for web dashboards and data-heavy applications**, but it **cannot target iOS or Android** as native apps. For CherryPhone's requirement of running on iOS, macOS, Windows, Linux, and Web, NiceGUI is **not suitable** — it's web-only with desktop wrappers.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
