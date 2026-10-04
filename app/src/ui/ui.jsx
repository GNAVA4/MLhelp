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

export const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const fmtMinutes = (m) => (m >= 60 ? Math.floor(m / 60) + ' ч ' + (m % 60 ? (m % 60) + ' мин' : '') : m + ' мин').trim();
