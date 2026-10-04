// Поиск по курсу: темы (название, описание, секции) и вопросы банка (вопрос, варианты, ответ, объяснение).
// Все слова запроса должны встретиться (И); регистр и «ё/е» не важны. Индекс строится один раз при первом поиске.

// HTML → простой текст для поиска (формулы KaTeX дают немного «мусора» — для поиска слов это не мешает).
export function plain(html) {
  return (html || '').replace(/<annotation[\s\S]*?<\/annotation>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#36;/g, '$');
}
export const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
export const tokens = (query) => norm(query).split(' ').map((w) => w.trim()).filter((w) => w.length >= 2);

let _idx = null;
let _idxFor = null;
function index(manifest, bank) {
  if (_idx && _idxFor === bank) return _idx;
  const topics = [];
  for (const t of manifest.topics) {
    if (!t.file) continue;
    topics.push({ kind: 'topic', t, sec: null, head: norm(t.id + ' ' + t.title), body: norm(t.summary) });
    for (const s of t.sections || []) topics.push({ kind: 'section', t, sec: s, head: norm(s.title), body: norm(t.title) });
  }
  const questions = bank.all.map((q) => ({
    kind: 'q', q,
    head: norm(plain(q.q)),
    body: norm(plain([...(q.options || []), q.a, q.explanation].filter(Boolean).join(' '))),
  }));
  _idx = { topics, questions };
  _idxFor = bank;
  return _idx;
}

// Совпадение в «заголовке» (название / текст вопроса) весит больше, чем в теле.
function score(e, words) {
  let sc = 0;
  for (const w of words) {
    if (e.head.includes(w)) sc += 3;
    else if (e.body.includes(w)) sc += 1;
    else return 0;
  }
  return sc;
}

export const MAX_QUESTIONS = 60; // больше на экране телефона не просмотреть — уточняйте запрос

export function search(manifest, bank, query) {
  const words = tokens(query);
  if (!words.length) return null;
  const { topics, questions } = index(manifest, bank);
  const rank = (arr) => arr.map((e) => [e, score(e, words)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const qs = rank(questions);
  return { words, topics: rank(topics).slice(0, 10), questions: qs.slice(0, MAX_QUESTIONS), totalQuestions: qs.length };
}
