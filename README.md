# Applied ML Course

Курс прикладного машинного обучения на русском: около 75 тем в блоках 0–9 (от вероятности до LLM), тесты к блокам. Плюс (в разработке) веб-приложение (PWA) для чтения, тестов и интервального повторения с синхронизацией прогресса через Firebase.

## Структура

```
content-src/      исходники тем нового стандарта (LaTeX в <tex>/<texd>)
content-legacy/   готовые HTML тем, тесты (blockN_quiz*), index_roadmap, block0_plan
tools/            build.js (сборка темы), check-page.js / check-all.js (проверка), vendor/ (KaTeX, Chart.js)
docs/             ML_COURSE_HANDOFF.md (ТЗ и план), content-report.md (состояние страниц)
COURSE_STANDARD.md  правила оформления тем
```

## Команды

```bash
npm install
npm run build:topic -- content-src/block0_03_bayes.src.html   # → content-legacy/block0_03_bayes.html
npm run check:page -- content-legacy/block0_03_bayes.html     # код 0 — страница в порядке
npm run check:all                                             # все страницы → docs/content-report.md
```
