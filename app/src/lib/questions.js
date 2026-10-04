// Вопросы для тренировок (public/data/questions.json, собирается из банка questions/*.json) и очереди сессий.
// Вопрос: { id, type: 'mcq'|'card', topicId, blockId, q, options?, correct?, explanation?, fixedOrder?, a?, tags? }
import { useEffect, useState } from 'react';
import { retrievability } from './srs.js';

let _bank = null;
let _promise = null;

export function loadQuestions() {
  if (!_promise) {
    _promise = fetch('data/questions.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('questions.json: HTTP ' + r.status); return r.json(); })
      .then((d) => {
        _bank = { all: d.questions, byId: Object.fromEntries(d.questions.map((q) => [q.id, q])) };
        return _bank;
      });
  }
  return _promise;
}

export function useQuestions() {
  const [state, setState] = useState({ bank: _bank, error: null });
  useEffect(() => {
    if (_bank) return;
    loadQuestions().then((b) => setState({ bank: b, error: null }), (e) => setState({ bank: null, error: e }));
  }, []);
  return state;
}

// ---------- области: 'all' | 'b1,b2,t0.3' ----------
export function parseScope(str) {
  if (!str || str === 'all') return { all: true, blocks: new Set(), topics: new Set() };
  const parts = str.split(',').filter(Boolean);
  return { all: false, blocks: new Set(parts.filter((p) => p[0] === 'b').map((p) => p.slice(1))), topics: new Set(parts.filter((p) => p[0] === 't').map((p) => p.slice(1))) };
}
export const inScope = (q, sc) => sc.all || sc.blocks.has(q.blockId) || sc.topics.has(q.topicId);
export function scopeLabel(manifest, str) {
  const sc = parseScope(str);
  if (sc.all) return 'Весь курс';
  const parts = [...sc.blocks].map((b) => 'Блок ' + b + (sc.blocks.size === 1 && !sc.topics.size ? ' · ' + (manifest.blockById[b]?.title || '') : ''))
    .concat([...sc.topics].map((t) => t + (sc.topics.size === 1 && !sc.blocks.size ? ' · ' + (manifest.byId[t]?.title || '') : '')));
  return parts.join(', ');
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Порядок курса: блоки и темы как в каталоге (а не лексикографический порядок файлов банка).
function courseRank(manifest) {
  const r = {};
  manifest.blocks.forEach((b, bi) => b.topicIds.forEach((t, ti) => { r[t] = bi * 1000 + ti; }));
  return r;
}

// Последняя оценка по каждому вопросу (из журнала).
export function lastGrades(p) {
  const m = {};
  for (const x of p.log) m[x.q] = x.g;
  return m;
}

// Сколько всего показывать к повторению за день. 200 — потолок, чтобы после перерыва сессия не превращалась в марафон.
export const MAX_REVIEWS_PER_DAY = 200;

export const MODES = {
  today: { title: 'Сегодня', desc: 'Повторение того, что пора вспомнить, плюс новые вопросы' },
  test: { title: 'Тест', desc: 'Вопросы с вариантами, объяснение сразу после ответа' },
  cards: { title: 'Карточки', desc: 'Вопрос → вспоминаешь → ответ → самооценка' },
  interview: { title: 'Собеседование', desc: 'Открытые вопросы вперемешку, на время, без подсказок' },
  exam: { title: 'Экзамен', desc: 'Тест на время, результаты только в конце' },
  mistakes: { title: 'Работа над ошибками', desc: 'Вопросы, на которые последний ответ был неверным' },
  weak: { title: 'Слабые места', desc: 'Изученные вопросы, которые вы вспомните с наименьшей вероятностью' },
  starred: { title: 'Избранное', desc: 'Отмеченные звёздочкой' },
};

// Очередь вопросов для сессии. Возвращает массив вопросов.
export function buildQueue({ mode, bank, progress, manifest, scope, n }) {
  const sc = parseScope(scope);
  const pool = bank.all.filter((q) => inScope(q, sc));
  const now = Date.now();
  const srs = progress.srs;
  const take = (arr) => (n ? arr.slice(0, n) : arr);
  switch (mode) {
    case 'today': {
      // повторения — по всему курсу (память не делится по областям); новые — из выбранной области, в порядке курса
      const due = bank.all.filter((q) => srs[q.id] && srs[q.id].due <= now).sort((a, b) => srs[a.id].due - srs[b.id].due).slice(0, MAX_REVIEWS_PER_DAY);
      const sod = new Date(); sod.setHours(0, 0, 0, 0);
      const newToday = Object.values(srs).filter((c) => c.fr >= +sod).length;
      const left = Math.max(0, (progress.settings.newPerDay || 0) - newToday);
      const rank = courseRank(manifest);
      // внутри темы — вперемешку, чтобы тест и карточки чередовались
      const fresh = shuffle(pool.filter((q) => !srs[q.id])).sort((a, b) => (rank[a.topicId] ?? 1e9) - (rank[b.topicId] ?? 1e9)).slice(0, left);
      // новые вставляем равномерно между повторениями
      const out = [];
      const step = fresh.length ? Math.max(1, Math.round(due.length / fresh.length)) : Infinity;
      let fi = 0;
      due.forEach((q, i) => { out.push(q); if ((i + 1) % step === 0 && fi < fresh.length) out.push(fresh[fi++]); });
      while (fi < fresh.length) out.push(fresh[fi++]);
      return out;
    }
    case 'test': return take(shuffle(pool.filter((q) => q.type === 'mcq')));
    case 'exam': return take(shuffle(pool.filter((q) => q.type === 'mcq')));
    case 'cards': {
      // сначала то, что пора повторить, потом новое, потом остальное
      const c = pool.filter((q) => q.type === 'card');
      const due = shuffle(c.filter((q) => srs[q.id] && srs[q.id].due <= now));
      const fresh = shuffle(c.filter((q) => !srs[q.id]));
      const rest = shuffle(c.filter((q) => srs[q.id] && srs[q.id].due > now));
      return take([...due, ...fresh, ...rest]);
    }
    case 'interview': return take(shuffle(pool.filter((q) => q.type === 'card')));
    case 'mistakes': { const lg = lastGrades(progress); return take(shuffle(pool.filter((q) => lg[q.id] === 1))); }
    case 'weak': {
      const seen = pool.filter((q) => srs[q.id]);
      return take(seen.map((q) => [q, retrievability(srs[q.id])]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));
    }
    case 'starred': return take(shuffle(pool.filter((q) => progress.marks.starred[q.id])));
    default: return [];
  }
}

// Сколько вопросов доступно в каждом режиме (для плиток на экране тренировки).
export function modeCounts({ bank, progress, manifest, scope }) {
  const sc = parseScope(scope);
  const pool = bank.all.filter((q) => inScope(q, sc));
  const lg = lastGrades(progress);
  const now = Date.now();
  return {
    test: pool.filter((q) => q.type === 'mcq').length,
    exam: pool.filter((q) => q.type === 'mcq').length,
    cards: pool.filter((q) => q.type === 'card').length,
    interview: pool.filter((q) => q.type === 'card').length,
    mistakes: pool.filter((q) => lg[q.id] === 1).length,
    weak: pool.filter((q) => progress.srs[q.id]).length,
    starred: pool.filter((q) => progress.marks.starred[q.id]).length,
    due: bank.all.filter((q) => progress.srs[q.id] && progress.srs[q.id].due <= now).length,
    fresh: pool.filter((q) => !progress.srs[q.id]).length,
  };
}
