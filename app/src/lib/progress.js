// Прогресс чтения. Пока хранится локально (localStorage); форма записей совпадает с будущей схемой Firestore
// users/{uid}/topics/{topicId} (docs/ML_COURSE_HANDOFF.md §7), чтобы синхронизация подключалась без миграции.
//
// topics[topicId] = { sectionsRead: string[], lastSection, maxScroll, startedAt, completedAt, updatedAt,
//                     marks: { understood?: bool, revisit?: bool }, note? }
// meta = { lastTopicId, lastOpenedAt }
// attempts = [{ id, scope: 'block:1'|'topic:1.3', mode: 'all'|'random'|'wrong', startedAt, finishedAt,
//               total, correct, answers: [{ qid, chosen, correct, ms }] }]  ← users/{uid}/attempts/{id}
import { useSyncExternalStore } from 'react';

const KEY = 'mlc:progress';
const EMPTY = { topics: {}, meta: {}, attempts: [] };
// Локально храним последние 300 попыток (~5–10 КБ каждая у тестов блока) — с запасом до лимита localStorage ~5 МБ.
const MAX_ATTEMPTS = 300;

function read() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.topics ? { ...EMPTY, ...v } : EMPTY; } catch { return EMPTY; }
}

let state = read();
const listeners = new Set();

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* квота/приватный режим — работаем в памяти */ }
  listeners.forEach((l) => l());
}

// изменения из другой вкладки
window.addEventListener('storage', (e) => { if (e.key === KEY) { state = read(); listeners.forEach((l) => l()); } });

const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const useProgress = () => useSyncExternalStore(subscribe, () => state);
export const getProgress = () => state;

function patchTopic(id, fn) {
  const now = Date.now();
  const prev = state.topics[id] || { sectionsRead: [], marks: {}, startedAt: now };
  const next = { ...fn(prev), updatedAt: now };
  commit({ ...state, topics: { ...state.topics, [id]: next } });
}

export function openTopic(id) {
  const now = Date.now();
  patchTopic(id, (t) => t);
  commit({ ...state, meta: { ...state.meta, lastTopicId: id, lastOpenedAt: now } });
}

export function setCurrentSection(id, sectionId) {
  if (state.topics[id]?.lastSection === sectionId) return;
  patchTopic(id, (t) => ({ ...t, lastSection: sectionId }));
}

export function markSectionRead(id, sectionId, totalSections) {
  const t = state.topics[id];
  if (t?.sectionsRead?.includes(sectionId)) return;
  patchTopic(id, (t) => {
    const sectionsRead = [...t.sectionsRead, sectionId];
    // тема прочитана, когда прочитаны все её секции
    const completedAt = t.completedAt || (totalSections && sectionsRead.length >= totalSections ? Date.now() : undefined);
    return { ...t, sectionsRead, completedAt };
  });
}

export function setMaxScroll(id, pct) {
  if ((state.topics[id]?.maxScroll || 0) >= pct) return;
  patchTopic(id, (t) => ({ ...t, maxScroll: pct }));
}

export function setCompleted(id, done) {
  patchTopic(id, (t) => ({ ...t, completedAt: done ? Date.now() : undefined }));
}

export function setMark(id, mark, value) {
  patchTopic(id, (t) => ({ ...t, marks: { ...t.marks, [mark]: value } }));
}

export function setNote(id, note) {
  patchTopic(id, (t) => ({ ...t, note }));
}

export function saveAttempt(a) {
  const attempts = [...state.attempts, a].slice(-MAX_ATTEMPTS);
  commit({ ...state, attempts });
}

// Лучшая и последняя попытка по области (scope = 'block:1' | 'topic:1.3'); считаются только полные прохождения (mode 'all').
export function scopeResults(p, scope) {
  const list = p.attempts.filter((a) => a.scope === scope);
  const full = list.filter((a) => a.mode === 'all');
  const best = full.reduce((b, a) => (!b || a.correct / a.total > b.correct / b.total ? a : b), null);
  return { best, last: list[list.length - 1] || null, count: list.length };
}

// Доля прочитанного 0..1: по секциям, если они есть, иначе по прокрутке (блок 3 без id="sN").
export function topicPct(topic, p) {
  if (!p) return 0;
  if (p.completedAt) return 1;
  if (topic.sections.length) return Math.min(1, (p.sectionsRead?.length || 0) / topic.sections.length);
  return (p.maxScroll || 0) / 100;
}

export function topicStatus(topic, p) {
  if (!p) return 'new';
  if (p.completedAt) return 'done';
  return 'reading';
}
