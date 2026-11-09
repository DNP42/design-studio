---
status: draft
checked: 2026-11-09
---
# particle-swarm (vanilla JS + canvas, no deps)
**Use when:** a page needs a cursor swarm that magnetises to buttons and headings. Hover effect, landing hero, reel b-roll (screen-record it).
**Shows:** a hive. The particles form an ordered golden-angle disc that turns slowly around the cursor. One particle in 12 is a scout: scouts fly out to elements within 600px and back, so they report what is near the cursor. Near a `[data-swarm]` element, the swarm is pulled onto it:
- `data-swarm="border"`: 80% of the swarm flows along the element border (rounded corners too). The border bulges toward the cursor, like a magnetic field line. The element leans toward the cursor (`data-swarm-magnet`).
- `data-swarm="text"`: the whole swarm fills the glyphs of the text, and the text fades to an outline (one line of text only).
- The swarm takes the tint of the element (`--swarm-color`) and gets brighter while it holds an element.
- Modes: `glow` (additive light) or `contrast` (canvas `mix-blend-mode: difference`, it inverts every pixel it crosses).
**Run:** open `src/index.html` in a browser. No build, no server.
**Use it:** `<script src="swarm.js"></script>` then `const s = createSwarm({ count: 700, color: '#7cf7ff', mode: 'glow', field: 90 })`. API: `s.setMode('contrast')`, `s.setCount(n)`, `s.refresh()` (after DOM changes), `s.destroy()`.
**Style hook:** the script writes `--swarm` (0..1) and the class `.is-swarmed` on each element. Use them in CSS for the glow, border colour and text colour (see `index.html`).
**Rules:** canvas is `position: fixed` with `pointer-events: none`. With `prefers-reduced-motion`, the swarm is calm: 30% of the particles, no idle drift, no element lean. Set `reducedMotion: 'off'` to remove it. The element lean uses the CSS `translate` property, so it does not fight a `transform`.
**Versions:** written 2026-11-09; needs `color-mix()` and canvas `letterSpacing` (Chrome 111+ / Safari 16.2+).
**Result:** checked in Chrome on 2026-11-09 by script, not by eye, so the status stays `draft`. Run at 61 fps in calm mode, because this Mac has reduce-motion on. On the button: `--swarm` reached 1.0, and lit pixels sat on the border ring (17k) more than inside it (3.8k). On the title: the swarm filled the glyphs (48k lit px) and the text faded to 12% alpha. Contrast mode set `mix-blend-mode: difference`. No JS errors. Next: look at it by eye, add a still, set `tested`. Ideas: multi-line text, an SVG-path target. Known issue: the `destination-out` fade can leave faint alpha residue.
**Related:** [animation-principles-in-code](../../animation-principles-in-code.md), [logo-reveal](../logo-reveal/README.md).
