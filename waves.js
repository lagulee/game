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
// 적은 WAVE_SPAWN_INTERVAL 초 간격으로 WAVE_SPAWN_BATCH 마리씩 무리 지어 나온다 (서로 다른 변에서).
// 표의 마릿수(count)에는 WAVE_COUNT_MULT 를 곱해서 반올림한다 (보스 수는 그대로).
// 배열에 칸을 하나 더 추가하면 웨이브가 하나 늘어난다! (마지막 웨이브를 깨면 클리어)
// 웨이브가 올라갈수록 적이 강해지는 배율은 enemies.js 맨 위 waveSpeedMult / waveHpMult / waveDamageMult
// 한 웨이브가 ENRAGE_TIME 초를 넘기면 "과열"로 적이 점점 빨라진다 (game.js)
// =============================================================

// 웨이브 중에 적 무리가 나타나는 간격 (초)
const WAVE_SPAWN_INTERVAL = tune("WAVE_SPAWN_INTERVAL", 1.6);
// 한 무리의 마릿수. 무리는 화면의 서로 다른 변에서 동시에 나와 플레이어를 둘러싼다
const WAVE_SPAWN_BATCH = tune("WAVE_SPAWN_BATCH", 3);
// 표에 적힌 졸개 수에 곱하는 배율 (반올림). 보스 웨이브의 졸개에도 적용, 보스 수는 그대로
const WAVE_COUNT_MULT = tune("WAVE_COUNT_MULT", 1.6);
// 6웨이브부터 적 수에 한 번 더 곱하는 배율 (1~5웨이브는 초반 난이도의 기준이라 건드리지 않는다)
const WAVE_COUNT_MULT_LATE = tune("WAVE_COUNT_MULT_LATE", 0.65);
// 이 웨이브부터 WAVE_COUNT_MULT_LATE 를 곱한다
const LATE_WAVE_FROM = 6;

// 보스 웨이브: 웨이브 시작 후 보스가 나타나기까지 걸리는 시간 (초)
const BOSS_SPAWN_DELAY = tune("BOSS_SPAWN_DELAY", 2);
// 보스 웨이브: 보스가 나타난 뒤 졸개가 한 마리씩 나오는 간격 (초. 보스 웨이브는 무리 없이 한 마리씩)
const BOSS_MINION_INTERVAL = tune("BOSS_MINION_INTERVAL", 3);

// 모든 웨이브를 담는 배열 (30웨이브 = 6챕터 × 5웨이브, 5웨이브마다 보스)
// 한 웨이브의 적은 5~15마리 (× WAVE_COUNT_MULT). 1웨이브만 순서대로, 나머지는 mix
// 챕터마다 그 챕터에 처음 나오는 적이 "주인공"이다. 처음 나오는 웨이브는 그 적 2~3마리 + 기본 적만 (익히기).
//   챕터 2: 사수형 (7웨이브 첫 등장)   챕터 3: 방패형 (12)   챕터 4: 공명형 (17)
//   챕터 5: 자석형 (22)                챕터 6: 모든 종류 섞기
const WAVES = [
  // ---- 챕터 1 (1~5웨이브는 바꾸지 않는다: 초반 난이도의 기준) ----
  /*  1 */ [{ type: "basic", count: 5 }],  // 몸풀기 (순서대로)
  /*  2 */ { mix: true, groups: [{ type: "basic", count: 4 }, { type: "charger", count: 2 }] },  // 돌격형 첫 등장
  /*  3 */ { mix: true, groups: [{ type: "sine", count: 4 }, { type: "basic", count: 3 }] },  // 사인파형 첫 등장
  /*  4 */ { mix: true, groups: [{ type: "splitter", count: 2 }, { type: "charger", count: 2 }, { type: "basic", count: 2 }] },  // 분열형 첫 등장
  /*  5 */ { boss: "chargerKing", mix: true, groups: [{ type: "basic", count: 4 }] },  // 보스: 돌진 대장
  // ---- 챕터 2: 사수형 ----
  /*  6 */ { mix: true, groups: [{ type: "basic", count: 4 }, { type: "sine", count: 3 }, { type: "charger", count: 2 }] },
  /*  7 */ { mix: true, groups: [{ type: "shooter", count: 3 }, { type: "basic", count: 4 }] },  // 사수형 첫 등장
  /*  8 */ { mix: true, groups: [{ type: "shooter", count: 3 }, { type: "sine", count: 4 }, { type: "splitter", count: 2 }] },
  /*  9 */ { mix: true, groups: [{ type: "shooter", count: 4 }, { type: "charger", count: 3 }, { type: "basic", count: 3 }] },
  /* 10 */ { boss: "splitterKing", mix: true, groups: [{ type: "shooter", count: 2 }, { type: "sine", count: 2 }] },  // 보스: 분열의 왕
  // ---- 챕터 3: 방패형 ----
  /* 11 */ { mix: true, groups: [{ type: "basic", count: 5 }, { type: "charger", count: 3 }, { type: "splitter", count: 2 }, { type: "shooter", count: 1 }] },
  /* 12 */ { mix: true, groups: [{ type: "shield", count: 3 }, { type: "basic", count: 5 }] },  // 방패형 첫 등장
  /* 13 */ { mix: true, groups: [{ type: "shield", count: 3 }, { type: "shooter", count: 3 }, { type: "splitter", count: 3 }] },
  /* 14 */ { mix: true, groups: [{ type: "shield", count: 4 }, { type: "charger", count: 4 }, { type: "sine", count: 3 }] },
  /* 15 */ { boss: "waveLord", mix: true, groups: [{ type: "shield", count: 2 }, { type: "basic", count: 3 }] },  // 보스: 파동 군주
  // ---- 챕터 4: 공명형 ----
  /* 16 */ { mix: true, groups: [{ type: "basic", count: 6 }, { type: "sine", count: 4 }, { type: "shooter", count: 2 }] },
  /* 17 */ { mix: true, groups: [{ type: "resonator", count: 2 }, { type: "basic", count: 6 }] },  // 공명형 첫 등장
  /* 18 */ { mix: true, groups: [{ type: "resonator", count: 2 }, { type: "charger", count: 5 }, { type: "sine", count: 4 }] },
  /* 19 */ { mix: true, groups: [{ type: "resonator", count: 3 }, { type: "shield", count: 3 }, { type: "splitter", count: 3 }, { type: "basic", count: 3 }] },
  /* 20 */ { boss: "turret", mix: true, groups: [{ type: "resonator", count: 1 }, { type: "basic", count: 4 }] },  // 보스: 회전 포대
  // ---- 챕터 5: 자석형 ----
  /* 21 */ { mix: true, groups: [{ type: "basic", count: 6 }, { type: "shooter", count: 3 }, { type: "shield", count: 3 }] },
  /* 22 */ { mix: true, groups: [{ type: "magnet", count: 2 }, { type: "basic", count: 6 }] },  // 자석형 첫 등장
  /* 23 */ { mix: true, groups: [{ type: "magnet", count: 2 }, { type: "charger", count: 5 }, { type: "shooter", count: 4 }] },
  /* 24 */ { mix: true, groups: [{ type: "magnet", count: 3 }, { type: "resonator", count: 2 }, { type: "sine", count: 4 }, { type: "splitter", count: 3 }] },
  /* 25 */ { boss: ["chargerKing", "splitterKing"], mix: true, groups: [{ type: "shooter", count: 2 }, { type: "shield", count: 2 }] },  // 보스: 돌진 대장 & 분열의 왕 동시
  // ---- 챕터 6: 모든 종류 섞기 ----
  /* 26 */ { mix: true, groups: [{ type: "basic", count: 3 }, { type: "charger", count: 3 }, { type: "sine", count: 2 }, { type: "splitter", count: 2 }, { type: "shooter", count: 2 }, { type: "shield", count: 2 }] },
  /* 27 */ { mix: true, groups: [{ type: "shooter", count: 3 }, { type: "shield", count: 3 }, { type: "resonator", count: 2 }, { type: "magnet", count: 2 }, { type: "charger", count: 3 }] },
  /* 28 */ { mix: true, groups: [{ type: "sine", count: 4 }, { type: "splitter", count: 3 }, { type: "magnet", count: 2 }, { type: "resonator", count: 2 }, { type: "shooter", count: 3 }] },
  /* 29 */ { mix: true, groups: [{ type: "charger", count: 3 }, { type: "shield", count: 3 }, { type: "shooter", count: 3 }, { type: "resonator", count: 2 }, { type: "magnet", count: 2 }, { type: "splitter", count: 2 }] },
  /* 30 */ { boss: "blackHole", mix: true, groups: [{ type: "shooter", count: 2 }, { type: "shield", count: 2 }, { type: "resonator", count: 1 }] },  // 최종 보스: 블랙홀
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
