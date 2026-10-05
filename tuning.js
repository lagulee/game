// =============================================================
// tuning.js : 숫자 조절판 (게임을 고치지 않고 브라우저에서 상수를 바꿔 보기)
// -------------------------------------------------------------
// 쓰는 법 (게임 안에서)
//   로비 → 오른쪽 위 톱니(설정) → "숫자 조절" 버튼
//   숫자를 바꾸고 "적용하고 다시 시작" → 페이지가 새로 열리면서 바뀐 값으로 게임이 돈다
//   바꾼 값은 이 브라우저에만 저장된다 (코인·업그레이드 저장과는 따로)
//   마음에 드는 값을 찾으면 "바뀐 값 복사" 로 목록을 복사해 두고, js 파일에서
//   tune("이름", 기본값) 의 기본값 숫자를 그 값으로 바꾸면 모든 사람에게 적용된다
//
// 원리
//   다른 js 파일에서 조절하고 싶은 상수를 이렇게 적는다:
//     const ENEMY_HP_BASE = tune("ENEMY_HP_BASE", 2.0);
//   tune() 은 조절판에 저장된 값이 있으면 그 값을, 없으면 기본값(2.0)을 돌려준다.
//   그래서 이 파일은 index.html 에서 가장 먼저 불러와야 한다.
//
// 주인 잠금
//   숫자 조절판과 디버그 모드(F2)는 비밀번호를 넣어야 열린다 (아래 "주인 잠금" 부분)
//   한 번 맞히면 그 탭을 닫을 때까지 다시 묻지 않는다 (조절판 "잠그기" 버튼으로 바로 잠글 수 있다)
//   ※ 이 게임은 브라우저에서 돌아가는 코드라 진짜 보안은 아니다. 코드를 읽을 줄 아는 사람은 풀 수 있다.
//
// 조절판에 새 상수를 넣으려면
//   1) 그 상수를 tune("이름", 기본값) 으로 바꾸고
//   2) 아래 TUNING_INFO 에 한 줄 추가한다 (어느 묶음, 설명, 정수만인지)
// =============================================================

// 조절한 값을 저장하는 이름표 (localStorage)
const TUNING_KEY = "augmentShooterTuning";

// 조절판에 보여 줄 상수 설명. 위에서부터 이 순서로 보여 준다.
//   group: 묶음 제목, label: 설명, int: true 면 정수만, min: 이보다 작게는 못 바꿈 (기본 0)
const TUNING_INFO = {
  // ---- 플레이어 ----
  PLAYER_SPEED: { group: "플레이어", label: "이동 속도 (px/초)" },
  PLAYER_MAX_HP: { group: "플레이어", label: "시작 최대 체력", int: true, min: 1 },
  PLAYER_INVINCIBLE_TIME: { group: "플레이어", label: "맞은 뒤 무적 시간 (초)" },
  FIRE_INTERVAL: { group: "플레이어", label: "자동 발사 간격 (초)", min: 0.05 },
  BULLET_SPEED: { group: "플레이어", label: "총알 속도 (px/초)", min: 1 },
  BULLET_DAMAGE: { group: "플레이어", label: "총알 기본 대미지" },
  WAVE_CLEAR_HEAL_RATIO: { group: "플레이어", label: "웨이브 클리어 회복 (최대 체력 비율)" },
  BOSS_KILL_HEAL_RATIO: { group: "플레이어", label: "보스 처치 회복 (최대 체력 비율)" },
  // ---- 적 강화 (웨이브마다) ----
  ENEMY_HP_BASE: { group: "적 강화", label: "체력 배율 (1웨이브)" },
  ENEMY_HP_GROWTH: { group: "적 강화", label: "체력 증가 (웨이브당)" },
  ENEMY_HP_QUAD: { group: "적 강화", label: "체력 제곱 항 (× (웨이브−1)²)" },
  ENEMY_DMG_BASE: { group: "적 강화", label: "접촉 대미지 배율 (1웨이브)" },
  ENEMY_DMG_GROWTH: { group: "적 강화", label: "접촉 대미지 증가 (웨이브당)" },
  ENEMY_SPEED_BASE: { group: "적 강화", label: "속도 배율 (1웨이브)" },
  ENEMY_SPEED_STEP: { group: "적 강화", label: "속도 증가 (웨이브당)" },
  ENEMY_SPEED_MAX_MULT: { group: "적 강화", label: "속도 배율 상한" },
  // ---- 웨이브 ----
  WAVE_SPAWN_INTERVAL: { group: "웨이브", label: "적 무리 등장 간격 (초)", min: 0.05 },
  WAVE_SPAWN_BATCH: { group: "웨이브", label: "한 무리 마릿수", int: true, min: 1 },
  WAVE_COUNT_MULT: { group: "웨이브", label: "적 수 배율 (표 × 이 값)" },
  WAVE_COUNT_MULT_LATE: { group: "웨이브", label: "6웨이브부터 적 수 배율 (한 번 더 곱함)" },
  BOSS_SPAWN_DELAY: { group: "웨이브", label: "보스 등장까지 (초)" },
  BOSS_MINION_INTERVAL: { group: "웨이브", label: "보스 웨이브 졸개 간격 (초)", min: 0.05 },
  ENRAGE_TIME: { group: "웨이브", label: "과열 시작 (웨이브 시작 후 초)" },
  ENRAGE_RATE: { group: "웨이브", label: "과열 속도 증가 (초당 비율)" },
  ENRAGE_MAX_PLAYER_RATIO: { group: "웨이브", label: "과열 속도 상한 (플레이어 속도 배수)" },
  // ---- 코인 · 업그레이드 ----
  COIN_PER_SECOND: { group: "코인 · 업그레이드", label: "초당 코인 (1웨이브)" },
  COIN_WAVE_BONUS: { group: "코인 · 업그레이드", label: "초당 코인 증가 (웨이브당)" },
  COIN_WAVE_TIME_CAP: { group: "코인 · 업그레이드", label: "웨이브당 코인 시간 상한 (초)" },
  BOSS_COIN_BONUS: { group: "코인 · 업그레이드", label: "보스 보너스 코인 (× 챕터)" },
  UPGRADE_BASE_COST: { group: "코인 · 업그레이드", label: "업그레이드 첫 비용", min: 1 },
  UPGRADE_COST_GROWTH: { group: "코인 · 업그레이드", label: "업그레이드 비용 배율 (레벨당)", min: 1 },
  UPGRADE_HP_PER_LEVEL: { group: "코인 · 업그레이드", label: "체력 업그레이드 (레벨당 +)" },
  UPGRADE_DAMAGE_PER_LEVEL: { group: "코인 · 업그레이드", label: "공격력 업그레이드 (레벨당 +)" },
};

// 저장된 조절 값 { 이름: 숫자 } (저장소를 못 쓰는 환경이면 빈 상자)
let tuningOverrides = {};
try {
  const raw = localStorage.getItem(TUNING_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") tuningOverrides = parsed;
  }
} catch (e) {
  tuningOverrides = {};
}

// tune() 으로 등록된 상수들의 기본값 { 이름: 기본값 }
const tuningDefaults = {};

// 숫자 value 를 이 상수의 규칙(정수, 최솟값)에 맞게 다듬는다. 쓸 수 없는 값이면 null
function cleanTuningValue(name, value) {
  const info = TUNING_INFO[name] || {};
  if (typeof value !== "number" || !isFinite(value)) return null;
  if (info.int) value = Math.round(value);
  return Math.max(info.min === undefined ? 0 : info.min, value);
}

// 상수 하나를 등록하고, 저장된 값이 있으면 그 값을 (없거나 이상하면 기본값을) 돌려준다
function tune(name, defaultValue) {
  tuningDefaults[name] = defaultValue;
  const v = cleanTuningValue(name, tuningOverrides[name]);
  return v === null ? defaultValue : v;
}

// 지금 기본값과 다르게 조절해서 쓰고 있는 상수 수 (로비에 "숫자 조절 N개 적용 중" 표시)
function tuningActiveCount() {
  let n = 0;
  for (const name in tuningDefaults) {
    const v = cleanTuningValue(name, tuningOverrides[name]);
    if (v !== null && v !== tuningDefaults[name]) n++;
  }
  return n;
}

// ---- 주인 잠금 (비밀번호) ----

// 비밀번호를 그대로 적지 않고 "지문"(해시)만 적어 둔다. 비밀번호를 바꾸려면:
//   브라우저 콘솔에서 pinHash("새 비밀번호") 를 실행해 나온 글자를 아래에 넣는다
const OWNER_PIN_HASH = "52e6c1c5";
// 잠금을 푼 상태를 기억하는 이름표 (sessionStorage: 탭을 닫으면 사라진다)
const OWNER_UNLOCK_KEY = "augmentShooterOwner";

// 글자의 지문 (FNV-1a 해시). 같은 글자는 항상 같은 지문, 조금만 달라도 전혀 다른 지문
function pinHash(pin) {
  const text = "augment-shooter:" + pin;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// 잠금이 풀려 있는지
let ownerUnlocked = false;
try {
  ownerUnlocked = sessionStorage.getItem(OWNER_UNLOCK_KEY) === "1";
} catch (e) {
  ownerUnlocked = false;
}

// 비밀번호가 맞으면 잠금을 풀고 true
function unlockOwner(pin) {
  if (pinHash(String(pin).trim()) !== OWNER_PIN_HASH) return false;
  ownerUnlocked = true;
  try { sessionStorage.setItem(OWNER_UNLOCK_KEY, "1"); } catch (e) { /* 이번 페이지 동안만 */ }
  return true;
}

// 다시 잠그기
function lockOwner() {
  ownerUnlocked = false;
  try { sessionStorage.removeItem(OWNER_UNLOCK_KEY); } catch (e) { /* 무시 */ }
}

let pinPrompt = null;   // 열려 있는 비밀번호 창 (닫혀 있으면 null)

// 잠금이 풀려 있으면 바로 onSuccess, 아니면 비밀번호 창을 띄우고 맞히면 onSuccess
//   title: 무엇을 열려는지 (예: "숫자 조절")
function requireOwner(title, onSuccess) {
  if (ownerUnlocked) { onSuccess(); return; }
  if (pinPrompt) return;
  const overlay = document.createElement("div");
  overlay.className = "tuning-overlay";
  overlay.innerHTML =
    '<div class="tuning-panel pin-panel">' +
    '<div class="tuning-head"><span class="tuning-title">🔒 ' + title + '</span>' +
    '<button class="tuning-close" title="닫기 (Esc)">✕</button></div>' +
    '<p class="tuning-help">만든 사람만 쓸 수 있어요. 비밀번호를 넣어 주세요.</p>' +
    '<input class="pin-input" type="password" inputmode="numeric" autocomplete="off" maxlength="12">' +
    '<p class="pin-message"></p>' +
    '<div class="tuning-foot"><button class="tuning-btn tuning-apply pin-ok">확인</button>' +
    '<button class="tuning-btn pin-cancel">취소</button></div></div>';
  const input = overlay.querySelector(".pin-input");
  const message = overlay.querySelector(".pin-message");
  const submit = function () {
    if (unlockOwner(input.value)) {
      closePinPrompt();
      onSuccess();
    } else {
      message.textContent = "비밀번호가 달라요";
      input.value = "";
      input.focus();
      // 창을 좌우로 살짝 흔든다 (CSS 애니메이션을 다시 시작)
      const panel = overlay.querySelector(".pin-panel");
      panel.classList.remove("pin-shake");
      void panel.offsetWidth;
      panel.classList.add("pin-shake");
    }
  };
  overlay.querySelector(".pin-ok").addEventListener("click", submit);
  overlay.querySelector(".pin-cancel").addEventListener("click", closePinPrompt);
  overlay.querySelector(".tuning-close").addEventListener("click", closePinPrompt);
  // 창 안의 키는 게임으로 가지 않게 막는다. Enter = 확인, Esc = 취소
  overlay.addEventListener("keydown", function (event) {
    event.stopPropagation();
    if (event.key === "Enter") submit();
    else if (event.key === "Escape") closePinPrompt();
  });
  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay) closePinPrompt();
  });
  document.body.appendChild(overlay);
  pinPrompt = overlay;
  input.focus();
}

// 비밀번호 창 닫기
function closePinPrompt() {
  if (!pinPrompt) return;
  pinPrompt.remove();
  pinPrompt = null;
}

// ---- 조절판 화면 (HTML 로 만든다. 캔버스 위에 겹쳐 뜬다) ----

let tuningPanel = null;   // 열려 있는 조절판 요소 (닫혀 있으면 null)

// 조절판이 열려 있는지
function isTuningOpen() {
  return tuningPanel !== null;
}

// 조절판이나 비밀번호 창이 떠 있는지 (떠 있는 동안 게임은 키 입력을 받지 않는다)
function isOverlayOpen() {
  return tuningPanel !== null || pinPrompt !== null;
}

// 페이지를 다시 연다 (검사할 때는 이 함수를 바꿔 끼운다)
function tuningReload() {
  location.reload();
}

// 저장 (저장소를 못 쓰면 false)
function writeTuning(map) {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(TUNING_KEY);
    else localStorage.setItem(TUNING_KEY, JSON.stringify(map));
    return true;
  } catch (e) {
    return false;
  }
}

// 숫자를 보기 좋게 (부동소수 찌꺼기 없애기: 0.30000000000000004 → 0.3)
function formatTuningNumber(v) {
  return String(Math.round(v * 1e6) / 1e6);
}

// 조절판 열기 (잠겨 있으면 비밀번호부터)
function openTuningPanel() {
  requireOwner("숫자 조절", showTuningPanel);
}

// 조절판을 실제로 띄운다
function showTuningPanel() {
  if (tuningPanel) return;
  const overlay = document.createElement("div");
  overlay.className = "tuning-overlay";
  const panel = document.createElement("div");
  panel.className = "tuning-panel";
  overlay.appendChild(panel);

  // 제목과 설명
  panel.innerHTML =
    '<div class="tuning-head"><span class="tuning-title">숫자 조절</span>' +
    '<button class="tuning-close" title="닫기 (Esc)">✕</button></div>' +
    '<p class="tuning-help">숫자를 바꾸고 <b>적용하고 다시 시작</b>을 누르면 바뀐 값으로 게임이 새로 시작돼요. ' +
    "바꾼 값은 이 브라우저에만 저장되고, 코인·업그레이드는 그대로예요.</p>";

  // 상수 목록 (묶음별로)
  const list = document.createElement("div");
  list.className = "tuning-list";
  const inputs = {};
  let lastGroup = "";
  // TUNING_INFO 순서대로, 실제로 등록된(tune 으로 부른) 상수만 한 줄씩 만드는 반복문
  for (const name in TUNING_INFO) {
    if (!(name in tuningDefaults)) continue;
    const info = TUNING_INFO[name];
    if (info.group !== lastGroup) {
      const h = document.createElement("div");
      h.className = "tuning-group";
      h.textContent = info.group;
      list.appendChild(h);
      lastGroup = info.group;
    }
    const row = document.createElement("label");
    row.className = "tuning-row";
    const def = tuningDefaults[name];
    const saved = cleanTuningValue(name, tuningOverrides[name]);
    row.innerHTML =
      '<span class="tuning-label">' + info.label + '<small>' + name + "</small></span>" +
      '<span class="tuning-default">기본 ' + formatTuningNumber(def) + "</span>";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = formatTuningNumber(saved === null ? def : saved);
    // 값이 기본값과 다르면 노랗게 표시
    const mark = function () {
      const v = cleanTuningValue(name, parseFloat(input.value));
      row.classList.toggle("tuning-changed", v !== null && v !== def);
      row.classList.toggle("tuning-bad", input.value !== "" && v === null);
    };
    input.addEventListener("input", mark);
    mark();
    row.appendChild(input);
    list.appendChild(row);
    inputs[name] = input;
  }
  panel.appendChild(list);

  // 아래쪽 버튼과 복사용 글상자
  const foot = document.createElement("div");
  foot.className = "tuning-foot";
  foot.innerHTML =
    '<button class="tuning-btn tuning-apply">적용하고 다시 시작</button>' +
    '<button class="tuning-btn tuning-copy">바뀐 값 복사</button>' +
    '<button class="tuning-btn tuning-reset">모두 기본값</button>' +
    '<button class="tuning-btn tuning-lock">🔒 잠그기</button>';
  panel.appendChild(foot);
  const note = document.createElement("textarea");
  note.className = "tuning-note";
  note.readOnly = true;
  note.hidden = true;
  panel.appendChild(note);

  // 입력칸들에서 "기본값과 다른 값" 만 모은다 { 이름: 숫자 }
  const collect = function () {
    const map = {};
    for (const name in inputs) {
      const v = cleanTuningValue(name, parseFloat(inputs[name].value));
      if (v !== null && v !== tuningDefaults[name]) map[name] = v;
    }
    return map;
  };

  panel.querySelector(".tuning-close").addEventListener("click", closeTuningPanel);
  panel.querySelector(".tuning-lock").addEventListener("click", function () {
    lockOwner();
    closeTuningPanel();
  });
  panel.querySelector(".tuning-apply").addEventListener("click", function () {
    applyTuning(collect());
  });
  panel.querySelector(".tuning-reset").addEventListener("click", function () {
    for (const name in inputs) {
      inputs[name].value = formatTuningNumber(tuningDefaults[name]);
      inputs[name].dispatchEvent(new Event("input"));
    }
  });
  panel.querySelector(".tuning-copy").addEventListener("click", function () {
    const map = collect();
    const lines = Object.keys(map).map(function (name) {
      return name + " = " + formatTuningNumber(map[name]) + "   (기본 " + formatTuningNumber(tuningDefaults[name]) + ")";
    });
    note.value = lines.length ? lines.join("\n") : "(기본값과 다른 숫자가 없어요)";
    note.hidden = false;
    note.select();
    // 클립보드 복사를 시도하고, 안 되면 글상자에서 직접 복사할 수 있게 둔다
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(note.value).catch(function () {});
    } catch (e) { /* 직접 복사 */ }
  });

  // 조절판 안의 키는 게임으로 가지 않게 막는다. Esc 는 닫기
  overlay.addEventListener("keydown", function (event) {
    event.stopPropagation();
    if (event.key === "Escape") closeTuningPanel();
  });
  // 바깥(어두운 부분)을 누르면 닫기
  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay) closeTuningPanel();
  });

  document.body.appendChild(overlay);
  tuningPanel = overlay;
  const first = list.querySelector("input");
  if (first) first.focus();
}

// 조절판 닫기 (적용하지 않은 값은 버린다)
function closeTuningPanel() {
  if (!tuningPanel) return;
  tuningPanel.remove();
  tuningPanel = null;
}

// 값을 저장하고 페이지를 다시 연다
function applyTuning(map) {
  tuningOverrides = map;
  writeTuning(map);
  closeTuningPanel();
  tuningReload();
}
