// Ежедневное напоминание о повторении (APK). Включается в Профиле: settings.remind = true, settings.remindAt = 'ЧЧ:ММ'.
// Уведомления локальные — сервер не нужен. Расписание — на 7 дней вперёд, по одному на день, через `at`
// (календарный `on` на телефоне не срабатывал — опыт Life OS). Текст считается при планировании («пора повторить 12»),
// поэтому расписание пересобирается при запуске, при возвращении в приложение и после ответов.
// Сегодняшнее не ставится, если повторять нечего и сегодня уже занимались.
// Плагины импортируются статически (ленивый import() в WebView виснет), каждый нативный вызов — с таймаутом.
import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getProgress, subscribeProgress } from './progress.js';
import { navigate, sessionHref } from './router.js';
import { nextTimes, reminderText } from './reminderPlan.js';

export const REMINDERS_NATIVE = Capacitor.isNativePlatform();
export { DEFAULT_REMIND_AT } from './reminderPlan.js';
const CHANNEL = 'mlc-review';
const BASE_ID = 7000;          // id уведомлений: 7000..7006 — дни недели вперёд, 7099 — проверочное
const RESCHEDULE_DELAY_MS = 3000; // пересборка после серии ответов — пачкой
const CALL_TIMEOUT_MS = 8000;

let status = { native: REMINDERS_NATIVE, permission: null, next: null, error: null, testSent: false };
const listeners = new Set();
const set = (p) => { status = { ...status, ...p }; listeners.forEach((l) => l()); };
export const useReminders = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status);

const withTimeout = (p, ms = CALL_TIMEOUT_MS) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('плагин уведомлений не отвечает')), ms))]);

export async function reschedule() {
  if (!REMINDERS_NATIVE) return;
  const p = getProgress();
  try {
    const pending = await withTimeout(LocalNotifications.getPending());
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 7);
    if (ours.length) await withTimeout(LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) }));
    if (!p.settings.remind) { set({ next: null, error: null }); return; }
    const perm = await withTimeout(LocalNotifications.checkPermissions());
    set({ permission: perm.display });
    if (perm.display !== 'granted') { set({ next: null }); return; }
    const list = nextTimes(p.settings.remindAt).map((at, i) => {
      const t = reminderText(p, at);
      return t && { id: BASE_ID + i, title: t.title, body: t.body, channelId: CHANNEL, schedule: { at, allowWhileIdle: true }, extra: { href: sessionHref('today', 'all') } };
    }).filter(Boolean);
    if (list.length) await withTimeout(LocalNotifications.schedule({ notifications: list }));
    set({ next: list[0] ? { at: +list[0].schedule.at, body: list[0].body } : null, error: null });
  } catch (e) {
    set({ error: e.message });
  }
}

// Включение из Профиля: разрешение (Android 13+ спрашивает системным окном) и канал с высоким приоритетом.
export async function enableReminders() {
  try {
    let perm = await withTimeout(LocalNotifications.checkPermissions());
    if (perm.display !== 'granted') perm = await withTimeout(LocalNotifications.requestPermissions(), 60000);
    set({ permission: perm.display });
    if (perm.display !== 'granted') return false;
    await ensureChannel();
    return true;
  } catch (e) { set({ error: e.message }); return false; }
}

async function ensureChannel() {
  await withTimeout(LocalNotifications.createChannel({ id: CHANNEL, name: 'Повторение', description: 'Напоминание о вопросах, которые пора повторить', importance: 4, visibility: 1 }));
}

// Проверка всего тракта: уведомление через 5 секунд (результат — на экране, alert в WebView не виден).
export async function testReminder() {
  try {
    if (!(await enableReminders())) return;
    await withTimeout(LocalNotifications.schedule({ notifications: [{ id: BASE_ID + 99, title: 'Applied ML', body: 'Так будет выглядеть напоминание о повторении', channelId: CHANNEL, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { href: '#/train' } }] }));
    set({ testSent: true, error: null });
  } catch (e) { set({ error: e.message }); }
}

let installed = false;
export function initReminders() {
  if (!REMINDERS_NATIVE || installed) return;
  installed = true;
  LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const href = a.notification?.extra?.href;
    if (href) navigate(href);
  });
  let timer = null;
  const soon = () => { clearTimeout(timer); timer = setTimeout(reschedule, RESCHEDULE_DELAY_MS); };
  subscribeProgress(soon);
  App.addListener('appStateChange', ({ isActive }) => { if (isActive) soon(); });
  if (getProgress().settings.remind) ensureChannel().catch(() => {});
  soon();
}
