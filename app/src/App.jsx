import { useManifest } from './lib/content.js';
import { useRoute } from './lib/router.js';
import { useProgress } from './lib/progress.js';
import Catalog from './pages/Catalog.jsx';
import Topic from './pages/Topic.jsx';
import Session from './pages/Session.jsx';
import Train from './pages/Train.jsx';
import Stats from './pages/Stats.jsx';
import Profile from './pages/Profile.jsx';
import Search from './pages/Search.jsx';
import TabBar from './ui/TabBar.jsx';
import { peekBank, shownFor, reviewOffFor } from './lib/questions.js';

export default function App() {
  const { manifest, error } = useManifest();
  const route = useRoute();
  const progress = useProgress();

  if (error) return <div className="screen-msg"><b>Не удалось загрузить курс.</b><span>{error.message}</span></div>;
  if (!manifest) return <div className="screen-msg"><span>Загрузка…</span></div>;

  if (route.name === 'topic') {
    const topic = manifest.byId[route.topicId];
    if (!topic || !topic.file) return <div className="screen-msg"><b>Тема не найдена</b><a href="#/">К каталогу</a></div>;
    return <Topic key={topic.id} manifest={manifest} topic={topic} sectionId={route.sectionId} from={route.from} />;
  }
  if (route.name === 'search') return <Search manifest={manifest} initial={route.q} />;
  if (route.name === 'session') {
    return <Session key={location.hash} manifest={manifest} params={route.params} />;
  }

  // счётчик «пора повторить» на вкладке — без загрузки банка, по памяти повторения; если банк уже загружен,
  // без выключенных из повторения тем и скрытых углублённых вопросов (как на вкладке «Повторить»)
  const now = Date.now();
  const bank = peekBank();
  const shown = shownFor(progress.settings), off = reviewOffFor(progress.settings);
  const counts = (qid) => { const q = bank?.byId[qid]; return !q || (shown(q) && !off(q)); };
  const due = Object.entries(progress.srs).filter(([qid, c]) => c.due <= now && counts(qid)).length;
  return (
    <div className="shell">
      <TabBar active={route.name} dueCount={due} />
      <div className="shell-main">
        {route.name === 'train' && <Train manifest={manifest} />}
        {route.name === 'stats' && <Stats manifest={manifest} />}
        {route.name === 'profile' && <Profile manifest={manifest} />}
        {route.name === 'catalog' && <Catalog manifest={manifest} />}
      </div>
    </div>
  );
}
