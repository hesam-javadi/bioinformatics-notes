// node tools/check.mjs [chNN ...]  — structural checks for chapters, data files and widgets.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const core = fs.readFileSync(path.join(root, 'assets/js/core.js'), 'utf8');
const chapters = [...core.matchAll(/\{ id: '(ch\d\d)', n: (\d+), part: '(p\d)', file: '([^']+)'/g)].map((m) => ({ id: m[1], file: m[4] }));
const widgetMap = Object.fromEntries([...core.matchAll(/'([a-z-]+)': '([a-z]+\.js)'/g)].map((m) => [m[1], m[2]]));
const only = process.argv.slice(2);
let errors = 0, warnings = 0;
const err = (f, m) => { errors++; console.log(`  ERROR ${f}: ${m}`); };
const warn = (f, m) => { warnings++; console.log(`  warn  ${f}: ${m}`); };

function checkHtml(c) {
  const f = path.join(root, 'chapters', c.file);
  if (!fs.existsSync(f)) { warn(c.file, 'missing (not written yet)'); return; }
  const s = fs.readFileSync(f, 'utf8');
  const need = [
    ['data-root=".."', 'html data-root=".."'],
    [`data-chapter="${c.id}"`, `body data-chapter="${c.id}"`],
    ['../assets/js/core.js', 'core.js script'],
    ['../assets/css/style.css', 'stylesheet'],
    ['<main class="chapter">', '<main class="chapter">'],
    ['class="hero"', 'hero header'],
    ['class="objectives"', 'objectives section'],
    ['data-render="questions"', 'questions block'],
    ['data-render="cards"', 'cards block'],
    ['data-render="glossary"', 'glossary block'],
  ];
  for (const [needle, label] of need) if (!s.includes(needle)) err(c.file, `missing ${label}`);
  for (const m of s.matchAll(/data-widget="([^"]+)"/g)) if (!widgetMap[m[1]]) err(c.file, `unknown widget "${m[1]}"`);
  if (/fill="var\(|stroke="var\(/.test(s)) err(c.file, 'SVG uses fill/stroke="var(...)" attribute — use classes');
  if (/#[0-9a-fA-F]{6}\b/.test(s.replace(/<style[\s\S]*?<\/style>/g, ''))) warn(c.file, 'hex colour literal found (use tokens/classes)');
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) err(c.file, `duplicate ids: ${[...new Set(dup)].join(', ')}`);
  for (const tag of ['div', 'section', 'aside', 'details', 'figure', 'svg', 'ol', 'ul', 'table', 'p', 'g']) {
    const open = (s.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (s.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) err(c.file, `<${tag}> open ${open} vs close ${close}`);
  }
  const quizzes = s.split('class="quiz"').slice(1);
  quizzes.forEach((q, i) => {
    const body = q.split('</ol>')[0];
    const n = (body.match(/data-correct/g) || []).length;
    if (n !== 1) err(c.file, `quiz #${i + 1} has ${n} data-correct`);
  });
  const h2 = (s.match(/<h2 /g) || []).length;
  const figs = (s.match(/class="fig/g) || []).length;
  const think = (s.match(/class="think"/g) || []).length;
  const words = s.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /[؀-ۿ]/.test(w)).length;
  console.log(`  ${c.file}: ~${words} Persian words, ${h2} h2, ${figs} figures, ${think} think, ${quizzes.length} quizzes, widgets: ${[...s.matchAll(/data-widget="([^"]+)"/g)].map((m) => m[1]).join(',') || '-'}`);
}

function checkData(c) {
  const f = path.join(root, 'assets/data', c.id + '.js');
  if (!fs.existsSync(f)) { warn(c.id + '.js', 'missing (not written yet)'); return; }
  let got = null;
  try {
    vm.runInNewContext(fs.readFileSync(f, 'utf8'), { BI: { data: (id, d) => { got = { id, d }; } } }, { filename: f });
  } catch (e) { err(c.id + '.js', 'JS error: ' + e.message); return; }
  if (!got) { err(c.id + '.js', 'BI.data(...) not called'); return; }
  if (got.id !== c.id) err(c.id + '.js', `BI.data id is "${got.id}"`);
  const d = got.d || {};
  const F = c.id + '.js';
  if (!Array.isArray(d.cards) || d.cards.length < 8) warn(F, `cards: ${d.cards ? d.cards.length : 0}`);
  (d.cards || []).forEach((x, i) => { if (!x.q || !x.a) err(F, `card ${i} needs q and a`); });
  if (!Array.isArray(d.glossary) || d.glossary.length < 6) warn(F, `glossary: ${d.glossary ? d.glossary.length : 0}`);
  (d.glossary || []).forEach((x, i) => { if (!x.fa || !x.def) err(F, `glossary ${i} needs fa and def`); });
  if (!Array.isArray(d.questions) || d.questions.length < 8) warn(F, `questions: ${d.questions ? d.questions.length : 0}`);
  (d.questions || []).forEach((q, i) => {
    const t = `question ${i} (${q.type})`;
    if (!q.q) err(F, `${t} has no q`);
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) err(F, `${t} options`);
      else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(F, `${t} answer index ${q.answer}`);
    } else if (q.type === 'tf') { if (typeof q.answer !== 'boolean') err(F, `${t} answer must be boolean`); }
    else if (q.type === 'fill') { if (!q.answer || (Array.isArray(q.answer) && !q.answer.length)) err(F, `${t} answer`); }
    else if (q.type === 'essay') { if (!q.answer && !(q.points && q.points.length)) err(F, `${t} needs answer or points`); }
    else err(F, `${t} unknown type`);
  });
  const types = (d.questions || []).reduce((a, q) => ((a[q.type] = (a[q.type] || 0) + 1), a), {});
  console.log(`  ${F}: ${d.cards?.length || 0} cards, ${d.glossary?.length || 0} terms, questions ${JSON.stringify(types)}`);
}

function checkWidgets() {
  const dir = path.join(root, 'assets/js/widgets');
  const files = [...new Set(Object.values(widgetMap))];
  for (const file of files) {
    const f = path.join(dir, file);
    if (!fs.existsSync(f)) { warn(file, 'missing (not written yet)'); continue; }
    const src = fs.readFileSync(f, 'utf8');
    try { new vm.Script(src, { filename: file }); } catch (e) { err(file, 'syntax: ' + e.message); continue; }
    const names = [...src.matchAll(/BI\.widget\('([a-z-]+)'/g)].map((m) => m[1]);
    const expected = Object.entries(widgetMap).filter(([, v]) => v === file).map(([k]) => k);
    for (const n of expected) if (!names.includes(n)) err(file, `does not register "${n}"`);
    if (/#(?!fff\b|ffffff\b|000\b)[0-9a-fA-F]{6}\b|#(?!fff\b|000\b)[0-9a-fA-F]{3}\b/.test(src.replace(/&#\d+;/g, ''))) warn(file, 'hex colour literal (prefer var(--token))');
    console.log(`  ${file}: registers ${names.join(', ')}`);
  }
}

console.log('Chapters:');
for (const c of chapters) if (!only.length || only.includes(c.id)) { checkHtml(c); checkData(c); }
if (!only.length) { console.log('Widgets:'); checkWidgets(); }
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
