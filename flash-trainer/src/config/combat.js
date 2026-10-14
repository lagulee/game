// =============================================================
// src/config/combat.js : 총 · 봇 숫자 모음
// -------------------------------------------------------------
// [발로란트와 동일] = 출처 확인 (docs/flash-spec.md 6절)
// [근사값]          = 출처 없음, 훈련용으로 정한 값
// =============================================================

// 총: 밴달 기준
export const GUN = {
  name: '밴달',
  fireRate: 9.75,       // [발로란트와 동일] 초당 발사 수 (패치 1.07 이후)
  magazine: 25,         // [발로란트와 동일] 탄창
  reloadTime: 2.5,      // [근사값] 재장전 시간
  damage: { head: 160, body: 40, legs: 34 }, // [발로란트와 동일] 0~50m 피해량
  // ---- 탄 퍼짐 [근사값] : 발로란트 실제 반동 패턴이 아니라 단순화한 원뿔 퍼짐 ----
  firstShotSpreadDeg: 0,   // 멈춰서 쏜 첫 발은 정확
  accurateShots: 3,        // 연사해도 처음 이만큼은 퍼지지 않음 (발로란트도 첫 몇 발은 거의 정확)
  spreadPerShotDeg: 0.25,  // 그 뒤 한 발마다 늘어나는 퍼짐
  maxSprayDeg: 3.0,
  recoverTime: 0.35,       // 이 시간 동안 안 쏘면 퍼짐이 0으로 돌아옴
  moveSpreadDeg: 4.0,      // 달리면서 쏘면 추가 퍼짐 (발로란트도 이동 사격은 부정확)
  walkSpreadDeg: 1.5,      // Shift 걷기
};

// 봇
export const BOT = {
  hp: 150,              // [발로란트와 동일] 체력 100 + 중방어구 50
  // 몸 크기(m) [근사값]
  headY: 1.55, headR: 0.14,
  bodyMinY: 0.85, bodyMaxY: 1.42, bodyHalf: 0.24,
  legsMaxY: 0.85, legsHalf: 0.2,
  strafeRange: 1.0,     // [근사값] 좌우 무빙 폭 m (속도는 난이도별)
  peekDelay: 0.05,      // [근사값] 플래시가 터진 뒤 봇이 튀어나오기까지
  peekBehind: [2, 4],   // [근사값] 플래시 폭발 지점보다 몇 m 뒤에서 나오는지
};

// 봇 난이도 [훈련 규칙]
//   react  : 피킹 봇이 나타난 뒤 이 시간 안에 못 잡으면 "당함"
//   strafe : 좌우 무빙 속도(m/s). 0 이면 가만히 서 있다
export const BOT_LEVELS = {
  easy: { label: '쉬움', react: 3.0, strafe: 0 },
  normal: { label: '보통', react: 2.0, strafe: 1.5 },
  hard: { label: '어려움', react: 1.2, strafe: 3.0 },
};

export function botLevel(combatSettings) {
  return BOT_LEVELS[combatSettings.botLevel] || BOT_LEVELS.easy;
}

// 봇 모드 기본값 (설정 화면에서 바꿀 수 있다)
export const COMBAT_DEFAULTS = {
  botMode: 'peek',      // 'off' 끔 | 'peek' 플래시와 함께 피킹 | 'always' 사격장처럼 상주
  botLevel: 'easy',
  alwaysCount: 3,       // 상주 봇 수
};
// 저장된 설정 형식이 바뀌면 올린다 (옛 botReact 1.6 같은 값이 남지 않게)
export const COMBAT_SETTINGS_VERSION = 2;
