import { useSyncStatus, login, logout } from '../lib/sync.js';

const fmtTime = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Вход и состояние синхронизации прогресса между устройствами.
export default function Account() {
  const s = useSyncStatus();
  if (!s.configured) return null;

  let line;
  if (!s.user) line = s.phase === 'syncing' ? 'Проверка входа…' : 'Прогресс хранится только на этом устройстве. Войдите, чтобы телефон и компьютер видели одну память повторения.';
  else if (s.phase === 'error') line = 'Ошибка синхронизации: ' + (s.error || 'неизвестно');
  else if (s.phase === 'syncing') line = 'Синхронизация…';
  else line = 'Синхронизировано' + (s.lastSync ? ' в ' + fmtTime(s.lastSync) : '') + '. Без сети изменения сохранятся и отправятся позже.';

  return (
    <section className="qcard account">
      <div className="account-row">
        <div className="account-main">
          <b>{s.user ? (s.user.name || s.user.email) : 'Синхронизация'}</b>
          {s.user?.name && s.user.email && <span className="small muted">{s.user.email}</span>}
          <span className={'small ' + (s.phase === 'error' ? 'bad' : 'muted')}>{line}</span>
        </div>
        {s.user
          ? <button className="btn btn-sm" onClick={() => logout()}>Выйти</button>
          : s.phase !== 'syncing' && <button className="btn btn-primary btn-sm" onClick={() => login()}>Войти через Google</button>}
      </div>
    </section>
  );
}
