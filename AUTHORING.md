# راهنمای نوشتن فصل‌ها و ابزارها (Authoring guide)

This file is the contract for everyone who writes a chapter page, a chapter data file or an
interactive widget for this site. Read it fully before writing anything. The finished example
to imitate is **`chapters/04-dna.html` + `assets/data/ch04.js` + `assets/js/widgets/dna.js`** —
open all three first.

## 1. The project in one paragraph

A static study site (plain HTML/CSS/JS, no build step, deployed to GitHub Pages) that replaces
the missing lecture notes of a Persian university course "مباحث ویژه در علوم کامپیوتر —
بیوانفورماتیک". The reader is a **computer-science student with zero biology background** who
must pass the instructor's exams (sample midterm style: 4-option MCQ, fill-in-the-blank, a
figure question, short essay questions). All prose is **Persian**, right-to-left. The teaching
method is evidence-based (see §4). Accuracy matters more than length: never invent facts that
contradict the slides or standard textbooks (Alberts, *Essential Cell Biology*).

## 2. Files

```
index.html  exam.html  flashcards.html  glossary.html  cheatsheet.html
chapters/NN-slug.html            one page per chapter (see registry in assets/js/core.js)
assets/css/style.css             shared styles — DO NOT EDIT (ask the orchestrator)
assets/js/core.js                shell + components — DO NOT EDIT
assets/js/widgets/<file>.js      interactive widgets, one file per group
assets/data/chNN.js              flashcards, glossary and exam questions of one chapter
```

Only write the files you were assigned. Never edit style.css or core.js. If you need a
component that does not exist, write it with existing classes or inline `style="..."` that uses
CSS variables only, and mention it in your report.

Source material (extracted from the instructor's PDFs) lives in the scratchpad given in your
brief: `out/src1/text.txt` (file 1, 168 slides: biology + start of data), `out/src3/text.txt`
(file 3, 105 slides: gene expression → file formats → coverage → GEO), `out/src2/text.txt`
(file 2, 51 slides: alignment). Contact sheets of slide images: `sheets/A_###.png` (file 1,
9 slides per image, first slide number in the name), `sheets/B_###.png` (file 3, 12 per image),
`sheets/C_###.png` (file 2, 9 per image). The PDF text extraction of Persian is sometimes
scrambled (word order, broken letters); use the images to resolve doubts.

## 3. Chapter page template

Copy the `<head>` exactly from `chapters/04-dna.html` and change only `<title>`,
`<meta name="description">` and `<body data-chapter="chNN">`. The title format is
`<chapter title> · جزوهٔ بیوانفورماتیک`. Everything visible goes inside
`<main class="chapter"> … </main>`. core.js adds the top bar, side navigation, on-page outline,
section numbers, chapter end box and prev/next links — do not write those yourself.

Block order inside `<main>` (keep it):

1. `<header class="hero" data-src="فایل ۱ (advance_bio_part1)، اسلایدهای ۹۶ تا ۱۲۱" data-motif="ACGU...">`
   with `<h1>` (chapter title from the registry) and `<p class="lead">` — a hook: a concrete
   question or puzzle the chapter answers. `data-motif` is 20–30 letters of A/C/G/T/U shown as a
   decorative strip (use a sequence that appears in the chapter).
2. `<section class="objectives"><p class="obj-title">بعد از این فصل می‌توانی:</p><ul>…</ul></section>`
   — 4–6 objectives, each starting with a measurable verb in bold (توضیح بدهی، حساب کنی، مقایسه کنی، رسم کنی، نام ببری …).
3. One **pretest** question (`.quiz` with `data-label="پیش‌آزمون — قبل از خواندن حدس بزن؛ نمره ندارد"`).
4. 5–9 content sections, each `<h2 id="kebab-id">Persian title</h2>` (no numbers; core.js numbers them),
   `<h3>` for sub-parts. Each section mixes: explanation → diagram/table → callout(s) →
   a `details.think` prompt or a quick `.quiz`/`.fill` → (where it fits) a `.worked` example and a widget.
5. `<h2 id="summary" class="no-num">خلاصه در یک نگاه</h2><div class="summary"><ul>…</ul></div>` — 6–9 bullets.
6. `<h2 id="exam" class="no-num">سؤال‌های سبک امتحان</h2>` + one intro line + `<div data-render="questions"></div>`
7. `<h2 id="cards" class="no-num">کارت‌های مرور</h2>` + one line + `<div data-render="cards"></div>`
8. `<h2 id="terms" class="no-num">واژه‌های این فصل</h2><div data-render="glossary"></div>`

Length guide: 2,000–4,500 Persian words of prose per chapter (shorter for small topics), at least 3 inline SVG figures (or
2 figures + 1 widget), at least 2 `details.think`, 2 inline quizzes/fills, 1 worked example
where the topic has any calculation or procedure.

## 4. Teaching method (apply everywhere)

The page should *teach*, not summarise the slides. Use these evidence-based techniques:

- **Retrieval practice** (Roediger & Karpicke 2006; Dunlosky et al. 2013 rate it "high utility"):
  frequent low-stakes questions with immediate feedback that *explains* why (`.explain`).
- **Pretesting / prequestions**: one guess question before teaching.
- **Elaborative interrogation**: `details.think` prompts that ask *why/how*; many slides already
  contain such "Question?" slides — turn every one of them into a think prompt and answer it correctly.
- **Worked examples → practice** (Sweller's worked-example effect): show a fully solved example
  step by step (`.worked`), then give a similar problem to solve (`.fill` or `.quiz`).
- **Dual coding / multimedia** (Paivio; Mayer): every key process gets a diagram; put labels
  inside the diagram, keep captions short; segment long processes into numbered steps.
- **Concrete examples & analogies**: the reader is a CS student — use `callout analogy` with
  programming analogies (string, function call, hash table, cache, compile, version control…).
  Do not overuse: about one per section, only where it truly helps.
- **Signalling**: `callout exam` for things the instructor clearly emphasises or that appeared on
  the sample midterm; `callout pitfall` for common misconceptions.
- **Spacing & interleaving** are handled by the flashcards page and the mixed exam generator;
  your job is to write good cards and questions in the data file.
- **Learning objectives** (Bloom, revised by Anderson & Krathwohl): measurable verbs.

## 5. Writing style

- Persian, warm and direct, second person singular ("می‌بینی", "حساب کن"). Short sentences.
  Explain every new term the first time it appears. Never assume biology knowledge.
- Use the zero-width non-joiner correctly: «می‌شود»، «سلول‌ها»، «پروتئین‌ها». Use Persian
  digits in prose (۱۲۳), Latin digits inside code, sequences, formulas in `<code>`, and widgets.
- First use of a technical term: `<span class="term" data-en="Transcription">رونویسی</span>`
  (renders as «رونویسی (Transcription)»). Later uses: plain Persian, or the English word if the
  field normally uses it (PCR, FASTQ, read…).
- DNA/RNA sequences: `<code class="seq">5′-AUGGCC-3′</code>` (core.js colours the letters).
  Use the prime character ′ (U+2032) for 5′/3′. Long sequences: `<code class="seq-block">…</code>`.
- Formulas: `<code>C = L × N / G</code>` or a centred paragraph.
- No emoji. No "lorem". Avoid mannered phrasing (dramatic dashes, "not X but Y" formulas, scare quotes).
- Refer to slides when useful: «(اسلاید ۱۱۹)». The hero `data-src` names the file and slide range.
- Every factual claim must agree with the slides; where the slides are vague, use standard
  textbook facts (Alberts). Answer the instructor's in-slide questions correctly.

## 6. Components (HTML you can use)

```html
<aside class="callout simple"><p>…</p></aside>   <!-- «به زبان ساده» -->
<aside class="callout analogy"><p>…</p></aside>  <!-- «قیاس کامپیوتری» -->
<aside class="callout exam"><p>…</p></aside>     <!-- «نکتهٔ امتحانی» -->
<aside class="callout pitfall"><p>…</p></aside>  <!-- «اشتباه رایج» -->
<aside class="callout story"><p>…</p></aside>    <!-- «پشت صحنهٔ علم» (history) -->
<aside class="callout key"><p>…</p></aside>      <!-- «نکتهٔ کلیدی» -->
<aside class="callout deep"><p>…</p></aside>     <!-- optional depth -->
<aside class="callout" data-label="any label"><p>…</p></aside>

<details class="think"><summary>Question text?</summary><div><p>Answer…</p></div></details>
<details class="more"><summary>Title</summary><div>…</div></details>   <!-- optional extra -->

<!-- inline multiple choice: mark the right <li> with data-correct; .explain is shown after answering -->
<div class="quiz" data-id="ch06:s3"><p class="q">…؟</p>
  <ol class="opts"><li>…</li><li data-correct>…</li><li>…</li><li>…</li></ol>
  <div class="explain">Why…</div></div>

<!-- fill in the blank: answers separated by |, matching ignores spaces/ZWNJ/case/punctuation -->
<div class="fill" data-answer="GGTACA|5GGTACA3" data-id="ch06:f1">
  <p class="q">… <input class="blank" type="text"> …</p><div class="explain">…</div></div>

<!-- short essay with model answer and self-check points -->
<div class="essay" data-id="ch06:e1"><p class="q">…</p>
  <div class="answer"><p>model answer…</p><ul class="points"><li>key point 1</li><li>…</li></ul></div></div>

<!-- worked example: steps are revealed one by one; .after-steps shows at the end -->
<div class="worked" data-title="Title"><p class="problem">…</p>
  <ol class="steps"><li>…</li><li>…</li></ol><p class="after-steps"><b>پاسخ:</b> …</p></div>

<ol class="steps"><li>…</li></ol>                       <!-- numbered process (static) -->
<div class="compare"><div><h4>A</h4><p>…</p></div><div><h4>B</h4><p>…</p></div></div>
<table>…</table>                                        <!-- auto-wrapped in a scroll box -->
<pre data-lang="PYTHON"><code>…</code></pre>            <!-- spans .k keyword .s string .c comment .n number -->
<figure class="fig"><svg …>…</svg><figcaption><b>شکل ۶.۲</b> — …</figcaption></figure>
<div data-widget="splicing" data-…="…"></div>           <!-- see §8 -->
```

`data-id` on inline quizzes: `chNN:` + a short unique name. Figure numbers: `شکل <chapter>.<k>`.

## 7. Inline SVG diagrams

- `viewBox` + `width="<viewBox width>"` (e.g. `viewBox="0 0 720 260" width="720"`). Keep the
  viewBox ≤ 760 wide. On phones the figure scrolls horizontally (min 34rem); for a small figure
  that should shrink instead, add `class="fig compact"`.
- Include `role="img"`, `aria-labelledby` and a `<title>` with a Persian description.
- **Colours only through classes** (never hex, never `fill="var(...)"` attributes — they fail in
  some browsers): fills `.f-a .f-t .f-g .f-c .f-u` (nucleotides), `.f-accent .f-accent-soft
  .f-surface .f-surface-2 .f-ink .f-ink-2 .f-muted .f-line .f-hl .f-hl-soft .f-ok .f-ok-soft
  .f-bad .f-bad-soft .f-info .f-info-soft .f-warn .f-warn-soft .f-none`; strokes `.s-a … .s-u
  .s-accent .s-ink .s-ink-2 .s-muted .s-line .s-hl .s-ok .s-bad .s-info .s-warn`; text
  `.t-muted .t-ink-2 .t-white .t-accent .t-hl`, `class="mono"` for monospace. Plain `<text>`
  already uses the ink colour and the Persian font. Persian text: add `style="direction:rtl"`
  when the text mixes Persian and Latin. White text only on saturated fills (.f-a, .f-t, .f-c,
  .f-g, .f-accent, .f-hl, .f-info, .f-ok, .f-bad).
- Animations: classes `.anim-pulse`, `.anim-flow` (dashed stroke flowing), `.anim-float`, or SMIL
  `<animate>`; keep them gentle (the site honours prefers-reduced-motion for CSS animations).
- `id`s inside SVG (markers, gradients) must be unique on the page: prefix with the figure name
  (e.g. `tr-ah`). Arrowhead marker example is in 04-dna.html (`hc-ah`).
- Keep labels inside the viewBox and away from shapes; check font-size ≥ 11.
- Draw the mechanism, not decoration: label every part the text talks about.

## 8. Widgets

Embed with `<div data-widget="NAME" data-opt="…"></div>`. core.js loads the file, builds the
frame (title, badge, description) and calls the widget. Optional on any widget:
`data-title`, `data-desc` (override texts). Available names and options:

| name | file | options | what it does |
|---|---|---|---|
| `dna-tools` | dna.js | `data-seq` | complement, reverse complement, GC%, H-bonds, ladder |
| `chargaff` | dna.js | `data-a` (A%) | Chargaff's rule calculator, single vs double strand |
| `transcribe-translate` | dogma.js | `data-seq` (DNA coding strand) | coding/template strands → mRNA → codons → protein, ribosome step-through |
| `codon-table` | dogma.js | `data-highlight` (e.g. `Leu`) | interactive 64-codon table, search an amino acid, start/stop |
| `reading-frames` | dogma.js | `data-seq`, `data-strands` (`3`/`6`) | 3 or 6 reading frames, stops and ORFs |
| `splicing` | dogma.js | `data-exons` (count, default 4) | animated intron removal + cap/poly-A; alternative-splicing isoform counter |
| `dogma-locations` | dogma.js | — | exam figure task: where each central-dogma step happens in eukaryote vs prokaryote |
| `cell-explorer` | cell.js | `data-cell` (`animal`/`plant`/`prokaryote`) | clickable cell diagram with organelle functions and a find-the-organelle quiz |
| `cell-cycle` | cell.js | — | G1/S/G2/M wheel, checkpoints, DNA molecules per phase |
| `pcr` | lab.js | `data-cycles`, `data-start` | thermal cycle animation, 2ⁿ growth, linear/log chart |
| `qpcr` | lab.js | — | amplification curves, threshold, Ct values |
| `sanger` | lab.js | `data-seq` | chain termination fragments → gel → read sequence |
| `microarray` | lab.js | — | two-colour chip, log2(R/G), background correction |
| `normalize` | data.js | `data-preset` (`slide42`,`outlier`,`cells`,`count`,`quantile3`) | min-max / mean / median / quantile with steps |
| `phred` | data.js | `data-qual` | char ↔ ASCII ↔ Q ↔ error probability, quality-string decoder |
| `fastq-parse` | data.js | — | parse a FASTQ record, validate, per-base quality, TRAILING trimming |
| `coverage` | data.js | `data-l`,`data-n`,`data-g` | Lander–Waterman calculator + random read pile-up simulation (depth, breadth) |
| `cell-vectors` | data.js | — | cells as gene-expression vectors, distances, 2-D scatter |
| `naive-search` | align.js | `data-ref`,`data-read` | brute-force sliding comparison + cost estimator (the 9.5-years slide) |
| `dp-align` | align.js | `data-mode` (`global`/`local`), `data-a`,`data-b` | Needleman–Wunsch / Smith–Waterman matrix fill + traceback |
| `kmer` | index.js | `data-seq`,`data-k` | k-mer sliding window, L−k+1, pigeonhole blocks demo |
| `hash-index` | index.js | `data-ref`,`data-k` | k-mer hash index of a reference, seed lookup for a read |
| `trie` | index.js | `data-words` (comma list) | build/draw a trie, search a pattern |
| `bwt` | index.js | `data-text`,`data-pattern` | rotations → sorted matrix → BWT, C/Occ tables, backward search |

### Writing a widget (only for widget authors)

```js
/* widgets/<file>.js */
(() => {
  'use strict';
  const { h, fa, esc, colorSeq } = BI;          // helpers from core.js
  BI.css('w-<file>', `...scoped CSS using var(--tokens) only...`);
  BI.widget('name', {
    title: 'Persian title',
    desc: 'One or two Persian sentences telling the learner what to try.',
    mount(body, opts, el) { /* build UI inside body; opts = el.dataset */ },
  });
})();
```

Helpers: `BI.h(tag, attrs, ...children)` (attrs: `class`, `text`, `html`, `onclick`…),
`BI.fa(n)` Persian digits, `BI.esc(s)`, `BI.colorSeq(s)` (HTML with coloured bases),
`BI.store.get/set` (localStorage, never throws), `BI.css(id, text)`.
Shared widget classes in style.css: `.w-controls`, `.w-field` (+ `.grow`), `.w-out`, `.w-row`,
`.w-kv` (`.k`/`.v`), `.w-note`, `.w-err`, `.w-table` (+ `td.hit`, `td.path`, `td.cur`),
`.w-seq`, `.bar-row` (+ `.track`, `.fill`), `.pill` (`.ok`/`.bad`/`.hl`), `.seg` (button group
with `aria-pressed`), `.btn` (`.primary`/`.ghost`/`.ok`/`.bad`), inputs `class="mono"`.

Rules: every colour from CSS variables (works in light and dark themes); open in a useful,
pre-filled state (never an empty box); validate input and explain errors in Persian; labels in
Persian, sequences/numbers LTR; must fit a 360 px wide phone (wrap controls, put wide tables or
SVGs inside an `overflow-x:auto` box); give every input an `id` and a `<label for>`; use
`requestAnimationFrame`/`setTimeout` for animations and stop them when finished; respect
`matchMedia('(prefers-reduced-motion: reduce)')` (jump to the end state). No external libraries.
Several instances of the same widget can be on one page — never use global ids; generate them.

## 9. Chapter data file (`assets/data/chNN.js`)

```js
BI.data('chNN', {
  cards: [ { q: 'question (HTML allowed)', a: 'answer' }, … ],          // 14–22 cards
  glossary: [ { fa: 'رونویسی', en: 'Transcription', def: 'one-sentence definition' }, … ], // 12–25 terms
  questions: [                                                          // 12–18 questions
    { type: 'mcq', q: '…', options: ['…','…','…','…'], answer: 1, explain: '…', src: 'optional tag' },
    { type: 'tf',  q: '…', answer: true, explain: '…' },
    { type: 'fill', q: 'text with ____ blank', answer: ['main answer', 'accepted variant'], explain: '…' },
    { type: 'essay', q: '…', answer: '<p>model answer</p>', points: ['key point', …] },
  ],
});
```

- `answer` for mcq is the 0-based index. Options in the instructor's style (4 options, one
  correct, plausible distractors; "هیچکدام" is allowed). Mix: ~50% mcq, ~15% tf, ~20% fill, ~15% essay.
- Questions must test understanding and calculation, not trivia. Include every in-slide question
  and practice problem of the chapter's slides, solved. Use `src: 'میان‌ترم'` only for questions
  that literally appear in the sample midterm.
- `explain` always says *why* (and why the tempting wrong answer is wrong).
- Cards: one fact or one reasoning step per card, answer short (≤ 2 sentences).
- Must be valid JavaScript (run `node --check assets/data/chNN.js`) and pass `node tools/check.mjs`.

## 10. Self-check before you report

Run `node tools/check.mjs` from the repo root — it validates structure, widget names and data
files. Then re-read your page once for: correct facts, consistent terms, no English sentences
left untranslated, every `.quiz` has exactly one `data-correct`, every think prompt has an answer.
