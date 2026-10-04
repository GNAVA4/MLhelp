// Сборка темы курса: исходник content-src/*.src.html -> готовый HTML в content-legacy/ (или путь вторым аргументом).
// <tex>...</tex> — формула в строке, <texd>...</texd> — формула отдельным блоком (LaTeX, рендер KaTeX на этапе сборки).
// <!--KATEX_CSS--> — сюда встраивается CSS KaTeX со шрифтами (base64), <!--CHARTJS--> — встроенный Chart.js.
// Запуск: node tools/build.js content-src/block0_01_expectation_variance.src.html
const fs=require('fs'), path=require('path');
const V=path.join(__dirname,'vendor');
const katex=require(path.join(V,'katex.min.js'));
const src=process.argv[2]; if(!src){console.error('usage: node build.js <src>');process.exit(1);}
const out=process.argv[3]||path.join(__dirname,'..','content-legacy',path.basename(src).replace('.src.html','.html'));
let s=fs.readFileSync(src,'utf8'); let n=0, errs=[];
const macros={'\\E':'\\mathbb{E}','\\Var':'\\operatorname{Var}','\\Cov':'\\operatorname{Cov}','\\P':'\\mathrm{P}'};
function R(tex,disp){ try{ n++; return katex.renderToString(tex.trim(),{displayMode:disp,throwOnError:true,output:'html',macros:Object.assign({},macros),strict:false}); }catch(e){ errs.push((disp?'texd':'tex')+': '+tex.trim().slice(0,80)+' -> '+e.message); return '<span style="color:#f87171">[TeX error]</span>'; } }
s=s.replace(/<texd>([\s\S]*?)<\/texd>/g,(m,t)=>'<div class="tx-d">'+R(t,true)+'</div>');
s=s.replace(/<tex>([\s\S]*?)<\/tex>/g,(m,t)=>R(t,false));
let css=fs.readFileSync(path.join(V,'katex.min.css'),'utf8');
css=css.replace(/url\(fonts\/([^)]+?\.woff2)\)\s*format\("woff2"\)/g,(m,f)=>'url(data:font/woff2;base64,'+fs.readFileSync(path.join(V,'fonts',f)).toString('base64')+') format("woff2")');
css=css.replace(/,\s*url\(fonts\/[^)]+?\.(woff|ttf)\)\s*format\("(woff|truetype)"\)/g,'');
s=s.replace('<!--KATEX_CSS-->','<style>'+css+'</style>');
s=s.replace('<!--CHARTJS-->','<script>/* Chart.js 4.4.1 (MIT), встроен */\n'+fs.readFileSync(path.join(V,'chart.umd.js'),'utf8').replace(/<\/script/g,'<\\/script')+'\n</script>');
fs.writeFileSync(out,s);
console.log('formulas:',n,'errors:',errs.length,'->',out,(s.length/1024).toFixed(0)+'KB'); errs.forEach(e=>console.log('  '+e));
if(errs.length) process.exit(2);
