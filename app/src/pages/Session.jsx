import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestions, buildQueue, shuffle, scopeLabel, MODES, KINDS } from '../lib/questions.js';
import { useProgress, getProgress, saveAttempt, toggleStar, setFlag } from '../lib/progress.js';
import { review, previewIntervals, fmtInterval } from '../lib/srs.js';
import { topicHref } from '../lib/router.js';
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
const GRADES = [
  { g: 1, label: 'Не знал', cls: 'g1' },
  { g: 2, label: 'С трудом', cls: 'g2' },
  { g: 3, label: 'Знал', cls: 'g3' },
  { g: 4, label: 'Легко', cls: 'g4' },
];
const Html = ({ html, className, as: Tag = 'div' }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

// Прохождение, из которого ушли читать тему: при возврате (тот же адрес) продолжаем с того же вопроса
// и в том же состоянии (выбранный ответ / открытый ответ карточки). Живёт в памяти, пока открыто приложение.
let kept = null; // { hash, run, answer: { chosen } | { shown } | null }
// свойства ссылки «в тему»: адрес с возвратом сюда; прохождение запоминается только по нажатию.
// Секция — где разобран вопрос (q.sec); без неё — начало темы, а не место последнего чтения (иначе любой вопрос
// уводил туда, где человек остановился, session 042).
const readLinkProps = (t, sec, answer, run) => ({
  href: topicHref(t.id, sec || (t.sections?.length ? t.sections[0].id : undefined)) + '?from=' + encodeURIComponent(window.location.hash),
  onClick: () => { kept = { hash: window.location.hash, run, answer }; },
});

const mkItem = (q) => ({ q, order: q.type === 'mcq' ? (q.fixedOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i))) : null, requeued: 0 });

export default function Session({ manifest, params }) {
  const { bank, error } = useQuestions();
  // 'today' (повторение + новые одной сессией) убран в session 018 — старые ссылки (напоминания) ведут на повторение
  const mode = params.mode === 'today' ? 'review' : MODES[params.mode] ? params.mode : 'test';
  const kind = KINDS[params.kind] ? params.kind : 'all';
  const title = MODES[mode].title + ((mode === 'review' || mode === 'new' || mode === 'again') && kind !== 'all' ? ': ' + KINDS[kind] : '');
  const scope = params.scope || 'all';
  const n = params.n ? parseInt(params.n, 10) : 0;
  const [restored] = useState(() => { const k = kept && kept.hash === window.location.hash ? kept : null; kept = null; return k; });
  const [run, setRun] = useState(restored ? restored.run : null);

  useEffect(() => {
    if (!bank || run) return;
    const qs = buildQueue({ mode, bank, progress: getProgress(), manifest, scope, n, kind });
    setRun(newRun(qs));
  }, [bank]);
  useEffect(() => { document.title = title + ' · Applied ML'; return () => { document.title = 'Applied ML'; }; }, [mode]);

  function newRun(qs) {
    return { items: qs.map(mkItem), idx: 0, results: [], startedAt: Date.now(), tq: Date.now(), done: false,
      deadline: mode === 'exam' ? Date.now() + qs.length * EXAM_SEC_PER_Q * 1000 : null };
  }

  if (error) return <div className="screen-msg"><b>Не удалось загрузить вопросы</b><span>{error.message}</span></div>;
  if (!bank || !run) return <div className="screen-msg"><span>Загрузка…</span></div>;

  const finish = (r) => {
    if (mode === 'test' || mode === 'exam') {
      const answers = r.results.map((x) => ({ qid: x.qid, chosen: x.chosen, correct: x.ok, ms: x.ms }));
      if (answers.length) saveAttempt({ id: 'a' + r.startedAt.toString(36), scope, mode, full: !n, startedAt: r.startedAt, finishedAt: Date.now(),
        total: answers.length, correct: answers.filter((a) => a.correct).length, answers });
    }
    haptic('success');
    setRun({ ...r, done: true });
    window.scrollTo(0, 0);
  };

  const header = (
    <header className="qbar">
      <a className="rbar-back" href="#/train" title="К тренировке">←</a>
      <div className="rbar-title"><span className="rbar-name">{title}<span className="muted small"> · {scopeLabel(manifest, scope)}</span></span></div>
      {!run.done && run.items.length > 0 && <span className="small muted nowrap">{Math.min(run.idx + 1, run.items.length)} / {run.items.length}</span>}
      {!run.done && run.deadline && <Countdown deadline={run.deadline} onExpire={() => finish(run)} />}
    </header>
  );

  if (!run.items.length) {
    return <div className="quiz">{header}<main className="qmain"><Empty mode={mode} /></main></div>;
  }

  return (
    <div className="quiz">
      {header}
      <main className="qmain">
        {!run.done && <Runner key={run.idx + ':' + run.items.length} run={run} setRun={setRun} mode={mode} manifest={manifest} onFinish={finish}
          restoreAnswer={restored && restored.run.idx === run.idx ? restored.answer : null} />}
        {run.done && <Summary run={run} mode={mode} manifest={manifest} bank={bank} onRetry={(qs) => setRun(newRun(qs))} />}
      </main>
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

function Runner({ run, setRun, mode, manifest, onFinish, restoreAnswer }) {
  const item = run.items[run.idx];
  const q = item.q;
  // банк в APK может быть свежее манифеста (lib/liveBank.js) — тема могла ещё не попасть в каталог
  const t = manifest.byId[q.topicId] || { id: q.topicId, title: '' };
  const progress = useProgress();
  const [flagForm, setFlagForm] = useState(false);
  const [note, setNote] = useState('');
  const starred = !!progress.marks.starred[q.id];
  const flagged = progress.marks.flagged[q.id];

  // result = null — вопрос пропущен: ни в память, ни в результаты сессии
  const advance = (result, requeue) => {
    const items = requeue ? [...run.items, { ...item, requeued: item.requeued + 1 }] : run.items;
    const next = { ...run, results: result ? [...run.results, result] : run.results, items, idx: run.idx + 1, tq: Date.now() };
    if (next.idx >= items.length) onFinish(next); else setRun(next);
    window.scrollTo(0, 0);
  };

  // пометка «в вопросе ошибка» — формой в карточке: prompt/confirm в Android-приложении не показываются
  const flag = () => { setNote(''); setFlagForm((v) => !v); };
  const saveFlag = () => { setFlag(q.id, note.trim() || '—'); setFlagForm(false); };
  const unflag = () => { setFlag(q.id, null); setFlagForm(false); };

  const answered = run.results.length;
  const ok = run.results.filter((x) => x.ok).length;
  return (
    <>
      <Bar value={run.idx / run.items.length} color="var(--c)" thin />
      <div className="qcard">
        <div className="qmeta small muted">
          <a {...readLinkProps(t, q.sec, null, run)} title="Открыть тему (вернётесь к этому вопросу)">{t.id} {t.title}</a>
          <span className="qtools">
            {mode === 'interview' && <Stopwatch since={run.tq} />}
            {mode !== 'exam' && answered > 0 && <span className="nowrap">{ok} / {answered}</span>}
            <button className={'icon ' + (starred ? 'on-star' : '')} onClick={() => toggleStar(q.id)} title="В избранное" aria-pressed={starred}><Icon name="star" size={18} fill={starred} /></button>
            <button className={'icon ' + (flagged ? 'on-flag' : '')} onClick={flag} title="В вопросе ошибка" aria-pressed={!!flagged}><Icon name="flag" size={18} /></button>
          </span>
        </div>
        {flagForm && (flagged
          ? <div className="flag-form"><span className="small">Вопрос помечен: {flagged.note}</span><span className="flag-btns"><button className="btn btn-sm" onClick={unflag}>Снять пометку</button><button className="btn btn-sm" onClick={() => setFlagForm(false)}>Закрыть</button></span></div>
          : <div className="flag-form"><input className="flag-input" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что не так с вопросом?" onKeyDown={(e) => e.key === 'Enter' && saveFlag()} /><span className="flag-btns"><button className="btn btn-sm btn-primary" onClick={saveFlag}>Отметить</button><button className="btn btn-sm" onClick={() => setFlagForm(false)}>Отмена</button></span></div>)}
        {item.requeued > 0 && <div className="tag-again small">повтор</div>}
        <Html className="qtext" html={q.q} />
        {q.type === 'mcq'
          ? <McqItem item={item} mode={mode} tq={run.tq} restore={restoreAnswer} readLink={(answer) => readLinkProps(t, q.sec, answer, run)} onDone={(res) => advance(res, false)} onSkip={() => advance(null, false)} />
          : <CardItem item={item} mode={mode} tq={run.tq} restore={restoreAnswer} readLink={(answer) => readLinkProps(t, q.sec, answer, run)} onDone={(res) => advance(res, (mode === 'review' || mode === 'new' || mode === 'again' || mode === 'cards') && res.grade === 1 && item.requeued < MAX_REQUEUE)} onSkip={() => advance(null, false)} />}
      </div>
    </>
  );
}

function McqItem({ item, mode, tq, onDone, onSkip, restore, readLink }) {
  const q = item.q;
  const exam = mode === 'exam';
  const [chosen, setChosen] = useState(restore && restore.chosen != null ? restore.chosen : null);
  const [locked, setLocked] = useState(!!(restore && restore.chosen != null && !exam));
  const nextRef = useRef(null);

  const pick = (orig) => {
    if (locked) return;
    setChosen(orig);
    if (exam) haptic('tap'); // в экзамене верность не показывается — и не ощущается
    if (!exam) {
      setLocked(true);
      const okk = orig === q.correct;
      review(q.id, okk ? 3 : 1, mode);
      haptic(okk ? 'success' : 'error');
    }
  };
  const next = () => {
    if (chosen == null) return;
    const okk = chosen === q.correct;
    if (exam) review(q.id, okk ? 3 : 1, mode);
    onDone({ qid: q.id, type: 'mcq', chosen, ok: okk, grade: okk ? 3 : 1, ms: Date.now() - tq });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= item.order.length) pick(item.order[k - 1]);
      else if (e.key === 'Enter' || e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (locked) nextRef.current?.focus(); }, [locked]);

  const show = locked && !exam;
  return (
    <>
      <div className="opts">
        {item.order.map((orig, i) => {
          let cls = 'opt';
          if (show) cls += orig === q.correct ? ' opt-ok' : orig === chosen ? ' opt-bad' : ' opt-dim';
          else if (exam && orig === chosen) cls += ' opt-sel';
          return (
            <button key={orig} className={cls} onClick={() => pick(orig)} disabled={show} data-haptic="off">
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
          <a className="read-link" {...readLink({ chosen })}>Почитать в теме →</a>
        </div>
      )}
      {(show || (exam && chosen != null)) && (
        <div className="qnext"><button ref={nextRef} className="btn btn-primary" onClick={next}>Дальше →</button></div>
      )}
      {chosen == null && <SkipBtn onSkip={onSkip} />}
    </>
  );
}

function CardItem({ item, mode, tq, onDone, onSkip, restore, readLink }) {
  const q = item.q;
  const [shown, setShown] = useState(!!(restore && restore.shown));
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const intervals = useMemo(() => (shown ? previewIntervals(q.id) : null), [shown]);
  const labels = mode === 'interview' ? { 1: 'Не ответил', 2: 'Частично', 3: 'Ответил', 4: 'Блестяще' } : null;

  const grade = (g) => {
    review(q.id, g, mode);
    haptic(g === 1 ? 'error' : 'tap');
    onDone({ qid: q.id, type: 'card', grade: g, ok: g >= 3, ms: Date.now() - tq });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setShown(true); return; }
      const k = parseInt(e.key, 10);
      if (shown && k >= 1 && k <= 4) grade(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // свайп по ответу: вправо — «знал», влево — «не знал»
  const onDown = (e) => { if (shown) start.current = e.clientX; };
  const onMove = (e) => { if (start.current != null) setDx(e.clientX - start.current); };
  const onUp = () => {
    if (start.current == null) return;
    const d = dx; start.current = null; setDx(0);
    if (d > SWIPE_PX) grade(3); else if (d < -SWIPE_PX) grade(1);
  };

  if (!shown) {
    return (
      <div className="qnext qnext-reveal">
        <button className="btn btn-primary" onClick={() => setShown(true)}>Показать ответ</button>
        <SkipBtn onSkip={onSkip} />
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
      {mode !== 'interview' && <a className="read-link" {...readLink({ shown: true })}>Почитать в теме →</a>}
      <div className="small muted swipe-hint">Свайп: вправо — знал, влево — не знал</div>
      <div className="grades">
        {GRADES.map((x) => (
          <button key={x.g} className={'grade ' + x.cls} onClick={() => grade(x.g)} data-haptic="off">
            <b>{labels ? labels[x.g] : x.label}</b>
            <span>{fmtInterval(intervals[x.g])}</span>
          </button>
        ))}
      </div>
      <SkipBtn onSkip={onSkip} />
    </>
  );
}

// Пропустить: вопрос уходит из сессии без оценки, память повторения не меняется (владелец, session 022).
function SkipBtn({ onSkip }) {
  return <button className="link-btn small skip-btn" onClick={onSkip}>Пропустить</button>;
}

function verdict(p) {
  if (p >= 0.9) return 'Отлично — материал усвоен';
  if (p >= 0.75) return 'Хорошо — есть отдельные пробелы';
  if (p >= 0.5) return 'Заметные пробелы — стоит повторить слабые темы';
  return 'Материал стоит перечитать';
}

function Summary({ run, mode, manifest, bank, onRetry }) {
  const res = run.results;
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
        <div className="small muted">{mins ? mins + ' мин · ' : ''}к повторению до конца завтра: {tomorrow}</div>
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
