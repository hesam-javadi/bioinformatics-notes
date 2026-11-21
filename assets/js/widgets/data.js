/* widgets/data.js — normalization, Phred quality, FASTQ parsing, coverage and cells-as-vectors */
(() => {
  'use strict';
  const { h, fa, esc } = BI;

  /* ---------------- pure calculations ---------------- */
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const r2 = (x) => {
    if (!isFinite(x)) return '—';
    const a = Math.abs(x);
    const d = a > 0 && a < 0.1 ? 3 : 2;
    return String(Math.round(x * 10 ** d) / 10 ** d);
  };
  const grp = (x) => (isFinite(x) ? Number(x).toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—');
  const faNum = (s) => fa(s).replace(/\./g, '٫');

  function median(a) {
    const s = a.slice().sort((x, y) => x - y);
    const n = s.length;
    if (!n) return NaN;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function colStats(col) {
    return { min: Math.min(...col), max: Math.max(...col), mean: col.reduce((a, b) => a + b, 0) / col.length, median: median(col) };
  }
  function scaleCol(method, col) {
    const s = colStats(col);
    if (method === 'minmax') return col.map((x) => (s.max === s.min ? NaN : (x - s.min) / (s.max - s.min)));
    if (method === 'mean') return col.map((x) => (s.mean === 0 ? NaN : x / s.mean));
    return col.map((x) => (s.median === 0 ? NaN : x / s.median));
  }
  function quantileNorm(cols) {
    const n = cols[0].length;
    const sorted = cols.map((col) => col.map((v, g) => ({ v, g })).sort((a, b) => a.v - b.v || a.g - b.g));
    const rankMeans = [];
    for (let r = 0; r < n; r++) rankMeans.push(sorted.reduce((a, c) => a + c[r].v, 0) / cols.length);
    const out = sorted.map((c) => {
      const res = new Array(n);
      let i = 0;
      while (i < n) {
        let j = i;
        while (j + 1 < n && c[j + 1].v === c[i].v) j++;
        let sum = 0;
        for (let k = i; k <= j; k++) sum += rankMeans[k];
        const val = sum / (j - i + 1);
        for (let k = i; k <= j; k++) res[c[k].g] = val;
        i = j + 1;
      }
      return res;
    });
    return { sorted, rankMeans, out };
  }
  function normalizeCols(method, cols) {
    return method === 'quantile' ? quantileNorm(cols).out : cols.map((c) => scaleCol(method, c));
  }

  const charToQ = (c) => c.charCodeAt(0) - 33;
  const qToChar = (q) => String.fromCharCode(q + 33);
  const qToP = (q) => 10 ** (-q / 10);
  const pToQ = (p) => Math.round(-10 * Math.log10(p)) || 0;
  const accuracyPct = (p) => 100 * (1 - p);
  const fmtP = (p) => (p >= 1e-4 ? String(+p.toPrecision(3)) : p.toExponential(2));
  const fmtAcc = (p) => String(+accuracyPct(p).toFixed(6));
  const decodeQual = (s) => [...s].map(charToQ);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const expectedErrors = (qs) => qs.reduce((a, q) => a + qToP(q), 0);
  const validQualChars = (s) => [...s].every((c) => { const k = c.charCodeAt(0); return k >= 33 && k <= 126; });

  function trailingKeep(qs, thr) {
    let n = qs.length;
    while (n > 0 && qs[n - 1] < thr) n--;
    return n;
  }
  function parseFastq(text) {
    const lines = String(text).split(/\r?\n/);
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const records = [];
    const general = [];
    const full = Math.floor(lines.length / 4);
    for (let i = 0; i < full; i++) {
      const L = lines.slice(i * 4, i * 4 + 4).map((x) => x.trim());
      const n = i * 4 + 1;
      const errors = [];
      if (!L[0].startsWith('@')) errors.push(`خط ${fa(n)}: شناسه باید با @ شروع شود.`);
      const seq = L[1].toUpperCase();
      const badBases = [...new Set([...seq].filter((b) => !'ACGTN'.includes(b)))];
      if (!seq) errors.push(`خط ${fa(n + 1)}: توالی خالی است.`);
      else if (badBases.length) errors.push(`خط ${fa(n + 1)}: توالی فقط باید A، C، G، T یا N داشته باشد؛ نویسهٔ نامجاز: ${badBases.join('، ')}`);
      if (!L[2].startsWith('+')) errors.push(`خط ${fa(n + 2)}: جداکننده باید با + شروع شود.`);
      const qualOk = validQualChars(L[3]);
      if (!qualOk) errors.push(`خط ${fa(n + 3)}: کیفیت فقط می‌تواند نویسه‌های چاپی ASCII (از ! تا ~) داشته باشد.`);
      if (L[3].length !== L[1].length) errors.push(`خط ${fa(n + 3)}: طول کیفیت (${fa(L[3].length)}) با طول توالی (${fa(L[1].length)}) برابر نیست؛ خط ۴ باید به اندازهٔ خط ۲ نویسه داشته باشد.`);
      records.push({ lines: L, seq, quals: qualOk ? decodeQual(L[3]) : [], errors, ok: !errors.length, startLine: n });
    }
    if (lines.length % 4) general.push(`تعداد خط‌ها ${fa(lines.length)} است و مضرب ۴ نیست؛ ${fa(lines.length % 4)} خط آخر ناقص است و نادیده گرفته شد.`);
    return { records, general };
  }

  function parseNum(s) {
    let t = BI.en(String(s)).replace(/[٬,\s_]/g, '').replace(/٫/g, '.').replace(/[×x*]\s*10\^?/i, 'e');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }
  const covC = (L, N, G) => (L * N) / G;
  const readsFor = (C, G, L) => (C * G) / L;
  const humanBases = (b) => (b >= 1e9 ? `${+(b / 1e9).toPrecision(4)} Gb` : b >= 1e6 ? `${+(b / 1e6).toPrecision(4)} Mb` : b >= 1e3 ? `${+(b / 1e3).toPrecision(4)} kb` : `${b} b`);

  function simulate(G, L, N, rnd) {
    const starts = [];
    for (let i = 0; i < N; i++) starts.push(Math.floor(rnd() * (G - L + 1)));
    const depth = new Array(G).fill(0);
    starts.forEach((s) => { for (let p = s; p < s + L; p++) depth[p]++; });
    return { starts, depth };
  }
  function packRows(starts, L) {
    const rows = [];
    starts.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s || a.i - b.i).forEach((r) => {
      const row = rows.find((x) => x.end <= r.s);
      if (row) { row.items.push(r.s); row.end = r.s + L; } else rows.push({ items: [r.s], end: r.s + L });
    });
    return rows.map((r) => r.items);
  }
  function depthStats(depth, L, N) {
    const G = depth.length;
    return { mean: depth.reduce((a, b) => a + b, 0) / G, breadth: (100 * depth.filter((d) => d >= 1).length) / G, min: Math.min(...depth), max: Math.max(...depth), formula: (L * N) / G };
  }

  const euclid = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
  const cosDist = (a, b) => {
    const dot = a.reduce((s, x, i) => s + x * b[i], 0);
    const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
    return na === 0 || nb === 0 ? NaN : 1 - dot / (na * nb);
  };
  function niceTicks(min, max, target = 5) {
    if (!(max > min)) max = min + 1;
    const raw = (max - min) / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step + 1e-9) * step;
    const hi = Math.ceil(max / step - 1e-9) * step;
    const ticks = [];
    for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(10)));
    return { ticks, lo: ticks[0], hi: ticks[ticks.length - 1] };
  }
  const constantRows = (rows) => rows.map((r, i) => ({ r, i })).filter((x) => x.r.every((v) => v === x.r[0])).map((x) => x.i);

  /* ---------------- shared UI ---------------- */
  BI.css('w-data', `
    .wd-scroll { overflow-x: auto; max-width: 100%; }
    .wd-scroll svg { display: block; }
    .wd-grid input { width: 5.6em; padding: 4px 6px; }
    .wd-grid input.nm { width: 7em; font-family: var(--font); direction: rtl; text-align: center; }
    .wd-grid th.rowh { text-align: start; }
    .wd-step { display: grid; gap: 6px; }
    .wd-step h4 { margin: 0; font-size: var(--fs-0); color: var(--accent); }
    .wd-formula { font-family: var(--mono); direction: ltr; unicode-bidi: isolate; text-align: left; font-size: .9rem; overflow-wrap: anywhere; }
    .wd-big { font: 800 2rem var(--mono); direction: ltr; unicode-bidi: isolate; display: inline-block; color: var(--accent); }
    .wd-rec { border: 1px solid var(--line); border-radius: 10px; background: var(--bg); padding: 10px 12px; display: grid; gap: 8px; min-width: 0; }
    .wd-rec.bad { border-color: var(--bad); }
    .wd-line { display: grid; grid-template-columns: 6.5em 1fr; gap: 4px 10px; align-items: baseline; }
    .wd-line .lab { font-weight: 700; font-size: .8rem; color: var(--accent); }
    .wd-line code { direction: ltr; unicode-bidi: isolate; text-align: left; overflow-wrap: anywhere; display: block; }
    .wd-line .why { grid-column: 2; font-size: .8rem; color: var(--muted); margin-top: -4px; }
    .wd-strike { text-decoration: line-through; opacity: .45; color: var(--bad); }
    .wd-keep { color: var(--ok); }
    .wd-mono { font-family: var(--mono); direction: ltr; unicode-bidi: isolate; display: inline-block; }
    @media (max-width: 480px) { .wd-line { grid-template-columns: 1fr; } .wd-line .why { grid-column: 1; } }
  `);

  const scrollBox = (html) => `<div class="wd-scroll">${html}</div>`;
  const L = (s) => `<span class="wd-mono">${esc(s)}</span>`;

  function qChart(qs, bases, chars, keep, thr) {
    const n = qs.length;
    const qmax = Math.max(40, Math.ceil(Math.max(...qs) / 10) * 10);
    const top = 18, ph = 150, left = 44;
    const W = left + n * 26 + 10;
    const H = top + ph + 52;
    const y = (q) => top + ph - (q / qmax) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="min-width:${W}px" role="img" aria-label="نمودار کیفیت هر باز"><title>کیفیت (Q) هر باز</title>`;
    for (let t = 0; t <= qmax; t += 10) {
      s += `<line x1="${left}" x2="${W - 6}" y1="${y(t)}" y2="${y(t)}" class="s-line" stroke-width="1" ${t === 0 ? '' : 'stroke-dasharray="3 3"'}/><text x="${left - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" class="mono t-muted">${t}</text>`;
    }
    qs.forEach((q, i) => {
      const x = left + i * 26 + 3;
      const cls = q < 20 ? 'f-bad' : q < 30 ? 'f-warn' : 'f-ok';
      const faded = keep != null && i >= keep ? ' style="opacity:.3"' : '';
      const b = bases[i] || '';
      s += `<g${faded}><rect x="${x}" y="${y(q)}" width="20" height="${(q / qmax) * ph}" class="${cls}"/><text x="${x + 10}" y="${y(q) - 4}" text-anchor="middle" font-size="11" class="mono t-ink-2">${q}</text>`;
      s += `<text x="${x + 10}" y="${top + ph + 18}" text-anchor="middle" font-size="13" font-weight="700" class="mono ${'ACGT'.includes(b) && b ? 'f-' + b.toLowerCase() : 'f-muted'}">${esc(b)}</text>`;
      s += `<text x="${x + 10}" y="${top + ph + 36}" text-anchor="middle" font-size="12" class="mono t-muted">${esc(chars[i])}</text></g>`;
    });
    if (thr != null) s += `<line x1="${left}" x2="${W - 6}" y1="${y(thr)}" y2="${y(thr)}" class="s-hl" stroke-width="2" stroke-dasharray="6 4"/>`;
    s += `<text x="4" y="${top + ph + 18}" font-size="11" class="t-muted" style="direction:rtl">باز</text><text x="4" y="${top + ph + 36}" font-size="11" class="t-muted" style="direction:rtl">نماد</text></svg>`;
    return s;
  }
  const qLegend = '<p class="w-note" style="margin:0">رنگ ستون‌ها: <span class="pill bad">Q &lt; 20</span> <span class="pill hl">۲۰ تا ۲۹</span> <span class="pill ok">Q ≥ 30</span></p>';

  function numTable(head, rows, cls) {
    return `<table class="w-table ${cls || ''}"><thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => (typeof c === 'object' && c !== null ? `<td class="${c.cls || ''}">${c.t}</td>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table>`;
  }

  /* ---------------- normalize ---------------- */
  const PRESETS = {
    slide42: { label: 'اسلاید ۴۲ — بیمار و سالم', genes: ['A', 'B', 'C', 'D'], samples: ['Healthy', 'Cancer'], cols: [[100, 200, 300, 400], [50, 100, 150, 200]], method: 'minmax', next: (n) => String.fromCharCode(65 + n) },
    outlier: { label: 'دادهٔ پرت (۴۰۰۰)', genes: ['A', 'B', 'C', 'D'], samples: ['Healthy', 'Cancer'], cols: [[100, 200, 300, 4000], [50, 100, 150, 200]], method: 'average', next: (n) => String.fromCharCode(65 + n) },
    cells: { label: 'اسلاید ۴۱ — دو سلول', genes: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'], samples: ['Cell A', 'Cell B'], cols: [[200, 100, 15, 7, 5, 2, 1], [1000, 100, 16, 8, 4, 3, 1]], method: 'minmax', next: (n) => 'g' + (n + 1) },
    count: { label: 'اسلاید ۴۰ — شمارش', genes: ['Gene1', 'Gene2', 'Gene3', 'Gene4'], samples: ['Sample 1', 'Sample 2', 'Sample 3', 'Sample 4'], cols: [[1, 4, 16, 3], [3, 5, 2, 15], [7, 10, 8, 2], [11, 3, 15, 13]], method: 'minmax', next: (n) => 'Gene' + (n + 1) },
    quantile3: { label: 'اسلاید ۴۶ — چندک', genes: ['G1', 'G2', 'G3', 'G4', 'G5'], samples: ['Sample 1', 'Sample 2', 'Sample 3'], cols: [[1, 3, 7, 12, 15], [11, 13, 8, 2, 14], [3, 16, 12, 5, 6]], method: 'quantile', next: (n) => 'G' + (n + 1) },
  };
  const METHODS = [['minmax', 'Min-Max'], ['average', 'Average'], ['median', 'Median'], ['quantile', 'Quantile']];
  const METHOD_KEY = { minmax: 'minmax', average: 'mean', median: 'median' };

  BI.widget('normalize', {
    title: 'نرمال‌سازی گام‌به‌گام',
    desc: 'عددهای جدول را عوض کن، ژن اضافه یا حذف کن و روش را انتخاب کن. برای هر نمونه مقدارهای کمینه، بیشینه، میانگین و میانه و فرمول با عددهای واقعی نشان داده می‌شود. پیش‌تنظیم «دادهٔ پرت» را امتحان کن و میانگین را با میانه مقایسه کن.',
    mount(body, opts) {
      const id = uid('nm');
      let key = PRESETS[opts.preset] ? opts.preset : 'slide42';
      let method = PRESETS[key].method;
      let genes = [], samples = [], vals = [];
      const loadPreset = (k) => {
        const p = PRESETS[k];
        key = k; method = p.method;
        genes = p.genes.slice(); samples = p.samples.slice();
        vals = p.genes.map((_, g) => p.cols.map((c) => String(c[g])));
      };
      loadPreset(key);

      const sel = h('select', { id: id + '-p' }, ...Object.entries(PRESETS).map(([k, p]) => h('option', { value: k, text: p.label })));
      sel.value = key;
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'روش نرمال‌سازی' });
      const segBtns = METHODS.map(([m, t]) => { const b = h('button', { type: 'button', text: t, onclick: () => { method = m; paintSeg(); render(); } }); seg.append(b); return b; });
      const paintSeg = () => segBtns.forEach((b, i) => b.setAttribute('aria-pressed', METHODS[i][0] === method));
      const addBtn = h('button', { class: 'btn', type: 'button', text: '+ افزودن ژن', onclick: () => { if (genes.length >= 12) return; genes.push(PRESETS[key].next(genes.length)); vals.push(samples.map(() => '1')); buildGrid(); render(); } });
      const delBtn = h('button', { class: 'btn', type: 'button', text: '− حذف آخرین ژن', onclick: () => { if (genes.length <= 2) return; genes.pop(); vals.pop(); buildGrid(); render(); } });
      const grid = h('div', { class: 'wd-scroll' });
      const err = h('p', { class: 'w-err', hidden: true });
      const out = h('div', { class: 'wd-step' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field', for: id + '-p' }, 'پیش‌تنظیم', sel), h('div', { class: 'w-field' }, h('span', { text: 'روش' }), seg)),
        h('div', { class: 'w-row' }, addBtn, delBtn), grid, err, out
      );
      sel.addEventListener('change', () => { loadPreset(sel.value); buildGrid(); paintSeg(); render(); });

      function buildGrid() {
        const t = h('table', { class: 'w-table wd-grid' });
        const head = h('tr', null, h('th', { text: 'ژن' }), ...samples.map((s) => h('th', { text: s })));
        t.append(h('thead', null, head));
        const tb = h('tbody');
        genes.forEach((g, gi) => {
          const tr = h('tr', null, h('th', { class: 'rowh', text: g }));
          samples.forEach((s, si) => {
            const iid = `${id}-c${gi}-${si}`;
            const inp = h('input', { type: 'number', class: 'mono', id: iid, value: vals[gi][si], step: 'any' });
            inp.addEventListener('input', () => { vals[gi][si] = inp.value; render(); });
            tr.append(h('td', null, h('label', { class: 'sr-only', for: iid, text: `مقدار ${g} در ${s}` }), inp));
          });
          tb.append(tr);
        });
        t.append(tb);
        grid.replaceChildren(t);
      }

      function render() {
        const cols = samples.map((_, si) => vals.map((r) => (r[si].trim() === '' ? NaN : Number(r[si]))));
        if (cols.some((c) => c.some((v) => !isFinite(v)))) {
          err.hidden = false;
          err.textContent = 'همهٔ خانه‌ها باید عدد باشند. یک خانهٔ خالی یا نامعتبر پیدا شد.';
          out.innerHTML = '';
          return;
        }
        err.hidden = true;
        const st = cols.map(colStats);
        let html = '<div class="w-out"><b>آمار هر نمونه</b>' + scrollBox(numTable(['نمونه', 'min', 'max', 'mean', 'median'], samples.map((s, i) => [esc(s), r2(st[i].min), r2(st[i].max), r2(st[i].mean), r2(st[i].median)]))) + '</div>';
        const M = method;
        const formula = { minmax: 'x′ = (x − min) / (max − min)', average: 'x′ = x / mean', median: 'x′ = x / median', quantile: 'هر مقدار با میانگین هم‌رتبه‌هایش در همهٔ نمونه‌ها جایگزین می‌شود' }[M];
        html += `<div class="w-out"><b>فرمول ${esc(METHODS.find((m) => m[0] === M)[1])}</b><p class="wd-formula" style="margin:6px 0">${esc(formula)}</p>`;
        if (M !== 'quantile') {
          html += '<ul style="margin:0;padding-inline-start:1.2em">' + samples.map((s, i) => {
            const t = st[i];
            const f = M === 'minmax' ? `x′ = (x − ${r2(t.min)}) / (${r2(t.max)} − ${r2(t.min)})` : M === 'average' ? `x′ = x / ${r2(t.mean)}` : `x′ = x / ${r2(t.median)}`;
            return `<li>${esc(s)}: <span class="wd-formula">${esc(f)}</span></li>`;
          }).join('') + '</ul>';
        }
        html += '</div>';
        if (M === 'quantile') {
          const q = quantileNorm(cols);
          const n = genes.length;
          const s1 = [];
          for (let r = 0; r < n; r++) s1.push([fa(r + 1), ...q.sorted.map((c) => `${r2(c[r].v)} <small style="color:var(--muted)">(${esc(genes[c[r].g])})</small>`)]);
          html += `<div class="w-out"><b>گام ۱ — هر ستون را از کوچک به بزرگ مرتب کن (برچسب ژن کنار هر مقدار می‌ماند)</b>${scrollBox(numTable(['رتبه', ...samples.map(esc)], s1))}</div>`;
          const s2 = q.rankMeans.map((m, r) => [fa(r + 1), `(${q.sorted.map((c) => r2(c[r].v)).join(' + ')}) / ${cols.length}`, `<b>${r2(m)}</b>`]);
          html += `<div class="w-out"><b>گام ۲ — میانگین هر رتبه در همهٔ نمونه‌ها</b>${scrollBox(numTable(['رتبه', 'محاسبه', 'میانگین رتبه'], s2))}</div>`;
          const s3 = genes.map((g, gi) => [esc(g), ...cols.map((c, si) => `${r2(c[gi])} → <b>${r2(q.out[si][gi])}</b>`)]);
          html += `<div class="w-out"><b>گام ۳ — هر مقدار اصلی با میانگین رتبهٔ خودش جایگزین می‌شود</b>${scrollBox(numTable(['ژن', ...samples.map(esc)], s3))}<p class="w-note" style="margin:6px 0 0">اگر در یک ستون چند مقدار برابر باشند (گره)، به همهٔ آن‌ها میانگینِ میانگین‌های رتبه‌هایی که پوشش می‌دهند داده می‌شود. بعد از این کار توزیع همهٔ نمونه‌ها دقیقاً یکی است.</p></div>`;
        } else {
          const res = normalizeCols(METHOD_KEY[M], cols);
          const bad = res.some((c) => c.some((v) => !isFinite(v)));
          const rows = genes.map((g, gi) => {
            const row = res.map((c) => c[gi]);
            const fin = row.filter(isFinite);
            const hi = Math.max(...fin), lo = Math.min(...fin);
            const diff = fin.length > 1 && (hi - lo) / Math.max(Math.abs(hi), Math.abs(lo), 1e-12) > 0.5;
            return [esc(g), ...row.map((v) => ({ t: r2(v), cls: diff ? 'path' : '' }))];
          });
          html += `<div class="w-out"><b>جدول نرمال‌شده (۲ رقم اعشار)</b>${scrollBox(numTable(['ژن', ...samples.map(esc)], rows))}<p class="w-note" style="margin:6px 0 0">ردیف نارنجی: بعد از نرمال‌سازی هم نمونه‌ها بیش از ۵۰٪ با هم فرق دارند؛ یعنی تفاوت واقعی است یا روش مناسب این داده نبوده.</p>${bad ? '<p class="w-err" style="margin:6px 0 0">در یک نمونه مخرج فرمول صفر است (همهٔ مقدارها برابرند یا میانگین/میانه صفر است)، پس نتیجه تعریف نشده است (—).</p>' : ''}</div>`;
        }
        if (key === 'outlier') {
          html += '<aside class="callout pitfall"><p><b>چرا میانگین فرو می‌ریزد؟</b> یک مقدار پرت (۴۰۰۰) میانگین Healthy را به ۱۱۵۰ می‌رساند، پس بقیهٔ ژن‌ها بعد از تقسیم بر میانگین به عددهای کوچک (۰٫۰۸۷، ۰٫۱۷۴، ۰٫۲۶۱) تبدیل می‌شوند و در مقایسه با Cancer (۰٫۴، ۰٫۸، ۱٫۲) اشتباهاً کم‌بیان به نظر می‌رسند. میانه (۲۵۰) تقریباً به مقدار پرت حساس نیست: سه ژن اول دقیقاً ۰٫۴، ۰٫۸ و ۱٫۲ می‌شوند و فقط ژن D، که واقعاً جداست، بزرگ می‌ماند (۱۶). این توضیح برای مقدارهای پیش‌فرض این پیش‌تنظیم است.</p></aside>';
        }
        out.innerHTML = html;
      }
      buildGrid(); paintSeg(); render();
    },
  });

  /* ---------------- phred ---------------- */
  BI.widget('phred', {
    title: 'کیفیت Phred',
    desc: 'نماد کیفیت، عدد Q و احتمال خطا سه شکل از یک چیزند. در هر کدام از سه کادر اول بنویس تا بقیه حساب شوند. پایین‌تر یک رشتهٔ کیفیت را رمزگشایی کن.',
    mount(body, opts) {
      const id = uid('ph');
      const inC = h('input', { type: 'text', class: 'mono', id: id + '-c', value: '5', maxlength: '1', autocomplete: 'off', style: 'width:5em' });
      const inQ = h('input', { type: 'number', class: 'mono', id: id + '-q', value: '20', min: '0', max: '93', step: '1', style: 'width:6em' });
      const inP = h('input', { type: 'text', class: 'mono', id: id + '-p', value: '0.01', autocomplete: 'off', style: 'width:9em' });
      const cErr = h('p', { class: 'w-err', hidden: true });
      const cOut = h('div', { class: 'w-out' });
      const showQ = (q, p, src) => {
        cErr.hidden = true;
        if (src !== 'c') inC.value = qToChar(q);
        if (src !== 'q') inQ.value = q;
        if (src !== 'p') inP.value = fmtP(p);
        cOut.innerHTML = `<div class="w-kv"><div><span class="k">نماد</span><span class="v">${esc(qToChar(q))}</span></div><div><span class="k">Q</span><span class="v">${q}</span></div><div><span class="k">p</span><span class="v">${fmtP(p)}</span></div><div><span class="k">دقت</span><span class="v">${fmtAcc(p)}%</span></div></div>
          <p class="wd-formula" style="margin:8px 0 0">char = chr(Q + 33) = chr(${q} + 33) = chr(${q + 33}) = '${esc(qToChar(q))}'<br>Q = ord('${esc(qToChar(q))}') − 33 = ${q + 33} − 33 = ${q}<br>p = 10^(−Q/10) = 10^(−${q}/10) = ${fmtP(qToP(q))}<br>Q = −10·log10(p) = ${q}<br>accuracy = (1 − p) × 100 = ${fmtAcc(p)}%</p>`;
      };
      const fail = (m) => { cErr.hidden = false; cErr.textContent = m; };
      inC.addEventListener('input', () => {
        const v = inC.value;
        if (v.length !== 1 || v.charCodeAt(0) < 33 || v.charCodeAt(0) > 126) return fail('نماد باید دقیقاً یک نویسهٔ چاپی ASCII بین ! و ~ باشد (نویسهٔ فاصله مجاز نیست).');
        const q = charToQ(v); showQ(q, qToP(q), 'c');
      });
      inQ.addEventListener('input', () => {
        const q = Number(inQ.value);
        if (inQ.value.trim() === '' || !Number.isInteger(q) || q < 0 || q > 93) return fail('Q باید عدد صحیح بین ۰ و ۹۳ باشد (نمادهای ! تا ~).');
        showQ(q, qToP(q), 'q');
      });
      inP.addEventListener('input', () => {
        const p = parseNum(inP.value);
        if (!(p > 0 && p <= 1)) return fail('احتمال خطا باید عددی بزرگ‌تر از ۰ و حداکثر ۱ باشد (مثلاً 0.01 یا 1e-3).');
        const q = pToQ(p);
        if (q > 93) return fail('این احتمال از Q = ۹۳ (بیشترین مقدار قابل نمایش) هم کوچک‌تر است.');
        showQ(q, p, 'p');
      });
      const ref = [[10, '+'], [20, '5'], [30, '?'], [40, 'I'], [2, '#'], [0, '!']].map(([q, c]) => {
        const p = qToP(q);
        return [`<b>${esc(c)}</b>`, q, fmtP(p), q === 0 ? 'همهٔ بازها خطا' : `۱ از ${fa(+(1 / p).toPrecision(2))}`, fmtAcc(p) + '%'];
      });
      const qIn = h('input', { type: 'text', class: 'mono', id: id + '-qs', value: opts.qual || 'II5?+#II5?', autocomplete: 'off', spellcheck: 'false' });
      const sIn = h('input', { type: 'text', class: 'mono', id: id + '-sq', value: 'GATTACAGGT', autocomplete: 'off', spellcheck: 'false' });
      const dErr = h('p', { class: 'w-err', hidden: true });
      const dOut = h('div', { class: 'wd-step' });
      body.append(
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field', for: id + '-c' }, 'نماد (کاراکتر)', inC),
          h('label', { class: 'w-field', for: id + '-q' }, 'Q', inQ),
          h('label', { class: 'w-field', for: id + '-p' }, 'احتمال خطا p', inP)),
        cErr, cOut,
        h('div', { class: 'w-out', html: '<b>جدول مرجع</b>' + scrollBox(numTable(['نماد', 'Q', 'p', 'خطا', 'دقت'], ref)) }),
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field grow', for: id + '-sq' }, 'توالی (خط ۲ فایل FASTQ)', sIn),
          h('label', { class: 'w-field grow', for: id + '-qs' }, 'رشتهٔ کیفیت (خط ۴)', qIn)),
        dErr, dOut
      );
      showQ(20, qToP(20), '');
      const decode = () => {
        const qs = qIn.value.trim(), sq = sIn.value.trim().toUpperCase();
        dErr.hidden = true; dOut.innerHTML = '';
        if (!qs || !sq) { dErr.hidden = false; dErr.textContent = 'هم توالی و هم رشتهٔ کیفیت را وارد کن.'; return; }
        const badB = [...new Set([...sq].filter((b) => !'ACGTN'.includes(b)))];
        if (badB.length) { dErr.hidden = false; dErr.textContent = `توالی فقط باید A، C، G، T یا N داشته باشد؛ نویسهٔ نامجاز: ${badB.join('، ')}`; return; }
        if (!validQualChars(qs)) { dErr.hidden = false; dErr.textContent = 'رشتهٔ کیفیت فقط می‌تواند نویسه‌های چاپی ASCII (از ! تا ~) داشته باشد.'; return; }
        if (qs.length !== sq.length) { dErr.hidden = false; dErr.textContent = `طول رشتهٔ کیفیت (${fa(qs.length)}) با طول توالی (${fa(sq.length)}) برابر نیست. در FASTQ خط ۴ باید دقیقاً به اندازهٔ خط ۲ نویسه داشته باشد، چون برای هر باز یک نماد کیفیت لازم است.`; return; }
        const q = decodeQual(qs);
        dOut.innerHTML = `<div class="w-out">${scrollBox(qChart(q, [...sq], [...qs], null, null))}${qLegend}</div>
          <div class="w-kv"><div><span class="k">میانگین Q</span><span class="v">${r2(mean(q))}</span></div><div><span class="k">کمینهٔ Q</span><span class="v">${Math.min(...q)}</span></div><div><span class="k">خطای مورد انتظار Σp</span><span class="v">${r2(expectedErrors(q))}</span></div></div>
          <p class="wd-formula">Q = [${q.join(', ')}]<br>mean = ${q.reduce((a, b) => a + b, 0)} / ${q.length} = ${r2(mean(q))}<br>Σp = ${q.map((x) => fmtP(qToP(x))).join(' + ')} = ${r2(expectedErrors(q))}</p>
          <p class="w-note" style="margin:0">یعنی در این خوانش انتظار داریم حدود ${faNum(r2(expectedErrors(q)))} باز اشتباه خوانده شده باشد.</p>`;
      };
      qIn.addEventListener('input', decode);
      sIn.addEventListener('input', decode);
      decode();
    },
  });

  /* ---------------- fastq-parse ---------------- */
  const FASTQ_DEFAULT = "@SRR001666.1 read_1\nGATTTGGGGTTCAAAGCAGT\n+\n!''*((((***+))%%%++)\n@SRR001666.2 read_2\nGGCATTACGGATCCATGCAA\n+\nIIIIHHIIIIGIIIIIHIII";

  BI.widget('fastq-parse', {
    title: 'خواندن فایل FASTQ',
    desc: 'هر خوانش در FASTQ چهار خط است. متن را ویرایش کن تا اعتبارسنجی و نمودار کیفیت به‌روز شوند. با لغزنده آستانهٔ TRAILING را تغییر بده و ببین چه بخشی از انتهای ۳′ بریده می‌شود.',
    mount(body) {
      const id = uid('fq');
      const ta = h('textarea', { class: 'mono', id: id + '-t', rows: '9', spellcheck: 'false' });
      ta.value = FASTQ_DEFAULT;
      const slider = h('input', { type: 'range', id: id + '-s', min: '0', max: '40', step: '1', value: '10' });
      const sVal = h('b', { class: 'wd-mono' });
      const reset = h('button', { class: 'btn ghost', type: 'button', text: 'بازگرداندن مثال', onclick: () => { ta.value = FASTQ_DEFAULT; render(); } });
      const gen = h('div', { class: 'wd-step' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: id + '-t' }, 'متن FASTQ (هر ۴ خط یک خوانش)', ta)),
        h('div', { class: 'w-row' }, reset),
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: id + '-s' }, h('span', null, 'آستانهٔ TRAILING: ', sVal), slider)),
        gen
      );
      slider.addEventListener('input', render);
      ta.addEventListener('input', render);
      const lab = ['شناسه', 'توالی', 'جداکننده', 'کیفیت'];
      const why = [
        'با @ شروع می‌شود؛ نام خوانش و اطلاعات دستگاه.',
        'بازهای خوانده‌شده (A، C، G، T یا N برای بازِ نامشخص).',
        'همیشه با + شروع می‌شود؛ بعدش می‌تواند دوباره شناسه بیاید.',
        'برای هر باز یک نماد: Q = ord(نماد) − 33. طولش باید با خط ۲ برابر باشد.',
      ];
      function render() {
        const thr = Number(slider.value);
        sVal.textContent = String(thr);
        const { records, general } = parseFastq(ta.value);
        if (!records.length) { gen.innerHTML = '<p class="w-err">هیچ خوانش کاملی پیدا نشد. هر خوانش دقیقاً ۴ خط می‌خواهد.</p>' + general.map((g) => `<p class="w-err">${g}</p>`).join(''); return; }
        let html = general.map((g) => `<p class="w-err">${g}</p>`).join('');
        records.forEach((r, ri) => {
          let s = `<div class="wd-rec${r.ok ? '' : ' bad'}"><b>خوانش ${fa(ri + 1)}</b>`;
          r.lines.forEach((ln, i) => {
            s += `<div class="wd-line"><span class="lab">${fa(r.startLine + i)}. ${lab[i]}</span><code>${i === 1 ? BI.colorSeq(ln) : esc(ln)}</code><span class="why">${why[i]}</span></div>`;
          });
          if (r.errors.length) s += r.errors.map((e) => `<p class="w-err" style="margin:0">${e}</p>`).join('');
          if (r.ok) {
            const keep = trailingKeep(r.quals, thr);
            s += `<div class="wd-scroll">${qChart(r.quals, [...r.seq], [...r.lines[3]], keep, thr)}</div>${qLegend}`;
            s += `<div class="w-kv"><div><span class="k">طول</span><span class="v">${r.seq.length}</span></div><div><span class="k">میانگین Q</span><span class="v">${r2(mean(r.quals))}</span></div><div><span class="k">طول بعد از TRAILING:${thr}</span><span class="v">${keep}</span></div><div><span class="k">میانگین Q بخش باقی‌مانده</span><span class="v">${keep ? r2(mean(r.quals.slice(0, keep))) : '—'}</span></div></div>`;
            s += `<div class="w-seq"><span class="wd-keep">${esc(r.seq.slice(0, keep)) || '∅'}</span><span class="wd-strike">${esc(r.seq.slice(keep))}</span></div>`;
            s += `<p class="w-note" style="margin:0">${keep === r.seq.length ? 'هیچ بازی حذف نشد: آخرین باز هم Q ≥ ' + thr + ' دارد.' : keep === 0 ? 'همهٔ بازها حذف شدند: هیچ بازی با Q ≥ ' + thr + ' وجود ندارد و کل خوانش دور ریخته می‌شود.' : `${fa(r.seq.length - keep)} باز از انتهای ۳′ حذف شد؛ اولین بازی که از ۳′ شمردیم و Q ≥ ${fa(thr)} داشت (Q = ${r.quals[keep - 1]}) متوقف‌کننده بود.`} (TRAILING مثل Trimmomatic فقط از انتها می‌برد و وقتی به بازی با کیفیت کافی برسد می‌ایستد، حتی اگر جلوتر بازهای بد باشد.)</p>`;
          }
          html += s + '</div>';
        });
        gen.innerHTML = html;
      }
      render();
    },
  });

  /* ---------------- coverage ---------------- */
  BI.widget('coverage', {
    title: 'پوشش ژنوم',
    desc: 'پوشش میانگین C = L × N / G است. مجهول را انتخاب کن و بقیه را بنویس (مثلاً 3e9 برای ژنوم انسان). پایین‌تر خوانش‌ها را تصادفی روی یک ژنوم کوچک بریز و ببین عمق واقعی هر موقعیت با میانگین فرق می‌کند.',
    mount(body, opts) {
      const id = uid('cv');
      let mode = 'C';
      const mk = (k, v, lbl) => h('input', { type: 'text', class: 'mono', id: `${id}-${k}`, value: v, autocomplete: 'off', style: 'width:9em' });
      const inL = mk('L', opts.l || '8'), inN = mk('N', opts.n || '5'), inG = mk('G', opts.g || '20'), inC = mk('C', '');
      const fld = (k, t, inp) => h('label', { class: 'w-field', for: `${id}-${k}` }, t, inp);
      const segC = h('button', { type: 'button', text: 'حل برای C', onclick: () => setMode('C') });
      const segN = h('button', { type: 'button', text: 'حل برای N', onclick: () => setMode('N') });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'مجهول' }, segC, segN);
      const err = h('p', { class: 'w-err', hidden: true });
      const out = h('div', { class: 'w-out' });
      const presets = h('div', { class: 'w-row' });
      [['اسلاید ۹۳', 'C', '8', '5', '20', ''], ['اسلاید ۹۴', 'C', '8', '5', '10', ''], ['ژنوم انسان ۳۰X', 'N', '150', '', '3e9', '30']].forEach(([t, m, l, n, g, c]) => {
        presets.append(h('button', { class: 'btn ghost', type: 'button', text: t, onclick: () => { inL.value = l; inG.value = g; if (m === 'C') inN.value = n; else inC.value = c; setMode(m); } }));
      });
      body.append(
        h('div', { class: 'w-controls' }, h('div', { class: 'w-field' }, h('span', { text: 'مجهول' }), seg), fld('L', 'L: طول خوانش (باز)', inL), fld('N', 'N: تعداد خوانش‌ها', inN), fld('G', 'G: طول ژنوم (باز)', inG), fld('C', 'C: پوشش (X)', inC)),
        presets, err, out
      );
      function setMode(m) {
        mode = m;
        segC.setAttribute('aria-pressed', m === 'C'); segN.setAttribute('aria-pressed', m === 'N');
        inN.readOnly = m === 'N'; inC.readOnly = m === 'C';
        if (m === 'C' && !inN.value.trim()) inN.value = '5';
        if (m === 'N' && !inC.value.trim()) inC.value = '30';
        calc();
      }
      function calc() {
        const Lr = parseNum(inL.value), G = parseNum(inG.value);
        err.hidden = true;
        const fail = (m) => { err.hidden = false; err.textContent = m; out.innerHTML = ''; };
        if (!(Lr > 0) || !(G > 0)) return fail('L و G باید عدد مثبت باشند (مثلاً 150 یا 3e9).');
        if (Lr > G) return fail('طول خوانش نمی‌تواند از طول ژنوم بیشتر باشد.');
        if (mode === 'C') {
          const N = parseNum(inN.value);
          if (!(N > 0)) return fail('N باید عدد مثبت باشد.');
          const C = covC(Lr, N, G);
          inC.value = grp(C);
          out.innerHTML = `<div><span class="wd-big">${faNum(grp(C))}X</span></div>
            <p class="wd-formula">C = L × N / G<br>C = ${grp(Lr)} × ${grp(N)} / ${grp(G)} = ${grp(Lr * N)} / ${grp(G)} = ${grp(C)}</p>
            <p class="w-note" style="margin:0">کل بازهای خوانده‌شده L × N = ${esc(humanBases(Lr * N))}. به‌طور میانگین هر باز ژنوم ${faNum(grp(C))} بار خوانده می‌شود.</p>`;
        } else {
          const C = parseNum(inC.value);
          if (!(C > 0)) return fail('C باید عدد مثبت باشد.');
          const N = readsFor(C, G, Lr);
          const Nc = Math.ceil(N - 1e-9);
          inN.value = grp(Nc);
          out.innerHTML = `<div><span class="wd-big">N = ${grp(Nc)}</span> <span class="w-note">خوانش</span></div>
            <p class="wd-formula">N = C × G / L<br>N = ${grp(C)} × ${grp(G)} / ${grp(Lr)} = ${grp(C * G)} / ${grp(Lr)} = ${grp(N)}${Nc !== N ? ` → ${grp(Nc)} (گرد به بالا)` : ''}</p>
            <p class="w-note" style="margin:0">کل بازهای خوانده‌شده N × L = ${esc(humanBases(Nc * Lr))} (برابر C × G = ${esc(humanBases(C * G))}).</p>`;
        }
      }
      [inL, inN, inG, inC].forEach((i) => i.addEventListener('input', calc));
      setMode('C');

      /* simulation */
      const sG = h('input', { type: 'number', class: 'mono', id: id + '-sg', value: '60', min: '5', max: '200', step: '1', style: 'width:6em' });
      const sL = h('input', { type: 'number', class: 'mono', id: id + '-sl', value: '10', min: '1', max: '200', step: '1', style: 'width:6em' });
      const sN = h('input', { type: 'number', class: 'mono', id: id + '-sn', value: '12', min: '1', max: '300', step: '1', style: 'width:6em' });
      const sPos = h('input', { type: 'number', class: 'mono', id: id + '-sp', value: '0', min: '0', step: '1', style: 'width:6em' });
      const sErr = h('p', { class: 'w-err', hidden: true });
      const sOut = h('div', { class: 'wd-step' });
      let sim = null, sel = 0;
      const rollBtn = h('button', { class: 'btn primary', type: 'button', text: 'چیدن تصادفی خوانش‌ها', onclick: roll });
      body.append(
        h('div', { class: 'w-note', html: '<b>شبیه‌سازی</b>: خوانش‌ها از جاهای تصادفی ژنوم شروع می‌شوند.' }),
        h('div', { class: 'w-controls' }, fld('sg', 'طول ژنوم G', sG), fld('sl', 'طول خوانش L', sL), fld('sn', 'تعداد خوانش N', sN), rollBtn),
        sErr, sOut
      );
      function roll() {
        const G = Number(sG.value), Lr = Number(sL.value), N = Number(sN.value);
        sErr.hidden = true;
        if (![G, Lr, N].every(Number.isInteger) || G < 5 || G > 200 || Lr < 1 || N < 1 || N > 300) { sErr.hidden = false; sErr.textContent = 'G باید عدد صحیح ۵ تا ۲۰۰ باشد، L و N عددهای صحیح مثبت (N حداکثر ۳۰۰).'; return; }
        if (Lr > G) { sErr.hidden = false; sErr.textContent = 'طول خوانش نباید از طول ژنوم بیشتر باشد.'; return; }
        sim = { G, L: Lr, N, ...simulate(G, Lr, N, Math.random) };
        sim.rows = packRows(sim.starts, Lr);
        sel = Math.min(sel, G - 1);
        sPos.max = G - 1;
        draw();
      }
      sPos.addEventListener('input', () => { const p = Number(sPos.value); if (sim && Number.isInteger(p) && p >= 0 && p < sim.G) { sel = p; draw(); } });
      function draw() {
        const { G, L: Lr, N, depth, rows } = sim;
        const st = depthStats(depth, Lr, N);
        const u = Math.max(3, Math.min(14, Math.floor(640 / G)));
        const left = 40, W = left + G * u + 12;
        const rh = 14, readsH = rows.length * rh + 6, rulerY = readsH + 4, chartTop = rulerY + 34;
        const nt = niceTicks(0, Math.max(st.max, 1), 5);
        const ch = 110, H = chartTop + ch + 12;
        const yy = (d) => chartTop + ch - (d / nt.hi) * ch;
        let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="min-width:${W}px" role="img" aria-label="خوانش‌ها و عمق هر موقعیت"><title>خوانش‌های چیده‌شده روی ژنوم و عمق هر موقعیت</title>`;
        s += `<rect x="${left + sel * u}" y="0" width="${u}" height="${H - 12}" class="f-hl" style="opacity:.28"/>`;
        rows.forEach((row, r) => row.forEach((start) => { s += `<rect x="${left + start * u}" y="${r * rh + 2}" width="${Lr * u}" height="${rh - 4}" rx="2" class="f-info" style="opacity:.85"/>`; }));
        s += `<line x1="${left}" x2="${left + G * u}" y1="${rulerY}" y2="${rulerY}" class="s-ink-2" stroke-width="1.5"/>`;
        const step = G <= 40 ? 5 : G <= 100 ? 10 : 20;
        const marks = [];
        for (let p = 0; p <= G; p += step) marks.push(p);
        if (marks[marks.length - 1] !== G) marks.push(G);
        marks.forEach((p) => { s += `<line x1="${left + p * u}" x2="${left + p * u}" y1="${rulerY}" y2="${rulerY + 5}" class="s-ink-2"/><text x="${left + p * u}" y="${rulerY + 18}" text-anchor="middle" font-size="11" class="mono t-muted">${p}</text>`; });
        nt.ticks.forEach((t) => { s += `<line x1="${left}" x2="${left + G * u}" y1="${yy(t)}" y2="${yy(t)}" class="s-line" stroke-width="1" ${t === 0 ? '' : 'stroke-dasharray="3 3"'}/><text x="${left - 6}" y="${yy(t) + 4}" text-anchor="end" font-size="11" class="mono t-muted">${t}</text>`; });
        depth.forEach((d, p) => { s += `<rect x="${left + p * u + (u > 4 ? 0.5 : 0)}" y="${yy(d)}" width="${u > 4 ? u - 1 : u}" height="${(d / nt.hi) * ch}" class="${d === 0 ? 'f-bad' : 'f-accent'}"/>`; });
        s += `<line x1="${left}" x2="${left + G * u}" y1="${yy(st.mean)}" y2="${yy(st.mean)}" class="s-hl" stroke-width="2" stroke-dasharray="6 4"/>`;
        for (let p = 0; p < G; p++) s += `<rect x="${left + p * u}" y="0" width="${u}" height="${H - 12}" data-p="${p}" style="fill:transparent;cursor:pointer"/>`;
        s += '</svg>';
        const theory = 1 - Math.exp(-st.formula);
        sOut.innerHTML = `<div class="w-out">${scrollBox(s)}<p class="w-note" style="margin:6px 0 0">بالا: خوانش‌ها (هر ردیف چند خوانش بدون هم‌پوشانی). وسط: خط‌کش ژنوم. پایین: عمق هر موقعیت؛ خط‌چین نارنجی میانگین عمق است. روی یک موقعیت کلیک کن.</p></div>
          <div class="w-kv"><div><span class="k">میانگین عمق L×N/G</span><span class="v">${r2(st.mean)}X</span></div><div><span class="k">پهنای پوشش (عمق ≥ 1)</span><span class="v">${r2(st.breadth)}%</span></div><div><span class="k">کمینهٔ عمق</span><span class="v">${st.min}</span></div><div><span class="k">بیشینهٔ عمق</span><span class="v">${st.max}</span></div></div>
          <p class="wd-formula">mean = ${Lr} × ${N} / ${G} = ${r2(st.formula)}<br>breadth ≈ 1 − e^(−C) = ${r2(100 * theory)}% (نظریهٔ لاندر–واترمن، تقریبی)</p>
          <div class="w-out" id="${id}-info"></div>`;
        sOut.querySelector('svg').addEventListener('click', (e) => { const p = e.target.dataset && e.target.dataset.p; if (p != null) { sel = Number(p); sPos.value = sel; draw(); } });
        const info = sOut.querySelector('#' + id + '-info');
        info.innerHTML = `<label for="${id}-sp" style="font-weight:600">موقعیت انتخاب‌شده (۰ تا ${G - 1}) </label>`;
        info.append(sPos);
        info.insertAdjacentHTML('beforeend', `<p style="margin:8px 0 0">عمق موقعیت <b class="wd-mono">${sel}</b> برابر <b class="wd-mono">${depth[sel]}</b> است، در حالی که میانگین ${r2(st.mean)} است.</p><p class="w-note" style="margin:6px 0 0">فرمول L×N/G فقط میانگین را می‌دهد، نه عمق یک موقعیت مشخص (دام اسلاید ۹۵). عمق هر موقعیت تصادفی است و کنار میانگین بالا و پایین می‌رود؛ موقعیت‌های نزدیک دو سر ژنوم هم به‌طور متوسط کمتر پوشش می‌گیرند.</p>`);
      }
      roll();
    },
  });

  /* ---------------- cell-vectors ---------------- */
  BI.widget('cell-vectors', {
    title: 'سلول‌ها به‌عنوان بردار',
    desc: 'هر سلول یک بردار است که هر درایه‌اش بیان یک ژن است. عددها را عوض کن، معیار فاصله را انتخاب کن و ببین کدام دو سلول به هم نزدیک‌ترند. با دو منوی پایین دو ژن را به‌عنوان محور نمودار انتخاب کن.',
    mount(body) {
      const id = uid('cl');
      let cells = ['مغز', 'جنین', 'قلب'];
      let genes = ['OCT4', 'P53', 'X'];
      let vals = [['10', '500', '0'], ['0', '0', '100'], ['30', '30', '30']];
      let metric = 'euclid';
      const grid = h('div', { class: 'wd-scroll' });
      const err = h('p', { class: 'w-err', hidden: true });
      const out = h('div', { class: 'wd-step' });
      const bE = h('button', { type: 'button', text: 'اقلیدسی', onclick: () => { metric = 'euclid'; paintSeg(); render(); } });
      const bC = h('button', { type: 'button', text: 'کسینوسی', onclick: () => { metric = 'cos'; paintSeg(); render(); } });
      const paintSeg = () => { bE.setAttribute('aria-pressed', metric === 'euclid'); bC.setAttribute('aria-pressed', metric === 'cos'); };
      const xs = h('select', { id: id + '-x' }), ys = h('select', { id: id + '-y' });
      const rebuildSel = () => {
        const px = xs.value, py = ys.value;
        [xs, ys].forEach((s) => { s.replaceChildren(...genes.map((g, i) => h('option', { value: i, text: g || `ژن ${i + 1}` }))); });
        xs.value = px !== '' && +px < genes.length ? px : 0;
        ys.value = py !== '' && +py < genes.length ? py : Math.min(1, genes.length - 1);
      };
      body.append(
        h('div', { class: 'w-controls' }, h('div', { class: 'w-field' }, h('span', { text: 'معیار فاصله' }), h('div', { class: 'seg', role: 'group', 'aria-label': 'معیار فاصله' }, bE, bC))),
        h('div', { class: 'w-row' },
          h('button', { class: 'btn', type: 'button', text: '+ سلول', onclick: () => { if (cells.length >= 6) return; cells.push('سلول ' + fa(cells.length + 1)); vals.forEach((r) => r.push('1')); build(); render(); } }),
          h('button', { class: 'btn', type: 'button', text: '− سلول', onclick: () => { if (cells.length <= 2) return; cells.pop(); vals.forEach((r) => r.pop()); build(); render(); } }),
          h('button', { class: 'btn', type: 'button', text: '+ ژن', onclick: () => { if (genes.length >= 8) return; genes.push('G' + (genes.length + 1)); vals.push(cells.map(() => '1')); build(); render(); } }),
          h('button', { class: 'btn', type: 'button', text: '− ژن', onclick: () => { if (genes.length <= 2) return; genes.pop(); vals.pop(); build(); render(); } })),
        grid, err, out,
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field', for: id + '-x' }, 'محور افقی (ژن)', xs), h('label', { class: 'w-field', for: id + '-y' }, 'محور عمودی (ژن)', ys)),
        h('div', { class: 'w-out wd-plot' })
      );
      const plot = body.querySelector('.wd-plot');
      xs.addEventListener('change', render); ys.addEventListener('change', render);

      function build() {
        const t = h('table', { class: 'w-table wd-grid' });
        t.append(h('thead', null, h('tr', null, h('th', { text: 'ژن' }), ...cells.map((c, ci) => {
          const iid = `${id}-n${ci}`;
          const inp = h('input', { type: 'text', class: 'nm', id: iid, value: c, autocomplete: 'off' });
          inp.addEventListener('input', () => { cells[ci] = inp.value; render(); });
          return h('th', null, h('label', { class: 'sr-only', for: iid, text: `نام سلول ${fa(ci + 1)}` }), inp);
        }))));
        const tb = h('tbody');
        genes.forEach((g, gi) => {
          const tr = h('tr', null, h('th', { class: 'rowh', text: g }));
          cells.forEach((c, ci) => {
            const iid = `${id}-v${gi}-${ci}`;
            const inp = h('input', { type: 'number', class: 'mono', id: iid, value: vals[gi][ci], step: 'any' });
            inp.addEventListener('input', () => { vals[gi][ci] = inp.value; render(); });
            tr.append(h('td', null, h('label', { class: 'sr-only', for: iid, text: `بیان ${g} در سلول ${fa(ci + 1)}` }), inp));
          });
          tb.append(tr);
        });
        t.append(tb);
        grid.replaceChildren(t);
        rebuildSel();
      }

      function render() {
        const nums = vals.map((r) => r.map((v) => (v.trim() === '' ? NaN : Number(v))));
        if (nums.some((r) => r.some((v) => !isFinite(v)))) { err.hidden = false; err.textContent = 'همهٔ خانه‌های بیان باید عدد باشند. یک خانهٔ خالی یا نامعتبر پیدا شد.'; out.innerHTML = ''; plot.innerHTML = ''; return; }
        err.hidden = true;
        const n = cells.length;
        const vec = cells.map((_, ci) => nums.map((r) => r[ci]));
        const nm = cells.map((c, i) => esc(c.trim() || `سلول ${fa(i + 1)}`));
        const fn = metric === 'euclid' ? euclid : cosDist;
        const D = vec.map((a) => vec.map((b) => fn(a, b)));
        let best = null;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (isFinite(D[i][j]) && (!best || D[i][j] < D[best[0]][best[1]])) best = [i, j];
        const dec = (x) => (isFinite(x) ? String(Math.round(x * 100) / 100) : 'تعریف‌نشده');
        const rows = D.map((r, i) => [`<b>${nm[i]}</b>`, ...r.map((x, j) => ({ t: dec(x), cls: best && ((i === best[0] && j === best[1]) || (i === best[1] && j === best[0])) ? 'path' : '' }))]);
        let html = `<div class="w-out"><b>ماتریس فاصله (${metric === 'euclid' ? 'اقلیدسی' : 'کسینوسی'})</b><p class="wd-formula" style="margin:6px 0">${metric === 'euclid' ? 'd(a, b) = √( Σ (aᵢ − bᵢ)² )' : 'd(a, b) = 1 − (a·b) / (‖a‖ × ‖b‖)'}</p>${scrollBox(numTable(['', ...nm], rows))}`;
        html += best ? `<p style="margin:6px 0 0">نزدیک‌ترین جفت: <b>${nm[best[0]]}</b> و <b>${nm[best[1]]}</b> با فاصلهٔ <span class="wd-mono">${dec(D[best[0]][best[1]])}</span> (خانهٔ نارنجی).</p>` : '<p class="w-err" style="margin:6px 0 0">فاصله‌ای قابل محاسبه نیست (بردار صفر برای کسینوسی تعریف نمی‌شود).</p>';
        const other = metric === 'euclid' ? cosDist : euclid;
        let ob = null;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = other(vec[i], vec[j]); if (isFinite(d) && (!ob || d < ob.d)) ob = { i, j, d }; }
        if (best && ob && (ob.i !== best[0] || ob.j !== best[1])) html += `<p class="w-note" style="margin:6px 0 0">معیار ${metric === 'euclid' ? 'کسینوسی' : 'اقلیدسی'} جفت دیگری را نزدیک‌ترین می‌داند (${nm[ob.i]} و ${nm[ob.j]}). فاصلهٔ اقلیدسی به اندازهٔ بیان حساس است، ولی کسینوسی فقط جهت بردار (الگوی نسبی ژن‌ها) را می‌بیند.</p>`;
        html += '</div>';
        let steps = '';
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const a = vec[i], b = vec[j];
          let f;
          if (metric === 'euclid') f = `√(${a.map((x, k) => `(${x} − ${b[k]})²`).join(' + ')}) = √${a.reduce((s, x, k) => s + (x - b[k]) ** 2, 0)} = ${dec(D[i][j])}`;
          else {
            const dot = a.reduce((s, x, k) => s + x * b[k], 0);
            f = `1 − ${dot} / (${r2(Math.sqrt(a.reduce((s, x) => s + x * x, 0)))} × ${r2(Math.sqrt(b.reduce((s, x) => s + x * x, 0)))}) = ${dec(D[i][j])}`;
          }
          steps += `<li>${nm[i]} – ${nm[j]}: <span class="wd-formula">${esc(f)}</span></li>`;
        }
        html += `<details class="more"><summary>محاسبهٔ گام‌به‌گام همهٔ جفت‌ها</summary><div><ul style="margin:0;padding-inline-start:1.2em">${steps}</ul></div></details>`;
        const consts = constantRows(nums);
        consts.forEach((gi) => { html += `<aside class="callout pitfall"><p>ژن ${L(genes[gi])} در همهٔ سلول‌ها یکسان است؛ برای تشخیص نوع سلول اطلاعاتی نمی‌دهد.</p></aside>`; });
        out.innerHTML = html;

        const gx = Number(xs.value) || 0, gy = Number(ys.value) || 0;
        const W = 460, Ht = 330, ml = 56, mr = 24, mt = 20, mb = 50;
        const px = nums[gx], py = nums[gy];
        const tx = niceTicks(Math.min(0, ...px), Math.max(0, ...px)), ty = niceTicks(Math.min(0, ...py), Math.max(0, ...py));
        const X = (v) => ml + ((v - tx.lo) / (tx.hi - tx.lo)) * (W - ml - mr);
        const Y = (v) => Ht - mb - ((v - ty.lo) / (ty.hi - ty.lo)) * (Ht - mt - mb);
        let s = `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" style="min-width:${W}px" role="img" aria-label="نمودار پراکندگی سلول‌ها"><title>سلول‌ها در فضای دو ژن</title>`;
        tx.ticks.forEach((t) => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${mt}" y2="${Ht - mb}" class="s-line" stroke-width="1" stroke-dasharray="3 3"/><text x="${X(t)}" y="${Ht - mb + 16}" text-anchor="middle" font-size="11" class="mono t-muted">${t}</text>`; });
        ty.ticks.forEach((t) => { s += `<line x1="${ml}" x2="${W - mr}" y1="${Y(t)}" y2="${Y(t)}" class="s-line" stroke-width="1" stroke-dasharray="3 3"/><text x="${ml - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" class="mono t-muted">${t}</text>`; });
        s += `<rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${Ht - mt - mb}" class="f-none s-ink-2" stroke-width="1.5"/>`;
        s += `<text x="${(ml + W - mr) / 2}" y="${Ht - 8}" text-anchor="middle" font-size="13" font-weight="700" class="mono">${esc(genes[gx])}</text>`;
        s += `<text transform="translate(14 ${(mt + Ht - mb) / 2}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="700" class="mono">${esc(genes[gy])}</text>`;
        cells.forEach((c, ci) => {
          const cx = X(px[ci]), cy = Y(py[ci]);
          s += `<circle cx="${cx}" cy="${cy}" r="6" class="f-accent s-ink" stroke-width="1.5"/><text x="${Math.min(Math.max(cx, ml + 20), W - mr - 20)}" y="${cy - 11}" text-anchor="middle" font-size="13" font-weight="700" style="direction:rtl">${esc(c.trim() || 'سلول ' + fa(ci + 1))}</text>`;
        });
        s += '</svg>';
        plot.innerHTML = `<b>نمودار پراکندگی: ${L(genes[gx])} در برابر ${L(genes[gy])}</b>${scrollBox(s)}<p class="w-note" style="margin:6px 0 0">محورها به مقیاس‌اند. سلول‌هایی که نزدیک هم می‌افتند در این دو ژن الگوی بیان مشابه دارند.</p>`;
      }
      build(); paintSeg(); render();
    },
  });
})();
