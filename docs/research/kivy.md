# Kivy — Cross-Platform Python Framework for GUI Apps

> **Website:** [kivy.org](https://kivy.org)  
> **GitHub:** [github.com/kivy/kivy](https://github.com/kivy/kivy)  
> **Version:** 2.3.x (stable)  
> **License:** MIT  
> **Package:** `kivy` on PyPI  
> **Stars:** ~19,000

---

## Overview

Kivy is the **oldest and most mature** Python cross-platform UI framework. It uses its own custom widget toolkit (not native OS widgets) built on OpenGL ES 2.0, providing a consistent look and feel across all platforms. Kivy has been in development since 2011 and has a large, established community.

Kivy uses a **declarative language** called **KV** for defining UI layouts, separating design from logic.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ✅ | Supported via Kivy's iOS toolchain (Pythonista integration). Requires Xcode. |
| **macOS** | ✅ | Full support. Can be packaged as `.app` bundle. |
| **Windows** | ✅ | Full support. Can be packaged as `.exe` via PyInstaller. |
| **Linux** | ✅ | Full support. Native packages available. |
| **Web** | ⚠️ | Limited. Can run via SDL2 with Emscripten/WebAssembly, but not a primary target. KivyMD provides some web support. |
| **Android** | ✅ | Full support via python-for-android (p4a). Published apps on Google Play. |

---

## Key Features

- **Custom widget toolkit** — Consistent look across all platforms (not native)
- **OpenGL ES 2.0 rendering** — GPU-accelerated graphics
- **KV language** — Declarative UI definition language
- **Multi-touch support** — Built for touch interfaces from the ground up
- **20+ widgets** — Buttons, labels, text inputs, sliders, lists, etc.
- **KivyMD** — Material Design widget library for Kivy
- **Garden** — Community widget extension system
- **PyInstaller support** — Package for desktop distribution
- **python-for-android** — Build Android APKs
- **Kivy iOS** — Build iOS apps (requires macOS + Xcode)

---

## Architecture

Kivy is a **retained-mode** GUI framework with its own rendering engine:

```
┌─────────────────────────────────┐
│  Your Python Code               │
│  ├── .py files (logic)          │
│  └── .kv files (UI layout)      │
├─────────────────────────────────┤
│  Kivy Core                      │
│  ├── Widget system              │
│  ├── Event dispatcher           │
│  ├── Properties & bindings     │
│  └── Graphics engine (OpenGL)   │
├─────────────────────────────────┤
│  SDL2 / OpenGL ES               │
├─────────────────────────────────┤
│  OS (Windows/macOS/Linux/iOS/Android) │
└─────────────────────────────────┘
```

---

## Getting Started

```bash
# Install with UV
uv add kivy

# Minimal example
uv run python -c "
from kivy.app import App
from kivy.uix.label import Label

class MyApp(App):
    def build(self):
        return Label(text='Hello, Kivy!')

MyApp().run()
"
```

### KV Language Example

```python
# main.py
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout

class DialerUI(BoxLayout):
    pass

class DialerApp(App):
    def build(self):
        return DialerUI()

DialerApp().run()
```

```kv
# dialer.kv
<DialerUI>:
    orientation: 'vertical'
    BoxLayout:
        size_hint_y: 0.2
        TextInput:
            id: number_display
            readonly: True
            font_size: 40
            halign: 'right'
    GridLayout:
        cols: 3
        Button:
            text: '1'
            on_press: app.press_number('1')
        Button:
            text: '2'
            on_press: app.press_number('2')
        # ... more buttons
```

---

## Pros & Cons

### Pros
- ✅ **Most mature** Python cross-platform framework (since 2011)
- ✅ **Large community** — 19k stars, active Discord/forum
- ✅ **MIT license** — completely free, no GPL concerns
- ✅ **GPU-accelerated** — smooth graphics and animations
- ✅ **Touch-first** — designed for mobile from the start
- ✅ **KivyMD** — Material Design widgets available
- ✅ **Good documentation** and many tutorials

### Cons
- ❌ **Custom look-and-feel** — apps don't look native on any platform
- ❌ **Complex build toolchain** for mobile (python-for-android, Xcode)
- ❌ **Limited web support** — not a primary target
- ❌ **KV language** — another DSL to learn
- ❌ **Performance** can be sluggish on complex UIs
- ❌ **Smaller widget set** compared to Qt or Flet
- ❌ **Aging** — development pace has slowed

---

## Comparison to Flet

| Aspect | Kivy | Flet |
|--------|:----:|:----:|
| iOS | ✅ | ✅ |
| Web | ⚠️ (limited) | ✅ (full) |
| Native look | ❌ (custom) | ❌ (Flutter) |
| Maturity | High (since 2011) | Medium (since 2022) |
| Community | 19k stars | ~10k stars |
| Widgets | 20+ (plus KivyMD) | 150+ |
| Mobile packaging | Complex (p4a) | Built-in (`flet build`) |
| Learning curve | Medium (KV lang) | Low (pure Python) |

---

## Verdict

Kivy is a **solid, mature choice** if you don't need web support and are comfortable with its custom look-and-feel. For CherryPhone, the **limited web support** and **non-native appearance** make it less suitable than Flet, which covers all five target platforms more cleanly.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
