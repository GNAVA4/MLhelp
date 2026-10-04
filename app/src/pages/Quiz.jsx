import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuestions, mcqForScope, scopeKey, shuffle } from '../lib/questions.js';
import { useProgress, saveAttempt, scopeResults } from '../lib/progress.js';
import { topicHref } from '../lib/router.js';
import { Bar, plural } from '../ui/ui.jsx';

// Размер короткого прогона «случайные N».
const RANDOM_N = 20;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const Html = ({ html, className, as: Tag = 'div' }) => <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;

export default function Quiz({ manifest, scopeType, scopeId }) {
  const { bank, error } = useQuestions();
  const progress = useProgress();
  const scope = scopeKey(scopeType, scopeId);
  const block = scopeType === 'block' ? manifest.blockById[scopeId] : manifest.blockById[manifest.byId[scopeId]?.blockId];
  const topic = scopeType === 'topic' ? manifest.byId[scopeId] : null;
  const title = topic ? 'Тест по теме ' + topic.id + ' · ' + topic.title : 'Тест блока ' + block?.id + ' · ' + block?.title;
  const [run, setRun] = useState(null); // { mode, items: [{q, order}], idx, answers: [], startedAt, tq }

  useEffect(() => { document.title = title; return () => { document.title = 'Applied ML'; }; }, [title]);

  if (!block) return <div className="screen-msg"><b>Тест не найден</b><a href="#/">К каталогу</a></div>;
  if (error) return <div className="screen-msg"><b>Не удалось загрузить вопросы</b><span>{error.message}</span></div>;
  if (!bank) return <div className="screen-msg"><span>Загрузка вопросов…</span></div>;

  const pool = mcqForScope(bank, scopeType, scopeId);
  const res = scopeResults(progress, scope);
  const lastWrong = res.last ? res.last.answers.filter((a) => !a.correct).map((a) => bank.byId[a.qid]).filter(Boolean) : [];

  const start = (mode, qs) => {
    const items = shuffle(qs).map((q) => ({ q, order: q.fixedOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i)) }));
    setRun({ mode, items, idx: 0, answers: [], startedAt: Date.now(), tq: Date.now(), done: false });
    window.scrollTo(0, 0);
  };

  const back = topic ? topicHref(topic.id) : '#/';

  return (
    <div className="quiz" style={{ '--c': block.color }}>
      <header className="qbar">
        <a className="rbar-back" href={back} title="Назад">←</a>
        <div className="rbar-title"><span className="rbar-name">{title}</span></div>
        {run && !run.done && <span className="small muted nowrap">{run.idx + 1} / {run.items.length}</span>}
      </header>
      <main className="qmain">
        {!run && <Start pool={pool} res={res} lastWrong={lastWrong} onStart={start} manifest={manifest} scopeType={scopeType} />}
        {run && !run.done && <Runner run={run} setRun={setRun} scope={scope} manifest={manifest} />}
        {run && run.done && <Result run={run} manifest={manifest} scopeType={scopeType} onRetry={(qs, mode) => start(mode, qs)} onHome={() => setRun(null)} />}
      </main>
    </div>
  );
}

function pctText(a) { return a ? Math.round((a.correct / a.total) * 100) + '%' : '—'; }

function Start({ pool, res, lastWrong, onStart, manifest, scopeType }) {
  const topics = scopeType === 'block' ? [...new Set(pool.map((q) => q.topicId))].map((id) => manifest.byId[id]) : [];
  if (!pool.length) return <div className="qcard"><p className="muted">Для этой области пока нет вопросов теста.</p></div>;
  return (
    <div className="qcard qstart">
      <div className="qstart-n"><b>{pool.length}</b> {plural(pool.length, 'вопрос', 'вопроса', 'вопросов')} с вариантами ответа</div>
      {topics.length > 0 && <div className="muted small">Темы: {topics.map((t) => t.id).join(', ')}</div>}
      <div className="qstart-res">
        <div><span className="muted small">Лучший результат (все вопросы)</span><b>{pctText(res.best)}</b></div>
        <div><span className="muted small">Последняя попытка</span><b>{res.last ? res.last.correct + ' / ' + res.last.total : '—'}</b></div>
        <div><span className="muted small">Попыток</span><b>{res.count}</b></div>
      </div>
      <div className="qstart-btns">
        <button className="btn btn-primary" onClick={() => onStart('all', pool)}>Все вопросы · {pool.length}</button>
        {pool.length > RANDOM_N && <button className="btn" onClick={() => onStart('random', shuffle(pool).slice(0, RANDOM_N))}>Случайные {RANDOM_N}</button>}
        {lastWrong.length > 0 && <button className="btn" onClick={() => onStart('wrong', lastWrong)}>Ошибки прошлой попытки · {lastWrong.length}</button>}
      </div>
      <p className="muted small">Варианты ответов перемешиваются при каждой попытке. После ответа — объяснение. Клавиши: 1–4 — выбрать, Enter — дальше.</p>
    </div>
  );
}

function Runner({ run, setRun, scope, manifest }) {
  const item = run.items[run.idx];
  const ans = run.answers[run.idx];
  const nextRef = useRef(null);
  const correctCount = run.answers.filter((a) => a.correct).length;

  const choose = (orig) => {
    if (ans) return;
    const a = { qid: item.q.id, chosen: orig, correct: orig === item.q.correct, ms: Date.now() - run.tq };
    setRun((r) => { const answers = r.answers.slice(); answers[r.idx] = a; return { ...r, answers }; });
  };
  const next = () => {
    if (!ans) return;
    if (run.idx + 1 < run.items.length) { setRun((r) => ({ ...r, idx: r.idx + 1, tq: Date.now() })); window.scrollTo(0, 0); return; }
    const answers = run.answers;
    const attempt = { id: 'a' + run.startedAt.toString(36), scope, mode: run.mode, startedAt: run.startedAt, finishedAt: Date.now(),
      total: answers.length, correct: answers.filter((a) => a.correct).length, answers };
    saveAttempt(attempt);
    setRun((r) => ({ ...r, done: true, attempt }));
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input,textarea')) return;
      const k = parseInt(e.key, 10);
      if (k >= 1 && k <= item.order.length) choose(item.order[k - 1]);
      else if (e.key === 'Enter' || e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (ans) nextRef.current?.focus(); }, [ans]);

  const t = manifest.byId[item.q.topicId];
  return (
    <>
      <Bar value={(run.idx + (ans ? 1 : 0)) / run.items.length} color="var(--c)" thin />
      <div className="qcard">
        <div className="qmeta small muted">
          <a href={topicHref(t.id)}>{t.id} {t.title}</a>
          <span>верно {correctCount} из {run.answers.filter(Boolean).length}</span>
        </div>
        <Html className="qtext" html={item.q.q} />
        <div className="opts">
          {item.order.map((orig, i) => {
            let cls = 'opt';
            if (ans) {
              if (orig === item.q.correct) cls += ' opt-ok';
              else if (orig === ans.chosen) cls += ' opt-bad';
              else cls += ' opt-dim';
            }
            return (
              <button key={orig} className={cls} onClick={() => choose(orig)} disabled={!!ans}>
                <span className="opt-l">{LETTERS[i]}</span>
                <Html as="span" className="opt-t" html={item.q.options[orig]} />
              </button>
            );
          })}
        </div>
        {ans && (
          <div className={'expl ' + (ans.correct ? 'expl-ok' : 'expl-bad')}>
            <b>{ans.correct ? '✓ Верно' : '✗ Неверно'}</b>
            {item.q.explanation && <Html html={item.q.explanation} />}
          </div>
        )}
        {ans && (
          <div className="qnext">
            <button ref={nextRef} className="btn btn-primary" onClick={next}>{run.idx + 1 < run.items.length ? 'Дальше →' : 'Завершить'}</button>
          </div>
        )}
      </div>
    </>
  );
}

// Оценка словами — только подпись к результату, на логику не влияет.
function verdict(p) {
  if (p >= 0.9) return 'Отлично — материал усвоен';
  if (p >= 0.75) return 'Хорошо — есть отдельные пробелы';
  if (p >= 0.5) return 'Заметные пробелы — стоит перечитать слабые темы';
  return 'Материал стоит перечитать';
}

function Result({ run, manifest, scopeType, onRetry, onHome }) {
  const { attempt, items } = run;
  const p = attempt.correct / attempt.total;
  const wrong = items.filter((_, i) => !attempt.answers[i].correct);
  const byTopic = useMemo(() => {
    const m = {};
    items.forEach((it, i) => { const id = it.q.topicId; (m[id] = m[id] || { ok: 0, n: 0 }); m[id].n++; if (attempt.answers[i].correct) m[id].ok++; });
    return Object.entries(m).map(([id, v]) => ({ t: manifest.byId[id], ...v })).sort((a, b) => a.ok / a.n - b.ok / b.n);
  }, [items]);

  return (
    <div className="qresult">
      <div className="qcard qscore">
        <div className="qscore-big">{Math.round(p * 100)}%</div>
        <div><b>{attempt.correct} из {attempt.total}</b> · {verdict(p)}</div>
        <div className="qstart-btns">
          {wrong.length > 0 && <button className="btn btn-primary" onClick={() => onRetry(wrong.map((x) => x.q), 'wrong')}>Пройти ошибки · {wrong.length}</button>}
          <button className="btn" onClick={() => onRetry(items.map((x) => x.q), run.mode)}>Ещё раз</button>
          <button className="btn" onClick={onHome}>К началу теста</button>
        </div>
      </div>

      {scopeType === 'block' && byTopic.length > 1 && (
        <div className="qcard">
          <h3>По темам</h3>
          {byTopic.map(({ t, ok, n }) => (
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
          {wrong.map((it) => {
            const a = attempt.answers[items.indexOf(it)];
            const t = manifest.byId[it.q.topicId];
            return (
              <details key={it.q.id} className="qwrong">
                <summary><Html as="span" html={it.q.q} /></summary>
                <div className="qwrong-body">
                  <div className="small"><span className="bad">Ваш ответ:</span> <Html as="span" html={it.q.options[a.chosen]} /></div>
                  <div className="small"><span className="ok">Верно:</span> <Html as="span" html={it.q.options[it.q.correct]} /></div>
                  {it.q.explanation && <Html className="small muted" html={it.q.explanation} />}
                  <a className="small link" href={topicHref(t.id)}>Перечитать тему {t.id} →</a>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
