// Сборка темы курса: исходник content-src/*.src.html -> готовый HTML в content-legacy/ (или путь вторым аргументом).
// <tex>...</tex> — формула в строке, <texd>...</texd> — формула отдельным блоком (LaTeX, рендер KaTeX на этапе сборки).
// <!--KATEX_CSS--> — сюда встраивается CSS KaTeX со шрифтами (base64), <!--CHARTJS--> — встроенный Chart.js.
// Запуск: node tools/build.js content-src/block0_01_expectation_variance.src.html [out.html] [--app]
// --app — режим приложения: вместо встраивания ссылки на общие ../assets/katex/katex.min.css и ../assets/chart.umd.js
const fs=require('fs'), path=require('path');
const V=path.join(__dirname,'vendor');
const katex=require(path.join(V,'katex.min.js'));
const args=process.argv.slice(2), app=args.includes('--app'), pos=args.filter(a=>a!=='--app');
const src=pos[0]; if(!src){console.error('usage: node build.js <src> [out] [--app]');process.exit(1);}
const out=pos[1]||path.join(__dirname,'..','content-legacy',path.basename(src).replace('.src.html','.html'));
let s=fs.readFileSync(src,'utf8'); let n=0, errs=[];
const macros={'\\E':'\\mathbb{E}','\\Var':'\\operatorname{Var}','\\Cov':'\\operatorname{Cov}','\\P':'\\mathrm{P}'};
function R(tex,disp){ try{ n++; return katex.renderToString(tex.trim(),{displayMode:disp,throwOnError:true,output:'html',macros:Object.assign({},macros),strict:false}); }catch(e){ errs.push((disp?'texd':'tex')+': '+tex.trim().slice(0,80)+' -> '+e.message); return '<span style="color:#f87171">[TeX error]</span>'; } }
// Блочная формула с переносом строк. KaTeX в displayMode не переносит, и на телефоне длинные формулы обрезались.
// Делим TeX на верхнем уровне (вне {}, (), [], \left..\right, \begin..\end): по \qquad/\quad (разные формулы
// в одной строке) и перед отношениями (=, \le, \Rightarrow, ...). Части рендерятся по отдельности с \displaystyle
// и встают во flex-wrap: на широком экране — одна строка, как раньше; на узком — перенос, продолжение со знака.
// Формула целиком в одной среде gathered — каждая её строка отдельно. Если часть не рендерится — откат к целой формуле.
const RELS=['=','<','>','\\le','\\ge','\\leq','\\geq','\\ne','\\neq','\\approx','\\sim','\\propto','\\equiv','\\to','\\Rightarrow','\\Leftarrow','\\iff','\\Longleftrightarrow','\\Longrightarrow','\\implies','\\xrightarrow'];
function splitTop(tex){
  const parts=[]; let cur='', depth=0, i=0, kind='start';
  const push=(k)=>{ if(cur.trim()) { parts.push({tex:cur,kind}); kind=k; } else if(k!=='rel') kind=k; cur=''; };
  while(i<tex.length){
    const rest=tex.slice(i);
    const cmd=/^\\[a-zA-Z]+/.exec(rest);
    if(cmd){
      const c=cmd[0];
      if(c==='\\begin'||c==='\\left') depth++;
      else if(c==='\\end'||c==='\\right') depth--;
      if(depth===0 && (c==='\\qquad'||c==='\\quad')){ push(c==='\\qquad'?'wide':'gap'); i+=c.length; continue; }
      if(depth===0 && RELS.includes(c) && cur.trim()){ push('rel'); kind='rel'; }
      cur+=c; i+=c.length;
      if(c==='\\left'||c==='\\right'){ const d=/^\\[{}|]|^\\[a-zA-Z]+|^./.exec(tex.slice(i)); if(d){ cur+=d[0]; i+=d[0].length; } }
      continue;
    }
    const ch=tex[i];
    if(ch==='\\'){ cur+=tex.slice(i,i+2); i+=2; continue; } // \{ \} \, \; \\ и т.п.
    if('{(['.includes(ch)) depth++;
    else if('})]'.includes(ch)) depth--;
    if(depth===0 && RELS.includes(ch) && cur.trim()){ push('rel'); kind='rel'; }
    cur+=ch; i++;
  }
  push('end');
  return parts;
}
function RD(tex){
  const t=tex.trim();
  const g=/^\\begin\{gathered\}([\s\S]*)\\end\{gathered\}$/.exec(t);
  const rows=(g && !/\\begin\{gathered\}/.test(g[1])) ? g[1].split(/\\\\/).map(r=>r.trim()).filter(Boolean) : [t];
  try{
    const html=rows.map(r=>{
      const parts=splitTop(r);
      return '<div class="tx-row">'+parts.map(p=>'<span class="tx-p'+(p.kind==='rel'?' tx-rel':p.kind==='wide'?' tx-wide':p.kind==='gap'?' tx-gap':'')+'">'+
        katex.renderToString('\\displaystyle '+p.tex.trim(),{displayMode:false,throwOnError:true,output:'html',macros:Object.assign({},macros),strict:false})+'</span>').join('')+'</div>';
    }).join('');
    n++; return '<div class="tx-d tx-w">'+html+'</div>';
  }catch(e){ return '<div class="tx-d">'+R(t,true)+'</div>'; }
}
const TXW_CSS='<style>/* build.js: блочные формулы с переносом */.tx-w{display:flex;flex-direction:column;align-items:center;gap:.3em;margin:.35em 0}.tx-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;row-gap:.35em;max-width:100%}.tx-p{white-space:nowrap}.tx-rel{margin-left:.2778em}.tx-gap{margin-left:1em}.tx-wide{margin-left:2em}@media (max-width:600px){.fbox .katex{font-size:1.12em}.tx-wide{margin-left:1.2em}}</style>';
s=s.replace(/<texd>([\s\S]*?)<\/texd>/g,(m,t)=>RD(t));
s=s.replace('</head>',TXW_CSS+'\n</head>');
s=s.replace(/<tex>([\s\S]*?)<\/tex>/g,(m,t)=>R(t,false));
let css=fs.readFileSync(path.join(V,'katex.min.css'),'utf8');
css=css.replace(/url\(fonts\/([^)]+?\.woff2)\)\s*format\("woff2"\)/g,(m,f)=>'url(data:font/woff2;base64,'+fs.readFileSync(path.join(V,'fonts',f)).toString('base64')+') format("woff2")');
css=css.replace(/,\s*url\(fonts\/[^)]+?\.(woff|ttf)\)\s*format\("(woff|truetype)"\)/g,'');
if(app){
  s=s.replace('<!--KATEX_CSS-->','<link rel="stylesheet" href="../assets/katex/katex.min.css">');
  s=s.replace('<!--CHARTJS-->','<script src="../assets/chart.umd.js"></script>');
}
s=s.replace('<!--KATEX_CSS-->','<style>'+css+'</style>');
s=s.replace('<!--CHARTJS-->','<script>/* Chart.js 4.4.1 (MIT), встроен */\n'+fs.readFileSync(path.join(V,'chart.umd.js'),'utf8').replace(/<\/script/g,'<\\/script')+'\n</script>');
fs.writeFileSync(out,s);
console.log('formulas:',n,'errors:',errs.length,'->',out,(s.length/1024).toFixed(0)+'KB'); errs.forEach(e=>console.log('  '+e));
if(errs.length) process.exit(2);
