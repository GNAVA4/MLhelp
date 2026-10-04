// ОДНОРАЗОВЫЙ перенос вопросов из HTML курса в банк questions/<topicId>.json (session 004).
// После переноса банк — источник истины для тренировок; правки — в questions/, а не здесь.
// Повторный запуск перезаписал бы банк и выдал НОВЫЕ id (вся память повторения потеряется), поэтому без --force не работает.
//
// Источники: тесты blockN_quiz_data.js / встроенные в block3_quiz, block7_quiz (mcq);
// Q&A страниц content-legacy (card); Q&A и задачи у доски блока 0 — из content-src (<tex> → $…$).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { JSDOM } = require('jsdom');
const { extractConsts, loadQuizData } = require('./lib-extract.js');

const ROOT = path.join(__dirname, '..'), LEG = path.join(ROOT, 'content-legacy'), SRC = path.join(ROOT, 'content-src');
const OUT = path.join(ROOT, 'questions');
if (fs.existsSync(OUT) && !process.argv.includes('--force')) {
  console.error('questions/ уже существует — перенос делается один раз. Перезапись выдаст новые id и сотрёт память повторения. --force, если точно нужно.');
  process.exit(1);
}

const usedIds = new Set();
function newId() {
  for (;;) {
    const id = 'q' + crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, '').toLowerCase().slice(0, 7);
    if (id.length === 8 && !usedIds.has(id)) { usedIds.add(id); return id; }
  }
}
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const unnumber = (s) => s.replace(/^\s*\d+\.\s*/, '');
// В тестах формулы $…$ и HTML-теги вперемешку с «<» в обычном тексте (p < 0.05). Приводим к HTML: «<» вне формул и
// вне разрешённых тегов экранируем; TeX внутри $…$ остаётся сырым.
const SAFE_TAG = /^<\/?(strong|b|em|i|code|br|sub|sup|span|u|small)\b[^<>]*>/i;
function plainToHtml(s) {
  if (s == null) return s;
  const parts = String(s).split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/);
  return parts.map((p, i) => {
    if (i % 2) return p;
    let r = '';
    for (let k = 0; k < p.length; k++) {
      if (p[k] === '<') { const t = SAFE_TAG.exec(p.slice(k)); if (t) { r += t[0]; k += t[0].length - 1; } else r += '&lt;'; }
      else r += p[k];
    }
    return r;
  }).join('');
}
// В HTML, сериализованном jsdom, внутри $…$ стоят сущности (&lt;) — возвращаем сырой TeX.
const decodeMath = (h) => h.replace(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g, (m) => m.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '));
const texTags = (h) => h.replace(/<texd>([\s\S]*?)<\/texd>/g, (m, t) => '$$' + t.trim() + '$$').replace(/<tex>([\s\S]*?)<\/tex>/g, (m, t) => '$' + t.trim() + '$');

// ---------- темы ----------
const { DATA } = extractConsts(path.join(LEG, 'index_roadmap.html'), ['DATA'], "const P1='p1', P2='p2', P3='p3';");
const TOPIC_FILE = /^block(\d+)_(\d+)_[\w]+\.html$/;
const topics = [];
for (const b of DATA) for (const t of b.topics) {
  const m = TOPIC_FILE.exec(t.f || '');
  if (m) topics.push({ id: m[1] + '.' + (+m[2]), blockId: String(b.n), file: t.f, title: t.t.replace(/^\d+\.\d+\s+/, '') });
}
const bank = Object.fromEntries(topics.map((t) => [t.id, { topic: t.id, title: t.title, questions: [] }]));
const fileTopics = (blockId) => topics.filter((t) => t.blockId === blockId).map((t) => t.id);

// ---------- mcq из тестов ----------
const PART_MAP = { '7': ['7.1', '7.1', '7.2', '7.3', '7.4'] };
for (const n of ['1', '2', '3', '4', '6', '7', '8', '9']) {
  const qf = path.join(LEG, 'block' + n + '_quiz.html');
  let items, srcName;
  if (n === '3') { items = extractConsts(qf, ['QUESTIONS']).QUESTIONS.map((x) => ({ p: +x.t.slice(1) - 1, q: x.q, o: x.opts, c: x.ans, e: x.ex })); srcName = 'block3_quiz.html'; }
  else if (n === '7') { items = extractConsts(qf, ['Q']).Q; srcName = 'block7_quiz.html'; }
  else { items = loadQuizData(path.join(LEG, 'block' + n + '_quiz_data.js')); srcName = 'block' + n + '_quiz_data.js'; }
  const map = PART_MAP[n] || fileTopics(n);
  items.forEach((x, i) => {
    const tid = map[x.p];
    if (!tid) throw new Error('block ' + n + ' q' + i + ': часть ' + x.p + ' без темы');
    bank[tid].questions.push({ id: newId(), type: 'mcq', q: plainToHtml(x.q), options: x.o.map(plainToHtml), correct: x.c, explanation: plainToHtml(x.e) || undefined, src: srcName + '#' + (i + 1) });
  });
}

// ---------- карточки: Q&A старых страниц ----------
function legacyQA(file) {
  const doc = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  const out = [];
  const add = (qEl, aHtml, tagEls) => {
    const q = qEl.cloneNode(true);
    q.querySelectorAll('.qch, .tag').forEach((x) => x.remove());
    const text = unnumber(clean(q.innerHTML.replace(/<span[^>]*>|<\/span>/g, '')));
    if (!text) return;
    const tags = [...tagEls].map((x) => clean(x.textContent)).filter(Boolean);
    out.push({ q: decodeMath(text), a: decodeMath(aHtml.trim()), tags });
  };
  for (const d of doc.querySelectorAll('details.qa, details.qi')) {
    const sum = d.querySelector(':scope > summary'); if (!sum) continue;
    const rest = [...d.children].filter((c) => c !== sum);
    // ответ — содержимое единственного div.qa, иначе всё после summary
    const a = rest.length === 1 && rest[0].matches('div.qa, div.qa-a') ? rest[0].innerHTML : rest.map((c) => c.outerHTML).join('');
    add(sum, a, sum.querySelectorAll('.tag'));
  }
  for (const d of doc.querySelectorAll('div.qa')) {
    if (d.closest('details')) continue;
    const q = d.querySelector(':scope > .q') || d.querySelector(':scope > b, :scope > strong');
    if (!q) continue;
    const a = d.querySelector(':scope > .a');
    const ans = a ? a.innerHTML : [...d.childNodes].filter((x) => x !== q).map((x) => x.outerHTML ?? x.textContent).join('');
    add(q, ans, []);
  }
  return out;
}

// ---------- карточки блока 0: из исходников ----------
function srcQA(file) {
  const s = fs.readFileSync(file, 'utf8');
  const qa = [...s.matchAll(/<details class="qa"><summary>([\s\S]*?)<\/summary><div class="qa-a">([\s\S]*?)<\/div><\/details>/g)]
    .map((m) => ({ q: unnumber(clean(texTags(m[1]))), a: texTags(m[2]).trim(), tags: [] }));
  const tasks = [...s.matchAll(/<div class="task">\s*<div class="task-h">([\s\S]*?)<\/div>\s*<div class="task-q">([\s\S]*?)<\/div>\s*<details><summary>[\s\S]*?<\/summary><div class="sol">([\s\S]*?)<\/div><\/details>/g)]
    .map((m) => ({ q: '<b>' + clean(m[1]).replace(/^Задача\s+\d+\s*·\s*/, '') + '.</b> ' + clean(texTags(m[2])), a: texTags(m[3]).trim(), tags: ['задача у доски'] }));
  return { qa, tasks };
}

for (const t of topics) {
  const src = path.join(SRC, t.file.replace(/\.html$/, '.src.html'));
  let cards;
  if (fs.existsSync(src)) {
    const { qa, tasks } = srcQA(src);
    const expected = (fs.readFileSync(src, 'utf8').match(/<details class="qa">/g) || []).length;
    if (qa.length !== expected) throw new Error(t.id + ': Q&A ' + qa.length + ' из ' + expected + ' — разметка не распознана');
    cards = [...qa.map((x, i) => ({ ...x, src: path.basename(src) + '#qa' + (i + 1) })), ...tasks.map((x, i) => ({ ...x, src: path.basename(src) + '#task' + (i + 1) }))];
  } else {
    cards = legacyQA(path.join(LEG, t.file)).map((x, i) => ({ ...x, src: t.file + '#qa' + (i + 1) }));
  }
  for (const c of cards) bank[t.id].questions.push({ id: newId(), type: 'card', q: c.q, a: c.a, tags: c.tags.length ? c.tags : undefined, src: c.src });
}

// ---------- доллары-валюта ----------
// В этих вопросах «$» — валюта ($139/год, ~$1), а не формула; MathJax на старых страницах тоже показывал их криво.
// Список найден вручную (session 004): непарные $ и «формулы» с кириллицей. Экранируем как &#36; только поля,
// где валюта действительно есть (в остальных вопросах эвристика давала ложные срабатывания на \text{…}).
const CURRENCY_SRC = new Set(['block3_02_demand_forecasting.html#qa11', 'block3_quiz.html#27', 'block3_03_fraud_detection.html#qa1',
  'block3_03_fraud_detection.html#qa7', 'block3_03_fraud_detection.html#qa11', 'block3_quiz.html#42', 'block8_quiz_data.js#85', 'block8_06_ssl.html#qa1']);
const looksLikeCurrency = (s) => /\$\s?\d|\d\$|\(\$\)/.test(s) && (((s.replace(/\$\$/g, '').match(/\$/g) || []).length % 2 === 1) || /\$[^$]*[а-яё][^$]*\$/i.test(s));
let currencyFixed = 0;
for (const b of Object.values(bank)) for (const q of b.questions) {
  if (!CURRENCY_SRC.has(q.src)) continue;
  const fix = (s) => { if (s && looksLikeCurrency(s)) { currencyFixed++; return s.replace(/\$/g, '&#36;'); } return s; };
  q.q = fix(q.q); if (q.a) q.a = fix(q.a); if (q.explanation) q.explanation = fix(q.explanation);
  if (q.options) q.options = q.options.map(fix);
}
if (currencyFixed < CURRENCY_SRC.size) throw new Error('валюта: исправлено полей ' + currencyFixed + ' — меньше, чем вопросов в списке; проверь CURRENCY_SRC');

// ---------- запись ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let nm = 0, nc = 0;
for (const t of topics) {
  const b = bank[t.id];
  nm += b.questions.filter((q) => q.type === 'mcq').length; nc += b.questions.filter((q) => q.type === 'card').length;
  fs.writeFileSync(path.join(OUT, t.id + '.json'), JSON.stringify(b, null, 1) + '\n');
}
console.log('банк: тем ' + topics.length + ', mcq ' + nm + ', card ' + nc + ' → questions/');
