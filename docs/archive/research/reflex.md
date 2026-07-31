# Reflex — Full-Stack Python Web Framework

> **Website:** [reflex.dev](https://reflex.dev)  
> **GitHub:** [github.com/reflex-dev/reflex](https://github.com/reflex-dev/reflex)  
> **Version:** 0.7.x (stable)  
> **License:** Apache 2.0  
> **Package:** `reflex` on PyPI  
> **Stars:** ~22,000

---

## Overview

Reflex (formerly Pynecone) is a **full-stack web framework** that lets you build both frontend and backend in pure Python. It compiles Python components into a React single-page application with a FastAPI backend. Reflex is **web-only** — it does not target mobile or desktop platforms natively.

Reflex is one of the fastest-growing Python frameworks (22k+ stars) and is used by companies like IBM, Microsoft, and Apple for internal tools.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ❌ | No native support. Can be accessed via mobile browser. |
| **macOS** | ❌ | No native support. Can be accessed via browser. |
| **Windows** | ❌ | No native support. Can be accessed via browser. |
| **Linux** | ❌ | No native support. Can be accessed via browser. |
| **Web** | ✅ | Primary target. Full-stack web apps. |
| **Android** | ❌ | No native support. Can be accessed via mobile browser. |

---

## Key Features

- **Full-stack** — Frontend + backend in one Python codebase
- **React compilation** — Python components compile to React
- **Reactive state management** — Automatic UI updates on state changes
- **No JavaScript** — All code is Python
- **Built-in hosting** — Reflex Cloud for deployment
- **Rich component library** — 60+ built-in components
- **AI-native** — Built-in support for AI app patterns
- **Theming** — Customizable with Chakra UI components
- **Database integration** — SQLAlchemy + Alembic support
- **Open source** — Apache 2.0 license

---

## Architecture

```
┌─────────────────────────────────┐
│  Browser                         │
│  ┌───────────────────────────┐  │
│  │  React SPA (compiled from  │  │
│  │  Python components)        │  │
│  └───────────────────────────┘  │
└──────────────┬──────────────────┘
               │ HTTP + WebSocket
┌──────────────▼──────────────────┐
│  Python Backend                  │
│  ┌───────────────────────────┐  │
│  │  FastAPI                   │  │
│  │  Reflex State Management   │  │
│  │  Your application logic    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Getting Started

```bash
# Install with UV
uv add reflex

# Initialize a project
uv run reflex init

# Run
uv run reflex run
```

### Minimal Example

```python
import reflex as rx

class State(rx.State):
    count: int = 0

    def increment(self):
        self.count += 1

def index() -> rx.Component:
    return rx.container(
        rx.heading("Hello, Reflex!"),
        rx.text(f"Count: {State.count}"),
        rx.button("Increment", on_click=State.increment),
    )

app = rx.App()
app.add_page(index)
```

---

## Pros & Cons

### Pros
- ✅ **Full-stack** — frontend and backend in one framework
- ✅ **Large community** — 22k+ stars, fast-growing
- ✅ **Reactive state** — clean, automatic UI updates
- ✅ **No JavaScript** — pure Python
- ✅ **Built-in hosting** — easy deployment
- ✅ **Rich components** — 60+ built-in
- ✅ **AI-native** — good for AI app patterns

### Cons
- ❌ **Web-only** — no mobile or desktop native support
- ❌ **Requires hosting** — not a standalone app
- ❌ **Compilation step** — Python → React adds build time
- ❌ **Not suitable for CherryPhone** — can't target iOS, macOS, Windows, or Linux as native apps
- ❌ **Heavier** — React bundle size
- ❌ **Learning curve** — state management concepts

---

## Comparison to Flet

| Aspect | Reflex | Flet |
|--------|:------:|:----:|
| iOS | ❌ | ✅ |
| macOS | ❌ | ✅ |
| Windows | ❌ | ✅ |
| Linux | ❌ | ✅ |
| Web | ✅ | ✅ |
| Native apps | ❌ | ✅ |
| Full-stack | ✅ (built-in) | ❌ (bring your own) |
| Community | 22k stars | ~10k stars |
| Best for | Web apps | Cross-platform apps |

---

## Verdict

Reflex is an **excellent full-stack web framework** with a large and growing community, but it is **web-only**. For CherryPhone's requirement of running on iOS, macOS, Windows, Linux, and Web, Reflex is **not suitable** — it cannot produce native mobile or desktop applications.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
