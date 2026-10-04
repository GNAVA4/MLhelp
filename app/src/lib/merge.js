// Слияние прогресса двух устройств (локальный + облачный). Чистые функции, без побочных эффектов.
// Правило: ничего не теряем. Телефон и ПК могли заниматься офлайн одновременно — «последний записавший
// побеждает» стёр бы ответы одного из них, поэтому каждая часть сливается по своему смыслу.

// Журнал и попытки хранятся с теми же лимитами, что и локально (progress.js, srs.js).
export const MAX_LOG = 8000;
export const MAX_ATTEMPTS = 300;

// srs[qid]: побеждает карточка с более поздним последним повторением (lr), при равенстве — с бо́льшим числом
// повторений; дата первого знакомства (fr) — самая ранняя.
export function mergeSrs(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, cb] of Object.entries(b)) {
    const ca = out[id];
    if (!ca) { out[id] = cb; continue; }
    const la = ca.lr || 0, lb = cb.lr || 0;
    const win = lb > la || (lb === la && (cb.r || 0) > (ca.r || 0)) ? cb : ca;
    const fr = Math.min(ca.fr ?? Infinity, cb.fr ?? Infinity);
    out[id] = Number.isFinite(fr) ? { ...win, fr } : win;
  }
  return out;
}

// Журнал ответов: объединение без дублей (ключ — время + вопрос), по времени, последние MAX_LOG.
export function mergeLog(a = [], b = []) {
  const seen = new Set(), out = [];
  for (const x of [...a, ...b]) {
    const k = x.t + '|' + x.q;
    if (seen.has(k)) continue;
    seen.add(k); out.push(x);
  }
  out.sort((x, y) => x.t - y.t);
  return out.slice(-MAX_LOG);
}

export function mergeAttempts(a = [], b = []) {
  const by = new Map();
  for (const x of [...a, ...b]) if (x && x.id && !by.has(x.id)) by.set(x.id, x);
  return [...by.values()].sort((x, y) => (x.startedAt || 0) - (y.startedAt || 0)).slice(-MAX_ATTEMPTS);
}

// Темы: прочитанные секции объединяются, прокрутка — максимум; отметки, последняя секция, «пройдено» —
// с устройства, где тему трогали позже (так снятие «пройдено» тоже доезжает).
export function mergeTopics(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, tb] of Object.entries(b)) {
    const ta = out[id];
    if (!ta) { out[id] = tb; continue; }
    const [old, neu] = (tb.updatedAt || 0) > (ta.updatedAt || 0) ? [ta, tb] : [tb, ta];
    out[id] = {
      ...old, ...neu,
      sectionsRead: [...new Set([...(ta.sectionsRead || []), ...(tb.sectionsRead || [])])],
      maxScroll: Math.max(ta.maxScroll || 0, tb.maxScroll || 0),
      startedAt: Math.min(ta.startedAt ?? Infinity, tb.startedAt ?? Infinity),
      // «пройдено» не теряется от простого открытия темы на другом устройстве; снимается только явным null
      completedAt: neu.completedAt === null ? null : (neu.completedAt ?? old.completedAt),
    };
    if (!Number.isFinite(out[id].startedAt)) delete out[id].startedAt;
  }
  return out;
}

// Избранное и пометки: { starred: {qid: ms}, flagged: {qid: {t, note}}, removed: {'star:qid'|'flag:qid': ms} }.
// removed — «надгробия»: снятие звезды/пометки позже её установки побеждает, иначе звезда вернулась бы с другого устройства.
export function mergeMarks(a = {}, b = {}) {
  const removed = { ...(a.removed || {}) };
  for (const [k, t] of Object.entries(b.removed || {})) removed[k] = Math.max(removed[k] || 0, t);
  const starred = { ...(a.starred || {}) };
  for (const [id, t] of Object.entries(b.starred || {})) starred[id] = Math.max(starred[id] || 0, t);
  const flagged = { ...(a.flagged || {}) };
  for (const [id, f] of Object.entries(b.flagged || {})) if (!flagged[id] || f.t > flagged[id].t) flagged[id] = f;
  for (const id of Object.keys(starred)) if ((removed['star:' + id] || 0) >= starred[id]) delete starred[id];
  for (const id of Object.keys(flagged)) if ((removed['flag:' + id] || 0) >= flagged[id].t) delete flagged[id];
  return { starred, flagged, removed };
}

// Небольшие объекты целиком: побеждает более свежий (settings._t, meta.lastOpenedAt).
const newer = (a, b, key) => ((b?.[key] || 0) > (a?.[key] || 0) ? b : a) || {};

export function mergeProgress(a, b) {
  return {
    ...a,
    srs: mergeSrs(a.srs, b.srs),
    log: mergeLog(a.log, b.log),
    attempts: mergeAttempts(a.attempts, b.attempts),
    topics: mergeTopics(a.topics, b.topics),
    marks: mergeMarks(a.marks, b.marks),
    meta: newer(a.meta, b.meta, 'lastOpenedAt'),
    settings: newer(a.settings, b.settings, '_t'),
  };
}
