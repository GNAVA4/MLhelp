// Загрузка манифеста курса (генерируется `npm run content` в public/data/manifest.json).
import { useEffect, useState } from 'react';

let _manifest = null;
let _promise = null;

function index(m) {
  const byId = Object.fromEntries(m.topics.map((t) => [t.id, t]));
  const byFile = Object.fromEntries(m.topics.filter((t) => t.file).map((t) => [t.file.replace(/^content\//, ''), t]));
  const blockById = Object.fromEntries(m.blocks.map((b) => [b.id, b]));
  // порядок чтения — только темы с файлом, по порядку блоков
  const readable = m.blocks.flatMap((b) => b.topicIds.map((id) => byId[id]).filter((t) => t.file));
  return { ...m, byId, byFile, blockById, readable };
}

export function loadManifest() {
  if (!_promise) {
    _promise = fetch('data/manifest.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('manifest.json: HTTP ' + r.status + ' — запусти npm run content'); return r.json(); })
      .then((m) => (_manifest = index(m)));
  }
  return _promise;
}

export function useManifest() {
  const [state, setState] = useState({ manifest: _manifest, error: null });
  useEffect(() => {
    if (_manifest) return;
    loadManifest().then((m) => setState({ manifest: m, error: null }), (e) => setState({ manifest: null, error: e }));
  }, []);
  return state;
}
