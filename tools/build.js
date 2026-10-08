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
// Перенос допустим и перед бинарной операцией верхнего уровня (длинные суммы и произведения), если до неё стоит
// операнд — иначе это унарный знак. Такая часть рендерится с {} впереди, чтобы KaTeX дал знаку бинарные отступы.
const BINS=['+','-','\\cdot','\\times'];
const afterOperand=(cur)=>{ const c=cur.trimEnd(); if(!c) return false; const m=/\\[a-zA-Z]+$/.exec(c); if(m) return !RELS.includes(m[0]) && !BINS.includes(m[0]) && m[0]!=='\\pm'; return !/[=<>(\[{,^_+\-&]$/.test(c); };
const RELS=['=','<','>','\\le','\\ge','\\leq','\\geq','\\ne','\\neq','\\approx','\\sim','\\propto','\\equiv','\\to','\\Rightarrow','\\Leftarrow','\\iff','\\Longleftrightarrow','\\Longrightarrow','\\implies','\\xrightarrow'];
function splitTop(tex){
  const parts=[]; let cur='', depth=0, i=0, kind='start';
  const push=(k)=>{ if(cur.trim()) { parts.push({tex:cur,kind}); kind=k; } else if(k!=='rel'&&k!=='bin') kind=k; cur=''; };
  while(i<tex.length){
    const rest=tex.slice(i);
    const cmd=/^\\[a-zA-Z]+/.exec(rest);
    if(cmd){
      const c=cmd[0];
      if(c==='\\begin'||c==='\\left') depth++;
      else if(c==='\\end'||c==='\\right') depth--;
      if(depth===0 && (c==='\\qquad'||c==='\\quad')){ push(c==='\\qquad'?'wide':'gap'); i+=c.length; continue; }
      if(depth===0 && RELS.includes(c) && cur.trim()){ push('rel'); kind='rel'; }
      else if(depth===0 && BINS.includes(c) && afterOperand(cur)){ push('bin'); kind='bin'; }
      cur+=c; i+=c.length;
      if(c==='\\left'||c==='\\right'){ const d=/^\\[{}|]|^\\[a-zA-Z]+|^./.exec(tex.slice(i)); if(d){ cur+=d[0]; i+=d[0].length; } }
      continue;
    }
    const ch=tex[i];
    if(ch==='\\'){ cur+=tex.slice(i,i+2); i+=2; continue; } // \{ \} \, \; \\ и т.п.
    if('{(['.includes(ch)) depth++;
    else if('})]'.includes(ch)) depth--;
    if(depth===0 && RELS.includes(ch) && cur.trim()){ push('rel'); kind='rel'; }
    else if(depth===0 && BINS.includes(ch) && afterOperand(cur)){ push('bin'); kind='bin'; }
    cur+=ch; i++;
  }
  push('end');
  return parts;
}
// Формула целиком в aligned: на широком экране — как есть (с выравниванием по &), на узком (<=600px) — построчно
// с переносами, без выравнивания. Иначе выравнивание делает строку неделимой и она обрезается на телефоне.
function RD(tex){
  const t=tex.trim();
  const al=/^\\begin\{aligned\}([\s\S]*)\\end\{aligned\}$/.exec(t);
  if(al && !/\\begin\{/.test(al[1])){
    const narrow=RDrows(al[1].split(/\\\\/).map(r=>r.replace(/&/g,' ').trim()).filter(Boolean));
    if(narrow) return '<div class="tx-d tx-al"><div class="tx-alw">'+R(t,true)+'</div><div class="tx-aln">'+narrow+'</div></div>';
  }
  const g=/^\\begin\{gathered\}([\s\S]*)\\end\{gathered\}$/.exec(t);
  const rows=(g && !/\\begin\{gathered\}/.test(g[1])) ? g[1].split(/\\\\/).map(r=>r.trim()).filter(Boolean) : [t];
  const html=RDrows(rows);
  return html ? '<div class="tx-d">'+html+'</div>' : '<div class="tx-d">'+R(t,true)+'</div>';
}
function RDrows(rows){
  try{
    // Перенос по приоритету — вложенные flex-wrap: строка (tx-row) → формулы между \quad/\qquad (tx-ch) →
    // звенья между отношениями (tx-rg) → части между + − · ×. Внутренний уровень переносится, только если
    // элемент внешнего сам шире экрана.
    const html=rows.map(r=>{
      const chunks=[];
      for(const p of splitTop(r)){
        if(!chunks.length||p.kind==='wide'||p.kind==='gap') chunks.push({kind:p.kind,groups:[]});
        const g=chunks[chunks.length-1].groups;
        if(!g.length||p.kind!=='bin') g.push({kind:p.kind,parts:[]});
        g[g.length-1].parts.push(p);
      }
      const P=p=>'<span class="tx-p">'+katex.renderToString('\\displaystyle '+(p.kind==='bin'?'{}':'')+p.tex.trim(),{displayMode:false,throwOnError:true,output:'html',macros:Object.assign({},macros),strict:false})+'</span>';
      return '<div class="tx-row">'+chunks.map(c=>'<span class="tx-ch'+(c.kind==='wide'?' tx-wide':c.kind==='gap'?' tx-gap':'')+'">'+
        c.groups.map(g=>'<span class="tx-rg'+(g.kind==='rel'?' tx-rel':'')+'">'+g.parts.map(P).join('')+'</span>').join('')+'</span>').join('')+'</div>';
    }).join('');
    n++; return '<div class="tx-w">'+html+'</div>';
  }catch(e){ return null; }
}
const TXW_CSS='<style>/* build.js: блочные формулы с переносом */.tx-w{display:flex;flex-direction:column;align-items:center;gap:.3em;margin:.35em 0}.tx-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;row-gap:.35em;max-width:100%}.tx-ch,.tx-rg{display:inline-flex;flex-wrap:wrap;justify-content:center;align-items:baseline;row-gap:.35em;max-width:100%}.tx-p{white-space:nowrap}.tx-rel{margin-left:.2778em}.tx-gap{margin-left:1em}.tx-wide{margin-left:2em}.tx-aln{display:none}@media (max-width:600px){.fbox .katex{font-size:1.12em}.tx-wide{margin-left:1.2em}.tx-al .tx-alw{display:none}.tx-al .tx-aln{display:block}}</style>';
s=s.replace(/<texd>([\s\S]*?)<\/texd>/g,(m,t)=>RD(t));
if(!/<\/head>/i.test(s)) s=s.replace(/<body/i,'</head>\n<body'); // без </head> стили переноса формул терялись (так было в 0.4)
s=s.replace('</head>',TXW_CSS+'\n</head>');
// Таблицы на телефоне (владелец, session 038): широкая таблица вылезала за экран и обрезалась карточкой.
// Каждая таблица — в контейнере со своей горизонтальной прокруткой; на ≤600px ячейки компактнее, чтобы больше помещалось целиком.
// Шпаргалку .ct.cs не трогаем — на телефоне она и так становится карточками.
const TBL_CSS='<style>/* build.js: таблицы с прокруткой */.tbl-x{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}@media (max-width:600px){.tbl-x>.ct:not(.cs) th{padding:8px 8px;letter-spacing:0}.tbl-x>.ct:not(.cs) td{padding:8px 8px}}</style>';
s=s.replace('</head>',TBL_CSS+'\n</head>');
s=s.replace(/<table\b[\s\S]*?<\/table>/g,(m)=>'<div class="tbl-x">'+m+'</div>');
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
