// Контент-пайплайн приложения: `npm run content` (из корня или из app/).
// Собирает в app/public/:
//   content/<file>.html   — страницы тем (блок 0 — сборка из content-src в режиме --app, остальные — legacy с локальными
//                           Chart.js и MathJax вместо CDN) + подключённый мост assets/bridge.js
//   assets/               — katex (css + woff2), chart.umd.js, mathjax (локальная копия), bridge.js
//   data/manifest.json    — блоки, модули, темы, секции, время чтения
//   data/version.json     — { qv, schema, builtAt, count } банка (проверка обновлений в APK)
//   data/questions.json   — вопросы для тренировок из банка questions/*.json (mcq + card), формулы отрендерены KaTeX
// Флаг --if-missing: ничего не делать, если data/manifest.json уже есть (для predev).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const { JSDOM } = require('jsdom');
const { extractConsts } = require('./lib-extract.js');

const ROOT = path.join(__dirname, '..');
const LEG = path.join(ROOT, 'content-legacy'), SRC = path.join(ROOT, 'content-src'), VENDOR = path.join(ROOT, 'tools', 'vendor');
const OUT = path.join(ROOT, 'app', 'public');
const DIR = { content: path.join(OUT, 'content'), assets: path.join(OUT, 'assets'), data: path.join(OUT, 'data') };

// Оценка «~N ч M мин» в каталоге — время вдумчивого разбора темы (задачи, трассировки, Q&A), а не беглого чтения.
// Скорость по тексту без формул — 60 слов в минуту (владелец, session 020: «150 слишком много, где-то 60 норм»;
// обычная проза на русском ~180–200). Формулы считаются отдельно: строчная (чаще всего одно обозначение) — как слово,
// блочная (вывод, расчёт) — 40 с. Калибровка по владельцу: тема 0.1 ≈ 4 ч (session 023: «4 часа ушло, ещё не закончил»;
// было 60 сл/мин и 30 с — 3 ч; всё ×4/3).
const WPM = 45, MIN_PER_INLINE = 1 / WPM, MIN_PER_DISPLAY = 2 / 3;
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
// Старые темы (MathJax) на телефоне: широкая формула, код или таблица растягивали страницу и её таскало вбок —
// теперь они прокручиваются сами. Графики с aspectRatio по умолчанию (2) на узком экране были сплющены.
const MOBILE_CSS = '<style>/* build-content: телефон */mjx-container[display="true"]{display:block;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0}pre{max-width:100%;overflow-x:auto}:not(pre)>code{overflow-wrap:anywhere}.pout,.calc{max-width:100%;overflow-x:auto}mjx-assistive-mml{max-width:1px!important}@media (max-width:640px){[style*="grid-template-columns:repeat(4,1fr)"],[style*="grid-template-columns:repeat(3,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}</style>';
// После отрисовки MathJax: формула внутри текста не переносится, а шаг расчёта (flex) не сжимается уже неё —
// страницу таскало вбок. Только для того, что реально вылезает за экран: ближайший контейнер формулы и таблица
// прокручиваются сами, flex/grid-предкам разрешается сжиматься (min-width:0).
const MOBILE_FIT = '<script>(function(){function fit(){var W=document.documentElement.clientWidth,out=function(e){return e.getBoundingClientRect().right>W+1};' +
  'var shrink=function(e){for(var a=e;a&&a!==document.body;a=a.parentElement){var d=getComputedStyle(a.parentElement||a).display;if(/flex|grid/.test(d))a.style.minWidth="0";}};' +
  'document.querySelectorAll("mjx-container,table,pre").forEach(function(e){if(!out(e))return;var box=e.tagName==="MJX-CONTAINER"?e.parentElement:e;' +
  'if(e.tagName==="TABLE")e.style.display="block";box.style.maxWidth="100%";box.style.overflowX="auto";box.style.overflowY="hidden";shrink(box);});}' +
  'function go(){if(window.MathJax&&MathJax.startup&&MathJax.startup.promise)MathJax.startup.promise.then(fit);else fit();}' +
  'if(document.readyState==="complete")go();else addEventListener("load",go);addEventListener("resize",fit);})();</script>';
const MOBILE_CHART = 'Chart.defaults.aspectRatio=(window.innerWidth||1024)<640?1.05:2;';

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
  if (CDN_CHART.test(h)) h = h.replace(CDN_CHART, '<script src="../assets/chart.umd.js"></script><script>Chart.defaults.animation=false;' + MOBILE_CHART + '</script>');
  h = h.replace('</head>', MOBILE_CSS + '\n</head>');
  { const i = h.lastIndexOf('</body>'); h = h.slice(0, i) + MOBILE_FIT + '\n' + h.slice(i); }
  h = h.replace(CDN_MATHJAX, '$1../assets/mathjax/tex-mml-chtml.js$2');
  if (/https:\/\/cdn/.test(h.match(/<script[^>]*src="[^"]*"/g)?.join(' ') || '')) throw new Error(f + ': остался CDN-скрипт');
  fs.writeFileSync(out, injectBridge(h, f));
  return 'legacy';
}

// ---------- разбор страницы: секции, время чтения ----------
const clean = (s) => s.replace(/\s+/g, ' ').trim();
function parsePage(file) {
  const doc = new JSDOM(fs.readFileSync(file, 'utf8')).window.document;
  const sections = [...doc.querySelectorAll('[id]')].filter(el => /^s\d+$/.test(el.id)).map(el => {
    const a = doc.querySelector('a[href="#' + el.id + '"]');
    let t = a ? clean(a.textContent) : '';
    if (!t) { const h = el.querySelector('h2,h3'); t = h ? clean(h.textContent) : el.id; }
    return { id: el.id, title: t };
  });
  const body = doc.body.cloneNode(true);
  body.querySelectorAll('script, style, noscript, .snav, nav').forEach(x => x.remove());
  // формулы считаются отдельно от слов. Блок 0: KaTeX уже отрисован (.tx-d / .tx-w — блочные, остальные .katex — строчные);
  // старые темы: сырой TeX для MathJax ($$…$$ — блочные, $…$ — строчные)
  const disp = [...body.querySelectorAll('.tx-d, .tx-w')].filter(el => !el.parentElement.closest('.tx-d, .tx-w'));
  const inl = [...body.querySelectorAll('.katex')].filter(el => !el.closest('.tx-d, .tx-w') && !el.parentElement.closest('.katex'));
  let formulas = { display: disp.length, inline: inl.length };
  disp.concat(inl).forEach(x => x.remove());
  let text = clean(body.textContent);
  // длина ограничена: непарный разделитель иначе «съедает» абзацы обычного текста (блок 3 пишет \( … \))
  text = text.replace(/\$\$[^$]{1,600}?\$\$|\\\[.{1,600}?\\\]/g, () => { formulas.display++; return ' '; })
    .replace(/\$[^$]{1,150}?\$|\\\(.{1,150}?\\\)/g, () => { formulas.inline++; return ' '; });
  const words = clean(text).split(' ').length;
  const title = clean((doc.querySelector('h1') || doc.querySelector('title') || { textContent: '' }).textContent);
  return { sections, words, formulas, title };
}

// ---------- сборка манифеста ----------
const blocks = [], topics = [];
let built = { src: 0, legacy: 0 };
for (const b of DATA) {
  const blockId = String(b.n);
  const block = { id: blockId, title: b.title, subtitle: b.sub || '', color: colorOf(b), topicIds: [] };
  let planIdx = 0;
  for (const t of b.topics) {
    if (t.f && !TOPIC_FILE.test(t.f)) continue; // план блока 0, страницы тестов (вопросы — в questions/)
    let id = t.f ? idFromFile(t.f) : (/^(\d+\.\d+)\s/.exec(t.t) || [])[1];
    if (!t.f && !id) { if (/^Тест|Тренажёр/.test(t.t)) continue; id = blockId + '.p' + (++planIdx); } // план без номера (блок 5)
    const topic = {
      id, blockId, slug: t.f ? t.f.replace(/\.html$/, '') : null,
      title: t.t.replace(/^\d+\.\d+\s+/, ''), summary: t.d || '',
      contentStatus: t.f ? t.st : 'planned',
      file: t.f ? 'content/' + t.f : null,
      sections: [], readingMinutes: 0,
    };
    if (blockId === '0') { const p = T.find(x => x.id === id); if (p) { topic.module = p.m; if (!t.f) topic.title = p.t; } }
    if (t.f) {
      built[buildPage(t.f)]++;
      const info = parsePage(path.join(DIR.content, t.f));
      topic.sections = info.sections;
      const mins = info.words / WPM + info.formulas.inline * MIN_PER_INLINE + info.formulas.display * MIN_PER_DISPLAY;
      topic.readingMinutes = Math.max(5, Math.round(mins / 5) * 5);
    }
    topics.push(topic); block.topicIds.push(id);
  }
  if (blockId === '0') {
    block.modules = Object.entries(MODS).map(([m, v]) => ({ id: m, title: v.n, summary: v.d, topicIds: topics.filter(x => x.blockId === '0' && x.module === m).map(x => x.id) }));
  }
  blocks.push(block);
}

// ---------- банк вопросов (questions/*.json — источник истины для тренировок) ----------
// Формат и правила — scripts/lib-questions.js. Формулы $…$ рендерятся KaTeX здесь, приложению MathJax не нужен.
const { loadBank, validate, renderMath } = require('./lib-questions.js');
const bank = loadBank();
{
  const problems = validate(bank, new Set(topics.map((t) => t.id)));
  if (problems.length) { console.error('банк вопросов: проблем ' + problems.length + ' (npm run questions)\n  ' + problems.slice(0, 20).join('\n  ')); process.exit(2); }
}
// варианты ссылаются друг на друга («Верны A и C», «все перечисленные») — порядок менять нельзя
// («Клиент A», «модель B», «в 3 раза» — не ссылки на варианты)
const REFS_OPTIONS = /(^|[^A-Za-zА-Яа-яЁё])[ABCDАБВГ] (и|или) [ABCDАБВГ]([^A-Za-zА-Яа-яЁё]|$)|вс[её] (выше)?перечисленн|все (варианты|ответы|утверждения) (верн|правильн)|ни один из (вариантов|перечисленн)|оба (варианта|ответа|утверждения) (верн|правильн)|ничего из перечисленн/i;
const texErrors = [];
const questions = [];
const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
for (const f of bank) {
  const t = topicById[f.topic];
  for (const q of f.questions) {
    const r = (s) => renderMath(s, texErrors, q.id);
    const out = { id: q.id, type: q.type, topicId: f.topic, blockId: t.blockId, q: r(q.q) };
    if (q.type === 'mcq') {
      out.options = q.options.map(r); out.correct = q.correct;
      if (q.explanation) out.explanation = r(q.explanation);
      if (q.fixedOrder || q.options.some((o) => REFS_OPTIONS.test(o))) out.fixedOrder = true;
    } else { out.a = r(q.a); if (q.note) out.note = r(q.note); }
    if (q.tags) out.tags = q.tags;
    if (q.level) out.level = q.level;
    if (q.deep) out.deep = true;
    questions.push(out);
  }
}
for (const t of topics) {
  const mine = questions.filter((q) => q.topicId === t.id);
  const m = mine.filter((q) => q.type === 'mcq').length, c = mine.length - m;
  if (m) t.mcqCount = m;
  if (c) t.cardCount = c;
}
for (const b of blocks) {
  const mine = questions.filter((q) => q.blockId === b.id);
  b.mcqCount = mine.filter((q) => q.type === 'mcq').length;
  b.cardCount = mine.length - b.mcqCount;
}

const body = { blocks, topics };
// Формат вопроса в questions.json. Менять при несовместимых изменениях полей (тогда старые APK не возьмут новый банк).
const BANK_SCHEMA = 1;
const version = crypto.createHash('sha1').update(JSON.stringify(body) + JSON.stringify(questions)).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(DIR.data, 'manifest.json'), JSON.stringify({ version, ...body }));
// qv — версия только банка вопросов: по ней APK решает, скачивать ли свежий банк с сайта (app/src/lib/liveBank.js, ADR 012).
// schema — формат вопроса; APK со старым кодом не берёт банк новой схемы.
const qv = crypto.createHash('sha1').update(JSON.stringify(questions)).digest('hex').slice(0, 10);
const builtAt = Date.now();
fs.writeFileSync(path.join(DIR.data, 'questions.json'), JSON.stringify({ version, qv, schema: BANK_SCHEMA, questions }));
fs.writeFileSync(path.join(DIR.data, 'version.json'), JSON.stringify({ qv, schema: BANK_SCHEMA, builtAt, count: questions.length }));

const withFile = topics.filter(t => t.file);
console.log('content: тем ' + topics.length + ' (с файлом ' + withFile.length + ': из content-src ' + built.src + ', legacy ' + built.legacy + '), блоков ' + blocks.length);
console.log('questions: mcq ' + questions.filter(q => q.type === 'mcq').length + ', card ' + questions.filter(q => q.type === 'card').length + ', с фиксированным порядком вариантов ' + questions.filter((q) => q.fixedOrder).length);
if (texErrors.length) { console.error('ошибки TeX в банке: ' + texErrors.length + '\n  ' + texErrors.slice(0, 15).join('\n  ')); process.exit(2); }
console.log('без секций id="sN": ' + (withFile.filter(t => !t.sections.length).map(t => t.id).join(', ') || 'нет'));
console.log('version ' + version + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
