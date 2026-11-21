/* pages.js — home dashboard, mixed practice exam, spaced-repetition review and glossary */
(() => {
  'use strict';
  const doc = document;
  const page = doc.body.dataset.page;
  const { h, fa } = BI;

  const run = () => {
    if (page === 'home') home();
    if (page === 'exam') examBuilder();
    if (page === 'flashcards') flashcards();
    if (page === 'glossary') glossary();
  };
  if (BI.ready) run(); else doc.addEventListener('bi:ready', run, { once: true });

  /* ======================= home ======================= */
  function home() {
    const done = BI.progress.done();
    const map = doc.getElementById('course-map');
    if (map) {
      BI.parts.forEach((p) => {
        const chs = BI.chapters.filter((c) => c.part === p.id);
        const nDone = chs.filter((c) => done[c.id]).length;
        const sec = h('section', { class: 'part-block' });
        sec.append(h('div', { class: 'part-head' },
          h('div', null, h('span', { class: 'part-n', text: 'بخش ' + fa(p.n) }), h('h3', { text: p.title }), h('p', { class: 'muted', text: p.sub })),
          h('span', { class: 'pill' + (nDone === chs.length ? ' ok' : ''), text: `${fa(nDone)} از ${fa(chs.length)} فصل` })));
        const grid = h('div', { class: 'cards-grid' });
        chs.forEach((c) => {
          const isDone = !!done[c.id];
          const a = h('a', { class: 'ch-card' + (isDone ? ' done' : ''), href: BI.chapterUrl(c) });
          a.innerHTML = `<span class="num"><span>فصل ${BI.pad(c.n)}</span>${isDone ? '<span class="done-mark">خوانده‌شده ✓</span>' : ''}</span>
            <span class="ttl">${c.title}</span>
            <span class="en">${c.en}</span>
            <span class="meta">${BI.icons.clock.replace('<svg', '<svg width="14" height="14"')}<span>${fa(c.min)} دقیقه</span></span>`;
          grid.append(a);
        });
        sec.append(grid);
        map.append(sec);
      });
    }

    const next = BI.chapters.find((c) => !done[c.id]);
    const cont = doc.getElementById('continue-btn');
    if (cont) {
      const anyDone = BI.chapters.some((c) => done[c.id]);
      if (next) { cont.href = BI.chapterUrl(next); cont.textContent = anyDone ? `ادامه: فصل ${fa(next.n)} — ${next.title}` : 'شروع از فصل ۱'; }
      else { cont.href = BI.url('exam.html'); cont.textContent = 'همهٔ فصل‌ها تمام شد؛ برو سراغ آزمون'; }
    }

    const stats = doc.getElementById('stats');
    if (stats) {
      BI.loadAllData().then(() => {
        const cards = BI.chapters.flatMap((c) => BI.cardsOf(c.id));
        const srs = BI.srs.all();
        const due = cards.filter((c) => srs[c.id] && srs[c.id].due <= BI.srs.today()).length;
        const fresh = cards.filter((c) => !srs[c.id]).length;
        const learned = cards.filter((c) => srs[c.id] && srs[c.id].box >= 3).length;
        const q = BI.progress.quiz();
        const vals = Object.values(q);
        const acc = vals.length ? Math.round((100 * vals.filter(Boolean).length) / vals.length) : null;
        const nDone = Object.keys(done).length;
        const tiles = [
          ['فصل‌های خوانده‌شده', `${fa(nDone)} از ${fa(BI.chapters.length)}`, nDone ? '' : 'هنوز هیچ فصلی را علامت نزده‌ای'],
          ['کارت‌های موعد امروز', fa(due), due ? 'مرور امروز را انجام بده' : (fresh ? `${fa(fresh)} کارت جدید آماده است` : 'امروز کاری نمانده')],
          ['کارت‌های جاافتاده', `${fa(learned)} از ${fa(cards.length)}`, 'کارت‌های جعبهٔ ۳ به بالا'],
          ['درصد پاسخ درست', acc == null ? '—' : fa(acc) + '٪', vals.length ? `از ${fa(vals.length)} پاسخ ثبت‌شده` : 'بعد از اولین سؤال حساب می‌شود'],
        ];
        stats.innerHTML = tiles.map(([k, v, s]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${s}</span></div>`).join('');
        const rv = doc.getElementById('review-btn');
        if (rv) rv.textContent = due ? `مرور امروز (${fa(due)} کارت)` : 'مرور با فلش‌کارت';
      });
    }
    helix(doc.getElementById('helix'));
  }

  /* animated double helix for the home hero */
  function helix(canvas) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seq = 'ATGCGTACGTTAGCGATTACAGGCTAACGTTGCAATCGGATCCATGA';
    const pair = { A: 'T', T: 'A', G: 'C', C: 'G' };
    let colors = {};
    const readColors = () => {
      const cs = getComputedStyle(doc.documentElement);
      colors = { A: cs.getPropertyValue('--nt-a').trim(), T: cs.getPropertyValue('--nt-t').trim(), G: cs.getPropertyValue('--nt-g').trim(), C: cs.getPropertyValue('--nt-c').trim(), ink: cs.getPropertyValue('--ink-2').trim(), line: cs.getPropertyValue('--line-strong').trim() };
    };
    readColors();
    doc.addEventListener('bi:theme', readColors);
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readColors);
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    let t = 0, raf = 0, visible = true;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const amp = H * 0.32, cy = H / 2, step = Math.max(18, W / 34), freq = 0.016;
      const n = Math.ceil(W / step) + 1;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = i * step;
        const ph = x * freq + t;
        pts.push({ x, y1: cy + amp * Math.sin(ph), y2: cy + amp * Math.sin(ph + Math.PI), z: Math.cos(ph), b: seq[i % seq.length] });
      }
      // rungs
      pts.forEach((p) => {
        const a = 0.25 + 0.55 * (p.z * 0.5 + 0.5);
        const mid = (p.y1 + p.y2) / 2;
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.globalAlpha = a; ctx.strokeStyle = colors[p.b]; ctx.beginPath(); ctx.moveTo(p.x, p.y1); ctx.lineTo(p.x, mid); ctx.stroke();
        ctx.strokeStyle = colors[pair[p.b]]; ctx.beginPath(); ctx.moveTo(p.x, mid); ctx.lineTo(p.x, p.y2); ctx.stroke();
      });
      // backbones
      [['y1', 1], ['y2', -1]].forEach(([k, s]) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i], q = pts[i + 1];
          const z = s * (p.z + q.z) / 2;
          ctx.globalAlpha = 0.25 + 0.65 * (z * 0.5 + 0.5);
          ctx.lineWidth = 2 + 1.6 * (z * 0.5 + 0.5);
          ctx.strokeStyle = colors.ink;
          ctx.beginPath(); ctx.moveTo(p.x, p[k]); ctx.lineTo(q.x, q[k]); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    };
    const loop = () => { t += 0.012; draw(); raf = visible ? requestAnimationFrame(loop) : 0; };
    if (reduce) { draw(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
    }
    raf = requestAnimationFrame(loop);
  }

  /* ======================= mixed practice exam ======================= */
  function examBuilder() {
    const box = doc.getElementById('builder');
    if (!box) return;
    const out = doc.getElementById('builder-out');
    const chosen = new Set(BI.chapters.filter((c) => c.part === 'p1').map((c) => c.id));
    const chipsWrap = h('div', { class: 'chip-groups' });
    const paintChips = () => {
      chipsWrap.innerHTML = '';
      BI.parts.forEach((p) => {
        const row = h('div', { class: 'chip-row' }, h('span', { class: 'chip-row-title', text: `بخش ${fa(p.n)}` }));
        BI.chapters.filter((c) => c.part === p.id).forEach((c) => {
          const b = h('button', { type: 'button', class: 'pick', 'aria-pressed': String(chosen.has(c.id)), text: `${fa(c.n)}. ${c.title}` });
          b.addEventListener('click', () => { chosen.has(c.id) ? chosen.delete(c.id) : chosen.add(c.id); b.setAttribute('aria-pressed', String(chosen.has(c.id))); });
          row.append(b);
        });
        chipsWrap.append(row);
      });
    };
    paintChips();
    const presets = h('div', { class: 'w-row' });
    [['شبیه‌ساز میان‌ترم (بخش ۱)', ['p1']], ['بخش ۲', ['p2']], ['بخش ۳', ['p3']], ['کل درس', ['p1', 'p2', 'p3']]].forEach(([label, parts]) => {
      presets.append(h('button', { type: 'button', class: 'btn ghost', text: label, onclick: () => { chosen.clear(); BI.chapters.filter((c) => parts.includes(c.part)).forEach((c) => chosen.add(c.id)); paintChips(); } }));
    });
    const count = h('select', { id: 'mix-count' });
    [10, 15, 20, 30].forEach((n) => count.append(h('option', { value: n, text: fa(n) + ' سؤال' })));
    const typeBoxes = [['mcq', 'چهارگزینه‌ای'], ['tf', 'درست/نادرست'], ['fill', 'جای خالی'], ['essay', 'تشریحی']].map(([v, l]) => {
      const cb = h('input', { type: 'checkbox', id: 'mix-t-' + v, checked: true, value: v });
      return h('label', { class: 'check', for: cb.id }, cb, l);
    });
    const go = h('button', { type: 'button', class: 'btn primary', text: 'ساخت آزمون' });
    const msg = h('p', { class: 'w-note' });
    box.append(
      h('p', { class: 'w-desc', text: 'فصل‌ها را انتخاب کن. سؤال‌ها به‌صورت تصادفی و درهم از فصل‌های مختلف می‌آیند؛ این درهم بودن دقیقاً همان چیزی است که سر جلسهٔ امتحان با آن روبه‌رو می‌شوی.' }),
      presets, chipsWrap,
      h('div', { class: 'w-controls' }, h('label', { class: 'w-field', for: 'mix-count' }, 'تعداد', count), h('div', { class: 'w-row' }, ...typeBoxes), go), msg
    );
    go.addEventListener('click', () => {
      const types = typeBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      if (!chosen.size) { msg.textContent = 'دست‌کم یک فصل انتخاب کن.'; return; }
      if (!types.length) { msg.textContent = 'دست‌کم یک نوع سؤال انتخاب کن.'; return; }
      msg.textContent = 'در حال آماده‌سازی…';
      BI.loadAllData().then(() => {
        let pool = [];
        BI.chapters.filter((c) => chosen.has(c.id)).forEach((c) => {
          ((BI._data[c.id] && BI._data[c.id].questions) || []).forEach((q, i) => {
            if (!types.includes(q.type)) return;
            pool.push({ ...q, _id: `${c.id}:x:${i}`, src: `فصل ${fa(c.n)}` + (q.src ? ' · ' + q.src : '') });
          });
        });
        if (!pool.length) { msg.textContent = 'برای این انتخاب هنوز سؤالی وجود ندارد.'; return; }
        pool = BI.shuffle(pool).slice(0, +count.value);
        msg.textContent = `${fa(pool.length)} سؤال از ${fa(chosen.size)} فصل. اول همه را جواب بده، بعد نمره‌ات را ببین.`;
        out.replaceChildren(BI.questionSet(pool, 'mix'));
        BI.enhance(out);
        out.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* ======================= flashcards (Leitner) ======================= */
  function flashcards() {
    const root = doc.getElementById('review');
    if (!root) return;
    root.append(h('p', { class: 'muted', text: 'در حال بارگذاری کارت‌ها…' }));
    BI.loadAllData().then(() => {
      root.innerHTML = '';
      const all = BI.chapters.flatMap((c) => BI.cardsOf(c.id).map((x) => ({ ...x, n: c.n, chTitle: c.title })));
      const chosen = new Set(BI.chapters.map((c) => c.id));
      const hashCh = location.hash.slice(1);
      if (BI.chapters.some((c) => c.id === hashCh)) { chosen.clear(); chosen.add(hashCh); }
      let mode = 'due';

      const boxes = h('div', { class: 'leitner' });
      const paintBoxes = () => {
        const s = BI.srs.all();
        const cnt = [0, 0, 0, 0, 0, 0];
        all.forEach((c) => { const st = s[c.id]; cnt[st ? st.box : 0]++; });
        boxes.innerHTML = ['جدید', 'جعبهٔ ۱', 'جعبهٔ ۲', 'جعبهٔ ۳', 'جعبهٔ ۴', 'جعبهٔ ۵'].map((l, i) =>
          `<div class="lbox${i === 0 ? ' new' : ''}"><span class="k">${l}</span><span class="v">${fa(cnt[i])}</span><span class="s">${i === 0 ? 'هنوز ندیده‌ای' : 'مرور بعدی: ' + fa(BI.srs.intervals[i]) + ' روز بعد'}</span></div>`).join('');
      };

      const chipRow = h('div', { class: 'chip-row' });
      const allBtn = h('button', { type: 'button', class: 'pick', text: 'همهٔ فصل‌ها' });
      const paintChips = () => {
        chipRow.innerHTML = '';
        allBtn.setAttribute('aria-pressed', String(chosen.size === BI.chapters.length));
        chipRow.append(allBtn);
        BI.chapters.forEach((c) => {
          const n = all.filter((x) => x.ch === c.id).length;
          if (!n) return;
          const b = h('button', { type: 'button', class: 'pick', 'aria-pressed': String(chosen.has(c.id) && chosen.size !== BI.chapters.length), text: `${fa(c.n)}. ${c.title}` });
          b.addEventListener('click', () => { if (chosen.size === BI.chapters.length) chosen.clear(); chosen.has(c.id) ? chosen.delete(c.id) : chosen.add(c.id); if (!chosen.size) BI.chapters.forEach((x) => chosen.add(x.id)); paintChips(); start(); });
          chipRow.append(b);
        });
      };
      allBtn.addEventListener('click', () => { BI.chapters.forEach((x) => chosen.add(x.id)); paintChips(); start(); });

      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'حالت مرور' });
      [['due', 'مرور امروز'], ['all', 'همهٔ کارت‌ها'], ['hard', 'کارت‌های سخت']].forEach(([m, l]) => {
        const b = h('button', { type: 'button', 'aria-pressed': String(m === mode), text: l });
        b.addEventListener('click', () => { mode = m; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); start(); });
        seg.append(b);
      });

      const stage = h('div', { class: 'review-stage' });
      root.append(boxes, h('div', { class: 'review-controls' }, seg), chipRow, stage);

      function start() {
        const s = BI.srs.all();
        const today = BI.srs.today();
        let pool = all.filter((c) => chosen.has(c.ch));
        if (mode === 'due') {
          const due = pool.filter((c) => s[c.id] && s[c.id].due <= today);
          const fresh = pool.filter((c) => !s[c.id]).slice(0, 20);
          pool = BI.shuffle(due).concat(fresh);
        } else if (mode === 'hard') {
          pool = BI.shuffle(pool.filter((c) => s[c.id] && s[c.id].box <= 1));
        } else pool = BI.shuffle(pool);
        session(pool);
      }

      function session(queue) {
        stage.innerHTML = '';
        if (!queue.length) {
          stage.append(h('div', { class: 'review-empty' },
            h('h3', { text: mode === 'hard' ? 'کارت سختی نداری.' : 'برای امروز کارتی نمانده.' }),
            h('p', { class: 'muted', text: mode === 'due' ? 'فاصله گذاشتن بین مرورها عمداً است: حافظه وقتی کمی فراموش کرده و دوباره بازیابی می‌کند قوی‌تر می‌شود. فردا برگرد، یا از «همهٔ کارت‌ها» تمرین آزاد کن.' : 'حالت دیگری را امتحان کن.' })));
          paintBoxes();
          return;
        }
        let i = 0, right = 0, wrong = 0;
        const total = queue.length;
        const bar = h('div', { class: 'review-bar' }, h('i'));
        const meta = h('div', { class: 'deck-bar' });
        const flash = h('div', { class: 'flash', tabindex: '0', role: 'button', 'aria-label': 'برگرداندن کارت' });
        const front = h('div', { class: 'flash-face flash-front' });
        const back = h('div', { class: 'flash-face flash-back' });
        flash.append(front, back);
        const flipBtn = h('button', { type: 'button', class: 'btn primary', text: 'نمایش پاسخ (فاصله)' });
        const no = h('button', { type: 'button', class: 'btn bad', text: 'بلد نبودم' });
        const yes = h('button', { type: 'button', class: 'btn ok', text: 'بلد بودم' });
        const grade = h('div', { class: 'grade-row', hidden: true }, no, yes);
        const actions = h('div', { class: 'grade-row' }, flipBtn);
        stage.append(bar, meta, h('div', { class: 'deck-stage' }, flash), actions, grade);
        const show = () => {
          const c = queue[i];
          flash.classList.remove('flipped');
          front.innerHTML = `<span class="face-label">فصل ${fa(c.n)} · ${c.chTitle}</span><div class="face-text">${c.q}</div>`;
          back.innerHTML = `<span class="face-label">پاسخ</span><div class="face-text">${c.a}</div>`;
          BI.enhance(front); BI.enhance(back);
          const st = BI.srs.info(c.id);
          meta.innerHTML = `<span>کارت ${fa(i + 1)} از ${fa(queue.length)}</span><span>${st ? 'جعبهٔ ' + fa(st.box) : 'کارت جدید'}</span><span>درست ${fa(right)} · نادرست ${fa(wrong)}</span>`;
          bar.firstChild.style.width = (100 * i / total) + '%';
          grade.hidden = true; actions.hidden = false;
          requestAnimationFrame(() => { flash.style.minHeight = Math.max(220, front.scrollHeight, back.scrollHeight) + 'px'; });
        };
        const flip = () => { flash.classList.add('flipped'); grade.hidden = false; actions.hidden = true; };
        const answer = (ok) => {
          const c = queue[i];
          BI.srs.grade(c.id, ok);
          if (ok) right++; else { wrong++; if (queue.length < total * 2) queue.push(c); }
          i++;
          if (i >= queue.length) return finish();
          show();
        };
        flash.addEventListener('click', () => (flash.classList.contains('flipped') ? flash.classList.remove('flipped') : flip()));
        flipBtn.addEventListener('click', flip);
        yes.addEventListener('click', () => answer(true));
        no.addEventListener('click', () => answer(false));
        const keys = (e) => {
          if (!stage.isConnected || !flash.isConnected) { doc.removeEventListener('keydown', keys); return; }
          if (e.target.closest('input, textarea, select')) return;
          if (e.key === ' ' && !flash.classList.contains('flipped')) { e.preventDefault(); flip(); }
          else if (flash.classList.contains('flipped') && (e.key === '1' || e.key === 'ArrowRight')) answer(false);
          else if (flash.classList.contains('flipped') && (e.key === '2' || e.key === 'ArrowLeft')) answer(true);
        };
        doc.addEventListener('keydown', keys);
        function finish() {
          doc.removeEventListener('keydown', keys);
          paintBoxes();
          stage.innerHTML = '';
          stage.append(h('div', { class: 'review-empty' },
            h('h3', { text: 'این دور تمام شد.' }),
            h('p', { text: `${fa(right)} بار «بلد بودم» و ${fa(wrong)} بار «بلد نبودم». کارت‌هایی که بلد نبودی به جعبهٔ ۱ برگشتند و فردا دوباره می‌آیند.` }),
            h('button', { type: 'button', class: 'btn primary', text: 'دور بعد', onclick: start })));
        }
        show();
      }

      paintBoxes();
      paintChips();
      start();
    });
  }

  /* ======================= glossary ======================= */
  function glossary() {
    const root = doc.getElementById('gloss-root');
    if (!root) return;
    BI.loadAllData().then(() => {
      const seen = new Map();
      BI.chapters.forEach((c) => {
        ((BI._data[c.id] && BI._data[c.id].glossary) || []).forEach((g) => {
          const key = (g.en || g.fa).toLowerCase().trim();
          if (!seen.has(key)) seen.set(key, { ...g, chs: [c] });
          else seen.get(key).chs.push(c);
        });
      });
      const list = [...seen.values()].sort((a, b) => a.fa.localeCompare(b.fa, 'fa'));
      const q = h('input', { type: 'search', id: 'gloss-q', placeholder: 'جستجو به فارسی یا انگلیسی… مثلاً «رونویسی» یا «FASTQ»', autocomplete: 'off' });
      const count = h('p', { class: 'w-note' });
      const dl = h('dl', { class: 'gloss' });
      root.append(h('label', { class: 'w-field grow gloss-search', for: 'gloss-q' }, 'جستجو در ' + fa(list.length) + ' واژه', q), count, dl);
      const norm = (s) => BI.normalizeAnswer(String(s || '').replace(/<[^>]+>/g, ''));
      const paint = () => {
        const term = norm(q.value);
        const hits = list.filter((g) => !term || norm(g.fa).includes(term) || norm(g.en).includes(term) || norm(g.def).includes(term));
        dl.innerHTML = '';
        hits.forEach((g) => {
          const links = g.chs.map((c) => `<a href="${BI.chapterUrl(c)}">فصل ${fa(c.n)}</a>`).join('، ');
          dl.append(h('div', null, h('dt', { html: `${g.fa}<span class="en">${BI.esc(g.en || '')}</span>` }), h('dd', { html: `${g.def} <span class="gloss-src">${links}</span>` })));
        });
        count.textContent = term ? `${fa(hits.length)} نتیجه` : '';
        BI.enhance(dl);
      };
      q.addEventListener('input', paint);
      paint();
    });
  }
})();
