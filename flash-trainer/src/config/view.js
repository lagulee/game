// =============================================================
// src/config/view.js : 감도 · 시야 · 이동 숫자 모음
// -------------------------------------------------------------
// [발로란트와 동일] = docs/flash-spec.md 에서 출처를 확인한 값
// [근사값]          = 출처를 찾지 못해 임시로 정한 값
// =============================================================

// [발로란트와 동일] 마우스 1카운트당 회전각(도). 감도 1.0 기준. 상하(pitch)도 같은 값.
export const VALORANT_YAW = 0.07;

// [발로란트와 동일] 다른 게임의 yaw (감도 변환기용)
export const OTHER_GAME_YAW = {
  cs2: { label: 'CS2 / CS:GO', yaw: 0.022 },
  apex: { label: 'Apex Legends', yaw: 0.022 },
  ow2: { label: '오버워치 2', yaw: 0.0066 },
};

// [발로란트와 동일] 16:9 화면에서의 수평 시야각(도). 화면 비율이 달라도 이 값을 유지한다.
export const HORIZONTAL_FOV_DEG = 103;

// 상하 시선 제한(도). 작업 지시서 값 (발로란트도 위·아래 끝에서 멈춘다)
export const PITCH_LIMIT_DEG = 89;

// 1인치 = 2.54 cm (정의값)
export const CM_PER_INCH = 2.54;

// [근사값] 눈 높이(m). 발로란트 캐릭터 눈 높이의 공식 수치는 찾지 못했다.
export const EYE_HEIGHT = 1.6;

// [근사값] 달리기 속도(m/s). 커뮤니티에서 흔히 말하는 6.75 m/s(=675 유닛/s)를 쓴다. 공식 출처 미확인.
export const RUN_SPEED = 6.75;
// [근사값] Shift 걷기 배율
export const WALK_MULT = 0.6;
// 플레이어 몸 반지름(m) — 벽에 끼지 않게 하는 충돌용
export const PLAYER_RADIUS = 0.35;

// 설정 기본값 (localStorage 에 저장된 값이 없을 때)
export const DEFAULT_SETTINGS = {
  map: 'open',     // 'open' = 빈 훈련장, 'course' = 구조물 맵
  dpi: 800,
  sens: 0.4,
  volume: 0.6,      // 효과음 전체 볼륨 (0~1)
  ringVolume: 0.35, // 이명 볼륨 (0~1). 귀 보호를 위해 낮게 시작
  showDebug: false,
};
