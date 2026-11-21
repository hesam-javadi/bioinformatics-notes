/* widgets/index.js — k-mers and pigeonhole, hash index, trie, BWT / FM-index */
(() => {
  'use strict';
  const { h, fa, esc, colorSeq } = BI;

  const DIGIT = { A: 0, C: 1, G: 2, T: 3 };

  function cleanDna(s) { return String(s || '').toUpperCase().replace(/\s+/g, ''); }
  function badDna(s) { return [...new Set([...s].filter((c) => !(c in DIGIT)))]; }

  function kmersOf(seq, k) {
    const out = [];
    for (let i = 0; i + k <= seq.length; i++) out.push({ s: seq.slice(i, i + k), pos: i + 1 });
    return out;
  }
  function kmerCount(L, k) { return Math.max(0, L - k + 1); }
  function distinctCount(list) { return new Set(list.map((x) => x.s)).size; }
  function blockRanges(L, b) {
    const r = [];
    for (let j = 0; j < b; j++) r.push([Math.floor(j * L / b), Math.floor((j + 1) * L / b)]);
    return r;
  }
  function blockStatus(ranges, muts) {
    return ranges.map(([a, z]) => { let c = 0; for (let i = a; i < z; i++) if (muts.has(i)) c++; return c; });
  }
  function randInt(n, rnd) { return Math.floor(rnd() * n); }
  function randomMuts(L, m, rnd) {
    const set = new Set();
    m = Math.min(m, L);
    while (set.size < m) set.add(randInt(L, rnd));
    return set;
  }
  function worstCase(L, b, m, rnd) {
    const set = new Set();
    m = Math.min(m, L);
    const ranges = blockRanges(L, b);
    const order = ranges.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = randInt(i + 1, rnd); [order[i], order[j]] = [order[j], order[i]]; }
    for (let t = 0; t < Math.min(m, b); t++) {
      const [a, z] = ranges[order[t]];
      set.add(a + randInt(z - a, rnd));
    }
    while (set.size < m) set.add(randInt(L, rnd));
    return set;
  }

  function encode(s) { let v = 0; for (const c of s) v = v * 4 + DIGIT[c]; return v; }
  function buildIndex(ref, k) {
    const m = new Map();
    for (let i = 0; i + k <= ref.length; i++) {
      const s = ref.substr(i, k);
      if (!m.has(s)) m.set(s, []);
      m.get(s).push(i + 1);
    }
    return m;
  }
  function readKmers(read, k, step) {
    const out = [];
    for (let o = 0; o + k <= read.length; o += step) out.push({ o, s: read.substr(o, k) });
    return out;
  }
  function mismatches(a, b) { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++; return c; }
  function lookupRead(ref, read, index, k, step) {
    const lookups = readKmers(read, k, step).map((x) => ({ ...x, hits: index.get(x.s) || [] }));
    const votes = new Map();
    let outside = 0;
    for (const lk of lookups) {
      lk.cands = lk.hits.map((p) => p - lk.o);
      lk.valid = lk.cands.map((st) => st >= 1 && st + read.length - 1 <= ref.length);
      lk.cands.forEach((st, i) => {
        if (lk.valid[i]) votes.set(st, (votes.get(st) || 0) + 1); else outside++;
      });
    }
    const ranked = [...votes].map(([start, v]) => ({ start, votes: v, mism: mismatches(read, ref.substr(start - 1, read.length)) }))
      .sort((a, b) => b.votes - a.votes || a.start - b.start);
    return { lookups, ranked, outside };
  }

  const TRIE_ORDER = 'ACGT';
  function childOrder(a, b) {
    const ia = TRIE_ORDER.indexOf(a), ib = TRIE_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function sortedChildren(node) { return [...node.children.keys()].sort(childOrder).map((c) => node.children.get(c)); }
  function buildTrie(words) {
    const root = { ch: '', prefix: '', children: new Map(), end: false, depth: 0 };
    let nodes = 0, chars = 0;
    for (const w of words) {
      chars += w.length;
      let node = root;
      for (const ch of w) {
        if (!node.children.has(ch)) { node.children.set(ch, { ch, prefix: node.prefix + ch, children: new Map(), end: false, depth: node.depth + 1 }); nodes++; }
        node = node.children.get(ch);
      }
      node.end = true;
    }
    return { root, nodes, chars };
  }
  function layoutTrie(root) {
    let leaf = 0, maxDepth = 0;
    (function rec(n) {
      maxDepth = Math.max(maxDepth, n.depth);
      const kids = sortedChildren(n);
      if (!kids.length) { n.x = leaf++; return; }
      kids.forEach(rec);
      n.x = (kids[0].x + kids[kids.length - 1].x) / 2;
    })(root);
    return { leaves: leaf, maxDepth };
  }
  function trieWalk(root, pat) {
    let node = root, matched = 0;
    const path = [root];
    for (const ch of pat) {
      const nx = node.children.get(ch);
      if (!nx) break;
      node = nx; matched++; path.push(nx);
    }
    return { node, matched, path, complete: matched === pat.length };
  }
  function wordsUnder(node) {
    const out = [];
    (function rec(n) { if (n.end) out.push(n.prefix); sortedChildren(n).forEach(rec); })(node);
    return out;
  }

  function bwtKey(c) { return c === '$' ? -1 : c.charCodeAt(0); }
  function bwtCompare(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { const d = bwtKey(a[i]) - bwtKey(b[i]); if (d) return d; }
    return a.length - b.length;
  }
  function normalizeText(raw) {
    let s = String(raw || '').replace(/\s+/g, '');
    if (!s) return { error: 'یک متن وارد کن.' };
    const first = s.indexOf('$');
    if (first >= 0 && (first !== s.length - 1 || s.indexOf('$', first + 1) >= 0)) return { error: 'علامت $ فقط یک بار و فقط در انتهای متن مجاز است؛ خودت لازم نیست آن را بنویسی، ابزار اضافه‌اش می‌کند.' };
    if (!s.endsWith('$')) s += '$';
    if (s.length < 2) return { error: 'متن باید دست‌کم یک نویسه جز $ داشته باشد.' };
    if (s.length > 41) return { error: 'برای خوانا ماندن جدول‌ها، متن حداکثر ۴۰ نویسه باشد.' };
    return { text: s };
  }
  function buildBwt(text) {
    const n = text.length;
    const rots = [];
    for (let i = 0; i < n; i++) rots.push({ sa: i, rot: text.slice(i) + text.slice(0, i) });
    const rows = rots.slice().sort((a, b) => bwtCompare(a.rot, b.rot));
    const F = rows.map((r) => r.rot[0]);
    const L = rows.map((r) => r.rot[n - 1]);
    const symbols = [...new Set(text)].sort((a, b) => bwtKey(a) - bwtKey(b));
    const C = new Map();
    symbols.forEach((c) => C.set(c, [...text].filter((x) => bwtKey(x) < bwtKey(c)).length));
    const occ = new Map();
    symbols.forEach((c) => {
      const row = [0];
      for (let i = 0; i < n; i++) row.push(row[i] + (L[i] === c ? 1 : 0));
      occ.set(c, row);
    });
    return { n, rots, rows, F, L, bwt: L.join(''), SA: rows.map((r) => r.sa), symbols, C, occ };
  }
  function backwardSearch(info, pattern) {
    let sp = 0, ep = info.n;
    const steps = [];
    for (let i = pattern.length - 1; i >= 0; i--) {
      const c = pattern[i];
      if (!info.C.has(c)) { steps.push({ c, idx: i, sp, ep, missing: true, sp2: 0, ep2: 0 }); sp = 0; ep = 0; break; }
      const cc = info.C.get(c), o1 = info.occ.get(c)[sp], o2 = info.occ.get(c)[ep];
      const st = { c, idx: i, sp, ep, cc, o1, o2, sp2: cc + o1, ep2: cc + o2 };
      steps.push(st);
      sp = st.sp2; ep = st.ep2;
      if (sp >= ep) break;
    }
    const found = sp < ep && steps.length === pattern.length;
    return { steps, sp, ep, found, positions: found ? info.SA.slice(sp, ep) : [] };
  }

  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 7);
  const fmt = (n) => fa(n);

  BI.css('w-index', `
    .ix-h { font-weight: 800; font-size: var(--fs-0); margin: 0 0 6px; color: var(--ink-2); }
    .ix-cells { direction: ltr; display: flex; gap: 3px; overflow-x: auto; padding: 4px 2px 6px; }
    .ix-cell { flex: none; min-width: 28px; text-align: center; font-family: var(--mono); font-weight: 700; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 3px 2px 0; }
    .ix-cell small { display: block; font-size: .62rem; color: var(--muted); font-weight: 500; }
    .ix-cell.win { background: var(--accent-soft); border-color: var(--accent); }
    .ix-cell.hl { background: var(--hl-soft); border-color: var(--hl); }
    .ix-chips { direction: ltr; display: flex; flex-wrap: wrap; gap: 6px; }
    .ix-chips .pill { font-family: var(--mono); font-size: .8rem; }
    .ix-blocks { direction: ltr; display: flex; flex-wrap: wrap; gap: 10px; }
    .ix-blk { border: 2px solid var(--ok); background: var(--ok-soft); border-radius: 8px; padding: 4px 6px 6px; min-width: 0; max-width: 100%; }
    .ix-blk.bad { border-color: var(--bad); background: var(--bad-soft); }
    .ix-blk-title { font-size: .72rem; font-weight: 700; display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
    .ix-blk-cells { display: flex; flex-wrap: wrap; gap: 2px; }
    .ix-mut { width: 12px; height: 22px; padding: 0; border: 1px solid var(--line-strong); border-radius: 3px; background: var(--surface); cursor: pointer; }
    .ix-mut[aria-pressed="true"] { background: var(--bad); border-color: var(--bad); }
    .ix-mut:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .ix-f { direction: ltr; text-align: left; font-family: var(--mono); font-size: .88rem; overflow-x: auto; }
    .ix-step { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; background: var(--surface); display: grid; gap: 4px; }
    .ix-step.cur { border-color: var(--accent); background: var(--accent-soft); }
    .ix-scroll { overflow-x: auto; max-width: 100%; }
    .ix-m { color: var(--ok); font-weight: 800; }
    .ix-x { color: var(--bad); background: var(--bad-soft); font-weight: 800; }
    .ix-tbl-scroll { max-height: 320px; overflow: auto; }
    .w-table tr.sel td { background: var(--hl-soft); }
    .w-table td.fl { background: var(--accent-soft); font-weight: 800; }
    .w-table tr.sel td.fl { background: var(--hl-soft); outline: 1px solid var(--hl); outline-offset: -1px; }
    .w-table td.mid { color: var(--muted); }
    .w-table td.left, .w-table th.left { text-align: left; }
  `);

  function setPressed(btns, active) { btns.forEach((b, i) => b.setAttribute('aria-pressed', i === active ? 'true' : 'false')); }
  function numField(label, id, value, min, max) {
    const input = h('input', { type: 'number', class: 'mono', id, value, min, max, step: '1', inputmode: 'numeric', style: 'width:7rem' });
    return { input, field: h('label', { class: 'w-field', for: id }, label, input) };
  }

  /* ------------------------------------------------------------- kmer */
  BI.widget('kmer', {
    title: 'k-mer و اصل لانهٔ کبوتری',
    desc: 'در حالت اول یک پنجرهٔ k تایی روی خوانش می‌لغزد و همهٔ k-merها را می‌شمارد. در حالت دوم خوانش را به بلوک‌های جدا از هم می‌شکنیم و می‌بینیم چرا چند جهش نمی‌تواند همهٔ بلوک‌ها را خراب کند.',
    mount(body, opts) {
      const seg1 = h('button', { type: 'button', 'aria-pressed': 'true', text: 'پنجرهٔ k-mer' });
      const seg2 = h('button', { type: 'button', 'aria-pressed': 'false', text: 'اصل لانهٔ کبوتری' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'حالت نمایش' }, seg1, seg2);
      const p1 = h('div', { class: 'w-body', style: 'padding:0' });
      const p2 = h('div', { class: 'w-body', style: 'padding:0', hidden: true });
      body.append(h('div', { class: 'w-controls' }, seg), p1, p2);
      seg1.addEventListener('click', () => { setPressed([seg1, seg2], 0); p1.hidden = false; p2.hidden = true; });
      seg2.addEventListener('click', () => { stop(); setPressed([seg1, seg2], 1); p1.hidden = true; p2.hidden = false; });

      /* mode 1 */
      const idSeq = uid('km-seq'), idK = uid('km-k');
      const inSeq = h('input', { type: 'text', class: 'mono', id: idSeq, value: cleanDna(opts.seq) || 'ACGTACG', spellcheck: 'false', autocomplete: 'off', maxlength: '60' });
      const kf = numField('طول k', idK, String(parseInt(opts.k, 10) || 4), 1, 60);
      const stepBtn = h('button', { class: 'btn primary', type: 'button', text: 'گام بعد' });
      const playBtn = h('button', { class: 'btn', type: 'button', text: 'پخش' });
      const resetBtn = h('button', { class: 'btn ghost', type: 'button', text: 'از نو' });
      const err1 = h('p', { class: 'w-err', hidden: true });
      const cells = h('div', { class: 'ix-cells' });
      const chips = h('div', { class: 'ix-chips' });
      const progress = h('p', { class: 'w-note', style: 'margin:0' });
      const kv1 = h('div', { class: 'w-kv' });
      p1.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idSeq }, 'خوانش (فقط A، C، G، T)', inSeq), kf.field, stepBtn, playBtn, resetBtn),
        err1, cells, progress, h('div', { class: 'w-out' }, h('p', { class: 'ix-h', text: 'k-merهای دیده‌شده (شمارهٔ شروع از ۱)' }), chips), kv1
      );
      const idL = uid('km-l'), idK2 = uid('km-k2');
      const lf = numField('طول خوانش L', idL, '100', 1, 100000);
      const kf2 = numField('طول k', idK2, '20', 1, 100000);
      const calc = h('div', { class: 'w-out' });
      p1.append(h('p', { class: 'ix-h', text: 'ماشین‌حساب تعداد k-mer' }), h('div', { class: 'w-controls' }, lf.field, kf2.field), calc);

      let seq = '', k = 4, pos = 0, timer = null;
      function stop() { if (timer) clearTimeout(timer); timer = null; playBtn.textContent = 'پخش'; }
      function read1() {
        seq = cleanDna(inSeq.value);
        k = parseInt(kf.input.value, 10);
        const bad = badDna(seq);
        let msg = '';
        if (!seq) msg = 'یک خوانش وارد کن.';
        else if (bad.length) msg = `حروف غیرمجاز: ${bad.join('، ')} — فقط A، C، G و T مجاز است.`;
        else if (!(k >= 1)) msg = 'k باید عددی صحیح و دست‌کم ۱ باشد.';
        else if (k > seq.length) msg = `k (${fmt(k)}) از طول خوانش (${fmt(seq.length)}) بیشتر است؛ پنجره جا نمی‌شود.`;
        err1.hidden = !msg; err1.textContent = msg;
        return !msg;
      }
      function render1() {
        if (!read1()) { stop(); cells.innerHTML = ''; chips.innerHTML = ''; kv1.innerHTML = ''; progress.textContent = ''; return; }
        const L = seq.length;
        const all = kmersOf(seq, k);
        const n = all.length;
        pos = Math.max(0, Math.min(pos, n - 1));
        cells.innerHTML = [...seq].map((c, i) => `<span class="ix-cell n${c}${i >= pos && i < pos + k ? ' win' : ''}">${c}<small>${i + 1}</small></span>`).join('');
        const seen = new Set();
        chips.innerHTML = all.slice(0, pos + 1).map((x, i) => {
          const dup = seen.has(x.s); seen.add(x.s);
          return `<span class="pill${i === pos ? ' hl' : ''}">${fmt(x.pos)}: ${colorSeq(x.s)}${dup ? ' (تکرار)' : ''}</span>`;
        }).join('');
        progress.textContent = `پنجرهٔ ${fmt(pos + 1)} از ${fmt(n)}: باز ${fmt(pos + 1)} تا ${fmt(pos + k)}.`;
        kv1.innerHTML = [
          ['طول خوانش L', fmt(L)],
          ['تعداد k-merها L − k + 1', `${fmt(L)} − ${fmt(k)} + ${fmt(1)} = ${fmt(n)}`],
          ['k-merهای متمایز', `${fmt(distinctCount(all))} از ${fmt(n)}`],
        ].map(([a, b]) => `<div><span class="k">${a}</span><span class="v">${b}</span></div>`).join('');
        stepBtn.disabled = pos >= n - 1;
      }
      function tick() {
        if (!body.isConnected || pos >= kmersOf(seq, k).length - 1) { stop(); render1(); return; }
        pos++; render1();
        timer = setTimeout(tick, 700);
      }
      stepBtn.addEventListener('click', () => { stop(); pos++; render1(); });
      playBtn.addEventListener('click', () => {
        if (timer) { stop(); return; }
        if (!read1()) return;
        const n = kmersOf(seq, k).length;
        if (reduced()) { pos = n - 1; render1(); return; }
        if (pos >= n - 1) pos = 0;
        playBtn.textContent = 'توقف';
        render1();
        timer = setTimeout(tick, 600);
      });
      resetBtn.addEventListener('click', () => { stop(); pos = 0; render1(); });
      [inSeq, kf.input].forEach((el) => el.addEventListener('input', () => { stop(); pos = 0; render1(); }));
      function renderCalc() {
        const L = parseInt(lf.input.value, 10), kk = parseInt(kf2.input.value, 10);
        if (!(L >= 1) || !(kk >= 1)) { calc.innerHTML = '<span class="w-err">L و k باید اعداد صحیح مثبت باشند.</span>'; return; }
        const n = kmerCount(L, kk);
        calc.innerHTML = kk > L
          ? `<span class="w-err">k از L بزرگ‌تر است، پس هیچ k-merی وجود ندارد (${fmt(0)}).</span>`
          : `<span class="ix-f" style="display:block">L − k + 1 = ${fmt(L)} − ${fmt(kk)} + ${fmt(1)} = <b>${fmt(n)}</b></span>`;
      }
      [lf.input, kf2.input].forEach((el) => el.addEventListener('input', renderCalc));
      render1();
      renderCalc();

      /* mode 2 */
      const idL2 = uid('pg-l'), idB = uid('pg-b'), idM = uid('pg-m');
      const l2 = numField('طول خوانش L', idL2, '100', 2, 200);
      const bf = numField('تعداد بلوک b', idB, '5', 1, 20);
      const mf = numField('تعداد جهش m', idM, '4', 0, 200);
      const randBtn = h('button', { class: 'btn primary', type: 'button', text: 'جهش تصادفی' });
      const worstBtn = h('button', { class: 'btn', type: 'button', text: 'بدترین حالت' });
      const clearBtn = h('button', { class: 'btn ghost', type: 'button', text: 'پاک کردن' });
      const err2 = h('p', { class: 'w-err', hidden: true });
      const blocksBox = h('div', { class: 'ix-blocks' });
      const msg2 = h('div', { class: 'w-out' });
      const kv2 = h('div', { class: 'w-kv' });
      p2.append(
        h('div', { class: 'w-controls' }, l2.field, bf.field, mf.field, randBtn, worstBtn, clearBtn),
        err2,
        h('p', { class: 'w-note', style: 'margin:0', text: 'روی هر خانه بزن تا یک جهش (جانشینی) در آن باز ثبت یا برداشته شود. قاب سبز یعنی بلوک سالم، قاب قرمز یعنی بلوک شکسته.' }),
        blocksBox, kv2, msg2
      );
      let muts = new Set();
      function read2() {
        const L = parseInt(l2.input.value, 10), b = parseInt(bf.input.value, 10), m = parseInt(mf.input.value, 10);
        let msg = '';
        if (!(L >= 2 && L <= 200)) msg = 'L باید عددی صحیح بین ۲ و ۲۰۰ باشد.';
        else if (!(b >= 1 && b <= 20)) msg = 'تعداد بلوک‌ها باید عددی صحیح بین ۱ و ۲۰ باشد.';
        else if (b > L) msg = 'تعداد بلوک‌ها نمی‌تواند از طول خوانش بیشتر باشد.';
        else if (!(m >= 0 && m <= L)) msg = 'تعداد جهش باید عددی صحیح بین ۰ و L باشد.';
        err2.hidden = !msg; err2.textContent = msg;
        return msg ? null : { L, b, m };
      }
      function render2() {
        const v = read2();
        if (!v) { blocksBox.innerHTML = ''; kv2.innerHTML = ''; msg2.innerHTML = ''; return; }
        const { L, b } = v;
        muts = new Set([...muts].filter((i) => i < L));
        const ranges = blockRanges(L, b);
        const status = blockStatus(ranges, muts);
        blocksBox.replaceChildren();
        ranges.forEach(([a, z], j) => {
          const blk = h('div', { class: 'ix-blk' + (status[j] ? ' bad' : '') });
          blk.append(h('div', { class: 'ix-blk-title' }, h('span', { text: `بلوک ${fmt(j + 1)}` }), h('span', { text: status[j] ? 'شکسته' : 'سالم' })));
          const row = h('div', { class: 'ix-blk-cells' });
          for (let i = a; i < z; i++) {
            const on = muts.has(i);
            row.append(h('button', {
              type: 'button', class: 'ix-mut', 'aria-pressed': on ? 'true' : 'false', title: `باز ${fa(i + 1)}`,
              'aria-label': `باز ${fa(i + 1)}، ${on ? 'جهش‌یافته' : 'سالم'}`,
              onclick: () => { if (muts.has(i)) muts.delete(i); else muts.add(i); render2(); },
            }));
          }
          blk.append(row);
          blocksBox.append(blk);
        });
        const nm = muts.size;
        const broken = status.filter((x) => x > 0).length;
        const intact = b - broken;
        const size = Math.floor(L / b);
        kv2.innerHTML = [
          ['طول بلوک‌ها', L % b ? `حدود ${fmt(size)} باز` : `${fmt(L)} ÷ ${fmt(b)} = ${fmt(size)} باز`],
          ['جهش‌های ثبت‌شده', fmt(nm)],
          ['بلوک سالم / شکسته', `${fmt(intact)} / ${fmt(broken)}`],
        ].map(([a, c]) => `<div><span class="k">${a}</span><span class="v">${c}</span></div>`).join('');
        let text;
        if (nm < b) {
          text = `<b>${fmt(nm)} جهش و ${fmt(b)} بلوک:</b> هر جهش فقط یک بلوک را خراب می‌کند، پس دست‌کم ${fmt(b)} − ${fmt(nm)} = ${fmt(b - nm)} بلوک سالم می‌ماند (اصل لانهٔ کبوتری). جستجوی دقیق (exact) همان بلوک سالم، ناحیهٔ خوانش را روی ژنوم پیدا می‌کند و بعد می‌شود خوانش کامل را با جهش‌ها هم‌تراز کرد. هر چقدر جهش‌ها را جابه‌جا کنی، این تضمین برقرار است.`;
        } else if (intact > 0) {
          text = `<b>${fmt(nm)} جهش و ${fmt(b)} بلوک:</b> جهش‌ها از بلوک‌ها کم‌تر نیستند، پس دیگر تضمینی وجود ندارد. این بار شانس آوردی و ${fmt(intact)} بلوک سالم ماند، ولی با «بدترین حالت» (یک جهش در هر بلوک) همهٔ بلوک‌ها می‌شکنند و جستجوی دقیق هیچ بلوکی را پیدا نمی‌کند.`;
        } else {
          text = `<b>${fmt(nm)} جهش و ${fmt(b)} بلوک:</b> همهٔ بلوک‌ها دست‌کم یک جهش دارند، پس جستجوی دقیق هیچ بلوکی شکست می‌خورد. وقتی m ≥ b است این اتفاق ممکن است؛ برای تحمل m جهش باید دست‌کم m + ۱ بلوک بسازی.`;
        }
        msg2.innerHTML = `<p style="margin:0">${text}</p>`;
      }
      randBtn.addEventListener('click', () => { const v = read2(); if (!v) return; muts = randomMuts(v.L, v.m, Math.random); render2(); });
      worstBtn.addEventListener('click', () => { const v = read2(); if (!v) return; muts = worstCase(v.L, v.b, v.m, Math.random); render2(); });
      clearBtn.addEventListener('click', () => { muts = new Set(); render2(); });
      [l2.input, bf.input, mf.input].forEach((el) => el.addEventListener('input', render2));
      muts = new Set([5, 27, 52, 78]);
      render2();
    },
  });

  /* ------------------------------------------------------- hash-index */
  BI.widget('hash-index', {
    title: 'شاخص هش k-mer',
    desc: 'برای هر k-mer مرجع، جایگاه‌هایش را در یک جدول ذخیره می‌کنیم. بعد خوانش را به k-mer می‌شکنیم، هر کدام را پیدا می‌کنیم و هر برخورد یک رأی برای محل شروع خوانش می‌شود. در خوانش یک جهش بگذار تا ببینی k-merهای سالم هنوز رأی می‌دهند.',
    mount(body, opts) {
      const idRef = uid('hx-ref'), idK = uid('hx-k'), idRead = uid('hx-read');
      const inRef = h('input', { type: 'text', class: 'mono', id: idRef, value: cleanDna(opts.ref) || 'ACGTACGTTACGATCGTACG', spellcheck: 'false', autocomplete: 'off', maxlength: '120' });
      const kf = numField('طول k', idK, String(parseInt(opts.k, 10) || 4), 1, 12);
      const inRead = h('input', { type: 'text', class: 'mono', id: idRead, value: cleanDna(opts.read) || 'TACGATCG', spellcheck: 'false', autocomplete: 'off', maxlength: '60' });
      const s1 = h('button', { type: 'button', 'aria-pressed': 'true', text: 'همپوشان' });
      const s2 = h('button', { type: 'button', 'aria-pressed': 'false', text: 'غیرهمپوشان' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'روش شکستن خوانش' }, s1, s2);
      let step1 = true;
      const err = h('p', { class: 'w-err', hidden: true });
      const idxOut = h('div', { class: 'w-out' });
      const lookOut = h('div', { class: 'w-out' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idRef }, 'مرجع (فقط A، C، G، T؛ حداکثر ۱۲۰ باز)', inRef), kf.field),
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idRead }, 'خوانش (می‌توانی یک حرف را عوض کنی تا جهش بسازی)', inRead),
          h('div', { class: 'w-field' }, h('span', { text: 'k-merهای خوانش' }), seg)),
        err,
        h('p', { class: 'ix-h', text: '۱) ساخت شاخص: هر k-mer مرجع با جایگاه‌های شروعش (شمارهٔ ۱ به بعد)' }), idxOut,
        h('p', { class: 'ix-h', text: '۲) جستجوی خوانش: هر k-mer، برخوردها و رأی‌گیری' }), lookOut
      );
      setPressed([s1, s2], 0);
      s1.addEventListener('click', () => { step1 = true; setPressed([s1, s2], 0); run(); });
      s2.addEventListener('click', () => { step1 = false; setPressed([s1, s2], 1); run(); });
      [inRef, kf.input, inRead].forEach((el) => el.addEventListener('input', run));

      function seqView(ref, read, start) {
        const off = start - 1;
        const refLine = [...ref].map((c, i) => (i >= off && i < off + read.length ? (c === read[i - off] ? `<span class="ix-m">${c}</span>` : `<span class="ix-x">${c}</span>`) : c)).join('');
        const markLine = [...ref].map((_, i) => (i >= off && i < off + read.length ? (ref[i] === read[i - off] ? '|' : 'x') : ' ')).join('');
        const readLine = ' '.repeat(off) + [...read].map((c, i) => (c === ref[off + i] ? `<span class="ix-m">${c}</span>` : `<span class="ix-x">${c}</span>`)).join('');
        return `<div class="ix-scroll"><span class="w-seq">${'ref  '}${refLine}\n${'     '}${markLine}\n${'read '}${readLine}</span></div>`;
      }

      function run() {
        const ref = cleanDna(inRef.value), read = cleanDna(inRead.value), k = parseInt(kf.input.value, 10);
        const bad = badDna(ref + read);
        let msg = '';
        if (!ref) msg = 'یک توالی مرجع وارد کن.';
        else if (!read) msg = 'یک خوانش وارد کن.';
        else if (bad.length) msg = `حروف غیرمجاز: ${bad.join('، ')} — فقط A، C، G و T مجاز است.`;
        else if (!(k >= 1 && k <= 12)) msg = 'k باید عددی صحیح بین ۱ و ۱۲ باشد.';
        else if (k > ref.length) msg = 'k از طول مرجع بیشتر است.';
        else if (k > read.length) msg = 'k از طول خوانش بیشتر است؛ هیچ k-merی از خوانش درنمی‌آید.';
        else if (read.length > ref.length) msg = 'خوانش نباید از مرجع بلندتر باشد.';
        err.hidden = !msg; err.textContent = msg;
        if (msg) { idxOut.innerHTML = ''; lookOut.innerHTML = ''; return; }

        const index = buildIndex(ref, k);
        const keys = [...index.keys()].sort();
        const total = ref.length - k + 1;
        const repeats = keys.filter((s) => index.get(s).length > 1).length;
        const first = ref.substr(0, k);
        const terms = [...first].map((c, i) => `${DIGIT[c]}×4<sup>${k - 1 - i}</sup>`).join(' + ');
        idxOut.innerHTML = `
          <p class="w-note" style="margin-top:0">کلید عددی: A=0، C=1، G=2، T=3 و k-mer را عددی در مبنای ۴ می‌خوانیم. برای مثال <span class="ltr">${esc(first)} = ${terms} = <b>${encode(first)}</b></span>. این کار یک هش کامل است: هر k-mer کلید یکتا دارد و برخوردی پیش نمی‌آید، چون ${fmt(4)}<sup>${fmt(k)}</sup> = ${fmt(Math.pow(4, k))} کلید ممکن داریم.</p>
          <div class="w-kv" style="margin-bottom:8px"><div><span class="k">k-merها در مرجع</span><span class="v">${fmt(ref.length)} − ${fmt(k)} + ${fmt(1)} = ${fmt(total)}</span></div><div><span class="k">k-merهای متمایز</span><span class="v">${fmt(keys.length)}</span></div><div><span class="k">k-merهای تکراری</span><span class="v">${fmt(repeats)}</span></div></div>
          <div class="ix-tbl-scroll"><table class="w-table"><thead><tr><th>k-mer</th><th>کلید عددی</th><th>جایگاه‌ها</th><th></th></tr></thead><tbody>${keys.map((s) => {
    const ps = index.get(s), rep = ps.length > 1;
    return `<tr><td>${colorSeq(s)}</td><td>${encode(s)}</td><td class="${rep ? 'hit' : ''}">${ps.join(', ')}</td><td>${rep ? `<span class="pill hl">تکراری ×${fmt(ps.length)}</span>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>
          ${repeats ? '<p class="w-note" style="margin-bottom:0">k-merهای تکراری مشکل «تکرارها» را نشان می‌دهند: یک k-mer می‌تواند از چند جای ژنوم آمده باشد، پس یک برخورد به‌تنهایی محل خوانش را مشخص نمی‌کند و باید رأی‌ها را جمع کرد.</p>' : ''}`;

        const res = lookupRead(ref, read, index, k, step1 ? 1 : k);
        const { lookups, ranked, outside } = res;
        const best = ranked[0];
        let html = `<p class="w-note" style="margin-top:0">خوانش <span class="ltr">${colorSeq(read)}</span> به ${fmt(lookups.length)} k-mer ${step1 ? 'همپوشان' : 'غیرهمپوشان'} شکسته شد. اگر k-mer شمارهٔ o (از صفر) در جایگاه p مرجع پیدا شود، خوانش از <span class="ltr">p − o</span> شروع می‌شود.</p>
          <div class="ix-scroll"><table class="w-table"><thead><tr><th>o</th><th>k-mer</th><th>کلید</th><th>جایگاه p</th><th>شروع p − o</th></tr></thead><tbody>${lookups.map((lk) => `<tr><td>${lk.o}</td><td>${colorSeq(lk.s)}</td><td>${encode(lk.s)}</td><td>${lk.hits.length ? lk.hits.join(', ') : '<span class="pill bad">پیدا نشد</span>'}</td><td class="${lk.hits.length ? 'hit' : ''}">${lk.hits.length ? lk.cands.map((c, i) => (lk.valid[i] ? c : `<s>${c}</s>`)).join(', ') : '—'}</td></tr>`).join('')}</tbody></table></div>`;
        if (outside) html += `<p class="w-note">شروع‌های خط‌خورده بیرون از مرجع می‌افتند (خوانش جا نمی‌شود) و رأی حساب نمی‌شوند.</p>`;
        if (!best) {
          html += '<p><span class="pill bad">هیچ رأی معتبری نیست</span> هیچ k-merی از خوانش در مرجع پیدا نشد یا همهٔ برخوردها بیرون از مرجع‌اند؛ خوانش را اینجا نمی‌شود جای داد.</p>';
        } else {
          html += `<p class="ix-h" style="margin-top:12px">رأی‌ها و راستی‌آزمایی (شمارش ناهمخوانی با مقایسهٔ مستقیم)</p>
            <div class="ix-scroll"><table class="w-table"><thead><tr><th>شروع</th><th>رأی</th><th>ناهمخوانی</th></tr></thead><tbody>${ranked.map((r, i) => `<tr><td${i === 0 ? ' class="path"' : ''}>${r.start}</td><td>${'■'.repeat(r.votes)} ${r.votes}</td><td>${r.mism}</td></tr>`).join('')}</tbody></table></div>
            <p style="margin:10px 0 6px"><b>بهترین نامزد:</b> شروع از <span class="ltr"><b>${best.start}</b></span> با ${fmt(best.votes)} رأی از ${fmt(lookups.length)} k-mer؛ ${best.mism === 0 ? `<span class="pill ok">${fmt(0)} ناهمخوانی؛ تطابق کامل</span>` : `<span class="pill hl">${fmt(best.mism)} ناهمخوانی</span>`}</p>
            ${seqView(ref, read, best.start)}
            <p class="w-note" style="margin-bottom:0">حرف سبز یعنی همخوان و حرف قرمز یعنی ناهمخوان. رأی‌گیری فقط نامزد می‌سازد؛ راستی‌آزمایی با مقایسهٔ مستقیم تصمیم نهایی را می‌گیرد.${ranked.length > 1 && ranked[1].votes === best.votes ? ' چند نامزد رأی برابر دارند؛ کوچک‌ترین شروع نمایش داده شد.' : ''}</p>`;
        }
        lookOut.innerHTML = html;
      }
      run();
    },
  });

  /* ------------------------------------------------------------- trie */
  BI.widget('trie', {
    title: 'درخت پیشوندی (Trie)',
    desc: 'کلمه‌ها را با ویرگول جدا کن تا درخت ساخته شود. پیشوندهای مشترک فقط یک بار ذخیره می‌شوند. یک الگو بنویس تا مسیرش در درخت روشن شود.',
    mount(body, opts) {
      const idW = uid('tr-w'), idP = uid('tr-p');
      const inW = h('input', { type: 'text', class: 'mono', id: idW, value: opts.words || 'ACG,ACT,AGT', spellcheck: 'false', autocomplete: 'off' });
      const inP = h('input', { type: 'text', class: 'mono', id: idP, value: 'AC', spellcheck: 'false', autocomplete: 'off', maxlength: '20' });
      const err = h('p', { class: 'w-err', hidden: true });
      const svgBox = h('div', { class: 'w-out' });
      const result = h('div', { class: 'w-out' });
      const kv = h('div', { class: 'w-kv' });
      const note = h('p', { class: 'w-note', style: 'margin:0' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idW }, 'کلمه‌ها (با ویرگول جدا کن؛ حداکثر ۸ کلمه با طول ۸)', inW)),
        err, svgBox,
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idP }, 'الگوی جستجو', inP)),
        result, kv, note
      );
      let trie = null, parsed = null;

      function parseWords() {
        const list = inW.value.split(/[,،]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
        const uniq = [...new Set(list)];
        let msg = '';
        if (!uniq.length) msg = 'دست‌کم یک کلمه وارد کن.';
        else if (uniq.some((w) => !/^[A-Z0-9]+$/.test(w))) msg = 'کلمه‌ها فقط می‌توانند حرف لاتین یا رقم داشته باشند و باید با ویرگول جدا شوند.';
        else if (uniq.length > 8) msg = 'برای خوانا ماندن درخت، حداکثر ۸ کلمه بنویس.';
        else if (uniq.some((w) => w.length > 8)) msg = 'هر کلمه حداکثر ۸ نویسه باشد.';
        err.hidden = !msg; err.textContent = msg;
        return msg ? null : uniq;
      }

      function draw(path) {
        const lay = layoutTrie(trie.root);
        const XG = 58, YG = 66, M = 34;
        const W = Math.max(200, (lay.leaves - 1) * XG + 2 * M), H = lay.maxDepth * YG + 2 * M;
        const px = (n) => M + n.x * XG + (W - 2 * M - (lay.leaves - 1) * XG) / 2;
        const py = (n) => M + n.depth * YG;
        const onPath = new Set(path);
        const edges = [], labels = [], nodes = [];
        const tid = uid('trie-t');
        (function rec(n) {
          for (const c of sortedChildren(n)) {
            const hot = onPath.has(c) && onPath.has(n);
            const x1 = px(n), y1 = py(n), x2 = px(c), y2 = py(c);
            edges.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${hot ? 's-hl' : 's-muted'}" stroke-width="${hot ? 3.5 : 1.6}"/>`);
            const mx = (x1 + x2) / 2 + (x2 < x1 ? -11 : 11), my = (y1 + y2) / 2;
            labels.push(`<rect x="${mx - 8}" y="${my - 9}" width="16" height="18" rx="4" class="f-surface"/><text x="${mx}" y="${my + 5}" text-anchor="middle" class="mono${hot ? ' t-hl' : ''}" font-size="14" font-weight="700">${esc(c.ch)}</text>`);
            rec(c);
          }
        })(trie.root);
        (function rec(n) {
          const hot = onPath.has(n);
          const r = n === trie.root ? 18 : 13;
          const x = px(n), y = py(n);
          nodes.push(`<g><title>${n === trie.root ? 'ریشه' : esc(n.prefix)}${n.end ? ' (پایان کلمه)' : ''}</title>
            ${n.end ? `<circle cx="${x}" cy="${y}" r="${r + 5}" class="f-none ${hot ? 's-hl' : 's-ink-2'}" stroke-width="2"/>` : ''}
            <circle cx="${x}" cy="${y}" r="${r}" class="${hot ? 'f-hl-soft s-hl' : 'f-surface-2 s-ink-2'}" stroke-width="2"/>
            ${n === trie.root ? `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" style="direction:rtl">ریشه</text>` : ''}</g>`);
          sortedChildren(n).forEach(rec);
        })(trie.root);
        svgBox.innerHTML = `<div class="ix-scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${tid}" style="direction:ltr"><title id="${tid}">درخت پیشوندی کلمه‌ها؛ هر یال یک حرف است و گره‌های دایرهٔ دوتایی پایان یک کلمه‌اند</title>${edges.join('')}${labels.join('')}${nodes.join('')}</svg></div>
          <p class="w-note" style="margin:6px 0 0">هر یال یک حرف است؛ دایرهٔ دوتایی یعنی یک کلمه همین‌جا تمام می‌شود.</p>`;
      }

      function search() {
        if (!trie) return;
        const raw = inP.value.trim().toUpperCase();
        if (!raw) { draw([trie.root]); result.innerHTML = '<span class="w-note">یک الگو بنویس تا مسیرش در درخت دنبال شود.</span>'; return; }
        if (!/^[A-Z0-9]+$/.test(raw)) { draw([trie.root]); result.innerHTML = '<span class="w-err">الگو فقط می‌تواند حرف لاتین یا رقم داشته باشد.</span>'; return; }
        const w = trieWalk(trie.root, raw);
        draw(w.path);
        if (w.complete && w.node.end) {
          const more = wordsUnder(w.node).filter((x) => x !== raw);
          result.innerHTML = `<span class="pill ok">کلمهٔ کامل پیدا شد</span> مسیر <span class="ltr">${colorSeq(raw)}</span> به یک گرهٔ پایان کلمه رسید.${more.length ? ` این کلمه پیشوند ${more.map((x) => `<span class="ltr">${colorSeq(x)}</span>`).join('، ')} هم هست.` : ''}`;
        } else if (w.complete) {
          const ws = wordsUnder(w.node);
          result.innerHTML = `<span class="pill hl">فقط پیشوند است</span> فقط پیشوند است؛ کلمه‌های با این پیشوند: ${ws.map((x) => `<span class="ltr">${colorSeq(x)}</span>`).join('، ')}`;
        } else {
          const cut = raw.slice(0, w.matched + 1);
          result.innerHTML = `<span class="pill bad">پیدا نشد</span> پیدا نشد؛ مسیر در <span class="ltr"><b>${esc(cut)}</b></span> قطع شد${w.matched ? ` (از گرهٔ <span class="ltr">${esc(raw.slice(0, w.matched))}</span> یالی با حرف <span class="ltr">${esc(raw[w.matched])}</span> بیرون نمی‌آید)` : ` (ریشه یالی با حرف <span class="ltr">${esc(raw[0])}</span> ندارد)`}.`;
        }
      }

      function build() {
        const words = parseWords();
        if (!words) { svgBox.innerHTML = ''; result.innerHTML = ''; kv.innerHTML = ''; note.textContent = ''; trie = null; return; }
        parsed = words;
        trie = buildTrie(words);
        kv.innerHTML = [
          ['مجموع نویسه‌های کلمه‌ها', fmt(trie.chars)],
          ['گره‌ها (جز ریشه)', fmt(trie.nodes)],
          ['صرفه‌جویی با پیشوند مشترک', `${fmt(trie.chars)} − ${fmt(trie.nodes)} = ${fmt(trie.chars - trie.nodes)}`],
        ].map(([a, b]) => `<div><span class="k">${a}</span><span class="v">${b}</span></div>`).join('');
        note.textContent = 'اگر همهٔ زیررشته‌های یک ژنوم سه‌میلیارد حرفی را در چنین درختی بریزیم، تعداد گره‌ها آن‌قدر زیاد می‌شود که در هیچ حافظه‌ای جا نمی‌گیرد. برای همین سراغ ساختارهای فشرده‌تر مثل BWT می‌رویم.';
        search();
      }
      inW.addEventListener('input', build);
      inP.addEventListener('input', search);
      build();
    },
  });

  /* -------------------------------------------------------------- bwt */
  BI.widget('bwt', {
    title: 'BWT و جستجوی پس‌رو',
    desc: 'متن را بنویس تا همهٔ چرخش‌ها، ماتریس مرتب‌شده، BWT و جدول‌های C و Occ ساخته شوند. بعد الگو را حرف‌به‌حرف از آخر به اول جستجو کن و ببین بازهٔ [sp, ep) چطور تنگ می‌شود.',
    mount(body, opts) {
      const idT = uid('bw-t'), idP = uid('bw-p');
      const inT = h('input', { type: 'text', class: 'mono', id: idT, value: opts.text || 'BANANA', spellcheck: 'false', autocomplete: 'off', maxlength: '41' });
      const inP = h('input', { type: 'text', class: 'mono', id: idP, value: opts.pattern || 'NAN', spellcheck: 'false', autocomplete: 'off', maxlength: '20' });
      const err = h('p', { class: 'w-err', hidden: true });
      const rotBox = h('div', { class: 'w-out' });
      const matBox = h('div', { class: 'w-out' });
      const cBox = h('div', { class: 'w-out' });
      const occBox = h('div', { class: 'w-out' });
      const searchBox = h('div');
      const nextBtn = h('button', { class: 'btn primary', type: 'button', text: 'گام بعد' });
      const allBtn = h('button', { class: 'btn', type: 'button', text: 'همه' });
      const resetBtn = h('button', { class: 'btn ghost', type: 'button', text: 'از نو' });
      const stepsBox = h('div', { style: 'display:grid;gap:8px' });
      const finalBox = h('div', { class: 'w-out' });
      const textBox = h('div', { class: 'ix-cells' });
      const secSearch = h('div', { style: 'display:grid;gap:10px' },
        h('p', { class: 'ix-h', text: '۵) جستجوی پس‌رو' }),
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idP }, 'الگو (حروف کوچک و بزرگ فرق دارند)', inP), nextBtn, allBtn, resetBtn),
        stepsBox, finalBox, textBox,
        h('p', { class: 'w-note', style: 'margin:0', text: 'تعداد گام‌ها برابر طول الگوست و به طول متن بستگی ندارد؛ جدول‌ها یک بار ساخته می‌شوند و هر گام فقط چهار جمع و دو جست‌وجوی جدولی است.' })
      );
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: idT }, 'متن ($ را خودکار در انتها اضافه می‌کنم)', inT)),
        err,
        h('p', { class: 'ix-h', text: '۱) همهٔ چرخش‌ها به ترتیب اصلی' }), rotBox,
        h('p', { class: 'ix-h', text: '۲) ماتریس مرتب‌شده، ستون F و ستون L، و BWT' }), matBox,
        h('p', { class: 'ix-h', text: '۳) جدول C: تعداد نویسه‌های کوچک‌تر از c در متن' }), cBox,
        h('p', { class: 'ix-h', text: '۴) جدول Occ(c, i): تعداد c در L[0..i−1]' }), occBox,
        secSearch
      );

      let info = null, pattern = '', res = null, shown = 0;

      function interval() {
        if (!res) return [0, info.n];
        if (shown === 0) return [0, info.n];
        const st = res.steps[shown - 1];
        return [st.sp2, st.ep2];
      }

      function drawMatrix() {
        const [sp, ep] = interval();
        matBox.innerHTML = `<table class="w-table"><thead><tr><th>row</th><th>F</th><th>میانه</th><th>L</th><th>SA</th></tr></thead><tbody>${info.rows.map((r, i) => `<tr class="${i >= sp && i < ep ? 'sel' : ''}"><td>${i}</td><td class="fl">${esc(r.rot[0])}</td><td class="mid">${esc(r.rot.slice(1, info.n - 1))}</td><td class="fl">${esc(r.rot[info.n - 1])}</td><td>${r.sa}</td></tr>`).join('')}</tbody></table>
          <p class="w-note" style="margin:8px 0 0"><span class="ltr">BWT = L = <b>${esc(info.bwt)}</b></span> — ستون F همان نویسه‌های مرتب‌شده است و ستون L نویسهٔ پیش از هر پسوند (آخرین نویسهٔ هر چرخش). ${sp < ep && res ? `ردیف‌های رنگی بازهٔ <span class="ltr">[${sp}, ${ep})</span> هستند.` : ''}</p>`;
      }

      function drawOcc() {
        let cur = null;
        if (res && shown > 0) { const st = res.steps[shown - 1]; if (!st.missing) cur = st; }
        const head = `<tr><th class="left">i</th>${Array.from({ length: info.n + 1 }, (_, i) => `<th>${i}</th>`).join('')}</tr><tr><th class="left">L[i−1]</th><td></td>${info.L.map((c) => `<td class="fl">${esc(c)}</td>`).join('')}</tr>`;
        const rows = info.symbols.map((c) => `<tr><th class="left">Occ(${esc(c)}, i)</th>${info.occ.get(c).map((v, i) => `<td class="${cur && cur.c === c && (i === cur.sp || i === cur.ep) ? 'path' : ''}">${v}</td>`).join('')}</tr>`).join('');
        occBox.innerHTML = `<table class="w-table"><thead>${head}</thead><tbody>${rows}</tbody></table>${cur ? '<p class="w-note" style="margin:8px 0 0">دو خانهٔ رنگی همان مقادیر Occ هستند که گام جاری استفاده کرد.</p>' : ''}`;
      }

      function drawSteps() {
        const parts = [];
        for (let i = 0; i < shown; i++) {
          const st = res.steps[i];
          const suffix = pattern.slice(st.idx);
          let inner;
          if (st.missing) {
            inner = `<div>حرف <span class="ltr"><b>${esc(st.c)}</b></span> در متن نیست، پس C[${esc(st.c)}] وجود ندارد و بازه تهی می‌شود.</div>`;
          } else {
            inner = `<div class="ix-f">sp′ = C[${esc(st.c)}] + Occ(${esc(st.c)}, ${st.sp}) = ${st.cc} + ${st.o1} = <b>${st.sp2}</b></div>
              <div class="ix-f">ep′ = C[${esc(st.c)}] + Occ(${esc(st.c)}, ${st.ep}) = ${st.cc} + ${st.o2} = <b>${st.ep2}</b></div>
              <div>بازهٔ جدید: <span class="ltr"><b>[${st.sp2}, ${st.ep2})</b></span> — ${fmt(Math.max(0, st.ep2 - st.sp2))} ردیف</div>`;
          }
          parts.push(`<div class="ix-step${i === shown - 1 ? ' cur' : ''}"><div><b>گام ${fmt(i + 1)}</b> — حرف <span class="ltr"><b>${esc(st.c)}</b></span>؛ پسوند الگو تا اینجا: <span class="ltr"><b>${esc(suffix)}</b></span>؛ بازهٔ قبلی <span class="ltr">[${st.sp}, ${st.ep})</span></div>${inner}</div>`);
        }
        if (!shown) parts.push(`<div class="ix-step"><div>شروع: بازهٔ کل ردیف‌ها <span class="ltr"><b>[sp, ep) = [0, ${info.n})</b></span>. الگو را از آخرین حرفش پردازش می‌کنیم.</div></div>`);
        stepsBox.innerHTML = parts.join('');
      }

      function drawFinal() {
        const done = res && (shown >= res.steps.length);
        let hlText = new Set();
        if (!done) { finalBox.hidden = true; }
        else {
          finalBox.hidden = false;
          if (res.found) {
            const { sp, ep, positions } = res;
            positions.forEach((p) => { for (let j = 0; j < pattern.length; j++) hlText.add(p + j); });
            finalBox.innerHTML = `<span class="pill ok">پیدا شد</span> <span class="ltr">تعداد = ep − sp = ${ep} − ${sp} = <b>${ep - sp}</b></span>؛ جایگاه‌ها (۰-مبنا) <span class="ltr">SA[${sp}..${ep - 1}] = <b>${positions.join(', ')}</b></span>.`;
          } else {
            const last = res.steps[res.steps.length - 1];
            finalBox.innerHTML = `<span class="pill bad">الگو در متن نیست</span> ${last.missing ? '' : `<span class="ltr">sp = ${last.sp2} ≥ ep = ${last.ep2}</span>، یعنی بازه تهی شد.`}`;
          }
        }
        textBox.hidden = !done || !res.found;
        textBox.innerHTML = [...info.text].map((c, i) => `<span class="ix-cell${hlText.has(i) ? ' hl' : ''}">${esc(c)}<small>${i}</small></span>`).join('');
      }

      function drawSearch() {
        drawMatrix(); drawOcc(); drawSteps(); drawFinal();
        const done = !res || shown >= res.steps.length;
        nextBtn.disabled = done; allBtn.disabled = done;
      }

      function setupSearch() {
        pattern = inP.value.replace(/\s+/g, '');
        shown = 0;
        res = null;
        if (!pattern) { stepsBox.innerHTML = '<p class="w-note" style="margin:0">یک الگو بنویس.</p>'; finalBox.hidden = true; textBox.hidden = true; nextBtn.disabled = true; allBtn.disabled = true; drawMatrix(); drawOcc(); return; }
        if (pattern.includes('$')) { err.hidden = false; err.textContent = 'الگو نباید علامت $ داشته باشد.'; stepsBox.innerHTML = ''; finalBox.hidden = true; textBox.hidden = true; nextBtn.disabled = true; allBtn.disabled = true; drawMatrix(); drawOcc(); return; }
        res = backwardSearch(info, pattern);
        drawSearch();
      }

      function build() {
        const norm = normalizeText(inT.value);
        err.hidden = !norm.error; err.textContent = norm.error || '';
        if (norm.error) { info = null; [rotBox, matBox, cBox, occBox, stepsBox, finalBox, textBox].forEach((b) => (b.innerHTML = '')); secSearch.hidden = true; return; }
        secSearch.hidden = false;
        info = buildBwt(norm.text);
        info.text = norm.text;
        rotBox.innerHTML = `<div class="ix-scroll"><table class="w-table"><thead><tr><th>i</th><th>چرخش</th></tr></thead><tbody>${info.rots.map((r) => `<tr><td>${r.sa}</td><td class="left">${esc(r.rot)}</td></tr>`).join('')}</tbody></table></div>
          <p class="w-note" style="margin:8px 0 0">چرخش i یعنی متن از نویسهٔ i شروع شود و بعد از $ به ابتدا برگردد. چون $ کوچک‌ترین نویسه است و فقط یک‌بار می‌آید، مرتب‌کردن چرخش‌ها همان مرتب‌کردن پسوندهاست.</p>`;
        cBox.innerHTML = `<table class="w-table"><thead><tr><th>c</th>${info.symbols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody><tr><th>C[c]</th>${info.symbols.map((c) => `<td>${info.C.get(c)}</td>`).join('')}</tr></tbody></table>
          <p class="w-note" style="margin:8px 0 0">C[c] نخستین ردیفی است که با c شروع می‌شود (ستون F). ترتیب: $ اول و بقیه بر اساس کد نویسه.</p>`;
        setupSearch();
      }

      nextBtn.addEventListener('click', () => { if (res && shown < res.steps.length) { shown++; drawSearch(); } });
      allBtn.addEventListener('click', () => { if (res) { shown = res.steps.length; drawSearch(); } });
      resetBtn.addEventListener('click', () => { shown = 0; if (res) drawSearch(); });
      inT.addEventListener('input', build);
      inP.addEventListener('input', () => { if (!info) return; err.hidden = true; const t = normalizeText(inT.value); if (t.error) { err.hidden = false; err.textContent = t.error; return; } setupSearch(); });
      build();
    },
  });
})();
