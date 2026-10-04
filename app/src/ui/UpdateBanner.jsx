import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Новая версия приложения скачана service worker'ом — обновляемся по кнопке, а не посреди теста (ADR 010).
// updateServiceWorker(true) перезагружает страницу по событию controllerchange; если оно не пришло
// (у владельца плашка «залипала» и кнопка ничего не делала), через 3 с перезагружаем сами.
const FALLBACK_RELOAD_MS = 3000;

export default function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const [busy, setBusy] = useState(false);
  if (!needRefresh) return null;

  const update = async () => {
    setBusy(true);
    setTimeout(() => window.location.reload(), FALLBACK_RELOAD_MS);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      await updateServiceWorker(true);
    } catch { window.location.reload(); }
  };

  return (
    <div className="update-banner" role="status">
      <span>{busy ? 'Обновляю…' : 'Доступна новая версия курса'}</span>
      {!busy && <button className="btn btn-sm" onClick={() => setNeedRefresh(false)}>Позже</button>}
      {!busy && <button className="btn btn-sm btn-primary" onClick={update}>Обновить</button>}
    </div>
  );
}
