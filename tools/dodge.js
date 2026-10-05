// =============================================================
// tools/dodge.js : "쏘지 않고 피하기만 하는 봇" 으로 보스 탄막을 피할 수 있는지 확인한다
// -------------------------------------------------------------
// 봇 규칙 (매 프레임 다시 계획한다)
//   - 8방향 + 가만히 = 9가지 움직임을 두 번 (0.35초씩, 9 × 9 = 81가지) 0.7초 앞까지 미리 굴려 본다
//     (적 탄환은 지금 속도로 곧게, 플레이어는 게임과 같은 물리: 가속도·최고 속도·끌려가는 속도)
//   - 탄환·보스 몸·블랙홀 사건의 지평선에 가장 늦게 닿는(또는 안 닿는) 움직임을 고른다
//     (같으면 "가고 싶은 곳" 쪽 = 벽에서 90px 안쪽 점들 중 보스에게서 가장 먼 곳. 구석에 몰리지 않게)
//   - 쏘지 않는다 (player.fireTimer 를 아주 크게)
// 보고
//   - 맞은 횟수, "피할 수 없는 순간" (81가지 모두 0.25초 안에 닿는 프레임) 수
//
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/dodge.js                 보스 3종, 체력 100% / 30% 각 30초
//   NODE_PATH=$(npm root -g) node tools/dodge.js --boss turret --seconds 60
//   NODE_PATH=$(npm root -g) node tools/dodge.js --boss blackHole --set BH_PULL_MAX_RATIO=0.35
// =============================================================

const { chromium } = require("playwright");
const path = require("path");
const { startServer } = require("./serve.js");

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
const BOSSES = (args.boss || "waveLord,turret,blackHole").split(",");
const SECONDS = Number(args.seconds || 30);
// 상수를 바꿔 끼워 시험: --set BH_PULL_RANGE=Infinity,BH_PULL_MAX_RATIO=0.35
const OVERRIDES = {};
if (args.set) for (const pair of args.set.split(",")) { const [k, v] = pair.split("="); OVERRIDES[k] = v; }

function initScript() {
  let seed = 7;
  Math.random = function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  window.requestAnimationFrame = () => 0;
  const box = {};
  Object.defineProperty(window, "localStorage", { value: {
    getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); },
    removeItem: (k) => { delete box[k]; }, clear: () => {},
  }, configurable: true });
}

// 브라우저 안에서: 보스 하나와 seconds 초 동안 피하기만 한다
function runDodge(opts) {
  const H = 0.7, STEP = 1 / 30, DANGER = 0.25;
  const dirs = [[0, 0]];
  for (let k = 0; k < 8; k++) dirs.push([Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);

  startGame(); spawnQueue = []; bossQueue = []; enemies = []; bannerTimer = 0;
  WAVES.splice(0, WAVES.length, [{ type: "basic", count: 1 }], [{ type: "basic", count: 1 }]);
  player.x = CANVAS_WIDTH / 2; player.y = CANVAS_HEIGHT - 80;
  player.hp = player.maxHp = 1e9;
  const boss = createEnemy(opts.boss, CANVAS_WIDTH / 2, -40, 20);
  enemies = [boss];
  const keyList = ["KeyW", "KeyA", "KeyS", "KeyD"];

  // 움직임 두 번(앞 0.35초는 (dx1,dy1), 뒤 0.35초는 (dx2,dy2))을 굴려서 처음 닿는 시간 (안 닿으면 H + 1)
  // 플레이어는 게임과 같은 물리로 굴린다: 가속도 PLAYER_ACCELERATION, 최고 속도, 끌려가는 속도(당김 + 마찰)
  function firstHit(dx1, dy1, dx2, dy2) {
    let px = player.x, py = player.y, vx = player.vx, vy = player.vy;
    let pvx = player.pullVx || 0, pvy = player.pullVy || 0;
    const keep = Math.exp(-PULL_FRICTION * STEP), maxChange = PLAYER_ACCELERATION * STEP;
    for (let t = STEP; t <= H + 1e-9; t += STEP) {
      const dx = t <= H / 2 ? dx1 : dx2, dy = t <= H / 2 ? dy1 : dy2;
      vx += clamp(dx * PLAYER_SPEED - vx, -maxChange, maxChange);
      vy += clamp(dy * PLAYER_SPEED - vy, -maxChange, maxChange);
      const sp = Math.hypot(vx, vy);
      if (sp > PLAYER_SPEED) { vx *= PLAYER_SPEED / sp; vy *= PLAYER_SPEED / sp; }
      let ax = 0, ay = 0;
      for (const e of enemies) { const T = enemyType(e); if (T.pullOn) { const a = T.pullOn(e, px, py); ax += a.ax; ay += a.ay; } }
      pvx = (pvx + ax * STEP) * keep; pvy = (pvy + ay * STEP) * keep;
      px = clamp(px + (vx + pvx) * STEP, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
      py = clamp(py + (vy + pvy) * STEP, PLAYER_RADIUS, CANVAS_HEIGHT - PLAYER_RADIUS);
      for (const b of enemyBullets) {
        const bx = b.x + b.vx * t, by = b.y + b.vy * t;
        if ((bx - px) ** 2 + (by - py) ** 2 < (PLAYER_RADIUS + b.radius + 2) ** 2) return t;
      }
      for (const e of enemies) {
        const reach = enemyType(e).shape === "blackHole" ? BH_HORIZON + PLAYER_RADIUS + 4 : e.radius + PLAYER_RADIUS + 6;
        if ((e.x - px) ** 2 + (e.y - py) ** 2 < reach * reach) return t;
      }
    }
    return H + 1;
  }

  let hits = 0, unavoidable = 0, frames = 0;
  const total = Math.round(opts.seconds * 60);
  for (let f = 0; f < total; f++) {
    if (gameState !== "playing") break;
    player.fireTimer = 1e9;
    if (opts.hpRatio < 1) boss.hp = boss.maxHp * opts.hpRatio;   // 화난 패턴을 보려고 체력 고정
    // 가고 싶은 곳: 벽에서 90px 안쪽 점들 중 보스에게서 가장 먼 곳 (구석에 몰리지 않게 미리 빠져나간다)
    let goal = null, goalDist = -1;
    for (let gx = 90; gx <= CANVAS_WIDTH - 90; gx += 40) {
      for (let gy = 90; gy <= CANVAS_HEIGHT - 90; gy += 40) {
        let d = Infinity;
        for (const e of enemies) d = Math.min(d, Math.hypot(gx - e.x, gy - e.y));
        if (d > goalDist) { goalDist = d; goal = [gx, gy]; }
      }
    }
    const gl = Math.hypot(goal[0] - player.x, goal[1] - player.y) || 1;
    const goalDir = [(goal[0] - player.x) / gl, (goal[1] - player.y) / gl];
    // 9가지 움직임 평가: 늦게 닿을수록 좋고, 같으면 가고 싶은 곳 쪽
    let best = null, bestScore = -Infinity, bestHit = 0;
    for (const [dx, dy] of dirs) {
      // 첫 움직임 (dx, dy) 다음에 고를 수 있는 9가지 중 가장 좋은 것
      let t = 0;
      for (const [ex, ey] of dirs) { t = Math.max(t, firstHit(dx, dy, ex, ey)); if (t > H) break; }
      const nx = player.x + dx * 30, ny = player.y + dy * 30;
      // 같은 조건이면: 보스에게서 멀수록(420px 까지) 좋고, 벽에 붙지 않을수록(80px 안쪽이면 감점),
      // 화면 가운데에 가까울수록 조금 좋다 (구석에 몰리면 블랙홀에게 눌려 빠져나갈 수 없다)
      let bossDist = 420;
      for (const e of enemies) bossDist = Math.min(bossDist, Math.hypot(nx - e.x, ny - e.y));
      const wall = Math.min(nx, ny, CANVAS_WIDTH - nx, CANVAS_HEIGHT - ny);
      const wallPenalty = -Math.max(0, 80 - wall) * 0.02;
      const centerPull = -Math.hypot(nx - CANVAS_WIDTH / 2, ny - CANVAS_HEIGHT / 2) * 0.002;
      const toGoal = (dx * goalDir[0] + dy * goalDir[1]) * Math.min(1, gl / 60);   // 가고 싶은 곳 쪽이면 +
      const score = t * 10 + toGoal * 0.6 + bossDist * 0.01 + wallPenalty + centerPull;
      if (score > bestScore) { bestScore = score; best = [dx, dy]; bestHit = t; }
    }
    if (bestHit < DANGER) unavoidable++;
    for (const k of keyList) keys[k] = false;
    if (best[0] > 0.38) keys.KeyD = true;
    if (best[0] < -0.38) keys.KeyA = true;
    if (best[1] > 0.38) keys.KeyS = true;
    if (best[1] < -0.38) keys.KeyW = true;
    const hp0 = player.hp;
    update(1 / 60);
    if (player.hp < hp0) hits++;
    frames++;
  }
  for (const k of keyList) keys[k] = false;
  return { boss: opts.boss, hpRatio: opts.hpRatio, seconds: +(frames / 60).toFixed(1), hits, unavoidable, maxBullets: enemyBullets.length };
}

(async () => {
  const server = await startServer(path.resolve(__dirname, ".."));
  server.setOverrides(OVERRIDES);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(initScript);
  await page.goto(server.url + "index.html");
  console.log("보스 | 체력 | 시간 | 맞은 횟수 | 피할 수 없는 순간(프레임)");
  for (const boss of BOSSES) {
    for (const hpRatio of [1, 0.3]) {
      const r = await page.evaluate(runDodge, { boss, hpRatio, seconds: SECONDS });
      console.log(r.boss + " | " + Math.round(hpRatio * 100) + "% | " + r.seconds + "초 | " + r.hits + " | " + r.unavoidable);
    }
  }
  if (errors.length) console.log("페이지 오류: " + errors.slice(0, 3).join(" / "));
  await browser.close();
  server.close();
})();
