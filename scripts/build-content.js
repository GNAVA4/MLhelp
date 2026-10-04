// Контент-пайплайн приложения: `npm run content` (из корня или из app/).
// Собирает в app/public/:
//   content/<file>.html   — страницы тем (блок 0 — сборка из content-src в режиме --app, остальные — legacy с локальными
//                           Chart.js и MathJax вместо CDN) + подключённый мост assets/bridge.js
//   assets/               — katex (css + woff2), chart.umd.js, mathjax (локальная копия), bridge.js
//   data/manifest.json    — блоки, модули, темы, секции, время чтения
//   data/questions.json   — банк вопросов: тесты блоков (mcq) + Q&A тем (open)
// Флаг --if-missing: ничего не делать, если data/manifest.json уже есть (для predev).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { extractConsts, loadQuizData } = require('./lib-extract.js');

const ROOT = path.join(__dirname, '..');
const LEG = path.join(ROOT, 'content-legacy'), SRC = path.join(ROOT, 'content-src'), VENDOR = path.join(ROOT, 'tools', 'vendor');
const OUT = path.join(ROOT, 'app', 'public');
const DIR = { content: path.join(OUT, 'content'), assets: path.join(OUT, 'assets'), data: path.join(OUT, 'data') };

// Скорость чтения технического текста с формулами, слов в минуту. Обычная проза на русском ~180–200;
// для плотного текста с формулами берём ниже. Используется только для оценки «~N мин» в каталоге.
const WPM = 150;
// Блок 0 в роадмапе окрашен #0c4a6e — на тёмном фоне почти не виден; берём акцент того же оттенка (sky-500).
const BLOCK0_COLOR = '#0ea5e9';

if (process.argv.includes('--if-missing') && fs.existsSync(path.join(DIR.data, 'manifest.json'))) {
  console.log('content: уже собран (app/public/data/manifest.json), пропускаю. Пересборка: npm run content');
  process.exit(0);
}

const t0 = Date.now();
for (const d of Object.values(DIR)) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }

// ---------- assets ----------
function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (skip(a)) continue;
    if (e.isDirectory()) copyDir(a, b, skip); else fs.copyFileSync(a, b);
  }
}
{
  const k = path.join(DIR.assets, 'katex');
  fs.mkdirSync(k, { recursive: true });
  // как в build.js: оставляем только woff2 (woff/ttf в vendor нет)
  const css = fs.readFileSync(path.join(VENDOR, 'katex.min.css'), 'utf8')
    .replace(/,\s*url\(fonts\/[^)]+?\.(woff|ttf)\)\s*format\("(woff|truetype)"\)/g, '');
  fs.writeFileSync(path.join(k, 'katex.min.css'), css);
  copyDir(path.join(VENDOR, 'fonts'), path.join(k, 'fonts'));
  fs.copyFileSync(path.join(VENDOR, 'chart.umd.js'), path.join(DIR.assets, 'chart.umd.js'));
  fs.copyFileSync(path.join(__dirname, 'bridge.js'), path.join(DIR.assets, 'bridge.js'));
  const mj = path.dirname(require.resolve('mathjax/es5/tex-mml-chtml.js'));
  const mo = path.join(DIR.assets, 'mathjax');
  fs.mkdirSync(mo, { recursive: true });
  fs.copyFileSync(path.join(mj, 'tex-mml-chtml.js'), path.join(mo, 'tex-mml-chtml.js'));
  // шрифты CHTML и расширения TeX (autoload подгружает их по требованию); sre (озвучка) не нужен
  copyDir(path.join(mj, 'output', 'chtml', 'fonts', 'woff-v2'), path.join(mo, 'output', 'chtml', 'fonts', 'woff-v2'));
  copyDir(path.join(mj, 'input', 'tex', 'extensions'), path.join(mo, 'input', 'tex', 'extensions'));
  for (const d of ['ui', 'a11y']) if (fs.existsSync(path.join(mj, d))) copyDir(path.join(mj, d), path.join(mo, d), p => /sre/.test(path.basename(p)));
}

// ---------- источники каталога ----------
const { DATA } = extractConsts(path.join(LEG, 'index_roadmap.html'), ['DATA'], "const P1='p1', P2='p2', P3='p3';");
const { T, MODS } = extractConsts(path.join(LEG, 'block0_plan.html'), ['T', 'MODS']);
const cssVars = Object.fromEntries([...fs.readFileSync(path.join(LEG, 'index_roadmap.html'), 'utf8').matchAll(/--(b\d):\s*(#[0-9a-fA-F]{3,6})/g)].map(m => [m[1], m[2]]));
const colorOf = (b) => b.n === 0 ? BLOCK0_COLOR : (/^var\(--(b\d)\)$/.exec(b.color) ? cssVars[/^var\(--(b\d)\)$/.exec(b.color)[1]] : b.color);

const TOPIC_FILE = /^block(\d+)_(\d+)_[\w]+\.html$/;
const idFromFile = (f) => { const m = TOPIC_FILE.exec(f); return m ? m[1] + '.' + (+m[2]) : null; };

// ---------- страницы ----------
const CDN_CHART = /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js\/[\d.]+\/chart\.umd(?:\.min)?\.js"><\/script>/;
const CDN_MATHJAX = /(<script src=")https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@3\/es5\/tex-mml-chtml\.js(")/;
const BRIDGE = '<script src="../assets/bridge.js"></script>';

function injectBridge(html, f) {
  const i = html.lastIndexOf('</body>');
  if (i < 0) throw new Error(f + ': нет </body>');
  return html.slice(0, i) + BRIDGE + '\n' + html.slice(i);
}

function buildPage(f) {
  const out = path.join(DIR.content, f);
  const src = path.join(SRC, f.replace(/\.html$/, '.src.html'));
  if (fs.existsSync(src)) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), src, out, '--app'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('build.js ' + f + ': ' + r.stdout + r.stderr);
    fs.writeFileSync(out, injectBridge(fs.readFileSync(out, 'utf8'), f));
    return 'src';
  }
  let h = fs.readFileSync(path.join(LEG, f), 'utf8');
  if (CDN_CHART.test(h)) h = h.replace(CDN_CHART, '<script src="../assets/chart.umd.js"></script><script>Chart.defaults.animation=false;</script>');
  h = h.replace(CDN_MATHJAX, '$1../assets/mathjax/tex-mml-chtml.js$2');
  if (/https:\/\/cdn/.test(h.match(/<script[^>]*src="[^"]*"/g)?.join(' ') || '')) throw new Error(f + ': остался CDN-скрипт');
  fs.writeFileSync(out, injectBridge(h, f));
  return 'legacy';
}

// ---------- разбор страницы: секции, время чтения, Q&A ----------
const clean = (s) => s.replace(/\s+/g, ' ').trim();
function parsePage(file) {
  const doc = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  const sections = [...doc.querySelectorAll('[id]')].filter(el => /^s\d+$/.test(el.id)).map(el => {
    const a = doc.querySelector('a[href="#' + el.id + '"]');
    let t = a ? clean(a.textContent) : '';
    if (!t) { const h = el.querySelector('h2,h3'); t = h ? clean(h.textContent) : el.id; }
    return { id: el.id, title: t };
  });
  const qa = [];
  const pushQA = (qEl, aHtml, tagEls, sectionEl) => {
    const q = qEl.cloneNode(true);
    q.querySelectorAll('.qch, .tag, .katex-mathml').forEach(x => x.remove());
    const text = clean(q.textContent).replace(/^\d+\.\s*/, '');
    if (!text) return;
    const tags = [...tagEls].map(x => clean(x.textContent)).filter(Boolean);
    qa.push({ q: text, answer: aHtml.trim(), tags, sectionRef: sectionEl ? sectionEl.id : undefined });
  };
  const secOf = (el) => { let p = el; while (p && !(p.id && /^s\d+$/.test(p.id))) p = p.parentElement; return p || null; };
  for (const d of doc.querySelectorAll('details.qa, details.qi')) {
    const sum = d.querySelector(':scope > summary'); if (!sum) continue;
    const rest = [...d.children].filter(c => c !== sum).map(c => c.outerHTML).join('');
    pushQA(sum, rest, sum.querySelectorAll('.tag'), secOf(d));
  }
  for (const d of doc.querySelectorAll('div.qa')) {
    if (d.closest('details')) continue; // ответ внутри details.qi — уже учтён
    const q = d.querySelector(':scope > .q') || d.querySelector(':scope > b, :scope > strong');
    if (!q) continue;
    const a = d.querySelector(':scope > .a');
    const ans = a ? a.innerHTML : [...d.childNodes].filter(n => n !== q).map(n => n.outerHTML ?? n.textContent).join('');
    pushQA(q, ans, [], secOf(d));
  }
  const body = doc.body.cloneNode(true);
  body.querySelectorAll('script, style, noscript, .katex-mathml, .snav, nav').forEach(x => x.remove());
  const words = clean(body.textContent).split(' ').length;
  const title = clean((doc.querySelector('h1') || doc.querySelector('title') || { textContent: '' }).textContent);
  return { sections, qa, words, title };
}

// ---------- сборка манифеста ----------
const blocks = [], topics = [], pages = {};
let built = { src: 0, legacy: 0 };
for (const b of DATA) {
  const blockId = String(b.n);
  const block = { id: blockId, title: b.title, subtitle: b.sub || '', color: colorOf(b), topicIds: [] };
  let planIdx = 0;
  for (const t of b.topics) {
    if (t.f && !TOPIC_FILE.test(t.f)) { if (/_quiz\.html$/.test(t.f)) block.quizFile = t.f; continue; } // план, тесты
    let id = t.f ? idFromFile(t.f) : (/^(\d+\.\d+)\s/.exec(t.t) || [])[1];
    if (!t.f && !id) { if (/^Тест|Тренажёр/.test(t.t)) continue; id = blockId + '.p' + (++planIdx); } // план без номера (блок 5)
    const topic = {
      id, blockId, slug: t.f ? t.f.replace(/\.html$/, '') : null,
      title: t.t.replace(/^\d+\.\d+\s+/, ''), summary: t.d || '',
      contentStatus: t.f ? t.st : 'planned',
      file: t.f ? 'content/' + t.f : null,
      sections: [], readingMinutes: 0, qaCount: 0,
    };
    if (blockId === '0') { const p = T.find(x => x.id === id); if (p) { topic.module = p.m; if (!t.f) topic.title = p.t; } }
    if (t.f) {
      built[buildPage(t.f)]++;
      const info = parsePage(path.join(DIR.content, t.f));
      pages[id] = info;
      topic.sections = info.sections;
      topic.readingMinutes = Math.max(1, Math.round(info.words / WPM));
      topic.qaCount = info.qa.length;
    }
    topics.push(topic); block.topicIds.push(id);
  }
  if (blockId === '0') {
    block.modules = Object.entries(MODS).map(([m, v]) => ({ id: m, title: v.n, summary: v.d, topicIds: topics.filter(x => x.blockId === '0' && x.module === m).map(x => x.id) }));
  }
  blocks.push(block);
}

// ---------- банк вопросов ----------
const questions = [];
const pad = (n, w = 3) => String(n).padStart(w, '0');
const fileTopics = (blockId) => topics.filter(t => t.blockId === blockId && t.file).map(t => t.id);
// Части теста → темы. По умолчанию часть i = i-я тема блока; исключения — где частей больше, чем тем.
const PART_MAP = { '7': ['7.1', '7.1', '7.2', '7.3', '7.4'] };
const strip = (s) => (s == null ? s : String(s));
for (const b of blocks) {
  if (!b.quizFile) continue;
  const qf = path.join(LEG, b.quizFile);
  let items, parts;
  if (b.id === '3') {
    items = extractConsts(qf, ['QUESTIONS']).QUESTIONS.map(x => ({ p: +x.t.slice(1) - 1, q: x.q, o: x.opts, c: x.ans, e: x.ex }));
    parts = fileTopics('3');
  } else if (b.id === '7') {
    items = extractConsts(qf, ['Q']).Q;
  } else {
    items = loadQuizData(path.join(LEG, b.quizFile.replace(/\.html$/, '_data.js')));
  }
  const map = PART_MAP[b.id] || fileTopics(b.id);
  if (!PART_MAP[b.id]) {
    const nParts = b.id === '3' ? 4 : extractConsts(qf, ['PARTS']).PARTS.length;
    if (nParts !== map.length) throw new Error('block ' + b.id + ': частей ' + nParts + ', тем ' + map.length + ' — нужен PART_MAP');
  }
  items.forEach((x, i) => {
    const topicId = map[x.p];
    if (!topicId) throw new Error('block ' + b.id + ' q' + i + ': часть ' + x.p + ' без темы');
    if (!Array.isArray(x.o) || x.c == null || x.c < 0 || x.c >= x.o.length) throw new Error('block ' + b.id + ' q' + i + ': плохие варианты');
    questions.push({ id: 'b' + b.id + '-q' + pad(i + 1), topicId, blockId: b.id, kind: 'mcq', q: x.q, options: x.o, correct: x.c, explanation: strip(x.e), source: b.quizFile });
  });
  b.mcqCount = items.length;
}
for (const t of topics) {
  if (!pages[t.id]) continue;
  pages[t.id].qa.forEach((x, i) => {
    questions.push({ id: 't' + t.id + '-qa-' + pad(i + 1, 2), topicId: t.id, blockId: t.blockId, kind: 'open', q: x.q, answer: x.answer, tags: x.tags.length ? x.tags : undefined, sectionRef: x.sectionRef, source: t.slug + '.html' });
  });
}
const ids = new Set(); for (const q of questions) { if (ids.has(q.id)) throw new Error('дубликат id ' + q.id); ids.add(q.id); }

const body = { blocks, topics };
const version = crypto.createHash('sha1').update(JSON.stringify(body) + JSON.stringify(questions)).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(DIR.data, 'manifest.json'), JSON.stringify({ version, ...body }));
fs.writeFileSync(path.join(DIR.data, 'questions.json'), JSON.stringify({ version, questions }));

const withFile = topics.filter(t => t.file);
console.log('content: тем ' + topics.length + ' (с файлом ' + withFile.length + ': из content-src ' + built.src + ', legacy ' + built.legacy + '), блоков ' + blocks.length);
console.log('questions: mcq ' + questions.filter(q => q.kind === 'mcq').length + ', open ' + questions.filter(q => q.kind === 'open').length);
console.log('без секций id="sN": ' + (withFile.filter(t => !t.sections.length).map(t => t.id).join(', ') || 'нет'));
console.log('version ' + version + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
