// Живой банк вопросов в APK (ADR 012). В APK вшит банк на момент сборки; если на сайте свежее —
// скачиваем его в Cache API и со следующего запуска приложения тренируемся по нему. Без сети — встроенный/скачанный.
// Проверка дешёвая: сначала data/version.json (~100 байт), сам банк (~5 МБ, по сети ~0.8 МБ сжатым) — только если он новее.
// Применяется при следующем запуске, а не сразу: банк не меняется под открытой сессией тренировки.
// На сайте (не APK) ничего этого не нужно — там банк обновляет service worker.
import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const WEB_URL = 'https://mlhelp-ede0d.web.app';
const SCHEMA = 1; // = BANK_SCHEMA в scripts/build-content.js
const CACHE = 'mlc-live-bank';
const REMOTE_Q = WEB_URL + '/data/questions.json';
const META_KEY = 'mlc:liveBank'; // { qv, schema, builtAt, count, at } скачанного банка
// Повторная проверка при возвращении в приложение — не чаще раза в час: банк меняется редко.
const RECHECK_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
const NATIVE = Capacitor.isNativePlatform();

let status = { native: NATIVE, source: 'bundled', builtAt: null, count: null, checking: false, pending: null, checkedAt: null, error: null };
const listeners = new Set();
const set = (p) => { status = { ...status, ...p }; listeners.forEach((l) => l()); };
export const useLiveBank = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status);

const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch { return null; } };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('нет ответа сервера')), ms))]);
const getJson = (url, opts) => fetch(url, opts).then((r) => { if (!r.ok) throw new Error(url.split('/').pop() + ': HTTP ' + r.status); return r.json(); });

let bundled = null; // version.json, вшитый в эту сборку
let inUse = null;   // { qv, builtAt } банка, по которому идёт работа

// Банк для loadQuestions(): скачанный, если он новее вшитого и цел, иначе вшитый.
export async function loadBankData() {
  if (NATIVE) {
    try {
      bundled = await getJson('data/version.json', { cache: 'no-cache' });
      const meta = readMeta();
      if (meta && meta.schema === SCHEMA && meta.builtAt > bundled.builtAt && typeof caches !== 'undefined') {
        const r = await (await caches.open(CACHE)).match(REMOTE_Q);
        const d = r && await r.json();
        if (d && d.qv === meta.qv && Array.isArray(d.questions) && d.questions.length) {
          inUse = { qv: meta.qv, builtAt: meta.builtAt };
          set({ source: 'live', builtAt: meta.builtAt, count: d.questions.length });
          scheduleChecks();
          return d;
        }
      }
    } catch { /* скачанный банк повреждён или кэш недоступен — берём вшитый */ }
  }
  const d = await getJson('data/questions.json', { cache: 'no-cache' });
  if (NATIVE) {
    inUse = { qv: d.qv, builtAt: bundled ? bundled.builtAt : 0 };
    set({ source: 'bundled', builtAt: inUse.builtAt || null, count: d.questions.length });
    scheduleChecks();
  }
  return d;
}

let lastCheck = 0;
let scheduled = false;
function scheduleChecks() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => checkForUpdate(), 3000); // не мешаем старту
  App.addListener('appStateChange', ({ isActive }) => { if (isActive && Date.now() - lastCheck > RECHECK_MS) checkForUpdate(); });
}

export async function checkForUpdate() {
  if (!NATIVE || !inUse || status.checking) return;
  lastCheck = Date.now();
  set({ checking: true, error: null });
  try {
    const remote = await withTimeout(getJson(WEB_URL + '/data/version.json', { cache: 'no-store' }), FETCH_TIMEOUT_MS);
    const newer = remote.schema === SCHEMA && remote.qv !== inUse.qv && remote.builtAt > inUse.builtAt;
    const already = readMeta();
    if (newer && !(already && already.qv === remote.qv)) {
      const text = await withTimeout(fetch(REMOTE_Q, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('questions.json: HTTP ' + r.status); return r.text(); }), FETCH_TIMEOUT_MS * 4);
      const d = JSON.parse(text);
      if (d.qv !== remote.qv || !Array.isArray(d.questions) || !d.questions.length) throw new Error('скачанный банк не совпал с версией');
      await (await caches.open(CACHE)).put(REMOTE_Q, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
      localStorage.setItem(META_KEY, JSON.stringify({ qv: remote.qv, schema: remote.schema, builtAt: remote.builtAt, count: d.questions.length, at: Date.now() }));
    }
    const meta = readMeta();
    set({ checking: false, checkedAt: Date.now(), pending: meta && meta.qv !== inUse.qv && meta.builtAt > inUse.builtAt ? meta : null });
  } catch (e) {
    set({ checking: false, checkedAt: Date.now(), error: e.message });
  }
}
