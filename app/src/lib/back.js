// Системная кнопка / жест «назад» в APK: шаг назад внутри приложения, а не выход.
// Порядок: 1) закрыть верхний открытый слой (панель секций и т.п. — useBackHandler);
//          2) вкладка (кроме «Теории») → «Теория»; 3) тема / сессия → предыдущий экран (история) или родитель;
//          4) на «Теории» — свернуть приложение (как «Домой»; состояние не теряется).
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { parseRoute, navigate } from './router.js';

const handlers = []; // стек: последний открытый слой закрывается первым

export function useBackHandler(active, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    const h = () => ref.current();
    handlers.push(h);
    return () => { const i = handlers.lastIndexOf(h); if (i >= 0) handlers.splice(i, 1); };
  }, [active]);
}

const TABS = ['train', 'stats', 'profile'];
const PARENT = { topic: '#/', session: '#/train', search: '#/' };

let installed = false;
export function initBackButton() {
  if (!Capacitor.isNativePlatform() || installed) return;
  installed = true;
  App.addListener('backButton', ({ canGoBack }) => {
    if (handlers.length) { handlers[handlers.length - 1](); return; }
    const r = parseRoute(window.location.hash);
    if (r.name === 'catalog') { App.minimizeApp(); return; }
    if (TABS.includes(r.name)) { navigate('#/'); return; }
    if (canGoBack) window.history.back();
    else navigate(PARENT[r.name] || '#/');
  });
}
