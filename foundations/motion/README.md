# Motion

Tokens: [`tokens.css`](tokens.css).

## Rules
1. Every animation has a purpose: it shows where a thing came from, what changed, or that the app got the action. Remove decoration that does none of these.
2. Use only the `--motion-*` tokens. Do not write a duration or an easing in a component.
3. Animate only `transform` and `opacity`. Do not animate `width`, `height`, `top`, `left`, `margin` or `padding`. Animation must not move other content (CLS stays 0 from motion).
4. Keep a UI transition at 300 ms or less. A page or panel change may take 400 ms. Nothing blocks input while it runs.
5. Enter with `--motion-ease-enter`. Exit with `--motion-ease-exit`, and make the exit shorter than the enter.
6. Do not loop. A thing that moves, blinks or scrolls for more than 5 s gets a pause control (WCAG 2.2.2). Nothing flashes more than 3 times a second (WCAG 2.3.1).
7. Do not start motion on scroll alone (no parallax, no scroll-jacking).

## Reduced motion
- Support `prefers-reduced-motion: reduce` on every page. The tokens do most of the work: distances go to 0 and long durations get short, so a move becomes a fade.
- Use a distance token for every translate: `transform: translateY(var(--motion-distance-md))`. Then the component needs no extra code.
- A transition that only moves (no fade) must stop. A spinner may stay, because it is status, but it must not travel.
- Test it: macOS System Settings > Accessibility > Display > Reduce motion, or Chrome DevTools > Rendering > Emulate `prefers-reduced-motion`.

## Example
```css
.toast {
  opacity: 0;
  transform: translateY(var(--motion-distance-md));
  transition:
    opacity var(--motion-duration-base) var(--motion-ease-enter),
    transform var(--motion-duration-base) var(--motion-ease-enter);
}
.toast[data-open] { opacity: 1; transform: none; }
```

## Light 3D accents (optional)
A 3D accent is decoration. A product does not need one.
- Use one accent per page at most. Mark it `aria-hidden="true"`. It holds no text, link or control.
- Prefer CSS 3D (`perspective`, `rotateX/Y`): 0 kB of JavaScript.
- Use WebGL only when CSS cannot do it. Load it in a separate chunk after the page is idle (`requestIdleCallback`, then dynamic `import()`). Keep the chunk at 150 kB gzip or less.
- Never put it on the critical path: not the LCP element, not in a form, not before the main action works.
- Show a static fallback image first, with the same size, so the swap causes no layout shift. Keep the fallback when reduced motion is on, when `navigator.connection.saveData` is true, or when WebGL fails.
- Stop the render loop when the accent is off screen (`IntersectionObserver`) or the tab is hidden (`visibilitychange`).
