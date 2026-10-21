// Перенумерация тем блоков 1–9 (ADR 022, 2026-10-21): старый номер → новый. Прогресс чтения (topics),
// выключенные из повторения темы (settings.reviewOff) и последняя тема (meta.lastTopicId) хранятся по номеру темы,
// поэтому их ключи переводятся один раз; отметка версии лежит в самом разделе — облако и устройство мигрируют независимо.
// Память повторения (srs) хранится по id вопроса и не меняется.
export const TOPIC_MAP_V = 1;
export const TOPIC_MAP = {
  '1.15': '1.1', '1.14': '1.2', '1.9': '1.3', '1.11': '1.4', '1.2': '1.5', '1.7': '1.6',
  '1.4': '1.7', '1.10': '1.8', '7.1': '1.9', '1.6': '1.10', '1.12': '1.11', '1.8': '1.12',
  '1.1': '1.13', '4.1': '2.1', '4.2': '2.2', '4.6': '2.3', '4.5': '2.4', '4.3': '2.5',
  '4.4': '2.6', '1.3': '2.7', '1.13': '2.9', '2.1': '3.1', '1.5': '3.2', '2.2': '3.3',
  '2.9': '3.4', '2.5': '3.5', '2.6': '3.6', '2.7': '3.7', '2.8': '3.8', '2.10': '3.9',
  '2.11': '3.10', '3.4': '3.11', '2.3': '3.12', '2.4': '3.13', '8.1': '4.1', '8.2': '4.2',
  '8.3': '4.3', '8.4': '4.4', '8.6': '4.5', '7.2': '4.6', '7.4': '4.7', '3.2': '6.1',
  '3.1': '6.2', '3.3': '6.3', '9.1': '7.1', '9.2': '7.2', '6.1': '7.3', '6.2': '7.4',
  '6.3': '7.5', '6.4': '7.6', '6.6': '7.7', '6.7': '7.8', '6.5': '7.9', '9.3': '8.1',
  '8.5': '8.2', '8.7': '8.3', '8.8': '8.4', '8.9': '8.5', '9.5': '8.6', '9.4': '8.7',
  '9.6': '8.8', '7.3': '9.1',
};
const MARK = '~v';
const remap = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) out[TOPIC_MAP[k] || k] = v; return out; };

// Переводит разделы, которые есть в объекте (локальное состояние целиком или пришедшие из облака разделы).
export function migrateTopicIds(s) {
  if (!s || typeof s !== 'object') return s;
  const out = { ...s };
  if (s.topics && !s.topics[MARK]) out.topics = { ...remap(s.topics), [MARK]: { v: TOPIC_MAP_V } };
  if (s.settings && (s.settings.topicMapV || 0) < TOPIC_MAP_V) out.settings = { ...s.settings, reviewOff: remap(s.settings.reviewOff), topicMapV: TOPIC_MAP_V };
  if (s.meta && (s.meta.topicMapV || 0) < TOPIC_MAP_V) out.meta = { ...s.meta, lastTopicId: TOPIC_MAP[s.meta.lastTopicId] || s.meta.lastTopicId, topicMapV: TOPIC_MAP_V };
  return out;
}

// Сохранённые фильтры тем и раскрытые блоки ссылаются на старые номера блоков — сбрасываем один раз.
export function resetStaleUiKeys() {
  try {
    if (Number(localStorage.getItem('mlc:topicMapV') || 0) >= TOPIC_MAP_V) return;
    for (const k of ['mlc:reviewScope', 'mlc:newScope', 'mlc:trainScope', 'mlc:openBlocks']) localStorage.removeItem(k);
    localStorage.setItem('mlc:topicMapV', String(TOPIC_MAP_V));
  } catch { /* приватный режим — не критично */ }
}
