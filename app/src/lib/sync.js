// Синхронизация прогресса между устройствами: Firebase Auth (Google) + Firestore, офлайн-first.
// Отдельный Firebase-проект курса (с Life OS не связан). Схема:
//   users/{uid}/state/{раздел}  = { value: JSON-строка, updatedAt }   — разделы SECTIONS (каждый < 1 МиБ)
//   users/{uid}/attempts/{id}   = { value: JSON-строка, updatedAt }   — попытки тестов по одной (их до 300, вместе > 1 МиБ)
// Разделы не перезаписывают друг друга: облако и устройство сливаются (lib/merge.js), результат пишется обратно.
//
// SDK (~600 КБ) грузится лениво: пока на устройстве не входили (нет SIGNED_KEY), firebase не загружается вовсе.
// Конфиг — src/firebaseConfig.js (в .gitignore); без него синхронизация просто выключена.
import { useSyncExternalStore } from 'react';
import { getProgress, updateState, subscribeProgress } from './progress.js';
import { mergeProgress } from './merge.js';
// APK (Capacitor, ADR 011): в WebView Google запрещает вход попапом/редиректом (disallowed_useragent) —
// idToken даёт нативный Google Sign-In, а входит им web-SDK (его использует Firestore).
// Плагин импортируется статически: ленивый import() плагинов в WebView виснет (опыт Life OS, session 014). Вес — тонкий мост.
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const SIGNED_KEY = 'mlc:signedIn';
const SECTIONS = ['srs', 'log', 'marks', 'topics', 'meta', 'settings'];
// Пауза перед отправкой локальных изменений: ответы в сессии идут каждые несколько секунд — пачкой дешевле.
const PUSH_DELAY_MS = 1500;

const cfgLoader = import.meta.glob('../firebaseConfig.js'); // {} если файла нет
const cfgImport = Object.values(cfgLoader)[0];
export const SYNC_CONFIGURED = !!cfgImport;

// ---- статус для интерфейса ----
let status = { configured: SYNC_CONFIGURED, user: null, phase: SYNC_CONFIGURED ? 'signedOut' : 'off', lastSync: null, error: null };
const listeners = new Set();
function setStatus(patch) { status = { ...status, ...patch }; listeners.forEach((l) => l()); }
export const useSyncStatus = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => status);

// ---- ленивый SDK ----
let _fb = null;
function fb() {
  if (!_fb) _fb = (async () => {
    const [appMod, a, f, cfg] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), cfgImport()]);
    // На Firebase Hosting вход идёт через свой же домен (/__/auth/handler): с чужим authDomain redirect-вход ломается
    // в Safari/iOS-PWA из-за разделения хранилища третьих сторон. Локально — authDomain из конфига.
    const onHosting = /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
    const app = appMod.initializeApp(onHosting ? { ...cfg.firebaseConfig, authDomain: location.hostname } : cfg.firebaseConfig);
    const auth = a.getAuth(app);
    let db;
    try { db = f.initializeFirestore(app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
    catch { db = f.initializeFirestore(app, {}); } // IndexedDB недоступна (приватный режим) — без офлайн-кэша
    return { auth, db, a, f };
  })();
  return _fb;
}

// ---- сессия синхронизации ----
let run = null; // { uid, unsubs: [], lastPushed: {}, pushedAttempts: Set, timer }

const enc = (v) => JSON.stringify(v ?? null);
const dec = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

async function start(uid) {
  stop();
  const me = { uid, unsubs: [], lastPushed: {}, pushedAttempts: new Set(), timer: null };
  run = me;
  setStatus({ phase: 'syncing', error: null });
  const { db, f } = await fb();
  const stateCol = f.collection(db, 'users', uid, 'state');
  const attCol = f.collection(db, 'users', uid, 'attempts');

  // 1. Забрать облако целиком и слить с устройством
  const [sSnap, aSnap] = await Promise.all([f.getDocs(stateCol), f.getDocs(attCol)]);
  if (run !== me) return;
  const cloud = {}, cloudStr = {};
  sSnap.forEach((d) => { const v = d.data()?.value; if (typeof v === 'string') { cloudStr[d.id] = v; cloud[d.id] = dec(v); } });
  cloud.attempts = [];
  aSnap.forEach((d) => { const v = dec(d.data()?.value); if (v) { cloud.attempts.push(v); me.pushedAttempts.add(v.id); } });
  const merged = mergeProgress(getProgress(), cloud);
  for (const s of SECTIONS) me.lastPushed[s] = cloudStr[s];
  updateState(() => merged);

  // 2. Отправить то, чего в облаке нет или что изменилось после слияния
  await push(me);

  // 3. Дальше — живые изменения с других устройств и отправка своих
  me.unsubs.push(f.onSnapshot(stateCol, (snap) => {
    const remote = {};
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
      const v = ch.doc.data()?.value;
      if (typeof v !== 'string' || v === me.lastPushed[ch.doc.id]) return;
      me.lastPushed[ch.doc.id] = v;
      remote[ch.doc.id] = dec(v);
    });
    if (Object.keys(remote).length) updateState((s) => mergeProgress(s, remote));
  }, (e) => setStatus({ phase: 'error', error: e.message })));
  me.unsubs.push(f.onSnapshot(attCol, (snap) => {
    const add = [];
    snap.docChanges().forEach((ch) => {
      if (ch.type !== 'added' || ch.doc.metadata.hasPendingWrites) return;
      const v = dec(ch.doc.data()?.value);
      if (v && !me.pushedAttempts.has(v.id)) { me.pushedAttempts.add(v.id); add.push(v); }
    });
    if (add.length) updateState((s) => mergeProgress(s, { attempts: add }));
  }));
  me.unsubs.push(subscribeProgress(() => {
    clearTimeout(me.timer);
    me.timer = setTimeout(() => push(me), PUSH_DELAY_MS);
  }));
}

async function push(me) {
  if (run !== me) return;
  const { db, f } = await fb();
  const p = getProgress();
  const writes = [];
  for (const s of SECTIONS) {
    const v = enc(p[s]);
    if (v === me.lastPushed[s]) continue;
    me.lastPushed[s] = v;
    writes.push(f.setDoc(f.doc(db, 'users', me.uid, 'state', s), { value: v, updatedAt: f.serverTimestamp() }));
  }
  for (const a of p.attempts) {
    if (!a?.id || me.pushedAttempts.has(a.id)) continue;
    me.pushedAttempts.add(a.id);
    writes.push(f.setDoc(f.doc(db, 'users', me.uid, 'attempts', String(a.id)), { value: enc(a), updatedAt: f.serverTimestamp() }));
  }
  // Офлайн setDoc ждёт сервера бесконечно, но запись уже в локальном кэше Firestore и уйдёт при связи —
  // поэтому статус «синхронизировано» ставим по подтверждению, а ошибки показываем.
  setStatus({ phase: 'syncing' });
  try { await Promise.all(writes); if (run === me) setStatus({ phase: 'ok', lastSync: Date.now(), error: null }); }
  catch (e) { if (run === me) setStatus({ phase: 'error', error: e.message }); }
}

function stop() {
  if (!run) return;
  clearTimeout(run.timer);
  run.unsubs.forEach((u) => u());
  run = null;
}

// ---- вход / выход ----
async function attachAuth() {
  const { auth, a } = await fb();
  // в APK редиректа не бывает (вход нативный), а getRedirectResult там бросает operation-not-supported
  if (!Capacitor.isNativePlatform()) { try { await a.getRedirectResult(auth); } catch (e) { setStatus({ error: e.message }); } }
  a.onAuthStateChanged(auth, (u) => {
    if (u) {
      setStatus({ user: { uid: u.uid, name: u.displayName, email: u.email } });
      start(u.uid).catch((e) => setStatus({ phase: 'error', error: e.message }));
    } else { stop(); setStatus({ user: null, phase: 'signedOut' }); }
  });
}

let attached = false;
// Вызывается при старте приложения: SDK грузится, только если на этом устройстве уже входили.
export function initSync() {
  if (!SYNC_CONFIGURED || attached) return;
  let signed = false;
  try { signed = !!localStorage.getItem(SIGNED_KEY); } catch { /* приватный режим */ }
  if (!signed) return;
  attached = true;
  setStatus({ phase: 'syncing' });
  attachAuth().catch((e) => setStatus({ phase: 'error', error: e.message }));
}

export async function login() {
  if (!SYNC_CONFIGURED) return;
  try { localStorage.setItem(SIGNED_KEY, '1'); } catch { /* не критично */ }
  const { auth, a } = await fb();
  if (!attached) { attached = true; await attachAuth(); }
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await FirebaseAuthentication.signInWithGoogle();
      const idToken = res.credential && res.credential.idToken;
      if (!idToken) throw new Error('Google не вернул idToken');
      await a.signInWithCredential(auth, a.GoogleAuthProvider.credential(idToken));
    } catch (e) { if (!/cancel/i.test(e.message || '')) setStatus({ error: e.message }); }
    return;
  }
  const provider = new a.GoogleAuthProvider();
  try { await a.signInWithPopup(auth, provider); }
  catch (e) {
    // на части мобильных браузеров попап блокируется — вход через перенаправление страницы
    if (/popup-blocked|operation-not-supported|popup-closed-by-browser/.test(e.code || '')) return a.signInWithRedirect(auth, provider);
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setStatus({ error: e.message });
  }
}

// Выход: прогресс остаётся на устройстве; при следующем входе снова сольётся с облаком.
export async function logout() {
  try { localStorage.removeItem(SIGNED_KEY); } catch { /* не критично */ }
  stop();
  if (Capacitor.isNativePlatform()) { try { await FirebaseAuthentication.signOut(); } catch { /* нативная сессия уже закрыта */ } }
  const { auth, a } = await fb();
  await a.signOut(auth);
}
