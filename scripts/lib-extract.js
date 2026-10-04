// Извлечение данных из страниц курса без запуска их DOM-кода.
// Берём объявление верхнего уровня `const NAME = [ ... ];` / `{ ... };` (закрывающая скобка — в начале строки)
// и выполняем только его в песочнице vm.
const fs = require('fs'), vm = require('vm');

function extractConsts(file, names, pre = '') {
  const h = fs.readFileSync(file, 'utf8');
  const parts = [pre];
  for (const n of names) {
    const m = new RegExp('^const ' + n + '\\s*=\\s*', 'm').exec(h);
    if (!m) throw new Error(file + ': нет const ' + n);
    const rest = h.slice(m.index);
    const first = rest.split('\n')[0];
    if (/;\s*(\/\*.*\*\/)?\s*$/.test(first)) { parts.push(first); continue; } // объявление в одну строку
    const end = rest.search(/^[\]}]\s*;/m);
    if (end < 0) throw new Error(file + ': не найден конец const ' + n);
    parts.push(rest.slice(0, end) + rest.slice(end).split('\n')[0]);
  }
  const ctx = {};
  vm.runInNewContext(parts.join('\n') + '\n;globalThis.__r={' + names.join(',') + '};', ctx);
  return ctx.__r;
}

// blockN_quiz_data.js: Q.push({p,q,o,c,e}, ...)
function loadQuizData(file) {
  const ctx = { Q: [] };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
  return ctx.Q;
}

module.exports = { extractConsts, loadQuizData };
