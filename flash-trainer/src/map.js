// =============================================================
// src/map.js : 훈련장 구조(벽 · 상자 · 복도)와 충돌 계산
// -------------------------------------------------------------
// 모든 구조물은 축에 나란한 상자(AABB)다. 같은 데이터로
//   1) 화면에 그릴 상자(main.js),
//   2) 플래시 시야 가림 레이캐스트(flash.js),
//   3) 플레이어 이동 충돌을 모두 처리한다.
// 단위는 미터, y 가 위쪽, 바닥은 y = 0. 천장은 없다(천장 반사 없음).
// [근사] 실제 발로란트 맵이 아니라 연습용 단순 구조.
// =============================================================

// box(최소 x, 최소 z, 최대 x, 최대 z, 높이, 색)
function box(x0, z0, x1, z1, h, color) {
  return { min: [Math.min(x0, x1), 0, Math.min(z0, z1)], max: [Math.max(x0, x1), h, Math.max(z0, z1)], color };
}

const WALL = 0x8a8f9c;
const WALL2 = 0x6f7d8c;
const CRATE = 0xb08a5a;
const PILLAR = 0x9a8f86;

export const ARENA_HALF = 22; // 바깥벽 안쪽 반 너비(m)

// 바깥벽 (높이 6m) — 모든 맵 공통
const OUTER = [
  box(-ARENA_HALF - 1, -ARENA_HALF - 1, ARENA_HALF + 1, -ARENA_HALF, 6, WALL),
  box(-ARENA_HALF - 1, ARENA_HALF, ARENA_HALF + 1, ARENA_HALF + 1, 6, WALL),
  box(-ARENA_HALF - 1, -ARENA_HALF, -ARENA_HALF, ARENA_HALF, 6, WALL),
  box(ARENA_HALF, -ARENA_HALF, ARENA_HALF + 1, ARENA_HALF, 6, WALL),
];

// 맵 종류
export const MAPS = {
  // 빈 훈련장 (기본): 시야를 가리는 것이 거의 없어 "돌아서 피하기"만 연습한다.
  // 멀리 있는 기둥 4개는 방향 감각용이다. 플래시는 최대 14m 안에서 터지므로 거의 가리지 않는다.
  open: {
    name: '빈 훈련장',
    spawn: { x: 0, z: 0 },
    boxes: [
      ...OUTER,
      box(-17, -17, -16, -16, 4, PILLAR),
      box(16, -17, 17, -16, 4, PILLAR),
      box(-17, 16, -16, 17, 4, PILLAR),
      box(16, 16, 17, 17, 4, PILLAR),
    ],
  },
  // 구조물 맵: 벽 · 상자 · 복도. 모서리 뒤에서 날아오는 플래시와 벽 가림을 연습한다.
  course: {
    name: '구조물 맵',
    spawn: { x: 0, z: 7 },
    boxes: [
      ...OUTER,
      // 왼쪽 복도 (x -12 ~ -8 사이가 통로)
      box(-12.5, -16, -12, 4, 4, WALL2),
      box(-8, -16, -7.5, -2, 4, WALL2),
      box(-8, 1, -7.5, 4, 4, WALL2),
      // 가운데 가림벽 + ㄱ자 모서리
      box(-3, -6, 6, -5.5, 4, WALL2),
      box(6, -6, 6.5, -1, 4, WALL2),
      // 오른쪽 ㄴ자 모서리
      box(11, 4, 11.5, 12, 4, WALL2),
      box(11, 3.5, 17, 4, 4, WALL2),
      // 뒤쪽 짧은 벽들
      box(-6, 12, 0, 12.5, 3.5, WALL2),
      box(3, 15, 8, 15.5, 3.5, WALL2),
      // 상자
      box(-2, 2, -0.5, 3.5, 1.5, CRATE),
      box(2, -1, 3.5, 0.5, 3, CRATE), // 2단 높이 상자
      box(-5, 6, -3.5, 7.5, 1.5, CRATE),
      box(7, 8, 8.5, 9.5, 1.5, CRATE),
      box(14, -10, 16, -8, 2, CRATE),
      box(-17, 8, -15, 10, 2, CRATE),
      // 기둥
      box(-16, -6, -15, -5, 5, PILLAR),
      box(15, 16, 16, 17, 5, PILLAR),
      box(0, -14, 1, -13, 5, PILLAR),
      box(10, -16, 11, -15, 5, PILLAR),
    ],
  },
};

// 지금 쓰는 맵의 상자 목록. 다른 파일은 이 배열을 그대로 참조하므로, 맵을 바꿀 때는 내용만 갈아 끼운다.
export const MAP_BOXES = [...MAPS.open.boxes];
export const PLAYER_SPAWN = { ...MAPS.open.spawn };

export function setMap(id) {
  const m = MAPS[id] || MAPS.open;
  MAP_BOXES.length = 0;
  MAP_BOXES.push(...m.boxes);
  PLAYER_SPAWN.x = m.spawn.x;
  PLAYER_SPAWN.z = m.spawn.z;
  return m;
}


/**
 * 선분 a→b 가 상자에 가로막히는지 (slab 방법).
 * a, b 는 [x,y,z]. 끝점 근처(eps)는 무시한다(플래시가 벽에 딱 붙어 있어도 판정이 튀지 않게).
 */
export function segmentBlocked(a, b, boxes = MAP_BOXES, eps = 1e-3) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  for (const bx of boxes) {
    let t0 = eps;
    let t1 = 1 - eps;
    let hit = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        if (a[i] < bx.min[i] || a[i] > bx.max[i]) { hit = false; break; }
      } else {
        let ta = (bx.min[i] - a[i]) / d[i];
        let tb = (bx.max[i] - a[i]) / d[i];
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) { hit = false; break; }
      }
    }
    if (hit) return true;
  }
  return false;
}

/**
 * 선분 a→b 에서 처음 부딪히는 지점과 면의 법선. 없으면 null.
 * 요루 Blindside · 케이/오 튕김 계산에 쓴다.
 */
export function segmentHit(a, b, boxes = MAP_BOXES) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  let best = null;
  for (const bx of boxes) {
    let t0 = 0;
    let t1 = 1;
    let axis = -1;
    let sign = 0;
    let ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        if (a[i] < bx.min[i] || a[i] > bx.max[i]) { ok = false; break; }
      } else {
        let ta = (bx.min[i] - a[i]) / d[i];
        let tb = (bx.max[i] - a[i]) / d[i];
        let s = -1;
        if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
        if (ta > t0) { t0 = ta; axis = i; sign = s; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && axis >= 0 && (!best || t0 < best.t)) {
      const n = [0, 0, 0];
      n[axis] = sign;
      best = { t: t0, point: [a[0] + d[0] * t0, a[1] + d[1] * t0, a[2] + d[2] * t0], normal: n };
    }
  }
  // 바닥(y=0)도 단단한 면
  if (d[1] < 0 && a[1] >= 0 && b[1] < 0) {
    const t = a[1] / -d[1];
    if (!best || t < best.t) best = { t, point: [a[0] + d[0] * t, 0, a[2] + d[2] * t], normal: [0, 1, 0] };
  }
  return best;
}

/** 점이 어떤 상자 안(여유 margin 포함)에 있는지 */
export function pointInsideAny(p, margin = 0, boxes = MAP_BOXES) {
  for (const bx of boxes) {
    if (p[0] > bx.min[0] - margin && p[0] < bx.max[0] + margin
      && p[1] > bx.min[1] - margin && p[1] < bx.max[1] + margin
      && p[2] > bx.min[2] - margin && p[2] < bx.max[2] + margin) return true;
  }
  return false;
}

/** 플레이어(원기둥)를 상자 밖으로 밀어낸다. x, z 평면만 계산. */
export function resolvePlayer(pos, radius, boxes = MAP_BOXES) {
  for (let iter = 0; iter < 3; iter++) {
    for (const bx of boxes) {
      const cx = Math.max(bx.min[0], Math.min(pos.x, bx.max[0]));
      const cz = Math.max(bx.min[2], Math.min(pos.z, bx.max[2]));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // 중심이 상자 안: 가장 가까운 면으로 밀어냄
          const opts = [
            [bx.min[0] - radius - pos.x, 0], [bx.max[0] + radius - pos.x, 0],
            [0, bx.min[2] - radius - pos.z], [0, bx.max[2] + radius - pos.z],
          ];
          opts.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
          pos.x += opts[0][0];
          pos.z += opts[0][1];
        }
      }
    }
  }
  return pos;
}
