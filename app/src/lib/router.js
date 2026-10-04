// Минимальный hash-роутер: #/ — каталог, #/t/<topicId>[/<sectionId>] — тема.
import { useSyncExternalStore } from 'react';

const subscribe = (cb) => { window.addEventListener('hashchange', cb); return () => window.removeEventListener('hashchange', cb); };
const getHash = () => window.location.hash;

export function parseRoute(hash) {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 't' && p[1]) return { name: 'topic', topicId: p[1], sectionId: p[2] || null };
  if (p[0] === 'quiz' && (p[1] === 'block' || p[1] === 'topic') && p[2]) return { name: 'quiz', scopeType: p[1], scopeId: p[2] };
  return { name: 'catalog' };
}

export function useRoute() {
  return parseRoute(useSyncExternalStore(subscribe, getHash));
}

export const topicHref = (id, sectionId) => '#/t/' + encodeURIComponent(id) + (sectionId ? '/' + sectionId : '');
export const quizHref = (type, id) => '#/quiz/' + type + '/' + encodeURIComponent(id);
export const navigate =(href) => { window.location.hash = href.replace(/^#/, ''); };
