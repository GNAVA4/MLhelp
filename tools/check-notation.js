#!/usr/bin/env node
// COURSE_STANDARD §7.11 (владелец, session 038): справка обозначений в начале темы не заменяет расшифровку в тексте.
// Для каждого «блока чтения» (задача .ex, трассировка .trace, камень .pf, задача у доски .task, «Не путать» .nb,
// «Минимум» .prim) ищет символы из справки темы (details.gl), которые использованы в формулах блока,
// но ни разу не названы в нём словами. Плюс: блок .fr без строки «где» (.fr-w).
// Это подсказка для чтения глазами (эвристика по ключевым словам), а не строгая проверка.
//   node tools/check-notation.js content-src/<file>.src.html [--all] [--quiet]
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
let files = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) files = fs.readdirSync('content-src').filter((f) => f.endsWith('.src.html')).map((f) => path.join('content-src', f));

// Служебные команды TeX — не обозначения.
const SKIP = new Set(('mid sum int prod Rightarrow Longleftrightarrow Leftrightarrow iff approx le leq ge geq lt gt ne neq frac dfrac tfrac text mathrm ' +
  'operatorname left right big Big bigg cdot cdots dots ldots times quad qquad sqrt to infty in notin subset begin end gathered aligned cases ' +
  'mathbf boldsymbol bm displaystyle textstyle limits lim max min arg log ln exp sim propto pm mp colon vert lVert rVert Vert langle rangle ' +
  'underbrace overbrace underset overset stackrel hline tag nonumber phantom vphantom hspace mathcal mathbb tilde widetilde hat widehat bar overline ' +
  'prime partial nabla xrightarrow forall exists equiv circ star ast cup cap emptyset varnothing setminus binom choose top intercal T').split(' '));
// Общие синонимы: обозначение считается названным, если в блоке встретилось одно из этих начал слов.
const ALIAS = {
  '\\sigma': ['станд', 'отклон', 'разбро', 'диспер', 'сигм', 'сингуляр'], '\\mu': ['средн', 'матож', 'ожидан'],
  '\\E': ['средн', 'матож', 'ожидан'], '\\P': ['вероят', 'доля', 'шанс'], '\\Var': ['диспер', 'разбро'], '\\Cov': ['ковар'],
  '\\rho': ['коррел'], '\\lambda': ['интенс', 'частот', 'штраф', 'регуляр', 'собствен', 'скорост'], '\\theta': ['парамет'],
  '\\alpha': ['уровен', 'значим', 'парамет', 'показат', 'сглаж', 'шаг'], '\\beta': ['мощност', 'ошибк', 'парамет', 'вес', 'коэфф'],
  '\\mathbb{1}': ['индикат'], '\\bar': ['средн', 'выбороч'], '\\hat': ['оценк', 'оцен', 'прогноз', 'предсказ'], 'SE': ['ошибк', 'станд'],
  '\\eta': ['шаг', 'скорост'], '\\nabla': ['градиен'], '\\partial': ['частн', 'производ'], '\\Sigma': ['ковариац', 'матриц', 'сингуляр'],
  '\\Phi': ['функц', 'распредел', 'нормальн'], '\\ell': ['лог', 'правдоп', 'потер'], '\\tau': ['приор', 'разбро', 'параметр', 'температ'],
  '\\pi': ['доля', 'приор', 'частот', 'распростр', 'базов'], '\\omega': ['исход'], '\\Omega': ['исход', 'множеств'], '\\varepsilon': ['шум', 'ошибк', 'точност', 'мал', 'порог'],
  '\\epsilon': ['шум', 'ошибк', 'точност', 'мал', 'порог'], '\\kappa': ['обусловл', 'число'], '\\nu': ['степен', 'свобод'], '\\delta': ['эффект', 'разниц', 'сдвиг', 'изменен', 'возмущ'],
  '\\Delta': ['разниц', 'измен', 'прирост', 'сдвиг'], '\\gamma': ['параметр', 'коэфф'], '\\chi': ['хи-кв', 'хи кв', 'квадрат'],
};
const STOP = new Set('это того этой этих когда который которая которое если только среди между число числа значение значения например пример запись читать'.split(' '));
const stem = (w) => w.toLowerCase().replace(/ё/g, 'е').slice(0, 6);

// Символы из куска TeX: команды (\sigma, \E, \mathbb{1}, \hat, \bar) и SE.
function texSymbols(tex) {
  const out = new Set();
  const re = /\\([A-Za-z]+)(\{1\})?/g; let m;
  while ((m = re.exec(tex))) {
    const name = m[1];
    if (name === 'mathbb' && m[2]) { out.add('\\mathbb{1}'); continue; }
    if (name === 'hat' || name === 'widehat') { out.add('\\hat'); continue; }
    if (name === 'bar' || name === 'overline') { out.add('\\bar'); continue; }
    if (!SKIP.has(name)) out.add('\\' + name);
  }
  if (/(^|[^A-Za-z\\])SE([^A-Za-z]|$)/.test(tex)) out.add('SE');
  // одиночные заглавные латинские буквы (H, L, D, I, C…) — вне \text{…} и не часть слова/команды
  const bare = tex.replace(/\\(text|mathrm|operatorname|textbf)\{[^}]*\}/g, ' ');
  const re2 = /(^|[^\\A-Za-z])([A-Z])(?![A-Za-z])/g;
  while ((m = re2.exec(bare))) if (!'XYAB'.includes(m[2])) out.add(m[2]);
  return out;
}

function audit(file) {
  const src = fs.readFileSync(file, 'utf8');
  const doc = new JSDOM(src).window.document;
  const texOf = (el) => [...el.querySelectorAll('tex, texd')].map((t) => t.textContent).join(' ');
  // словарь: символ → начала слов из описания (справка темы)
  const dict = {};
  const gl = doc.querySelector('details.gl');
  if (gl) for (const tr of gl.querySelectorAll('tr')) {
    const td = tr.querySelectorAll('td'); if (td.length < 2) continue;
    const syms = texSymbols(texOf(td[0])); if (/(^|[^A-Za-z])SE([^A-Za-z]|$)/.test(td[0].textContent)) syms.add('SE');
    const d = td[1].cloneNode(true); d.querySelectorAll('tex, .gl-ex').forEach((x) => x.remove());
    const words = (d.textContent.split(/[;.]\s/)[0].match(/[а-яё-]{4,}/gi) || []).filter((w) => !STOP.has(w.toLowerCase())).slice(0, 8).map(stem);
    for (const s of syms) dict[s] = [...new Set([...(dict[s] || []), ...words, ...(ALIAS[s] || []).map(stem)])];
  }
  const units = [];
  const label = (el) => {
    const t = el.querySelector('.ex-n, .task-h, .pfn, .nb-t, .prim-t, .trace-t, .tr-t, b, summary');
    return (t ? t.textContent : el.className).replace(/\s+/g, ' ').trim().slice(0, 70);
  };
  for (const el of doc.querySelectorAll('.ex, .trace, .pf, .task, .nb, .prim')) {
    if (el.parentElement.closest('.ex, .trace, .pf, .task, .nb, .prim')) continue;
    const sec = el.closest('section')?.id || '?';
    const used = texSymbols(texOf(el));
    const plain = el.cloneNode(true); plain.querySelectorAll('tex, texd').forEach((x) => x.remove());
    const text = plain.textContent.toLowerCase().replace(/ё/g, 'е') + ' ' + [...el.querySelectorAll('tex, texd')].map((t) => (t.textContent.match(/\\text\{([^}]*)\}/g) || []).join(' ')).join(' ').toLowerCase();
    // явное определение в блоке: «<tex>…символ…</tex> — пояснение» или «<tex>…</tex> (пояснение)»
    const defined = new Set();
    for (const t of el.querySelectorAll('tex')) {
      const nx = t.nextSibling;
      if (nx && nx.nodeType === 3 && /^\s*(—|–|\(|-\s)/.test(nx.textContent)) texSymbols(t.textContent).forEach((s) => defined.add(s));
    }
    const missing = [...used].filter((s) => dict[s] && !defined.has(s) && !dict[s].some((w) => text.includes(w)));
    const noWhere = [...el.querySelectorAll('.fr')].filter((fr) => !fr.querySelector('.fr-w')).length;
    if (missing.length || noWhere) units.push({ sec, cls: el.className.split(' ')[0], label: label(el), missing, noWhere });
  }
  // Карточки формул: каждая буква/команда формулы должна встретиться в расшифровке .where/.fnote (7.11, п.1).
  const letters = (tex) => {
    const out = texSymbols(tex);
    const bare = tex.replace(/p\s*\\text\{-value\}/g, ' ').replace(/\\(text|mathrm|operatorname|textbf|begin|end)\{[^}]*\}/g, ' ').replace(/\\[A-Za-z]+/g, ' ');
    for (const m of bare.matchAll(/(^|[^A-Za-z])([a-z])(?![A-Za-z])/g)) out.add(m[2]);
    return out;
  };
  for (const fb of doc.querySelectorAll('.fbox')) {
    const f = [...fb.querySelectorAll(':scope > texd, :scope > tex')].map((t) => t.textContent).join(' ');
    const w = fb.querySelector('.where, .fnote');
    if (!w) continue; // отсутствие .where ловит check-standard
    const wPlain = w.cloneNode(true); wPlain.querySelectorAll('tex, texd').forEach((x) => x.remove());
    const wt = w.textContent.toLowerCase();
    const have = letters(texOf(w));
    const miss = [...letters(f)].filter((s) => !have.has(s) && !(dict[s] && dict[s].some((x) => wt.includes(x))));
    if (miss.length) units.push({ sec: fb.closest('section')?.id || '?', cls: 'fbox', label: (fb.querySelector('.flabel')?.textContent || '').trim().slice(0, 70), missing: miss, noWhere: 0 });
  }
  return { units, dictSize: Object.keys(dict).length };
}

let total = 0;
for (const f of files) {
  const { units, dictSize } = audit(f);
  total += units.length;
  console.log(`${path.basename(f)}: блоков с нерасшифрованными символами ${units.length} (символов в справке ${dictSize})`);
  if (!quiet) for (const u of units) console.log(`  ${u.sec} ${u.cls} «${u.label}»: ${u.missing.join(' ')}${u.noWhere ? ' | .fr без «где» ×' + u.noWhere : ''}`);
}
process.exitCode = total ? 1 : 0;
