// Иконки и заставка приложения из app/resources/icon-{foreground,background}.svg (рисуются Chrome через playwright-core).
//   node scripts/gen-icons.js
// Android: адаптивная иконка (фон + рисунок + монохромная для тематических иконок Android 13+),
//          старые ic_launcher/ic_launcher_round, splash.png всех плотностей.
// Web (PWA): favicon.svg, icons/icon-192/512, maskable-512, apple-touch-icon.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'app/resources');
const RES = path.join(ROOT, 'app/android/app/src/main/res');
const PUB = path.join(ROOT, 'app/public');
const BG_COLOR = '#0b1120';

const fgSvg = fs.readFileSync(path.join(SRC, 'icon-foreground.svg'), 'utf8');
const bgSvg = fs.readFileSync(path.join(SRC, 'icon-background.svg'), 'utf8');
const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
// рисунок без свечения и одним цветом — для монохромной (тематической) иконки
const mono = fgSvg.replace(/url\(#ln\)/g, '#fff').replace(/fill="#[0-9a-f]{6}"/gi, 'fill="#fff"').replace(/stroke="#[0-9a-f]{6}"/gi, 'stroke="#fff"').replace(/ filter="url\(#glow\)"/g, '');
// полная иконка 108x108: фон + рисунок; crop — видимая часть (адаптивная иконка показывает центр 72 из 108)
const full = (crop = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop} ${crop} ${108 - 2 * crop} ${108 - 2 * crop}">${inner(bgSvg)}${inner(fgSvg)}</svg>`;

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function render(page, svg, w, h, file, { radius = 0, bg = null } = {}) {
  await page.setViewportSize({ width: w, height: h });
  const s = Math.min(w, h);
  const img = svg.replace('<svg ', `<svg width="${s}" height="${s}" `);
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${bg || 'transparent'}">
    <div style="width:${s}px;height:${s}px;border-radius:${radius};overflow:hidden">${img}</div></body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: !bg, clip: { x: 0, y: 0, width: w, height: h } });
}

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  const made = [];
  for (const [d, k] of Object.entries(DENS)) {
    const dir = path.join(RES, `mipmap-${d}`);
    const a = Math.round(108 * k); // слой адаптивной иконки: 108dp
    await render(p, fgSvg, a, a, path.join(dir, 'ic_launcher_foreground.png'));
    await render(p, bgSvg, a, a, path.join(dir, 'ic_launcher_background.png'));
    await render(p, mono, a, a, path.join(dir, 'ic_launcher_monochrome.png'));
    const l = Math.round(48 * k); // старая иконка: 48dp
    await render(p, full(18), l, l, path.join(dir, 'ic_launcher.png'), { radius: '22%' });
    await render(p, full(18), l, l, path.join(dir, 'ic_launcher_round.png'), { radius: '50%' });
    made.push(`mipmap-${d}`);
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', f), adaptive);
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG_COLOR}</color>\n</resources>\n`);

  // заставка (Android < 12 рисует splash.png на весь экран): тёмный фон, иконка по центру — треть короткой стороны
  for (const dir of fs.readdirSync(RES).filter((x) => x.startsWith('drawable'))) {
    const f = path.join(RES, dir, 'splash.png');
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    const s = Math.round(Math.min(w, h) / 3);
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${BG_COLOR}">
      <div style="width:${s}px;height:${s}px;border-radius:22%;overflow:hidden">${full(18).replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`);
    await p.screenshot({ path: f });
    made.push(`${dir}/splash.png ${w}x${h}`);
  }

  // web
  fs.writeFileSync(path.join(PUB, 'favicon.svg'), full(18).replace('<svg ', '<svg ').replace(/viewBox="18 18 72 72">/, 'viewBox="18 18 72 72"><clipPath id="r"><rect x="18" y="18" width="72" height="72" rx="16"/></clipPath><g clip-path="url(#r)">').replace(/<\/svg>$/, '</g></svg>'));
  await render(p, full(18), 192, 192, path.join(PUB, 'icons/icon-192.png'), { radius: '22%' });
  await render(p, full(18), 512, 512, path.join(PUB, 'icons/icon-512.png'), { radius: '22%' });
  await render(p, full(10), 512, 512, path.join(PUB, 'icons/maskable-512.png'));
  await render(p, full(14), 180, 180, path.join(PUB, 'icons/apple-touch-icon.png'));
  made.push('web: favicon.svg, icons/*');
  await b.close();
  console.log(made.join('\n'));
})();
