// =============================================================
// game.js : 게임 본체
// -------------------------------------------------------------
// (a) 플레이어 이동 : 게임 루프, 키보드 입력, 화면 밖 제한
// (b) 자동 발사와 적 : 적 생성·추적, 가장 가까운 적 조준, 총알 충돌, 적 체력
// (c) 웨이브와 체력  : 웨이브 3개, 플레이어 체력·무적 시간, 게임 오버·클리어, R 재시작
// (d) 증강 선택 화면 : 웨이브가 끝나면 카드 3장 중 1장 고르기 (마우스 클릭 / 1·2·3 키)
// (e) 증강 3개      : 복리 탄환, 분산 증폭, 시간 지연 효과를 augments.js 의 훅으로 연결
// (f) UI와 마무리    : 메뉴 화면, 점수·최고 점수, 증강 목록 패널, 결과 화면
// [스타일] 스티커 카툰: 두꺼운 외곽선 + 납작한 단색 + 하이라이트 한 줄
// =============================================================


// =============================================================
// 1. 조절용 상수 (숫자를 바꿔 보며 실험해 보세요!)
// =============================================================

// 캔버스(게임 화면) 크기. index.html의 width/height와 같아야 한다.
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

// ---- 스타일(그림) 관련 상수 ----

// 게임에서 쓰는 색은 전부 여기 팔레트에 모은다. 다른 곳에서는 COLORS.이름 으로만 쓴다.
const COLORS = {
  outline: "#2B2118",    // 외곽선 (아주 진한 갈색)
  background: "#E9E6D8", // 배경 (따뜻한 크림색)
  white: "#F7F4EA",      // 하양 (하이라이트, 글자)
  yellow: "#F2C14E",     // 노랑 (총알, 강조)
  red: "#D9482B",        // 빨강 (적)
  green: "#6FB04A",      // 초록 (플레이어)
  brown: "#C98A4B",      // 갈색 (보조: 총구, 패널, 돌격형)
  purple: "#8A63B8",     // 보라 (사인파형)
  orange: "#E8913A",     // 주황 (분열형)
  gray: "#A39D92",       // 회색 (코인이 모자라 살 수 없는 버튼)
};

// 도형 외곽선 두께 (px). 이 숫자 하나로 모든 도형의 외곽선이 바뀐다.
const OUTLINE_WIDTH = 4;

// 작은 도형(적 체력바, 파티클 등)용 외곽선 두께. 기본 두께에서 자동으로 계산된다.
const SMALL_OUTLINE_WIDTH = OUTLINE_WIDTH * 0.75;

// 글자 외곽선 두께 (px). 선의 절반은 글자 안쪽에 그려지므로 도형보다 조금 두껍게.
const TEXT_OUTLINE_WIDTH = 6;

// 글꼴: Jua → 없으면 Black Han Sans → 그것도 없으면(인터넷이 안 될 때) 기본 고딕
const FONT_FAMILY = '"Jua", "Black Han Sans", sans-serif';

// 배경 모눈 한 칸의 크기 (px)
const GRID_SIZE = 40;

// 대미지 숫자 팝업이 화면에 머무는 시간 (초)
const POPUP_LIFE = 0.8;

// 대미지 숫자의 기본 글자 크기 (px). 대미지가 클수록 이보다 커진다.
const POPUP_BASE_SIZE = 16;

// 적이 죽을 때 튀어 나가는 파티클(조각) 개수: 최소 ~ 최대 사이에서 무작위
const PARTICLE_COUNT_MIN = 6;
const PARTICLE_COUNT_MAX = 10;

// 파티클이 사라지기까지 걸리는 시간 (초)
const PARTICLE_LIFE = 0.55;

// 플레이어 최고 속도 (1초에 몇 픽셀 움직이는지)
const PLAYER_SPEED = 220;

// 플레이어 가속도 (px/초²). 1초에 속도가 얼마나 빨리 바뀌는지.
// 800 이면 멈춰 있다가 최고 속도(220)까지 약 0.28초 걸린다.
// → 속도가 0 과 최고 속도 사이를 부드럽게 오가서, "시간 지연" 증강이
//   "얼마나 빠른지"에 따라 다르게 작동하는 것을 느낄 수 있다.
const PLAYER_ACCELERATION = 800;

// 플레이어 몸의 반지름 (픽셀). 얼굴을 그리기 위해 조금 크게 잡았다.
const PLAYER_RADIUS = 18;

// 플레이어 최대 체력 (게임을 시작할 때의 값. 보급 카드 "세포 분열"로 늘어날 수 있어서
// 게임 중에는 player.maxHp 를 쓴다)
const PLAYER_MAX_HP = 100;

// 체력이 최대 체력의 이 비율보다 낮으면, 카드 3장 중 1장은 반드시 보급 카드가 나온다
const LOW_HP_RATIO = 0.4;

// 웨이브를 깨면 최대 체력의 이 비율만큼 회복 (0.1 = 10%. 최대 체력까지만)
const WAVE_CLEAR_HEAL_RATIO = 0.1;

// 보스를 잡으면 최대 체력의 이 비율만큼 회복 (0.5 = 50%)
const BOSS_KILL_HEAL_RATIO = 0.5;

// 챕터 = 웨이브 몇 개 묶음인지 (5 이면 1~5웨이브가 챕터 1)
const WAVES_PER_CHAPTER = 5;

// 일시정지에서 "계속하기"를 누른 뒤 게임이 다시 움직이기까지 기다리는 시간 (초)
const RESUME_DELAY = 0.5;

// ---- 코인 (영구 업그레이드를 사는 돈) ----
// 전투 중 1초마다 버는 코인 = COIN_PER_SECOND × (1 + COIN_WAVE_BONUS × (웨이브 − 1))
//   1웨이브 1개/초, 5웨이브 1.6개/초, 30웨이브 5.35개/초
const COIN_PER_SECOND = 1;
const COIN_WAVE_BONUS = 0.15;
// 한 웨이브에서 코인이 쌓이는 시간은 최대 60초 (적을 일부러 남겨 두고 버티는 것을 막기 위해)
const COIN_WAVE_TIME_CAP = 60;
// 보스를 잡으면 보너스 코인 = 이 값 × 챕터 번호
const BOSS_COIN_BONUS = 50;

// 맞은 뒤 잠깐 무적이 되는 시간 (초). 이 시간 동안은 또 맞지 않는다.
const PLAYER_INVINCIBLE_TIME = 1.0;

// 자동 발사 간격 (초). 0.4 이면 1초에 2.5발
const FIRE_INTERVAL = 0.4;

// 총알 속도 (px/초)
const BULLET_SPEED = 480;

// 총알 반지름 (픽셀)
const BULLET_RADIUS = 5;

// 총알 뒤에 남는 꼬리 길이 (픽셀)
const BULLET_TAIL_LENGTH = 16;

// 총알 한 발의 기본 대미지 (업그레이드 0레벨 기준. 게임 중에는 player.damage 를 쓴다)
const BULLET_DAMAGE = 10;

// ※ 적의 체력·속도·크기·접촉 대미지는 enemies.js 의 ENEMY_TYPES 에 있다.

// ※ 웨이브별 적 구성과 등장 간격은 waves.js 의 WAVES 에 있다.

// 증강 선택 화면에 보여 줄 카드 수
const CHOICE_COUNT = 3;

// 증강 카드 크기 (px)와 카드 사이 간격
const CARD_WIDTH = 250;
const CARD_HEIGHT = 330;
const CARD_GAP = 40;

// 카드가 나타난 뒤 이 시간(초) 동안은 클릭·키를 무시한다
// (전투 중 누르고 있던 키나 클릭 때문에 실수로 골라지는 것을 막기 위해)
const CHOICE_INPUT_DELAY = 0.4;

// 웨이브 시작 때 화면 위에 뜨는 안내 띠가 보이는 시간 (초)
const BANNER_TIME = 1.8;

// 가진 증강이 이 개수 이상이면 오른쪽 위 목록을 2열로 작게 그린다
const AUGMENT_LIST_COMPACT_FROM = 5;

// 화면 위쪽 보스 체력바의 폭 (왼쪽 위 패널과 오른쪽 위 증강 목록 사이에 들어가게)
const BOSS_BAR_WIDTH = 300;

// ※ 적 한 마리 처치 점수 = 종류별 score(enemies.js) × 웨이브 번호

// 점수: 클리어했을 때 남은 체력 1 당 보너스 점수
const SCORE_PER_HP_LEFT = 10;

// 메뉴 화면 버튼 목록.
// 새 메뉴를 만들 때 여기에 한 줄 추가하고, ready 를 true 로 바꾸면 된다.
//   label : 버튼 글자
//   action: 눌렀을 때 할 일의 이름 (runMenuAction 함수에서 처리)
//   ready : 지금 쓸 수 있는지 (false 면 "준비 중" 표시)
const MENU_ITEMS = [
  { label: "게임 시작", action: "start", ready: true },
  { label: "업그레이드", action: "upgrades", ready: true },
  { label: "도감", action: "collection", ready: false },
  { label: "설정", action: "settings", ready: false },
];


// =============================================================
// 2. 캔버스 준비
// =============================================================

// HTML에서 id가 "game"인 캔버스를 찾아온다
const canvas = document.getElementById("game");

// 캔버스에 그림을 그릴 수 있게 해 주는 "붓" 객체
const ctx = canvas.getContext("2d");

// ---- 화면 크게 보기 ----
// 게임 안의 좌표는 언제나 960 × 540 이다. (게임 로직과 회귀 검사는 이 좌표만 쓴다)
// 화면에 보이는 크기만 창에 맞춰 16:9 로 최대한 키우고,
// 캔버스의 실제 픽셀 수는 "보이는 크기 × devicePixelRatio" 로 맞춰서 글자와 선이 흐려지지 않게 한다.
// 그림을 그릴 때는 ctx 변환(확대)으로 960 × 540 좌표를 실제 픽셀에 맞춘다.

// 창 가장자리에 남길 여백 (px)
const SCREEN_MARGIN = 16;
// 캔버스 외곽선 두께 (style.css 의 border 와 같아야 한다)
const CANVAS_BORDER = 4;

// 게임 좌표 1 이 실제 픽셀 몇 개인지 (그릴 때 ctx 에 곱하는 확대 배율)
let renderScale = 1;

// 창 크기에 맞춰 캔버스 크기를 다시 정하는 함수
function fitCanvas() {
  // 쓸 수 있는 공간 = 창 크기 − 양쪽 여백 − 양쪽 외곽선
  const availW = document.documentElement.clientWidth - SCREEN_MARGIN * 2 - CANVAS_BORDER * 2;
  const availH = document.documentElement.clientHeight - SCREEN_MARGIN * 2 - CANVAS_BORDER * 2;
  // 16:9 를 지키면서 들어가는 가장 큰 배율 (가로·세로 중 더 빡빡한 쪽에 맞춘다)
  const scale = Math.max(0.2, Math.min(availW / CANVAS_WIDTH, availH / CANVAS_HEIGHT));
  const cssW = Math.floor(CANVAS_WIDTH * scale);
  const cssH = Math.floor(CANVAS_HEIGHT * scale);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  // 실제 픽셀 수 = 보이는 크기 × 화면 밀도 (고해상도 화면은 2 이상)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  renderScale = canvas.width / CANVAS_WIDTH;

  buildBackground(); // 배경도 새 해상도로 다시 그려 둔다
}

// 창 크기가 바뀌거나(화면 확대·축소 포함) 하면 다시 맞춘다
window.addEventListener("resize", fitCanvas);


// =============================================================
// 3. 키보드 입력
// =============================================================

// 지금 눌려 있는 키들을 기억하는 상자.
// 예: keys["KeyW"] 가 true 이면 W 키가 눌려 있다는 뜻.
const keys = {};

// 키를 누르는 순간 실행되는 함수를 등록한다
window.addEventListener("keydown", function (event) {
  // 눌린 키를 "눌림(true)"으로 기록한다
  keys[event.code] = true;

  // 디버그 모드 키 (F2 로 켜고 끈다). 처리한 키면 여기서 끝낸다
  if (handleDebugKey(event)) {
    event.preventDefault();
    return;
  }

  // 전투 중: P 나 Esc 로 일시정지 / 계속하기 (카드 선택 화면에서는 일시정지가 필요 없다)
  if (gameState === "playing" && (event.code === "KeyP" || event.code === "Escape")) {
    if (paused) resumeGame();
    else pauseGame();
    event.preventDefault();
    return;
  }

  // 메뉴 화면: ↑↓(또는 W/S)로 버튼 고르기, Enter 나 Space 로 누르기
  if (gameState === "menu") {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      // 맨 위에서 더 올라가면 맨 아래로 (나머지 연산 % 으로 빙글빙글 돌기)
      menuIndex = (menuIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      menuIndex = (menuIndex + 1) % MENU_ITEMS.length;
    } else if (event.code === "Enter" || event.code === "Space") {
      runMenuAction(menuIndex);
    }
  }

  // 게임 오버나 클리어 화면: R 키 = 바로 다시 시작, M 키 = 메뉴로, U 키 = 업그레이드
  if (gameState === "gameover" || gameState === "clear") {
    if (event.code === "KeyR") {
      resetGame();
    } else if (event.code === "KeyM") {
      goToMenu();
    } else if (event.code === "KeyU") {
      openUpgrades();
    }
  }

  // 업그레이드 화면: 1, 2 키 = 구매, Esc 나 M = 메뉴로
  if (gameState === "upgrades") {
    const keyToIndex = { Digit1: 0, Digit2: 1, Numpad1: 0, Numpad2: 1 };
    if (event.code in keyToIndex) {
      tryBuyUpgrade(keyToIndex[event.code]);
    } else if (event.code === "Escape" || event.code === "KeyM") {
      goToMenu();
    }
  }

  // 증강 선택 화면에서 1, 2, 3 키(키보드 위쪽 숫자 또는 오른쪽 숫자패드)로 카드 고르기
  if (gameState === "choosing") {
    // 키 이름과 카드 번호(0부터)를 짝지은 표
    const keyToIndex = {
      Digit1: 0, Digit2: 1, Digit3: 2,
      Numpad1: 0, Numpad2: 1, Numpad3: 2,
    };
    if (event.code in keyToIndex) {
      chooseAugment(keyToIndex[event.code]);
    }
  }

  // 방향키·스페이스를 누를 때 웹페이지가 위아래로 스크롤되는 것을 막는다
  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
});

// =============================================================
// 3-1. 디버그 모드 (개발·시험용)
// -------------------------------------------------------------
// F2       : 디버그 모드 켜기/끄기
// [ / ]    : 이전 / 다음 웨이브로 바로 이동
// Shift+1~9: AUGMENTS 배열 순서대로 증강 1개 지급 (이미 있으면 레벨업)
// Shift+0  : 체력 가득 채우기
// Shift+C  : 코인 +1000
// I        : 무적 켜기/끄기
// 디버그 모드가 꺼져 있으면 아래 기능은 전부 아무 영향이 없다.
// =============================================================

let debugMode = false;       // 디버그 모드가 켜져 있는지
let debugInvincible = false; // 디버그 무적이 켜져 있는지 (디버그 모드일 때만 효과)
let debugMessage = "";       // 화면 구석에 잠깐 보여 줄 디버그 알림
let debugMessageTimer = 0;   // 알림이 남은 시간 (초)

// 디버그 알림을 띄우는 함수
function debugSay(text) {
  debugMessage = text;
  debugMessageTimer = 2;
}

// 디버그 키를 처리하는 함수. 처리했으면 true 를 돌려준다.
function handleDebugKey(event) {
  // F2: 켜기/끄기 (언제든 가능)
  if (event.code === "F2") {
    debugMode = !debugMode;
    debugSay(debugMode ? "디버그 모드 ON" : "");
    return true;
  }
  if (!debugMode) return false; // 꺼져 있으면 아무것도 하지 않는다

  const inGame = gameState === "playing" || gameState === "choosing";

  // [ ] : 웨이브 이동
  if ((event.code === "BracketLeft" || event.code === "BracketRight") && inGame) {
    const next = wave + (event.code === "BracketRight" ? 1 : -1);
    if (next >= 1 && next <= WAVES.length) {
      enemies = [];
      bullets = [];
      startWave(next);
      debugSay("웨이브 " + next + " 로 이동");
    }
    return true;
  }

  // Shift + C : 코인 +1000 (바로 저장)
  if (event.shiftKey && event.code === "KeyC") {
    saveData.coins += 1000;
    writeSave();
    debugSay("코인 +1000 (보유 " + saveData.coins + ")");
    return true;
  }

  // Shift + 0 : 체력 가득 채우기
  if (event.shiftKey && event.code === "Digit0") {
    player.hp = player.maxHp;
    debugSay("체력 가득!");
    return true;
  }

  // Shift + 1~9 : 증강 지급 / 레벨업
  if (event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
    const index = Number(event.code.slice(5)) - 1; // "Digit3" → 2
    const aug = AUGMENTS[index];
    if (aug) {
      const level = Math.min(getAugmentLevel(aug.id) + 1, aug.levels.length);
      ownedAugments[aug.id] = level;
      debugSay(aug.name + " Lv." + level);
    }
    return true;
  }

  // I : 무적 토글
  if (event.code === "KeyI") {
    debugInvincible = !debugInvincible;
    debugSay("무적 " + (debugInvincible ? "ON" : "OFF"));
    return true;
  }
  return false;
}

// 브라우저 창이 포커스를 잃거나(다른 창 클릭) 탭이 가려지면 자동으로 일시정지
window.addEventListener("blur", function () {
  pauseGame();
});
document.addEventListener("visibilitychange", function () {
  if (document.hidden) pauseGame();
});

// 키에서 손을 떼는 순간 실행되는 함수를 등록한다
window.addEventListener("keyup", function (event) {
  // 뗀 키를 "안 눌림(false)"으로 기록한다
  keys[event.code] = false;
});


// =============================================================
// 3-2. 마우스 입력 (증강 카드 고르기)
// =============================================================

// 마우스 이벤트의 화면 좌표를 "게임 좌표(960 × 540)"로 바꾸는 함수
// 캔버스가 크게 또는 작게 보여도 정확한 위치를 계산한다.
function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();     // 외곽선까지 포함한 캔버스 위치
  // 외곽선 안쪽(그림 영역)의 왼쪽 위와 크기
  const left = rect.left + canvas.clientLeft;
  const top = rect.top + canvas.clientTop;
  return {
    x: (event.clientX - left) * (CANVAS_WIDTH / canvas.clientWidth),
    y: (event.clientY - top) * (CANVAS_HEIGHT / canvas.clientHeight),
  };
}

// 마우스를 움직이면: 마우스 아래에 있는 카드를 기억한다 (살짝 들어 올려 보여 주려고)
canvas.addEventListener("mousemove", function (event) {
  const pos = getMousePos(event);
  hoverIndex = gameState === "choosing" ? cardIndexAt(pos.x, pos.y) : -1;

  // 메뉴 화면에서는 마우스가 올라간 버튼을 선택 상태로
  let menuHover = -1;
  if (gameState === "menu") {
    menuHover = menuButtonAt(pos.x, pos.y);
    if (menuHover >= 0) menuIndex = menuHover;
  }

  // 업그레이드 화면·결과 화면·일시정지 버튼, 전투 중 상태창
  let otherHover = false;
  if (gameState === "playing") otherHover = paused ? pauseButtonAt(pos.x, pos.y) !== null : insideRect(pos.x, pos.y, hudPanelRect());
  if (gameState === "upgrades") otherHover = upgradeButtonAt(pos.x, pos.y) !== null;
  if (gameState === "gameover" || gameState === "clear") otherHover = resultButtonAt(pos.x, pos.y) !== null;

  // 카드나 버튼 위에서는 마우스 모양을 손가락으로
  canvas.style.cursor = (hoverIndex >= 0 || menuHover >= 0 || otherHover) ? "pointer" : "default";
});

// 마우스를 클릭하면: 클릭한 위치의 카드를 고른다
canvas.addEventListener("click", function (event) {
  const pos = getMousePos(event);

  // 전투 중
  if (gameState === "playing") {
    if (paused) {
      // 일시정지 창의 버튼
      const button = pauseButtonAt(pos.x, pos.y);
      if (button === "resume") resumeGame();
      else if (button === "restart") { commitRunProgress(); resetGame(); }
      else if (button === "lobby") { commitRunProgress(); goToMenu(); }
    } else if (insideRect(pos.x, pos.y, hudPanelRect())) {
      // 왼쪽 위 상태창을 누르면 일시정지
      pauseGame();
    }
    return;
  }

  // 메뉴 화면: 클릭한 버튼 실행
  if (gameState === "menu") {
    const index = menuButtonAt(pos.x, pos.y);
    if (index >= 0) runMenuAction(index);
    return;
  }

  // 증강 선택 화면: 클릭한 카드 고르기
  if (gameState === "choosing") {
    const index = cardIndexAt(pos.x, pos.y);
    if (index >= 0) chooseAugment(index);
    return;
  }

  // 업그레이드 화면: 구매 버튼, 메뉴 버튼, 저장 초기화 버튼
  if (gameState === "upgrades") {
    const button = upgradeButtonAt(pos.x, pos.y);
    if (button === null) return;
    if (button.kind === "buy") tryBuyUpgrade(button.index);
    else if (button.kind === "back") goToMenu();
    else if (button.kind === "reset") pressResetSave();
    return;
  }

  // 결과 화면: 다시 시작 / 업그레이드 / 메뉴 버튼
  if (gameState === "gameover" || gameState === "clear") {
    const button = resultButtonAt(pos.x, pos.y);
    if (button === "retry") resetGame();
    else if (button === "upgrades") openUpgrades();
    else if (button === "menu") goToMenu();
  }
});


// =============================================================
// 4. 게임에 등장하는 것들
// =============================================================

// 플레이어 정보를 담는 객체
const player = {
  x: CANVAS_WIDTH / 2,   // 가로 위치 (처음엔 화면 가운데)
  y: CANVAS_HEIGHT / 2,  // 세로 위치 (처음엔 화면 가운데)
  vx: 0,                 // 가로 속도 (px/초). 나중에 시간 지연 증강이 사용한다
  vy: 0,                 // 세로 속도 (px/초)
  fireTimer: 0,          // 다음 발사까지 남은 시간 (초). 0 이하가 되면 발사
  hp: PLAYER_MAX_HP,     // 현재 체력
  maxHp: PLAYER_MAX_HP,  // 최대 체력 (체력 업그레이드, 세포 분열 보급 카드로 늘어난다)
  damage: BULLET_DAMAGE, // 총알 한 발의 기본 대미지 (공격력 업그레이드로 늘어난다)
  invincibleTimer: 0,    // 남은 무적 시간 (초). 0보다 크면 맞지 않는다
  facing: 0,             // 바라보는 방향 (각도, 라디안). 0 = 오른쪽. 총구와 눈이 이쪽을 향한다
};

// 지금 화면에 있는 적들의 목록 (배열)
let enemies = [];

// 지금 날아가고 있는 총알들의 목록 (배열)
let bullets = [];

// 떠오르는 대미지 숫자들의 목록 (배열)
let popups = [];

// 복리 탄환용 기록: 마지막으로 맞힌 적과, 그 적을 연속으로 맞힌 횟수 n
let lastHitEnemy = null;
let hitStreak = 0;

// 튀어 나가는 파티클(조각)들의 목록 (배열)
let particles = [];

// 다음 적이 나타날 때까지 남은 시간 (초)
let spawnTimer = 0;

// 게임 상태: 지금 어떤 화면인지 기억하는 변수
//   "menu"      : 처음 메뉴 화면
//   "upgrades"  : 영구 업그레이드 화면
//   "playing"   : 전투 중
//   "choosing"  : 웨이브 사이, 증강 카드를 고르는 중
//   "gameover"  : 체력이 0이 되어 게임 오버
//   "clear"     : 마지막 웨이브까지 모두 통과
let gameState = "menu";

// 메뉴에서 지금 선택된 버튼 번호 (0 = 맨 위)
let menuIndex = 0;

// 메뉴 화면이 열린 뒤 흐른 시간 (초). 장식 캐릭터가 둥실거리는 애니메이션에 사용
let menuTime = 0;

// 메뉴 아래쪽에 잠깐 뜨는 알림 글자와 남은 시간 (예: "준비 중이에요!")
let menuToast = "";
let menuToastTimer = 0;

// 이번 판의 코인을 이미 저장했는지 (두 번 저장하지 않으려고)
let runCommitted = false;

// 일시정지 중인지, 그리고 "계속하기" 뒤 다시 움직이기까지 남은 시간 (초)
let paused = false;
let resumeTimer = 0;

// 이번 판에 잡은 보스 수
let bossesKilled = 0;

// 코인: 이번 판에 번 코인(소수까지), 전투한 시간, 이번 웨이브에서 코인이 쌓인 시간
let runCoins = 0;
let runTime = 0;
let waveCoinTime = 0;
// 판이 끝날 때 실제로 저장한 코인 수 (결과 화면에 보여 줌)
let lastRunCoins = 0;

// 점수와 최고 점수
let score = 0;
let bestScore = loadBestScore();
let isNewBest = false; // 이번 판에 최고 점수를 새로 세웠는지

// 현재 웨이브 번호 (1부터 시작)
let wave = 1;

// 이번 웨이브에서 아직 나오지 않은 적들의 줄(대기열). 앞에서부터 하나씩 나온다.
// 예: ["basic", "basic", "basic"] → 기본 적 3마리가 남아 있음
let spawnQueue = [];

// 아직 나오지 않은 보스들의 목록과, 보스가 나올 때까지 남은 시간 (초)
let bossQueue = [];
let bossTimer = 0;

// 지금 웨이브에서 졸개가 나오는 간격 (보통 WAVE_SPAWN_INTERVAL, 보스 웨이브는 BOSS_MINION_INTERVAL)
let currentSpawnInterval = WAVE_SPAWN_INTERVAL;

// 안내 띠가 보스 안내인지 (보스 안내면 띠 색이 빨강)
let bannerIsBoss = false;

// 플레이어가 가진 증강과 레벨을 기억하는 상자
// 예: { compound: 2, variance: 1 } → 복리 탄환 Lv.2, 분산 증폭 Lv.1
let ownedAugments = {};

// 지금 선택 화면에 나와 있는 카드(증강 객체)들의 목록
let choices = [];

// 마우스가 올라가 있는 카드 번호 (없으면 -1)
let hoverIndex = -1;

// 선택 화면이 열린 뒤 흐른 시간 (초). 카드 등장 애니메이션과 입력 지연에 사용
let choosingTime = 0;

// 웨이브 시작 안내 띠: 보여 줄 글자와 남은 시간
let bannerText = "";
let bannerSubText = "";
let bannerTimer = 0;


// =============================================================
// 5. 보조 함수
// =============================================================

// 값을 최소~최대 범위 안에 가둬 주는 함수
// 예: clamp(1000, 0, 960) → 960 (화면 밖으로 못 나가게 할 때 사용)
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 두 점 (x1, y1), (x2, y2) 사이의 거리 (피타고라스 정리)
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1; // 가로 차이
  const dy = y2 - y1; // 세로 차이
  return Math.sqrt(dx * dx + dy * dy);
}

// 두 원이 겹치는지 검사하는 함수
// 중심 사이 거리가 두 반지름의 합보다 작으면 겹친(부딪친) 것이다.
function circlesOverlap(x1, y1, r1, x2, y2, r2) {
  return distance(x1, y1, x2, y2) < r1 + r2;
}


// =============================================================
// 6. 업데이트 (값 바꾸기)
// =============================================================

// 플레이어 이동을 처리하는 함수. dt = 지난 프레임 이후 흐른 시간(초)
function updatePlayer(dt) {
  // 이번 프레임에 어느 방향으로 갈지 (-1, 0, 1)
  let dirX = 0;
  let dirY = 0;

  // 왼쪽(A 또는 ←)이 눌렸으면 x 방향을 -1
  if (keys["KeyA"] || keys["ArrowLeft"]) dirX -= 1;
  // 오른쪽(D 또는 →)이 눌렸으면 x 방향을 +1
  if (keys["KeyD"] || keys["ArrowRight"]) dirX += 1;
  // 위(W 또는 ↑)가 눌렸으면 y 방향을 -1 (캔버스는 위쪽이 y=0)
  if (keys["KeyW"] || keys["ArrowUp"]) dirY -= 1;
  // 아래(S 또는 ↓)가 눌렸으면 y 방향을 +1
  if (keys["KeyS"] || keys["ArrowDown"]) dirY += 1;

  // 방향 화살표의 길이 (피타고라스 정리: √(x² + y²))
  const length = Math.sqrt(dirX * dirX + dirY * dirY);

  // 대각선으로 갈 때 길이가 √2(약 1.41)가 되어 더 빨라지는 문제를 막는다.
  // 길이로 나눠 주면(정규화) 어느 방향이든 길이가 1이 된다.
  if (length > 0) {
    dirX = dirX / length;
    dirY = dirY / length;
  }

  // 가고 싶은 속도(목표 속도) = 방향 × 최고 속도
  const targetVx = dirX * PLAYER_SPEED;
  const targetVy = dirY * PLAYER_SPEED;

  // 지금 속도를 목표 속도 쪽으로 "이번 프레임에 바꿀 수 있는 만큼"만 바꾼다 (가속)
  // 예: 가속도 800, dt 0.016초 → 이번 프레임에는 최대 12.8 만큼만 변한다
  const maxChange = PLAYER_ACCELERATION * dt;
  player.vx += clamp(targetVx - player.vx, -maxChange, maxChange);
  player.vy += clamp(targetVy - player.vy, -maxChange, maxChange);

  // 방향을 바꾸는 도중에 최고 속도를 넘지 않도록 속력을 제한한다
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (speed > PLAYER_SPEED) {
    player.vx = (player.vx / speed) * PLAYER_SPEED;
    player.vy = (player.vy / speed) * PLAYER_SPEED;
  }

  // 위치 = 위치 + 속도 × 시간
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // 화면 밖으로 나가지 않게 가둔다 (몸의 반지름만큼 안쪽까지만 허용)
  const clampedX = clamp(player.x, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
  const clampedY = clamp(player.y, PLAYER_RADIUS, CANVAS_HEIGHT - PLAYER_RADIUS);

  // 벽에 막혔으면 그 방향 속도는 0 (벽을 밀고 있는 건 "움직이는 것"이 아니다)
  if (clampedX !== player.x) player.vx = 0;
  if (clampedY !== player.y) player.vy = 0;
  player.x = clampedX;
  player.y = clampedY;
}

// 화면 가장자리(위·아래·왼쪽·오른쪽 중 하나)에 typeId 종류의 적 하나를 만든다
function spawnEnemy(typeId) {
  const r = ENEMY_TYPES[typeId].radius; // 이 종류의 몸 반지름

  // 0, 1, 2, 3 중 하나를 무작위로 뽑아 어느 변에서 나올지 정한다
  const side = Math.floor(Math.random() * 4);

  // 적이 나타날 위치
  let x = 0;
  let y = 0;

  // 화면 바로 바깥(반지름만큼 밖)에서 나타나게 한다
  if (side === 0) {          // 0: 위쪽 변
    x = Math.random() * CANVAS_WIDTH;
    y = -r;
  } else if (side === 1) {   // 1: 아래쪽 변
    x = Math.random() * CANVAS_WIDTH;
    y = CANVAS_HEIGHT + r;
  } else if (side === 2) {   // 2: 왼쪽 변
    x = -r;
    y = Math.random() * CANVAS_HEIGHT;
  } else {                   // 3: 오른쪽 변
    x = CANVAS_WIDTH + r;
    y = Math.random() * CANVAS_HEIGHT;
  }

  // 적 객체를 만들어(enemies.js 의 createEnemy) 목록에 추가한다
  enemies.push(createEnemy(typeId, x, y, wave));
}

// 웨이브 동안 대기열의 적을 하나씩 만드는 함수
function updateSpawning(dt) {
  // 보스가 기다리고 있으면: 시간이 되면 화면 위쪽에서 한꺼번에 등장
  if (bossQueue.length > 0) {
    bossTimer -= dt;
    if (bossTimer <= 0) {
      // 보스가 여러 마리면 화면 폭을 (마릿수 + 1) 칸으로 나눠 나란히 세운다
      for (let i = 0; i < bossQueue.length; i++) {
        const type = ENEMY_TYPES[bossQueue[i]];
        const x = (CANVAS_WIDTH * (i + 1)) / (bossQueue.length + 1);
        enemies.push(createEnemy(bossQueue[i], x, -type.radius, wave));
      }
      bossQueue = [];
    }
  }

  // 이번 웨이브의 졸개를 이미 다 만들었으면 할 일이 없다
  if (spawnQueue.length === 0) return;

  // 남은 시간을 흐른 시간만큼 줄인다
  spawnTimer -= dt;

  // 시간이 다 됐으면 대기열 맨 앞의 적을 꺼내(shift) 하나 만든다
  if (spawnTimer <= 0) {
    spawnEnemy(spawnQueue.shift());
    spawnTimer = currentSpawnInterval; // 타이머를 다시 채운다
  }
}

// n번째 웨이브를 시작하는 함수
function startWave(n) {
  wave = n;

  // 대기열 만들기: 배열은 0번 칸부터 시작하므로 n번째 웨이브는 WAVES[n - 1]
  // 묶음 { type, count } 마다 type 을 count 번 줄 세운다
  const waveDef = WAVES[n - 1];
  spawnQueue = [];
  // 이번 웨이브의 묶음을 하나씩 보는 반복문
  for (const group of waveGroups(waveDef)) {
    // 같은 종류를 count 마리만큼 줄 뒤에 붙이는 반복문
    for (let i = 0; i < group.count; i++) {
      spawnQueue.push(group.type);
    }
  }
  // mix: true 인 웨이브는 대기열을 섞어서 여러 종류가 뒤섞여 나오게 한다
  if (waveIsMixed(waveDef)) {
    shuffle(spawnQueue);
  }
  // 새 웨이브: 이 웨이브에서 코인이 쌓인 시간을 0 부터 다시 잰다
  waveCoinTime = 0;

  // 보스 웨이브인지 확인
  bossQueue = waveBosses(waveDef).slice();
  if (bossQueue.length > 0) {
    bossTimer = BOSS_SPAWN_DELAY;                              // 2초 뒤 보스 등장
    currentSpawnInterval = BOSS_MINION_INTERVAL;               // 졸개는 3초 간격
    spawnTimer = BOSS_SPAWN_DELAY + BOSS_MINION_INTERVAL;      // 첫 졸개는 보스 등장 3초 뒤
  } else {
    currentSpawnInterval = WAVE_SPAWN_INTERVAL;
    spawnTimer = 1.0;       // 1초 뒤 첫 적 등장
  }
  gameState = "playing";

  // 화면 위에 "웨이브 n" 안내 띠를 띄운다. 처음 나오는 적이 있으면 이름도 함께
  bannerText = "웨이브 " + n;
  bannerIsBoss = bossQueue.length > 0;
  if (bannerIsBoss) {
    // 보스 웨이브: "웨이브 5 · 보스: 돌진 대장!" (여러 마리면 "최종 보스: A & B!")
    const names = bossQueue.map(function (id) { return ENEMY_TYPES[id].name; });
    bannerText += (names.length > 1 ? " · 최종 보스: " : " · 보스: ") + names.join(" & ") + "!";
  } else {
    const newNames = newEnemyNames(n);
    if (newNames.length > 0) {
      bannerText += " · 새 적: " + newNames.join(", ") + "!";
    }
  }
  bannerTimer = BANNER_TIME;
}

// n번째 웨이브에서 "처음" 등장하는 적들의 이름 목록
// (1웨이브는 시작 웨이브라 알리지 않는다. 앞 웨이브들에 나온 종류는 빼고 남은 것)
function newEnemyNames(n) {
  if (n <= 1) return [];
  // 1 ~ (n-1) 웨이브에 나온 종류를 모은다
  const seen = {};
  // 앞 웨이브들을 하나씩 보는 반복문
  for (let i = 0; i < n - 1; i++) {
    for (const group of waveGroups(WAVES[i])) seen[group.type] = true;
  }
  // 이번 웨이브에서 처음 보는 종류의 이름만 고른다 (같은 종류가 두 번 들어가지 않게)
  const names = [];
  for (const group of waveGroups(WAVES[n - 1])) {
    if (!seen[group.type]) {
      seen[group.type] = true;
      names.push(ENEMY_TYPES[group.type].name);
    }
  }
  return names;
}

// ---- 증강 관련 함수 ----

// 증강의 현재 레벨을 알려 주는 함수 (안 가지고 있으면 0)
function getAugmentLevel(id) {
  return ownedAugments[id] || 0;
}

// 가지고 있는 증강마다 "할 일"을 시키는 함수
// 가진 증강 하나하나에 대해 work(증강, 지금 레벨의 수치) 를 불러 준다.
function forEachOwnedAugment(work) {
  // 모든 증강을 하나씩 보며, 가지고 있는 것만 골라 처리하는 반복문
  for (const aug of AUGMENTS) {
    const level = getAugmentLevel(aug.id);
    if (level > 0) {
      work(aug, aug.levels[level - 1]); // levels 는 0번 칸이 Lv.1
    }
  }
}

// 플레이어의 지금 속력 v (피타고라스 정리: √(vx² + vy²))
function playerSpeed() {
  return Math.sqrt(player.vx * player.vx + player.vy * player.vy);
}

// 이 적의 이번 프레임 속도 배율을 계산하는 함수 (1 = 원래 속도)
// 가진 증강 중 modifyEnemySpeed 가 있는 것들이 차례로 배율을 바꾼다.
function enemySpeedFactor(enemy, distanceToPlayer) {
  let factor = 1;
  const info = {
    enemy: enemy,
    distance: distanceToPlayer,
    playerSpeed: playerSpeed(),
    playerMaxSpeed: PLAYER_SPEED,
  };
  forEachOwnedAugment(function (aug, stats) {
    if (aug.modifyEnemySpeed) {
      factor = aug.modifyEnemySpeed(factor, stats, info);
    }
  });
  return factor;
}

// 배열의 순서를 무작위로 섞는 함수 (피셔-예이츠 셔플)
// 맨 뒤 칸부터 앞으로 오면서, 자기 앞쪽(자기 포함)의 아무 칸과 자리를 바꾼다.
function shuffle(array) {
  // i 를 맨 뒤에서 1까지 하나씩 줄여 가는 반복문
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // 0 ~ i 중 하나
    const temp = array[i];                         // 두 칸의 값을 맞바꾼다
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

// 선택 화면에 보여 줄 카드를 최대 CHOICE_COUNT 장 고르는 함수
// 이미 최대 레벨인 증강은 더 올릴 수 없으므로 후보에서 뺀다.
//
// 뽑기 규칙
//   1) 최대 레벨이 아닌 증강을 섞어서 최대 3장
//   2) 증강이 3장보다 적으면, 남는 자리를 보급 카드(SUPPLIES)로 채운다
//   3) 체력이 최대 체력의 40% 아래면, 3장 중 1장은 반드시 보급 카드
function pickChoices() {
  const candidates = AUGMENTS.filter(function (aug) {
    return getAugmentLevel(aug.id) < aug.levels.length;
  });
  // 1) 섞은 뒤 앞에서부터 CHOICE_COUNT 장만 자른다
  const picks = shuffle(candidates).slice(0, CHOICE_COUNT);

  // 2) 남는 자리를 보급 카드로 채운다 (보급 카드끼리는 겹치지 않게 섞어서)
  if (picks.length < CHOICE_COUNT && SUPPLIES.length > 0) {
    const supplies = shuffle(SUPPLIES.slice());
    // 자리가 남아 있는 동안 보급 카드를 하나씩 넣는 반복문
    for (const supply of supplies) {
      if (picks.length >= CHOICE_COUNT) break;
      picks.push(supply);
    }
  }

  // 3) 체력이 낮은데 보급 카드가 하나도 없으면, 마지막 카드를 보급 카드로 바꾼다
  const lowHp = player.hp < player.maxHp * LOW_HP_RATIO;
  const hasSupply = picks.some(function (card) { return card.isSupply; });
  if (lowHp && !hasSupply && SUPPLIES.length > 0) {
    const supply = SUPPLIES[Math.floor(Math.random() * SUPPLIES.length)];
    if (picks.length < CHOICE_COUNT) picks.push(supply);
    else picks[picks.length - 1] = supply;
  }
  return picks;
}

// 웨이브를 깼을 때 회복하는 양 (함수로 둔 이유: 나중에 증강이나 난이도로 바꾸기 쉽게)
function waveClearHeal() {
  return player.maxHp * WAVE_CLEAR_HEAL_RATIO;
}

// 지금 웨이브가 몇 번째 챕터인지 (1~5 → 1, 6~10 → 2 ...)
function chapterOf(w) {
  return Math.ceil(w / WAVES_PER_CHAPTER);
}

// 플레이어 체력을 amount 만큼 회복하는 함수 (최대 체력을 넘지 않게)
// (회복은 체력을 절대 깎지 않는다: 이미 최대보다 많으면 그대로 둔다)
function healPlayer(amount) {
  player.hp = Math.max(player.hp, Math.min(player.maxHp, player.hp + amount));
}

// 증강 선택 화면을 여는 함수
function openChoiceScreen() {
  choices = pickChoices();

  // 고를 수 있는 증강이 하나도 없으면(모두 최대 레벨) 바로 다음 웨이브로
  if (choices.length === 0) {
    startWave(wave + 1);
    return;
  }

  gameState = "choosing";
  choosingTime = 0;
  hoverIndex = -1;
}

// index 번째 카드를 골랐을 때 실행되는 함수
function chooseAugment(index) {
  // 카드가 막 나타난 직후의 입력은 무시한다 (실수 방지)
  if (choosingTime < CHOICE_INPUT_DELAY) return;
  // 없는 번호면 무시 (예: 카드가 2장뿐인데 3번 키를 누른 경우)
  if (index < 0 || index >= choices.length) return;

  const aug = choices[index];
  canvas.style.cursor = "default";

  // 보급 카드: 레벨 없이 바로 효과만 쓰고 끝 (몇 번이든 고를 수 있다)
  if (aug.isSupply) {
    aug.apply();
    startWave(wave + 1);
    bannerSubText = aug.name + ": " + aug.formula;
    return;
  }

  const newLevel = getAugmentLevel(aug.id) + 1;
  ownedAugments[aug.id] = newLevel; // 레벨 기록 (처음이면 1, 또 고르면 2 ...)

  // 다음 웨이브 시작 + 안내 띠에 무엇을 얻었는지 함께 보여 준다
  startWave(wave + 1);
  bannerSubText = aug.name + " Lv." + newLevel + (newLevel > 1 ? " 레벨업!" : " 획득!");
}

// 카드 i 의 화면 위치(왼쪽 위 x, y)를 계산하는 함수
// 카드 수가 몇 장이든 화면 가운데에 나란히 놓이도록 한다.
function cardPosition(i) {
  const total = choices.length * CARD_WIDTH + (choices.length - 1) * CARD_GAP; // 전체 폭
  const startX = (CANVAS_WIDTH - total) / 2;                                   // 첫 카드 왼쪽 끝
  return {
    x: startX + i * (CARD_WIDTH + CARD_GAP),
    y: CANVAS_HEIGHT / 2 - CARD_HEIGHT / 2 + 30, // 위쪽 제목 자리만큼 조금 아래로
  };
}

// 캔버스 좌표 (x, y)가 몇 번째 카드 위에 있는지 알려 주는 함수 (없으면 -1)
function cardIndexAt(x, y) {
  // 카드를 하나씩 보며 사각형 안에 점이 들어 있는지 검사하는 반복문
  for (let i = 0; i < choices.length; i++) {
    const pos = cardPosition(i);
    if (x >= pos.x && x <= pos.x + CARD_WIDTH &&
        y >= pos.y && y <= pos.y + CARD_HEIGHT) {
      return i;
    }
  }
  return -1;
}

// ---- 최고 점수 저장/불러오기 ----
// 브라우저의 localStorage 에 저장하면, 창을 닫았다 열어도 최고 점수가 남는다.
// (개인 정보 보호 모드 등에서는 저장이 막힐 수 있어서 try/catch 로 감싼다)
function loadBestScore() {
  try {
    return Number(localStorage.getItem("augmentShooterBest")) || 0;
  } catch (e) {
    return 0; // 불러오기에 실패하면 0점부터
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("augmentShooterBest", String(value));
  } catch (e) {
    // 저장이 막혀 있으면 그냥 넘어간다 (게임은 그대로 할 수 있다)
  }
}

// 게임이 끝났을 때(게임 오버 또는 클리어) 부르는 함수
function endGame(result) {
  // 클리어했으면 남은 체력만큼 보너스 점수
  if (result === "clear") {
    score += player.hp * SCORE_PER_HP_LEFT;
  }
  // 최고 점수를 넘었으면 새 기록으로 저장
  isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    saveBestScore(bestScore);
  }

  // 이번 판에 번 코인(정수로 내림)과 최고 도달 웨이브를 영구 저장
  commitRunProgress();

  paused = false;
  resumeTimer = 0;
  gameState = result;
}

// 이번 판에 번 코인과 최고 웨이브를 저장한다
// (판이 끝날 때, 그리고 일시정지 창에서 "다시 시작"·"로비로"로 판을 그만둘 때)
// 같은 판의 코인이 두 번 저장되지 않도록 runCommitted 표시를 남긴다.
function commitRunProgress() {
  if (runCommitted) return;
  runCommitted = true;
  lastRunCoins = Math.floor(runCoins);
  saveData.coins += lastRunCoins;
  saveData.bestWave = Math.max(saveData.bestWave, wave);
  writeSave();
}

// ---- 일시정지 ----

// 일시정지하기 (전투 중일 때만. 카드 선택·메뉴·결과 화면에서는 아무 일도 없다)
function pauseGame() {
  if (gameState !== "playing" || paused) return;
  paused = true;
  resumeTimer = 0;
  // 누르고 있던 키를 모두 뗀 것으로 (창이 포커스를 잃으면 "뗀" 소식이 안 올 수 있어서)
  for (const k in keys) keys[k] = false;
}

// 계속하기: 바로 움직이지 않고 RESUME_DELAY(0.5초) 뒤에 움직인다
function resumeGame() {
  if (!paused) return;
  paused = false;
  resumeTimer = RESUME_DELAY;
}

// 지금 웨이브에서 1초에 버는 코인
function coinRate(w) {
  return COIN_PER_SECOND * (1 + COIN_WAVE_BONUS * (w - 1));
}

// 전투 중에만 불린다: 생존 시간과 코인을 쌓는다
function updateCoins(dt) {
  runTime += dt;
  // 이 웨이브에서 코인이 쌓일 수 있는 남은 시간만큼만 센다 (최대 60초)
  const t = Math.min(dt, Math.max(0, COIN_WAVE_TIME_CAP - waveCoinTime));
  runCoins += t * coinRate(wave);
  waveCoinTime += t;
}

// 초를 "분:초" 글자로 바꾸는 함수 (예: 125 → "2:05")
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s; // 10초 미만이면 앞에 0 을 붙인다
}

// ---- 메뉴 ----

// 메뉴 화면으로 가는 함수 (처음 켰을 때, 결과 화면에서 M 키)
function goToMenu() {
  gameState = "menu";
  paused = false;
  resumeTimer = 0;
  menuIndex = 0;
  menuTime = 0;
  menuToast = "";
  enemies = [];
  bullets = [];
  popups = [];
  particles = [];
}

// index 번째 메뉴 버튼을 눌렀을 때 할 일
function runMenuAction(index) {
  const item = MENU_ITEMS[index];

  // 아직 만들지 않은 메뉴는 알림만 띄운다
  if (!item.ready) {
    menuToast = item.label + "은(는) 곧 추가될 예정이에요!";
    menuToastTimer = 1.6;
    return;
  }

  // action 이름에 따라 할 일을 나눈다 (새 메뉴를 만들면 여기에 추가)
  if (item.action === "start") {
    canvas.style.cursor = "default";
    resetGame();
  } else if (item.action === "upgrades") {
    openUpgrades();
  }
}

// 메뉴 버튼 i 의 위치와 크기
const MENU_BUTTON_WIDTH = 260;
const MENU_BUTTON_HEIGHT = 48;
const MENU_BUTTON_GAP = 12;
function menuButtonRect(i) {
  return {
    x: CANVAS_WIDTH / 2 - MENU_BUTTON_WIDTH / 2,
    y: 214 + i * (MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP),
    w: MENU_BUTTON_WIDTH,
    h: MENU_BUTTON_HEIGHT,
  };
}

// 캔버스 좌표 (x, y) 가 몇 번째 메뉴 버튼 위에 있는지 (없으면 -1)
function menuButtonAt(x, y) {
  // 버튼을 하나씩 보며 사각형 안에 점이 있는지 검사하는 반복문
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const r = menuButtonRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return i;
    }
  }
  return -1;
}

// 웨이브가 끝났는지 검사하는 함수
// 끝나는 조건: 보스·졸개 대기열이 비었고(0), 화면에 남은 적(보스 포함)도 없다(0)
function checkWaveEnd() {
  if (bossQueue.length > 0 || spawnQueue.length > 0 || enemies.length > 0) return;

  // 웨이브를 깼다! 체력을 조금 회복
  healPlayer(waveClearHeal());

  if (wave >= WAVES.length) {
    // 마지막 웨이브였으면 클리어!
    endGame("clear");
  } else {
    // 아니면 증강 선택 화면으로
    openChoiceScreen();
  }
}

// 적이 플레이어에게 닿았는지 검사하고, 닿았으면 체력을 깎는 함수
function updatePlayerHit(dt) {
  // 무적 시간을 줄인다
  player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);

  // 무적이면 맞지 않으니 검사할 필요가 없다
  if (player.invincibleTimer > 0) return;

  // 디버그 무적 (디버그 모드가 켜져 있을 때만)
  if (debugMode && debugInvincible) return;

  // 모든 적을 하나씩 보면서 플레이어와 겹치는지 검사하는 반복문
  for (const enemy of enemies) {
    if (circlesOverlap(player.x, player.y, PLAYER_RADIUS,
                       enemy.x, enemy.y, enemy.radius)) {
      player.hp -= enemy.contactDamage;                // 체력 감소 (종류·웨이브마다 다름)
      player.invincibleTimer = PLAYER_INVINCIBLE_TIME; // 잠깐 무적

      // 체력이 0 이하면 게임 오버
      if (player.hp <= 0) {
        player.hp = 0;
        endGame("gameover");
      }
      break; // 한 프레임에 한 번만 맞는다
    }
  }
}

// 게임을 처음 상태로 되돌리는 함수 (R 키로 다시 시작할 때 사용)
function resetGame() {
  // 플레이어를 가운데로, 체력은 가득, 타이머는 0으로
  player.x = CANVAS_WIDTH / 2;
  player.y = CANVAS_HEIGHT / 2;
  player.vx = 0;
  player.vy = 0;
  player.maxHp = PLAYER_MAX_HP;
  player.damage = BULLET_DAMAGE;
  applyUpgrades();            // 영구 업그레이드 적용 (최대 체력, 공격력)
  player.hp = player.maxHp;
  player.fireTimer = 0;
  player.invincibleTimer = 0;
  player.facing = 0;

  // 적과 총알을 모두 지운다
  enemies = [];
  bullets = [];
  popups = [];
  particles = [];
  lastHitEnemy = null;
  hitStreak = 0;

  // 일시정지 풀기, 이번 판 코인은 아직 저장 전
  paused = false;
  resumeTimer = 0;
  runCommitted = false;

  // 점수는 0점부터, 잡은 보스도 0, 이번 판 코인과 시간도 0
  score = 0;
  bossesKilled = 0;
  runCoins = 0;
  runTime = 0;
  waveCoinTime = 0;
  lastRunCoins = 0;
  isNewBest = false;

  // 보스 대기열도 비운다
  bossQueue = [];
  spawnQueue = [];

  // 가진 증강도 모두 없애고, 증강들이 세던 숫자(발사 번호 등)도 처음으로
  ownedAugments = {};
  // 모든 증강을 하나씩 보며 reset 함수가 있으면 부르는 반복문
  for (const aug of AUGMENTS) {
    if (aug.reset) aug.reset();
  }
  choices = [];
  bannerSubText = "";

  // 1웨이브부터 다시
  startWave(1);
}

// 모든 적을 움직이는 함수 (어떻게 움직일지는 종류별 update 함수가 정한다)
function updateEnemies(dt) {
  // 적 목록을 처음부터 끝까지 하나씩 꺼내서 처리하는 반복문
  for (const enemy of enemies) {
    // 이 적과 플레이어 사이 거리
    const dist = distance(enemy.x, enemy.y, player.x, player.y);

    // 증강(시간 지연 등)이 정한 속도 배율. 그림 그릴 때도 쓰려고 적에 기록해 둔다
    enemy.slowFactor = enemySpeedFactor(enemy, dist);
    // 보스처럼 timeScaleMin 이 있는 적은 그보다 더 느려지지 않는다
    const timeScaleMin = enemyType(enemy).timeScaleMin;
    if (timeScaleMin !== undefined) enemy.slowFactor = Math.max(enemy.slowFactor, timeScaleMin);

    // 종류별 행동 함수(enemies.js)에게 움직임을 맡긴다
    //   speed     : 기본 속도 × 배율 (이동에 사용)
    //   timeScale : 배율 그 자체 = 이 적의 시간이 흐르는 빠르기
    //   localDt   : 이 적의 시계로 흐른 시간 (예고·돌진·흔들림 같은 행동 시간에 사용)
    enemyType(enemy).update(enemy, dt, {
      speed: enemy.speed * enemy.slowFactor,
      timeScale: enemy.slowFactor,
      localDt: dt * enemy.slowFactor,
    });

    // 넉백으로 밀리는 중이면: 밀리는 속도만큼 움직이고, 속도는 지수적으로 줄어든다
    // (이것도 이 적의 시계 localDt 로 계산 → 시간 지연을 받으면 천천히 밀린다)
    if (enemy.knockVx || enemy.knockVy) {
      const localDt = dt * enemy.slowFactor;
      // 매 순간 속도가 KNOCKBACK_DECAY 비율로 줄어든다: v(t) = v₀ · e^(−k·t)   (k = 감쇠율)
      // 이번 프레임 동안 남는 속도 비율
      const keep = Math.exp(-KNOCKBACK_DECAY * localDt);
      // 이번 프레임에 실제로 밀린 거리 = 속도를 시간으로 적분한 값 = v · (1 − e^(−k·Δt)) / k
      // (그냥 v × Δt 로 하면 줄어드는 속도를 반영 못 해서 조금 더 멀리 밀린다)
      const travel = (1 - keep) / KNOCKBACK_DECAY;
      enemy.x += enemy.knockVx * travel;
      enemy.y += enemy.knockVy * travel;
      enemy.knockVx *= keep;
      enemy.knockVy *= keep;
      // 거의 멈췄으면 0 으로 정리
      if (Math.abs(enemy.knockVx) + Math.abs(enemy.knockVy) < 1) {
        enemy.knockVx = 0;
        enemy.knockVy = 0;
      }
    }

    // 번쩍임 시간을 줄인다 (0 아래로는 안 내려가게)
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  }
}

// 플레이어에게서 가장 가까운 적을 찾아 돌려주는 함수 (없으면 null)
function findNearestEnemy() {
  let nearest = null;        // 지금까지 찾은 가장 가까운 적
  let nearestDist = Infinity; // 그 적까지의 거리 (처음엔 무한대)

  // 모든 적을 하나씩 보면서 더 가까운 적이 있으면 바꿔 기억하는 반복문
  for (const enemy of enemies) {
    const d = distance(player.x, player.y, enemy.x, enemy.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }
  return nearest;
}

// 대포(총구)와 눈이 바라볼 방향을 정하는 함수
//  - 적이 있으면: 총알이 날아갈 "가장 가까운 적"을 바라본다
//  - 적이 없으면: 움직이는 방향을 바라본다 (멈춰 있으면 마지막 방향 그대로)
function updateAim() {
  const target = findNearestEnemy();
  if (target !== null) {
    // Math.atan2(세로 차이, 가로 차이) = 플레이어에서 적을 향하는 각도
    player.facing = Math.atan2(target.y - player.y, target.x - player.x);
  } else if (player.vx !== 0 || player.vy !== 0) {
    player.facing = Math.atan2(player.vy, player.vx);
  }
}

// 일정 간격마다 가장 가까운 적을 향해 총알을 쏘는 함수
function updateShooting(dt) {
  // 발사 타이머를 줄인다
  player.fireTimer -= dt;

  // 아직 발사할 시간이 아니면 여기서 끝
  if (player.fireTimer > 0) return;

  // 조준할 적을 찾는다. 적이 없으면 쏘지 않는다.
  const target = findNearestEnemy();
  if (target === null) return;

  // 플레이어 → 적 방향을 구해서 길이 1로 맞춘다
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1; // 0으로 나누기 방지

  // 가장 가까운 적을 향해 한 발 쏜다 (이때 onFire 훅도 불린다)
  createBullet(dx / dist, dy / dist, { target: target });

  // 다음 발사까지 기다릴 시간을 다시 채운다
  player.fireTimer = fireInterval();
}

// onFire 훅을 처리하는 중인지 표시 (무한 반복을 막는 안전장치)
let insideOnFire = false;

// 총알 하나를 만들어 목록에 넣고, 만든 총알을 돌려주는 함수
// dirX, dirY: 날아갈 방향 (길이 1인 화살표)
// options (모두 생략 가능)
//   damageScale : 이 총알의 대미지 배율 (기본 1. 0.6 이면 60% 대미지)
//   fromAugment : 증강이 추가로 만든 총알이면 true → onFire 훅을 다시 부르지 않는다
//   generation  : 몇 번째 세대 총알인지 (기본 0. 핵분열처럼 총알이 총알을 낳을 때 사용)
//   target      : 조준한 적 (onFire 훅에 전달)
//   x, y        : 출발 위치 (생략하면 플레이어의 총구)
//   color       : 총알 색 (생략하면 노랑). 핵분열 파편처럼 구별하고 싶을 때
//   life        : 이 시간(초)이 지나면 사라진다 (생략하면 화면 밖으로 나갈 때까지)
// ※ 증강(3방향 탄 등)도 이 함수로 총알을 더 만들 수 있다.
//   예: createBullet(dx, dy, { damageScale: 0.6, fromAugment: true })
function createBullet(dirX, dirY, options) {
  const opt = options || {};
  // 총알이 대포 끝(총구)에서 나오도록 출발점을 몸 반지름 + 10 만큼 앞으로
  const muzzle = PLAYER_RADIUS + 10;
  const bullet = {
    x: opt.x !== undefined ? opt.x : player.x + dirX * muzzle,  // 총구 위치에서 출발
    y: opt.y !== undefined ? opt.y : player.y + dirY * muzzle,
    vx: dirX * BULLET_SPEED,      // 가로 속도
    vy: dirY * BULLET_SPEED,      // 세로 속도
    age: 0,                       // 날아간 시간 (초). 푸리에 탄환 같은 증강이 사용
    damageScale: opt.damageScale !== undefined ? opt.damageScale : 1,
    fromAugment: opt.fromAugment === true,
    generation: opt.generation || 0,
    color: opt.color,             // 없으면 노랑으로 그린다
    life: opt.life,               // 없으면 시간 제한 없음
    dead: false,                  // 맞았거나 화면 밖이면 true
  };
  bullets.push(bullet);

  // [훅] onFire: 플레이어가 직접 쏜 총알일 때만 증강에게 알린다 (3방향 탄, 반동 등)
  // 증강이 만든 총알(fromAugment)이거나, 이미 onFire 처리 중에 만들어진 총알이면
  // 다시 부르지 않는다. → "총알이 총알을 부르는" 무한 반복을 막는다.
  if (!bullet.fromAugment && !insideOnFire) {
    const fireInfo = {
      bullet: bullet,       // 방금 쏜 총알
      dirX: dirX,           // 쏜 방향 (길이 1)
      dirY: dirY,
      target: opt.target,   // 조준한 적
      player: player,
    };
    insideOnFire = true;
    forEachOwnedAugment(function (aug, stats) {
      if (aug.onFire) aug.onFire(stats, fireInfo);
    });
    insideOnFire = false;
  }
  return bullet;
}

// 지금 발사 간격(초)을 계산하는 함수
// 기본 간격에서 시작해서, 가진 증강 중 modifyFireInterval 이 있는 것들이 차례로 바꾼다.
function fireInterval() {
  let interval = FIRE_INTERVAL;
  forEachOwnedAugment(function (aug, stats) {
    if (aug.modifyFireInterval) interval = aug.modifyFireInterval(interval, stats);
  });
  return interval;
}

// 총알 한 발이 적에게 줄 대미지를 계산하는 함수
// 기본 대미지에서 시작해서, 가진 증강 중 modifyDamage 가 있는 것들이 차례로 바꾼다.
function calcDamage(enemy, bullet) {
  // 복리 탄환용 연속 명중 횟수 n 계산
  //   같은 적을 또 맞혔으면 n + 1, 다른 적이면 n = 0 부터 다시
  if (enemy === lastHitEnemy) {
    hitStreak += 1;
  } else {
    hitStreak = 0;
    lastHitEnemy = enemy;
  }

  // 기본 대미지 × 이 총알의 대미지 배율 (보통 1)
  let damage = player.damage * (bullet ? bullet.damageScale : 1);
  const info = { enemy: enemy, bullet: bullet, streak: hitStreak };

  // 대미지를 바꾸는 증강들을 order 가 작은 것부터 차례로 부른다
  // (order 를 안 적으면 0. 덧셈(등차)은 먼저, 곱셈(복리·분산)은 중간, 제곱 증폭은 맨 마지막)
  const list = [];
  forEachOwnedAugment(function (aug, stats) {
    if (aug.modifyDamage) list.push({ aug: aug, stats: stats });
  });
  list.sort(function (a, b) { return (a.aug.order || 0) - (b.aug.order || 0); }); // 같은 order 면 배열 순서 유지
  // 정렬된 순서대로 대미지를 바꾸는 반복문
  for (const item of list) {
    damage = item.aug.modifyDamage(damage, item.stats, info);
  }
  return damage;
}

// 대미지 숫자 팝업 하나를 만드는 함수
function spawnPopup(x, y, damage) {
  popups.push({
    x: x + (Math.random() - 0.5) * 14, // 숫자끼리 겹치지 않게 좌우로 살짝 흩뿌린다
    y: y,
    value: Math.round(damage),         // 화면에는 정수로 보여 준다
    age: 0,                            // 태어난 뒤 흐른 시간 (초)
  });
}

// 팝업을 위로 떠오르게 하고, 수명이 다하면 지우는 함수
function updatePopups(dt) {
  // 팝업 목록을 하나씩 처리하는 반복문
  for (const popup of popups) {
    popup.age += dt;
    // 처음 0.15초(튀어 오르는 동안)는 제자리, 그 뒤로는 1초에 50px씩 위로
    if (popup.age > 0.15) {
      popup.y -= 50 * dt;
    }
  }
  // 수명이 남은 것만 남긴다
  popups = popups.filter(function (p) { return p.age < POPUP_LIFE; });
}

// (x, y) 위치에서 파티클 여러 개를 사방으로 터뜨리는 함수
// mainColor: 조각의 주된 색 (생략하면 빨강). 죽은 적의 몸 색을 넣는다
function spawnParticles(x, y, mainColor) {
  // 최소~최대 사이의 정수 개수를 무작위로 정한다
  const count = PARTICLE_COUNT_MIN +
    Math.floor(Math.random() * (PARTICLE_COUNT_MAX - PARTICLE_COUNT_MIN + 1));

  // 파티클이 가질 수 있는 색과 모양 (팔레트 안에서만)
  const main = mainColor || COLORS.red;
  const colors = [main, main, COLORS.yellow, COLORS.brown];
  const shapes = ["circle", "square", "triangle"];

  // count 개의 파티클을 만드는 반복문
  for (let i = 0; i < count; i++) {
    // 원을 count 등분한 방향 + 약간의 흔들림 → 고르게 사방으로 퍼진다
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 120 + Math.random() * 160;  // 120 ~ 280 px/초
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,                // 가로 속도
      vy: Math.sin(angle) * speed,                // 세로 속도
      size: 7 + Math.random() * 4,                // 처음 크기 (반지름) 7 ~ 11
      rotation: Math.random() * Math.PI * 2,      // 처음 회전 각도
      spin: (Math.random() - 0.5) * 12,           // 1초에 도는 각도
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      age: 0,                                     // 태어난 뒤 흐른 시간
    });
  }
}

// 파티클을 움직이고, 수명이 다하면 지우는 함수
function updateParticles(dt) {
  // 파티클 목록을 하나씩 처리하는 반복문
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // 공기 저항처럼 매 프레임 속도를 조금씩 줄인다 (1초에 약 5%만 남음)
    p.vx *= Math.pow(0.05, dt);
    p.vy *= Math.pow(0.05, dt);
    p.rotation += p.spin * dt;
  }
  particles = particles.filter(function (p) { return p.age < PARTICLE_LIFE; });
}

// 총알을 움직이고, 적과 부딪쳤는지 검사하는 함수
function updateBullets(dt) {
  // 모든 총알을 하나씩 처리하는 반복문
  for (const bullet of bullets) {
    // [훅] onBulletUpdate: 움직이기 직전에 증강이 총알을 바꿀 기회를 준다
    //      (유도탄은 vx·vy 방향을 틀고, 푸리에 탄환은 출렁이게 만든다)
    bullet.age += dt;
    forEachOwnedAugment(function (aug, stats) {
      if (aug.onBulletUpdate) aug.onBulletUpdate(bullet, stats, dt);
    });

    // 수명이 정해진 총알(핵분열 파편 등)은 시간이 다 되면 사라진다
    if (bullet.life !== undefined && bullet.age > bullet.life) {
      bullet.dead = true;
      continue;
    }

    // 위치 = 위치 + 속도 × 시간
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    // 화면 밖으로 나가면 지울 표시를 한다
    if (bullet.x < 0 || bullet.x > CANVAS_WIDTH ||
        bullet.y < 0 || bullet.y > CANVAS_HEIGHT) {
      bullet.dead = true;
      continue; // 이 총알은 더 볼 필요 없으니 다음 총알로
    }

    // 이 총알이 어떤 적과 부딪쳤는지 모든 적을 검사하는 반복문
    for (const enemy of enemies) {
      // 이미 죽은 적은 건너뛴다
      if (enemy.dead) continue;

      if (circlesOverlap(bullet.x, bullet.y, BULLET_RADIUS,
                         enemy.x, enemy.y, enemy.radius)) {
        // 대미지를 계산해서 적 체력을 깎는다
        const damage = calcDamage(enemy, bullet);
        enemy.hp -= damage;
        spawnPopup(enemy.x, enemy.y - enemy.radius, damage); // 숫자 팝업
        enemy.hitFlash = 0.08;   // 잠깐 하얗게 번쩍
        bullet.dead = true;      // 총알은 맞으면 사라진다
        const killed = enemy.hp <= 0; // 이번 한 방으로 죽었는지

        // [훅] onHit: 대미지가 적용된 직후 증강에게 알린다 (넉백, 지속 대미지 등)
        const hitInfo = { enemy: enemy, bullet: bullet, damage: damage, killed: killed };
        forEachOwnedAugment(function (aug, stats) {
          if (aug.onHit) aug.onHit(stats, hitInfo);
        });

        // 적 종류별 "맞았을 때" 반응 (보스의 체력 단계별 패턴 변화 등). 죽었으면 부르지 않는다
        if (!killed && enemyType(enemy).onHurt) enemyType(enemy).onHurt(enemy);

        // 체력이 0 이하가 되면 적은 죽는다
        if (killed) {
          enemy.dead = true;
          enemyType(enemy).onDeath(enemy);  // 종류별 죽을 때 효과 (기본 적: 파티클)
          score += enemyType(enemy).score * wave; // 점수 획득 (종류별 점수 × 웨이브)

          // 보스를 잡으면 최대 체력의 절반을 회복하고, 잡은 보스 수를 센다
          if (enemyType(enemy).isBoss) {
            healPlayer(player.maxHp * BOSS_KILL_HEAL_RATIO);
            bossesKilled += 1;
            runCoins += BOSS_COIN_BONUS * chapterOf(wave); // 보스 보너스 코인
          }

          // [훅] onKill: 적이 죽은 순간 증강에게 알린다 (핵분열, 발열 반응 등)
          const killInfo = { enemy: enemy, x: enemy.x, y: enemy.y, bullet: bullet };
          forEachOwnedAugment(function (aug, stats) {
            if (aug.onKill) aug.onKill(stats, killInfo);
          });
        }
        break; // 총알 하나는 적 하나만 맞힌다
      }
    }
  }

  // dead 표시가 된 것들을 목록에서 걸러 낸다(지운다)
  bullets = bullets.filter(function (b) { return !b.dead; });
  enemies = enemies.filter(function (e) { return !e.dead; });
}

// 게임 전체의 값을 바꾸는 함수. 게임 상태에 따라 하는 일이 다르다.
function update(dt) {
  // 일시정지 중이거나, "계속하기" 뒤 0.5초 기다리는 중이면 게임 시간·코인·적·총알이 모두 멈춘다
  if (gameState === "playing" && (paused || resumeTimer > 0)) {
    if (!paused) resumeTimer = Math.max(0, resumeTimer - dt);
    debugMessageTimer = Math.max(0, debugMessageTimer - dt);
    return;
  }

  if (gameState === "playing") {
    // 전투 중 (순서가 중요하다)
    updatePlayer(dt);     // 1) 플레이어 이동
    updateSpawning(dt);   // 2) 적 생성
    updateEnemies(dt);    // 3) 적 이동
    updateAim();          // 4) 가장 가까운 적 쪽으로 대포 돌리기
    updateShooting(dt);   // 5) 자동 발사
    updateBullets(dt);    // 6) 총알 이동과 충돌
    updatePlayerHit(dt);  // 7) 적에게 닿았는지 검사
    updatePopups(dt);     // 8) 대미지 숫자 떠오르기
    updateParticles(dt);  // 9) 파티클 날아가기
    updateCoins(dt);      // 10) 생존 시간과 코인 (전투 중에만)

    // 게임 오버가 아니라면 웨이브가 끝났는지 검사
    if (gameState === "playing") {
      checkWaveEnd();
    }
  } else if (gameState === "menu") {
    // 메뉴: 장식 캐릭터 애니메이션용 시간만 흐른다
    menuTime += dt;
    menuToastTimer = Math.max(0, menuToastTimer - dt);
  } else if (gameState === "upgrades") {
    updateUpgradeScreen(dt);
  } else if (gameState === "choosing") {
    // 카드 고르는 중: 게임은 멈추고, 남은 숫자 팝업·파티클만 마저 움직인다
    choosingTime += dt;
    updatePopups(dt);
    updateParticles(dt);
  }

  // 안내 띠 남은 시간 줄이기 (어느 상태에서든)
  bannerTimer = Math.max(0, bannerTimer - dt);
  debugMessageTimer = Math.max(0, debugMessageTimer - dt);
  // "gameover", "clear" 상태에서는 아무것도 움직이지 않는다 (R 키를 기다림)
}


// =============================================================
// 7. 그리기 도우미 (스티커 카툰 스타일)
// -------------------------------------------------------------
// 모든 도형은 아래 함수들로 그린다. 그래서 외곽선 두께·색을
// 맨 위 상수(OUTLINE_WIDTH, COLORS.outline) 한 곳에서 바꾸면
// 게임 전체 그림이 한꺼번에 바뀐다.
// =============================================================

// 붓을 "외곽선 모드"로 준비하는 함수 (두께를 안 주면 기본 OUTLINE_WIDTH)
function setOutline(width = OUTLINE_WIDTH) {
  ctx.strokeStyle = COLORS.outline; // 외곽선 색
  ctx.lineWidth = width;            // 외곽선 두께
  ctx.lineJoin = "round";           // 선이 꺾이는 곳을 둥글게
  ctx.lineCap = "round";            // 선 끝을 둥글게
}

// 외곽선이 있는 원을 그리는 함수
// fill: 안쪽 색 (팔레트 색 중 하나) / width: 외곽선 두께 (안 주면 기본 두께)
function drawOutlinedCircle(x, y, radius, fill, width = OUTLINE_WIDTH) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2); // 0도 ~ 360도 원
  ctx.fillStyle = fill;
  ctx.fill();      // 1) 면 칠하기
  setOutline(width);
  ctx.stroke();    // 2) 외곽선 그리기
}

// 외곽선이 있는 다각형을 그리는 함수 (뿔, 가시 몸통, 세모 파티클 등)
// points: [[x1, y1], [x2, y2], ...] 처럼 꼭짓점 좌표를 모은 배열
function drawOutlinedPolygon(points, fill, width = OUTLINE_WIDTH) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);     // 첫 꼭짓점에서 시작
  // 나머지 꼭짓점을 차례로 잇는 반복문
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();                            // 마지막 점과 첫 점을 잇는다
  ctx.fillStyle = fill;
  ctx.fill();
  setOutline(width);
  ctx.stroke();
}

// 모서리가 둥근 직사각형 "모양(경로)"만 만드는 함수 (칠하지는 않음)
// x, y: 왼쪽 위 모서리 / w, h: 가로·세로 길이 / r: 모서리 둥글기
function roundRectPath(x, y, w, h, r) {
  // 둥글기가 가로·세로의 절반보다 크면 모양이 깨지므로 줄여 준다
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);                    // 위쪽 변 시작점
  ctx.arcTo(x + w, y, x + w, y + h, r);    // 오른쪽 위 모서리
  ctx.arcTo(x + w, y + h, x, y + h, r);    // 오른쪽 아래 모서리
  ctx.arcTo(x, y + h, x, y, r);            // 왼쪽 아래 모서리
  ctx.arcTo(x, y, x + w, y, r);            // 왼쪽 위 모서리
  ctx.closePath();
}

// 외곽선이 있는 둥근 직사각형을 그리는 함수
// fill 이 null 이면 외곽선만 그린다 (체력바 테두리 등에 사용)
function drawOutlinedRoundRect(x, y, w, h, r, fill, width = OUTLINE_WIDTH) {
  roundRectPath(x, y, w, h, r);
  if (fill !== null) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  setOutline(width);
  ctx.stroke();
}

// 동그란 도형 위쪽(왼쪽 위)에 하얀 하이라이트 호를 한 줄 그리는 함수
// → 납작한 단색 도형에 "반짝"하는 느낌을 준다
function drawHighlight(x, y, radius) {
  ctx.beginPath();
  // 원의 왼쪽 위 부분(약 200도 ~ 260도)만 짧게 그린다
  ctx.arc(x, y, radius * 0.62, Math.PI * 1.1, Math.PI * 1.45);
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = Math.max(2, radius * 0.18); // 도형이 클수록 굵게
  ctx.lineCap = "round";
  ctx.stroke();
}

// 하얀 글자 + 두꺼운 어두운 외곽선으로 글자를 쓰는 함수
// size: 글자 크기(px) / align: "left", "center", "right"
function drawOutlinedText(text, x, y, size, align = "center", fill = COLORS.white) {
  ctx.font = size + "px " + FONT_FAMILY;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";     // y 를 글자의 세로 가운데로
  setOutline(TEXT_OUTLINE_WIDTH);
  ctx.strokeText(text, x, y);      // 1) 외곽선을 먼저
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);        // 2) 그 위에 채우기
}


// =============================================================
// 8. 그리기 (실제 장면)
// =============================================================

// ---- 배경 ----
// 배경은 매번 똑같으므로, 처음에 한 번만 "보이지 않는 캔버스"에 그려 두고
// 매 프레임에는 그 그림을 통째로 복사해서 붙인다 (훨씬 빠르다).
const backgroundCanvas = document.createElement("canvas");

// 배경 그림을 한 번 만드는 함수: 크림색 바탕 + 연한 모눈선 + 십자 표시
function buildBackground() {
  // 보이지 않는 캔버스도 실제 캔버스와 같은 해상도로 만들고, 같은 배율로 확대해서 그린다
  backgroundCanvas.width = canvas.width;
  backgroundCanvas.height = canvas.height;
  const bg = backgroundCanvas.getContext("2d"); // 보이지 않는 캔버스의 붓
  bg.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  // 1) 크림색으로 전체 칠하기
  bg.fillStyle = COLORS.background;
  bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2) 설계도 느낌의 연한 모눈선 (투명도를 아주 낮게)
  bg.strokeStyle = COLORS.outline;
  bg.globalAlpha = 0.06;
  bg.lineWidth = 1;
  // 세로선: x 를 GRID_SIZE 씩 늘려 가며 위→아래 선을 긋는 반복문
  for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
    bg.beginPath();
    bg.moveTo(x + 0.5, 0);           // 0.5를 더하면 1px 선이 또렷해진다
    bg.lineTo(x + 0.5, CANVAS_HEIGHT);
    bg.stroke();
  }
  // 가로선: y 를 GRID_SIZE 씩 늘려 가며 왼쪽→오른쪽 선을 긋는 반복문
  for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
    bg.beginPath();
    bg.moveTo(0, y + 0.5);
    bg.lineTo(CANVAS_WIDTH, y + 0.5);
    bg.stroke();
  }

  // 3) 모눈 4칸마다 작은 "+" 표시 (지도의 좌표 표시처럼)
  bg.globalAlpha = 0.15;
  bg.lineWidth = 2;
  bg.lineCap = "round";
  // 가로·세로로 GRID_SIZE × 4 간격마다 + 를 그리는 이중 반복문
  for (let x = GRID_SIZE * 2; x < CANVAS_WIDTH; x += GRID_SIZE * 4) {
    for (let y = GRID_SIZE * 2; y < CANVAS_HEIGHT; y += GRID_SIZE * 4) {
      bg.beginPath();
      bg.moveTo(x - 5, y); bg.lineTo(x + 5, y); // 가로 막대
      bg.moveTo(x, y - 5); bg.lineTo(x, y + 5); // 세로 막대
      bg.stroke();
    }
  }
  bg.globalAlpha = 1; // 투명도를 원래대로
}
// (배경은 fitCanvas() 가 캔버스 크기를 정할 때마다 다시 만든다)

// 미리 만든 배경을 화면에 붙이는 함수
function drawBackground() {
  // 배경 그림을 게임 좌표 960 × 540 크기로 붙인다 (지금 ctx 확대 배율이 실제 픽셀에 맞춰 준다)
  ctx.drawImage(backgroundCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ---- 플레이어 ----
// 초록색 둥근 얼굴 + 눈 두 개 + 작은 입 + 가장 가까운 적을 향한 대포
function drawPlayer() {
  const r = PLAYER_RADIUS;

  ctx.save(); // 지금 붓 설정(위치, 투명도 등)을 저장해 둔다

  // 무적 시간에는 0.1초 간격으로 반투명 ↔ 불투명을 반복해 깜빡인다
  if (player.invincibleTimer > 0 && Math.floor(player.invincibleTimer * 10) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  // 붓의 기준점(0, 0)을 플레이어 위치로 옮긴다 → 아래 좌표는 모두 플레이어 기준
  ctx.translate(player.x, player.y);

  // 1) 총구: 몸 뒤에 먼저 그려서 몸이 총구 뿌리를 덮게 한다
  ctx.save();
  ctx.rotate(player.facing); // 바라보는 방향으로 붓을 돌린다
  // 돌린 상태에서 오른쪽(+x)으로 뻗은 막대 = 바라보는 방향으로 뻗은 총구
  drawOutlinedRoundRect(r * 0.3, -6, r + 10, 12, 4, COLORS.brown);
  ctx.restore(); // 회전을 되돌린다 (얼굴은 똑바로 서 있게)

  // 2) 얼굴(몸통)
  drawOutlinedCircle(0, 0, r, COLORS.green);

  // 3) 하이라이트 한 줄
  drawHighlight(0, 0, r);

  // 4) 눈과 입: 바라보는 방향으로 살짝 쏠리게 해서 "그쪽을 본다"는 느낌을 준다
  const lookX = Math.cos(player.facing) * 3; // 가로로 쏠리는 양
  const lookY = Math.sin(player.facing) * 2; // 세로로 쏠리는 양

  // 왼쪽 눈, 오른쪽 눈을 차례로 그리는 반복문 (side = -1 이면 왼쪽, 1 이면 오른쪽)
  for (const side of [-1, 1]) {
    const eyeX = side * r * 0.36 + lookX;
    const eyeY = -r * 0.15 + lookY;
    ctx.fillStyle = COLORS.outline;              // 까만 눈동자
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.white;                // 눈 속 반짝임
    ctx.beginPath();
    ctx.arc(eyeX - 1, eyeY - 1.5, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // 작은 웃는 입 (아래로 둥근 호)
  setOutline(2.5);
  ctx.beginPath();
  ctx.arc(lookX, r * 0.25 + lookY, r * 0.22, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  ctx.restore(); // 처음에 저장한 붓 설정으로 되돌린다
}

// ---- 적 ----
// 모든 적은 "종류별 몸통 + 공통 화난 얼굴" 로 그린다.
// 몸통 모양은 enemies.js 의 shape 로 정한다.
//   basic    : 빨간 원. 태어난 웨이브가 높을수록 험악해진다
//              (1웨이브 동그란 몸 / 2웨이브 뿔 2개 / 3웨이브 이상 가시 몸 + 뿔)
//   arrow    : 갈색 화살촉 (돌격형). 바라보는 방향을 뾰족한 끝이 가리킨다
//   diamond  : 보라 마름모 (사인파형). 움직이는 방향으로 살짝 기운다
//   splitter : 주황 원 + 몸 안에 비쳐 보이는 작은 원 (분열형)
function drawEnemy(enemy) {
  const type = enemyType(enemy);
  const r = enemy.radius;
  // 맞은 직후엔 하얗게 번쩍, 평소엔 종류별 색 (기본 적: 빨강)
  const bodyColor = enemy.hitFlash > 0 ? COLORS.white : COLORS[type.color];

  ctx.save();
  ctx.translate(enemy.x, enemy.y); // 아래 좌표는 모두 적의 중심 기준

  // 돌격형이 예고 중이면 부르르 떤다 (곧 돌진한다는 신호)
  if (enemy.state === "warn") {
    ctx.translate(Math.sin(enemy.stateTime * 90) * 1.8, 0);
  }

  if (type.shape === "arrow") {
    drawArrowBody(enemy, r, bodyColor);
  } else if (type.shape === "diamond") {
    drawDiamondBody(enemy, r, bodyColor);
  } else if (type.shape === "splitter") {
    drawSplitterBody(type, r, bodyColor);
  } else {
    drawBasicBody(enemy, r, bodyColor);
  }

  drawEnemyFace(enemy, r);
  if (type.crown) drawCrown(r);   // 보스는 머리에 왕관
  ctx.restore();

  // 체력바: 한 대라도 맞은 적만 머리 위에 보여 준다 (보스는 화면 위쪽 큰 체력바로 대신)
  if (enemy.hp < enemy.maxHp && !type.isBoss) {
    const barWidth = Math.max(r * 2.2, 24);
    let barTop = r * 1.3;                                              // 기본 높이
    if (type.shape === "basic") barTop = enemy.wave >= 2 ? r * 1.45 : r; // 뿔이 있으면 더 위에
    drawBar(enemy.x - barWidth / 2, enemy.y - barTop - 12, barWidth, 7,
            enemy.hp / enemy.maxHp, COLORS.green, SMALL_OUTLINE_WIDTH);
  }
}

// 기본 적 몸통: 원 (+ 웨이브에 따라 뿔, 가시)
function drawBasicBody(enemy, r, bodyColor) {
  // 1) 뿔 (2웨이브부터): 몸보다 먼저 그려서 뿌리가 몸에 가려지게 한다
  if (enemy.wave >= 2) {
    // 왼쪽 뿔, 오른쪽 뿔을 차례로 그리는 반복문 (side = -1 왼쪽, 1 오른쪽)
    for (const side of [-1, 1]) {
      drawOutlinedPolygon([
        [side * r * 0.25, -r * 0.7],   // 뿌리 안쪽
        [side * r * 0.85, -r * 0.45],  // 뿌리 바깥쪽
        [side * r * 0.75, -r * 1.45],  // 뾰족한 끝
      ], COLORS.brown);
    }
  }

  // 2) 몸통
  if (enemy.wave >= 3) {
    // 가시 몸: 바깥 점(가시 끝)과 안쪽 점을 번갈아 찍어 별 모양을 만든다
    const spikes = 10;          // 가시 개수
    const points = [];
    // 가시 개수 × 2 만큼 점을 찍는 반복문 (짝수 번째 = 가시 끝, 홀수 번째 = 골짜기)
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2; // 위쪽부터 시작
      const radius = i % 2 === 0 ? r * 1.2 : r * 0.92;
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }
    drawOutlinedPolygon(points, bodyColor);
  } else {
    drawOutlinedCircle(0, 0, r, bodyColor);
  }

  // 3) 하이라이트 한 줄
  drawHighlight(0, 0, r);
}

// 돌격형 몸통: 화살촉. 바라보는 방향(dirX, dirY)으로 돌려서 그린다
function drawArrowBody(enemy, r, bodyColor) {
  ctx.save();
  ctx.rotate(Math.atan2(enemy.dirY, enemy.dirX)); // 오른쪽(+x)이 바라보는 방향이 되게 돌린다
  drawOutlinedPolygon([
    [r * 1.75, 0],           // 뾰족한 끝
    [-r * 1.1, -r * 1.4],    // 왼쪽 날개 끝
    [-r * 0.65, 0],          // 꼬리 쪽 오목한 곳 (얕게 파서 얼굴이 들어갈 자리를 남긴다)
    [-r * 1.1, r * 1.4],     // 오른쪽 날개 끝
  ], bodyColor);
  ctx.restore();
  drawHighlight(0, 0, r * 0.9);
}

// 사인파형 몸통: 마름모. 움직이는 방향으로 조금 기운다
function drawDiamondBody(enemy, r, bodyColor) {
  ctx.save();
  ctx.rotate(Math.sin(enemy.tilt || 0) * 0.25); // 너무 많이 돌지 않게 살짝만
  drawOutlinedPolygon([
    [0, -r * 1.4],   // 위
    [r * 1.15, 0],   // 오른쪽
    [0, r * 1.4],    // 아래
    [-r * 1.15, 0],  // 왼쪽
  ], bodyColor);
  ctx.restore();
  drawHighlight(0, -r * 0.2, r * 0.8);
}

// 분열형 몸통: 큰 원 + 몸 안에 비쳐 보이는 작은 원 (나중에 갈라질 자식)
function drawSplitterBody(type, r, bodyColor) {
  drawOutlinedCircle(0, 0, r, bodyColor);
  if (type.innerCircles > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;               // 반투명 = "비쳐 보이는" 느낌
    // 작은 원의 위치 목록 (2개면 좌우, 3개면 아래쪽에 부채꼴로)
    const spots = type.innerCircles >= 3
      ? [[-0.5, 0.3, 0.26], [0, 0.55, 0.26], [0.5, 0.3, 0.26]]
      : [[-0.45, 0.38, 0.34], [0.45, 0.38, 0.34]];
    // 작은 원을 하나씩 그리는 반복문 ([가로 위치, 세로 위치, 크기] 를 몸 반지름에 곱한다)
    for (const spot of spots) {
      ctx.beginPath();
      ctx.arc(spot[0] * r, spot[1] * r, spot[2] * r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      setOutline(SMALL_OUTLINE_WIDTH * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawHighlight(0, 0, r);
}

// 보스의 왕관: 노란 톱니 모양 + 가운데 빨간 보석
function drawCrown(r) {
  drawOutlinedPolygon([
    [-r * 0.55, -r * 0.72],   // 왼쪽 아래
    [-r * 0.62, -r * 1.28],   // 왼쪽 뾰족
    [-r * 0.3, -r * 0.98],
    [0, -r * 1.45],           // 가운데 뾰족
    [r * 0.3, -r * 0.98],
    [r * 0.62, -r * 1.28],    // 오른쪽 뾰족
    [r * 0.55, -r * 0.72],    // 오른쪽 아래
  ], COLORS.yellow, SMALL_OUTLINE_WIDTH);
  drawOutlinedCircle(0, -r * 0.92, r * 0.11, COLORS.red, SMALL_OUTLINE_WIDTH * 0.7);
}

// 모든 적 공통: 화난 눈과 눈썹, 악문 입
function drawEnemyFace(enemy, r) {
  // 4) 눈: 플레이어 쪽으로 살짝 쏠려서 노려보는 느낌
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const lookX = Math.cos(angle) * 2.5;
  const lookY = Math.sin(angle) * 2;
  // 왼쪽 눈, 오른쪽 눈을 차례로 그리는 반복문
  for (const side of [-1, 1]) {
    const eyeX = side * r * 0.36;
    const eyeY = -r * 0.05;
    // 흰자
    drawOutlinedCircle(eyeX, eyeY, r * 0.24, COLORS.white, SMALL_OUTLINE_WIDTH * 0.8);
    // 눈동자 (흰자 안에서 플레이어 쪽으로 움직인다)
    ctx.fillStyle = COLORS.outline;
    ctx.beginPath();
    ctx.arc(eyeX + lookX * 0.6, eyeY + lookY * 0.6, r * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // 화난 눈썹: 바깥쪽이 높고 안쪽(가운데)이 낮은 "\ /" 모양 선
    setOutline(SMALL_OUTLINE_WIDTH);
    ctx.beginPath();
    ctx.moveTo(side * r * 0.65, -r * 0.5);   // 바깥쪽 (높게)
    ctx.lineTo(side * r * 0.12, -r * 0.28);  // 안쪽 (낮게)
    ctx.stroke();
  }

  // 5) 이를 악문 입: 짧은 일자 선
  setOutline(SMALL_OUTLINE_WIDTH * 0.8);
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 0.45);
  ctx.lineTo(r * 0.25, r * 0.45);
  ctx.stroke();
}

// 돌격형의 예고선: 돌진할 방향으로 빨간 점선 (적들보다 아래에 그린다)
function drawChargerWarning(enemy) {
  ctx.save();
  // 예고 시간 동안 점점 진해진다
  const type = enemyType(enemy);
  const warnTime = enemy.warnTime || CHARGER_WARN_TIME;        // 보스는 예고 시간이 단계마다 다르다
  ctx.globalAlpha = 0.35 + 0.55 * Math.min(1, enemy.stateTime / warnTime);
  ctx.setLineDash([14, 10]);   // 14px 선, 10px 빈칸
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = type.isBoss ? 7 : 4;                         // 보스 예고선은 더 굵게
  ctx.lineCap = "round";
  const length = type.warnLength || CHARGER_WARN_LENGTH;
  ctx.beginPath();
  ctx.moveTo(enemy.x, enemy.y);
  ctx.lineTo(enemy.x + enemy.dirX * length, enemy.y + enemy.dirY * length);
  ctx.stroke();
  ctx.restore();
}

// 모든 적을 그리는 함수
function drawEnemies() {
  // 1) 먼저 예고선들을 깐다 (예고 중인 돌격형만)
  for (const enemy of enemies) {
    if (enemy.state === "warn") drawChargerWarning(enemy);
  }
  // 2) 그 위에 적 몸을 그린다. 적 목록을 하나씩 꺼내 그리는 반복문
  for (const enemy of enemies) {
    drawEnemy(enemy);
  }
}

// ---- 총알 ----
// 노란 알갱이 + 외곽선, 날아온 쪽으로 짧은 꼬리
function drawBullets() {
  // 총알 목록을 하나씩 꺼내 그리는 반복문
  for (const bullet of bullets) {
    // 날아가는 방향의 반대쪽(뒤)으로 꼬리 끝 위치를 구한다
    const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
    const tailX = bullet.x - (bullet.vx / speed) * BULLET_TAIL_LENGTH;
    const tailY = bullet.y - (bullet.vy / speed) * BULLET_TAIL_LENGTH;

    // 1) 꼬리 외곽선: 굵은 어두운 선을 먼저 긋고
    setOutline(BULLET_RADIUS * 0.9 + SMALL_OUTLINE_WIDTH * 2);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    // 2) 꼬리 속: 그 위에 조금 가는 노란 선을 겹쳐 그으면 외곽선 있는 꼬리가 된다
    const color = bullet.color || COLORS.yellow; // 보통은 노랑, 파편 등은 자기 색
    ctx.strokeStyle = color;
    ctx.lineWidth = BULLET_RADIUS * 0.9;
    ctx.stroke();

    // 3) 알갱이 머리
    drawOutlinedCircle(bullet.x, bullet.y, BULLET_RADIUS, color, SMALL_OUTLINE_WIDTH);

    // 4) 아주 작은 하이라이트 점
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(bullet.x - 1.5, bullet.y - 1.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- 파티클 ----
// 외곽선을 두른 작은 단색 도형이 빙글빙글 돌며 점점 작아진다
function drawParticles() {
  // 파티클 목록을 하나씩 꺼내 그리는 반복문
  for (const p of particles) {
    // 크기 줄이기: t = 지난 수명 비율(0 → 1). 1 - t² 를 쓰면
    // 처음엔 천천히 작아지다가 끝에 가서 빠르게 사라진다 (그래프가 아래로 휘는 포물선)
    const t = p.age / PARTICLE_LIFE;
    const s = p.size * (1 - t * t);
    if (s < 0.5) continue; // 너무 작으면 그리지 않는다

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    if (p.shape === "circle") {
      drawOutlinedCircle(0, 0, s, p.color, SMALL_OUTLINE_WIDTH);
    } else if (p.shape === "square") {
      drawOutlinedRoundRect(-s, -s, s * 2, s * 2, s * 0.3, p.color, SMALL_OUTLINE_WIDTH);
    } else {
      // 세모: 중심에서 120도 간격으로 꼭짓점 3개
      drawOutlinedPolygon([
        [0, -s * 1.2],
        [s * 1.05, s * 0.6],
        [-s * 1.05, s * 0.6],
      ], p.color, SMALL_OUTLINE_WIDTH);
    }
    ctx.restore();
  }
}

// ---- 대미지 숫자 팝업 ----
// 바운스 크기 배율을 계산하는 함수. age = 팝업이 태어난 뒤 흐른 시간(초)
//   0 ~ 0.1초   : 0.3배 → 1.6배 로 "뻥" 하고 커진다
//   0.1 ~ 0.25초: 1.6배 → 1배 로 다시 줄어든다
//   그 뒤       : 1배 유지
function popupScale(age) {
  if (age < 0.1) {
    const t = age / 0.1;          // 0 → 1 로 늘어나는 진행도
    return 0.3 + (1.6 - 0.3) * t; // 0.3 에서 1.6 까지 일정하게 커짐
  } else if (age < 0.25) {
    const t = (age - 0.1) / 0.15; // 0 → 1
    return 1.6 + (1 - 1.6) * t;   // 1.6 에서 1 까지 일정하게 작아짐
  }
  return 1;
}

function drawPopups() {
  // 팝업 목록을 하나씩 꺼내 그리는 반복문
  for (const popup of popups) {
    // 큰 대미지일수록 큰 글씨. 제곱근(√)을 써서 너무 거대해지지 않게 한다.
    // 대미지 10 → 약 25px, 40 → 약 35px, 100 → 약 46px
    const size = POPUP_BASE_SIZE + Math.sqrt(popup.value) * 3;

    // 1) 바운스: 처음 0.25초 동안 크게 튀어나왔다가 원래 크기로
    const scale = popupScale(popup.age);

    // 2) 사라지기: 마지막 40% 동안 점점 투명해진다
    const lifeT = popup.age / POPUP_LIFE;              // 0 → 1
    const alpha = lifeT < 0.6 ? 1 : 1 - (lifeT - 0.6) / 0.4;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(popup.x, popup.y);
    ctx.scale(scale, scale);                           // 크기 배율 적용
    // 기본 대미지의 2배 이상인 "큰 한 방"은 노란 글씨로 강조
    const fill = popup.value >= player.damage * 2 ? COLORS.yellow : COLORS.white;
    drawOutlinedText(String(popup.value), 0, 0, size, "center", fill);
    ctx.restore();
  }
}

// ---- 체력바 (스티커 스타일) ----
// 하얀 바탕 → 남은 비율만큼 색 채우기 → 맨 위에 두꺼운 외곽선
function drawBar(x, y, w, h, ratio, fillColor, width = OUTLINE_WIDTH) {
  ratio = clamp(ratio, 0, 1);                 // 비율은 0~1 사이로
  roundRectPath(x, y, w, h, h / 2);           // 1) 바탕
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  if (ratio > 0) {                            // 2) 채우기 (남은 만큼)
    roundRectPath(x, y, w * ratio, h, h / 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  drawOutlinedRoundRect(x, y, w, h, h / 2, null, width); // 3) 외곽선만 덮어 그리기
}

// 왼쪽 위 상태창의 사각형 (누르면 일시정지)
function hudPanelRect() {
  return { x: 12, y: 12, w: 250, h: 132 };
}

// ---- 화면 위 정보 (HUD) ----
// 왼쪽 위: 웨이브 번호, 체력바, 점수 / 오른쪽 위: 가진 증강 목록
function drawHud() {
  // ---- 왼쪽 위 패널 ----
  drawOutlinedRoundRect(12, 12, 250, 132, 14, COLORS.brown);

  // 챕터와 웨이브 번호 (예: "챕터 2 · 웨이브 7 / 30"). 길면 패널 폭에 맞게 글자를 줄인다
  const waveText = "챕터 " + chapterOf(wave) + " · 웨이브 " + wave + " / " + WAVES.length;
  drawOutlinedText(waveText, 28, 34, fitTextSize(waveText, 22, 218), "left");

  // 플레이어 체력바: 체력이 30% 이하이면 빨강, 아니면 초록
  const ratio = player.hp / player.maxHp;
  drawBar(28, 54, 218, 18, ratio, ratio <= 0.3 ? COLORS.red : COLORS.green);

  // 점수 (노란 글씨)
  drawOutlinedText("점수 " + score, 28, 94, 22, "left", COLORS.yellow);

  // 이번 판에 번 코인 (동전 아이콘 + 내림한 정수)
  drawCoinIcon(38, 124, 10);
  drawOutlinedText(String(Math.floor(runCoins)), 56, 124, 20, "left");

  // ---- 오른쪽 위: 가진 증강 목록 ----
  drawAugmentList();
}

// 가진 증강을 한 줄씩 보여 주는 패널 (하나도 없으면 그리지 않는다)
function drawAugmentList() {
  // 가진 증강만 골라 목록으로 만든다 (augments.js 에 적힌 순서대로)
  const owned = AUGMENTS.filter(function (aug) {
    return getAugmentLevel(aug.id) > 0;
  });
  if (owned.length === 0) return;

  // 증강이 많으면 두 줄(2열)로 작게 그려서 화면을 덜 가린다
  if (owned.length > AUGMENT_LIST_COMPACT_FROM - 1) {
    drawAugmentListCompact(owned);
    return;
  }

  const w = 220;                    // 패널 폭
  const rowH = 32;                  // 한 줄 높이
  const x = CANVAS_WIDTH - 12 - w;  // 화면 오른쪽에 붙인다
  const y = 12;
  const h = 44 + owned.length * rowH;

  drawOutlinedRoundRect(x, y, w, h, 14, COLORS.brown);
  drawOutlinedText("증강", x + 16, y + 22, 20, "left");

  // 가진 증강을 한 줄씩 그리는 반복문
  for (let i = 0; i < owned.length; i++) {
    const aug = owned[i];
    const rowY = y + 52 + i * rowH;
    // 증강 색 동그라미 + 이름 + 레벨
    drawOutlinedCircle(x + 26, rowY, 9, COLORS[aug.color], SMALL_OUTLINE_WIDTH);
    drawOutlinedText(aug.name, x + 44, rowY, 18, "left");
    drawOutlinedText("Lv." + getAugmentLevel(aug.id), x + w - 16, rowY, 18, "right", COLORS.yellow);
  }
}

// 증강이 많을 때의 작은 목록: 2열로, 글자도 조금 작게
function drawAugmentListCompact(owned) {
  const colW = 150;                          // 한 열의 폭 (보스 체력바와 겹치지 않게)
  const rowH = 24;                           // 한 줄 높이
  const rows = Math.ceil(owned.length / 2);  // 2열이니 줄 수는 절반(올림)
  const w = colW * 2 + 16;
  const x = CANVAS_WIDTH - 12 - w;
  const y = 12;
  const h = 40 + rows * rowH;

  drawOutlinedRoundRect(x, y, w, h, 14, COLORS.brown);
  drawOutlinedText("증강 " + owned.length + "개", x + 14, y + 20, 17, "left");

  // 가진 증강을 위→아래, 왼쪽 열 → 오른쪽 열 순서로 그리는 반복문
  for (let i = 0; i < owned.length; i++) {
    const aug = owned[i];
    const col = Math.floor(i / rows);        // 0 = 왼쪽 열, 1 = 오른쪽 열
    const row = i % rows;
    const cx = x + 8 + col * colW;
    const rowY = y + 46 + row * rowH;
    drawOutlinedCircle(cx + 14, rowY, 7, COLORS[aug.color], SMALL_OUTLINE_WIDTH * 0.8);
    drawOutlinedText(aug.name, cx + 27, rowY, 15, "left");
    drawOutlinedText(String(getAugmentLevel(aug.id)), cx + colW - 10, rowY, 15, "right", COLORS.yellow);
  }
}

// ---- 동전 아이콘 ----
// 노란 동전 + 안쪽 테두리 + 하이라이트 (모든 코인 표시에 같이 쓴다)
function drawCoinIcon(x, y, r) {
  drawOutlinedCircle(x, y, r, COLORS.yellow, SMALL_OUTLINE_WIDTH);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);   // 안쪽 동그라미 무늬
  ctx.strokeStyle = COLORS.brown;
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.stroke();
  drawHighlight(x, y, r);
}

// ---- 보스 체력바 (화면 위쪽 가운데) ----
// 보스가 여러 마리면 아래로 한 줄씩 쌓는다
function drawBossBars() {
  const bosses = enemies.filter(function (e) { return enemyType(e).isBoss; });
  const w = BOSS_BAR_WIDTH;
  // 살아 있는 보스를 하나씩 그리는 반복문
  for (let i = 0; i < bosses.length; i++) {
    const boss = bosses[i];
    const y = 24 + i * 50;
    drawOutlinedText(enemyType(boss).name, CANVAS_WIDTH / 2, y, 20, "center", COLORS.yellow);
    drawBar(CANVAS_WIDTH / 2 - w / 2, y + 14, w, 18, boss.hp / boss.maxHp, COLORS.red);
  }
}

// ---- 웨이브 시작 안내 띠 ----
// 화면 위쪽에 "웨이브 2" + "복리 탄환 Lv.1 획득!" 을 잠깐 보여 준다
function drawBanner() {
  if (bannerTimer <= 0 || gameState !== "playing") return;

  // 처음 0.2초 동안 위에서 내려오고, 마지막 0.3초 동안 흐려진다
  const shown = BANNER_TIME - bannerTimer;           // 나타난 뒤 흐른 시간
  const slide = Math.min(1, shown / 0.2);            // 0 → 1
  const alpha = Math.min(1, bannerTimer / 0.3);      // 끝날 때 1 → 0

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(CANVAS_WIDTH / 2, -40 + 110 * slide); // y: -40 → 70 으로 내려온다
  ctx.rotate(0.02);
  const h = bannerSubText ? 84 : 56;                  // 부제가 있으면 더 높게
  // 띠 폭: 기본 340px, 글자가 길면 글자 폭에 맞춰 넓힌다
  ctx.font = "34px " + FONT_FAMILY;
  let w = Math.max(340, ctx.measureText(bannerText).width + 60);
  ctx.font = "20px " + FONT_FAMILY;
  w = Math.max(w, ctx.measureText(bannerSubText).width + 60);
  // 보스 웨이브 안내는 빨간 띠, 보통은 노란 띠
  drawOutlinedRoundRect(-w / 2, -28, w, h, 18, bannerIsBoss ? COLORS.red : COLORS.yellow);
  drawOutlinedText(bannerText, 0, 0, 34);
  if (bannerSubText) {
    drawOutlinedText(bannerSubText, 0, 36, 20);
  }
  ctx.restore();
}

// ---- 긴 글을 카드 폭에 맞게 여러 줄로 나누는 함수 ----
// 띄어쓰기 단위로 단어를 하나씩 붙여 보다가, 폭을 넘으면 다음 줄로 넘긴다.
function wrapText(text, maxWidth, size) {
  ctx.font = size + "px " + FONT_FAMILY;   // 글자 폭을 재려면 글꼴을 먼저 정해야 한다
  const words = text.split(" ");
  const lines = [];
  let line = "";
  // 단어를 하나씩 꺼내 줄에 붙여 보는 반복문
  for (const word of words) {
    const test = line === "" ? word : line + " " + word;
    if (ctx.measureText(test).width > maxWidth && line !== "") {
      lines.push(line);   // 지금 줄은 확정하고
      line = word;        // 이 단어부터 새 줄 시작
    } else {
      line = test;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// ---- 카드 글자 맞추기 ----
// 카드 설명이 들어갈 자리: 첫 줄 가운데가 카드 위에서 180px, 마지막 줄 가운데는 262px 까지
// (그 아래는 레벨 표시 자리라서 조금 여유를 둔다)
const CARD_DESC_TOP = 180;
const CARD_DESC_BOTTOM = 262;

// 설명 글을 카드에 맞게 나누는 함수.
// 17px 로 넣어 보고, 넘치면 16, 15 ... 13px 까지 글자를 줄여 가며 들어가는 크기를 찾는다.
// 돌려주는 값: { size: 글자 크기, lineHeight: 줄 간격, lines: 줄 목록 }
function fitCardDesc(text) {
  const maxWidth = CARD_WIDTH - 40;
  let result = null;
  // 글자 크기를 17부터 1씩 줄여 보는 반복문
  for (let size = 17; size >= 13; size--) {
    const lineHeight = Math.round(size * 1.35);                   // 17px → 23px
    const maxLines = Math.floor((CARD_DESC_BOTTOM - CARD_DESC_TOP) / lineHeight) + 1;
    const lines = wrapText(text, maxWidth, size);
    result = { size: size, lineHeight: lineHeight, lines: lines };
    if (lines.length <= maxLines) break;                          // 들어가면 이 크기로 결정
  }
  return result;
}

// 한 줄짜리 글자가 maxWidth 안에 들어가는 가장 큰 글자 크기 (startSize 부터 줄여 본다)
function fitTextSize(text, startSize, maxWidth) {
  let size = startSize;
  ctx.font = size + "px " + FONT_FAMILY;
  // 폭이 넘치는 동안 글자를 1px 씩 줄이는 반복문
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = size + "px " + FONT_FAMILY;
  }
  return size;
}

// ---- 증강 카드 한 장 ----
// i: 몇 번째 카드인지 (0, 1, 2)
function drawCard(aug, i) {
  const pos = cardPosition(i);
  const level = getAugmentLevel(aug.id);           // 지금 레벨 (없으면 0)
  // 고르면 얻게 될 레벨의 정보 (보급 카드는 레벨이 없으니 카드 자체의 설명)
  const info = aug.isSupply ? aug : aug.levels[level];
  const isHover = i === hoverIndex;

  // 등장 애니메이션: 카드마다 0.08초씩 늦게, 바운스하며 나타난다
  const appear = choosingTime - i * 0.08;
  if (appear <= 0) return;                         // 아직 차례가 안 됨
  const scale = popupScale(appear) * (isHover ? 1.04 : 1);

  ctx.save();
  // 카드 가운데를 기준으로 돌리고 키우기 위해 기준점을 카드 중심으로 옮긴다
  ctx.translate(pos.x + CARD_WIDTH / 2, pos.y + CARD_HEIGHT / 2 - (isHover ? 10 : 0));
  ctx.rotate((i - 1) * 0.035);                     // 스티커처럼 왼쪽·가운데·오른쪽 다르게 기울이기
  ctx.scale(scale, scale);

  // 이제부터 좌표는 카드 중심 기준. 왼쪽 위 = (-w/2, -h/2)
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const left = -w / 2;
  const top = -h / 2;
  const accent = COLORS[aug.color];               // 증강별 색

  // 1) 카드 그림자 (번지지 않는 진한 그림자 = 카툰 느낌)
  roundRectPath(left + 7, top + 7, w, h, 20);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();

  // 2) 카드 몸통 (하양)
  drawOutlinedRoundRect(left, top, w, h, 20, COLORS.white);

  // 3) 위쪽 색 띠 + 제목
  drawOutlinedRoundRect(left + 12, top + 12, w - 24, 58, 14, accent);
  drawOutlinedText(aug.name, 0, top + 41, fitTextSize(aug.name, 30, w - 44));

  // 4) 개념 이름 (작은 갈색 글자)
  ctx.font = "16px " + FONT_FAMILY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.brown;
  ctx.fillText(aug.concept, 0, top + 92);

  // 5) 수식 (카드의 주인공: 크게. 길면 카드 폭에 맞게 줄인다)
  drawOutlinedText(aug.formula, 0, top + 135, fitTextSize(aug.formula, 30, w - 34), "center", accent);

  // 6) 설명 (여러 줄로 나누고, 넘치면 글자를 줄인다)
  const desc = fitCardDesc(info.desc);
  ctx.fillStyle = COLORS.outline;
  ctx.font = desc.size + "px " + FONT_FAMILY;
  // 줄을 하나씩 아래로 내려가며 쓰는 반복문
  for (let n = 0; n < desc.lines.length; n++) {
    ctx.fillText(desc.lines[n], 0, top + CARD_DESC_TOP + n * desc.lineHeight);
  }

  // 7) 아래쪽 레벨 표시: 처음이면 "NEW!", 가지고 있으면 "Lv.1 → Lv.2", 보급 카드는 "보급"
  let levelText = level === 0 ? "NEW!" : "Lv." + level + " → Lv." + (level + 1);
  let badgeColor = level === 0 ? COLORS.yellow : COLORS.green;
  if (aug.isSupply) {
    levelText = "보급";
    badgeColor = COLORS.orange;
  }
  drawOutlinedRoundRect(-70, top + h - 46, 140, 32, 16, badgeColor);
  drawOutlinedText(levelText, 0, top + h - 30, 18);

  // 8) 왼쪽 위 번호 배지 (이 번호 키를 눌러도 고를 수 있다)
  drawOutlinedCircle(left + 6, top + 6, 18, COLORS.outline);
  drawOutlinedText(String(i + 1), left + 6, top + 7, 20, "center", COLORS.yellow);

  ctx.restore();
}

// ---- 증강 선택 화면 전체 ----
function drawChoiceScreen() {
  if (gameState !== "choosing") return;

  // 뒤 화면을 어둡게 덮는다
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // 위쪽 제목
  drawOutlinedText("웨이브 " + wave + " 클리어!", CANVAS_WIDTH / 2, 48, 40, "center", COLORS.yellow);
  drawOutlinedText("증강을 하나 고르세요  (클릭 또는 1 · 2 · 3 키)", CANVAS_WIDTH / 2, 88, 20);

  // 카드를 한 장씩 그리는 반복문
  for (let i = 0; i < choices.length; i++) {
    drawCard(choices[i], i);
  }
}

// ---- 일시정지 창 ----

// 일시정지 창 크기와 버튼 (게임 좌표)
const PAUSE_PANEL = { x: 80, y: 40, w: 800, h: 460 };
const PAUSE_BUTTONS = [
  { id: "resume", label: "계속하기", hint: "P / Esc", color: "green" },
  { id: "restart", label: "다시 시작", hint: "", color: "yellow" },
  { id: "lobby", label: "로비로", hint: "", color: "brown" },
];

// 조작법 (일시정지 창에 보여 준다)
const CONTROLS_HELP = [
  ["이동", "WASD / 방향키"],
  ["발사", "가장 가까운 적에게 자동"],
  ["일시정지", "P / Esc / 상태창 클릭"],
  ["상태창 접기", "Tab / 화살표 버튼"],
  ["카드 고르기", "클릭 또는 1 · 2 · 3"],
  ["결과 화면", "R 다시 · U 업그레이드 · M 메뉴"],
];

// i 번째 일시정지 버튼의 사각형
function pauseButtonRect(i) {
  return { x: PAUSE_PANEL.x + 34, y: PAUSE_PANEL.y + 84 + i * 64, w: 250, h: 50 };
}

// 일시정지 창에서 (x, y) 에 있는 버튼 id (없으면 null)
function pauseButtonAt(x, y) {
  for (let i = 0; i < PAUSE_BUTTONS.length; i++) {
    if (insideRect(x, y, pauseButtonRect(i))) return PAUSE_BUTTONS[i].id;
  }
  return null;
}

// 가진 증강 목록을 영역(폭 w, 높이 h) 안에 들어가게 배치한다.
// 글자 크기와 설명 줄 수를 줄여 가며 맞는 배치를 찾는다.
function layoutPauseAugments(owned, w, h) {
  // 글자 크기 14 → 11, 설명 최대 3줄 → 1줄 순서로 시도하는 이중 반복문
  for (let maxLines = 3; maxLines >= 1; maxLines--) {
    for (let size = 14; size >= 11; size--) {
      const lineH = size + 4;
      let total = 0;
      const items = owned.map(function (aug) {
        const level = getAugmentLevel(aug.id);
        let lines = wrapText(aug.levels[level - 1].desc, w - 18, size);
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…"); // 잘린 줄 끝에 말줄임표
        }
        const itemH = 22 + lines.length * lineH + 6;    // 이름 줄 + 설명 줄들 + 간격
        total += itemH;
        return { aug: aug, level: level, lines: lines, h: itemH };
      });
      if (total <= h || (maxLines === 1 && size === 11)) return { size: size, lineH: lineH, items: items };
    }
  }
}

function drawPauseScreen() {
  if (gameState !== "playing") return;

  // "계속하기" 뒤 다시 움직이기 전: 가운데에 짧은 안내
  if (!paused && resumeTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, resumeTimer / RESUME_DELAY + 0.3);
    drawOutlinedText("준비!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 44 + (1 - resumeTimer / RESUME_DELAY) * 16, "center", COLORS.yellow);
    ctx.restore();
    return;
  }
  if (!paused) return;

  // 1) 반투명 어두운 배경
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // 2) 가운데 패널 (그림자 + 크림색 몸통)
  const P = PAUSE_PANEL;
  roundRectPath(P.x + 8, P.y + 8, P.w, P.h, 26);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(P.x, P.y, P.w, P.h, 26, COLORS.background);

  // 3) 제목 스티커
  ctx.save();
  ctx.translate(P.x + 160, P.y + 6);
  ctx.rotate(-0.04);
  drawOutlinedRoundRect(-110, -26, 220, 52, 18, COLORS.yellow);
  drawOutlinedText("일시정지", 0, 1, 30);
  ctx.restore();

  // 4) 왼쪽: 버튼 3개
  for (let i = 0; i < PAUSE_BUTTONS.length; i++) {
    const b = PAUSE_BUTTONS[i];
    const r = pauseButtonRect(i);
    roundRectPath(r.x + 5, r.y + 5, r.w, r.h, 20);
    ctx.fillStyle = COLORS.outline;
    ctx.fill();
    drawOutlinedRoundRect(r.x, r.y, r.w, r.h, 20, COLORS[b.color]);
    drawOutlinedText(b.label, r.x + r.w / 2, r.y + r.h / 2 + 1, 24);
  }

  // 5) 왼쪽 아래: 조작법
  const hx = P.x + 34, hy = P.y + 290;
  drawOutlinedText("조작법", hx, hy, 20, "left", COLORS.brown);
  ctx.font = "15px " + FONT_FAMILY;
  ctx.textBaseline = "middle";
  // 조작법을 한 줄씩 쓰는 반복문 (왼쪽: 무엇, 오른쪽: 어떤 키)
  for (let i = 0; i < CONTROLS_HELP.length; i++) {
    const y = hy + 28 + i * 22;
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.brown;
    ctx.fillText(CONTROLS_HELP[i][0], hx, y);
    ctx.fillStyle = COLORS.outline;
    // 오른쪽 칸(증강 목록)을 넘지 않게, 길면 글자를 줄인다
    ctx.font = fitTextSize(CONTROLS_HELP[i][1], 15, 186) + "px " + FONT_FAMILY;
    ctx.fillText(CONTROLS_HELP[i][1], hx + 92, y);
    ctx.font = "15px " + FONT_FAMILY;
  }

  // 6) 오른쪽: 가진 증강과 설명
  const ax = P.x + 330, ay = P.y + 34, aw = P.w - 360, ah = P.h - 60;
  // 오른쪽 칸 구분선
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(ax - 18, P.y + 30, 3, P.h - 60);
  ctx.restore();
  drawOutlinedText("가진 증강", ax, ay, 20, "left", COLORS.brown);
  const owned = AUGMENTS.filter(function (aug) { return getAugmentLevel(aug.id) > 0; });
  if (owned.length === 0) {
    ctx.font = "16px " + FONT_FAMILY;
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.outline;
    ctx.fillText("아직 가진 증강이 없어요. 웨이브를 깨고 카드를 골라 보세요!", ax, ay + 34);
  } else {
    const layout = layoutPauseAugments(owned, aw, ah - 20);
    let y = ay + 26;
    // 증강을 하나씩: 색 동그라미 + 이름 Lv + 수식, 그 아래 설명
    for (const item of layout.items) {
      drawOutlinedCircle(ax + 8, y + 10, 7, COLORS[item.aug.color], SMALL_OUTLINE_WIDTH * 0.8);
      ctx.font = "17px " + FONT_FAMILY;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.outline;
      const title = item.aug.name + " Lv." + item.level;
      ctx.fillText(title, ax + 22, y + 10);
      const tw = ctx.measureText(title).width;
      ctx.font = "14px " + FONT_FAMILY;
      ctx.fillStyle = COLORS.brown;
      ctx.fillText(item.aug.formula, ax + 32 + tw, y + 10);
      ctx.font = layout.size + "px " + FONT_FAMILY;
      ctx.fillStyle = COLORS.outline;
      for (let n = 0; n < item.lines.length; n++) {
        ctx.fillText(item.lines[n], ax + 22, y + 22 + layout.lineH * (n + 0.5) + 2);
      }
      y += item.h;
    }
  }
}

// ---- 결과 화면 (게임 오버 / 클리어) ----
function drawOverlay() {
  if (gameState !== "gameover" && gameState !== "clear") return;

  const isClear = gameState === "clear";
  const title = isClear ? "모든 웨이브 클리어!" : "게임 오버";
  const panelColor = isClear ? COLORS.yellow : COLORS.red;

  // 화면 전체를 외곽선 색으로 반투명하게 덮는다
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // 가운데 패널 (스티커처럼 살짝 기울여 붙인다)
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.rotate(-0.025);

  // 그림자 + 패널 (가로 560, 세로 330)
  const pw = 560, ph = 330;
  roundRectPath(-pw / 2 + 8, -ph / 2 + 8, pw, ph, 26);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(-pw / 2, -ph / 2, pw, ph, 26, panelColor);

  // 제목
  drawOutlinedText(title, 0, -128, 46);

  // 점수 (새 기록이면 "NEW!" 표시)
  drawOutlinedText("점수 " + score, 0, -80, 36, "center", COLORS.white);
  if (isNewBest && score > 0) {
    ctx.save();
    ctx.translate(180, -96);
    ctx.rotate(0.2);
    drawOutlinedRoundRect(-38, -16, 76, 32, 12, COLORS.green);
    drawOutlinedText("NEW!", 0, 1, 20);
    ctx.restore();
  }
  drawOutlinedText("최고 점수 " + bestScore, 0, -48, 18);

  // 도달한 웨이브와 잡은 보스 수
  drawOutlinedText("도달 웨이브 " + wave + " / " + WAVES.length + "   ·   잡은 보스 " + bossesKilled + "마리",
    0, -18, 20, "center", COLORS.yellow);

  // 코인: 생존 시간 / 번 코인 / 보유 코인 / 최고 웨이브
  const coinText = "생존 " + formatTime(runTime) + "  ·  번 코인 +" + lastRunCoins +
    "  ·  보유 " + saveData.coins + "  ·  최고 웨이브 " + saveData.bestWave;
  const coinSize = fitTextSize(coinText, 18, pw - 70);
  ctx.font = coinSize + "px " + FONT_FAMILY;
  const coinW = ctx.measureText(coinText).width;
  drawCoinIcon(-coinW / 2 - 16, 12, 9);
  drawOutlinedText(coinText, 4, 12, coinSize);

  // 이번 판에 모은 증강 (많으면 여러 줄로 나눈다)
  const owned = AUGMENTS
    .filter(function (aug) { return getAugmentLevel(aug.id) > 0; })
    // 이름과 레벨 사이는 "줄이 바뀌지 않는 띄어쓰기"(\u00A0)로 붙여서, 줄은 " · " 에서만 바뀌게 한다
    .map(function (aug) { return (aug.name + " Lv." + getAugmentLevel(aug.id)).replace(/ /g, "\u00A0"); });
  const augText = owned.length > 0 ? "증강: " + owned.join(" · ") : "모은 증강 없음";
  const augLines = wrapText(augText, pw - 60, 16).slice(0, 3);   // 최대 3줄
  // 증강 목록을 한 줄씩 쓰는 반복문
  for (let i = 0; i < augLines.length; i++) {
    drawOutlinedText(augLines[i], 0, 42 + i * 20, 15);
  }

  // 아래쪽 버튼 3개: 다시 시작(R) / 업그레이드(U) / 메뉴(M)
  // 업그레이드 버튼만 눈에 띄게 초록색
  for (const b of RESULT_BUTTONS) {
    drawOutlinedRoundRect(b.dx - b.w / 2, 112, b.w, 40, 20, b.id === "upgrades" ? COLORS.green : COLORS.outline);
    drawOutlinedText(b.label, b.dx, 133, 18, "center", b.id === "upgrades" ? COLORS.white : COLORS.yellow);
  }
  ctx.restore();
}

// 결과 화면 아래쪽 버튼들 (dx = 화면 가운데에서 가로로 떨어진 거리)
const RESULT_BUTTONS = [
  { id: "retry", label: "R : 다시 시작", dx: -175, w: 160 },
  { id: "upgrades", label: "U : 업그레이드", dx: 0, w: 170 },
  { id: "menu", label: "M : 메뉴로", dx: 175, w: 160 },
];

// 결과 화면에서 (x, y) 를 누르면 어떤 버튼인지 (없으면 null)
// (패널이 아주 살짝 기울어져 있지만, 버튼을 넉넉히 잡아서 기울기는 무시한다)
function resultButtonAt(x, y) {
  const cy = CANVAS_HEIGHT / 2 + 132;     // 버튼 가운데 높이
  // 버튼을 하나씩 보며 눌린 곳이 안에 있는지 검사하는 반복문
  for (const b of RESULT_BUTTONS) {
    const cx = CANVAS_WIDTH / 2 + b.dx;
    if (Math.abs(x - cx) <= b.w / 2 && Math.abs(y - cy) <= 24) return b.id;
  }
  return null;
}

// =============================================================
// 업그레이드 화면
// =============================================================

// 업그레이드 화면 상태
let upgradeShake = [];        // 카드마다 흔들림이 남은 시간 (코인이 모자랄 때)
let upgradeToast = "";        // 아래쪽에 잠깐 뜨는 알림
let upgradeToastTimer = 0;
let resetArmTimer = 0;        // "한 번 더 누르면 초기화" 가 남은 시간 (0 이면 평소 상태)

// 업그레이드 카드 크기와 위치
const UPGRADE_CARD_WIDTH = 300;
const UPGRADE_CARD_HEIGHT = 290;
const UPGRADE_CARD_GAP = 40;
const UPGRADE_CARD_TOP = 150;
// 저장 초기화: 두 번째 누름을 기다리는 시간 (초)
const RESET_CONFIRM_TIME = 3;

// 업그레이드 화면을 여는 함수 (메뉴, 결과 화면에서)
function openUpgrades() {
  gameState = "upgrades";
  upgradeShake = UPGRADES.map(function () { return 0; });
  upgradeToast = "";
  upgradeToastTimer = 0;
  resetArmTimer = 0;
  canvas.style.cursor = "default";
}

// i 번째 업그레이드 카드의 왼쪽 위 위치
function upgradeCardPos(i) {
  const n = UPGRADES.length;
  const total = n * UPGRADE_CARD_WIDTH + (n - 1) * UPGRADE_CARD_GAP;
  return { x: (CANVAS_WIDTH - total) / 2 + i * (UPGRADE_CARD_WIDTH + UPGRADE_CARD_GAP), y: UPGRADE_CARD_TOP };
}

// i 번째 카드의 구매 버튼 사각형
function upgradeBuyRect(i) {
  const p = upgradeCardPos(i);
  return { x: p.x + 40, y: p.y + UPGRADE_CARD_HEIGHT - 66, w: UPGRADE_CARD_WIDTH - 80, h: 48 };
}

// 메뉴로 돌아가는 버튼, 저장 초기화 버튼의 사각형
const UPGRADE_BACK_RECT = { x: 20, y: 20, w: 120, h: 44 };
function resetButtonRect() {
  const w = resetArmTimer > 0 ? 230 : 130;             // 확인 상태에서는 글자가 길어져 넓게
  return { x: CANVAS_WIDTH - 20 - w, y: CANVAS_HEIGHT - 58, w: w, h: 40 };
}

// 점 (x, y) 가 사각형 r 안에 있는지
function insideRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 업그레이드 화면에서 (x, y) 에 있는 버튼 (없으면 null)
function upgradeButtonAt(x, y) {
  // 카드(구매 버튼 포함 카드 전체)를 누르면 구매
  for (let i = 0; i < UPGRADES.length; i++) {
    const p = upgradeCardPos(i);
    if (insideRect(x, y, { x: p.x, y: p.y, w: UPGRADE_CARD_WIDTH, h: UPGRADE_CARD_HEIGHT })) return { kind: "buy", index: i };
  }
  if (insideRect(x, y, UPGRADE_BACK_RECT)) return { kind: "back" };
  if (insideRect(x, y, resetButtonRect())) return { kind: "reset" };
  return null;
}

// i 번째 업그레이드 사기를 시도한다 (결과에 따라 알림 또는 흔들림)
function tryBuyUpgrade(i) {
  const up = UPGRADES[i];
  if (!up) return;
  const result = buyUpgrade(up);
  if (result === "ok") {
    upgradeToast = up.name + " Lv." + upgradeLevel(up) + "!  " + up.label(up.valueAt(upgradeLevel(up)));
    upgradeToastTimer = 1.5;
  } else if (result === "poor") {
    upgradeShake[i] = 0.35;                 // 카드가 살짝 흔들린다
    upgradeToast = "코인이 모자라요! (" + upgradeCost(up) + " 필요)";
    upgradeToastTimer = 1.5;
  } else {
    upgradeToast = up.name + "은(는) 이미 최대 레벨이에요";
    upgradeToastTimer = 1.5;
  }
}

// 저장 초기화 버튼: 첫 번째 누름은 "확인 대기", 3초 안에 한 번 더 누르면 실행
function pressResetSave() {
  if (resetArmTimer > 0) {
    resetSave();
    resetArmTimer = 0;
    upgradeToast = "저장을 초기화했어요 (코인 0, 레벨 0)";
    upgradeToastTimer = 2;
  } else {
    resetArmTimer = RESET_CONFIRM_TIME;
  }
}

// 업그레이드 화면의 시간 흐름 (흔들림, 알림, 초기화 대기 시간)
function updateUpgradeScreen(dt) {
  // 카드마다 흔들림 시간을 줄이는 반복문
  for (let i = 0; i < upgradeShake.length; i++) {
    upgradeShake[i] = Math.max(0, upgradeShake[i] - dt);
  }
  upgradeToastTimer = Math.max(0, upgradeToastTimer - dt);
  resetArmTimer = Math.max(0, resetArmTimer - dt);
}

// 업그레이드 아이콘 그리기 ("heart" = 하트, "bullet" = 총알)
function drawUpgradeIcon(shape, x, y, s) {
  if (shape === "heart") {
    // 하트: 위쪽 두 혹 + 아래 뾰족한 끝을 곡선으로 잇는다
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.75);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.55, y - s * 1.05, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.25, y - s * 0.05, x, y + s * 0.75);
    ctx.closePath();
    ctx.fillStyle = COLORS.red;
    ctx.fill();
    setOutline(SMALL_OUTLINE_WIDTH);
    ctx.stroke();
    drawHighlight(x - s * 0.35, y - s * 0.2, s * 0.6);
  } else {
    // 총알: 비스듬한 꼬리 + 노란 알갱이
    setOutline(s * 0.55 + SMALL_OUTLINE_WIDTH * 2);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y + s * 0.7);
    ctx.lineTo(x + s * 0.2, y - s * 0.2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = s * 0.55;
    ctx.stroke();
    drawOutlinedCircle(x + s * 0.25, y - s * 0.25, s * 0.55, COLORS.yellow, SMALL_OUTLINE_WIDTH);
    drawHighlight(x + s * 0.25, y - s * 0.25, s * 0.55);
  }
}

// 업그레이드 카드 한 장
function drawUpgradeCard(up, i) {
  const p = upgradeCardPos(i);
  const w = UPGRADE_CARD_WIDTH, h = UPGRADE_CARD_HEIGHT;
  const level = upgradeLevel(up);
  const isMax = level >= up.maxLevel;
  const cost = upgradeCost(up);
  const canBuy = !isMax && saveData.coins >= cost;

  ctx.save();
  // 코인이 모자란데 누르면 좌우로 살짝 흔들린다 (사인 곡선으로 빠르게 왕복)
  const shake = upgradeShake[i] > 0 ? Math.sin(upgradeShake[i] * 60) * 7 * (upgradeShake[i] / 0.35) : 0;
  ctx.translate(p.x + shake, p.y);

  // 그림자 + 몸통
  roundRectPath(7, 7, w, h, 22);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(0, 0, w, h, 22, COLORS.white);

  // 위쪽 색 띠: 아이콘 + 이름
  drawOutlinedRoundRect(12, 12, w - 24, 60, 16, COLORS[up.color]);
  drawUpgradeIcon(up.icon, 48, 42, 15);
  drawOutlinedText(up.name, w / 2 + 14, 42, 30);

  // 번호 배지 (이 번호 키로도 살 수 있다)
  drawOutlinedCircle(4, 4, 17, COLORS.outline);
  drawOutlinedText(String(i + 1), 4, 5, 19, "center", COLORS.yellow);

  // 개념
  ctx.font = "15px " + FONT_FAMILY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.brown;
  ctx.fillText(up.concept, w / 2, 92);

  // 레벨 (Lv.3 / 30)
  drawOutlinedText("Lv." + level + " / " + up.maxLevel, w / 2, 126, 30, "center", COLORS[up.color]);

  // 지금 값 → 다음 값
  const now = up.label(up.valueAt(level));
  const next = isMax ? "최대!" : String(up.valueAt(level + 1));
  ctx.font = "20px " + FONT_FAMILY;
  ctx.fillStyle = COLORS.outline;
  ctx.fillText(now + "  →  " + next, w / 2, 166);

  // 비용 (동전 아이콘 + 숫자)
  if (!isMax) {
    ctx.font = "22px " + FONT_FAMILY;
    const costText = String(cost);
    const tw = ctx.measureText(costText).width;
    drawCoinIcon(w / 2 - tw / 2 - 14, 198, 10);
    drawOutlinedText(costText, w / 2 + 6, 198, 22, "center", canBuy ? COLORS.yellow : COLORS.gray);
  }

  // 구매 버튼: 살 수 있으면 초록, 코인이 모자라면 회색, 최대면 MAX
  const b = upgradeBuyRect(i);
  const bx = b.x - p.x, by = b.y - p.y;
  const buttonColor = isMax ? COLORS.yellow : (canBuy ? COLORS.green : COLORS.gray);
  drawOutlinedRoundRect(bx, by, b.w, b.h, 22, buttonColor);
  drawOutlinedText(isMax ? "MAX" : "구매", bx + b.w / 2, by + b.h / 2 + 1, 24);

  ctx.restore();
}

// 업그레이드 화면 전체
function drawUpgradeScreen() {
  // 제목 스티커
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 58);
  ctx.rotate(-0.03);
  roundRectPath(-150 + 6, -32 + 6, 300, 64, 22);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(-150, -32, 300, 64, 22, COLORS.yellow);
  drawOutlinedText("업그레이드", 0, 2, 38);
  ctx.restore();

  // 보유 코인
  const coinText = "보유 코인 " + saveData.coins;
  ctx.font = "24px " + FONT_FAMILY;
  const cw = ctx.measureText(coinText).width;
  drawCoinIcon(CANVAS_WIDTH / 2 - cw / 2 - 18, 118, 12);
  drawOutlinedText(coinText, CANVAS_WIDTH / 2 + 6, 118, 24, "center", COLORS.yellow);

  // 업그레이드 카드들
  for (let i = 0; i < UPGRADES.length; i++) {
    drawUpgradeCard(UPGRADES[i], i);
  }

  // 메뉴로 버튼 (왼쪽 위)
  const back = UPGRADE_BACK_RECT;
  drawOutlinedRoundRect(back.x, back.y, back.w, back.h, 20, COLORS.brown);
  drawOutlinedText("← 메뉴", back.x + back.w / 2, back.y + back.h / 2 + 1, 20);

  // 조작 안내 / 알림
  if (upgradeToastTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, upgradeToastTimer / 0.3);
    drawOutlinedText(upgradeToast, CANVAS_WIDTH / 2, 470, 20, "center", COLORS.yellow);
    ctx.restore();
  } else {
    drawOutlinedText("클릭 또는 1 · 2 키로 구매 · Esc / M 메뉴로 · 최고 웨이브 " + saveData.bestWave,
      CANVAS_WIDTH / 2, 470, 17);
  }

  // 저장 초기화 버튼 (오른쪽 아래 구석, 두 번 눌러야 실행)
  const r = resetButtonRect();
  const armed = resetArmTimer > 0;
  drawOutlinedRoundRect(r.x, r.y, r.w, r.h, 18, armed ? COLORS.red : COLORS.gray, SMALL_OUTLINE_WIDTH);
  drawOutlinedText(armed ? "한 번 더 누르면 초기화 (" + Math.ceil(resetArmTimer) + ")" : "저장 초기화",
    r.x + r.w / 2, r.y + r.h / 2 + 1, 15);
}

// ---- 메뉴 화면 ----
function drawMenu() {
  // 1) 장식: 왼쪽에 플레이어, 오른쪽에 웨이브 1~3 적들이 둥실둥실
  //    sin(시간) 은 -1 ~ 1 을 부드럽게 오가므로 위아래로 흔들리는 움직임이 된다
  const decoEnemies = [
    { x: 740, y: 250, wave: 1 },
    { x: 840, y: 340, wave: 2 },
    { x: 750, y: 440, wave: 3 },
  ];
  // 장식용 적을 하나씩 그리는 반복문
  for (let i = 0; i < decoEnemies.length; i++) {
    const d = decoEnemies[i];
    drawEnemy({
      type: "basic",
      radius: ENEMY_TYPES.basic.radius,
      x: d.x,
      y: d.y + Math.sin(menuTime * 2 + i * 1.3) * 8, // 적마다 박자를 다르게
      wave: d.wave,
      hp: 1, maxHp: 1,  // 체력바가 안 보이게 가득 찬 상태
      hitFlash: 0,
    });
  }

  // 플레이어는 가운데 적을 조준하며 둥실둥실
  player.x = 200;
  player.y = 360 + Math.sin(menuTime * 2.4) * 10;
  player.invincibleTimer = 0;
  player.facing = Math.atan2(340 - player.y, 840 - player.x);
  drawPlayer();

  // 2) 제목 스티커
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 118);
  ctx.rotate(-0.04 + Math.sin(menuTime * 1.5) * 0.01); // 아주 살짝 흔들흔들
  roundRectPath(-250 + 8, -70 + 8, 500, 140, 30);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(-250, -70, 500, 140, 30, COLORS.yellow);
  drawOutlinedText("증강 슈터", 0, -12, 64);
  drawOutlinedText("수학 · 과학 공식으로 살아남기", 0, 42, 22, "center", COLORS.white);
  ctx.restore();

  // 3) 버튼들
  // 메뉴 항목을 하나씩 버튼으로 그리는 반복문
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const item = MENU_ITEMS[i];
    const r = menuButtonRect(i);
    const selected = i === menuIndex;
    const lift = selected ? 4 : 0;           // 선택된 버튼은 살짝 떠오른다

    // 그림자
    roundRectPath(r.x + 6, r.y + 6, r.w, r.h, 18);
    ctx.fillStyle = COLORS.outline;
    ctx.fill();

    // 버튼 색: 쓸 수 있으면 초록(선택되면 노랑), 준비 중이면 갈색
    let fill = COLORS.brown;
    if (item.ready) fill = selected ? COLORS.yellow : COLORS.green;
    drawOutlinedRoundRect(r.x, r.y - lift, r.w, r.h, 18, fill);
    drawOutlinedText(item.label, r.x + r.w / 2, r.y + r.h / 2 - lift, 28);

    // 준비 중 표시
    if (!item.ready) {
      drawOutlinedRoundRect(r.x + r.w - 78, r.y - 12 - lift, 86, 26, 13, COLORS.white, SMALL_OUTLINE_WIDTH);
      ctx.font = "15px " + FONT_FAMILY;
      ctx.fillStyle = COLORS.outline;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("준비 중", r.x + r.w - 35, r.y + 1 - lift);
    }

    // 선택된 버튼 왼쪽에 ▶ 표시
    if (selected) {
      drawOutlinedPolygon([
        [r.x - 30, r.y + r.h / 2 - 12 - lift],
        [r.x - 12, r.y + r.h / 2 - lift],
        [r.x - 30, r.y + r.h / 2 + 12 - lift],
      ], COLORS.yellow, SMALL_OUTLINE_WIDTH);
    }
  }

  // 4) 아래쪽: 알림이 있으면 알림을, 없으면 조작 안내를 보여 준다
  if (menuToastTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, menuToastTimer / 0.3); // 끝날 때 흐려짐
    drawOutlinedRoundRect(CANVAS_WIDTH / 2 - 200, 452, 400, 36, 18, COLORS.red);
    drawOutlinedText(menuToast, CANVAS_WIDTH / 2, 471, 18);
    ctx.restore();
  } else {
    drawOutlinedText("↑↓ 선택 · Enter 시작 · 마우스 클릭도 OK", CANVAS_WIDTH / 2, 470, 18);
  }
  drawOutlinedText("최고 점수 " + bestScore, CANVAS_WIDTH / 2, 508, 20, "center", COLORS.yellow);
}

// ---- 증강 효과 그림 (시간 지연 범위 등) ----
// 가진 증강 중 drawEffect 가 있는 것들에게 그리기를 맡긴다
function drawAugmentEffects() {
  const info = {
    x: player.x,
    y: player.y,
    playerSpeed: playerSpeed(),
    playerMaxSpeed: PLAYER_SPEED,
  };
  forEachOwnedAugment(function (aug, stats) {
    if (aug.drawEffect) {
      aug.drawEffect(stats, info);
    }
  });
}

// ---- 디버그 표시 (디버그 모드일 때만, 화면 왼쪽 아래 구석) ----
function drawDebug() {
  if (!debugMode) return;
  const x = 14;
  const y = CANVAS_HEIGHT - 18;
  drawOutlinedText("DEBUG" + (debugInvincible ? " · 무적" : ""), x, y, 16, "left", COLORS.yellow);
  drawOutlinedText("[ ] 웨이브  Shift+1~9 증강  Shift+0 체력  Shift+C 코인  I 무적  F2 끄기", x, y - 22, 13, "left");
  if (debugMessageTimer > 0 && debugMessage) {
    drawOutlinedText(debugMessage, x, y - 44, 15, "left", COLORS.green);
  }
}

// ---- 화면 전체 그리기 ----
function draw() {
  // 매 프레임 처음에: 게임 좌표 960 × 540 → 실제 픽셀로 확대하는 변환을 정한다
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  drawBackground(); // 배경 (가장 아래, 지난 프레임 그림도 덮어서 지워 준다)

  // 메뉴 화면은 따로 그리고 끝낸다
  if (gameState === "menu") {
    drawMenu();
    drawDebug();
    return;
  }
  // 업그레이드 화면도 따로 그리고 끝낸다
  if (gameState === "upgrades") {
    drawUpgradeScreen();
    drawDebug();
    return;
  }

  drawAugmentEffects(); // 증강 효과 범위 (바닥에 깔리듯이)
  drawBullets();    // 총알
  drawParticles();  // 파티클 (적 아래)
  drawEnemies();    // 적
  drawPlayer();     // 플레이어
  drawPopups();     // 대미지 숫자 (캐릭터들 위에)
  drawHud();        // 웨이브 번호, 체력바, 점수, 증강 목록
  drawBossBars();   // 보스 체력바
  drawBanner();     // 웨이브 시작 안내 띠
  drawChoiceScreen(); // 증강 카드 선택 화면
  drawOverlay();    // 게임 오버·클리어 안내
  drawPauseScreen(); // 일시정지 창 / 다시 움직이기 전 안내 (가장 위)
  drawDebug();      // 디버그 표시 (디버그 모드일 때만)
}


// =============================================================
// 9. 게임 루프 (게임의 심장)
// =============================================================

// 지난 프레임의 시각(밀리초)을 기억하는 변수
let lastTime = performance.now();

// 매 프레임마다 브라우저가 불러 주는 함수
function gameLoop(now) {
  // 지난 프레임 이후 흐른 시간(초). 밀리초 → 초로 바꾸려고 1000으로 나눈다.
  // 탭을 잠깐 다른 곳에 두었다 오면 dt가 너무 커지므로 최대 0.05초로 제한한다.
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt); // 1) 값 바꾸기
  draw();     // 2) 화면 그리기

  // 다음 프레임에도 gameLoop를 불러 달라고 브라우저에 부탁한다 (반복)
  requestAnimationFrame(gameLoop);
}

// 글꼴을 미리 불러 달라고 브라우저에 부탁한다.
// (캔버스는 글꼴이 준비되기 전엔 대체 글꼴로 그리고, 준비되면 다음 프레임부터 Jua로 그린다)
if (document.fonts) {
  document.fonts.load("20px Jua");
  document.fonts.load("20px 'Black Han Sans'");
}

// 캔버스를 창 크기에 맞추고, 메뉴 화면에서 시작해서 게임 루프를 돌린다!
fitCanvas();
goToMenu();
requestAnimationFrame(gameLoop);
