# Performance budget

A redesign must not make a product slower. Measure before and after on the same build setup.

## Targets (Lighthouse, mobile preset, median of 3 runs)
| Metric | Target |
|---|---|
| Largest Contentful Paint (LCP) | 2.5 s or less |
| Cumulative Layout Shift (CLS) | 0.1 or less |
| Total Blocking Time (TBT) | 200 ms or less |
| Interaction to Next Paint (INP), field data when you have it | 200 ms or less |
| Performance score | 90 or more, and not lower than before |
| Accessibility score | 100 |

## Budget for a redesign PR
1. Add 15 kB gzip of JavaScript or less to the first load, compared with the build before the PR.
2. Add 10 kB gzip of CSS or less.
3. Add no runtime dependency over 10 kB gzip without the owner's OK. Name each new dependency and its size in the PR.
4. Use CSS for transitions and simple effects. Do not add an animation library for what CSS can do.
5. Fonts: the system stack, or two `woff2` files or fewer, 100 kB total or less, preloaded, `font-display: swap`.
6. Images: set `width` and `height`. Use AVIF or WebP. Use `loading="lazy"` below the fold. Never lazy-load the LCP image.
7. A 3D accent loads in its own chunk after the page is idle. It is outside the first-load budget, but keep it at 150 kB gzip or less (see [motion](../motion/README.md#light-3d-accents-optional)).
8. Sound files are outside the first-load budget, because they load only after the user turns sound on (see [sound](../sound/README.md)).

## Measure
Run each command 3 times on the before build and 3 times on the after build. Take the median.

```bash
npx lighthouse <url> --only-categories=performance,accessibility --output=json --output-path=./lh.json --quiet
jq '{perf: .categories.performance.score, a11y: .categories.accessibility.score, lcp: .audits["largest-contentful-paint"].numericValue, cls: .audits["cumulative-layout-shift"].numericValue, tbt: .audits["total-blocking-time"].numericValue}' lh.json
```

Put this table in the PR:

| | Before | After |
|---|---|---|
| Performance | | |
| Accessibility | | |
| LCP (s) | | |
| CLS | | |
| TBT (ms) | | |
| First-load JS (kB gzip) | | |
| CSS (kB gzip) | | |
