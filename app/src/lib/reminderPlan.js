// Расписание и текст напоминания о повторении — чистые функции (без плагинов), проверяются тестом.
import { plural } from './plural.js';

// Время по умолчанию при включении: 20:00 — вечер, когда обычно есть 10 минут; меняется в Профиле.
export const DEFAULT_REMIND_AT = '20:00';
const DAYS_AHEAD = 7;

// Ближайшие моменты напоминания: сегодня (если ещё не прошло) и следующие дни.
export function nextTimes(remindAt, now = new Date(), days = DAYS_AHEAD) {
  const [h, m] = (remindAt || DEFAULT_REMIND_AT).split(':').map(Number);
  const out = [];
  for (let i = 0; out.length < days && i <= days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    if (d - now > 60000) out.push(d);
  }
  return out;
}

// Текст напоминания на момент `at` по памяти повторения. null — напоминать не о чем.
export function reminderText(p, at, now = new Date()) {
  const due = Object.values(p.srs).filter((c) => c.due <= +at).length;
  const sameDay = at.toDateString() === now.toDateString();
  const sod = new Date(now); sod.setHours(0, 0, 0, 0);
  const newToday = sameDay ? Object.values(p.srs).filter((c) => c.fr >= +sod).length : 0;
  const fresh = Math.max(0, (p.settings.newPerDay || 0) - newToday);
  const trainedToday = sameDay && p.log.some((x) => x.t >= +sod);
  if (!due && (trainedToday || !fresh)) return null;
  if (due) return { title: 'Пора повторить', body: `${due} ${plural(due, 'вопрос ждёт', 'вопроса ждут', 'вопросов ждут')} повторения` + (fresh ? `, и ещё до ${fresh} новых` : '') };
  return { title: 'Applied ML', body: `${fresh} ${plural(fresh, 'новый вопрос', 'новых вопроса', 'новых вопросов')} на сегодня. Не теряйте серию` };
}

