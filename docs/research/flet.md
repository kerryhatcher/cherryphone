# Flet — Cross-Platform Python UI Framework

> **Website:** [flet.dev](https://flet.dev)  
> **GitHub:** [github.com/flet-dev/flet](https://github.com/flet-dev/flet)  
> **Version:** 0.86.4 (July 2025)  
> **License:** Apache 2.0  
> **Package:** `flet` on PyPI

---

## Overview

Flet is a Python UI framework built on top of **Flutter** (Google's cross-platform UI toolkit). It allows developers to build mobile, desktop, and web applications entirely in Python — no Dart, Swift, Kotlin, HTML, or JavaScript required.

Flet uses a **server-driven architecture**: a Python backend process communicates with a Flutter client over a WebSocket connection, sending UI descriptions and receiving events. The Flutter client handles rendering and user interaction.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ✅ | Full support via Flutter. Package with `flet build ios`. |
| **macOS** | ✅ | Full support. Package with `flet build macos`. |
| **Windows** | ✅ | Full support. Package with `flet build windows`. |
| **Linux** | ✅ | Full support. Package with `flet build linux`. |
| **Web** | ✅ | Two modes: (1) Server-side with real-time UI updates via WebSocket, (2) Client-side via WebAssembly (Pyodide) — no server required. |
| **Android** | ✅ | Full support. Package with `flet build android`. |

---

## Key Features

- **150+ built-in widgets** — Material Design and Cupertino (iOS-style) controls
- **Single codebase** — One Python file runs on all platforms
- **Built-in packaging** — `flet build` creates platform-specific bundles (`.app`, `.exe`, `.apk`, `.ipa`, web assets)
- **WebAssembly support** — Flet apps can run entirely in the browser via Pyodide
- **50+ Python packages for mobile** — numpy, pandas, opencv, pillow, cryptography, etc.
- **Accessibility** — Inherits Flutter's accessibility foundations on all platforms
- **Hot reload** — Changes appear instantly during development
- **Adaptive design** — Widgets automatically adapt to platform conventions (Material on Android, Cupertino on iOS)

---

## Architecture

Flet uses a **client-server model**:

```
┌─────────────┐     WebSocket      ┌──────────────┐
│  Flutter     │ ◄──────────────► │  Python       │
│  Client      │    UI commands    │  Backend      │
│  (renders)   │    & events       │  (your code)  │
└─────────────┘                    └──────────────┘
```

- The **Flutter client** is a pre-built binary that connects to the Python backend
- The **Python backend** sends UI descriptions and receives user interaction events
- For web, the Flutter client runs in the browser via WebAssembly

---

## Getting Started

```bash
# Install with UV
uv add flet

# Run as desktop app
uv run flet run app.py

# Run as web app
uv run flet run --web app.py

# Build for distribution
uv run flet build macos    # or windows, linux, ios, android, web
```

### Minimal Example

```python
import flet as ft

def main(page: ft.Page):
    page.title = "Hello, Flet!"
    page.add(ft.Text("Hello, World!"))

ft.run(main)
```

---

## CherryPhone Usage

CherryPhone uses Flet for its dialer UI. The app is structured as:

```
src/cherryphone/
├── __init__.py      # Package metadata
├── __main__.py      # Entry point (ft.run(main))
└── dialer.py        # Dialer UI components
```

Run with:
```bash
uv run cherryphone          # Desktop mode
uv run flet run --web src/cherryphone/__main__.py  # Web mode
```

---

## Pros & Cons

### Pros
- ✅ True cross-platform support (all 5 target platforms + Android)
- ✅ Modern, beautiful UI with Material Design
- ✅ No frontend experience needed — pure Python
- ✅ Active development with frequent releases
- ✅ Built-in packaging for all platforms
- ✅ Works with UV/pip/poetry
- ✅ Good documentation and growing community

### Cons
- ❌ Server-driven architecture adds latency vs. native apps
- ❌ Relatively young framework (v0.86 — pre-1.0)
- ❌ Flutter dependency adds ~30MB to app size
- ❌ Smaller ecosystem than Kivy or Qt
- ❌ Not truly native widgets (rendered by Flutter)
- ❌ Some Flutter-specific knowledge needed for advanced customization

---

## Comparison to Other Frameworks

| Aspect | Flet | Kivy | BeeWare/Toga | PySide6 |
|--------|:----:|:----:|:------------:|:-------:|
| iOS support | ✅ | ✅ | ✅ | ❌ |
| Web support | ✅ | ⚠️ | ✅ | ⚠️ |
| Native widgets | ❌ (Flutter) | ❌ (custom) | ✅ | ✅ |
| Maturity | Medium | High | Medium | High |
| Community size | Growing | Large | Small | Large |
| Learning curve | Low | Medium | Medium | Medium |

---

## Verdict

**Flet is the best choice for CherryPhone** because it's the only framework that fully supports all five target platforms (iOS, macOS, Windows, Linux, and Web) from a single Python codebase with a modern widget set and built-in packaging.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
