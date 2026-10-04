// Проверка собранной страницы темы: структура + все графики Chart.js создаются без ошибок.
// Требует: npm i jsdom   Запуск: node tools/check-page.js content-legacy/block0_03_bayes.html
const fs=require('fs'), path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const f=process.argv[2]; if(!f){console.error('usage: node check-page.js <file.html>');process.exit(1);}
const html=fs.readFileSync(f,'utf8');
const noScript=html.replace(/<script[\s\S]*?<\/script>/g,'');
const cnt=(s,re)=>(s.match(re)||[]).length;
const report={
  // секции: в новом стандарте <section id="sN">, в старых страницах <div class="sec" id="sN">
  htmlEnd:cnt(html,/<\/html>/g), sections:cnt(noScript,/<(?:section|div)[^>]*\sid="s\d+"/g),
  qa:cnt(html,/<details class="qa">/g)+cnt(html,/<div class="qa">/g),
  divOpen:cnt(noScript,/<div[\s>]/g), divClose:cnt(noScript,/<\/div>/g),
  texErrors:cnt(html,/\[TeX error\]/g)
};
const canv=[...html.matchAll(/<canvas id="(c_[a-z0-9_]+)"/g)].map(m=>m[1]);
const mk=new Set([...html.matchAll(/mk\('(c_[a-z0-9_]+)'/g)].map(m=>m[1]));
report.canvasWithoutMk=canv.filter(c=>!mk.has(c)); // справочно: старые страницы создают графики через new Chart(...), а не mk()
const vc=new VirtualConsole(); const errs=[];
vc.on('jsdomError',e=>errs.push('jsdomError '+e.message)); vc.on('error',e=>errs.push('error '+e));
vc.on('log',(...m)=>errs.push('log '+m.map(x=>x&&x.stack?x.stack.split('\n')[0]:x).join(' ')));
// если Chart.js подключён по CDN — подставляем локальный
let src=html.replace(/<script src="[^"]*chart[^"]*"><\/script>/i,'');
const dom=new JSDOM(src,{runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true});
const w=dom.window;
const fake=new Proxy({},{get(t,k){ if(k==='canvas')return t.canvas; if(k==='length'||k==='then'||typeof k==='symbol')return undefined;
  if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:[]}); if(k==='createLinearGradient')return ()=>({addColorStop(){}});
  if(k in t) return t[k]; return function(){}; }, set(t,k,v){t[k]=v;return true;}});
w.HTMLCanvasElement.prototype.getContext=function(){ fake.canvas=this; return fake; };
Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return 800}});
Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return 400}});
w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
if(!/Chart\.js 4\.4\.1 \(MIT\)/.test(html)) w.eval(fs.readFileSync(path.join(__dirname,'vendor','chart.umd.js'),'utf8'));
// Все скрипты страницы (инлайн + локальные src, напр. blockN_quiz_data.js) — ОДНИМ eval: const/let верхнего уровня
// в отдельных eval не видны друг другу (на тестах давало ложное «PARTS is not defined»). CDN-скрипты (MathJax) пропускаются.
const code=[...w.document.querySelectorAll('script')].map(s=>{
  const u=s.getAttribute('src'); if(!u) return s.textContent;
  if(/^https?:/i.test(u)) return '';
  const p=path.join(path.dirname(f),u); if(fs.existsSync(p)) return fs.readFileSync(p,'utf8');
  errs.push('missing script '+u); return '';
}).join('\n;\n');
try{ w.eval(code); }catch(e){ errs.push('THROW '+e.message); }
// часть старых страниц создаёт графики в обработчике DOMContentLoaded — в jsdom он уже прошёл, вызываем вручную
for(const ev of ['DOMContentLoaded','load']){ try{ (ev==='load'?w:w.document).dispatchEvent(new w.Event(ev,{bubbles:ev==='DOMContentLoaded'})); }catch(e){ errs.push('THROW '+ev+' '+e.message); } }
const all=[...w.document.querySelectorAll('canvas')];
report.charts=all.filter(c=>w.Chart && w.Chart.getChart(c)).length+' / '+all.filter(c=>c.id.startsWith('c_')).length;
report.canvasNoChart=canv.filter(id=>{ const c=w.document.getElementById(id); return !(c && w.Chart && w.Chart.getChart(c)); });
report.errors=errs.slice(0,20);
console.log(JSON.stringify(report,null,2));
const bad=report.htmlEnd!==1||report.divOpen!==report.divClose||report.texErrors||report.canvasNoChart.length||errs.length;
process.exit(bad?2:0);
