// Тактильный отклик (APK). Лёгкий щелчок на любое нажатие — общим обработчиком (initHaptics), ответы и оценки —
// своими паттернами: «верно» — успех, «неверно» / «не знал» — ошибка. Элементы с data-haptic="off" общий
// обработчик пропускает: их отклик задаёт код (иначе на ответ сработало бы два раза).
// Выключается в Профиле (settings.haptics === false). В браузере — только короткая вибрация на ошибку, как раньше.
// Плагин импортируется статически: ленивый import() Capacitor-плагинов в WebView виснет (Life OS, session 014).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getProgress } from './progress.js';

export const HAPTICS_NATIVE = Capacitor.isNativePlatform();
const enabled = () => getProgress().settings.haptics !== false;

export function haptic(kind = 'tap') {
  if (!enabled()) return;
  try {
    if (!HAPTICS_NATIVE) {
      if (kind === 'error' && navigator.vibrate) navigator.vibrate(40);
      return;
    }
    const p = kind === 'success' ? Haptics.notification({ type: NotificationType.Success })
      : kind === 'error' ? Haptics.notification({ type: NotificationType.Error })
      : Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    if (p && p.catch) p.catch(() => {}); // нет вибромотора — молча
  } catch { /* то же */ }
}

let installed = false;
export function initHaptics() {
  if (!HAPTICS_NATIVE || installed) return;
  installed = true;
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('button, a[href], [role="button"], summary, label');
    if (!el || el.disabled || el.closest('[data-haptic="off"]')) return;
    haptic('tap');
  }, true);
}
