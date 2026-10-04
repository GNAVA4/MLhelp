import { useState } from 'react';
import { useProgress, topicPct, topicStatus } from '../lib/progress.js';
import { topicHref } from '../lib/router.js';
import { Bar, ContentBadge, Ring, plural, fmtMinutes } from '../ui/ui.jsx';

const OPEN_KEY = 'mlc:openBlocks';
function loadOpen() { try { return JSON.parse(localStorage.getItem(OPEN_KEY)) || null; } catch { return null; } }

export default function Catalog({ manifest }) {
  const progress = useProgress();
  const { blocks, byId, blockById, readable } = manifest;

  const last = progress.meta.lastTopicId && byId[progress.meta.lastTopicId];
  const [open, setOpen] = useState(() => {
    const saved = loadOpen();
    if (saved) return saved;
    return { [last ? last.blockId : '0']: true };
  });
  const toggle = (id) => setOpen((o) => {
    const n = { ...o, [id]: !o[id] };
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(n)); } catch { /* не критично */ }
    return n;
  });

  const done = readable.filter((t) => topicStatus(t, progress.topics[t.id]) === 'done').length;
  const started = readable.filter((t) => topicStatus(t, progress.topics[t.id]) === 'reading').length;
  const totalPct = readable.reduce((s, t) => s + topicPct(t, progress.topics[t.id]), 0) / readable.length;

  return (
    <div className="catalog">
      <header className="cat-head">
        <div>
          <h1>Applied ML</h1>
          <p className="muted">Курс прикладного машинного обучения — от вероятности до LLM</p>
        </div>
        <div className="cat-stats">
          <Stat value={done} label={'из ' + readable.length + ' ' + plural(readable.length, 'темы', 'тем', 'тем') + ' прочитано'} />
          <Stat value={started} label="в процессе" />
          <Stat value={Math.round(totalPct * 100) + '%'} label="курса пройдено" />
        </div>
      </header>

      {last && last.file && <ContinueCard topic={last} block={blockById[last.blockId]} p={progress.topics[last.id]} />}

      <div className="blocks">
        {blocks.map((b) => (
          <BlockCard key={b.id} block={b} topics={b.topicIds.map((id) => byId[id])} progress={progress}
            open={!!open[b.id]} onToggle={() => toggle(b.id)} />
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

function ContinueCard({ topic, block, p }) {
  const sec = p?.lastSection && topic.sections.find((s) => s.id === p.lastSection);
  const pct = topicPct(topic, p);
  return (
    <a className="continue" href={topicHref(topic.id, p?.lastSection)} style={{ '--c': block.color }}>
      <div className="continue-body">
        <span className="eyebrow">Продолжить</span>
        <div className="continue-title"><span className="tid" style={{ color: block.color }}>{topic.id}</span> {topic.title}</div>
        {sec && <div className="muted small">Секция: {sec.title}</div>}
        <Bar value={pct} color={block.color} thin />
      </div>
      <span className="continue-go">→</span>
    </a>
  );
}

function BlockCard({ block, topics, progress, open, onToggle }) {
  const readable = topics.filter((t) => t.file);
  const done = readable.filter((t) => topicStatus(t, progress.topics[t.id]) === 'done').length;
  const pct = readable.length ? readable.reduce((s, t) => s + topicPct(t, progress.topics[t.id]), 0) / readable.length : 0;
  const minutes = readable.reduce((s, t) => s + t.readingMinutes, 0);

  const groups = block.modules
    ? block.modules.map((m) => ({ key: m.id, title: m.title, summary: m.summary, topics: m.topicIds.map((id) => topics.find((t) => t.id === id)).filter(Boolean) }))
    : [{ key: 'all', topics }];

  return (
    <section className={'block' + (open ? ' open' : '')} style={{ '--c': block.color }}>
      <button className="block-head" onClick={onToggle} aria-expanded={open}>
        <span className="block-num">{block.id}</span>
        <span className="block-titles">
          <span className="block-title">{block.title}</span>
          <span className="muted small">{block.subtitle}</span>
          <span className="block-meta small">
            {readable.length ? <>{done} / {readable.length} прочитано · {fmtMinutes(minutes)}</> : 'ещё не написан'}
            {block.mcqCount ? <> · тест {block.mcqCount} {plural(block.mcqCount, 'вопрос', 'вопроса', 'вопросов')}</> : null}
          </span>
        </span>
        <span className="block-right">
          {readable.length > 0 && <Bar value={pct} color={block.color} />}
          <span className="chev">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div className="block-body">
          {groups.map((g) => (
            <div key={g.key} className="group">
              {g.title && <div className="group-head"><b>{g.title}</b><span className="muted small">{g.summary}</span></div>}
              {g.topics.map((t) => <TopicRow key={t.id} topic={t} color={block.color} p={progress.topics[t.id]} />)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TopicRow({ topic, color, p }) {
  const planned = !topic.file;
  const pct = topicPct(topic, p);
  const inner = (
    <>
      <span className="tid" style={{ color: planned ? undefined : color }}>{topic.id.replace(/\.p\d+$/, '')}</span>
      <span className="trow-main">
        <span className="trow-title">{topic.title}</span>
        <span className="trow-sum">{topic.summary}</span>
      </span>
      <span className="trow-side">
        {p?.marks?.revisit && <span className="flag" title="Вернуться позже">↺</span>}
        <ContentBadge status={topic.contentStatus} />
        {!planned && <span className="muted small nowrap">{fmtMinutes(topic.readingMinutes)}</span>}
        {!planned && <Ring pct={pct} color={color} />}
      </span>
    </>
  );
  if (planned) return <div className="trow planned">{inner}</div>;
  return <a className="trow" href={topicHref(topic.id)}>{inner}</a>;
}
