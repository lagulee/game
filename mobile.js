// =============================================================
// mobile.js : 모바일 모드 (휴대폰·태블릿에서 키보드 없이 모든 기능 쓰기)
// -------------------------------------------------------------
// 설정 창의 "모바일 모드" 버튼으로 켜고 끈다 (saveData.mobileMode 에 저장).
// 켜면 화면 위에 HTML 터치 버튼들이 생긴다:
//   - 조이스틱 : 전투 중, 화면 왼쪽 아래 아무 곳이나 누르면 그 자리에 생긴다.
//                끝까지 밀면 최고 속도, 반만 밀면 절반 속도 (game.js 의 touchStick 에 넣는다)
//   - ⏸ 버튼  : 전투 중 오른쪽 위. 일시정지 (P 키와 같다)
//   - 디버그   : 오른쪽 가운데. 누르면 F2 와 같다 (주인 비밀번호를 묻는다)
//                디버그 모드가 켜지면 웨이브 ◀ ▶, 지급(G), 보스(B), 무적(I), 체력, 코인 버튼이 생긴다
// 나머지(카드 고르기, 로비, 결과 화면, 업그레이드)는 원래부터 화면을 눌러서 쓸 수 있다.
// 손가락·마우스·펜을 모두 같은 방법(포인터 이벤트)으로 받는다 → 데스크탑에서 마우스로 시험해 볼 수도 있다.
// =============================================================

// ---- 조절용 상수 ----
const STICK_RADIUS = 60;            // 조이스틱 손잡이가 움직일 수 있는 반지름 (px). 끝까지 밀면 세기 1
const STICK_ZONE_WIDTH = 0.5;       // 조이스틱을 놓을 수 있는 구역: 화면 왼쪽 50%
const STICK_ZONE_TOP = 0.35;        //   그리고 화면 위에서 35% 아래쪽 (위쪽은 상태창을 누를 수 있게 비워 둔다)

// 디버그 모드에서 보여 줄 버튼 [글자, 키 코드, Shift 를 같이 누른 것처럼 할지, 전투 중에만 쓸 수 있는지]
// 버튼을 누르면 그 키를 누른 것처럼 game.js 에 알린다 (키보드와 똑같이 동작)
const MOBILE_DEBUG_BUTTONS = [
  ["◀ 웨이브", "BracketLeft", false, true],
  ["웨이브 ▶", "BracketRight", false, true],
  ["지급", "KeyG", false, true],
  ["보스", "KeyB", false, false],
  ["무적", "KeyI", false, false],
  ["체력", "Digit0", true, true],
  ["코인", "KeyC", true, false],
];

// ---- 화면 요소 만들기 ----
const mobileRoot = document.createElement("div");
mobileRoot.id = "mobile-controls";
mobileRoot.innerHTML =
  '<div class="stick-zone"></div>' +
  '<div class="stick-base"><div class="stick-knob"></div></div>' +
  '<button class="mobile-btn mobile-pause" title="일시정지">⏸</button>' +
  '<div class="mobile-debug">' +
  '  <button class="mobile-btn mobile-debug-toggle">디버그</button>' +
  '  <div class="mobile-debug-list"></div>' +
  "</div>";
document.body.appendChild(mobileRoot);

const stickZone = mobileRoot.querySelector(".stick-zone");
const stickBase = mobileRoot.querySelector(".stick-base");
const stickKnob = mobileRoot.querySelector(".stick-knob");
const pauseButton = mobileRoot.querySelector(".mobile-pause");
const debugToggle = mobileRoot.querySelector(".mobile-debug-toggle");
const debugList = mobileRoot.querySelector(".mobile-debug-list");

// 키를 누른 것처럼 game.js 에 알린다 (keydown 다음 keyup)
function mobilePressKey(code, shift) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: code, shiftKey: !!shift }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: code, shiftKey: !!shift }));
}

// 디버그 버튼들
for (const [label, code, shift] of MOBILE_DEBUG_BUTTONS) {
  const btn = document.createElement("button");
  btn.className = "mobile-btn mobile-debug-btn";
  btn.textContent = label;
  btn.dataset.code = code;
  btn.addEventListener("click", function () { mobilePressKey(code, shift); });
  debugList.appendChild(btn);
}
debugToggle.addEventListener("click", function () { mobilePressKey("F2"); });
pauseButton.addEventListener("click", function () {
  if (gameState === "playing" && !paused) pauseGame();
});

// ---- 조이스틱 ----
let stickPointer = null;     // 조이스틱을 잡고 있는 손가락(포인터) 번호
let stickCenter = { x: 0, y: 0 };

// 손잡이를 (dx, dy) 만큼 옮겨 그리고, 세기를 touchStick 에 넣는다
function setStick(dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d > STICK_RADIUS) { dx *= STICK_RADIUS / d; dy *= STICK_RADIUS / d; }
  stickKnob.style.transform = "translate(" + dx + "px, " + dy + "px)";
  touchStick.x = dx / STICK_RADIUS;
  touchStick.y = dy / STICK_RADIUS;
}

// 조이스틱 바탕을 화면 (x, y) 에 놓는다
function placeStick(x, y) {
  stickBase.style.left = x + "px";
  stickBase.style.top = y + "px";
}

// 손을 떼면: 손잡이를 가운데로, 바탕은 원래 자리(왼쪽 아래)로
function releaseStick() {
  stickPointer = null;
  touchStick.active = false;
  setStick(0, 0);
  stickBase.classList.remove("held");
  stickBase.style.left = "";
  stickBase.style.top = "";
}

stickZone.addEventListener("pointerdown", function (event) {
  if (stickPointer !== null) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  try { stickZone.setPointerCapture(event.pointerId); } catch (e) { /* 검사용 가짜 이벤트 */ }
  stickCenter = { x: event.clientX, y: event.clientY };
  placeStick(event.clientX, event.clientY);
  stickBase.classList.add("held");
  touchStick.active = true;
  setStick(0, 0);
});
stickZone.addEventListener("pointermove", function (event) {
  if (event.pointerId !== stickPointer) return;
  event.preventDefault();
  setStick(event.clientX - stickCenter.x, event.clientY - stickCenter.y);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  stickZone.addEventListener(type, function (event) {
    if (event.pointerId === stickPointer) releaseStick();
  });
}

// ---- 켜고 끄기 ----

// 설정 창 "모바일 모드" 버튼
function toggleMobileMode() {
  saveData.mobileMode = !(saveData.mobileMode === true);
  writeSave();
  if (!saveData.mobileMode) releaseStick();
  updateMobileControls();
}

// 지금 화면에 맞게 터치 버튼을 보이고 숨긴다 (game.js 의 draw() 가 매 프레임 부른다)
// 바뀐 것이 있을 때만 화면 요소를 고친다
let mobileShownKey = "";
function updateMobileControls() {
  const on = saveData.mobileMode === true;
  const fighting = gameState === "playing" && !paused && !isOverlayOpen() && !isDebugGiveOpen() && !isDebugBossOpen();
  const inGame = gameState === "playing" || gameState === "choosing";
  const key = [on, fighting, debugMode, inGame].join(",");
  if (key === mobileShownKey) return;
  mobileShownKey = key;
  mobileRoot.classList.toggle("on", on);
  mobileRoot.classList.toggle("fighting", fighting);
  mobileRoot.classList.toggle("debug-on", debugMode);
  debugToggle.textContent = debugMode ? "디버그 끄기" : "디버그";
  // 전투 중에만 쓰는 디버그 버튼은 전투가 아닐 때 흐리게
  debugList.querySelectorAll(".mobile-debug-btn").forEach(function (btn, i) {
    btn.disabled = MOBILE_DEBUG_BUTTONS[i][3] && !inGame;
  });
  // 전투가 아니면 조이스틱을 놓는다 (카드 화면 등에서 움직이지 않게)
  if (!fighting && stickPointer !== null) releaseStick();
}

updateMobileControls();
