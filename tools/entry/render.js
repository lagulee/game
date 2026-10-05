// =============================================================
// tools/entry/render.js : SVG 그림을 PNG 로 바꾼다 (Playwright 의 Chromium 으로 찍는다)
// -------------------------------------------------------------
// 엔트리 모양 그림은 PNG 로 넣는다 (웹·오프라인 엔트리 모두 잘 읽는다)
// =============================================================

const { chromium } = require("playwright");

// 게임과 같은 글꼴 (Google Fonts). 인터넷이 안 되면 기본 글꼴로 그려진다
const FONTS = '<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=block"></head>';

// items: [{ svg: "<svg ...>", width, height }] → 같은 순서의 PNG Buffer 목록
async function svgToPng(items) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  // 글꼴은 처음에 한 번만 불러 두고, 그림마다 내용만 바꿔 찍는다
  await page.setContent(FONTS + '<body style="margin:0;background:transparent"><div id="art"></div></body></html>', { waitUntil: "networkidle" });
  await page.evaluate(async () => { try { await document.fonts.load("20px Jua"); await document.fonts.load('20px "Black Han Sans"'); } catch (e) {} await document.fonts.ready; });
  const out = [];
  for (const it of items) {
    await page.setViewportSize({ width: it.width, height: it.height });
    await page.evaluate((svg) => { document.getElementById("art").innerHTML = svg; }, it.svg);
    out.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: it.width, height: it.height } }));
  }
  await browser.close();
  return out;
}

module.exports = { svgToPng };
