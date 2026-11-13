/* particle-swarm: a cursor swarm that is pulled onto [data-swarm] elements.
 * No dependencies. Load with <script src="swarm.js"></script>, then call createSwarm().
 *
 * Element attributes:
 *   data-swarm="border"   particles travel along the border (rounded corners too)
 *   data-swarm="text"     particles travel along the glyph outlines of the element's text (one line)
 *   data-swarm="shape"    particles draw a generated shape centred on the element: data-swarm-shape="egg"
 *                         (a click cycles the design; data-swarm-design="n" picks the start)
 *                         music icons in a ring: play (click toggles pause) | next | prev | stop
 *   data-swarm-scout="off"  scouts skip this element (for a target that must stay hidden)
 * The closer the cursor, the larger the share of the swarm that leaves the hive for the element.
 *   data-swarm-path="offset"  text path style: border (on the outline) | offset (pushed out 5px) | shadow (shifted down-right)
 *   data-swarm-prose      running text (descriptions, info): the swarm avoids it, lights it, goes behind it or over it
 *   data-swarm-info="text"  rest the cursor on the element: the swarm draws a circled 'i' above it and the text shows below it
 *                           (a tooltip, linked with aria-describedby; keyboard focus shows it too)
 *   data-swarm-danger     a danger action: the swarm draws a circled X in dangerColor (red) instead of the 'i'
 *   data-swarm-magnet="0.2"  how far the element leans toward the cursor (0 = none)
 * Live tuning: swarm.set({ spacing, size, orbit, stiffness, scouts, field, pathSpeed, curve, glow, count, ... }).
 * CSS: style .swarm-tip (and .swarm-tip.is-danger) for the info text; .is-on is set while it shows.
 *   While it shows, the tip is a swarm target too: half the focused particles run its border, and it gets
 *   --swarm, --swarm-color and .is-swarmed like a button.
 * CSS on the element:
 *   --swarm-color         swarm tint while it holds this element
 *   --swarm               written by the script, 0..1, use it in your own CSS
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // golden angle: an even, comb-like disc
  const SCOUT_RANGE = 600;
  const TEXT_PATHS = { border: [0, 0, 0], offset: [0, 0, 5], shadow: [4, 5, 0] };   // [shift x, shift y, push out] px

  function createSwarm(opts) {
    const o = Object.assign({
      count: 700,
      color: '#7cf7ff',
      mode: 'glow',        // 'glow' (additive light) | 'contrast' (difference blend, inverts what is under it)
      spacing: 24,         // hive radius in px at full focus (60% of it at rest)
      size: 1,             // particle size scale (dots, halos, tails)
      orbit: 1,            // hive orbit speed scale (0 = still)
      stiffness: 1,        // follow tightness scale: low = lags behind the cursor
      scouts: 1 / 12,      // share of particles that scout (0 = none)
      field: 90,           // px around an element where the pull starts
      pathSpeed: 90,       // px per second along an outline
      curve: 2,            // share of the swarm on the element = k^curve
      glow: 1,             // alpha scale of dots, halos, tails and the queen
      magnet: 0.15,        // default lean toward the cursor
      trail: 0.3,          // tail length: lower = longer tails
      selector: '[data-swarm]',
      textPath: 'border',    // text path style: 'border' | 'offset' | 'shadow'; per element: data-swarm-path
      prose: 'avoid',        // running text [data-swarm-prose]: 'avoid' | 'highlight' (spotlight, styled by the page) | 'behind' | 'over'
      proseGap: 10,          // px the swarm keeps clear of running text in 'avoid'
      burst: true,
      info: true,            // [data-swarm-info] / [data-swarm-danger]: after infoDelay on the element, the swarm draws the icon
      infoDelay: 0.6,        // s the cursor rests on the element before the icon forms
      dangerColor: '#ff4d4d',           // a click on a border target breaks its label into particles (page CSS: .is-burst)
      reducedMotion: 'calm', // with prefers-reduced-motion: 'calm' (30% count, no drift, no lean) | 'off'
    }, opts || {});

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const calm = reduce && o.reducedMotion === 'calm';
    const off = reduce && o.reducedMotion === 'off';
    if (calm) { o.magnet = 0; }
    const cvs = document.createElement('canvas');
    cvs.setAttribute('aria-hidden', 'true');
    Object.assign(cvs.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '9999',
    });
    document.body.appendChild(cvs);
    // Tooltip base: hidden until .is-on. Put first in <head>, so the page CSS wins.
    const tipCss = document.createElement('style');
    tipCss.textContent = `.swarm-tip{position:fixed;left:0;top:0;z-index:${+cvs.style.zIndex - 1};pointer-events:none;transform:translateX(-50%);` +
      `visibility:hidden;opacity:0;transition:opacity .2s,visibility .2s}.swarm-tip.is-on{visibility:visible;opacity:1}`;
    document.head.prepend(tipCss);
    let tipId = 0, danger = null, dangerSrc = null;
    const ctx = cvs.getContext('2d');

    const probe = document.createElement('canvas').getContext('2d');
    function toRGB(c) {
      probe.fillStyle = '#000';
      probe.fillStyle = c;
      const v = probe.fillStyle;
      if (v[0] === '#') return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
      return v.match(/[\d.]+/g).slice(0, 3).map(Number);
    }

    let W = 0, H = 0;
    let N, X, Y, VX, VY, PH, K, S, U, R, Q;
    let live = 0, spin = 0;
    let els = [], prose = [], boxes = [];
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    let has = false, t = 0, last = performance.now(), raf = 0;
    const base = toRGB(o.color);
    const col = base.slice();
    const tmp = new Float32Array(4);

    // Resize the arrays in place: the first min(old, n) particles keep their state, new ones start near the cursor.
    function alloc(n) {
      const keep = Math.min(N || 0, n);
      const grow = a => { const b = new Float32Array(n); if (a) b.set(a.subarray(0, keep)); return b; };
      X = grow(X); Y = grow(Y); VX = grow(VX); VY = grow(VY); PH = grow(PH);
      K = grow(K); S = grow(S); U = grow(U); R = grow(R); Q = grow(Q);
      N = n;
      for (let i = keep; i < n; i++) {
        X[i] = cx + (Math.random() - 0.5) * 200;
        Y[i] = cy + (Math.random() - 0.5) * 200;
        PH[i] = Math.random() * TAU;
        K[i] = 0.02 + Math.random() * 0.015;                 // spring stiffness: low = lags behind
        S[i] = 0.6 + Math.random() * 1.3;
        U[i] = Math.random();                                 // slot on a border
        R[i] = Math.random();                                 // look: halo size and brightness
        Q[i] = Math.random();                                 // rank: leaves the hive when share > Q
      }
    }

    function baseRect(e) {
      const r = e.el.getBoundingClientRect();
      return { left: r.left - e.tx, top: r.top - e.ty, width: r.width, height: r.height };
    }

    function sampleText(e) {
      const r = baseRect(e);
      const w = Math.ceil(r.width), h = Math.ceil(r.height);
      e.pts = null;
      if (!w || !h) return;
      const oc = document.createElement('canvas');
      oc.width = w; oc.height = h;
      const c = oc.getContext('2d', { willReadFrequently: true });
      drawText(c, e.el, w, h);
      const data = c.getImageData(0, 0, w, h).data;
      Object.assign(e, outline(data, w, h));
    }

    // Paint an element's text in white where CSS lays it out, in a w x h box (layout px).
    function drawText(c, el, w, h) {
      const cs = getComputedStyle(el);
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in c) c.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff';
      let text = el.textContent.trim().replace(/\s+/g, ' ');
      if (cs.textTransform === 'uppercase') text = text.toUpperCase();
      const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
      let x = pl;
      if (cs.textAlign === 'center') { c.textAlign = 'center'; x = pl + (w - pl - pr) / 2; }
      else if (cs.textAlign === 'right' || cs.textAlign === 'end') { c.textAlign = 'right'; x = w - pr; }
      else c.textAlign = 'left';
      // CSS puts half the leading above the font's content area; place the baseline the same way.
      const m = c.measureText(text);
      const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      const baseY = pt + (h - pt - pb - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent;
      c.fillText(text, x, baseY);
    }

    // Click burst: the label (.lbl, or the element) breaks into one particle per few glyph pixels.
    // The page's CSS grows and hides the label (class is-burst); the particles scatter, drift to the hive and fade.
    const BURST_MAX = 900, BURST_LIFE = 1.4;
    let bursts = [];
    function burst(e) {
      const el = e.el;
      el.classList.remove('is-burst');
      void el.offsetWidth;                                    // restart the CSS animation on a quick second click
      el.classList.add('is-burst');
      clearTimeout(e.bt);
      e.bt = setTimeout(() => el.classList.remove('is-burst'), 1300);
      setTimeout(() => {                                      // at full grow: the CSS hides the text now
        const lbl = el.querySelector('.lbl') || el, r = lbl.getBoundingClientRect();
        const lw = lbl.offsetWidth, lh = lbl.offsetHeight, w = Math.ceil(r.width), h = Math.ceil(r.height);
        if (!lw || !lh || !w || !h) return;
        const oc = document.createElement('canvas');
        oc.width = w; oc.height = h;
        const c = oc.getContext('2d', { willReadFrequently: true });
        c.scale(r.width / lw, r.height / lh);
        drawText(c, lbl, lw, lh);
        const data = c.getImageData(0, 0, w, h).data;
        let filled = 0;
        for (let p = 3; p < data.length; p += 4) if (data[p] > 128) filled++;
        const step = Math.max(1, Math.ceil(Math.sqrt(filled / BURST_MAX)));
        const px = [], py = [], mx0 = r.left + r.width / 2, my0 = r.top + r.height / 2;
        for (let y = 0; y < h; y += step)
          for (let x = 0; x < w; x += step)
            if (data[(y * w + x) * 4 + 3] > 128) { px.push(r.left + x); py.push(r.top + y); }
        const n = px.length, b = { n, t0: performance.now(), rgb: e.rgb,
          x: Float32Array.from(px), y: Float32Array.from(py), vx: new Float32Array(n), vy: new Float32Array(n), s: new Float32Array(n) };
        for (let i = 0; i < n; i++) {
          const dx = b.x[i] - mx0, dy = b.y[i] - my0, l = Math.hypot(dx, dy) || 1, sp = 0.6 + Math.random() * 2.4;
          b.vx[i] = dx / l * sp + (Math.random() - 0.5) * 1.2;
          b.vy[i] = dy / l * sp + (Math.random() - 0.5) * 1.2 - 0.5;   // a little lift
          b.s[i] = 1 + Math.random() * 1.2;
        }
        if (n) bursts.push(b);
      }, 110);
    }

    // A closed loop (flat x,y list) resampled to 1 px steps by arc length; appends to pts and records start and length.
    function resample(loop, pts, starts, lens, half) {
      const n = loop.length / 2, cum = [0];
      for (let j = 0; j < n; j++) {
        const a = j * 2, b = ((j + 1) % n) * 2;
        cum.push(cum[j] + Math.hypot(loop[b] - loop[a], loop[b + 1] - loop[a + 1]));
      }
      const L = cum[n], M = Math.floor(L);
      if (M < 2) return 0;
      starts.push(pts.length / 2); lens.push(M);
      for (let s = 0, j = 0; s < M; s++) {
        const u = s * L / M;
        while (cum[j + 1] <= u) j++;
        const f = (u - cum[j]) / (cum[j + 1] - cum[j]), a = j * 2, b = ((j + 1) % n) * 2;
        pts.push(loop[a] + (loop[b] - loop[a]) * f + half, loop[a + 1] + (loop[b + 1] - loop[a + 1]) * f + half);
      }
      return M;
    }

    // Unit normals of the loop that starts at point s0; flip(px, py, nx, ny) says when one points the wrong way.
    function normals(pts, s0, M, nrm, flip) {
      for (let s = 0; s < M; s++) {
        const a = (s0 + (s + M - 1) % M) * 2, b = (s0 + (s + 1) % M) * 2;
        let nx = pts[b + 1] - pts[a + 1], ny = pts[a] - pts[b];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        if (flip(pts[(s0 + s) * 2], pts[(s0 + s) * 2 + 1], nx, ny)) { nx = -nx; ny = -ny; }
        nrm.push(nx, ny);
      }
    }

    // Glyph outlines: edge pixels chained into loops, each resampled to 1 px steps by arc length.
    // A greedy walk that prefers to go straight is shorter than Moore tracing and good enough here.
    function outline(data, w, h) {
      const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 128;
      const edge = new Uint8Array(w * h);                       // 1 = edge pixel not yet used
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) edge[y * w + x] = 1;
      const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
      const TURNS = [0, 1, -1, 2, -2, 3, -3, 4];
      const pts = [], nrm = [], starts = [], lens = [];
      for (let p = 0; p < edge.length; p++) {
        if (!edge[p]) continue;
        const loop = [];
        let x = p % w, y = (p / w) | 0, d = 0, moved = true;
        while (moved) {
          edge[y * w + x] = 0;
          loop.push(x, y);
          moved = false;
          for (const tn of TURNS) {
            const q = (d + tn) & 7, nx = x + DX[q], ny = y + DY[q];
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && edge[ny * w + nx]) { x = nx; y = ny; d = q; moved = true; break; }
          }
        }
        const n = loop.length / 2;
        if (n < 24) continue;                                   // specks and scraps
        const M = resample(loop, pts, starts, lens, 0.5);
        // point out of the glyph
        if (M) normals(pts, starts[starts.length - 1], M, nrm, (px, py, nx, ny) => on(Math.floor(px + nx * 2), Math.floor(py + ny * 2)));
      }
      return pts.length ? { pts: Float32Array.from(pts), nrm: Float32Array.from(nrm), starts, lens, total: pts.length / 2 } : { pts: null };
    }

    // Generated shapes: a design is (w, h) => loops of { p: flat x,y list around the centre, closed }.
    // An open line is walked there and back, so the particles never jump from its end to its start.
    const ring = (x, y, r, n) => { const p = []; for (let i = 0; i < n; i++) p.push(x + r * Math.cos(i / n * TAU), y + r * Math.sin(i / n * TAU)); return { p, closed: true }; };
    const line = (...p) => ({ p, closed: false });
    // Egg, b = half height: x = 0.68 b sin(t) (1 - 0.12 cos(t)), y = -b cos(t). The top (t = 0) is the narrow end.
    const eggHalf = (b, y) => { const c = -y / b; return 0.68 * b * Math.sqrt(1 - c * c) * (1 - 0.12 * c); };
    const eggOutline = b => {
      const p = [];
      for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; p.push(0.68 * b * Math.sin(a) * (1 - 0.12 * Math.cos(a)), -b * Math.cos(a)); }
      return { p, closed: true };
    };
    const EGG_DECOR = [
      () => [],                                                                           // plain
      b => [-0.5, -0.15, 0.2, 0.55].map(f => { const hw = eggHalf(b, f * b) * 0.92; return line(-hw, f * b, hw, f * b); }),   // stripes
      b => {                                                                              // dots, in staggered rows
        const out = [], dx = 0.42 * b;
        for (let j = 0; j < 5; j++) {
          const y = b * (-0.6 + 0.36 * j), lim = eggHalf(b, y) * 0.72;
          for (let i = -4; i <= 4; i++) { const x = (i + 0.5 * (j % 2)) * dx; if (Math.abs(x) <= lim) out.push(ring(x, y, 0.075 * b, 16)); }
        }
        return out;
      },
      b => {                                                                              // zigzag between two bands
        const y0 = -0.2 * b, y1 = 0.2 * b, ht = eggHalf(b, y0) * 0.9, hb = eggHalf(b, y1) * 0.9, zig = [];
        for (let i = 0; i <= 8; i++) zig.push(-ht + i * ht / 4, i % 2 ? y1 : y0);
        return [line(-ht, y0, ht, y0), line(-hb, y1, hb, y1), line(...zig)];
      },
      b => [-0.4, 0.05, 0.5].map(f => {                                                   // waves
        const y0 = f * b, amp = 0.07 * b, hw = Math.min(eggHalf(b, y0 - amp), eggHalf(b, y0 + amp)) * 0.9, p = [];
        for (let i = 0; i <= 32; i++) p.push(-hw + i * hw / 16, y0 + amp * Math.sin(i / 32 * 4 * Math.PI));
        return line(...p);
      }),
    ];
    // Music icons, s = half the button's short side. Each icon sits inside a ring that is the button border.
    const rect = (x0, y0, x1, y1) => ({ p: [x0, y0, x1, y0, x1, y1, x0, y1], closed: true });
    const tri = (...p) => ({ p, closed: true });
    const ICONS = {
      play:  s => [tri(-0.28 * s, -0.4 * s, 0.42 * s, 0, -0.28 * s, 0.4 * s)],
      pause: s => [rect(-0.3 * s, -0.36 * s, -0.1 * s, 0.36 * s), rect(0.1 * s, -0.36 * s, 0.3 * s, 0.36 * s)],
      next:  s => [tri(-0.36 * s, -0.34 * s, 0.14 * s, 0, -0.36 * s, 0.34 * s), rect(0.18 * s, -0.34 * s, 0.3 * s, 0.34 * s)],
      prev:  s => [tri(0.36 * s, -0.34 * s, -0.14 * s, 0, 0.36 * s, 0.34 * s), rect(-0.3 * s, -0.34 * s, -0.18 * s, 0.34 * s)],
      stop:  s => [rect(-0.3 * s, -0.3 * s, 0.3 * s, 0.3 * s)],
    };
    const icon = name => (w, h) => { const s = Math.min(w, h) / 2; return [ring(0, 0, s, 96), ...ICONS[name](s)]; };
    const SHAPES = {
      egg: EGG_DECOR.map(d => (w, h) => [eggOutline(1.25 * h), ...d(1.25 * h)]),   // egg height 2.5 x the element
      play: [icon('play'), icon('pause')],                                          // a click toggles play and pause
      next: [icon('next')], prev: [icon('prev')], stop: [icon('stop')],
    };

    // Info icons, s = ring radius: an 'i' (dot and stem) or a danger X.
    const INFO = {
      info: s => [ring(0, -0.42 * s, 0.1 * s, 20), rect(-0.08 * s, -0.18 * s, 0.08 * s, 0.52 * s)],
      danger: s => [line(-0.42 * s, -0.42 * s, 0.42 * s, 0.42 * s), line(0.42 * s, -0.42 * s, -0.42 * s, 0.42 * s)],
    };
    function buildInfo(e) {                                 // centred above the element, 10px clear of it
      const r = baseRect(e), q = Math.max(14, Math.min(r.height * 0.55, 26));
      e.ishape = outlines([ring(0, 0, q, 96), ...INFO[e.danger ? 'danger' : 'info'](q)], r.width / 2, -q - 10);
    }

    function buildShape(e) {
      const r = baseRect(e), make = SHAPES[e.shape];
      e.pts = null;
      if (!make || !r.width || !r.height) return;
      Object.assign(e, outlines(make[e.design % make.length](r.width, r.height), r.width / 2, r.height / 2));
    }

    // Loops around (0, 0) to resampled outlines with normals, moved to (ox, oy) in element space.
    function outlines(loops, ox, oy) {
      const pts = [], nrm = [], starts = [], lens = [];
      for (const lp of loops) {
        const back = [];
        if (!lp.closed) for (let i = lp.p.length - 4; i >= 2; i -= 2) back.push(lp.p[i], lp.p[i + 1]);
        const loop = lp.p.concat(back);
        let area = 0;
        for (let i = 0; i < loop.length; i += 2) {
          const j = (i + 2) % loop.length;
          area += loop[i] * loop[j + 1] - loop[j] * loop[i + 1];
          loop[i] += ox; loop[i + 1] += oy;
        }
        const M = resample(loop, pts, starts, lens, 0);
        if (M) normals(pts, starts[starts.length - 1], M, nrm, () => area < 0);       // outward for a clockwise loop
      }
      return pts.length ? { pts: Float32Array.from(pts), nrm: Float32Array.from(nrm), starts, lens, total: pts.length / 2 } : { pts: null };
    }

    function sample(e) {
      if (e.kind === 'text') sampleText(e);
      else if (e.kind === 'shape') buildShape(e);
      if (e.info != null || e.danger) buildInfo(e);
    }

    // A point on the outlines. p0 in [0,total) picks the loop and the start; adv moves along that loop.
    function onOutline(e, p0, adv, out) {
      let c = e.starts.length - 1;
      while (e.starts[c] > p0) c--;
      const len = e.lens[c], q = (p0 - e.starts[c] + adv) % len, j = q | 0, f = q - j;
      const a = (e.starts[c] + j) * 2, b = (e.starts[c] + (j + 1) % len) * 2;
      out[0] = e.pts[a] + (e.pts[b] - e.pts[a]) * f;
      out[1] = e.pts[a + 1] + (e.pts[b + 1] - e.pts[a + 1]) * f;
      out[2] = e.nrm[a]; out[3] = e.nrm[a + 1];
    }

    function scan() {
      els.forEach(e => { e.el.style.translate = ''; e.el.style.removeProperty('--swarm'); if (e.off) e.off(); });
      els = [...document.querySelectorAll(o.selector)].map(el => {
        const cs = getComputedStyle(el);
        const m = parseFloat(el.dataset.swarmMagnet);
        return {
          el, kind: ['text', 'shape'].includes(el.dataset.swarm) ? el.dataset.swarm : 'border',
          shape: el.dataset.swarmShape, design: parseInt(el.dataset.swarmDesign) || 0, quiet: el.dataset.swarmScout === 'off', off: null,
          magnet: calm || isNaN(m) ? o.magnet : m,
          path: el.dataset.swarmPath || o.textPath,
          rgb: toRGB(cs.getPropertyValue('--swarm-color').trim() || o.color),
          info: el.dataset.swarmInfo, danger: el.hasAttribute('data-swarm-danger'), ishape: null, tip: null, focus: false, dw: 0, tipOn: false,
          k: 0, tx: 0, ty: 0, pts: null, rad: 0, r: 0, scout: false, cT: '', cS: null, cOn: false,
        };
      });
      prose.forEach(clearProse);
      prose = [...document.querySelectorAll('[data-swarm-prose]')].map(el => ({ el, k: 0, cS: null, cX: null, cY: null, raised: false }));
      setProse(o.prose);
      els.forEach(readRadius);
      els.forEach(sample);
      els.forEach(e => {                                    // a click on a shape cycles to its next design
        if (e.kind === 'border') {                          // a click on a button bursts its label
          const pop = () => { if (o.burst && !off) burst(e); };
          e.el.addEventListener('click', pop);
          e.off = () => { e.el.removeEventListener('click', pop); clearTimeout(e.bt); e.el.classList.remove('is-burst'); };
          return;
        }
        if (e.kind !== 'shape') return;
        const next = () => {
          e.design = (e.design + 1) % (SHAPES[e.shape] || [0]).length;
          e.el.dataset.swarmDesign = e.design;
          buildShape(e);
        };
        e.el.addEventListener('click', next);
        e.off = () => e.el.removeEventListener('click', next);
      });
      els.forEach(setupInfo);
    }

    // The info text is a real element: screen readers get it through aria-describedby, keyboard focus shows it.
    function setupInfo(e) {
      if (e.info == null && !e.danger) return;
      const el = e.el, had = el.getAttribute('aria-describedby');
      if (e.info) {
        const tip = e.tip = document.createElement('div');
        tip.className = 'swarm-tip' + (e.danger ? ' is-danger' : '');
        tip.id = 'swarm-tip-' + (++tipId);
        tip.setAttribute('role', 'tooltip');
        tip.textContent = e.info;
        tip.style.setProperty('--swarm-color', e.danger ? o.dangerColor : getComputedStyle(el).getPropertyValue('--swarm-color').trim() || o.color);
        document.body.appendChild(tip);
        el.setAttribute('aria-describedby', (had ? had + ' ' : '') + tip.id);
      }
      // Without the swarm (reducedMotion 'off') hover shows the text at once.
      const show = on => { if (!off || !e.tip) return; placeTip(e, el.getBoundingClientRect()); e.tip.classList.toggle('is-on', on); };
      const onFocus = () => { e.focus = el.matches(':focus-visible'); show(e.focus); };
      const onBlur = () => { e.focus = false; show(false); };
      const onEnter = () => show(true), onLeave = () => show(e.focus);
      el.addEventListener('focus', onFocus); el.addEventListener('blur', onBlur);
      el.addEventListener('pointerenter', onEnter); el.addEventListener('pointerleave', onLeave);
      const prev = e.off;
      e.off = () => {
        if (prev) prev();
        el.removeEventListener('focus', onFocus); el.removeEventListener('blur', onBlur);
        el.removeEventListener('pointerenter', onEnter); el.removeEventListener('pointerleave', onLeave);
        if (e.tip) { e.tip.remove(); if (had) el.setAttribute('aria-describedby', had); else el.removeAttribute('aria-describedby'); }
      };
    }
    function placeTip(e, b) {                               // centred below the element
      const l = Math.round(b.x + b.width / 2) + 'px', tp = Math.round(b.y + b.height + 12) + 'px';
      if (l !== e.cL) e.tip.style.left = e.cL = l;
      if (tp !== e.cTp) e.tip.style.top = e.cTp = tp;
    }

    function readRadius(e) {
      e.rad = parseFloat(getComputedStyle(e.el).borderTopLeftRadius) || 0;
      if (e.tip) e.trad = parseFloat(getComputedStyle(e.tip).borderTopLeftRadius) || 0;
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      els.forEach(readRadius);
      els.forEach(sample);
    }

    // A point on a rounded rectangle at s in [0,1), clockwise from the top-left, with its outward normal.
    function perim(x, y, w, h, r, s, out) {
      const sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2;
      let d = (((s % 1) + 1) % 1) * (2 * sw + 2 * sh + 4 * arc);
      const corner = (ccx, ccy, a0) => {
        const a = a0 + (d / arc) * (Math.PI / 2);
        out[2] = Math.cos(a); out[3] = Math.sin(a);
        out[0] = ccx + out[2] * r; out[1] = ccy + out[3] * r;
        return out;
      };
      if (d < sw) { out[0] = x + r + d; out[1] = y; out[2] = 0; out[3] = -1; return out; } d -= sw;
      if (d < arc) return corner(x + w - r, y + r, -Math.PI / 2); d -= arc;
      if (d < sh) { out[0] = x + w; out[1] = y + r + d; out[2] = 1; out[3] = 0; return out; } d -= sh;
      if (d < arc) return corner(x + w - r, y + h - r, 0); d -= arc;
      if (d < sw) { out[0] = x + w - r - d; out[1] = y + h; out[2] = 0; out[3] = 1; return out; } d -= sw;
      if (d < arc) return corner(x + r, y + h - r, Math.PI / 2); d -= arc;
      if (d < sh) { out[0] = x; out[1] = y + h - r - d; out[2] = -1; out[3] = 0; return out; } d -= sh;
      return corner(x + r, y + r, Math.PI);
    }

    function frame(now) {
      const dt = Math.min(2.5, (now - last) / 16.667);
      last = now; t += dt / 60;

      if (!has && !calm) {                                     // idle: drift in a slow loop
        mx = W * 0.5 + Math.cos(t * 0.45) * W * 0.22;
        my = H * 0.5 + Math.sin(t * 0.7) * H * 0.16;
      }
      cx += (mx - cx) * Math.min(1, 0.25 * dt);
      cy += (my - cy) * Math.min(1, 0.25 * dt);

      // Element fields: k rises from 0 at `field` px away to 1 on the element.
      let act = null, best = 0;
      for (const e of els) {
        const r = baseRect(e);
        const dx = Math.max(r.left - cx, 0, cx - (r.left + r.width));
        const dy = Math.max(r.top - cy, 0, cy - (r.top + r.height));
        e.d = Math.hypot(dx, dy);
        let g = Math.max(0, 1 - e.d / Math.max(o.field, 1));
        g = g * g * (3 - 2 * g);
        e.k += (g - e.k) * Math.min(1, 0.12 * dt);
        if (e.k < 0.002) e.k = 0;
        e.tx = (cx - (r.left + r.width / 2)) * e.magnet * e.k;
        e.ty = (cy - (r.top + r.height / 2)) * e.magnet * e.k;
        e.wT = e.k ? `${e.tx.toFixed(2)}px ${e.ty.toFixed(2)}px` : '';
        e.wS = e.k.toFixed(3);
        e.wOn = e.k > 0.5;
        const bo = e.box = { x: r.left + e.tx, y: r.top + e.ty, w: r.width, h: r.height };
        e.r = Math.min(e.rad, bo.w / 2, bo.h / 2);
        // A scout visits only a near, calm element that is on screen, so it never leaves the canvas.
        // Info: the cursor rests on the element for infoDelay seconds, or keyboard focus is on it.
        if (e.ishape) { e.dw = e.k > 0.85 && has ? e.dw + dt / 60 : 0; e.tipOn = o.info && (e.dw > o.infoDelay || e.focus); }
        if (e.tip) {                                        // the shown tip is a target: read its box (last frame's place)
          const tr = e.tipOn ? e.tip.getBoundingClientRect() : null;
          e.tb = tr && tr.width ? { x: tr.left, y: tr.top, w: tr.width, h: tr.height } : null;
          e.wTS = e.tipOn ? e.k.toFixed(3) : '0.000';
          e.wTOn = e.tipOn && e.k > 0.5;
        }
        e.scout = !e.quiet && e.d < SCOUT_RANGE && e.k < 0.3 && bo.x < W && bo.x + bo.w > 0 && bo.y < H && bo.y + bo.h > 0;
        if (e.k > best) { best = e.k; act = e; }
      }
      // Running text: on-screen boxes for 'avoid'; a spotlight position and closeness for 'highlight'.
      boxes = [];
      for (const p of prose) {
        const r = p.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) { p.wX = p.wY = '-999px'; p.wS = '0.000'; continue; }
        boxes.push(r);
        if (o.prose !== 'highlight') continue;
        const d = Math.hypot(Math.max(r.left - cx, 0, cx - r.right), Math.max(r.top - cy, 0, cy - r.bottom));
        const g = Math.max(0, 1 - d / Math.max(o.field, 1));
        p.k += (g * g * (3 - 2 * g) - p.k) * Math.min(1, 0.12 * dt);
        p.wS = p.k.toFixed(3);
        p.wX = Math.round(cx - r.left) + 'px'; p.wY = Math.round(cy - r.top) + 'px';
      }
      // Style writes come after all rect reads (one layout flush), and only when a value changed.
      if (o.prose === 'highlight') for (const p of prose) {
        if (p.wS !== p.cS) p.el.style.setProperty('--swarm', p.cS = p.wS);
        if (p.wX !== p.cX) p.el.style.setProperty('--sx', p.cX = p.wX);
        if (p.wY !== p.cY) p.el.style.setProperty('--sy', p.cY = p.wY);
      }
      for (const e of els) {
        if (e.wT !== e.cT) e.el.style.translate = e.cT = e.wT;
        if (e.wS !== e.cS) e.el.style.setProperty('--swarm', e.cS = e.wS);
        if (e.wOn !== e.cOn) e.el.classList.toggle('is-swarmed', e.cOn = e.wOn);
        if (e.tip) {
          if (e.tipOn) placeTip(e, { x: e.box.x, y: e.box.y, width: e.box.w, height: e.box.h });
          if (e.tipOn !== e.cTip) e.tip.classList.toggle('is-on', e.cTip = e.tipOn);
          if (e.wTS !== e.cTS) e.tip.style.setProperty('--swarm', e.cTS = e.wTS);
          if (e.wTOn !== e.cTOn) e.tip.classList.toggle('is-swarmed', e.cTOn = e.wTOn);
        }
      }

      // The pool holds twice the count; focus brings the second half out of the hive centre.
      live += ((N / 2) * (1 + best) - live) * Math.min(1, 0.08 * dt);
      const L = Math.min(N, Math.round(live));
      for (let i = L; i < N; i++) { X[i] = cx; Y[i] = cy; VX[i] = 0; VY[i] = 0; }
      // At rest the hive packs tighter; it loosens as an element takes focus.
      const pitch = o.spacing * (0.6 + 0.4 * best) / Math.sqrt(Math.max(L, 1));
      // Angular speed drifts through zero, so the hive turns, eases and turns back.
      spin += (1.1 * Math.sin(t * 0.37) + 0.5 * Math.sin(t * 0.91 + 1.7)) * o.orbit * dt / 60;

      if (o.dangerColor !== dangerSrc) danger = toRGB(dangerSrc = o.dangerColor);
      const tc = act ? (act.tipOn && act.danger ? danger : act.rgb) : base;
      for (let c = 0; c < 3; c++) col[c] += (base[c] + (tc[c] - base[c]) * best - col[c]) * Math.min(1, 0.1 * dt);

      // The share of the swarm on the element grows with closeness: about N*share particles leave the hive
      // (k is already eased, squared so only a close or over cursor takes many). The rest stay in the hive.
      const k = best;
      const share = Math.pow(k, o.curve);
      let bx = 0, by = 0, bw = 0, bh = 0, rad = 0, plen = 1;
      if (act) {
        ({ x: bx, y: by, w: bw, h: bh } = act.box);
        rad = act.r;
        plen = Math.max(1, 2 * (bw + bh) - 8 * rad + TAU * rad);
      }
      // The path set: the info icon while it shows, else the glyph or shape outlines, else (null) the border.
      const sh = act && act.tipOn && act.ishape.pts ? act.ishape : act && act.kind !== 'border' && act.pts ? act : null;
      const pts = sh ? sh.pts : null;
      // The shown tip: half the path particles run its border, the rest keep the icon.
      const tb = act && act.tipOn ? act.tb : null, trad = tb ? Math.min(act.trad || 0, tb.w / 2, tb.h / 2) : 0;
      const tlen = tb ? Math.max(1, 2 * (tb.w + tb.h) - 8 * trad + TAU * trad) : 1;
      const damp = Math.pow(0.8, dt);
      const every = o.scouts > 0 ? Math.max(1, Math.round(1 / o.scouts)) : 0;
      const sz = o.size, gl = o.glow, pathAdv = t * o.pathSpeed;
      const avoid = o.prose === 'avoid' && boxes.length, gap = o.proseGap;

      for (let i = 0; i < L; i++) {
        const a = i * GOLDEN + spin * (1.4 - 0.7 * Math.sqrt(i / L));   // inner rings turn faster: a fluid swirl
        const ring = pitch * Math.sqrt(i) * (1 + 0.04 * Math.sin(t * 1.3 + i * 0.01));
        let tx = cx + Math.cos(a) * ring;
        let ty = cy + Math.sin(a) * ring;
        let stiff = K[i] * o.stiffness;
        // Scouts fly out to a nearby element and back to report. Each keeps its own element for good;
        // when that one is far, off screen or busy, the scout stays home.
        const s = every && i % every === 0 && els.length ? els[(i / every) % els.length] : null;
        if (s && s.scout) {
          const out = 0.5 - 0.5 * Math.cos(((t * 0.3 + PH[i] / TAU) % 1) * TAU);
          perim(s.box.x, s.box.y, s.box.w, s.box.h, s.r, U[i], tmp);
          tx += (tmp[0] - tx) * out;
          ty += (tmp[1] - ty) * out;
        }
        if (act && Q[i] < share) {  // on the path: spring fully onto it, no blend
          let ex, ey;
          if (tb && R[i] < 0.5) {                           // travel the tip border
            perim(tb.x, tb.y, tb.w, tb.h, trad, U[i] + pathAdv / tlen, tmp);
            const off = (Q[i] - 0.5) * 3 + Math.sin(t * 3 + PH[i] * 5) * 0.6;
            ex = tmp[0] + tmp[2] * off;
            ey = tmp[1] + tmp[3] * off;
          } else if (pts) {                                        // travel a glyph contour at a constant tangent speed
            onOutline(sh, U[i] * sh.total, pathAdv, tmp);
            const [sx, sy, lift] = TEXT_PATHS[sh === act && act.kind === 'text' ? act.path : 'border'] || TEXT_PATHS.border;
            ex = bx + tmp[0] + tmp[2] * lift + sx + (R[i] - 0.5) * 1.5;
            ey = by + tmp[1] + tmp[3] * lift + sy + (Q[i] - 0.5) * 1.5;
          } else {                                          // travel the border at a constant tangent speed
            perim(bx, by, bw, bh, rad, U[i] + pathAdv / plen, tmp);
            const off = (R[i] - 0.5) * 3 + Math.sin(t * 3 + PH[i] * 5) * 0.6;   // tight, a little random
            ex = tmp[0] + tmp[2] * off;
            ey = tmp[1] + tmp[3] * off;
          }
          tx = ex;
          ty = ey;
          stiff += 0.05;
        } else if (avoid) {                                 // keep off running text: a target inside moves to the nearest edge
          for (const b of boxes) {
            const l = b.left - gap, rr = b.right + gap, tp = b.top - gap, bt = b.bottom + gap;
            if (tx > l && tx < rr && ty > tp && ty < bt) {
              const band = R[i] * 8, m = Math.min(tx - l, rr - tx, ty - tp, bt - ty);
              if (m === tx - l) tx = l - band; else if (m === rr - tx) tx = rr + band;
              else if (m === ty - tp) ty = tp - band; else ty = bt + band;
            }
            // a particle already inside is nudged out the short way
            if (X[i] > l && X[i] < rr && Y[i] > tp && Y[i] < bt) {
              const m = Math.min(X[i] - l, rr - X[i], Y[i] - tp, bt - Y[i]);
              if (m === X[i] - l) VX[i] -= 0.8 * dt; else if (m === rr - X[i]) VX[i] += 0.8 * dt;
              else if (m === Y[i] - tp) VY[i] -= 0.8 * dt; else VY[i] += 0.8 * dt;
            }
          }
        }
        VX[i] = (VX[i] + (tx - X[i]) * stiff * dt) * damp;
        VY[i] = (VY[i] + (ty - Y[i]) * stiff * dt) * damp;
        X[i] += VX[i] * dt;
        Y[i] += VY[i] * dt;
      }

      ctx.clearRect(0, 0, W, H);                              // a destination-out fade leaves 8-bit alpha residue
      ctx.globalCompositeOperation = 'lighter';
      const [r, g, b] = o.mode === 'contrast' ? [255, 255, 255] : col.map(Math.round);
      const rgb = `${r},${g},${b}`;

      // Queen: while the swarm works an element, a soft glow keeps the cursor's place.
      if (k > 0.02) {
        const qr = 22 + 3 * Math.sin(t * 2.2);
        const qg = ctx.createRadialGradient(cx, cy, 0, cx, cy, qr);
        qg.addColorStop(0, `rgba(${rgb},${0.5 * k * gl})`);
        qg.addColorStop(0.35, `rgba(${rgb},${0.18 * k * gl})`);
        qg.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = qg;
        ctx.fillRect(cx - qr, cy - qr, qr * 2, qr * 2);
      }

      // Halos: small and uneven. Two alpha buckets (two fills); some particles get no halo.
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = `rgba(${rgb},${((pass ? 0.05 : 0.025) + 0.03 * k) * gl})`;
        ctx.beginPath();
        for (let i = 0; i < L; i++) {
          const q = R[i];
          if (q < 0.45 || (q < 0.75) !== !pass) continue;
          const rr = (0.4 + S[i] * 1.1) * sz;
          ctx.moveTo(X[i] + rr, Y[i]);
          ctx.arc(X[i], Y[i], rr, 0, TAU);
        }
        ctx.fill();
      }

      // Tails: a dim copy behind each particle, along its velocity.
      const tail = 1 + (1 - o.trail) * 5;
      ctx.fillStyle = `rgba(${rgb},${(0.18 + 0.2 * k) * gl})`;
      ctx.beginPath();
      for (let i = 0; i < L; i++) {
        const z = (0.5 + S[i] * 0.5) * sz;
        ctx.rect(X[i] - VX[i] * tail - z / 2, Y[i] - VY[i] * tail - z / 2, z, z);
      }
      ctx.fill();

      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = `rgba(${rgb},${((pass ? 0.85 : 0.55) + 0.15 * k) * gl})`;
        ctx.beginPath();
        for (let i = 0; i < L; i++) {
          if ((R[i] < 0.5) === !!pass) continue;
          const z = (0.5 + S[i] * 0.5) * sz;
          ctx.rect(X[i] - z / 2, Y[i] - z / 2, z, z);
        }
        ctx.fill();
      }

      // Bursts: scatter with drag, then a growing pull to the hive centre; fade over BURST_LIFE.
      if (bursts.length) {
        bursts = bursts.filter(b => (now - b.t0) / 1000 < BURST_LIFE);
        const drag = Math.pow(0.94, dt);
        for (const b of bursts) {
          const age = (now - b.t0) / 1000, pull = Math.max(0, age - 0.3) * 0.004 * dt, fade = 1 - age / BURST_LIFE;
          const [br, bg, bb] = o.mode === 'contrast' ? [255, 255, 255] : b.rgb;
          ctx.fillStyle = `rgba(${br},${bg},${bb},${0.9 * fade * gl})`;
          ctx.beginPath();
          for (let i = 0; i < b.n; i++) {
            b.vx[i] = b.vx[i] * drag + (cx - b.x[i]) * pull;
            b.vy[i] = b.vy[i] * drag + (cy - b.y[i]) * pull;
            b.x[i] += b.vx[i] * dt; b.y[i] += b.vy[i] * dt;
            const z = b.s[i] * sz * (0.6 + 0.4 * fade);
            ctx.rect(b.x[i] - z / 2, b.y[i] - z / 2, z, z);
          }
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    const onMove = ev => { mx = ev.clientX; my = ev.clientY; has = true; };
    const onLeave = () => { has = false; };
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(resize, 120); };

    function setMode(mode) {
      o.mode = mode;
      cvs.style.mixBlendMode = mode === 'contrast' ? 'difference' : 'normal';
      ctx.clearRect(0, 0, W, H);                             // old glow pixels must not be difference-blended
    }

    alloc(off ? 0 : (calm ? Math.round(o.count * 0.3) : o.count) * 2);   // o.count stays the asked-for count; calm draws 30% of it
    resize();
    scan();
    setMode(o.mode);
    if (!off) {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      addEventListener('resize', onResize);
      if (document.fonts) document.fonts.ready.then(() => els.forEach(sample));
      raf = requestAnimationFrame(frame);
    }

    // 'behind' lifts the text above the canvas; 'highlight' marks the root so the page can style the spotlight.
    function clearProse(p) {
      ['--swarm', '--sx', '--sy'].forEach(v => p.el.style.removeProperty(v));
      p.cS = p.cX = p.cY = null; p.k = 0;
      if (p.raised) { p.el.style.position = p.el.style.zIndex = ''; p.raised = false; }
    }
    function setProse(mode) {
      o.prose = mode;
      const root = document.documentElement.classList;
      ['avoid', 'highlight', 'behind', 'over'].forEach(m => root.toggle('swarm-prose-' + m, m === mode));
      prose.forEach(p => {
        clearProse(p);
        if (mode !== 'behind') return;
        if (getComputedStyle(p.el).position === 'static') p.el.style.position = 'relative';
        p.el.style.zIndex = String(+cvs.style.zIndex + 1);
        p.raised = true;
      });
    }
    function setCount(n) { o.count = n; if (!off) alloc((calm ? Math.round(n * 0.3) : n) * 2); }
    function setPath(style) {
      o.textPath = style;
      els.forEach(e => { e.path = e.el.dataset.swarmPath || style; });
    }
    // One colour for the swarm and every element; overrides per-element --swarm-color.
    function setColor(c) {
      const rgb = toRGB(c);
      o.color = c;
      base.splice(0, 3, ...rgb);
      els.forEach(e => { e.rgb = rgb; e.el.style.setProperty('--swarm-color', c); if (e.tip && !e.danger) e.tip.style.setProperty('--swarm-color', c); });
      prose.forEach(p => p.el.style.setProperty('--swarm-color', c));
    }
    // Options that need more than a store go through their setter; the rest are read every frame.
    const SETTERS = { count: setCount, mode: setMode, textPath: setPath, color: setColor, prose: setProse };

    return {
      setMode, setCount, setPath, setColor, setProse,
      set(part) { for (const key in part) (SETTERS[key] || (v => { o[key] = v; }))(part[key]); },
      get: () => Object.assign({}, o),
      refresh: scan,
      destroy() {
        cancelAnimationFrame(raf);
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerdown', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        removeEventListener('resize', onResize);
        els.forEach(e => { e.el.style.translate = ''; e.el.style.removeProperty('--swarm'); e.el.classList.remove('is-swarmed'); if (e.off) e.off(); });
        prose.forEach(clearProse);
        ['avoid', 'highlight', 'behind', 'over'].forEach(m => document.documentElement.classList.remove('swarm-prose-' + m));
        cvs.remove();
        tipCss.remove();
      },
    };
  }

  window.createSwarm = createSwarm;
})();
