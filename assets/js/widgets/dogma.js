/* widgets/dogma.js — central dogma: transcription/translation, codon table, reading frames, splicing, locations */
(() => {
  'use strict';
  const { h, fa, esc } = BI;

  /* ====================== pure core (no DOM) ====================== */
  const BASE_ORDER = 'UCAG';
  const AA_STRING = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const CODON_AA = {};
  for (let i = 0; i < 64; i++) CODON_AA[BASE_ORDER[i >> 4] + BASE_ORDER[(i >> 2) & 3] + BASE_ORDER[i & 3]] = AA_STRING[i];

  const AA = {
    A: ['Ala', 'Alanine', 'آلانین', 'np'],
    R: ['Arg', 'Arginine', 'آرژینین', 'ba'],
    N: ['Asn', 'Asparagine', 'آسپاراژین', 'po'],
    D: ['Asp', 'Aspartic acid', 'آسپارتیک‌اسید', 'ac'],
    C: ['Cys', 'Cysteine', 'سیستئین', 'po'],
    E: ['Glu', 'Glutamic acid', 'گلوتامیک‌اسید', 'ac'],
    Q: ['Gln', 'Glutamine', 'گلوتامین', 'po'],
    G: ['Gly', 'Glycine', 'گلیسین', 'np'],
    H: ['His', 'Histidine', 'هیستیدین', 'ba'],
    I: ['Ile', 'Isoleucine', 'ایزولوسین', 'np'],
    L: ['Leu', 'Leucine', 'لوسین', 'np'],
    K: ['Lys', 'Lysine', 'لیزین', 'ba'],
    M: ['Met', 'Methionine', 'متیونین', 'np'],
    F: ['Phe', 'Phenylalanine', 'فنیل‌آلانین', 'np'],
    P: ['Pro', 'Proline', 'پرولین', 'np'],
    S: ['Ser', 'Serine', 'سرین', 'po'],
    T: ['Thr', 'Threonine', 'ترئونین', 'po'],
    W: ['Trp', 'Tryptophan', 'تریپتوفان', 'np'],
    Y: ['Tyr', 'Tyrosine', 'تیروزین', 'po'],
    V: ['Val', 'Valine', 'والین', 'np'],
    '*': ['Stop', 'Stop', 'کدون پایان', 'st'],
  };
  const aaInfo = (l) => { const a = AA[l]; return { one: l, three: a[0], en: a[1], fa: a[2], cls: a[3] }; };
  const CLASS_FA = { np: 'غیرقطبی (آبگریز)', po: 'قطبی بدون بار', ac: 'اسیدی (بار منفی −)', ba: 'بازی (بار مثبت +)', st: 'کدون پایان' };

  const COMPL = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const COMPL_RNA = { A: 'U', U: 'A', G: 'C', C: 'G' };
  const cleanDna = (s) => String(s || '').toUpperCase().replace(/[\s\-′'’‵0-9]/g, '');
  const badLetters = (s) => [...new Set([...s].filter((b) => !'ACGT'.includes(b)))];
  const compDna = (s) => [...s].map((b) => COMPL[b]).join('');
  const revcompDna = (s) => [...compDna(s)].reverse().join('');
  const toRna = (s) => s.replace(/T/g, 'U');
  const anticodon = (codon) => [...codon].map((b) => COMPL_RNA[b]).join('');

  function translateFrom(rna, start) {
    const codons = [];
    let stopped = false;
    let i = start;
    for (; i + 3 <= rna.length; i += 3) {
      const codon = rna.slice(i, i + 3);
      const aa = CODON_AA[codon];
      codons.push({ codon, aa, idx: i });
      if (aa === '*') { stopped = true; i += 3; break; }
    }
    return { codons, stopped, end: i };
  }
  const proteinOf = (tr) => tr.codons.filter((c) => c.aa !== '*').map((c) => c.aa);

  function readFrame(dna, off) {
    const codons = [];
    for (let i = off; i + 3 <= dna.length; i += 3) {
      const codon = dna.slice(i, i + 3);
      codons.push({ idx: i, codon, aa: CODON_AA[toRna(codon)] });
    }
    const usedEnd = off + codons.length * 3;
    const orfs = [];
    let k = 0;
    while (k < codons.length) {
      if (codons[k].codon === 'ATG') {
        let j = k;
        while (j < codons.length && codons[j].aa !== '*') j++;
        const complete = j < codons.length;
        orfs.push({ from: k, to: complete ? j : codons.length - 1, complete, aaLen: j - k });
        k = j + 1;
      } else k++;
    }
    return { off, codons, orfs, tailStart: usedEnd };
  }

  function isoforms(n, optional) {
    const opt = [...new Set(optional)].filter((x) => x >= 1 && x <= n).sort((a, b) => a - b);
    const k = opt.length;
    const res = [];
    for (let m = (1 << k) - 1; m >= 0; m--) {
      const row = [];
      for (let e = 1; e <= n; e++) {
        const j = opt.indexOf(e);
        if (j < 0 || ((m >> j) & 1)) row.push(e);
      }
      res.push(row);
    }
    return res;
  }

  /* ====================== shared UI helpers ====================== */
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const nt = (s) => [...s].map((b) => `<span class="n${b}">${b}</span>`).join('');
  const EXON_CLS = ['f-accent', 'f-info', 'f-hl', 'f-ok', 'f-bad'];

  BI.css('w-dogma', `
    .dg-grid { direction: ltr; font-family: var(--mono); overflow-x: auto; padding: 6px 2px 8px; }
    .dg-row { display: flex; align-items: center; white-space: nowrap; margin-bottom: 3px; min-width: min-content; }
    .dg-lab { flex: none; width: 118px; position: sticky; left: 0; z-index: 2; background: var(--bg); font: 600 .72rem/1.3 var(--font); color: var(--muted); direction: rtl; text-align: right; padding-inline-end: 8px; white-space: normal; }
    .dg-c, .dg-end { flex: none; width: 22px; height: 26px; line-height: 26px; text-align: center; font-weight: 700; border-radius: 4px; }
    .dg-end { color: var(--muted); font-size: .72rem; font-weight: 600; }
    .dg-c.faded { opacity: .4; }
    .dg-c.done { background: var(--accent-soft); }
    .dg-c.cur { background: var(--hl-soft); box-shadow: inset 0 0 0 2px var(--hl); }
    .dg-tick { color: var(--muted); opacity: .6; font-weight: 400; }
    .dg-cod { flex: none; width: 66px; height: 28px; line-height: 28px; box-sizing: border-box; text-align: center; font-weight: 700; box-shadow: inset 0 0 0 1px var(--line-strong); border-radius: 6px; background: var(--surface); transition: background .2s; }
    .dg-cod.stop { background: var(--bad-soft); box-shadow: inset 0 0 0 1px var(--bad); }
    .dg-cod.done { background: var(--accent-soft); }
    .dg-cod.cur { background: var(--hl-soft); box-shadow: inset 0 0 0 2px var(--hl); }
    .dg-cod.aa { font: 700 .82rem var(--mono); background: transparent; box-shadow: none; }
    .dg-cod.aa.stop { color: var(--bad); font-family: var(--font); }
    .dg-cod.aa.todo { opacity: .3; }
    .dg-ribo { display: grid; gap: 10px; }
    .dg-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .dg-card { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; background: var(--surface); min-width: 0; }
    .dg-card small { display: block; color: var(--muted); font-weight: 700; font-size: .72rem; }
    .dg-card .v { display: block; direction: ltr; text-align: right; font: 700 1.05rem var(--mono); overflow-wrap: anywhere; }
    .dg-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; direction: ltr; font: 700 .85rem var(--mono); }
    .dg-chain .aa { padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--ink); border: 1px solid var(--accent); }
    .dg-chain .aa.new { background: var(--hl-soft); border-color: var(--hl); }
    .dg-chain .bd { color: var(--muted); }
    .dg-stopmsg { font-weight: 800; color: var(--bad); background: var(--bad-soft); border-radius: 8px; padding: 6px 10px; }

    .ct-wrap { overflow-x: auto; }
    .ct-tab { border-collapse: separate; border-spacing: 4px; direction: ltr; min-width: 560px; width: 100%; }
    .ct-tab th { font: 800 .85rem var(--mono); color: var(--ink-2); padding: 2px 4px; }
    .ct-tab th.rowh { width: 34px; }
    .ct-tab td { vertical-align: top; padding: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
    .ct-cod { display: flex; justify-content: space-between; align-items: center; gap: 6px; width: 100%; margin: 0 0 3px; font: 600 .78rem var(--mono); padding: 3px 6px; border: 1px solid transparent; border-left: 4px solid var(--cc); background: var(--cs); color: var(--ink); border-radius: 5px; cursor: pointer; direction: ltr; }
    .ct-cod:last-child { margin-bottom: 0; }
    .ct-cod:hover { border-color: var(--cc); }
    .ct-cod:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .ct-cod .a { font-family: var(--font); font-weight: 700; }
    .ct-cod.start { outline: 2px solid var(--hl); outline-offset: -1px; }
    .ct-cod.dim { opacity: .25; }
    .ct-cod.match { box-shadow: 0 0 0 2px var(--accent); }
    .ct-cod.sel { background: var(--ink); color: var(--bg); border-color: var(--ink); }
    .cl-np { --cc: var(--warn); --cs: var(--warn-soft); }
    .cl-po { --cc: var(--info); --cs: var(--info-soft); }
    .cl-ac { --cc: var(--bad); --cs: var(--bad-soft); }
    .cl-ba { --cc: var(--accent); --cs: var(--accent-soft); }
    .cl-st { --cc: var(--ink); --cs: var(--surface-2); }
    .ct-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: var(--fs-0); }
    .ct-legend span { display: inline-flex; align-items: center; gap: 5px; }
    .ct-legend i { width: 14px; height: 14px; border-radius: 4px; border-left: 4px solid var(--cc); background: var(--cs); display: inline-block; }
    .ct-legend i.st { background: var(--surface-2); }
    .ct-syn { display: flex; flex-wrap: wrap; gap: 6px; direction: ltr; }
    .ct-syn button { font: 700 .8rem var(--mono); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--cc); background: var(--cs); color: var(--ink); cursor: pointer; }

    .fr-c { flex: none; width: 66px; display: flex; flex-direction: column; align-items: center; box-sizing: border-box; }
    .fr-cod { width: 100%; box-sizing: border-box; height: 26px; line-height: 26px; text-align: center; font-weight: 700; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--line-strong); background: var(--surface); }
    .fr-c.st .fr-cod { background: var(--ok-soft); box-shadow: inset 0 0 0 2px var(--ok); }
    .fr-c.sp .fr-cod { background: var(--bad-soft); box-shadow: inset 0 0 0 2px var(--bad); }
    .fr-aa { font: 700 .78rem/1.5 var(--mono); color: var(--ink-2); width: 100%; text-align: center; border-bottom: 3px solid transparent; }
    .fr-c.orf .fr-aa { border-bottom-color: var(--accent); color: var(--ink); }
    .fr-c.sp .fr-aa { color: var(--bad); }
    .fr-pad { flex: none; width: 22px; height: 26px; line-height: 26px; text-align: center; font-weight: 700; opacity: .35; }
    .fr-row { align-items: flex-start; margin-bottom: 8px; }
    .fr-notes { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: var(--fs-0); }
    .fr-notes li { display: flex; gap: 8px; align-items: baseline; }

    .sp-wrap { overflow-x: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; }
    .sp-wrap svg { display: block; min-width: 560px; }
    .sp-stages { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .sp-stages li { flex: 1 1 150px; border: 1px solid var(--line); border-radius: 9px; padding: 6px 10px; font-size: var(--fs-0); color: var(--muted); background: var(--surface); }
    .sp-stages li.on { border-color: var(--hl); color: var(--ink); background: var(--hl-soft); font-weight: 700; }
    .sp-stages li.done { border-color: var(--ok); color: var(--ink); background: var(--ok-soft); }
    .sp-cap { margin: 0; font-weight: 600; min-height: 3em; }
    .sp-opts { display: flex; flex-wrap: wrap; gap: 6px 10px; }
    .sp-opts label { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-0); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px 2px 6px; background: var(--surface); }
    .sp-iso { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 5px 0; border-bottom: 1px dashed var(--line); direction: ltr; }
    .sp-iso .nm { font: 600 .72rem var(--font); color: var(--muted); width: 64px; direction: rtl; text-align: right; flex: none; }
    .sp-e { display: inline-block; min-width: 36px; text-align: center; font: 800 .8rem var(--mono); padding: 3px 6px; border-radius: 6px; color: var(--bg); }
    .sp-e.f-accent { background: var(--accent); } .sp-e.f-info { background: var(--info); } .sp-e.f-hl { background: var(--hl); } .sp-e.f-ok { background: var(--ok); } .sp-e.f-bad { background: var(--bad); }
    .sp-e.opt { box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--ink-2); }
    .sp-join { color: var(--muted); font-weight: 700; }

    .dl-cells { display: flex; flex-wrap: wrap; gap: 12px; }
    .dl-cell { flex: 1 1 280px; min-width: 0; display: grid; gap: 6px; align-content: start; }
    .dl-cell h4 { margin: 0; font-size: var(--fs-1); }
    .dl-cell svg { width: 100%; height: auto; max-width: 420px; margin-inline: auto; display: block; }
    .dl-chip { font: 600 var(--fs-0) var(--font); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink); cursor: pointer; }
    .dl-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
    .dl-chip b { margin-inline-end: 4px; }
    .dl-region { cursor: pointer; outline: none; }
    .dl-region:hover .rg, .dl-region:focus-visible .rg { stroke: var(--accent); stroke-width: 3.5; }
    .rg-cyt { fill: var(--surface-2); stroke: var(--line-strong); stroke-width: 2; }
    .rg-nuc { fill: var(--accent-soft); stroke: var(--ink-2); stroke-width: 2.5; }
    .nm-in { fill: none; stroke: var(--ink-2); stroke-width: 1.2; pointer-events: none; }
    .wall { fill: none; stroke: var(--ink-2); stroke-width: 3; pointer-events: none; }
    .ribo { fill: var(--ink-2); pointer-events: none; }
    .dna-a { stroke: var(--hl); stroke-width: 9; fill: none; stroke-linecap: round; pointer-events: none; }
    .dna-b { stroke: var(--surface); stroke-width: 1.6; fill: none; stroke-linecap: round; pointer-events: none; }
    .dl-lab { fill: var(--muted); font-size: 11px; pointer-events: none; }
    .dl-none { fill: none; stroke: var(--line-strong); stroke-width: 1.5; stroke-dasharray: 5 4; }
    .dl-mk { pointer-events: none; }
    .dl-mk circle { stroke: var(--bg); stroke-width: 2; }
    .dl-mk.sel circle { fill: var(--accent); } .dl-mk.right circle { fill: var(--ok); } .dl-mk.wrong circle { fill: var(--bad); }
    .dl-mk text { fill: var(--bg); font: 800 14px var(--font); }
    .dl-res { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: var(--fs-0); }
    .dl-res li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  `);

  /* ====================== 1. transcribe-translate ====================== */
  BI.widget('transcribe-translate', {
    title: 'از DNA تا پروتئین: رونویسی و ترجمه',
    desc: 'توالی رشتهٔ رمزگذار DNA را (فقط A، C، G، T) بنویس. ابزار رشتهٔ الگو، mRNA، کدون‌ها و پروتئین را زیر هم می‌چیند. با «ترجمهٔ گام‌به‌گام» ببین ریبوزوم کدون‌ها را یکی‌یکی می‌خواند.',
    mount(body, opts) {
      const inId = uid('tt-in');
      const ckId = uid('tt-atg');
      const input = h('input', { type: 'text', class: 'mono', id: inId, value: opts.seq || 'ATGGCCATTGTAATGGGCCGCTGA', spellcheck: 'false', autocomplete: 'off', dir: 'ltr' });
      const ck = h('input', { type: 'checkbox', id: ckId, checked: true });
      const presets = h('div', { class: 'w-row' });
      [['مثال پیش‌فرض', 'ATGGCCATTGTAATGGGCCGCTGA'], ['ATGCCA', 'ATGCCA'], ['با پیشوند قبل از ATG', 'GCATGAAATTTTAAGG']].forEach(([label, s]) => {
        presets.append(h('button', { class: 'btn ghost', type: 'button', text: label, onclick: () => { input.value = s; reset(); } }));
      });
      const err = h('p', { class: 'w-err', hidden: true, role: 'alert' });
      const gridBox = h('div', { class: 'w-out' });
      const summary = h('div', { class: 'w-out' });
      const btnPlay = h('button', { class: 'btn primary', type: 'button', text: 'پخش' });
      const btnStep = h('button', { class: 'btn', type: 'button', text: 'گام بعد' });
      const btnReset = h('button', { class: 'btn ghost', type: 'button', text: 'از اول' });
      const panel = h('div', { class: 'w-out dg-ribo', 'aria-live': 'polite' });
      body.append(
        h('div', { class: 'w-controls' },
          h('label', { class: 'w-field grow', for: inId }, 'رشتهٔ رمزگذار (۵′ به ۳′)', input),
          h('label', { class: 'w-field', for: ckId, style: 'display:flex;align-items:center;gap:6px;flex-direction:row' }, ck, 'شروع از اولین ATG')),
        presets, err, gridBox, summary,
        h('div', { class: 'w-controls' }, h('b', { text: 'ترجمهٔ گام‌به‌گام' }), btnPlay, btnStep, btnReset),
        panel
      );

      let model = null;
      let k = 0;
      let timer = 0;

      function compute() {
        const coding = cleanDna(input.value);
        if (!coding) return { error: 'یک توالی DNA وارد کن.' };
        const bad = badLetters(coding);
        if (bad.length) return { error: `حرف غیرمجاز: ${bad.join('، ')} — توالی DNA فقط A، C، G و T دارد (U مخصوص RNA است).` };
        if (coding.length > 120) return { error: 'حداکثر ۱۲۰ باز مجاز است.' };
        const rna = toRna(coding);
        const start = ck.checked ? rna.indexOf('AUG') : 0;
        const tr = start >= 0 ? translateFrom(rna, start) : { codons: [], stopped: false, end: 0 };
        return { coding, template: compDna(coding), rna, start, tr };
      }

      function stopTimer() { if (timer) { clearTimeout(timer); timer = 0; } btnPlay.textContent = 'پخش'; }
      function reset() { stopTimer(); k = 0; update(); }

      function update() {
        model = compute();
        err.hidden = !model.error;
        if (model.error) { err.textContent = model.error; gridBox.hidden = summary.hidden = panel.hidden = true; btnPlay.disabled = btnStep.disabled = true; return; }
        gridBox.hidden = summary.hidden = panel.hidden = false;
        const total = model.tr.codons.length;
        btnPlay.disabled = btnStep.disabled = !total;
        k = Math.min(k, total);
        renderGrid(); renderSummary(); renderPanel();
      }

      function renderGrid() {
        const { coding, template, rna, start, tr } = model;
        const n = coding.length;
        let curFrom = -1, curTo = -1, doneTo = -1;
        if (k > 0) { const c = tr.codons[k - 1]; curFrom = c.idx; curTo = c.idx + 3; doneTo = c.idx; }
        const cls = (i) => (i >= curFrom && i < curTo ? 'cur' : (k > 0 && i >= start && i < doneTo ? 'done' : ''));
        const cells = (str) => [...str].map((b, i) => `<span class="dg-c n${b} ${cls(i)}">${b}</span>`).join('');
        const ticks = [...coding].map((_, i) => `<span class="dg-c dg-tick ${cls(i)}">|</span>`).join('');
        const row = (label, a, inner, b) => `<div class="dg-row"><span class="dg-lab">${label}</span><span class="dg-end">${a}</span>${inner}<span class="dg-end">${b}</span></div>`;
        const lead = start > 0 ? [...rna.slice(0, start)].map((b) => `<span class="dg-c n${b} faded">${b}</span>`).join('') : '';
        const tailFrom = start < 0 ? 0 : tr.end;
        const tail = [...rna.slice(tailFrom)].map((b) => `<span class="dg-c n${b} faded">${b}</span>`).join('');
        const blanks = (c) => '<span class="dg-c"></span>'.repeat(c);
        const codRow = (start < 0 ? '' : blanks(Math.max(start, 0))) + tr.codons.map((c, j) => {
          const st = k > 0 && j === k - 1 ? 'cur' : (j < k - 1 ? 'done' : '');
          return `<span class="dg-cod ${c.aa === '*' ? 'stop' : ''} ${st}">${nt(c.codon)}</span>`;
        }).join('');
        const aaRow = blanks(Math.max(start, 0)) + tr.codons.map((c, j) => `<span class="dg-cod aa ${c.aa === '*' ? 'stop' : ''} ${k > 0 && j >= k ? 'todo' : ''}">${c.aa === '*' ? 'پایان' : AA[c.aa][0]}</span>`).join('');
        const mrnaInner = start > 0 ? lead + [...rna.slice(start)].map((b, i) => `<span class="dg-c n${b} ${cls(i + start)}">${b}</span>`).join('') : cells(rna);
        const mrnaFaded = start >= 0 && tailFrom < n ? '' : '';
        gridBox.innerHTML = `<div class="dg-grid" role="group" aria-label="ردیف‌های رشتهٔ رمزگذار، الگو، mRNA، کدون و پروتئین">
          ${row('رشتهٔ رمزگذار', '5′', cells(coding), '3′')}
          ${row('', '', ticks, '')}
          ${row('رشتهٔ الگو (مکمل)', '3′', cells(template), '5′')}
          ${row('mRNA (مثل رمزگذار با U)', '5′', mrnaInner + mrnaFaded, '3′')}
          ${row('کدون‌ها (سه‌تا‌سه‌تا)', '', (start < 0 ? [...rna].map((b) => `<span class="dg-c n${b} faded">${b}</span>`).join('') : codRow + tail), '')}
          ${row('آمینواسید', '', aaRow, '')}
        </div>`;
      }

      function renderSummary() {
        const { rna, start, tr } = model;
        if (start < 0) { summary.innerHTML = '<b>ATG پیدا نشد.</b> وقتی «شروع از اولین ATG» روشن است، ریبوزوم بدون کدون شروع AUG ترجمه را آغاز نمی‌کند. توالی دیگری امتحان کن یا گزینه را خاموش کن.'; return; }
        const aas = proteinOf(tr);
        const three = aas.map((a) => AA[a][0]).join('-') || '—';
        const one = aas.join('') || '—';
        const last = tr.codons[tr.codons.length - 1];
        let note;
        if (!tr.codons.length) note = 'کدونی برای ترجمه وجود ندارد.';
        else if (tr.stopped) note = `ترجمه در کدون پایان ${last.codon} متوقف می‌شود (پایان).`;
        else note = 'کدون پایان ندارد؛ ترجمه تا انتهای توالی ادامه پیدا کرد.';
        const left = rna.length - tr.end;
        const extra = !tr.stopped && left > 0 ? ` ${fa(left)} باز آخر یک کدون کامل نمی‌سازند و نادیده گرفته می‌شوند.` : '';
        const pre = start > 0 ? ` ${fa(start)} باز اول (قبل از اولین AUG) ترجمه نمی‌شود.` : '';
        summary.innerHTML = `<div class="w-row"><span class="w-note">پروتئین (۳ حرفی)</span><code>${esc(three)}</code></div>
          <div class="w-row"><span class="w-note">پروتئین (۱ حرفی)</span><code>${esc(one)}</code></div>
          <p class="w-note" style="margin:6px 0 0">${note}${extra}${pre} رشتهٔ الگو را از ۳′ به ۵′ می‌خوانیم؛ mRNA مکمل آن است و مثل رشتهٔ رمزگذار از ۵′ به ۳′ نوشته می‌شود.</p>`;
      }

      function renderPanel() {
        const { tr } = model;
        const total = tr.codons.length;
        if (!total) { panel.innerHTML = '<p class="w-note" style="margin:0">برای ترجمه یک کدون شروع (ATG) لازم است.</p>'; return; }
        if (k === 0) { panel.innerHTML = `<p class="w-note" style="margin:0">ریبوزوم هنوز روی mRNA ننشسته است. «پخش» یا «گام بعد» را بزن؛ ${fa(total)} کدون خوانده می‌شود.</p>`; return; }
        const c = tr.codons[k - 1];
        const chain = tr.codons.slice(0, k).filter((x) => x.aa !== '*');
        const chainHtml = chain.length
          ? chain.map((x, i) => `${i ? '<span class="bd">—</span>' : ''}<span class="aa ${i === chain.length - 1 && c.aa !== '*' ? 'new' : ''}">${AA[x.aa][0]}</span>`).join('')
          : '<span class="w-note">هنوز آمینواسیدی نیامده</span>';
        let top;
        if (c.aa === '*') {
          top = `<div class="dg-cards"><div class="dg-card"><small>کدون روی mRNA</small><span class="v">${nt(c.codon)}</span></div>
            <div class="dg-card"><small>tRNA</small><span class="v" style="font-family:var(--font)">ندارد</span></div></div>
            <p class="dg-stopmsg" style="margin:0">کدون پایان: پروتئین آزاد می‌شود</p>
            <p class="w-note" style="margin:0">برای کدون پایان هیچ tRNA‌ای وجود ندارد؛ یک عامل آزادکننده به ریبوزوم می‌چسبد و زنجیرهٔ آمینواسیدی را رها می‌کند.</p>`;
        } else {
          const a = aaInfo(c.aa);
          const first = k === 1 && c.codon === 'AUG';
          top = `<div class="dg-cards">
            <div class="dg-card"><small>کدون روی mRNA (۵′→۳′)</small><span class="v">${nt(c.codon)}</span></div>
            <div class="dg-card"><small>آنتی‌کدون tRNA (۳′→۵′)</small><span class="v">3′-${nt(anticodon(c.codon))}-5′</span></div>
            <div class="dg-card"><small>آمینواسید آورده‌شده</small><span class="v">${a.three} <span style="font-family:var(--font);font-size:.85rem">${a.fa}</span></span></div></div>
            <p class="w-note" style="margin:0">کدون ${fa(k)} از ${fa(total)}: tRNA با آنتی‌کدونِ مکمل کدون به آن می‌چسبد و ${a.fa} را می‌آورد؛ ${first ? 'این کدون شروع است و همیشه متیونین می‌آورد. ' : ''}آمینواسید به انتهای زنجیره وصل می‌شود.</p>`;
        }
        const finished = k === total;
        const endNote = finished && c.aa !== '*' ? '<p class="w-note" style="margin:0">به انتهای mRNA رسیدیم و کدون پایان نداشت؛ ترجمه همین‌جا تمام شد.</p>' : '';
        panel.innerHTML = `${top}<div><span class="w-note">زنجیرهٔ در حال ساخت:</span><div class="dg-chain">${chainHtml}</div></div>${endNote}`;
      }

      function step() {
        const total = model.tr.codons.length;
        if (k >= total) return false;
        k++;
        renderGrid(); renderPanel();
        return k < total;
      }
      function tick() {
        timer = 0;
        if (!body.isConnected) return;
        if (step()) timer = setTimeout(tick, 1100); else btnPlay.textContent = 'پخش';
      }
      btnPlay.addEventListener('click', () => {
        if (timer) { stopTimer(); return; }
        const total = model.tr.codons.length;
        if (reduced()) { k = total; renderGrid(); renderPanel(); return; }
        if (k >= total) { k = 0; renderGrid(); renderPanel(); }
        btnPlay.textContent = 'توقف';
        timer = setTimeout(tick, 400);
      });
      btnStep.addEventListener('click', () => { stopTimer(); step(); });
      btnReset.addEventListener('click', reset);
      input.addEventListener('input', reset);
      ck.addEventListener('change', reset);
      update();
    },
  });

  /* ====================== 2. codon-table ====================== */
  BI.widget('codon-table', {
    title: 'جدول کد ژنتیکی',
    desc: 'همهٔ ۶۴ کدون mRNA در یک جدول. روی هر کدون کلیک کن تا اطلاعات آمینواسیدش را ببینی، یا نام آمینواسید را (Leu، L یا لوسین) جست‌وجو کن تا کدون‌هایش روشن شوند.',
    mount(body, opts) {
      const sId = uid('ct-s');
      const search = h('input', { type: 'text', id: sId, value: opts.highlight === undefined ? 'Leu' : opts.highlight, spellcheck: 'false', autocomplete: 'off', placeholder: 'Leu یا L یا لوسین', dir: 'auto' });
      const msg = h('p', { class: 'w-note', style: 'margin:0', 'aria-live': 'polite' });
      const wrap = h('div', { class: 'ct-wrap' });
      const info = h('div', { class: 'w-out', 'aria-live': 'polite' });
      const legend = h('div', { class: 'ct-legend' });
      ['np', 'po', 'ac', 'ba', 'st'].forEach((c) => legend.append(h('span', { class: 'cl-' + c }, h('i', { class: c === 'st' ? 'st' : '' }), CLASS_FA[c])));
      legend.append(h('span', null, h('i', { style: 'outline:2px solid var(--hl);outline-offset:-1px;border-left:0;background:var(--surface)' }), 'کدون شروع AUG'));

      let sel = null;
      let matched = null;
      const buttons = {};
      let html = '<table class="ct-tab"><thead><tr><th></th>' + [...BASE_ORDER].map((b) => `<th scope="col">${b}</th>`).join('') + '</tr></thead><tbody>';
      for (const b1 of BASE_ORDER) {
        html += `<tr><th class="rowh" scope="row">${b1}</th>`;
        for (const b2 of BASE_ORDER) {
          html += '<td>';
          for (const b3 of BASE_ORDER) {
            const c = b1 + b2 + b3;
            const a = CODON_AA[c];
            const lab = a === '*' ? 'پایان' : AA[a][0];
            html += `<button type="button" class="ct-cod cl-${AA[a][3]} ${c === 'AUG' ? 'start' : ''}" data-c="${c}" aria-label="${c}: ${a === '*' ? 'کدون پایان' : AA[a][0] + ' ' + AA[a][2]}${c === 'AUG' ? '، کدون شروع' : ''}"><span>${c}</span><span class="a">${lab}${c === 'AUG' ? ' ▸' : ''}</span></button>`;
          }
          html += '</td>';
        }
        html += '</tr>';
      }
      wrap.innerHTML = html + '</tbody></table>';
      wrap.querySelectorAll('.ct-cod').forEach((b) => { buttons[b.dataset.c] = b; b.addEventListener('click', () => { sel = b.dataset.c; paint(); }); });

      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: sId }, 'جست‌وجوی آمینواسید (۳ حرفی، ۱ حرفی یا نام فارسی)', search)),
        msg, legend, wrap, info,
        h('p', { class: 'w-note', style: 'margin:0' }, '۶۴ کدون = ۶۱ کدون آمینواسید + ۳ کدون پایان؛ AUG هم کدون شروع است و هم متیونین را می‌آورد.')
      );

      const codonsOf = (l) => Object.keys(CODON_AA).filter((c) => CODON_AA[c] === l);

      function findMatches(raw) {
        const q = raw.trim();
        if (!q) return null;
        const qn = BI.normalizeAnswer(q);
        const res = new Set();
        const lat = /^[A-Za-z*]+$/.test(q);
        if (lat) {
          const ql = q.toLowerCase();
          if (q.length === 1) { const u = q.toUpperCase(); if (AA[u]) res.add(u); } else {
            for (const [l, a] of Object.entries(AA)) if (a[0].toLowerCase() === ql || (ql.length >= 3 && a[1].toLowerCase().startsWith(ql))) res.add(l);
            if (ql === 'stop') res.add('*');
          }
        } else if (qn.length >= 2) {
          for (const [l, a] of Object.entries(AA)) if (BI.normalizeAnswer(a[2]).includes(qn)) res.add(l);
        } else if (q === '*') res.add('*');
        return res;
      }

      function paint() {
        matched = findMatches(search.value);
        const all = matched === null;
        for (const [c, b] of Object.entries(buttons)) {
          const hit = !all && matched.has(CODON_AA[c]);
          b.classList.toggle('match', hit);
          b.classList.toggle('dim', !all && !hit);
          b.classList.toggle('sel', c === sel);
        }
        if (all) msg.textContent = 'کدونی را انتخاب کن یا نام آمینواسیدی را جست‌وجو کن.';
        else if (!matched.size) msg.textContent = 'چیزی پیدا نشد. نمونه: Leu، L، لوسین.';
        else {
          const n = [...matched].reduce((s, l) => s + codonsOf(l).length, 0);
          msg.textContent = `${fa(n)} کدون برای ${[...matched].map((l) => (l === '*' ? 'Stop' : AA[l][0])).join('، ')} روشن شد.`;
        }
        if (sel) showInfo(sel);
        else info.innerHTML = '<p class="w-note" style="margin:0">روی یک کدون کلیک کن تا اطلاعاتش اینجا نمایش داده شود.</p>';
      }

      function showInfo(c) {
        const l = CODON_AA[c];
        const a = aaInfo(l);
        const syn = codonsOf(l);
        const synHtml = syn.map((x) => `<button type="button" class="cl-${a.cls}" data-c="${x}" ${x === c ? 'aria-current="true"' : ''}>${x}</button>`).join('');
        if (l === '*') {
          info.innerHTML = `<div class="w-kv"><div><span class="k">کدون</span><span class="v">${nt(c)}</span></div><div><span class="k">نوع</span><span class="v" style="font-family:var(--font)">کدون پایان (Stop)</span></div><div><span class="k">تعداد کدون‌های پایان</span><span class="v">${fa(syn.length)}</span></div></div>
            <p class="w-note" style="margin:8px 0">هیچ آمینواسیدی نمی‌آورد؛ ریبوزوم این کدون را که ببیند ترجمه تمام می‌شود و پروتئین آزاد می‌شود.</p><div class="ct-syn">${synHtml}</div>`;
        } else {
          info.innerHTML = `<div class="w-kv">
            <div><span class="k">کدون</span><span class="v">${nt(c)}${c === 'AUG' ? ' ▸ شروع' : ''}</span></div>
            <div><span class="k">آمینواسید</span><span class="v" style="font-family:var(--font)">${a.fa} (${a.en})</span></div>
            <div><span class="k">کد ۳ حرفی / ۱ حرفی</span><span class="v">${a.three} / ${a.one}</span></div>
            <div><span class="k">دستهٔ شیمیایی</span><span class="v" style="font-family:var(--font)">${CLASS_FA[a.cls]}</span></div>
            <div><span class="k">تعداد کدون‌های هم‌معنی</span><span class="v">${fa(syn.length)}</span></div></div>
            <p class="w-note" style="margin:8px 0 6px">کدون‌های هم‌معنی برای ${a.three} (کلیک کن تا بروی سراغ آن‌ها):</p><div class="ct-syn">${synHtml}</div>`;
        }
        info.querySelectorAll('.ct-syn button').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.c; paint(); }));
      }

      search.addEventListener('input', () => {
        const m = findMatches(search.value);
        if (m && m.size === 1) { const l = [...m][0]; if (!sel || CODON_AA[sel] !== l) sel = codonsOf(l)[0]; }
        paint();
      });
      const first = findMatches(search.value);
      if (first && first.size === 1) sel = codonsOf([...first][0])[0];
      else sel = 'AUG';
      paint();
    },
  });

  /* ====================== 3. reading-frames ====================== */
  BI.widget('reading-frames', {
    title: 'قاب‌های خواندن و ORF',
    desc: 'یک توالی DNA بنویس. هر قاب خواندن از یک باز متفاوت شروع می‌شود و آمینواسیدهای دیگری می‌دهد. ATG سبز است، کدون پایان قرمز، و خط زیر آمینواسیدها یک ORF را نشان می‌دهد.',
    mount(body, opts) {
      const inId = uid('rf-in');
      const input = h('input', { type: 'text', class: 'mono', id: inId, value: opts.seq || 'ATGAAACGCTAG', spellcheck: 'false', autocomplete: 'off', dir: 'ltr' });
      let six = opts.strands === '6';
      const b3 = h('button', { type: 'button', text: '۳ قاب (رشتهٔ داده‌شده)' });
      const b6 = h('button', { type: 'button', text: '۶ قاب (دو رشته)' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'تعداد قاب‌ها' }, b3, b6);
      const err = h('p', { class: 'w-err', hidden: true, role: 'alert' });
      const out = h('div', { class: 'w-out' });
      const notes = h('div');
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: inId }, 'توالی DNA (۵′ به ۳′)', input), seg),
        err, out, notes
      );
      const setSix = (v) => { six = v; b3.setAttribute('aria-pressed', !v); b6.setAttribute('aria-pressed', v); run(); };
      b3.addEventListener('click', () => setSix(false));
      b6.addEventListener('click', () => setSix(true));
      input.addEventListener('input', run);

      const frameNote = (label, f) => {
        const done = f.orfs.filter((o) => o.complete);
        const open = f.orfs.filter((o) => !o.complete);
        const stops = f.codons.filter((c) => c.aa === '*').length;
        let t;
        if (done.length === 1) t = `یک ORF کامل از ATG تا کدون پایان (${fa(done[0].aaLen)} آمینواسید)`;
        else if (done.length > 1) t = `${fa(done.length)} ORF کامل (از ATG تا کدون پایان)`;
        else if (open.length) t = 'ATG دارد اما تا انتهای توالی کدون پایان ندارد (ORF ناقص)';
        else t = `ATG ندارد، پس ORF‌ای شروع نمی‌شود${stops ? ` (${fa(stops)} کدون پایان)` : ''}`;
        if (done.length && open.length) t += ' و یک ORF ناقص';
        return `${label}: ${t}`;
      };

      function frameRow(label, dna, f) {
        const orfIdx = new Set();
        f.orfs.forEach((o) => { for (let j = o.from; j <= o.to; j++) orfIdx.add(j); });
        const pad = (s) => [...s].map((b) => `<span class="fr-pad n${b}">${b}</span>`).join('');
        const cods = f.codons.map((c, j) => {
          const isStop = c.aa === '*';
          return `<span class="fr-c ${c.codon === 'ATG' ? 'st' : ''} ${isStop ? 'sp' : ''} ${orfIdx.has(j) ? 'orf' : ''}"><b class="fr-cod">${nt(c.codon)}</b><i class="fr-aa">${isStop ? 'Stop' : AA[c.aa][0]}</i></span>`;
        }).join('');
        return `<div class="dg-row fr-row"><span class="dg-lab">${label}</span>${pad(dna.slice(0, f.off))}${cods}${pad(dna.slice(f.tailStart))}</div>`;
      }
      const seqRow = (label, dna) => `<div class="dg-row"><span class="dg-lab">${label}</span>${[...dna].map((b) => `<span class="dg-c n${b}">${b}</span>`).join('')}</div>`;

      function run() {
        const dna = cleanDna(input.value);
        const bad = badLetters(dna);
        let e = '';
        if (!dna) e = 'یک توالی DNA وارد کن.';
        else if (bad.length) e = `حرف غیرمجاز: ${bad.join('، ')} — فقط A، C، G و T مجاز است.`;
        else if (dna.length < 3) e = 'دست‌کم ۳ باز لازم است تا یک کدون بسازد.';
        else if (dna.length > 90) e = 'حداکثر ۹۰ باز مجاز است.';
        err.hidden = !e; err.textContent = e;
        out.hidden = notes.hidden = !!e;
        if (e) return;
        const lines = [];
        let html = '<div class="dg-grid">' + seqRow('توالی (۵′→۳′)', dna);
        for (let o = 0; o < 3; o++) {
          const f = readFrame(dna, o);
          const label = `قاب ${fa(o + 1)}`;
          html += frameRow(label, dna, f);
          lines.push([label, frameNote(label, f)]);
        }
        if (six) {
          const rc = revcompDna(dna);
          html += '<hr style="border:0;border-top:1px dashed var(--line-strong);margin:6px 0">' + seqRow('مکمل معکوس (۵′→۳′)', rc);
          for (let o = 0; o < 3; o++) {
            const f = readFrame(rc, o);
            const label = `قاب −${fa(o + 1)}`;
            html += frameRow(label, rc, f);
            lines.push([label, frameNote(label, f)]);
          }
        }
        out.innerHTML = html + '</div>';
        notes.innerHTML = `<ul class="fr-notes">${lines.map(([, t]) => `<li><span>${t}</span></li>`).join('')}</ul>
          <p class="w-note" style="margin:8px 0 0">کدون‌های کم‌رنگ انتهای هر ردیف (یا باز‌های اول قابِ ۲ و ۳) در آن قاب شرکت نمی‌کنند. ${six ? 'قاب‌های منفی روی مکمل معکوس خوانده می‌شوند، یعنی ژن‌هایی که روی رشتهٔ مقابل قرار دارند.' : 'برای دیدن ژن‌های رشتهٔ مقابل، حالت ۶ قاب را روشن کن.'}</p>`;
      }
      b3.setAttribute('aria-pressed', !six); b6.setAttribute('aria-pressed', six);
      run();
    },
  });

  /* ====================== 4. splicing ====================== */
  BI.widget('splicing', {
    title: 'پردازش RNA و اسپلایسینگ',
    desc: 'در بخش الف مراحل ساخته شدن mRNA بالغ را ببین. در بخش ب تعیین کن کدام اگزون‌ها اختیاری‌اند تا همهٔ ایزوفرم‌های ممکن شمرده شوند.',
    mount(body, opts) {
      const nA = clamp(parseInt(opts.exons, 10) || 4, 2, 8);
      const smooth = (t) => t * t * (3 - 2 * t);

      /* ---- part A ---- */
      const wrap = h('div', { class: 'sp-wrap' });
      const stagesEl = h('ol', { class: 'sp-stages' });
      const STAGE_T = ['۱) کلاهک ۵′ (m7G)', '۲) اسپلایسینگ (حذف اینترون‌ها)', '۳) دم پلی‌A'];
      STAGE_T.forEach((t) => stagesEl.append(h('li', { text: t })));
      const cap = h('p', { class: 'sp-cap', 'aria-live': 'polite' });
      const runBtn = h('button', { class: 'btn primary', type: 'button', text: 'اجرای پردازش RNA' });
      const rstBtn = h('button', { class: 'btn ghost', type: 'button', text: 'بازنشانی' });
      const CAPS = [
        'پیش‌mRNA تازه رونویسی‌شده: اگزون‌ها (بلوک‌های رنگی) را اینترون‌ها (خط‌های نازک) از هم جدا کرده‌اند. هر اینترون با GU در سر ۵′ شروع و با AG در سر ۳′ تمام می‌شود. دکمه را بزن.',
        'مرحلهٔ ۱: کلاهک ۵′ (m7G) به سر ۵′ اضافه می‌شود؛ از RNA محافظت می‌کند و به ریبوزوم کمک می‌کند.',
        'مرحلهٔ ۲: اسپلایسوزوم اینترون‌ها را حلقه می‌کند و بیرون می‌اندازد و اگزون‌ها را به هم می‌چسباند.',
        'مرحلهٔ ۳: دم پلی‌A (AAAA…) به سر ۳′ اضافه می‌شود.',
        'mRNA بالغ آمادهٔ خروج از هسته',
      ];

      function svgA(prog) {
        const x0 = 48, W = 586, ratio = 1.1, Y = 110;
        const ew = W / (nA + ratio * (nA - 1));
        const iw = ew * ratio;
        const s = clamp(prog - 1, 0, 1);
        const lift = smooth(clamp(s * 2, 0, 1));
        const coll = smooth(clamp((s - 0.5) * 2, 0, 1));
        const ex = (i) => x0 + i * (ew + iw) - coll * i * iw;
        const capOp = clamp(prog, 0, 1);
        let g = '';
        for (let i = 0; i < nA - 1; i++) {
          const xs = ex(i) + ew, xe = ex(i + 1);
          const peak = Y - lift * 70;
          const op = 1 - coll;
          g += `<path d="M${xs.toFixed(1)} ${Y} C${xs.toFixed(1)} ${peak.toFixed(1)} ${xe.toFixed(1)} ${peak.toFixed(1)} ${xe.toFixed(1)} ${Y}" class="f-none s-muted" style="stroke-width:3;opacity:${op.toFixed(2)}"/>`;
          const lo = Math.max(0, 1 - lift * 3) * op;
          if (lo > 0.02) g += `<text x="${(xs + 3).toFixed(1)}" y="${Y - 8}" class="mono t-hl" style="font-size:11px;font-weight:700;opacity:${lo.toFixed(2)}">GU</text><text x="${(xe - 3).toFixed(1)}" y="${Y - 8}" text-anchor="end" class="mono t-hl" style="font-size:11px;font-weight:700;opacity:${lo.toFixed(2)}">AG</text>`;
        }
        for (let i = 0; i < nA; i++) {
          g += `<rect x="${ex(i).toFixed(1)}" y="${Y - 22}" width="${ew.toFixed(1)}" height="44" rx="6" class="${EXON_CLS[i % 5]}"/><text x="${(ex(i) + ew / 2).toFixed(1)}" y="${Y + 5}" text-anchor="middle" style="fill:var(--bg);font-weight:800;font-size:14px">E${i + 1}</text>`;
        }
        const right = ex(nA - 1) + ew;
        const nA2 = Math.ceil(clamp(prog - 2, 0, 1) * 8);
        let endX = right + 8;
        if (nA2 > 0) {
          g += `<text x="${(right + 6).toFixed(1)}" y="${Y + 5}" class="mono t-hl" style="font-size:14px;font-weight:800">${'A'.repeat(nA2)}</text>`;
          endX = right + 10 + nA2 * 8.5;
        }
        g += `<text x="${endX.toFixed(1)}" y="${Y + 5}" class="t-muted" style="font-size:13px;font-weight:700">3′</text>`;
        g += `<text x="22" y="150" text-anchor="middle" class="t-muted" style="font-size:13px;font-weight:700">5′</text>`;
        if (capOp > 0) g += `<line x1="37" y1="${Y}" x2="${x0}" y2="${Y}" class="s-hl" style="stroke-width:3;opacity:${capOp.toFixed(2)}"/><circle cx="22" cy="${Y}" r="16" class="f-hl" style="opacity:${capOp.toFixed(2)}"/><text x="22" y="${Y + 4}" text-anchor="middle" style="fill:var(--bg);font-size:11px;font-weight:800;opacity:${capOp.toFixed(2)}" class="mono">m7G</text>`;
        if (lift > 0.1 && coll < 0.9) g += `<text x="${(x0 + W / 2).toFixed(1)}" y="22" text-anchor="middle" class="t-ink-2" style="font-size:12px;font-weight:700;opacity:${(1 - coll).toFixed(2)}">اسپلایسوزوم</text>`;
        return `<svg viewBox="0 0 720 190" role="img" aria-label="پیش‌mRNA با ${nA} اگزون و اینترون‌ها"><title>پیش‌mRNA با ${nA} اگزون و اینترون‌های بین آن‌ها</title>${g}</svg>`;
      }

      let raf = 0;
      function draw(prog) {
        wrap.innerHTML = svgA(prog);
        const stage = prog <= 0 ? 0 : Math.min(3, Math.ceil(prog - 1e-9));
        const done = prog >= 3;
        [...stagesEl.children].forEach((li, i) => {
          li.classList.toggle('done', done || stage > i + 1 || (stage === i + 1 && prog >= i + 1 && prog > i + 0.999));
          li.classList.toggle('on', !done && stage === i + 1 && prog < i + 1);
        });
        cap.textContent = done ? CAPS[4] : CAPS[stage];
        runBtn.disabled = prog > 0 && prog < 3;
      }
      function cancel() { if (raf) cancelAnimationFrame(raf); raf = 0; }
      function runA() {
        cancel();
        if (reduced()) { draw(3); return; }
        draw(0);
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(3, (t - t0) / 2200);
          draw(p);
          if (p < 3 && wrap.isConnected) raf = requestAnimationFrame(tick); else raf = 0;
        };
        raf = requestAnimationFrame(tick);
      }
      runBtn.addEventListener('click', runA);
      rstBtn.addEventListener('click', () => { cancel(); draw(0); });

      /* ---- part B ---- */
      const nId = uid('sp-n');
      const nIn = h('input', { type: 'number', id: nId, min: '3', max: '8', step: '1', value: String(clamp(nA, 3, 8)), class: 'mono', style: 'width:6rem', inputmode: 'numeric' });
      const optBox = h('div', { class: 'sp-opts', role: 'group', 'aria-label': 'اگزون‌های اختیاری' });
      const errB = h('p', { class: 'w-err', hidden: true, role: 'alert' });
      const isoOut = h('div', { class: 'w-out' });
      const countEl = h('div', { class: 'w-kv' });
      let nB = clamp(nA, 3, 8);
      let optional = new Set();
      const defaults = (n) => { const s = new Set(); for (let i = 2; i <= n - 1; i++) s.add(i); return s; };
      optional = defaults(nB);

      function buildOpts() {
        optBox.replaceChildren();
        for (let i = 1; i <= nB; i++) {
          const id = uid('sp-o');
          const cb = h('input', { type: 'checkbox', id, checked: optional.has(i) });
          cb.addEventListener('change', () => { if (cb.checked) optional.add(i); else optional.delete(i); showIso(); });
          optBox.append(h('label', { for: id }, cb, h('span', { class: 'sp-e ' + EXON_CLS[(i - 1) % 5], text: 'E' + i }), 'اختیاری'));
        }
      }
      function showIso() {
        const list = isoforms(nB, [...optional]);
        const k = [...optional].filter((x) => x >= 1 && x <= nB).length;
        const exonHtml = (e) => `<span class="sp-e ${EXON_CLS[(e - 1) % 5]} ${optional.has(e) ? 'opt' : ''}">E${e}</span>`;
        const MAX = 64;
        isoOut.innerHTML = list.slice(0, MAX).map((row, i) => `<div class="sp-iso"><span class="nm">ایزوفرم ${fa(i + 1)}</span>${row.map(exonHtml).join('<span class="sp-join">–</span>')}</div>`).join('') +
          (list.length > MAX ? `<p class="w-note" style="margin:6px 0 0">${fa(list.length - MAX)} ایزوفرم دیگر نمایش داده نشد.</p>` : '');
        countEl.innerHTML = `<div><span class="k">تعداد اگزون‌های اختیاری</span><span class="v">${fa(k)}</span></div>
          <div><span class="k">حداکثر ایزوفرم</span><span class="v">2<sup>${k}</sup> = ${fa(list.length)}</span></div>`;
      }
      nIn.addEventListener('input', () => {
        const v = parseInt(nIn.value, 10);
        if (!(v >= 3 && v <= 8)) { errB.hidden = false; errB.textContent = 'تعداد اگزون‌ها باید عددی بین ۳ تا ۸ باشد.'; return; }
        errB.hidden = true;
        if (v !== nB) { nB = v; optional = defaults(nB); buildOpts(); }
        showIso();
      });

      body.append(
        h('h4', { text: 'الف) از پیش‌mRNA تا mRNA بالغ', style: 'margin:0' }),
        wrap, stagesEl, cap,
        h('div', { class: 'w-controls' }, runBtn, rstBtn),
        h('hr', { style: 'border:0;border-top:1px solid var(--line);width:100%' }),
        h('h4', { text: 'ب) اسپلایسینگ جایگزین: چند ایزوفرم؟', style: 'margin:0' }),
        h('p', { class: 'w-note', style: 'margin:0' }, 'اگزون‌های «اختیاری» را در هر ایزوفرم می‌شود نگه داشت یا برداشت؛ بقیه همیشه می‌مانند. تعداد را عوض کن و تیک اختیاری بودن هر اگزون را بزن (قاب دور اگزون یعنی اختیاری).'),
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field', for: nId }, 'تعداد اگزون‌ها (۳ تا ۸)', nIn)),
        errB, optBox, countEl, isoOut,
        h('p', { class: 'w-note', style: 'margin:0' }, 'فرمول: تعداد ایزوفرم‌ها = ۲ به توان تعداد اگزون‌های اختیاری. این عدد حداکثر است (پاسخ سؤال اسلاید ۱۱۹)؛ سلول واقعی لزوماً همهٔ ترکیب‌ها را نمی‌سازد.')
      );
      buildOpts();
      showIso();
      draw(0);
    },
  });

  /* ====================== 5. dogma-locations ====================== */
  BI.widget('dogma-locations', {
    title: 'دگمای مرکزی: هر مرحله کجا رخ می‌دهد؟',
    desc: 'شکل زیر سلول یوکاریوتی و پروکاریوتی را نشان می‌دهد؛ مشخص کنید هر مرحلهٔ دگمای مرکزی در کدام قسمت رخ می‌دهد (نوار نارنجی، DNA دورشته‌ای است). یک مرحله را انتخاب کن، بعد روی هسته یا سیتوپلاسم هر سلول کلیک کن (با صفحه‌کلید: Tab و Enter).',
    mount(body) {
      const STEPS = [
        { n: 1, t: 'همانندسازی DNA' },
        { n: 2, t: 'رونویسی' },
        { n: 3, t: 'پردازش RNA (کلاهک، دم پلی‌A، اسپلایسینگ)' },
        { n: 4, t: 'ترجمه' },
      ];
      const KEY = { euk: { 1: 'nuc', 2: 'nuc', 3: 'nuc', 4: 'cyt' }, pro: { 1: 'cyt', 2: 'cyt', 3: 'none', 4: 'cyt' } };
      const WHERE = { nuc: 'هسته', cyt: 'سیتوپلاسم', none: 'در این سلول انجام نمی‌شود' };
      const REASON = {
        euk: {
          1: 'DNA یوکاریوت داخل هسته است و همانندسازی هم همان‌جا انجام می‌شود.',
          2: 'RNA پلیمراز روی DNA کار می‌کند و DNA در هسته است، پس رونویسی در هسته رخ می‌دهد.',
          3: 'کلاهک، دم پلی‌A و حذف اینترون‌ها روی پیش‌mRNA در هسته انجام می‌شوند و بعد mRNA بالغ از هسته خارج می‌شود.',
          4: 'ریبوزوم‌ها (آزاد در سیتوپلاسم یا روی شبکهٔ آندوپلاسمی زبر) در سیتوپلاسم mRNA را به پروتئین ترجمه می‌کنند.',
        },
        pro: {
          1: 'DNA باکتری در ناحیهٔ نوکلئوئید داخل سیتوپلاسم است و همانندسازی همان‌جا انجام می‌شود.',
          2: 'هسته‌ای وجود ندارد؛ RNA پلیمراز در سیتوپلاسم روی DNA نوکلئوئید کار می‌کند.',
          3: 'mRNA معمول باکتری کلاهک، دم پلی‌A و اینترون ندارد، پس این مرحله در آن انجام نمی‌شود.',
          4: 'ریبوزوم‌ها در سیتوپلاسم‌اند و چون غشای هسته‌ای نیست، ترجمه هم‌زمان با رونویسی روی همان mRNA شروع می‌شود.',
        },
      };
      const CELLNAME = { euk: 'سلول یوکاریوتی', pro: 'سلول پروکاریوتی' };
      const POS = {
        euk: { nuc: { y: 98 }, cyt: { y: 232 } },
        pro: { cyt: { y: 168 }, none: { y: 242, x: 252 } },
      };

      const state = { placed: { euk: {}, pro: {} }, active: 1, checked: false, results: { euk: {}, pro: {} } };

      const ribo = (pts) => pts.map(([x, y]) => `<circle class="ribo" cx="${x}" cy="${y}" r="3.6"/>`).join('');
      const eukSvg = () => `<svg viewBox="0 0 320 270" role="group" aria-label="سلول یوکاریوتی"><title>سلول یوکاریوتی با هسته</title>
        <g class="dl-region" data-cell="euk" data-region="cyt" tabindex="0" role="button" aria-label="سیتوپلاسم سلول یوکاریوتی">
          <rect class="rg rg-cyt" x="10" y="10" width="300" height="250" rx="46"/>
          ${ribo([[40, 70], [58, 200], [272, 68], [282, 190], [246, 240], [86, 238], [30, 130], [292, 130], [64, 150], [258, 150]])}
          <text class="dl-lab" x="160" y="204" text-anchor="middle">سیتوپلاسم</text>
          <text class="dl-lab" x="160" y="27" text-anchor="middle">غشای پلاسمایی</text>
        </g>
        <g class="dl-region" data-cell="euk" data-region="nuc" tabindex="0" role="button" aria-label="هستهٔ سلول یوکاریوتی">
          <ellipse class="rg rg-nuc" cx="160" cy="112" rx="78" ry="62"/>
          <ellipse class="nm-in" cx="160" cy="112" rx="70" ry="54"/>
          <text class="dl-lab" x="160" y="70" text-anchor="middle">هسته (غشای دوگانه)</text>
          <path class="dna-a" d="M118 126H202"/><path class="dna-b" d="M122 126H198"/>
          <text class="dl-lab" x="160" y="152" text-anchor="middle">DNA</text>
        </g>
        <g class="mk" data-layer="euk"></g></svg>`;
      const proSvg = () => `<svg viewBox="0 0 320 270" role="group" aria-label="سلول پروکاریوتی"><title>سلول پروکاریوتی بدون هسته</title>
        <g class="dl-region" data-cell="pro" data-region="cyt" tabindex="0" role="button" aria-label="سیتوپلاسم سلول پروکاریوتی">
          <rect class="rg rg-cyt" x="18" y="48" width="284" height="154" rx="77"/>
          ${ribo([[58, 100], [74, 160], [250, 96], [262, 150], [200, 186], [120, 186], [96, 70], [228, 66]])}
          <path class="dna-a" d="M104 110C130 76 160 142 190 108S226 100 224 118"/><path class="dna-b" d="M104 110C130 76 160 142 190 108S226 100 224 118"/>
          <text class="dl-lab" x="160" y="68" text-anchor="middle">نوکلئوئید (DNA)</text>
          <text class="dl-lab" x="160" y="196" text-anchor="middle">سیتوپلاسم</text>
        </g>
        <rect class="wall" x="10" y="40" width="300" height="170" rx="85"/>
        <text class="dl-lab" x="160" y="28" text-anchor="middle">دیوارهٔ سلولی و غشای پلاسمایی (بدون هسته)</text>
        <rect class="dl-none" x="40" y="222" width="240" height="40" rx="10"/>
        <text class="dl-lab" x="130" y="246" text-anchor="middle">در این سلول انجام نمی‌شود</text>
        <g class="mk" data-layer="pro"></g></svg>`;

      const chipBox = h('div', { class: 'w-row', role: 'group', 'aria-label': 'مرحله‌های دگمای مرکزی' });
      const chips = STEPS.map((s) => {
        const b = h('button', { class: 'dl-chip', type: 'button', 'aria-pressed': 'false' }, h('b', { text: fa(s.n) }), s.t);
        b.addEventListener('click', () => { state.active = s.n; paint(); });
        chipBox.append(b);
        return b;
      });
      const hint = h('p', { class: 'w-note', style: 'margin:0', 'aria-live': 'polite' });
      const eukWrap = h('div', { class: 'dl-cell' }, h('h4', { text: 'سلول یوکاریوتی' }));
      const proWrap = h('div', { class: 'dl-cell' }, h('h4', { text: 'سلول پروکاریوتی' }));
      eukWrap.insertAdjacentHTML('beforeend', eukSvg());
      proWrap.insertAdjacentHTML('beforeend', proSvg());
      const noneBtn = h('button', { class: 'btn', type: 'button', text: 'مرحلهٔ ۳: در این سلول انجام نمی‌شود' });
      proWrap.append(noneBtn);
      const btnCheck = h('button', { class: 'btn primary', type: 'button', text: 'بررسی' });
      const btnShow = h('button', { class: 'btn', type: 'button', text: 'نمایش پاسخ' });
      const btnClear = h('button', { class: 'btn ghost', type: 'button', text: 'پاک کردن' });
      const resBox = h('div', { class: 'w-out', hidden: true, 'aria-live': 'polite' });
      const model = h('div', { class: 'w-out', hidden: true });
      body.append(chipBox, hint, h('div', { class: 'dl-cells' }, eukWrap, proWrap), h('div', { class: 'w-controls' }, btnCheck, btnShow, btnClear), resBox, model);

      const layers = { euk: eukWrap.querySelector('[data-layer]'), pro: proWrap.querySelector('[data-layer]') };

      function markersHtml(cell) {
        const groups = {};
        for (const [step, reg] of Object.entries(state.placed[cell])) (groups[reg] = groups[reg] || []).push(+step);
        let out = '';
        for (const [reg, steps] of Object.entries(groups)) {
          steps.sort((a, b) => a - b);
          const p = POS[cell][reg];
          steps.forEach((s, i) => {
            const x = p.x !== undefined ? p.x + (i - (steps.length - 1) / 2) * 30 : 160 + (i - (steps.length - 1) / 2) * 30;
            const r = state.checked ? (state.results[cell][s] ? 'right' : 'wrong') : 'sel';
            out += `<g class="dl-mk ${r}"><circle cx="${x}" cy="${p.y}" r="13"/><text x="${x}" y="${p.y + 5}" text-anchor="middle">${fa(s)}</text></g>`;
          });
        }
        return out;
      }

      function paint() {
        chips.forEach((b, i) => b.setAttribute('aria-pressed', String(state.active === i + 1)));
        const st = STEPS[state.active - 1];
        hint.textContent = st ? `مرحلهٔ انتخاب‌شده: ${fa(st.n)} — ${st.t}. حالا روی هسته یا سیتوپلاسم یک سلول کلیک کن. دوباره کلیک کنی، نشانه جابه‌جا می‌شود.` : '';
        for (const c of ['euk', 'pro']) layers[c].innerHTML = markersHtml(c);
        const placedAll = Object.keys(state.placed.euk).length + Object.keys(state.placed.pro).length;
        btnClear.disabled = !placedAll;
      }

      function place(cell, region) {
        if (!state.active) return;
        state.placed[cell][state.active] = region;
        invalidate();
      }
      function invalidate() { state.checked = false; resBox.hidden = true; model.hidden = true; paint(); }

      body.querySelectorAll('.dl-region').forEach((g) => {
        const act = () => place(g.dataset.cell, g.dataset.region);
        g.addEventListener('click', act);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      });
      noneBtn.addEventListener('click', () => { state.placed.pro[3] = 'none'; invalidate(); });
      btnClear.addEventListener('click', () => { state.placed = { euk: {}, pro: {} }; invalidate(); });

      function check() {
        let right = 0;
        const rows = [];
        for (const cell of ['euk', 'pro']) {
          for (const s of STEPS) {
            const got = state.placed[cell][s.n];
            const want = KEY[cell][s.n];
            const ok = got === want;
            state.results[cell][s.n] = ok;
            if (ok) right++;
            const why = REASON[cell][s.n];
            const verdict = got === undefined ? 'هنوز قرار نداده‌ای.' : (ok ? 'درست.' : `نادرست (گذاشته بودی: ${WHERE[got]}).`);
            rows.push(`<li><span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'درست' : 'نادرست'}</span><b>${CELLNAME[cell]} — ${fa(s.n)} ${s.t}</b><span>${verdict} ${ok ? '' : `پاسخ درست: ${WHERE[want]}. `}${why}</span></li>`);
          }
        }
        state.checked = true;
        paint();
        resBox.hidden = false;
        resBox.innerHTML = `<p style="margin:0 0 8px"><b>${fa(right)} از ${fa(8)} درست</b></p><ul class="dl-res">${rows.join('')}</ul>`;
        model.hidden = false;
        model.innerHTML = `<p style="margin:0 0 4px"><b>پاسخ نمونه</b></p>
          <p style="margin:0 0 6px">در <b>یوکاریوت</b> همانندسازی، رونویسی و پردازش RNA (کلاهک، دم پلی‌A و اسپلایسینگ) همه در <b>هسته</b> رخ می‌دهند؛ سپس mRNA بالغ به سیتوپلاسم می‌رود و <b>ترجمه</b> روی ریبوزوم‌های سیتوپلاسم (آزاد یا روی شبکهٔ آندوپلاسمی زبر) انجام می‌شود.</p>
          <p style="margin:0">در <b>پروکاریوت</b> هسته وجود ندارد: DNA در ناحیهٔ نوکلئوئید داخل سیتوپلاسم است، پس همانندسازی و رونویسی در <b>سیتوپلاسم</b> رخ می‌دهند. mRNA معمول باکتری کلاهک، دم پلی‌A و اینترون ندارد، پس پردازش RNA <b>انجام نمی‌شود</b>. ترجمه هم در سیتوپلاسم است و چون mRNA و ریبوزوم در یک فضا هستند، رونویسی و ترجمه <b>هم‌زمان</b> روی همان mRNA انجام می‌شوند.</p>`;
      }
      btnCheck.addEventListener('click', check);
      btnShow.addEventListener('click', () => {
        state.placed = { euk: { ...KEY.euk }, pro: { ...KEY.pro } };
        check();
      });
      paint();
    },
  });
})();
