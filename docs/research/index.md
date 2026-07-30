# Python Cross-Platform UI Frameworks — Research Summary

> **Project:** CherryPhone  
> **Date:** 2025-07-29  
> **Goal:** Find Python UI frameworks that can target **iOS, macOS, Windows, Linux, and Web** from a single codebase.

---

## Quick Comparison

| Framework | iOS | macOS | Windows | Linux | Web | Native Look | License | Stars |
|-----------|:---:|:-----:|:-------:|:----:|:---:|:-----------:|:--------|:-----:|
| **[Flet](./flet.md)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (adaptive) | Apache 2.0 | ~10k |
| **[Kivy](./kivy.md)** | ✅ | ✅ | ✅ | ✅ | ⚠️ (via KivyMD/SDL2) | ❌ (custom) | MIT | ~19k |
| **[BeeWare/Toga](./beeware-toga.md)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (native) | BSD | ~4k |
| **[NiceGUI](./nicegui.md)** | ❌ | ✅* | ✅* | ✅* | ✅ | N/A (browser) | MIT | ~10k |
| **[Reflex](./reflex.md)** | ❌ | ❌ | ❌ | ❌ | ✅ | N/A (browser) | Apache 2.0 | ~22k |
| **[PySide6/PyQt](./pyside-pyqt.md)** | ❌ | ✅ | ✅ | ✅ | ⚠️ (Qt for WASM) | ✅ (native) | LGPL/GPL | ~5k |

> \* NiceGUI can be packaged as a native desktop app via its native mode, but it's still a web view underneath.

---

## Framework Overviews

### [Flet](./flet.md) — ⭐ Best Overall Match
Flet wraps Flutter and exposes it to Python. It is the **only framework** that fully supports all five target platforms (iOS, macOS, Windows, Linux, and Web) with a **single Python codebase**, a **modern widget set** (Material + Cupertino), and **built-in packaging** for all platforms.

- **Strengths:** True cross-platform, modern UI, active development, built-in packaging, 150+ widgets
- **Weaknesses:** Relatively young (v0.86), server-driven architecture adds latency, Flutter dependency
- **Verdict:** **Recommended** for CherryPhone

### [Kivy](./kivy.md) — Mature & Battle-Tested
Kivy is the oldest Python cross-platform framework. It uses its own custom widget toolkit (not native) and supports iOS, Android, Windows, macOS, and Linux. Web support is limited.

- **Strengths:** Mature (19k stars), large community, MIT license, good documentation
- **Weaknesses:** Custom look-and-feel (not native), complex build toolchain for mobile, limited web support
- **Verdict:** Good choice if you don't need web and want a mature framework

### [BeeWare/Toga](./beeware-toga.md) — True Native UI
BeeWare's Toga toolkit renders **native widgets** on each platform. It supports iOS, macOS, Windows, Linux, Android, and web (single-page app mode).

- **Strengths:** Truly native UI on every platform, strong tooling (Briefcase), Python Software Foundation backing
- **Weaknesses:** Smaller ecosystem, fewer widgets, still maturing, can be complex to set up
- **Verdict:** Best for native look-and-feel, but smaller ecosystem

### [NiceGUI](./nicegui.md) — Web-First with Desktop Packaging
NiceGUI is a web-based framework that renders in the browser. It can be packaged as a native desktop app using its native mode (essentially a web view).

- **Strengths:** Rich web widgets, real-time updates via WebSockets, easy to use, great for dashboards
- **Weaknesses:** No mobile (iOS/Android) support, web-only rendering, not suitable for phone dialer UI
- **Verdict:** Great for web dashboards, not suitable for mobile apps

### [Reflex](./reflex.md) — Full-Stack Web Framework
Reflex (formerly Pynecone) is a full-stack web framework that compiles Python to React. It's web-only.

- **Strengths:** Full-stack (frontend + backend), reactive state management, large community (22k stars)
- **Weaknesses:** Web-only, no mobile or desktop native support, requires hosting
- **Verdict:** Excellent for web apps, not suitable for mobile/desktop targets

### [PySide6 / PyQt](./pyside-pyqt.md) — Desktop Powerhouse
Qt bindings for Python. Excellent for desktop (Windows, macOS, Linux) but no iOS/Android support. Web support is experimental via Qt for WebAssembly.

- **Strengths:** Mature, feature-rich, native look, excellent documentation, Qt Designer
- **Weaknesses:** No mobile support, heavy dependency, licensing complexity (GPL/LGPL)
- **Verdict:** Best for desktop-only apps, not suitable for CherryPhone's mobile+web requirements

---

## Recommendation for CherryPhone

**Flet** is the strongest candidate for CherryPhone because:

1. ✅ **All five platforms** from a single codebase
2. ✅ **Modern Material Design** widgets that look great on mobile
3. ✅ **Built-in packaging** for App Store, Google Play, and desktop
4. ✅ **Web support** via WebAssembly (Pyodide) or server-side
5. ✅ **Active development** (v0.86.4, frequent releases)
6. ✅ **UV-compatible** — works perfectly with `uv add flet`

The CherryPhone dialer has already been built with Flet and is running successfully.

---

## Report Index

| Report | File |
|--------|------|
| Flet | [flet.md](./flet.md) |
| Kivy | [kivy.md](./kivy.md) |
| BeeWare / Toga | [beeware-toga.md](./beeware-toga.md) |
| NiceGUI | [nicegui.md](./nicegui.md) |
| Reflex | [reflex.md](./reflex.md) |
| PySide6 / PyQt | [pyside-pyqt.md](./pyside-pyqt.md) |
| Twilio Integration | [twilio.md](./twilio.md) |
| Summary (this file) | [index.md](./index.md) |
