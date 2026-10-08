// Правка существующих вопросов по id: node scripts/patch-questions.js <patch.json> [--dry]
// patch.json — массив [{ id, options?, correct?, q?, explanation?, a?, note?, deep? }]; меняются только переданные поля
// (note: null / deep: null — удалить поле; { id, delete: true } — удалить вопрос вместе с его памятью повторения),
// id и место вопроса в файле сохраняются (на id держится память повторения).
// Выгрузка темы для правки: node scripts/patch-questions.js --dump <topicId> [--all]  (по умолчанию — только вопросы с подсказкой)
const fs = require('fs'), path = require('path');
const { loadBank, validate } = require('./lib-questions');
const { audit, plain } = require('./audit-options');

const args = process.argv.slice(2);
const bank = loadBank();

if (args[0] === '--dump') {
  const f = bank.find((b) => b.topic === args[1]);
  if (!f) { console.error('нет темы ' + args[1]); process.exit(1); }
  const all = args.includes('--all');
  for (const q of f.questions) {
    if (q.type !== 'mcq') continue;
    const a = audit(q);
    if (!all && !a.bad) continue;
    console.log('## ' + q.id + ' [' + a.flags.join(',') + ' ' + a.ratio.toFixed(2) + '] ' + q.q);
    q.options.forEach((o, i) => console.log((i === q.correct ? ' * ' : '   ') + i + ' (' + plain(o).length + ') ' + o));
  }
  process.exit(0);
}

const file = args[0];
if (!file) { console.error('usage: node scripts/patch-questions.js <patch.json> [--dry] | --dump <topic> [--all]'); process.exit(1); }
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map();
for (const f of bank) for (const q of f.questions) byId.set(q.id, { f, q });

// Защита от съехавшего индекса: новый верный вариант должен быть ближе всех к старому верному по общим основам слов.
const stems = (s) => new Set((s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\\[a-z]+/g, ' ').match(/[a-zа-яё0-9.]+/g) || []).filter((w) => w.length > 2).map((w) => w.slice(0, 5)));
const sim = (a, b) => { const A = stems(a), B = stems(b); let k = 0; for (const w of A) if (B.has(w)) k++; return k / Math.max(1, Math.min(A.size, B.size)); };

const FIELDS = ['options', 'correct', 'q', 'explanation', 'a', 'note', 'deep', 'sec'];
const touched = new Set();
let n = 0;
for (const p of patch) {
  const hit = byId.get(p.id);
  if (!hit) { console.error('нет вопроса ' + p.id); process.exit(2); }
  if (p.delete === true) {
    hit.f.questions.splice(hit.f.questions.indexOf(hit.q), 1);
    byId.delete(p.id); touched.add(hit.f); n++; continue;
  }
  if (hit.q.type !== 'mcq' && p.options) { console.error(p.id + ': не mcq'); process.exit(2); }
  if (hit.q.type !== 'card' && (p.a != null || p.note != null)) { console.error(p.id + ': a/note — только у card'); process.exit(2); }
  if (p.options && p.correct == null && p.options.length !== hit.q.options.length) {
    console.error(p.id + ': другое число вариантов — укажите correct явно'); process.exit(2);
  }
  if (p.options) {
    const ref = hit.q.options[hit.q.correct], c = p.correct != null ? p.correct : hit.q.correct;
    const s = p.options.map((x) => sim(ref, x)), best = s.indexOf(Math.max(...s));
    if (best !== c && s[best] > s[c]) console.log('  ⚠ проверь индекс: ' + p.id + ' верный=' + c + ', ближе к старому верному вариант ' + best + ' (' + s.map((x) => x.toFixed(2)).join(' ') + ')');
  }
  for (const k of FIELDS) if (p[k] != null) hit.q[k] = p[k];
  if (p.note === null) delete hit.q.note;
  if (p.deep === null) delete hit.q.deep;
  touched.add(hit.f); n++;
}

const problems = validate(bank);
if (problems.length) { console.error(problems.join('\n')); process.exit(2); }

let still = 0;
for (const p of patch) { if (!byId.has(p.id)) continue; const q = byId.get(p.id).q; if (q.type !== 'mcq') continue; const a = audit(q); if (a.bad) { still++; console.log('  всё ещё подсказка: ' + p.id + ' ' + a.flags.join(',') + ' ' + a.ratio.toFixed(2)); } }
if (!args.includes('--dry')) {
  for (const f of touched) { const { file: fp, ...data } = f; fs.writeFileSync(fp, JSON.stringify(data, null, 1) + '\n'); }
}
console.log((args.includes('--dry') ? '[dry] ' : '') + 'исправлено ' + n + ' вопросов в ' + touched.size + ' файлах; с подсказкой осталось ' + still);
