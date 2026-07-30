# PySide6 / PyQt — Qt for Python

> **Website:** [qt.io/qt-for-python](https://www.qt.io/development-tools/qt-for-python)  
> **GitHub:** [github.com/qtproject/pyside-pyside-setup](https://github.com/qtproject/pyside-pyside-setup)  
> **Version:** PySide6 6.8.x / PyQt6 6.8.x  
> **License:** PySide6 — LGPL / GPL | PyQt6 — GPL / Commercial  
> **Packages:** `PySide6` or `PyQt6` on PyPI  
> **Stars:** ~2,500 (PySide)

---

## Overview

PySide6 (Qt for Python) and PyQt6 are **Python bindings for the Qt framework**, one of the most powerful and mature cross-platform C++ GUI toolkits. They provide access to the full Qt API, including widgets, networking, multimedia, and more.

Qt is the gold standard for **desktop application development** — it powers apps like KDE, VLC, and many professional tools. However, Qt's mobile and web support is limited.

---

## Platform Support

| Platform | Support | Details |
|----------|:-------:|---------|
| **iOS** | ❌ | No official support. Qt for iOS exists in C++ but Python bindings are not available. |
| **macOS** | ✅ | Full support. Native Cocoa integration. |
| **Windows** | ✅ | Full support. Native Windows integration. |
| **Linux** | ✅ | Full support. Native X11/Wayland integration. |
| **Web** | ⚠️ | Experimental. Qt for WebAssembly exists but Python bindings are not available. |
| **Android** | ❌ | No official Python support. Qt for Android exists in C++ only. |

---

## Key Features

- **Mature and feature-rich** — 30+ years of development
- **Comprehensive widget set** — 500+ classes
- **Qt Designer** — Visual UI designer with drag-and-drop
- **Model/View architecture** — Powerful data-driven UIs
- **Signals & Slots** — Clean event handling
- **QML** — Declarative UI language (Qt Quick)
- **Internationalization** — Built-in i18n support
- **Accessibility** — Full platform accessibility support
- **Professional tooling** — Qt Creator IDE, Qt Designer, Qt Linguist
- **Commercial support** — Available from The Qt Company

---

## Architecture

```
┌─────────────────────────────────┐
│  Your Python Code                │
│  (PySide6 / PyQt6 API calls)     │
├─────────────────────────────────┤
│  Python Bindings (Shiboken / SIP)│
├─────────────────────────────────┤
│  Qt C++ Library                  │
│  ├── QtWidgets (UI controls)     │
│  ├── QtCore (events, threads)    │
│  ├── QtNetwork                   │
│  ├── QtMultimedia                │
│  └── QtWebEngine (Chromium)      │
├─────────────────────────────────┤
│  Platform Adaptation Layer       │
│  (Cocoa, Win32, X11/Wayland)     │
└─────────────────────────────────┘
```

---

## Getting Started

```bash
# Install with UV (PySide6)
uv add PySide6

# Minimal example
uv run python -c "
import sys
from PySide6.QtWidgets import QApplication, QLabel

app = QApplication(sys.argv)
label = QLabel('Hello, Qt!')
label.show()
sys.exit(app.exec())
"
```

### Dialer Example (PySide6)

```python
import sys
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout,
    QGridLayout, QPushButton, QLineEdit
)

class DialerWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("CherryPhone")
        self.setFixedSize(400, 700)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)

        # Number display
        self.display = QLineEdit()
        self.display.setReadOnly(True)
        self.display.setAlignment(Qt.AlignRight)
        self.display.setStyleSheet("font-size: 40px;")
        layout.addWidget(self.display)

        # Dial pad
        grid = QGridLayout()
        keys = [
            ('1', 0, 0), ('2', 0, 1), ('3', 0, 2),
            ('4', 1, 0), ('5', 1, 1), ('6', 1, 2),
            ('7', 2, 0), ('8', 2, 1), ('9', 2, 2),
            ('*', 3, 0), ('0', 3, 1), ('#', 3, 2),
        ]
        for text, row, col in keys:
            btn = QPushButton(text)
            btn.setFixedSize(80, 80)
            btn.clicked.connect(self.on_key_press)
            grid.addWidget(btn, row, col)
        layout.addLayout(grid)

    def on_key_press(self):
        button = self.sender()
        self.display.setText(self.display.text() + button.text())

app = QApplication(sys.argv)
window = DialerWindow()
window.show()
sys.exit(app.exec())
```

---

## Pros & Cons

### Pros
- ✅ **Most feature-rich** — 500+ classes, unmatched depth
- ✅ **Mature and stable** — 30+ years of development
- ✅ **Qt Designer** — Visual UI builder
- ✅ **Excellent documentation** — Qt's official docs are world-class
- ✅ **Professional tooling** — Qt Creator, Qt Linguist
- ✅ **Native look** — Adapts to each desktop platform
- ✅ **Commercial support** available

### Cons
- ❌ **No iOS/Android support** — cannot target mobile
- ❌ **No web support** — Qt for WASM is C++ only
- ❌ **Heavy dependency** — Qt libraries are large (~200MB+)
- ❌ **Licensing complexity** — GPL/LGPL vs commercial
- ❌ **Steep learning curve** — Qt API is vast and complex
- ❌ **Not suitable for CherryPhone** — can't target iOS or Web

---

## Comparison to Flet

| Aspect | PySide6/PyQt | Flet |
|--------|:-----------:|:----:|
| iOS | ❌ | ✅ |
| macOS | ✅ | ✅ |
| Windows | ✅ | ✅ |
| Linux | ✅ | ✅ |
| Web | ❌ | ✅ |
| Widget count | 500+ | 150+ |
| Maturity | Very high | Medium |
| Learning curve | Steep | Low |
| App size | ~200MB | ~30MB |
| License | LGPL/GPL | Apache 2.0 |

---

## Verdict

PySide6/PyQt is the **most powerful desktop GUI toolkit** available for Python, but it **cannot target iOS or Web** — two of CherryPhone's five required platforms. For desktop-only applications, Qt is an excellent choice, but for CherryPhone's cross-platform requirements, **Flet is the better fit**.

---

*See the [index](./index.md) for a full comparison of all frameworks.*
