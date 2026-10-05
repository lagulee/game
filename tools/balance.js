// =============================================================
// tools/balance.js : 자동 플레이 봇으로 밸런스(난이도 곡선)를 측정한다
// -------------------------------------------------------------
// 봇 두 가지 (--bot 으로 고른다)
//   new (기본, 사람처럼 카이팅)
//     - 경기장 가운데를 크게 타원을 그리며 돈다 (사람이 흔히 하는 "빙글빙글 돌며 쏘기")
//     - 도는 방향은 적들의 무게중심에서 멀어지는 쪽으로 고른다 (앞이 막히면 반대로 돈다)
//     - 가까운 적일수록 강하게 피한다
//     - 돌격형·돌진 대장의 예고선(돌진할 직선) 안에 있으면 선 밖으로 옆걸음
//     - 벽 가까이 가면 안쪽으로 밀려나서 구석에 몰리지 않는다
//   old (예전 봇)
//     - 가장 가까운 적에게서 멀어지고, 벽에 막히면 가운데를 중심으로 돈다
//   공통: 카드는 무작위, 화면 없이 update(1/60) 을 직접 불러 실제보다 훨씬 빠르게 돌린다
//
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/balance.js
//   NODE_PATH=$(npm root -g) node tools/balance.js --runs 30 --levels 0,3,6,10 --bot old
//   상수를 바꿔서 시험: --set ENEMY_HP_GROWTH=0.1,WAVE_SPAWN_BATCH=2
//   압박 규칙 이전 값으로 시험: --preset before-pressure
//   (게임 파일은 그대로 두고, 측정할 때만 파일 글자를 바꿔 끼운다 → tools/serve.js)
//   레벨들은 브라우저 탭 여러 개에서 동시에 돌린다 (--parallel 4)
// =============================================================

const { chromium } = require("playwright");
const path = require("path");
const { startServer } = require("./serve.js");

// 명령줄 인자 읽기 ("--이름 값" 꼴)
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const RUNS = Number(args.runs || 30);
const LEVELS = (args.levels || "0,3,6,10,15,20,25,30").split(",").map(Number);
const BOT = args.bot || "new";
const PARALLEL = Number(args.parallel || 4);

// 압박 규칙 이전 값 (tools/regress.js 의 BEFORE_PRESSURE 와 같다)
const PRESETS = {
  "before-pressure": {
    ENEMY_SPEED_BASE: 1.15, ENEMY_SPEED_MAX_MULT: 1.8,
    WAVE_SPAWN_INTERVAL: 0.8, WAVE_SPAWN_BATCH: 1, WAVE_COUNT_MULT: 1,
    ENRAGE_TIME: "Infinity", PLAYER_INVINCIBLE_TIME: 1.0, WAVE_CLEAR_HEAL_RATIO: 0.1,
    ENEMY_HP_GROWTH: 0.12, ENEMY_DMG_GROWTH: 0.05, COIN_PER_SECOND: 1,
  },
};
const OVERRIDES = Object.assign({}, PRESETS[args.preset] || {});
if (args.set) {
  for (const pair of args.set.split(",")) {
    const [k, v] = pair.split("=");
    OVERRIDES[k] = v;
  }
}

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
  const keyList = ["KeyW", "KeyA", "KeyS", "KeyD"];
  const CX = CANVAS_WIDTH / 2, CY = CANVAS_HEIGHT / 2;

  // (x, y) 방향을 8방향 키로 바꾼다
  function pressDir(mx, my) {
    for (const k of keyList) keys[k] = false;
    const len = Math.hypot(mx, my);
    if (len < 1e-6) return;
    mx /= len; my /= len;
    if (mx > 0.38) keys.KeyD = true;
    if (mx < -0.38) keys.KeyA = true;
    if (my > 0.38) keys.KeyS = true;
    if (my < -0.38) keys.KeyW = true;
  }

  // ---- 예전 봇: 가장 가까운 적에게서 멀어지기 + 벽에서 돌기 ----
  const MARGIN = 70;
  function oldBot() {
    let near = null, nd = Infinity;
    for (const e of enemies) {
      const d = distance(player.x, player.y, e.x, e.y);
      if (d < nd) { nd = d; near = e; }
    }
    let mx, my;
    if (near) { mx = player.x - near.x; my = player.y - near.y; } else { mx = CX - player.x; my = CY - player.y; }
    let len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
    const clip = () => {
      if (player.x < MARGIN && mx < 0) mx = 0;
      if (player.x > CANVAS_WIDTH - MARGIN && mx > 0) mx = 0;
      if (player.y < MARGIN && my < 0) my = 0;
      if (player.y > CANVAS_HEIGHT - MARGIN && my > 0) my = 0;
    };
    clip();
    if (Math.hypot(mx, my) < 0.35) {
      const tx = CX - player.x, ty = CY - player.y;
      mx = -ty; my = tx;
      len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
      clip();
      if (Math.hypot(mx, my) < 0.2) { mx = tx; my = ty; }
    }
    pressDir(mx, my);
  }

  // ---- 새 봇: 타원 궤도를 돌며 카이팅 ----
  const ORBIT_RX = 300, ORBIT_RY = 165;  // 도는 타원의 가로·세로 반지름 (경기장 960×540 안쪽)
  const DANGER = 200;                    // 이 거리 안의 적은 피한다
  const WALL = 85;                       // 벽에서 이 거리 안이면 안쪽으로 밀려난다
  let orbitDir = 1;                      // 1 = 시계 방향, -1 = 반시계 방향
  let flipCooldown = 0;                  // 방향을 너무 자주 바꾸지 않게 (초)
  function newBot(dt) {
    flipCooldown = Math.max(0, flipCooldown - dt);
    const dx = player.x - CX, dy = player.y - CY;
    // 타원 좌표로 바꿔서: r = 1 이면 궤도 위
    const nx = dx / ORBIT_RX, ny = dy / ORBIT_RY;
    const r = Math.hypot(nx, ny) || 1e-6;
    // 궤도의 접선 방향 (타원 위에서 orbitDir 쪽으로 도는 방향)
    let tx = -ny * ORBIT_RX * orbitDir, ty = nx * ORBIT_RY * orbitDir;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    // 궤도 안팎을 바로잡는 방향 (바깥이면 안으로, 안쪽이면 밖으로)
    let ox = nx / ORBIT_RX, oy = ny / ORBIT_RY;
    const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
    const radial = Math.max(-1, Math.min(1, (1 - r) * 2.5));
    let fx = tx + ox * radial, fy = ty + oy * radial;

    // 가까운 적 피하기 + 앞쪽(도는 방향)에 적이 몰려 있으면 반대로 돌기
    let aheadThreat = 0;
    for (const e of enemies) {
      const ex = player.x - e.x, ey = player.y - e.y;
      const d = Math.hypot(ex, ey) || 1;
      const reach = DANGER + e.radius;
      if (d < reach) {
        const w = Math.pow(1 - d / reach, 2) * 4;
        fx += (ex / d) * w; fy += (ey / d) * w;
        // 적이 내가 가는 쪽 앞에 있는지 (접선과 적 방향의 내적)
        const ahead = (-ex / d) * tx + (-ey / d) * ty;
        if (ahead > 0.3) aheadThreat += (1 - d / reach) * ahead;
      }
      // 돌격형·돌진 대장: 예고 중이거나 돌진 중이면 그 직선 밖으로 피한다
      if (e.state === "warn" || e.state === "dash") {
        const px = player.x - e.x, py = player.y - e.y;
        const t = px * e.dirX + py * e.dirY;              // 돌진 방향으로 얼마나 앞에 있는지
        if (t > -20 && t < 700) {
          const lateral = px * -e.dirY + py * e.dirX;     // 직선에서 옆으로 떨어진 거리 (부호 = 어느 쪽)
          const safe = e.radius + PLAYER_RADIUS + 40;
          if (Math.abs(lateral) < safe) {
            const side = lateral >= 0 ? 1 : -1;
            const w = 6 * (1 - Math.abs(lateral) / safe) + 2;
            fx += -e.dirY * side * w; fy += e.dirX * side * w;
          }
        }
      }
    }
    if (aheadThreat > 0.8 && flipCooldown <= 0) { orbitDir = -orbitDir; flipCooldown = 1.2; }

    // 벽에서 밀려나기 (구석에 몰리지 않게)
    const push = (dist) => (dist < WALL ? Math.pow(1 - dist / WALL, 2) * 5 : 0);
    fx += push(player.x) - push(CANVAS_WIDTH - player.x);
    fy += push(player.y) - push(CANVAS_HEIGHT - player.y);

    // 벽에 붙어 있으면 벽 쪽으로 미는 성분은 뺀다 (벽을 미는 건 제자리걸음)
    const STUCK = 45;
    if (player.x < STUCK && fx < 0) fx = 0;
    if (player.x > CANVAS_WIDTH - STUCK && fx > 0) fx = 0;
    if (player.y < STUCK && fy < 0) fy = 0;
    if (player.y > CANVAS_HEIGHT - STUCK && fy > 0) fy = 0;
    // 그래도 거의 못 움직이면: 벽을 따라 가까운 적의 반대쪽으로 미끄러지며 빠져나간다
    if (Math.hypot(fx, fy) < 0.6) {
      let near = null, nd = Infinity;
      for (const e of enemies) { const d = distance(player.x, player.y, e.x, e.y); if (d < nd) { nd = d; near = e; } }
      const awayX = near ? player.x - near.x : CX - player.x, awayY = near ? player.y - near.y : CY - player.y;
      const onSideWall = player.x < STUCK || player.x > CANVAS_WIDTH - STUCK;
      const onTopBottom = player.y < STUCK || player.y > CANVAS_HEIGHT - STUCK;
      // 위·아래 벽이면 가로로, 왼쪽·오른쪽 벽이면 세로로 (구석이면 가운데 쪽으로)
      if (onTopBottom && !onSideWall) { fx = awayX >= 0 ? 1 : -1; fy = (CY - player.y) * 0.004; }
      else if (onSideWall && !onTopBottom) { fy = awayY >= 0 ? 1 : -1; fx = (CX - player.x) * 0.004; }
      else { fx = CX - player.x; fy = CY - player.y; }
    }

    pressDir(fx, fy);
  }

  const results = [];
  for (let run = 0; run < opts.runs; run++) {
    __reseed(1000 + run * 7919 + opts.level * 104729);
    saveData = defaultSave();
    saveData.upgrades = { vitality: opts.level, power: opts.level };
    orbitDir = 1; flipCooldown = 0;
    startGame();
    let frames = 0;
    const MAX_FRAMES = 60 * 60 * 60; // 게임 시간 1시간이면 멈춤 (안전장치)
    while (gameState !== "gameover" && gameState !== "clear" && frames < MAX_FRAMES) {
      if (gameState === "choosing") {
        choosingTime = 1;
        chooseAugment(Math.floor(Math.random() * choices.length));
        continue;
      }
      if (opts.bot === "old") oldBot(); else newBot(1 / 60);
      update(1 / 60);
      frames++;
    }
    results.push({ wave: wave, clear: gameState === "clear", coins: lastRunCoins, time: runTime, cards: wave - 1 });
  }
  return results;
}

(async () => {
  const server = await startServer(path.resolve(__dirname, ".."));
  server.setOverrides(OVERRIDES);
  const browser = await chromium.launch();
  const errors = [];

  console.log("봇: " + BOT + " / 판 수: " + RUNS + " / 바꾼 상수: " + (Object.keys(OVERRIDES).length ? JSON.stringify(OVERRIDES) : "없음"));
  console.log("레벨(체력,공격력) | 평균 웨이브 | 최소 | 최대 | 클리어 | 평균 생존 시간 | 평균 코인 | 최소 코인 | 40코인 이상");
  const rows = new Array(LEVELS.length);
  let next = 0;
  // 탭 하나가 레벨을 하나씩 가져가서 측정하는 일꾼 (PARALLEL 개가 동시에 돈다)
  async function worker() {
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(initScript);
    await page.goto(server.url + "index.html");
    while (next < LEVELS.length) {
      const idx = next++;
      const level = LEVELS[idx];
      const r = await page.evaluate(runLevel, { level: level, runs: RUNS, bot: BOT });
      const waves = r.map((x) => x.wave), coins = r.map((x) => x.coins);
      const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
      rows[idx] = {
        level: level, avgWave: avg(waves), min: Math.min(...waves), max: Math.max(...waves),
        clears: r.filter((x) => x.clear).length, avgTime: avg(r.map((x) => x.time)),
        avgCoins: avg(coins), minCoins: Math.min(...coins), coins40: coins.filter((c) => c >= 40).length,
        avgCards: avg(r.map((x) => x.cards)),
      };
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, LEVELS.length) }, worker));

  for (const row of rows) {
    console.log("(" + row.level + "," + row.level + ") | " + row.avgWave.toFixed(1) + " | " + row.min + " | " + row.max + " | " +
      row.clears + "/" + RUNS + " | " + (row.avgTime / 60).toFixed(1) + "분 | " + row.avgCoins.toFixed(0) + " | " + row.minCoins +
      " | " + row.coins40 + "/" + RUNS);
  }
  if (errors.length) console.log("페이지 오류: " + errors.slice(0, 3).join(" / "));
  console.log("JSON " + JSON.stringify(rows));
  await browser.close();
  server.close();
})();
