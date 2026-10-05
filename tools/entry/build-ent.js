// =============================================================
// tools/entry/build-ent.js : 증강 슈팅 "엔트리판" 작품(.ent) 만들기
// -------------------------------------------------------------
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js            → entry/증강슈팅_간단판.ent
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js 폴더       → 그 폴더에 temp/ 를 풀어서도 저장 (검사용)
//
// 엔트리는 JavaScript 를 실행할 수 없어서, 게임을 엔트리 블록으로 다시 만들었다.
//   - 30웨이브, 보스는 웹 게임과 같다: 5 돌진 대장 / 10 분열의 왕 / 15 파동 군주 / 20 회전 포대 /
//     25 돌진 대장 + 분열의 왕 / 30 블랙홀
//   - 일반 적은 3종 (기본 · 돌격형 · 사인파형) + 분열의 왕이 낳는 분열형
//   - 증강 6종 + 보급 2종 (카드 3장 중 하나, 클릭 또는 1 · 2 · 3 키)
// 그림은 웹 게임의 그리기 코드로 만든다 (tools/entry/sprites.js) → 웹 게임과 똑같은 모양
// 글자도 웹 게임처럼 테두리 글자: 글자 그림을 이어 붙여 쓴다 ("글씨" 오브젝트)
//
// 엔트리 무대는 480 × 270 (가운데가 0,0 / 위쪽이 +y). 웹 게임(960 × 540)의 절반이라
//   길이 = 웹 ÷ 2, 속도(프레임당) = 웹(px/초) ÷ 120, 시간 = 초 × 60 프레임
//   웹 좌표 (x, y) → 엔트리 (x ÷ 2 − 240, 135 − y ÷ 2)
// 화면은 변수 "상태"로 바뀐다:
//   메뉴 ↔ 조작법 / 도감,  메뉴 → 준비(웨이브 띠) → 전투 → 카드준비 → 고르기 → 준비 … → 결과
//   전투 ↔ 멈춤 → 재개("준비!") → 전투
// =============================================================

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { assemble } = require("./assemble.js");
const { makeSprites } = require("./sprites.js");

// ---- 조절용 상수 (엔트리 단위) ----
const WAVE_COUNT = 30;
// 보스 웨이브 (웹 게임과 같다)
const BOSS_WAVES = { 5: ["ck"], 10: ["sk"], 15: ["wl"], 20: ["tu"], 25: ["ck", "sk"], 30: ["bh"] };
// 보스 웨이브의 졸개 (웹 게임과 같은 수, 종류는 엔트리판의 3종: 1 기본, 2 돌격형, 3 사인파형)
const BOSS_MINIONS = { 5: [1, 1, 1, 1], 10: [2, 2, 3, 3], 15: [1, 1, 1, 3, 3], 20: [1, 1, 1, 1, 2], 25: [2, 2, 3, 3], 30: [2, 2, 3, 3, 1] };
// 숫자 조절판(만든 사람용)으로 바꿀 수 있는 값 = 엔트리 변수 "조절_이름". 웹의 tune() 값과 같은 단위 (px/초, 초)
//   [묶음, 이름, 설명(웹과 같다), 기본값, { int: 정수만, min: 이보다 작게는 못 바꿈 }]
const TUNES = [
  ["플레이어", "이동속도", "이동 속도 (px/초)", 220],
  ["플레이어", "시작체력", "시작 최대 체력", 100, { int: true, min: 1 }],
  ["플레이어", "무적시간", "맞은 뒤 무적 시간 (초)", 0.6],
  ["플레이어", "발사간격", "자동 발사 간격 (초)", 0.4, { min: 0.05 }],
  ["플레이어", "총알속도", "총알 속도 (px/초)", 480, { min: 1 }],
  ["플레이어", "기본대미지", "총알 기본 대미지", 10],
  ["플레이어", "웨이브회복", "웨이브 클리어 회복 (최대 체력 비율)", 0.05],
  ["플레이어", "보스회복", "보스 처치 회복 (최대 체력 비율)", 0.5],
  ["적 강화", "체력배율", "체력 배율 (1웨이브)", 0.5],
  ["적 강화", "체력증가", "체력 증가 (웨이브당)", 0.12],
  ["적 강화", "접촉배율", "접촉 대미지 배율 (1웨이브)", 0.5],
  ["적 강화", "접촉증가", "접촉 대미지 증가 (웨이브당)", 0.02],
  ["적 강화", "속도배율", "속도 배율 (1웨이브)", 1.5],
  ["적 강화", "속도증가", "속도 증가 (웨이브당)", 0.025],
  ["적 강화", "속도상한", "속도 배율 상한", 2.2],
  ["웨이브", "무리간격", "적 무리 등장 간격 (초)", 1.6, { min: 0.05 }],
  ["웨이브", "무리수", "한 무리 마릿수", 3, { int: true, min: 1 }],
].map(([group, key, label, def, o]) => Object.assign({ group, key, v: "조절_" + key, label, def, int: false, min: 0 }, o || {}));
const TUNE = Object.fromEntries(TUNES.map((t) => [t.key, t]));
// ---- 숫자 조절판 · 디버그 창 배치 (웹 px, 창 가운데 = 무대 가운데, 아래가 +y) ----
const TUNE_UI = (() => {
  const w = 900, h = 510, rowW = 412, rowH = 30;
  const groups = [], rows = [];
  for (const col of [{ x: -427, groups: ["플레이어"] }, { x: 10, groups: ["적 강화", "웨이브"] }]) {
    let y = -132;
    for (const g of col.groups) {
      groups.push({ name: g, x: col.x + 2, y }); y += 26;
      TUNES.forEach((t, i) => { if (t.group === g) { rows[i] = { x: col.x + rowW / 2, y }; y += 33; } });
      y -= 7;
    }
  }
  return { w, h, rowW, rowH, groups, rows, list: { x: -435, y: -150, w: 870, h: 345 },
    apply: { x: -330, y: 225 }, reset: { x: -157, y: 225 }, lock: { x: -24, y: 225 }, close: { x: 412, y: -219 }, saved: { x: 250, y: 225 },
    help: "줄을 누르고 대답 칸에 새 값을 쓰면 바로 바뀌고 엔트리 서버에 저장돼요 (모든 플레이어 · 다음 실행에도). 노란 줄 = 기본값과 다른 값" };
})();
// 디버그 · 지급 (G) 창: 증강 칸 = [레벨 +1 버튼][− 버튼] 3열, 보급 2칸
const GIVE_UI = (() => {
  const cols = [-330, -110, 110];
  return { w: 720, h: 360, cellW: 170, list: { x: -340, y: -60, w: 680, h: 222 }, groups: [{ name: "증강", x: -328, y: -42 }, { name: "보급", x: -328, y: 96 }],
    aug: (k) => ({ x: cols[k % 3] + 85, y: -8 + Math.floor(k / 3) * 52 }), minus: (k) => ({ x: cols[k % 3] + 193, y: -8 + Math.floor(k / 3) * 52 }),
    sup: (i) => ({ x: cols[i] + 106, y: 130 }), clear: { x: 290, y: -42 }, close: { x: 322, y: -144 } };
})();
// 디버그 · 보스 선택 (B) 창
const BOSS_UI = (() => {
  const cols = [-224, -4, 216];
  return { w: 720, h: 330, cellW: 212, list: { x: -340, y: -60, w: 680, h: 190 }, cell: (i) => ({ x: cols[i % 3], y: -8 + Math.floor(i / 3) * 66 }), close: { x: 322, y: -129 } };
})();
// 설정 창 (웹 SETTINGS_PANEL 과 같은 크기 · 자리. 엔트리 좌표)
const SET_UI = { w: 620, h: 418, x: 0, y: 8.5, close: { x: 139, y: 97 }, dbg: { x: 85.5, y: 54 }, tune: { x: -65.5, y: -78 },
  controls: [["이동", "방향키 · WASD"], ["발사", "가장 가까운 적에게 자동"], ["일시정지", "P · Esc"], ["카드 고르기", "클릭 · 1 2 3"], ["결과 화면", "R 다시 · M 메뉴"], ["게임 시작", "Enter · Space"], ["디버그", "` 키 (숫자 1 왼쪽)"]],
  debugKeys: [["[ ]", "웨이브 이동"], ["G", "증강 · 보급 지급"], ["B", "보스 선택"], ["Shift+0", "체력 가득"], ["I", "무적 켜고 끄기"]] };
// 웹 좌표(창 가운데 기준) → 엔트리
const uiPos = (p) => [p.x / 2, -p.y / 2];
// 주인 잠금: 비밀번호 자체는 어디에도 적지 않는다. 넣은 수 x 가 (x × PIN_MUL) mod PIN_MOD = PIN_CHECK 이면 통과
//   (0 ~ 10006 사이에서는 답이 하나뿐이다. 웹과 같은 비밀번호)
const PIN_MUL = 7919, PIN_MOD = 10007, PIN_CHECK = 2605;
const SIDE_BULLET_SCALE = 0.6;
const BANNER_FRAMES = 108;        // 웨이브 띠 1.8초
const CHOICE_DELAY = 24;          // 카드가 나온 뒤 0.4초는 고르지 않는다 (웹과 같다)
const RESUME_FRAMES = 30;         // "준비!" 0.5초
// 적 체력·속도·대미지 배율은 숫자 조절판 값 (엔트리판은 영구 업그레이드가 없어서 웹보다 순하게)
//   체력 배율 = 체력배율 × (1 + 체력증가 × (웨이브 − 1)), 접촉 대미지 배율도 같은 꼴, 속도 배율은 상한까지

// 적 종류 (웹 게임의 값. r = 엔트리 반지름, speed = 웹 px/초, parts = 죽을 때 파티클 색)
const T = {
  basic: { id: 1, r: 8, hp: 60, speed: 60, contact: 20, score: 100, parts: ["red", "red"] },
  charger: { id: 2, r: 8, hp: 40, speed: 70, contact: 30, score: 120, parts: ["brown", "brown"] },
  sine: { id: 3, r: 7.5, hp: 50, speed: 60, contact: 20, score: 120, parts: ["purple", "purple"] },
  splitter: { id: 4, r: 10, hp: 60, speed: 55, contact: 15, score: 150, parts: ["orange", "orange"] },
  child: { id: 5, r: 7, hp: 30, speed: 66, contact: 15, score: 60, parts: ["orange", "orange"] },
  ck: { id: 11, r: 17, hp: 600, speed: 70, contact: 30, score: 1000, parts: ["brown", "yellow"], boss: 1, name: "돌진 대장" },
  sk: { id: 12, r: 20, hp: 800, speed: 40, contact: 25, score: 1500, parts: ["orange", "yellow"], boss: 2, name: "분열의 왕" },
  wl: { id: 13, r: 17, hp: 1000, speed: 60, contact: 30, score: 2000, parts: ["blue", "yellow"], boss: 3, name: "파동 군주" },
  tu: { id: 14, r: 18, hp: 1200, speed: 80, contact: 30, score: 2500, parts: ["slate", "yellow"], boss: 4, name: "회전 포대" },
  bh: { id: 15, r: 20, hp: 1600, speed: 18, contact: 35, score: 3500, parts: ["purple", "orange"], boss: 5, name: "블랙홀" },
};
const TYPES = Object.values(T);
const SHAPE_PREFIX = { 1: ["e_basic", 0], 2: ["e_charger_", 1], 3: ["e_sine_", 0], 4: ["e_splitter_", 0], 5: ["e_splitterChild_", 0],
  11: ["b_ck_", 1], 12: ["b_sk", 2], 13: ["b_wl_", 0], 14: ["b_tu_", 0], 15: ["b_bh_", 0] };
// 정리할 때 비우지 않는 리스트 (글자 정보 · 팝업 폭 고리 · 필드 글자 수)
// 적 종류 표 (종류 번호 → 값): 블록 수를 줄이려고 종류마다 "만약" 대신 리스트에서 꺼낸다
const TYPE_TABLES = {
  적표체력: (t) => t.hp, 적표속도: (t) => +(t.speed / 120).toFixed(5), 적표반지름: (t) => t.r, 적표접촉: (t) => t.contact,
  적표점수: (t) => t.score, 적표파편1: (t) => t.parts[0], 적표파편2: (t) => t.parts[1],
  // 모양 이름 앞부분과 방향 방식 (0: 눈 8방향, 1: 몸 16방향, 2: 분열의 왕 = 분열 단계 + 눈 8방향). 기본 적은 웨이브에 따라 따로
  적표모양: (t) => SHAPE_PREFIX[t.id][0], 적표방향: (t) => SHAPE_PREFIX[t.id][1],
};
const KEEP_LISTS = ["글자폭", "글자그림폭", "글자그림높이", "팝업폭", "필드길이", "필드있음", "필드투명", "필드글", "필드x", "필드y", "필드색", "필드보임", ...Object.keys(TYPE_TABLES)];
// 대미지 숫자 폭을 적어 두는 고리 칸 수 (동시에 떠 있는 숫자보다 넉넉히)
const POPUP_RING = 200;
// 일반 적 반지름 (엔트리) 종류: 머리 위 체력바 폭을 반지름마다 따로 그린다
const EBAR_RADII = [...new Set(TYPES.filter((t) => t.id < 10).map((t) => t.r))];
const BOSS_LIST = TYPES.filter((t) => t.boss).sort((a, b) => a.boss - b.boss);
// 돌격형 (웹과 같다: 100px 안 또는 1.5초 → 예고 0.6초 → 3배 돌진 0.5초 → 쉬기 1초)
const CHARGER_TRIGGER = 100, CHARGER_APPROACH = 90, CHARGER_WARN = 36, CHARGER_DASH = 30, CHARGER_REST = 60, CHARGER_DASH_MULT = 3;
// 사인파형: 옆으로 A·ω·cos(ωt + φ) (A = 40 px, ω = 2.5 rad/초)
const SINE_OMEGA_DEG = 2.5 * 180 / Math.PI / 60;   // 프레임당 각도
const SINE_SIDE = 20 * (2.5 / 60);                  // 옆 속도 크기 (엔트리 px/프레임)
// 돌진 대장
const CK_ENTER_Y = 50, CK_FIRST_WARN = 48, CK_REAIM = 21, CK_DASH = 30, CK_DASH_MULT = 4, CK_REST = 120;
// 파동 군주: x = 165·sin(ωt), y = 87.5 + 6·sin(3ωt), 3초마다 12발, 화나면 0.5초 뒤 15° 어긋난 두 번째 겹
const WL_Y = 87.5, WL_A = 165, WL_OMEGA_DEG = 0.55 * 180 / Math.PI / 60, WL_FIRE = 180, WL_SECOND = 30;
// 회전 포대: ω = 1 rad/초 × (1 + 1.2 × 잃은 비율), 0.3초마다 4발, 10초마다 방향 반대 (1초 전 예고)
const TU_OMEGA_DEG = 180 / Math.PI / 60, TU_FIRE = 18, TU_FLIP = 600, TU_WARN = 60;
// 블랙홀: 당김 (범위 210, 세기 243 ÷ d², 상한 0.028, 마찰 0.967), 지평선 25, 약점 8초 중 마지막 3초, 평소 30%
const BH_RANGE = 210, BH_PULL = 243, BH_PULL_MAX = 0.028, BH_FRICTION = 0.967, BH_HORIZON = 25, BH_KICK = 2.67;
const BH_PERIOD = 480, BH_WEAK = 180, BH_ARMOR = 0.3, BH_BEND = 104, BH_BEND_MAX = 0.35, BH_HORIZON_DMG = 40;
const ENEMY_BULLET_SPEED = 1.333;  // 웹 160 px/초
const WL_BULLET_DMG = 14, TU_BULLET_DMG = 12;
// 증강 (카드 1~6)
const AUGS = [
  { v: "촉매", name: "촉매", color: "green", concept: "화학 · 반응 속도", formula: "간격 × 0.85", max: 3,
    levelDesc: ["촉매는 반응에 필요한 에너지 언덕을 낮춰 반응을 빠르게 한다. 발사 간격 15% 감소 (0.4초 → 0.34초)", "더 좋은 촉매! 발사 간격 25% 감소 (0.4초 → 0.3초)", "최고의 촉매! 발사 간격 33% 감소 (0.4초 → 0.27초)"] },
  { v: "삼방향", name: "3방향 탄", color: "yellow", concept: "수학 · 각도", formula: "360° ÷ n", max: 3,
    levelDesc: ["한 번에 3발을 360° ÷ 3 = 120° 간격으로 쏜다. 조준한 총알은 그대로, 나머지는 대미지 0.6배", "5발로 늘어난다! 360° ÷ 5 = 72° 간격, 나머지 대미지 0.6배", "6발! 360° ÷ 6 = 60° 간격 (정육각형 모양), 나머지 대미지 0.6배"] },
  { v: "복리", name: "복리 탄환", color: "yellow", concept: "수학 · 지수함수", formula: "(1 + r)ⁿ", max: 3,
    levelDesc: ["이자에 이자가 붙듯 공격력이 불어난다. 공격력 × 1.2", "공격력 × 1.44 (= 1.2²)", "공격력 × 1.73 (= 1.2³)"] },
  { v: "지연", name: "시간 지연", color: "green", concept: "물리 · 특수 상대성 이론", formula: "√(1 − (v/c)²)", max: 3,
    levelDesc: ["움직이는 동안 반경 90px 안의 적이 0.2배 속도로 느려진다 (보스는 0.6배)", "시간이 느려지는 범위가 넓어진다! 반경 90px → 115px", "시간 지연 범위 최대! 반경 115px → 140px"] },
  { v: "넉백", name: "넉백", color: "brown", concept: "물리 · 작용 반작용", formula: "v₀ ÷ 감쇠율", max: 3,
    levelDesc: ["맞은 적이 뒤로 밀려난다. 처음 속도 240 (약 40px)", "더 세게 민다! 처음 속도 240 → 360 (약 60px)", "가장 세게 민다! 처음 속도 360 → 480 (약 80px)"] },
  { v: "분산", name: "분산 증폭", color: "red", concept: "통계 · 평균과 분산", formula: "평균 1.1, 분산 ↑", max: 3,
    levelDesc: ["한 발마다 0.2배 ~ 2.5배 사이에서 크게 흔들린다. 평균은 1.1배", "더 크게 흔들린다! 최대 배율 2.5배 → 3배 (평균은 여전히 1.1배)", "극한의 분산! 최대 배율 3배 → 3.5배 (그래도 평균은 1.1배)"] },
];
const SUPPLIES = [
  { name: "세포 분열", color: "purple", concept: "생물 · 세포 분열", formula: "최대 체력 +20", desc: "세포가 둘로 나뉘며 몸이 커진다. 최대 체력 +20, 체력도 +20" },
  { name: "항상성", color: "green", concept: "생물 · 항상성", formula: "체력 +40%", desc: "몸이 스스로 균형을 되찾는다. 최대 체력의 40% 만큼 회복" },
];
const CATALYST = [0, 0.15, 0.25, 0.33];
const MULTI_COUNT = [1, 3, 5, 6];
const KNOCK_SPEED = [0, 2, 3, 4];                 // 웹 240 / 360 / 480 px/초
const PUSH_DECAY = Math.exp(-6 / 60);             // 밀리는 속도가 프레임마다 줄어드는 비율
const VARIANCE_MAX = [0, 2.5, 3, 3.5];
// 상태창 (웹: 왼쪽 위 (12, 12), 폭 290. 엔트리판은 코인 줄이 없어 높이 104)
const HUD_H = 104;
const HP_WIDTHS = [140, 168, 196, 224, 252, 258];  // 최대 체력 100 · 120 · … 200+ 일 때 체력바 길이 (웹과 같다)
const IN_GAME = ["준비", "전투", "카드준비", "고르기", "멈춤", "재개", "결과", "잠금", "지급", "보스선택"];
// 메뉴 화면이 뒤에 깔리는 상태 (설정 · 숫자 조절 · 비밀번호 · 메뉴에서 연 보스 선택)
const MENU_BG = ["메뉴", "설정", "설정잠금", "메뉴잠금", "조절", "조절입력", "메뉴보스"];
// 디버그 · 설정 창이 떠 있는 상태 (뒤를 어둡게)
const PANEL_STATES = ["설정", "설정잠금", "메뉴잠금", "잠금", "조절", "조절입력", "지급", "보스선택", "메뉴보스"];
// 디버그 키 ([ ] G Shift+0) 가 듣는 게임 상태
const DEBUG_GAME = ["준비", "전투", "카드준비", "고르기", "멈춤", "재개"];
// 상태창 글씨가 보이는 상태 (일시정지 중에는 판이 상태창을 덮으니 숨긴다) · 어둡게 깔리는 상태 (글씨도 같이 어둡게)
const HUD_TEXT = ["준비", "전투", "카드준비", "고르기", "재개", "결과"];
const DIMMED = ["카드준비", "고르기", "결과"];
// 체력이 이 비율보다 낮으면 카드에 회복 보급 카드가 꼭 1장 (웹 LOW_HP_RATIO)
const LOW_HP_RATIO = 0.4;
const FIGHT_VIEW = ["준비", "전투", "카드준비", "재개"];   // 대미지 숫자 · 파티클이 보이는 상태
// 결과 창이 기운 각도 (웹 −0.025 rad, 엔트리는 시계 방향이 +)
const RESULT_ROT = -0.025 * 180 / Math.PI;

// ---- 웹 좌표 → 엔트리 좌표 ----
const ex = (x) => x / 2 - 240;
const ey = (y) => 135 - y / 2;

// =============================================================
// 글자 (테두리 글자 그림): 쓰이는 모든 글자를 모은다
// =============================================================
const TEXT_SAMPLES = [
  "0123456789 /:+-·→.!", "챕터 · 웨이브 / 30", "점수 최고 점수", "최고 기록: 웨이브", "지난 최고 기록: 웨이브 없음 → 이번: 웨이브",
  "생존 0:00 · 잡은 보스 0마리", "증강: 모은 증강 없음", "회복", "최대 체력 +20", "사건의 지평선!", "Lv.",
  ...AUGS.map((a) => a.name),
];
const GLYPH_COLORS = [["흰", "#F7F4EA"], ["노랑", "#F2C14E"], ["초록", "#6FB04A"], ["빨강", "#D9482B"], ["검", "#2B2118"]];   // 검 = 테두리 없는 글자
// 글자 그림 묶음: 웹과 같은 글자 크기(px) · 색마다 쓰는 글자만 그린다 (숫자와 빈칸은 늘 포함)
//   엔트리(WebGL)는 그림을 크게 줄이면 테두리가 깨지니, 크기마다 따로 그려서 줄이지 않고 쓴다
const DIGITS = "0123456789 ";
// 대미지 숫자 크기 (웹: 16 + √대미지 × 3) → 가장 가까운 묶음을 골라 조금만 늘이거나 줄인다
const POPUP_SIZES = [18, 22, 27, 33, 40, 50];
const RECORD_TEXT = "지난 최고 기록: 웨이브 없음  →  이번: 웨이브";
const GLYPH_SET_DEFS = [
  ["흰", 20, "챕터 · 웨이브 / 30"], ["흰", 16, " /"], ["노랑", 22, "점수 "], ["노랑", 20, "최고 기록: 웨이브 "],
  ["흰", 36, "점수 "], ["흰", 18, "최고 점수 생존 0:00 · 잡은 보스 0마리"], ["초록", 19, RECORD_TEXT], ["노랑", 19, RECORD_TEXT],
  ["흰", 15, "증강: 모은 증강 없음 Lv. · " + AUGS.map((a) => a.name).join(" ")],
  ...POPUP_SIZES.flatMap((size) => ["흰", "노랑", "빨강"].map((c) => [c, size, "-"])),
  ["초록", 22, "+ 회복 최대 체력 +20"], ["빨강", 22, "사건의 지평선!"],
  // 디버그 (웹 drawDebug 와 같은 크기 · 색): DEBUG 16 노랑, 키 안내 13 흰, 알림 15 초록 (비밀번호 틀림 등은 빨강)
  ["노랑", 16, "DEBUG · 무적"], ["흰", 13, "[ ] 웨이브  G 지급  B 보스  Shift+0 체력  I 무적  ` 끄기"],
  ["초록", 15, "디버그 모드 ON OFF 웨이브 로 이동 체력 가득! 무적 모두 기본값으로 잠갔어요 바뀐 값으로 다시 시작해요 보스:"],
  ["빨강", 15, "증강 지급은 전투 중에만 비밀번호가 달라요 숫자를 넣어 주세요 보다 작게는 못 바꿔요"],
  // 숫자 조절판 입력칸 (웹 input: 16px 검은 글자)
  ["검", 16, ".-"],
];
// 디버그 알림 글 (위 글자 묶음에 들어 있는 글자만 쓴다)
const DEBUG_KEYS_HELP = "[ ] 웨이브  G 지급  B 보스  Shift+0 체력  I 무적  ` 끄기";
const GLYPHS = [...new Set((TEXT_SAMPLES.join("") + DIGITS + GLYPH_SET_DEFS.map((d) => d[2]).join("")).split(""))];
const GLYPH_STR = GLYPHS.join("");
const GLYPH_SETS = (() => {
  const byName = {};
  for (const [c, size, sample] of GLYPH_SET_DEFS) {
    const name = c + size;
    const set = byName[name] || (byName[name] = { name, size, color: GLYPH_COLORS.find((g) => g[0] === c)[1], plain: c === "검", chars: new Set() });
    for (const ch of sample + DIGITS) set.chars.add(GLYPHS.indexOf(ch));
  }
  return Object.values(byName).map((x) => Object.assign(x, { chars: [...x.chars].sort((a, b) => a - b) }));
})();
const GLYPH_SIZES = [...new Set(GLYPH_SETS.map((x) => x.size))].sort((a, b) => a - b);
const glyphHeight = (size) => Math.ceil(size * 1.4 + 8);   // sprites.js 와 같은 식

// 웨이브 띠 부제 (증강 이름 Lv.N 획득! / 레벨업!, 보급: 이름: 수식) — 웹과 같다
const BANNER_SUBS = [];
const SUB_INDEX = {};
AUGS.forEach((a, k) => { for (let lv = 1; lv <= a.max; lv++) { SUB_INDEX[k + "_" + lv] = BANNER_SUBS.length + 1; BANNER_SUBS.push(a.name + " Lv." + lv + (lv > 1 ? " 레벨업!" : " 획득!")); } });
SUPPLIES.forEach((s, i) => { SUB_INDEX["s" + i] = BANNER_SUBS.length + 1; BANNER_SUBS.push(s.name + ": " + s.formula); });

// 그림 목록에 넘길 카드 (증강 k 의 지금 레벨 L 일 때 보이는 카드)
function cardSpecs() {
  const list = [];
  AUGS.forEach((a, k) => {
    for (let L = 0; L < a.max; L++) list.push({ key: "card_" + k + "_" + L, name: a.name, concept: a.concept, formula: a.formula, color: a.color, desc: a.levelDesc[L],
      badge: L === 0 ? "NEW!" : "Lv." + L + " → Lv." + (L + 1), badgeColor: L === 0 ? "yellow" : "green" });
  });
  SUPPLIES.forEach((s, i) => list.push({ key: "card_s" + i, name: s.name, concept: s.concept, formula: s.formula, color: s.color, desc: s.desc, badge: "보급", badgeColor: "orange" }));
  return list;
}

// =============================================================
// 변수 · 리스트
// =============================================================
const GLOBALS = ["상태", "팝업순번", "디버그", "디버그무적", "치트무적", "주인확인", "이전상태", "요청종류", "알림글", "알림색", "알림시간", "흔들시간", "비번틀림", "끝",
  "입력값", "이동웨이브", "시작웨이브", "조절칸", "조절바뀜", "디버그글", "웨이브", "체력", "최대체력", "점수", "최고웨이브", "최고점수", "지난최고", "지난최고글", "새점수기록", "신기록", "결과종류", "생존", "잡은보스",
  "배너시간", "배너보스", "배너부제", "다음부제", "배너진행", "배너알파", "조준거리", "무적", "남은적", "다음종류", "대미지배율",
  "후보거리", "후보x", "후보y", "목표x", "목표y", "목표있음", "바라봄",
  "발사타이머", "발사간격", "공격력", "쏠vx", "쏠vy", "이동x", "이동y", "움직임", "끌림vx", "끌림vy",
  "카드1", "카드2", "카드3", "카드수", "남은증강", "보급순서", "카드들림1", "카드들림2", "카드들림3", "뽑기", "가능", "생성수", "고른카드", "고르기시간", "멈춤시간", "타이머숨",
  "보스1종류", "보스1체력", "보스1최대", "보스2종류", "보스2체력", "보스2최대",
  "파동x", "파동y", "파동있음", "포대x", "포대y", "포대각", "포대예고", "포대방향", "포대있음", "블랙홀x", "블랙홀y", "블랙홀약점", "블랙홀있음", "블랙홀시간",
  "분산배율", "분산높음", "분산p", "회복량", "바만듦", "선만듦", "글자표", "증강수", "증강글1", "증강글2", "생존글", "체력바길이", "세는수",
  ...AUGS.map((a) => a.v)];
const LOCALS = {
  글씨: ["복제본", "필드", "칸", "팝업", "글", "이전글", "기준x", "기준y", "이전x", "배율", "색이름", "정렬", "회전", "내글자", "글자번호", "앞폭", "전체폭",
    "번호j", "폭j", "lx", "나이", "수명", "크기값", "튀김", "값", "종류", "길이", "내팝업", "이전색", "이전투명", "글크기", "크기칸"],
  적: ["복제본", "종류", "적체력", "적최대", "속도", "단계", "단계시간", "거리", "느림", "번쩍", "번호", "반지름", "맞은대미지", "각", "눈각", "변",
    "모양", "태어난웨이브", "밀기x", "밀기y", "흔들", "남은돌진", "화남", "보스칸", "분열단계", "파동t", "발사", "두번째", "링각", "포대각속", "예고시간", "dx", "dy",
    "돌진x", "돌진y", "새x", "새y", "k", "바위", "모양앞", "방향식"],
  총알: ["복제본", "vx", "vy", "나이", "속력", "bx", "by", "bd", "ba", "각"],
  보조총알: ["복제본", "vx", "vy", "각", "나이", "속력", "bx", "by", "bd", "ba"],
  적탄: ["복제본", "vx", "vy", "피해"],
  파편: ["복제본", "vx", "vy", "크기", "회전속도", "나이", "개수", "색", "k", "모양번호"],
  카드: ["복제본", "칸", "내카드", "카드모양", "나이", "배율", "들림", "등장"],
  카드번호: ["복제본", "칸", "나이", "등장", "배율", "들림", "각", "ox", "oy"],
  증강줄: ["복제본", "칸", "앞수"],
  멈춤증강: ["복제본", "칸", "앞수"],
  적체력바: ["복제본", "내번호", "비율"],
  예고선: ["복제본", "내번호", "선각"],
  보스이름: ["복제본", "칸"],
  보스바: ["복제본", "칸"],
  도감카드: ["복제본", "칸"],
  메뉴장식: ["복제본", "칸"],
  체력바: ["칸", "폭번호"],
  체력번쩍: ["이전최대", "번쩍"],
  보스고르기: ["복제본", "칸"], 지급빼기: ["복제본", "칸", "값"], 지급줄: ["복제본", "칸", "값"], 지급보급: ["복제본", "칸"], 조절줄: ["복제본", "칸", "값"],
};
const LISTS = ["팝업x", "팝업y", "팝업값", "팝업종류", "슬롯x", "슬롯y", "슬롯비율", "슬롯선각", "슬롯선진함", "슬롯보스", "슬롯폭",
  "생성종류", "생성x", "생성y", "생성밀기x", "생성밀기y", "탄x", "탄y", "탄각", "탄피해", "파편x", "파편y", "파편색1", "파편색2", ...KEEP_LISTS];

// =============================================================
// 설계
// =============================================================
function design(sp) {
  const variables = GLOBALS.map((name) => ({ name, value: name === "글자표" ? GLYPH_STR : name === "시작웨이브" ? 1 : name === "디버그글" ? "DEBUG" : name === "알림색" ? "초록" : 0 }));
  // 숫자 조절판 값 (처음 = 기본값). 엔트리 "실시간 변수": 값이 엔트리 서버에 저장되어,
  //   조절판에서 바꾸면 작품을 다시 열어도 · 다른 사람이 해도 그 값으로 돈다 (온라인에 저장한 작품에서)
  for (const t of TUNES) variables.push({ name: t.v, value: t.def, realTime: true });
  for (const obj in LOCALS) for (const name of LOCALS[obj]) variables.push({ name, local: obj, value: 0 });
  const listInit = {
    글자폭: GLYPHS.map((g, i) => +sp["adv_" + i].adv.toFixed(2)),
    // (크기칸 × 글자 수 + 글자 번호) 칸에 그 크기 글자 그림의 폭, 글자그림높이 는 크기마다 그림 높이
    글자그림폭: GLYPH_SIZES.flatMap((size) => GLYPHS.map((g, i) => { const set = GLYPH_SETS.find((x) => x.size === size && x.chars.includes(i)); return set ? sp["g_" + set.name + "_" + i].w : 0; })),
    글자그림높이: GLYPH_SIZES.map(glyphHeight),
    팝업폭: Array.from({ length: POPUP_RING }, () => 0),
  };
  const maxId = Math.max(...TYPES.map((t) => t.id));
  for (const [name, f] of Object.entries(TYPE_TABLES)) listInit[name] = Array.from({ length: maxId }, (_, i) => { const t = TYPES.find((x) => x.id === i + 1); return t ? f(t) : 0; });
  const messages = ["게임시작", "메뉴로", "정리", "목록비우기", "도감열기", "웨이브진행", "감시", "웨이브이동", "능력갱신", "창닫기", "디버그끄기", "잠금열기", "잠금성공", "조절입력", "조절열기", "지급열기", "보스열기", "카드보이기", "카드선택", "발사"];
  // 그림 하나 → 오브젝트 모양
  const pic = (key, name) => ({ name: name || key, png: sp[key].png, width: sp[key].w, height: sp[key].h });
  const pics = (keys) => keys.map((k) => pic(k));
  const baseSize = (key) => (sp[key].w + sp[key].h) / 2 * 0.5;   // 엔트리 "크기" (가로·세로 평균, 50%)

  // ---- 자주 쓰는 블록 묶음 ----
  // 숫자 조절판 값 (엔트리 단위로): TV = 그대로, 속도 px/초 → 프레임당 (÷ 120), 시간 초 → 프레임 (× 60)
  const TV = (B, key) => B.v(TUNE[key].v);
  const TVspeed = (B, key) => B.div(TV(B, key), 120);
  const TVframes = (B, key) => B.mul(TV(B, key), 60);
  const invFrames = (B) => TVframes(B, "무적시간");
  // 증강 레벨로 공격력 · 발사 간격을 다시 계산 (카드 고르기 · 디버그 지급)
  const statsRecompute = (B) => [
    B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
    B.set("공격력", TV(B, "기본대미지")), B.repeat(B.v("복리"), [B.set("공격력", B.mul(B.v("공격력"), 1.2))]),
    B.set("발사간격", TVframes(B, "발사간격")),
    ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("촉매"), "=", lv), [B.set("발사간격", B.mul(TVframes(B, "발사간격"), 1 - CATALYST[lv]))])),
  ];
  // 디버그 치트 무적이 아닐 때만 맞는다
  const canHurt = (B) => B.cmp(B.v("치트무적"), "=", 0);
  const stateIs = (B, s) => B.cmp(B.v("상태"), "=", s);
  const stateIn = (B, list) => list.slice(1).reduce((acc, st) => B.or(acc, stateIs(B, st)), stateIs(B, list[0]));
  const fighting = (B) => stateIs(B, "전투");
  const showIn = (B, list, extra) => B.ifElse(extra ? B.and(stateIn(B, list), extra) : stateIn(B, list), [B.show()], [B.hide()]);
  const outside = (B) => B.or(B.cmp(B.mathOp("abs", B.myX()), ">", 250), B.cmp(B.mathOp("abs", B.myY()), ">", 145));
  // 리스트 비우기: 반복은 한 바퀴에 한 프레임이 걸리니 한 바퀴에 10칸씩 지운다
  const clearList = (B, name) => [
    B.repeatUntil(B.cmp(B.listLen(name), "<", 10), Array.from({ length: 10 }, () => B.listRemove(name, 1))),
    B.repeatUntil(B.cmp(B.listLen(name), "=", 0), [B.listRemove(name, 1)]),
  ];
  // 보일 상태가 아니면 숨고, 그 상태가 될 때까지 기다리기만 한다 (매 프레임 할 일을 줄여 빠르게)
  const whileIn = (B, states, body) => B.ifElse(stateIn(B, states), body, [B.hide(), B.waitUntil(stateIn(B, states))]);
  // 오래 남는 복제본은 msg 를 받으면 지우고 원본이 다시 만든다.
  //   엔트리는 처음 그림 불러오기가 끝날 때 화면 순서를 한 번 다시 정리하는데, 그 전에 ▶ 를 누르면
  //   그때 있던 복제본이 화면에서 빠진다 (보이지 않게 됨). 웨이브 · 게임 시작 · 메뉴마다 새로 만들어 되살린다
  const remake = (B, msg, create) => B.when.msg(msg, [B.ifElse(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()], create)]);
  const isClone = (B) => B.cmp(B.v("복제본"), "=", 1);
  const isOrig = (B) => B.cmp(B.v("복제본"), "=", 0);
  // 각도 (반시계, 0~360): atan(dy ÷ dx), dx 가 음수면 +180
  const setAngle = (B, name, dx, dy) => [
    B.set(name, B.mathOp("atan_radian", B.div(dy, B.add(dx, 0.0001)))),
    B.iff(B.cmp(dx, "<", 0), [B.change(name, 180)]),
    B.set(name, B.mod(B.add(B.v(name), 360), 360)),
  ];
  const dir8 = (B, a) => B.mod(B.mathOp("round", B.div(a, 45)), 8);
  const dir16 = (B, a) => B.mod(B.mathOp("round", B.div(a, 22.5)), 16);
  // 바운스 (웹 popupScale): 0~6프레임 0.3 → 1.6, 6~15프레임 1.6 → 1, 그 뒤 1
  const bounce = (B, target, age) => [
    B.set(target, 1),
    B.iff(B.cmp(age, "<", 15), [B.set(target, B.sub(1.6, B.mul(0.6, B.div(B.sub(age, 6), 9))))]),
    B.iff(B.cmp(age, "<", 6), [B.set(target, B.add(0.3, B.mul(1.3, B.div(age, 6))))]),
  ];
  // 대미지 숫자·글자 팝업 대기열: 종류 1 대미지, 2 내가 맞음(−N), 3 회복(+N 회복), 4 "최대 체력 +20", 5 "사건의 지평선!"
  const popup = (B, x, y, val, kind) => [B.listAdd("팝업x", x), B.listAdd("팝업y", y), B.listAdd("팝업값", val), B.listAdd("팝업종류", kind)];
  const particles = (B, x, y, c1, c2) => [B.listAdd("파편x", x), B.listAdd("파편y", y), B.listAdd("파편색1", c1), B.listAdd("파편색2", c2)];
  const playerX = (B) => B.coord("플레이어", "x");
  const playerY = (B) => B.coord("플레이어", "y");
  // 버튼: 보일 상태 + 마우스를 올리면 1.04배 (웹과 같다) + 누르면 할 일. pulse = 숨 쉬기 (1.5초마다 3%)
  const button = (name, key, x, y, states, onClick, opts) => {
    const o = opts || {};
    const base = baseSize(key);
    return {
      name, pictures: [pic(key, name)], scale: 0.5, x, y, visible: false, rotation: o.rot || 0,
      scripts: (B) => [
        B.when.run([B.hide(), B.forever([whileIn(B, states, [
          B.show(),
          B.ifElse(B.touching("mouse"), [B.size(base * 1.04)],
            [o.pulse ? B.size(B.mul(base, B.add(1, B.mul(0.03, B.mathOp("sin", B.mul(B.v("타이머숨"), 4)))))) : B.size(base)]),
        ])])]),
        B.when.click([B.iff(stateIn(B, o.clickStates || states), onClick(B))]),
      ],
    };
  };
  const sprite = (name, keys, x, y, states, extraLoop, opts) => {
    const o = opts || {};
    return { name, pictures: pics(keys), scale: 0.5, x, y, visible: false, rotation: o.rot || 0, scripts: (B) => [
      B.when.run([B.hide(), B.forever([whileIn(B, states, [o.cond ? B.ifElse(o.cond(B), [B.show()], [B.hide()]) : B.show(), ...(extraLoop ? extraLoop(B) : [])])])]),
    ] };
  };

  // =============================================================
  // 글자 판 (필드): 상태창 · 결과 · 메뉴의 바뀌는 글
  //   x, y: 엔트리 좌표 / size: 웹 글자 크기(px) / align: 0 왼쪽, 0.5 가운데, 1 오른쪽 / rot: 기울기
  // =============================================================
  const rr = RESULT_ROT * Math.PI / 180;
  // 결과 창 가운데를 기준으로 (x, y) 를 창 기울기만큼 돌린 자리 (시계 방향 φ: x' = x·cosφ + y·sinφ, y' = −x·sinφ + y·cosφ)
  const rotP = (x, y) => [x * Math.cos(rr) + y * Math.sin(rr), -x * Math.sin(rr) + y * Math.cos(rr)];
  const FIELDS = [
    // 상태창 (웹: "챕터 C · 웨이브 W / 30" 22px, 체력 숫자 16px, "점수 S" 22px 노랑)
    { states: HUD_TEXT, dim: true, x: () => ex(28), y: () => ey(34), size: 20, color: "흰", align: 0, maxLen: 18,
      text: (B) => B.join("챕터 ", B.join(B.mathOp("ceil", B.div(B.v("웨이브"), 5)), B.join(" · 웨이브 ", B.join(B.v("웨이브"), " / " + WAVE_COUNT)))) },
    { states: HUD_TEXT, dim: true, x: (B) => B.add(ex(28), B.div(B.v("체력바길이"), 4)), y: () => ey(63), size: 16, color: "흰", align: 0.5, maxLen: 9,
      text: (B) => B.join(B.mathOp("ceil", B.v("체력")), B.join(" / ", B.mathOp("round", B.v("최대체력")))) },
    { states: HUD_TEXT, dim: true, x: () => ex(28), y: () => ey(96), size: 22, color: "노랑", align: 0, maxLen: 10, text: (B) => B.join("점수 ", B.v("점수")) },
    // 메뉴: 최고 기록
    { states: ["메뉴"], x: () => 0, y: () => ey(368), size: 20, color: "노랑", align: 0.5, maxLen: 12, text: (B) => B.join("최고 기록: 웨이브 ", B.v("최고웨이브")) },
    // 결과 창 (웹과 같은 자리, 창과 함께 기울어짐)
    { states: ["결과"], x: () => rotP(0, 40)[0], y: () => rotP(0, 40)[1], size: 36, color: "흰", align: 0.5, maxLen: 10, rot: RESULT_ROT, text: (B) => B.join("점수 ", B.v("점수")) },
    { states: ["결과"], x: () => rotP(0, 24)[0], y: () => rotP(0, 24)[1], size: 18, color: "흰", align: 0.5, maxLen: 13, rot: RESULT_ROT, text: (B) => B.join("최고 점수 ", B.v("최고점수")) },
    // 지난 최고 기록 → 이번 (기록을 깼으면 초록, 아니면 노랑)
    { states: ["결과"], x: () => rotP(0, 9)[0], y: () => rotP(0, 9)[1], size: 19, colorByRecord: true, align: 0.5, maxLen: 34, rot: RESULT_ROT,
      text: (B) => B.join("지난 최고 기록: ", B.join(B.v("지난최고글"), B.join("  →  이번: 웨이브 ", B.v("웨이브")))) },
    { states: ["결과"], x: () => rotP(0, -6)[0], y: () => rotP(0, -6)[1], size: 18, color: "흰", align: 0.5, maxLen: 24, rot: RESULT_ROT, text: (B) => B.v("생존글") },
    { states: ["결과"], x: () => rotP(0, -21)[0], y: () => rotP(0, -21)[1], size: 15, color: "흰", align: 0.5, maxLen: 40, rot: RESULT_ROT, text: (B) => B.v("증강글1") },
    { states: ["결과"], x: () => rotP(0, -31)[0], y: () => rotP(0, -31)[1], size: 15, color: "흰", align: 0.5, maxLen: 40, rot: RESULT_ROT, text: (B) => B.v("증강글2") },
  ];
  // 숫자 조절판 입력칸 값 (웹 input 처럼 16px 검은 글자)
  TUNES.forEach((t, i) => { const r = TUNE_UI.rows[i];
    FIELDS.push({ states: ["조절", "조절입력"], x: () => (r.x + TUNE_UI.rowW / 2 - 48) / 2, y: () => -r.y / 2, size: 16, color: "검", align: 0.5, maxLen: 8, text: (B) => B.v(t.v) }); });
  // 디버그 표시 (웹 drawDebug: 왼쪽 아래 구석) · 알림
  const htmlOpen = (B) => stateIn(B, ["조절", "조절입력", "지급", "보스선택", "메뉴보스", "잠금", "설정잠금", "메뉴잠금"]);
  FIELDS.push({ states: null, cond: (B) => B.and(B.cmp(B.v("디버그"), "=", 1), B.not(htmlOpen(B))), x: () => ex(14), y: () => ey(522), size: 16, color: "노랑", align: 0, maxLen: 12, text: (B) => B.v("디버그글") });
  FIELDS.push({ states: null, cond: (B) => B.and(B.cmp(B.v("디버그"), "=", 1), B.not(htmlOpen(B))), x: () => ex(14), y: () => ey(500), size: 13, color: "흰", align: 0, maxLen: DEBUG_KEYS_HELP.length, text: () => DEBUG_KEYS_HELP });
  FIELDS.push({ states: null, cond: (B) => B.cmp(B.v("알림시간"), ">", 0), x: () => ex(14), y: () => ey(478), size: 15, colorVar: "알림색", align: 0, maxLen: 24, text: (B) => B.v("알림글") });
  const MAX_FIELD_LEN = Math.max(...FIELDS.map((f) => f.maxLen));
  listInit.필드길이 = FIELDS.map((f) => f.maxLen);
  for (const l of ["필드있음", "필드투명", "필드글", "필드x", "필드y", "필드색", "필드보임"]) listInit[l] = FIELDS.map(() => 0);
  const POPUP_MAX_LEN = 10;

  const objects = [];

  // ================= 글씨 (맨 앞) =================
  objects.push({
    // 모양 이름: 색 + 웹 글자 크기 + "_" + 글자 번호 (예: 흰20_5)
    name: "글씨", pictures: GLYPH_SETS.flatMap((set) => set.chars.map((i) => { const g = sp["g_" + set.name + "_" + i]; return { name: set.name + "_" + (i + 1), png: g.png, width: g.w, height: g.h }; })),
    scale: 0.5, visible: false,
    scripts: (B) => {
      const advOf = (idx) => B.listItem("글자폭", idx);
      const NG = GLYPHS.length;
      // 크기칸(0부터)의 글자 그림 폭 · 높이
      const pngW = (idx) => B.listItem("글자그림폭", B.add(B.mul(B.v("크기칸"), NG), idx));
      const pngH = () => B.listItem("글자그림높이", B.add(B.v("크기칸"), 1));
      const glyphShape = () => B.shapeV(B.join(B.v("색이름"), B.join(B.v("글크기"), B.join("_", B.v("글자번호")))));
      const spaceIdx = GLYPHS.indexOf(" ") + 1;
      const glyphIdx = (ch) => B.indexOf(B.v("글자표"), ch);
      // (원본) 팝업 하나 꺼내서 글자마다 복제본 만들기
      const takePopup = () => B.iff(B.cmp(B.listLen("팝업값"), ">", 0), [
        B.set("종류", B.listItem("팝업종류", 1)), B.set("값", B.mathOp("round", B.listItem("팝업값", 1))),
        B.set("기준x", B.add(B.listItem("팝업x", 1), B.div(B.rand(-35, 35), 10))), B.set("기준y", B.listItem("팝업y", 1)),
        ...["팝업x", "팝업y", "팝업값", "팝업종류"].map((l) => B.listRemove(l, 1)),
        B.iff(B.cmp(B.v("값"), "<", 0), [B.set("값", 0)]),
        // 글 · 색 · 크기 (웹: 대미지는 16 + √대미지 × 3, 글자 팝업은 22px / 0.8초, 글자 팝업 1.6초)
        B.set("배율", B.div(B.add(16, B.mul(B.mathOp("root", B.v("값")), 3)), 40)), B.set("수명", 48),
        B.iff(B.cmp(B.v("종류"), "=", 1), [B.set("글", B.v("값")), B.ifElse(B.cmp(B.v("값"), ">=", B.mul(2, TV(B, "기본대미지"))), [B.set("색이름", "노랑")], [B.set("색이름", "흰")])]),
        B.iff(B.cmp(B.v("종류"), "=", 2), [B.set("글", B.join("-", B.v("값"))), B.set("색이름", "빨강")]),
        B.iff(B.cmp(B.v("종류"), "=", 3), [B.set("글", B.join("+", B.join(B.v("값"), " 회복"))), B.set("색이름", "초록"), B.set("배율", 22 / 40), B.set("수명", 96)]),
        B.iff(B.cmp(B.v("종류"), "=", 4), [B.set("글", "최대 체력 +20"), B.set("색이름", "초록"), B.set("배율", 22 / 40), B.set("수명", 96)]),
        B.iff(B.cmp(B.v("종류"), "=", 5), [B.set("글", "사건의 지평선!"), B.set("색이름", "빨강"), B.set("배율", 22 / 40), B.set("수명", 96)]),
        // 그릴 글자 묶음: 글자 팝업은 22px, 대미지 숫자는 가장 가까운 크기
        ...POPUP_SIZES.flatMap((size, i) => {
          const set = [B.set("글크기", size), B.set("크기칸", GLYPH_SIZES.indexOf(size))];
          return i === 0 ? set : [B.iff(B.cmp(B.mul(B.v("배율"), 40), ">", (POPUP_SIZES[i - 1] + size) / 2), set)];
        }),
        B.iff(B.cmp(B.v("종류"), ">", 2), [B.set("글크기", 22), B.set("크기칸", GLYPH_SIZES.indexOf(22))]),
        // 첫 글자 복제본만 만든다 (다음 글자는 복제본이 이어서 만든다). 전체 폭은 마지막 글자가 고리 칸에 적는다
        B.set("팝업순번", B.add(B.mod(B.v("팝업순번"), POPUP_RING), 1)), B.listSet("팝업폭", B.v("팝업순번"), -1),
        B.set("내팝업", B.v("팝업순번")), B.set("칸", 1), B.set("앞폭", 0),
        B.set("팝업", 1), B.clone("self"), B.set("팝업", 0),
      ]);
      // (원본) 필드마다 지금 보여야 하는지 · 글 · 자리 · 색을 목록에 적는다 (글자 복제본은 바뀌었을 때만 다시 놓는다)
      // (states 가 없으면 어느 화면에서나, cond 만 본다)
      const fieldWrite = (f, fi) => B.ifElse(!f.states ? f.cond(B) : f.cond ? B.and(stateIn(B, f.states), f.cond(B)) : stateIn(B, f.states), [
        B.listSet("필드글", fi + 1, f.text(B)), B.listSet("필드x", fi + 1, f.x(B)), B.listSet("필드y", fi + 1, f.y(B)),
        f.colorByRecord ? B.ifElse(B.cmp(B.v("신기록"), "=", 1), [B.listSet("필드색", fi + 1, "초록")], [B.listSet("필드색", fi + 1, "노랑")])
          : B.listSet("필드색", fi + 1, f.colorVar ? B.v(f.colorVar) : f.color),
        B.listSet("필드보임", fi + 1, 1),
        f.dim ? B.ifElse(stateIn(B, DIMMED), [B.listSet("필드투명", fi + 1, 45)], [B.listSet("필드투명", fi + 1, 0)]) : B.listSet("필드투명", fi + 1, 0),
        // 이 필드의 글자 복제본이 없으면 첫 칸을 만든다 (나머지 칸은 복제본이 이어서)
        B.iff(B.cmp(B.listItem("필드있음", fi + 1), "=", 0), [B.listSet("필드있음", fi + 1, 1), B.set("필드", fi + 1), B.set("칸", 1), B.clone("self")]),
      ], [B.listSet("필드보임", fi + 1, 0), B.listSet("필드있음", fi + 1, 0)]);
      // (복제본) 이 글자가 속한 필드의 크기 · 정렬 · 기울기 (바뀌지 않는 값)
      const fieldStatic = (f, fi) => B.iff(B.cmp(B.v("필드"), "=", fi + 1), [B.set("배율", f.size / 40), B.set("정렬", f.align), B.set("회전", f.rot || 0),
        B.set("글크기", f.size), B.set("크기칸", GLYPH_SIZES.indexOf(f.size))]);
      const relayout = [
        B.set("이전글", B.v("글")), B.set("이전x", B.v("기준x")), B.set("이전색", B.v("색이름")),
        B.set("길이", B.strLen(B.v("글"))),
        B.ifElse(B.cmp(B.v("칸"), ">", B.v("길이")), [B.hide()], [
          B.set("내글자", B.charAt(B.v("글"), B.v("칸"))),
          B.set("글자번호", glyphIdx(B.v("내글자"))), B.iff(B.cmp(B.v("글자번호"), "=", 0), [B.set("글자번호", spaceIdx)]),
          B.set("앞폭", 0), B.set("전체폭", 0),
          ...Array.from({ length: MAX_FIELD_LEN }, (_, j) => B.iff(B.cmp(B.v("길이"), ">=", j + 1), [
            B.set("번호j", glyphIdx(B.charAt(B.v("글"), j + 1))), B.iff(B.cmp(B.v("번호j"), "=", 0), [B.set("번호j", spaceIdx)]),
            B.set("폭j", advOf(B.v("번호j"))),
            B.iff(B.cmp(B.v("칸"), ">", j + 1), [B.change("앞폭", B.v("폭j"))]),
            B.change("전체폭", B.v("폭j"))])),
          // 왼쪽 정렬이면 0, 가운데 0.5, 오른쪽 1 만큼 전체 폭을 뺀다
          B.set("lx", B.mul(B.sub(B.add(B.v("앞폭"), B.div(advOf(B.v("글자번호")), 2)), B.mul(B.v("정렬"), B.v("전체폭"))), B.mul(B.v("배율"), 0.5))),
          // 웹과 같은 크기로 그린 그림을 그대로 (크기를 바꾸지 않는다: 오브젝트 기본 50%)
          glyphShape(),
          B.rotateToV(B.v("회전")),
          // 기울어진 창: 글자 자리도 같은 각도로 돌린다
          B.goXY(B.add(B.v("기준x"), B.mul(B.v("lx"), B.mathOp("cos", B.v("회전")))), B.sub(B.v("기준y"), B.mul(B.v("lx"), B.mathOp("sin", B.v("회전"))))),
          B.ifElse(B.cmp(B.v("글자번호"), "=", spaceIdx), [B.hide()], [B.show()]),
        ]),
      ];
      return [
        B.when.run([B.hide(), B.set("복제본", 0), B.set("팝업", 0),
          // 필드 글자 복제본 (필드마다 최대 글자 수만큼)
          // 필드 글자 복제본은 그 필드가 보일 때만 있다 (안 보이면 지워서 가볍게)
          ...FIELDS.map((f, fi) => B.listSet("필드있음", fi + 1, 0)),
          B.forever([...FIELDS.map(fieldWrite), takePopup(), takePopup(), takePopup(), takePopup()]),
        ]),
        B.when.clone([
          B.set("복제본", 1),
          B.ifElse(B.cmp(B.v("팝업"), "=", 1), [
            // 대미지 숫자: 뻥! 튀어나오고 (바운스), 0.15초 뒤부터 위로, 마지막 40% 동안 투명 (웹과 같다)
            B.set("길이", B.strLen(B.v("글"))),
            B.set("글자번호", glyphIdx(B.charAt(B.v("글"), B.v("칸")))), B.iff(B.cmp(B.v("글자번호"), "=", 0), [B.set("글자번호", spaceIdx)]),
            B.set("폭j", advOf(B.v("글자번호"))),
            B.ifElse(B.cmp(B.v("칸"), "<", B.v("길이")), [
              // 다음 글자: 자리 = 앞 글자 폭의 합 (복제본은 만들 때의 지역 변수를 물려받는다)
              B.change("앞폭", B.v("폭j")), B.change("칸", 1), B.clone("self"), B.change("칸", -1), B.change("앞폭", B.mul(B.v("폭j"), -1)),
            ], [B.listSet("팝업폭", B.v("내팝업"), B.add(B.v("앞폭"), B.v("폭j")))]),
            B.hide(), B.waitUntil(B.cmp(B.listItem("팝업폭", B.v("내팝업")), ">=", 0)),
            B.set("전체폭", B.listItem("팝업폭", B.v("내팝업"))),
            B.set("lx", B.mul(B.sub(B.add(B.v("앞폭"), B.div(B.v("폭j"), 2)), B.div(B.v("전체폭"), 2)), B.mul(B.v("배율"), 0.5))),
            // 묶음 크기(글크기)와 실제 크기(배율 × 40)의 차이만큼만 늘이거나 줄인다
            B.set("크기값", B.mul(B.div(B.add(pngW(B.v("글자번호")), pngH()), 2), B.mul(0.5, B.div(B.mul(B.v("배율"), 40), B.v("글크기"))))),
            glyphShape(), B.set("나이", 0),
            B.forever([
              B.change("나이", 1),
              ...bounce(B, "튀김", B.v("나이")),
              B.size(B.mul(B.v("크기값"), B.v("튀김"))),
              B.iff(B.cmp(B.v("나이"), ">", 9), [B.change("기준y", 0.42)]),
              B.goXY(B.add(B.v("기준x"), B.mul(B.v("lx"), B.v("튀김"))), B.v("기준y")),
              B.ifElse(B.cmp(B.v("나이"), ">", B.mul(B.v("수명"), 0.6)),
                [B.effect("transparency", B.mul(B.div(B.sub(B.v("나이"), B.mul(B.v("수명"), 0.6)), B.mul(B.v("수명"), 0.4)), 100))], [B.effect("transparency", 0)]),
              showIn(B, FIGHT_VIEW),
              B.iff(B.cmp(B.v("나이"), ">=", B.v("수명")), [B.deleteClone()]),
            ]),
          ], [
            B.iff(B.cmp(B.v("칸"), "<", B.listItem("필드길이", B.v("필드"))), [B.change("칸", 1), B.clone("self"), B.change("칸", -1)]),
            ...FIELDS.map(fieldStatic),
            B.set("이전글", "#없음#"),
            B.forever([
              // 안 보이는 동안은 보일 때까지 기다리기만 한다 (가볍게)
              B.ifElse(B.cmp(B.listItem("필드보임", B.v("필드")), "=", 1), [
                B.iff(B.or(B.or(B.cmp(B.listItem("필드글", B.v("필드")), "!=", B.v("이전글")), B.cmp(B.listItem("필드x", B.v("필드")), "!=", B.v("이전x"))),
                  B.or(B.cmp(B.listItem("필드색", B.v("필드")), "!=", B.v("이전색")), B.cmp(B.listItem("필드투명", B.v("필드")), "!=", B.v("이전투명")))), [
                  // 뒤에 어두운 막이 깔리면 글씨도 같이 어둡게 (웹은 상태창 위에 막을 덮는다)
                  B.set("이전투명", B.listItem("필드투명", B.v("필드"))), B.effect("transparency", B.v("이전투명")),
                  B.set("글", B.listItem("필드글", B.v("필드"))), B.set("기준x", B.listItem("필드x", B.v("필드"))), B.set("기준y", B.listItem("필드y", B.v("필드"))),
                  B.set("색이름", B.listItem("필드색", B.v("필드"))),
                  ...relayout]),
              ], [B.deleteClone()]),
            ]),
          ]),
        ]),
        // 정리: 대미지 숫자와 필드 글자를 지운다 (필드 글자는 원본이 다음 프레임에 다시 만든다)
        B.when.msg("정리", [B.ifElse(isClone(B), [B.deleteClone()], FIELDS.map((f, fi) => B.listSet("필드있음", fi + 1, 0)))]),
      ];
    },
  });

  // ================= 설정 · 비밀번호 · 숫자 조절 · 디버그 창 (글씨 바로 뒤 = 다른 모든 것보다 앞) =================
  // 상태: 설정 / 조절 · 조절입력 / 잠금 · 설정잠금 · 메뉴잠금 (비밀번호) / 지급 (G) / 보스선택 · 메뉴보스 (B)
  const say = (B, text, color) => [B.set("알림글", text), B.set("알림색", color || "초록"), B.set("알림시간", 120)];
  // 마우스를 올리면 1.04배 (웹 버튼과 같다). 모양이 바뀌는 버튼
  const dynButton = (name, keys, x, y, states, shapeFn, onClick, clickStates) => {
    const base = baseSize(keys[0]);
    return { name, pictures: pics(keys), scale: 0.5, x, y, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([whileIn(B, states, [B.show(), ...shapeFn(B), B.ifElse(B.touching("mouse"), [B.size(base * 1.04)], [B.size(base)])])])]),
      B.when.click([B.iff(stateIn(B, clickStates || states), onClick(B))]),
    ] };
  };
  // 같은 모양 버튼 n 개 (복제본, 칸 = 1 ~ n). 창을 열 때(remakeMsg) 다시 만든다
  const cloneButtons = (name, keys, n, states, pos, shapeFn, onClick, remakeMsg, clickStates) => {
    const base = baseSize(keys[0]);
    const create = (B) => [B.set("칸", 0), B.repeat(n, [B.change("칸", 1), B.clone("self")])];
    return { name, pictures: pics(keys), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), ...create(B)]),
      remake(B, remakeMsg, create(B)),
      B.when.clone([B.set("복제본", 1), ...Array.from({ length: n }, (_, i) => B.iff(B.cmp(B.v("칸"), "=", i + 1), [B.goXY(...pos(i))])),
        B.forever([whileIn(B, states, [B.show(), ...shapeFn(B), B.ifElse(B.touching("mouse"), [B.size(base * 1.04)], [B.size(base)])])])]),
      B.when.click([B.iff(B.and(isClone(B), stateIn(B, clickStates || states)), onClick(B))]),
    ] };
  };
  const LOCK_STATES = ["잠금", "설정잠금", "메뉴잠금"];
  // 이전상태 가 목록 중 하나인지
  const prevIn = (B, list) => list.slice(1).reduce((acc, st) => B.or(acc, B.cmp(B.v("이전상태"), "=", st)), B.cmp(B.v("이전상태"), "=", list[0]));
  // 틀리면 0.35초 동안 좌우로 흔들림 (웹 .pin-shake: ±10px 두 번)
  const shakeX = (B) => B.mul(5, B.mathOp("sin", B.mul(B.v("흔들시간"), 34.3)));
  objects.push(sprite("비밀번호틀림", ["pin_wrong"], 0, 16, LOCK_STATES, (B) => [B.setX(shakeX(B))], { cond: (B) => B.cmp(B.v("비번틀림"), "=", 1) }));
  objects.push(sprite("비밀번호창", ["pin_dbg", "pin_tune"], 0, 45, LOCK_STATES, (B) => [
    B.ifElse(B.cmp(B.v("요청종류"), "=", 2), [B.shapeV("pin_tune")], [B.shapeV("pin_dbg")]), B.setX(shakeX(B))]));

  // ---- 디버그 · 보스 선택 (B) ----
  const BOSS_PICK = Object.entries(BOSS_WAVES).map(([w, list]) => ({ wave: +w, names: list.map((b) => T[b].name).join(" & ") }));
  const BOSS_ST = ["보스선택", "메뉴보스"];
  const closeBoss = (B) => [B.ifElse(stateIs(B, "메뉴보스"), [B.set("상태", "메뉴")], [B.set("상태", B.v("이전상태"))])];
  objects.push(button("보스닫기", "html_close", ...uiPos(BOSS_UI.close), BOSS_ST, closeBoss));
  objects.push(cloneButtons("보스고르기", BOSS_PICK.map((b, i) => "bsel_" + i), BOSS_PICK.length, BOSS_ST, (i) => uiPos(BOSS_UI.cell(i)),
    (B) => [B.shapeV(B.join("bsel_", B.sub(B.v("칸"), 1)))],
    (B) => [
      ...BOSS_PICK.map((b, i) => B.iff(B.cmp(B.v("칸"), "=", i + 1), [B.set("이동웨이브", b.wave), B.set("시작웨이브", b.wave)])),
      // 게임 중이면 그 웨이브로 바로 (증강은 그대로), 메뉴 · 결과 화면이면 새 게임을 그 웨이브부터
      B.ifElse(B.and(stateIs(B, "보스선택"), prevIn(B, DEBUG_GAME)), [
        B.set("상태", "준비"), ...say(B, B.join("웨이브 ", B.join(B.v("이동웨이브"), " 로 이동"))), B.send("웨이브이동")],
      [B.send("게임시작")]),
    ], "보스열기"));
  objects.push(sprite("보스판", ["boss_panel"], 0, 0, BOSS_ST));

  // ---- 디버그 · 지급 (G) ----
  const giveLv = (B) => [B.set("값", 0), ...AUGS.map((a, k) => B.iff(B.cmp(B.v("칸"), "=", k + 1), [B.set("값", B.v(a.v))]))];
  objects.push(button("지급닫기", "html_close", ...uiPos(GIVE_UI.close), ["지급"], (B) => [B.set("상태", B.v("이전상태"))]));
  objects.push(button("지급삭제", "give_clear", ...uiPos(GIVE_UI.clear), ["지급"], (B) => [...AUGS.map((a) => B.set(a.v, 0)), B.send("능력갱신")]));
  objects.push(cloneButtons("지급빼기", ["give_minus_0", "give_minus_1"], AUGS.length, ["지급"], (i) => uiPos(GIVE_UI.minus(i)),
    (B) => [...giveLv(B), B.ifElse(B.cmp(B.v("값"), ">", 0), [B.shapeV("give_minus_1")], [B.shapeV("give_minus_0")])],
    (B) => [...AUGS.map((a, k) => B.iff(B.and(B.cmp(B.v("칸"), "=", k + 1), B.cmp(B.v(a.v), ">", 0)), [B.change(a.v, -1)])), B.send("능력갱신")], "지급열기"));
  objects.push(cloneButtons("지급줄", AUGS.flatMap((a, k) => Array.from({ length: a.max + 1 }, (_, lv) => "give_aug_" + k + "_" + lv)), AUGS.length, ["지급"], (i) => uiPos(GIVE_UI.aug(i)),
    (B) => [...giveLv(B), B.shapeV(B.join(B.join("give_aug_", B.sub(B.v("칸"), 1)), B.join("_", B.v("값"))))],
    (B) => [...AUGS.map((a, k) => B.iff(B.and(B.cmp(B.v("칸"), "=", k + 1), B.cmp(B.v(a.v), "<", a.max)), [B.change(a.v, 1)])), B.send("능력갱신")], "지급열기"));
  objects.push(cloneButtons("지급보급", SUPPLIES.map((s, i) => "give_sup_" + i), SUPPLIES.length, ["지급"], (i) => uiPos(GIVE_UI.sup(i)),
    (B) => [B.shapeV(B.join("give_sup_", B.sub(B.v("칸"), 1)))],
    (B) => [
      // 세포 분열: 최대 체력 +20 · 체력 +20 / 항상성: 최대 체력의 40% 회복 (카드와 같다)
      B.iff(B.cmp(B.v("칸"), "=", 1), [B.change("최대체력", 20), B.change("체력", 20), ...popup(B, playerX(B), B.add(playerY(B), 18), 20, 4)]),
      B.iff(B.cmp(B.v("칸"), "=", 2), [B.set("회복량", B.sub(B.v("최대체력"), B.v("체력"))),
        B.iff(B.cmp(B.v("회복량"), ">", B.mul(B.v("최대체력"), 0.4)), [B.set("회복량", B.mul(B.v("최대체력"), 0.4))]),
        B.change("체력", B.v("회복량")), ...popup(B, playerX(B), B.add(playerY(B), 18), B.v("회복량"), 3)]),
      B.send("능력갱신")], "지급열기"));
  objects.push(sprite("지급판", ["give_panel"], 0, 0, ["지급"]));

  // ---- 숫자 조절판 ----
  const TUNE_ST = ["조절", "조절입력"];
  objects.push(button("조절닫기", "html_close", ...uiPos(TUNE_UI.close), TUNE_ST, (B) => [B.set("상태", "설정")], { clickStates: ["조절"] }));
  objects.push(button("조절적용", "tune_apply", ...uiPos(TUNE_UI.apply), TUNE_ST, (B) => [...say(B, "바뀐 값으로 다시 시작해요"), B.send("메뉴로")], { clickStates: ["조절"] }));
  objects.push(button("조절기본", "tune_reset", ...uiPos(TUNE_UI.reset), TUNE_ST, (B) => [...TUNES.map((t) => B.set(t.v, String(t.def))), ...say(B, "모두 기본값으로")], { clickStates: ["조절"] }));
  objects.push(button("조절잠금", "tune_lock", ...uiPos(TUNE_UI.lock), TUNE_ST, (B) => [B.set("주인확인", 0), B.set("상태", "설정"), ...say(B, "잠갔어요")], { clickStates: ["조절"] }));
  objects.push(cloneButtons("조절줄", TUNES.flatMap((t, i) => [0, 1].map((c) => "tune_row_" + i + "_" + c)), TUNES.length, TUNE_ST, (i) => uiPos(TUNE_UI.rows[i]),
    (B) => [
      // 기본값과 다르면 노란 줄 (웹 .tuning-changed)
      B.set("값", 0), ...TUNES.map((t, i) => B.iff(B.and(B.cmp(B.v("칸"), "=", i + 1), B.cmp(B.v(t.v), "!=", t.def)), [B.set("값", 1)])),
      B.shapeV(B.join(B.join("tune_row_", B.sub(B.v("칸"), 1)), B.join("_", B.v("값")))), B.wait(0.05)],
    (B) => [B.set("조절칸", B.v("칸")), B.send("조절입력")], "조절열기", ["조절"]));
  objects.push(sprite("조절판", ["tune_panel"], 0, 0, TUNE_ST));

  // ---- 설정 창 (메뉴의 톱니 버튼) ----
  const SET_ST = ["설정", "설정잠금"];
  objects.push(button("설정닫기", "btn_closeX", SET_UI.close.x, SET_UI.close.y, SET_ST, (B) => [B.set("상태", "메뉴")], { clickStates: ["설정"] }));
  objects.push(dynButton("디버그버튼", ["set_dbg_lock", "set_dbg_off", "set_dbg_on"], SET_UI.dbg.x, SET_UI.dbg.y, SET_ST,
    (B) => [B.ifElse(B.cmp(B.v("디버그"), "=", 1), [B.shapeV("set_dbg_on")], [B.ifElse(B.cmp(B.v("주인확인"), "=", 1), [B.shapeV("set_dbg_off")], [B.shapeV("set_dbg_lock")])])],
    (B) => [B.ifElse(B.cmp(B.v("디버그"), "=", 1), [B.send("디버그끄기")], [B.set("요청종류", 1), B.send("잠금열기")])], ["설정"]));
  objects.push(dynButton("조절열기버튼", ["set_tune_lock", "set_tune_0", ...TUNES.map((t, i) => "set_tune_" + (i + 1))], SET_UI.tune.x, SET_UI.tune.y, SET_ST,
    (B) => [
      B.set("조절바뀜", 0), ...TUNES.map((t) => B.iff(B.cmp(B.v(t.v), "!=", t.def), [B.change("조절바뀜", 1)])),
      B.ifElse(B.cmp(B.v("주인확인"), "=", 1), [B.shapeV(B.join("set_tune_", B.v("조절바뀜")))], [B.shapeV("set_tune_lock")])],
    (B) => [B.set("요청종류", 2), B.send("잠금열기")], ["설정"]));
  objects.push(sprite("설정판", ["set_panel"], SET_UI.x, SET_UI.y, SET_ST));
  // 창 뒤를 어둡게 (웹 .tuning-overlay: 55%)
  objects.push(sprite("창어둡게", ["dim55"], 0, 0, PANEL_STATES));

  // ================= 결과 화면 =================
  const rp = (x, y) => rotP(x, y);
  objects.push(sprite("신기록스티커", ["sticker_record"], rp(0, 97)[0], rp(0, 97)[1], ["결과"], (B) => [
    // 1초에 한 번 5% 커졌다 작아진다 (웹과 같다)
    B.size(B.mul(baseSize("sticker_record"), B.add(1, B.mul(0.05, B.mathOp("sin", B.mul(B.v("타이머숨"), 6)))))),
  ], { rot: RESULT_ROT - 2.3, cond: (B) => B.cmp(B.v("신기록"), "=", 1) }));
  objects.push(sprite("새점수스티커", ["sticker_new"], rp(90, 48)[0], rp(90, 48)[1], ["결과"], null, { rot: RESULT_ROT, cond: (B) => B.cmp(B.v("새점수기록"), "=", 1) }));
  objects.push(button("다시하기버튼", "rb_retry", rp(-50, -66)[0], rp(-50, -66)[1], ["결과"], (B) => [B.send("게임시작")], { rot: RESULT_ROT }));
  objects.push(button("결과메뉴버튼", "rb_menu", rp(50, -66)[0], rp(50, -66)[1], ["결과"], (B) => [B.send("메뉴로")], { rot: RESULT_ROT }));
  objects.push(sprite("결과판", ["result_over", "result_clear"], 0, 0, ["결과"], (B) => [
    B.ifElse(B.cmp(B.v("결과종류"), "=", "클리어"), [B.shapeV("result_clear")], [B.shapeV("result_over")])], { rot: RESULT_ROT }));

  // ================= 일시정지 =================
  objects.push(sprite("준비글", ["ready"], 0, 0, ["재개"], (B) => [
    // "준비!" 가 커지며 (44 → 60px) 옅어진다 (웹과 같다)
    B.size(B.mul(baseSize("ready"), B.add(1, B.mul(16 / 44, B.sub(1, B.div(B.v("멈춤시간"), RESUME_FRAMES)))))),
    B.effect("transparency", B.mul(100, B.sub(1, B.add(B.div(B.v("멈춤시간"), RESUME_FRAMES), 0.3)))),
  ]));
  [["계속버튼", "pb_resume", 0, (B) => [B.set("상태", "재개"), B.set("멈춤시간", RESUME_FRAMES)]],
    ["멈춤다시버튼", "pb_restart", 1, (B) => [B.send("게임시작")]],
    ["멈춤로비버튼", "pb_lobby", 2, (B) => [B.send("메뉴로")]]].forEach(([name, key, i, fn]) => {
    objects.push(button(name, key, ex(239), ey(149 + 64 * i), ["멈춤"], fn));
  });
  // 가진 증강 (오른쪽 칸): 증강마다 복제본, 가진 것만 위에서부터
  objects.push({
    name: "멈춤증강", pictures: [pic("pause_noaug"), ...AUGS.flatMap((a, k) => Array.from({ length: a.max }, (_, l) => pic("pause_aug_" + k + "_" + (l + 1))))],
    scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.goXY(ex(615), ey(108)), B.forever([showIn(B, ["멈춤"], B.cmp(B.v("증강수"), "=", 0))])]),
      B.when.run([B.set("칸", 0), B.repeat(AUGS.length, [B.change("칸", 1), B.clone("self")])]),
      remake(B, "정리", [B.set("칸", 0), B.repeat(AUGS.length, [B.change("칸", 1), B.clone("self")])]),
      B.when.clone([B.set("복제본", 1), B.forever([whileIn(B, ["멈춤"], [
        B.set("앞수", 0),
        ...AUGS.map((a, k) => B.iff(B.and(B.cmp(B.v("칸"), ">", k + 1), B.cmp(B.v(a.v), ">", 0)), [B.change("앞수", 1)])),
        ...AUGS.map((a, k) => B.iff(B.cmp(B.v("칸"), "=", k + 1), [
          showIn(B, ["멈춤"], B.cmp(B.v(a.v), ">", 0)),
          B.iff(B.cmp(B.v(a.v), ">", 0), [B.shapeV(B.join("pause_aug_" + k + "_", B.v(a.v)))]),
        ])),
        B.goXY(ex(615), B.sub(ey(130), B.mul(30, B.v("앞수")))),
        B.wait(0.05),
      ])])]),
    ],
  });
  objects.push(sprite("일시정지판", ["pause_panel"], 0, 5, ["멈춤"]));

  // ================= 조작법 · 도감 =================
  objects.push(button("조작법닫기", "mb_close", 0, -98, ["조작법"], (B) => [B.set("상태", "메뉴")]));
  objects.push(sprite("조작법판", ["help_panel"], 0, 0, ["조작법"]));
  objects.push(button("도감닫기", "mb_close", 0, -98, ["도감"], (B) => [B.set("상태", "메뉴")]));
  const bookCards = [...AUGS.map((a, k) => "card_" + k + "_0"), ...SUPPLIES.map((s, i) => "card_s" + i)];
  objects.push({
    name: "도감카드", pictures: pics(bookCards), scale: 0.27, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 0), B.repeat(bookCards.length, [B.change("칸", 1), B.clone("self")])]),
      remake(B, "도감열기", [B.set("칸", 0), B.repeat(bookCards.length, [B.change("칸", 1), B.clone("self")])]),
      B.when.clone([B.set("복제본", 1), B.shapeV(B.v("칸")),
        B.goXY(B.add(-150, B.mul(B.mod(B.sub(B.v("칸"), 1), 4), 100)), 0),
        B.iff(B.cmp(B.v("칸"), ">", 4), [B.setY(-38)]), B.iff(B.cmp(B.v("칸"), "<=", 4), [B.setY(52)]),
        B.forever([whileIn(B, ["도감"], [B.show()])])]),
    ],
  });
  objects.push(sprite("도감판", ["book_panel"], 0, 0, ["도감"]));

  // ================= 메뉴 =================
  const M1 = { clickStates: ["메뉴"] };
  objects.push(button("설정버튼", "gear_btn", ex(922), ey(34), MENU_BG, (B) => [B.set("상태", "설정")], M1));
  objects.push(button("시작버튼", "menu_start", 0, ey(293), MENU_BG, (B) => [B.send("게임시작")], { pulse: true, clickStates: ["메뉴"] }));
  objects.push(button("조작법버튼", "mb_help", -68, -104, MENU_BG, (B) => [B.set("상태", "조작법")], M1));
  objects.push(button("도감버튼", "mb_book", 68, -104, MENU_BG, (B) => [B.send("도감열기"), B.set("상태", "도감")], M1));
  objects.push(sprite("메뉴안내", ["menu_hint"], 0, ey(400), MENU_BG));
  // 제목 스티커: 아주 살짝 흔들흔들 (웹: −0.04 + 0.01·sin(1.5t) rad)
  objects.push(sprite("메뉴제목", ["menu_title"], 0, ey(148), MENU_BG, (B) => [
    B.rotateToV(B.add(-2.29, B.mul(0.57, B.mathOp("sin", B.mul(B.v("타이머숨"), 1.43)))))]));
  // 장식: 오른쪽에 웨이브 1·2·3 의 기본 적 (동그라미 · 뿔 · 가시), 왼쪽에 가운데 적을 겨누는 플레이어 (웹과 같다)
  const deco = [[790, 236, 1], [870, 318, 2], [780, 384, 3]];
  objects.push({
    name: "메뉴장식", pictures: [...deco.map(([x, y, v]) => pic("e_basic" + v + "_4_0")), pic("p_gun"), pic("p_body_0")],
    scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 0), B.repeat(5, [B.change("칸", 1), B.clone("self")])]),
      remake(B, "정리", [B.set("칸", 0), B.repeat(5, [B.change("칸", 1), B.clone("self")])]),
      B.when.clone([B.set("복제본", 1), B.shapeV(B.v("칸")), B.forever([whileIn(B, MENU_BG, [
        B.show(),
        // 둥실둥실: sin(2t + 1.3i) × 8px (적), sin(2.4t) × 10px (플레이어). 적의 눈은 플레이어 쪽
        ...deco.map(([x, y, v], i) => B.iff(B.cmp(B.v("칸"), "=", i + 1), [
          B.goXY(ex(x), B.add(ey(y), B.mul(4, B.mathOp("sin", B.add(B.mul(B.v("타이머숨"), 1.91), 74.5 * i)))))])),
        B.iff(B.cmp(B.v("칸"), ">=", 4), [B.goXY(ex(170), B.add(ey(320), B.mul(5, B.mathOp("sin", B.mul(B.v("타이머숨"), 2.29)))))]),
      ])])]),
    ],
  });


  // ================= 카드 고르기 =================
  const allCardKeys = cardSpecs().map((c) => c.key);
  const cardBase = baseSize("card_0_0");
  // 카드 i (1~3) 의 등장 나이 (카드마다 0.08초 = 5프레임씩 늦게)
  const cardAge = (B) => B.sub(B.v("나이"), B.mul(B.sub(B.v("칸"), 1), 5));
  const cardRot = (B) => B.mul(B.sub(B.v("칸"), 2), 2.0);   // 스티커처럼 왼쪽·가운데·오른쪽 다르게 기울이기 (웹: (i − 1) × 0.035 rad)
  objects.push({
    name: "카드번호", pictures: [1, 2, 3].map((i) => pic("card_num" + i)), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      // 카드 수는 카드 오브젝트가 정하니, 고르기 상태가 된 다음에 만든다
      B.when.msg("카드보이기", [B.iff(isOrig(B), [B.waitUntil(stateIs(B, "고르기")), B.set("칸", 0), B.repeat(B.v("카드수"), [B.change("칸", 1), B.clone("self")])])]),
      // 왼쪽 위 번호 배지 (이 번호 키를 눌러도 고를 수 있다): 카드와 같은 등장 · 기울기 · 들림
      B.when.clone([B.set("복제본", 1), B.shapeV(B.v("칸")), B.set("나이", 0), B.set("각", cardRot(B)), B.forever([
        B.change("나이", 1),
        B.set("등장", cardAge(B)),
        B.ifElse(B.cmp(B.v("등장"), ">", 0), [...bounce(B, "배율", B.v("등장"))], [B.set("배율", 0)]),
        B.set("들림", 0),
        ...[1, 2, 3].map((k) => B.iff(B.cmp(B.v("칸"), "=", k), [B.set("들림", B.v("카드들림" + k))])),
        // 카드 왼쪽 위 모서리 (웹: left + 6, top + 6) → 카드 크기 · 기울기를 따라 돌린 자리
        B.set("ox", B.mul(-59.5, B.mul(B.v("배율"), B.add(1, B.mul(0.04, B.v("들림")))))),
        B.set("oy", B.mul(79.5, B.mul(B.v("배율"), B.add(1, B.mul(0.04, B.v("들림")))))),
        B.goXY(B.add(B.mul(B.sub(B.v("칸"), B.div(B.add(B.v("카드수"), 1), 2)), 145), B.add(B.mul(B.v("ox"), B.mathOp("cos", B.v("각"))), B.mul(B.v("oy"), B.mathOp("sin", B.v("각"))))),
          B.add(B.add(-15, B.mul(5, B.v("들림"))), B.sub(B.mul(B.v("oy"), B.mathOp("cos", B.v("각"))), B.mul(B.v("ox"), B.mathOp("sin", B.v("각")))))),
        B.size(B.mul(baseSize("card_num1"), B.v("배율"))),
        B.ifElse(B.cmp(B.v("배율"), ">", 0), [B.show()], [B.hide()]),
      ])]),
      B.when.msg("카드선택", [B.iff(isClone(B), [B.deleteClone()])]),
      B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
    ],
  });
  objects.push({
    name: "카드", pictures: pics(allCardKeys), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      // 카드 3장 고르기: 이미 뽑은 카드, 최대 레벨 증강은 다시 뽑는다 (보급 2장은 늘 가능하니 끝난다)
      B.when.msg("카드보이기", [B.iff(isOrig(B), [
        B.set("카드1", 0), B.set("카드2", 0), B.set("카드3", 0), B.set("고르기시간", 0),
        // 웹과 같게: 최대 레벨이 아닌 증강에서 먼저 (서로 다르게) 뽑고, 모자라면 보급 카드로 채운다
        B.set("남은증강", 0), ...AUGS.map((a) => B.iff(B.cmp(B.v(a.v), "<", a.max), [B.change("남은증강", 1)])),
        B.set("카드수", B.add(B.v("남은증강"), SUPPLIES.length)), B.iff(B.cmp(B.v("카드수"), ">", 3), [B.set("카드수", 3)]),
        B.set("보급순서", B.rand(0, 1)),
        ...[1, 2, 3].map((k) => B.iff(B.cmp(B.v("카드수"), ">=", k), [
          B.ifElse(B.cmp(B.v("남은증강"), ">=", k), [
            B.set("가능", 0),
            B.repeatUntil(B.cmp(B.v("가능"), "=", 1), [
              B.set("뽑기", B.rand(1, AUGS.length)), B.set("가능", 1),
              B.iff(B.or(B.cmp(B.v("뽑기"), "=", B.v("카드1")), B.cmp(B.v("뽑기"), "=", B.v("카드2"))), [B.set("가능", 0)]),
              ...AUGS.map((a, i) => B.iff(B.and(B.cmp(B.v("뽑기"), "=", i + 1), B.cmp(B.v(a.v), ">=", a.max)), [B.set("가능", 0)])),
            ]),
          ], [
            // 보급 카드 (두 장을 섞은 순서대로)
            B.set("뽑기", B.add(AUGS.length + 1, B.mod(B.add(B.v("보급순서"), B.sub(k, B.add(B.v("남은증강"), 1))), SUPPLIES.length))),
          ]),
          B.set("카드" + k, B.v("뽑기")),
        ])),
        // 체력이 40% 보다 낮은데 보급 카드가 없으면 마지막 카드를 보급 카드로 (웹과 같다)
        B.iff(B.and(B.cmp(B.v("체력"), "<", B.mul(B.v("최대체력"), LOW_HP_RATIO)),
          B.and(B.cmp(B.v("카드1"), "<=", AUGS.length), B.and(B.cmp(B.v("카드2"), "<=", AUGS.length), B.cmp(B.v("카드3"), "<=", AUGS.length)))),
          [B.set("카드" + 3, B.add(AUGS.length + 1, B.v("보급순서")))]),
        ...[1, 2, 3].map((k) => B.iff(B.cmp(B.v("카드수"), ">=", k), [B.set("칸", k), B.set("내카드", B.v("카드" + k)), B.clone("self")])),
        B.set("상태", "고르기"),
      ])]),
      B.when.clone([
        B.set("복제본", 1), B.set("나이", 0),
        // 증강 k: 지금 레벨에 맞는 카드 (NEW! / Lv.L → Lv.L+1), 보급: 보급 카드
        ...AUGS.map((a, k) => B.iff(B.cmp(B.v("내카드"), "=", k + 1), [B.set("카드모양", B.join("card_" + k + "_", B.v(a.v)))])),
        ...SUPPLIES.map((s, i) => B.iff(B.cmp(B.v("내카드"), "=", AUGS.length + i + 1), [B.set("카드모양", "card_s" + i)])),
        B.shapeV(B.v("카드모양")), B.rotateToV(cardRot(B)),
        B.forever([
          B.change("나이", 1),
          // 카드마다 0.08초씩 늦게, 바운스하며 나타난다 (웹과 같다)
          B.set("등장", cardAge(B)),
          B.ifElse(B.cmp(B.v("등장"), ">", 0), [...bounce(B, "배율", B.v("등장"))], [B.set("배율", 0)]),
          // 마우스를 올리면 1.04배 + 10px 들림
          B.set("들림", 0), B.iff(B.and(B.touching("mouse"), B.cmp(B.v("배율"), ">", 0)), [B.set("들림", 1)]),
          B.size(B.mul(cardBase, B.mul(B.v("배율"), B.add(1, B.mul(0.04, B.v("들림")))))),
          B.goXY(B.mul(B.sub(B.v("칸"), B.div(B.add(B.v("카드수"), 1), 2)), 145), B.add(-15, B.mul(5, B.v("들림")))),
          B.ifElse(B.cmp(B.v("배율"), ">", 0), [B.show()], [B.hide()]),
          // 번호 배지에게 들림 알려 주기
          ...[1, 2, 3].map((k) => B.iff(B.cmp(B.v("칸"), "=", k), [B.set("카드들림" + k, B.v("들림"))])),
        ]),
      ]),
      B.when.click([B.iff(B.and(isClone(B), B.and(stateIs(B, "고르기"), B.cmp(B.v("고르기시간"), ">=", CHOICE_DELAY))), [B.set("고른카드", B.v("내카드")), B.send("카드선택")])]),
      ...[1, 2, 3].map((k) => B.when.key(48 + k, [B.iff(B.and(isOrig(B), B.and(stateIs(B, "고르기"), B.and(B.cmp(B.v("고르기시간"), ">=", CHOICE_DELAY), B.cmp(B.v("카드" + k), ">", 0)))), [B.set("고른카드", B.v("카드" + k)), B.send("카드선택")])])),
      B.when.msg("카드선택", [B.iff(isClone(B), [B.deleteClone()])]),
      B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
    ],
  });
  objects.push(sprite("고르기제목", Array.from({ length: WAVE_COUNT }, (_, i) => "choice_t" + (i + 1)), 0, ey(48), ["고르기", "카드준비"], (B) => [B.shapeV(B.join("choice_t", B.v("웨이브")))]));
  objects.push(sprite("고르기부제", ["choice_sub"], 0, ey(88), ["고르기", "카드준비"]));

  // ================= 화면 어둡게 (카드 · 창 · 버튼보다 뒤: 앞에 있으면 엔트리에서 클릭을 막이 가로챈다) =================
  objects.push(sprite("어둡게", ["dim45", "dim55"], 0, 0, ["결과", "멈춤", "조작법", "도감", "고르기", "카드준비"], (B) => [
    B.ifElse(stateIs(B, "멈춤"), [B.shapeV("dim55")], [B.shapeV("dim45")])]));

  // ================= 웨이브 띠 (위에서 0.2초 동안 내려오고, 마지막 0.3초 동안 흐려진다) =================
  // 웹: 띠 기준점 y = −40 → 상태창 아래 (12 + 104 + 42 = 158) 로 내려온다. 살짝 기울임 (0.02 rad)
  const bannerY = (B) => B.add(ey(158), B.mul(ey(-40) - ey(158), B.sub(1, B.v("배너진행"))));
  const bannerAlpha = (B) => B.effect("transparency", B.mul(100, B.sub(1, B.v("배너알파"))));
  objects.push(sprite("배너부제", BANNER_SUBS.map((s, i) => "banner_s" + i), 0, 0, ["준비", "전투"], (B) => [
    B.iff(B.cmp(B.v("배너부제"), ">", 0), [B.shapeV(B.v("배너부제"))]),
    B.goXY(0, B.sub(bannerY(B), 18)), bannerAlpha(B),
  ], { rot: 1.15, cond: (B) => B.and(B.cmp(B.v("배너시간"), ">", 0), B.cmp(B.v("배너부제"), ">", 0)) }));
  objects.push(sprite("배너제목", Array.from({ length: WAVE_COUNT }, (_, i) => "banner_t" + (i + 1)), 0, 0, ["준비", "전투"], (B) => [
    B.shapeV(B.join("banner_t", B.v("웨이브"))), B.goXY(0, bannerY(B)), bannerAlpha(B),
  ], { rot: 1.15, cond: (B) => B.cmp(B.v("배너시간"), ">", 0) }));
  objects.push({
    name: "배너띠", pictures: pics(["banner_yellow56", "banner_yellow84", "banner_red56", "banner_red84"]), scale: 0.5, visible: false, rotation: 1.15, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        // 진행 (0 → 1, 처음 12프레임) · 알파 (끝 18프레임 동안 1 → 0)
        B.set("배너진행", B.div(B.sub(BANNER_FRAMES, B.v("배너시간")), 12)), B.iff(B.cmp(B.v("배너진행"), ">", 1), [B.set("배너진행", 1)]),
        B.set("배너알파", B.div(B.v("배너시간"), 18)), B.iff(B.cmp(B.v("배너알파"), ">", 1), [B.set("배너알파", 1)]),
        showIn(B, ["준비", "전투"], B.cmp(B.v("배너시간"), ">", 0)),
        B.iff(B.cmp(B.v("배너시간"), ">", 0), [
          B.change("배너시간", -1),
          // 보스 웨이브는 빨간 띠, 부제가 있으면 높은 띠 (웹과 같다)
          B.ifElse(B.cmp(B.v("배너보스"), "=", 1),
            [B.ifElse(B.cmp(B.v("배너부제"), ">", 0), [B.shapeV("banner_red84")], [B.shapeV("banner_red56")])],
            [B.ifElse(B.cmp(B.v("배너부제"), ">", 0), [B.shapeV("banner_yellow84")], [B.shapeV("banner_yellow56")])]),
          // 띠 가운데 = 기준점 + (높이 ÷ 2 − 28) 아래
          B.ifElse(B.cmp(B.v("배너부제"), ">", 0), [B.goXY(0, B.sub(bannerY(B), 7))], [B.goXY(0, bannerY(B))]),
          bannerAlpha(B),
        ]),
      ])]),
    ],
  });

  // ================= 증강 목록 (오른쪽 위) =================
  // 4개까지: 폭 220 패널에 한 줄씩 / 5개부터: 폭 316 패널에 두 열로 작게 (웹과 같다)
  objects.push({
    name: "증강줄", pictures: AUGS.flatMap((a, k) => Array.from({ length: a.max }, (_, l) => [pic("aug_row_" + k + "_" + (l + 1)), pic("aug_crow_" + k + "_" + (l + 1))]).flat()),
    scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 0), B.repeat(AUGS.length, [B.change("칸", 1), B.clone("self")])]),
      remake(B, "정리", [B.set("칸", 0), B.repeat(AUGS.length, [B.change("칸", 1), B.clone("self")])]),
      B.when.clone([B.set("복제본", 1), B.forever([whileIn(B, IN_GAME, [
        B.set("앞수", 0),
        ...AUGS.map((a, k) => B.iff(B.and(B.cmp(B.v("칸"), ">", k + 1), B.cmp(B.v(a.v), ">", 0)), [B.change("앞수", 1)])),
        ...AUGS.map((a, k) => B.iff(B.cmp(B.v("칸"), "=", k + 1), [
          showIn(B, IN_GAME, B.cmp(B.v(a.v), ">", 0)),
          B.iff(B.cmp(B.v(a.v), ">", 0), [
            B.ifElse(B.cmp(B.v("증강수"), "<", 5), [
              B.shapeV(B.join("aug_row_" + k + "_", B.v(a.v))),
              B.goXY(ex(838), B.sub(ey(64), B.mul(16, B.v("앞수")))),
            ], [
              // 두 열: 위→아래, 왼쪽 열 → 오른쪽 열 (한 열 3줄)
              B.shapeV(B.join("aug_crow_" + k + "_", B.v(a.v))),
              B.goXY(B.add(ex(640 + 75), B.mul(75, B.mathOp("floor", B.div(B.v("앞수"), 3)))), B.sub(ey(58), B.mul(12, B.mod(B.v("앞수"), 3)))),
            ]),
          ]),
        ])),
        B.wait(0.03),
      ])])]),
    ],
  });
  objects.push(sprite("증강판", [1, 2, 3, 4, 5, 6].map((n) => "aug_panel" + n), 0, 0, IN_GAME, (B) => [
    B.set("증강수", 0), ...AUGS.map((a) => B.iff(B.cmp(B.v(a.v), ">", 0), [B.change("증강수", 1)])),
    B.iff(B.cmp(B.v("증강수"), ">", 0), [B.shapeV(B.join("aug_panel", B.v("증강수")))]),
    B.ifElse(B.cmp(B.v("증강수"), "<", 5), [B.goXY(ex(838), B.sub(ey(12), B.div(B.add(44, B.mul(32, B.v("증강수"))), 4)))], [B.goXY(ex(790), ey(68))]),
  ], { cond: (B) => B.cmp(B.v("증강수"), ">", 0) }));

  // ================= 상태창 (왼쪽 위) =================
  objects.push({
    name: "체력번쩍", pictures: HP_WIDTHS.map((w, i) => pic("hpflash_" + i)), scale: 0.5, visible: false, scripts: (B) => [
      // 최대 체력이 늘면 1초 동안 하얀 빛이 깜빡이며 사라지고 노란 테두리 (웹과 같다)
      B.when.run([B.hide(), B.set("이전최대", TV(B, "시작체력")), B.set("번쩍", 0), B.forever([
        B.iff(B.and(B.cmp(B.v("최대체력"), ">", B.v("이전최대")), B.cmp(B.v("이전최대"), ">", 0)), [B.set("번쩍", 60)]),
        B.set("이전최대", B.v("최대체력")),
        showIn(B, IN_GAME, B.cmp(B.v("번쩍"), ">", 0)),
        B.iff(B.cmp(B.v("번쩍"), ">", 0), [
          B.change("번쩍", -1),
          B.shapeV(B.add(B.mathOp("round", B.div(B.sub(B.v("체력바길이"), 140), 28)), 1)),
          B.goXY(B.add(ex(28), B.div(B.v("체력바길이"), 4)), ey(63)),
          B.effect("transparency", B.mul(100, B.sub(1, B.mul(B.div(B.v("번쩍"), 60), B.add(0.5, B.mul(0.5, B.mathOp("sin", B.mul(B.v("번쩍"), 28)))))))),
        ]),
      ])]),
    ],
  });
  objects.push({
    name: "체력바", pictures: HP_WIDTHS.flatMap((w, wi) => [0, 1].flatMap((red) => Array.from({ length: 21 }, (_, lv) => pic("hp_" + wi + "_" + red + "_" + lv)))), scale: 0.5, visible: false,
    scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        showIn(B, IN_GAME),
        // 길이: 최대 체력 100 = 140px, 비례해서 늘어나고 258px 에서 멈춤 (웹과 같다). 20 단위로 6가지
        B.set("폭번호", B.mathOp("round", B.div(B.sub(B.v("최대체력"), 100), 20))),
        B.iff(B.cmp(B.v("폭번호"), "<", 0), [B.set("폭번호", 0)]), B.iff(B.cmp(B.v("폭번호"), ">", 5), [B.set("폭번호", 5)]),
        ...HP_WIDTHS.map((w, i) => B.iff(B.cmp(B.v("폭번호"), "=", i), [B.set("체력바길이", w)])),
        B.set("칸", B.mathOp("round", B.mul(B.div(B.v("체력"), B.v("최대체력")), 20))),
        B.iff(B.cmp(B.v("칸"), "<", 0), [B.set("칸", 0)]), B.iff(B.cmp(B.v("칸"), ">", 20), [B.set("칸", 20)]),
        // 30% 이하면 빨강
        B.ifElse(B.cmp(B.div(B.v("체력"), B.v("최대체력")), "<=", 0.3),
          [B.shapeV(B.add(B.add(B.mul(B.v("폭번호"), 42), 22), B.v("칸")))], [B.shapeV(B.add(B.add(B.mul(B.v("폭번호"), 42), 1), B.v("칸")))]),
        B.goXY(B.add(ex(28), B.div(B.v("체력바길이"), 4)), ey(63)),
      ])]),
    ],
  });
  objects.push(sprite("상태판", ["hud_panel"], ex(157), ey(12 + HUD_H / 2), IN_GAME));

  // ================= 보스 이름 · 체력바 (화면 위 가운데, 보스가 둘이면 아래로) =================
  objects.push({
    name: "보스이름", pictures: BOSS_LIST.map((t, i) => pic("boss_name" + i)), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 1), B.clone("self"), B.set("칸", 2), B.clone("self")]),
      remake(B, "정리", [B.set("칸", 1), B.clone("self"), B.set("칸", 2), B.clone("self")]),
      B.when.clone([B.set("복제본", 1), B.goXY(0, B.sub(ey(24), B.mul(25, B.sub(B.v("칸"), 1)))), B.forever([
        ...[1, 2].map((k) => B.iff(B.cmp(B.v("칸"), "=", k), [
          showIn(B, IN_GAME, B.cmp(B.v("보스" + k + "종류"), ">", 0)),
          B.iff(B.cmp(B.v("보스" + k + "종류"), ">", 0), [B.shapeV(B.v("보스" + k + "종류"))]),
        ])),
      ])]),
    ],
  });
  objects.push({
    name: "보스바", pictures: Array.from({ length: 21 }, (_, lv) => pic("boss_bar_" + lv)), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 1), B.clone("self"), B.set("칸", 2), B.clone("self")]),
      remake(B, "정리", [B.set("칸", 1), B.clone("self"), B.set("칸", 2), B.clone("self")]),
      B.when.clone([B.set("복제본", 1), B.goXY(0, B.sub(ey(47), B.mul(25, B.sub(B.v("칸"), 1)))), B.forever([
        ...[1, 2].map((k) => B.iff(B.cmp(B.v("칸"), "=", k), [
          showIn(B, IN_GAME, B.cmp(B.v("보스" + k + "종류"), ">", 0)),
          B.iff(B.cmp(B.v("보스" + k + "종류"), ">", 0), [B.shapeV(B.add(1, B.mathOp("round", B.mul(20, B.div(B.v("보스" + k + "체력"), B.add(B.v("보스" + k + "최대"), 0.001))))))]),
        ])),
      ])]),
    ],
  });

  // ================= 파티클 (적이 죽을 때 튀는 조각) =================
  // 6~10개, 사방으로 120~280 px/초, 1초에 5% 만 남게 느려지고, 빙글빙글 돌며 1 − t² 로 작아진다 (0.55초)
  const PART_SHAPES = ["circle", "square", "triangle"];
  const PART_COLORS = ["red", "brown", "purple", "orange", "yellow", "blue", "slate"];
  objects.push({
    name: "파편", pictures: PART_SHAPES.flatMap((s) => PART_COLORS.map((c) => pic("pt_" + s + "_" + c))), scale: 0.5, visible: false, scripts: (B) => {
      const burst = () => B.iff(B.cmp(B.listLen("파편x"), ">", 0), [
        B.goXY(B.listItem("파편x", 1), B.listItem("파편y", 1)),
        B.set("개수", B.rand(6, 10)), B.set("k", 0),
        B.repeat(B.v("개수"), [
          B.change("k", 1),
          // 원을 개수만큼 나눈 방향 ± 17° · 속력 1 ~ 2.33 (엔트리 px/프레임)
          B.set("회전속도", B.add(B.div(B.mul(360, B.v("k")), B.v("개수")), B.rand(-17, 17))),
          B.set("크기", B.div(B.rand(1000, 2333), 1000)),
          B.set("vx", B.mul(B.v("크기"), B.mathOp("cos", B.v("회전속도")))), B.set("vy", B.mul(B.v("크기"), B.mathOp("sin", B.v("회전속도")))),
          B.set("크기", B.div(B.rand(70, 110), 10)),            // 처음 크기 7 ~ 11 (웹)
          B.set("회전속도", B.div(B.rand(-57, 57), 10)),        // 빙글빙글 (프레임당 각도)
          // 색: 주 색 · 주 색 · 노랑 · 갈색 중 하나 / 모양: 동그라미 · 네모 · 세모 중 하나
          B.set("색", B.rand(1, 4)),
          B.iff(B.cmp(B.v("색"), "<=", 2), [B.ifElse(B.cmp(B.rand(1, 2), "=", 1), [B.set("색", B.listItem("파편색1", 1))], [B.set("색", B.listItem("파편색2", 1))])]),
          B.iff(B.cmp(B.v("색"), "=", 3), [B.set("색", "yellow")]), B.iff(B.cmp(B.v("색"), "=", 4), [B.set("색", "brown")]),
          B.set("모양번호", B.rand(1, 3)),
          ...PART_SHAPES.map((s, i) => B.iff(B.cmp(B.v("모양번호"), "=", i + 1), [B.shapeV(B.join("pt_" + s + "_", B.v("색")))])),
          B.set("나이", 0), B.rotateToV(B.rand(0, 359)),
          B.clone("self"),
        ]),
        ...["파편x", "파편y", "파편색1", "파편색2"].map((l) => B.listRemove(l, 1)),
      ]);
      return [
        B.when.run([B.hide(), B.set("복제본", 0), B.forever([burst()])]),
        B.when.clone([B.set("복제본", 1), B.forever([
          B.change("나이", 1),
          B.moveX(B.v("vx")), B.moveY(B.v("vy")),
          B.set("vx", B.mul(B.v("vx"), 0.9513)), B.set("vy", B.mul(B.v("vy"), 0.9513)),
          B.rotateToV(B.add(B.coord("self", "rotation"), B.v("회전속도"))),
          // 크기 = 처음 크기 × (1 − t²)  (그림은 크기 11 로 그렸다: 34 × 34 → 엔트리 17)
          B.size(B.mul(17, B.mul(B.div(B.v("크기"), 11), B.sub(1, B.mathOp("square", B.div(B.v("나이"), 33)))))),
          showIn(B, FIGHT_VIEW),
          B.iff(B.cmp(B.v("나이"), ">=", 33), [B.deleteClone()]),
        ])]),
        B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
      ];
    },
  });

  // ================= 적 머리 위 체력바 · 블랙홀 약점 · 회전 포대 화살표 =================
  objects.push({
    name: "적체력바", pictures: EBAR_RADII.flatMap((r) => Array.from({ length: 21 }, (_, lv) => pic("ebar_" + r + "_" + lv))), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.forever([
        B.iff(B.cmp(B.v("바만듦"), "<", B.listLen("슬롯비율")), [B.change("바만듦", 1), B.set("내번호", B.v("바만듦")), B.clone("self")]),
      ])]),
      B.when.clone([B.set("복제본", 1), B.forever([
        B.iff(B.cmp(B.v("내번호"), ">", B.listLen("슬롯비율")), [B.deleteClone()]),
        B.set("비율", B.listItem("슬롯비율", B.v("내번호"))),
        B.iff(B.cmp(B.v("비율"), "<", 0), [B.deleteClone()]),
        // 한 대라도 맞은 적만 (보스는 화면 위 큰 체력바가 대신)
        B.ifElse(B.or(B.cmp(B.v("비율"), ">=", 1), B.cmp(B.listItem("슬롯보스", B.v("내번호")), "=", 1)), [B.hide()], [
          // 폭은 적 크기에 맞춘다 (웹: max(r × 2.2, 24))
          B.shapeV(B.join(B.join("ebar_", B.listItem("슬롯폭", B.v("내번호"))), B.join("_", B.mathOp("round", B.mul(B.v("비율"), 20))))),
          B.goXY(B.listItem("슬롯x", B.v("내번호")), B.listItem("슬롯y", B.v("내번호"))), showIn(B, IN_GAME)]),
      ])]),
      B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
    ],
  });
  objects.push(sprite("약점글", ["b_bh_weaktext"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("블랙홀x"), B.sub(B.v("블랙홀y"), 33))],
    { cond: (B) => B.and(B.cmp(B.v("블랙홀있음"), "=", 1), B.cmp(B.v("블랙홀약점"), "=", 1)) }));
  objects.push(sprite("약점고리", ["b_bh_weak"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("블랙홀x"), B.v("블랙홀y")),
    // 0.6 + 0.4·sin(12t) 로 반짝 (웹과 같다)
    B.effect("transparency", B.mul(100, B.sub(1, B.add(0.6, B.mul(0.4, B.mathOp("sin", B.mul(B.v("블랙홀시간"), 11.46)))))))],
  { cond: (B) => B.and(B.cmp(B.v("블랙홀있음"), "=", 1), B.cmp(B.v("블랙홀약점"), "=", 1)) }));
  objects.push(sprite("지평선", ["b_bh_horizon"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("블랙홀x"), B.v("블랙홀y")), B.rotateToV(B.mul(B.v("블랙홀시간"), -0.38))],
    { cond: (B) => B.cmp(B.v("블랙홀있음"), "=", 1) }));
  objects.push(sprite("포대화살표", ["b_tu_arrowcw", "b_tu_arrowccw"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("포대x"), B.v("포대y")),
    // 회전 방향 화살표 (예고 중이면 다음 방향을 보여 준다)
    B.ifElse(B.cmp(B.mul(B.v("포대방향"), B.sub(1, B.mul(2, B.v("포대예고")))), ">", 0), [B.shapeV("b_tu_arrowcw")], [B.shapeV("b_tu_arrowccw")])],
  { cond: (B) => B.cmp(B.v("포대있음"), "=", 1) }));

  // ================= 적 탄 (빨간 뾰족한 가시, 날아가는 쪽을 향함) =================
  objects.push({
    name: "적탄", pictures: [pic("ebullet")], scale: 0.5, visible: false, scripts: (B) => {
      const take = () => B.iff(B.cmp(B.listLen("탄x"), ">", 0), [
        B.goXY(B.listItem("탄x", 1), B.listItem("탄y", 1)), B.set("피해", B.listItem("탄피해", 1)),
        B.set("vx", B.mul(B.mathOp("cos", B.listItem("탄각", 1)), ENEMY_BULLET_SPEED)), B.set("vy", B.mul(B.mathOp("sin", B.listItem("탄각", 1)), ENEMY_BULLET_SPEED)),
        B.rotateToV(B.mul(B.listItem("탄각", 1), -1)),
        ...["탄x", "탄y", "탄각", "탄피해"].map((l) => B.listRemove(l, 1)),
        B.clone("self"),
      ]);
      return [
        B.when.run([B.hide(), B.set("복제본", 0), B.forever(Array.from({ length: 12 }, take))]),
        B.when.clone([B.set("복제본", 1), B.show(), B.forever([
          B.iff(fighting(B), [
            B.moveX(B.v("vx")), B.moveY(B.v("vy")),
            B.iff(B.and(B.touching("플레이어"), B.and(B.cmp(B.v("무적"), "<=", 0), canHurt(B))), [
              B.change("체력", B.mul(B.v("피해"), -1)), B.set("무적", invFrames(B)),
              ...popup(B, playerX(B), B.add(playerY(B), 18), B.v("피해"), 2),
              B.deleteClone()]),
          ]),
          showIn(B, IN_GAME),
          B.iff(outside(B), [B.deleteClone()]),
        ])]),
        B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
      ];
    },
  });

  // ================= 적 =================
  objects.push(enemyObject());
  // 몸 뒤에 그리는 보스 부품: 파동 군주 물결 테두리 · 회전 포대 총구 · 블랙홀 강착 원반
  objects.push(sprite("파동테두리", ["b_wl_ring"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("파동x"), B.v("파동y")), B.rotateToV(B.mul(B.v("타이머숨"), 0.48))],
    { cond: (B) => B.cmp(B.v("파동있음"), "=", 1) }));
  objects.push(sprite("포대총구", ["b_tu_barrels0", "b_tu_barrels1"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("포대x"), B.v("포대y")), B.rotateToV(B.mul(B.v("포대각"), -1)),
    // 방향이 바뀌기 1초 전부터 노랗게 깜빡 (웹: 1초에 8번)
    B.ifElse(B.and(B.cmp(B.v("포대예고"), "=", 1), B.cmp(B.mod(B.v("타이머숨"), 8), "<", 4)), [B.shapeV("b_tu_barrels1")], [B.shapeV("b_tu_barrels0")])],
  { cond: (B) => B.cmp(B.v("포대있음"), "=", 1) }));
  objects.push(sprite("강착원반", ["b_bh_disk"], 0, 0, IN_GAME, (B) => [B.goXY(B.v("블랙홀x"), B.v("블랙홀y")), B.rotateToV(B.mul(B.v("블랙홀시간"), 1.43))],
    { cond: (B) => B.cmp(B.v("블랙홀있음"), "=", 1) }));
  // 돌격형 · 돌진 대장의 예고선 (적보다 아래, 예고 시간 동안 점점 진해진다)
  objects.push({
    name: "예고선", pictures: pics(["warn", "warnBoss"]), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.forever([
        B.iff(B.cmp(B.v("선만듦"), "<", B.listLen("슬롯선각")), [B.change("선만듦", 1), B.set("내번호", B.v("선만듦")), B.clone("self")]),
      ])]),
      B.when.clone([B.set("복제본", 1), B.forever([
        B.iff(B.cmp(B.v("내번호"), ">", B.listLen("슬롯선각")), [B.deleteClone()]),
        B.iff(B.cmp(B.listItem("슬롯비율", B.v("내번호")), "<", 0), [B.deleteClone()]),
        B.set("선각", B.listItem("슬롯선각", B.v("내번호"))),
        B.ifElse(B.cmp(B.v("선각"), "<", 0), [B.hide()], [
          B.ifElse(B.cmp(B.listItem("슬롯보스", B.v("내번호")), "=", 1), [B.shapeV("warnBoss")], [B.shapeV("warn")]),
          B.goXY(B.listItem("슬롯x", B.v("내번호")), B.listItem("슬롯y", B.v("내번호"))), B.rotateToV(B.mul(B.v("선각"), -1)),
          // 알파 0.35 → 0.9
          B.effect("transparency", B.mul(100, B.sub(1, B.add(0.35, B.mul(0.55, B.listItem("슬롯선진함", B.v("내번호"))))))),
          showIn(B, IN_GAME)]),
      ])]),
      B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
    ],
  });

  // ================= 총알 (노란 알갱이 + 꼬리, 날아가는 쪽을 향함) =================
  const bulletObject = (name, onFire) => ({
    name, pictures: [pic("bullet")], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
      B.when.msg("발사", [B.iff(isOrig(B), onFire(B))]),
      B.when.clone([
        B.set("복제본", 1), B.goTo("플레이어"), B.set("나이", 0), B.set("속력", TVspeed(B, "총알속도")),
        B.forever([
          // 움직이기 "전에" 닿았는지 본다 (태어난 프레임은 빼고) → 같은 프레임에 적도 이 총알을 볼 수 있다
          B.iff(B.and(B.cmp(B.v("나이"), ">", 0), B.touching("적")), [B.deleteClone()]),
          B.iff(fighting(B), [
            // 블랙홀이 있으면 그쪽으로 휜다 (빠르기는 그대로)
            B.iff(B.cmp(B.v("블랙홀있음"), "=", 1), [
              B.set("bx", B.sub(B.v("블랙홀x"), B.myX())), B.set("by", B.sub(B.v("블랙홀y"), B.myY())),
              B.set("bd", B.add(B.mathOp("root", B.add(B.mathOp("square", B.v("bx")), B.mathOp("square", B.v("by")))), 0.01)),
              B.set("ba", B.div(BH_BEND, B.mathOp("square", B.v("bd")))), B.iff(B.cmp(B.v("ba"), ">", BH_BEND_MAX), [B.set("ba", BH_BEND_MAX)]),
              B.change("vx", B.mul(B.v("ba"), B.div(B.v("bx"), B.v("bd")))), B.change("vy", B.mul(B.v("ba"), B.div(B.v("by"), B.v("bd")))),
              B.set("bd", B.mathOp("root", B.add(B.mathOp("square", B.v("vx")), B.mathOp("square", B.v("vy"))))),
              B.set("vx", B.mul(B.v("vx"), B.div(B.v("속력"), B.v("bd")))), B.set("vy", B.mul(B.v("vy"), B.div(B.v("속력"), B.v("bd")))),
            ]),
            B.moveX(B.v("vx")), B.moveY(B.v("vy")), B.change("나이", 1),
          ]),
          ...setAngle(B, "각", B.v("vx"), B.v("vy")), B.rotateToV(B.mul(B.v("각"), -1)),
          showIn(B, IN_GAME),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
    ],
  });
  // 조준한 총알 1발
  objects.push(bulletObject("총알", (B) => [B.set("vx", B.v("쏠vx")), B.set("vy", B.v("쏠vy")), B.clone("self")]));
  // 3방향 탄의 옆 총알 n − 1 발: 조준 방향을 (360° ÷ n) 씩 돌린다 (x' = x·cosθ − y·sinθ, y' = x·sinθ + y·cosθ)
  objects.push(bulletObject("보조총알", (B) => [B.iff(B.cmp(B.v("삼방향"), ">", 0), [
    B.set("각", 0),
    ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("삼방향"), "=", lv), [
      B.repeat(MULTI_COUNT[lv] - 1, [
        B.change("각", 360 / MULTI_COUNT[lv]),
        B.set("vx", B.sub(B.mul(B.v("쏠vx"), B.mathOp("cos", B.v("각"))), B.mul(B.v("쏠vy"), B.mathOp("sin", B.v("각"))))),
        B.set("vy", B.add(B.mul(B.v("쏠vx"), B.mathOp("sin", B.v("각"))), B.mul(B.v("쏠vy"), B.mathOp("cos", B.v("각"))))),
        B.clone("self"),
      ]),
    ])),
  ])]));

  // ================= 플레이어 =================
  objects.push({
    name: "플레이어", pictures: [0, 1, 2, 3, 4, 5, 6, 7].map((d) => pic("p_body_" + d)), scale: 0.5, x: 0, y: -40, visible: false, scripts: (B) => {
      const keyPair = (a, b) => B.or(B.key(a), B.key(b));
      return [
        B.when.run([B.hide()]),
        B.when.msg("게임시작", [B.goXY(0, -40), B.clearEffects(), B.set("바라봄", 0)]),
        B.when.run([B.forever([showIn(B, IN_GAME),
          B.iff(fighting(B), [
            // 1) 이동: 방향키 또는 WASD. 대각선은 0.707 배
            B.set("이동x", 0), B.set("이동y", 0),
            B.iff(keyPair(39, 68), [B.change("이동x", 1)]), B.iff(keyPair(37, 65), [B.change("이동x", -1)]),
            B.iff(keyPair(38, 87), [B.change("이동y", 1)]), B.iff(keyPair(40, 83), [B.change("이동y", -1)]),
            B.set("움직임", 0), B.iff(B.or(B.cmp(B.v("이동x"), "!=", 0), B.cmp(B.v("이동y"), "!=", 0)), [B.set("움직임", 1)]),
            B.iff(B.and(B.cmp(B.v("이동x"), "!=", 0), B.cmp(B.v("이동y"), "!=", 0)), [B.set("이동x", B.mul(B.v("이동x"), 0.707)), B.set("이동y", B.mul(B.v("이동y"), 0.707))]),
            B.moveX(B.add(B.mul(B.v("이동x"), TVspeed(B, "이동속도")), B.v("끌림vx"))), B.moveY(B.add(B.mul(B.v("이동y"), TVspeed(B, "이동속도")), B.v("끌림vy"))),
            // 블랙홀에 끌려가는 속도는 마찰로 줄어든다
            B.set("끌림vx", B.mul(B.v("끌림vx"), BH_FRICTION)), B.set("끌림vy", B.mul(B.v("끌림vy"), BH_FRICTION)),
            B.iff(B.cmp(B.myX(), ">", 231), [B.setX(231)]), B.iff(B.cmp(B.myX(), "<", -231), [B.setX(-231)]),
            B.iff(B.cmp(B.myY(), ">", 126), [B.setY(126)]), B.iff(B.cmp(B.myY(), "<", -126), [B.setY(-126)]),
            // 2) 조준: 적들이 이번 프레임에 적어 둔 "가장 가까운 적"
            B.set("목표있음", 0),
            B.iff(B.cmp(B.v("후보거리"), "<", 99999), [B.set("목표있음", 1), B.set("목표x", B.v("후보x")), B.set("목표y", B.v("후보y"))]),
            B.set("후보거리", 99999),
            B.iff(B.cmp(B.v("목표있음"), "=", 1), setAngle(B, "바라봄", B.sub(B.v("목표x"), B.myX()), B.sub(B.v("목표y"), B.myY()))),
            // 3) 자동 발사
            B.change("발사타이머", -1),
            B.iff(B.and(B.cmp(B.v("발사타이머"), "<=", 0), B.cmp(B.v("목표있음"), "=", 1)), [
              B.set("조준거리", B.add(B.mathOp("root", B.add(B.mathOp("square", B.sub(B.v("목표x"), B.myX())), B.mathOp("square", B.sub(B.v("목표y"), B.myY())))), 0.01)),
              B.set("쏠vx", B.mul(B.div(B.sub(B.v("목표x"), B.myX()), B.v("조준거리")), TVspeed(B, "총알속도"))),
              B.set("쏠vy", B.mul(B.div(B.sub(B.v("목표y"), B.myY()), B.v("조준거리")), TVspeed(B, "총알속도"))),
              B.send("발사"), B.set("발사타이머", B.v("발사간격")),
            ]),
            // 4) 무적: 0.1초 간격으로 반투명(0.45) ↔ 불투명 (웹과 같다)
            B.ifElse(B.cmp(B.v("무적"), ">", 0), [
              B.change("무적", -1),
              B.ifElse(B.cmp(B.mod(B.mathOp("floor", B.div(B.v("무적"), 6)), 2), "=", 0), [B.effect("transparency", 55)], [B.effect("transparency", 0)]),
            ], [B.effect("transparency", 0)]),
          ]),
          // 눈은 바라보는 쪽 (8방향)
          B.shapeV(B.add(dir8(B, B.v("바라봄")), 1)),
        ])]),
      ];
    },
  });
  // 총구: 플레이어 몸 뒤, 목표 쪽으로 돈다
  objects.push(sprite("총구", ["p_gun"], 0, 0, IN_GAME, (B) => [B.goTo("플레이어"), B.rotateToV(B.mul(B.v("바라봄"), -1))]));
  // 시간 지연 범위 + "시간 ×0.20" (움직이는 동안 진하게)
  objects.push(sprite("지연글", ["slow_text"], 0, 0, IN_GAME, (B) => [
    B.goXY(playerX(B), B.sub(playerY(B), B.add(B.div(B.add(B.mul(B.v("지연"), 25), 65), 2), 7)))],
  { cond: (B) => B.and(B.cmp(B.v("지연"), ">", 0), B.cmp(B.v("움직임"), "=", 1)) }));
  objects.push(sprite("지연원", [0, 1, 2].flatMap((lv) => [0, 1].map((s) => "slow_" + lv + "_" + s)), 0, 0, IN_GAME, (B) => [
    B.goTo("플레이어"), B.iff(B.cmp(B.v("지연"), ">", 0), [B.shapeV(B.add(B.mul(B.sub(B.v("지연"), 1), 2), B.add(B.v("움직임"), 1)))])],
  { cond: (B) => B.cmp(B.v("지연"), ">", 0) }));

  // ================= 배경 + 게임 진행 (맨 뒤) =================
  // ================= 시계 (프레임마다 +1): 메뉴 장식 · 반짝임 · 생존 시간 · 카드 등장 · "준비!" · 알림 =================
  //   배경 오브젝트의 "다른 스크립트 멈추기" 에 같이 멈추지 않게 따로 둔다
  objects.push({ name: "시계", pictures: [pic("menu_hint")], scale: 0.5, visible: false, scripts: (B) => [
    B.when.run([B.forever([B.change("타이머숨", 1),
      B.iff(fighting(B), [B.change("생존", 1 / 60)]),
      B.iff(stateIs(B, "고르기"), [B.change("고르기시간", 1)]),
      B.iff(stateIs(B, "재개"), [B.change("멈춤시간", -1), B.iff(B.cmp(B.v("멈춤시간"), "<=", 0), [B.set("상태", "전투")])]),
      B.iff(B.cmp(B.v("알림시간"), ">", 0), [B.change("알림시간", -1)]),
      B.iff(B.cmp(B.v("흔들시간"), ">", 0), [B.change("흔들시간", -1)]),
    ])]),
  ] });

  // ================= 디버그 모드 (웹과 같다) =================
  // ` 켜기/끄기 (웹의 F2. 켤 때 비밀번호) · [ ] 웨이브 이동 · G 지급 창 · B 보스 선택 · Shift+0 체력 가득 · I 무적
  // 비밀번호는 엔트리의 "묻고 기다리기" 대답 칸에 넣는다 (웹은 코인이 있어 Shift+C 코인 +1000 도 있지만 엔트리판엔 코인이 없다)
  objects.push({ name: "디버그", pictures: [pic("menu_hint")], scale: 0.5, x: 225, y: -85, visible: false, scripts: (B) => {
    const debugText = (B) => B.ifElse(B.cmp(B.v("디버그무적"), "=", 1), [B.set("디버그글", "DEBUG · 무적")], [B.set("디버그글", "DEBUG")]);
    const pinOk = (B) => B.and(B.isNumber(B.answer()), B.and(B.and(B.cmp(B.answer(), ">=", 0), B.cmp(B.answer(), "<", PIN_MOD)),
      B.and(B.cmp(B.mathOp("floor", B.answer()), "=", B.answer()), B.cmp(B.mod(B.mul(B.answer(), PIN_MUL), PIN_MOD), "=", PIN_CHECK))));
    return [
      B.when.run([B.set("디버그", 0), B.set("디버그무적", 0), B.set("치트무적", 0), B.set("주인확인", 0), B.set("알림시간", 0), B.set("흔들시간", 0), B.set("시작웨이브", 1), B.hideAnswer()]),
      // ` 키 (웹은 F2. 엔트리는 F2 키를 못 받아서 숫자 1 왼쪽의 ` 키로)
      B.when.key(192, [B.ifElse(B.cmp(B.v("디버그"), "=", 1), [B.send("디버그끄기")], [
        B.iff(B.not(B.or(stateIn(B, LOCK_STATES), stateIs(B, "조절입력"))), [B.set("요청종류", 1), B.send("잠금열기")])])]),
      B.when.msg("디버그끄기", [B.set("디버그", 0), B.set("치트무적", 0), B.set("알림시간", 0)]),
      // 주인 잠금: 이미 열려 있으면 바로, 아니면 비밀번호 (틀리면 흔들고 다시, 빈칸이면 취소)
      B.when.msg("잠금열기", [B.ifElse(B.cmp(B.v("주인확인"), "=", 1), [B.send("잠금성공")], [
        B.set("이전상태", B.v("상태")),
        // 전투 중이면 비밀번호를 넣는 동안 멈춰 두고, 끝나면 일시정지 화면으로 (웹과 같다)
        B.iff(B.or(stateIs(B, "전투"), stateIs(B, "재개")), [B.set("이전상태", "멈춤")]),
        B.ifElse(stateIn(B, IN_GAME), [B.set("상태", "잠금")], [B.ifElse(stateIs(B, "설정"), [B.set("상태", "설정잠금")], [B.set("상태", "메뉴잠금")])]),
        B.set("비번틀림", 0), B.set("끝", 0),
        B.repeatUntil(B.cmp(B.v("끝"), "=", 1), [
          // (엔트리 대답 칸은 빈칸으로 낼 수 없어서, 숫자가 아닌 글 (예: 취소) 을 내면 그만둔다)
          B.ask("비밀번호 (그만두기: 취소)"),
          B.ifElse(B.not(B.isNumber(B.answer())), [B.set("끝", 1)], [
            B.ifElse(pinOk(B), [B.set("주인확인", 1), B.set("끝", 1)], [B.set("비번틀림", 1), B.set("흔들시간", 21)])]),
        ]),
        B.set("상태", B.v("이전상태")),
        B.iff(B.cmp(B.v("주인확인"), "=", 1), [B.send("잠금성공")]),
      ])]),
      B.when.msg("잠금성공", [
        B.iff(B.cmp(B.v("요청종류"), "=", 1), [B.set("디버그", 1), B.set("치트무적", B.v("디버그무적")), debugText(B), ...say(B, "디버그 모드 ON")]),
        B.iff(B.cmp(B.v("요청종류"), "=", 2), [B.set("상태", "조절"), B.send("조절열기")]),
      ]),
      // 숫자 조절: 줄을 누르면 새 값을 묻는다 (숫자가 아니거나 너무 작으면 안 바꾼다)
      B.when.msg("조절입력", [
        B.set("상태", "조절입력"),
        ...TUNES.map((t, i) => B.iff(B.cmp(B.v("조절칸"), "=", i + 1), [
          B.ask(t.label + " (기본 " + t.def + ") 새 값은? (그만두기: 취소)"),
          B.iff(B.cmp(B.answer(), "!=", "취소"), [
            B.ifElse(B.isNumber(B.answer()), [
              B.set("입력값", B.answer()), ...(t.int ? [B.set("입력값", B.mathOp("round", B.v("입력값")))] : []),
              B.ifElse(B.cmp(B.v("입력값"), "<", t.min), [...say(B, t.min + " 보다 작게는 못 바꿔요", "빨강")], [B.set(t.v, B.join(B.v("입력값"), ""))]),
            ], [...say(B, "숫자를 넣어 주세요", "빨강")]),
          ]),
        ])),
        B.set("상태", "조절"),
      ]),
      // Esc: 창 닫기
      B.when.msg("창닫기", [
        B.ifElse(stateIs(B, "설정"), [B.set("상태", "메뉴")], [
          B.ifElse(stateIs(B, "조절"), [B.set("상태", "설정")], [
            B.ifElse(stateIs(B, "메뉴보스"), [B.set("상태", "메뉴")], [
              B.iff(B.or(stateIs(B, "지급"), stateIs(B, "보스선택")), [B.set("상태", B.v("이전상태"))])])])]),
      ]),
      // [ ] 웨이브 이동
      ...[[219, -1], [221, 1]].map(([k, d]) => B.when.key(k, [B.iff(B.and(B.cmp(B.v("디버그"), "=", 1), stateIn(B, DEBUG_GAME)), [
        B.set("이동웨이브", B.add(B.v("웨이브"), d)),
        B.iff(B.and(B.cmp(B.v("이동웨이브"), ">=", 1), B.cmp(B.v("이동웨이브"), "<=", WAVE_COUNT)), [
          B.set("상태", "준비"), B.send("웨이브이동"), ...say(B, B.join("웨이브 ", B.join(B.v("이동웨이브"), " 로 이동")))]),
      ])])),
      // G 지급 창 (전투 · 카드 고르기 중에만)
      B.when.key(71, [B.iff(B.cmp(B.v("디버그"), "=", 1), [
        B.ifElse(stateIs(B, "지급"), [B.set("상태", B.v("이전상태"))], [
          B.ifElse(stateIn(B, DEBUG_GAME), [B.set("이전상태", B.v("상태")), B.set("상태", "지급"), B.send("지급열기")], [
            B.iff(B.not(B.or(stateIn(B, LOCK_STATES), stateIs(B, "조절입력"))), say(B, "증강 지급은 전투 중에만", "빨강"))])])])]),
      // B 보스 선택 (어느 화면에서나)
      B.when.key(66, [B.iff(B.cmp(B.v("디버그"), "=", 1), [
        B.ifElse(stateIs(B, "보스선택"), [B.set("상태", B.v("이전상태"))], [
          B.ifElse(stateIs(B, "메뉴보스"), [B.set("상태", "메뉴")], [
            B.ifElse(B.or(stateIn(B, DEBUG_GAME), stateIs(B, "결과")), [B.set("이전상태", B.v("상태")), B.set("상태", "보스선택"), B.send("보스열기")], [
              B.iff(stateIn(B, ["메뉴", "조작법", "도감"]), [B.set("이전상태", "메뉴"), B.set("상태", "메뉴보스"), B.send("보스열기")])])])])])]),
      // Shift + 0 체력 가득
      B.when.key(48, [B.iff(B.and(B.cmp(B.v("디버그"), "=", 1), B.and(B.key(16), stateIn(B, DEBUG_GAME))), [B.set("체력", B.v("최대체력")), ...say(B, "체력 가득!")])]),
      // I 무적
      B.when.key(73, [B.iff(B.cmp(B.v("디버그"), "=", 1), [
        B.set("디버그무적", B.sub(1, B.v("디버그무적"))), B.set("치트무적", B.v("디버그무적")), debugText(B),
        B.ifElse(B.cmp(B.v("디버그무적"), "=", 1), say(B, "무적 ON"), say(B, "무적 OFF"))])]),
    ];
  } });
  objects.push(managerObject());

  // 전투 화면 겹침 순서를 웹과 같게 (앞 → 뒤): 플레이어 > 적 탄 > 적 (+ 체력바) > 파편 > 총알 > 증강 범위
  const GAME_ORDER = ["플레이어", "총구", "적탄", "적체력바", "약점글", "약점고리", "지평선", "포대화살표", "적", "파동테두리", "포대총구", "강착원반",
    "예고선", "파편", "총알", "보조총알", "지연글", "지연원"];
  const firstGame = Math.min(...GAME_ORDER.map((n) => objects.findIndex((o) => o.name === n)));
  const gameObjs = GAME_ORDER.map((n) => objects.find((o) => o.name === n));
  if (gameObjs.some((o) => !o) || objects.slice(firstGame, firstGame + GAME_ORDER.length).some((o) => !GAME_ORDER.includes(o.name))) throw new Error("전투 오브젝트 순서를 다시 확인하세요");
  objects.splice(firstGame, GAME_ORDER.length, ...gameObjs);

  // 맨 위에 블록이 없는 작은 오브젝트: 작품을 열 때 처음 고른 오브젝트의 블록을 그리느라 오래 걸리지 않게
  // 맨 위 썸네일: ▶ 를 누르기 전(편집 화면)에만 보인다. 엔트리는 작품을 저장할 때 무대를 찍어 대표 그림으로 쓴다.
  //   블록이 적어서 작품을 열 때 처음 고른 오브젝트로도 가볍다
  objects.unshift({ name: "썸네일", pictures: [pic("thumb")], scale: 0.5, visible: true, scripts: (B) => [B.when.run([B.hide()])] });
  return { scene: "증강 슈팅", variables, lists: LISTS, listInit, messages, objects };

  // ---------------------------------------------------------------
  // 적 오브젝트: 원본이 "생성" 대기열에서 하나씩 꺼내 복제본을 만든다 (졸개 · 보스 · 소환 · 분열 모두)
  function enemyObject() {
    const enemyPics = [];
    const add = (key) => enemyPics.push(pic(key));
    for (const v of [1, 2, 3]) for (let d = 0; d < 8; d++) for (const f of [0, 1]) add("e_basic" + v + "_" + d + "_" + f);
    for (let a = 0; a < 16; a++) for (const f of [0, 1]) { add("e_charger_" + a + "_" + f); add("b_ck_" + a + "_" + f); }
    for (let d = 0; d < 8; d++) for (const f of [0, 1]) {
      add("e_sine_" + d + "_" + f); add("e_splitter_" + d + "_" + f); add("e_splitterChild_" + d + "_" + f);
      for (const p of [0, 1, 2]) add("b_sk" + p + "_" + d + "_" + f);
      add("b_wl_" + d + "_" + f); add("b_tu_" + d + "_" + f); add("b_bh_" + d + "_" + f);
    }
    return {
      name: "적", pictures: enemyPics, scale: 0.5, visible: false, scripts: (B) => {
        const typeIs = (t) => B.cmp(B.v("종류"), "=", t.id);
        const dx = () => B.sub(playerX(B), B.myX());
        const dy = () => B.sub(playerY(B), B.myY());
        const rnd01 = () => B.div(B.rand(0, 1000), 1000);
        const slow = () => B.v("느림");
        // (tx, ty) 쪽으로 speed (엔트리 px/프레임) 만큼
        const moveTo = (tx, ty, speed) => [
          B.set("dx", B.sub(tx, B.myX())), B.set("dy", B.sub(ty, B.myY())),
          B.set("거리", B.add(B.mathOp("root", B.add(B.mathOp("square", B.v("dx")), B.mathOp("square", B.v("dy")))), 0.0001)),
          B.moveX(B.mul(B.div(B.v("dx"), B.v("거리")), speed)), B.moveY(B.mul(B.div(B.v("dy"), B.v("거리")), speed)),
        ];
        const clampInside = () => [
          B.iff(B.cmp(B.myX(), ">", B.sub(240, B.v("반지름"))), [B.setX(B.sub(240, B.v("반지름")))]), B.iff(B.cmp(B.myX(), "<", B.sub(B.v("반지름"), 240)), [B.setX(B.sub(B.v("반지름"), 240))]),
          B.iff(B.cmp(B.myY(), ">", B.sub(135, B.v("반지름"))), [B.setY(B.sub(135, B.v("반지름")))]), B.iff(B.cmp(B.myY(), "<", B.sub(B.v("반지름"), 135)), [B.setY(B.sub(B.v("반지름"), 135))]),
        ];
        const spawnReq = (type, x, y, px, py) => [B.listAdd("생성종류", type), B.listAdd("생성x", x), B.listAdd("생성y", y), B.listAdd("생성밀기x", px), B.listAdd("생성밀기y", py)];
        const aimDir = () => setAngle(B, "각", dx(), dy());   // 바라보는(돌진할) 방향 = 플레이어 쪽
        const enemyBullet = (x, y, ang, dmg) => [B.listAdd("탄x", x), B.listAdd("탄y", y), B.listAdd("탄각", ang), B.listAdd("탄피해", B.mul(dmg, B.v("대미지배율")))];
        const ring = (offset, dmg) => Array.from({ length: 12 }, (_, k) => enemyBullet(
          B.add(B.myX(), B.mul(17, B.mathOp("cos", B.add(B.v("링각"), k * 30 + offset)))), B.add(B.myY(), B.mul(17, B.mathOp("sin", B.add(B.v("링각"), k * 30 + offset)))),
          B.add(B.v("링각"), k * 30 + offset), dmg)).flat();
        // 총알 하나에 맞았을 때
        const hit = (scale) => [
          B.set("분산배율", 1),
          B.iff(B.cmp(B.v("분산"), ">", 0), [
            ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("분산"), "=", lv), [B.set("분산높음", VARIANCE_MAX[lv])])),
            B.set("분산p", B.div(1.1 - 0.6, B.sub(B.div(B.add(1, B.v("분산높음")), 2), 0.6))),
            B.ifElse(B.cmp(rnd01(), "<", B.v("분산p")), [B.set("분산배율", B.add(1, B.mul(rnd01(), B.sub(B.v("분산높음"), 1))))], [B.set("분산배율", B.add(0.2, B.mul(rnd01(), 0.8)))]),
          ]),
          B.set("맞은대미지", B.mul(B.mul(B.v("공격력"), scale), B.v("분산배율"))),
          // 블랙홀: 약점이 아니면 30% 만
          B.iff(B.and(typeIs(T.bh), B.cmp(B.v("블랙홀약점"), "=", 0)), [B.set("맞은대미지", B.mul(B.v("맞은대미지"), BH_ARMOR))]),
          B.change("적체력", B.mul(B.v("맞은대미지"), -1)), B.set("번쩍", 5),
          ...popup(B, B.myX(), B.add(B.myY(), B.v("반지름")), B.v("맞은대미지"), 1),
          // 넉백 (보스는 안 밀린다)
          B.iff(B.and(B.cmp(B.v("넉백"), ">", 0), B.cmp(B.v("종류"), "<", 10)), [
            ...setAngle(B, "k", B.mul(dx(), -1), B.mul(dy(), -1)),
            ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("넉백"), "=", lv), [B.set("밀기x", B.mul(KNOCK_SPEED[lv], B.mathOp("cos", B.v("k")))), B.set("밀기y", B.mul(KNOCK_SPEED[lv], B.mathOp("sin", B.v("k"))))])),
          ]),
          // 분열의 왕: 66%, 33% 를 지나면 조각 3마리 (120° 간격, 바깥으로 튕겨 나감), 몸이 작아지고 1.3배 빨라진다
          B.iff(typeIs(T.sk), [0, 1].map((p) => B.iff(B.and(B.cmp(B.v("분열단계"), "=", p), B.cmp(B.v("적체력"), "<", B.mul(B.v("적최대"), [0.66, 0.33][p]))), [
            ...[0, 1, 2].flatMap((i) => { const a = (90 - p * 60 - i * 120) * Math.PI / 180;
              return spawnReq(T.child.id, B.add(B.myX(), B.mul(B.v("반지름"), Math.cos(a))), B.add(B.myY(), B.mul(B.v("반지름"), Math.sin(a))), 2 * Math.cos(a), 2 * Math.sin(a)); }),
            B.change("분열단계", 1), B.set("반지름", [16, 12][p]), B.set("속도", B.mul(B.v("속도"), 1.3)),
            ...particles(B, B.myX(), B.myY(), "orange", "orange"),
          ]))),
          // 돌진 대장: 50% 아래면 화난 상태 (다음 사이클부터 4연속 돌진)
          B.iff(B.and(typeIs(T.ck), B.cmp(B.v("적체력"), "<", B.mul(B.v("적최대"), 0.5))), [B.set("화남", 1)]),
        ];
        const die = () => [
          B.change("점수", B.mul(B.listItem("적표점수", B.v("종류")), B.v("웨이브"))),
          ...particles(B, B.myX(), B.myY(), B.listItem("적표파편1", B.v("종류")), B.listItem("적표파편2", B.v("종류"))),
          // 보스: 최대 체력의 절반 회복 (초록 숫자), 잡은 보스 +1, 체력바 자리 비우기
          B.iff(B.cmp(B.v("종류"), ">", 10), [
            B.set("회복량", B.sub(B.v("최대체력"), B.v("체력"))), B.iff(B.cmp(B.v("회복량"), ">", B.mul(B.v("최대체력"), TV(B, "보스회복"))), [B.set("회복량", B.mul(B.v("최대체력"), TV(B, "보스회복")))]),
            B.change("체력", B.v("회복량")), ...popup(B, playerX(B), B.add(playerY(B), 18), B.v("회복량"), 3),
            B.change("잡은보스", 1),
            B.iff(B.cmp(B.v("보스칸"), "=", 1), [B.set("보스1종류", 0)]), B.iff(B.cmp(B.v("보스칸"), "=", 2), [B.set("보스2종류", 0)]),
          ]),
          B.iff(typeIs(T.wl), [B.set("파동있음", 0)]), B.iff(typeIs(T.tu), [B.set("포대있음", 0)]), B.iff(typeIs(T.bh), [B.set("블랙홀있음", 0)]),
          // 분열의 왕은 죽으면 분열형 2마리
          B.iff(typeIs(T.sk), [...spawnReq(T.splitter.id, B.sub(B.myX(), 10), B.myY(), 0, 0), ...spawnReq(T.splitter.id, B.add(B.myX(), 10), B.myY(), 0, 0)]),
          B.listSet("슬롯비율", B.v("번호"), -1),
          B.change("남은적", -1), B.deleteClone(),
        ];
        // 보스(종류 > 10)와 졸개를 먼저 나눠서, 매 프레임 종류 검사를 줄인다
        const byBoss = (bossArr, minionArr) => B.ifElse(B.cmp(B.v("종류"), ">", 10), bossArr, minionArr);
        // 종류별 움직임 (앞 3개는 졸개, 나머지는 보스)
        const behaveAll = [
          // 기본 · 분열형 · 조각: 곧장 다가온다
          B.iff(B.or(B.or(typeIs(T.basic), typeIs(T.splitter)), typeIs(T.child)), moveTo(playerX(B), playerY(B), B.mul(B.v("속도"), slow()))),
          // 사인파형: 앞으로 + 옆으로 A·ω·cos(ωt + φ), 움직이는 쪽으로 살짝 기운다
          B.iff(typeIs(T.sine), [
            B.change("파동t", B.mul(SINE_OMEGA_DEG, slow())),
            B.set("dx", dx()), B.set("dy", dy()),
            B.set("거리", B.add(B.mathOp("root", B.add(B.mathOp("square", B.v("dx")), B.mathOp("square", B.v("dy")))), 0.0001)),
            B.set("k", B.mul(SINE_SIDE, B.mul(B.mathOp("cos", B.v("파동t")), slow()))),
            B.set("돌진x", B.sub(B.mul(B.div(B.v("dx"), B.v("거리")), B.mul(B.v("속도"), slow())), B.mul(B.div(B.v("dy"), B.v("거리")), B.v("k")))),
            B.set("돌진y", B.add(B.mul(B.div(B.v("dy"), B.v("거리")), B.mul(B.v("속도"), slow())), B.mul(B.div(B.v("dx"), B.v("거리")), B.v("k")))),
            B.moveX(B.v("돌진x")), B.moveY(B.v("돌진y")),
            ...setAngle(B, "k", B.v("돌진x"), B.v("돌진y")), B.rotateToV(B.mul(-14.3, B.mathOp("sin", B.v("k")))),
          ]),
          // 돌격형: 다가가기 → (100px 안 또는 1.5초) 멈춰서 예고 0.6초 → 3배 돌진 0.5초 → 쉬기 1초
          B.iff(typeIs(T.charger), [
            B.change("단계시간", slow()),
            B.iff(B.cmp(B.v("단계"), "=", 0), [...aimDir(), ...moveTo(playerX(B), playerY(B), B.mul(B.v("속도"), slow())),
              B.iff(B.or(B.cmp(B.v("거리"), "<", CHARGER_TRIGGER), B.cmp(B.v("단계시간"), ">=", CHARGER_APPROACH)), [B.set("단계", 1), B.set("단계시간", 0)])]),
            B.iff(B.and(B.cmp(B.v("단계"), "=", 1), B.cmp(B.v("단계시간"), ">=", CHARGER_WARN)), [B.set("단계", 2), B.set("단계시간", 0)]),
            B.iff(B.cmp(B.v("단계"), "=", 2), [
              B.moveX(B.mul(B.mathOp("cos", B.v("각")), B.mul(B.mul(B.v("속도"), CHARGER_DASH_MULT), slow()))), B.moveY(B.mul(B.mathOp("sin", B.v("각")), B.mul(B.mul(B.v("속도"), CHARGER_DASH_MULT), slow()))),
              ...clampInside(),
              B.iff(B.cmp(B.v("단계시간"), ">=", CHARGER_DASH), [B.set("단계", 3), B.set("단계시간", 0)])]),
            B.iff(B.and(B.cmp(B.v("단계"), "=", 3), B.cmp(B.v("단계시간"), ">=", CHARGER_REST)), [B.set("단계", 0), B.set("단계시간", 0)]),
          ]),
          // 돌진 대장: 내려오기 → 예고 0.8초 → 4배 돌진 0.5초 → (재조준 0.35초 → 돌진) × 3 (화나면 4) → 쉬기 2초 (화나면 돌격형 2마리 소환)
          B.iff(typeIs(T.ck), [
            B.change("단계시간", slow()),
            B.iff(B.cmp(B.v("단계"), "=", 0), [B.moveY(B.mul(B.v("속도"), -1)), B.set("각", 270),
              B.iff(B.cmp(B.myY(), "<=", CK_ENTER_Y), [B.set("단계", 1), B.set("단계시간", 0), B.set("남은돌진", B.add(3, B.v("화남"))), ...aimDir(), B.set("예고시간", CK_FIRST_WARN)])]),
            B.iff(B.and(B.cmp(B.v("단계"), "=", 1), B.cmp(B.v("단계시간"), ">=", B.v("예고시간"))), [B.set("단계", 2), B.set("단계시간", 0)]),
            B.iff(B.cmp(B.v("단계"), "=", 2), [
              B.moveX(B.mul(B.mathOp("cos", B.v("각")), B.mul(B.mul(B.v("속도"), CK_DASH_MULT), slow()))), B.moveY(B.mul(B.mathOp("sin", B.v("각")), B.mul(B.mul(B.v("속도"), CK_DASH_MULT), slow()))),
              ...clampInside(),
              B.iff(B.cmp(B.v("단계시간"), ">=", CK_DASH), [
                B.change("남은돌진", -1),
                B.ifElse(B.cmp(B.v("남은돌진"), ">", 0), [...aimDir(), B.set("예고시간", CK_REAIM), B.set("단계", 1), B.set("단계시간", 0)], [
                  B.set("단계", 3), B.set("단계시간", 0),
                  // 화난 상태면 쉬기 시작할 때 양옆(바라보는 방향의 수직)에 돌격형 2마리
                  B.iff(B.cmp(B.v("화남"), "=", 1), [-1, 1].flatMap((side) => spawnReq(T.charger.id,
                    B.add(B.myX(), B.mul(side * 32, B.mul(-1, B.mathOp("sin", B.v("각"))))), B.add(B.myY(), B.mul(side * 32, B.mathOp("cos", B.v("각")))), 0, 0))),
                ]),
              ])]),
            B.iff(B.and(B.cmp(B.v("단계"), "=", 3), B.cmp(B.v("단계시간"), ">=", CK_REST)), [B.set("단계", 1), B.set("단계시간", 0), B.set("남은돌진", B.add(3, B.v("화남"))), ...aimDir(), B.set("예고시간", CK_FIRST_WARN)]),
          ]),
          // 분열의 왕: 곧장 다가온다
          B.iff(typeIs(T.sk), moveTo(playerX(B), playerY(B), B.mul(B.v("속도"), slow()))),
          // 파동 군주: 내려와서 x = 165·sin(ωt) 로 오가며 3초마다 12발 원형 탄막 (화나면 0.5초 뒤 15° 어긋난 두 번째 겹)
          B.iff(typeIs(T.wl), [
            B.ifElse(B.cmp(B.v("단계"), "=", 0), [B.moveY(B.mul(B.v("속도"), -1)),
              B.iff(B.cmp(B.myY(), "<=", WL_Y), [B.set("단계", 1), B.set("파동t", B.mathOp("asin_radian", B.div(B.myX(), WL_A))), B.set("발사", WL_FIRE), B.set("두번째", -1)])], [
              B.change("파동t", B.mul(WL_OMEGA_DEG, slow())),
              B.goXY(B.mul(WL_A, B.mathOp("sin", B.v("파동t"))), B.add(WL_Y, B.mul(6, B.mathOp("sin", B.mul(3, B.v("파동t")))))),
              B.change("발사", B.mul(-1, slow())),
              B.iff(B.cmp(B.v("발사"), "<=", 0), [B.change("발사", WL_FIRE), B.set("링각", B.rand(0, 29)), ...ring(0, WL_BULLET_DMG),
                B.iff(B.cmp(B.v("적체력"), "<", B.mul(B.v("적최대"), 0.5)), [B.set("두번째", WL_SECOND)])]),
              B.iff(B.cmp(B.v("두번째"), ">=", 0), [B.change("두번째", B.mul(-1, slow())), B.iff(B.cmp(B.v("두번째"), "<", 0), ring(15, WL_BULLET_DMG))]),
            ]),
            B.set("파동x", B.myX()), B.set("파동y", B.myY()), B.set("파동있음", 1),
          ]),
          // 회전 포대: 가운데로 가서 4방향 총구를 각속도 ω 로 돌리며 0.3초마다 쏜다 → 나선. 10초마다 방향 반대 (1초 전 예고)
          B.iff(typeIs(T.tu), [
            B.ifElse(B.cmp(B.v("단계"), "=", 0), [...moveTo(0, 0, B.v("속도")), B.iff(B.cmp(B.v("거리"), "<", 1.5), [B.goXY(0, 0), B.set("단계", 1), B.set("발사", TU_FIRE), B.set("단계시간", TU_FLIP)])], [
              B.set("포대각속", B.mul(TU_OMEGA_DEG, B.add(1, B.mul(1.2, B.sub(1, B.div(B.v("적체력"), B.v("적최대"))))))),
              B.change("포대각", B.mul(B.mul(B.v("포대각속"), B.v("포대방향")), slow())),
              B.change("단계시간", B.mul(-1, slow())),
              B.ifElse(B.cmp(B.v("단계시간"), "<=", TU_WARN), [B.set("포대예고", 1)], [B.set("포대예고", 0)]),
              B.iff(B.cmp(B.v("단계시간"), "<=", 0), [B.set("포대방향", B.mul(B.v("포대방향"), -1)), B.change("단계시간", TU_FLIP)]),
              B.change("발사", B.mul(-1, slow())),
              B.iff(B.cmp(B.v("발사"), "<=", 0), [B.change("발사", TU_FIRE),
                ...[0, 1, 2, 3].flatMap((k) => enemyBullet(B.add(B.myX(), B.mul(23, B.mathOp("cos", B.add(B.v("포대각"), k * 90)))), B.add(B.myY(), B.mul(23, B.mathOp("sin", B.add(B.v("포대각"), k * 90)))), B.add(B.v("포대각"), k * 90), TU_BULLET_DMG))]),
            ]),
            B.set("포대x", B.myX()), B.set("포대y", B.myY()), B.set("포대있음", 1),
          ]),
          // 블랙홀: 가운데 쪽으로 내려온 뒤 아주 천천히 다가온다. 끌어당김 · 사건의 지평선 · 8초마다 3초 약점
          B.iff(typeIs(T.bh), [
            B.ifElse(B.cmp(B.v("단계"), "=", 0), [...moveTo(0, 0, B.mul(B.v("속도"), 4)), B.iff(B.cmp(B.myY(), "<=", 65), [B.set("단계", 1)])],
              moveTo(playerX(B), playerY(B), B.mul(B.v("속도"), slow()))),
            B.change("블랙홀시간", slow()),
            B.ifElse(B.cmp(B.mod(B.v("블랙홀시간"), BH_PERIOD), ">=", BH_PERIOD - BH_WEAK), [B.set("블랙홀약점", 1)], [B.set("블랙홀약점", 0)]),
            // 플레이어를 끌어당긴다: 가속도 = 243 ÷ d² (상한 0.028), 210 보다 멀면 안 당김
            B.set("dx", B.sub(B.myX(), playerX(B))), B.set("dy", B.sub(B.myY(), playerY(B))),
            B.set("거리", B.add(B.mathOp("root", B.add(B.mathOp("square", B.v("dx")), B.mathOp("square", B.v("dy")))), 0.01)),
            B.iff(B.cmp(B.v("거리"), "<", BH_RANGE), [
              B.set("k", B.div(BH_PULL, B.mathOp("square", B.v("거리")))), B.iff(B.cmp(B.v("k"), ">", BH_PULL_MAX), [B.set("k", BH_PULL_MAX)]),
              B.change("끌림vx", B.mul(B.v("k"), B.div(B.v("dx"), B.v("거리")))), B.change("끌림vy", B.mul(B.v("k"), B.div(B.v("dy"), B.v("거리")))),
            ]),
            // 사건의 지평선: 닿으면 큰 대미지 + 바깥으로 튕겨 냄 (무적이면 튕기기만)
            B.iff(B.cmp(B.v("거리"), "<", BH_HORIZON + 9), [
              B.set("끌림vx", B.mul(B.div(B.v("dx"), B.v("거리")), -BH_KICK)), B.set("끌림vy", B.mul(B.div(B.v("dy"), B.v("거리")), -BH_KICK)),
              B.iff(B.and(B.cmp(B.v("무적"), "<=", 0), canHurt(B)), [B.change("체력", B.mul(-BH_HORIZON_DMG, B.v("대미지배율"))), B.set("무적", invFrames(B)),
                ...popup(B, playerX(B), B.add(playerY(B), 18), 0, 5)]),
            ]),
            B.set("블랙홀x", B.myX()), B.set("블랙홀y", B.myY()), B.set("블랙홀있음", 1),
          ]),
        ];
        const behave = [byBoss(behaveAll.slice(3), behaveAll.slice(0, 3))];
        // 모양: 눈은 플레이어 쪽(8방향), 돌격형 · 돌진 대장은 몸이 바라보는 쪽(16방향), 맞은 직후엔 하얀 몸
        const shapeName = () => [
          ...setAngle(B, "눈각", dx(), dy()),
          B.set("번쩍", B.sub(B.v("번쩍"), 1)), B.iff(B.cmp(B.v("번쩍"), "<", 0), [B.set("번쩍", 0)]),
          B.set("k", 0), B.iff(B.cmp(B.v("번쩍"), ">", 0), [B.set("k", 1)]),
          B.ifElse(B.cmp(B.v("방향식"), "=", 1), [B.set("모양", B.join(B.v("모양앞"), B.join(dir16(B, B.v("각")), B.join("_", B.v("k")))))], [
            B.ifElse(B.cmp(B.v("방향식"), "=", 2), [B.set("모양", B.join("b_sk", B.join(B.v("분열단계"), B.join("_", B.join(dir8(B, B.v("눈각")), B.join("_", B.v("k")))))))],
              [B.set("모양", B.join(B.v("모양앞"), B.join(dir8(B, B.v("눈각")), B.join("_", B.v("k")))))])]),
          B.shapeV(B.v("모양")),
        ];
        // 원본: 생성 대기열에서 하나 꺼내 복제
        const spawnOne = () => B.iff(B.cmp(B.listLen("생성종류"), ">", 0), [
          B.set("종류", B.listItem("생성종류", 1)), B.set("새x", B.listItem("생성x", 1)), B.set("새y", B.listItem("생성y", 1)),
          B.set("밀기x", B.listItem("생성밀기x", 1)), B.set("밀기y", B.listItem("생성밀기y", 1)),
          ...["생성종류", "생성x", "생성y", "생성밀기x", "생성밀기y"].map((l) => B.listRemove(l, 1)),
          B.set("적최대", B.listItem("적표체력", B.v("종류"))), B.set("속도", B.listItem("적표속도", B.v("종류"))), B.set("반지름", B.listItem("적표반지름", B.v("종류"))),
          // 웨이브 배율 (체력 · 속도)
          B.set("적최대", B.mul(B.v("적최대"), B.mul(TV(B, "체력배율"), B.add(1, B.mul(TV(B, "체력증가"), B.sub(B.v("웨이브"), 1)))))),
          B.set("k", B.mul(TV(B, "속도배율"), B.add(1, B.mul(TV(B, "속도증가"), B.sub(B.v("웨이브"), 1))))), B.iff(B.cmp(B.v("k"), ">", TV(B, "속도상한")), [B.set("k", TV(B, "속도상한"))]),
          B.set("속도", B.mul(B.v("속도"), B.v("k"))),
          B.set("태어난웨이브", B.v("웨이브")), B.iff(B.cmp(B.v("태어난웨이브"), ">", 3), [B.set("태어난웨이브", 3)]),
          // 모양 이름 앞부분 (기본 적은 웨이브마다 뿔 · 가시가 다르다)
          B.set("모양앞", B.listItem("적표모양", B.v("종류"))), B.set("방향식", B.listItem("적표방향", B.v("종류"))),
          B.iff(typeIs(T.basic), [B.set("모양앞", B.join("e_basic", B.join(B.v("태어난웨이브"), "_")))]),
          // 머리 위 체력바 높이 (웹: 몸 위 r×1.3 (+12), 기본 적 1웨이브는 r, 뿔이 있으면 r×1.45)
          B.ifElse(B.and(typeIs(T.basic), B.cmp(B.v("태어난웨이브"), "=", 1)), [B.set("바위", B.add(B.v("반지름"), 4.25))], [
            B.ifElse(typeIs(T.basic), [B.set("바위", B.add(B.mul(B.v("반지름"), 1.45), 4.25))], [B.set("바위", B.add(B.mul(B.v("반지름"), 1.3), 4.25))])]),
          // 체력바 · 예고선 칸
          B.listAdd("슬롯x", 0), B.listAdd("슬롯y", 0), B.listAdd("슬롯비율", 1), B.listAdd("슬롯선각", -1), B.listAdd("슬롯선진함", 0), B.listAdd("슬롯폭", B.v("반지름")),
          B.ifElse(B.cmp(B.v("종류"), ">", 10), [B.listAdd("슬롯보스", 1)], [B.listAdd("슬롯보스", 0)]),
          B.set("번호", B.listLen("슬롯비율")),
          // 보스 체력바 자리
          B.set("보스칸", 0),
          B.iff(B.cmp(B.v("종류"), ">", 10), [
            B.ifElse(B.cmp(B.v("보스1종류"), "=", 0), [B.set("보스칸", 1), B.set("보스1종류", B.sub(B.v("종류"), 10)), B.set("보스1최대", B.v("적최대")), B.set("보스1체력", B.v("적최대"))],
              [B.set("보스칸", 2), B.set("보스2종류", B.sub(B.v("종류"), 10)), B.set("보스2최대", B.v("적최대")), B.set("보스2체력", B.v("적최대"))]),
          ]),
          B.change("남은적", 1),
          B.clone("self"),
        ]);
        return [
          B.when.run([B.hide(), B.set("복제본", 0), B.forever([spawnOne(), spawnOne(), spawnOne(), spawnOne()])]),
          B.when.msg("정리", [B.iff(isClone(B), [B.deleteClone()])]),
          B.when.clone([
            B.set("복제본", 1), B.set("적체력", B.v("적최대")), B.set("단계", 0), B.set("단계시간", 0), B.set("번쩍", 0), B.set("흔들", 0), B.set("화남", 0), B.set("분열단계", 0),
            B.set("각", 270), B.set("파동t", B.rand(0, 359)), B.rotateTo(0),
            // 나올 자리: 정해 준 자리 (−999 면 네 변 중 한 곳의 바깥, 보스는 위 가운데)
            B.ifElse(B.cmp(B.v("새x"), "=", -999), [
              B.set("변", B.rand(1, 4)), B.iff(B.cmp(B.v("종류"), ">", 10), [B.set("변", 1)]),
              B.iff(B.cmp(B.v("변"), "=", 1), [B.goXY(B.rand(-200, 200), 150)]), B.iff(B.cmp(B.v("변"), "=", 2), [B.goXY(B.rand(-200, 200), -150)]),
              B.iff(B.cmp(B.v("변"), "=", 3), [B.goXY(-255, B.rand(-110, 110))]), B.iff(B.cmp(B.v("변"), "=", 4), [B.goXY(255, B.rand(-110, 110))]),
              B.iff(B.cmp(B.v("종류"), ">", 10), [B.setX(0)]),
            ], [B.goXY(B.v("새x"), B.v("새y"))]),
            ...shapeName(), B.show(),
            B.forever([
              // 예고 중 떨림을 되돌린다 (위치는 그대로 두고 그림만 떨리게)
              B.iff(B.cmp(B.v("흔들"), "!=", 0), [B.moveX(B.mul(B.v("흔들"), -1)), B.set("흔들", 0)]),
              B.iff(fighting(B), [
                // 1) 총알에 맞았는지 (옆 총알은 0.6배)
                B.iff(B.touching("총알"), hit(1)),
                B.iff(B.touching("보조총알"), hit(SIDE_BULLET_SCALE)),
                B.iff(B.cmp(B.v("적체력"), "<=", 0), die()),
                B.iff(B.cmp(B.v("보스칸"), ">", 0), [B.ifElse(B.cmp(B.v("보스칸"), "=", 1), [B.set("보스1체력", B.v("적체력"))], [B.set("보스2체력", B.v("적체력"))])]),
                // 2) 시간 지연: 플레이어가 움직이는 동안 반경 안의 적은 0.2배 (보스 0.6배)
                B.set("느림", 1),
                B.iff(B.and(B.cmp(B.v("지연"), ">", 0), B.and(B.cmp(B.v("움직임"), "=", 1), B.cmp(B.dist("플레이어"), "<", B.add(B.mul(B.v("지연"), 12.5), 32.5)))), [
                  B.ifElse(B.cmp(B.v("종류"), ">", 10), [B.set("느림", 0.6)], [B.set("느림", 0.2)])]),
                // 3) 밀림 (넉백 · 튕겨 나감): 조금 미끄러지다 멈춘다
                B.iff(B.or(B.cmp(B.mathOp("abs", B.v("밀기x")), ">", 0.01), B.cmp(B.mathOp("abs", B.v("밀기y")), ">", 0.01)), [
                  B.moveX(B.v("밀기x")), B.moveY(B.v("밀기y")), B.set("밀기x", B.mul(B.v("밀기x"), PUSH_DECAY)), B.set("밀기y", B.mul(B.v("밀기y"), PUSH_DECAY))]),
                ...behave,
                // 4) 가장 가까운 적 후보 (플레이어가 다음에 조준한다)
                B.set("거리", B.dist("플레이어")),
                B.iff(B.cmp(B.v("거리"), "<", B.v("후보거리")), [B.set("후보거리", B.v("거리")), B.set("후보x", B.myX()), B.set("후보y", B.myY())]),
                // 5) 부딪히면 대미지 (빨간 숫자)
                B.iff(B.and(B.touching("플레이어"), B.and(B.cmp(B.v("무적"), "<=", 0), canHurt(B))), [
                  B.set("k", B.mul(B.listItem("적표접촉", B.v("종류")), B.v("대미지배율"))),
                  B.change("체력", B.mul(B.v("k"), -1)), B.set("무적", invFrames(B)),
                  ...popup(B, playerX(B), B.add(playerY(B), 18), B.v("k"), 2)]),
              ]),
              ...shapeName(),
              // 6) 체력바 · 예고선 칸
              B.listSet("슬롯x", B.v("번호"), B.myX()), B.listSet("슬롯y", B.v("번호"), B.add(B.myY(), B.v("바위"))),
              B.listSet("슬롯비율", B.v("번호"), B.div(B.v("적체력"), B.v("적최대"))),
              B.ifElse(B.and(B.or(typeIs(T.charger), typeIs(T.ck)), B.cmp(B.v("단계"), "=", 1)), [
                B.listSet("슬롯선각", B.v("번호"), B.v("각")),
                B.ifElse(typeIs(T.ck), [B.listSet("슬롯선진함", B.v("번호"), B.div(B.v("단계시간"), B.v("예고시간")))], [B.listSet("슬롯선진함", B.v("번호"), B.div(B.v("단계시간"), CHARGER_WARN))]),
                // 예고 중에는 부르르 떤다 (웹: sin(90t) × 1.8px)
                B.set("흔들", B.mul(0.9, B.mathOp("sin", B.mul(B.v("단계시간"), 86)))), B.moveX(B.v("흔들")),
              ], [B.listSet("슬롯선각", B.v("번호"), -1)]),
              B.show(),
            ]),
          ]),
        ];
      },
    };
  }

  // ---------------------------------------------------------------
  // 배경 + 게임 진행
  function managerObject() {
    return {
      name: "배경", pictures: [pic("background")], scale: 0.5, scripts: (B) => {
        const spawnReqM = (type) => [B.listAdd("생성종류", type), B.listAdd("생성x", -999), B.listAdd("생성y", 0), B.listAdd("생성밀기x", 0), B.listAdd("생성밀기y", 0)];
        const resultScreen = (kind) => [
          B.set("상태", "결과"), B.set("결과종류", kind), B.set("배너시간", 0),
          // 기록: 지난 최고 웨이브 → 이번, 최고 점수 (웹과 같다)
          B.set("지난최고", B.v("최고웨이브")),
          B.ifElse(B.cmp(B.v("지난최고"), ">", 0), [B.set("지난최고글", B.join("웨이브 ", B.v("지난최고")))], [B.set("지난최고글", "없음")]),
          B.set("신기록", 0), B.iff(B.cmp(B.v("웨이브"), ">", B.v("최고웨이브")), [B.set("최고웨이브", B.v("웨이브")), B.set("신기록", 1)]),
          B.set("새점수기록", 0), B.iff(B.and(B.cmp(B.v("점수"), ">", B.v("최고점수")), B.cmp(B.v("점수"), ">", 0)), [B.set("최고점수", B.v("점수")), B.set("새점수기록", 1)]),
          // 생존 m:ss · 잡은 보스
          B.set("세는수", B.mod(B.mathOp("floor", B.v("생존")), 60)),
          B.set("생존글", B.join("생존 ", B.join(B.mathOp("floor", B.div(B.v("생존"), 60)), ":"))),
          B.ifElse(B.cmp(B.v("세는수"), "<", 10), [B.set("생존글", B.join(B.v("생존글"), B.join("0", B.v("세는수"))))], [B.set("생존글", B.join(B.v("생존글"), B.v("세는수")))]),
          B.set("생존글", B.join(B.v("생존글"), B.join("  ·  잡은 보스 ", B.join(B.v("잡은보스"), "마리")))),
          // 모은 증강 (3개씩 두 줄)
          B.set("증강글1", ""), B.set("증강글2", ""), B.set("세는수", 0),
          ...AUGS.map((a) => B.iff(B.cmp(B.v(a.v), ">", 0), [
            B.change("세는수", 1),
            B.ifElse(B.cmp(B.v("세는수"), "<=", 3),
              [B.ifElse(B.cmp(B.v("세는수"), "=", 1), [B.set("증강글1", B.join("증강: ", B.join(a.name + " Lv.", B.v(a.v))))], [B.set("증강글1", B.join(B.v("증강글1"), B.join(" · " + a.name + " Lv.", B.v(a.v))))])],
              [B.ifElse(B.cmp(B.v("세는수"), "=", 4), [B.set("증강글2", B.join(a.name + " Lv.", B.v(a.v)))], [B.set("증강글2", B.join(B.v("증강글2"), B.join(" · " + a.name + " Lv.", B.v(a.v))))])]),
          ])),
          B.iff(B.cmp(B.v("세는수"), "=", 0), [B.set("증강글1", "모은 증강 없음")]),
        ];
        return [
          B.when.run([B.set("상태", "메뉴"), B.set("최고웨이브", 0), B.set("최고점수", 0), B.set("타이머숨", 0), B.set("보스1종류", 0), B.set("보스2종류", 0), B.set("배너시간", 0),
            B.set("파동있음", 0), B.set("포대있음", 0), B.set("블랙홀있음", 0), B.set("체력바길이", 140), B.set("최대체력", TV(B, "시작체력"))]),
          // 키보드: Enter · Space 시작, P · Esc 일시정지 · 닫기, R 다시, M 메뉴
          ...[13, 32].map((k) => B.when.key(k, [B.iff(stateIs(B, "메뉴"), [B.send("게임시작")])])),
          ...[80, 27].map((k) => B.when.key(k, [
            B.ifElse(stateIs(B, "전투"), [B.set("상태", "멈춤")], [
              B.ifElse(stateIs(B, "멈춤"), [B.set("상태", "재개"), B.set("멈춤시간", RESUME_FRAMES)], [
                B.iff(B.or(stateIs(B, "조작법"), stateIs(B, "도감")), [B.set("상태", "메뉴")]),
                // Esc: 설정 · 숫자 조절 · 디버그 창 닫기
                ...(k === 27 ? [B.send("창닫기")] : []),
              ])])])),
          B.when.key(82, [B.iff(stateIs(B, "결과"), [B.send("게임시작")])]),
          B.when.key(77, [B.iff(B.or(stateIs(B, "결과"), stateIs(B, "멈춤")), [B.send("메뉴로")])]),

          // ---- 게임 시작 ----
          B.when.msg("게임시작", [
            B.stop("otherThread"),
            B.set("상태", "준비"), B.set("배너시간", 0), B.set("배너부제", 0), B.set("다음부제", 0), B.set("웨이브", 1),
            B.set("체력", TV(B, "시작체력")), B.set("최대체력", TV(B, "시작체력")), B.set("점수", 0), B.set("생존", 0), B.set("잡은보스", 0),
            B.set("무적", 0), B.set("남은적", 0), B.set("후보거리", 99999), B.set("목표있음", 0), B.set("발사타이머", 0), B.set("끌림vx", 0), B.set("끌림vy", 0),
            B.set("보스1종류", 0), B.set("보스2종류", 0), B.set("파동있음", 0), B.set("포대있음", 0), B.set("블랙홀있음", 0), B.set("블랙홀시간", 0), B.set("블랙홀약점", 0),
            B.set("포대각", 0), B.set("포대방향", 1), B.set("포대예고", 0), B.set("고른카드", 0),
            ...AUGS.map((a) => B.set(a.v, 0)),
            B.set("공격력", TV(B, "기본대미지")), B.set("발사간격", TVframes(B, "발사간격")),
            B.sendWait("정리"),
            B.sendWait("목록비우기"), B.set("바만듦", 0), B.set("선만듦", 0),
            // 디버그 보스 선택(메뉴에서)이면 그 웨이브부터
            B.iff(B.cmp(B.v("시작웨이브"), ">", 1), [B.set("웨이브", B.v("시작웨이브"))]), B.set("시작웨이브", 1),
            B.send("웨이브진행"), B.send("감시"),
          ]),
          B.when.msg("웨이브진행", [
            B.repeatUntil(B.cmp(B.v("웨이브"), ">", WAVE_COUNT), [
              // 웨이브 배율: 접촉 · 탄 대미지
              B.set("대미지배율", B.mul(TV(B, "접촉배율"), B.add(1, B.mul(TV(B, "접촉증가"), B.sub(B.v("웨이브"), 1))))),
              // 웨이브 띠 (보스 웨이브는 빨강, 고른 증강이 있으면 부제)
              B.set("배너보스", 0), ...Object.keys(BOSS_WAVES).map((w) => B.iff(B.cmp(B.v("웨이브"), "=", +w), [B.set("배너보스", 1)])),
              B.set("배너부제", B.v("다음부제")), B.set("다음부제", 0),
              B.set("상태", "준비"), B.set("배너시간", BANNER_FRAMES), B.wait(1),
              B.set("상태", "전투"),
              // 보스 웨이브: 보스 → 졸개 (웹과 같은 보스 · 같은 수)
              ...Object.entries(BOSS_WAVES).map(([w, list]) => B.iff(B.cmp(B.v("웨이브"), "=", +w), [
                ...list.flatMap((b) => spawnReqM(T[b].id)), B.wait(1),
                B.set("세는수", 0),
                ...BOSS_MINIONS[w].flatMap((t) => [B.waitUntil(fighting(B)), ...spawnReqM(t),
                  B.change("세는수", 1), B.iff(B.cmp(B.mod(B.v("세는수"), TV(B, "무리수")), "=", 0), [B.wait(TV(B, "무리간격"))])]),
              ])),
              // 보통 웨이브: 3 + 웨이브 마리 (최대 26), 1.6초마다 3마리. 3웨이브부터 돌격형, 6웨이브부터 사인파형
              B.iff(B.cmp(B.v("배너보스"), "=", 0), [
                B.set("생성수", B.add(3, B.v("웨이브"))), B.iff(B.cmp(B.v("생성수"), ">", 26), [B.set("생성수", 26)]),
                B.set("세는수", 0),
                B.repeat(B.v("생성수"), [
                  B.waitUntil(fighting(B)),
                  B.set("뽑기", B.rand(1, 10)), B.set("다음종류", T.basic.id),
                  B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 3), B.cmp(B.v("뽑기"), "<=", 3)), [B.set("다음종류", T.charger.id)]),
                  B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 6), B.cmp(B.v("뽑기"), ">=", 8)), [B.set("다음종류", T.sine.id)]),
                  ...spawnReqM(B.v("다음종류")),
                  B.change("세는수", 1), B.iff(B.cmp(B.mod(B.v("세는수"), TV(B, "무리수")), "=", 0), [B.wait(TV(B, "무리간격"))]),
                ]),
              ]),
              B.waitUntil(B.and(B.cmp(B.v("남은적"), "<=", 0), B.cmp(B.listLen("생성종류"), "=", 0))),
              B.waitUntil(fighting(B)),
              B.send("정리"), B.set("보스1종류", 0), B.set("보스2종류", 0),
              B.iff(B.cmp(B.v("웨이브"), "<", WAVE_COUNT), [
                // 웨이브 클리어: 최대 체력의 5% 회복, 카드 고르기
                B.change("체력", B.mul(B.v("최대체력"), TV(B, "웨이브회복"))),
                B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
                B.set("상태", "카드준비"), B.send("카드보이기"),
                B.waitUntil(fighting(B)),
              ]),
              B.change("웨이브", 1),
            ]),
            B.set("웨이브", WAVE_COUNT),
            ...resultScreen("클리어"),
          ]),
          // 체력이 0 이 되면 게임 오버
          B.when.msg("감시", [
            B.waitUntil(B.cmp(B.v("체력"), "<=", 0)),
            B.stop("otherThread"),
            B.set("체력", 0),
            ...resultScreen("게임 오버"),
          ]),
          // 디버그: 웨이브 이동 ([ ] 키 · 보스 선택). 진행 중인 웨이브를 멈추고 적 · 탄 · 카드를 치운 뒤 그 웨이브부터 (증강은 그대로)
          B.when.msg("웨이브이동", [
            B.stop("otherThread"),
            B.set("보스1종류", 0), B.set("보스2종류", 0), B.set("배너시간", 0), B.set("파동있음", 0), B.set("포대있음", 0), B.set("블랙홀있음", 0),
            B.set("다음부제", 0), B.set("남은적", 0), B.set("무적", 0), B.set("끌림vx", 0), B.set("끌림vy", 0),
            B.sendWait("정리"), B.sendWait("목록비우기"), B.set("바만듦", 0), B.set("선만듦", 0),
            B.set("웨이브", B.v("이동웨이브")),
            B.send("웨이브진행"), B.send("감시"),
          ]),
          // 디버그 지급 뒤: 공격력 · 발사 간격 다시 계산
          B.when.msg("능력갱신", statsRecompute(B)),
          // 리스트마다 따로 (동시에) 비운다
          ...LISTS.filter((l) => !KEEP_LISTS.includes(l)).map((l) => B.when.msg("목록비우기", clearList(B, l))),
          B.when.msg("메뉴로", [B.stop("otherThread"), B.set("보스1종류", 0), B.set("보스2종류", 0), B.set("배너시간", 0), B.set("파동있음", 0), B.set("포대있음", 0), B.set("블랙홀있음", 0),
            B.send("정리"), B.set("상태", "메뉴")]),
          // 카드를 골랐을 때
          B.when.msg("카드선택", [
            ...AUGS.map((a, k) => B.iff(B.cmp(B.v("고른카드"), "=", k + 1), [B.change(a.v, 1),
              ...Array.from({ length: a.max }, (_, l) => B.iff(B.cmp(B.v(a.v), "=", l + 1), [B.set("다음부제", SUB_INDEX[k + "_" + (l + 1)])]))])),
            B.iff(B.cmp(B.v("고른카드"), "=", AUGS.length + 1), [B.change("최대체력", 20), B.change("체력", 20), B.set("다음부제", SUB_INDEX.s0),
              ...popup(B, playerX(B), B.add(playerY(B), 18), 20, 4)]),
            B.iff(B.cmp(B.v("고른카드"), "=", AUGS.length + 2), [B.set("다음부제", SUB_INDEX.s1),
              B.set("회복량", B.sub(B.v("최대체력"), B.v("체력"))),
              B.iff(B.cmp(B.v("회복량"), ">", B.mul(B.v("최대체력"), 0.4)), [B.set("회복량", B.mul(B.v("최대체력"), 0.4))]),
              B.change("체력", B.v("회복량")), ...popup(B, playerX(B), B.add(playerY(B), 18), B.v("회복량"), 3)]),
            B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
            ...statsRecompute(B),
            B.set("상태", "전투"),
          ]),
        ];
      },
    };
  }
}

// =============================================================
// 그림 · 만들기
// =============================================================
function spriteSpec() {
  return {
    glyphs: GLYPHS, glyphSets: GLYPH_SETS, hudHeight: HUD_H, hpWidths: HP_WIDTHS,
    augs: AUGS.map((a) => ({ name: a.name, color: a.color, max: a.max, formula: a.formula, levelDesc: a.levelDesc })),
    bosses: BOSS_LIST.map((t) => t.name), waveCount: WAVE_COUNT, bannerSubs: BANNER_SUBS, cards: cardSpecs(),
    controls: [["이동", "WASD / 방향키"], ["발사", "가장 가까운 적에게 자동"], ["일시정지", "P / Esc"], ["카드 고르기", "클릭 또는 1 · 2 · 3"], ["결과 화면", "R 다시 · M 메뉴"]],
    pauseButtons: [["pb_resume", "계속하기", "green"], ["pb_restart", "다시 시작", "yellow"], ["pb_lobby", "로비로", "brown"]],
    resultButtons: [["rb_retry", "R : 다시 시작"], ["rb_menu", "M : 메뉴로"]],
    menuButtons: [["mb_help", "조작법", "blue"], ["mb_book", "카드 도감", "purple"], ["mb_close", "닫기 (Esc)", "brown"]],
    infoPanels: [
      ["help_panel", "조작법", [["이동", "방향키 · WASD"], ["발사", "가장 가까운 적에게 자동!"], ["카드", "웨이브를 깨면 3장 중 하나 (클릭 · 1 2 3)"], ["일시정지", "P · Esc"], ["보스", "5 · 10 · 15 · 20 · 25 · 30웨이브"], ["목표", "30웨이브를 모두 깨면 클리어!"]]],
      ["book_panel", "카드 도감", []]],
    slowRadii: [90, 115, 140],
    ebarRadii: EBAR_RADII,
    menuHint: "Enter · Space 시작  ·  P 일시정지",
    debug: {
      settings: SET_UI, tunes: TUNES.map((t) => ({ label: t.label, defText: String(t.def) })),
      tune: Object.assign({}, TUNE_UI), augs: AUGS.map((a) => ({ name: a.name, max: a.max })), supplies: SUPPLIES.map((x) => ({ name: x.name, formula: x.formula })),
      give: { w: GIVE_UI.w, h: GIVE_UI.h, cellW: GIVE_UI.cellW, list: GIVE_UI.list, groups: GIVE_UI.groups },
      boss: { w: BOSS_UI.w, h: BOSS_UI.h, cellW: BOSS_UI.cellW, list: BOSS_UI.list },
      bosses: Object.entries(BOSS_WAVES).map(([w, list]) => ({ wave: +w, names: list.map((b) => T[b].name).join(" & ") })),
    },
    thumb: { cards: [0, 2, 3].map((k) => ({ name: AUGS[k].name, color: AUGS[k].color, formula: AUGS[k].formula })) },
  };
}

async function build(outFile, extractDir) {
  const sp = await makeSprites(spriteSpec());
  // 썸네일 그림도 따로 저장 (엔트리 작품 정보에 올릴 때 쓰기 좋게)
  fs.writeFileSync(path.join(path.dirname(outFile), "썸네일.png"), sp.thumb.png);
  const { project, files } = assemble(design(sp));
  // 엔트리는 변수를 목록 앞에서부터 찾으니, 블록에서 많이 쓰는 변수를 앞에 둔다 (실행이 빨라진다)
  const uses = {};
  for (const o of project.objects) for (const m of o.script.matchAll(/"([a-z0-9]{4})"/g)) uses[m[1]] = (uses[m[1]] || 0) + 1;
  project.variables.sort((a, b) => (uses[b.id] || 0) - (uses[a.id] || 0));
  files.push({ path: "temp/project.json", data: Buffer.from(JSON.stringify(project)) });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zlib.gzipSync(tarPack(files), { level: 6 }));
  if (extractDir) {
    fs.rmSync(path.join(extractDir, "temp"), { recursive: true, force: true });
    for (const f of files) { const p = path.join(extractDir, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
  }
  return { project, files };
}

// 아주 작은 tar 만들기 (파일과 폴더만, ustar 형식)
function tarPack(files) {
  const blocks = [];
  const dirs = new Set();
  for (const f of files) { const parts = f.path.split("/"); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/") + "/"); }
  const entries = [...[...dirs].sort().map((d) => ({ path: d, data: Buffer.alloc(0), dir: true })), ...files];
  for (const e of entries) {
    const h = Buffer.alloc(512);
    h.write(e.path, 0, 100, "utf8");
    h.write(e.dir ? "0000755\0" : "0000644\0", 100);
    h.write("0000000\0", 108); h.write("0000000\0", 116);
    h.write(e.data.length.toString(8).padStart(11, "0") + "\0", 124);
    h.write(Math.floor(Date.UTC(2026, 9, 5) / 1000).toString(8).padStart(11, "0") + "\0", 136);
    h.write("        ", 148);
    h.write(e.dir ? "5" : "0", 156);
    h.write("ustar\0" + "00", 257);
    let sum = 0; for (let i = 0; i < 512; i++) sum += h[i];
    h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(h, e.data, Buffer.alloc((512 - (e.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

module.exports = { design, build };

if (require.main === module) {
  const out = path.resolve(__dirname, "..", "..", "entry", "증강슈팅_간단판.ent");
  build(out, process.argv[2]).then(({ project, files }) => {
    let blocks = 0;
    const count = (b) => { if (!b || typeof b !== "object") return; if (b.type) blocks++; (b.params || []).forEach(count); (b.statements || []).forEach((l) => l.forEach(count)); };
    for (const o of project.objects) JSON.parse(o.script).forEach((s) => s.forEach(count));
    console.log("만들었습니다: " + out + " (오브젝트 " + project.objects.length + "개, 블록 " + blocks + "개, 그림 " + (files.length - 1) / 2 + "개, " + Math.round(fs.statSync(out).size / 1024) + "KB)");
  });
}
