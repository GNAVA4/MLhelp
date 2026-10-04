# Applied ML Course

Курс прикладного машинного обучения на русском: около 75 тем в блоках 0–9 (от вероятности до LLM), тесты к блокам. Плюс веб-приложение (PWA, в разработке) для чтения, тестов и интервального повторения.

## Структура

```
content-src/      исходники тем нового стандарта (LaTeX в <tex>/<texd>)
content-legacy/   готовые HTML тем, тесты (blockN_quiz*), index_roadmap, block0_plan
tools/            build.js (сборка темы), check-page.js / check-all.js (проверка), vendor/ (KaTeX, Chart.js)
questions/        банк вопросов для тренировок (по файлу на тему, правила — questions/README.md)
scripts/          контент-пайплайн приложения: build-content.js, bridge.js; банк: check/add-questions
app/              приложение: Vite + React (JS) — теория, тренировка (FSRS), статистика
docs/             ML_COURSE_HANDOFF.md (ТЗ и план), content-report.md (состояние страниц)
COURSE_STANDARD.md  правила оформления тем
```

## Запуск приложения

```bash
npm install                 # в корне: jsdom, mathjax — нужны контент-пайплайну
npm --prefix app install    # зависимости приложения
npm run content             # собрать app/public/{content,assets,data}
npm run dev                 # http://localhost:5173
```

`npm run content` собирает страницы тем для приложения (общие KaTeX / Chart.js / MathJax вместо CDN и встраивания, мост `bridge.js`), а также `data/manifest.json` (блоки, темы, секции) и `data/questions.json` (из банка `questions/`, формулы отрендерены). Результат в git не хранится.

## Банк вопросов

```bash
npm run questions                                   # проверка банка
node scripts/add-questions.js new.json              # добавить вопросы в тему (id выдаются сами)
```

## Контент

```bash
npm run build:topic -- content-src/block0_03_bayes.src.html   # → content-legacy/block0_03_bayes.html
npm run check:page -- content-legacy/block0_03_bayes.html     # код 0 — страница в порядке
npm run check:all                                             # все страницы → docs/content-report.md
```
