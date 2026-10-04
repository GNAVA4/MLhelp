// Проверка банка вопросов: `npm run questions` (код 2 при проблемах).
// --fix-ids — выдать id вопросам без id (новые вопросы можно добавлять без id и запускать это).
const path = require('path');
const { loadBank, validate, fixIds } = require('./lib-questions.js');
const { extractConsts } = require('./lib-extract.js');

const ROOT = path.join(__dirname, '..');
const { DATA } = extractConsts(path.join(ROOT, 'content-legacy', 'index_roadmap.html'), ['DATA'], "const P1='p1', P2='p2', P3='p3';");
// допустимые темы: с файлом (blockN_NN_) и запланированные с номером (0.4 …) — под них можно писать вопросы заранее
const topicIds = new Set();
for (const b of DATA) for (const t of b.topics) {
  const m = /^block(\d+)_(\d+)_/.exec(t.f || '');
  if (m) topicIds.add(m[1] + '.' + (+m[2]));
  else { const n = /^(\d+\.\d+)\s/.exec(t.t); if (n) topicIds.add(n[1]); }
}

let bank = loadBank();
if (process.argv.includes('--fix-ids')) { const n = fixIds(bank); console.log('выдано id: ' + n); bank = loadBank(); }
const problems = validate(bank, topicIds);
// подсказка формой: верный вариант заметно длиннее остальных или единственный с формулой / пояснением (scripts/audit-options.js)
const { audit } = require('./audit-options.js');
for (const f of bank) for (const q of f.questions) {
  if (q.type !== 'mcq') continue;
  const a = audit(q);
  if (a.bad) problems.push(f.topic + ' ' + q.id + ': верный вариант выделяется формой (' + a.flags.join(',') + ', длиннее в ' + a.ratio.toFixed(2) + ' раза) — выровнять варианты');
}
const all = bank.flatMap((f) => f.questions);
console.log('банк: файлов ' + bank.length + ', вопросов ' + all.length + ' (mcq ' + all.filter((q) => q.type === 'mcq').length + ', card ' + all.filter((q) => q.type === 'card').length + ')');
if (problems.length) { console.log('проблем: ' + problems.length); problems.slice(0, 40).forEach((p) => console.log('  ' + p)); process.exit(2); }
console.log('ok');
