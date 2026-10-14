// 실행: node --test tests/   (flash-trainer 폴더에서)
// 감도 공식 · 눈뽕 판정 · 궤적 계획 · 점수 계산을 브라우저 없이 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { degPerCount, eDPI, cmPer360, toValorantSens, verticalFovDeg, countsToCm, LookState } from '../src/input.js';
import { VALORANT_YAW, HORIZONTAL_FOV_DEG } from '../src/config/view.js';
import { FLASH_TYPES, BLIND } from '../src/config/flash.js';
import {
  angleFactor, computeBlind, blindOpacity, skyeMaxBlind, kayoPopTime, planThrow, angleBetweenDeg,
} from '../src/flash.js';
import { segmentBlocked, segmentHit, MAP_BOXES, pointInsideAny, setMap, MAPS } from '../src/map.js';
import { unionLength } from '../src/game.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ---------------- 감도 ----------------
test('yaw 상수는 0.07', () => close(VALORANT_YAW, 0.07));

test('감도 공식: 1카운트 = sens × 0.07°', () => {
  close(degPerCount(0.4), 0.028);
  close(degPerCount(1), 0.07);
});

test('eDPI, cm/360', () => {
  close(eDPI(800, 0.4), 320);
  // 800 DPI × 0.4: 360×2.54 / (800×0.4×0.07) = 914.4 / 22.4 = 40.82142857...
  close(cmPer360(800, 0.4), 914.4 / 22.4);
  close(cmPer360(1600, 0.2), cmPer360(800, 0.4)); // 같은 eDPI → 같은 cm/360
});

test('cm/360 만큼 카운트를 넣으면 정확히 360° 회전 (감도 테스트 모드의 원리)', () => {
  const settings = { sens: 0.4, dpi: 800 };
  const look = new LookState(() => settings);
  const countsPer360 = 360 / degPerCount(settings.sens); // 12857.14...
  // 마우스는 정수 카운트를 보낸다. 1카운트씩 여러 번 나눠 보내도(=높은 FPS) 결과가 같아야 한다
  const n = Math.round(countsPer360);
  for (let i = 0; i < n; i++) look.applyMouse(1, 0);
  close(look.yawDeg, n * 0.028, 1e-6);
  close(countsToCm(n, 800), cmPer360(800, 0.4), 0.01); // 이동 거리도 cm/360 과 일치(반올림 오차 이내)
  const look2 = new LookState(() => settings);
  look2.applyMouse(n, 0); // 한 번에 몰아서(=낮은 FPS)
  close(look2.yawDeg, look.yawDeg, 1e-6);
});

test('pitch: 마우스를 아래로(+Y) 움직이면 아래를 보고, ±89°에서 멈춘다', () => {
  const look = new LookState(() => ({ sens: 1 }));
  look.applyMouse(0, 100); // 7°
  close(look.pitchDeg, -7);
  look.applyMouse(0, -100000);
  close(look.pitchDeg, 89);
  look.applyMouse(0, 100000);
  close(look.pitchDeg, -89);
});

test('forward(): yaw 0 = -z, 오른쪽으로 90° = +x', () => {
  const look = new LookState(() => ({ sens: 1 }));
  let f = look.forward();
  close(f.z, -1); close(f.x, 0);
  look.yawDeg = 90;
  f = look.forward();
  close(f.x, 1, 1e-12); close(f.z, 0, 1e-12);
});

test('다른 게임 감도 변환', () => {
  close(toValorantSens(1, 0.022), 0.022 / 0.07);   // CS2 1.0 → 0.3143
  close(toValorantSens(3.181818, 0.022), 1, 1e-5); // "발로란트 1.0 = CS2 3.18"
  close(toValorantSens(5, 0.0066), 5 * 0.0066 / 0.07); // OW2
});

test('FOV: 16:9 에서 수평 103° → 수직 ≈ 70.53°, 다른 비율에서도 수평 유지', () => {
  const v = verticalFovDeg(HORIZONTAL_FOV_DEG, 16 / 9);
  close(v, 70.5328, 1e-3);
  for (const aspect of [4 / 3, 16 / 10, 21 / 9, 32 / 9]) {
    const vv = verticalFovDeg(103, aspect) * Math.PI / 180;
    const h = 2 * Math.atan(Math.tan(vv / 2) * aspect) * 180 / Math.PI;
    close(h, 103, 1e-9);
  }
});

// ---------------- 눈뽕 판정 ----------------
test('최대 눈뽕 · 윈드업이 스펙 문서와 같다', () => {
  close(FLASH_TYPES.phoenix.maxBlind, 1.5); close(FLASH_TYPES.phoenix.fuse, 0.6);
  close(FLASH_TYPES.skye.blindMin, 1.0); close(FLASH_TYPES.skye.blindMax, 2.25); close(FLASH_TYPES.skye.chargeTime, 0.75);
  close(FLASH_TYPES.yoru.maxBlind, 1.5); close(FLASH_TYPES.yoru.bounceWindup, 0.6);
  close(FLASH_TYPES.kayoOver.maxBlind, 2.25); close(FLASH_TYPES.kayoUnder.maxBlind, 1.5);
  close(FLASH_TYPES.kayoOver.bounceWindup, 0.8); close(FLASH_TYPES.kayoOver.fuse, 1.6); close(FLASH_TYPES.kayoUnder.fuse, 1.0);
  close(FLASH_TYPES.breach.maxBlind, 2.25); close(FLASH_TYPES.breach.fuse, 0.5);
  close(FLASH_TYPES.reyna.nearsight, 1.6); close(FLASH_TYPES.reyna.windup, 0.4); close(FLASH_TYPES.reyna.hp, 60);
  close(BLIND.fadeTime, 1.0);
});

test('각도 배율: 정면 1, 등지면 0, 단조 감소', () => {
  close(angleFactor(0), 1);
  close(angleFactor(BLIND.fullAngleDeg), 1);
  close(angleFactor(180), 0);
  close(angleFactor(BLIND.zeroAngleDeg), 0);
  let prev = 1;
  for (let a = 0; a <= 180; a += 1) {
    const f = angleFactor(a);
    assert.ok(f <= prev + 1e-12, `${a}°에서 증가함`);
    prev = f;
  }
});

const openEye = [0, 1.6, 7];
test('정면이면 최대 눈뽕, 등지면 0', () => {
  const P = [0, 1.6, 4]; // 앞쪽 3m (-z)
  const front = computeBlind({ eye: openEye, forward: { x: 0, y: 0, z: -1 }, flashPos: P, maxBlind: 1.5 });
  assert.equal(front.blocked, false);
  close(front.hold, 1.5);
  close(front.fade, 1.0);
  const back = computeBlind({ eye: openEye, forward: { x: 0, y: 0, z: 1 }, flashPos: P, maxBlind: 1.5 });
  close(back.hold, 0);
  close(back.fade, 0);
  const side = computeBlind({ eye: openEye, forward: { x: 1, y: 0, z: 0 }, flashPos: P, maxBlind: 1.5 });
  assert.ok(side.hold > 0 && side.hold < 1.5, '옆이면 부분 눈뽕');
});

test('벽에 가려지면 눈뽕 없음', () => {
  setMap('course');
  // 가운데 가림벽 z -6 ~ -5.5, x -3 ~ 6
  const eye = [0, 1.6, -2];
  const P = [0, 1.6, -9];
  assert.ok(segmentBlocked(eye, P));
  const r = computeBlind({ eye, forward: { x: 0, y: 0, z: -1 }, flashPos: P, maxBlind: 2.25 });
  assert.equal(r.blocked, true);
  close(r.hold, 0);
});

test('화면 불투명도: 유지 → 페이드 → 0', () => {
  close(blindOpacity(0, 1.5, 1), 1);
  close(blindOpacity(1.5, 1.5, 1), 1);
  assert.ok(blindOpacity(2.0, 1.5, 1) < 1 && blindOpacity(2.0, 1.5, 1) > 0);
  close(blindOpacity(2.5, 1.5, 1), 0);
  close(blindOpacity(-0.1, 1.5, 1), 0);
});

test('스카이 충전: 0s → 1.0, 0.75s 이상 → 2.25', () => {
  close(skyeMaxBlind(0), 1.0);
  close(skyeMaxBlind(0.375), 1.625);
  close(skyeMaxBlind(0.75), 2.25);
  close(skyeMaxBlind(3), 2.25);
});

test('케이/오 튕김 윈드업 규칙 (패치 10.06)', () => {
  close(kayoPopTime(1.6, null, 0.8), 1.6);
  close(kayoPopTime(1.6, 0.3, 0.8), 1.1);  // 튕긴 뒤 0.8s
  close(kayoPopTime(1.6, 1.0, 0.8), 1.6);  // 남은 0.6s < 0.8s → 원래대로 (늘어나지 않음)
  close(kayoPopTime(1.0, 0.1, 0.8), 0.9);
});

// ---------------- 궤적 ----------------
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test('모든 종류: 계획한 경로가 정확히 폭발 지점에서 끝나고, 거리 범위를 지킨다 (두 맵 모두)', () => {
  for (const mapId of Object.keys(MAPS)) for (const typeId of Object.keys(FLASH_TYPES)) {
    setMap(mapId);
    for (let k = 0; k < 30; k++) {
      const rng = seeded(k * 97 + typeId.length);
      const eye = [0, 1.6, 7];
      const plan = planThrow(typeId, { eye, yawDeg: 0, distMin: 5, distMax: 14, allowBehind: false, rng });
      const end = plan.path(plan.popTime);
      for (let i = 0; i < 3; i++) close(end[i], plan.pop[i], 1e-6);
      if (!plan.fallback) {
        const d = Math.hypot(plan.pop[0] - eye[0], plan.pop[2] - eye[2]);
        assert.ok(d >= 5 - 1e-6 && d <= 14 + 1e-6, `${typeId} 거리 ${d}`);
        assert.ok(!segmentBlocked(eye, plan.pop), `${typeId}: 폭발 지점이 보이는 곳이어야 함`);
        assert.ok(!pointInsideAny(plan.pop, 0.1), `${typeId}: 폭발 지점이 상자 안`);
      }
    }
  }
  setMap('course');
});

test('빈 훈련장: 구조물이 거의 없고, 튕기는 플래시도 대체 경로 없이 계획된다(바닥 튕김)', () => {
  setMap('open');
  assert.ok(MAP_BOXES.length <= 8, `상자 ${MAP_BOXES.length}개`);
  const eye = [0, 1.6, 0];
  for (const typeId of ['yoru', 'kayoOver', 'kayoUnder']) {
    let bounced = 0;
    for (let k = 0; k < 40; k++) {
      const p = planThrow(typeId, { eye, yawDeg: 0, distMin: 5, distMax: 14, allowBehind: false, rng: seeded(900 + k) });
      assert.ok(!p.fallback, `${typeId}: 대체 직선 경로가 쓰임`);
      if (p.events.some((e) => e.kind === 'bounce')) bounced++;
    }
    // 언더핸드는 신관 1.0s - 윈드업 0.8s = 0.2s 라 튕김 윈드업이 사실상 의미가 없어(10.06 규칙) 튕김 계획을 하지 않는다
    if (typeId !== 'kayoUnder') assert.ok(bounced > 0, `${typeId}: 튕김 경로가 하나도 없음`);
  }
  // 플레이어 주변 14m 안은 완전히 트여 있어야 한다
  for (let h = 0; h < 360; h += 5) {
    const a = h * Math.PI / 180;
    assert.ok(!segmentBlocked(eye, [Math.sin(a) * 14, 1.6, -Math.cos(a) * 14]), `${h}° 방향이 막힘`);
  }
  setMap('course');
});

test('신관 시간: 피닉스 0.6s, 브리치 0.5s, 케이/오 오버 1.6s 또는 튕김 규칙, 윈드업 배율 적용', () => {
  const eye = [0, 1.6, 7];
  const opt = { eye, yawDeg: 0, distMin: 5, distMax: 12, allowBehind: false };
  close(planThrow('phoenix', { ...opt, rng: seeded(1) }).popTime, 0.6, 1e-9);
  close(planThrow('breach', { ...opt, rng: seeded(2) }).popTime, 0.5, 1e-9);
  close(planThrow('phoenix', { ...opt, windupScale: 2, rng: seeded(3) }).popTime, 1.2, 1e-9);
  for (let k = 0; k < 20; k++) {
    const p = planThrow('kayoOver', { ...opt, rng: seeded(100 + k) });
    if (p.bounceAt != null) close(p.popTime, p.bounceAt + 0.8, 1e-9);
    else close(p.popTime, 1.6, 1e-9);
  }
});

test('커브볼은 실제로 휜다 (좌/우 모두 나온다)', () => {
  const sides = new Set();
  for (let k = 0; k < 30; k++) {
    const p = planThrow('phoenix', { eye: [0, 1.6, 7], yawDeg: 0, distMin: 5, distMax: 12, allowBehind: false, rng: seeded(500 + k) });
    if (p.fallback) continue;
    sides.add(p.curveSide);
    const a = p.path(0); const m = p.path(p.popTime / 2); const b = p.path(p.popTime);
    const v1 = [m[0] - a[0], 0, m[2] - a[2]]; const v2 = [b[0] - m[0], 0, b[2] - m[2]];
    // 위에서 본 회전 방향 (x=동, -z=북 좌표): 북→동(시계, 오른쪽)이면 +
    const cross = v1[0] * v2[2] - v1[2] * v2[0];
    assert.ok(Math.sign(cross) === p.curveSide, '곡선 방향이 좌/우 클릭과 일치');
    assert.ok(angleBetweenDeg(v1, v2) > 20, '충분히 휘어야 함');
  }
  assert.deepEqual([...sides].sort(), [-1, 1]);
});

test('segmentHit: 벽 법선', () => {
  setMap('course');
  const h = segmentHit([0, 1.6, -2], [0, 1.6, -9], MAP_BOXES);
  assert.ok(h);
  close(h.point[2], -5.5, 1e-9);
  assert.deepEqual(h.normal, [0, 0, 1]);
});

// ---------------- 점수 ----------------
test('겹치는 눈뽕 구간은 합집합으로 센다', () => {
  close(unionLength([]), 0);
  close(unionLength([[0, 1.5]]), 1.5);
  close(unionLength([[0, 1.5], [1, 2]]), 2);
  close(unionLength([[0, 1], [2, 3]]), 2);
  close(unionLength([[0, 0], [5, 5]]), 0);
});

// ---------------- 터지는 시간 배율 (브리치 제외) ----------------
test('fastScale: 브리치만 빼고 터지는 시간 · 던지는 모션이 줄어든다', () => {
  setMap('open');
  const opt = { eye: [0, 1.6, 0], yawDeg: 0, distMin: 5, distMax: 12, allowBehind: false, fastScale: 0.7 };
  const ph = planThrow('phoenix', { ...opt, rng: seeded(11) });
  close(ph.popTime, 0.6 * 0.7, 1e-9);
  close(ph.throwAnim, FLASH_TYPES.phoenix.throwAnim * 0.7, 1e-9);
  const br = planThrow('breach', { ...opt, rng: seeded(12) });
  close(br.popTime, 0.5, 1e-9);
  close(br.throwAnim, FLASH_TYPES.breach.throwAnim, 1e-9);
  for (let k = 0; k < 10; k++) {
    const real = planThrow('kayoOver', { ...opt, fastScale: 1, rng: seeded(300 + k) });
    const fast = planThrow('kayoOver', { ...opt, rng: seeded(300 + k) });
    assert.ok(fast.popTime < real.popTime, '케이/오도 빨라져야 함');
    assert.ok(fast.popTime <= 1.6 * 0.7 + 1e-9);
  }
  // 기본값(fastScale 생략) = 실제 값
  close(planThrow('phoenix', { ...opt, fastScale: undefined, rng: seeded(13) }).popTime, 0.6, 1e-9);
  setMap('course');
});

// ---------------- 총 · 봇 ----------------
import { damageFor, rayHitBot, wallDistance, spreadDeg, jitterDir, peekSpot } from '../src/combat.js';
import { GUN, BOT } from '../src/config/combat.js';

test('밴달 피해량 · 연사 속도 · 봇 체력', () => {
  close(damageFor('head'), 160); close(damageFor('body'), 40); close(damageFor('legs'), 34);
  close(GUN.fireRate, 9.75); close(GUN.magazine, 25); close(BOT.hp, 150);
  assert.ok(damageFor('head') >= BOT.hp, '머리 한 방');
  assert.equal(Math.ceil(BOT.hp / damageFor('body')), 4, '몸 4발');
});

test('봇 부위 판정: 머리 / 몸 / 다리 / 빗나감', () => {
  const bot = { x: 0, z: -10 };
  const eye = [0, 1.6, 0];
  const aim = (y) => { const d = [0, y - 1.6, -10]; const l = Math.hypot(...d); return d.map((v) => v / l); };
  assert.equal(rayHitBot(eye, aim(BOT.headY), bot).part, 'head');
  assert.equal(rayHitBot(eye, aim(1.1), bot).part, 'body');
  assert.equal(rayHitBot(eye, aim(0.4), bot).part, 'legs');
  assert.equal(rayHitBot(eye, [0.3, 0, -0.954], bot), null);
  close(rayHitBot(eye, aim(BOT.headY), bot).dist, 10 - BOT.headR, 0.01);
});

test('벽 뒤 봇은 벽이 먼저 맞는다', () => {
  setMap('course');
  // 가운데 가림벽(z -5.5 ~ -6) 너머의 봇
  const eye = [0, 1.6, -2];
  const bot = { x: 0, z: -9 };
  const d = [0, 0, -1];
  assert.ok(wallDistance(eye, d) < rayHitBot(eye, d, bot).dist);
  setMap('open');
  assert.ok(wallDistance([0, 1.6, 0], d) > rayHitBot([0, 1.6, 0], d, { x: 0, z: -7 }).dist);
});

test('탄 퍼짐: 멈춘 첫 발은 정확, 연사 · 이동하면 넓어짐', () => {
  close(spreadDeg(0, 'still'), 0);
  assert.ok(spreadDeg(5, 'still') > 0);
  assert.ok(spreadDeg(100, 'still') <= GUN.maxSprayDeg + 1e-9);
  assert.ok(spreadDeg(0, 'run') > spreadDeg(0, 'walk'));
  const d = jitterDir([0, 0, -1], 0);
  assert.deepEqual(d, [0, 0, -1]);
  for (let i = 0; i < 50; i++) {
    const j = jitterDir([0, 0, -1], 3);
    const ang = Math.acos(-j[2]) * 180 / Math.PI;
    assert.ok(ang <= 3 + 1e-6, `퍼짐 ${ang}`);
  }
});

test('피킹 봇은 플래시 폭발 지점 뒤, 보이는 곳에 나온다', () => {
  setMap('open');
  const eye = [0, 1.6, 0];
  const pop = [0, 2, -8];
  for (let k = 0; k < 20; k++) {
    const s = peekSpot(eye, pop, seeded(700 + k));
    assert.ok(s);
    const d = Math.hypot(s.x, s.z);
    assert.ok(d >= 8 + BOT.peekBehind[0] - 1e-6 && d <= 8 + BOT.peekBehind[1] + 1e-6, `거리 ${d}`);
    assert.ok(!segmentBlocked(eye, [s.x, BOT.headY, s.z]));
  }
  setMap('course');
});
