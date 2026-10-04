// Добавить новые вопросы в банк: node scripts/add-questions.js <file.json> [--src "пометка"]
// file.json: { "topic": "0.1", "questions": [ { type, q, options, correct, explanation } | { type: 'card', q, a } ] }
// Вопросы дописываются в конец questions/<topic>.json, получают id; затем весь банк проверяется.
// Дубликаты (тот же текст вопроса в теме) не добавляются.
const fs = require('fs'), path = require('path');
const { QDIR, loadBank, validate, fixIds } = require('./lib-questions.js');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/add-questions.js <file.json> [--src "..."]'); process.exit(1); }
const si = process.argv.indexOf('--src');
const src = si > 0 ? process.argv[si + 1] : 'authored';
const add = JSON.parse(fs.readFileSync(file, 'utf8'));
const target = path.join(QDIR, add.topic + '.json');
if (!fs.existsSync(target)) { console.error('нет файла темы ' + target); process.exit(1); }
const bankFile = JSON.parse(fs.readFileSync(target, 'utf8'));
const norm = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const existing = new Set(bankFile.questions.map((q) => norm(q.q)));
let added = 0, skipped = 0;
for (const q of add.questions) {
  if (existing.has(norm(q.q))) { skipped++; continue; }
  const { id, ...rest } = q;
  bankFile.questions.push({ ...rest, src: rest.src || src });
  existing.add(norm(q.q));
  added++;
}
fs.writeFileSync(target, JSON.stringify(bankFile, null, 1) + '\n');
const n = fixIds(loadBank());
const problems = validate(loadBank());
const mcq = bankFile.questions.filter((q) => q.type === 'mcq').length;
console.log(add.topic + ': добавлено ' + added + (skipped ? ', пропущено дублей ' + skipped : '') + ', выдано id ' + n + ' · теперь mcq ' + mcq + ', card ' + (bankFile.questions.length - mcq));
if (problems.length) { console.log('ПРОБЛЕМЫ:\n  ' + problems.slice(0, 30).join('\n  ')); process.exit(2); }
