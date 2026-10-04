// Вкладки приложения: на телефоне — снизу, на широком экране — сверху.
export default function TabBar({ active, dueCount }) {
  const tabs = [
    { id: 'catalog', href: '#/', label: 'Теория', ico: '📖' },
    { id: 'train', href: '#/train', label: 'Тренировка', ico: '🎯', badge: dueCount },
    { id: 'stats', href: '#/stats', label: 'Статистика', ico: '📊' },
  ];
  return (
    <nav className="tabbar" aria-label="Разделы">
      {tabs.map((t) => (
        <a key={t.id} href={t.href} className={'tab' + (active === t.id ? ' tab-on' : '')} aria-current={active === t.id ? 'page' : undefined}>
          <span className="tab-ico">{t.ico}</span>
          <span className="tab-l">{t.label}</span>
          {t.badge > 0 && <span className="tab-badge">{t.badge > 99 ? '99+' : t.badge}</span>}
        </a>
      ))}
    </nav>
  );
}
