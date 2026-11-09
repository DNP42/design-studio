---
status: draft
checked: 2026-11-09
---
# particle-swarm (vanilla JS + canvas, no deps)
**Use when:** a page needs a cursor swarm that magnetises to buttons and headings. Hover effect, landing hero, reel b-roll (screen-record it).
**Shows:** a hive. The particles form an ordered golden-angle disc that turns slowly around the cursor. One particle in 12 is a scout: each scout keeps one element and shuttles to it and back, if that element is on screen and within 600px. Near a `[data-swarm]` element, part of the swarm leaves the hive and travels along the element outline at a constant speed. The closer the cursor, the larger that share (about 0% at 90px away, 100% over the element). The rest stay in the hive. The page adds no CSS highlight: the particles are the moving border.
- `data-swarm="border"`: the particles run along the border (rounded corners too), tight to it with a small random offset. Set `border-color: transparent` on the element. The element leans toward the cursor (`data-swarm-magnet`).
- `data-swarm="text"`: the particles run along the glyph outlines (contours, not fill) of the text (one line of text only).
- The swarm takes the tint of the element (`--swarm-color`) and gets brighter while it holds an element.
- Halos are small and uneven; some particles have none.
- Modes: `glow` (additive light) or `contrast` (canvas `mix-blend-mode: difference`, it inverts every pixel it crosses).
**Run:** open `src/index.html` in a browser. No build, no server.
**Use it:** `<script src="swarm.js"></script>` then `const s = createSwarm({ count: 700, color: '#7cf7ff', mode: 'glow', field: 90 })`. API: `s.setMode('contrast')`, `s.setCount(n)`, `s.refresh()` (after DOM changes), `s.destroy()`.
**Style hook:** the script writes `--swarm` (0..1) and the class `.is-swarmed` on each element. Optional: the demo does not use them. Use them in your own CSS if you want a highlight on top of the swarm.
**Rules:** canvas is `position: fixed` with `pointer-events: none`. With `prefers-reduced-motion`, the swarm is calm: 30% of the particles, no idle drift, no element lean. Set `reducedMotion: 'off'` to remove it. The element lean uses the CSS `translate` property, so it does not fight a `transform`.
**Versions:** written 2026-11-09; needs `color-mix()` and canvas `letterSpacing` (Chrome 111+ / Safari 16.2+).
**Result:** not yet looked at by eye, so the status stays `draft`. This version (outline paths, share by distance, no CSS highlight, smaller halos) passes `node --check` only; the outline tracer was checked on a synthetic ring and box in Node. The earlier fill version was checked in Chrome on 2026-11-09 by script (61 fps in calm mode, no JS errors). Next: look at it by eye in a browser, add a still, set `tested`. Ideas: multi-line text, an SVG-path target.
**Related:** [animation-principles-in-code](../../animation-principles-in-code.md), [logo-reveal](../logo-reveal/README.md).
