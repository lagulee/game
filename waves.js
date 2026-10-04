// =============================================================
// waves.js : 웨이브 구성을 모아 두는 파일
// -------------------------------------------------------------
// WAVES 배열의 한 칸 = 웨이브 하나. 두 가지 모양으로 적을 수 있다.
//
//   (1) 묶음 목록만:  [{ type: "basic", count: 10 }]
//       → 적힌 순서대로 나온다 (basic 10마리)
//
//   (2) 설정과 함께:  { mix: true, groups: [{ type: "basic", count: 8 }, { type: "charger", count: 4 }] }
//       → mix: true 면 대기열을 무작위로 섞어서, 여러 종류가 뒤섞여 나온다
//
//   (3) 보스 웨이브:  { boss: "chargerKing", mix: true, groups: [{ type: "basic", count: 4 }] }
//       → 웨이브 시작 BOSS_SPAWN_DELAY 초 뒤 화면 위쪽에서 보스 등장,
//         그 뒤 groups 의 졸개가 BOSS_MINION_INTERVAL 초 간격으로 한 마리씩 나온다
//       → boss: ["chargerKing", "splitterKing"] 처럼 배열로 쓰면 보스 여러 마리가 함께 나온다
//       → 보스와 졸개가 모두 죽어야 웨이브가 끝난다
//
// type 은 enemies.js 의 ENEMY_TYPES 이름표.
// 적은 WAVE_SPAWN_INTERVAL 초 간격으로 한 마리씩 나온다.
// 배열에 칸을 하나 더 추가하면 웨이브가 하나 늘어난다! (마지막 웨이브를 깨면 클리어)
// =============================================================

// 웨이브 중에 적이 하나씩 나타나는 간격 (초)
const WAVE_SPAWN_INTERVAL = 0.8;

// 보스 웨이브: 웨이브 시작 후 보스가 나타나기까지 걸리는 시간 (초)
const BOSS_SPAWN_DELAY = 2;
// 보스 웨이브: 보스가 나타난 뒤 졸개가 한 마리씩 나오는 간격 (초)
const BOSS_MINION_INTERVAL = 3;

// 모든 웨이브를 담는 배열 (지금은 5웨이브)
const WAVES = [
  // 1웨이브: 기본 적으로 몸풀기
  [{ type: "basic", count: 10 }],

  // 2웨이브: 돌격형 첫 등장
  { mix: true, groups: [{ type: "basic", count: 8 }, { type: "charger", count: 4 }] },

  // 3웨이브: 사인파형 첫 등장
  { mix: true, groups: [{ type: "sine", count: 8 }, { type: "basic", count: 6 }] },

  // 4웨이브: 분열형 첫 등장
  { mix: true, groups: [{ type: "splitter", count: 4 }, { type: "charger", count: 4 }, { type: "basic", count: 6 }] },

  // 5웨이브: 모든 종류를 섞은 큰 웨이브 (나중에 보스가 들어갈 자리)
  { mix: true, groups: [
    { type: "basic", count: 10 },
    { type: "charger", count: 5 },
    { type: "sine", count: 5 },
    { type: "splitter", count: 3 },
  ] },
];

// 웨이브 칸에서 묶음 목록을 꺼내는 함수 (두 가지 모양 모두 처리)
function waveGroups(waveDef) {
  return Array.isArray(waveDef) ? waveDef : waveDef.groups;
}

// 웨이브 칸이 섞어서 내보내기(mix)인지 알려 주는 함수
function waveIsMixed(waveDef) {
  return !Array.isArray(waveDef) && waveDef.mix === true;
}

// 웨이브 칸의 보스 목록 (보스가 없으면 빈 배열, 하나면 [이름], 여러 마리면 그대로)
function waveBosses(waveDef) {
  if (Array.isArray(waveDef) || !waveDef.boss) return [];
  return Array.isArray(waveDef.boss) ? waveDef.boss : [waveDef.boss];
}
