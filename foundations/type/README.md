# Type

Tokens: [`tokens.css`](tokens.css). The defaults are for readers over 65.

## Rules
1. Body text is 20px (`--text-base`). No text is smaller than 18px (`--text-sm`). This includes labels, buttons, hints, footers and legal text.
2. Use `rem` for every size. Do not set `font-size` on `html` in px. Then the browser font setting and zoom scale all text.
3. Body line height is 1.6. Heading line height is 1.25. Keep paragraph spacing at 1.5 × the font size or more.
4. Keep a line at 65 characters or less (`max-width: var(--measure)`).
5. Use weight 400 or more for body text. Do not use thin or light weights (100–300).
6. Do not set text in all capitals for more than two words. Do not use italic for long text.
7. Left-align text in left-to-right languages. Do not justify.
8. Page text must survive the WCAG 1.4.12 spacing test: line height 1.5, paragraph spacing 2, letter spacing 0.12, word spacing 0.16 (in em). Nothing clips or overlaps.
9. Use the system font stack by default. A web font is allowed only inside the [performance budget](../performance/README.md): two `woff2` files or fewer, `font-display: swap`, and a fallback with `size-adjust` so the swap does not shift the layout.

## Scale
| Token | Size | Use |
|---|---|---|
| `--text-sm` | 18px | Hints, captions, footer |
| `--text-base` | 20px | Body, inputs, buttons |
| `--text-lg` | 24px | Lead text, h3 |
| `--text-xl` | 30px | h2 |
| `--text-2xl` | 36px | h1 on mobile |
| `--text-3xl` | 48px | h1 on desktop |
