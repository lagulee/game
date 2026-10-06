// =============================================================
// rules.js : 지금 판의 규칙 (난이도 · 모드)
// -------------------------------------------------------------
// 난이도와 모드는 둘 다 "규칙 값을 바꾸는 데이터" 일 뿐이다.
// 게임 본체 (game.js · enemies.js) 는 늘 currentRules 의 값을 읽어서 동작한다.
//   새 판을 시작할 때 (startGame) 로비에서 고른 난이도 + 모드로 currentRules 를 새로 만든다.
//
// 규칙 값 (BASE_RULES = 보통 난이도 + 기본 모드 = 지금까지의 게임과 완전히 같은 값)
//   enemyHpMult      : 적 체력 배율
//   enemySpeedMult   : 적 속도 배율
//   enemyDamageMult  : 접촉 대미지 배율 (적 탄환 · 블랙홀 지평선처럼 플레이어가 받는 대미지 모두)
//   coinMult         : 코인 배율 (생존 코인 · 보스 보너스)
//   choiceShow       : 카드 선택 때 보여 주는 장수
//   choicePick       : 카드 선택 때 고르는 장수
//   mutationMult     : 돌연변이 확률 배율 (MUTATION_CHANCE · MUTATION_BOSS_CHANCE 에 곱한다)
//   rerolls          : 한 판에 카드를 다시 뽑을 수 있는 횟수
//   useUpgrades      : 영구 업그레이드 (체력 · 공격력) 를 적용하는지
//   useSkills        : 발동 스킬을 쓸 수 있는지
//   waves            : 이 판의 웨이브 표 (null 이면 waves.js 의 WAVES)
//   exactCounts      : true 면 웨이브 표의 마릿수를 그대로 (WAVE_COUNT_MULT 를 곱하지 않음)
//   noDeath          : true 면 체력이 1 아래로 내려가지 않는다
//   saveRecord       : false 면 이번 판의 최고 기록 · 코인을 저장하지 않는다
//   tutorial         : 튜토리얼 판인지 (tutorial.js 의 안내)
//   autoAugments     : 0 보다 크면 카드를 고르지 못하고, 웨이브가 끝나면 무작위 카드를 이만큼 자동으로 받는다 (혼돈)
//   fixedStats       : { maxHp, damage } 이면 영구 업그레이드 대신 이 능력치로 시작 (오늘의 도전)
//   daily            : 오늘의 도전 판인지 (적 배치 · 카드 난수를 날짜로 고정)
//
// 난이도는 배율 (곱하기) 과 (튜토리얼처럼) 덮어쓸 값 rules 를, 모드는 rules 를 가진다.
// fixedMode: 이 난이도는 모드를 고정한다 (튜토리얼 = 기본)
// 둘을 합칠 때: 배율끼리는 곱하고, 그 밖의 값은 모드가 덮어쓴다.
// =============================================================

// ---- 조절용 숫자 (난이도 · 모드) ----
// 카드 선택 화면의 "다시 뽑기" 횟수 (한 판에)
const REROLL_COUNT = 2;
// 쉬움 · 어려움 배율 (적 체력 · 속도 · 접촉 대미지 · 코인) 과 해금 웨이브 ("보통 + 기본" 기록)
const EASY_HP = 0.7;
const EASY_SPEED = 0.9;
const EASY_DAMAGE = 0.7;
const EASY_COIN = 0.7;
const HARD_HP = 1.4;
const HARD_SPEED = 1.1;
const HARD_DAMAGE = 1.3;
const HARD_COIN = 1.5;
const HARD_UNLOCK = 15;
// 풍요: 보여 주는 카드 · 고르는 카드, 적 체력 · 코인 배율, 해금
const PLENTY_SHOW = 5;
const PLENTY_PICK = 2;
const PLENTY_HP = 1.6;
const PLENTY_COIN = 0.8;
const PLENTY_UNLOCK = 10;
// 혼돈: 웨이브마다 자동으로 받는 카드 수, 돌연변이 확률 배율, 코인 배율, 해금
const CHAOS_AUTO = 2;
const CHAOS_MUTATION = 3;
const CHAOS_COIN = 1.2;
const CHAOS_UNLOCK = 15;
// 오늘의 도전: 정해진 능력치, 해금
const DAILY_HP = 200;
const DAILY_DAMAGE = 16;
const DAILY_UNLOCK = 5;

// ---- 규칙의 기본값 (보통 + 기본) ----
const BASE_RULES = {
  enemyHpMult: 1,
  enemySpeedMult: 1,
  enemyDamageMult: 1,
  coinMult: 1,
  choiceShow: 3,
  choicePick: 1,
  mutationMult: 1,
  rerolls: REROLL_COUNT,
  useUpgrades: true,
  useSkills: true,
  waves: null,
  exactCounts: false,
  noDeath: false,
  saveRecord: true,
  tutorial: false,
  autoAugments: 0,
  fixedStats: null,
  daily: false,
};

// 배율 (곱해서 합치는 값) 이름 목록
const RULE_MULTIPLIERS = ["enemyHpMult", "enemySpeedMult", "enemyDamageMult", "coinMult", "mutationMult"];

// ---- 난이도 ----
//   id, name: 이름표와 이름 / color: 로비 버튼 색 (game.js 의 COLORS) / desc: 도감 설명
//   unlockWave: "보통 + 기본" 으로 이 웨이브에 닿아야 열린다 (0 = 처음부터)
//   그 밖의 값: BASE_RULES 의 배율에 곱한다
const DIFFICULTIES = [
  {
    id: "tutorial", name: "튜토리얼", color: "blue", unlockWave: 0, fixedMode: "basic",
    desc: "4웨이브짜리 연습 판. 이동 · 피하기 · 카드 · 보스를 차례로 알려 준다. 쓰러지지 않고, 처음 끝내면 코인 " + TUTORIAL_REWARD,
    rules: {
      waves: TUTORIAL_WAVES, exactCounts: true, noDeath: true, saveRecord: false, tutorial: true,
      useUpgrades: false, useSkills: false, enemyHpMult: 0.5, enemySpeedMult: 0.7, coinMult: 0, rerolls: 0,
    },
  },
  {
    id: "easy", name: "쉬움", color: "green", unlockWave: 0,
    enemyHpMult: EASY_HP, enemySpeedMult: EASY_SPEED, enemyDamageMult: EASY_DAMAGE, coinMult: EASY_COIN,
    desc: "연습용. 적 체력 × " + EASY_HP + ", 속도 × " + EASY_SPEED + ", 대미지 × " + EASY_DAMAGE + ". 대신 코인도 × " + EASY_COIN,
  },
  {
    id: "normal", name: "보통", color: "yellow", unlockWave: 0,
    desc: "기본 난이도. 모든 배율 × 1",
  },
  {
    id: "hard", name: "어려움", color: "red", unlockWave: HARD_UNLOCK,
    enemyHpMult: HARD_HP, enemySpeedMult: HARD_SPEED, enemyDamageMult: HARD_DAMAGE, coinMult: HARD_COIN,
    desc: "적 체력 × " + HARD_HP + ", 속도 × " + HARD_SPEED + ", 대미지 × " + HARD_DAMAGE + ". 코인 × " + HARD_COIN,
  },
];

// ---- 모드 ----
//   id, name, color, desc, unlockWave: 난이도와 같다
//   rules: 덮어쓸 규칙 값 (배율은 곱한다)
//   fixedDifficulty: 이 모드는 난이도를 고정한다 (오늘의 도전 = 보통)
const MODES = [
  {
    id: "basic", name: "기본", color: "yellow", unlockWave: 0,
    desc: "지금 그대로. 웨이브마다 카드 3장 중 1장",
    rules: {},
  },
  {
    id: "plenty", name: "풍요", color: "green", unlockWave: PLENTY_UNLOCK,
    desc: "카드 " + PLENTY_SHOW + "장 중 " + PLENTY_PICK + "장을 고른다. 대신 적 체력 × " + PLENTY_HP + ", 코인 × " + PLENTY_COIN,
    rules: { choiceShow: PLENTY_SHOW, choicePick: PLENTY_PICK, enemyHpMult: PLENTY_HP, coinMult: PLENTY_COIN },
  },
  {
    id: "chaos", name: "혼돈", color: "purple", unlockWave: CHAOS_UNLOCK,
    desc: "카드를 고르지 못하고 웨이브마다 무작위 증강 " + CHAOS_AUTO + "개를 자동으로 받는다. 돌연변이 확률 " + CHAOS_MUTATION + "배, 다시 뽑기 없음, 코인 × " + CHAOS_COIN,
    rules: { autoAugments: CHAOS_AUTO, mutationMult: CHAOS_MUTATION, rerolls: 0, coinMult: CHAOS_COIN },
  },
  {
    id: "daily", name: "오늘의 도전", color: "orange", unlockWave: DAILY_UNLOCK, fixedDifficulty: "normal",
    desc: "날짜가 같으면 누구나 같은 적 배치 · 같은 카드. 업그레이드 · 스킬 없이 체력 " + DAILY_HP + ", 공격력 " + DAILY_DAMAGE + " 으로. 난이도는 보통 고정, 코인은 하루 첫 판만",
    rules: { useUpgrades: false, useSkills: false, fixedStats: { maxHp: DAILY_HP, damage: DAILY_DAMAGE }, daily: true },
  },
];

// 해금 조건을 따지는 기록: "보통 + 기본" 최고 웨이브
const UNLOCK_RECORD = { difficulty: "normal", mode: "basic" };

// 지금 판의 규칙 (startGame 이 새로 만든다)
let currentRules = Object.assign({ difficulty: "normal", mode: "basic" }, BASE_RULES);

// 이름표로 난이도 · 모드 찾기 (없으면 보통 · 기본)
function difficultyById(id) {
  return DIFFICULTIES.find(function (d) { return d.id === id; }) || DIFFICULTIES.find(function (d) { return d.id === "normal"; });
}
function modeById(id) {
  return MODES.find(function (m) { return m.id === id; }) || MODES[0];
}

// 난이도 + 모드 → 규칙 한 벌
function makeRules(difficultyId, modeId) {
  let difficulty = difficultyById(difficultyId);
  const mode = modeById(difficulty.fixedMode || modeId);
  // 모드가 난이도를 고정하면 (오늘의 도전 = 보통) 그 난이도. 단 튜토리얼은 튜토리얼 그대로
  if (mode.fixedDifficulty && !difficulty.fixedMode) difficulty = difficultyById(mode.fixedDifficulty);
  const rules = Object.assign({ difficulty: difficulty.id, mode: mode.id }, BASE_RULES);
  // 난이도: 배율을 곱한다
  for (const key of RULE_MULTIPLIERS) {
    if (difficulty[key] !== undefined) rules[key] *= difficulty[key];
  }
  // 난이도 · 모드의 rules: 배율은 곱하고, 나머지는 덮어쓴다
  for (const extra of [difficulty.rules || {}, mode.rules || {}]) {
    for (const key in extra) {
      if (RULE_MULTIPLIERS.indexOf(key) >= 0) rules[key] *= extra[key];
      else rules[key] = extra[key];
    }
  }
  return rules;
}

// 이 판의 웨이브 표 (튜토리얼은 따로 만든 4웨이브)
function currentWaves() {
  return currentRules.waves || WAVES;
}

// ---- 최고 기록 (난이도 + 모드 별로 따로) ----

// 저장할 때 쓰는 이름표: "normal:basic"
function recordKey(difficultyId, modeId) {
  return difficultyId + ":" + modeId;
}
// 그 조합의 최고 웨이브 (없으면 0)
function bestWaveFor(difficultyId, modeId) {
  return saveData.bestWaves[recordKey(difficultyId, modeId)] || 0;
}
// 해금 조건에 쓰는 기록
function unlockRecord() {
  return bestWaveFor(UNLOCK_RECORD.difficulty, UNLOCK_RECORD.mode);
}
// 열렸는지 (난이도 · 모드 데이터 하나)
function isUnlocked(item) {
  return unlockRecord() >= (item.unlockWave || 0);
}

// ---- 오늘의 도전: 날짜로 고정한 난수 ----
// 회귀 검사 (tools/regress.js) 에서 쓰던 "같은 씨앗이면 같은 숫자 줄" 장치 (선형 합동 생성기) 를 게임으로 옮겼다.
// 적 배치용 (spawnRandom) 과 카드용 (cardRandom) 을 따로 쓰고, 웨이브마다 (날짜 + 웨이브 번호) 로 씨앗을 다시 정한다.
//   → 플레이어가 어떻게 움직이든 (파티클 · 대미지 숫자처럼 다른 곳에서 쓰는 난수와 섞이지 않아서)
//     같은 날 같은 웨이브는 누구나 같은 적 순서 · 같은 등장 자리, 같은 증강을 가졌으면 같은 카드.
// 오늘의 도전이 아니면 두 함수 모두 Math.random() 그대로 (= 예전과 똑같은 난수 순서)
let spawnRng = null;
let cardRng = null;

// 씨앗 → 0 이상 1 미만의 숫자를 차례로 내놓는 함수
function makeSeededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
// 글자 → 씨앗 숫자 (FNV-1a 해시: 글자가 조금만 달라도 전혀 다른 숫자)
function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 오늘 날짜 "2026-10-07" (이 컴퓨터의 날짜)
function todayKey() {
  const d = new Date();
  const two = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}
function spawnRandom() {
  return spawnRng ? spawnRng() : Math.random();
}
function cardRandom() {
  return cardRng ? cardRng() : Math.random();
}
// 오늘의 도전이면 이번 웨이브의 적 배치 난수 / 카드 난수를 (날짜 + 웨이브) 로 다시 정한다
function seedDailySpawns(waveNumber) {
  spawnRng = currentRules.daily ? makeSeededRandom(hashText(currentRules.dayKey + ":spawn:" + waveNumber)) : null;
}
function seedDailyCards(waveNumber) {
  cardRng = currentRules.daily ? makeSeededRandom(hashText(currentRules.dayKey + ":card:" + waveNumber)) : null;
}

// 로비에서 고른 난이도 · 모드 (잠겨 있으면 보통 · 기본)
function selectedDifficulty() {
  const d = difficultyById(saveData.difficulty);
  return isUnlocked(d) ? d : difficultyById("normal");
}
function selectedMode() {
  const m = modeById(saveData.mode);
  return isUnlocked(m) ? m : MODES[0];
}
