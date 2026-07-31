# BeeWare / Toga — Native Cross-Platform GUI Toolkit

> **Website:** [beeware.org](https://beeware.org) | [toga.beeware.org](https://toga.beeware.org)  
> **GitHub:** [github.com/beeware/toga](https://github.com/beeware/toga)  
> **Version:** 0.4.x (stable)  
> **License:** BSD  
> **Package:** `toga` on PyPI  
> **Stars:** ~4,000

---

## Overview

BeeWare is a **collection of tools** for building native Python apps. Its GUI toolkit is **Toga**, which renders **truly native widgets** on each platform — a macOS app looks like a macOS app, an iOS app looks like an iOS app, etc.

BeeWare is a **Python Software Foundation** project and is led by Russell Keith-Magee (a Django core developer). It also includes **Briefcase**, a tool for packaging Python projects as standalone native applications.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ✅ | Full support via Briefcase. Requires macOS + Xcode. |
| **macOS** | ✅ | Full support. Native Cocoa widgets via `toga-cocoa`. |
| **Windows** | ✅ | Full support. Native Win32 widgets via `toga-win32`. |
| **Linux** | ✅ | Full support. GTK widgets via `toga-gtk`. Also has Qt backend via `toga-qt`. |
| **Web** | ✅ | Single-page web app support via `toga-web` (DOM-based). |
| **Android** | ✅ | Full support via Briefcase. |
| **tvOS** | ✅ | Experimental support. |

---

## Key Features

- **Truly native widgets** — Each platform uses its own native UI toolkit
- **Single codebase** — One Python codebase deploys everywhere
- **Briefcase packaging** — Build `.app`, `.exe`, `.apk`, `.ipa`, web assets
- **Python Software Foundation backing** — Long-term viability
- **BSD license** — Permissive, business-friendly
- **Native look and feel** — Users can't tell it's not a native app
- **Accessibility** — Inherits native platform accessibility

---

## Architecture

Toga uses a **backend abstraction** pattern:

```
┌─────────────────────┐
│  Your Python App     │
│  (toga.App + widgets)│
├─────────────────────┤
│  Toga Core           │
│  (abstract interface)│
├─────────┬───────────┤
│ Backend  │ Backend   │
│ (native) │ (web)     │
├──────────┴──────────┤
│  Platform-specific   │
│  (Cocoa, GTK, Win32, │
│   UIKit, DOM, etc.)  │
└─────────────────────┘
```

Each platform has its own backend:
- **macOS:** `toga-cocoa` — uses Cocoa/AppKit
- **iOS:** `toga-iOS` — uses UIKit
- **Windows:** `toga-win32` — uses Win32 API
- **Linux:** `toga-gtk` — uses GTK (or `toga-qt` for Qt)
- **Web:** `toga-web` — uses DOM

---

## Getting Started

```bash
# Install with UV
uv add toga

# Create a minimal app
uv run python -c "
import toga
from toga.style import Pack
from toga.style.pack import COLUMN

class DialerApp(toga.App):
    def startup(self):
        self.main_window = toga.MainWindow(title='CherryPhone')
        box = toga.Box(style=Pack(direction=COLUMN))
        label = toga.Label('Hello, BeeWare!')
        box.add(label)
        self.main_window.content = box
        self.main_window.show()

def main():
    return DialerApp('CherryPhone', 'org.cherryphone')

if __name__ == '__main__':
    main().main_loop()
"
```

### Packaging with Briefcase

```bash
# Install Briefcase
uv add briefcase

# Create project
uv run briefcase create

# Build for specific platform
uv run briefcase build macOS    # or iOS, Windows, Linux, Android, web
uv run briefcase run macOS
```

---

## Pros & Cons

### Pros
- ✅ **Truly native UI** — best user experience on each platform
- ✅ **All target platforms** supported (iOS, macOS, Windows, Linux, Web)
- ✅ **Python Software Foundation** backing
- ✅ **BSD license** — permissive
- ✅ **Briefcase** — excellent packaging tool
- ✅ **Accessibility** — native platform accessibility

### Cons
- ❌ **Smaller widget set** — fewer controls than Flet or Qt
- ❌ **Still maturing** — pre-1.0, APIs may change
- ❌ **Smaller community** — ~4k stars, fewer tutorials
- ❌ **Complex setup** — requires platform SDKs (Xcode, GTK, etc.)
- ❌ **Web backend** is less polished than desktop backends
- ❌ **Documentation** can be sparse for advanced use cases
- ❌ **Slower development pace** compared to Flet

---

## Comparison to Flet

| Aspect | BeeWare/Toga | Flet |
|--------|:-----------:|:----:|
| iOS | ✅ | ✅ |
| Web | ✅ | ✅ |
| Native widgets | ✅ (truly native) | ❌ (Flutter) |
| Maturity | Medium (pre-1.0) | Medium (pre-1.0) |
| Community | ~4k stars | ~10k stars |
| Widgets | Basic set | 150+ |
| Setup complexity | High (SDKs needed) | Low |
| Packaging | Briefcase | Built-in `flet build` |
| Learning curve | Medium | Low |

---

## Verdict

BeeWare/Toga is the **best choice for native look-and-feel** across all platforms. If it's critical that your app looks and behaves exactly like a native platform app, Toga is the way to go. However, its **smaller widget set** and **higher setup complexity** make it less practical for CherryPhone than Flet, which offers a richer widget library and simpler development experience.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
