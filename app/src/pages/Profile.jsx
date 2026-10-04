import { useSyncStatus, login, logout } from '../lib/sync.js';
import { useProgress, setSetting } from '../lib/progress.js';
import { HAPTICS_NATIVE, haptic } from '../lib/haptics.js';
import { streak } from '../lib/srs.js';
import { plural } from '../ui/ui.jsx';
import { useReminders, enableReminders, reschedule, testReminder, DEFAULT_REMIND_AT } from '../lib/reminders.js';
import { useLiveBank, checkForUpdate, WEB_URL } from '../lib/liveBank.js';

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

      <section className="qcard profile-sec">
        <h3 className="profile-h">Ваш путь</h3>
        <div className="profile-facts">
          <Fact v={st.days} l={plural(st.days, 'день', 'дня', 'дней') + ' подряд'} />
          <Fact v={p.log.length} l={plural(p.log.length, 'ответ', 'ответа', 'ответов') + ' всего'} />
          <Fact v={Object.values(p.topics).filter((t) => t.completedAt).length + ' / ' + manifest.readable.length} l="тем прочитано" />
        </div>
        {firstAnswer && firstAnswer !== Infinity && <p className="small muted">Учитесь с {fmtDate(firstAnswer)}</p>}
      </section>

      {HAPTICS_NATIVE && (
        <section className="qcard profile-sec">
          <h3 className="profile-h">Настройки</h3>
          <Reminder p={p} />
          <label className="switch-row">
            <span><b>Вибрация</b><span className="small muted">Отклик на нажатия, верные и неверные ответы</span></span>
            <input type="checkbox" className="switch" checked={hapticsOn}
              onChange={(e) => { setSetting('haptics', e.target.checked); if (e.target.checked) haptic('medium'); }} />
          </label>
        </section>
      )}

      <section className="qcard profile-sec">
        <h3 className="profile-h">О приложении</h3>
        <p className="small muted">Applied ML — курс прикладного машинного обучения: теория, тесты, карточки и интервальное повторение.
          Версия от {fmtDate(__BUILD_TIME__)}</p>
        {HAPTICS_NATIVE && <BankInfo />}
        {HAPTICS_NATIVE && <p className="small muted">Веб-версия: <a className="link" href={WEB_URL} target="_blank" rel="noreferrer">{WEB_URL.replace('https://', '')}</a></p>}
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

const fmtWhen = (t) => {
  const d = new Date(t), today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const day = d.toDateString() === today.toDateString() ? 'сегодня' : d.toDateString() === tomorrow.toDateString() ? 'завтра' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return day + ' в ' + fmtTime(t);
};

// Ежедневное напоминание о повторении (lib/reminders.js).
function Reminder({ p }) {
  const r = useReminders();
  const on = !!p.settings.remind;
  const at = p.settings.remindAt || DEFAULT_REMIND_AT;
  const toggle = async (v) => {
    if (v && !(await enableReminders())) return; // разрешение не дали — переключатель остаётся выключенным
    setSetting('remind', v);
    if (v && !p.settings.remindAt) setSetting('remindAt', DEFAULT_REMIND_AT);
    reschedule();
  };
  return (
    <div className="remind">
      <label className="switch-row">
        <span><b>Напоминание о повторении</b><span className="small muted">Раз в день: сколько вопросов пора вспомнить</span></span>
        <input type="checkbox" className="switch" checked={on} onChange={(e) => toggle(e.target.checked)} />
      </label>
      {on && (
        <div className="remind-opts">
          <label className="small">Время <input type="time" className="time-input" value={at} onChange={(e) => e.target.value && (setSetting('remindAt', e.target.value), reschedule())} /></label>
          <button className="btn btn-sm" onClick={testReminder}>Проверить</button>
        </div>
      )}
      {r.permission === 'denied' && <p className="small bad">Уведомления запрещены. Разрешите их в настройках Android: Приложения → Applied ML → Уведомления.</p>}
      {on && r.next && <p className="small muted">Ближайшее: {fmtWhen(r.next.at)} — «{r.next.body}»</p>}
      {on && !r.next && r.permission === 'granted' && <p className="small muted">На ближайшие дни напоминать не о чем.</p>}
      {r.testSent && <p className="small muted">Проверочное уведомление придёт через 5 секунд — можно свернуть приложение.</p>}
      {r.error && <p className="small bad">Ошибка уведомлений: {r.error}</p>}
    </div>
  );
}

// Банк вопросов в APK: встроенный или свежий с сайта (lib/liveBank.js).
function BankInfo() {
  const b = useLiveBank();
  let line = 'Банк вопросов: ' + (b.count ?? '…') + (b.builtAt ? ' от ' + fmtDate(b.builtAt) : '') + (b.source === 'live' ? ' (обновлён с сайта)' : '');
  return (
    <div className="bank-info">
      <p className="small muted">{line}</p>
      {b.pending && (
        <p className="small">Скачан новый банк: {b.pending.count} вопросов от {fmtDate(b.pending.builtAt)}.{' '}
          <button className="link-btn" onClick={() => window.location.reload()}>Применить сейчас</button></p>
      )}
      {!b.pending && (
        <p className="small muted">{b.checking ? 'Проверяю обновления…' : b.error ? 'Не удалось проверить обновления: ' + b.error : b.checkedAt ? 'Новых вопросов на сайте нет.' : ''}{' '}
          {!b.checking && <button className="link-btn" onClick={checkForUpdate}>Проверить</button>}</p>
      )}
    </div>
  );
}
