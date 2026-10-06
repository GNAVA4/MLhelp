// Вопросы для тренировок (public/data/questions.json, собирается из банка questions/*.json) и очереди сессий.
// Вопрос: { id, type: 'mcq'|'card', topicId, blockId, q, options?, correct?, explanation?, fixedOrder?, a?, note?, tags?, deep? }
import { useEffect, useState } from 'react';
import { retrievability } from './srs.js';
import { loadBankData } from './liveBank.js';

let _bank = null;
let _promise = null;

export function loadQuestions() {
  if (!_promise) {
    // в APK — встроенный или скачанный с сайта банк (lib/liveBank.js), на сайте — data/questions.json
    _promise = loadBankData()
      .then((d) => {
        _bank = { all: d.questions, byId: Object.fromEntries(d.questions.map((q) => [q.id, q])) };
        return _bank;
      });
  }
  return _promise;
}

// Банк, если уже загружен (без загрузки) — для счётчика на вкладке.
export const peekBank = () => _bank;

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

// Что видно в тренировке (session 022, решения владельца):
// - deep: углублённый вопрос (вывод, доказательство, задача-головоломка) — скрыт, пока в Профиле не включены
//   «Углублённые вопросы» (settings.showDeep);
// - settings.reviewOff[topicId]: тема выключена из повторения — её вопросы не попадают в «Повторить»,
//   в счётчики «пора вспомнить» и в напоминания; «Новое» и «Практика» её по-прежнему берут.
export const shownFor = (settings) => (q) => !q.deep || !!settings?.showDeep;
export const reviewOffFor = (settings) => (q) => !!settings?.reviewOff?.[q.topicId];

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

// Ошибки по каждому вопросу из журнала: { qid: { n, wrong } } (оценка 1 = не знал / неверно).
export function answerStats(p) {
  const m = {};
  for (const x of p.log) { const s = m[x.q] || (m[x.q] = { n: 0, wrong: 0 }); s.n++; if (x.g === 1) s.wrong++; }
  return m;
}

// «Слабость» вопроса 0..1 — для режима «Слабые места». Главное — доля ошибок, сглаженная априорными
// 1 ошибкой на 2 ответа (один случайный промах не делает вопрос худшим в курсе); добавки — трудность FSRS
// (d от 1 до 10) и риск забыть (1 − R). Веса 0.6 / 0.25 / 0.15: ошибки важнее, остальное различает равных.
export function weakness(c, st, now = new Date()) {
  const err = ((st?.wrong || 0) + 1) / ((st?.n || 0) + 2);
  const diff = Math.min(1, Math.max(0, ((c?.d ?? 5) - 1) / 9));
  return 0.6 * err + 0.25 * diff + 0.15 * (1 - retrievability(c, now));
}
// В «Слабые места» попадают изученные вопросы, где была хоть одна ошибка или «забывание» в FSRS.
const isWeak = (c, st) => !!c && ((st && st.wrong > 0) || c.l > 0);

// Сколько всего показывать к повторению за день. 200 — потолок, чтобы после перерыва сессия не превращалась в марафон.
export const MAX_REVIEWS_PER_DAY = 200;

// Тип вопросов в сессиях «Повторение» и «Новое»: тесты (mcq), карточки (card) или все.
export const KINDS = { mcq: 'тесты', card: 'карточки', all: 'всё' };
const ofKind = (kind) => (q) => !kind || kind === 'all' || q.type === kind;

export const MODES = {
  review: { title: 'Повторение', desc: 'То, что пора вспомнить по памяти повторения' },
  new: { title: 'Новое', desc: 'Вопросы, которые вы ещё не видели, по порядку курса' },
  test: { title: 'Тест', desc: 'Вопросы с вариантами, объяснение сразу после ответа' },
  cards: { title: 'Карточки', desc: 'Вопрос → вспоминаешь → ответ → самооценка' },
  interview: { title: 'Собеседование', desc: 'Открытые вопросы вперемешку, на время, без подсказок' },
  exam: { title: 'Экзамен', desc: 'Тест на время, результаты только в конце' },
  mistakes: { title: 'Работа над ошибками', desc: 'Вопросы, на которые последний ответ был неверным' },
  weak: { title: 'Слабые места', desc: 'Где вы ошибаетесь чаще всего: по доле ошибок, трудности и риску забыть' },
  starred: { title: 'Избранное', desc: 'Отмеченные звёздочкой' },
};

// Очередь вопросов для сессии. Возвращает массив вопросов.
export function buildQueue({ mode, bank, progress, manifest, scope, n, kind }) {
  const sc = parseScope(scope);
  const shown = shownFor(progress.settings);
  const pool = bank.all.filter((q) => inScope(q, sc) && shown(q));
  const now = Date.now();
  const srs = progress.srs;
  const off = reviewOffFor(progress.settings);
  const take = (arr) => (n ? arr.slice(0, n) : arr);
  switch (mode) {
    case 'review': {
      // сначала самые просроченные; область по умолчанию — весь курс (память не делится по темам)
      const due = pool.filter((q) => ofKind(kind)(q) && !off(q) && srs[q.id] && srs[q.id].due <= now).sort((a, b) => srs[a.id].due - srs[b.id].due);
      return due.slice(0, n || MAX_REVIEWS_PER_DAY);
    }
    case 'new': {
      // ещё не виденные, в порядке курса; внутри темы — вперемешку. Дневной ориентир новых здесь не ограничивает —
      // экран тренировки только предупреждает, что повторений станет больше (решение владельца, session 018)
      const rank = courseRank(manifest);
      return take(shuffle(pool.filter((q) => ofKind(kind)(q) && !srs[q.id])).sort((a, b) => (rank[a.topicId] ?? 1e9) - (rank[b.topicId] ?? 1e9)));
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
      const st = answerStats(progress);
      const weak = pool.filter((q) => isWeak(srs[q.id], st[q.id]));
      return take(weak.map((q) => [q, weakness(srs[q.id], st[q.id], new Date(now))]).sort((a, b) => b[1] - a[1]).map((x) => x[0]));
    }
    case 'starred': return take(shuffle(pool.filter((q) => progress.marks.starred[q.id])));
    default: return [];
  }
}

// Сколько вопросов доступно в каждом режиме (для плиток на экране тренировки).
export function modeCounts({ bank, progress, manifest, scope }) {
  const sc = parseScope(scope);
  const shown = shownFor(progress.settings);
  const pool = bank.all.filter((q) => inScope(q, sc) && shown(q));
  const lg = lastGrades(progress);
  const now = Date.now();
  return {
    test: pool.filter((q) => q.type === 'mcq').length,
    exam: pool.filter((q) => q.type === 'mcq').length,
    cards: pool.filter((q) => q.type === 'card').length,
    interview: pool.filter((q) => q.type === 'card').length,
    mistakes: pool.filter((q) => lg[q.id] === 1).length,
    weak: (() => { const st = answerStats(progress); return pool.filter((q) => isWeak(progress.srs[q.id], st[q.id])).length; })(),
    starred: pool.filter((q) => progress.marks.starred[q.id]).length,
  };
}

// Счётчики по каждой теме: всего / новых / пора повторить — отдельно для тестов и карточек; seen — изучено (оба типа).
// Тема выключена из повторения (off) — её due = 0, а сколько ждало бы, лежит в offDue.
// { [topicId]: { mcq: {all, fresh, due}, card: {all, fresh, due}, seen, all, off, offDue } }
export function topicStats({ bank, progress, now = Date.now() }) {
  const m = {};
  const shown = shownFor(progress.settings);
  const offMap = progress.settings?.reviewOff || {};
  for (const q of bank.all) {
    if (!shown(q)) continue;
    const s = m[q.topicId] || (m[q.topicId] = { mcq: { all: 0, fresh: 0, due: 0 }, card: { all: 0, fresh: 0, due: 0 }, seen: 0, all: 0, blockId: q.blockId, off: !!offMap[q.topicId], offDue: 0 });
    const k = s[q.type === 'mcq' ? 'mcq' : 'card'];
    const c = progress.srs[q.id];
    k.all++; s.all++;
    if (!c) k.fresh++; else { s.seen++; if (c.due <= now) { if (s.off) s.offDue++; else k.due++; } }
  }
  return m;
}

// Сумма счётчиков по области: { mcq: {all, fresh, due}, card: {…} }.
export function sumStats(stats, scope) {
  const sc = parseScope(scope);
  const out = { mcq: { all: 0, fresh: 0, due: 0 }, card: { all: 0, fresh: 0, due: 0 } };
  for (const [tid, s] of Object.entries(stats)) {
    if (!(sc.all || sc.topics.has(tid) || sc.blocks.has(s.blockId))) continue;
    for (const k of ['mcq', 'card']) for (const f of ['all', 'fresh', 'due']) out[k][f] += s[k][f];
  }
  return out;
}
