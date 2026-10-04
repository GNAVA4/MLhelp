import { useRegisterSW } from 'virtual:pwa-register/react';

// Новая версия приложения скачана service worker'ом — обновляемся по кнопке, а не посреди теста (ADR 010).
export default function UpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>Доступна новая версия курса</span>
      <button className="btn btn-sm" onClick={() => setNeedRefresh(false)}>Позже</button>
      <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>Обновить</button>
    </div>
  );
}
