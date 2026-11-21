/* =====================================================================
   core.js — layout shell, progress tracking and learning components
   for the interactive bioinformatics notes. No dependencies.
   ===================================================================== */
(() => {
  'use strict';
  const BI = (window.BI = window.BI || {});
  const doc = document;
  const html = doc.documentElement;
  const ROOT = (html.getAttribute('data-root') || '.').replace(/\/$/, '');
  BI.root = ROOT;
  BI.url = (p) => (ROOT === '.' ? '' : ROOT + '/') + p;

  /* ---------------- storage (never throws) ---------------- */
  BI.store = {
    get(k, d) { try { const v = localStorage.getItem('bi:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bi:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem('bi:' + k); } catch (e) { /* ignore */ } },
  };

  /* ---------------- small helpers ---------------- */
  BI.fa = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  BI.en = (s) => String(s).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  BI.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  BI.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  BI.h = (tag, attrs, ...kids) => {
    const el = doc.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : doc.createTextNode(String(kid)));
    return el;
  };
  const injected = new Set();
  BI.css = (id, text) => { if (injected.has(id)) return; injected.add(id); doc.head.append(BI.h('style', { 'data-for': id, text })); };
  const loading = new Map();
  BI.load = (src) => {
    if (loading.has(src)) return loading.get(src);
    const p = new Promise((res, rej) => {
      const s = doc.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('load failed: ' + src));
      doc.head.append(s);
    });
    loading.set(src, p);
    return p;
  };

  /* ---------------- icons ---------------- */
  const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  BI.icons = {
    menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'class="nav-done"'),
    home: I('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    file: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'),
    cards: I('<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v11"/>'),
    exam: I('<path d="M9 4h6M9 4a2 2 0 0 0-2 2H5v15h14V6h-2a2 2 0 0 0-2-2"/><path d="M8.5 13l2.5 2.5 4.5-5"/>'),
    book: I('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>'),
    sigma: I('<path d="M18 5H6l6 7-6 7h12"/>'),
    target: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  };
  const brandMark = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" class="f-accent"/><path d="M11 5c0 6 10 5 10 11s-10 5-10 11" fill="none" stroke-width="2.4" stroke-linecap="round" style="stroke:var(--accent-ink)"/><path d="M21 5c0 6-10 5-10 11s10 5 10 11" fill="none" stroke-width="2.4" stroke-linecap="round" style="stroke:var(--accent-ink);stroke-opacity:.5"/><path d="M13 9.2h6M13 22.8h6" stroke-width="1.8" style="stroke:var(--accent-ink)"/></svg>`;

  /* ---------------- course registry ---------------- */
  BI.parts = [
    { id: 'p1', n: 1, title: 'مبانی زیستی', sub: 'سلول، پروتئین، DNA و جریان اطلاعات ژنتیکی' },
    { id: 'p2', n: 2, title: 'از مولکول تا داده', sub: 'اندازه‌گیری بیان ژن، توالی‌یابی و فایل‌های داده' },
    { id: 'p3', n: 3, title: 'هم‌ترازی و تحلیل', sub: 'پیدا کردن جای هر خوانش روی ژنوم و خط لولهٔ تحلیل' },
  ];
  BI.chapters = [
    { id: 'ch01', n: 1, part: 'p1', file: '01-intro.html', title: 'بیوانفورماتیک چیست؟', en: 'What is Bioinformatics?', min: 20 },
    { id: 'ch02', n: 2, part: 'p1', file: '02-cell.html', title: 'سلول و قلمروهای حیات', en: 'Cells & Kingdoms of Life', min: 40 },
    { id: 'ch03', n: 3, part: 'p1', file: '03-proteins.html', title: 'پروتئین‌ها', en: 'Proteins', min: 45 },
    { id: 'ch04', n: 4, part: 'p1', file: '04-dna.html', title: 'DNA، زبان حیات', en: 'DNA: the Language of Life', min: 50 },
    { id: 'ch05', n: 5, part: 'p1', file: '05-replication.html', title: 'تقسیم سلول و همانندسازی DNA', en: 'Cell Division & DNA Replication', min: 35 },
    { id: 'ch06', n: 6, part: 'p1', file: '06-transcription.html', title: 'RNA و رونویسی', en: 'RNA & Transcription', min: 50 },
    { id: 'ch07', n: 7, part: 'p1', file: '07-translation.html', title: 'ترجمه و کد ژنتیکی', en: 'Translation & the Genetic Code', min: 40 },
    { id: 'ch08', n: 8, part: 'p2', file: '08-expression.html', title: 'بیان ژن: هر سلول یک بردار', en: 'Gene Expression Profiles', min: 30 },
    { id: 'ch09', n: 9, part: 'p2', file: '09-pcr.html', title: 'خواندن DNA و روش PCR', en: 'Reading DNA: PCR & qPCR', min: 40 },
    { id: 'ch10', n: 10, part: 'p2', file: '10-microarray.html', title: 'ریزآرایه و نرمال‌سازی', en: 'Microarray & Normalization', min: 50 },
    { id: 'ch11', n: 11, part: 'p2', file: '11-sequencing.html', title: 'توالی‌یابی: از سنگر تا نسل سوم', en: 'Sequencing Technologies', min: 40 },
    { id: 'ch12', n: 12, part: 'p2', file: '12-formats.html', title: 'فرمت فایل‌های زیستی', en: 'Bioinformatics File Formats', min: 55 },
    { id: 'ch13', n: 13, part: 'p2', file: '13-biopython.html', title: 'پایتون، Biopython و دادهٔ GEO', en: 'Biopython & NCBI GEO', min: 35 },
    { id: 'ch14', n: 14, part: 'p2', file: '14-coverage.html', title: 'پوشش و عمق خوانش', en: 'Coverage & Depth', min: 30 },
    { id: 'ch15', n: 15, part: 'p3', file: '15-mapping.html', title: 'مسئلهٔ نگاشت خوانش‌ها', en: 'The Read Mapping Problem', min: 25 },
    { id: 'ch16', n: 16, part: 'p3', file: '16-dynamic-programming.html', title: 'هم‌ترازی با برنامه‌نویسی پویا', en: 'Needleman–Wunsch & Smith–Waterman', min: 55 },
    { id: 'ch17', n: 17, part: 'p3', file: '17-indexing.html', title: 'جستجوی سریع: هش، k-mer و BWT', en: 'Hashing, k-mers, Trie & BWT', min: 60 },
    { id: 'ch18', n: 18, part: 'p3', file: '18-pipeline.html', title: 'خط لولهٔ RNA-seq و مینی‌پروژه', en: 'Analysis Pipelines & Mini-project', min: 40 },
  ];
  BI.tools = [
    { file: 'exam.html', title: 'آزمون نمونه و تمرین ترکیبی', short: 'آزمون', icon: 'exam' },
    { file: 'flashcards.html', title: 'مرور فاصله‌دار با فلش‌کارت', short: 'فلش‌کارت', icon: 'cards' },
    { file: 'glossary.html', title: 'واژه‌نامهٔ فارسی–انگلیسی', short: 'واژه‌نامه', icon: 'book' },
    { file: 'cheatsheet.html', title: 'خلاصهٔ فرمول‌ها و نکته‌ها', short: 'خلاصهٔ فرمول‌ها', icon: 'sigma' },
  ];
  BI.chapterUrl = (c) => BI.url('chapters/' + c.file);
  BI.pad = (n) => String(n).padStart(2, '0');

  /* widget name -> file in assets/js/widgets/ */
  BI.widgetFiles = {
    'dna-tools': 'dna.js', 'chargaff': 'dna.js',
    'transcribe-translate': 'dogma.js', 'codon-table': 'dogma.js', 'reading-frames': 'dogma.js', 'splicing': 'dogma.js', 'dogma-locations': 'dogma.js',
    'cell-explorer': 'cell.js', 'cell-cycle': 'cell.js',
    'pcr': 'lab.js', 'qpcr': 'lab.js', 'sanger': 'lab.js', 'microarray': 'lab.js',
    'normalize': 'data.js', 'phred': 'data.js', 'fastq-parse': 'data.js', 'coverage': 'data.js', 'cell-vectors': 'data.js',
    'naive-search': 'align.js', 'dp-align': 'align.js',
    'kmer': 'index.js', 'hash-index': 'index.js', 'trie': 'index.js', 'bwt': 'index.js',
  };

  /* ---------------- theme ---------------- */
  function isDark() {
    const t = html.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function paintThemeBtn() {
    doc.querySelectorAll('.theme-btn').forEach((b) => {
      b.innerHTML = isDark() ? BI.icons.sun : BI.icons.moon;
      b.setAttribute('aria-label', isDark() ? 'پوستهٔ روشن' : 'پوستهٔ تیره');
      b.title = b.getAttribute('aria-label');
    });
  }
  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    BI.store.set('theme', next);
    paintThemeBtn();
    doc.dispatchEvent(new CustomEvent('bi:theme'));
  }

  /* ---------------- progress ---------------- */
  BI.progress = {
    done() { return BI.store.get('done', {}); },
    isDone(id) { return !!this.done()[id]; },
    setDone(id, v) { const d = this.done(); if (v) d[id] = Date.now(); else delete d[id]; BI.store.set('done', d); },
    quiz() { return BI.store.get('quiz', {}); },
    record(qid, ok) { const q = this.quiz(); q[qid] = ok ? 1 : 0; BI.store.set('quiz', q); },
  };

  /* ---------------- spaced repetition (Leitner) ---------------- */
  BI.srs = {
    intervals: [0, 1, 2, 4, 8, 16],
    today() { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); },
    all() { return BI.store.get('srs', {}); },
    info(id) { return this.all()[id] || null; },
    isNew(id) { return !this.all()[id]; },
    isDue(id) { const s = this.info(id); return !s || s.due <= this.today(); },
    grade(id, ok) {
      const all = this.all();
      const s = all[id] || { box: 0, seen: 0 };
      const box = ok ? Math.min((s.box || 0) + 1, 5) : 1;
      all[id] = { box, due: this.today() + this.intervals[box], seen: (s.seen || 0) + 1 };
      BI.store.set('srs', all);
      return all[id];
    },
  };

  /* ---------------- data files ---------------- */
  BI._data = BI._data || {};
  BI.data = (id, obj) => { BI._data[id] = obj; };
  BI.loadData = (id) => (BI._data[id] ? Promise.resolve(BI._data[id]) : BI.load(BI.url('assets/data/' + id + '.js')).then(() => BI._data[id] || null).catch(() => null));
  BI.loadAllData = () => Promise.all(BI.chapters.map((c) => BI.loadData(c.id))).then(() => BI._data);
  BI.cardsOf = (id) => ((BI._data[id] && BI._data[id].cards) || []).map((c, i) => ({ ...c, id: id + '-' + i, ch: id }));

  /* ---------------- shell ---------------- */
  function buildShell() {
    const main = doc.querySelector('main');
    if (!main || doc.querySelector('.shell')) return;
    const chId = doc.body.dataset.chapter || '';
    const page = doc.body.dataset.page || '';
    const here = location.pathname.split('/').pop() || 'index.html';
    const done = BI.progress.done();

    const top = BI.h('header', { class: 'topbar' });
    top.innerHTML = `
      <button class="icon-btn menu-btn" type="button" aria-label="فهرست فصل‌ها">${BI.icons.menu}</button>
      <a class="brand" href="${BI.url('index.html')}">${brandMark}<span>جزوهٔ بیوانفورماتیک<small>مباحث ویژه در علوم کامپیوتر</small></span></a>
      <div class="spacer"></div>
      <nav class="top-links" aria-label="ابزارها">${BI.tools.map((t) => `<a href="${BI.url(t.file)}"${here === t.file ? ' aria-current="page"' : ''}>${t.short}</a>`).join('')}</nav>
      <button class="icon-btn theme-btn" type="button"></button>
      <div class="read-progress" aria-hidden="true"><i></i></div>`;

    const nav = BI.h('nav', { class: 'sidenav', 'aria-label': 'فصل‌های درس', id: 'sidenav' });
    let navHtml = `<a class="nav-home" href="${BI.url('index.html')}">${BI.icons.home}<span>صفحهٔ اصلی و نقشهٔ درس</span></a>`;
    for (const p of BI.parts) {
      const chs = BI.chapters.filter((c) => c.part === p.id);
      const nDone = chs.filter((c) => done[c.id]).length;
      navHtml += `<div class="nav-part"><div class="nav-part-title"><span>بخش ${BI.fa(p.n)} · ${p.title}</span><span>${BI.fa(nDone)}/${BI.fa(chs.length)}</span></div><ul class="nav-list">`;
      for (const c of chs) {
        const cur = c.id === chId ? ' aria-current="page"' : '';
        navHtml += `<li><a href="${BI.chapterUrl(c)}" class="${done[c.id] ? 'done' : ''}"${cur}><span class="nav-num">${BI.pad(c.n)}</span><span>${c.title}</span>${BI.icons.check}</a></li>`;
      }
      navHtml += '</ul></div>';
    }
    navHtml += `<div class="nav-tools"><ul class="nav-list">${BI.tools.map((t) => `<li><a href="${BI.url(t.file)}"${here === t.file ? ' aria-current="page"' : ''}>${BI.icons[t.icon]}<span>${t.title}</span></a></li>`).join('')}</ul></div>`;
    nav.innerHTML = navHtml;

    const shell = BI.h('div', { class: 'shell' });
    main.id = main.id || 'main';
    main.before(shell);
    shell.append(nav, main);
    shell.before(top);
    doc.body.append(BI.h('div', { class: 'nav-overlay', onclick: () => doc.body.classList.remove('nav-open') }));

    // table of contents
    const heads = [...main.querySelectorAll(':scope > h2, :scope > section > h2')].filter((h) => !h.closest('.objectives'));
    if (heads.length >= 3 && !main.hasAttribute('data-no-toc')) {
      const toc = BI.h('aside', { class: 'toc', 'aria-label': 'فهرست این صفحه' });
      const ol = BI.h('ol');
      heads.forEach((h, i) => {
        if (!h.id) h.id = 'sec-' + (i + 1);
        const label = h.cloneNode(true);
        label.querySelectorAll('.sec-num').forEach((x) => x.remove());
        ol.append(BI.h('li', null, BI.h('a', { href: '#' + h.id, text: label.textContent.trim() })));
      });
      toc.append(BI.h('div', { class: 'toc-title', text: page ? 'در این صفحه' : 'در این فصل' }), ol);
      shell.append(toc);
      if ('IntersectionObserver' in window) {
        const links = new Map([...ol.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              links.forEach((a) => a.classList.remove('active'));
              const a = links.get(e.target.id); if (a) a.classList.add('active');
            }
          });
        }, { rootMargin: '-15% 0px -75% 0px' });
        heads.forEach((h) => io.observe(h));
      }
    } else {
      shell.classList.add('no-toc');
    }

    top.querySelector('.menu-btn').addEventListener('click', () => doc.body.classList.toggle('nav-open'));
    top.querySelector('.theme-btn').addEventListener('click', toggleTheme);
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) doc.body.classList.remove('nav-open'); });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') doc.body.classList.remove('nav-open'); });
    paintThemeBtn();
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', paintThemeBtn);

    const bar = top.querySelector('.read-progress i');
    const onScroll = () => {
      const max = doc.documentElement.scrollHeight - innerHeight;
      bar.style.width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- chapter hero & section numbers ---------------- */
  function decorateChapter() {
    const chId = doc.body.dataset.chapter;
    const c = BI.chapters.find((x) => x.id === chId);
    const main = doc.querySelector('main');
    if (!c || !main) return;
    const part = BI.parts.find((p) => p.id === c.part);
    doc.title = doc.title || `${c.title} · جزوهٔ بیوانفورماتیک`;
    const hero = main.querySelector('.hero');
    if (hero && !hero.dataset.ready) {
      hero.dataset.ready = '1';
      const eb = BI.h('div', { class: 'eyebrow' });
      eb.innerHTML = `<span class="part-chip">بخش ${BI.fa(part.n)} · ${part.title}</span><span>فصل ${BI.fa(c.n)} از ${BI.fa(BI.chapters.length)}</span>`;
      hero.prepend(eb);
      const h1 = hero.querySelector('h1');
      if (h1 && !h1.querySelector('.en-title')) h1.append(BI.h('span', { class: 'en-title', text: c.en }));
      const meta = BI.h('div', { class: 'hero-meta' });
      meta.innerHTML = `<span class="chip">${BI.icons.clock}حدود ${BI.fa(c.min)} دقیقه مطالعه</span>` +
        (hero.dataset.src ? `<span class="chip">${BI.icons.file}منبع: ${hero.dataset.src}</span>` : '') +
        (BI.progress.isDone(c.id) ? `<span class="chip" style="color:var(--ok);border-color:var(--ok)">${BI.icons.check.replace('class="nav-done"', '')}خوانده‌شده</span>` : '');
      hero.append(meta);
      if (hero.dataset.motif) {
        const m = BI.h('div', { class: 'motif', 'aria-hidden': 'true' });
        [...hero.dataset.motif.toUpperCase()].forEach((ch, i) => {
          if (!/[ACGTU]/.test(ch)) return;
          m.append(BI.h('b', { class: 'bg' + ch, style: `animation-delay:${i * 25}ms`, text: ch }));
        });
        hero.append(m);
      }
    }
    let i = 0;
    main.querySelectorAll(':scope > h2, :scope > section > h2').forEach((h) => {
      if (h.classList.contains('no-num') || h.closest('.objectives') || h.querySelector('.sec-num')) return;
      i++;
      h.prepend(BI.h('span', { class: 'sec-num', text: BI.fa(c.n) + '.' + BI.fa(i) }));
    });
  }

  function chapterEnd() {
    const chId = doc.body.dataset.chapter;
    const idx = BI.chapters.findIndex((x) => x.id === chId);
    const main = doc.querySelector('main');
    if (idx < 0 || !main || main.querySelector('.chapter-end')) return;
    const c = BI.chapters[idx];
    const prev = BI.chapters[idx - 1];
    const next = BI.chapters[idx + 1];
    const end = BI.h('section', { class: 'chapter-end' });
    const box = BI.h('div', { class: 'done-box' });
    const paint = () => {
      const d = BI.progress.isDone(c.id);
      box.classList.toggle('is-done', d);
      box.innerHTML = d
        ? '<p><b>این فصل را تمام کرده‌ای.</b> یکی دو روز دیگر کارت‌هایش را مرور کن تا در حافظهٔ بلندمدت بماند.</p>'
        : '<p><b>تمامش کردی؟</b> اول سؤال‌های بالا را بدون نگاه به متن جواب بده، بعد این فصل را علامت بزن.</p>';
      const b = BI.h('button', { class: d ? 'btn' : 'btn primary', type: 'button', text: d ? 'برداشتن علامت' : 'این فصل را خواندم' });
      b.addEventListener('click', () => { BI.progress.setDone(c.id, !d); paint(); const a = doc.querySelector(`.nav-list a[href$="${c.file}"]`); if (a) a.classList.toggle('done', !d); });
      box.append(b);
    };
    paint();
    const pager = BI.h('nav', { class: 'pager', 'aria-label': 'فصل قبل و بعد' });
    pager.innerHTML =
      (prev ? `<a class="prev" href="${BI.chapterUrl(prev)}"><small>→ فصل قبل</small><span>${prev.title}</span></a>` : `<a class="prev" href="${BI.url('index.html')}"><small>→ بازگشت</small><span>نقشهٔ درس</span></a>`) +
      (next ? `<a class="next" href="${BI.chapterUrl(next)}"><small>فصل بعد ←</small><span>${next.title}</span></a>` : `<a class="next" href="${BI.url('exam.html')}"><small>قدم بعد ←</small><span>آزمون تمرینی</span></a>`);
    end.append(box, pager);
    main.append(end);
  }

  /* ---------------- components ---------------- */
  function colorizeSeq(root) {
    root.querySelectorAll('.seq:not([data-colored]):not(.plain), .seq-block:not([data-colored]):not(.plain)').forEach((el) => {
      el.dataset.colored = '1';
      if (el.children.length) return;
      el.innerHTML = BI.esc(el.textContent).replace(/[ACGTU]/g, (b) => `<span class="n${b}">${b}</span>`);
    });
  }
  BI.colorSeq = (s) => BI.esc(s).replace(/[ACGTU]/g, (b) => `<span class="n${b}">${b}</span>`);

  const LETTERS = ['الف', 'ب', 'ج', 'د', 'هـ', 'و'];
  let autoQ = 0;
  const qidFor = (el) => el.dataset.id || ((doc.body.dataset.chapter || doc.body.dataset.page || 'p') + ':q' + (++autoQ));

  function initQuiz(q) {
    if (q.dataset.ready) return; q.dataset.ready = '1';
    const id = qidFor(q);
    const items = [...q.querySelectorAll(':scope .opts > li')];
    const explain = q.querySelector(':scope > .explain');
    if (explain) explain.hidden = true;
    if (!q.querySelector('.q-label')) q.prepend(BI.h('div', { class: 'q-label', html: q.dataset.label ? BI.esc(q.dataset.label) : (q.closest('.question-set') ? '' : 'خودآزمایی') }));
    const buttons = items.map((li, i) => {
      const b = BI.h('button', { class: 'opt', type: 'button' });
      b.innerHTML = `<span class="opt-key">${LETTERS[i] || i + 1}</span><span class="opt-text">${li.innerHTML}</span>`;
      if (li.hasAttribute('data-correct')) b.dataset.correct = '1';
      li.replaceChildren(b);
      b.addEventListener('click', () => choose(b));
      return b;
    });
    const fb = BI.h('div', { class: 'feedback', hidden: true });
    const actions = BI.h('div', { class: 'q-actions', hidden: true });
    const retry = BI.h('button', { class: 'btn ghost', type: 'button', text: 'دوباره امتحان کن' });
    actions.append(retry);
    q.append(fb, actions);
    function choose(b) {
      if (q.classList.contains('answered')) return;
      q.classList.add('answered');
      const ok = b.dataset.correct === '1';
      b.classList.add(ok ? 'is-right' : 'is-wrong');
      buttons.forEach((x) => { x.disabled = true; if (x.dataset.correct === '1') x.classList.add('is-right'); });
      fb.className = 'feedback ' + (ok ? 'right' : 'wrong');
      fb.innerHTML = `<b class="verdict">${ok ? 'درست است.' : 'نه، این گزینه درست نیست.'}</b>` + (explain ? explain.innerHTML : '');
      fb.hidden = false; actions.hidden = false;
      colorizeSeq(fb);
      BI.progress.record(id, ok);
      q.dispatchEvent(new CustomEvent('bi:answer', { bubbles: true, detail: { ok } }));
    }
    retry.addEventListener('click', () => {
      q.classList.remove('answered');
      buttons.forEach((x) => { x.disabled = false; x.classList.remove('is-right', 'is-wrong'); });
      fb.hidden = true; actions.hidden = true;
      q.dispatchEvent(new CustomEvent('bi:reset', { bubbles: true }));
    });
  }

  BI.normalizeAnswer = (s) => BI.en(String(s)).toLowerCase()
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[‌‏‎\s\-_.,،:؛"'«»()′’`]/g, '');

  function initFill(f) {
    if (f.dataset.ready) return; f.dataset.ready = '1';
    const id = qidFor(f);
    const answers = (f.dataset.answer || '').split('|').map((s) => s.trim()).filter(Boolean);
    let input = f.querySelector('input.blank');
    if (!input) { input = BI.h('input', { class: 'blank', type: 'text' }); (f.querySelector('.q') || f).append(input); }
    input.setAttribute('aria-label', 'پاسخ جای خالی');
    input.setAttribute('autocomplete', 'off');
    if (!input.id) input.id = 'blank-' + id.replace(/[^a-z0-9-]/gi, '-');
    const explain = f.querySelector(':scope > .explain');
    if (explain) explain.hidden = true;
    if (!f.querySelector('.q-label')) f.prepend(BI.h('div', { class: 'q-label', text: f.closest('.question-set') ? '' : 'جای خالی را پر کن' }));
    const fb = BI.h('div', { class: 'feedback', hidden: true });
    const check = BI.h('button', { class: 'btn primary', type: 'button', text: 'بررسی' });
    const show = BI.h('button', { class: 'btn ghost', type: 'button', text: 'نمایش پاسخ' });
    f.append(BI.h('div', { class: 'q-actions' }, check, show), fb);
    const run = (reveal) => {
      const val = BI.normalizeAnswer(input.value);
      const ok = !reveal && val && answers.some((a) => BI.normalizeAnswer(a) === val);
      input.classList.remove('right', 'wrong');
      if (!reveal) input.classList.add(ok ? 'right' : 'wrong');
      fb.className = 'feedback ' + (ok ? 'right' : 'wrong');
      fb.innerHTML = reveal || !ok
        ? `<b class="verdict">${reveal ? 'پاسخ:' : 'هنوز نه.'}</b>${reveal || !val ? '' : 'یک بار دیگر فکر کن یا پاسخ را ببین. '}${reveal ? `<b>${BI.esc(answers[0] || '')}</b>` : ''}${reveal && explain ? '<div>' + explain.innerHTML + '</div>' : ''}`
        : `<b class="verdict">درست است.</b>${explain ? explain.innerHTML : ''}`;
      fb.hidden = false;
      colorizeSeq(fb);
      if (!reveal && val) { BI.progress.record(id, ok); f.dispatchEvent(new CustomEvent('bi:answer', { bubbles: true, detail: { ok } })); }
    };
    check.addEventListener('click', () => run(false));
    show.addEventListener('click', () => run(true));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(false); } });
  }

  function initEssay(es) {
    if (es.dataset.ready) return; es.dataset.ready = '1';
    const id = qidFor(es);
    const ans = es.querySelector(':scope > .answer');
    if (ans) ans.hidden = true;
    if (!es.querySelector('.q-label')) es.prepend(BI.h('div', { class: 'q-label', text: es.closest('.question-set') ? '' : 'سؤال تشریحی' }));
    const draftKey = 'draft:' + id;
    const ta = BI.h('textarea', { rows: '4', id: 'ta-' + id.replace(/[^a-z0-9-]/gi, '-'), placeholder: 'اول پاسخت را با کلمات خودت بنویس (حتی چند خط ناقص). نوشتن از حافظه، خودش بهترین تمرین است.' });
    ta.value = BI.store.get(draftKey, '');
    ta.addEventListener('input', () => BI.store.set(draftKey, ta.value));
    const btn = BI.h('button', { class: 'btn primary', type: 'button', text: 'مقایسه با پاسخ نمونه' });
    const box = BI.h('div', { class: 'model-answer', hidden: true });
    es.append(ta, BI.h('div', { class: 'q-actions' }, btn), box);
    btn.addEventListener('click', () => {
      if (!box.hidden) { box.hidden = true; btn.textContent = 'مقایسه با پاسخ نمونه'; return; }
      box.innerHTML = '<h5>پاسخ نمونه</h5>' + (ans ? ans.innerHTML : '');
      const pts = box.querySelectorAll('ul.points > li');
      if (pts.length) {
        const ul = box.querySelector('ul.points');
        const list = BI.h('ul', { class: 'checklist' });
        const score = BI.h('p', { class: 'self-score' });
        const upd = () => { const n = list.querySelectorAll('input:checked').length; score.textContent = `خودارزیابی: ${BI.fa(n)} از ${BI.fa(pts.length)} نکتهٔ کلیدی را نوشته بودی.`; };
        pts.forEach((li, i) => {
          const cb = BI.h('input', { type: 'checkbox', id: `pt-${id.replace(/[^a-z0-9-]/gi, '-')}-${i}` });
          cb.addEventListener('change', upd);
          list.append(BI.h('li', null, BI.h('label', { for: cb.id }, cb, BI.h('span', { html: li.innerHTML }))));
        });
        ul.replaceWith(BI.h('div', null, BI.h('h5', { text: 'کدام نکته‌ها را نوشته بودی؟' }), list, score));
        upd();
      }
      colorizeSeq(box);
      box.hidden = false; btn.textContent = 'بستن پاسخ نمونه';
    });
  }

  function initWorked(w) {
    if (w.dataset.ready) return; w.dataset.ready = '1';
    const head = BI.h('div', { class: 'worked-head' }, BI.h('b', { text: w.dataset.title || 'مثال حل‌شده' }), BI.h('span', { class: 'tag', text: w.dataset.tag || 'مثال حل‌شدهٔ گام‌به‌گام' }));
    const body = BI.h('div', { class: 'worked-body' });
    while (w.firstChild) body.append(w.firstChild);
    w.append(head, body);
    const steps = [...body.querySelectorAll('ol.steps > li')];
    const after = body.querySelectorAll('.after-steps');
    if (!steps.length || w.dataset.mode === 'open') return;
    let shown = 0;
    steps.forEach((s) => s.classList.add('hidden-step'));
    after.forEach((a) => (a.hidden = true));
    const next = BI.h('button', { class: 'btn primary', type: 'button' });
    const all = BI.h('button', { class: 'btn ghost', type: 'button', text: 'نمایش همهٔ گام‌ها' });
    const hint = BI.h('span', { class: 'w-note', text: 'قبل از دیدن هر گام، حدس بزن قدم بعدی چیست.' });
    const actions = BI.h('div', { class: 'worked-actions' }, next, all, hint);
    w.append(actions);
    const paint = () => {
      steps.forEach((s, i) => s.classList.toggle('hidden-step', i >= shown));
      next.textContent = shown === 0 ? 'شروع حل' : `گام بعد (${BI.fa(shown)}/${BI.fa(steps.length)})`;
      if (shown >= steps.length) { actions.hidden = true; after.forEach((a) => (a.hidden = false)); }
    };
    next.addEventListener('click', () => { shown++; paint(); });
    all.addEventListener('click', () => { shown = steps.length; paint(); });
    paint();
  }

  function enhanceCode(root) {
    root.querySelectorAll('pre:not([data-ready])').forEach((pre) => {
      pre.dataset.ready = '1';
      if (pre.closest('.widget')) return;
      const b = BI.h('button', { class: 'copy-btn', type: 'button', text: 'کپی' });
      b.addEventListener('click', () => {
        const txt = pre.innerText.replace(/^کپی\s*/, '').replace(/\n?کپی$/, '');
        const code = pre.querySelector('code');
        const text = code ? code.innerText : txt;
        const done = () => { b.textContent = 'کپی شد'; setTimeout(() => (b.textContent = 'کپی'), 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => selectText(pre)); else selectText(pre);
      });
      pre.append(b);
    });
  }
  function selectText(el) { const r = doc.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  function wrapTables(root) {
    root.querySelectorAll('table:not(.w-table)').forEach((t) => {
      if (t.parentElement.classList.contains('table-wrap') || t.closest('.widget')) return;
      const w = BI.h('div', { class: 'table-wrap' });
      t.before(w); w.append(t);
    });
  }

  /* ---------------- widgets ---------------- */
  BI._widgets = BI._widgets || {};
  BI.widget = (name, def) => { BI._widgets[name] = def; doc.querySelectorAll(`[data-widget="${name}"]:not([data-mounted])`).forEach(mountWidget); };
  function mountWidget(el) {
    const name = el.dataset.widget;
    const def = BI._widgets[name];
    if (!def) {
      const f = BI.widgetFiles[name];
      if (!f) { el.innerHTML = `<p class="w-err">ابزار «${BI.esc(name)}» پیدا نشد.</p>`; return; }
      BI.load(BI.url('assets/js/widgets/' + f)).catch(() => { el.innerHTML = '<p class="w-err">بارگذاری این ابزار ناموفق بود. صفحه را دوباره باز کن.</p>'; });
      return;
    }
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    el.classList.add('widget');
    const opts = { ...el.dataset };
    const head = BI.h('div', { class: 'w-head' }, BI.h('div', { class: 'w-title', text: opts.title || def.title || name }), BI.h('span', { class: 'w-badge', text: 'ابزار تعاملی' }));
    const body = BI.h('div', { class: 'w-body' });
    const desc = opts.desc || def.desc;
    if (desc) body.append(BI.h('p', { class: 'w-desc', html: desc }));
    el.replaceChildren(head, body);
    try { def.mount(body, opts, el); colorizeSeq(body); } catch (err) {
      console.error(err);
      body.append(BI.h('p', { class: 'w-err', text: 'خطا در اجرای این ابزار: ' + err.message }));
    }
  }

  /* ---------------- data-driven renderers ---------------- */
  BI.renderQuestion = (q, id) => {
    let el;
    const src = q.src ? `<span class="q-src">${BI.esc(q.src)}</span>` : '';
    if (q.type === 'mcq' || q.type === 'tf') {
      const options = q.type === 'tf' ? ['درست', 'نادرست'] : q.options;
      const answer = q.type === 'tf' ? (q.answer ? 0 : 1) : q.answer;
      el = BI.h('div', { class: 'quiz', 'data-id': id });
      el.innerHTML = `<div class="q-label">${src}</div><p class="q">${q.q}</p><ol class="opts">${options.map((o, i) => `<li${i === answer ? ' data-correct' : ''}>${o}</li>`).join('')}</ol>${q.explain ? `<div class="explain">${q.explain}</div>` : ''}`;
    } else if (q.type === 'fill') {
      el = BI.h('div', { class: 'fill', 'data-id': id, 'data-answer': [].concat(q.answer).join('|') });
      const text = /_{3,}/.test(q.q) ? q.q.replace(/_{3,}/, '<input class="blank" type="text">') : q.q + ' <input class="blank" type="text">';
      el.innerHTML = `<div class="q-label">${src}</div><p class="q">${text}</p>${q.explain ? `<div class="explain">${q.explain}</div>` : ''}`;
    } else {
      el = BI.h('div', { class: 'essay', 'data-id': id });
      const pts = q.points && q.points.length ? `<ul class="points">${q.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : '';
      el.innerHTML = `<div class="q-label">${src}</div><p class="q">${q.q}</p><div class="answer">${q.answer || ''}${pts}</div>`;
    }
    return el;
  };

  BI.questionSet = (questions, prefix) => {
    const set = BI.h('div', { class: 'question-set' });
    const score = BI.h('div', { class: 'set-score' });
    const graded = questions.filter((q) => q.type !== 'essay').length;
    const results = new Map();
    const paint = () => {
      const right = [...results.values()].filter(Boolean).length;
      score.innerHTML = `<span>پاسخ داده: <b>${BI.fa(results.size)}</b> از ${BI.fa(graded)}</span><span>درست: <b style="color:var(--ok)">${BI.fa(right)}</b></span>` +
        (results.size === graded && graded ? `<span class="pill ${right / graded >= 0.7 ? 'ok' : 'hl'}">${right / graded >= 0.7 ? 'عالی؛ برو سراغ بخش بعد' : 'بخش‌هایی را که اشتباه زدی دوباره بخوان'}</span>` : '');
    };
    questions.forEach((q, i) => {
      const el = BI.renderQuestion(q, q._id || `${prefix}:${i}`);
      el.addEventListener('bi:answer', (e) => { if (!results.has(i)) results.set(i, e.detail.ok); paint(); });
      el.addEventListener('bi:reset', () => { results.delete(i); paint(); });
      set.append(el);
    });
    paint();
    const wrap = BI.h('div');
    if (graded) wrap.append(score);
    wrap.append(set);
    return wrap;
  };

  BI.renderDeck = (cards, opts = {}) => {
    const deck = BI.h('div', { class: 'deck' });
    if (!cards.length) { deck.append(BI.h('p', { class: 'muted', text: 'کارتی برای نمایش نیست.' })); return deck; }
    let order = cards.slice();
    let i = 0;
    const stage = BI.h('div', { class: 'deck-stage' });
    const flash = BI.h('div', { class: 'flash', tabindex: '0', role: 'button', 'aria-label': 'برگرداندن کارت' });
    const front = BI.h('div', { class: 'flash-face flash-front' });
    const back = BI.h('div', { class: 'flash-face flash-back' });
    flash.append(front, back); stage.append(flash);
    const count = BI.h('span');
    const prev = BI.h('button', { class: 'btn', type: 'button', text: 'قبلی' });
    const next = BI.h('button', { class: 'btn', type: 'button', text: 'بعدی' });
    const flip = BI.h('button', { class: 'btn primary', type: 'button', text: 'برگردان' });
    const shuffle = BI.h('button', { class: 'btn ghost', type: 'button', text: 'بُر زدن' });
    const no = BI.h('button', { class: 'btn', type: 'button', text: 'بلد نبودم' });
    const yes = BI.h('button', { class: 'btn ok', type: 'button', text: 'بلد بودم' });
    const bar = BI.h('div', { class: 'deck-bar' }, count, BI.h('div', { class: 'btns' }, prev, flip, next, shuffle));
    const grade = BI.h('div', { class: 'deck-bar', hidden: true }, BI.h('span', { text: 'جوابت را با پشت کارت مقایسه کن:' }), BI.h('div', { class: 'btns' }, no, yes));
    const sizeCard = () => { flash.style.minHeight = Math.max(200, front.scrollHeight, back.scrollHeight) + 'px'; };
    const show = () => {
      const c = order[i];
      flash.classList.remove('flipped');
      front.innerHTML = `<span class="face-label">سؤال</span><div class="face-text">${c.q}</div>`;
      back.innerHTML = `<span class="face-label">پاسخ</span><div class="face-text">${c.a}</div>`;
      colorizeSeq(front); colorizeSeq(back);
      const st = BI.srs.info(c.id);
      count.textContent = `کارت ${BI.fa(i + 1)} از ${BI.fa(order.length)}` + (st ? ` · جعبهٔ ${BI.fa(st.box)}` : ' · جدید');
      grade.hidden = true;
      requestAnimationFrame(sizeCard);
    };
    const doFlip = () => { flash.classList.toggle('flipped'); grade.hidden = !flash.classList.contains('flipped'); };
    flash.addEventListener('click', doFlip);
    flash.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doFlip(); } });
    flip.addEventListener('click', doFlip);
    prev.addEventListener('click', () => { i = (i - 1 + order.length) % order.length; show(); });
    next.addEventListener('click', () => { i = (i + 1) % order.length; show(); });
    shuffle.addEventListener('click', () => { order = BI.shuffle(order); i = 0; show(); });
    const g = (ok) => { BI.srs.grade(order[i].id, ok); i = (i + 1) % order.length; show(); };
    yes.addEventListener('click', () => g(true));
    no.addEventListener('click', () => g(false));
    deck.append(stage, bar, grade);
    if (opts.link !== false) deck.append(BI.h('p', { class: 'w-note', html: `این کارت‌ها خودکار وارد <a href="${BI.url('flashcards.html')}">برنامهٔ مرور فاصله‌دار</a> می‌شوند؛ هر روز فقط کارت‌هایی که موعدشان رسیده را نشان می‌دهد.` }));
    show();
    return deck;
  };

  BI.renderGlossary = (list) => {
    const dl = BI.h('dl', { class: 'gloss' });
    list.forEach((g) => {
      dl.append(BI.h('div', null, BI.h('dt', { html: `${g.fa}<span class="en">${BI.esc(g.en || '')}</span>` }), BI.h('dd', { html: g.def })));
    });
    return dl;
  };

  function renderDataBlocks(root) {
    const blocks = root.querySelectorAll('[data-render]');
    if (!blocks.length) return;
    const chId = doc.body.dataset.chapter;
    BI.loadData(chId).then((d) => {
      blocks.forEach((b) => {
        if (b.dataset.rendered) return;
        b.dataset.rendered = '1';
        if (!d) { b.append(BI.h('p', { class: 'w-err', text: 'دادهٔ این بخش بارگذاری نشد.' })); return; }
        const kind = b.dataset.render;
        if (kind === 'questions') {
          let qs = d.questions || [];
          if (b.dataset.types) { const t = b.dataset.types.split(','); qs = qs.filter((q) => t.includes(q.type)); }
          b.append(BI.questionSet(qs, chId + ':x'));
        } else if (kind === 'cards') {
          b.append(BI.renderDeck(BI.cardsOf(chId)));
        } else if (kind === 'glossary') {
          b.append(BI.renderGlossary(d.glossary || []));
        }
        BI.enhance(b);
      });
    });
  }

  BI.enhance = (root = doc) => {
    colorizeSeq(root);
    root.querySelectorAll('.quiz').forEach(initQuiz);
    root.querySelectorAll('.fill').forEach(initFill);
    root.querySelectorAll('.essay').forEach(initEssay);
    root.querySelectorAll('.worked').forEach(initWorked);
    enhanceCode(root);
    wrapTables(root);
    root.querySelectorAll('[data-widget]:not([data-mounted])').forEach(mountWidget);
  };

  /* ---------------- boot ---------------- */
  function boot() {
    buildShell();
    decorateChapter();
    BI.enhance(doc);
    renderDataBlocks(doc);
    chapterEnd();
    if (location.hash) { const t = doc.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) setTimeout(() => t.scrollIntoView(), 50); }
    BI.ready = true;
    doc.dispatchEvent(new CustomEvent('bi:ready'));
  }
  // deferred scripts run while readyState is "interactive" but before DOMContentLoaded,
  // so waiting for DOMContentLoaded lets page scripts loaded after core.js register first.
  if (doc.readyState === 'complete') boot(); else doc.addEventListener('DOMContentLoaded', boot);
})();
