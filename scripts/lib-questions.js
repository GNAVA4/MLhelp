// Банк вопросов questions/<topicId>.json: загрузка, проверка, рендер формул.
// Формат вопроса:
//   { id: 'q' + 7 символов [a-z0-9] — постоянный, на него ссылается память повторения; НЕ менять и не переиспользовать
//     type: 'mcq' | 'card',
//     q: HTML + TeX в $…$ / $$…$$ (TeX сырой),
//     mcq:  options: [HTML+TeX] (2–6), correct: индекс, explanation?: HTML+TeX, fixedOrder?: true (варианты ссылаются друг на друга)
//     card: a: HTML+TeX — ответ (общий, без чисел разобранного в теме кейса), note?: HTML+TeX — пример из темы с числами,
//     tags?: [string], level?: 'junior'|'middle'|'senior', src?: откуда взят }
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const QDIR = path.join(ROOT, 'questions');
const katex = require(path.join(ROOT, 'tools', 'vendor', 'katex.min.js'));
const KATEX_MACROS = { '\\E': '\\mathbb{E}', '\\Var': '\\operatorname{Var}', '\\Cov': '\\operatorname{Cov}', '\\P': '\\mathrm{P}' };
const ID_RE = /^q[a-z0-9]{7}$/;

function loadBank() {
  return fs.readdirSync(QDIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const file = path.join(QDIR, f);
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { file, ...d };
  });
}

function newId(used) {
  for (;;) {
    const id = 'q' + crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, '').toLowerCase().slice(0, 7);
    if (ID_RE.test(id) && !used.has(id)) { used.add(id); return id; }
  }
}

// HTML + $TeX$ → HTML с отрендеренным KaTeX. errors — массив, куда пишутся ошибки TeX.
function renderMath(s, errors, where) {
  if (s == null) return s;
  return String(s).replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (m, d, i) => {
    const disp = d != null, tex = disp ? d : i;
    try {
      const html = katex.renderToString(tex, { displayMode: disp, throwOnError: true, output: 'html', macros: Object.assign({}, KATEX_MACROS), strict: false });
      return disp ? '<div class="mdisp">' + html + '</div>' : html;
    } catch (e) {
      errors && errors.push(where + ': $' + tex.slice(0, 60) + '$ — ' + e.message.slice(0, 90));
      return m;
    }
  });
}

// Проверка всего банка. topicIds — допустимые темы (из манифеста). Возвращает список проблем.
function validate(bank, topicIds) {
  const problems = [], seen = new Map();
  for (const f of bank) {
    const name = path.basename(f.file);
    if (name !== f.topic + '.json') problems.push(name + ': поле topic=' + f.topic + ' не совпадает с именем файла');
    if (topicIds && !topicIds.has(f.topic)) problems.push(name + ': нет темы ' + f.topic + ' в каталоге');
    if (!Array.isArray(f.questions)) { problems.push(name + ': нет массива questions'); continue; }
    f.questions.forEach((q, i) => {
      const at = name + '#' + (i + 1) + (q.id ? ' (' + q.id + ')' : '');
      if (!q.id) problems.push(at + ': нет id (npm run questions -- --fix-ids)');
      else if (!ID_RE.test(q.id)) problems.push(at + ': id не по формату q + 7 [a-z0-9]');
      else if (seen.has(q.id)) problems.push(at + ': id повторяется (уже в ' + seen.get(q.id) + ')');
      else seen.set(q.id, name);
      if (!q.q || !String(q.q).trim()) problems.push(at + ': пустой вопрос');
      if (q.type === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) problems.push(at + ': options — от 2 до 6 вариантов');
        else if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length) problems.push(at + ': correct вне диапазона');
        else if (new Set(q.options.map((o) => String(o).trim())).size !== q.options.length) problems.push(at + ': одинаковые варианты');
      } else if (q.type === 'card') {
        if (!q.a || !String(q.a).trim()) problems.push(at + ': пустой ответ');
      } else problems.push(at + ': type должен быть mcq или card');
      const errs = [];
      for (const s of [q.q, q.a, q.note, q.explanation, ...(q.options || [])]) renderMath(s, errs, at);
      problems.push(...errs);
      // нечётное число $ — почти наверняка незакрытая формула
      for (const s of [q.q, q.a, q.note, q.explanation, ...(q.options || [])]) if (s && (String(s).replace(/\$\$/g, '').match(/\$/g) || []).length % 2) problems.push(at + ': непарный $');
    });
  }
  return problems;
}

function fixIds(bank) {
  const used = new Set(bank.flatMap((f) => f.questions.map((q) => q.id).filter(Boolean)));
  let n = 0;
  for (const f of bank) {
    let changed = false;
    for (const q of f.questions) if (!q.id) { q.id = newId(used); n++; changed = true; }
    if (changed) { const { file, ...data } = f; fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n'); }
  }
  return n;
}

module.exports = { QDIR, loadBank, validate, fixIds, renderMath, ID_RE };
