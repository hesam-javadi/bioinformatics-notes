/* widgets/cell.js — clickable cell diagrams with organelle functions, and the cell-cycle wheel */
(() => {
  'use strict';
  const { h, fa, esc } = BI;
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 7);

  BI.css('w-cell', `
    .ce-fig { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .ce-fig svg { display: block; width: 100%; min-width: 520px; height: auto; }
    .org { cursor: pointer; outline: none; }
    .org.hv, .org:focus-visible, .org.sel { filter: drop-shadow(0 0 3px var(--hl)) drop-shadow(0 0 7px var(--hl)); }
    .org.good { filter: drop-shadow(0 0 3px var(--ok)) drop-shadow(0 0 8px var(--ok)); }
    .org.wrong { filter: drop-shadow(0 0 3px var(--bad)) drop-shadow(0 0 8px var(--bad)); }
    .ce-panel { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; }
    .ce-name { font-weight: 800; font-size: var(--fs-2); }
    .ce-en { direction: ltr; text-align: right; color: var(--muted); font-family: var(--mono); font-size: var(--fs-0); }
    .ce-panel p { margin: 0; line-height: 1.9; }
    .ce-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .ce-chips button { font: 600 .78rem var(--font); padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-2); cursor: pointer; }
    .ce-chips button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
    .ce-quiz { background: var(--hl-soft); border: 1px solid var(--hl); border-radius: 10px; padding: 12px 14px; display: grid; gap: 8px; }
    .ce-q { font-weight: 700; }
    .ce-fb { min-height: 1.6em; }
    .cc-grid { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
    .cc-grid > * { min-width: 0; }
    .cc-ring { flex: 1 1 460px; }
    .cc-side { flex: 1 1 300px; display: grid; gap: 10px; }
    .cc-ph { cursor: pointer; outline: none; }
    .cc-ph:hover, .cc-ph:focus-visible, .cc-ph.sel { filter: drop-shadow(0 0 3px var(--hl)) drop-shadow(0 0 6px var(--hl)); }
    .cc-ph.sel path.arc { stroke-width: 42; }
  `);

  const st = (fill, stroke, sw, extra) => `style="fill:${fill ? `var(--${fill})` : 'none'};stroke:${stroke ? `var(--${stroke})` : 'none'};stroke-width:${sw || 0}${extra ? ';' + extra : ''}"`;
  const org = (k, inner) => `<g class="org" data-k="${k}">${inner}</g>`;
  const HIT = 'style="fill:transparent;stroke:none"';

  const GEN = 'عمومی', TMP = 'موقتی', PLANT = 'مخصوص سلول گیاهی', PRO = 'مخصوص پروکاریوت';
  const ORG = {
    cytoplasm: { fa: 'سیتوپلاسم', en: 'Cytoplasm', cat: GEN, fn: 'ژل درون سلول که اندامک‌ها در آن قرار دارند و بسیاری از واکنش‌های شیمیایی سلول در آن انجام می‌شود.' },
    membrane: { fa: 'غشای پلاسمایی', en: 'Plasma membrane', cat: GEN, fn: 'سلول را از محیط بیرون جدا می‌کند و کنترل می‌کند چه چیزی وارد سلول شود و چه چیزی از آن خارج شود.' },
    nucleus: { fa: 'هسته', en: 'Nucleus', cat: GEN, fn: 'DNA سلول را نگه می‌دارد و همانندسازی می‌کند و فعالیت‌های سلول را مدیریت می‌کند.' },
    nucleolus: { fa: 'هستک', en: 'Nucleolus', cat: GEN, fn: 'ناحیه‌ای درون هسته که زیرواحدهای ریبوزوم در آن ساخته می‌شوند.' },
    envelope: { fa: 'پوشش هسته', en: 'Nuclear envelope', cat: GEN, fn: 'دو غشایی که هسته را از سیتوپلاسم جدا می‌کند و از راه منفذهای هسته‌ای رفت‌وآمد مولکول‌ها را کنترل می‌کند.' },
    mito: { fa: 'میتوکندری', en: 'Mitochondria', cat: GEN, fn: 'نیروگاه سلول است. با تنفس سلولی و مصرف O₂، از مواد غذایی انرژی قابل‌استفاده (ATP) می‌سازد و CO₂ آزاد می‌کند. DNA مخصوص به خود دارد و از مادر به ارث می‌رسد.' },
    ribosome: { fa: 'ریبوزوم', en: 'Ribosome', cat: GEN, fn: 'محل ساخت پروتئین است؛ هم آزاد در سیتوپلاسم دیده می‌شود و هم روی شبکهٔ آندوپلاسمی زبر.' },
    rer: { fa: 'شبکهٔ آندوپلاسمی زبر', en: 'Rough endoplasmic reticulum', cat: GEN, fn: 'ریبوزوم‌ها روی آن نشسته‌اند (برای همین زبر است). پروتئین‌های غشایی و پروتئین‌هایی را که باید از سلول خارج شوند می‌سازد.' },
    ser: { fa: 'شبکهٔ آندوپلاسمی صاف', en: 'Smooth endoplasmic reticulum', cat: GEN, fn: 'چربی‌ها (لیپیدها) را می‌سازد و داروها و سموم را تجزیه می‌کند.' },
    golgi: { fa: 'دستگاه گلژی', en: 'Golgi apparatus', cat: GEN, fn: 'کیسه‌های غشادار که پروتئین‌ها را برای صدور از سلول آماده می‌کنند.' },
    lysosome: { fa: 'لیزوزوم', en: 'Lysosome', cat: GEN, fn: 'قطعات فرسوده و مواد زائد را هضم می‌کند.' },
    peroxisome: { fa: 'پراکسی‌زوم', en: 'Peroxisome', cat: GEN, fn: 'مواد سمی، از جمله آب اکسیژنه (H₂O₂)، را تجزیه می‌کند.' },
    vesicle: { fa: 'وزیکول (کیسه‌چه)', en: 'Vesicle', cat: GEN, fn: 'مواد را در سیتوپلاسم جابه‌جا می‌کند.' },
    centrosome: { fa: 'سانتروزوم', en: 'Centrosome', cat: TMP, fn: 'ریزلوله‌ها را سازمان‌دهی می‌کند و پیشرفت چرخهٔ سلولی را تنظیم می‌کند.' },
    cytoskel: { fa: 'اسکلت سلولی', en: 'Cytoskeleton', cat: GEN, fn: 'پشتیبانی ساختاری می‌دهد و جابه‌جایی اندامک‌ها را ممکن می‌کند.' },
    chloroplast: { fa: 'کلروپلاست', en: 'Chloroplast', cat: PLANT, fn: 'محل فتوسنتز است و نور خورشید را جذب می‌کند. دو غشا دارد و درونش پشته‌های غشایی حاوی کلروفیل است.' },
    vacuole: { fa: 'واکوئل مرکزی', en: 'Central vacuole', cat: PLANT, fn: 'محافظت می‌کند، مواد اضافی را ذخیره می‌کند و pH درون سلول را نگه می‌دارد.' },
    cellwall: { fa: 'دیوارهٔ سلولی', en: 'Cell wall', cat: PLANT, fn: 'استحکام و محافظت می‌دهد.' },
    pcapsule: { fa: 'کپسول', en: 'Capsule', cat: PRO, fn: 'لایهٔ محافظ بیرونی باکتری.' },
    pwall: { fa: 'دیوارهٔ سلولی باکتری', en: 'Cell wall', cat: PRO, fn: 'به باکتری شکل و استحکام می‌دهد و از آن محافظت می‌کند.' },
    nucleoid: { fa: 'نوکلئوئید', en: 'Nucleoid', cat: PRO, fn: 'ناحیه‌ای است که DNA باکتری در آن قرار دارد. غشایی دور آن نیست.' },
    plasmid: { fa: 'پلاسمید', en: 'Plasmid', cat: PRO, fn: 'DNA حلقوی کوچک و اضافی است؛ مثلاً ژن‌های مقاومت به آنتی‌بیوتیک را حمل می‌کند.' },
    flagellum: { fa: 'تاژک', en: 'Flagellum', cat: PRO, fn: 'حرکت سلول را ممکن می‌کند.' },
    pili: { fa: 'پیلی', en: 'Pili', cat: PRO, fn: 'به سلول کمک می‌کند به سطوح بچسبد (اتصال).' },
  };

  function mito(x, y, rot, sc) {
    return org('mito', `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc || 1})"><ellipse rx="32" ry="14" ${st('hl-soft', 'hl', 2.5)}/><path d="M-22 -8 Q-18 7 -12 -8 Q-8 7 -2 -8 Q2 7 8 -8 Q12 7 18 -8" ${st(null, 'hl', 1.6)}/></g>`);
  }
  function dot(x, y) { return org('ribosome', `<circle cx="${x}" cy="${y}" r="3.4" ${st('ink-2')}/><circle cx="${x}" cy="${y}" r="10" ${HIT}/>`); }
  function sacs(x0, y0, w, n, gap, key, outer, inner) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = x0 + i * 6, b = x0 + w - i * 6, y = y0 + i * gap;
      const d = `M ${a} ${y} Q ${(a + b) / 2} ${y - 12} ${b} ${y}`;
      s += `<path d="${d}" ${st(null, outer, 10, 'stroke-linecap:round')}/><path d="${d}" ${st(null, inner, 5.5, 'stroke-linecap:round')}/>`;
    }
    return org(key, s);
  }
  function tube(d, w) { return `<path d="${d}" ${st(null, 'warn', w + 4, 'stroke-linecap:round')}/><path d="${d}" ${st(null, 'warn-soft', w, 'stroke-linecap:round')}/>`; }
  function chloro(x, y) {
    let g = '';
    [-14, 0, 14].forEach((dx) => { for (let j = 0; j < 3; j++) g += `<rect x="${dx - 5}" y="${-5 + j * 4}" width="10" height="3" rx="1" ${st('ok')}/>`; });
    return org('chloroplast', `<g transform="translate(${x} ${y})"><ellipse rx="34" ry="17" ${st('ok-soft', 'ok', 2.5)}/>${g}</g>`);
  }

  function drawAnimal() {
    let s = org('cytoplasm', `<ellipse cx="320" cy="200" rx="285" ry="175" ${st('accent-soft')}/>`);
    const ends = [[70, 200], [70, 150], [110, 290], [250, 365], [400, 360], [540, 290], [590, 200], [500, 75], [320, 38]];
    s += org('cytoskel', ends.map(([x, y]) => `<line x1="205" y1="100" x2="${x}" y2="${y}" ${st(null, 'muted', 1.4)}/><line x1="205" y1="100" x2="${x}" y2="${y}" ${st(null, 'transparent', 10)}/>`).join('').replace(/var\(--transparent\)/g, 'transparent'));
    s += org('membrane', `<ellipse cx="320" cy="200" rx="285" ry="175" ${st(null, 'accent', 6)}/>`);
    let rer = '';
    [0, 1, 2].forEach((i) => {
      const rx = 102 + i * 14, ry = 92 + i * 14;
      const pt = (deg, k) => { const t = deg * Math.PI / 180; return [(260 + (rx + k) * Math.cos(t)).toFixed(1), (185 + (ry + k) * Math.sin(t)).toFixed(1)]; };
      const [x0, y0] = pt(-65, 0), [x1, y1] = pt(65, 0);
      const d = `M ${x0} ${y0} A ${rx} ${ry} 0 0 1 ${x1} ${y1}`;
      rer += `<path d="${d}" ${st(null, 'warn', 12, 'stroke-linecap:round')}/><path d="${d}" ${st(null, 'warn-soft', 7.5, 'stroke-linecap:round')}/>`;
      for (let deg = -55; deg <= 55; deg += 22) { const [x, y] = pt(deg, 9); rer += `<circle cx="${x}" cy="${y}" r="2.8" ${st('ink-2')}/>`; }
    });
    s += org('rer', rer);
    s += org('nucleus', `<ellipse cx="260" cy="185" rx="80" ry="70" ${st('info-soft')}/><path d="M 215 165 q 12 -14 24 0 t 24 0 M 212 200 q 12 -14 24 0 t 24 0" ${st(null, 'info', 1.6, 'opacity:.6')}/>` +
      org('nucleolus', `<circle cx="275" cy="195" r="22" ${st('info', 'info', 1)}/>`) +
      org('envelope', `<ellipse cx="260" cy="185" rx="80" ry="70" ${st(null, 'info', 5)}/>`));
    s += mito(110, 170, -25) + mito(150, 295, 25) + mito(330, 335, 0);
    s += org('ser', tube('M 405 262 Q 430 240 455 262 T 505 262', 8) + tube('M 420 285 Q 445 262 470 285 T 520 285', 8) + tube('M 455 262 L 470 285', 8));
    s += sacs(435, 100, 90, 4, 12, 'golgi', 'ok', 'ok-soft');
    s += org('lysosome', `<circle cx="545" cy="185" r="15" ${st('bad-soft', 'bad', 2.5)}/><circle cx="540" cy="181" r="2.5" ${st('bad')}/><circle cx="550" cy="190" r="2.5" ${st('bad')}/>`);
    s += org('peroxisome', `<circle cx="555" cy="260" r="13" ${st('warn-soft', 'warn', 2.5)}/><rect x="551" y="256" width="8" height="8" ${st('ink-2')}/>`);
    [[412, 128], [412, 172], [548, 125], [425, 215]].forEach(([x, y]) => { s += org('vesicle', `<circle cx="${x}" cy="${y}" r="7" ${st('info-soft', 'info', 2)}/>`); });
    s += org('centrosome', `<g transform="translate(205 95)"><rect x="-12" y="-4.5" width="24" height="9" rx="4.5" ${st('ink-2', 'surface', 1)}/><rect x="-4.5" y="7" width="9" height="22" rx="4.5" ${st('ink-2', 'surface', 1)}/><circle cy="10" r="26" ${HIT}/></g>`);
    [[95, 215], [120, 232], [82, 250], [215, 300], [236, 282], [190, 326], [430, 345], [462, 330]].forEach(([x, y]) => { s += dot(x, y); });
    return s;
  }

  function drawPlant() {
    let s = org('cytoplasm', `<rect x="36" y="34" width="568" height="332" rx="36" ${st('accent-soft')}/>`);
    s += org('cellwall', `<rect x="26" y="24" width="588" height="352" rx="44" ${st(null, 'hl', 12)}/>`);
    s += org('membrane', `<rect x="36" y="34" width="568" height="332" rx="36" ${st(null, 'accent', 3.5)}/>`);
    s += org('vacuole', `<rect x="190" y="84" width="290" height="234" rx="70" ${st('info-soft', 'info', 3)}/>`);
    s += org('nucleus', `<ellipse cx="115" cy="150" rx="52" ry="54" ${st('info-soft')}/>` +
      org('nucleolus', `<circle cx="122" cy="158" r="15" ${st('info', 'info', 1)}/>`) +
      org('envelope', `<ellipse cx="115" cy="150" rx="52" ry="54" ${st(null, 'info', 4.5)}/>`));
    let rer = tube('M 56 235 Q 85 218 115 235 T 175 235', 7) + tube('M 56 256 Q 85 239 115 256 T 175 256', 7);
    [66, 96, 126, 156].forEach((x) => { rer += `<circle cx="${x}" cy="${x % 60 < 30 ? 224 : 230}" r="2.8" ${st('ink-2')}/>`; });
    s += org('rer', rer);
    s += sacs(68, 290, 84, 4, 11, 'golgi', 'ok', 'ok-soft');
    [[265, 58], [365, 58], [550, 115], [550, 295], [285, 347], [385, 347]].forEach(([x, y]) => { s += chloro(x, y); });
    s += mito(545, 205, 0, 0.8);
    s += org('peroxisome', `<circle cx="480" cy="345" r="13" ${st('warn-soft', 'warn', 2.5)}/><rect x="476" y="341" width="8" height="8" ${st('ink-2')}/>`);
    [[80, 345], [102, 352], [126, 342], [200, 345]].forEach(([x, y]) => { s += dot(x, y); });
    return s;
  }

  function drawProk() {
    let s = org('flagellum', `<path d="M 556 200 c 15 -26 26 -26 36 0 s 21 26 36 0" ${st(null, 'ink-2', 3.5, 'stroke-linecap:round')}/><path d="M 556 200 c 15 -26 26 -26 36 0 s 21 26 36 0" ${st(null, 'transparent', 14)}/>`.replace(/var\(--transparent\)/g, 'transparent'));
    [[170, -1], [225, -1], [290, -1], [200, 1], [265, 1], [335, 1]].forEach(([x, d]) => {
      const y0 = d < 0 ? 100 : 300, y1 = y0 + d * 34;
      s += org('pili', `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" ${st(null, 'ink-2', 2.5, 'stroke-linecap:round')}/><line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" style="stroke:transparent;stroke-width:12"/>`);
    });
    s += org('pcapsule', `<rect x="100" y="100" width="460" height="200" rx="100" ${st('warn-soft', 'warn', 2)}/>`);
    s += org('cytoplasm', `<rect x="124" y="124" width="412" height="152" rx="76" ${st('accent-soft')}/>`);
    s += org('pwall', `<rect x="116" y="116" width="428" height="168" rx="84" ${st(null, 'hl', 8)}/>`);
    s += org('membrane', `<rect x="124" y="124" width="412" height="152" rx="76" ${st(null, 'accent', 4)}/>`);
    s += org('nucleoid', `<ellipse cx="310" cy="200" rx="95" ry="50" ${st('info-soft', 'info', 2, 'stroke-dasharray:6 5')}/><path d="M 250 200 q 10 -35 25 -10 t 25 15 t 25 -20 t 25 18 t 25 -14 t 20 8 M 262 215 q 18 22 35 0 t 35 4 t 35 -6 t 30 5" ${st(null, 'info', 2.5, 'stroke-linecap:round')}/>`);
    [[470, 190], [165, 205]].forEach(([x, y]) => { s += org('plasmid', `<circle cx="${x}" cy="${y}" r="14" ${st(null, 'hl', 3.5)}/><circle cx="${x}" cy="${y}" r="22" ${HIT}/>`); });
    [[180, 150], [200, 248], [250, 142], [300, 140], [350, 145], [405, 142], [255, 258], [310, 260], [365, 255], [410, 250], [445, 225], [450, 160], [500, 150], [500, 240]].forEach(([x, y]) => { s += dot(x, y); });
    return s;
  }

  const CELLS = {
    animal: { fa: 'سلول جانوری', en: 'Animal cell', first: 'nucleus', draw: drawAnimal,
      keys: ['membrane', 'cytoplasm', 'nucleus', 'nucleolus', 'envelope', 'mito', 'rer', 'ser', 'golgi', 'lysosome', 'peroxisome', 'vesicle', 'ribosome', 'centrosome', 'cytoskel'] },
    plant: { fa: 'سلول گیاهی', en: 'Plant cell', first: 'chloroplast', draw: drawPlant,
      keys: ['cellwall', 'membrane', 'cytoplasm', 'chloroplast', 'vacuole', 'nucleus', 'nucleolus', 'envelope', 'mito', 'rer', 'golgi', 'ribosome', 'peroxisome'] },
    prokaryote: { fa: 'سلول پروکاریوت (باکتری میله‌ای)', en: 'Prokaryotic cell', first: 'nucleoid', draw: drawProk,
      keys: ['pcapsule', 'pwall', 'membrane', 'cytoplasm', 'nucleoid', 'plasmid', 'ribosome', 'flagellum', 'pili'] },
  };
  const QUIZ_SKIP = new Set(['nucleolus', 'envelope']);

  BI.widget('cell-explorer', {
    title: 'کاوشگر سلول',
    desc: 'روی هر اندامک کلیک کن (یا با کلید Tab به آن برو و Enter بزن) تا نام، کارکرد و دستهٔ آن را ببینی. بعد با «آزمونک» خودت را بسنج.',
    mount(body, opts) {
      let cell = CELLS[opts.cell] ? opts.cell : 'animal';
      let sel = CELLS[cell].first;
      const quiz = { on: false, target: null, last: null, asked: 0, right: 0, waiting: false };

      const segBtns = Object.keys(CELLS).map((k) => h('button', { type: 'button', 'aria-pressed': k === cell ? 'true' : 'false', text: CELLS[k].fa, onclick: () => setCell(k) }));
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'نوع سلول' }, segBtns);
      const quizBtn = h('button', { class: 'btn primary', type: 'button', text: 'آزمونک: پیدا کن', onclick: () => (quiz.on ? stopQuiz() : startQuiz()) });
      const fig = h('div', { class: 'ce-fig' });
      const panel = h('div', { class: 'ce-panel', 'aria-live': 'polite' });
      const chips = h('div', { class: 'ce-chips', role: 'group', 'aria-label': 'فهرست بخش‌های سلول' });
      const qText = h('div', { class: 'ce-q', 'aria-live': 'polite' });
      const qScore = h('span', { class: 'pill' });
      const qFb = h('div', { class: 'ce-fb', 'aria-live': 'polite' });
      const nextBtn = h('button', { class: 'btn primary', type: 'button', text: 'سؤال بعد', hidden: true, onclick: () => nextQ() });
      const exitBtn = h('button', { class: 'btn', type: 'button', text: 'خروج از آزمونک', onclick: () => stopQuiz() });
      const quizBox = h('div', { class: 'ce-quiz', hidden: true }, qText, qFb, h('div', { class: 'w-row' }, nextBtn, exitBtn, qScore));
      const note = h('p', { class: 'w-note', html: `<b>دسته‌بندی درس:</b> «عمومی»: غشای پلاسمایی، سیتوپلاسم، هسته، میتوکندری، شبکهٔ آندوپلاسمی، گلژی، پراکسی‌زوم، لیزوزوم، اسکلت سلولی. «موقتی»: کروموزوم‌ها، سانتروزوم‌ها، اندوزوم‌ها. «مخصوص سلول گیاهی»: کلروپلاست، واکوئل مرکزی، دیوارهٔ سلولی.` });
      body.append(h('div', { class: 'w-controls' }, seg, quizBtn), fig, panel, chips, quizBox, note);

      const svgEl = () => fig.querySelector('svg');
      const all = (k) => [...svgEl().querySelectorAll(`.org[data-k="${k}"]`)];

      function render() {
        fig.innerHTML = `<svg viewBox="0 0 640 400" role="group" aria-label="شکل ${esc(CELLS[cell].fa)}">${CELLS[cell].draw()}</svg>`;
        const seen = new Set();
        svgEl().querySelectorAll('.org').forEach((g) => {
          const k = g.dataset.k;
          if (seen.has(k)) return;
          seen.add(k);
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
        });
        labels();
        chips.replaceChildren(...CELLS[cell].keys.map((k) => h('button', { type: 'button', 'data-k': k, 'aria-pressed': 'false', text: ORG[k].fa, onclick: () => pick(k) })));
        if (!quiz.on) select(CELLS[cell].keys.includes(sel) ? sel : CELLS[cell].first);
      }
      function labels() {
        svgEl().querySelectorAll('.org[tabindex]').forEach((g) => g.setAttribute('aria-label', quiz.on ? 'بخشی از سلول' : ORG[g.dataset.k].fa));
      }
      function clearMarks() { svgEl().querySelectorAll('.org').forEach((g) => g.classList.remove('sel', 'good', 'wrong', 'hv')); }
      function select(k) {
        sel = k;
        clearMarks();
        all(k).forEach((g) => g.classList.add('sel'));
        chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k ? 'true' : 'false'));
        const o = ORG[k];
        panel.innerHTML = `<div class="ce-name">${o.fa}</div><div class="ce-en">${esc(o.en)}</div><div><span class="pill ${o.cat === TMP ? 'hl' : o.cat === GEN ? '' : 'ok'}">${o.cat}</span></div><p>${o.fn}</p>`;
      }
      function pick(k, g) {
        if (quiz.on) { if (quiz.waiting) answer(k, g); return; }
        select(k);
      }
      function setCell(k) {
        cell = k;
        segBtns.forEach((b, i) => b.setAttribute('aria-pressed', Object.keys(CELLS)[i] === k ? 'true' : 'false'));
        sel = CELLS[k].first;
        render();
        if (quiz.on) nextQ();
      }

      function startQuiz() {
        quiz.on = true; quiz.asked = 0; quiz.right = 0; quiz.last = null;
        quizBtn.textContent = 'خروج از آزمونک';
        quizBox.hidden = false; panel.hidden = true; chips.hidden = true;
        labels();
        nextQ();
      }
      function stopQuiz() {
        quiz.on = false; quiz.waiting = false;
        quizBtn.textContent = 'آزمونک: پیدا کن';
        quizBox.hidden = true; panel.hidden = false; chips.hidden = false;
        labels();
        select(sel);
      }
      function score() { qScore.textContent = `امتیاز: ${fa(quiz.right)} از ${fa(quiz.asked)}`; }
      function nextQ() {
        const c = CELLS[cell].keys.filter((k) => !QUIZ_SKIP.has(k) && k !== quiz.last);
        quiz.target = c[Math.floor(Math.random() * c.length)];
        quiz.last = quiz.target;
        quiz.waiting = true;
        clearMarks();
        qText.textContent = `«${ORG[quiz.target].fa}» را در شکل پیدا کن و رویش کلیک کن.`;
        qFb.textContent = '';
        nextBtn.hidden = true;
        score();
      }
      function answer(k, g) {
        quiz.waiting = false;
        quiz.asked++;
        const ok = !!(g && g.closest(`.org[data-k="${quiz.target}"]`)) || k === quiz.target;
        if (ok) quiz.right++;
        all(quiz.target).forEach((x) => x.classList.add('good'));
        if (!ok && g) g.classList.add('wrong');
        qFb.innerHTML = ok ? `<b style="color:var(--ok)">درست!</b> این ${ORG[quiz.target].fa} است. ${ORG[quiz.target].fn}`
          : `<b style="color:var(--bad)">نه.</b> آنچه انتخاب کردی «${ORG[k].fa}» بود. «${ORG[quiz.target].fa}» همان بخش سبزرنگ است.`;
        nextBtn.hidden = false;
        score();
      }

      fig.addEventListener('click', (e) => { const g = e.target.closest('.org'); if (g) pick(g.dataset.k, g); });
      fig.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const g = e.target.closest && e.target.closest('.org');
        if (g) { e.preventDefault(); pick(g.dataset.k, g); }
      });
      fig.addEventListener('pointerover', (e) => {
        const g = e.target.closest('.org');
        fig.querySelectorAll('.org.hv').forEach((x) => x.classList.remove('hv'));
        if (g) all(g.dataset.k).forEach((x) => x.classList.add('hv'));
      });
      fig.addEventListener('pointerleave', () => fig.querySelectorAll('.org.hv').forEach((x) => x.classList.remove('hv')));
      render();
    },
  });

  /* ---------------- cell cycle ---------------- */
  const PH = [
    { k: 'g1', label: 'G1', fa: 'فاز G1 (رشد اول)', hours: 11, col: 'info', w: 0.27, desc: 'سلول رشد می‌کند و کارهای عادی خودش را انجام می‌دهد. DNA هنوز همانندسازی نشده است: ۴۶ کروموزوم، هر کدام یک کروماتید، یعنی ۴۶ مولکول DNA دورشته‌ای.' },
    { k: 's', label: 'S', fa: 'فاز S (سنتز DNA)', hours: 8, col: 'hl', w: 0.27, desc: 'DNA همانندسازی می‌شود. هر کروموزوم یک نسخهٔ دقیق از خودش می‌سازد و تعداد مولکول‌های DNA از ۴۶ به ۹۲ می‌رسد.' },
    { k: 'g2', label: 'G2', fa: 'فاز G2 (رشد دوم)', hours: 4, col: 'ok', w: 0.19, desc: 'سلول باز هم رشد می‌کند و بررسی می‌کند همانندسازی درست و کامل انجام شده باشد. حالا ۹۲ مولکول DNA داریم و هر کروموزوم از دو کروماتید خواهری به شکل X ساخته شده است.' },
    { k: 'm', label: 'M', fa: 'فاز M (میتوز و سیتوکینز)', hours: 1, col: 'bad', w: 0.27, desc: 'اول هسته تقسیم می‌شود (میتوز): کروموزوم‌ها ردیف می‌شوند و کروماتیدهای خواهری از هم جدا می‌شوند. بعد سیتوپلاسم تقسیم می‌شود (سیتوکینز). نتیجه دو سلول دختر است که هر کدام ۴۶ مولکول DNA دارند.' },
  ];
  const CHK = [
    { k: 'c1', fa: 'ایست‌گاه G1/S', desc: 'تصمیم شروع تقسیم: آیا سلول به اندازهٔ کافی بزرگ است، مواد و سیگنال‌های رشد کافی هست و DNA آسیب ندیده؟ اگر نه، چرخه همین‌جا می‌ایستد.' },
    { k: 'c2', fa: 'ایست‌گاه G2/M', desc: 'آیا همانندسازی DNA کامل و بدون خطا انجام شده است؟ فقط در این صورت سلول وارد میتوز می‌شود.' },
    { k: 'c3', fa: 'ایست‌گاه دوک (درون M)', desc: 'آیا همهٔ کروموزوم‌ها به رشته‌های دوک وصل شده‌اند و وسط سلول ردیف شده‌اند؟ فقط در این صورت کروماتیدهای خواهری جدا می‌شوند (متافاز به آنافاز).' },
    { k: 'g0', fa: 'G0 (خروج از چرخه)', desc: 'سلول از چرخه بیرون می‌رود و دیگر تقسیم نمی‌شود، ولی زنده می‌ماند و کار خودش را می‌کند؛ مثلاً نورون‌ها.' },
  ];
  const TOT = PH.reduce((a, p) => a + p.hours, 0);
  (() => { let a = 0, tw = 0; PH.forEach((p) => { p.a0 = a; p.a1 = a + 360 * p.hours / TOT; a = p.a1; p.t0 = tw; tw += p.w; p.t1 = tw; }); })();

  function cycleAt(t) {
    t = Math.min(1, Math.max(0, t));
    const ph = PH.find((p) => t < p.t1) || PH[3];
    const f = Math.min(1, (t - ph.t0) / (ph.t1 - ph.t0));
    let dna, cap, stage = ph.k;
    if (ph.k === 'g1') { dna = '46'; cap = 'یک نسخه از هر کروموزوم'; }
    else if (ph.k === 's') { dna = String(46 + Math.round(46 * f)); cap = 'همانندسازی در جریان است؛ بین ۴۶ و ۹۲'; }
    else if (ph.k === 'g2') { dna = '92'; cap = 'همانندسازی کامل شده'; }
    else if (f < 0.35) { dna = '92'; cap = 'هنوز یک سلول؛ کروماتیدها جدا نشده‌اند'; stage = 'm1'; }
    else if (f < 0.7) { dna = '92'; cap = 'در حال تقسیم: ۴۶ + ۴۶'; stage = 'm2'; }
    else { dna = '46'; cap = 'در هر سلول دختر'; stage = 'm3'; }
    const angle = ph.a0 + f * (ph.a1 - ph.a0);
    return { ph, f, dna: +dna, cap, stage, angle };
  }

  function chromoSvg(c) {
    const A = st(null, 'info', 8, 'stroke-linecap:round'), B = st(null, 'hl', 8, 'stroke-linecap:round');
    const X = (x, sty) => `<line x1="${x - 9}" y1="52" x2="${x + 9}" y2="98" ${sty}/><line x1="${x + 9}" y1="52" x2="${x - 9}" y2="98" ${sty}/><circle cx="${x}" cy="75" r="4" ${st('surface', 'ink-2', 1.5)}/>`;
    const cellE = (cx, rx, ry) => `<ellipse cx="${cx}" cy="75" rx="${rx}" ry="${ry}" ${st('surface-2', 'muted', 2)}/>`;
    const nuc = (cx, rx, ry, dashed) => `<ellipse cx="${cx}" cy="75" rx="${rx}" ry="${ry}" ${st('info-soft', 'info', 2, dashed ? 'stroke-dasharray:4 4' : '')}/>`;
    let s = '';
    const { stage, f } = c;
    if (stage === 'g1') s = cellE(150, 120, 62) + nuc(150, 55, 40) + `<line x1="132" y1="52" x2="132" y2="98" ${A}/><line x1="168" y1="52" x2="168" y2="98" ${B}/>`;
    else if (stage === 's') {
      const L = 46 * f;
      s = cellE(150, 120, 62) + nuc(150, 55, 40) + `<line x1="132" y1="52" x2="132" y2="98" ${A}/><line x1="168" y1="52" x2="168" y2="98" ${B}/>` +
        `<line x1="143" y1="52" x2="143" y2="${52 + L}" ${A.replace('"', '"opacity:.55;')}/><line x1="179" y1="52" x2="179" y2="${52 + L}" ${B.replace('"', '"opacity:.55;')}/>`;
    } else if (stage === 'g2') s = cellE(150, 120, 62) + nuc(150, 55, 40) + X(132, A) + X(168, B);
    else if (stage === 'm1') s = cellE(150, 124, 62) + `<circle cx="22" cy="75" r="4" ${st('ink-2')}/><circle cx="278" cy="75" r="4" ${st('ink-2')}/><line x1="22" y1="75" x2="132" y2="75" ${st(null, 'muted', 1)}/><line x1="278" y1="75" x2="168" y2="75" ${st(null, 'muted', 1)}/>` + X(132, A) + X(168, B);
    else if (stage === 'm2') {
      const p = (f - 0.35) / 0.35, d = 70 * p;
      const rod = (x, sty) => `<line x1="${x}" y1="55" x2="${x}" y2="95" ${sty}/>`;
      s = cellE(150, 124 + 10 * p, 62) + `<circle cx="22" cy="75" r="4" ${st('ink-2')}/><circle cx="278" cy="75" r="4" ${st('ink-2')}/>` +
        rod(132 - d, A) + rod(132 + d, A) + rod(168 - d + 6, B) + rod(168 + d - 6, B);
    } else {
      const q = (f - 0.7) / 0.3, off = 20 + 44 * q;
      const one = (cx) => cellE(cx, 56, 52) + nuc(cx, 34, 28) + `<line x1="${cx - 8}" y1="62" x2="${cx - 8}" y2="88" ${st(null, 'info', 6, 'stroke-linecap:round')}/><line x1="${cx + 8}" y1="62" x2="${cx + 8}" y2="88" ${st(null, 'hl', 6, 'stroke-linecap:round')}/>`;
      s = one(150 - off) + one(150 + off);
    }
    return `<svg viewBox="0 0 300 150" role="img" aria-label="وضعیت یک جفت کروموزوم در این مرحله" style="display:block;width:100%;height:auto"><title>یک جفت کروموزوم همتا (آبی از یک والد، نارنجی از والد دیگر)</title>${s}</svg>`;
  }

  BI.widget('cell-cycle', {
    title: 'چرخهٔ سلولی',
    desc: 'روی هر فاز یا ایست‌گاه کلیک کن، یا «پخش چرخه» را بزن و ببین کروموزوم‌ها و تعداد مولکول‌های DNA چطور تغییر می‌کنند.',
    mount(body) {
      const id = uid('cc');
      const CX = 280, CY = 230, R = 112;
      const pt = (a, r) => { const t = a * Math.PI / 180; return [CX + r * Math.sin(t), CY - r * Math.cos(t)]; };
      const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
      let ringSvg = '';
      PH.forEach((p) => {
        const mid = (p.a0 + p.a1) / 2, [tx, ty] = pt(mid, R);
        ringSvg += `<g class="cc-ph" data-k="${p.k}" tabindex="0" role="button" aria-label="${p.fa}"><path class="arc" d="${arc(p.a0 + 0.6, p.a1 - 0.6, R)}" ${st(null, p.col, 34)}/><text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}" text-anchor="middle" style="fill:var(--accent-ink);font-weight:800;font-size:${p.k === 'm' ? 14 : 17}px;pointer-events:none">${p.label}</text></g>`;
      });
      const flag = (c, a, lx, ly) => {
        const [x0, y0] = pt(a, 98), [x1, y1] = pt(a, 146);
        return `<g class="cc-ph" data-k="${c}" tabindex="0" role="button" aria-label="${CHK.find((x) => x.k === c).fa}"><line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" ${st(null, 'ink', 2.5)}/><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${lx}" y2="${ly + (ly < CY ? 8 : -14)}" ${st(null, 'muted', 1)}/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="7" ${st('bad', 'surface', 1.5)}/><text x="${lx}" y="${ly}" text-anchor="middle" style="font-size:12.5px;font-weight:700;direction:rtl">${CHK.find((x) => x.k === c).fa}</text></g>`;
      };
      ringSvg += flag('c1', PH[1].a0, 338, 408) + flag('c2', PH[3].a0, 150, 48) + flag('c3', (PH[3].a0 + PH[3].a1) / 2, 450, 48);
      const g0 = `<g class="cc-ph" data-k="g0" tabindex="0" role="button" aria-label="G0 خروج از چرخه"><line x1="410" y1="208" x2="448" y2="208" ${st(null, 'ink-2', 2.5)}/><polygon points="456,208 446,202 446,214" ${st('ink-2')}/><rect x="458" y="190" width="70" height="36" rx="10" ${st('surface-2', 'ink-2', 2)}/><text x="493" y="214" text-anchor="middle" style="font-weight:800;font-size:16px">G0</text><text x="493" y="246" text-anchor="middle" style="font-size:12px;direction:rtl" class="t-muted">مثلاً نورون‌ها</text></g>`;
      const ringBox = h('div', { class: 'ce-fig' });
      ringBox.innerHTML = `<svg viewBox="0 0 560 440" role="group" aria-label="چرخهٔ سلولی"><circle cx="${CX}" cy="${CY}" r="${R}" ${st(null, 'surface-2', 34)}/>${ringSvg}${g0}<text class="cn-ph t-muted" x="${CX}" y="196" text-anchor="middle" style="font-size:13px;direction:rtl"></text><text class="cn-num" x="${CX}" y="244" text-anchor="middle" style="font-size:40px;font-weight:800;direction:ltr"></text><text x="${CX}" y="266" text-anchor="middle" style="font-size:12px;direction:rtl">مولکول DNA دورشته‌ای</text><text class="cn-cap" x="${CX}" y="284" text-anchor="middle" style="font-size:11px;direction:rtl"></text><circle class="cn-ptr" r="11" ${st('surface', 'ink', 3)} cx="${CX}" cy="${CY - R}"/></svg>`;

      const playBtn = h('button', { class: 'btn primary', type: 'button', text: 'پخش چرخه' });
      const slId = id + '-t';
      const slider = h('input', { type: 'range', min: '0', max: '1000', step: '1', value: '0', id: slId });
      const info = h('div', { class: 'ce-panel', 'aria-live': 'polite' });
      const chromo = h('div', { class: 'ce-fig' });
      const readout = h('div', { class: 'w-out' });
      body.append(
        h('div', { class: 'w-controls' }, playBtn, h('label', { class: 'w-field grow', for: slId }, 'موقعیت در چرخه', slider)),
        h('div', { class: 'cc-grid' }, h('div', { class: 'cc-ring' }, ringBox), h('div', { class: 'cc-side' }, info, chromo, readout)),
        h('p', { class: 'w-note', text: 'اندازهٔ کمان‌ها بر اساس چرخهٔ نمونهٔ ۲۴ ساعته است: G1 حدود ۱۱، S حدود ۸، G2 حدود ۴ و M حدود ۱ ساعت. زمان واقعی در سلول‌های مختلف فرق می‌کند. سرعت پخش یکنواخت نیست تا فاز M کوتاه هم دیده شود.' })
      );
      const svg = ringBox.querySelector('svg');
      let t = 0, sel = 'g1', lastPh = null, raf = 0, playing = false;

      function showSel() {
        svg.querySelectorAll('.cc-ph').forEach((g) => g.classList.toggle('sel', g.dataset.k === sel));
        const p = PH.find((x) => x.k === sel) || CHK.find((x) => x.k === sel);
        info.innerHTML = `<div class="ce-name">${p.fa}</div><p>${p.desc}</p>`;
      }
      function render() {
        const c = cycleAt(t);
        if (c.ph.k !== lastPh) { lastPh = c.ph.k; sel = c.ph.k; showSel(); }
        const [x, y] = pt(c.angle, R);
        const ptr = svg.querySelector('.cn-ptr');
        ptr.setAttribute('cx', x.toFixed(1)); ptr.setAttribute('cy', y.toFixed(1));
        svg.querySelector('.cn-ph').textContent = c.ph.label;
        svg.querySelector('.cn-num').textContent = String(c.dna);
        svg.querySelector('.cn-cap').textContent = c.cap;
        chromo.innerHTML = chromoSvg(c);
        let txt;
        if (c.ph.k === 's') txt = `بین ۴۶ و ۹۲ (در حال همانندسازی): الان <b>${fa(c.dna)}</b>`;
        else if (c.stage === 'm3') txt = `<b>${fa(46)}</b> در هستهٔ هر سلول دختر (دو سلول دختر)`;
        else txt = `<b>${fa(c.dna)}</b>`;
        readout.innerHTML = `<div class="w-note" style="margin:0 0 4px">تعداد مولکول‌های DNA دورشته‌ای در هستهٔ یک سلول انسان</div><div>${c.ph.label}: ${txt}</div><div class="w-note" style="margin:4px 0 0">${c.cap}. هر کروماتید یک مولکول DNA دورشته‌ای است. کروموزوم‌های آبی و نارنجی یک جفت همتا هستند.</div>`;
        slider.value = String(Math.round(t * 1000));
      }
      function stop() { playing = false; cancelAnimationFrame(raf); playBtn.textContent = 'پخش چرخه'; }
      function play() {
        if (reduce()) { t = 1; render(); return; }
        if (t >= 1) t = 0;
        playing = true; playBtn.textContent = 'توقف';
        const dur = 14000, t0 = performance.now(), from = t;
        const step = (now) => {
          if (!playing) return;
          t = Math.min(1, from + (now - t0) / dur);
          render();
          if (t >= 1) stop(); else raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
      playBtn.addEventListener('click', () => (playing ? stop() : play()));
      slider.addEventListener('input', () => { stop(); t = +slider.value / 1000; render(); });
      const choose = (k) => {
        stop();
        const p = PH.find((x) => x.k === k);
        if (p) { t = (p.t0 + p.t1) / 2; if (k === 'g1') t = p.t0 + (p.t1 - p.t0) * 0.5; lastPh = p.k; sel = k; render(); showSel(); }
        else { sel = k; showSel(); }
      };
      svg.addEventListener('click', (e) => { const g = e.target.closest('.cc-ph'); if (g) choose(g.dataset.k); });
      svg.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const g = e.target.closest && e.target.closest('.cc-ph');
        if (g) { e.preventDefault(); choose(g.dataset.k); }
      });
      render();
      showSel();
    },
  });
})();
