# Foundations

The design rules every DNP product redesign implements. The defaults are made for users over 65. They are brand-free: change the token values for a brand, then run the checks.

| Rule set | Tokens | Check |
|---|---|---|
| [Motion](motion/README.md), with reduced motion and light 3D accents | [`motion/tokens.css`](motion/tokens.css) | Manual: reduced-motion emulation |
| [Type](type/README.md): 18px minimum, 20px body | [`type/tokens.css`](type/tokens.css) | Manual: zoom and spacing test |
| [Colour](colour/README.md): AAA body text, AA for the rest, light and dark | [`colour/tokens.css`](colour/tokens.css) | `python3 colour/check-contrast.py` |
| [UI sounds](sound/README.md): off by default, mute toggle | – | Manual |
| [Performance budget](performance/README.md) | – | Lighthouse before and after |
| [Accessibility checklist](accessibility/README.md) | – | Copy into each product PR |

## Use
1. Copy the three `tokens.css` files into the product. Load them before other CSS.
2. Change values for the brand. Keep the token names.
3. Run `check-contrast.py` on the colour file.
4. Build against the rules. Paste the accessibility checklist and the Lighthouse table into the PR.
