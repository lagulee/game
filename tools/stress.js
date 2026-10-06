// =============================================================
// tools/stress.js : 폭주 확인 (총알이 끝없이 늘어나 게임이 느려지지 않는지)
// -------------------------------------------------------------
// 디버그로 "3방향 탄 Lv.3 + 프랙털 탄 + 핵분열 Lv.3 + 임계 초과 + 발열 반응 Lv.3 + 폭발 연쇄" 를 만들고
// 29웨이브에서 30초 동안 돌린다 (무적, 업그레이드 (30,30) = 적이 잘 죽어서 연쇄가 가장 많이 일어나는 경우). 그동안
//   - 화면의 총알 수 · 핵분열 파편 수 · 프랙털 총알 수 · 적 수의 최댓값
//   - 한 프레임 계산 시간 (update 만 / update + draw) 의 최댓값 · 평균 · 상위 1%
// 를 잰다. 기준: 한 프레임 8ms (60fps 의 한 프레임 16.7ms 의 절반)
// 비교를 위해 같은 증강을 돌연변이 없이 (같은 씨앗) 도 돌린다.
// ※ 헤드리스 브라우저는 그림을 GPU 없이 그려서, 증강이 없어도 가끔 (약 1~2% 프레임) draw 가 수백 ms 걸린다.
//   그래서 "계산 시간" 은 update 로 판단하고, update+draw 는 참고로만 본다.
//
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/stress.js            씨앗 3개
//   NODE_PATH=$(npm root -g) node tools/stress.js --seeds 5 --set FISSION_MAX_FRAGMENTS=30
// =============================================================

const { chromium } = require("playwright");
const path = require("path");
const { startServer } = require("./serve.js");

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const SEEDS = Number(args.seeds || 3);
const SECONDS = Number(args.seconds || 30);
const WAVE = Number(args.wave || 29);
const LEVEL = Number(args.level || 30);   // 업그레이드 (체력, 공격력) 레벨
const OVERRIDES = {};
if (args.set) for (const pair of args.set.split(",")) { const [k, v] = pair.split("="); OVERRIDES[k] = v; }

// 브라우저 안: 고정 시드 난수, 게임 루프 멈춤, 가짜 저장소
function initScript() {
  let seed = 1;
  Math.random = function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  window.__reseed = (s) => { seed = s; };
  window.requestAnimationFrame = () => 0;
  const box = {};
  Object.defineProperty(window, "localStorage", { value: { getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); }, removeItem: (k) => { delete box[k]; }, clear: () => {} }, configurable: true });
}

// 브라우저 안: 한 판 (씨앗 하나)
function runOnce(opts) {
  __reseed(opts.seed);
  saveData.upgrades = { vitality: opts.level, power: opts.level };
  startGame();
  debugMode = true; debugInvincible = true;
  ownedAugments = { multiShot: 3, fission: 3, exothermic: 3 };
  mutatedAugments = opts.mutated ? { multiShot: true, fission: true, exothermic: true } : {};
  startWave(opts.wave);
  const DT = 1 / 60;
  const frames = Math.round(opts.seconds / DT);
  const upd = [], full = [];
  let maxBullets = 0, maxFragments = 0, maxFractal = 0, maxEnemies = 0, kills = 0, waves = 0;
  const score0 = score;
  for (let f = 0; f < frames; f++) {
    // 웨이브를 깨면 카드는 고르지 않고 같은 웨이브를 다시 (계속 29웨이브의 적으로 시험)
    if (gameState === "choosing") { startWave(opts.wave); waves++; }
    const t0 = performance.now();
    update(DT);
    const t1 = performance.now();
    draw();
    const t2 = performance.now();
    upd.push(t1 - t0); full.push(t2 - t0);
    maxBullets = Math.max(maxBullets, bullets.length);
    let frag = 0, frac = 0;
    for (const b of bullets) { if (b.isFragment) frag++; if (b.isFractal) frac++; }
    maxFragments = Math.max(maxFragments, frag);
    maxFractal = Math.max(maxFractal, frac);
    maxEnemies = Math.max(maxEnemies, enemies.length);
  }
  const stat = (a) => {
    const s = a.slice().sort((x, y) => x - y);
    return { max: s[s.length - 1], avg: a.reduce((x, y) => x + y, 0) / a.length, p99: s[Math.floor(s.length * 0.99)] };
  };
  debugMode = false; debugInvincible = false;
  return { maxBullets, maxFragments, maxFractal, maxEnemies, update: stat(upd), full: stat(full), wavesCleared: waves, score: score - score0 };
}

(async () => {
  const server = await startServer(path.resolve(__dirname, ".."));
  server.setOverrides(OVERRIDES);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(initScript);
  await page.goto(server.url + "index.html");
  console.log("폭주 확인: " + WAVE + "웨이브, " + SECONDS + "초, 업그레이드 (" + LEVEL + "," + LEVEL + "), 씨앗 " + SEEDS + "개, 바꾼 상수 " + (Object.keys(OVERRIDES).length ? JSON.stringify(OVERRIDES) : "없음"));
  console.log("조합: 3방향 탄 Lv.3 · 핵분열 연쇄 Lv.3 · 발열 반응 Lv.3 (돌연변이: 프랙털 탄 · 임계 초과 · 폭발 연쇄)");
  console.log("돌연변이 | 씨앗 | 최대 총알 | 최대 파편 | 최대 프랙털 | 최대 적 | update 최대/평균/상위1% (ms) | update+draw 최대/평균/상위1% (ms) | 깬 웨이브");
  const all = [];
  // 첫 판은 브라우저가 코드를 데우는 중이라 느릴 수 있어 한 번 미리 돌린다
  await page.evaluate(runOnce, { seed: 999, wave: WAVE, seconds: 3, level: LEVEL, mutated: true });
  for (const mutated of [false, true]) {
    for (let s = 1; s <= SEEDS; s++) {
      const r = await page.evaluate(runOnce, { seed: s, wave: WAVE, seconds: SECONDS, level: LEVEL, mutated: mutated });
      r.mutated = mutated;
      all.push(r);
      const f = (x) => x.max.toFixed(2) + " / " + x.avg.toFixed(2) + " / " + x.p99.toFixed(2);
      console.log((mutated ? "있음" : "없음") + " | " + s + " | " + r.maxBullets + " | " + r.maxFragments + " | " + r.maxFractal + " | " + r.maxEnemies + " | " + f(r.update) + " | " + f(r.full) + " | " + r.wavesCleared);
    }
  }
  const mut = all.filter((r) => r.mutated);
  const worst = Math.max(...mut.map((r) => r.update.max)), worstFull = Math.max(...mut.map((r) => r.full.max));
  console.log("돌연변이 있음, 가장 느린 프레임: update " + worst.toFixed(2) + "ms (기준 8ms → " + (worst > 8 ? "넘음" : "안 넘음") + "), update+draw " + worstFull.toFixed(2) + "ms (그림은 참고)");
  console.log("최대 총알 " + Math.max(...mut.map((r) => r.maxBullets)) + ", 최대 파편 " + Math.max(...mut.map((r) => r.maxFragments)) + ", 최대 프랙털 " + Math.max(...mut.map((r) => r.maxFractal)));
  if (errors.length) console.log("페이지 오류: " + errors.slice(0, 3).join(" / "));
  console.log("JSON " + JSON.stringify(all));
  await browser.close();
  server.close();
})();
