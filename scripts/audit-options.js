// Аудит подсказок в вариантах ответа: верный — самый длинный / единственный с формулой / единственный с пояснением.
// node scripts/audit-options.js [--list] [--topic=1.1]
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'questions');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const ONLY = (args.find(a => a.startsWith('--topic=')) || '').slice(8);

// длина «на глаз»: без тегов, формулы считаются по исходнику без пробелов и команд
function plain(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}\s]+/g, ' ').trim();
}
const len = s => plain(s).length;
const hasMath = s => /\$/.test(s);
const hasGloss = s => /[;(—:]/.test(s.replace(/\$[^$]*\$/g, ''));

// Флаги для вопроса; ratio — во сколько раз верный длиннее самого длинного неверного
function audit(q) {
  const L = q.options.map(len);
  const c = q.correct;
  const others = L.filter((_, i) => i !== c);
  const maxOther = Math.max(...others);
  const ratio = L[c] / Math.max(1, maxOther);
  const flags = [];
  if (L[c] > maxOther) flags.push(ratio > LONG_RATIO ? 'LONGEST' : 'longest');
  const m = q.options.map(hasMath);
  if (m[c] && m.filter(Boolean).length === 1) flags.push('ONLYMATH');
  const g = q.options.map(hasGloss);
  if (g[c] && g.filter(Boolean).length === 1) flags.push('ONLYGLOSS');
  const bad = flags.includes('LONGEST') || flags.includes('ONLYMATH') || flags.includes('ONLYGLOSS');
  return { flags, ratio, bad };
}

// верный длиннее самого длинного неверного больше чем на 10% — заметно глазом
const LONG_RATIO = 1.1;
module.exports = { audit, plain, LONG_RATIO };
if (require.main !== module) return;

let total = 0, longest = 0, strong = 0, onlyMath = 0, onlyGloss = 0, bad = 0, chance = 0;
const perTopic = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const topic = f.replace(/\.json$/, '');
  if (ONLY && topic !== ONLY) continue;
  const bank = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  const qs = (bank.questions || bank).filter(q => q.type === 'mcq');
  for (const q of qs) {
    const { flags, ratio } = audit(q);
    total++;
    chance += 1 / q.options.length;
    if (flags.some(x => x.toLowerCase() === 'longest')) longest++;
    if (flags.includes('LONGEST')) strong++;
    if (flags.includes('ONLYMATH')) onlyMath++;
    if (flags.includes('ONLYGLOSS')) onlyGloss++;
    const isBad = audit(q).bad;
    if (isBad) bad++;
    const t = perTopic[topic] || (perTopic[topic] = { n: 0, bad: 0 });
    t.n++; if (isBad) t.bad++;
    if (LIST && isBad) console.log(`${topic}\t${q.id}\t${flags.join(',')}\t${ratio.toFixed(2)}\t${plain(q.q).slice(0, 70)}`);
  }
}
const pct = x => (100 * x / total).toFixed(0) + '%';
console.log(`mcq ${total}; случайно был бы самым длинным ~${pct(chance)}`);
console.log(`верный самый длинный: ${longest} (${pct(longest)}), из них длиннее всех больше чем на 10%: ${strong} (${pct(strong)})`);
console.log(`единственный с формулой: ${onlyMath} (${pct(onlyMath)}); единственный с пояснением (; ( — :): ${onlyGloss} (${pct(onlyGloss)})`);
console.log(`с явной подсказкой (любой из сильных флагов): ${bad} (${pct(bad)})`);
if (!LIST) console.log(Object.entries(perTopic).map(([k, v]) => `${k}:${v.bad}/${v.n}`).join('  '));
