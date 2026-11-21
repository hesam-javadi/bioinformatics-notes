/* widgets/dna.js — DNA toolbox (reverse complement, GC content, H-bonds) and Chargaff's rule */
(() => {
  'use strict';
  const { h, fa, esc, colorSeq } = BI;
  const COMP = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };

  BI.css('w-dna', `
    .dna-ladder { direction: ltr; font-family: var(--mono); font-weight: 700; line-height: 1.35; overflow-x: auto; padding: 6px 2px; }
    .dna-ladder .row { display: flex; gap: 2px; align-items: center; white-space: nowrap; }
    .dna-ladder .end { width: 34px; flex: none; color: var(--muted); font-size: .8rem; font-weight: 600; }
    .dna-ladder .b { width: 22px; flex: none; text-align: center; }
    .dna-ladder .bond { width: 22px; flex: none; display: flex; justify-content: center; gap: 2px; height: 16px; align-items: center; }
    .dna-ladder .bond i { width: 2px; height: 14px; border-radius: 1px; background: var(--muted); opacity: .7; }
    .dna-ladder .bond.gc i { background: var(--nt-c); opacity: .9; }
    .comp-bars { display: grid; gap: 6px; }
    .chg-bar { display: flex; height: 34px; border-radius: 8px; overflow: hidden; direction: ltr; border: 1px solid var(--line); }
    .chg-bar span { display: grid; place-items: center; color: #fff; font: 700 .8rem var(--mono); transition: width .3s ease; min-width: 0; overflow: hidden; }
  `);

  function clean(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, ''); }
  function revcomp(s) { return [...s].reverse().map((b) => COMP[b] || 'N').join(''); }
  function comp(s) { return [...s].map((b) => COMP[b] || 'N').join(''); }

  BI.widget('dna-tools', {
    title: 'جعبه‌ابزار DNA',
    desc: 'یک توالی DNA (فقط حروف A، C، G، T) بنویس. ابزار رشتهٔ مکمل، مکمل معکوس، محتوای GC و تعداد پیوندهای هیدروژنی حالت دورشته‌ای را حساب می‌کند.',
    mount(body, opts) {
      const id = 'dna-in-' + Math.random().toString(36).slice(2, 7);
      const input = h('input', { type: 'text', class: 'mono', id, value: opts.seq || 'ATGCGTACGTTAGC', spellcheck: 'false', autocomplete: 'off' });
      const presets = h('div', { class: 'w-row' });
      [['مثال اسلاید', 'ATGCGTACGTTAGC'], ['GATTACA', 'GATTACA'], ['پرGC', 'GCGGCCGCGGCGCCGGGCGC'], ['پرAT', 'ATATTAAATATTTAAATATA']].forEach(([label, s]) => {
        presets.append(h('button', { class: 'btn ghost', type: 'button', text: label, onclick: () => { input.value = s; run(); } }));
      });
      const err = h('p', { class: 'w-err', hidden: true });
      const kv = h('div', { class: 'w-kv' });
      const ladder = h('div', { class: 'w-out' });
      const strands = h('div', { class: 'w-out' });
      const bars = h('div', { class: 'comp-bars' });
      body.append(
        h('div', { class: 'w-controls' }, h('label', { class: 'w-field grow', for: id }, 'توالی رشتهٔ بالا (۵′ به ۳′)', input)),
        presets, err, kv, h('div', { class: 'w-note', text: 'نردبان دورشته‌ای: هر خط عمودی یک پیوند هیدروژنی است (A–T دو تا، G–C سه تا).' }), ladder, strands, bars
      );
      input.addEventListener('input', run);

      function run() {
        const raw = input.value;
        const s = clean(raw);
        const bad = [...s].filter((b) => !'ACGT'.includes(b));
        err.hidden = !bad.length;
        if (bad.length) err.textContent = `حروف غیرمجاز نادیده گرفته شد: ${[...new Set(bad)].join('، ')} — DNA فقط A، C، G و T دارد (U مخصوص RNA است).`;
        const seq = [...s].filter((b) => 'ACGT'.includes(b)).join('');
        const n = seq.length;
        const cnt = { A: 0, C: 0, G: 0, T: 0 };
        for (const b of seq) cnt[b]++;
        const gc = cnt.G + cnt.C;
        const at = cnt.A + cnt.T;
        const hb = at * 2 + gc * 3;
        const pct = (x) => (n ? (100 * x / n) : 0);
        kv.innerHTML = [
          ['طول', `${n} nt`],
          ['محتوای GC', `${pct(gc).toFixed(1)}%`],
          ['جفت A–T / G–C', `${at} / ${gc}`],
          ['پیوند هیدروژنی (دورشته‌ای)', `${at}×2 + ${gc}×3 = ${hb}`],
        ].map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('');

        // ladder
        const show = seq.slice(0, 40);
        const row = (label, arr, cls) => `<div class="row"><span class="end">${label}</span>${arr.map((b) => `<span class="b n${b}">${b}</span>`).join('')}<span class="end">${cls}</span></div>`;
        const bonds = `<div class="row"><span class="end"></span>${[...show].map((b) => `<span class="bond ${'GC'.includes(b) ? 'gc' : ''}">${'<i></i>'.repeat('GC'.includes(b) ? 3 : 2)}</span>`).join('')}<span class="end"></span></div>`;
        ladder.innerHTML = n ? `<div class="dna-ladder">${row("5′", [...show], "3′")}${bonds}${row("3′", [...comp(show)], "5′")}</div>${n > 40 ? `<p class="w-note">فقط ${fa(40)} باز اول نمایش داده شده.</p>` : ''}` : '<p class="w-note">یک توالی وارد کن.</p>';

        strands.innerHTML = n ? `
          <div class="w-row"><span class="w-note" style="min-width:150px">رشتهٔ ورودی</span><code class="seq">5′-${colorSeq(seq)}-3′</code></div>
          <div class="w-row"><span class="w-note" style="min-width:150px">مکمل (زیر همان باز)</span><code class="seq">3′-${colorSeq(comp(seq))}-5′</code></div>
          <div class="w-row"><span class="w-note" style="min-width:150px"><b>مکمل معکوس</b> (۵′ به ۳′)</span><code class="seq">5′-${colorSeq(revcomp(seq))}-3′</code></div>` : '';

        bars.innerHTML = ['A', 'T', 'G', 'C'].map((b) => `
          <div class="bar-row"><span>${b}</span><span class="track"><span class="fill bg${b}" style="width:${pct(cnt[b])}%;display:block"></span></span><span>${pct(cnt[b]).toFixed(0)}%</span></div>`).join('');
      }
      run();
    },
  });

  BI.widget('chargaff', {
    title: 'قاعدهٔ چارگاف',
    desc: 'در DNA دورشته‌ای هر A روبه‌روی یک T است و هر G روبه‌روی یک C. پس اگر درصد یک باز را بدانی، بقیه را حساب می‌کنی. درصد آدنین را تغییر بده.',
    mount(body, opts) {
      const id = 'chg-' + Math.random().toString(36).slice(2, 7);
      const range = h('input', { type: 'range', min: '0', max: '50', step: '1', value: opts.a || '30', id });
      const ds = h('button', { type: 'button', 'aria-pressed': 'true', text: 'دورشته‌ای' });
      const ss = h('button', { type: 'button', 'aria-pressed': 'false', text: 'تک‌رشته‌ای' });
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'نوع DNA' }, ds, ss);
      const label = h('label', { class: 'w-field grow', for: id }, h('span', { class: 'aval' }), range);
      const bar = h('div', { class: 'chg-bar' });
      const out = h('div', { class: 'w-out' });
      body.append(h('div', { class: 'w-controls' }, label, seg), bar, out);
      let double = true;
      const set = (d) => { double = d; ds.setAttribute('aria-pressed', d); ss.setAttribute('aria-pressed', !d); run(); };
      ds.addEventListener('click', () => set(true));
      ss.addEventListener('click', () => set(false));
      range.addEventListener('input', run);
      function run() {
        const A = +range.value;
        label.querySelector('.aval').textContent = `درصد آدنین (A): ${fa(A)}٪`;
        if (!double) {
          bar.innerHTML = `<span class="bgA" style="width:${A}%">A ${A}%</span><span style="width:${100 - A}%;background:var(--surface-2);color:var(--muted)">؟</span>`;
          out.innerHTML = '<b>نمی‌شود حساب کرد.</b> در DNA تک‌رشته‌ای بازها جفت نشده‌اند، پس هیچ قانونی نمی‌گوید T باید با A برابر باشد. قاعدهٔ چارگاف فقط برای DNA دورشته‌ای برقرار است.';
          return;
        }
        const T = A, G = (100 - 2 * A) / 2, C = G;
        bar.innerHTML = [['A', A], ['T', T], ['G', G], ['C', C]].map(([b, v]) => `<span class="bg${b}" style="width:${v}%">${v >= 6 ? b + ' ' + v + '%' : ''}</span>`).join('');
        out.innerHTML = `<div class="w-row"><span>A = T = <b class="ltr">${fa(A)}٪</b></span><span>G = C = (۱۰۰ − ۲×${fa(A)}) ÷ ۲ = <b class="ltr">${fa(G)}٪</b></span></div><p class="w-note" style="margin:6px 0 0">چک: ${fa(A)} + ${fa(T)} + ${fa(G)} + ${fa(C)} = ۱۰۰. محتوای GC این نمونه ${fa(G + C)}٪ است.</p>`;
      }
      run();
    },
  });
})();
