import Icon from './icons.jsx';

// Вкладки приложения: на телефоне — снизу, на широком экране — сверху.
export default function TabBar({ active, dueCount }) {
  const tabs = [
    { id: 'catalog', href: '#/', label: 'Теория', ico: 'book' },
    { id: 'train', href: '#/train', label: 'Тренировка', ico: 'cards', badge: dueCount },
    { id: 'stats', href: '#/stats', label: 'Статистика', ico: 'chart' },
    { id: 'profile', href: '#/profile', label: 'Профиль', ico: 'user' },
  ];
  return (
    <nav className="tabbar" aria-label="Разделы">
      {tabs.map((t) => (
        <a key={t.id} href={t.href} className={'tab' + (active === t.id ? ' tab-on' : '')} aria-current={active === t.id ? 'page' : undefined}>
          <Icon name={t.ico} className="tab-ico" />
          <span className="tab-l">{t.label}</span>
          {t.badge > 0 && <span className="tab-badge">{t.badge > 99 ? '99+' : t.badge}</span>}
        </a>
      ))}
    </nav>
  );
}
