// Проверка темы на соответствие COURSE_STANDARD.md (всё, что можно проверить автоматически).
// Запуск: node tools/check-standard.js content-src/block0_05_likelihood_mle_map.src.html [ещё файлы…]
//         node tools/check-standard.js --all            — все темы content-src/
// Код выхода 2, если есть ошибки (E). Предупреждения (W) — смотреть глазами, код не меняют.
// Чего скрипт НЕ проверяет: связность текста, «проблема → инструмент», понятность объяснений, верность чисел —
// это чтение темы целиком (раздел 8 стандарта).
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const LEGACY = path.join(ROOT, 'content-legacy');
const args = process.argv.slice(2);
const files = args.includes('--all')
  ? fs.readdirSync(path.join(ROOT, 'content-src')).filter(f => f.endsWith('.src.html')).sort().map(f => path.join(ROOT, 'content-src', f))
  : args.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: node tools/check-standard.js <file.src.html>… | --all'); process.exit(1); }

const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const short = (s, n = 50) => (s.length > n ? s.slice(0, n) + '…' : s);
const idsCache = {};
function idsOf(file) {
  if (!(file in idsCache)) {
    const p = path.join(LEGACY, file);
    idsCache[file] = fs.existsSync(p) ? new Set([...fs.readFileSync(p, 'utf8').matchAll(/\sid="(s\d+)"/g)].map(m => m[1])) : null;
  }
  return idsCache[file];
}

function check(file) {
  const src = fs.readFileSync(file, 'utf8');
  const base = path.basename(file).replace('.src.html', '');
  const out = [];
  const E = (rule, msg) => out.push(['E', rule, msg]);
  const W = (rule, msg) => out.push(['W', rule, msg]);
  const doc = new JSDOM(src).window.document;
  const $$ = (sel, root = doc) => [...root.querySelectorAll(sel)];

  // §1 тёмная тема
  if (!/#0b1120/i.test(src)) E('§1', 'фон страницы не #0b1120');

  // §2 формулы: KaTeX, без $…$ и без CDN
  if (/cdn\.jsdelivr|cdnjs|unpkg/i.test(src)) E('§2/§4', 'подключение по CDN');
  const noTex = src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<tex>[\s\S]*?<\/tex>|<texd>[\s\S]*?<\/texd>/g, '');
  if (/\$[^$\s][^$]*\\[a-zA-Z]+[^$]*\$/.test(noTex)) E('§2', 'формула в $…$ вне <tex>');
  for (const m of src.matchAll(/<texd?>([\s\S]*?)<\/texd?>/g)) {
    if (/&lt;|&gt;/.test(m[1])) E('Инструменты', `&lt;/&gt; внутри <tex> — писать \\lt/\\gt: ${short(m[1], 40)}`);
    if (/&&\s*\\text/.test(m[1])) E('Инструменты', `комментарий внутри aligned (&&\\text): ${short(m[1], 40)}`);
  }

  // §2 карточки формул: 15–20, у каждой расшифровка
  const fboxes = $$('.fbox');
  if (fboxes.length < 15 || fboxes.length > 20) W('§2', `карточек формул ${fboxes.length} (норма 15–20)`);
  for (const fb of fboxes) if (!fb.querySelector('.where, .fnote')) E('§2/§7.2', `формула без расшифровки (.where/.fnote): ${short(txt(fb.querySelector('.flabel')))}`);

  // §3 Q&A и задачи у доски
  const qa = $$('details.qa');
  if (qa.length !== 30) E('§3/§6', `Q&A ${qa.length}, нужно 30`);
  if (qa.some(d => !d.closest('#s15'))) E('§3', 'details.qa вне секции 15 (мост считает их вопросами)');
  if ($$('details.qi').length) E('§3', 'class="qi" в теме нового стандарта');
  const tasks = $$('#s14 .task');
  if (tasks.length !== 5) E('§6', `задач у доски ${tasks.length}, нужно 5`);
  if (tasks.some(t => !t.querySelector('details'))) E('§3', 'решение задачи у доски не в <details>');

  // §4 графики
  if (!/<!--CHARTJS-->/.test(src)) E('§4', 'нет <!--CHARTJS--> (Chart.js не встраивается)');
  if (!/Chart\.defaults\.animation\s*=\s*false/.test(src)) E('§4', 'нет Chart.defaults.animation=false');
  const charts = $$('canvas').length;
  if (charts < 11 || charts > 16) W('§6', `графиков ${charts} (норма 11–15)`);

  // §5 и §6: секции, подводки, переходы
  const secs = $$('section[id^="s"]');
  const ids = secs.map(s => s.id).join(',');
  if (ids !== Array.from({ length: 15 }, (_, i) => 's' + (i + 1)).join(',')) E('§6', `секции ${ids}, нужно s1…s15 по порядку`);
  for (const s of secs) {
    const n = +s.id.slice(1);
    if (!s.querySelector('.sh h2')) E('§5', `${s.id}: нет заголовка .sh h2`);
    if (!s.querySelector('.slead')) E('§5', `${s.id}: нет подводки .slead`);
    if (n <= 12 && !s.querySelector('p.next')) E('§5', `${s.id}: нет перехода p.next в конце`);
    if (n === 13 && !s.querySelector('p.next')) W('§5', `${s.id}: нет перехода к шпаргалке (p.next)`);
  }
  const s1 = doc.getElementById('s1');
  if (s1 && !/План темы/.test(txt(s1))) E('§5', 's1: нет плана темы («План темы»)');
  if ($$('.pf').length !== 15) E('§6', `подводных камней ${$$('.pf').length}, нужно 15`);
  if (!$$('.play').length) E('§6', 'нет интерактива (.play)');
  const traces = $$('.trace').length;
  if (traces < 4 || traces > 7) W('§6', `трассировок ${traces} (норма 4–7)`);

  // §5 задачи: Ситуация → Что найти → Как рассуждаем → Решение → Ответ и вывод
  const exs = $$('.ex');
  for (const ex of exs) {
    const name = short(txt(ex.querySelector('.ex-n')), 60);
    const heads = $$('.ex-h', ex).map(txt);
    const has = re => heads.some(h => re.test(h));
    const miss = [['Ситуация', /^Ситуация/i], ['Что найти', /^Что (найти|нужно найти)/i], ['Как рассуждаем', /^Как рассуждаем/i],
      ['Решение', /^Решение/i], ['Ответ и вывод', /^Ответ/i]].filter(([, re]) => !has(re)).map(([n]) => n);
    if (miss.length) E('§5', `${name}: нет «${miss.join('», «')}»`);
    // §7.9 каждое решение начинается с .fr
    for (const r of $$('.ex-r', ex).filter(r => /^Решение/i.test(txt(r.querySelector('.ex-h'))))) {
      const c = r.querySelector('.ex-c');
      const first = c && c.firstElementChild;
      const lead = c ? c.innerHTML.split(/<div class="fr"/)[0].replace(/<[^>]+>/g, '').trim() : '';
      if (!first || !first.classList.contains('fr') || lead) E('§7.9', `${name}: «${txt(r.querySelector('.ex-h'))}» не начинается с блока .fr`);
      else if (!c.querySelector('.fr .fr-w') && !/\\sum|\\int|=/.test(c.querySelector('.fr').innerHTML)) W('§7.9', `${name}: в .fr нет строки «где»`);
    }
  }
  if (exs.length < 8) W('§5', `задач с условием всего ${exs.length}`);

  // §7.1 справка обозначений
  const gl = s1 && s1.querySelector('details.gl');
  if (!gl) E('§7.1', 's1: нет справки обозначений details.gl');
  else {
    const ths = $$('tr:first-child th', gl).length;
    if (ths !== 2) E('§7.1', `справка: колонок ${ths}, нужно 2`);
    const rows = $$('tr', gl).slice(1);
    const noEx = rows.filter(r => !/Пример/.test(txt(r))).length;
    if (noEx) W('§7.1', `справка: ${noEx} строк без «Пример:»`);
    const noLink = rows.filter(r => !r.querySelector('a[href]')).length;
    if (noLink > rows.length / 2) W('§7.1', `справка: ${noLink} из ${rows.length} строк без ссылки на секцию`);
  }

  // §7.3 / §7.4 блоки «Не путать» и «Минимум»
  if (!$$('.nb').length) W('§7.3', 'нет ни одного блока «Не путать» (.nb) — проверить пары записей темы');
  for (const pr of $$('.prim')) if (!$$('a[href*=".html#s"]', pr).length) E('§7.4', `«${short(txt(pr.querySelector('.prim-t')))}»: нет ссылки на секцию другой темы`);

  // §7.5 ссылки
  for (const a of $$('a[href]')) {
    const h = a.getAttribute('href');
    if (/^https?:/.test(h)) continue;
    const m = h.match(/^([^#]*)(?:#(.*))?$/);
    const f = m[1] || base + '.html', id = m[2];
    const set = idsOf(f);
    if (!set) { E('§7.5', `ссылка на несуществующий файл: ${h}`); continue; }
    // ссылка на тему целиком допустима в абзаце «Где это в курсе», в навигации .pnav и на план блока
    if (!id) { if (m[1] && !a.closest('.pnav') && !/Где это в курсе/.test(txt(a.parentElement)) && !/_plan\.html$/.test(m[1])) W('§7.5', `ссылка на тему без секции: ${h} («${short(txt(a.parentElement), 40)}»)`); continue; }
    if (!set.has(id)) E('§7.5', `ссылка на несуществующую секцию: ${h}`);
  }

  // §7.10 шпаргалка
  const cs = $$('#s14 table').find(t => /Формул/i.test(txt(t.querySelector('tr'))));
  if (!cs) E('§7.10', 's14: нет шпаргалки формул');
  else {
    if (!cs.classList.contains('cs')) E('§7.10', 'шпаргалка не class="ct cs" (на телефоне не станет карточками)');
    const hs = $$('tr:first-child th', cs).map(txt).join(' | ');
    if (!/Что это/i.test(hs)) E('§7.10', `шпаргалка: колонки «${hs}», нужно «№ | Что это · формула | Когда применять»`);
    const rows = $$('tr', cs).slice(1);
    const noName = rows.filter(r => !r.cells[1] || !r.cells[1].querySelector('b')).length;
    const noLink = rows.filter(r => !r.cells[0] || !r.cells[0].querySelector('a[href^="#s"]')).length;
    if (noName) E('§7.10', `шпаргалка: ${noName} из ${rows.length} формул без названия`);
    if (noLink) E('§7.10', `шпаргалка: ${noLink} из ${rows.length} номеров без ссылки на секцию`);
    const noW = rows.filter(r => r.cells[1] && !r.cells[1].querySelector('.cs-w')).length;
    if (noW) W('§7.10', `шпаргалка: ${noW} строк без обозначений (.cs-w)`);
  }

  // Инструменты: заголовки .ct th набраны капсом (text-transform) — формула внутри th становится заглавной (e → E)
  if (!/\.ct th \.katex\{text-transform:none\}/.test(src))
    for (const th of $$('th')) if (th.querySelector('tex, texd')) E('Инструменты', `формула в заголовке <th> станет заглавной — нужен CSS .ct th .katex{text-transform:none}: «${short(txt(th), 30)}»`);

  // Инструменты: колонки grid на телефоне
  if (/grid-template-columns:\s*1fr\b(?!\s*\))/.test(src.replace(/minmax\(0,\s*1fr\)/g, ''))) W('Инструменты', 'grid-template-columns:1fr без minmax(0,1fr)');

  // §8 сборка не устарела
  const built = path.join(LEGACY, base + '.html');
  if (!fs.existsSync(built)) E('§8', 'нет собранного content-legacy/' + base + '.html');
  else if (fs.statSync(built).mtimeMs < fs.statSync(file).mtimeMs) E('§8', 'собранный HTML старее исходника — пересобрать');

  return { base, out, stats: { секций: secs.length, формул: fboxes.length, задач: exs.length, трассировок: traces, графиков: charts, nb: $$('.nb').length, prim: $$('.prim').length } };
}

let errors = 0;
for (const f of files) {
  const { base, out, stats } = check(f);
  const e = out.filter(o => o[0] === 'E').length, w = out.length - e;
  errors += e;
  console.log(`\n${e ? '✗' : '✓'} ${base}: ошибок ${e}, предупреждений ${w}  (${Object.entries(stats).map(([k, v]) => k + ' ' + v).join(', ')})`);
  for (const [lvl, rule, msg] of out) console.log(`  ${lvl} ${rule.padEnd(11)} ${msg}`);
}
process.exit(errors ? 2 : 0);
