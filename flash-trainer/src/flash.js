// =============================================================
// src/flash.js : 플래시 메커니즘 (궤적 · 폭발 · 눈뽕 판정 · 연출)
// -------------------------------------------------------------
// [발로란트와 동일]
//   - 요원별 최대 눈뽕 · 윈드업(신관) 시간  → config/flash.js 에서 ✅ 표시된 값
//   - 커브볼 좌클릭=왼쪽 / 우클릭=오른쪽 곡선
//   - 스카이: 시전 후 0.75s 충전에 따라 1.0→2.25s
//   - 케이/오: 튕기면 0.8s 윈드업, 이미 0.8s 안에 터질 예정이면 무시 (kayoPopTime)
//   - 요루: 단단한 면에 부딪힌 뒤 윈드업 시작
//   - 브리치: 벽을 뚫고 나옴(궤적은 벽을 무시), 눈뽕 판정은 폭발 위치 기준
//   - 벽/상자에 가려지면 눈뽕 없음, 등지면 눈뽕 없음, 지속시간 뒤 약 1초 페이드
// [근사 구현]
//   - 각도 → 지속시간 곡선(코사인), 거리 감쇠(기본 꺼짐), 투사체 속도 · 곡률,
//     던지는 모션 시간, 스카이 재사용 후 윈드업, 레이나 눈 판정 각도
//   - 궤적은 물리 시뮬레이션이 아니라 "폭발 지점에서 거꾸로 계획한" 경로를 따라간다.
//     (훈련용으로 플래시가 원하는 거리 · 방향에서 터지도록 하기 위함)
// =============================================================

import * as THREE from '../vendor/three.module.min.js';
import { FLASH_TYPES, BLIND, NEARSIGHT } from './config/flash.js';
import { MAP_BOXES, ARENA_HALF, segmentBlocked, segmentHit, pointInsideAny } from './map.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------
// 1. 눈뽕 판정 (순수 함수 — tests/flash.test.mjs 에서 검사)
// ---------------------------------------------------------------

/** 두 벡터 사이 각도(도) */
export function angleBetweenDeg(a, b) {
  const la = Math.hypot(a[0], a[1], a[2]);
  const lb = Math.hypot(b[0], b[1], b[2]);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}

/**
 * (a) 시선 각도 → 배율 [근사값]
 * θ ≤ full: 1,  θ ≥ zero: 0,  사이: 0.5 × (1 + cos(π × (θ - full) / (zero - full)))
 * 코사인 곡선을 쓰면 양 끝에서 기울기가 0 이라 "조금 돌렸을 때 갑자기 확 줄어드는" 일이 없다.
 */
export function angleFactor(thetaDeg, cfg = BLIND) {
  if (thetaDeg <= cfg.fullAngleDeg) return 1;
  if (thetaDeg >= cfg.zeroAngleDeg) return 0;
  const u = (thetaDeg - cfg.fullAngleDeg) / (cfg.zeroAngleDeg - cfg.fullAngleDeg);
  return 0.5 * (1 + Math.cos(Math.PI * u));
}

/** (c) 거리 → 배율 [근사값]. 기본은 꺼져 있어 항상 1 */
export function distanceFactor(dist, cfg = BLIND) {
  const d = cfg.distance;
  if (!d || !d.enabled) return 1;
  if (dist <= d.fullRange) return 1;
  if (dist >= d.zeroRange) return 0;
  return 1 - (dist - d.fullRange) / (d.zeroRange - d.fullRange);
}

/**
 * 폭발 순간의 눈뽕 계산.
 * @returns {{hold:number, fade:number, factor:number, theta:number, blocked:boolean, dist:number}}
 *   hold = 완전 눈뽕(화면 하얗게 유지) 시간 = 점수로 쓰는 "눈뽕 지속시간"
 *   fade = 그 뒤 서서히 사라지는 시간
 */
export function computeBlind({ eye, forward, flashPos, maxBlind, boxes = MAP_BOXES, cfg = BLIND }) {
  const to = [flashPos[0] - eye[0], flashPos[1] - eye[1], flashPos[2] - eye[2]];
  const dist = Math.hypot(to[0], to[1], to[2]);
  const theta = angleBetweenDeg([forward.x, forward.y, forward.z], to);
  // (b) 시야 가림
  const blocked = cfg.losCheck ? segmentBlocked(eye, flashPos, boxes) : false;
  let factor = blocked ? 0 : angleFactor(theta, cfg) * distanceFactor(dist, cfg);
  if (factor < cfg.minFactor) factor = 0;
  const hold = maxBlind * factor;
  const fade = factor > 0 ? cfg.fadeTime * (cfg.fadeScalesWithFactor ? Math.sqrt(factor) : 1) : 0;
  return { hold, fade, factor, theta, blocked, dist };
}

/** 폭발 후 t 초일 때 화면 흰색 불투명도 (0~1) */
export function blindOpacity(t, hold, fade) {
  if (t < 0 || (hold <= 0 && fade <= 0)) return 0;
  if (t <= hold) return 1;
  if (fade <= 0) return 0;
  const u = (t - hold) / fade;
  if (u >= 1) return 0;
  // easeOutQuad 의 반대: 처음엔 천천히 걷히다가 끝에서 빨리 사라짐 → 1 - u² [근사]
  return 1 - u * u;
}

/** 스카이: 시전 후 경과 시간 → 최대 눈뽕 [발로란트와 동일: 1.0→2.25s over 0.75s] (선형 증가는 근사) */
export function skyeMaxBlind(sinceCast, def = FLASH_TYPES.skye) {
  const u = Math.max(0, Math.min(1, sinceCast / def.chargeTime));
  return def.blindMin + (def.blindMax - def.blindMin) * u;
}

/**
 * 케이/오: 던진 뒤 폭발 시각 [발로란트와 동일: 패치 10.06 규칙]
 * 튕긴 순간 0.8s 윈드업 시작. 남은 시간이 이미 0.8s 이하면 원래 신관대로.
 */
export function kayoPopTime(fuse, bounceAt, bounceWindup) {
  if (bounceAt == null || bounceAt >= fuse) return fuse;
  if (fuse - bounceAt <= bounceWindup) return fuse;
  return bounceAt + bounceWindup;
}

// ---------------------------------------------------------------
// 2. 궤적 계획 (폭발 지점 P 에서 거꾸로)
// ---------------------------------------------------------------

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function lerp3(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
// 수평 방향(나침반 각도 h, 도) → 단위벡터. h=0 이 -z(북), 90 이 +x(동)
function dirH(hDeg) { return [Math.sin(hDeg * DEG), 0, -Math.cos(hDeg * DEG)]; }
function bearing(from, to) { return Math.atan2(to[0] - from[0], -(to[2] - from[2])) / DEG; }

function inArena(p, m = 0.6) {
  return Math.abs(p[0]) < ARENA_HALF - m && Math.abs(p[2]) < ARENA_HALF - m && p[1] > 0.2;
}

/** 점 목록(시간 간격 일정)을 따라가는 경로 */
function sampledPath(points, duration) {
  return (t) => {
    const u = Math.max(0, Math.min(1, t / duration)) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(u));
    return lerp3(points[i], points[i + 1], u - i);
  };
}

function pathClear(points, ignoreFirst = false) {
  for (let i = ignoreFirst ? 1 : 0; i < points.length - 1; i++) {
    if (segmentBlocked(points[i], points[i + 1])) return false;
  }
  for (const p of points) if (!inArena(p, 0.3) || pointInsideAny(p, 0.05)) return false;
  return true;
}

/** 폭발 지점 P 를 고른다: 거리 · 방향 범위 안, 상자 밖, 플레이어 눈에서 보이는 곳 */
export function choosePopPoint({ eye, yawDeg, distMin, distMax, allowBehind, rng = Math.random, needLOS = true }) {
  for (let i = 0; i < 80; i++) {
    const spread = allowBehind ? 180 : 100;
    const h = yawDeg + (rng() * 2 - 1) * spread;
    const d = distMin + rng() * (distMax - distMin);
    const y = 1.2 + rng() * 1.8;
    const flat = dirH(h);
    const P = [eye[0] + flat[0] * d, y, eye[2] + flat[2] * d];
    if (!inArena(P, 1)) continue;
    if (pointInsideAny(P, 0.4)) continue;
    if (needLOS && segmentBlocked(eye, P)) continue;
    return P;
  }
  return null;
}

/**
 * 종류별 궤적 계획.
 * 반환: { typeId, pop: P, start: S, popTime, path(t), events:[{t, kind}], maxBlind, curveSide?, debugPoints }
 * popTime/events 의 t 는 "투사체가 손을 떠난 순간" 기준(던지는 모션 시간 제외).
 */
export function planThrow(typeId, { eye, yawDeg, distMin, distMax, allowBehind, windupScale = 1, rng = Math.random }) {
  const def = FLASH_TYPES[typeId];
  for (let attempt = 0; attempt < 40; attempt++) {
    const P = choosePopPoint({ eye, yawDeg, distMin, distMax, allowBehind, rng });
    if (!P) continue;
    const plan = PLANNERS[def.path](def, P, eye, windupScale, rng);
    if (plan) {
      plan.typeId = typeId;
      return plan;
    }
  }
  // 마지막 수단: 직선 경로 (어떤 구조에서도 반드시 무언가는 던진다)
  const P = choosePopPoint({ eye, yawDeg, distMin, distMax, allowBehind, rng, needLOS: false })
    || [eye[0], 2, eye[2] - distMin];
  const S = add(P, mul(dirH(bearing(eye, P)), 4));
  const T = (def.fuse || def.bounceWindup || 0.6) * windupScale;
  return {
    typeId, pop: P, start: S, popTime: T, path: (t) => lerp3(S, P, Math.min(1, t / T)), events: [],
    maxBlind: def.maxBlind ?? def.blindMax, debugPoints: [S, P], fallback: true,
  };
}

const PLANNERS = {
  // 피닉스 커브볼: 일정한 속도로 날며 진행 방향이 일정하게 꺾인다
  curve(def, P, eye, scale, rng) {
    const T = def.fuse * scale;
    const side = rng() < 0.5 ? -1 : 1; // -1: 좌클릭(왼쪽으로 휨), +1: 우클릭(오른쪽으로 휨)
    // 도착 방향: 플레이어 시선을 가로지르게 (눈→P 방향에 대해 ±90° 근처)
    const hEnd = bearing(eye, P) + (60 + rng() * 60) * (rng() < 0.5 ? 1 : -1);
    const w = side * def.turnRateDeg; // 초당 방향 변화(도). +면 시계 방향(오른쪽)
    const N = 40;
    const dt = T / N;
    const pts = [P];
    let p = P;
    // 거꾸로 적분: t = T 에서 0 으로
    for (let i = N; i > 0; i--) {
      const h = hEnd - w * (T - (i - 0.5) * dt);
      p = sub(p, mul(dirH(h), def.speed * dt));
      pts.push(p);
    }
    pts.reverse();
    if (!pathClear(pts)) return null;
    return {
      pop: P, start: pts[0], popTime: T, path: sampledPath(pts, T), events: [],
      maxBlind: def.maxBlind, curveSide: side, debugPoints: pts,
    };
  },

  // 스카이 매: 직선 비행 → 스카이가 재사용 → 윈드업 → 폭발
  hawk(def, P, eye, scale, rng) {
    const flight = def.flightMin + rng() * (def.flightMax - def.flightMin);
    const wind = def.popWindup * scale;
    const slow = 0.4; // [근사] 재사용 후에는 느려지며 터진다
    const u = norm(dirH(bearing(eye, P) + (rng() * 2 - 1) * 50));
    const L1 = def.speed * flight;
    const L2 = def.speed * slow * wind;
    const S = add(P, mul(u, L1 + L2)); // 플레이어 반대쪽 멀리서 날아온다
    S[1] = Math.max(1.2, P[1] + 0.3);
    const R = add(P, mul(sub(S, P), L2 / (L1 + L2)));
    const pts = [S, R, P];
    if (!pathClear(pts)) return null;
    const T = flight + wind;
    const path = (t) => (t <= flight ? lerp3(S, R, t / flight) : lerp3(R, P, Math.min(1, (t - flight) / wind)));
    return {
      pop: P, start: S, popTime: T, path, events: [{ t: flight, kind: 'reactivate' }],
      maxBlind: skyeMaxBlind(flight, def), debugPoints: pts,
    };
  },

  // 요루: 벽에 던져 튕긴 뒤 0.6s 윈드업
  bounce(def, P, eye, scale, rng) {
    return planBounce(def, P, eye, def.bounceWindup * scale, def.speed, 0.25 + rng() * 0.35, rng, def.maxBlind);
  },

  // 케이/오: 포물선. 일부는 벽에 튕겨 0.8s 윈드업 규칙 적용
  lob(def, P, eye, scale, rng) {
    const fuse = def.fuse * scale;
    const bw = def.bounceWindup * scale;
    if (fuse - bw > 0.25 && rng() < 0.4) {
      const bounceAt = 0.2 + rng() * (fuse - bw - 0.2);
      const plan = planBounce(def, P, eye, bw, def.throwSpeed, bounceAt, rng, def.maxBlind);
      if (plan) {
        plan.popTime = kayoPopTime(fuse, bounceAt, bw); // = bounceAt + bw
        plan.bounceAt = bounceAt;
        return plan;
      }
    }
    const L = 6 + rng() * 8;
    const u = dirH(bearing(eye, P) + (rng() * 2 - 1) * 70);
    const S = [P[0] + u[0] * L, 1.5, P[2] + u[2] * L];
    const g = def.gravity;
    const v0 = [(P[0] - S[0]) / fuse, (P[1] - S[1] + 0.5 * g * fuse * fuse) / fuse, (P[2] - S[2]) / fuse];
    const path = (t) => {
      const tt = Math.min(t, fuse);
      return [S[0] + v0[0] * tt, S[1] + v0[1] * tt - 0.5 * g * tt * tt, S[2] + v0[2] * tt];
    };
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(path((fuse * i) / 24));
    if (!pathClear(pts)) return null;
    return { pop: P, start: S, popTime: fuse, path, events: [], maxBlind: def.maxBlind, debugPoints: pts };
  },

  // 브리치: 벽을 뚫고 나와 0.5s 뒤 폭발. 벽을 무시하는 직선
  through(def, P, eye, scale, rng) {
    const T = def.fuse * scale;
    const L = def.speed * T * def.travelFraction;
    // 가능하면 플레이어 눈에서 안 보이는 쪽(벽 뒤)에서 나오게
    let best = null;
    for (let i = 0; i < 12; i++) {
      const u = dirH(bearing(eye, P) + (rng() * 2 - 1) * 80);
      const S = [P[0] + u[0] * L, P[1], P[2] + u[2] * L];
      if (!inArena(S, 0.3)) continue;
      best = S;
      if (segmentBlocked(eye, S)) break;
    }
    if (!best) return null;
    return {
      pop: P, start: best, popTime: T, path: (t) => lerp3(best, P, Math.min(1, t / T)), events: [],
      maxBlind: def.maxBlind, debugPoints: [best, P], ghost: true,
    };
  },

  // 레이나 눈: 날아가서 도착 → 0.4s 윈드업 → 근시 시작
  eye(def, P, eye, scale, rng) {
    const travel = def.travel;
    const wind = def.windup * scale;
    const u = dirH(bearing(eye, P) + (rng() * 2 - 1) * 60);
    const L = 5 + rng() * 4;
    const S = [P[0] + u[0] * L, 1.5, P[2] + u[2] * L];
    const pts = [S, P];
    if (!pathClear(pts)) return null;
    return {
      pop: P, start: S, popTime: travel + wind, path: (t) => lerp3(S, P, Math.min(1, t / travel)),
      events: [{ t: travel, kind: 'arrive' }], maxBlind: 0, debugPoints: pts,
    };
  },
};

/** 벽에 튕기는 경로: S → B(벽) → P. 벽에 닿은 뒤 windup 초 뒤 P 에서 폭발 */
function planBounce(def, P, eye, windup, speed, tIn, rng, maxBlind) {
  // 1) P 근처의 벽을 찾는다 (수평 방향으로 광선). 2) 벽이 없으면 바닥에 튕긴다.
  //    (요루 Blindside · 케이/오 플래시는 바닥에도 튕긴다 — 빈 훈련장에서 쓰는 경로)
  for (let k = 0; k < 20; k++) {
    let B;
    let n;
    if (k < 10) {
      const far = add(P, mul(dirH(rng() * 360), 5));
      const hit = segmentHit(P, far);
      if (!hit || hit.normal[1] !== 0) continue;
      n = hit.normal;
      B = add(hit.point, mul(n, 0.12));
    } else {
      const off = mul(dirH(rng() * 360), 1 + rng() * 1.5);
      n = [0, 1, 0];
      B = [P[0] + off[0], 0.25, P[2] + off[2]]; // 공 반지름만큼 띄움 (inArena 는 y > 0.2 요구)
    }
    const r = norm(sub(P, B));
    if (dot(r, n) < 0.2) continue; // 면에서 P 쪽으로 튕겨 나와야 한다
    const dIn = sub(r, mul(n, 2 * dot(r, n))); // 반사 법칙: 들어온 방향
    const S = sub(B, mul(dIn, speed * tIn));
    S[1] = n[1] === 1 ? Math.max(0.8, Math.min(5, S[1])) : Math.max(0.8, Math.min(2.2, S[1]));
    const pts = [S, B, P];
    if (!pathClear(pts)) continue;
    const path = (t) => (t <= tIn ? lerp3(S, B, t / tIn) : lerp3(B, P, Math.min(1, (t - tIn) / windup)));
    return {
      pop: P, start: S, popTime: tIn + windup, path, events: [{ t: tIn, kind: 'bounce' }],
      maxBlind, debugPoints: pts,
    };
  }
  return null;
}

// ---------------------------------------------------------------
// 3. 화면 · 소리 연출과 실행 (브라우저 전용)
// ---------------------------------------------------------------

export class FlashSystem {
  constructor({ scene, audio, look, eye, settings }) {
    this.scene = scene;
    this.audio = audio;
    this.look = look;
    this.eye = eye;
    this.settings = settings;
    this.time = 0; // 게임 시계(초). 일시정지 중엔 멈춘다
    this.active = [];
    this.blinds = []; // { at, hold, fade }
    this.nearsightLevel = 0;
    this.listeners = []; // 결과를 받을 함수들 (training)
    this.whiteEl = document.getElementById('flash-white');
    this.nearEl = document.getElementById('nearsight');
    this.debugGroup = new THREE.Group();
    scene.add(this.debugGroup);
    this.popFx = [];
  }

  onResult(fn) { this.listeners.push(fn); }

  clear() {
    for (const f of this.active) this.removeObj(f);
    this.active = [];
    this.blinds = [];
    this.nearsightLevel = 0;
    this.whiteEl.style.opacity = 0;
    this.nearEl.style.opacity = 0;
  }

  /** 계획된 투척 하나를 시작한다. 반환값은 추적용 객체 */
  launch(plan, roundId) {
    const def = FLASH_TYPES[plan.typeId];
    const f = {
      plan, def, roundId, castAt: this.time, t: -def.throwAnim, state: 'windup-throw', mesh: null,
      sound: null, eventsDone: 0, hp: def.hp || 0, eyeUntil: 0, nearSec: 0,
    };
    this.audio.throwSound(plan.start);
    // 투사체 모양
    const geo = def.kind === 'nearsight' ? new THREE.SphereGeometry(0.22, 16, 12) : new THREE.SphereGeometry(0.13, 12, 10);
    const mat = new THREE.MeshBasicMaterial({ color: def.color });
    f.mesh = new THREE.Mesh(geo, mat);
    if (def.path === 'hawk') {
      f.mesh.scale.set(2.2, 0.6, 1.2); // 매 몸통 느낌 [연출]
    }
    f.mesh.visible = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: def.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(0.9, 0.9, 0.9);
    f.mesh.add(glow);
    this.scene.add(f.mesh);
    if (this.settings.showDebug) this.drawDebug(plan);
    this.active.push(f);
    return f;
  }

  drawDebug(plan) {
    const g = new THREE.BufferGeometry().setFromPoints(plan.debugPoints.map((p) => new THREE.Vector3(...p)));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff00ff }));
    const mk = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    mk.position.set(...plan.pop);
    this.debugGroup.add(line, mk);
    setTimeout(() => { this.debugGroup.remove(line, mk); g.dispose(); }, 3000);
  }

  removeObj(f) {
    if (f.sound) f.sound.stop();
    if (f.mesh) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
    }
  }

  /** 좌클릭 사격: 레이나 눈만 맞출 수 있다 */
  shoot(eye, fwd) {
    this.audio.shot();
    let best = null;
    for (const f of this.active) {
      if (f.def.kind !== 'nearsight' || !f.mesh.visible) continue;
      const c = f.mesh.position;
      const oc = [c.x - eye[0], c.y - eye[1], c.z - eye[2]];
      const along = oc[0] * fwd.x + oc[1] * fwd.y + oc[2] * fwd.z;
      if (along <= 0) continue;
      const perp2 = dot(oc, oc) - along * along;
      if (perp2 > 0.35 * 0.35) continue; // [근사] 맞는 판정 반지름 0.35m
      if (segmentBlocked(eye, [c.x, c.y, c.z])) continue;
      if (!best || along < best.along) best = { f, along };
    }
    if (best) {
      best.f.hp -= best.f.def.shotDamage;
      this.audio.beep([best.f.mesh.position.x, best.f.mesh.position.y, best.f.mesh.position.z], 2200, 0.05);
      if (best.f.hp <= 0) this.finishEye(best.f, true);
    }
  }

  finishEye(f, destroyed) {
    f.state = 'done';
    this.removeObj(f);
    this.emit({ f, typeId: f.plan.typeId, kind: 'nearsight', blindSec: f.nearSec, destroyed, popAt: f.popAt });
  }

  emit(res) {
    for (const fn of this.listeners) fn(res);
  }

  update(dt, showDebug) {
    this.time += dt;
    const eye = this.eye();
    const fwd = this.look.forward();
    let nearsightWanted = 0;

    for (const f of this.active) {
      if (f.state === 'done') continue;
      f.t += dt;
      const { plan, def } = f;
      if (f.t < 0) continue; // 아직 던지는 모션 중

      if (!f.mesh.visible && f.state !== 'eye') {
        f.mesh.visible = true;
        f.sound = this.audio.flight(plan.typeId, plan.start);
        f.state = 'flying';
      }

      // 경로 이벤트 (튕김, 재사용, 도착)
      while (f.eventsDone < plan.events.length && f.t >= plan.events[f.eventsDone].t) {
        const ev = plan.events[f.eventsDone++];
        const p = plan.path(ev.t);
        if (ev.kind === 'bounce') { this.audio.beep(p, 900, 0.08); f.sound && f.sound.rise(plan.popTime - ev.t); }
        if (ev.kind === 'reactivate') { this.audio.beep(p, 1500, 0.1); f.sound && f.sound.rise(plan.popTime - ev.t); }
        if (ev.kind === 'arrive') { f.sound && f.sound.rise(plan.popTime - ev.t); }
      }

      if (f.state === 'flying') {
        const p = plan.path(Math.min(f.t, plan.popTime));
        f.mesh.position.set(p[0], p[1], p[2]);
        if (f.sound) f.sound.move(p);
        // 윈드업 막바지에 깜빡임
        const left = plan.popTime - f.t;
        f.mesh.children[0].scale.setScalar(left < 0.25 ? 1.4 + Math.sin(f.t * 60) * 0.4 : 0.9);
        if (f.t >= plan.popTime) this.detonate(f, eye, fwd);
      } else if (f.state === 'eye') {
        // 레이나 눈: 바라보고 있고 가려지지 않았으면 근시
        if (this.time >= f.eyeUntil) {
          this.finishEye(f, false);
          continue;
        }
        const c = plan.pop;
        const theta = angleBetweenDeg([fwd.x, fwd.y, fwd.z], sub(c, eye));
        if (theta <= def.viewAngleDeg && !segmentBlocked(eye, c)) {
          nearsightWanted = 1;
          f.nearSec += dt;
        }
        f.mesh.rotation.y += dt * 3;
      }
    }
    this.active = this.active.filter((f) => f.state !== 'done');

    // ---- 눈뽕 화면 ----
    let white = 0;
    for (const b of this.blinds) white = Math.max(white, blindOpacity(this.time - b.at, b.hold, b.fade));
    this.blinds = this.blinds.filter((b) => this.time - b.at < b.hold + b.fade);
    this.whiteEl.style.opacity = white.toFixed(3);

    // ---- 니어사이트 화면 ----
    const rate = nearsightWanted ? 1 / NEARSIGHT.fadeIn : -1 / NEARSIGHT.fadeOut;
    this.nearsightLevel = Math.max(0, Math.min(1, this.nearsightLevel + rate * dt));
    this.nearEl.style.opacity = this.nearsightLevel.toFixed(3);

    // ---- 폭발 빛 ----
    for (const fx of this.popFx) {
      fx.life -= dt;
      const k = Math.max(0, fx.life / fx.max);
      fx.light.intensity = 60 * k;
      fx.sprite.material.opacity = k;
      fx.sprite.scale.setScalar(1 + (1 - k) * 5);
    }
    for (const fx of this.popFx.filter((x) => x.life <= 0)) {
      this.scene.remove(fx.light, fx.sprite);
    }
    this.popFx = this.popFx.filter((x) => x.life > 0);
    this.debugGroup.visible = showDebug;
  }

  detonate(f, eye, fwd) {
    const { plan, def } = f;
    const P = plan.pop;
    f.popAt = this.time;
    if (f.sound) { f.sound.stop(); f.sound = null; }

    if (def.kind === 'nearsight') {
      // 레이나 눈은 터지지 않고 그 자리에서 근시를 건다
      f.state = 'eye';
      f.mesh.position.set(...P);
      f.eyeUntil = this.time + def.nearsight;
      this.audio.beep(P, 600, 0.2);
      return;
    }

    f.state = 'done';
    this.removeObj(f);
    this.audio.pop(P);
    this.spawnPopFx(P, def.color);
    const r = computeBlind({ eye, forward: fwd, flashPos: P, maxBlind: plan.maxBlind });
    if (r.factor > 0) {
      this.blinds.push({ at: this.time, hold: r.hold, fade: r.fade });
      this.audio.ring(r.factor, r.hold, r.fade);
    }
    this.emit({ f, typeId: plan.typeId, kind: 'flash', blindSec: r.hold, popAt: this.time, ...r, maxBlind: plan.maxBlind });
  }

  spawnPopFx(P, color) {
    const light = new THREE.PointLight(0xffffff, 60, 25, 1.5);
    light.position.set(...P);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.set(...P);
    this.scene.add(light, sprite);
    this.popFx.push({ light, sprite, life: 0.3, max: 0.3 });
  }
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
