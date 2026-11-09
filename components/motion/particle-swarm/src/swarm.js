/* particle-swarm: a cursor swarm that is pulled onto [data-swarm] elements.
 * No dependencies. Load with <script src="swarm.js"></script>, then call createSwarm().
 *
 * Element attributes:
 *   data-swarm="border"   particles travel along the border (rounded corners too)
 *   data-swarm="text"     particles travel along the glyph outlines of the element's text (one line)
 * The closer the cursor, the larger the share of the swarm that leaves the hive for the element.
 *   data-swarm-path="offset"  text path style: border (on the outline) | offset (pushed out 5px) | shadow (shifted down-right)
 *   data-swarm-magnet="0.2"  how far the element leans toward the cursor (0 = none)
 * Live tuning: swarm.set({ spacing, size, orbit, stiffness, scouts, field, pathSpeed, curve, glow, count, ... }).
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
      reducedMotion: 'calm', // with prefers-reduced-motion: 'calm' (30% count, no drift, no lean) | 'off'
    }, opts || {});

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const calm = reduce && o.reducedMotion === 'calm';
    const off = reduce && o.reducedMotion === 'off';
    if (calm) { o.count = Math.round(o.count * 0.3); o.magnet = 0; }
    const cvs = document.createElement('canvas');
    cvs.setAttribute('aria-hidden', 'true');
    Object.assign(cvs.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '9999',
    });
    document.body.appendChild(cvs);
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
    let els = [];
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
      const cs = getComputedStyle(e.el);
      const oc = document.createElement('canvas');
      oc.width = w; oc.height = h;
      const c = oc.getContext('2d', { willReadFrequently: true });
      c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('letterSpacing' in c) c.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#fff';
      let text = e.el.textContent.trim().replace(/\s+/g, ' ');
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
      const data = c.getImageData(0, 0, w, h).data;
      Object.assign(e, outline(data, w, h));
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
        const cum = [0];
        for (let j = 0; j < n; j++) {
          const a = j * 2, b = ((j + 1) % n) * 2;
          cum.push(cum[j] + Math.hypot(loop[b] - loop[a], loop[b + 1] - loop[a + 1]));
        }
        const L = cum[n], M = Math.floor(L);
        starts.push(pts.length / 2); lens.push(M);
        for (let s = 0, j = 0; s < M; s++) {
          const u = s * L / M;
          while (cum[j + 1] <= u) j++;
          const f = (u - cum[j]) / (cum[j + 1] - cum[j]), a = j * 2, b = ((j + 1) % n) * 2;
          pts.push(loop[a] + (loop[b] - loop[a]) * f + 0.5, loop[a + 1] + (loop[b + 1] - loop[a + 1]) * f + 0.5);
        }
        const s0 = starts[starts.length - 1];
        for (let s = 0; s < M; s++) {
          const a = (s0 + (s + M - 1) % M) * 2, b = (s0 + (s + 1) % M) * 2;
          let nx = pts[b + 1] - pts[a + 1], ny = pts[a] - pts[b];
          const l = Math.hypot(nx, ny) || 1;
          nx /= l; ny /= l;
          const px = pts[(s0 + s) * 2], py = pts[(s0 + s) * 2 + 1];
          if (on(Math.floor(px + nx * 2), Math.floor(py + ny * 2))) { nx = -nx; ny = -ny; }   // point out of the glyph
          nrm.push(nx, ny);
        }
      }
      return pts.length ? { pts: Float32Array.from(pts), nrm: Float32Array.from(nrm), starts, lens, total: pts.length / 2 } : { pts: null };
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
      els.forEach(e => { e.el.style.translate = ''; e.el.style.removeProperty('--swarm'); });
      els = [...document.querySelectorAll(o.selector)].map(el => {
        const cs = getComputedStyle(el);
        const m = parseFloat(el.dataset.swarmMagnet);
        return {
          el, kind: el.dataset.swarm === 'text' ? 'text' : 'border',
          magnet: calm || isNaN(m) ? o.magnet : m,
          path: el.dataset.swarmPath || o.textPath,
          rgb: toRGB(cs.getPropertyValue('--swarm-color').trim() || o.color),
          k: 0, tx: 0, ty: 0, pts: null, rad: 0, r: 0, scout: false, cT: '', cS: null, cOn: false,
        };
      });
      els.forEach(readRadius);
      els.forEach(e => e.kind === 'text' && sampleText(e));
    }

    function readRadius(e) { e.rad = parseFloat(getComputedStyle(e.el).borderTopLeftRadius) || 0; }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      els.forEach(readRadius);
      els.forEach(e => e.kind === 'text' && sampleText(e));
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
        e.scout = e.d < SCOUT_RANGE && e.k < 0.3 && bo.x < W && bo.x + bo.w > 0 && bo.y < H && bo.y + bo.h > 0;
        if (e.k > best) { best = e.k; act = e; }
      }
      // Style writes come after all rect reads (one layout flush), and only when a value changed.
      for (const e of els) {
        if (e.wT !== e.cT) e.el.style.translate = e.cT = e.wT;
        if (e.wS !== e.cS) e.el.style.setProperty('--swarm', e.cS = e.wS);
        if (e.wOn !== e.cOn) e.el.classList.toggle('is-swarmed', e.cOn = e.wOn);
      }

      // The pool holds twice the count; focus brings the second half out of the hive centre.
      live += ((N / 2) * (1 + best) - live) * Math.min(1, 0.08 * dt);
      const L = Math.min(N, Math.round(live));
      for (let i = L; i < N; i++) { X[i] = cx; Y[i] = cy; VX[i] = 0; VY[i] = 0; }
      // At rest the hive packs tighter; it loosens as an element takes focus.
      const pitch = o.spacing * (0.6 + 0.4 * best) / Math.sqrt(Math.max(L, 1));
      // Angular speed drifts through zero, so the hive turns, eases and turns back.
      spin += (1.1 * Math.sin(t * 0.37) + 0.5 * Math.sin(t * 0.91 + 1.7)) * o.orbit * dt / 60;

      const tc = act ? act.rgb : base;
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
      const pts = act && act.kind === 'text' ? act.pts : null;
      const damp = Math.pow(0.8, dt);
      const every = o.scouts > 0 ? Math.max(1, Math.round(1 / o.scouts)) : 0;
      const sz = o.size, gl = o.glow, pathAdv = t * o.pathSpeed;

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
          if (pts) {                                        // travel a glyph contour at a constant tangent speed
            onOutline(act, U[i] * act.total, pathAdv, tmp);
            const [sx, sy, lift] = TEXT_PATHS[act.path] || TEXT_PATHS.border;
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

    alloc(off ? 0 : o.count * 2);
    resize();
    scan();
    setMode(o.mode);
    if (!off) {
      addEventListener('pointermove', onMove, { passive: true });
      addEventListener('pointerdown', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      addEventListener('resize', onResize);
      if (document.fonts) document.fonts.ready.then(() => els.forEach(e => e.kind === 'text' && sampleText(e)));
      raf = requestAnimationFrame(frame);
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
      els.forEach(e => { e.rgb = rgb; e.el.style.setProperty('--swarm-color', c); });
    }
    // Options that need more than a store go through their setter; the rest are read every frame.
    const SETTERS = { count: setCount, mode: setMode, textPath: setPath, color: setColor };

    return {
      setMode, setCount, setPath, setColor,
      set(part) { for (const key in part) (SETTERS[key] || (v => { o[key] = v; }))(part[key]); },
      get: () => Object.assign({}, o),
      refresh: scan,
      destroy() {
        cancelAnimationFrame(raf);
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerdown', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        removeEventListener('resize', onResize);
        els.forEach(e => { e.el.style.translate = ''; e.el.style.removeProperty('--swarm'); e.el.classList.remove('is-swarmed'); });
        cvs.remove();
      },
    };
  }

  window.createSwarm = createSwarm;
})();
