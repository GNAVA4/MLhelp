// Линейные иконки одного стиля (24×24, обводка currentColor) вместо эмодзи: эмодзи на разных
// платформах рисуются по-разному и выглядят чужеродно рядом с текстом интерфейса.
const P = {
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" /></>,
  cards: <><rect x="7" y="3" width="13" height="15" rx="2" /><path d="M4 7v12a2 2 0 0 0 2 2h10" /></>,
  chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
};

export default function Icon({ name, size = 20, fill = false, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
