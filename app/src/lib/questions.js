// Банк вопросов (public/data/questions.json, ~2.4 МБ) — грузится только при открытии теста.
import { useEffect, useState } from 'react';

let _bank = null;
let _promise = null;

export function loadQuestions() {
  if (!_promise) {
    _promise = fetch('data/questions.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('questions.json: HTTP ' + r.status); return r.json(); })
      .then((d) => {
        const mcq = d.questions.filter((q) => q.kind === 'mcq');
        _bank = { all: d.questions, mcq, byId: Object.fromEntries(d.questions.map((q) => [q.id, q])) };
        return _bank;
      });
  }
  return _promise;
}

export function useQuestions() {
  const [state, setState] = useState({ bank: _bank, error: null });
  useEffect(() => {
    if (_bank) return;
    loadQuestions().then((b) => setState({ bank: b, error: null }), (e) => setState({ bank: null, error: e }));
  }, []);
  return state;
}

export const scopeKey = (type, id) => type + ':' + id;

export function mcqForScope(bank, type, id) {
  return bank.mcq.filter((q) => (type === 'block' ? q.blockId === id : q.topicId === id));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
