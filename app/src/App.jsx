import { useManifest } from './lib/content.js';
import { useRoute } from './lib/router.js';
import Catalog from './pages/Catalog.jsx';
import Topic from './pages/Topic.jsx';
import Quiz from './pages/Quiz.jsx';

export default function App() {
  const { manifest, error } = useManifest();
  const route = useRoute();

  if (error) return <div className="screen-msg"><b>Не удалось загрузить курс.</b><span>{error.message}</span></div>;
  if (!manifest) return <div className="screen-msg"><span>Загрузка…</span></div>;

  if (route.name === 'topic') {
    const topic = manifest.byId[route.topicId];
    if (!topic || !topic.file) return <div className="screen-msg"><b>Тема не найдена</b><a href="#/">К каталогу</a></div>;
    return <Topic key={topic.id} manifest={manifest} topic={topic} sectionId={route.sectionId} />;
  }
  if (route.name === 'quiz') {
    return <Quiz key={route.scopeType + route.scopeId} manifest={manifest} scopeType={route.scopeType} scopeId={route.scopeId} />;
  }
  return <Catalog manifest={manifest} />;
}
