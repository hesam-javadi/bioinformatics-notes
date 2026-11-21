/* widgets/align.js — brute-force read search with cost estimate, and DP alignment (Needleman–Wunsch / Smith–Waterman) */
(() => {
  'use strict';
  const { h, fa, esc } = BI;

  /* ---------- pure functions ---------- */

  function naiveTrace(ref, read, early) {
    const N = ref.length, L = read.length;
    const steps = [], matches = [];
    for (let w = 0; w + L <= N; w++) {
      let bad = 0;
      for (let j = 0; j < L; j++) {
        const ok = ref[w + j] === read[j];
        if (!ok) bad++;
        const stop = !ok && early;
        const done = stop || j === L - 1;
        steps.push({ w, j, ok, done, match: done ? bad === 0 : null });
        if (stop) break;
      }
      if (!bad) matches.push(w + 1);
    }
    const windows = Math.max(0, N - L + 1);
    return { steps, matches, windows, worst: windows * L };
  }

  function parseNum(str) {
    let s = String(str == null ? '' : str).trim();
    s = s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٬,_\s]/g, '').replace(/[−–]/g, '-').replace('٫', '.');
    let v = NaN, m;
    if (/^\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) v = Number(s);
    else if ((m = /^(\d*\.?\d+)\^(-?\d+)$/.exec(s))) v = Math.pow(Number(m[1]), Number(m[2]));
    else if ((m = /^(\d*\.?\d+)[x×*]10\^(-?\d+)$/i.exec(s))) v = Number(m[1]) * Math.pow(10, Number(m[2]));
    return Number.isFinite(v) && v > 0 ? v : NaN;
  }

  function costEstimate(G, L, N, rate) {
    const ops = G * L * N;
    const seconds = ops / rate;
    const days = seconds / 86400;
    const years = days / 365;
    return { ops, seconds, days, years };
  }

  function sci(x) {
    if (x < 1000) return String(Number(x.toPrecision(3)));
    const [m, e] = x.toExponential(2).split('e');
    const mant = Number(m);
    const ex = Number(e);
    return mant === 1 ? `10^${ex}` : `${mant} × 10^${ex}`;
  }

  function plain(x) {
    if (x >= 1e6) return sci(x);
    if (x >= 100) return Math.round(x).toLocaleString('en-US');
    return String(Number(x.toFixed(1)));
  }

  function mn(x) { return x < 0 ? '−' + (-x) : String(x); }

  function dpCands(H, a, b, i, j, mode, sc) {
    const s = a[j - 1] === b[i - 1] ? sc.match : sc.mis;
    const c = [
      { k: 'diag', arrow: '↖', base: H[i - 1][j - 1], add: s },
      { k: 'up', arrow: '↑', base: H[i - 1][j], add: sc.gap },
      { k: 'left', arrow: '←', base: H[i][j - 1], add: sc.gap },
    ];
    c.forEach((x) => { x.val = x.base + x.add; });
    if (mode === 'local') c.push({ k: 'zero', arrow: '•', base: 0, add: 0, val: 0 });
    const best = Math.max(...c.map((x) => x.val));
    let chosen;
    if (mode === 'local' && best === 0) chosen = c[3];
    else chosen = c.find((x) => x.val === best);
    return { cands: c, best, chosen, s };
  }

  function dpInit(m, n, mode, gap) {
    const H = [];
    for (let i = 0; i <= m; i++) {
      H.push([]);
      for (let j = 0; j <= n; j++) H[i].push(mode === 'global' ? (i === 0 ? j * gap : j === 0 ? i * gap : 0) : 0);
    }
    return H;
  }

  function dpMatrix(a, b, mode, sc) {
    const m = b.length, n = a.length;
    const H = dpInit(m, n, mode, sc.gap);
    const arrows = H.map((r) => r.map(() => ''));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const r = dpCands(H, a, b, i, j, mode, sc);
      H[i][j] = r.best;
      arrows[i][j] = r.chosen.arrow;
    }
    return { H, arrows };
  }

  function dpTrace(H, a, b, mode, sc) {
    const m = b.length, n = a.length;
    let i = m, j = n;
    if (mode === 'local') {
      let best = -Infinity;
      for (let x = 1; x <= m; x++) for (let y = 1; y <= n; y++) if (H[x][y] >= best) { best = H[x][y]; i = x; j = y; }
      if (best <= 0) return { path: [], alA: '', alB: '', mid: '', terms: [], score: 0, empty: true };
    }
    const path = [[i, j]];
    const cols = [];
    const go = () => (mode === 'global' ? (i > 0 || j > 0) : H[i][j] > 0);
    while (go()) {
      const s = i > 0 && j > 0 ? (a[j - 1] === b[i - 1] ? sc.match : sc.mis) : 0;
      if (i > 0 && j > 0 && H[i][j] === H[i - 1][j - 1] + s) {
        cols.push({ x: a[j - 1], y: b[i - 1], t: a[j - 1] === b[i - 1] ? '|' : '·', s });
        i--; j--;
      } else if (i > 0 && H[i][j] === H[i - 1][j] + sc.gap) {
        cols.push({ x: '-', y: b[i - 1], t: ' ', s: sc.gap });
        i--;
      } else {
        cols.push({ x: a[j - 1], y: '-', t: ' ', s: sc.gap });
        j--;
      }
      path.push([i, j]);
    }
    cols.reverse();
    const terms = cols.map((c) => c.s);
    return {
      path,
      alA: cols.map((c) => c.x).join(''),
      alB: cols.map((c) => c.y).join(''),
      mid: cols.map((c) => c.t).join(''),
      terms,
      score: terms.reduce((p, q) => p + q, 0),
      empty: false,
    };
  }

  function fmtTerms(terms, score) {
    if (!terms.length) return `= ${mn(score)}`;
    const body = terms.map((t, k) => (k === 0 ? mn(t) : t < 0 ? ` − ${-t}` : ` + ${t}`)).join('');
    return `${body} = ${mn(score)}`;
  }

  /* ---------- shared helpers ---------- */

  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let uidN = 0;
  const uid = (p) => `${p}-${++uidN}-${Math.random().toString(36).slice(2, 6)}`;

  BI.css('w-align', `
    .al-scroll { overflow-x: auto; direction: ltr; padding: 4px 2px 8px; }
    .al-inner { display: inline-block; min-width: 100%; }
    .al-row { display: flex; gap: 2px; white-space: nowrap; direction: ltr; margin-bottom: 4px; }
    .al-c { width: 26px; flex: none; text-align: center; font: 700 .95rem/1.3 var(--mono); border: 1px solid var(--line); border-radius: 4px; background: var(--surface); color: var(--ink); padding: 2px 0 0; }
    .al-c small { display: block; font: 500 .62rem/1.3 var(--mono); color: var(--muted); }
    .al-c.found { background: var(--accent-soft); border-color: var(--accent); }
    .al-c.win { border-color: var(--accent); border-width: 2px; }
    .al-c.ok { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
    .al-c.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
    .al-lbl { width: 46px; flex: none; font: 600 .7rem/1.9 var(--mono); color: var(--muted); }
    .al-line { margin: 0; padding: 4px 8px; font-family: var(--mono); direction: ltr; unicode-bidi: isolate; white-space: pre; text-align: left; }
    .al-cand { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 3px 0; }
    .al-cand code { direction: ltr; unicode-bidi: isolate; display: inline-block; }
    .al-cand.pick { font-weight: 800; }
    .al-mm { color: var(--bad); font-weight: 700; } .al-mt { color: var(--ok); font-weight: 700; }
    .al-arrow { display: block; font-size: .65rem; color: var(--muted); line-height: 1; }
    .al-wrap { display: grid; gap: 8px; }
    .al-check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-0); font-weight: 600; color: var(--ink-2); }
    .al-steps code { display: block; direction: ltr; unicode-bidi: isolate; text-align: left; margin: 2px 0; }
  `);

  /* ---------- naive-search ---------- */

  BI.widget('naive-search', {
    title: 'جست‌وجوی ساده (brute force)',
    desc: 'ریید را روی ژنوم مرجع می‌لغزانیم و هر بار حرف‌به‌حرف مقایسه می‌کنیم. گام بعد را بزن تا ببینی هر مقایسه سبز (تطابق) یا قرمز (عدم تطابق) می‌شود. بخش پایین هزینهٔ این روش را برای یک ژنوم واقعی تخمین می‌زند.',
    mount(body, opts) {
      const idRef = uid('ns-ref'), idRead = uid('ns-read'), idSpeed = uid('ns-speed'), idEarly = uid('ns-early');
      const refIn = h('input', { type: 'text', class: 'mono', id: idRef, value: opts.ref || 'ACGTACGTACGA', spellcheck: 'false', autocomplete: 'off', maxlength: '60' });
      const readIn = h('input', { type: 'text', class: 'mono', id: idRead, value: opts.read || 'TACG', spellcheck: 'false', autocomplete: 'off', maxlength: '30' });
      const early = h('input', { type: 'checkbox', id: idEarly, checked: true });
      const speed = h('select', { id: idSpeed },
        h('option', { value: '900', text: 'کند' }), h('option', { value: '450', text: 'متوسط', selected: true }), h('option', { value: '120', text: 'سریع' }));
      const bNext = h('button', { class: 'btn primary', type: 'button', text: 'گام بعد' });
      const bPlay = h('button', { class: 'btn', type: 'button', text: 'پخش' });
      const bReset = h('button', { class: 'btn ghost', type: 'button', text: 'از نو' });
      const err = h('p', { class: 'w-err', hidden: true });
      const stage = h('div', { class: 'al-scroll w-out' });
      const status = h('p', { class: 'w-note', style: 'margin:0', 'aria-live': 'polite' });
      const kv = h('div', { class: 'w-kv' });
      const res = h('div', { class: 'w-row' });

      body.append(
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field grow', for: idRef }, 'ژنوم مرجع (حداکثر ۶۰ حرف)', refIn),
          h('label', { class: 'w-field', for: idRead }, 'ریید', readIn)),
        h('div', { class: 'w-controls' }, bNext, bPlay, bReset,
          h('label', { class: 'w-field', for: idSpeed }, 'سرعت', speed),
          h('label', { class: 'al-check', for: idEarly }, early, 'توقف در اولین عدم تطابق')),
        err, stage, status, kv, res
      );

      let ref = '', read = '', tr = null, idx = 0, timer = null, valid = false;

      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } bPlay.textContent = 'پخش'; };

      function apply() {
        stop();
        const r = refIn.value.trim().toUpperCase(), q = readIn.value.trim().toUpperCase();
        let msg = '';
        if (!r || !q) msg = 'ژنوم و ریید را وارد کن.';
        else if (/[^ACGT]/.test(r + q)) msg = 'فقط حروف A، C، G و T مجازند.';
        else if (q.length > r.length) msg = 'ریید نباید از ژنوم مرجع بلندتر باشد.';
        err.hidden = !msg;
        err.textContent = msg;
        valid = !msg;
        [bNext, bPlay].forEach((b) => { b.disabled = !valid; });
        if (!valid) return;
        ref = r; read = q;
        tr = naiveTrace(ref, read, early.checked);
        idx = 0;
        render();
      }

      function render() {
        const N = ref.length, L = read.length;
        const last = idx ? tr.steps[idx - 1] : null;
        const w = last ? last.w : 0;
        const cmp = {};
        for (let k = 0; k < idx; k++) if (tr.steps[k].w === w) cmp[tr.steps[k].j] = tr.steps[k].ok;
        const found = new Set();
        let doneCount = 0;
        const foundStarts = [];
        for (let k = 0; k < idx; k++) {
          const s = tr.steps[k];
          if (s.done) { doneCount++; if (s.match) foundStarts.push(s.w); }
        }
        foundStarts.forEach((p) => { for (let q = 0; q < L; q++) found.add(p + q); });
        const refCells = [...ref].map((c, p) => {
          let cls = '';
          if (found.has(p)) cls = ' found';
          if (p >= w && p < w + L) { cls = ' win'; const j = p - w; if (j in cmp) cls += cmp[j] ? ' ok' : ' bad'; }
          return `<span class="al-c${cls}">${c}<small>${p + 1}</small></span>`;
        }).join('');
        const readCells = [...read].map((c, j) => `<span class="al-c${j in cmp ? (cmp[j] ? ' ok' : ' bad') : ''}">${c}</span>`).join('');
        stage.innerHTML = `<div class="al-inner"><div class="al-row">${refCells}</div><div class="al-row" style="margin-left:${w * 28}px">${readCells}</div></div>`;

        const finished = idx === tr.steps.length;
        let txt;
        if (!last) txt = `آمادهٔ شروع: پنجرهٔ ۱ روی موقعیت ۱ قرار دارد (ریید ${L} حرف دارد).`;
        else {
          const rc = ref[w + last.j], qc = read[last.j];
          txt = `مقایسه: ref[${w + last.j + 1}] = ${rc} با read[${last.j + 1}] = ${qc} ← ${last.ok ? 'تطابق' : 'عدم تطابق'}.`;
          if (last.done) txt += last.match ? ` پنجرهٔ ${w + 1} تمام شد: تطابق کامل در موقعیت ${w + 1}.` : ` پنجرهٔ ${w + 1} تمام شد: بدون تطابق.`;
          if (finished) txt += ' همهٔ پنجره‌ها بررسی شد.';
        }
        status.textContent = txt;

        const kvs = [
          ['پنجره‌های امتحان‌شده', `${doneCount} / ${tr.windows}`],
          ['مقایسه‌های حرفی تا الان', String(idx)],
          ['بدترین حالت (N − L + 1)·L', `(${N} − ${L} + 1)·${L} = ${tr.worst}`],
        ];
        kv.innerHTML = kvs.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('');

        const ms = foundStarts.map((p) => p + 1);
        res.innerHTML = `<b>موقعیت‌های تطابق (از ۱):</b> ` + (ms.length ? ms.map((p) => `<span class="pill ok">${p}</span>`).join(' ') : `<span class="w-note">${finished ? 'هیچ تطابقی پیدا نشد.' : 'هنوز چیزی پیدا نشده.'}</span>`);
        bNext.disabled = !valid || finished;
        bPlay.disabled = !valid || finished;
      }

      function step() { if (idx < tr.steps.length) { idx++; render(); } }

      function tick() {
        timer = null;
        step();
        if (idx < tr.steps.length) timer = setTimeout(tick, +speed.value);
        else stop();
      }

      bNext.addEventListener('click', () => { stop(); step(); });
      bPlay.addEventListener('click', () => {
        if (timer) { stop(); return; }
        if (reduced()) { idx = tr.steps.length; render(); return; }
        bPlay.textContent = 'توقف';
        timer = setTimeout(tick, 50);
      });
      bReset.addEventListener('click', apply);
      refIn.addEventListener('input', apply);
      readIn.addEventListener('input', apply);
      early.addEventListener('change', apply);
      apply();

      /* cost estimator */
      const ids = { g: uid('ns-g'), l: uid('ns-l'), n: uid('ns-n'), r: uid('ns-r') };
      const mk = (id, v) => h('input', { type: 'text', class: 'mono', id, value: v, inputmode: 'decimal', spellcheck: 'false', autocomplete: 'off', style: 'direction:ltr;text-align:left' });
      const gIn = mk(ids.g, '1e9'), lIn = mk(ids.l, '300'), nIn = mk(ids.n, '1e6'), rIn = mk(ids.r, '1e9');
      const cErr = h('p', { class: 'w-err', hidden: true });
      const cOut = h('div', { class: 'w-out al-steps' });
      body.append(
        h('h4', { text: 'تخمین هزینه', style: 'margin:6px 0 0' }),
        h('p', { class: 'w-note', style: 'margin:0', text: 'عدد را به شکل 1e9، 10^9 یا معمولی بنویس. تعداد عمل‌ها برابر است با طول ریید × تعداد ریدها × طول ژنوم.' }),
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field', for: ids.g }, 'طول ژنوم (G)', gIn),
          h('label', { class: 'w-field', for: ids.l }, 'طول ریید (L)', lIn),
          h('label', { class: 'w-field', for: ids.n }, 'تعداد ریدها (N)', nIn),
          h('label', { class: 'w-field', for: ids.r }, 'عمل در ثانیه', rIn)),
        cErr, cOut
      );
      function cost() {
        const G = parseNum(gIn.value), L = parseNum(lIn.value), N = parseNum(nIn.value), R = parseNum(rIn.value);
        const bad = [G, L, N, R].some((x) => Number.isNaN(x));
        cErr.hidden = !bad;
        if (bad) { cErr.textContent = 'همهٔ چهار مقدار باید عددی مثبت باشند (مثل 1e9، 10^9 یا 300).'; cOut.innerHTML = ''; return; }
        const c = costEstimate(G, L, N, R);
        cOut.innerHTML = `
          <code>ops = L × N × G = ${sci(L)} × ${sci(N)} × ${sci(G)} = ${sci(c.ops)} ops</code>
          <code>ثانیه = ${sci(c.ops)} ÷ ${sci(R)} = ${sci(c.seconds)} s</code>
          <code>روز = ${sci(c.seconds)} ÷ 86,400 ≈ ${plain(c.days)} days</code>
          <code>سال = ${plain(c.days)} ÷ 365 ≈ ${plain(c.years)} years</code>
          <p class="w-note" style="margin:6px 0 0"><b>نتیجه:</b> حدود <span class="ltr">${plain(c.years)}</span> سال، پس جست‌وجوی ساده برای ژنوم واقعی کارآمد نیست.</p>`;
      }
      [gIn, lIn, nIn, rIn].forEach((x) => x.addEventListener('input', cost));
      cost();
    },
  });

  /* ---------- dp-align ---------- */

  BI.widget('dp-align', {
    title: 'هم‌ترازی با برنامه‌نویسی پویا',
    desc: 'ماتریس را خانه‌به‌خانه پر کن. هر خانه بیشینهٔ سه حالت (قطری، بالا، چپ) است و در حالت محلی صفر هم کاندید است. بعد با «ردگیری» مسیر هم‌ترازی را از ماتریس بیرون بکش.',
    mount(body, opts) {
      const id = { a: uid('dp-a'), b: uid('dp-b'), m: uid('dp-m'), x: uid('dp-x'), g: uid('dp-g'), ar: uid('dp-ar') };
      let mode = opts.mode === 'local' ? 'local' : 'global';
      const mkSeg = (t, v) => h('button', { type: 'button', text: t, 'aria-pressed': String(mode === v) });
      const bG = mkSeg('سراسری (Global)', 'global'), bL = mkSeg('محلی (Local)', 'local');
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'نوع هم‌ترازی' }, bG, bL);
      const num = (i, v) => h('input', { type: 'text', class: 'mono', id: i, value: v, inputmode: 'numeric', spellcheck: 'false', autocomplete: 'off', style: 'width:5em;direction:ltr;text-align:left' });
      const aIn = h('input', { type: 'text', class: 'mono', id: id.a, value: opts.a || 'ATGCT', spellcheck: 'false', autocomplete: 'off', maxlength: '12', style: 'direction:ltr;text-align:left' });
      const bIn = h('input', { type: 'text', class: 'mono', id: id.b, value: opts.b || 'AGCT', spellcheck: 'false', autocomplete: 'off', maxlength: '12', style: 'direction:ltr;text-align:left' });
      const mIn = num(id.m, '1'), xIn = num(id.x, '-1'), gIn = num(id.g, '-2');
      const arrowChk = h('input', { type: 'checkbox', id: id.ar, checked: true });
      const presets = h('div', { class: 'w-row' });
      [['سراسری: ATGCT / AGCT', 'global', 'ATGCT', 'AGCT'], ['محلی: ATGCT / AGCT', 'local', 'ATGCT', 'AGCT'], ['سراسری: AGT / AT', 'global', 'AGT', 'AT'], ['محلی: ACGT / AGT', 'local', 'ACGT', 'AGT']].forEach(([t, md, a, b]) => {
        presets.append(h('button', { class: 'btn ghost', type: 'button', text: t, onclick: () => { mode = md; syncSeg(); aIn.value = a; bIn.value = b; apply(); } }));
      });
      const bNext = h('button', { class: 'btn primary', type: 'button', text: 'گام بعد' });
      const bFill = h('button', { class: 'btn', type: 'button', text: 'پر کردن کامل' });
      const bTrace = h('button', { class: 'btn', type: 'button', text: 'ردگیری' });
      const bReset = h('button', { class: 'btn ghost', type: 'button', text: 'از نو' });
      const err = h('p', { class: 'w-err', hidden: true });
      const tbl = h('div', { class: 'w-out' });
      const panel = h('div', { class: 'w-out', 'aria-live': 'polite' });
      const outp = h('div', { class: 'w-out' });
      const cells = h('p', { class: 'w-note', style: 'margin:0' });

      body.append(
        h('div', { class: 'w-controls' }, seg),
        presets,
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field grow', for: id.a }, 'توالی a (ستون‌ها، حداکثر ۱۲)', aIn),
          h('label', { class: 'w-field grow', for: id.b }, 'توالی b (سطرها، حداکثر ۱۲)', bIn)),
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field', for: id.m }, 'امتیاز تطابق', mIn),
          h('label', { class: 'w-field', for: id.x }, 'امتیاز عدم تطابق', xIn),
          h('label', { class: 'w-field', for: id.g }, 'امتیاز گپ (منفی)', gIn)),
        h('div', { class: 'w-controls' }, bNext, bFill, bTrace, bReset,
          h('label', { class: 'al-check', for: id.ar }, arrowChk, 'نمایش پیکان‌ها')),
        err, h('div', { class: 'al-wrap' }, tbl, panel, outp), cells
      );

      let a = '', b = '', sc = null, H = null, arrows = null, k = 0, path = null, trace = null, valid = false;

      function syncSeg() { bG.setAttribute('aria-pressed', String(mode === 'global')); bL.setAttribute('aria-pressed', String(mode === 'local')); }
      bG.addEventListener('click', () => { mode = 'global'; syncSeg(); apply(); });
      bL.addEventListener('click', () => { mode = 'local'; syncSeg(); apply(); });

      const num0 = (el) => { const s = el.value.trim().replace(/[−–]/g, '-').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); return /^[+-]?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; };

      function apply() {
        const A = aIn.value.trim().toUpperCase(), B = bIn.value.trim().toUpperCase();
        const m = num0(mIn), x = num0(xIn), g = num0(gIn);
        let msg = '';
        if (!A || !B) msg = 'هر دو توالی را وارد کن.';
        else if (/[^A-Z]/.test(A + B)) msg = 'توالی‌ها فقط می‌توانند حروف انگلیسی باشند (مثل ATGC).';
        else if (A.length > 12 || B.length > 12) msg = 'طول هر توالی حداکثر ۱۲ است.';
        else if ([m, x, g].some(Number.isNaN)) msg = 'امتیازها باید عدد باشند (مثل 1، -1 و -2).';
        else if (g > 0) msg = 'امتیاز گپ باید عددی منفی (یا صفر) باشد، مثل -2.';
        err.hidden = !msg;
        err.textContent = msg;
        valid = !msg;
        if (!valid) { [bNext, bFill, bTrace].forEach((q) => { q.disabled = true; }); return; }
        a = A; b = B; sc = { match: m, mis: x, gap: g };
        H = dpInit(b.length, a.length, mode, g);
        arrows = H.map((r) => r.map(() => ''));
        k = 0; path = null; trace = null;
        render(null);
      }

      const total = () => a.length * b.length;
      const cellAt = (n) => [Math.floor(n / a.length) + 1, (n % a.length) + 1];

      function fillOne() {
        if (k >= total()) return null;
        const [i, j] = cellAt(k);
        const r = dpCands(H, a, b, i, j, mode, sc);
        H[i][j] = r.best;
        arrows[i][j] = r.chosen.arrow;
        k++;
        return { i, j, r };
      }

      function doTrace() {
        while (k < total()) fillOne();
        trace = dpTrace(H, a, b, mode, sc);
        path = new Set(trace.path.map(([i, j]) => `${i},${j}`));
        render(null);
      }

      function render(info) {
        const m = b.length, n = a.length;
        const showArrows = arrowChk.checked;
        const cur = k > 0 ? cellAt(k - 1) : null;
        let bestKey = null;
        if (mode === 'local' && k >= total() && total() > 0) {
          let bv = -Infinity;
          for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) if (H[i][j] >= bv) { bv = H[i][j]; bestKey = `${i},${j}`; }
        }
        let html = '<div style="overflow-x:auto"><table class="w-table"><thead><tr><th></th><th>−</th>' + [...a].map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        for (let i = 0; i <= m; i++) {
          html += `<tr><th>${i === 0 ? '−' : b[i - 1]}</th>`;
          for (let j = 0; j <= n; j++) {
            const init = i === 0 || j === 0;
            const idxk = init ? -1 : (i - 1) * n + (j - 1);
            const filled = init || idxk < k;
            const key = `${i},${j}`;
            let cls = '';
            if (path && path.has(key)) cls = 'path';
            else if (cur && cur[0] === i && cur[1] === j && !path) cls = 'cur';
            else if (bestKey === key) cls = 'hit';
            const ar = filled && !init && showArrows ? `<span class="al-arrow">${arrows[i][j]}</span>` : '';
            html += `<td${cls ? ` class="${cls}"` : ''}>${filled ? mn(H[i][j]) : ''}${ar}</td>`;
          }
          html += '</tr>';
        }
        tbl.innerHTML = html + '</tbody></table></div>';

        if (info) {
          const { i, j, r } = info;
          const rows = r.cands.map((c) => {
            const pick = c === r.chosen;
            const names = { diag: 'قطری', up: 'بالا', left: 'چپ', zero: 'صفر (فقط محلی)' };
            const f = c.k === 'zero' ? '0' : c.k === 'diag' ? `${mn(c.base)} + s(${a[j - 1]},${b[i - 1]}) = ${mn(c.base)} + ${mn(c.add)} = ${mn(c.val)}` : `${mn(c.base)} + gap = ${mn(c.base)} + ${mn(c.add)} = ${mn(c.val)}`;
            return `<div class="al-cand${pick ? ' pick' : ''}"><span>${c.arrow} ${names[c.k]}</span><code>${f}</code>${pick ? '<span class="pill ok">انتخاب</span>' : ''}</div>`;
          }).join('');
          panel.innerHTML = `<p class="w-note" style="margin:0 0 4px">خانهٔ سطر ${i}، ستون ${j}: <code class="seq">a[${j}] = ${a[j - 1]}</code> و <code class="seq">b[${i}] = ${b[i - 1]}</code> (${r.s === sc.match && a[j - 1] === b[i - 1] ? 'تطابق' : 'عدم تطابق'})</p>${rows}<p style="margin:6px 0 0">مقدار خانه = بیشینه = <b class="ltr">${mn(r.best)}</b> ${r.chosen.arrow}</p>`;
        } else if (k === 0) {
          panel.innerHTML = '<p class="w-note" style="margin:0">سطر و ستون صفر آماده است. «گام بعد» را بزن تا اولین خانه حساب شود.</p>';
        } else if (k >= total()) {
          panel.innerHTML = `<p class="w-note" style="margin:0">ماتریس کامل است. ${mode === 'global' ? 'جواب سراسری در خانهٔ پایین-راست است.' : 'جواب محلی بزرگ‌ترین عدد ماتریس است (با رنگ مشخص شده).'}</p>`;
        }

        if (trace && !trace.empty) {
          const mid = [...trace.mid].map((c) => (c === '|' ? `<span class="al-mt">|</span>` : c === '·' ? `<span class="al-mm">·</span>` : ' ')).join('');
          outp.innerHTML = `<div class="al-line">${esc(trace.alA)}</div><div class="al-line">${mid}</div><div class="al-line">${esc(trace.alB)}</div>
            <p class="w-row" style="margin:6px 0 0"><span><b>امتیاز:</b> <code class="seq">${fmtTerms(trace.terms, trace.score)}</code></span></p>
            <p class="w-note" style="margin:4px 0 0">| تطابق، · عدم تطابق، فاصله = گپ (‎-‎).</p>`;
        } else if (trace && trace.empty) {
          outp.innerHTML = '<p class="w-note" style="margin:0">بیشینهٔ ماتریس صفر است، پس هیچ هم‌ترازی محلی با امتیاز مثبت وجود ندارد.</p>';
        } else outp.innerHTML = '<p class="w-note" style="margin:0">هم‌ترازی بعد از «ردگیری» اینجا نشان داده می‌شود.</p>';

        cells.innerHTML = `تعداد خانه‌هایی که باید حساب شوند: <code class="seq">m × n = ${m} × ${n} = ${m * n}</code> ← پیچیدگی <code class="seq">O(mn)</code>. پر شده: ${fa(k)} از ${fa(m * n)}.`;
        const full = k >= total();
        bNext.disabled = full;
        bFill.disabled = full;
        bTrace.disabled = !!trace;
      }

      bNext.addEventListener('click', () => { const info = fillOne(); path = null; trace = null; render(info); });
      bFill.addEventListener('click', () => { while (k < total()) fillOne(); path = null; trace = null; render(null); });
      bTrace.addEventListener('click', doTrace);
      bReset.addEventListener('click', apply);
      [aIn, bIn, mIn, xIn, gIn].forEach((x) => x.addEventListener('input', apply));
      arrowChk.addEventListener('change', () => { if (valid) render(null); });
      apply();
    },
  });
})();
