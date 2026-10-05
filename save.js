// =============================================================
// save.js : 영구 저장 장치 (코인, 업그레이드 레벨, 최고 웨이브)
// -------------------------------------------------------------
// 브라우저의 localStorage 에 JSON 글자로 저장한다.
//   - 읽기·쓰기는 모두 try/catch 로 감싼다. (개인 정보 보호 모드 등에서는 막힐 수 있다)
//   - 저장소를 못 쓰면 saveData 가 메모리에만 남는다. 게임은 그대로 할 수 있고,
//     창을 닫으면 그 판의 진행만 사라진다.
//   - 저장 데이터가 없거나 깨졌으면 기본값(코인 0, 레벨 0)으로 시작한다.
//
// 저장 형식 (SAVE_VERSION = 1)
//   { version: 1, coins: 120, upgrades: { vitality: 3, power: 2 }, bestWave: 7, hudCollapsed: false }
//   (hudCollapsed: 상태창을 접어 두었는지. 다음 판에도 그대로)
// =============================================================

// localStorage 안에서 쓰는 이름표
const SAVE_KEY = "augmentShooterSave";

// 저장 형식 버전. 나중에 저장 모양이 바뀌면 숫자를 올리고, 옛 데이터를 고쳐 읽는다.
const SAVE_VERSION = 1;

// 기본 저장 데이터 (처음 하는 사람, 또는 데이터가 깨졌을 때)
function defaultSave() {
  return { version: SAVE_VERSION, coins: 0, upgrades: {}, bestWave: 0, hudCollapsed: false };
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
  data.bestWave = cleanCount(parsed.bestWave, 0);
  data.hudCollapsed = parsed.hudCollapsed === true;  // true 가 아니면 펼친 상태
  if (parsed.upgrades && typeof parsed.upgrades === "object") {
    // 업그레이드 이름표를 하나씩 보며 레벨이 올바른 숫자인 것만 담는 반복문
    for (const id in parsed.upgrades) {
      data.upgrades[id] = cleanCount(parsed.upgrades[id], 0);
    }
  }
  // (버전이 달라도 지금은 위 항목만 읽으면 된다. 나중에 형식이 바뀌면 여기서 고쳐 읽는다)
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
