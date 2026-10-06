// =============================================================
// save.js : 영구 저장 장치 (코인, 업그레이드 레벨, 최고 웨이브)
// -------------------------------------------------------------
// 브라우저의 localStorage 에 JSON 글자로 저장한다.
//   - 읽기·쓰기는 모두 try/catch 로 감싼다. (개인 정보 보호 모드 등에서는 막힐 수 있다)
//   - 저장소를 못 쓰면 saveData 가 메모리에만 남는다. 게임은 그대로 할 수 있고,
//     창을 닫으면 그 판의 진행만 사라진다.
//   - 저장 데이터가 없거나 깨졌으면 기본값(코인 0, 레벨 0)으로 시작한다.
//
// 저장 형식 (SAVE_VERSION = 2)
//   { version: 2, coins: 120, upgrades: { vitality: 3, power: 2 }, bestWaves: { "normal:basic": 7, "hard:basic": 3 },
//     difficulty: "normal", mode: "basic", hudCollapsed: false, ... }
//   (bestWaves: 최고 웨이브를 "난이도:모드" 별로 따로. rules.js 의 recordKey)
//   (difficulty · mode: 로비에서 고른 난이도 · 모드. 다음에 켜도 그대로)
//   ※ 버전 1 (옛 저장) 에는 bestWave 숫자 하나만 있었다 → 읽을 때 "보통 + 기본" 기록 (bestWaves["normal:basic"]) 으로 옮긴다.
//     코인 · 업그레이드 · 스킬 · 본 돌연변이 등 나머지는 그대로 읽는다.
//   (hudCollapsed: 상태창을 접어 두었는지. 다음 판에도 그대로)
//   (mobileMode: 모바일 모드(조이스틱·터치 버튼)를 켰는지)
//   (spawnWarn: 적 등장 예고 표시를 보여 줄지. 기본 켜짐)
//   (ownedSkills: 산 발동 스킬 이름표 목록 ["dash", ...] / equippedSkill: 장착한 스킬 이름표, 없으면 null)
//   (seenMutations: 한 번이라도 얻은 돌연변이의 증강 이름표 목록 ["compound", ...]. 도감에서 내용을 보여 준다.
//    옛 저장 데이터에 이 항목이 없으면 빈 목록으로 읽는다)
// =============================================================

// localStorage 안에서 쓰는 이름표
const SAVE_KEY = "augmentShooterSave";

// 저장 형식 버전. 나중에 저장 모양이 바뀌면 숫자를 올리고, 옛 데이터를 고쳐 읽는다.
const SAVE_VERSION = 2;
// 버전 1 의 bestWave 를 옮겨 넣을 기록 이름표 (= rules.js 의 recordKey("normal", "basic"))
const LEGACY_RECORD_KEY = "normal:basic";

// 기본 저장 데이터 (처음 하는 사람, 또는 데이터가 깨졌을 때)
function defaultSave() {
  return { version: SAVE_VERSION, coins: 0, upgrades: {}, bestWaves: {}, difficulty: "normal", mode: "basic",
    hudCollapsed: false, mobileMode: false, spawnWarn: true, ownedSkills: [], equippedSkill: null, seenMutations: [] };
}

// 0 이상의 정수만 통과시키는 도우미 (이상한 값이면 기본값)
function cleanCount(value, fallback) {
  return (typeof value === "number" && isFinite(value) && value >= 0) ? Math.floor(value) : fallback;
}

// 저장소에서 읽어 오는 함수. 어떤 문제가 있어도 항상 올바른 모양의 데이터를 돌려준다.
function loadSave() {
  const data = defaultSave();
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return data; // 저장소를 아예 못 쓰는 환경
  }
  if (!raw) return data; // 저장된 적이 없음

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return data; // 글자가 깨져서 JSON 으로 읽을 수 없음
  }
  if (!parsed || typeof parsed !== "object") return data;

  // 항목 하나하나를 검사해서 올바른 것만 옮겨 담는다
  data.coins = cleanCount(parsed.coins, 0);
  // 최고 웨이브: 조합마다 (이름표는 글자, 값은 0 이상의 정수만)
  if (parsed.bestWaves && typeof parsed.bestWaves === "object") {
    for (const key in parsed.bestWaves) {
      const wave = cleanCount(parsed.bestWaves[key], 0);
      if (wave > 0) data.bestWaves[key] = wave;
    }
  }
  // 버전 1 → 2: 옛 bestWave 는 "보통 + 기본" 기록으로 옮긴다 (이미 더 큰 기록이 있으면 그대로)
  if (parsed.version !== SAVE_VERSION && parsed.bestWave !== undefined) {
    const old = cleanCount(parsed.bestWave, 0);
    if (old > (data.bestWaves[LEGACY_RECORD_KEY] || 0)) data.bestWaves[LEGACY_RECORD_KEY] = old;
  }
  if (typeof parsed.difficulty === "string") data.difficulty = parsed.difficulty;
  if (typeof parsed.mode === "string") data.mode = parsed.mode;
  data.hudCollapsed = parsed.hudCollapsed === true;  // true 가 아니면 펼친 상태
  data.mobileMode = parsed.mobileMode === true;      // true 가 아니면 꺼짐
  data.spawnWarn = parsed.spawnWarn !== false;       // false 가 아니면 켜짐 (적 등장 예고 표시)
  // 산 스킬: 글자 이름표만, 같은 것은 한 번만
  if (Array.isArray(parsed.ownedSkills)) {
    for (const id of parsed.ownedSkills) {
      if (typeof id === "string" && data.ownedSkills.indexOf(id) < 0) data.ownedSkills.push(id);
    }
  }
  // 장착한 스킬: 산 스킬 중 하나일 때만
  // 얻은 돌연변이 목록 (글자만, 겹치지 않게)
  if (Array.isArray(parsed.seenMutations)) {
    for (const id of parsed.seenMutations) {
      if (typeof id === "string" && data.seenMutations.indexOf(id) < 0) data.seenMutations.push(id);
    }
  }
  if (typeof parsed.equippedSkill === "string" && data.ownedSkills.indexOf(parsed.equippedSkill) >= 0) data.equippedSkill = parsed.equippedSkill;
  if (parsed.upgrades && typeof parsed.upgrades === "object") {
    // 업그레이드 이름표를 하나씩 보며 레벨이 올바른 숫자인 것만 담는 반복문
    for (const id in parsed.upgrades) {
      data.upgrades[id] = cleanCount(parsed.upgrades[id], 0);
    }
  }
  // (읽은 데이터는 늘 지금 버전 모양: 다음에 저장하면 version 2 로 써진다)
  return data;
}

// 지금 saveData 를 저장소에 쓰는 함수. 실패해도 게임은 계속된다.
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    return false; // 저장소를 못 쓰면 메모리에만 남는다
  }
}

// 저장 초기화: 기본값으로 되돌리고 바로 저장
function resetSave() {
  saveData = defaultSave();
  writeSave();
}

// 게임 전체가 함께 쓰는 저장 데이터 (게임을 켤 때 한 번 읽는다)
let saveData = loadSave();
