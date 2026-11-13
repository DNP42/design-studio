# Design rules v1

Every DNP product redesign implements these rules. The full rules and tokens are in [`foundations/`](../foundations/README.md). This page is the short list.

## Must
- **Motion:** Animate only `transform` and `opacity`. Use the `--motion-*` tokens. Keep a UI transition at 300 ms or less, a page change at 400 ms or less. Support `prefers-reduced-motion`: fade only. → [motion](../foundations/motion/README.md)
- **3D accents (optional):** One per page at most, decorative only, CSS first. WebGL loads after idle, 150 kB gzip or less, with a static fallback. Never on the critical path. → [motion](../foundations/motion/README.md#light-3d-accents-optional)
- **Type:** No text under 18px. Body text 20px, line height 1.6. Sizes in `rem`. → [type](../foundations/type/README.md)
- **Colour:** Use the `--color-*` tokens. Body text 7:1 (AAA), other text 4.5:1 (AA), borders and focus 3:1. Light and dark. Run `check-contrast.py`. → [colour](../foundations/colour/README.md)
- **UI sounds (optional):** Off by default. A labelled mute toggle. The choice is remembered. Never the only signal. → [sound](../foundations/sound/README.md)
- **Performance:** LCP 2.5 s or less, CLS 0.1 or less, TBT 200 ms or less. At most +15 kB gzip JS and +10 kB gzip CSS per redesign. Lighthouse before and after in the PR. → [performance](../foundations/performance/README.md)
- **Accessibility:** WCAG 2.2 AA, plus 44px targets (AAA 2.5.5), visible focus, labels on every input. Paste the checklist into every product PR. → [accessibility](../foundations/accessibility/README.md)

## Product PR template
1. Copy the tokens. Change values for the brand. Run the contrast check.
2. Build against the rules.
3. In the PR: the accessibility checklist, the Lighthouse before/after table, and a screenshot in light and dark.
