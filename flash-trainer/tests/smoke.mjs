// 브라우저 확인(선택): Playwright 가 설치된 환경에서만.  node tests/smoke.mjs
// 포인터 락은 자동 테스트에서 걸 수 없으므로 window.__ft 손잡이로 "잠긴 상태"를 흉내 낸다.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { startServer } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(globalRoot, 'playwright')));
}

const OUT = process.argv[2] || '.';
const server = await startServer(8765);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:8765/index.html');
await page.waitForFunction(() => window.__ft);
await page.screenshot({ path: path.join(OUT, 'shot-menu.png') });

function check(cond, msg) {
  console.log((cond ? 'OK   ' : 'FAIL ') + msg);
  if (!cond) process.exitCode = 1;
}

// ---- FOV ----
const fov = await page.evaluate(() => ({ v: window.__ft.camera.fov, a: window.__ft.camera.aspect }));
const h = 2 * Math.atan(Math.tan((fov.v * Math.PI) / 360) * fov.a) * 180 / Math.PI;
check(Math.abs(h - 103) < 1e-6, `수평 FOV = ${h.toFixed(4)}° (수직 ${fov.v.toFixed(3)}°, 화면비 ${fov.a.toFixed(3)})`);

// ---- 감도 테스트 모드: cm/360 만큼 카운트 → 360° ----
const st = await page.evaluate(() => {
  const ft = window.__ft;
  document.getElementById('menu').classList.add('hidden');
  ft.settings.dpi = 800; ft.settings.sens = 0.4;
  ft.setRunning(true);
  ft.setMode('senstest');
  const counts = 360 / (0.4 * 0.07);
  // 실제 mousemove 이벤트로 보낸다 (main.js 의 핸들러를 거치는지 확인)
  const n = Math.round(counts);
  let sent = 0;
  while (sent < n) {
    const d = Math.min(37, n - sent);
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: d, movementY: 0 }));
    sent += d;
  }
  return { yaw: ft.look.yawDeg, counts: ft.look.totalCountsX, n };
});
await page.waitForTimeout(100);
check(Math.abs(st.yaw - st.n * 0.028) < 1e-6 && Math.abs(st.yaw - 360) < 0.03, `감도 테스트: ${st.counts} 카운트 → ${st.yaw.toFixed(4)}°`);
const label = await page.textContent('#st-angle');
check(label === st.yaw.toFixed(1), `표시기 각도 글자 = ${label}`);
await page.screenshot({ path: path.join(OUT, 'shot-senstest.png') });

// ---- 훈련 모드: 플래시를 정면에서 맞으면 눈뽕, 등지면 0 ----
async function oneRound(face) {
  return page.evaluate(async (face) => {
    const ft = window.__ft;
    ft.setMode('train');
    ft.settings.combat.botMode = 'off'; // 눈뽕 시간 측정만 (봇이 있으면 라운드가 늦게 끝난다)
    ft.settings.training.fastScale = 1;  // 실제 발로란트 값으로 측정
    ft.settings.training.enabled = { phoenix: true };
    ft.settings.training.count = 1;
    ft.flashes.clear();
    ft.player.x = 0; ft.player.z = 7;
    ft.look.yawDeg = 0; ft.look.pitchDeg = 0;
    const before = ft.training.history.length;
    ft.training.state = 'waiting';
    ft.training.round = null;
    ft.training.nextAt = ft.flashes.time; // 바로 던지기
    // 터지기 직전에 시선을 플래시 쪽(face=true) 또는 반대쪽으로 맞춘다
    const t0 = performance.now();
    await new Promise((resolve, reject) => {
      const tick = () => {
        const f = ft.flashes.active[0];
        if (f && f.t > f.plan.popTime - 0.12) {
          const e = [ft.player.x, 1.6, ft.player.z];
          const P = f.plan.pop;
          const yaw = Math.atan2(P[0] - e[0], -(P[2] - e[2])) * 180 / Math.PI;
          const pitch = Math.atan2(P[1] - e[1], Math.hypot(P[0] - e[0], P[2] - e[2])) * 180 / Math.PI;
          ft.look.yawDeg = face ? yaw : yaw + 180;
          ft.look.pitchDeg = face ? pitch : 0;
        }
        if (ft.training.history.length > before) resolve();
        else if (performance.now() - t0 > 20000) reject(new Error('라운드가 20초 안에 끝나지 않음'));
        else requestAnimationFrame(tick);
      };
      tick();
    });
    const white = parseFloat(document.getElementById('flash-white').style.opacity || '0');
    return { rec: ft.training.history[0], white };
  }, face);
}
const hit = await oneRound(true);
check(Math.abs(hit.rec.blind - 1.5) < 1e-6, `정면 커브볼: 눈뽕 ${hit.rec.blind.toFixed(3)}s (기대 1.5s) — ${hit.rec.detail[0]}`);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'shot-flashed.png') });
const op = await page.evaluate(() => parseFloat(document.getElementById('flash-white').style.opacity));
check(op > 0.99, `폭발 0.3초 뒤 화면 흰색 불투명도 ${op}`);
await page.waitForTimeout(2800);
const op2 = await page.evaluate(() => parseFloat(document.getElementById('flash-white').style.opacity));
check(op2 === 0, `2.5초(1.5 유지 + 1.0 페이드) 뒤 불투명도 ${op2}`);

const dodge = await oneRound(false);
check(dodge.rec.blind === 0, `등진 커브볼: 눈뽕 ${dodge.rec.blind}s — ${dodge.rec.detail[0]}`);

// ---- 모든 종류 한 번씩 (에러 없이 끝까지 돌아가는지) ----
const all = await page.evaluate(async () => {
  const ft = window.__ft;
  const types = ['phoenix', 'skye', 'yoru', 'kayoOver', 'kayoUnder', 'breach', 'reyna'];
  const out = [];
  for (const t of types) {
    ft.settings.training.enabled = { [t]: true };
    ft.settings.training.count = 2;
    const before = ft.training.history.length;
    ft.training.state = 'waiting'; ft.training.round = null; ft.training.nextAt = ft.flashes.time;
    const t0 = performance.now();
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (ft.training.history.length > before) resolve();
        else if (performance.now() - t0 > 20000) reject(new Error(t + ' 라운드가 20초 안에 끝나지 않음'));
        else requestAnimationFrame(tick);
      };
      tick();
    });
    out.push(`${t}: ${ft.training.history[0].blind.toFixed(2)}s [${ft.training.history[0].detail.join(' / ')}]`);
  }
  return out;
});
for (const line of all) console.log('     ' + line);
check(all.length === 7, '7종 모두 라운드 완료');
await page.screenshot({ path: path.join(OUT, 'shot-train.png') });

// ---- 사격: 피킹 봇을 머리로 한 방에 잡기 ----
const fight = await page.evaluate(async () => {
  const ft = window.__ft;
  ft.settings.training.enabled = { phoenix: true };
  ft.settings.training.count = 1;
  ft.settings.combat.botMode = 'peek';
  ft.settings.combat.botReact = 3;
  ft.flashes.clear(); ft.combat.clear();
  ft.player.x = 0; ft.player.z = 0;
  const before = ft.training.history.length;
  const shotsBefore = ft.combat.stats.shots;
  ft.training.state = 'waiting'; ft.training.round = null; ft.training.nextAt = ft.flashes.time;
  const t0 = performance.now();
  let fired = false;
  await new Promise((resolve, reject) => {
    const tick = () => {
      const bot = ft.combat.bots.find((b) => b.alive);
      if (bot && !fired) {
        // 봇 머리를 정확히 조준하고 한 발
        const e = [ft.player.x, 1.6, ft.player.z];
        ft.look.yawDeg = Math.atan2(bot.x - e[0], -(bot.z - e[2])) * 180 / Math.PI;
        ft.look.pitchDeg = Math.atan2(1.55 - 1.6, Math.hypot(bot.x - e[0], bot.z - e[2])) * 180 / Math.PI;
        ft.combat.moveState = 'still';
        ft.combat.lastShot = -Infinity;
        ft.combat.setFiring(true);
        ft.combat.setFiring(false);
        fired = true;
      }
      if (ft.training.history.length > before) resolve();
      else if (performance.now() - t0 > 20000) reject(new Error('사격 라운드가 20초 안에 끝나지 않음'));
      else requestAnimationFrame(tick);
    };
    tick();
  });
  const h = ft.training.history[0];
  return { kills: h.kills, died: h.died, ttk: h.ttk, shots: ft.combat.stats.shots - shotsBefore, heads: ft.combat.stats.heads };
});
check(fight.kills === 1 && !fight.died && fight.shots === 1 && fight.heads >= 1, `피킹 봇 헤드샷 1발 처치 (처치 ${fight.kills}, 발사 ${fight.shots}, 처치 시간 ${fight.ttk && Math.round(fight.ttk * 1000)}ms)`);

// 아무것도 안 하면 "당함"
const lose = await page.evaluate(async () => {
  const ft = window.__ft;
  ft.settings.combat.botReact = 0.5;
  const before = ft.training.history.length;
  ft.training.state = 'waiting'; ft.training.round = null; ft.training.nextAt = ft.flashes.time;
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    const tick = () => (ft.training.history.length > before ? resolve()
      : performance.now() - t0 > 20000 ? reject(new Error('timeout')) : requestAnimationFrame(tick));
    tick();
  });
  return ft.training.history[0];
});
check(lose.died === true && lose.kills === 0, '피킹 봇을 못 잡으면 당함으로 기록');
await page.screenshot({ path: path.join(OUT, 'shot-combat.png') });

// 상주 봇
const always = await page.evaluate(async () => {
  const ft = window.__ft;
  ft.settings.combat.botMode = 'always';
  ft.settings.combat.alwaysCount = 3;
  ft.training.state = 'waiting'; ft.training.nextAt = ft.flashes.time + 999; // 플래시 멈춤
  await new Promise((r) => setTimeout(r, 500));
  return ft.combat.bots.filter((b) => b.kind === 'always' && b.alive).length;
});
check(always === 3, `상주 봇 ${always}마리`);
await page.screenshot({ path: path.join(OUT, 'shot-always.png') });

check(errors.length === 0, `콘솔 오류 없음 ${errors.join(' | ')}`);
await browser.close();
server.close();
