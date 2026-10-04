// Прогон tools/check-page.js по всем страницам content-legacy/ (кроме _archive) и сводный отчёт.
// Запуск: node tools/check-all.js [docs/content-report.md]   Код выхода 2, если хоть одна страница с проблемами.
const fs=require('fs'), path=require('path'), {spawnSync}=require('child_process');
const root=path.join(__dirname,'..'), dir=path.join(root,'content-legacy');
const out=process.argv[2]||path.join(root,'docs','content-report.md');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.html')).sort();
const rows=[]; let bad=0;
for(const f of files){
  const r=spawnSync(process.execPath,[path.join(__dirname,'check-page.js'),path.join(dir,f)],{encoding:'utf8',maxBuffer:64<<20});
  let j; try{ j=JSON.parse(r.stdout); }catch(e){ j={crash:(r.stderr||r.stdout||'').trim().split('\n')[0]}; }
  const kb=Math.round(fs.statSync(path.join(dir,f)).size/1024);
  const cdn=/<script src="https?:[^"]*chart[^"]*"/i.test(fs.readFileSync(path.join(dir,f),'utf8'));
  const problems=[];
  if(j.crash) problems.push('падение: '+j.crash);
  else{
    if(j.htmlEnd!==1) problems.push('</html>×'+j.htmlEnd);
    if(j.divOpen!==j.divClose) problems.push('div '+j.divOpen+'/'+j.divClose);
    if(j.texErrors) problems.push('TeX error×'+j.texErrors);
    if(j.canvasNoChart.length) problems.push('график не создан: '+j.canvasNoChart.join(', '));
    if(j.errors.length) problems.push('ошибки JS: '+j.errors.slice(0,3).join(' | ').replace(/\|/g,'¦'));
  }
  if(r.status!==0) bad++;
  rows.push({f,kb,cdn,code:r.status,j,problems});
  process.stdout.write((r.status===0?'ok  ':'BAD ')+f+'\n');
}
const ok=rows.length-bad;
let md='# Отчёт о состоянии контента\n\n';
md+='Сгенерирован `node tools/check-all.js` '+new Date().toISOString().slice(0,10)+'. ';
md+='Проверка: `tools/check-page.js` (jsdom + настоящий Chart.js 4.4.1 + заглушка canvas).\n\n';
md+='**Итого:** '+rows.length+' страниц, без проблем — '+ok+', с проблемами — '+bad+'.\n\n';
md+='Колонки: секции (`id="sN"`), Q&A (`details.qa` + `div.qa`), графики (создано / `canvas#c_*`), CDN — Chart.js грузится с CDN.\n\n';
md+='| Файл | КБ | Секции | Q&A | Графики | CDN | Код | Проблемы |\n|---|--:|--:|--:|---|:-:|:-:|---|\n';
for(const r of rows){
  const j=r.j;
  md+='| '+r.f+' | '+r.kb+' | '+(j.sections??'—')+' | '+(j.qa??'—')+' | '+(j.charts??'—')+' | '+(r.cdn?'да':'')+' | '+r.code+' | '+(r.problems.join('; ')||'')+' |\n';
}
fs.writeFileSync(out,md);
console.log('\n'+ok+'/'+rows.length+' ok -> '+path.relative(root,out));
process.exit(bad?2:0);
