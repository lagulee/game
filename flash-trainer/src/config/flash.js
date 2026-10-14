// =============================================================
// src/config/flash.js : 플래시 수치는 전부 여기서 조정한다
// -------------------------------------------------------------
// [발로란트와 동일] = docs/flash-spec.md 에서 ✅(공식 패치 노트) 로 확인한 값
// [2차 출처]        = 🟡 공략 사이트 · 위키 검색 요약 등 한 군데에서만 확인한 값
// [근사값]          = ❌ 출처를 찾지 못해 임시로 정한 값. 게임 느낌을 보고 조정하면 된다.
// 단위: 초(s), 미터(m), 도(°)
// =============================================================

export const FLASH_TYPES = {
  phoenix: {
    name: '피닉스 커브볼',
    short: '커브볼',
    kind: 'flash',
    maxBlind: 1.5,        // [발로란트와 동일] 패치 5.01
    fuse: 0.6,            // [발로란트와 동일] 윈드업. 패치 11.00 (0.5 → 0.6)
    path: 'curve',        // 좌/우로 휘는 궤적
    throwAnim: 0.25,      // [근사값] 던지는 모션
    speed: 13,            // [근사값] 비행 속도 m/s
    turnRateDeg: 140,     // [근사값] 초당 방향 꺾임(도). 좌클릭=왼쪽, 우클릭=오른쪽 (곡선 방향은 2차 출처 확인)
    color: 0xffb35c,
  },
  skye: {
    name: '스카이 인도하는 빛',
    short: '스카이 매',
    kind: 'flash',
    blindMin: 1.0,        // [발로란트와 동일] 패치 5.07: 1s → 2.25s
    blindMax: 2.25,       // [발로란트와 동일]
    chargeTime: 0.75,     // [발로란트와 동일] 시전 후 0.75s 동안 최대치까지 충전
    popWindup: 0.5,       // [근사값] 스카이가 터뜨린(재사용) 뒤 실제 폭발까지
    path: 'hawk',
    throwAnim: 0.3,       // [근사값]
    speed: 10,            // [근사값] 매 비행 속도
    flightMin: 0.6,       // [근사값] 시전 → 재사용까지 비행 시간(무작위 범위)
    flightMax: 1.6,       // [근사값]
    color: 0x9cff9c,
  },
  yoru: {
    name: '요루 기습',
    short: '요루',
    kind: 'flash',
    maxBlind: 1.5,        // [발로란트와 동일] 패치 11.08 (1.75 → 1.5)
    bounceWindup: 0.6,    // [2차 출처] 단단한 면에 부딪힌 뒤 0.6s 윈드업
    path: 'bounce',
    throwAnim: 0.25,      // [근사값]
    speed: 22,            // [근사값] 벽까지 날아가는 속도
    reboundSpeed: 5,      // [근사값] 튕긴 뒤 윈드업 동안 움직이는 속도
    color: 0x7fb0ff,
  },
  kayoOver: {
    name: '케이/오 섬광 드라이브 (오버핸드)',
    short: '케이/오 ↑',
    kind: 'flash',
    maxBlind: 2.25,       // [발로란트와 동일] 패치 5.07
    fuse: 1.6,            // [2차 출처] 던진 뒤 약 1.6s
    bounceWindup: 0.8,    // [발로란트와 동일] 패치 10.06: 튕기면 0.8s 윈드업 (남은 시간이 더 짧으면 무시)
    path: 'lob',
    throwAnim: 0.3,       // [근사값]
    gravity: 9.8,         // [근사값] 포물선 중력
    throwSpeed: 16,       // [근사값] 벽에 튕기는 투척일 때 속도
    color: 0xb0e0ff,
  },
  kayoUnder: {
    name: '케이/오 섬광 드라이브 (언더핸드)',
    short: '케이/오 ↓',
    kind: 'flash',
    maxBlind: 1.5,        // [발로란트와 동일] 패치 10.06 (1.25 → 1.5)
    fuse: 1.0,            // [2차 출처] 약 1.0s
    bounceWindup: 0.8,    // [발로란트와 동일] 패치 10.06
    path: 'lob',
    throwAnim: 0.25,      // [근사값]
    gravity: 9.8,         // [근사값]
    throwSpeed: 12,       // [근사값]
    color: 0xb0e0ff,
  },
  breach: {
    name: '브리치 섬광 폭발',
    short: '브리치',
    kind: 'flash',
    maxBlind: 2.25,       // [발로란트와 동일] 패치 11.08 (2 → 2.25)
    fuse: 0.5,            // [2차 출처] 윈드업 0.5s (패치 1.07)
    path: 'through',      // 벽을 뚫고 나온다 → 시야 가림 판정은 폭발 위치 기준
    throwAnim: 0.3,       // [근사값]
    speed: 24,            // [2차 출처] 2400 유닛/s = 24 m/s (v12.00). 화면에서는 윈드업 동안 이 속도의 일부만 이동 [근사]
    travelFraction: 0.35, // [근사값] 윈드업 중 실제로 이동하는 비율 (화면에 보이는 거리 조절용)
    color: 0xffe08a,
  },
  reyna: {
    name: '레이나 눈총 (니어사이트)',
    short: '레이나 눈',
    kind: 'nearsight',
    nearsight: 1.6,       // [2차 출처] 근시 지속시간. [근사 해석] 눈이 활성화된 뒤 이 시간 동안 바라보는 사람에게 근시
    windup: 0.4,          // [2차 출처] 도착 후 0.4s
    travel: 0.55,         // [2차 출처] 최대 사거리 이동 시간
    hp: 60,               // [2차 출처] 체력 60
    path: 'eye',
    throwAnim: 0.25,      // [근사값]
    viewAngleDeg: 55,     // [근사값] 이 각도 안에서 눈을 바라보면 근시 (≈ 수평 FOV 의 절반)
    shotDamage: 40,       // [근사값] 좌클릭 한 발 피해 (60HP → 두 발에 파괴)
    color: 0xd060ff,
  },
};

// 눈뽕 판정 · 연출
export const BLIND = {
  // ---- (a) 시선 각도 → 지속시간 배율 [근사값] ----
  // θ = 시선 방향과 "눈 → 플래시" 방향 사이 각도.
  // θ ≤ fullAngleDeg 이면 100%, θ ≥ zeroAngleDeg 이면 0%, 그 사이는 코사인 곡선으로 부드럽게 줄어든다.
  // (공식 공식 미확인. "정면=최대, 옆=감소(화면 밖도 부분 눈뽕), 등지면 없음" 이라는 확인된 성질만 맞춘 근사)
  fullAngleDeg: 30,
  zeroAngleDeg: 110,
  minFactor: 0.05,          // [근사값] 이보다 약하면 눈뽕 없음으로 처리

  // ---- (b) 시야 가림 ----
  losCheck: true,           // 플래시와 눈 사이에 벽/상자가 있으면 눈뽕 없음

  // ---- (c) 거리 [근사값] ----
  // 위키 요약은 "거리도 영향"이라 하지만 수치가 없고, 다른 공략은 "거리 무관"이라 서술 → 기본은 꺼 둔다.
  distance: { enabled: false, fullRange: 10, zeroRange: 60 },

  // ---- 연출 ----
  fadeTime: 1.0,            // [2차 출처] 지속시간이 끝난 뒤 약 1초에 걸쳐 사라짐
  fadeScalesWithFactor: true, // [근사값] 약한 눈뽕은 페이드도 짧게
  fadeEase: 'easeOutQuad',  // [근사값] 페이드 곡선
  ringFreq: 2600,           // [근사값] 이명 주파수(Hz). CS:GO 레퍼런스. 발로란트 이명 존재 여부 미확인
};

// 니어사이트 연출 [근사값]
export const NEARSIGHT = {
  fadeIn: 0.15,
  fadeOut: 0.5,
};

// 훈련 규칙 기본값 (설정 화면에서 바꿀 수 있다)
export const TRAINING_DEFAULTS = {
  enabled: { phoenix: true, skye: true, yoru: true, kayoOver: true, kayoUnder: true, breach: true, reyna: false },
  distMin: 5,
  distMax: 14,
  windupScale: 1.0,   // 1.0 = 실제 윈드업. 연습용으로만 늘리거나 줄인다
  count: 1,
  gapMin: 1.5,
  gapMax: 4.0,
  allowBehind: false, // false 면 플래시는 플레이어 앞쪽 ±100° 안에서 터진다
};

// 반응 시간: 투척 순간부터 시점이 이 각도 이상 돌아가기 시작한 시각까지
export const REACTION_START_DEG = 2;

// 점수 구간 (게임 규칙, 발로란트와 무관)
export const GRADE = [
  { max: 0.001, label: '완벽 회피', cls: 'good' },
  { max: 0.35, label: '좋음', cls: 'good' },
  { max: 0.9, label: '보통', cls: 'mid' },
  { max: Infinity, label: '눈뽕', cls: 'bad' },
];
