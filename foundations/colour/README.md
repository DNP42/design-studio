# Colour

Tokens: [`tokens.css`](tokens.css). Check: [`check-contrast.py`](check-contrast.py) (Python 3.9+, stdlib only).

## Rules
1. Use only the `--color-*` tokens. Do not write a hex value in a component.
2. Body text gets 7:1 or more (WCAG AAA). Secondary text, links, error and success text get 4.5:1 or more (AA).
3. Borders, focus rings and icons that carry meaning get 3:1 or more against what is behind them (AA non-text).
4. Do not use colour as the only signal. Add a word or an icon to every error, success or required mark.
5. Supply light and dark. Light is the default. Dark follows `prefers-color-scheme`. `data-theme="light|dark"` on `<html>` overrides the system.
6. When you change a value for a brand, run the check. A failing pair blocks the PR.

```bash
python3 foundations/colour/check-contrast.py path/to/your/tokens.css
```

## Tokens
| Token | Use |
|---|---|
| `--color-bg` | Page background |
| `--color-surface` | Cards, panels, inputs |
| `--color-text` | Body text, headings |
| `--color-text-muted` | Hints, captions. Not for body text. |
| `--color-accent` | Links, primary button background |
| `--color-on-accent` | Text on the accent |
| `--color-border` | Input and card borders |
| `--color-focus` | Focus ring |
| `--color-danger` / `--color-success` | Status text and icons |
