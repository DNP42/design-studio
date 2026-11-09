/* particle-swarm: a cursor swarm that is pulled onto [data-swarm] elements.
 * No dependencies. Load with <script src="swarm.js"></script>, then call createSwarm().
 *
 * Element attributes:
 *   data-swarm="border"   particles flow along the border; the border bulges toward the cursor
 *   data-swarm="text"     particles fill the glyphs of the element's text (one line)
 *   data-swarm-magnet="0.2"  how far the element leans toward the cursor (0 = none)
 * CSS on the element:
 *   --swarm-color         swarm tint while it holds this element
 *   --swarm               written by the script, 0..1, use it in your own CSS
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // golden angle: an even, comb-like disc
  const HIVE_RADIUS = 70;
  const SCOUT_EVERY = 12;                         // one particle in 12 is a scout
  const SCOUT_RANGE = 600;

  function createSwarm(opts) {
    const o = Object.assign({
      count: 700,
      color: '#7cf7ff',
      mode: 'glow',        // 'glow' (additive light) | 'contrast' (difference blend, inverts what is under it)
      field: 90,           // px around an element where the pull starts
      magnet: 0.15,        // default lean toward the cursor
      trail: 0.3,          // tail length: lower = longer tails
      selector: '[data-swarm]',
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
    let N, X, Y, VX, VY, PH, K, S, U, R;
    let els = [];
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    let has = false, t = 0, last = performance.now(), raf = 0;
    const base = toRGB(o.color);
    const col = base.slice();
    const tmp = new Float32Array(4);

    function alloc(n) {
      N = n;
      X = new Float32Array(n); Y = new Float32Array(n);
      VX = new Float32Array(n); VY = new Float32Array(n);
      PH = new Float32Array(n);
      K = new Float32Array(n); S = new Float32Array(n); U = new Float32Array(n);
      R = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        X[i] = cx + (Math.random() - 0.5) * 200;
        Y[i] = cy + (Math.random() - 0.5) * 200;
        PH[i] = Math.random() * TAU;
        K[i] = 0.02 + Math.random() * 0.015;                 // spring stiffness: low = lags behind
        S[i] = 0.6 + Math.random() * 1.3;
        U[i] = Math.random();                                 // slot on a border
        R[i] = Math.random();                                 // look: halo size and brightness
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
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      let text = e.el.textContent.trim().replace(/\s+/g, ' ');
      if (cs.textTransform === 'uppercase') text = text.toUpperCase();
      const pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
      let x = pl;
      if (cs.textAlign === 'center') { c.textAlign = 'center'; x = pl + (w - pl - pr) / 2; }
      else if (cs.textAlign === 'right' || cs.textAlign === 'end') { c.textAlign = 'right'; x = w - pr; }
      else c.textAlign = 'left';
      c.fillText(text, x, h / 2);
      const data = c.getImageData(0, 0, w, h).data;
      let filled = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 128) filled++;
      const step = Math.max(2, Math.round(Math.sqrt(filled / N)));
      const pts = [];
      for (let y = 0; y < h; y += step)
        for (let xx = 0; xx < w; xx += step)
          if (data[(y * w + xx) * 4 + 3] > 128) pts.push(xx, y);
      for (let i = pts.length / 2 - 1; i > 0; i--) {          // shuffle so particles cross the swarm
        const j = (Math.random() * (i + 1)) | 0;
        [pts[2 * i], pts[2 * j]] = [pts[2 * j], pts[2 * i]];
        [pts[2 * i + 1], pts[2 * j + 1]] = [pts[2 * j + 1], pts[2 * i + 1]];
      }
      if (pts.length) e.pts = Float32Array.from(pts);
    }

    function scan() {
      els.forEach(e => { e.el.style.translate = ''; e.el.style.removeProperty('--swarm'); });
      els = [...document.querySelectorAll(o.selector)].map(el => {
        const cs = getComputedStyle(el);
        const m = parseFloat(el.dataset.swarmMagnet);
        return {
          el, kind: el.dataset.swarm === 'text' ? 'text' : 'border',
          magnet: calm || isNaN(m) ? o.magnet : m,
          rgb: toRGB(cs.getPropertyValue('--swarm-color').trim() || o.color),
          k: 0, tx: 0, ty: 0, pts: null,
        };
      });
      els.forEach(e => e.kind === 'text' && sampleText(e));
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        let g = Math.max(0, 1 - e.d / o.field);
        g = g * g * (3 - 2 * g);
        e.k += (g - e.k) * Math.min(1, 0.12 * dt);
        if (e.k < 0.002) e.k = 0;
        e.tx = (cx - (r.left + r.width / 2)) * e.magnet * e.k;
        e.ty = (cy - (r.top + r.height / 2)) * e.magnet * e.k;
        e.el.style.translate = e.k ? `${e.tx.toFixed(2)}px ${e.ty.toFixed(2)}px` : '';
        e.el.style.setProperty('--swarm', e.k.toFixed(3));
        e.el.classList.toggle('is-swarmed', e.k > 0.5);
        e.box = { x: r.left + e.tx, y: r.top + e.ty, w: r.width, h: r.height };
        if (e.k > best) { best = e.k; act = e; }
      }

      const scouts = els.filter(e => e.d < SCOUT_RANGE && e.k < 0.3).map(e => e.box);
      const spacing = HIVE_RADIUS / Math.sqrt(Math.max(N, 1));

      const tc = act ? act.rgb : base;
      for (let c = 0; c < 3; c++) col[c] += (base[c] + (tc[c] - base[c]) * best - col[c]) * Math.min(1, 0.1 * dt);

      // Attach a share of the swarm to the active element; the rest stays on the cursor.
      const k = best;
      const m = act ? Math.floor(N * (act.kind === 'text' ? 1 : 0.8)) : 0;
      let bx = 0, by = 0, bw = 0, bh = 0, rad = 0;
      if (act) {
        ({ x: bx, y: by, w: bw, h: bh } = act.box);
        rad = Math.min(parseFloat(getComputedStyle(act.el).borderTopLeftRadius) || 0, bw / 2, bh / 2);
      }
      const pts = act && act.kind === 'text' ? act.pts : null;
      const damp = Math.pow(0.8, dt);

      for (let i = 0; i < N; i++) {
        const a = i * GOLDEN + t * 0.25;
        const ring = spacing * Math.sqrt(i) * (1 + 0.04 * Math.sin(t * 1.3 + i * 0.01));
        let tx = cx + Math.cos(a) * ring;
        let ty = cy + Math.sin(a) * ring;
        let stiff = K[i];
        if (i % SCOUT_EVERY === 0 && scouts.length) {      // scouts fly out to nearby elements and back to report
          const s = scouts[(i / SCOUT_EVERY) % scouts.length];
          const out = 0.5 - 0.5 * Math.cos(((t * 0.3 + PH[i] / TAU) % 1) * TAU);
          perim(s.x, s.y, s.w, s.h, 0, U[i], tmp);
          tx += (tmp[0] - tx) * out;
          ty += (tmp[1] - ty) * out;
        }
        if (i < m && k > 0) {
          let ex, ey;
          if (pts) {
            const j = (i % (pts.length >> 1)) << 1;
            ex = bx + pts[j] + Math.sin(t * 2.3 + PH[i] * 7) * 1.2;
            ey = by + pts[j + 1] + Math.cos(t * 1.9 + PH[i] * 5) * 1.2;
          } else {
            perim(bx, by, bw, bh, rad, U[i] + t * 0.05, tmp);
            const ddx = tmp[0] - cx, ddy = tmp[1] - cy;
            const near = Math.exp(-(ddx * ddx + ddy * ddy) / 9800);    // the border bulges toward the cursor
            const off = 2 + 3 * Math.sin(t * 3 + PH[i] * 5) + near * (10 + 14 * Math.sin(t * 6 + PH[i]) ** 2);
            ex = tmp[0] + tmp[2] * off;
            ey = tmp[1] + tmp[3] * off;
          }
          tx += (ex - tx) * k;
          ty += (ey - ty) * k;
          stiff += 0.05 * k;
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

      // Halos: small and uneven. Two alpha buckets (two fills); some particles get no halo.
      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = `rgba(${rgb},${(pass ? 0.05 : 0.025) + 0.03 * k})`;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const q = R[i];
          if (q < 0.45 || (q < 0.75) !== !pass) continue;
          const rr = 0.4 + S[i] * 1.1;
          ctx.moveTo(X[i] + rr, Y[i]);
          ctx.arc(X[i], Y[i], rr, 0, TAU);
        }
        ctx.fill();
      }

      // Tails: a dim copy behind each particle, along its velocity.
      const tail = 1 + (1 - o.trail) * 5;
      ctx.fillStyle = `rgba(${rgb},${0.18 + 0.2 * k})`;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const z = 0.5 + S[i] * 0.5;
        ctx.rect(X[i] - VX[i] * tail - z / 2, Y[i] - VY[i] * tail - z / 2, z, z);
      }
      ctx.fill();

      for (let pass = 0; pass < 2; pass++) {
        ctx.fillStyle = `rgba(${rgb},${(pass ? 0.85 : 0.55) + 0.15 * k})`;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          if ((R[i] < 0.5) === !!pass) continue;
          const z = 0.5 + S[i] * 0.5;
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

    alloc(off ? 0 : o.count);
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

    return {
      setMode,
      setCount(n) { alloc(calm ? Math.round(n * 0.3) : n); els.forEach(e => e.kind === 'text' && sampleText(e)); },
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
