// Интервальное повторение: FSRS (библиотека ts-fsrs). Любой ответ в любом режиме обновляет память вопроса.
// Оценки: 1 — не знал (Again), 2 — с трудом (Hard), 3 — знал (Good), 4 — легко (Easy).
// Тест с вариантами: верно → 3, неверно → 1.
import { fsrs, generatorParameters, createEmptyCard, State } from 'ts-fsrs';
import { getProgress, updateState } from './progress.js';

// request_retention 0.9 — стандарт FSRS: повторение назначается, когда шанс вспомнить падает до 90%.
// enable_fuzz — небольшой разброс интервалов, чтобы карточки одного дня не повторялись потом всегда вместе.
const F = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));
// Журнал ответов: последние 8000 (~40 байт каждый ≈ 320 КБ) — хватает для статистики за месяцы.
const MAX_LOG = 8000;
// «Выучено»: стабильность ≥ 21 дня (термин Anki «mature»).
export const MATURE_DAYS = 21;

const r4 = (x) => Math.round(x * 1e4) / 1e4;
function toCard(c) {
  return { due: new Date(c.due), stability: c.s, difficulty: c.d, elapsed_days: c.ed, scheduled_days: c.sd, reps: c.r,
    lapses: c.l, learning_steps: c.ls, state: c.st, last_review: c.lr ? new Date(c.lr) : undefined };
}
function fromCard(c, first) {
  return { due: +c.due, s: r4(c.stability), d: r4(c.difficulty), ed: c.elapsed_days, sd: c.scheduled_days, r: c.reps,
    l: c.lapses, ls: c.learning_steps, st: c.state, lr: c.last_review ? +c.last_review : undefined, fr: first };
}

export function review(qid, grade, mode, now = new Date()) {
  updateState((s) => {
    const prev = s.srs[qid];
    const cur = prev ? toCard(prev) : createEmptyCard(now);
    const { card } = F.next(cur, now, grade);
    const log = s.log.length >= MAX_LOG ? s.log.slice(-MAX_LOG + 1) : s.log.slice();
    log.push({ q: qid, t: +now, g: grade, m: mode });
    return { ...s, srs: { ...s.srs, [qid]: fromCard(card, prev?.fr ?? +now) }, log };
  });
}

// Когда вопрос будет показан снова при каждой из оценок — подписи на кнопках («10 мин», «4 дн»).
export function previewIntervals(qid, now = new Date()) {
  const c = getProgress().srs[qid];
  const rep = F.repeat(c ? toCard(c) : createEmptyCard(now), now);
  return { 1: +rep[1].card.due - +now, 2: +rep[2].card.due - +now, 3: +rep[3].card.due - +now, 4: +rep[4].card.due - +now };
}

export function retrievability(c, now = new Date()) {
  if (!c) return 0;
  return F.get_retrievability(toCard(c), now, false);
}

export const isLearning = (c) => c && (c.st === State.Learning || c.st === State.Relearning);
export const isMature = (c) => c && c.st === State.Review && c.s >= MATURE_DAYS;

export function fmtInterval(ms) {
  const m = ms / 60000;
  if (m < 1) return '<1 мин';
  if (m < 60) return Math.round(m) + ' мин';
  const h = m / 60;
  if (h < 24) return Math.round(h) + ' ч';
  const d = h / 24;
  if (d < 31) return Math.round(d) + ' дн';
  const mo = d / 30.4;
  if (mo < 12) return (mo < 10 ? Math.round(mo * 10) / 10 : Math.round(mo)) + ' мес';
  return Math.round((d / 365) * 10) / 10 + ' г';
}

// ---------- дни и серия ----------
export const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };

export function todayInfo(p, now = Date.now()) {
  const sod = startOfDay(now);
  const today = p.log.filter((x) => x.t >= sod);
  const newToday = Object.values(p.srs).filter((c) => c.fr >= sod).length;
  return { answered: today.length, correct: today.filter((x) => x.g >= 3).length, newToday };
}

export function streak(p, now = Date.now()) {
  const days = new Set(p.log.map((x) => dayKey(x.t)));
  let n = 0, d = new Date(now);
  if (!days.has(dayKey(+d))) d.setDate(d.getDate() - 1); // сегодня ещё не занимался — серия не прервана
  while (days.has(dayKey(+d))) { n++; d.setDate(d.getDate() - 1); }
  return { days: n, activeToday: days.has(dayKey(now)) };
}
