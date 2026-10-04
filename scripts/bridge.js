// Мост «страница темы → оболочка приложения». Подключается в каждую страницу при `npm run content`.
// Работает, только если страница открыта во фрейме приложения; при самостоятельном открытии ничего не делает.
//
// Страница → оболочка (postMessage, type с префиксом 'mlc:'):
//   mlc:ready    { sections: [{id,title}] }                — список секций id="sN"
//   mlc:section  { id }                                    — текущая секция (та, что пересекает верхнюю треть экрана)
//   mlc:read     { id }                                    — секция прочитана (см. READ_MS)
//   mlc:scroll   { pct }                                   — сколько страницы пролистано, 0..100
//   mlc:toggle   { kind: 'qa'|'task', open, index }        — раскрыт/свёрнут вопрос или задача
//   mlc:open     { file, hash }                            — клик по ссылке на другую тему курса
// Оболочка → страница:
//   mlc:goto     { id }                                    — прокрутить к секции
(function () {
  if (window.parent === window) return;
  var post = function (type, data) {
    var m = { type: 'mlc:' + type };
    for (var k in data) m[k] = data[k];
    try { window.parent.postMessage(m, '*'); } catch (e) {}
  };

  // Секция считается прочитанной, если она была текущей суммарно READ_MS миллисекунд.
  // 20 с — нижняя граница «действительно смотрел», а не пролистал мимо; уточнить по опыту использования.
  var READ_MS = 20000;
  var TICK_MS = 1000;

  function sectionTitle(el) {
    var a = document.querySelector('a[href="#' + el.id + '"]');
    var t = a ? a.textContent : '';
    if (!t) { var h = el.querySelector('h2,h3'); t = h ? h.textContent : el.id; }
    return t.replace(/\s+/g, ' ').trim();
  }

  function init() {
    var secs = Array.prototype.filter.call(document.querySelectorAll('[id]'), function (el) { return /^s\d+$/.test(el.id); });
    post('ready', { sections: secs.map(function (el) { return { id: el.id, title: sectionTitle(el) }; }) });

    var current = null, dwell = {}, sent = {};
    function pickCurrent() {
      var line = window.innerHeight / 3, best = null;
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        if (r.top <= line && r.bottom > line) { best = secs[i]; break; }
        if (r.top <= line) best = secs[i];
      }
      var id = best ? best.id : null;
      if (id !== current) { current = id; if (id) post('section', { id: id }); }
    }
    var lastPct = -1;
    function onScroll() {
      pickCurrent();
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? Math.round(Math.min(100, Math.max(0, window.scrollY / h * 100))) : 100;
      if (pct !== lastPct) { lastPct = pct; post('scroll', { pct: pct }); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    setInterval(function () {
      if (document.hidden || !current || sent[current]) return;
      dwell[current] = (dwell[current] || 0) + TICK_MS;
      if (dwell[current] >= READ_MS) { sent[current] = true; post('read', { id: current }); }
    }, TICK_MS);

    var qas = document.querySelectorAll('details.qa, details.qi');
    var tasks = document.querySelectorAll('.task details');
    function watch(list, kind) {
      Array.prototype.forEach.call(list, function (d, i) {
        d.addEventListener('toggle', function () { post('toggle', { kind: kind, open: d.open, index: i }); });
      });
    }
    watch(qas, 'qa'); watch(tasks, 'task');

    // Ссылки на другие темы курса открываем в оболочке, а не внутри фрейма.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      var m = /^(?:\.\/)?((?:block\d+_[\w]+|index_roadmap)\.html)(#.*)?$/.exec(href);
      if (!m) return;
      e.preventDefault();
      post('open', { file: m[1], hash: m[2] || '' });
    });

    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.type !== 'mlc:goto' || !d.id) return;
      var el = document.getElementById(d.id);
      if (el) el.scrollIntoView({ block: 'start' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
