// Минимальный hash-роутер:
//   #/                     — теория (каталог)
//   #/t/<topicId>[/<sN>][?from=<адрес>] — тема (from — куда вернёт «←», например к вопросу тренировки)
//   #/train                — тренировка (хаб)
//   #/train/s?mode=…&scope=…&n=…&kind=mcq|card|all  — сессия тренировки (kind — для «Повторение» и «Новое»)
//   #/stats                — статистика
//   #/search[?q=…]        — поиск по темам и вопросам
//   #/profile              — профиль (вход, синхронизация, настройки)
import { useSyncExternalStore } from 'react';

const subscribe = (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
const getHash = () => window.location.hash;

export function parseRoute(hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, query = ''] = raw.split('?');
  const p = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const params = Object.fromEntries(new URLSearchParams(query));
  if (p[0] === 't' && p[1]) return { name: 'topic', topicId: p[1], sectionId: p[2] || null, from: params.from || null };
  if (p[0] === 'train' && p[1] === 's') return { name: 'session', params };
  if (p[0] === 'train') return { name: 'train' };
  if (p[0] === 'stats') return { name: 'stats' };
  if (p[0] === 'profile') return { name: 'profile' };
  if (p[0] === 'search') return { name: 'search', q: params.q || '' };
  // старые ссылки на тесты (session 003)
  if (p[0] === 'quiz' && p[2]) return { name: 'session', params: { mode: 'test', scope: (p[1] === 'block' ? 'b' : 't') + p[2] } };
  return { name: 'catalog' };
}

export function useRoute() {
  return parseRoute(useSyncExternalStore(subscribe, getHash));
}

export const topicHref = (id, sectionId) => '#/t/' + encodeURIComponent(id) + (sectionId ? '/' + sectionId : '');
export const sessionHref = (mode, scope, n, kind) => '#/train/s?' + new URLSearchParams({ mode, ...(scope ? { scope } : {}), ...(n ? { n: String(n) } : {}), ...(kind ? { kind } : {}) }).toString();
export const navigate = (href) => { window.location.hash = href.replace(/^#/, ''); };
