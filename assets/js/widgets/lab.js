/* widgets/lab.js — PCR, qPCR, Sanger sequencing and two-colour microarray */
(() => {
  'use strict';
  const { h, fa, esc, colorSeq } = BI;

  /* ---------- pure numeric core ---------- */
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).replace(/\d/g, (d) => SUP[d]);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function pcrCopies(n0, n) { return BigInt(n0) * (1n << BigInt(n)); }
  function groupDigits(big) { return big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function approxFa(big) {
    const v = Number(big);
    const dec = (x) => fa(x.replace('.', '٫'));
    if (v < 1000) return `${fa(String(big))} نسخه`;
    if (v >= 1e15) {
      const e = Math.floor(Math.log10(v));
      return `حدود ${dec((v / 10 ** e).toFixed(1))} × ۱۰${sup(e)} نسخه`;
    }
    const units = [[1e12, 'تریلیون'], [1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
    const [u, name] = units.find(([k]) => v >= k);
    const m = v / u;
    let s = m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return `حدود ${dec(s)} ${name} نسخه`;
  }
  function niceStep(range, target) {
    const raw = range / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function compact(v) {
    const u = [[1e18, 'E'], [1e15, 'P'], [1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([k]) => v >= k);
    return u ? `${+(v / u[0]).toPrecision(3)}${u[1]}` : String(+v.toPrecision(3));
  }
  function thermalProfile(cycles) {
    const holds = [['den', 95, 30], ['ann', 58, 30], ['ext', 72, 45]], ramp = 12;
    const pts = [], hs = [];
    let t = 0;
    for (let c = 0; c < cycles; c++) {
      holds.forEach(([ph, T, d], i) => {
        if (!(c === 0 && i === 0)) t += ramp;
        pts.push([t, T]); hs.push({ phase: ph, t0: t, t1: t + d, T, cycle: c }); t += d; pts.push([t, T]);
      });
    }
    return { pts, holds: hs, total: t };
  }

  const QC = { c0: 35, s: 1.6, fmax: 1000, base: 5 };
  function qFluor(n0, n) { return QC.base + QC.fmax / (1 + Math.exp(-(n - (QC.c0 - Math.log2(n0))) / QC.s)); }
  function qCt(n0, thr) {
    let prev = qFluor(n0, 0);
    if (prev >= thr) return null;
    for (let i = 1; i <= 2000; i++) {
      const n = i * 0.02, cur = qFluor(n0, n);
      if (cur >= thr) return n - 0.02 + 0.02 * (thr - prev) / (cur - prev);
      prev = cur;
    }
    return null;
  }

  const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const revComp = (s) => [...s].reverse().map((b) => COMP[b]).join('');
  function sangerFragments(template) {
    const ns = revComp(template);
    return { newStrand: ns, frags: [...ns].map((_, i) => ({ len: i + 1, seq: ns.slice(0, i + 1), last: ns[i] })) };
  }
  const sangerArrival = (len, n) => 1.2 + 6 * (len - 1) / Math.max(1, n - 1);

  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const logRatio = (R, G) => Math.log2((R + 1) / (G + 1));
  const corrected = (v, bg) => Math.max(0, v - bg);
  function classify(R, G) {
    if (R < 50 && G < 50) return 'off';
    const x = logRatio(R, G);
    return x > 1 ? 'up' : x < -1 ? 'down' : 'same';
  }
  function buildChip() {
    const special = { 0: ['OCT4', 880, 90], 5: ['TP53', 120, 640], 10: ['MYC', 950, 210], 15: ['GAPDH', 720, 700], 20: ['ACTB', 810, 790], 27: ['BRCA1', 230, 760], 34: ['EGFR', 760, 190], 41: ['CDK1', 640, 280] };
    const rnd = mulberry32(20240611);
    const cats = ['up', 'down', 'same', 'off', 'dim'];
    const w = [0.26, 0.22, 0.28, 0.12, 0.12];
    const spots = [];
    for (let i = 0; i < 48; i++) {
      if (special[i]) { spots.push({ name: special[i][0], R: special[i][1], G: special[i][2] }); continue; }
      const name = 'G' + String(i + 1).padStart(2, '0');
      let u = rnd(), k = 0;
      while (k < 4 && u > w[k]) { u -= w[k]; k++; }
      const c = cats[k], r = () => rnd();
      let R, G;
      if (c === 'up') { G = 60 + r() * 200; R = Math.min(1000, G * (2.6 + r() * 3.5)); }
      else if (c === 'down') { R = 60 + r() * 200; G = Math.min(1000, R * (2.6 + r() * 3.5)); }
      else if (c === 'same') { G = 350 + r() * 550; R = G * (0.78 + r() * 0.44); R = Math.min(1000, R); }
      else if (c === 'off') { R = r() * 35; G = r() * 35; }
      else { G = 70 + r() * 70; R = 70 + r() * 70; }
      spots.push({ name, R: Math.round(R), G: Math.round(G) });
    }
    return spots;
  }
  const chan = (v) => Math.round(255 * Math.pow(clamp(v / 1000, 0, 1), 0.75));

  BI.css('w-lab', `
    .lab-fig { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .lab-fig svg { display: block; width: 100%; min-width: 480px; height: auto; }
    .lab-lbl { font-size: var(--fs-0); font-weight: 600; color: var(--ink-2); }
    .lab-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: var(--fs-0); align-items: center; }
    .lab-legend i { display: inline-block; width: 22px; height: 4px; border-radius: 2px; vertical-align: middle; margin-inline-end: 6px; }
    .lab-step { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; }
    .lab-step b { font-size: var(--fs-2); }
    .lab-row { display: flex; direction: ltr; font-family: var(--mono); font-weight: 700; gap: 2px; align-items: center; white-space: nowrap; }
    .lab-row .e { width: 30px; color: var(--muted); font-size: .8rem; font-weight: 600; }
    .lab-row .b { width: 20px; text-align: center; }
    .sg-grid { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
    .sg-grid > * { min-width: 0; }
    .sg-lane { flex: 0 0 190px; }
    .sg-lane svg { min-width: 0; }
    .sg-side { flex: 1 1 280px; display: grid; gap: 10px; }
    .sg-read { font: 700 1.3rem var(--mono); direction: ltr; text-align: left; min-height: 1.8em; letter-spacing: .08em; }
    .ma-dark { background: #0a0e0d; border-color: #2a3330; }
    .ma-sw { display: inline-block; width: 18px; height: 18px; border-radius: 50%; vertical-align: middle; margin-inline-end: 6px; border: 1px solid #555; }
    .ma-spot { cursor: pointer; outline: none; }
    .ma-spot:focus-visible circle.ring { stroke: #fff; stroke-width: 2.5; }
  `);

  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 7);
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const faDec = (x, d) => fa(Number(x).toFixed(d).replace('.', '٫'));
  const fmtBig = (b) => fa(groupDigits(b)).replace(/,/g, '٬');
  function animator(fn, dur) {
    let raf = 0, run = false;
    return {
      get running() { return run; },
      start(from, done) {
        cancelAnimationFrame(raf);
        if (reduce()) { run = false; fn(1); if (done) done(); return; }
        run = true;
        const t0 = performance.now();
        const step = (now) => {
          if (!run) return;
          const p = Math.min(1, from + (now - t0) / dur);
          fn(p);
          if (p >= 1) { run = false; if (done) done(); } else raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      stop() { run = false; cancelAnimationFrame(raf); },
    };
  }
  const axisLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--ink-2);stroke-width:1.5"/>`;
  const gridLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--line);stroke-width:1"/>`;
  const tx = (x, y, t, anchor, extra) => `<text x="${x}" y="${y}" text-anchor="${anchor || 'middle'}" style="font-size:12px;direction:ltr;${extra || ''}" class="t-muted">${t}</text>`;

  /* ---------- PCR ---------- */
  function pcrChartSvg(n0, n, log) {
    const W = 560, H = 300, ml = 66, mr = 16, mt = 14, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
    const xmax = Math.max(n, 10), X = (v) => ml + pw * v / xmax;
    const cur = Number(pcrCopies(n0, n));
    let s = '', Y, yt = [];
    if (log) {
      const lo = Math.floor(Math.log10(n0)), hi = Math.max(lo + 1, Math.ceil(Math.log10(cur)));
      const step = Math.ceil((hi - lo) / 7);
      Y = (v) => mt + ph * (1 - (Math.log10(v) - lo) / (hi - lo));
      for (let k = lo; k <= hi; k += step) yt.push([10 ** k, k === 0 ? '1' : '10' + sup(k)]);
    } else {
      const st0 = niceStep(cur, 5), ymax = Math.ceil(cur / st0) * st0;
      Y = (v) => mt + ph * (1 - v / ymax);
      for (let v = 0; v <= ymax + 1e-9; v += st0) yt.push([v, v === 0 ? '0' : compact(v)]);
    }
    yt.forEach(([v, l]) => { s += gridLine(ml, Y(v).toFixed(1), W - mr, Y(v).toFixed(1)) + tx(ml - 6, (Y(v) + 4).toFixed(1), l, 'end'); });
    const xs = niceStep(xmax, 8);
    for (let v = 0; v <= xmax + 1e-9; v += xs) s += gridLine(X(v).toFixed(1), mt, X(v).toFixed(1), mt + ph) + tx(X(v).toFixed(1), mt + ph + 16, String(v));
    s += axisLine(ml, mt, ml, mt + ph) + axisLine(ml, mt + ph, W - mr, mt + ph);
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push(`${X(k).toFixed(1)},${Y(Number(pcrCopies(n0, k))).toFixed(1)}`);
    s += `<polyline points="${pts.join(' ')}" style="fill:none;stroke:var(--accent);stroke-width:3;stroke-linejoin:round"/>`;
    s += `<circle cx="${X(n).toFixed(1)}" cy="${Y(cur).toFixed(1)}" r="5.5" style="fill:var(--hl);stroke:var(--surface);stroke-width:2"/>`;
    const lx = X(n) > W - 120 ? X(n) - 8 : X(n) + 8;
    s += tx(lx.toFixed(1), (Y(cur) - 10).toFixed(1), compact(cur), X(n) > W - 120 ? 'end' : 'start', 'font-weight:700');
    s += tx(ml + pw / 2, H - 6, 'تعداد چرخه (n)', 'middle', 'direction:rtl');
    s += `<text transform="translate(14 ${mt + ph / 2}) rotate(-90)" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">تعداد نسخه${log ? ' (مقیاس لگاریتمی)' : ''}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار تعداد نسخه نسبت به چرخه"><title>تعداد نسخهٔ DNA نسبت به تعداد چرخه</title>${s}</svg>`;
  }

  const PH_NAME = { den: 'واسرشتن', ann: 'اتصال آغازگر', ext: 'بسط' };
  function thermalSvg(cur) {
    const W = 560, H = 210, ml = 50, mr = 14, mt = 28, mb = 44, pw = W - ml - mr, ph = H - mt - mb;
    const tp = thermalProfile(3), X = (t) => ml + pw * t / tp.total, Y = (T) => mt + ph * (1 - (T - 40) / 60);
    let s = '';
    [[94, 96, 'hl-soft'], [55, 68, 'info-soft'], [71, 73, 'ok-soft']].forEach(([a, b, c]) => { s += `<rect x="${ml}" y="${Y(b).toFixed(1)}" width="${pw}" height="${(Y(a) - Y(b)).toFixed(1)}" style="fill:var(--${c})"/>`; });
    for (let T = 40; T <= 100; T += 10) s += gridLine(ml, Y(T).toFixed(1), W - mr, Y(T).toFixed(1)) + tx(ml - 6, (Y(T) + 4).toFixed(1), String(T), 'end');
    for (let t = 0; t <= tp.total; t += 100) s += tx(X(t).toFixed(1), mt + ph + 16, String(t));
    s += axisLine(ml, mt, ml, mt + ph) + axisLine(ml, mt + ph, W - mr, mt + ph);
    s += `<polyline points="${tp.pts.map(([t, T]) => X(t).toFixed(1) + ',' + Y(T).toFixed(1)).join(' ')}" style="fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round"/>`;
    tp.holds.forEach((o) => {
      if (cur && o.phase === cur) s += `<line x1="${X(o.t0).toFixed(1)}" y1="${Y(o.T).toFixed(1)}" x2="${X(o.t1).toFixed(1)}" y2="${Y(o.T).toFixed(1)}" style="stroke:var(--hl);stroke-width:6;stroke-linecap:round"/>`;
      if (o.cycle === 0) {
        const lab = { den: 'واسرشتن ۹۴–۹۶°', ann: 'اتصال ≈۵۵–۶۸°', ext: 'بسط ≈۷۲°' }[o.phase];
        const yy = o.phase === 'ann' ? Y(o.T) + 18 : Y(o.T) - 8;
        s += `<text x="${((X(o.t0) + X(o.t1)) / 2).toFixed(1)}" y="${yy.toFixed(1)}" text-anchor="middle" style="font-size:11.5px;font-weight:700;direction:rtl">${lab}</text>`;
      }
    });
    for (let c = 0; c < 3; c++) s += tx(X(c * 141 + 70).toFixed(1), 14, `چرخهٔ ${c + 1}`, 'middle', 'direction:rtl');
    s += tx(ml + pw / 2, H - 6, 'زمان (ثانیه، نمونه)', 'middle', 'direction:rtl');
    s += `<text transform="translate(12 ${mt + ph / 2}) rotate(-90)" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">دما (°C)</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار دمای سه چرخهٔ PCR"><title>نمودار دما نسبت به زمان در سه چرخهٔ PCR</title>${s}</svg>`;
  }

  function cycleSvg(p) {
    const d = clamp((p - 0.08) / 0.24, 0, 1), a = clamp((p - 0.32) / 0.24, 0, 1), e = clamp((p - 0.56) / 0.34, 0, 1);
    const lerp = (x, y, k) => x + (y - x) * k;
    const topY = lerp(98, 62, d), botY = lerp(126, 178, d);
    const line = (x1, y1, x2, y2, col, w, op) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke:var(--${col});stroke-width:${w};stroke-linecap:round;opacity:${op == null ? 1 : op}"/>`;
    let s = '';
    if (d < 1) for (let x = 46; x <= 516; x += 12) s += line(x, topY, x, botY, 'muted', 1.5, (1 - d) * 0.8);
    s += line(40, topY, 520, topY, 'ink-2', 5) + line(40, botY, 520, botY, 'ink-2', 5);
    const fy = botY - 14, ry = topY + 14;
    if (a > 0) {
      s += line(130, fy - (1 - a) * 28, 170, fy - (1 - a) * 28, 'hl', 5, a);
      s += line(390, ry + (1 - a) * 28, 430, ry + (1 - a) * 28, 'info', 5, a);
    }
    if (e > 0) {
      const fx = 170 + 350 * e, rx = 390 - 350 * e;
      s += line(170, fy, fx, fy, 'accent', 5) + line(390, ry, rx, ry, 'accent', 5);
      for (let x = 176; x <= fx; x += 12) s += line(x, fy, x, botY, 'muted', 1.5, 0.7);
      for (let x = 384; x >= rx; x -= 12) s += line(x, ry, x, topY, 'muted', 1.5, 0.7);
      if (e < 1) {
        s += `<ellipse cx="${fx.toFixed(1)}" cy="${(fy - 2).toFixed(1)}" rx="13" ry="10" style="fill:var(--warn);stroke:var(--surface);stroke-width:1.5"/><ellipse cx="${rx.toFixed(1)}" cy="${(ry + 2).toFixed(1)}" rx="13" ry="10" style="fill:var(--warn);stroke:var(--surface);stroke-width:1.5"/>`;
      }
    }
    const L = (x, y, t, c) => `<text x="${x}" y="${y}" text-anchor="middle" style="font-size:12px;direction:ltr;font-weight:700" class="${c || 't-muted'}">${t}</text>`;
    s += L(24, topY + 4, '5′') + L(538, topY + 4, '3′') + L(24, botY + 4, '3′') + L(538, botY + 4, '5′');
    s += `<line x1="130" y1="20" x2="430" y2="20" style="stroke:var(--ink-2);stroke-width:1.5"/><line x1="130" y1="14" x2="130" y2="26" style="stroke:var(--ink-2);stroke-width:1.5"/><line x1="430" y1="14" x2="430" y2="26" style="stroke:var(--ink-2);stroke-width:1.5"/>`;
    s += `<text x="280" y="38" text-anchor="middle" style="font-size:12px;direction:rtl;font-weight:700">ناحیهٔ هدف (بین دو آغازگر)</text>`;
    if (a > 0.5) s += `<text x="150" y="${(fy - 14 - (1 - a) * 28).toFixed(1)}" text-anchor="middle" style="font-size:11.5px;direction:rtl" class="t-hl">آغازگر رو به جلو</text><text x="410" y="${(ry + 24 + (1 - a) * 28).toFixed(1)}" text-anchor="middle" style="font-size:11.5px;direction:rtl" class="t-muted">آغازگر معکوس</text>`;
    if (p >= 0.9) s += `<text x="280" y="${(topY - 12).toFixed(1)}" text-anchor="middle" style="font-size:12px;direction:rtl;font-weight:700">مولکول ۱</text><text x="280" y="${(botY + 26).toFixed(1)}" text-anchor="middle" style="font-size:12px;direction:rtl;font-weight:700">مولکول ۲</text>`;
    return `<svg viewBox="0 0 560 230" role="img" aria-label="طرح یک چرخهٔ PCR"><title>یک چرخهٔ PCR: واسرشتن، اتصال آغازگر، بسط</title>${s}</svg>`;
  }
  function cycleState(p) {
    if (p < 0.08) return ['شروع: DNA دورشته‌ای', '—', 'رشتهٔ هدف دورشته‌ای است و دو رشته با پیوند هیدروژنی به هم چسبیده‌اند.'];
    if (p < 0.32) return ['۱. واسرشتن (Denaturation)', '۹۴–۹۶ °C', 'گرما پیوندهای هیدروژنی را می‌شکند و دو رشته از هم جدا می‌شوند.'];
    if (p < 0.56) return ['۲. اتصال آغازگر (Annealing)', '≈ ۵۵–۶۸ °C', 'دما پایین می‌آید و دو آغازگر به انتهای ناحیهٔ هدف روی دو رشته می‌چسبند.'];
    if (p < 0.9) return ['۳. بسط (Extension)', '≈ ۷۲ °C', 'پلیمراز از آغازگر شروع می‌کند و رشتهٔ جدید را در جهت ۵′ به ۳′ می‌سازد.'];
    return ['پایان چرخه', '—', 'از یک مولکول دورشته‌ای دو مولکول دورشته‌ای ساخته شد؛ تعداد نسخه‌ها دو برابر شد.'];
  }

  BI.widget('pcr', {
    title: 'PCR: دو برابر شدن در هر چرخه',
    desc: 'تعداد چرخه‌ها و تعداد نسخهٔ اولیه را عوض کن و ببین تعداد نسخه‌ها چقدر زود زیاد می‌شود. پایین‌تر یک چرخهٔ کامل را قدم به قدم ببین.',
    mount(body, opts) {
      const id = uid('pcr');
      let cycles = clamp(parseInt(opts.cycles, 10) || 30, 0, 40);
      let n0 = Math.max(1, parseInt(opts.start, 10) || 1);
      let log = false, phase = null, p = 0;
      const slider = h('input', { type: 'range', min: '0', max: '40', step: '1', value: String(cycles), id: id + '-n' });
      const nLbl = h('span');
      const startIn = h('input', { type: 'number', class: 'mono', min: '1', max: '1000000000', step: '1', value: String(n0), id: id + '-s' });
      const err = h('p', { class: 'w-err', hidden: true });
      const bLin = h('button', { type: 'button', 'aria-pressed': 'true', text: 'خطی' });
      const bLog = h('button', { type: 'button', 'aria-pressed': 'false', text: 'لگاریتمی' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'مقیاس محور عمودی' }, bLin, bLog);
      const kv = h('div', { class: 'w-kv' });
      const chart = h('div', { class: 'lab-fig' });
      const chartNote = h('p', { class: 'w-note' });
      const thermal = h('div', { class: 'lab-fig' });
      const cyc = h('div', { class: 'lab-fig' });
      const stepBox = h('div', { class: 'lab-step', 'aria-live': 'polite' });
      const playBtn = h('button', { class: 'btn primary', type: 'button', text: 'اجرای یک چرخه' });
      const jump = [['۱. واسرشتن', 0.32, 'den'], ['۲. اتصال', 0.56, 'ann'], ['۳. بسط', 0.9, 'ext']].map(([t, v, ph]) => h('button', { class: 'btn', type: 'button', text: t, onclick: () => { anim.stop(); reset(); setP(v); } }));
      const resetBtn = h('button', { class: 'btn ghost', type: 'button', text: 'از اول', onclick: () => { anim.stop(); reset(); setP(0); } });
      body.append(
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field grow', for: id + '-n' }, nLbl, slider),
          h('label', { class: 'w-field', for: id + '-s' }, 'تعداد نسخهٔ اولیه (N₀)', startIn),
          seg),
        err, kv, chart, chartNote,
        h('div', { class: 'lab-lbl', text: 'برنامهٔ دمایی (سه چرخه)' }), thermal,
        h('div', { class: 'lab-lbl', text: 'یک چرخه از نزدیک' }), stepBox, cyc,
        h('div', { class: 'w-controls' }, playBtn, jump, resetBtn),
        h('div', { class: 'lab-legend' }, h('span', { html: '<i style="background:var(--ink-2)"></i>رشتهٔ اولیه' }), h('span', { html: '<i style="background:var(--hl)"></i>آغازگر رو به جلو' }), h('span', { html: '<i style="background:var(--info)"></i>آغازگر معکوس' }), h('span', { html: '<i style="background:var(--accent)"></i>رشتهٔ جدید' }), h('span', { html: '<i style="background:var(--warn)"></i>پلیمراز' })),
        h('p', { class: 'w-note', text: 'فرض ساده: بازده کامل (در هر چرخه دقیقاً دو برابر). در واقعیت بعد از حدود ۳۰ تا ۴۰ چرخه مواد مصرف می‌شود و رشد متوقف می‌شود. زمان‌ها و دماهای نمودار نمونه‌اند.' })
      );
      const anim = animator((v) => setP(v), 9000);
      function reset() { p = 0; }
      function setP(v) {
        p = v;
        const [name, temp, txt] = cycleState(p);
        const np = p < 0.08 ? null : p < 0.32 ? 'den' : p < 0.56 ? 'ann' : p < 0.9 ? 'ext' : null;
        cyc.innerHTML = cycleSvg(p);
        stepBox.innerHTML = `<b>${name}</b><span class="pill hl" style="direction:ltr">${temp}</span><span>${txt}</span>`;
        if (np !== phase) { phase = np; thermal.innerHTML = thermalSvg(phase); }
      }
      playBtn.addEventListener('click', () => { anim.stop(); phase = undefined; anim.start(0); });
      function run() {
        nLbl.textContent = `تعداد چرخه‌ها (n): ${fa(cycles)}`;
        const c = pcrCopies(n0, cycles);
        kv.innerHTML = [['فرمول', `${groupDigits(BigInt(n0))} × 2^${cycles}`], ['تعداد نسخه', fmtBig(c)], ['به زبان ساده', approxFa(c)]]
          .map(([k, v], i) => `<div><span class="k">${k}</span><span class="v"${i === 2 ? ' style="direction:rtl;font-family:var(--font)"' : ''}>${esc(v)}</span></div>`).join('');
        chart.innerHTML = pcrChartSvg(n0, cycles, log);
        chartNote.textContent = log ? 'در مقیاس لگاریتمی رشد دوبرابری یک خط راست می‌شود؛ هر چرخه نمودار به اندازهٔ log₁₀(۲) ≈ ۰٫۳۰ بالا می‌رود.' : 'در مقیاس خطی تا چرخه‌های آخر تقریباً چیزی دیده نمی‌شود و بعد نمودار ناگهان بالا می‌رود؛ ویژگی رشد نمایی همین است.';
      }
      slider.addEventListener('input', () => { cycles = +slider.value; run(); });
      startIn.addEventListener('input', () => {
        const v = Number(startIn.value);
        const ok = Number.isInteger(v) && v >= 1 && v <= 1e9;
        err.hidden = ok;
        if (!ok) { err.textContent = 'تعداد نسخهٔ اولیه باید عدد صحیح بین ۱ و ۱٬۰۰۰٬۰۰۰٬۰۰۰ باشد. تا وقتی اصلاح نکنی، آخرین مقدار درست استفاده می‌شود.'; return; }
        n0 = v; run();
      });
      [[bLin, false], [bLog, true]].forEach(([b, v]) => b.addEventListener('click', () => { log = v; bLin.setAttribute('aria-pressed', String(!v)); bLog.setAttribute('aria-pressed', String(v)); run(); }));
      run(); phase = undefined; setP(0);
    },
  });

  /* ---------- qPCR ---------- */
  const QCOL = ['info', 'ok', 'hl'];
  function qpcrSvg(samples, thr) {
    const W = 560, H = 320, ml = 56, mr = 16, mt = 14, mb = 46, pw = W - ml - mr, ph = H - mt - mb, ymax = 1000;
    const X = (v) => ml + pw * v / 40, Y = (v) => mt + ph * (1 - v / ymax);
    let s = '';
    for (let v = 0; v <= ymax; v += 200) s += gridLine(ml, Y(v).toFixed(1), W - mr, Y(v).toFixed(1)) + tx(ml - 6, (Y(v) + 4).toFixed(1), String(v), 'end');
    for (let v = 0; v <= 40; v += 5) s += gridLine(X(v).toFixed(1), mt, X(v).toFixed(1), mt + ph) + tx(X(v).toFixed(1), mt + ph + 16, String(v));
    s += axisLine(ml, mt, ml, mt + ph) + axisLine(ml, mt + ph, W - mr, mt + ph);
    samples.forEach((sm, i) => {
      if (!sm.ok) return;
      const pts = [];
      for (let k = 0; k <= 80; k++) pts.push(`${X(k / 2).toFixed(1)},${Y(qFluor(sm.n0, k / 2)).toFixed(1)}`);
      s += `<polyline points="${pts.join(' ')}" style="fill:none;stroke:var(--${QCOL[i]});stroke-width:2.8"/>`;
    });
    s += `<line x1="${ml}" y1="${Y(thr).toFixed(1)}" x2="${W - mr}" y2="${Y(thr).toFixed(1)}" style="stroke:var(--ink-2);stroke-width:1.8;stroke-dasharray:6 4"/>` + tx(W - mr - 2, (Y(thr) - 6).toFixed(1), `آستانه = ${thr}`, 'end', 'direction:rtl;font-weight:700');
    samples.forEach((sm, i) => {
      if (!sm.ok || sm.ct == null) return;
      s += `<line x1="${X(sm.ct).toFixed(1)}" y1="${Y(thr).toFixed(1)}" x2="${X(sm.ct).toFixed(1)}" y2="${mt + ph}" style="stroke:var(--${QCOL[i]});stroke-width:1.5;stroke-dasharray:3 3"/><circle cx="${X(sm.ct).toFixed(1)}" cy="${Y(thr).toFixed(1)}" r="5" style="fill:var(--${QCOL[i]});stroke:var(--surface);stroke-width:2"/>`;
      s += tx(X(sm.ct).toFixed(1), (mt + ph - 6 - i * 14).toFixed(1), `Ct=${sm.ct.toFixed(1)}`, 'middle', 'font-weight:700');
    });
    s += tx(ml + pw / 2, H - 6, 'چرخه', 'middle', 'direction:rtl');
    s += `<text transform="translate(12 ${mt + ph / 2}) rotate(-90)" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">شدت فلورسانس (واحد نسبی)</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="منحنی‌های تکثیر qPCR"><title>فلورسانس نسبت به چرخه برای سه نمونه با آستانه و مقدار Ct</title>${s}</svg>`;
  }

  BI.widget('qpcr', {
    title: 'qPCR: منحنی تکثیر و Ct',
    desc: 'سه نمونه با مقدار اولیهٔ DNA متفاوت داریم. آستانه را جابه‌جا کن و ببین هر منحنی در کدام چرخه (Ct) از آن رد می‌شود. نمونه‌ای که DNA بیشتری دارد زودتر رد می‌شود.',
    mount(body) {
      const id = uid('qp');
      const defaults = [10000, 1000, 100];
      const ins = defaults.map((d, i) => h('input', { type: 'number', class: 'mono', min: '1', max: '100000000', step: '1', value: String(d), id: `${id}-${i}` }));
      const thrIn = h('input', { type: 'range', min: '20', max: '900', step: '5', value: '150', id: id + '-t' });
      const thrLbl = h('span');
      const err = h('p', { class: 'w-err', hidden: true });
      const chart = h('div', { class: 'lab-fig' });
      const tbl = h('div', { class: 'w-out' });
      const note = h('p', { class: 'w-note' });
      body.append(
        h('div', { class: 'w-controls' }, ins.map((inp, i) => h('label', { class: 'w-field', for: inp.id }, `نمونهٔ ${fa(i + 1)}: نسخهٔ اولیه`, inp))),
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: id + '-t' }, thrLbl, thrIn)),
        err, chart, tbl, note,
        h('div', { class: 'w-note', html: '<b>قاعدهٔ مهم:</b> ۱۰ برابر DNA بیشتر ← Ct حدود ۳٫۳ چرخه زودتر (log₂10). این منحنی‌ها شبیه‌سازی ساده‌ای با بازدهٔ ایده‌آل هستند.' })
      );
      const last = [10000, 1000, 100];
      function run() {
        const thr = +thrIn.value;
        thrLbl.textContent = `آستانهٔ فلورسانس: ${fa(thr)}`;
        const bad = [];
        const samples = ins.map((inp, i) => {
          const v = Number(inp.value);
          const ok = Number.isInteger(v) && v >= 1 && v <= 1e8;
          if (ok) last[i] = v; else bad.push(i + 1);
          const n0 = last[i];
          return { n0, ok: true, ct: qCt(n0, thr) };
        });
        err.hidden = !bad.length;
        if (bad.length) err.textContent = `مقدار نمونهٔ ${bad.map(fa).join(' و ')} باید عدد صحیح بین ۱ و ۱۰۰٬۰۰۰٬۰۰۰ باشد؛ فعلاً مقدار قبلی استفاده می‌شود.`;
        chart.innerHTML = qpcrSvg(samples, thr);
        tbl.innerHTML = `<table class="w-table" style="direction:rtl"><thead><tr><th>نمونه</th><th>نسخهٔ اولیه</th><th>Ct</th></tr></thead><tbody>${samples.map((s, i) => `<tr><td><span style="color:var(--${QCOL[i]})">●</span> ${fa(i + 1)}</td><td>${s.n0}</td><td>${s.ct == null ? '—' : s.ct.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
        const [a, b] = samples;
        note.textContent = a.ct != null && b.ct != null
          ? `نمونهٔ ۲ نسبت به نمونهٔ ۱: ${(a.n0 / b.n0).toFixed(a.n0 / b.n0 % 1 ? 2 : 0)} برابر DNA کمتر، ΔCt = ${(b.ct - a.ct).toFixed(2)} چرخه. پیش‌بینی نظری: log₂(${(a.n0 / b.n0).toFixed(a.n0 / b.n0 % 1 ? 2 : 0)}) = ${Math.log2(a.n0 / b.n0).toFixed(2)}.`.replace(/\d+(\.\d+)?/g, (m) => fa(m.replace('.', '٫')))
          : 'برای بعضی نمونه‌ها منحنی پیش از چرخهٔ ۰ از آستانه گذشته است؛ آستانه را بالاتر ببر.';
      }
      ins.forEach((i) => i.addEventListener('input', run));
      thrIn.addEventListener('input', run);
      run();
    },
  });

  /* ---------- Sanger ---------- */
  const NTV = (b) => `var(--nt-${b.toLowerCase()})`;
  function laneSvg(frags, t) {
    const n = frags.length, y0 = 44, yD = 262;
    let s = `<text x="70" y="16" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">قطب − (شروع)</text><rect x="35" y="30" width="70" height="250" rx="10" style="fill:var(--surface-2);stroke:var(--line-strong);stroke-width:1.5"/>`;
    s += `<line x1="26" y1="${yD}" x2="114" y2="${yD}" style="stroke:var(--bad);stroke-width:2;stroke-dasharray:5 3"/><text x="153" y="${yD + 4}" text-anchor="middle" style="font-size:12px;direction:rtl;font-weight:700">آشکارساز</text>`;
    s += `<text x="70" y="298" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">قطب +</text>`;
    frags.forEach((f) => {
      const arr = sangerArrival(f.len, n), pr = clamp(t / arr, 0, 1), y = y0 + (yD - y0) * pr, passed = t > arr + 0.35;
      s += `<rect x="43" y="${(y - 3).toFixed(1)}" width="54" height="6" rx="3" style="fill:${NTV(f.last)};opacity:${passed ? 0.25 : 1}"/>`;
    });
    return `<svg viewBox="0 0 190 304" role="img" aria-label="خط الکتروفورز: قطعه‌های کوتاه‌تر زودتر به آشکارساز می‌رسند"><title>مسیر مهاجرت قطعه‌های DNA به سمت قطب مثبت</title>${s}</svg>`;
  }
  function chromSvg(frags, t) {
    const n = frags.length, W = 560, H = 150, ml = 44, mr = 14, mt = 22, mb = 40, pw = W - ml - mr, ph = H - mt - mb;
    const Tmax = sangerArrival(n, n) + 1, X = (v) => ml + pw * v / Tmax, Y = (v) => mt + ph * (1 - v), sg = 0.22;
    let s = '';
    const ts = niceStep(Tmax, 8);
    for (let v = 0; v <= Tmax + 1e-9; v += ts) s += tx(X(v).toFixed(1), mt + ph + 16, String(+v.toFixed(2)));
    s += tx(ml - 6, (Y(0) + 4).toFixed(1), '0', 'end') + tx(ml - 6, (Y(1) + 4).toFixed(1), '1', 'end');
    s += axisLine(ml, mt, ml, mt + ph) + axisLine(ml, mt + ph, W - mr, mt + ph);
    frags.forEach((f) => {
      const a = sangerArrival(f.len, n);
      if (t < a - 3 * sg) return;
      const pts = [];
      for (let x = a - 3 * sg; x <= Math.min(t, a + 3 * sg) + 1e-9; x += 0.03) pts.push(`${X(x).toFixed(1)},${Y(Math.exp(-((x - a) ** 2) / (2 * sg * sg))).toFixed(1)}`);
      if (pts.length > 1) s += `<polygon points="${X(a - 3 * sg).toFixed(1)},${Y(0)} ${pts.join(' ')} ${pts[pts.length - 1].split(',')[0]},${Y(0)}" style="fill:${NTV(f.last)};opacity:.85"/>`;
      if (t >= a) s += `<text x="${X(a).toFixed(1)}" y="${(mt - 6).toFixed(1)}" text-anchor="middle" style="font-size:13px;font-weight:800;fill:${NTV(f.last)}">${f.last}</text>`;
    });
    s += tx(ml + pw / 2, H - 4, 'زمان رسیدن به آشکارساز (ثانیه، نسبی)', 'middle', 'direction:rtl');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="کروماتوگرام: قله‌های رنگی به ترتیب رسیدن"><title>سیگنال آشکارساز نسبت به زمان</title>${s}</svg>`;
  }

  BI.widget('sanger', {
    title: 'توالی‌یابی سنگر',
    desc: 'پلیمراز روی رشتهٔ الگو رشتهٔ جدید می‌سازد و هر بار با یک نوکلئوتید رنگی ddNTP متوقف می‌شود. قطعه‌ها را در الکتروفورز جدا کن و ببین آشکارساز توالی را چطور می‌خواند.',
    mount(body, opts) {
      const id = uid('sg');
      const input = h('input', { type: 'text', class: 'mono', id, value: opts.seq || 'GCTAGCAT', spellcheck: 'false', autocomplete: 'off' });
      const err = h('p', { class: 'w-err', hidden: true });
      const strands = h('div', { class: 'w-out' });
      const lane = h('div', { class: 'lab-fig sg-lane' });
      const tblBox = h('div', { class: 'w-out', style: 'max-height:300px;overflow:auto' });
      const chrom = h('div', { class: 'lab-fig' });
      const read = h('div', { class: 'sg-read', 'aria-live': 'polite' });
      const concl = h('div', { class: 'w-out', hidden: true });
      const runBtn = h('button', { class: 'btn primary', type: 'button', text: 'اجرای الکتروفورز' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: id }, 'رشتهٔ الگو (۵′ به ۳′، فقط A، C، G، T؛ ۲ تا ۲۴ باز)', input), runBtn),
        err, strands,
        h('div', { class: 'sg-grid' }, lane, h('div', { class: 'sg-side' }, h('div', { class: 'lab-lbl', text: 'قطعه‌های ساخته‌شده (طول از کوتاه به بلند)' }), tblBox)),
        h('div', { class: 'lab-lbl', text: 'سیگنال آشکارساز' }), chrom,
        h('div', { class: 'lab-lbl', text: 'خوانش (به ترتیب رسیدن، کوتاه‌ترین اول)' }), read, concl,
        h('p', { class: 'w-note', text: 'در دستگاه واقعی هر شرکت رنگ‌های خودش را دارد؛ در اسلاید درس: A سبز، T قرمز، C سیاه/زرد، G آبی. در این ابزار از رنگ‌های بازهای همین جزوه استفاده شده است.' })
      );
      let frags = [], ns = '', tpl = '', t = 0;
      let T = 8;
      let raf = 0, running = false;
      function stop() { running = false; cancelAnimationFrame(raf); runBtn.textContent = 'اجرای الکتروفورز'; }
      function draw(tt) {
        t = tt;
        lane.innerHTML = laneSvg(frags, t);
        chrom.innerHTML = chromSvg(frags, t);
        const got = frags.filter((f) => sangerArrival(f.len, frags.length) <= t);
        read.innerHTML = got.length ? colorSeq(got.map((f) => f.last).join('')) : '<span class="w-note">هنوز چیزی نخوانده است</span>';
        const done = got.length === frags.length;
        concl.hidden = !done;
        if (done) concl.innerHTML = `<b>خوانش = <span class="ltr" dir="ltr">5′-${colorSeq(ns)}-3′</span></b> برابر رشتهٔ جدید (۵′ به ۳′) است و مکمل رشتهٔ الگو؛ پس رشتهٔ الگو همان مکمل معکوس خوانش است: <span dir="ltr">5′-${colorSeq(tpl)}-3′</span>.`;
      }
      function build() {
        const clean = input.value.toUpperCase().replace(/\s/g, '');
        const bad = [...clean].filter((c) => !'ACGT'.includes(c));
        if (bad.length || clean.length < 2 || clean.length > 24) {
          err.hidden = false;
          err.textContent = bad.length ? `حرف غیرمجاز: ${[...new Set(bad)].join('، ')}؛ فقط A، C، G و T مجاز است.` : 'طول توالی باید بین ۲ و ۲۴ باز باشد.';
          return;
        }
        err.hidden = true;
        stop();
        tpl = clean;
        const r = sangerFragments(tpl);
        ns = r.newStrand; frags = r.frags;
        T = sangerArrival(frags.length, frags.length) + 1;
        const cmp = [...tpl].map((b) => COMP[b]).join('');
        const row = (a, arr, b) => `<div class="lab-row"><span class="e">${a}</span>${[...arr].map((x) => `<span class="b n${x}">${x}</span>`).join('')}<span class="e">${b}</span></div>`;
        strands.innerHTML = `<div class="w-note">رشتهٔ الگو و رشتهٔ جدید زیر آن (جفت‌شده، پس از چپ به راست ۳′ به ۵′ نوشته شده):</div>${row('5′', tpl, '3′')}${row('3′', cmp, '5′')}<div class="w-row" style="margin-top:6px"><span>رشتهٔ جدید به صورت ۵′ به ۳′ (مکمل معکوس الگو):</span><code class="seq plain" dir="ltr">5′-${colorSeq(ns)}-3′</code></div>`;
        tblBox.innerHTML = `<table class="w-table" style="direction:ltr"><thead><tr><th>طول</th><th>قطعه (۵′ به ۳′)</th><th>ddNTP پایانی</th></tr></thead><tbody>${frags.map((f) => `<tr><td>${f.len}</td><td style="text-align:left">${[...f.seq].map((b, i) => (i === f.len - 1 ? `<b class="n${b}">${b}</b>` : `<span style="color:var(--muted)">${b}</span>`)).join('')}</td><td><b class="n${f.last}">dd${f.last}TP</b></td></tr>`).join('')}</tbody></table>`;
        draw(0);
      }
      function step(now0) {
        const t0 = now0;
        const f = (now) => {
          if (!running) return;
          const tt = Math.min(T, (now - t0) / 1000);
          draw(tt);
          if (tt >= T) stop(); else raf = requestAnimationFrame(f);
        };
        raf = requestAnimationFrame(f);
      }
      runBtn.addEventListener('click', () => {
        if (running) { stop(); return; }
        if (reduce()) { draw(T); return; }
        running = true; runBtn.textContent = 'توقف';
        draw(0);
        step(performance.now());
      });
      input.addEventListener('input', build);
      build();
    },
  });

  /* ---------- microarray ---------- */
  const MA_CAT = {
    up: ['بیان در سلول سرطانی بیشتر است (قرمز)', 'bad'],
    down: ['بیان در سلول سالم بیشتر است (سبز)', 'ok'],
    same: ['تقریباً برابر (زرد)', 'hl'],
    off: ['در هیچ‌کدام بیان نشده (سیاه)', ''],
  };

  BI.widget('microarray', {
    title: 'ریزآرایهٔ دورنگ',
    desc: 'هر نقطه یک ژن است. قرمز: سلول سرطانی (Cy5)، سبز: سلول سالم (Cy3). روی نقطه‌ها کلیک کن تا نسبت بیان را ببینی. بعد تصحیح پس‌زمینه را روشن کن.',
    mount(body) {
      const id = uid('ma');
      const chip = buildChip();
      let sel = 0, on = false, bg = 80;
      const cols = 8, cw = 76, ch = 70;
      const chk = h('input', { type: 'checkbox', id: id + '-c' });
      const rng = h('input', { type: 'range', min: '0', max: '200', step: '5', value: '80', id: id + '-r' });
      const rLbl = h('span');
      const fig = h('div', { class: 'lab-fig ma-dark' });
      const info = h('div', { class: 'w-out' });
      const counts = h('div', { class: 'w-row' });
      const note = h('p', { class: 'w-note' });
      const sw = (c, t) => `<span><span class="ma-sw" style="background:${c}"></span>${t}</span>`;
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field', for: id + '-c', style: 'display:flex;align-items:center;gap:8px;grid-auto-flow:column' }, chk, 'تصحیح پس‌زمینه'), h('label', { class: 'w-field grow', for: id + '-r' }, rLbl, rng)),
        fig, h('div', { class: 'lab-legend', html: sw('rgb(255,0,0)', 'قرمز: در سرطانی بیشتر') + sw('rgb(0,255,0)', 'سبز: در سالم بیشتر') + sw('rgb(255,255,0)', 'زرد: تقریباً برابر') + sw('rgb(0,0,0)', 'سیاه: بیان نشده') }),
        counts, info, note
      );
      const val = (s) => [corrected(s.R, on ? bg : 0), corrected(s.G, on ? bg : 0)];
      function drawChip() {
        let s = `<rect width="${cols * cw + 32}" height="${6 * ch + 28}" style="fill:#0a0e0d"/>`;
        chip.forEach((sp, i) => {
          const c = i % cols, r = Math.floor(i / cols), x = 16 + cw / 2 + c * cw, y = 14 + 30 + r * ch;
          const [R, G] = val(sp);
          const col = `rgb(${chan(R)},${chan(G)},0)`;
          s += `<g class="ma-spot" data-i="${i}" tabindex="0" role="button" aria-label="ژن ${sp.name}"><circle cx="${x}" cy="${y}" r="26" style="fill:transparent"/><circle class="ring" cx="${x}" cy="${y}" r="25" style="fill:none;stroke:${i === sel ? '#fff' : 'transparent'};stroke-width:2.5"/><circle cx="${x}" cy="${y}" r="22" style="fill:${col};opacity:.3"/><circle cx="${x}" cy="${y}" r="18" style="fill:${col};stroke:rgb(48,56,53);stroke-width:1.2"/><text x="${x}" y="${y + 38}" text-anchor="middle" style="font-size:11px;font-family:monospace;fill:rgb(150,160,155);direction:ltr">${sp.name}</text></g>`;
        });
        fig.innerHTML = `<svg viewBox="0 0 ${cols * cw + 32} ${6 * ch + 28}" role="group" aria-label="تصویر اسکن ریزآرایه، ۴۸ نقطه">${s}</svg>`;
      }
      function details() {
        const sp = chip[sel], [R, G] = val(sp), x = logRatio(R, G), cat = classify(R, G);
        const [txt, pc] = MA_CAT[cat];
        info.innerHTML = `<div class="w-kv"><div><span class="k">ژن</span><span class="v">${sp.name}</span></div><div><span class="k">R (قرمز، سرطانی)</span><span class="v">${R}${on ? ` <small style="color:var(--muted)">(خام ${sp.R})</small>` : ''}</span></div><div><span class="k">G (سبز، سالم)</span><span class="v">${G}${on ? ` <small style="color:var(--muted)">(خام ${sp.G})</small>` : ''}</span></div><div><span class="k">log₂((R+1)/(G+1))</span><span class="v">${x.toFixed(2)}</span></div></div><p style="margin:8px 0 0"><span class="pill ${pc}">${txt}</span>${cat === 'up' || cat === 'down' ? ` حدود ${faDec(2 ** Math.abs(x), 1)} برابر` : ''}</p>`;
      }
      function summary() {
        const tally = { up: 0, down: 0, same: 0, off: 0 };
        let turned = 0, changed = 0, best = null;
        chip.forEach((sp) => {
          const [R, G] = val(sp), c = classify(R, G), c0 = classify(sp.R, sp.G);
          tally[c]++;
          if (c !== c0) changed++;
          if (c === 'off' && c0 !== 'off') turned++;
          if (R > 0 && G > 0 && sp.R < 200 && sp.G < 200) { const dd = Math.abs(logRatio(R, G) - logRatio(sp.R, sp.G)); if (!best || dd > best.dd) best = { sp, dd, a: logRatio(sp.R, sp.G), b: logRatio(R, G) }; }
        });
        counts.innerHTML = `<span class="pill bad">قرمز ${fa(tally.up)}</span><span class="pill ok">سبز ${fa(tally.down)}</span><span class="pill hl">زرد ${fa(tally.same)}</span><span class="pill">سیاه ${fa(tally.off)}</span>`;
        if (!on) note.textContent = 'تصحیح پس‌زمینه خاموش است. نقطه‌های کم‌نور (مثلاً با شدت حدود ۷۰ تا ۱۴۰) هم‌اکنون زرد کم‌رنگ دیده می‌شوند. تصحیح را روشن کن تا ببینی چه می‌شود.';
        else note.textContent = `با کم کردن ${fa(bg)} از R و G (و گرفتن صفر به‌جای مقدار منفی)، ${fa(turned)} نقطهٔ کم‌نور سیاه شد و ${fa(changed)} نقطه دستهٔ خود را عوض کرد.` + (best ? ` مثلاً ${best.sp.name}: نسبت از ${faDec(best.a, 2)} به ${faDec(best.b, 2)} تغییر کرد؛ پس‌زمینه نسبت نقطه‌های کم‌نور را بزرگ‌نمایی می‌کند.` : '');
      }
      function run() {
        bg = +rng.value; on = chk.checked;
        rLbl.textContent = `مقدار پس‌زمینه: ${fa(bg)}${on ? '' : ' (غیرفعال تا تصحیح روشن نشود)'}`;
        drawChip(); details(); summary();
      }
      fig.addEventListener('click', (e) => { const g = e.target.closest('.ma-spot'); if (g) { sel = +g.dataset.i; run(); } });
      fig.addEventListener('keydown', (e) => {
        const g = e.target.closest && e.target.closest('.ma-spot');
        if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = +g.dataset.i; run(); const n = fig.querySelector(`.ma-spot[data-i="${sel}"]`); if (n) n.focus(); }
      });
      chk.addEventListener('change', run);
      rng.addEventListener('input', run);
      run();
    },
  });
})();
