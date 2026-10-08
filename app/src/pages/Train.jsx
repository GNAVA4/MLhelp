import { useMemo, useState } from 'react';
import { useQuestions, modeCounts, parseScope, inScope, topicStats, sumStats, shownFor, reviewOffFor, MODES } from '../lib/questions.js';
import { useProgress, setSetting, DEFAULT_NEW_PER_DAY } from '../lib/progress.js';
import { streak, todayInfo } from '../lib/srs.js';
import { sessionHref } from '../lib/router.js';
import { useBackHandler } from '../lib/back.js';
import { Bar, plural, SearchEntry } from '../ui/ui.jsx';

// Вкладки «Повторить / Новое / Практика» (session 018): повторение отдельно от новых, тесты отдельно от карточек.
// Выбор вкладки, областей и размера сессии — удобство конкретного зрителя, храним в localStorage.
const K = { tab: 'mlc:trainTab', review: 'mlc:reviewScope', fresh: 'mlc:newScope', kind: 'mlc:newKind', practice: 'mlc:trainScope', n: 'mlc:trainN' };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* не критично */ } };
const useStored = (k, d) => { const [v, set] = useState(() => load(k, d)); return [v, (x) => { set(x); save(k, x); }]; };
const SIZES = [10, 20, 50, 0];
const TABS = [['review', 'Повторить'], ['new', 'Новое'], ['practice', 'Практика']];
const PRACTICE = ['test', 'cards', 'interview', 'exam', 'mistakes', 'weak', 'starred'];
const DAY = 86400000;

const nQ = (n) => n + ' ' + plural(n, 'вопрос', 'вопроса', 'вопросов');
const nCard = (n) => n + ' ' + plural(n, 'карточка', 'карточки', 'карточек');
const nTopics = (n) => n + ' ' + plural(n, 'тема', 'темы', 'тем');

export default function Train({ manifest }) {
  const { bank, error } = useQuestions();
  const progress = useProgress();
  const [tab, setTab] = useStored(K.tab, 'review');
  const [reviewScope, setReviewScope] = useStored(K.review, 'all');
  const [newScope, setNewScope] = useStored(K.fresh, 'all');
  const [kind, setKind] = useStored(K.kind, 'mcq');
  const [practiceScope, setPracticeScope] = useStored(K.practice, 'all');
  const [n, setN] = useStored(K.n, 20);
  const [sheet, setSheet] = useState(null); // 'review' | 'practice' — открыт экран выбора тем

  const stats = useMemo(() => (bank ? topicStats({ bank, progress }) : null), [bank, progress]);
  if (error) return <div className="screen-msg"><b>Не удалось загрузить вопросы</b><span>{error.message}</span></div>;
  if (!bank) return <div className="screen-msg"><span>Загрузка вопросов…</span></div>;

  const st = streak(progress);
  const today = todayInfo(progress);
  const dueAll = sumStats(stats, 'all');
  const dueTotal = dueAll.mcq.due + dueAll.card.due;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Тренировка</h1>
        <p className="muted">
          {st.days ? st.days + ' ' + plural(st.days, 'день', 'дня', 'дней') + ' подряд' : 'Серия ещё не начата'}
          {' · сегодня '}{today.answered} {plural(today.answered, 'ответ', 'ответа', 'ответов')}
        </p>
      </header>
      <SearchEntry />

      <div className="ttabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}{id === 'review' && dueTotal > 0 && <span className="ttab-n">{dueTotal}</span>}
          </button>
        ))}
      </div>

      {tab === 'review' && <ReviewTab {...{ bank, progress, manifest, stats, scope: reviewScope, setScope: setReviewScope, n, setN, openPicker: () => setSheet('review') }} />}
      {tab === 'new' && <NewTab {...{ manifest, stats, progress, today, scope: newScope, setScope: setNewScope, kind, setKind, n, setN }} />}
      {tab === 'practice' && <PracticeTab {...{ bank, progress, manifest, scope: practiceScope, setScope: setPracticeScope, n, setN, openPicker: () => setSheet('practice') }} />}

      {sheet && (
        <PickerSheet
          manifest={manifest} stats={stats}
          value={sheet === 'review' ? reviewScope : practiceScope}
          metric={sheet === 'review' ? reviewMetric : practiceMetric}
          filter={sheet === 'review' ? { label: 'Есть что повторить', pred: (s) => s.mcq.due + s.card.due > 0 } : null}
          onDone={(v) => { (sheet === 'review' ? setReviewScope : setPracticeScope)(v); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

// ---------- Повторить ----------
function ReviewTab({ bank, progress, manifest, stats, scope, setScope, n, setN, openPicker }) {
  const s = sumStats(stats, scope);
  const total = s.mcq.due + s.card.due;
  // прогноз: сколько станет «пора повторить» до конца завтрашнего дня и за 7 дней (в той же области)
  const fc = useMemo(() => {
    const sc = parseScope(scope);
    const shown = shownFor(progress.settings), off = reviewOffFor(progress.settings);
    const now = Date.now();
    const eot = new Date(); eot.setHours(0, 0, 0, 0); const endTomorrow = +eot + 2 * DAY;
    let tomorrow = 0, week = 0;
    for (const q of bank.all) {
      const c = progress.srs[q.id];
      if (!c || c.due <= now || !inScope(q, sc) || !shown(q) || off(q)) continue;
      if (c.due < endTomorrow) tomorrow++;
      if (c.due < now + 7 * DAY) week++;
    }
    return { tomorrow, week };
  }, [bank, progress, scope]);

  return (
    <>
      <section className="tbox tbox-hl">
        <div className="tbox-top">
          <div><div className="lbl">Пора вспомнить</div><div className="big-n">{total}</div></div>
          <span className="small muted tr">{scope === 'all' ? 'по всему изученному' : 'в выбранных темах'}</span>
        </div>
        {total > 0 ? (
          <>
            <div className="two">
              <a className={'kbtn kbtn-pri' + (s.mcq.due ? '' : ' btn-off')} href={sessionHref('review', scope, 0, 'mcq')}>Тесты<span>{nQ(s.mcq.due)}</span></a>
              <a className={'kbtn kbtn-pri' + (s.card.due ? '' : ' btn-off')} href={sessionHref('review', scope, 0, 'card')}>Карточки<span>{nCard(s.card.due)}</span></a>
            </div>
            {s.mcq.due > 0 && s.card.due > 0 && <a className="btn btn-ghost-w" href={sessionHref('review', scope, 0, 'all')}>Всё вперемешку · {total}</a>}
          </>
        ) : (
          <p className="small muted tmsg">Повторять нечего. {fc.tomorrow ? 'До конца завтрашнего дня подойдёт ' + nQ(fc.tomorrow) + '.' : 'Можно взять новые на вкладке «Новое».'} Или пройти изученное заново — ниже.</p>
        )}
      </section>

      <section className="tbox">
        <div className="lbl">Дальше</div>
        <div className="fc">
          <div><b>{fc.tomorrow}</b><span className="small muted">до конца завтра</span></div>
          <div><b>{fc.week}</b><span className="small muted">за 7 дней</span></div>
        </div>
      </section>

      <AgainBox s={s} scope={scope} n={n} setN={setN}
        note={scope === 'all' ? 'Всё изученное, кроме выключенных из повторения тем.' : 'Изученное в выбранных темах.'} />

      <ReviewTopics manifest={manifest} stats={stats} progress={progress} />

      <section className="tbox">
        <div className="lbl">Повторять из нескольких тем</div>
        <PickRow manifest={manifest} scope={scope} onOpen={openPicker} onReset={() => setScope('all')} />
        <span className="small muted">Необязательно: счётчик и кнопки вверху будут только по выбранным темам.</span>
      </section>
    </>
  );
}

// Какие темы повторять — как выбор тем на «Новом»: блоки с галочкой (вкл / частично / выкл) раскрываются в темы.
// Галочка = тема участвует в повторении (settings.reviewOff — выключенные, синхронизируется между устройствами).
// Галочка блока переключает все его темы, в том числе ещё не изученные — выключенный блок останется выключенным.
// «Повторить N ›» у темы — сессия повторения только этой темы.
function ReviewTopics({ manifest, stats, progress }) {
  const off = progress.settings.reviewOff || {};
  const blocks = useMemo(() => manifest.blocks
    .map((b) => ({ b, topics: b.topicIds.map((id) => manifest.byId[id]).filter((t) => t && stats[t.id]?.seen) }))
    .filter((x) => x.topics.length), [manifest, stats]);
  const due = (t) => stats[t.id].mcq.due + stats[t.id].card.due;
  const [only, setOnly] = useState(false);
  // раскрыт первый блок, где есть что повторить
  const [open, setOpen] = useState(() => { const f = blocks.find((x) => x.topics.some((t) => due(t) > 0)); return new Set(f ? [f.b.id] : []); });
  if (!blocks.length) return null;
  const save = (o) => setSetting('reviewOff', o);
  const toggleTopic = (id) => { const o = { ...off }; if (o[id]) delete o[id]; else o[id] = true; save(o); };
  const toggleBlock = (b, allOn) => { const o = { ...off }; b.topicIds.forEach((id) => (allOn ? (o[id] = true) : delete o[id])); save(o); };
  const toggleOpen = (id) => { const s = new Set(open); if (s.has(id)) s.delete(id); else s.add(id); setOpen(s); };
  const nOff = Object.keys(off).filter((id) => stats[id]?.seen).length;

  return (
    <section className="tbox">
      <div className="lbl">Какие темы повторять</div>
      <div className="tp-tools">
        <span className="small muted rv-sum">{nOff ? 'Выключено из повторения: ' + nTopics(nOff) : 'Повторяются все изученные темы'}</span>
        <button className={'chip' + (only ? ' on' : '')} onClick={() => setOnly((v) => !v)} aria-pressed={only}>Есть что повторить</button>
      </div>
      <div className="tp-list">
        {blocks.map(({ b, topics }) => {
          const shown = only ? topics.filter((t) => due(t) > 0) : topics;
          if (!shown.length) return null;
          const nOn = b.topicIds.filter((id) => !off[id]).length;
          const allOn = nOn === b.topicIds.length;
          const bDue = topics.reduce((a, t) => a + due(t), 0);
          const bOffDue = topics.reduce((a, t) => a + stats[t.id].offDue, 0);
          const seenOn = topics.filter((t) => !off[t.id]).length;
          const expanded = only || open.has(b.id);
          return (
            <div key={b.id} className="tp-block" style={{ '--c': b.color }}>
              <div className="tp-row tp-brow">
                <button className={'cb' + (allOn ? ' on' : nOn ? ' part' : '')} onClick={() => toggleBlock(b, allOn)}
                  aria-label={(allOn ? 'Не повторять' : 'Повторять') + ' блок ' + b.id} />
                <button className="tp-main" onClick={() => toggleOpen(b.id)} aria-expanded={expanded}>
                  <span className="tp-t"><span className="tid">{b.id}</span> {b.title}</span>
                  <span className="small muted">
                    {!seenOn ? 'не повторяется' : 'повторяется ' + seenOn + ' из ' + topics.length + ' ' + plural(topics.length, 'темы', 'тем', 'тем')}
                    {bDue ? ' · пора ' + bDue : ''}{bOffDue ? (seenOn ? ' · в выключенных ждут ' : ' · ждут ') + bOffDue : ''}
                  </span>
                </button>
                {bDue > 0 && <span className="tbadge b-due">{bDue}</span>}
                <span className={'tp-chev' + (expanded ? ' open' : '')} aria-hidden="true">›</span>
              </div>
              {expanded && shown.map((t) => {
                const s = stats[t.id], on = !off[t.id], d = due(t);
                return (
                  <div key={t.id} className={'tp-row tp-trow' + (on ? '' : ' tp-off')} role="button" tabIndex={0} aria-pressed={on}
                    onClick={() => toggleTopic(t.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleTopic(t.id))}>
                    <span className={'cb' + (on ? ' on' : '')} aria-hidden="true" />
                    <span className="tp-main">
                      <span className="tp-t"><span className="tid">{t.id}</span> {t.title}</span>
                      <span className="small muted">
                        {!on ? 'не повторяется' + (s.offDue ? ' · ждут ' + s.offDue : '')
                          : d ? 'пора: тестов ' + s.mcq.due + ', карточек ' + s.card.due : 'повторять нечего · изучено ' + s.seen + ' из ' + s.all}
                      </span>
                    </span>
                    {on && d > 0 && <a className="rv-go" href={sessionHref('review', 't' + t.id, 0, 'all')} onClick={(e) => e.stopPropagation()}
                      title={'Повторить только тему ' + t.id}>{d} ›</a>}
                    {d === 0 && s.seen > 0 && <a className="rv-go rv-again" href={sessionHref('again', 't' + t.id, 0, 'all')} onClick={(e) => e.stopPropagation()}
                      title={'Пройти заново изученное в теме ' + t.id}>заново ›</a>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <span className="small muted">Снятая галочка выключает тему из повторения: её вопросы не придут в «Повторить» и в напоминания. Галочка блока — все его темы сразу. «N ›» у темы — повторить только её, «заново ›» — пройти изученное в ней внепланово.</span>
    </section>
  );
}

// Внепланово: уже изученные вопросы, не дожидаясь срока (владелец, session 038). Ответы идут в память, как везде.
function AgainBox({ s, scope, n, setN, note }) {
  const cnt = (k) => (n ? Math.min(n, s[k].seen) : s[k].seen);
  if (!s.mcq.seen && !s.card.seen) return null;
  return (
    <section className="tbox">
      <div className="lbl">Пройти изученное заново</div>
      <div className="seg seg-w">
        {SIZES.map((x) => <button key={x} className={n === x ? 'on' : ''} onClick={() => setN(x)}>{x || 'Все'}</button>)}
      </div>
      <div className="two">
        <a className={'kbtn' + (s.mcq.seen ? '' : ' btn-off')} href={sessionHref('again', scope, n, 'mcq')}>Тесты<span>{nQ(cnt('mcq'))}</span></a>
        <a className={'kbtn' + (s.card.seen ? '' : ' btn-off')} href={sessionHref('again', scope, n, 'card')}>Карточки<span>{nCard(cnt('card'))}</span></a>
      </div>
      <span className="small muted">{note} Не дожидаясь срока; сначала то, что раньше подойдёт к повторению.</span>
    </section>
  );
}

// ---------- Новое ----------
function NewTab({ manifest, stats, progress, today, scope, setScope, kind, setKind, n, setN }) {
  const s = sumStats(stats, scope);
  const avail = s[kind].fresh;
  const planned = n ? Math.min(n, avail) : avail;
  const newPerDay = progress.settings.newPerDay ?? DEFAULT_NEW_PER_DAY;
  const over = today.newToday + planned > newPerDay;
  const what = kind === 'mcq' ? plural(planned, 'новый тест', 'новых теста', 'новых тестов') : plural(planned, 'новую карточку', 'новые карточки', 'новых карточек');
  const metric = useMemo(() => newMetric(kind), [kind]);

  return (
    <>
      <div className="seg seg-w">
        <button className={kind === 'mcq' ? 'on' : ''} onClick={() => setKind('mcq')}>Тесты<small>{s.mcq.fresh} новых</small></button>
        <button className={kind === 'card' ? 'on' : ''} onClick={() => setKind('card')}>Карточки<small>{s.card.fresh} новых</small></button>
      </div>

      <section className="new-pick">
        <TopicPicker manifest={manifest} stats={stats} value={scope} onChange={setScope} metric={metric}
          filter={{ label: 'Есть новые', pred: (x) => x[kind].fresh > 0 }} />
        <div className="tfoot">
          <div className="small muted">
            {scope === 'all' ? 'Темы не выбраны: берём по порядку курса' : 'Выбрано: ' + pickLabel(manifest, scope)} · {avail} новых
          </div>
          <div className="seg seg-w">
            {SIZES.map((x) => <button key={x} className={n === x ? 'on' : ''} onClick={() => setN(x)}>{x || 'Все'}</button>)}
          </div>
          <a className={'btn btn-primary btn-big' + (planned ? '' : ' btn-off')} href={sessionHref('new', scope, n, kind)}>
            {planned ? 'Учить: ' + planned + ' ' + what : 'Новых здесь нет'}
          </a>
          {s[kind].seen > 0 && (
            <a className="btn btn-ghost-w" href={sessionHref('again', scope, n, kind)}>
              Пройти изученные заново · {kind === 'mcq' ? nQ(Math.min(n || Infinity, s[kind].seen)) : nCard(Math.min(n || Infinity, s[kind].seen))}
            </a>
          )}
          <div className={'small ' + (over ? 'twarn' : 'muted')}>
            {over
              ? 'Сегодня уже взято новых: ' + today.newToday + ' при ориентире ' + newPerDay + '. Каждый новый вопрос вернётся на повторение, поэтому завтра повторений будет больше.'
              : 'Сегодня взято новых: ' + today.newToday + ' из ' + newPerDay + '.'}
          </div>
        </div>
      </section>

      <details className="tbox">
        <summary><b>Ориентир новых в день: {newPerDay}</b></summary>
        <div className="stepper">
          <button onClick={() => setSetting('newPerDay', Math.max(0, newPerDay - 5))}>−</button>
          <b>{newPerDay}</b>
          <button onClick={() => setSetting('newPerDay', Math.min(200, newPerDay + 5))}>+</button>
          <span className="small muted">Не запрет, а подсказка: больше новых в день — больше повторений в следующие дни. Тесты и карточки считаются вместе.</span>
        </div>
      </details>
    </>
  );
}

// ---------- Практика ----------
function PracticeTab({ bank, progress, manifest, scope, setScope, n, setN, openPicker }) {
  const counts = useMemo(() => modeCounts({ bank, progress, manifest, scope }), [bank, progress, scope]);
  return (
    <>
      <section className="tbox">
        <div className="lbl">Темы</div>
        <PickRow manifest={manifest} scope={scope} onOpen={openPicker} onReset={() => setScope('all')} />
        <div className="lbl">Вопросов в сессии</div>
        <div className="seg seg-w">
          {SIZES.map((x) => <button key={x} className={n === x ? 'on' : ''} onClick={() => setN(x)}>{x || 'Все'}</button>)}
        </div>
      </section>
      <section className="modes">
        {PRACTICE.map((m) => {
          const c = counts[m];
          return (
            <a key={m} className={'mode' + (c ? '' : ' mode-off')} href={c ? sessionHref(m, scope, n) : undefined} aria-disabled={!c}>
              <span className="mode-body">
                <b>{MODES[m].title}</b>
                <span className="small muted">{MODES[m].desc}</span>
              </span>
              <span className="mode-n">{c}</span>
            </a>
          );
        })}
      </section>
      <span className="small muted">Практика не смотрит на новизну: берёт любые вопросы выбранных тем. Ответы всё равно идут в память повторения.</span>
    </>
  );
}

// ---------- выбор тем ----------
// Что показывать у темы / блока: подпись и число на значке.
const newMetric = (kind) => (s) => ({
  sub: 'новых ' + s[kind].fresh + ' из ' + s[kind].all + (s[kind].due ? ' · повторить ' + s[kind].due : ''),
  badge: s[kind].fresh, cls: 'b-new', off: !s[kind].all,
});
const reviewMetric = (s) => {
  const due = s.mcq.due + s.card.due;
  return { sub: due ? 'повторить: тестов ' + s.mcq.due + ', карточек ' + s.card.due : 'изучено ' + s.seen + ' из ' + s.all, badge: due, cls: 'b-due', off: !s.seen };
};
const practiceMetric = (s) => ({ sub: 'тестов ' + s.mcq.all + ' · карточек ' + s.card.all + ' · изучено ' + Math.round((s.seen / s.all) * 100) + '%', badge: 0, cls: '', off: false });

const ZERO = () => ({ mcq: { all: 0, fresh: 0, due: 0, seen: 0 }, card: { all: 0, fresh: 0, due: 0, seen: 0 }, seen: 0, all: 0 });
function addStats(a, b) {
  for (const k of ['mcq', 'card']) for (const f of ['all', 'fresh', 'due', 'seen']) a[k][f] += b[k][f];
  a.seen += b.seen; a.all += b.all;
  return a;
}
const norm = (x) => x.toLowerCase().replace(/ё/g, 'е');

// Блоки и темы, по которым есть вопросы, в порядке курса.
function pickerBlocks(manifest, stats) {
  return manifest.blocks
    .map((b) => ({ b, topics: b.topicIds.map((id) => manifest.byId[id]).filter((t) => t && stats[t.id]) }))
    .filter((x) => x.topics.length);
}

// Область ↔ набор тем. Блок, выбранный целиком, записывается как 'bN' — короче адрес и подпись.
function scopeToSet(manifest, scope) {
  const sc = parseScope(scope);
  const set = new Set(sc.topics);
  for (const b of sc.blocks) for (const id of manifest.blockById[b]?.topicIds || []) set.add(id);
  return set;
}
function setToScope(blocks, set) {
  const parts = [];
  for (const { b, topics } of blocks) {
    const sel = topics.filter((t) => set.has(t.id));
    if (sel.length && sel.length === topics.length) parts.push('b' + b.id);
    else sel.forEach((t) => parts.push('t' + t.id));
  }
  return parts.length ? parts.join(',') : 'all';
}
function pickLabel(manifest, scope) {
  const sc = parseScope(scope);
  if (sc.all) return 'Весь курс';
  const parts = [...sc.blocks].map((b) => 'Блок ' + b).concat([...sc.topics]);
  return parts.length <= 3 ? parts.join(', ') : nTopics(scopeToSet(manifest, scope).size);
}

function PickRow({ manifest, scope, onOpen, onReset }) {
  return (
    <div className="pickrow">
      <button className="pick" onClick={onOpen}>
        <span className="pick-v"><b>{pickLabel(manifest, scope)}</b></span>
        <span className="pick-ch" aria-hidden="true">›</span>
      </button>
      {scope !== 'all' && <button className="link-btn small" onClick={onReset}>Сбросить</button>}
    </div>
  );
}

function TopicPicker({ manifest, stats, value, onChange, metric, filter }) {
  const blocks = useMemo(() => pickerBlocks(manifest, stats), [manifest, stats]);
  const set = useMemo(() => scopeToSet(manifest, value), [manifest, value]);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  // раскрыты блоки с выбранными темами; если выбора нет — первый блок, где есть что показать на значке
  const [open, setOpen] = useState(() => {
    const o = new Set(blocks.filter((x) => x.topics.some((t) => set.has(t.id))).map((x) => x.b.id));
    if (!o.size) { const f = blocks.find((x) => x.topics.some((t) => metric(stats[t.id]).badge > 0)) || blocks[0]; if (f) o.add(f.b.id); }
    return o;
  });
  const commit = (s) => onChange(setToScope(blocks, s));
  const toggleTopic = (id) => { const s = new Set(set); if (s.has(id)) s.delete(id); else s.add(id); commit(s); };
  const toggleBlock = (topics, all) => { const s = new Set(set); topics.forEach((t) => (all ? s.delete(t.id) : s.add(t.id))); commit(s); };
  const toggleOpen = (id) => { const o = new Set(open); if (o.has(id)) o.delete(id); else o.add(id); setOpen(o); };
  const nq = norm(q.trim());

  return (
    <div className="tp">
      <div className="tp-tools">
        <input className="tp-search" type="search" id="tp-search" placeholder="Найти тему…" value={q} onChange={(e) => setQ(e.target.value)} />
        {filter && <button className={'chip' + (only ? ' on' : '')} onClick={() => setOnly((v) => !v)} aria-pressed={only}>{filter.label}</button>}
      </div>
      <div className="tp-list">
        {blocks.map(({ b, topics }) => {
          const shown = topics.filter((t) => (!nq || norm(t.id + ' ' + t.title).includes(nq)) && (!only || filter.pred(stats[t.id])));
          if (!shown.length) return null;
          const agg = topics.reduce((a, t) => addStats(a, stats[t.id]), ZERO());
          const m = metric(agg);
          const nSel = topics.filter((t) => set.has(t.id)).length;
          const all = nSel === topics.length;
          const expanded = !!nq || only || open.has(b.id);
          return (
            <div key={b.id} className="tp-block" style={{ '--c': b.color }}>
              <div className="tp-row tp-brow">
                <button className={'cb' + (all ? ' on' : nSel ? ' part' : '')} onClick={() => toggleBlock(topics, all)} aria-label={(all ? 'Снять' : 'Выбрать') + ' блок ' + b.id} />
                <button className="tp-main" onClick={() => toggleOpen(b.id)} aria-expanded={expanded}>
                  <span className="tp-t"><span className="tid">{b.id}</span> {b.title}</span>
                  <span className="small muted">{nSel ? 'выбрано ' + nSel + ' из ' + topics.length : nTopics(topics.length)} · {m.sub}</span>
                </button>
                {m.badge > 0 && <span className={'tbadge ' + m.cls}>{m.badge}</span>}
                <span className={'tp-chev' + (expanded ? ' open' : '')} aria-hidden="true">›</span>
              </div>
              {expanded && shown.map((t) => {
                const s = stats[t.id];
                const tm = metric(s);
                const on = set.has(t.id);
                return (
                  <button key={t.id} className={'tp-row tp-trow' + (tm.off ? ' tp-off' : '')} onClick={() => toggleTopic(t.id)} aria-pressed={on}>
                    <span className={'cb' + (on ? ' on' : '')} aria-hidden="true" />
                    <span className="tp-main">
                      <span className="tp-t"><span className="tid">{t.id}</span> {t.title}</span>
                      <span className="small muted">{tm.sub}</span>
                      <Bar value={s.seen / s.all} color="var(--c)" thin />
                    </span>
                    {tm.badge > 0 && <span className={'tbadge ' + tm.cls}>{tm.badge}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Полноэкранный выбор тем (для «Повторить» и «Практики»): правки применяются по «Готово».
function PickerSheet({ manifest, stats, value, metric, filter, onDone, onClose }) {
  const [v, setV] = useState(value);
  useBackHandler(true, onClose);
  const s = sumStats(stats, v);
  return (
    <div className="tsheet" role="dialog" aria-label="Выбор тем">
      <header className="tsheet-h">
        <button className="rbar-back" onClick={onClose} aria-label="Закрыть">←</button>
        <b>Выбор тем</b>
        <button className="link-btn" onClick={() => setV('all')} disabled={v === 'all'}>Сбросить</button>
      </header>
      <div className="tsheet-b">
        <TopicPicker manifest={manifest} stats={stats} value={v} onChange={setV} metric={metric} filter={filter} />
      </div>
      <footer className="tsheet-f">
        <span className="small muted">
          {v === 'all' ? 'Весь курс' : 'Выбрано: ' + pickLabel(manifest, v)}
          {metric === reviewMetric ? ' · повторить ' + (s.mcq.due + s.card.due) : ' · тестов ' + s.mcq.all + ', карточек ' + s.card.all}
        </span>
        <button className="btn btn-primary btn-big" onClick={() => onDone(v)}>Готово</button>
      </footer>
    </div>
  );
}
