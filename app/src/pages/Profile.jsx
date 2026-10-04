import { useSyncStatus, login, logout } from '../lib/sync.js';
import { useProgress, setSetting } from '../lib/progress.js';
import { HAPTICS_NATIVE, haptic } from '../lib/haptics.js';
import { streak } from '../lib/srs.js';
import { plural } from '../ui/ui.jsx';

const fmtTime = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (t) => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

// Профиль: аккаунт и синхронизация, настройки устройства, о приложении.
export default function Profile({ manifest }) {
  const s = useSyncStatus();
  const p = useProgress();
  const st = streak(p);
  const firstAnswer = p.log.length ? Math.min(...p.log.map((x) => x.t || Infinity)) : null;
  const hapticsOn = p.settings.haptics !== false;

  return (
    <div className="page">
      <header className="page-head"><h1>Профиль</h1></header>

      <section className="qcard profile">
        <div className="profile-head">
          <Avatar user={s.user} />
          <div className="profile-who">
            <b>{s.user ? (s.user.name || s.user.email) : 'Гость'}</b>
            <span className="small muted">{s.user ? s.user.email : 'Прогресс хранится только на этом устройстве'}</span>
          </div>
        </div>
        {s.configured ? <SyncBlock s={s} /> : <p className="small muted">Синхронизация в этой сборке не настроена.</p>}
      </section>

      <section className="qcard">
        <h3 className="profile-h">Ваш путь</h3>
        <div className="profile-facts">
          <Fact v={st.days} l={plural(st.days, 'день', 'дня', 'дней') + ' подряд'} />
          <Fact v={p.log.length} l={plural(p.log.length, 'ответ', 'ответа', 'ответов') + ' всего'} />
          <Fact v={Object.values(p.topics).filter((t) => t.completedAt).length + ' / ' + manifest.readable.length} l="тем прочитано" />
        </div>
        {firstAnswer && firstAnswer !== Infinity && <p className="small muted">Учитесь с {fmtDate(firstAnswer)}</p>}
      </section>

      {HAPTICS_NATIVE && (
        <section className="qcard">
          <h3 className="profile-h">Настройки</h3>
          <label className="switch-row">
            <span><b>Вибрация</b><span className="small muted">Отклик на нажатия, верные и неверные ответы</span></span>
            <input type="checkbox" className="switch" checked={hapticsOn}
              onChange={(e) => { setSetting('haptics', e.target.checked); if (e.target.checked) haptic('medium'); }} />
          </label>
        </section>
      )}

      <section className="qcard">
        <h3 className="profile-h">О приложении</h3>
        <p className="small muted">Applied ML — курс прикладного машинного обучения: теория, тесты, карточки и интервальное повторение.
          Версия от {fmtDate(__BUILD_TIME__)}</p>
        {HAPTICS_NATIVE && <p className="small muted">Веб-версия: <a className="link" href="https://mlhelp-ede0d.web.app" target="_blank" rel="noreferrer">mlhelp-ede0d.web.app</a></p>}
      </section>
    </div>
  );
}

function SyncBlock({ s }) {
  let line, tone = 'muted';
  if (!s.user) line = s.phase === 'syncing' ? 'Проверка входа…' : 'Войдите, чтобы телефон и компьютер видели одну память повторения.';
  else if (s.phase === 'error') { line = 'Ошибка синхронизации: ' + (s.error || 'неизвестно'); tone = 'bad'; }
  else if (s.phase === 'syncing') line = 'Синхронизация…';
  else { line = 'Синхронизировано' + (s.lastSync ? ' в ' + fmtTime(s.lastSync) : '') + '. Без сети изменения сохранятся и отправятся позже.'; tone = 'ok-line'; }
  return (
    <div className="profile-sync">
      <span className={'small sync-line ' + tone}>{line}</span>
      {s.user
        ? <button className="btn" onClick={() => logout()}>Выйти</button>
        : s.phase !== 'syncing' && <button className="btn btn-primary btn-big" onClick={() => login()}>Войти через Google</button>}
    </div>
  );
}

function Avatar({ user }) {
  if (user?.photo) return <img className="avatar" src={user.photo} alt="" referrerPolicy="no-referrer" />;
  const ch = (user?.name || user?.email || '?').trim()[0].toUpperCase();
  return <span className="avatar avatar-ph">{user ? ch : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>}</span>;
}

const Fact = ({ v, l }) => <div className="fact"><b>{v}</b><span className="small muted">{l}</span></div>;
