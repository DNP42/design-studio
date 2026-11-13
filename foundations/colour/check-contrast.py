#!/usr/bin/env python3
"""Check the WCAG contrast of colour tokens. Stdlib only, Python 3.9+.

Usage: python3 check-contrast.py [tokens.css]
Exit 0 when every pair passes, 1 when one fails.
"""
import re
import sys
from pathlib import Path

# (foreground, background, minimum ratio, reason)
PAIRS = [
    ("text", "bg", 7.0, "body text, AAA"),
    ("text", "surface", 7.0, "body text on cards, AAA"),
    ("text-muted", "bg", 4.5, "secondary text, AA"),
    ("text-muted", "surface", 4.5, "secondary text on cards, AA"),
    ("accent", "bg", 4.5, "links, AA"),
    ("accent", "surface", 4.5, "links on cards, AA"),
    ("on-accent", "accent", 4.5, "button label, AA"),
    ("danger", "bg", 4.5, "error text, AA"),
    ("danger", "surface", 4.5, "error text on cards, AA"),
    ("success", "bg", 4.5, "success text, AA"),
    ("success", "surface", 4.5, "success text on cards, AA"),
    ("border", "bg", 3.0, "input borders, AA non-text"),
    ("border", "surface", 3.0, "input borders on cards, AA non-text"),
    ("focus", "bg", 3.0, "focus ring, AA non-text"),
    ("focus", "surface", 3.0, "focus ring on cards, AA non-text"),
]


def luminance(hex_colour):
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    channels = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def read_themes(css):
    themes = []
    for part in re.split(r"/\*\s*@theme\s+", css)[1:]:
        name = part.split()[0]
        tokens = dict(re.findall(r"--color-([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;", part))
        themes.append((name, tokens))
    return themes


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("tokens.css"))
    themes = read_themes(path.read_text())
    if not themes:
        print(f"FAIL: no '/* @theme */' blocks in {path}")
        return 1
    fail = False
    seen = {}
    for name, tokens in themes:
        if name in seen and seen[name] != tokens:
            print(f"FAIL: the '{name}' blocks have different values")
            fail = True
        seen[name] = tokens
    for name, tokens in seen.items():
        print(f"[{name}]")
        for fg, bg, minimum, why in PAIRS:
            if fg not in tokens or bg not in tokens:
                print(f"  FAIL  --color-{fg} or --color-{bg} is missing")
                fail = True
                continue
            r = ratio(tokens[fg], tokens[bg])
            ok = r >= minimum
            fail = fail or not ok
            print(f"  {'ok  ' if ok else 'FAIL'}  {fg:<11} on {bg:<8} {r:5.2f} (min {minimum}) {why}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
