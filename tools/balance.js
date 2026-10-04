// =============================================================
// tools/balance.js : 자동 플레이 봇으로 밸런스(난이도 곡선)를 측정한다
// -------------------------------------------------------------
// 봇 규칙
//   - 이동: 가장 가까운 적에게서 멀어지는 방향. 벽에 막히면 벽 쪽 성분을 빼고,
//           그래도 거의 못 움직이면 경기장 가운데를 중심으로 빙글 돈다(벽을 따라 돎)
//   - 카드: 무작위로 고른다
//   - 화면 없이 update(1/60) 을 직접 불러 실제 시간보다 훨씬 빠르게 돌린다
//
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/balance.js
//   NODE_PATH=$(npm root -g) node tools/balance.js --runs 20 --levels 0,5,10,15,20,25,30
//   상수를 바꿔서 시험: --hp-base 2 --hp-growth 0.12 --dmg-base 1.5 --dmg-growth 0.05 --speed-base 1.15
//   (상수를 주면 게임 파일은 그대로 두고, 측정할 때만 바꿔 끼운다)
// =============================================================

const { chromium } = require("playwright");
const path = require("path");

// 명령줄 인자 읽기 ("--이름 값" 꼴)
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const RUNS = Number(args.runs || 20);
const LEVELS = (args.levels || "0,5,10,15,20,25,30").split(",").map(Number);
const OVERRIDE = {
  hpBase: args["hp-base"], hpGrowth: args["hp-growth"],
  dmgBase: args["dmg-base"], dmgGrowth: args["dmg-growth"], speedBase: args["speed-base"],
};

// ---- 브라우저 안에서 돌릴 준비 코드: 가짜 저장소, 고정 시드 난수, 게임 루프 멈춤 ----
function initScript() {
  let seed = 1;
  Math.random = function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  window.__reseed = (s) => { seed = s >>> 0; };
  window.requestAnimationFrame = () => 0;
  const box = {};
  Object.defineProperty(window, "localStorage", { value: {
    getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); },
    removeItem: (k) => { delete box[k]; }, clear: () => {},
  }, configurable: true });
}

// ---- 브라우저 안에서 한 레벨을 RUNS 판 돌리는 함수 ----
function runLevel(opts) {
  // 상수 바꿔 끼우기 (주어진 것만)
  const o = opts.override;
  const num = (v, d) => (v === undefined ? d : Number(v));
  const HB = num(o.hpBase, ENEMY_HP_BASE), HG = num(o.hpGrowth, ENEMY_HP_GROWTH);
  const DB = num(o.dmgBase, ENEMY_DMG_BASE), DG = num(o.dmgGrowth, ENEMY_DMG_GROWTH);
  const SB = num(o.speedBase, ENEMY_SPEED_BASE);
  window.waveHpMult = (w) => HB * (1 + HG * (w - 1));
  window.waveDamageMult = (w) => DB * (1 + DG * (w - 1));
  window.waveSpeedMult = (w) => Math.min(ENEMY_SPEED_MAX_MULT, SB * (1 + ENEMY_SPEED_STEP * (w - 1)));

  const keyList = ["KeyW", "KeyA", "KeyS", "KeyD"];
  const MARGIN = 70;                 // 벽에서 이만큼 안쪽부터 "벽에 붙었다"고 본다
  const CX = CANVAS_WIDTH / 2, CY = CANVAS_HEIGHT / 2;

  // 봇이 이번 프레임에 누를 키를 정한다
  function botKeys() {
    let near = null, nd = Infinity;
    for (const e of enemies) {
      const d = distance(player.x, player.y, e.x, e.y);
      if (d < nd) { nd = d; near = e; }
    }
    // 1) 가장 가까운 적에게서 멀어지는 방향 (적이 없으면 가운데로)
    let mx, my;
    if (near) { mx = player.x - near.x; my = player.y - near.y; } else { mx = CX - player.x; my = CY - player.y; }
    let len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
    // 2) 벽에 막힌 방향 성분은 뺀다
    const clip = () => {
      if (player.x < MARGIN && mx < 0) mx = 0;
      if (player.x > CANVAS_WIDTH - MARGIN && mx > 0) mx = 0;
      if (player.y < MARGIN && my < 0) my = 0;
      if (player.y > CANVAS_HEIGHT - MARGIN && my > 0) my = 0;
    };
    clip();
    // 3) 거의 못 움직이면 가운데를 중심으로 시계 방향으로 돈다 (벽을 따라 돌기)
    if (Math.hypot(mx, my) < 0.35) {
      const tx = CX - player.x, ty = CY - player.y;
      mx = -ty; my = tx;                       // 가운데 방향을 90° 돌린 방향
      len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
      clip();
      if (Math.hypot(mx, my) < 0.2) { mx = tx; my = ty; } // 그래도 막히면 가운데로
    }
    // 4) 8방향 키로 바꾼다
    for (const k of keyList) keys[k] = false;
    if (mx > 0.38) keys.KeyD = true;
    if (mx < -0.38) keys.KeyA = true;
    if (my > 0.38) keys.KeyS = true;
    if (my < -0.38) keys.KeyW = true;
  }

  const results = [];
  for (let run = 0; run < opts.runs; run++) {
    __reseed(1000 + run * 7919 + opts.level * 104729);
    saveData = defaultSave();
    saveData.upgrades = { vitality: opts.level, power: opts.level };
    runMenuAction(0);
    let frames = 0;
    const MAX_FRAMES = 60 * 60 * 60; // 게임 시간 1시간이면 멈춤 (안전장치)
    while (gameState !== "gameover" && gameState !== "clear" && frames < MAX_FRAMES) {
      if (gameState === "choosing") {
        choosingTime = 1;
        chooseAugment(Math.floor(Math.random() * choices.length));
        continue;
      }
      botKeys();
      update(1 / 60);
      frames++;
    }
    results.push({ wave: wave, clear: gameState === "clear", coins: lastRunCoins, time: runTime, cards: wave - 1 });
  }
  return results;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(initScript);
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));

  const rows = [];
  console.log("레벨(체력,공격력) | 평균 웨이브 | 최소 | 최대 | 클리어 | 평균 코인 | 평균 생존 시간");
  for (const level of LEVELS) {
    const started = Date.now();
    const r = await page.evaluate(runLevel, { level: level, runs: RUNS, override: OVERRIDE });
    const waves = r.map((x) => x.wave);
    const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const row = {
      level: level, avgWave: avg(waves), min: Math.min(...waves), max: Math.max(...waves),
      clears: r.filter((x) => x.clear).length, avgCoins: avg(r.map((x) => x.coins)), avgTime: avg(r.map((x) => x.time)),
      avgCards: avg(r.map((x) => x.cards)),
    };
    rows.push(row);
    console.log("(" + level + "," + level + ") | " + row.avgWave.toFixed(1) + " | " + row.min + " | " + row.max + " | " +
      row.clears + "/" + RUNS + " | " + row.avgCoins.toFixed(0) + " | " + (row.avgTime / 60).toFixed(1) + "분" +
      "   (측정 " + ((Date.now() - started) / 1000).toFixed(0) + "초)");
  }
  if (errors.length) console.log("페이지 오류: " + errors.slice(0, 3).join(" / "));
  console.log("JSON " + JSON.stringify(rows));
  await browser.close();
})();
