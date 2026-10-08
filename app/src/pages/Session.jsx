import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestions, buildQueue, shuffle, scopeLabel, MODES, KINDS } from '../lib/questions.js';
import { useProgress, getProgress, saveAttempt, toggleStar, setFlag } from '../lib/progress.js';
import { review, previewIntervals, fmtInterval } from '../lib/srs.js';
import { topicHref } from '../lib/router.js';
import { useBackHandler } from '../lib/back.js';
import { Bar, plural } from '../ui/ui.jsx';
import Icon from '../ui/icons.jsx';
import { haptic } from '../lib/haptics.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Экзамен: 60 с на вопрос — ориентир на вдумчивый ответ без подглядывания.
const EXAM_SEC_PER_Q = 60;
// Карточку с оценкой «не знал» в сессиях «Повторение», «Новое» и «Карточки» показываем ещё раз в конце — один раз
// (владелец, session 022: в памяти она вернётся завтра; лишнее можно пропустить).
const MAX_REQUEUE = 1;
// Свайп: смещение в пикселях, после которого карточка засчитывается.
const SWIPE_PX = 90;
// Листание вопросов свайпом: горизонтальный сдвиг больше NAV_PX при вертикальном меньше NAV_DY (иначе это прокрутка).
const NAV_PX = 70, NAV_DY = 40;
const GRADES = [
  { g: 1, label: 'Не знал', cls: 'g1' },
  { g: 2, label: 'С трудом', cls: 'g2' },
  { g: 3, label: 'Знал', cls: 'g3' },
  { g: 4, label: 'Легко', cls: 'g4' },
];
const Html = ({ html, className, as: Tag = 'div' }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

// Прохождение, из которого ушли читать тему: при возврате (тот же адрес) продолжаем с того же вопроса
// и в том же состоянии (ответы и раскрытые карточки лежат в самом прохождении). Живёт в памяти, пока открыто приложение.
let kept = null; // { hash, run }
// свойства ссылки «в тему»: адрес с возвратом сюда; прохождение запоминается только по нажатию.
// Секция — где разобран вопрос (q.sec); без неё — начало темы, а не место последнего чтения (иначе любой вопрос
// уводил туда, где человек остановился, session 042).
const readLinkProps = (t, sec, run) => ({
  href: topicHref(t.id, sec || (t.sections?.length ? t.sections[0].id : undefined)) + '?from=' + encodeURIComponent(window.location.hash),
  onClick: () => { kept = { hash: window.location.hash, run }; },
});

// Вопрос сессии: res — засчитанный ответ (null — ещё нет), ans — состояние на экране ({ chosen } / { shown }),
// later — отложен кнопкой «Отложить» (владелец, session 046: вернуться к нему в конце; память не меняется).
const mkItem = (q, requeued = 0) => ({
  q, order: q.type === 'mcq' ? (q.fixedOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i))) : null,
  requeued, res: null, ans: null, later: false,
});
const setItem = (r, i, patch) => ({ ...r, items: r.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
// первый вопрос без ответа после from (по кругу не идём: начало списка — это уже «вернуться к отложенным»)
const nextOpen = (r, from) => { for (let i = from + 1; i < r.items.length; i++) if (!r.items[i].res) return i; return -1; };
const openItems = (r) => r.items.map((x, i) => ({ x, i })).filter(({ x }) => !x.res);
const answeredOf = (r) => r.items.filter((x) => x.res).map((x) => x.res);

export default function Session({ manifest, params }) {
  const { bank, error } = useQuestions();
  // 'today' (повторение + новые одной сессией) убран в session 018 — старые ссылки (напоминания) ведут на повторение
  const mode = params.mode === 'today' ? 'review' : MODES[params.mode] ? params.mode : 'test';
  const kind = KINDS[params.kind] ? params.kind : 'all';
  const title = MODES[mode].title + ((mode === 'review' || mode === 'new' || mode === 'again') && kind !== 'all' ? ': ' + KINDS[kind] : '');
  const scope = params.scope || 'all';
  const n = params.n ? parseInt(params.n, 10) : 0;
  const [run, setRun] = useState(() => { const k = kept && kept.hash === window.location.hash ? kept.run : null; kept = null; return k; });
  const [overview, setOverview] = useState(false);

  useEffect(() => {
    if (!bank || run) return;
    const qs = buildQueue({ mode, bank, progress: getProgress(), manifest, scope, n, kind });
    setRun(newRun(qs));
  }, [bank]);
  useEffect(() => { document.title = title + ' · Applied ML'; return () => { document.title = 'Applied ML'; }; }, [mode]);

  function newRun(qs) {
    return { items: qs.map((q) => mkItem(q)), idx: 0, startedAt: Date.now(), tq: Date.now(), done: false, end: false,
      deadline: mode === 'exam' ? Date.now() + qs.length * EXAM_SEC_PER_Q * 1000 : null };
  }

  if (error) return <div className="screen-msg"><b>Не удалось загрузить вопросы</b><span>{error.message}</span></div>;
  if (!bank || !run) return <div className="screen-msg"><span>Загрузка…</span></div>;

  const finish = (r) => {
    // экзамен: выбранный, но не подтверждённый «Дальше» ответ (ушли к другому вопросу) засчитывается при завершении
    if (mode === 'exam') r = { ...r, items: r.items.map((x) => {
      if (x.res || x.ans?.chosen == null) return x;
      const okk = x.ans.chosen === x.q.correct;
      review(x.q.id, okk ? 3 : 1, mode);
      return { ...x, res: { qid: x.q.id, type: 'mcq', chosen: x.ans.chosen, ok: okk, grade: okk ? 3 : 1, ms: 0 } };
    }) };
    if (mode === 'test' || mode === 'exam') {
      const answers = answeredOf(r).map((x) => ({ qid: x.qid, chosen: x.chosen, correct: x.ok, ms: x.ms }));
      if (answers.length) saveAttempt({ id: 'a' + r.startedAt.toString(36), scope, mode, full: !n, startedAt: r.startedAt, finishedAt: Date.now(),
        total: answers.length, correct: answers.filter((a) => a.correct).length, answers });
    }
    haptic('success');
    setOverview(false);
    setRun({ ...r, done: true });
    window.scrollTo(0, 0);
  };
  // переход к вопросу i (в том числе назад и к отложенным)
  const go = (r, i) => { setOverview(false); setRun({ ...r, idx: i, end: false, tq: Date.now() }); window.scrollTo(0, 0); };
  // конец прохода: если остались вопросы без ответа — экран «вернуться к отложенным», иначе итог
  const toEnd = (r) => { if (openItems(r).length) { setOverview(false); setRun({ ...r, end: true }); window.scrollTo(0, 0); } else finish(r); };
  const advance = (r) => { const i = nextOpen(r, r.idx); if (i >= 0) go(r, i); else toEnd(r); };

  const nOpen = openItems(run).length;
  const nLater = run.items.filter((x) => x.later && !x.res).length;
  const header = (
    <header className="qbar qbar-s">
      <a className="rbar-back" href="#/train" title="К тренировке">←</a>
      <div className="rbar-title"><span className="rbar-name">{title}<span className="muted small"> · {scopeLabel(manifest, scope)}</span></span></div>
      {!run.done && run.items.length > 0 && <span className="small muted nowrap">{run.end ? 'без ответа ' + nOpen : Math.min(run.idx + 1, run.items.length) + ' / ' + run.items.length}</span>}
      {!run.done && run.deadline && <Countdown deadline={run.deadline} onExpire={() => finish(run)} />}
      {!run.done && run.items.length > 1 && (
        <button className="icon" onClick={() => setOverview(true)} title="Все вопросы сессии" aria-label="Все вопросы сессии"><GridIcon /></button>
      )}
      {!run.done && run.items.length > 1 && <Strip run={run} exam={mode === 'exam'} onGo={(i) => go(run, i)} />}
      {!run.done && nLater > 0 && !run.end && <span className="strip-note small">Отложено: {nLater} — вернутся в конце</span>}
    </header>
  );

  if (!run.items.length) {
    return <div className="quiz">{header}<main className="qmain"><Empty mode={mode} /></main></div>;
  }

  return (
    <div className="quiz">
      {header}
      <main className={'qmain' + (!run.done && !run.end ? ' qmain-nav' : '')}>
        {!run.done && !run.end && <Runner key={run.idx + ':' + run.items.length} run={run} setRun={setRun} mode={mode} manifest={manifest}
          go={go} toEnd={toEnd} advance={advance} />}
        {!run.done && run.end && <EndOfPass run={run} mode={mode} onGo={(i) => go(run, i)} onFinish={() => finish(run)} />}
        {run.done && <Summary run={run} mode={mode} manifest={manifest} bank={bank} onRetry={(qs) => setRun(newRun(qs))} />}
      </main>
      {overview && <Overview run={run} exam={mode === 'exam'} onGo={(i) => go(run, i)} onFinish={() => finish(run)} onClose={() => setOverview(false)} />}
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

// Состояние вопроса для полоски и обзора. В экзамене верность не показываем — только «отвечен».
function cellState(x, i, run, exam) {
  if (x.res) return exam ? 's-done' : x.res.ok ? 's-ok' : 's-bad';
  if (x.later) return 's-later';
  if (i === run.idx && !run.end) return 's-cur';
  return '';
}
const STATE_NAME = { 's-done': 'отвечен', 's-ok': 'верно', 's-bad': 'ошибка', 's-later': 'отложен', 's-cur': 'текущий', '': 'без ответа' };

// Полоска вопросов сессии: по отрезку на вопрос, нажатие — перейти к нему.
function Strip({ run, exam, onGo }) {
  return (
    <div className="strip" role="list" aria-label="Вопросы сессии">
      {run.items.map((x, i) => {
        const s = cellState(x, i, run, exam);
        return <button key={i} role="listitem" className={'sseg ' + s + (i === run.idx && !run.end ? ' s-here' : '')} onClick={() => onGo(i)}
          aria-label={'Вопрос ' + (i + 1) + ': ' + STATE_NAME[s]} data-haptic="off" />;
      })}
    </div>
  );
}

// Все вопросы сессии сеткой номеров — для длинных сессий, где отрезки полоски мелкие.
function Overview({ run, exam, onGo, onFinish, onClose }) {
  useBackHandler(true, onClose);
  const answered = answeredOf(run);
  const open = openItems(run);
  const later = open.filter(({ x }) => x.later);
  const first = (later[0] || open[0])?.i;
  return (
    <div className="tsheet" role="dialog" aria-label="Вопросы сессии">
      <header className="tsheet-h">
        <button className="rbar-back" onClick={onClose} aria-label="Закрыть">←</button>
        <b>Вопросы сессии</b>
      </header>
      <div className="tsheet-b">
        <div className="ov">
          <p className="small muted ov-sum">
            Отвечено {answered.length} из {run.items.length}{!exam && answered.length ? ' · верно ' + answered.filter((x) => x.ok).length : ''}
            {later.length ? ' · отложено ' + later.length : ''}
          </p>
          <div className="ov-grid">
            {run.items.map((x, i) => {
              const s = cellState(x, i, run, exam);
              return <button key={i} className={'ov-cell ' + s + (i === run.idx && !run.end ? ' s-here' : '')} onClick={() => onGo(i)}
                aria-label={'Вопрос ' + (i + 1) + ': ' + STATE_NAME[s]}>{i + 1}</button>;
            })}
          </div>
          <div className="ov-legend small muted">
            {!exam && <><span><i className="s-ok" />верно</span><span><i className="s-bad" />ошибка</span></>}
            {exam && <span><i className="s-done" />отвечен</span>}
            <span><i className="s-later" />отложен</span><span><i />без ответа</span>
          </div>
        </div>
      </div>
      <footer className="tsheet-f">
        {first != null && <button className="btn btn-primary btn-big" onClick={() => onGo(first)}>{later.length ? 'К отложенным · ' + later.length : 'К вопросам без ответа · ' + open.length}</button>}
        <button className="btn btn-big btn-ghost-w" onClick={onFinish}>Завершить сессию</button>
      </footer>
    </div>
  );
}

// Конец прохода: есть вопросы без ответа — вернуться к ним или завершить без них.
function EndOfPass({ run, mode, onGo, onFinish }) {
  const answered = answeredOf(run);
  const open = openItems(run);
  const later = open.filter(({ x }) => x.later);
  const rest = open.filter(({ x }) => !x.later);
  const ok = answered.filter((x) => x.ok).length;
  const first = (later[0] || open[0]).i;
  const row = ({ x, i }) => (
    <button key={i} className="eop-row" onClick={() => onGo(i)}>
      <span className={'eop-n' + (x.later ? '' : ' eop-n-rest')}>№{i + 1}</span>
      <Html as="span" className="eop-q" html={x.q.q} />
      <span className="pick-ch" aria-hidden="true">›</span>
    </button>
  );
  return (
    <div className="qresult">
      {answered.length > 0 && (
        <div className="qcard eop-score">
          <b>{mode === 'exam' ? 'Отвечено ' + answered.length : ok + ' из ' + answered.length + ' верно'}</b>
          <span className="small muted">Ответили на {answered.length} из {run.items.length}</span>
        </div>
      )}
      <div className="qcard eop">
        <h3>{later.length ? 'Отложено ' + later.length + ' ' + plural(later.length, 'вопрос', 'вопроса', 'вопросов') : 'Без ответа ' + open.length}</h3>
        <div className="eop-list">
          {later.map(row)}
          {rest.length > 0 && later.length > 0 && <div className="lbl eop-lbl">Пролистаны без ответа</div>}
          {rest.map(row)}
        </div>
        <button className="btn btn-primary btn-big" onClick={() => onGo(first)}>{later.length ? 'Вернуться к отложенным · ' + later.length : 'Ответить на оставшиеся · ' + open.length}</button>
        <button className="btn btn-big btn-ghost-w" onClick={onFinish}>Завершить без них</button>
        <span className="small muted">Вопросы без ответа не трогают память повторения — новые останутся новыми, повторение подойдёт снова.</span>
      </div>
    </div>
  );
}

function Empty({ mode }) {
  const msg = {
    review: 'Повторять нечего: всё, что пора вспомнить, уже повторено. Можно взять новые вопросы.',
    new: 'В выбранных темах новых вопросов этого типа не осталось.',
    again: 'В выбранных темах ещё нет изученных вопросов этого типа.',
    mistakes: 'Ошибок нет — или вы ещё не отвечали на вопросы в этой области.',
    weak: 'Пока нет изученных вопросов в этой области.',
    starred: 'В избранном пока пусто. Отмечайте вопросы звёздочкой во время тренировки.',
  }[mode] || 'В этой области нет подходящих вопросов.';
  return <div className="qcard qscore"><p>{msg}</p><a className="btn btn-primary" href="#/train">К тренировке</a></div>;
}

function Countdown({ deadline, onExpire }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const left = Math.max(0, deadline - now);
  useEffect(() => { if (left === 0) onExpire(); }, [left === 0]);
  const s = Math.ceil(left / 1000);
  return <span className={'timer' + (s < 60 ? ' timer-low' : '')}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

function Stopwatch({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - since) / 1000);
  return <span className="timer">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</span>;
}

function Runner({ run, setRun, mode, manifest, go, toEnd, advance }) {
  const item = run.items[run.idx];
  const q = item.q;
  const exam = mode === 'exam';
  // банк в APK может быть свежее манифеста (lib/liveBank.js) — тема могла ещё не попасть в каталог
  const t = manifest.byId[q.topicId] || { id: q.topicId, title: '' };
  const progress = useProgress();
  const [flagForm, setFlagForm] = useState(false);
  const [note, setNote] = useState('');
  const touch = useRef(null);
  const starred = !!progress.marks.starred[q.id];
  const flagged = progress.marks.flagged[q.id];

  const saveAns = (ans) => setRun(setItem(run, run.idx, { ans }));
  // засчитать ответ, не уходя с вопроса (тест: объяснение остаётся на экране до «Дальше»)
  const record = (res, ans) => setRun(setItem(run, run.idx, { res, ans, later: false }));
  // засчитать и перейти (карточка после оценки; экзамен по «Дальше»); «не знал» — копия вопроса в конец
  const commit = (res, ans, requeue) => {
    let r = setItem(run, run.idx, { res, ans, later: false });
    if (requeue) r = { ...r, items: [...r.items, mkItem(q, item.requeued + 1)] };
    advance(r);
  };
  const prev = () => run.idx > 0 && go(run, run.idx - 1);
  const fwd = () => (run.idx < run.items.length - 1 ? go(run, run.idx + 1) : toEnd(run));
  const later = () => { haptic('tap'); advance(setItem(run, run.idx, { later: true })); };
  const next = () => {
    if (exam && !item.res && item.ans?.chosen != null) {
      const okk = item.ans.chosen === q.correct;
      review(q.id, okk ? 3 : 1, mode);
      commit({ qid: q.id, type: 'mcq', chosen: item.ans.chosen, ok: okk, grade: okk ? 3 : 1, ms: Date.now() - run.tq }, item.ans, false);
    } else advance(run);
  };
  // главная кнопка внизу: после ответа (или выбора в экзамене) — «Дальше», до ответа — «Отложить»
  const ready = !!item.res || (exam && item.ans?.chosen != null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') (ready ? next() : fwd());
      else if (e.key === 'Enter' && ready) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // свайп по вопросу — листать (у раскрытой карточки свайп по ответу — оценка, там не листаем)
  const swipeNav = q.type === 'mcq' || !(item.ans?.shown || item.res);
  const onTouchStart = (e) => { if (swipeNav) touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || e.target.closest('.answer, pre, .mdisp, .opt-t, .flag-form')) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dy) > NAV_DY || Math.abs(dx) < NAV_PX) return;
    if (dx < 0) fwd(); else prev();
  };

  // пометка «в вопросе ошибка» — формой в карточке: prompt/confirm в Android-приложении не показываются
  const flag = () => { setNote(''); setFlagForm((v) => !v); };
  const saveFlag = () => { setFlag(q.id, note.trim() || '—'); setFlagForm(false); };
  const unflag = () => { setFlag(q.id, null); setFlagForm(false); };

  const answered = answeredOf(run);
  const ok = answered.filter((x) => x.ok).length;
  return (
    <>
      <div className="qcard" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="qmeta small muted">
          <a {...readLinkProps(t, q.sec, run)} title="Открыть тему (вернётесь к этому вопросу)">{t.id} {t.title}</a>
          <span className="qtools">
            {mode === 'interview' && <Stopwatch since={run.tq} />}
            {!exam && answered.length > 0 && <span className="nowrap">{ok} / {answered.length}</span>}
            <button className={'icon ' + (starred ? 'on-star' : '')} onClick={() => toggleStar(q.id)} title="В избранное" aria-pressed={starred}><Icon name="star" size={18} fill={starred} /></button>
            <button className={'icon ' + (flagged ? 'on-flag' : '')} onClick={flag} title="В вопросе ошибка" aria-pressed={!!flagged}><Icon name="flag" size={18} /></button>
          </span>
        </div>
        {flagForm && (flagged
          ? <div className="flag-form"><span className="small">Вопрос помечен: {flagged.note}</span><span className="flag-btns"><button className="btn btn-sm" onClick={unflag}>Снять пометку</button><button className="btn btn-sm" onClick={() => setFlagForm(false)}>Закрыть</button></span></div>
          : <div className="flag-form"><input className="flag-input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что не так с вопросом?" onKeyDown={(e) => e.key === 'Enter' && saveFlag()} /><span className="flag-btns"><button className="btn btn-sm btn-primary" onClick={saveFlag}>Отметить</button><button className="btn btn-sm" onClick={() => setFlagForm(false)}>Отмена</button></span></div>)}
        {item.requeued > 0 && <div className="tag-again small">повтор</div>}
        {item.later && !item.res && <div className="tag-again small">отложен</div>}
        <Html className="qtext" html={q.q} />
        {q.type === 'mcq'
          ? <McqItem item={item} mode={mode} tq={run.tq} readLink={readLinkProps(t, q.sec, run)} onRecord={record} onSelect={saveAns} />
          : <CardItem item={item} mode={mode} tq={run.tq} readLink={readLinkProps(t, q.sec, run)} onShow={() => saveAns({ shown: true })}
              onGrade={(res) => commit(res, { shown: true }, (mode === 'review' || mode === 'new' || mode === 'again' || mode === 'cards') && res.grade === 1 && item.requeued < MAX_REQUEUE)} />}
      </div>
      {q.type === 'mcq' && run.idx === 0 && !item.res && <div className="small muted swipe-hint">Свайп ← → — листать вопросы</div>}

      <nav className="snav" aria-label="Навигация по вопросам">
        <div className="snav-in">
          <button className="snav-arrow" onClick={prev} disabled={run.idx === 0} aria-label="Предыдущий вопрос">‹</button>
          {ready
            ? <button className="snav-mid btn-primary" onClick={next} autoFocus>Дальше →</button>
            : <button className="snav-mid snav-later" onClick={later}><BookmarkIcon />Отложить</button>}
          <button className="snav-arrow" onClick={fwd} aria-label="Следующий вопрос">›</button>
        </div>
      </nav>
    </>
  );
}

function BookmarkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
}

function McqItem({ item, mode, tq, onRecord, onSelect, readLink }) {
  const q = item.q;
  const exam = mode === 'exam';
  const chosen = item.ans?.chosen ?? null;
  const locked = !!item.res; // ответ засчитан: в тесте — сразу по нажатию, в экзамене — по «Дальше»

  const pick = (orig) => {
    if (locked) return;
    if (exam) { haptic('tap'); onSelect({ chosen: orig }); return; } // в экзамене верность не показывается — и не ощущается
    const okk = orig === q.correct;
    review(q.id, okk ? 3 : 1, mode);
    haptic(okk ? 'success' : 'error');
    onRecord({ qid: q.id, type: 'mcq', chosen: orig, ok: okk, grade: okk ? 3 : 1, ms: Date.now() - tq }, { chosen: orig });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= item.order.length) pick(item.order[k - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const show = locked && !exam;
  return (
    <>
      <div className="opts">
        {item.order.map((orig, i) => {
          let cls = 'opt';
          if (show) cls += orig === q.correct ? ' opt-ok' : orig === chosen ? ' opt-bad' : ' opt-dim';
          else if (exam && orig === chosen) cls += ' opt-sel';
          return (
            <button key={orig} className={cls} onClick={() => pick(orig)} disabled={locked} data-haptic="off">
              <span className="opt-l">{LETTERS[i]}</span>
              <Html as="span" className="opt-t" html={q.options[orig]} />
            </button>
          );
        })}
      </div>
      {show && (
        <div className={'expl ' + (chosen === q.correct ? 'expl-ok' : 'expl-bad')}>
          <b>{chosen === q.correct ? 'Верно' : 'Неверно'}</b>
          {q.explanation && <Html html={q.explanation} />}
          <a className="read-link" {...readLink}>Почитать в теме →</a>
        </div>
      )}
    </>
  );
}

function CardItem({ item, mode, tq, onShow, onGrade, readLink }) {
  const q = item.q;
  const shown = !!(item.ans?.shown || item.res);
  const done = item.res; // уже оценена: при возврате к ней показываем оценку, без повторной
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const intervals = useMemo(() => (shown && !done ? previewIntervals(q.id) : null), [shown]);
  const labels = mode === 'interview' ? { 1: 'Не ответил', 2: 'Частично', 3: 'Ответил', 4: 'Блестяще' } : null;

  const grade = (g) => {
    if (done) return;
    review(q.id, g, mode);
    haptic(g === 1 ? 'error' : 'tap');
    onGrade({ qid: q.id, type: 'card', grade: g, ok: g >= 3, ms: Date.now() - tq });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onShow(); return; }
      const k = parseInt(e.key, 10);
      if (shown && k >= 1 && k <= 4) grade(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // свайп по ответу: вправо — «знал», влево — «не знал»
  const onDown = (e) => { if (shown && !done) start.current = e.clientX; };
  const onMove = (e) => { if (start.current != null) setDx(e.clientX - start.current); };
  const onUp = () => {
    if (start.current == null) return;
    const d = dx; start.current = null; setDx(0);
    if (d > SWIPE_PX) grade(3); else if (d < -SWIPE_PX) grade(1);
  };

  if (!shown) {
    return (
      <div className="qnext qnext-reveal">
        <button className="btn btn-primary" onClick={onShow}>Показать ответ</button>
      </div>
    );
  }
  return (
    <>
      <div className={'answer' + (dx > SWIPE_PX ? ' sw-ok' : dx < -SWIPE_PX ? ' sw-bad' : '')}
        style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 40}deg)` : undefined, touchAction: 'pan-y' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Html html={q.a} />
        {q.note && <Html className="card-note" html={q.note} />}
      </div>
      {mode !== 'interview' && <a className="read-link" {...readLink}>Почитать в теме →</a>}
      {!done && <div className="small muted swipe-hint">Свайп по ответу: вправо — знал, влево — не знал</div>}
      <div className="grades">
        {GRADES.map((x) => (
          <button key={x.g} className={'grade ' + x.cls + (done ? (done.grade === x.g ? ' grade-on' : ' grade-dim') : '')} onClick={() => grade(x.g)} disabled={!!done} data-haptic="off">
            <b>{labels ? labels[x.g] : x.label}</b>
            {!done && <span>{fmtInterval(intervals[x.g])}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function verdict(p) {
  if (p >= 0.9) return 'Отлично — материал усвоен';
  if (p >= 0.75) return 'Хорошо — есть отдельные пробелы';
  if (p >= 0.5) return 'Заметные пробелы — стоит повторить слабые темы';
  return 'Материал стоит перечитать';
}

function Summary({ run, mode, manifest, bank, onRetry }) {
  const res = answeredOf(run);
  const unanswered = openItems(run).length;
  const p = res.length ? res.filter((x) => x.ok).length / res.length : 0;
  // по первой попытке каждого вопроса (повторы карточек внутри сессии не учитываем)
  const first = [];
  const seen = new Set();
  for (const x of res) if (!seen.has(x.qid)) { seen.add(x.qid); first.push(x); }
  const wrong = first.filter((x) => !x.ok);
  const byTopic = {};
  first.forEach((x) => { const tid = bank.byId[x.qid].topicId; (byTopic[tid] = byTopic[tid] || { ok: 0, n: 0 }); byTopic[tid].n++; if (x.ok) byTopic[tid].ok++; });
  const topics = Object.entries(byTopic).map(([id, v]) => ({ t: manifest.byId[id], ...v })).sort((a, b) => a.ok / a.n - b.ok / b.n);
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 59, 999); return Object.values(getProgress().srs).filter((c) => c.due <= +d).length; })();
  const mins = Math.round((Date.now() - run.startedAt) / 60000);

  return (
    <div className="qresult">
      <div className="qcard qscore">
        <div className="qscore-big">{Math.round(p * 100)}%</div>
        <div><b>{first.filter((x) => x.ok).length} из {first.length}</b> · {verdict(p)}</div>
        <div className="small muted">{mins ? mins + ' мин · ' : ''}{unanswered ? 'без ответа ' + unanswered + ' · ' : ''}к повторению до конца завтра: {tomorrow}</div>
        <div className="qstart-btns">
          {wrong.length > 0 && <button className="btn btn-primary" onClick={() => onRetry(wrong.map((x) => bank.byId[x.qid]))}>Повторить ошибки · {wrong.length}</button>}
          <a className="btn" href="#/train">К тренировке</a>
        </div>
      </div>

      {topics.length > 1 && (
        <div className="qcard">
          <h3>По темам</h3>
          {topics.map(({ t, ok, n }) => (
            <a key={t.id} className="qtopic" href={topicHref(t.id)}>
              <span className="tid" style={{ color: 'var(--c)' }}>{t.id}</span>
              <span className="qtopic-name">{t.title}</span>
              <span className="small muted nowrap">{ok} / {n}</span>
              <Bar value={ok / n} color={ok / n >= 0.75 ? 'var(--ok)' : ok / n >= 0.5 ? 'var(--warn)' : 'var(--bad)'} thin />
            </a>
          ))}
        </div>
      )}

      {wrong.length > 0 && (
        <div className="qcard">
          <h3>Ошибки · {wrong.length}</h3>
          {wrong.map((x) => {
            const q = bank.byId[x.qid];
            const t = manifest.byId[q.topicId];
            return (
              <details key={x.qid} className="qwrong">
                <summary><Html as="span" html={q.q} /></summary>
                <div className="qwrong-body">
                  {q.type === 'mcq' ? (
                    <>
                      <div className="small"><span className="bad">Ваш ответ:</span> <Html as="span" html={q.options[x.chosen]} /></div>
                      <div className="small"><span className="ok">Верно:</span> <Html as="span" html={q.options[q.correct]} /></div>
                      {q.explanation && <Html className="small muted" html={q.explanation} />}
                    </>
                  ) : <><Html className="small" html={q.a} />{q.note && <Html className="small card-note" html={q.note} />}</>}
                  <a className="small link" href={topicHref(t.id)}>Тема {t.id} {t.title} →</a>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
