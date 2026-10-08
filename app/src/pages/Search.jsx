import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestions } from '../lib/questions.js';
import { useProgress, toggleStar } from '../lib/progress.js';
import { search, MAX_QUESTIONS } from '../lib/search.js';
import { topicHref } from '../lib/router.js';
import { plural } from '../lib/plural.js';
import Icon from '../ui/icons.jsx';

// ссылка в тему с возвратом к результатам поиска
const toTopic = (id, sec) => topicHref(id, sec) + '?from=' + encodeURIComponent(window.location.hash);

const Html = ({ html, className, as: Tag = 'div' }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

// Поиск по темам и вопросам. Запрос хранится в адресе (#/search?q=…) — «назад» из темы возвращает к результатам.
export default function Search({ manifest, initial }) {
  const { bank } = useQuestions();
  const [q, setQ] = useState(initial || '');
  const input = useRef(null);
  useEffect(() => { if (!initial) input.current?.focus(); }, []);
  useEffect(() => {
    const h = '#/search' + (q ? '?q=' + encodeURIComponent(q) : '');
    if (window.location.hash !== h) window.history.replaceState(null, '', h);
  }, [q]);
  const res = useMemo(() => (bank ? search(manifest, bank, q) : null), [bank, q]);

  return (
    <div className="search-page">
      <header className="qbar">
        <a className="rbar-back" href="#/" title="К каталогу">←</a>
        <input ref={input} className="search-input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по темам и вопросам" enterKeyHint="search" />
      </header>
      <div className="page search-body">
        {!bank && <p className="muted small">Загрузка вопросов…</p>}
        {bank && !res && <p className="muted small">Например: «калибровка», «утечка признаков», «groupby», «ROC AUC».</p>}
        {res && !res.topics.length && !res.questions.length && <p className="muted">Ничего не нашлось. Попробуйте другое слово или его начало.</p>}
        {res && res.topics.length > 0 && (
          <section className="search-sec">
            <h3>Теория</h3>
            {res.topics.map((e) => (
              <a key={e.t.id + (e.sec ? e.sec.id : '')} className="search-topic" href={toTopic(e.t.id, e.sec?.id)}>
                <span className="tid">{e.t.id}</span>
                <span className="search-topic-t">{e.sec ? <>{e.sec.title}<span className="small muted"> · {e.t.title}</span></> : e.t.title}</span>
              </a>
            ))}
          </section>
        )}
        {res && res.questions.length > 0 && (
          <section className="search-sec">
            <h3>Вопросы <span className="muted small">{res.totalQuestions > MAX_QUESTIONS ? `первые ${MAX_QUESTIONS} из ${res.totalQuestions} — уточните запрос` : res.totalQuestions + ' ' + plural(res.totalQuestions, 'найден', 'найдено', 'найдено')}</span></h3>
            {res.questions.map((e) => <QResult key={e.q.id} q={e.q} manifest={manifest} />)}
          </section>
        )}
      </div>
    </div>
  );
}

function QResult({ q, manifest }) {
  const [open, setOpen] = useState(false);
  const p = useProgress();
  const starred = !!p.marks.starred[q.id];
  const t = manifest.byId[q.topicId];
  return (
    <div className="qcard search-q">
      <div className="qmeta small muted">
        <span>{q.type === 'mcq' ? 'Тест' : 'Карточка'} · {q.topicId} {t?.title || ''}</span>
        <button className={'icon ' + (starred ? 'on-star' : '')} onClick={() => toggleStar(q.id)} title="В избранное" aria-pressed={starred}><Icon name="star" size={18} fill={starred} /></button>
      </div>
      <Html className="qtext" html={q.q} />
      {!open && <button className="link-btn small" onClick={() => setOpen(true)}>Показать ответ</button>}
      {open && (q.type === 'mcq'
        ? <div className="expl expl-ok"><Html html={q.options[q.correct]} />{q.explanation && <Html className="small" html={q.explanation} />}</div>
        : <div className="answer"><Html html={q.a} />{q.note && <Html className="card-note" html={q.note} />}</div>)}
      {open && t?.file && <a className="read-link" href={toTopic(q.topicId, q.sec || t.sections?.[0]?.id)}>Почитать в теме →</a>}
    </div>
  );
}
