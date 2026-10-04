import { useEffect, useRef, useState } from 'react';
import {
  useProgress, getProgress, openTopic, setCurrentSection, markSectionRead, setMaxScroll,
  setCompleted, setMark, setNote, topicPct, scopeResults,
} from '../lib/progress.js';
import { navigate, topicHref, quizHref } from '../lib/router.js';
import { Bar, ContentBadge } from '../ui/ui.jsx';

export default function Topic({ manifest, topic, sectionId }) {
  const block = manifest.blockById[topic.blockId];
  const progress = useProgress();
  const p = progress.topics[topic.id];
  const frame = useRef(null);
  const [current, setCurrent] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const ready = useRef(false);

  const idx = manifest.readable.findIndex((t) => t.id === topic.id);
  const prev = manifest.readable[idx - 1], next = manifest.readable[idx + 1];

  const goto = (id) => {
    frame.current?.contentWindow?.postMessage({ type: 'mlc:goto', id }, '*');
    setDrawer(false);
  };

  useEffect(() => {
    openTopic(topic.id);
    document.title = topic.id + ' · ' + topic.title;
    return () => { document.title = 'Applied ML'; };
  }, [topic.id]);

  // переход к секции по ссылке #/t/<id>/<sN>, когда страница уже загружена
  useEffect(() => { if (ready.current && sectionId) goto(sectionId); }, [sectionId]);

  useEffect(() => {
    const onMsg = (e) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const d = e.data;
      if (!d || typeof d.type !== 'string' || !d.type.startsWith('mlc:')) return;
      switch (d.type) {
        case 'mlc:ready': {
          ready.current = true;
          const target = sectionId || getProgress().topics[topic.id]?.lastSection;
          if (target && target !== 's1') goto(target);
          break;
        }
        case 'mlc:section': setCurrent(d.id); setCurrentSection(topic.id, d.id); break;
        case 'mlc:read': markSectionRead(topic.id, d.id, topic.sections.length); break;
        case 'mlc:scroll': setMaxScroll(topic.id, d.pct); break;
        case 'mlc:open': {
          const t = manifest.byFile[d.file];
          const sec = /^#(s\d+)$/.exec(d.hash || '');
          navigate(t ? topicHref(t.id, sec ? sec[1] : null) : '#/');
          break;
        }
        default: break;
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [topic.id]);

  const read = new Set(p?.sectionsRead || []);
  const pct = topicPct(topic, p);

  return (
    <div className="reader" style={{ '--c': block.color }}>
      <header className="rbar">
        <a className="rbar-back" href="#/" title="К каталогу">←</a>
        <div className="rbar-title">
          <span className="tid" style={{ color: block.color }}>{topic.id}</span>
          <span className="rbar-name">{topic.title}</span>
        </div>
        <div className="rbar-progress">
          <span className="small muted nowrap">
            {topic.sections.length ? `${read.size} / ${topic.sections.length}` : Math.round(pct * 100) + '%'}
          </span>
          <Bar value={pct} color={block.color} thin />
        </div>
        <button className="rbar-btn" onClick={() => setDrawer((v) => !v)} aria-expanded={drawer}>Секции</button>
      </header>

      <div className="rbody">
        <aside className={'side' + (drawer ? ' side-open' : '')}>
          <div className="side-block muted small">Блок {block.id} · {block.title} <ContentBadge status={topic.contentStatus} /></div>

          {topic.sections.length > 0 ? (
            <ol className="secs">
              {topic.sections.map((s) => (
                <li key={s.id}>
                  <button className={'sec' + (current === s.id ? ' sec-cur' : '') + (read.has(s.id) ? ' sec-read' : '')} onClick={() => goto(s.id)}>
                    <span className="sec-dot">{read.has(s.id) ? '✓' : ''}</span>
                    <span>{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small side-note">У этой страницы нет размеченных секций — прогресс считается по прокрутке.</p>
          )}

          {topic.mcqCount > 0 && (() => {
            const r = scopeResults(progress, 'topic:' + topic.id);
            return (
              <a className="side-quiz" href={quizHref('topic', topic.id)}>
                <b>Тест по теме</b>
                <span className="small muted">{topic.mcqCount} вопр.{r.best ? ' · лучший ' + Math.round((r.best.correct / r.best.total) * 100) + '%' : ''}</span>
              </a>
            );
          })()}

          <div className="marks">
            <label className="mark"><input type="checkbox" checked={!!p?.completedAt} onChange={(e) => setCompleted(topic.id, e.target.checked)} /> Прочитана</label>
            <label className="mark"><input type="checkbox" checked={!!p?.marks?.understood} onChange={(e) => setMark(topic.id, 'understood', e.target.checked)} /> Понял тему</label>
            <label className="mark"><input type="checkbox" checked={!!p?.marks?.revisit} onChange={(e) => setMark(topic.id, 'revisit', e.target.checked)} /> Вернуться позже</label>
            <textarea className="note" placeholder="Заметка к теме…" defaultValue={p?.note || ''} onBlur={(e) => setNote(topic.id, e.target.value)} />
          </div>

          <nav className="pn">
            {prev ? <a href={topicHref(prev.id)}>← {prev.id} {prev.title}</a> : <span />}
            {next ? <a href={topicHref(next.id)}>{next.id} {next.title} →</a> : <span />}
          </nav>
        </aside>
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <iframe ref={frame} className="frame" src={topic.file} title={topic.title} />
      </div>
    </div>
  );
}
