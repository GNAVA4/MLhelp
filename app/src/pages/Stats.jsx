import { useMemo, useState } from 'react';
import { useQuestions } from '../lib/questions.js';
import { useProgress, setFlag } from '../lib/progress.js';
import { streak, todayInfo, dayKey, isMature } from '../lib/srs.js';
import { sessionHref, topicHref } from '../lib/router.js';
import { Bar, plural } from '../ui/ui.jsx';
import Account from '../ui/Account.jsx';

// Тема попадает в «слабые», если по ней не меньше 5 ответов — иначе доля верных слишком шумная.
const WEAK_MIN_ANSWERS = 5;
const DAYS = 30;

export default function Stats({ manifest }) {
  const { bank } = useQuestions();
  const p = useProgress();
  const data = useMemo(() => (bank ? compute(bank, p, manifest) : null), [bank, p]);
  if (!bank) return <div className="screen-msg"><span>Загрузка…</span></div>;
  const st = streak(p), today = todayInfo(p);

  return (
    <div className="page">
      <header className="page-head"><h1>Статистика</h1></header>

      <Account />

      <section className="tiles">
        <Tile v={st.days} l={plural(st.days, 'день', 'дня', 'дней') + ' подряд'} />
        <Tile v={today.answered} l={plural(today.answered, 'ответ', 'ответа', 'ответов') + ' сегодня'} />
        <Tile v={data.seenMcq + ' / ' + data.totalMcq} l="тестов изучено" />
        <Tile v={data.seenCard + ' / ' + data.totalCard} l="карточек изучено" />
        <Tile v={data.mature} l="выучено надолго (≥ 21 дня)" />
        <Tile v={data.acc7 == null ? '—' : Math.round(data.acc7 * 100) + '%'} l="верных за 7 дней" />
        <Tile v={data.due} l="пора повторить" />
        <Tile v={Object.keys(p.marks.starred).filter((id) => bank.byId[id]).length} l="в избранном" />
      </section>

      <section className="qcard">
        <h3>Ответов в день · последние {DAYS} дней</h3>
        <Columns data={data.activity} fmt={(d) => d.label + ': ' + d.v + ' ' + plural(d.v, 'ответ', 'ответа', 'ответов')} />
      </section>

      <section className="qcard">
        <h3>Прогноз повторений · 14 дней</h3>
        <Columns data={data.forecast} fmt={(d) => d.label + ': ' + d.v + ' к повторению'} />
      </section>

      <section className="qcard">
        <h3>По блокам</h3>
        <div className="small muted bl-legend">изучено из всех · доля верных ответов</div>
        {data.blocks.map((b) => (
          <a key={b.id} className="brow" href={sessionHref('test', 'b' + b.id, 20)} style={{ '--c': b.color }}>
            <span className="block-num sm">{b.id}</span>
            <span className="brow-main">
              <span className="brow-title">{b.title}</span>
              <Bar value={b.total ? b.seen / b.total : 0} color={b.color} thin />
            </span>
            <span className="small nowrap">{b.seen} / {b.total}</span>
            <span className="small nowrap muted">{b.acc == null ? '—' : Math.round(b.acc * 100) + '%'}</span>
          </a>
        ))}
      </section>

      {data.weak.length > 0 && (
        <section className="qcard">
          <h3>Слабые темы</h3>
          {data.weak.map((w) => (
            <div key={w.t.id} className="wrow">
              <a href={topicHref(w.t.id)} className="wrow-name"><span className="tid">{w.t.id}</span> {w.t.title}</a>
              <span className="small nowrap">{Math.round(w.acc * 100)}% · {w.n}</span>
              <a className="btn btn-sm" href={sessionHref('test', 't' + w.t.id, 20)}>Тренировать</a>
            </div>
          ))}
        </section>
      )}

      <Flagged bank={bank} p={p} manifest={manifest} />
    </div>
  );
}

function Tile({ v, l }) { return <div className="stat"><b>{v}</b><span>{l}</span></div>; }

// Столбцы одной серии: подпись — в заголовке карточки, подсказка — при наведении/нажатии на столбец.
function Columns({ data, fmt }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="cols-wrap">
      <div className="cols" role="img" aria-label={data.map(fmt).join('; ')}>
        {data.map((d, i) => (
          <div key={i} className="col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} title={fmt(d)}>
            <div className="col-bar" style={{ height: (d.v / max) * 100 + '%' }} />
          </div>
        ))}
      </div>
      <div className="cols-axis small muted"><span>{data[0].label}</span><span>max {max}</span><span>{data[data.length - 1].label}</span></div>
      <div className="cols-tip small">{hover != null ? fmt(data[hover]) : ' '}</div>
    </div>
  );
}

function Flagged({ bank, p, manifest }) {
  const list = Object.entries(p.marks.flagged).map(([id, f]) => ({ q: bank.byId[id], id, ...f })).filter((x) => x.q);
  const [copied, setCopied] = useState(false);
  if (!list.length) return null;
  const text = (h) => h.replace(/<span class="katex[\s\S]*?<\/span><\/span>/g, '[формула]').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const copy = async () => {
    const payload = list.map((x) => ({ id: x.id, topic: x.q.topicId, note: x.note, q: text(x.q.q).slice(0, 200) }));
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 1)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert('Не удалось скопировать'); }
  };
  return (
    <section className="qcard">
      <h3>Вопросы с пометкой «ошибка» · {list.length}</h3>
      <p className="small muted">Скопируйте список и пришлите — вопросы будут исправлены в банке.</p>
      {list.map((x) => (
        <div key={x.id} className="wrow">
          <span className="wrow-name small"><span className="tid">{x.q.topicId}</span> {text(x.q.q).slice(0, 120)}<br /><span className="muted">— {x.note}</span></span>
          <button className="btn btn-sm" onClick={() => setFlag(x.id, null)}>Снять</button>
        </div>
      ))}
      <button className="btn" onClick={copy}>{copied ? 'Скопировано' : 'Скопировать список'}</button>
    </section>
  );
}

function compute(bank, p, manifest) {
  const now = Date.now();
  const srs = p.srs;
  const seenIds = Object.keys(srs).filter((id) => bank.byId[id]);
  const due = seenIds.filter((id) => srs[id].due <= now).length;
  const mature = seenIds.filter((id) => isMature(srs[id])).length;
  const week = p.log.filter((x) => x.t >= now - 7 * 864e5);
  const acc7 = week.length ? week.filter((x) => x.g >= 3).length / week.length : null;

  const byDay = {};
  for (const x of p.log) byDay[dayKey(x.t)] = (byDay[dayKey(x.t)] || 0) + 1;
  const fmtD = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const activity = [];
  for (let i = DAYS - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); activity.push({ label: fmtD(d), v: byDay[dayKey(+d)] || 0 }); }
  const forecast = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(23, 59, 59, 999);
    const from = i === 0 ? -Infinity : (() => { const s = new Date(d); s.setHours(0, 0, 0, 0); return +s; })();
    forecast.push({ label: i === 0 ? 'сегодня' : fmtD(d), v: seenIds.filter((id) => srs[id].due > from && srs[id].due <= +d).length });
  }

  // доля верных — по журналу ответов
  const accBy = (pred) => { const xs = p.log.filter((x) => bank.byId[x.q] && pred(bank.byId[x.q])); return { n: xs.length, acc: xs.length ? xs.filter((x) => x.g >= 3).length / xs.length : null }; };
  const blocks = manifest.blocks.filter((b) => b.mcqCount || b.cardCount).map((b) => {
    const qs = bank.all.filter((q) => q.blockId === b.id);
    return { id: b.id, title: b.title, color: b.color, total: qs.length, seen: qs.filter((q) => srs[q.id]).length, acc: accBy((q) => q.blockId === b.id).acc };
  });
  const weak = manifest.topics.filter((t) => t.mcqCount || t.cardCount).map((t) => ({ t, ...accBy((q) => q.topicId === t.id) }))
    .filter((x) => x.n >= WEAK_MIN_ANSWERS && x.acc < 0.75).sort((a, b) => a.acc - b.acc).slice(0, 8);
  const byType = (t) => ({ total: bank.all.filter((q) => q.type === t).length, seen: seenIds.filter((id) => bank.byId[id].type === t).length });
  const mcq = byType('mcq'), card = byType('card');
  return { seenMcq: mcq.seen, totalMcq: mcq.total, seenCard: card.seen, totalCard: card.total, due, mature, acc7, activity, forecast, blocks, weak };
}
