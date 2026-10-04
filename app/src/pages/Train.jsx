import { useMemo, useState } from 'react';
import { useQuestions, modeCounts, parseScope, MODES } from '../lib/questions.js';
import { useProgress, setSetting, DEFAULT_NEW_PER_DAY } from '../lib/progress.js';
import { streak, todayInfo } from '../lib/srs.js';
import { sessionHref } from '../lib/router.js';
import { plural, SearchEntry } from '../ui/ui.jsx';

// Выбор области и размера сессии — удобство конкретного зрителя, храним в localStorage.
const SCOPE_KEY = 'mlc:trainScope', N_KEY = 'mlc:trainN';
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* не критично */ } };
const SIZES = [10, 20, 50, 0];

export default function Train({ manifest }) {
  const { bank, error } = useQuestions();
  const progress = useProgress();
  const [scope, setScopeState] = useState(() => load(SCOPE_KEY, 'all'));
  const [n, setNState] = useState(() => load(N_KEY, 20));
  const [topicsOpen, setTopicsOpen] = useState(false);
  const setScope = (s) => { setScopeState(s); save(SCOPE_KEY, s); };
  const setN = (v) => { setNState(v); save(N_KEY, v); };

  const counts = useMemo(() => (bank ? modeCounts({ bank, progress, manifest, scope }) : null), [bank, progress, scope]);
  if (error) return <div className="screen-msg"><b>Не удалось загрузить вопросы</b><span>{error.message}</span></div>;
  if (!bank) return <div className="screen-msg"><span>Загрузка вопросов…</span></div>;

  const sc = parseScope(scope);
  const qBlocks = manifest.blocks.filter((b) => b.mcqCount || b.cardCount);
  const toggle = (key) => {
    const set = new Set(sc.all ? [] : scope.split(',').filter(Boolean));
    if (set.has(key)) set.delete(key); else set.add(key);
    // тема внутри выбранного блока — лишняя
    if (key[0] === 'b') for (const t of [...set]) if (t[0] === 't' && manifest.byId[t.slice(1)]?.blockId === key.slice(1)) set.delete(t);
    setScope(set.size ? [...set].join(',') : 'all');
  };

  const st = streak(progress);
  const today = todayInfo(progress);
  const newPerDay = progress.settings.newPerDay ?? DEFAULT_NEW_PER_DAY;
  const newLeft = Math.min(Math.max(0, newPerDay - today.newToday), counts.fresh);
  const total = bank.all.length;
  const seen = Object.keys(progress.srs).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Тренировка</h1>
        <p className="muted">{total} {plural(total, 'вопрос', 'вопроса', 'вопросов')} · изучено {seen}</p>
      </header>
      <SearchEntry />

      <section className="today">
        <div className="today-top">
          <div className="streak" title="Дней подряд с занятиями">
            <span className="streak-n">{st.days}</span>
            <span className="small">{plural(st.days, 'день', 'дня', 'дней')} подряд{st.activeToday ? '' : ' — сегодня ещё не занимались'}</span>
          </div>
          <div className="today-nums">
            <div><b>{counts.due}</b><span className="small muted">повторить</span></div>
            <div><b>{newLeft}</b><span className="small muted">новых</span></div>
            <div><b>{today.answered}</b><span className="small muted">ответов сегодня</span></div>
          </div>
        </div>
        <a className={'btn btn-primary btn-big' + (counts.due + newLeft ? '' : ' btn-off')} href={sessionHref('today', scope)}>
          {counts.due + newLeft ? 'Начать: ' + (counts.due + newLeft) + ' ' + plural(counts.due + newLeft, 'вопрос', 'вопроса', 'вопросов') : 'На сегодня всё'}
        </a>
        <div className="small muted">Повторения — по всему изученному; новые вопросы — из выбранной области ниже, по порядку курса.</div>
      </section>

      <section className="scope">
        <div className="scope-h"><b>Область</b><span className="small muted">{sc.all ? 'весь курс' : 'выбрано: ' + scope.split(',').length}</span></div>
        <div className="chips">
          <button className={'chip-b' + (sc.all ? ' on' : '')} onClick={() => setScope('all')}>Весь курс</button>
          {qBlocks.map((b) => (
            <button key={b.id} className={'chip-b' + (sc.blocks.has(b.id) ? ' on' : '')} onClick={() => toggle('b' + b.id)}>
              <span className="chip-n">{b.id}</span>{b.title}
            </button>
          ))}
        </div>
        <button className="link-btn small" onClick={() => setTopicsOpen((v) => !v)}>{topicsOpen ? 'Скрыть темы ▴' : 'Выбрать отдельные темы ▾'}</button>
        {topicsOpen && (
          <div className="topic-pick">
            {qBlocks.map((b) => (
              <div key={b.id} className="tp-block">
                <div className="small muted">Блок {b.id}</div>
                <div className="chips">
                  {b.topicIds.map((id) => manifest.byId[id]).filter((t) => t.mcqCount || t.cardCount).map((t) => {
                    const on = sc.topics.has(t.id) || sc.blocks.has(b.id);
                    return (
                      <button key={t.id} className={'chip-t' + (on ? ' on' : '')} disabled={sc.blocks.has(b.id)} onClick={() => toggle('t' + t.id)} title={t.title}>
                        {t.id} {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="scope-h"><b>Вопросов в сессии</b></div>
        <div className="seg">
          {SIZES.map((s) => <button key={s} className={n === s ? 'on' : ''} onClick={() => setN(s)}>{s || 'Все'}</button>)}
        </div>
      </section>

      <section className="modes">
        {['test', 'cards', 'interview', 'exam', 'mistakes', 'weak', 'starred'].map((m) => {
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

      <section className="settings">
        <div className="scope-h"><b>Новых вопросов в день</b></div>
        <div className="stepper">
          <button onClick={() => setSetting('newPerDay', Math.max(0, newPerDay - 5))}>−</button>
          <b>{newPerDay}</b>
          <button onClick={() => setSetting('newPerDay', Math.min(200, newPerDay + 5))}>+</button>
          <span className="small muted">Каждый новый вопрос потом несколько раз вернётся на повторение — больше новых, больше ежедневной нагрузки.</span>
        </div>
      </section>
    </div>
  );
}
