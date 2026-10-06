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
//
// 난이도는 배율 (곱하기) 을, 모드는 배율 (곱하기) 과 덮어쓸 값을 가진다.
// 둘을 합칠 때: 배율끼리는 곱하고, 그 밖의 값은 모드가 덮어쓴다.
// =============================================================

// ---- 규칙의 기본값 (보통 + 기본) ----
const BASE_RULES = {
  enemyHpMult: 1,
  enemySpeedMult: 1,
  enemyDamageMult: 1,
  coinMult: 1,
  choiceShow: 3,
  choicePick: 1,
  mutationMult: 1,
  rerolls: 0,
  useUpgrades: true,
  useSkills: true,
};

// 배율 (곱해서 합치는 값) 이름 목록
const RULE_MULTIPLIERS = ["enemyHpMult", "enemySpeedMult", "enemyDamageMult", "coinMult", "mutationMult"];

// ---- 난이도 ----
//   id, name: 이름표와 이름 / color: 로비 버튼 색 (game.js 의 COLORS) / desc: 도감 설명
//   unlockWave: "보통 + 기본" 으로 이 웨이브에 닿아야 열린다 (0 = 처음부터)
//   그 밖의 값: BASE_RULES 의 배율에 곱한다
const DIFFICULTIES = [
  {
    id: "easy", name: "쉬움", color: "green", unlockWave: 0,
    enemyHpMult: 0.7, enemySpeedMult: 0.9, enemyDamageMult: 0.7, coinMult: 0.7,
    desc: "연습용. 적 체력 × 0.7, 속도 × 0.9, 대미지 × 0.7. 대신 코인도 × 0.7",
  },
  {
    id: "normal", name: "보통", color: "yellow", unlockWave: 0,
    desc: "기본 난이도. 모든 배율 × 1",
  },
  {
    id: "hard", name: "어려움", color: "red", unlockWave: 15,
    enemyHpMult: 1.4, enemySpeedMult: 1.1, enemyDamageMult: 1.3, coinMult: 1.5,
    desc: "적 체력 × 1.4, 속도 × 1.1, 대미지 × 1.3. 코인 × 1.5",
  },
];

// ---- 모드 ----
//   id, name, color, desc, unlockWave: 난이도와 같다
//   rules: 덮어쓸 규칙 값 (배율은 곱한다)
const MODES = [
  {
    id: "basic", name: "기본", color: "yellow", unlockWave: 0,
    desc: "지금 그대로",
    rules: {},
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
  const difficulty = difficultyById(difficultyId), mode = modeById(modeId);
  const rules = Object.assign({ difficulty: difficulty.id, mode: mode.id }, BASE_RULES);
  // 난이도: 배율만 곱한다
  for (const key of RULE_MULTIPLIERS) {
    if (difficulty[key] !== undefined) rules[key] *= difficulty[key];
  }
  // 모드: 배율은 곱하고, 나머지는 덮어쓴다
  for (const key in mode.rules) {
    if (RULE_MULTIPLIERS.indexOf(key) >= 0) rules[key] *= mode.rules[key];
    else rules[key] = mode.rules[key];
  }
  return rules;
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

// 로비에서 고른 난이도 · 모드 (잠겨 있으면 보통 · 기본)
function selectedDifficulty() {
  const d = difficultyById(saveData.difficulty);
  return isUnlocked(d) ? d : difficultyById("normal");
}
function selectedMode() {
  const m = modeById(saveData.mode);
  return isUnlocked(m) ? m : MODES[0];
}
