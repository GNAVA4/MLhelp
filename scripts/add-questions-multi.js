// Пакет вопросов для нескольких тем: node scripts/add-questions-multi.js <file.json> [--src "..."]
// file.json — массив [{ topic, questions: [...] }, ...]; каждая часть добавляется как в add-questions.js.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/add-questions-multi.js <file.json> [--src "..."]'); process.exit(1); }
const rest = process.argv.slice(3);
const parts = JSON.parse(fs.readFileSync(file, 'utf8'));
let bad = false;
for (const part of parts) {
  const tmp = path.join(os.tmpdir(), 'mlc-add-' + part.topic + '-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify(part));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'add-questions.js'), tmp, ...rest], { encoding: 'utf8' });
  fs.rmSync(tmp, { force: true });
  process.stdout.write(r.stdout.split('\n').filter((l) => !/No character metrics/.test(l)).join('\n'));
  if (r.status !== 0) bad = true;
}
process.exit(bad ? 2 : 0);
