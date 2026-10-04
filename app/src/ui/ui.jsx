// Мелкие общие элементы интерфейса.

export function Bar({ value, color, thin }) {
  return (
    <div className={'bar' + (thin ? ' bar-thin' : '')}>
      <div className="bar-fill" style={{ width: Math.round(value * 100) + '%', background: color }} />
    </div>
  );
}

const STATUS_LABEL = { new: 'новый стандарт', mid: 'промежуточный', old: 'старый формат', planned: 'в планах' };
export function ContentBadge({ status }) {
  return <span className={'cbadge cb-' + status} title={STATUS_LABEL[status]}>{status === 'planned' ? 'план' : status}</span>;
}

// Кружок прогресса темы: пусто / дуга / галочка.
export function Ring({ pct, color, size = 22 }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  if (pct >= 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="прочитано">
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
        <path d={`M${size * 0.3} ${size * 0.52} l${size * 0.14} ${size * 0.14} l${size * 0.27} -${size * 0.3}`} stroke="#0b1120" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={Math.round(pct * 100) + '%'}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bd2)" strokeWidth="2" />
      {pct > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
    </svg>
  );
}

export { plural } from '../lib/plural.js';

export const fmtMinutes = (m) => (m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60 ? (m % 60) + ' мин' : '') : m + ' мин').trim();

// Строка «Поиск…» — вход на экран поиска (#/search).
export function SearchEntry() {
  return (
    <a className="search-entry" href="#/search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
      <span>Поиск по темам и вопросам</span>
    </a>
  );
}
