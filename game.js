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
  dark: "#4A3B2E",       // 어두운 갈색 (고르지 않은 탭)
  dim: "#8C8173",        // 흐린 회갈색 (고르지 않은 탭의 아이콘·글자)
  blue: "#4E8FC6",       // 파랑 (사수형)
  pink: "#D7739F",       // 분홍 (공명형)
  slate: "#6F7F8C",      // 쇳빛 회색 (방패형)
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
const PLAYER_SPEED = tune("PLAYER_SPEED", 220);

// 플레이어 가속도 (px/초²). 1초에 속도가 얼마나 빨리 바뀌는지.
// 800 이면 멈춰 있다가 최고 속도(220)까지 약 0.28초 걸린다.
// → 속도가 0 과 최고 속도 사이를 부드럽게 오가서, "시간 지연" 증강이
//   "얼마나 빠른지"에 따라 다르게 작동하는 것을 느낄 수 있다.
const PLAYER_ACCELERATION = 800;

// 플레이어 몸의 반지름 (픽셀). 얼굴을 그리기 위해 조금 크게 잡았다.
const PLAYER_RADIUS = 18;

// 플레이어 최대 체력 (게임을 시작할 때의 값. 보급 카드 "세포 분열"로 늘어날 수 있어서
// 게임 중에는 player.maxHp 를 쓴다)
const PLAYER_MAX_HP = tune("PLAYER_MAX_HP", 100);

// 체력이 최대 체력의 이 비율보다 낮으면, 카드 3장 중 1장은 반드시 보급 카드가 나온다
const LOW_HP_RATIO = 0.4;

// 웨이브를 깨면 최대 체력의 이 비율만큼 회복 (0.05 = 5%. 최대 체력까지만)
const WAVE_CLEAR_HEAL_RATIO = tune("WAVE_CLEAR_HEAL_RATIO", 0.05);

// 보스를 잡으면 최대 체력의 이 비율만큼 회복 (0.5 = 50%)
const BOSS_KILL_HEAL_RATIO = tune("BOSS_KILL_HEAL_RATIO", 0.5);

// 챕터 = 웨이브 몇 개 묶음인지 (5 이면 1~5웨이브가 챕터 1)
const WAVES_PER_CHAPTER = 5;

// 일시정지에서 "계속하기"를 누른 뒤 게임이 다시 움직이기까지 기다리는 시간 (초)
const RESUME_DELAY = 0.5;

// ---- 상태창(HUD) ----
// 펼친 상태창의 폭과 높이
const HUD_WIDTH = 290;
const HUD_HEIGHT = 132;
// 접은 상태창의 높이 (체력바와 웨이브 번호만 한 줄로)
const HUD_COLLAPSED_HEIGHT = 40;
// 상태창 · 증강 목록 · 보스 체력바 영역에 플레이어 · 적 · 적 탄환이 들어오면 그 창만 이 투명도로 (뒤가 보이게)
const HUD_FADE_ALPHA = 0.3;
// 투명도가 바뀌는 데 걸리는 시간 (초). 1 → 0.3 (또는 반대) 를 이 시간에 걸쳐 부드럽게
const HUD_FADE_TIME = 0.15;
// 체력바 길이: 최대 체력 100 일 때의 길이. 최대 체력에 비례해서 늘어나고, 상태창 폭에서 멈춘다
const HP_BAR_BASE_WIDTH = 140;
// 최대 체력이 늘었을 때 체력바가 번쩍이는 시간 (초)
const HP_FLASH_TIME = 1.0;
// 글자 팝업(최대 체력 +20, +N 회복)이 떠 있는 시간 (초)
const TEXT_POPUP_LIFE = 1.6;

// ---- 코인 (영구 업그레이드를 사는 돈) ----
// 전투 중 1초마다 버는 코인 = COIN_PER_SECOND × (1 + COIN_WAVE_BONUS × (웨이브 − 1))
//   1웨이브 1개/초, 5웨이브 1.6개/초, 30웨이브 5.35개/초
const COIN_PER_SECOND = tune("COIN_PER_SECOND", 1);
const COIN_WAVE_BONUS = tune("COIN_WAVE_BONUS", 0.15);
// 한 웨이브에서 코인이 쌓이는 시간은 최대 60초 (적을 일부러 남겨 두고 버티는 것을 막기 위해)
const COIN_WAVE_TIME_CAP = tune("COIN_WAVE_TIME_CAP", 60);
// 보스를 잡으면 보너스 코인 = 이 값 × 챕터 번호
const BOSS_COIN_BONUS = tune("BOSS_COIN_BONUS", 50);

// 자석형·블랙홀에게 끌려가는 속도가 저절로 줄어드는 정도 (1/초). 클수록 금방 멈춘다
//   (끌려가는 속도는 플레이어가 조종하는 속도와 따로 쌓인다. 당기는 힘 ÷ 이 값 = 계속 끌릴 때의 속도)
const PULL_FRICTION = 2;

// 맞은 뒤 잠깐 무적이 되는 시간 (초). 이 시간 동안은 또 맞지 않는다.
const PLAYER_INVINCIBLE_TIME = tune("PLAYER_INVINCIBLE_TIME", 0.6);

// ---- 과열: 한 웨이브를 너무 오래 끌면 적이 점점 빨라진다 (끝없이 도망만 다니는 것을 막는다) ----
// 웨이브 시작 후 이 시간(초)이 지나면 과열 시작
const ENRAGE_TIME = tune("ENRAGE_TIME", 40);
// 과열 중에는 살아 있는 모든 적의 속도가 1초마다 이 비율씩 빨라진다 (0.03 = 3%, 복리)
const ENRAGE_RATE = tune("ENRAGE_RATE", 0.03);
// 과열로 빨라져도 적의 속도는 플레이어 최고 속도의 이 배수를 넘지 않는다
const ENRAGE_MAX_PLAYER_RATIO = tune("ENRAGE_MAX_PLAYER_RATIO", 1.1);

// ---- 등장 예고: 적이 화면에 나오기 전에 나올 자리를 미리 보여 준다 ----
// 등장 이 시간(초) 전에 자리를 정해 두고, 화면 안쪽 가장자리에 빨간 세모 느낌표를 깜빡인다.
//   (등장 시각은 그대로. 0 으로 두면 예전처럼 나오는 순간에 자리를 정한다 → 예고 없음, 기록도 예전과 같다)
const SPAWN_WARN_TIME = tune("SPAWN_WARN_TIME", 0.8);
// 예고 표시를 화면 가장자리에서 이만큼 안쪽에 그린다 (px). 보스는 더 안쪽
const SPAWN_WARN_MARGIN = 28;
const SPAWN_WARN_BOSS_MARGIN = 58;
// 세모 크기 (px, 가운데에서 꼭짓점까지). 보스는 더 크게
const SPAWN_WARN_SIZE = 17;
const SPAWN_WARN_BOSS_SIZE = 30;
// 깜빡이는 빠르기 (번/초): 예고를 시작할 때 → 등장 직전
const SPAWN_WARN_BLINK_START = 3;
const SPAWN_WARN_BLINK_END = 12;
// 보스 예고: 등장 자리로 좁혀 드는 원의 처음 반지름 (px)
const SPAWN_WARN_BOSS_RING = 230;

// ---- 적 탄환 (사수형·보스가 쏘는 총알) ----
// 기본 속도 (px/초). 플레이어(220)보다 훨씬 느려서 보고 피할 수 있다
const ENEMY_BULLET_SPEED = 160;
// 충돌 반지름 (px)
const ENEMY_BULLET_RADIUS = 6;
// 화면에 남아 있는 최대 시간 (초). 이 시간이 지나면 저절로 사라진다
const ENEMY_BULLET_LIFE = 9;
// 그림 크기 배율 (충돌 반지름보다 이만큼 크게 그려서 잘 보이게)
const ENEMY_BULLET_DRAW_SCALE = 1.3;

// 자동 발사 간격 (초). 0.4 이면 1초에 2.5발
const FIRE_INTERVAL = tune("FIRE_INTERVAL", 0.4);

// 총알 속도 (px/초)
const BULLET_SPEED = tune("BULLET_SPEED", 480);

// 총알 반지름 (픽셀)
const BULLET_RADIUS = 5;

// 총알 뒤에 남는 꼬리 길이 (픽셀)
const BULLET_TAIL_LENGTH = 16;

// 총알 한 발의 기본 대미지 (업그레이드 0레벨 기준. 게임 중에는 player.damage 를 쓴다)
const BULLET_DAMAGE = tune("BULLET_DAMAGE", 10);

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

// ---- 돌연변이 카드 연출 ----
const MUTATION_CARD_DELAY = 0.35;   // 돌연변이 카드는 다른 카드보다 이만큼 (초) 한 박자 늦게 튀어나온다
const MUTATION_SHAKE_TIME = 0.45;   // 카드가 뜰 때 화면이 흔들리는 시간 (초)
const MUTATION_SHAKE_SIZE = 6;      // 흔들림 크기 (px)
const MUTATION_BORDER = 7;          // 돌연변이 카드의 보라 테두리 두께 (px)
const MUTATION_HELIX_ALPHA = 0.14;  // 카드 배경 DNA 이중 나선 무늬의 진하기

// 가진 증강이 이 개수 이상이면 오른쪽 위 목록을 2열로 작게 그린다
const AUGMENT_LIST_COMPACT_FROM = 5;

// 화면 위쪽 보스 체력바의 폭 (왼쪽 위 패널과 오른쪽 위 증강 목록 사이에 들어가게)
const BOSS_BAR_WIDTH = 300;

// 상태창의 보급 효과 아이콘 반지름과 간격 (px)
const EFFECT_ICON_RADIUS = 12;
const EFFECT_ICON_GAP = 30;

// ※ 적 한 마리 처치 점수 = 종류별 score(enemies.js) × 웨이브 번호

// 점수: 클리어했을 때 남은 체력 1 당 보너스 점수
const SCORE_PER_HP_LEFT = 10;

// ---- 로비(메뉴) 화면 배치 ----
// 버튼 위치와 크기는 여기 한 곳에만 적는다. 그리기와 클릭 판정이 모두 이 값을 쓴다.

// 위쪽 줄(코인·최고 웨이브·톱니 버튼)의 세로 가운데
const LOBBY_TOP_BAR_Y = 34;
// 오른쪽 위 설정 톱니 버튼 (가운데 x, y 와 반지름. 지름 44px)
const GEAR_BUTTON = { x: 922, y: LOBBY_TOP_BAR_Y, r: 22 };
// 가운데 큰 "게임 시작" 버튼 (로비에서 가장 큰 버튼)
const START_BUTTON = { x: 330, y: 248, w: 300, h: 90 };
// 시작 버튼이 숨 쉬듯 커졌다 작아지는 정도 (0.03 = 3%) 와 한 번 왕복하는 시간 (초)
const START_PULSE_AMOUNT = 0.03;
const START_PULSE_PERIOD = 1.5;

// 아래쪽 탭 바: 높이, 위쪽 끝 y, 고른 탭이 떠오르는 높이 (px)
const TAB_BAR_HEIGHT = 84;
const TAB_BAR_Y = CANVAS_HEIGHT - TAB_BAR_HEIGHT;
const TAB_ACTIVE_LIFT = 10;
// 탭 화면의 내용은 이 높이 위에서 끝나야 한다 (고른 탭이 떠오른 만큼 여유를 둔다)
const LOBBY_CONTENT_BOTTOM = TAB_BAR_Y - TAB_ACTIVE_LIFT - 4;

// 탭 목록. 탭을 늘리려면 여기에 한 줄 추가한다 (칸 폭은 자동으로 나눠진다).
//   id    : 탭 이름표 ("battle" = 로비, "upgrades" = 업그레이드 화면, "collection" = 도감)
//   label : 아이콘 아래 작은 글자
//   icon  : 코드로 그리는 아이콘 모양 ("book", "star", "arrow")
//   color : 골랐을 때의 밝은 색 (COLORS 이름)
//   locked: true 면 자물쇠가 그려지고 눌러도 열리지 않는다 (생략하면 열림)
const LOBBY_TABS = [
  { id: "collection", label: "도감", icon: "book", color: "purple" },
  { id: "battle", label: "전투", icon: "star", color: "yellow" },
  { id: "upgrades", label: "업그레이드", icon: "arrow", color: "green" },
];

// 설정 창 (가운데 패널) 크기
const SETTINGS_PANEL = { x: 170, y: 18, w: 620, h: 504 };
// 설정 창 오른쪽 칸: 항목(제목 + 버튼 + 설명) 하나의 높이 (px)
const SETTINGS_ROW = 92;

// 버튼 효과: 마우스를 올리면 밝아지는 정도, 누르면 작아지는 정도와 튕겨 돌아오는 시간 (초)
const BUTTON_HOVER_LIGHTEN = 0.18;
const BUTTON_PRESS_SHRINK = 0.08;
const BUTTON_PRESS_TIME = 0.25;

// 로비 화면 안내 글자가 잠깐 떠 있는 시간 (초)
const LOBBY_TOAST_TIME = 1.5;


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

// 모바일 조이스틱의 입력 (mobile.js 가 채운다). x, y 는 −1 ~ 1, active 는 손가락이 닿아 있는지
//   조이스틱을 끝까지 밀면 최고 속도, 반만 밀면 절반 속도로 움직인다
const touchStick = { x: 0, y: 0, active: false };
// 조이스틱을 이만큼(0.15)보다 덜 밀면 멈춘 것으로 본다 (손가락이 살짝 떨리는 것 무시)
const TOUCH_STICK_DEADZONE = 0.15;

// 키를 누르는 순간 실행되는 함수를 등록한다
window.addEventListener("keydown", function (event) {
  // 숫자 조절판·비밀번호 창(tuning.js), 디버그 지급 창이 떠 있으면 키는 그 창 몫이다
  if (isOverlayOpen() || isDebugGiveOpen() || isDebugBossOpen()) {
    if (isDebugGiveOpen() && (event.code === "Escape" || event.code === "KeyG")) closeDebugGivePanel();
    if (isDebugBossOpen() && (event.code === "Escape" || event.code === "KeyB")) closeDebugBossPanel();
    return;
  }

  // 눌린 키를 "눌림(true)"으로 기록한다
  keys[event.code] = true;

  // 디버그 모드 키 (F2 로 켜고 끈다). 처리한 키면 여기서 끝낸다
  if (handleDebugKey(event)) {
    event.preventDefault();
    return;
  }

  // Tab: 상태창 접기/펼치기 (전투·카드 선택 화면). Tab 이 다른 곳으로 초점을 옮기지 않게 막는다
  if (event.code === "Tab") {
    event.preventDefault();
    if ((gameState === "playing" && !paused) || gameState === "choosing") toggleHud();
    else if (gameState === "upgrades" && !settingsOpen) switchUpgradeSection();
    return;
  }

  // 전투 중: P 나 Esc 로 일시정지 / 계속하기 (카드 선택 화면에서는 일시정지가 필요 없다)
  if (gameState === "playing" && (event.code === "KeyP" || event.code === "Escape")) {
    if (paused) resumeGame();
    else pauseGame();
    event.preventDefault();
    return;
  }

  // 전투 중 Space: 장착한 스킬 쓰기
  if (gameState === "playing" && event.code === "Space") {
    tryUseSkill();
    event.preventDefault();
    return;
  }

  // 로비 화면들 (전투 탭·도감·업그레이드, 설정 창): 처리한 키면 여기서 끝낸다
  if (isLobbyState()) {
    if (handleLobbyKey(event.code)) {
      event.preventDefault();
      return;
    }
  }

  // 게임 오버나 클리어 화면: R 키 = 바로 다시 시작, M 키 = 로비(전투 탭)로, U 키 = 업그레이드 탭
  if (gameState === "gameover" || gameState === "clear") {
    if (event.code === "KeyR") {
      resetGame();
    } else if (event.code === "KeyM") {
      goToMenu();
    } else if (event.code === "KeyU") {
      goToMenu();
      openTab("upgrades");
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
// G        : 증강·보급 목록 창 (클릭해서 지급. 전투·카드 고르기 중에만)
// B        : 보스 선택 창 (클릭하면 그 보스 웨이브로 바로 전투. 로비에서도 된다)
// Shift+0  : 체력 가득 채우기
// Shift+C  : 코인 +1000
// I        : 무적 켜기/끄기
// K        : 스킬 전부 해금 + 쿨타임 없애기 켜기/끄기
// 디버그 모드가 꺼져 있으면 아래 기능은 전부 아무 영향이 없다.
// =============================================================

let debugMode = false;       // 디버그 모드가 켜져 있는지
let debugInvincible = false; // 디버그 무적이 켜져 있는지 (디버그 모드일 때만 효과)
let debugSkillCheat = false; // 디버그 K: 스킬 전부 해금 + 쿨타임 없음 (디버그 모드일 때만 효과)
let debugMessage = "";       // 화면 구석에 잠깐 보여 줄 디버그 알림
let debugMessageTimer = 0;   // 알림이 남은 시간 (초)

// 디버그 알림을 띄우는 함수
function debugSay(text) {
  debugMessage = text;
  debugMessageTimer = 2;
}

// 디버그 키를 처리하는 함수. 처리했으면 true 를 돌려준다.
function handleDebugKey(event) {
  // F2: 켜기/끄기 (켤 때는 주인 비밀번호가 필요하다. 끄는 것은 언제든)
  if (event.code === "F2") {
    if (debugMode) {
      debugMode = false;
      debugSay("");
    } else {
      // 전투 중이면 비밀번호를 넣는 동안 게임을 멈춰 둔다
      if (gameState === "playing" && !paused && !ownerUnlocked) pauseGame();
      requireOwner("디버그 모드", function () {
        debugMode = true;
        debugSay("디버그 모드 ON");
      });
    }
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
      enemyBullets = [];
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

  // B : 보스 선택 창 열기 (어느 화면에서나)
  if (event.code === "KeyB" && !event.shiftKey) {
    openDebugBossPanel();
    return true;
  }

  // G : 증강·보급 목록 창 열기 (전투 중이거나 카드 고르는 중에만)
  if (event.code === "KeyG" && !event.shiftKey) {
    if (inGame) openDebugGivePanel();
    else debugSay("증강 지급은 전투 중에만");
    return true;
  }

  // K : 스킬 전부 해금 + 쿨타임 없애기 토글 (저장은 바꾸지 않는다)
  if (event.code === "KeyK") {
    debugSkillCheat = !debugSkillCheat;
    if (debugSkillCheat) skillState.cooldown = 0;
    debugSay("스킬 전부 해금 · 쿨타임 없음 " + (debugSkillCheat ? "ON" : "OFF"));
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

// ---- 디버그: 증강·보급 지급 창 (G 키) ----
// HTML 로 만든 목록 창. 증강 버튼을 누르면 레벨 +1, 옆의 − 버튼은 레벨 −1 (0 이 되면 삭제),
// "모두 삭제" 는 가진 증강을 전부 지운다. 보급 버튼을 누르면 바로 사용한다.
// 전투 중에 열면 게임을 멈췄다가, 닫으면 다시 움직인다.

let debugGivePanel = null;      // 열려 있는 창 (닫혀 있으면 null)
let debugGivePaused = false;    // 이 창이 게임을 멈췄는지 (닫을 때 다시 움직이려고)

// 디버그 지급 창이 열려 있는지
function isDebugGiveOpen() {
  return debugGivePanel !== null;
}

// 증강 하나를 한 레벨 올린다 (최대 레벨이면 그대로)
function debugGiveAugment(aug) {
  const level = Math.min(getAugmentLevel(aug.id) + 1, aug.levels.length);
  ownedAugments[aug.id] = level;
  debugSay(aug.name + " Lv." + level);
}

// 증강 하나를 한 레벨 내린다 (Lv.1 에서 내리면 삭제)
function debugRemoveAugment(aug) {
  const level = getAugmentLevel(aug.id) - 1;
  if (level < 0) return;
  if (level === 0) { delete ownedAugments[aug.id]; delete mutatedAugments[aug.id]; }   // 지우면 돌연변이도 사라진다
  else ownedAugments[aug.id] = level;
  debugSay(level === 0 ? aug.name + " 삭제" : aug.name + " Lv." + level);
}

// 증강 하나의 돌연변이를 켜고 끈다 (가지고 있을 때만. 디버그라서 Lv.2 조건 · 최대 개수는 따지지 않고, 도감 기록도 남기지 않는다)
function debugToggleMutation(aug) {
  if (getAugmentLevel(aug.id) <= 0) return;
  if (isMutated(aug.id)) {
    delete mutatedAugments[aug.id];
    runMutations = runMutations.filter(function (id) { return id !== aug.id; });
    debugSay(aug.name + " 돌연변이 끔");
  } else {
    mutatedAugments[aug.id] = true;
    runMutations.push(aug.id);
    debugSay(aug.mutation.name + " 돌연변이 켬");
  }
}

// 가진 증강을 모두 지운다
function debugRemoveAllAugments() {
  ownedAugments = {};
  mutatedAugments = {};
  debugSay("증강 모두 삭제");
}

// 보급 카드 하나를 바로 사용한다
function debugGiveSupply(card) {
  applySupply(card);
  debugSay(card.name + " 사용");
}

function openDebugGivePanel() {
  if (debugGivePanel) return;
  if (gameState === "playing" && !paused) { pauseGame(); debugGivePaused = true; }
  const overlay = document.createElement("div");
  overlay.className = "tuning-overlay";
  const panel = document.createElement("div");
  panel.className = "tuning-panel debug-give";
  overlay.appendChild(panel);
  panel.innerHTML =
    '<div class="tuning-head"><span class="tuning-title">디버그 · 지급</span>' +
    '<button class="tuning-close" title="닫기 (Esc / G)">✕</button></div>' +
    '<p class="tuning-help">증강을 누르면 레벨 +1, − 를 누르면 레벨 −1 (Lv.1 에서 누르면 삭제), "변이" 는 돌연변이 켜기/끄기 (가진 증강만). 보급을 누르면 바로 사용해요. Esc 나 G 로 닫기</p>' +
    '<div class="tuning-list"><div class="tuning-group give-head">증강 <button class="tuning-btn give-clear">모두 삭제</button></div>' +
    '<div class="give-grid give-augments"></div>' +
    '<div class="tuning-group">보급</div><div class="give-grid give-supplies"></div></div>';

  // 버튼 글자를 지금 레벨에 맞게 다시 쓴다
  const refresh = function () {
    panel.querySelectorAll(".give-cell").forEach(function (cell, i) {
      const aug = AUGMENTS[i], lv = getAugmentLevel(aug.id), max = aug.levels.length;
      const plus = cell.querySelector(".give-plus"), minus = cell.querySelector(".give-minus"), mut = cell.querySelector(".give-mut");
      plus.innerHTML = aug.name + "<small>" + (lv >= max ? "Lv." + lv + " (MAX)" : "Lv." + lv + " → " + (lv + 1)) + "</small>";
      plus.disabled = lv >= max;
      plus.classList.toggle("give-owned", lv > 0);
      minus.disabled = lv <= 0;
      minus.title = lv === 1 ? "삭제" : "레벨 −1";
      // 돌연변이 버튼: 켜져 있으면 보라색, 가진 증강이 아니면 잠김
      mut.disabled = lv <= 0;
      mut.classList.toggle("give-mut-on", isMutated(aug.id));
      mut.title = (isMutated(aug.id) ? "돌연변이 끄기: " : "돌연변이 켜기: ") + aug.mutation.name;
      if (isMutated(aug.id)) plus.innerHTML = aug.mutation.name + "<small>" + aug.name + " · " + (lv >= max ? "Lv." + lv + " (MAX)" : "Lv." + lv + " → " + (lv + 1)) + "</small>";
    });
    panel.querySelector(".give-clear").disabled = Object.keys(ownedAugments).length === 0;
  };
  // 증강 칸: [이름 · 레벨 +1 버튼] [− 버튼] (AUGMENTS 순서)
  for (const aug of AUGMENTS) {
    const cell = document.createElement("div");
    cell.className = "give-cell";
    const plus = document.createElement("button");
    plus.className = "tuning-btn give-btn give-plus";
    plus.style.borderLeft = "12px solid " + COLORS[aug.color];
    plus.addEventListener("click", function () { debugGiveAugment(aug); refresh(); });
    const minus = document.createElement("button");
    minus.className = "tuning-btn give-minus";
    minus.textContent = "−";
    minus.addEventListener("click", function () { debugRemoveAugment(aug); refresh(); });
    const mut = document.createElement("button");
    mut.className = "tuning-btn give-mut";
    mut.textContent = "변이";
    mut.addEventListener("click", function () { debugToggleMutation(aug); refresh(); });
    cell.appendChild(plus);
    cell.appendChild(mut);
    cell.appendChild(minus);
    panel.querySelector(".give-augments").appendChild(cell);
  }
  panel.querySelector(".give-clear").addEventListener("click", function () { debugRemoveAllAugments(); refresh(); });
  // 보급 버튼
  for (const card of SUPPLIES) {
    const btn = document.createElement("button");
    btn.className = "tuning-btn give-btn";
    btn.style.borderLeft = "12px solid " + COLORS[card.color];
    btn.innerHTML = card.name + "<small>" + card.formula + "</small>";
    btn.addEventListener("click", function () { debugGiveSupply(card); });
    panel.querySelector(".give-supplies").appendChild(btn);
  }
  refresh();

  panel.querySelector(".tuning-close").addEventListener("click", closeDebugGivePanel);
  overlay.addEventListener("keydown", function (event) {
    event.stopPropagation();
    if (event.key === "Escape" || event.code === "KeyG") closeDebugGivePanel();
  });
  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay) closeDebugGivePanel();
  });
  // 창 밖(게임 화면)에서 누른 키도 창이 받게: 창에 초점을 준다
  overlay.tabIndex = -1;
  document.body.appendChild(overlay);
  debugGivePanel = overlay;
  overlay.focus();
}

function closeDebugGivePanel() {
  if (!debugGivePanel) return;
  debugGivePanel.remove();
  debugGivePanel = null;
  if (debugGivePaused && gameState === "playing" && paused) resumeGame();
  debugGivePaused = false;
}

// ---- 디버그: 보스 선택 창 (B 키) ----
// 보스가 나오는 웨이브(5, 10, 15, 20, 25, 30)를 버튼으로 보여 주고, 누르면 그 웨이브를 바로 시작한다.
// 로비나 결과 화면에서 누르면 새 판을 시작한 뒤 그 웨이브로 간다.

let debugBossPanel = null;      // 열려 있는 창 (닫혀 있으면 null)
let debugBossPaused = false;    // 이 창이 게임을 멈췄는지

function isDebugBossOpen() {
  return debugBossPanel !== null;
}

// 보스가 나오는 웨이브 목록 [{ wave, names }]
function bossWaveList() {
  const list = [];
  for (let i = 0; i < WAVES.length; i++) {
    const ids = waveBosses(WAVES[i]);
    if (ids.length) list.push({ wave: i + 1, names: ids.map(function (id) { return ENEMY_TYPES[id].name; }).join(" & ") });
  }
  return list;
}

// n 웨이브(보스 웨이브)를 바로 시작한다
function debugStartBossWave(n) {
  closeDebugBossPanel();
  if (gameState !== "playing" && gameState !== "choosing") startGame();
  enemies = [];
  bullets = [];
  enemyBullets = [];
  paused = false;
  resumeTimer = 0;
  startWave(n);
  debugSay(n + "웨이브 보스전 시작");
}

function openDebugBossPanel() {
  if (debugBossPanel) return;
  if (gameState === "playing" && !paused) { pauseGame(); debugBossPaused = true; }
  const overlay = document.createElement("div");
  overlay.className = "tuning-overlay";
  const panel = document.createElement("div");
  panel.className = "tuning-panel debug-give";
  overlay.appendChild(panel);
  panel.innerHTML =
    '<div class="tuning-head"><span class="tuning-title">디버그 · 보스 선택</span>' +
    '<button class="tuning-close" title="닫기 (Esc / B)">✕</button></div>' +
    '<p class="tuning-help">누르면 그 보스가 나오는 웨이브를 바로 시작해요 (지금 가진 증강은 그대로). Esc 나 B 로 닫기</p>' +
    '<div class="tuning-list"><div class="give-grid give-bosses"></div></div>';
  for (const item of bossWaveList()) {
    const btn = document.createElement("button");
    btn.className = "tuning-btn give-btn give-boss";
    btn.innerHTML = item.names + "<small>" + item.wave + "웨이브</small>";
    btn.addEventListener("click", function () { debugStartBossWave(item.wave); });
    panel.querySelector(".give-bosses").appendChild(btn);
  }
  panel.querySelector(".tuning-close").addEventListener("click", closeDebugBossPanel);
  overlay.addEventListener("keydown", function (event) {
    event.stopPropagation();
    if (event.key === "Escape" || event.code === "KeyB") closeDebugBossPanel();
  });
  overlay.addEventListener("mousedown", function (event) {
    if (event.target === overlay) closeDebugBossPanel();
  });
  overlay.tabIndex = -1;
  document.body.appendChild(overlay);
  debugBossPanel = overlay;
  overlay.focus();
}

function closeDebugBossPanel() {
  if (!debugBossPanel) return;
  debugBossPanel.remove();
  debugBossPanel = null;
  if (debugBossPaused && gameState === "playing" && paused) resumeGame();
  debugBossPaused = false;
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

  // 로비 화면들에서는 마우스가 올라간 버튼을 기억한다 (살짝 밝게 그리려고)
  hoverButton = isLobbyState() ? lobbyButtonAt(pos.x, pos.y) : null;

  // 업그레이드 화면·결과 화면·일시정지 버튼, 전투 중 상태창
  let otherHover = false;
  if (gameState === "playing") otherHover = paused ? pauseButtonAt(pos.x, pos.y) !== null : insideRect(pos.x, pos.y, hudPanelRect());
  if (gameState === "gameover" || gameState === "clear") otherHover = resultButtonAt(pos.x, pos.y) !== null;

  // 카드나 버튼 위에서는 마우스 모양을 손가락으로
  canvas.style.cursor = (hoverIndex >= 0 || hoverButton !== null || otherHover) ? "pointer" : "default";
});

// 마우스 버튼을 누르는 순간: 로비 버튼이면 "꾹" 작아지는 효과를 시작한다 (실행은 click 에서)
// 마우스 오른쪽 버튼: 전투 중 스킬 쓰기 (게임 화면 위에서는 브라우저 오른쪽 클릭 메뉴를 띄우지 않는다)
canvas.addEventListener("contextmenu", function (event) {
  event.preventDefault();
});
canvas.addEventListener("mousedown", function (event) {
  if (event.button === 2) {
    if (gameState === "playing") tryUseSkill();
    return;
  }
  if (!isLobbyState()) return;
  const pos = getMousePos(event);
  const id = lobbyButtonAt(pos.x, pos.y);
  if (id !== null) {
    pressedButton = id;
    pressTimer = BUTTON_PRESS_TIME;
  }
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
    } else if (insideRect(pos.x, pos.y, hudArrowRect())) {
      // 상태창 오른쪽 위 화살표 = 접기 / 펼치기
      toggleHud();
    } else if (insideRect(pos.x, pos.y, hudPanelRect())) {
      // 상태창의 나머지 부분 = 일시정지
      pauseGame();
    }
    return;
  }

  // 로비 화면들 (전투 탭·도감·업그레이드, 설정 창): 클릭한 버튼 실행
  if (isLobbyState()) {
    const id = lobbyButtonAt(pos.x, pos.y);
    if (id !== null) runLobbyButton(id);
    return;
  }

  // 증강 선택 화면: 클릭한 카드 고르기 (상태창 화살표는 여기서도 접기/펼치기)
  if (gameState === "choosing") {
    if (insideRect(pos.x, pos.y, hudArrowRect())) { toggleHud(); return; }
    const index = cardIndexAt(pos.x, pos.y);
    if (index >= 0) chooseAugment(index);
    return;
  }

  // 결과 화면: 다시 시작 / 업그레이드 / 메뉴 버튼
  if (gameState === "gameover" || gameState === "clear") {
    const button = resultButtonAt(pos.x, pos.y);
    if (button === "retry") resetGame();
    else if (button === "upgrades") { goToMenu(); openTab("upgrades"); }
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

// 적이 쏜 총알들의 목록 (배열). 플레이어 총알(bullets)과 따로 관리한다
let enemyBullets = [];

// 떠오르는 대미지 숫자들의 목록 (배열)
let popups = [];

// 복리 탄환용 기록: 마지막으로 맞힌 적과, 그 적을 연속으로 맞힌 횟수 n
let lastHitEnemy = null;
let hitStreak = 0;

// 튀어 나가는 파티클(조각)들의 목록 (배열)
let particles = [];

// 다음 적이 나타날 때까지 남은 시간 (초)
let spawnTimer = 0;

// 등장 예고: 다음 무리의 자리를 미리 정해 둔 목록 (아직 화면에 없는 적)
//   { type, x, y, boss, time: 등장까지 남은 초, total: 예고를 시작할 때 남은 초, phase: 깜빡임 박자 }
//   보통 적은 spawnQueue 에서 꺼내 여기로 옮겨 두고, 시간이 되면 그 자리에 만든다.
//   보스는 bossQueue 에 그대로 두고 그림용으로만 여기에 적어 둔다 (boss: true)
let pendingSpawns = [];
// 이번 무리의 자리를 이미 정해 두었는지
let batchReserved = false;
// 보스 자리 예고를 이미 했는지
let bossWarned = false;

// 이번 웨이브가 시작된 뒤 흐른 전투 시간 (초). 과열(ENRAGE_TIME)을 잴 때 쓴다
let waveTime = 0;

// 게임 상태: 지금 어떤 화면인지 기억하는 변수
//   "menu"      : 로비의 전투 탭 (처음 화면)
//   "upgrades"  : 로비의 업그레이드 탭 (영구 업그레이드)
//   "collection": 로비의 도감 탭
//   "playing"   : 전투 중
//   "choosing"  : 웨이브 사이, 증강 카드를 고르는 중
//   "gameover"  : 체력이 0이 되어 게임 오버
//   "clear"     : 마지막 웨이브까지 모두 통과
let gameState = "menu";

// 로비 화면이 열린 뒤 흐른 시간 (초). 장식 캐릭터가 둥실거리고 시작 버튼이 숨 쉬는 애니메이션에 사용
let menuTime = 0;

// 설정 창이 열려 있는지 (로비 화면 위에 겹쳐 뜬다. 탭이 아니다)
let settingsOpen = false;

// 마우스가 올라가 있는 로비 버튼 이름표 (없으면 null), 눌린 버튼과 눌림 효과 남은 시간 (초)
let hoverButton = null;
let pressedButton = null;
let pressTimer = 0;

// 탭마다 지금 떠오른 높이 (px). 고른 탭 쪽으로 부드럽게 따라간다 (그림 전용 값)
let tabLift = LOBBY_TABS.map(function () { return 0; });

// 로비 아래쪽에 잠깐 뜨는 알림 글자와 남은 시간 (예: "코인이 모자라요!")
let lobbyToast = "";
let lobbyToastTimer = 0;

// 체력바가 번쩍이는 남은 시간 (초)
let hpFlashTimer = 0;

// 창마다 지금 투명도 (1 = 보통, HUD_FADE_ALPHA = 반투명). 그림 전용 값 (게임 진행에는 쓰지 않는다)
let hudFade = { hud: 1, aug: 1, boss: 1 };

// 발동 스킬 (skills.js) 의 이번 판 상태
//   cooldown  : 다시 쓸 수 있을 때까지 남은 시간 (초, 0 이면 준비됨)
//   bounce    : 준비됐을 때 아이콘이 튀어 오르는 남은 시간 (초)
//   deny      : 쿨타임 중에 눌렀을 때 아이콘이 흔들리는 남은 시간 (초)
//   dashTime · dashVx · dashVy · trail : 관성 질주 (남은 돌진 시간, 돌진 속도, 잔상 자리)
//   rings     : 충격파 그림 (퍼지는 고리) / freezeTime : 절대 영도 남은 시간 (초)
function newSkillState() {
  return { cooldown: 0, bounce: 0, deny: 0, dashTime: 0, dashVx: 0, dashVy: 0, trail: [], rings: [], freezeTime: 0 };
}
let skillState = newSkillState();

// 이번 판의 코인을 이미 저장했는지 (두 번 저장하지 않으려고)
let runCommitted = false;

// 이번 판을 저장하기 직전의 최고 웨이브 (결과 화면 "지난 최고 기록: 웨이브 N → 이번: 웨이브 M")
let runPrevBestWave = 0;

// 결과 화면이 열린 뒤 흐른 시간 (초). 신기록 스티커·업그레이드 버튼이 콩닥거리는 애니메이션에 사용
let resultTime = 0;

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
// 지금 웨이브에서 한 번에 나오는 졸개 수 (보통 WAVE_SPAWN_BATCH, 보스 웨이브는 1)
let currentSpawnBatch = WAVE_SPAWN_BATCH;

// 안내 띠가 보스 안내인지 (보스 안내면 띠 색이 빨강)
let bannerIsBoss = false;
let bannerIsMutation = false;   // 돌연변이를 얻은 직후의 안내 띠는 보라색

// 플레이어가 가진 증강과 레벨을 기억하는 상자
// 예: { compound: 2, variance: 1 } → 복리 탄환 Lv.2, 분산 증폭 Lv.1
let ownedAugments = {};

// 돌연변이 (augments.js 의 mutation): 이번 판에 돌연변이한 증강 { id: true }, 얻은 순서 (결과 화면에 보여 준다)
let mutatedAugments = {};
let runMutations = [];
// 이번 웨이브에 보스를 잡았는지 (잡은 직후의 카드 선택은 돌연변이 확률이 MUTATION_BOSS_CHANCE)
let bossKilledThisWave = false;

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

// 플레이어를 당기는 적들(자석형, 블랙홀)의 가속도를 모두 더한다 { ax, ay }
// 적 종류에 pullOn(enemy, x, y) 이 있으면 그 적이 주는 가속도를 돌려준다
function enemyPullOnPlayer() {
  let ax = 0, ay = 0;
  for (const enemy of enemies) {
    const type = enemyType(enemy);
    if (!type.pullOn || enemy.dead) continue;
    const a = type.pullOn(enemy, player.x, player.y);
    // 절대 영도 · 시간 정지 중이면 끌어당기는 힘도 그만큼 느려진다 (평소엔 × 1)
    const slow = worldSlowFactor(type.isBoss);
    ax += a.ax * slow;
    ay += a.ay * slow;
  }
  return { ax: ax, ay: ay };
}

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

  // 모바일 조이스틱을 쓰고 있으면 그 방향과 세기(0 ~ 1)를 그대로 쓴다
  const stick = Math.hypot(touchStick.x, touchStick.y);
  if (touchStick.active && stick > TOUCH_STICK_DEADZONE) {
    const power = Math.min(1, stick);
    dirX = (touchStick.x / stick) * power;
    dirY = (touchStick.y / stick) * power;
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

  // 자석형·블랙홀이 당기는 힘: 끌려가는 속도(pullVx, pullVy)를 따로 쌓고, 마찰로 조금씩 줄인다
  const pull = enemyPullOnPlayer();
  const keep = Math.exp(-PULL_FRICTION * dt);
  player.pullVx = ((player.pullVx || 0) + pull.ax * dt) * keep;
  player.pullVy = ((player.pullVy || 0) + pull.ay * dt) * keep;

  if (skillState.dashTime > 0) {
    // 관성 질주: 돌진하는 동안은 돌진 속도로만 움직인다 (정해진 거리를 정해진 시간에)
    const step = Math.min(dt, skillState.dashTime);
    skillState.trail.push({ x: player.x, y: player.y });
    player.x += skillState.dashVx * step;
    player.y += skillState.dashVy * step;
    skillState.dashTime -= step;
  } else {
    // 위치 = 위치 + (조종 속도 + 끌려가는 속도) × 시간
    player.x += (player.vx + player.pullVx) * dt;
    player.y += (player.vy + player.pullVy) * dt;
  }

  // 화면 밖으로 나가지 않게 가둔다 (몸의 반지름만큼 안쪽까지만 허용)
  const clampedX = clamp(player.x, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
  const clampedY = clamp(player.y, PLAYER_RADIUS, CANVAS_HEIGHT - PLAYER_RADIUS);

  // 벽에 막혔으면 그 방향 속도는 0 (벽을 밀고 있는 건 "움직이는 것"이 아니다)
  if (clampedX !== player.x) { player.vx = 0; player.pullVx = 0; }
  if (clampedY !== player.y) { player.vy = 0; player.pullVy = 0; }
  player.x = clampedX;
  player.y = clampedY;
}

// 지금 누르고 있는 이동 방향 { x, y } (길이 1, 안 누르면 0, 0). 키보드 · 모바일 조이스틱 (관성 질주 방향)
function moveInputDir() {
  let x = 0, y = 0;
  if (keys["KeyA"] || keys["ArrowLeft"]) x -= 1;
  if (keys["KeyD"] || keys["ArrowRight"]) x += 1;
  if (keys["KeyW"] || keys["ArrowUp"]) y -= 1;
  if (keys["KeyS"] || keys["ArrowDown"]) y += 1;
  const stick = Math.hypot(touchStick.x, touchStick.y);
  if (touchStick.active && stick > TOUCH_STICK_DEADZONE) { x = touchStick.x; y = touchStick.y; }
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

// 화면 가장자리(위·아래·왼쪽·오른쪽 중 하나)에 typeId 종류의 적 하나를 만든다
// side 를 주면 그 변에서 (0 위, 1 아래, 2 왼쪽, 3 오른쪽), 안 주면 무작위 변에서 나온다
function spawnEnemy(typeId, side) {
  const p = edgeSpawnPoint(typeId, side);
  // 적 객체를 만들어(enemies.js 의 createEnemy) 목록에 추가한다
  enemies.push(createEnemy(typeId, p.x, p.y, wave));
}

// typeId 종류가 나타날 화면 바로 바깥 자리 { x, y } (난수 쓰는 순서는 예전 spawnEnemy 와 같다)
function edgeSpawnPoint(typeId, side) {
  const r = ENEMY_TYPES[typeId].radius; // 이 종류의 몸 반지름

  // 변을 정하지 않았으면 0, 1, 2, 3 중 하나를 무작위로 뽑는다
  if (side === undefined) side = Math.floor(Math.random() * 4);

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
  return { x: x, y: y };
}

// 웨이브 동안 대기열의 적을 하나씩 만드는 함수
function updateSpawning(dt) {
  // 예고 표시의 남은 시간 · 깜빡임 박자 (그림 전용. 게임 진행에는 쓰지 않는다)
  for (const w of pendingSpawns) {
    w.time = Math.max(0, w.time - dt);
    const t = w.total > 0 ? 1 - w.time / w.total : 1;   // 0 → 1 (등장이 가까울수록 1)
    w.phase += dt * (SPAWN_WARN_BLINK_START + (SPAWN_WARN_BLINK_END - SPAWN_WARN_BLINK_START) * t);
  }

  // 보스가 기다리고 있으면: 시간이 되면 화면 위쪽에서 한꺼번에 등장
  if (bossQueue.length > 0) {
    bossTimer -= dt;
    // 등장 SPAWN_WARN_TIME 초 전: 보스 자리 예고 (보스 자리는 정해져 있어 난수를 쓰지 않는다)
    if (!bossWarned && bossTimer > 0 && bossTimer <= SPAWN_WARN_TIME) {
      bossWarned = true;
      for (let i = 0; i < bossQueue.length; i++) {
        const type = ENEMY_TYPES[bossQueue[i]];
        pendingSpawns.push({ type: bossQueue[i], x: (CANVAS_WIDTH * (i + 1)) / (bossQueue.length + 1), y: -type.radius,
          boss: true, time: bossTimer, total: bossTimer, phase: 0 });
      }
    }
    if (bossTimer <= 0) {
      pendingSpawns = pendingSpawns.filter(function (w) { return !w.boss; });
      // 보스가 여러 마리면 화면 폭을 (마릿수 + 1) 칸으로 나눠 나란히 세운다
      for (let i = 0; i < bossQueue.length; i++) {
        const type = ENEMY_TYPES[bossQueue[i]];
        const x = (CANVAS_WIDTH * (i + 1)) / (bossQueue.length + 1);
        enemies.push(createEnemy(bossQueue[i], x, -type.radius, wave));
      }
      bossQueue = [];
    }
  }

  // 이번 웨이브의 졸개를 이미 다 만들었으면 할 일이 없다 (자리를 정해 둔 무리가 남았으면 마저 기다린다)
  if (spawnQueue.length === 0 && !batchReserved) return;

  // 남은 시간을 흐른 시간만큼 줄인다
  spawnTimer -= dt;

  // 등장 SPAWN_WARN_TIME 초 전: 다음 무리를 대기열에서 꺼내 자리를 정해 둔다 (등장 시각은 그대로)
  if (!batchReserved && spawnTimer > 0 && spawnTimer <= SPAWN_WARN_TIME && spawnQueue.length > 0) {
    reserveBatch(currentSpawnBatch, spawnTimer);
    batchReserved = true;
  }

  // 시간이 다 됐으면 한 무리를 만든다
  if (spawnTimer <= 0) {
    if (batchReserved) spawnReserved();          // 미리 정해 둔 자리에
    else spawnBatch(currentSpawnBatch);          // (예고 시간이 0 이면 예전과 똑같이 지금 자리를 정한다)
    batchReserved = false;
    spawnTimer = currentSpawnInterval; // 타이머를 다시 채운다
  }
}

// 다음 무리 count 마리의 자리를 미리 정해 둔다 (spawnBatch 와 같은 규칙: 서로 다른 변, 한 마리면 무작위 변)
function reserveBatch(count, timeLeft) {
  const add = function (typeId, side) {
    const p = edgeSpawnPoint(typeId, side);
    pendingSpawns.push({ type: typeId, x: p.x, y: p.y, boss: false, time: timeLeft, total: timeLeft, phase: 0 });
  };
  if (count <= 1) {
    add(spawnQueue.shift());
    return;
  }
  const sides = shuffle([0, 1, 2, 3]);
  for (let i = 0; i < count && spawnQueue.length > 0; i++) {
    add(spawnQueue.shift(), sides[i % sides.length]);
  }
}

// 미리 정해 둔 자리에 적을 만든다 (보스 예고는 그대로 둔다)
function spawnReserved() {
  const keep = [];
  for (const w of pendingSpawns) {
    if (w.boss) keep.push(w);
    else enemies.push(createEnemy(w.type, w.x, w.y, wave));
  }
  pendingSpawns = keep;
}

// 대기열에서 count 마리를 꺼내 "서로 다른 변"에서 동시에 나오게 한다 (둘러싸는 느낌)
function spawnBatch(count) {
  // 한 마리씩 나오는 웨이브는 예전처럼 무작위 변에서
  if (count <= 1) {
    spawnEnemy(spawnQueue.shift());
    return;
  }
  // 네 변의 순서를 섞어서 앞에서부터 하나씩 쓴다 (4마리가 넘으면 다시 처음 변부터)
  const sides = shuffle([0, 1, 2, 3]);
  for (let i = 0; i < count && spawnQueue.length > 0; i++) {
    spawnEnemy(spawnQueue.shift(), sides[i % sides.length]);
  }
}

// 표의 마릿수에 WAVE_COUNT_MULT 를 곱한 실제 마릿수 (반올림)
// waveNumber 가 6 이상이면 WAVE_COUNT_MULT_LATE 도 곱한다 (주지 않으면 지금 웨이브)
function scaledCount(count, waveNumber) {
  const w = waveNumber === undefined ? wave : waveNumber;
  const late = w >= LATE_WAVE_FROM ? WAVE_COUNT_MULT_LATE : 1;
  return Math.round(count * WAVE_COUNT_MULT * late);
}

// 지금 과열 배율: 과열 전에는 1, 과열이 시작되면 1초마다 (1 + ENRAGE_RATE) 배씩
function enrageMult() {
  if (waveTime <= ENRAGE_TIME) return 1;
  return Math.pow(1 + ENRAGE_RATE, waveTime - ENRAGE_TIME);
}

// 과열 중인지 (화면 위 "과열!" 경고)
function isEnraged() {
  return gameState === "playing" && waveTime > ENRAGE_TIME;
}

// 이 적이 과열로 받는 속도 배율. 플레이어 최고 속도 × ENRAGE_MAX_PLAYER_RATIO 를 넘지 않게 자른다
function enrageFactor(enemy) {
  const mult = enrageMult();
  if (mult === 1) return 1;
  const cap = (ENRAGE_MAX_PLAYER_RATIO * PLAYER_SPEED) / enemy.speed;  // 이 적이 낼 수 있는 최대 배율
  return Math.max(1, Math.min(mult, cap));
}

// n번째 웨이브를 시작하는 함수
function startWave(n) {
  wave = n;
  bossKilledThisWave = false;

  // 대기열 만들기: 배열은 0번 칸부터 시작하므로 n번째 웨이브는 WAVES[n - 1]
  // 묶음 { type, count } 마다 type 을 count 번 줄 세운다
  const waveDef = WAVES[n - 1];
  spawnQueue = [];
  // 등장 예고도 처음부터 (디버그로 웨이브를 옮길 때 남은 예고를 지운다)
  pendingSpawns = [];
  batchReserved = false;
  bossWarned = false;
  // 이번 웨이브의 묶음을 하나씩 보는 반복문
  for (const group of waveGroups(waveDef)) {
    // 같은 종류를 count 마리만큼 줄 뒤에 붙이는 반복문
    for (let i = 0; i < scaledCount(group.count, n); i++) {
      spawnQueue.push(group.type);
    }
  }
  // mix: true 인 웨이브는 대기열을 섞어서 여러 종류가 뒤섞여 나오게 한다
  if (waveIsMixed(waveDef)) {
    shuffle(spawnQueue);
  }
  // 새 웨이브: 이 웨이브에서 코인이 쌓인 시간, 과열 시계를 0 부터 다시 잰다
  waveCoinTime = 0;
  waveTime = 0;

  // 보스 웨이브인지 확인
  bossQueue = waveBosses(waveDef).slice();
  if (bossQueue.length > 0) {
    bossTimer = BOSS_SPAWN_DELAY;                              // 2초 뒤 보스 등장
    currentSpawnInterval = BOSS_MINION_INTERVAL;               // 졸개는 3초 간격
    currentSpawnBatch = 1;                                     // 보스 웨이브의 졸개는 한 마리씩
    spawnTimer = BOSS_SPAWN_DELAY + BOSS_MINION_INTERVAL;      // 첫 졸개는 보스 등장 3초 뒤
  } else {
    currentSpawnInterval = WAVE_SPAWN_INTERVAL;
    currentSpawnBatch = WAVE_SPAWN_BATCH;
    spawnTimer = 1.0;       // 1초 뒤 첫 무리 등장
  }
  gameState = "playing";

  // 화면 위에 "웨이브 n" 안내 띠를 띄운다. 처음 나오는 적이 있으면 이름도 함께
  bannerText = "웨이브 " + n;
  bannerIsBoss = bossQueue.length > 0;
  bannerIsMutation = false;
  if (bannerIsBoss) {
    // 보스 웨이브: "웨이브 5 · 보스: 돌진 대장!" (여러 마리면 "A & B", 마지막 웨이브면 "최종 보스")
    const names = bossQueue.map(function (id) { return ENEMY_TYPES[id].name; });
    bannerText += (n === WAVES.length ? " · 최종 보스: " : " · 보스: ") + names.join(" & ") + "!";
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
      work(aug, augmentStats(aug, level));
    }
  }
}

// ---- 돌연변이 ----

// 이 증강이 이번 판에 돌연변이했는지
function isMutated(id) {
  return mutatedAugments[id] === true;
}

// 증강 aug 의 level 레벨 수치. 돌연변이했으면 levels 의 값 위에 mutation.stats 를 덮고 mutated: true 를 붙인 것
// (매번 새로 만들지 않게, 레벨 칸 하나마다 한 번만 만들어 기억해 둔다)
const mutatedStatsCache = new WeakMap();
function augmentStats(aug, level) {
  const stats = aug.levels[level - 1];   // levels 는 0번 칸이 Lv.1
  if (!isMutated(aug.id)) return stats;
  let merged = mutatedStatsCache.get(stats);
  if (!merged) {
    merged = Object.assign({}, stats, (aug.mutation && aug.mutation.stats) || {}, { mutated: true });
    mutatedStatsCache.set(stats, merged);
  }
  return merged;
}

// 지금 돌연변이할 수 있는 증강 목록: Lv.MUTATION_MIN_LEVEL 이상, 아직 돌연변이 안 함, 이번 판 돌연변이가 MUTATION_MAX 개 미만
// (보급 카드는 증강이 아니라서 처음부터 후보가 아니다)
function mutationCandidates() {
  if (Object.keys(mutatedAugments).length >= MUTATION_MAX) return [];
  return AUGMENTS.filter(function (aug) {
    return aug.mutation && getAugmentLevel(aug.id) >= MUTATION_MIN_LEVEL && !isMutated(aug.id);
  });
}

// 돌연변이 카드 한 장 (카드 화면이 쓰는 이름 · 개념 · 수식 · 설명은 mutation 의 것)
function makeMutationCard(aug) {
  const m = aug.mutation;
  return { isMutation: true, aug: aug, id: aug.id + ":mutation", name: m.name, concept: m.concept, formula: m.formula, desc: m.desc, color: "purple" };
}

// 증강 aug 를 돌연변이시킨다 (레벨은 그대로, 앞으로 레벨업도 된다). 도감 기록도 남긴다
function mutateAugment(aug) {
  if (isMutated(aug.id)) return;
  mutatedAugments[aug.id] = true;
  runMutations.push(aug.id);
  if (saveData.seenMutations.indexOf(aug.id) < 0) {
    saveData.seenMutations.push(aug.id);
    writeSave();
  }
}

// [훅] onUpdate: 전투 중 매 프레임 한 번, 가진 증강에게 시간이 흘렀다고 알린다 (시간 정지 · 효소 · 특이점 시계)
function updateAugments(dt) {
  forEachOwnedAugment(function (aug, stats) {
    if (aug.onUpdate) aug.onUpdate(stats, dt);
  });
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
  // (회복해 주는 보급(rescue: true) 중에서 고른다)
  const rescue = SUPPLIES.filter(function (card) { return card.rescue; });
  if (lowHp && !hasSupply && rescue.length > 0) {
    const supply = rescue[Math.floor(Math.random() * rescue.length)];
    if (picks.length < CHOICE_COUNT) picks.push(supply);
    else picks[picks.length - 1] = supply;
  }

  // 4) 돌연변이: 후보(Lv.2 이상 증강)가 있으면 확률 MUTATION_CHANCE (보스를 잡은 직후는 MUTATION_BOSS_CHANCE) 로
  //    3장 중 1장이 돌연변이 카드로 바뀐다. 후보가 없거나 확률이 0 이면 난수를 쓰지 않는다 (= 예전과 완전히 같은 뽑기)
  const mutants = mutationCandidates();
  const chance = bossKilledThisWave ? MUTATION_BOSS_CHANCE : MUTATION_CHANCE;
  if (mutants.length > 0 && chance > 0 && Math.random() < chance) {
    const aug = mutants[Math.floor(Math.random() * mutants.length)];
    picks[mutationSlot(picks, aug)] = makeMutationCard(aug);
  }
  return picks;
}

// 돌연변이 카드가 들어갈 자리
//   같은 증강의 레벨업 카드가 있으면 그 자리 (같은 증강 카드가 두 장 나오지 않게)
//   없으면 보급이 아닌 카드 중 무작위 (체력이 낮을 때 넣은 회복 카드는 남긴다), 그것도 없으면 회복 카드가 아닌 자리
function mutationSlot(picks, aug) {
  if (picks.length === 0) return 0;
  const same = picks.indexOf(aug);
  if (same >= 0) return same;
  let slots = [];
  for (let i = 0; i < picks.length; i++) if (!picks[i].isSupply) slots.push(i);
  if (slots.length === 0) for (let i = 0; i < picks.length; i++) if (!picks[i].rescue) slots.push(i);
  if (slots.length === 0) return picks.length - 1;
  return slots[Math.floor(Math.random() * slots.length)];
}

// 웨이브를 깼을 때 회복하는 양 (함수로 둔 이유: 나중에 증강이나 난이도로 바꾸기 쉽게)
function waveClearHeal() {
  return player.maxHp * (WAVE_CLEAR_HEAL_RATIO + (player.healBonus || 0));
}

// ---- 임시 효과 ("다음 웨이브 동안" 만 유지되는 보급 효과) ----
// player.tempEffects 의 한 칸 = { id, ...그 효과의 값 }. 웨이브를 깨는 순간 모두 사라진다.

// 임시 효과를 더한다 (같은 id 가 있으면 새것으로 바꾼다)
function addTempEffect(id, data) {
  player.tempEffects = (player.tempEffects || []).filter(function (e) { return e.id !== id; });
  player.tempEffects.push(Object.assign({ id: id }, data || {}));
}

// id 임시 효과 (없으면 null)
function getTempEffect(id) {
  const list = player.tempEffects || [];
  for (const e of list) if (e.id === id) return e;
  return null;
}

// id 임시 효과를 지운다
function removeTempEffect(id) {
  player.tempEffects = (player.tempEffects || []).filter(function (e) { return e.id !== id; });
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

// 보급 카드 하나의 효과를 쓴다 (카드 선택, 디버그 지급)
// 효과 전후의 체력을 비교해서, 얼마나 바뀌었는지 플레이어 위에 글자로 띄운다
function applySupply(card) {
  const beforeMax = player.maxHp, beforeHp = player.hp;
  card.apply();
  const gainMax = player.maxHp - beforeMax;
  const healed = player.hp - beforeHp;
  if (gainMax > 0) {
    spawnTextPopup(player.x, player.y - PLAYER_RADIUS - 18, "최대 체력 +" + Math.round(gainMax), COLORS.green);
    hpFlashTimer = HP_FLASH_TIME;       // 체력바가 잠깐 번쩍인다
  } else if (healed > 0) {
    spawnTextPopup(player.x, player.y - PLAYER_RADIUS - 18, "+" + Math.round(healed) + " 회복", COLORS.green);
  }
}

// index 번째 카드를 골랐을 때 실행되는 함수
function chooseAugment(index) {
  // 카드가 막 나타난 직후의 입력은 무시한다 (실수 방지)
  if (choosingTime < CHOICE_INPUT_DELAY) return;
  // 없는 번호면 무시 (예: 카드가 2장뿐인데 3번 키를 누른 경우)
  if (index < 0 || index >= choices.length) return;

  const aug = choices[index];
  canvas.style.cursor = "default";

  // 돌연변이 카드: 그 증강이 돌연변이한다 (레벨은 그대로)
  if (aug.isMutation) {
    mutateAugment(aug.aug);
    startWave(wave + 1);
    bannerSubText = "돌연변이: " + aug.name + "!";
    bannerIsMutation = true;
    return;
  }

  // 보급 카드: 레벨 없이 바로 효과만 쓰고 끝 (몇 번이든 고를 수 있다)
  if (aug.isSupply) {
    applySupply(aug);
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
  resultTime = 0;
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
  runPrevBestWave = saveData.bestWave;
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

// ---- 로비 (메뉴) ----

// 지금이 로비 화면들(전투 탭·도감·업그레이드) 중 하나인지
function isLobbyState() {
  return gameState === "menu" || gameState === "upgrades" || gameState === "collection";
}

// 지금 화면에 맞는 탭 이름표 (전투 탭 = "menu" 상태)
function currentTabId() {
  return gameState === "menu" ? "battle" : gameState;
}

// 로비(전투 탭)로 가는 함수 (처음 켰을 때, 결과 화면의 M, 일시정지 창의 "로비로")
// 판에서 쓰던 적·총알 등을 깨끗이 치운다
function goToMenu() {
  paused = false;
  resumeTimer = 0;
  menuTime = 0;
  settingsOpen = false;
  resetArmTimer = 0;
  lobbyToast = "";
  lobbyToastTimer = 0;
  enemies = [];
  pendingSpawns = [];
  bullets = [];
  enemyBullets = [];
  popups = [];
  particles = [];
  openTab("battle");
  // 탭 높이는 바로 제자리로 (판에서 돌아올 때는 떠오르는 애니메이션 없이)
  tabLift = LOBBY_TABS.map(function (t) { return t.id === "battle" ? TAB_ACTIVE_LIFT : 0; });
}

// 탭 하나를 연다 (탭 클릭, ←→ 키, 결과 화면의 U)
// 잠긴 탭이나 없는 탭이면 아무것도 하지 않는다
function openTab(id) {
  const tab = LOBBY_TABS.find(function (t) { return t.id === id; });
  if (!tab || tab.locked) return;
  if (id === "battle") gameState = "menu";
  else if (id === "upgrades") openUpgrades();
  else if (id === "collection") gameState = "collection";
}

// 지금 탭에서 왼쪽(-1) / 오른쪽(+1) 으로 옮긴다. 잠긴 탭은 건너뛴다
function moveTab(step) {
  const n = LOBBY_TABS.length;
  let i = LOBBY_TABS.findIndex(function (t) { return t.id === currentTabId(); });
  // 한 칸씩 옮기다가 열린 탭을 만나면 멈추는 반복문 (끝에서는 멈춘다)
  for (let k = 0; k < n; k++) {
    i += step;
    if (i < 0 || i >= n) return;
    if (!LOBBY_TABS[i].locked) { openTab(LOBBY_TABS[i].id); return; }
  }
}

// 로비에서 "게임 시작" (시작 버튼, Enter / Space)
function startGame() {
  canvas.style.cursor = "default";
  settingsOpen = false;
  resetGame();
}

// 설정 창 열기 / 닫기
function openSettings() {
  settingsOpen = true;
  resetArmTimer = 0;
}
function closeSettings() {
  settingsOpen = false;
  resetArmTimer = 0;     // 닫으면 "한 번 더 누르면 초기화" 대기도 취소
}

// 로비에서 키를 눌렀을 때. 처리한 키면 true 를 돌려준다
function handleLobbyKey(code) {
  // 설정 창이 열려 있으면 Esc 로 닫기만 한다 (뒤의 화면은 키를 받지 않는다)
  if (settingsOpen) {
    if (code === "Escape") closeSettings();
    return true;
  }
  if (code === "ArrowLeft") { moveTab(-1); return true; }
  if (code === "ArrowRight") { moveTab(1); return true; }

  if (gameState === "menu") {
    // 전투 탭에서만 Enter / Space 로 게임 시작
    if (code === "Enter" || code === "Space") { startGame(); return true; }
    return false;
  }

  // 업그레이드 탭: 숫자 키 = 구매 (능력치 1 · 2, 스킬 1 · 2 · 3), Tab = 구역 바꾸기
  if (gameState === "upgrades") {
    const keyToIndex = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
    if (code in keyToIndex) {
      if (upgradeSection === "skills") tryPressSkill(keyToIndex[code]);
      else tryBuyUpgrade(keyToIndex[code]);
      return true;
    }
  }
  // 도감 탭: 1, 2, 3 키 = 적 / 증강 / 보급 쪽
  if (gameState === "collection") {
    const keyToPage = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 };
    if (code in keyToPage && COLLECTION_PAGES[keyToPage[code]]) { collectionPage = COLLECTION_PAGES[keyToPage[code]].id; return true; }
  }
  // 도감·업그레이드 탭: Esc (또는 M) = 전투 탭으로
  if (code === "Escape" || code === "KeyM") { openTab("battle"); return true; }
  return false;
}

// 탭 i 칸의 사각형 (탭 바를 똑같은 폭으로 나눈다)
function tabRect(i) {
  const w = CANVAS_WIDTH / LOBBY_TABS.length;
  return { x: i * w, y: TAB_BAR_Y, w: w, h: TAB_BAR_HEIGHT };
}

// 설정 창 안의 버튼 사각형들
function settingsCloseRect() {
  const P = SETTINGS_PANEL;
  return { x: P.x + P.w - 54, y: P.y + 10, w: 44, h: 44 };   // 오른쪽 위 X (지름 44)
}
// 오른쪽 칸 i 번째 항목의 버튼 (0 상태창, 1 모바일, 2 등장 예고, 3 저장 초기화)
function settingsRowRect(i) {
  const P = SETTINGS_PANEL;
  return { x: P.x + 372, y: P.y + 98 + i * SETTINGS_ROW, w: 218, h: 40 };
}
function settingsHudRect() { return settingsRowRect(0); }
function settingsMobileRect() { return settingsRowRect(1); }
function settingsSpawnWarnRect() { return settingsRowRect(2); }
function settingsResetRect() { return settingsRowRect(3); }
function settingsTuningRect() {
  const P = SETTINGS_PANEL;
  return { x: P.x + 34, y: P.y + P.h - 56, w: 290, h: 40 };      // 왼쪽 아래: 숫자 조절판 열기
}

// 지금 화면에서 누를 수 있는 로비 버튼 목록 { id, rect }.
// 그리기와 클릭 판정이 모두 이 목록의 사각형을 쓴다.
function lobbyButtons() {
  // 설정 창이 열려 있으면 설정 창 버튼만 눌린다
  if (settingsOpen) {
    return [
      { id: "settings:close", rect: settingsCloseRect() },
      { id: "settings:hud", rect: settingsHudRect() },
      { id: "settings:mobile", rect: settingsMobileRect() },
      { id: "settings:spawnWarn", rect: settingsSpawnWarnRect() },
      { id: "settings:reset", rect: settingsResetRect() },
      { id: "settings:tuning", rect: settingsTuningRect() },
    ];
  }
  const G = GEAR_BUTTON;
  const list = [{ id: "gear", rect: { x: G.x - G.r, y: G.y - G.r, w: G.r * 2, h: G.r * 2 } }];
  // 탭 칸을 하나씩 버튼으로 넣는 반복문 (잠긴 탭은 눌러도 반응하지 않으니 빼 둔다)
  for (let i = 0; i < LOBBY_TABS.length; i++) {
    if (!LOBBY_TABS[i].locked) list.push({ id: "tab:" + LOBBY_TABS[i].id, rect: tabRect(i) });
  }
  if (gameState === "menu") list.push({ id: "start", rect: START_BUTTON });
  if (gameState === "collection") {
    // 도감 위쪽 쪽 버튼
    for (let i = 0; i < COLLECTION_PAGES.length; i++) list.push({ id: "col:" + COLLECTION_PAGES[i].id, rect: collectionPageRect(i) });
  }
  if (gameState === "upgrades") {
    // 위쪽 구역 버튼 + 지금 구역의 카드 (카드 전체가 버튼)
    for (let i = 0; i < UPGRADE_SECTIONS.length; i++) list.push({ id: "sec:" + UPGRADE_SECTIONS[i].id, rect: upgradeSectionRect(i) });
    if (upgradeSection === "skills") {
      for (let i = 0; i < SKILLS.length; i++) list.push({ id: "skill:" + i, rect: skillCardRect(i) });
    } else {
      for (let i = 0; i < UPGRADES.length; i++) list.push({ id: "buy:" + i, rect: upgradeCardRect(i) });
    }
  }
  return list;
}

// 로비에서 (x, y) 에 있는 버튼 이름표 (없으면 null)
function lobbyButtonAt(x, y) {
  const list = lobbyButtons();
  for (let i = 0; i < list.length; i++) {
    if (insideRect(x, y, list[i].rect)) return list[i].id;
  }
  return null;
}

// 로비 버튼 id 를 눌렀을 때 할 일
function runLobbyButton(id) {
  if (id === "start") startGame();
  else if (id === "gear") openSettings();
  else if (id === "settings:close") closeSettings();
  else if (id === "settings:hud") toggleHud();
  else if (id === "settings:mobile") toggleMobileMode();
  else if (id === "settings:spawnWarn") toggleSpawnWarn();
  else if (id === "settings:reset") pressResetSave();
  else if (id === "settings:tuning") { closeSettings(); openTuningPanel(); }
  else if (id.startsWith("tab:")) openTab(id.slice(4));
  else if (id.startsWith("buy:")) tryBuyUpgrade(Number(id.slice(4)));
  else if (id.startsWith("sec:")) switchUpgradeSection(id.slice(4));
  else if (id.startsWith("skill:")) tryPressSkill(Number(id.slice(6)));
  else if (id.startsWith("col:")) collectionPage = id.slice(4);
}

// 로비 화면들의 시간 흐름 (장식 애니메이션, 알림, 초기화 대기, 버튼 효과, 탭 떠오르기)
function updateLobby(dt) {
  menuTime += dt;
  // 카드마다 흔들림 시간을 줄이는 반복문
  for (let i = 0; i < upgradeShake.length; i++) {
    upgradeShake[i] = Math.max(0, upgradeShake[i] - dt);
  }
  for (let i = 0; i < skillShake.length; i++) skillShake[i] = Math.max(0, skillShake[i] - dt);
  lobbyToastTimer = Math.max(0, lobbyToastTimer - dt);
  resetArmTimer = Math.max(0, resetArmTimer - dt);
  pressTimer = Math.max(0, pressTimer - dt);
  // 탭마다 목표 높이(고른 탭 = TAB_ACTIVE_LIFT, 나머지 = 0) 쪽으로 조금씩 다가간다
  const k = Math.min(1, dt * 14);
  for (let i = 0; i < LOBBY_TABS.length; i++) {
    const target = LOBBY_TABS[i].id === currentTabId() ? TAB_ACTIVE_LIFT : 0;
    tabLift[i] += (target - tabLift[i]) * k;
  }
}

// 로비 아래쪽 알림을 띄운다
function showLobbyToast(text, time) {
  lobbyToast = text;
  lobbyToastTimer = time || LOBBY_TOAST_TIME;
}

// 웨이브가 끝났는지 검사하는 함수
// 끝나는 조건: 보스·졸개 대기열이 비었고(0), 화면에 남은 적(보스 포함)도 없다(0)
function checkWaveEnd() {
  if (bossQueue.length > 0 || spawnQueue.length > 0 || pendingSpawns.length > 0 || enemies.length > 0) return;

  // 웨이브를 깼다! 체력을 조금 회복
  healPlayer(waveClearHeal());
  // "다음 웨이브 동안" 이던 보급 효과는 여기서 끝, 남은 적 탄환도 사라진다
  player.tempEffects = [];
  enemyBullets = [];

  if (wave >= WAVES.length) {
    // 마지막 웨이브였으면 클리어!
    endGame("clear");
  } else {
    // 아니면 증강 선택 화면으로
    openChoiceScreen();
  }
}

// 플레이어가 damage 만큼 맞는다 (적과 닿았을 때, 적 탄환에 맞았을 때)
//   보급 "면역 반응" 보호막이 남아 있으면 대미지 없이 한 번 막는다
//   맞으면 잠깐 무적, 체력이 0 이하면 게임 오버
function hurtPlayer(damage) {
  const shield = getTempEffect("immune");
  if (shield && shield.charges > 0) {
    shield.charges -= 1;
    if (shield.charges <= 0) removeTempEffect("immune");
    player.invincibleTimer = PLAYER_INVINCIBLE_TIME;
    spawnTextPopup(player.x, player.y - PLAYER_RADIUS - 18, "막음!", COLORS.white);
    return;
  }
  player.hp -= damage;
  player.invincibleTimer = PLAYER_INVINCIBLE_TIME; // 잠깐 무적
  if (player.hp <= 0) {
    player.hp = 0;
    endGame("gameover");
  }
}

// ---- 적 탄환 ----

// (x, y) 에서 angle(라디안) 방향으로 적 탄환 한 발을 쏜다
//   opts.damage : 기본 대미지 (웨이브의 접촉 대미지 배율 waveDamageMult 가 곱해진다)
//   opts.speed  : 속도 (없으면 ENEMY_BULLET_SPEED)
function spawnEnemyBullet(x, y, angle, opts) {
  const o = opts || {};
  const speed = o.speed !== undefined ? o.speed : ENEMY_BULLET_SPEED;
  const bullet = {
    x: x, y: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: o.radius || ENEMY_BULLET_RADIUS,
    damage: (o.damage !== undefined ? o.damage : 10) * waveDamageMult(wave),
    age: 0,
    dead: false,
  };
  enemyBullets.push(bullet);
  return bullet;
}

// 적 탄환 움직이기와 플레이어 충돌
function updateEnemyBullets(dt) {
  const margin = 40;   // 화면 밖으로 이만큼 나가면 지운다
  for (const b of enemyBullets) {
    // 시간 지연 범위 안이면 적처럼 느려진다 (증강의 modifyEnemySpeed 를 그대로 쓴다)
    const dist = distance(b.x, b.y, player.x, player.y);
    b.slowFactor = enemySpeedFactor(b, dist);
    b.slowFactor *= worldSlowFactor(false);   // 스킬 "절대 영도" · 돌연변이 "시간 정지"
    b.x += b.vx * b.slowFactor * dt;
    b.y += b.vy * b.slowFactor * dt;
    b.age += dt;
    if (b.age > ENEMY_BULLET_LIFE || b.x < -margin || b.x > CANVAS_WIDTH + margin || b.y < -margin || b.y > CANVAS_HEIGHT + margin) {
      b.dead = true;
      continue;
    }
    // 플레이어와 닿으면 대미지 (무적 중이면 그냥 지나간다)
    if (gameState === "playing" && player.invincibleTimer <= 0 && !(debugMode && debugInvincible) &&
        circlesOverlap(player.x, player.y, PLAYER_RADIUS, b.x, b.y, b.radius)) {
      b.dead = true;
      hurtPlayer(b.damage);
    }
  }
  enemyBullets = enemyBullets.filter(function (b) { return !b.dead; });
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
      hurtPlayer(enemy.contactDamage);  // 체력 감소 (종류·웨이브마다 다름)
      break; // 한 프레임에 한 번만 맞는다
    }
  }
}

// 게임을 처음 상태로 되돌리는 함수 (R 키로 다시 시작할 때 사용)
function resetGame() {
  hudFade = { hud: 1, aug: 1, boss: 1 };   // 창 투명도도 처음처럼
  skillState = newSkillState();            // 스킬은 새 판마다 바로 쓸 수 있다
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
  player.pullVx = 0;          // 자석형·블랙홀에게 끌려가는 속도
  player.pullVy = 0;
  player.tempEffects = [];    // "다음 웨이브 동안" 만 유지되는 보급 효과 목록 (ATP 충전, 면역 반응)
  player.healBonus = 0;       // 광합성: 웨이브 클리어 회복 비율에 더해지는 값 (이번 판 동안)

  // 적과 총알을 모두 지운다
  enemies = [];
  bullets = [];
  enemyBullets = [];
  popups = [];
  particles = [];
  lastHitEnemy = null;
  hitStreak = 0;

  // 일시정지 풀기, 이번 판 코인은 아직 저장 전, 번쩍임 없음
  hpFlashTimer = 0;
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
  mutatedAugments = {};
  runMutations = [];
  // 모든 증강을 하나씩 보며 reset 함수가 있으면 부르는 반복문
  for (const aug of AUGMENTS) {
    if (aug.reset) aug.reset();
  }
  choices = [];
  bannerSubText = "";

  // 1웨이브부터 다시
  startWave(1);
}

// 모든 적에게 한꺼번에 걸리는 느려짐 배율 (1 = 그대로)
//   스킬 "절대 영도" (적 0.3, 보스 0.6) 와 돌연변이 "시간 정지" (적 0.05, 보스 0.3)
//   둘이 겹치면 곱하지 않고 더 느린 쪽 하나만 쓴다
function worldSlowFactor(isBoss) {
  let f = 1;
  if (skillState.freezeTime > 0) f = Math.min(f, isBoss ? SKILL_FREEZE_BOSS : SKILL_FREEZE_ENEMY);
  if (timeStopActive()) f = Math.min(f, isBoss ? TIMESTOP_BOSS_FACTOR : TIMESTOP_FACTOR);
  return f;
}

// 공명형 범위 안에 있는 적의 속도 배율 (여러 공명형 범위가 겹쳐도 한 번만: 1 또는 RESONATOR_BOOST)
function resonanceFactor(enemy) {
  for (const other of enemies) {
    if (other === enemy || other.dead || !enemyType(other).resonance) continue;
    if (distance(enemy.x, enemy.y, other.x, other.y) <= enemyType(other).resonance.range) return enemyType(other).resonance.boost;
  }
  return 1;
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
    // 스킬 "절대 영도" · 돌연변이 "시간 정지": 그 위에 한 번 더 (보스는 덜). 행동 시간(localDt)도 함께 느려진다
    enemy.slowFactor *= worldSlowFactor(enemyType(enemy).isBoss);

    // 종류별 행동 함수(enemies.js)에게 움직임을 맡긴다
    //   speed     : 기본 속도 × 배율 (이동에 사용)
    //   timeScale : 배율 그 자체 = 이 적의 시간이 흐르는 빠르기
    //   localDt   : 이 적의 시계로 흐른 시간 (예고·돌진·흔들림 같은 행동 시간에 사용)
    enemyType(enemy).update(enemy, dt, {
      // 과열 중이면 더 빠르게, 공명형 범위 안이면 더 빠르게
      speed: enemy.speed * enemy.slowFactor * enrageFactor(enemy) * resonanceFactor(enemy),
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

    // [훅] onEnemyUpdate: 적마다 매 프레임 증강에게 알린다 (반감기 붕괴 등)
    forEachOwnedAugment(function (aug, stats) {
      if (aug.onEnemyUpdate) aug.onEnemyUpdate(enemy, stats, dt);
    });

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
    radius: BULLET_RADIUS,        // 충돌 반지름 (푸리에 탄환이 키운다)
    pierce: 0,                    // 앞으로 더 뚫고 지나갈 수 있는 적 수 (0 이면 맞자마자 사라짐)
    hitEnemies: null,             // 관통 중에 이미 맞힌 적 목록 (같은 적을 두 번 맞히지 않게)
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
  // 보급 "ATP 충전" (이번 웨이브 동안)
  if (getTempEffect("atp")) interval *= 1 - SUPPLY_ATP_REDUCTION;
  return interval;
}

// 다른 적을 맞혔을 때 남는 연속 명중 횟수 n
//   보통은 0 부터 다시. 돌연변이 "연속 복리" 는 이자를 끊지 않고 이어 간다: 상한 안에서 절반(내림)
//   예: n = 13 → 6, n = 30 → (상한 20) → 10
function keepStreakOnSwitch(n) {
  if (getAugmentLevel("compound") > 0 && isMutated("compound")) return Math.floor(Math.min(n, COMPOUND_MUT_MAX_N) / 2);
  return 0;
}

// 총알 한 발이 적에게 줄 대미지를 계산하는 함수
// 기본 대미지에서 시작해서, 가진 증강 중 modifyDamage 가 있는 것들이 차례로 바꾼다.
function calcDamage(enemy, bullet) {
  // 복리 탄환용 연속 명중 횟수 n 계산
  //   같은 적을 또 맞혔으면 n + 1, 다른 적이면 n = 0 부터 다시
  if (enemy === lastHitEnemy) {
    hitStreak += 1;
  } else {
    hitStreak = keepStreakOnSwitch(hitStreak);
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

// 글자 팝업 하나를 만드는 함수 (예: "최대 체력 +20", "+40 회복")
function spawnTextPopup(x, y, text, color) {
  popups.push({ x: x, y: y, value: 0, text: text, color: color, age: 0, life: TEXT_POPUP_LIFE });
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
  popups = popups.filter(function (p) { return p.age < (p.life || POPUP_LIFE); });
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

// 총알의 충돌 반지름 (따로 정하지 않은 총알은 기본 BULLET_RADIUS)
function bulletRadius(bullet) {
  return bullet.radius !== undefined ? bullet.radius : BULLET_RADIUS;
}

// 적이 죽는 처리 (총알에 맞아서, 또는 발열 반응 폭발로)
//   cause.bullet   : 마지막 한 방을 날린 총알 (폭발이면 없음)
//   cause.explosion: 발열 반응 폭발로 죽었으면 true (폭발로 죽은 적은 다시 폭발하지 않는다)
function killEnemy(enemy, cause) {
  enemy.dead = true;
  enemyType(enemy).onDeath(enemy);  // 종류별 죽을 때 효과 (기본 적: 파티클)
  score += enemyType(enemy).score * wave; // 점수 획득 (종류별 점수 × 웨이브)

  // 보스를 잡으면 최대 체력의 절반을 회복하고, 잡은 보스 수를 센다
  if (enemyType(enemy).isBoss) {
    healPlayer(player.maxHp * BOSS_KILL_HEAL_RATIO);
    bossesKilled += 1;
    bossKilledThisWave = true;   // 이 웨이브 뒤의 카드 선택은 돌연변이 확률이 높다
    runCoins += BOSS_COIN_BONUS * chapterOf(wave); // 보스 보너스 코인
  }

  // [훅] onKill: 적이 죽은 순간 증강에게 알린다 (핵분열, 발열 반응 등)
  const killInfo = { enemy: enemy, x: enemy.x, y: enemy.y, bullet: cause.bullet, explosion: cause.explosion === true };
  forEachOwnedAugment(function (aug, stats) {
    if (aug.onKill) aug.onKill(stats, killInfo);
  });
}

// 총알이 아닌 것(발열 반응 폭발 등)으로 적에게 대미지를 준다. 죽으면 killEnemy
function damageEnemy(enemy, damage, cause) {
  if (enemy.dead) return;
  if (enemyType(enemy).damageTakenMult) damage *= enemyType(enemy).damageTakenMult(enemy);   // 블랙홀 약점
  enemy.hp -= damage;
  spawnPopup(enemy.x, enemy.y - enemy.radius, damage);
  enemy.hitFlash = 0.08;
  if (enemy.hp <= 0) killEnemy(enemy, cause);
  else if (enemyType(enemy).onHurt) enemyType(enemy).onHurt(enemy);
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
    // 블랙홀처럼 총알을 휘게 하는 적
    for (const enemy of enemies) {
      if (!enemy.dead && enemyType(enemy).bendBullet) enemyType(enemy).bendBullet(enemy, bullet, dt);
    }

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
      // 이미 죽은 적, 관통 중에 이미 맞힌 적은 건너뛴다
      if (enemy.dead) continue;
      if (bullet.hitEnemies && bullet.hitEnemies.includes(enemy)) continue;

      if (circlesOverlap(bullet.x, bullet.y, bulletRadius(bullet),
                         enemy.x, enemy.y, enemy.radius)) {
        // 방패에 막혔는지 (방패형). 막힌 총알은 갈라지거나 (프랙털 탄) 공명 관통을 하지 않는다
        const blocked = enemyType(enemy).blocksBullet ? enemyType(enemy).blocksBullet(enemy, bullet) : false;
        // 대미지를 계산해서 적 체력을 깎는다 (방패형처럼 총알 대미지를 줄이는 적은 종류별로 한 번 더)
        let damage = calcDamage(enemy, bullet);
        if (enemyType(enemy).modifyBulletDamage) damage = enemyType(enemy).modifyBulletDamage(enemy, damage, bullet);
        if (enemyType(enemy).damageTakenMult) damage *= enemyType(enemy).damageTakenMult(enemy);   // 블랙홀 약점
        enemy.hp -= damage;
        spawnPopup(enemy.x, enemy.y - enemy.radius, damage); // 숫자 팝업
        enemy.hitFlash = 0.08;   // 잠깐 하얗게 번쩍
        // 총알은 맞으면 사라진다. 관통이 남아 있으면 하나 쓰고 계속 날아간다
        // (돌연변이 "공명" 총알은 방패에 막히면 관통하지 않는다)
        if (bullet.pierce > 0 && !(blocked && bullet.stopOnShield)) {
          bullet.pierce -= 1;
          bullet.hitEnemies = bullet.hitEnemies || [];
          bullet.hitEnemies.push(enemy);
        } else {
          bullet.dead = true;
        }
        const killed = enemy.hp <= 0; // 이번 한 방으로 죽었는지

        // [훅] onHit: 대미지가 적용된 직후 증강에게 알린다 (넉백, 지속 대미지 등)
        const hitInfo = { enemy: enemy, bullet: bullet, damage: damage, killed: killed, blocked: blocked };
        forEachOwnedAugment(function (aug, stats) {
          if (aug.onHit) aug.onHit(stats, hitInfo);
        });

        // 적 종류별 "맞았을 때" 반응 (보스의 체력 단계별 패턴 변화 등). 죽었으면 부르지 않는다
        if (!killed && enemyType(enemy).onHurt) enemyType(enemy).onHurt(enemy);

        // 체력이 0 이하가 되면 적은 죽는다
        if (killed) killEnemy(enemy, { bullet: bullet });
        if (bullet.dead) break; // 총알 하나는 적 하나만 맞힌다 (관통이 남았으면 계속)
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
    waveTime += dt;       // 0) 과열 시계
    updateAugments(dt);   // 0-1) 증강의 매 프레임 훅 onUpdate (시간 정지 시계 등)
    updatePlayer(dt);     // 1) 플레이어 이동
    updateSpawning(dt);   // 2) 적 생성
    updateEnemies(dt);    // 3) 적 이동
    updateAim();          // 4) 가장 가까운 적 쪽으로 대포 돌리기
    updateShooting(dt);   // 5) 자동 발사
    updateBullets(dt);    // 6) 총알 이동과 충돌
    updatePlayerHit(dt);  // 7) 적에게 닿았는지 검사
    if (gameState === "playing") updateEnemyBullets(dt);   // 7-1) 적 탄환 움직이기·맞았는지 검사
    updatePopups(dt);     // 8) 대미지 숫자 떠오르기
    updateParticles(dt);  // 9) 파티클 날아가기
    updateCoins(dt);      // 10) 생존 시간과 코인 (전투 중에만)
    updateHudFade(dt);    // 11) 상태창 · 증강 목록 · 보스 체력바 반투명 (그림 전용)
    updateSkills(dt);     // 12) 발동 스킬 쿨타임 · 효과 시간 (전투 중에만 흐른다)

    // 게임 오버가 아니라면 웨이브가 끝났는지 검사
    if (gameState === "playing") {
      checkWaveEnd();
    }
  } else if (gameState === "gameover" || gameState === "clear") {
    // 결과 화면: 애니메이션 시간만 흐른다
    resultTime += dt;
  } else if (isLobbyState()) {
    // 로비 화면들: 장식 애니메이션, 알림, 버튼 효과 시간만 흐른다
    updateLobby(dt);
  } else if (gameState === "choosing") {
    // 카드 고르는 중: 게임은 멈추고, 남은 숫자 팝업·파티클만 마저 움직인다
    choosingTime += dt;
    updatePopups(dt);
    updateParticles(dt);
  }

  // 안내 띠, 체력바 번쩍임 남은 시간 줄이기 (어느 상태에서든)
  bannerTimer = Math.max(0, bannerTimer - dt);
  hpFlashTimer = Math.max(0, hpFlashTimer - dt);
  debugMessageTimer = Math.max(0, debugMessageTimer - dt);
  // "gameover", "clear" 상태에서는 게임이 멈춰 있다 (결과 화면 애니메이션 시간만 흐른다)
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
  // 쏘기 직전(chargeFlash)인 적은 빠르게 깜빡인다 (사수형: 곧 쏜다는 신호)
  const blink = enemy.chargeFlash && Math.floor(runTime * 12) % 2 === 0;
  const bodyColor = enemy.hitFlash > 0 || blink ? COLORS.white : COLORS[type.color];

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
  } else if (type.shape === "shooter") {
    drawShooterBody(enemy, r, bodyColor);
  } else if (type.shape === "shield") {
    drawShieldBody(enemy, r, bodyColor);
  } else if (type.shape === "resonator") {
    drawResonatorBody(enemy, r, bodyColor);
  } else if (type.shape === "magnet") {
    drawMagnetBody(enemy, r, bodyColor);
  } else if (type.shape === "waveLord") {
    drawWaveLordBody(enemy, r, bodyColor);
  } else if (type.shape === "turret") {
    drawTurretBody(enemy, r, bodyColor);
  } else if (type.shape === "blackHole") {
    drawBlackHoleBody(enemy, r, bodyColor);
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

// 사수형 몸통: 육각형 + 플레이어 쪽을 겨누는 총신
function drawShooterBody(enemy, r, bodyColor) {
  ctx.save();
  ctx.rotate(Math.atan2(enemy.dirY || 0, enemy.dirX || 1));
  // 총신 (몸보다 먼저 그려서 뿌리가 몸에 가려지게)
  drawOutlinedRoundRect(r * 0.3, -r * 0.32, r * 1.15, r * 0.64, r * 0.2, COLORS.slate, SMALL_OUTLINE_WIDTH);
  ctx.restore();
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1]);
  }
  drawOutlinedPolygon(pts, bodyColor);
  drawHighlight(0, 0, r * 0.9);
}

// 방패형 몸통: 동그란 몸 + 앞쪽 120° 의 두꺼운 노란 방패 (막을 때 하얗게 반짝)
function drawShieldBody(enemy, r, bodyColor) {
  drawOutlinedCircle(0, 0, r, bodyColor);
  drawHighlight(0, 0, r);
  const a = enemy.shieldAngle || 0, half = SHIELD_ARC / 2;
  const shieldR = r + 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, shieldR, a - half, a + half);
  setOutline(13);
  ctx.stroke();
  ctx.strokeStyle = enemy.shieldFlash > 0 ? COLORS.white : COLORS.yellow;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.lineCap = "butt";
}

// 공명형 몸통: 둥근 세모 + 몸 둘레에 떨리는 작은 물결 선 두 개 (소리굽쇠 느낌)
function drawResonatorBody(enemy, r, bodyColor) {
  const shake = Math.sin(runTime * 30) * 1.2;          // 아주 빠르게 떨린다
  drawOutlinedPolygon([
    [shake, -r * 1.25], [r * 1.15, r * 0.8], [-r * 1.15, r * 0.8],
  ], bodyColor);
  drawHighlight(0, -r * 0.1, r * 0.8);
  setOutline(SMALL_OUTLINE_WIDTH);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 1.6, side > 0 ? -0.5 : Math.PI - 0.5, side > 0 ? 0.5 : Math.PI + 0.5);
    ctx.stroke();
  }
}

// 자석형 몸통: 말굽자석 (빨강·파랑 두 극) + 가운데 몸
function drawMagnetBody(enemy, r, bodyColor) {
  ctx.save();
  ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2);   // 극이 플레이어 쪽을 본다
  // 말굽 (U 자 모양): 굵은 외곽선 → 색 순서로
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.95, 0, Math.PI);
  ctx.moveTo(r * 0.95, r * 0.15); ctx.lineTo(r * 0.95, -r * 1.05);
  ctx.moveTo(-r * 0.95, r * 0.15); ctx.lineTo(-r * 0.95, -r * 1.05);
  setOutline(r * 0.7 + SMALL_OUTLINE_WIDTH * 2);
  ctx.stroke();
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = r * 0.7;
  ctx.stroke();
  // 두 극 끝: 빨강(N), 파랑(S)
  drawOutlinedRoundRect(r * 0.6, -r * 1.35, r * 0.7, r * 0.5, 3, COLORS.white, SMALL_OUTLINE_WIDTH);
  drawOutlinedRoundRect(-r * 1.3, -r * 1.35, r * 0.7, r * 0.5, 3, COLORS.blue, SMALL_OUTLINE_WIDTH);
  ctx.restore();
  // 가운데 몸 (얼굴이 들어갈 자리)
  drawOutlinedCircle(0, 0, r * 0.75, bodyColor);
  drawHighlight(0, 0, r * 0.7);
}

// 파동 군주 몸통: 동그란 몸 + 둘레가 물결치는 테두리 (사인파 모양)
function drawWaveLordBody(enemy, r, bodyColor) {
  const pts = [];
  const n = 48;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1.12 + 0.1 * Math.sin(a * 8 + runTime * 4));   // 8개 물결이 빙글 돈다
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  drawOutlinedPolygon(pts, COLORS.purple, SMALL_OUTLINE_WIDTH);
  drawOutlinedCircle(0, 0, r * 0.92, bodyColor);
  drawHighlight(0, 0, r * 0.85);
}

// 회전 포대 몸통: 4방향 총구 (돌아간다) + 둥근 사각형 몸. 방향이 바뀌기 직전에는 총구가 노랗게 깜빡
function drawTurretBody(enemy, r, bodyColor) {
  const warn = enemy.flipWarn && Math.floor(runTime * 8) % 2 === 0;
  ctx.save();
  ctx.rotate(enemy.spin || 0);
  for (let k = 0; k < TURRET_BARRELS; k++) {
    ctx.save();
    ctx.rotate((k * Math.PI * 2) / TURRET_BARRELS);
    drawOutlinedRoundRect(r * 0.5, -r * 0.22, r * 0.85, r * 0.44, 4, warn ? COLORS.yellow : COLORS.dark, SMALL_OUTLINE_WIDTH);
    ctx.restore();
  }
  ctx.restore();
  drawOutlinedRoundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.45, bodyColor);
  drawHighlight(-r * 0.2, -r * 0.2, r * 0.7);
  // 회전 방향 화살표 (예고 중이면 다음 방향을 보여 준다)
  const dir = (enemy.spinDir || 1) * (enemy.flipWarn ? -1 : 1);
  setOutline(SMALL_OUTLINE_WIDTH);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.45, -0.6 * dir - Math.PI / 2, 0.6 * dir - Math.PI / 2, dir < 0);
  ctx.stroke();
}

// 블랙홀 몸통: 주황 강착 원반(빙글빙글) + 검은 몸 + 사건의 지평선 점선 + 약점이면 노랗게 빛나는 고리
function drawBlackHoleBody(enemy, r, bodyColor) {
  const weak = blackHoleWeak(enemy);
  ctx.save();
  ctx.rotate(runTime * 1.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.orange;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  setOutline(SMALL_OUTLINE_WIDTH);
  ctx.stroke();
  ctx.restore();
  drawOutlinedCircle(0, 0, r, enemy.hitFlash > 0 ? COLORS.white : COLORS.outline);
  // 사건의 지평선 (닿으면 큰 대미지)
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -runTime * 20;
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r * BH_HORIZON / ENEMY_TYPES.blackHole.radius, 0, Math.PI * 2);   // 몸 크기에 맞춰 (도감에서는 작게)
  ctx.stroke();
  ctx.restore();
  // 약점: 노랗게 빛나는 고리 + 남은 시간 표시
  if (weak) {
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(runTime * 12);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawOutlinedText("약점!", 0, r + 26, 18, "center", COLORS.yellow);   // 몸 아래 (대미지 숫자는 위에 뜬다)
  }
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

// 적 종류에 drawAura(enemy) 가 있으면 몸보다 먼저(바닥에) 범위를 그린다 (공명형 물결, 자석형 자기장)
function drawEnemyAuras() {
  for (const enemy of enemies) {
    const type = enemyType(enemy);
    if (type.drawAura) type.drawAura(enemy);
  }
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

// ---- 적 탄환: 빨간 뾰족한 가시 모양 (동그란 노란 플레이어 총알과 확실히 다르게) ----
function drawEnemyBullets() {
  for (const b of enemyBullets) {
    const angle = Math.atan2(b.vy, b.vx);
    const r = b.radius * ENEMY_BULLET_DRAW_SCALE;   // 잘 보이게 충돌 반지름보다 조금 크게 그린다
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    // 앞이 뾰족한 마름모 (진행 방향으로 길쭉하게)
    drawOutlinedPolygon([
      [r * 2.2, 0], [0, -r], [-r * 1.4, 0], [0, r],
    ], COLORS.red, SMALL_OUTLINE_WIDTH);
    // 가운데 하얀 점 (빛나는 느낌)
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(r * 0.3, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const radius = bulletRadius(bullet);
    setOutline(radius * 0.9 + SMALL_OUTLINE_WIDTH * 2);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    // 2) 꼬리 속: 그 위에 조금 가는 노란 선을 겹쳐 그으면 외곽선 있는 꼬리가 된다
    const color = bullet.color || COLORS.yellow; // 보통은 노랑, 파편 등은 자기 색
    ctx.strokeStyle = color;
    ctx.lineWidth = radius * 0.9;
    ctx.stroke();

    // 3) 알갱이 머리
    drawOutlinedCircle(bullet.x, bullet.y, radius, color, SMALL_OUTLINE_WIDTH);

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
    // (글자 팝업은 크기가 일정)
    const size = popup.text ? 22 : POPUP_BASE_SIZE + Math.sqrt(popup.value) * 3;

    // 1) 바운스: 처음 0.25초 동안 크게 튀어나왔다가 원래 크기로
    const scale = popupScale(popup.age);

    // 2) 사라지기: 마지막 40% 동안 점점 투명해진다
    const lifeT = popup.age / (popup.life || POPUP_LIFE); // 0 → 1
    const alpha = lifeT < 0.6 ? 1 : 1 - (lifeT - 0.6) / 0.4;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(popup.x, popup.y);
    ctx.scale(scale, scale);                           // 크기 배율 적용
    // 기본 대미지의 2배 이상인 "큰 한 방"은 노란 글씨로 강조
    if (popup.text) {
      drawOutlinedText(popup.text, 0, 0, size, "center", popup.color || COLORS.white);
    } else {
      const fill = popup.value >= player.damage * 2 ? COLORS.yellow : COLORS.white;
      drawOutlinedText(String(popup.value), 0, 0, size, "center", fill);
    }
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

// 적 등장 예고 표시 켜기 / 끄기 (바로 저장. 표시만 바뀌고 게임 진행은 그대로)
function toggleSpawnWarn() {
  saveData.spawnWarn = !spawnWarnOn();
  writeSave();
}

// 상태창이 접혀 있는지 (저장 데이터에 남겨서 다음 판에도 유지)
function hudCollapsed() {
  return saveData.hudCollapsed === true;
}

// 상태창 접기 / 펼치기 (바로 저장)
function toggleHud() {
  saveData.hudCollapsed = !hudCollapsed();
  writeSave();
}

// 체력바 길이: 최대 체력 100 = HP_BAR_BASE_WIDTH, 최대 체력에 비례, maxWidth 에서 멈춤
function hpBarWidth(maxWidth) {
  return Math.min(maxWidth, HP_BAR_BASE_WIDTH * player.maxHp / PLAYER_MAX_HP);
}

// 체력 글자 (예: "70 / 120"). 체력이 소수여도 살아 있으면 1 이상으로 보이게 올림
function hpText() {
  return Math.ceil(player.hp) + " / " + Math.round(player.maxHp);
}

// 왼쪽 위 상태창의 사각형 (누르면 일시정지)
function hudPanelRect() {
  if (hudCollapsed()) {
    // 웨이브 번호 칸(86) + 체력바 + 화살표 칸(44)
    return { x: 12, y: 12, w: 86 + hpBarWidth(HUD_WIDTH - 110) + 44, h: HUD_COLLAPSED_HEIGHT };
  }
  return { x: 12, y: 12, w: HUD_WIDTH, h: HUD_HEIGHT };
}

// 상태창 오른쪽 위의 접기 화살표 버튼 사각형
function hudArrowRect() {
  const p = hudPanelRect();
  return { x: p.x + p.w - 34, y: p.y + 6, w: 28, h: 28 };
}

// 체력바 + 가운데 숫자 + (최대 체력이 늘었을 때) 번쩍임
function drawHpBar(x, y, w, h) {
  const ratio = player.hp / player.maxHp;
  drawBar(x, y, w, h, ratio, ratio <= 0.3 ? COLORS.red : COLORS.green);
  // 번쩍임: 하얀 빛이 깜빡이며 사라지고, 바깥에 노란 테두리
  if (hpFlashTimer > 0) {
    const t = hpFlashTimer / HP_FLASH_TIME;                 // 1 → 0
    ctx.save();
    ctx.globalAlpha = 0.6 * t * (0.5 + 0.5 * Math.sin(hpFlashTimer * 30));
    roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = COLORS.white;
    ctx.fill();
    ctx.globalAlpha = t;
    roundRectPath(x - 4, y - 4, w + 8, h + 8, h / 2 + 4);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  // 숫자 (체력바 가운데)
  drawOutlinedText(hpText(), x + w / 2, y + h / 2 + 1, Math.min(16, h - 2));
}

// 접기 화살표 버튼 (펼친 상태: ▲ = 접기, 접힌 상태: ▼ = 펼치기)
function drawHudArrow() {
  const r = hudArrowRect();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  drawOutlinedCircle(cx, cy, 12, COLORS.white, SMALL_OUTLINE_WIDTH);
  const up = !hudCollapsed();
  const d = up ? -1 : 1;                                  // 위쪽(-1) 또는 아래쪽(+1)을 가리킨다
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 2.5 * d);
  ctx.lineTo(cx + 5, cy - 2.5 * d);
  ctx.lineTo(cx, cy + 3.5 * d);
  ctx.closePath();
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
}

// ---- 화면 위 정보 (HUD) ----
// 왼쪽 위: 웨이브 번호, 체력바(숫자), 점수, 코인 / 오른쪽 위: 가진 증강 목록
// 접으면: 웨이브 번호 + 체력바만 한 줄로 얇게, 증강 목록도 작은 표시만
function drawHud() {
  ctx.save();
  ctx.globalAlpha *= hudFade.hud;   // 뒤에 플레이어 · 적 · 탄환이 있으면 반투명
  drawHudPanel();
  ctx.restore();
  // ---- 오른쪽 위: 가진 증강 목록 (따로 반투명) ----
  drawAugmentList();
}

function drawHudPanel() {
  const p = hudPanelRect();

  if (hudCollapsed()) {
    drawOutlinedRoundRect(p.x, p.y, p.w, p.h, 14, COLORS.brown);
    const label = wave + " / " + WAVES.length;
    drawOutlinedText(label, p.x + 12, p.y + p.h / 2 + 1, fitTextSize(label, 18, 70), "left");
    drawHpBar(p.x + 86, p.y + 10, hpBarWidth(HUD_WIDTH - 110), 20);
    drawHudArrow();
    drawEffectIcons(p.x + p.w + 22, p.y + p.h / 2, 1);   // 접은 상태창 오른쪽 바깥에 왼쪽부터
    return;
  }

  // ---- 펼친 상태창 ----
  drawOutlinedRoundRect(p.x, p.y, p.w, p.h, 14, COLORS.brown);

  // 챕터와 웨이브 번호 (예: "챕터 2 · 웨이브 7 / 30"). 화살표 자리를 남기고, 길면 글자를 줄인다
  const waveText = "챕터 " + chapterOf(wave) + " · 웨이브 " + wave + " / " + WAVES.length;
  drawOutlinedText(waveText, p.x + 16, p.y + 22, fitTextSize(waveText, 22, p.w - 66), "left");
  drawHudArrow();

  // 체력바: 최대 체력에 비례하는 길이, 가운데에 "체력 / 최대 체력"
  drawHpBar(p.x + 16, p.y + 40, hpBarWidth(p.w - 32), 22);

  // 점수 (노란 글씨)
  drawOutlinedText("점수 " + score, p.x + 16, p.y + 84, 22, "left", COLORS.yellow);

  // 이번 판에 번 코인 (동전 아이콘 + 내림한 정수)
  drawCoinIcon(p.x + 26, p.y + 112, 10);
  drawOutlinedText(String(Math.floor(runCoins)), p.x + 44, p.y + 112, 20, "left");

  // 남은 보급 효과 아이콘 (코인 줄 오른쪽 끝에서 왼쪽으로)
  drawEffectIcons(p.x + p.w - 24, p.y + 110, -1);
}

// ---- 남은 보급 효과 아이콘 (상태창) ----
// 임시 효과(ATP 충전, 면역 반응)와 이번 판 효과(광합성)를 동그란 아이콘으로 보여 준다.
// 아이콘 오른쪽 아래 작은 글자: 면역 반응은 남은 횟수, 광합성은 늘어난 회복량

// 지금 보여 줄 효과 목록 [{ icon, color, badge }]
function activeEffectIcons() {
  const list = [];
  for (const e of player.tempEffects || []) {
    const card = SUPPLIES.find(function (c) { return c.id === e.id; });
    if (!card) continue;
    list.push({ icon: card.icon, color: card.color, badge: e.charges !== undefined ? String(e.charges) : "" });
  }
  if (player.healBonus > 0) {
    const photo = SUPPLIES.find(function (c) { return c.id === "photosynthesis"; });
    list.push({ icon: "leaf", color: photo ? photo.color : "green", badge: "+" + Math.round(player.healBonus * 100) + "%" });
  }
  return list;
}

// (x, y) 부터 dir 방향(1 = 오른쪽으로, −1 = 왼쪽으로) 으로 아이콘을 늘어놓는다
// 글자(남은 횟수, +N%)는 아이콘 오른쪽에 붙이고, 그 폭만큼 다음 아이콘을 띄운다
//   dir = 1  : x 가 첫 아이콘의 가운데
//   dir = −1 : x 가 첫 아이콘(+글자)의 오른쪽 끝 근처
function drawEffectIcons(x, y, dir) {
  const list = activeEffectIcons();
  const r = EFFECT_ICON_RADIUS;
  ctx.font = "12px " + FONT_FAMILY;
  let cursor = x;
  for (const item of list) {
    const badgeW = item.badge ? ctx.measureText(item.badge).width + 2 : 0;
    // 아이콘 가운데: 오른쪽으로 늘어놓으면 cursor 가 가운데, 왼쪽으로면 글자 폭만큼 더 왼쪽
    const cx = dir > 0 ? cursor : cursor - badgeW;
    drawOutlinedCircle(cx, y, r, COLORS[item.color], SMALL_OUTLINE_WIDTH);
    drawEffectGlyph(item.icon, cx, y, r * 0.62);
    if (item.badge) drawOutlinedText(item.badge, cx + r - 2, y + r * 0.7, 12, "left");
    cursor += dir * (2 * r + badgeW + EFFECT_ICON_GAP - 2 * r);
  }
}

// 아이콘 안의 하얀 그림: "bolt" = 번개, "shield" = 방패, "leaf" = 잎
function drawEffectGlyph(shape, x, y, s) {
  if (shape === "bolt") {
    drawOutlinedPolygon([
      [x + s * 0.2, y - s], [x - s * 0.55, y + s * 0.15], [x - s * 0.05, y + s * 0.15],
      [x - s * 0.25, y + s], [x + s * 0.55, y - s * 0.2], [x + s * 0.05, y - s * 0.2],
    ], COLORS.white, SMALL_OUTLINE_WIDTH * 0.6);
  } else if (shape === "shield") {
    drawOutlinedPolygon([
      [x, y - s], [x + s * 0.85, y - s * 0.6], [x + s * 0.7, y + s * 0.35],
      [x, y + s], [x - s * 0.7, y + s * 0.35], [x - s * 0.85, y - s * 0.6],
    ], COLORS.white, SMALL_OUTLINE_WIDTH * 0.6);
  } else {
    // 잎: 비스듬한 타원 + 가운데 잎맥
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.white;
    ctx.fill();
    setOutline(SMALL_OUTLINE_WIDTH * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.lineTo(s * 0.8, 0);
    ctx.stroke();
    ctx.restore();
  }
}

// ---- 면역 반응 보호막: 플레이어 둘레의 고리 (남은 횟수만큼 조각) ----
function drawImmuneRing() {
  const shield = getTempEffect("immune");
  if (!shield || shield.charges <= 0 || gameState === "gameover") return;
  const r = PLAYER_RADIUS + 10;
  const n = SUPPLY_IMMUNE_CHARGES;
  const gap = 0.35;                                   // 조각 사이 틈 (라디안)
  const spin = runTime * 1.5;                         // 천천히 돈다
  // 남은 횟수만큼 고리 조각을 그리는 반복문 (외곽선 → 하양 순서로 겹쳐 그린다)
  for (let i = 0; i < shield.charges; i++) {
    const start = spin + (i * Math.PI * 2) / n + gap / 2;
    const end = spin + ((i + 1) * Math.PI * 2) / n - gap / 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, start, end);
    setOutline(9);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

// 가진 증강 목록 (augments.js 에 적힌 순서대로)
function ownedAugmentList() {
  return AUGMENTS.filter(function (aug) {
    return getAugmentLevel(aug.id) > 0;
  });
}

// 오른쪽 위 증강 목록 창의 사각형 (가진 증강이 없으면 null). 그리기와 반투명 판정이 같이 쓴다
function augmentListRect() {
  const n = ownedAugmentList().length;
  if (n === 0) return null;
  if (hudCollapsed()) return { x: CANVAS_WIDTH - 12 - 110, y: 12, w: 110, h: HUD_COLLAPSED_HEIGHT };
  if (n > AUGMENT_LIST_COMPACT_FROM - 1) {
    const w = 150 * 2 + 16;
    return { x: CANVAS_WIDTH - 12 - w, y: 12, w: w, h: 40 + Math.ceil(n / 2) * 24 };
  }
  return { x: CANVAS_WIDTH - 12 - 220, y: 12, w: 220, h: 44 + n * 32 };
}

// 보스 체력바 영역 (보스 이름 + 체력바, 보스가 여러 마리면 아래로 쌓인 전체. 보스가 없으면 null)
function bossBarsRect() {
  const count = enemies.filter(function (e) { return enemyType(e).isBoss; }).length;
  if (count === 0) return null;
  return { x: CANVAS_WIDTH / 2 - BOSS_BAR_WIDTH / 2 - 4, y: 8, w: BOSS_BAR_WIDTH + 8, h: (count - 1) * 50 + 46 };
}

// 원 (cx, cy, r) 이 사각형 rect 와 겹치는지
function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) <= r * r;
}

// 사각형 안에 플레이어 · 적 · 적 탄환 중 하나라도 들어와 있는지
function somethingUnder(rect) {
  if (!rect) return false;
  if (circleHitsRect(player.x, player.y, PLAYER_RADIUS, rect)) return true;
  for (const e of enemies) if (circleHitsRect(e.x, e.y, e.radius, rect)) return true;
  for (const b of enemyBullets) if (circleHitsRect(b.x, b.y, b.radius, rect)) return true;
  return false;
}

// 창 투명도를 목표 쪽으로 HUD_FADE_TIME 에 걸쳐 옮긴다 (그림 전용. 난수 · 게임 진행과 상관없다)
function updateHudFade(dt) {
  const step = (1 - HUD_FADE_ALPHA) * dt / HUD_FADE_TIME;
  const move = function (key, under) {
    const target = under ? HUD_FADE_ALPHA : 1;
    const now = hudFade[key];
    hudFade[key] = now < target ? Math.min(target, now + step) : Math.max(target, now - step);
  };
  move("hud", somethingUnder(hudPanelRect()));
  move("aug", somethingUnder(augmentListRect()));
  move("boss", somethingUnder(bossBarsRect()));
}

// 가진 증강을 한 줄씩 보여 주는 패널 (하나도 없으면 그리지 않는다)
function drawAugmentList() {
  // 가진 증강만 골라 목록으로 만든다 (augments.js 에 적힌 순서대로)
  const owned = ownedAugmentList();
  if (owned.length === 0) return;
  ctx.save();
  ctx.globalAlpha *= hudFade.aug;   // 뒤에 무언가 있으면 반투명
  drawAugmentListPanel(owned);
  ctx.restore();
}

function drawAugmentListPanel(owned) {

  // 상태창을 접었으면 증강 목록도 접어서 "증강 N개" 작은 표시만
  if (hudCollapsed()) {
    const label = "증강 " + owned.length + "개";
    const w = 110;
    drawOutlinedRoundRect(CANVAS_WIDTH - 12 - w, 12, w, HUD_COLLAPSED_HEIGHT, 14, COLORS.brown);
    drawOutlinedText(label, CANVAS_WIDTH - 12 - w / 2, 12 + HUD_COLLAPSED_HEIGHT / 2 + 1, 17);
    return;
  }

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
    // 증강 색 동그라미 + 이름 + 레벨 (돌연변이했으면 보라 표시 + 돌연변이 이름)
    drawAugmentDot(aug, x + 26, rowY, 9, SMALL_OUTLINE_WIDTH);
    drawOutlinedText(augmentDisplayName(aug), x + 44, rowY, 18, "left", augmentNameColor(aug));
    drawOutlinedText("Lv." + getAugmentLevel(aug.id), x + w - 16, rowY, 18, "right", COLORS.yellow);
  }
}

// 목록에 보여 줄 증강 이름 (돌연변이했으면 돌연변이 이름)
function augmentDisplayName(aug) {
  return isMutated(aug.id) ? aug.mutation.name : aug.name;
}
// 이름 글자 색 (돌연변이는 밝은 보라)
function augmentNameColor(aug) {
  return isMutated(aug.id) ? lightenColor(COLORS.purple, 0.55) : COLORS.white;
}
// 증강 색 동그라미 (돌연변이했으면 보라 동그라미 + 안쪽 DNA 가닥 두 줄)
function drawAugmentDot(aug, x, y, r, width) {
  if (!isMutated(aug.id)) { drawOutlinedCircle(x, y, r, COLORS[aug.color], width); return; }
  drawOutlinedCircle(x, y, r + 1, COLORS.purple, width);
  ctx.save();
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = Math.max(1.2, r * 0.22);
  for (const side of [1, -1]) {
    ctx.beginPath();
    for (let t = -1; t <= 1.001; t += 0.25) {
      const px = x + side * Math.sin(t * Math.PI) * r * 0.45, py = y + t * r * 0.7;
      if (t === -1) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
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
    drawAugmentDot(aug, cx + 14, rowY, 7, SMALL_OUTLINE_WIDTH * 0.8);
    drawOutlinedText(augmentDisplayName(aug), cx + 27, rowY, 15, "left", augmentNameColor(aug));
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

// ---- "과열!" 경고 (화면 위쪽 가운데, 보스 체력바가 있으면 그 아래) ----
function drawEnrageWarning() {
  if (!isEnraged()) return;
  const bossCount = enemies.filter(function (e) { return enemyType(e).isBoss; }).length;
  const y = bossCount > 0 ? 24 + bossCount * 50 + 6 : 30;
  // 0.5초마다 살짝 커졌다 작아지며 깜빡이는 느낌
  const pulse = 1 + 0.06 * Math.sin(waveTime * Math.PI * 4);
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, y);
  ctx.scale(pulse, pulse);
  ctx.rotate(-0.02);
  drawOutlinedRoundRect(-140, -18, 280, 36, 16, COLORS.red);
  drawOutlinedText("과열! 적이 점점 빨라져요", 0, 1, 19);
  ctx.restore();
}

// ---- 보스 체력바 (화면 위쪽 가운데) ----
// 보스가 여러 마리면 아래로 한 줄씩 쌓는다
function drawBossBars() {
  const bosses = enemies.filter(function (e) { return enemyType(e).isBoss; });
  const w = BOSS_BAR_WIDTH;
  ctx.save();
  ctx.globalAlpha *= hudFade.boss;   // 뒤에 무언가 있으면 반투명
  // 살아 있는 보스를 하나씩 그리는 반복문
  for (let i = 0; i < bosses.length; i++) {
    const boss = bosses[i];
    const y = 24 + i * 50;
    drawOutlinedText(enemyType(boss).name, CANVAS_WIDTH / 2, y, 20, "center", COLORS.yellow);
    drawBar(CANVAS_WIDTH / 2 - w / 2, y + 14, w, 18, boss.hp / boss.maxHp, COLORS.red);
  }
  ctx.restore();
}

// ---- 발동 스킬 (skills.js) ----
// 화면 아래 가운데 스킬 아이콘 자리와 크기
const SKILL_ICON_X = CANVAS_WIDTH / 2;
const SKILL_ICON_Y = CANVAS_HEIGHT - 44;
const SKILL_ICON_R = 28;
// 충격파 고리가 퍼지는 시간 (초)
const SKILL_RING_TIME = 0.35;

// 매 프레임 (전투 중에만 불린다 → 일시정지 · 카드 고르기 중에는 쿨타임이 멈춘다)
function updateSkills(dt) {
  if (skillState.cooldown > 0) {
    skillState.cooldown = Math.max(0, skillState.cooldown - dt);
    if (skillState.cooldown === 0) skillState.bounce = SKILL_READY_BOUNCE_TIME;   // 준비됨 → 한 번 튀어 오른다
  }
  if (debugMode && debugSkillCheat) skillState.cooldown = 0;                      // 디버그 K: 쿨타임 없음
  skillState.bounce = Math.max(0, skillState.bounce - dt);
  skillState.deny = Math.max(0, skillState.deny - dt);
  skillState.freezeTime = Math.max(0, skillState.freezeTime - dt);
  for (const r of skillState.rings) r.age += dt;
  skillState.rings = skillState.rings.filter(function (r) { return r.age < SKILL_RING_TIME; });
  if (skillState.dashTime <= 0 && skillState.trail.length) skillState.trail.shift();   // 잔상이 하나씩 사라진다
}

// 장착한 스킬을 쓴다 (Space · 오른쪽 클릭 · 모바일 스킬 버튼). 쓰면 true
function tryUseSkill() {
  if (gameState !== "playing" || paused || resumeTimer > 0) return false;
  const skill = equippedSkill();
  if (!skill) return false;
  if (skillState.cooldown > 0) {
    skillState.deny = 0.25;          // 아직이면 아이콘이 살짝 흔들린다
    return false;
  }
  skill.activate();
  skillState.cooldown = debugMode && debugSkillCheat ? 0 : skill.cooldown;
  return true;
}

// 스킬 아이콘 그림 ("dash" = 화살표 돌진, "wave" = 동심원 파동, "snow" = 눈송이). s = 크기
function drawSkillIcon(shape, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  if (shape === "dash") {
    // 오른쪽으로 달리는 화살표 + 뒤쪽 속도선 세 줄
    setOutline(SMALL_OUTLINE_WIDTH);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.95, -s * 0.35 + i * s * 0.35); ctx.lineTo(-s * 0.45, -s * 0.35 + i * s * 0.35); ctx.stroke(); }
    drawOutlinedPolygon([[-s * 0.25, -s * 0.55], [s * 0.9, 0], [-s * 0.25, s * 0.55], [0, 0]], color || COLORS.white, SMALL_OUTLINE_WIDTH);
  } else if (shape === "wave") {
    // 가운데 점 + 퍼지는 고리 두 개
    for (const r of [0.9, 0.58]) {
      ctx.beginPath(); ctx.arc(0, 0, s * r, 0, Math.PI * 2);
      setOutline(SMALL_OUTLINE_WIDTH * 2.2); ctx.stroke();
      ctx.strokeStyle = color || COLORS.white; ctx.lineWidth = SMALL_OUTLINE_WIDTH; ctx.stroke();
    }
    drawOutlinedCircle(0, 0, s * 0.24, color || COLORS.white, SMALL_OUTLINE_WIDTH);
  } else {
    // 눈송이: 가지 6개 (가지마다 작은 갈래)
    for (const pass of [0, 1]) {
      if (pass === 0) setOutline(SMALL_OUTLINE_WIDTH * 2.4); else { ctx.strokeStyle = color || COLORS.white; ctx.lineWidth = SMALL_OUTLINE_WIDTH; ctx.lineCap = "round"; }
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3, c = Math.cos(a), sn = Math.sin(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c * s * 0.9, sn * s * 0.9);
        const bx = c * s * 0.55, by = sn * s * 0.55, b2 = a + 0.6, b3 = a - 0.6;
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(b2) * s * 0.28, by + Math.sin(b2) * s * 0.28);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(b3) * s * 0.28, by + Math.sin(b3) * s * 0.28);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// 스킬 효과 그림 (전투 화면): 관성 질주 잔상, 충격파 고리, 절대 영도의 푸른 서리
function drawSkillEffects() {
  // 관성 질주 잔상: 지나온 자리에 옅은 플레이어 동그라미
  for (let i = 0; i < skillState.trail.length; i++) {
    const p = skillState.trail[i];
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.3 * (i + 1) / skillState.trail.length;
    drawOutlinedCircle(p.x, p.y, PLAYER_RADIUS, COLORS.blue, SMALL_OUTLINE_WIDTH);
    ctx.restore();
  }
  // 충격파: 반경까지 빠르게 퍼지며 흐려지는 고리
  for (const r of skillState.rings) {
    const t = r.age / SKILL_RING_TIME;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.arc(r.x, r.y, SKILL_SHOCK_RADIUS * (0.25 + 0.75 * Math.sqrt(t)), 0, Math.PI * 2);
    setOutline(10); ctx.stroke();
    ctx.strokeStyle = COLORS.purple; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
}

// 절대 영도: 화면 가장자리에 푸른 서리 (마지막 0.5초 동안 흐려진다)
function drawFreezeOverlay() {
  if (skillState.freezeTime <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.35 * Math.min(1, skillState.freezeTime / 0.5);
  const g = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.35, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH * 0.62);
  g.addColorStop(0, "rgba(120, 190, 255, 0)");
  g.addColorStop(1, "rgba(120, 190, 255, 1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();
}

// ---- 돌연변이 "시간 정지" 표시 ----
const TIMESTOP_HUD_X = 46;                     // 고리 가운데 (화면 왼쪽 아래 가장자리)
const TIMESTOP_HUD_Y = CANVAS_HEIGHT - 46;
const TIMESTOP_HUD_R = 24;

// 왼쪽 아래 고리: 다음 정지까지 시계 방향으로 차오르고, 정지 중에는 남은 정지 시간이 줄어든다.
// 정지 중에는 화면 가장자리에 회보라 테두리
function drawTimeStopHud() {
  const info = timeStopInfo();
  if (!info) return;
  const x = TIMESTOP_HUD_X, y = TIMESTOP_HUD_Y, r = TIMESTOP_HUD_R;
  if (info.active) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = COLORS.purple;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, CANVAS_WIDTH - 14, CANVAS_HEIGHT - 14);
    ctx.restore();
  }
  drawOutlinedCircle(x, y, r, COLORS.dark, SMALL_OUTLINE_WIDTH);
  // 진행 고리: 정지 전에는 "다음 정지까지" 가 차오르고 (노랑), 정지 중에는 남은 정지 시간 (보라)
  const ratio = info.active ? info.left / TIMESTOP_DURATION : 1 - info.left / (TIMESTOP_PERIOD - TIMESTOP_DURATION);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 5, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
  ctx.strokeStyle = info.active ? lightenColor(COLORS.purple, 0.3) : COLORS.yellow;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  drawOutlinedText(info.active ? "정지" : String(Math.ceil(info.left)), x, y + 1, info.active ? 15 : 19);
}

// 화면 아래 가운데 스킬 아이콘: 쿨타임은 시계 방향으로 차오르고, 준비되면 한 번 튀어 오른다
function drawSkillHud() {
  const skill = equippedSkill();
  if (!skill) return;
  const x = SKILL_ICON_X, y = SKILL_ICON_Y, r = SKILL_ICON_R;
  const ready = skillState.cooldown <= 0;
  // 튀어 오르기 (준비됨) · 흔들기 (아직)
  const b = skillState.bounce > 0 ? Math.sin(Math.PI * (1 - skillState.bounce / SKILL_READY_BOUNCE_TIME)) : 0;
  const dx = skillState.deny > 0 ? Math.sin(skillState.deny * 70) * 4 : 0;
  ctx.save();
  ctx.translate(x + dx, y - b * 12);
  ctx.scale(1 + b * 0.18, 1 + b * 0.18);
  // 바탕 (어두운 원) + 차오른 만큼 스킬 색 부채꼴 (12시에서 시계 방향)
  drawOutlinedCircle(0, 0, r, COLORS.dark);
  const fill = ready ? 1 : 1 - skillState.cooldown / skill.cooldown;
  if (fill > 0) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 2, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = ready ? COLORS[skill.color] : lightenColor(COLORS[skill.color], 0.15);
    ctx.globalAlpha = ready ? 1 : 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  setOutline(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  drawSkillIcon(skill.icon, 0, 0, r * 0.62, ready ? COLORS.white : COLORS.dim);
  // 남은 초 (쿨타임 중)
  if (!ready) drawOutlinedText(String(Math.ceil(skillState.cooldown)), 0, 1, 22, "center", COLORS.white);
  ctx.restore();
  // 키 안내 (아이콘 오른쪽)
  drawOutlinedText(ready ? "Space · 우클릭" : skill.name, x + r + 10, y + 1, 14, "left", ready ? COLORS.yellow : COLORS.white);
  // 절대 영도 남은 시간: 아이콘 둘레의 하늘색 고리
  if (skillState.freezeTime > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + (skillState.freezeTime / SKILL_FREEZE_TIME) * Math.PI * 2);
    ctx.strokeStyle = "rgb(120, 190, 255)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.stroke();
  }
}

// ---- 적 등장 예고 ----
// 설정에서 끌 수 있다 (꺼도 자리는 똑같이 미리 정한다 → 켜고 끄기가 게임 진행을 바꾸지 않는다)
function spawnWarnOn() {
  return saveData.spawnWarn !== false;
}

// 나올 자리의 화면 안쪽 가장자리에 빨간 세모 느낌표. 등장이 가까울수록 빨리 깜빡인다.
// 보스는 더 크게, 그리고 등장 자리로 큰 원이 좁혀 든다
function drawSpawnWarnings() {
  if (!spawnWarnOn() || pendingSpawns.length === 0) return;
  for (const w of pendingSpawns) {
    const t = w.total > 0 ? 1 - w.time / w.total : 1;          // 0 → 1
    const margin = w.boss ? SPAWN_WARN_BOSS_MARGIN : SPAWN_WARN_MARGIN;
    const x = clamp(w.x, margin, CANVAS_WIDTH - margin);
    const y = clamp(w.y, margin, CANVAS_HEIGHT - margin);
    // 보스: 등장 자리로 좁혀 드는 점선 원 (처음 반지름 → 보스 몸 크기)
    if (w.boss) {
      const r = SPAWN_WARN_BOSS_RING + (ENEMY_TYPES[w.type].radius - SPAWN_WARN_BOSS_RING) * t;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * t;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -w.phase * 40;
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(w.x, Math.max(w.y, 0), Math.max(r, 4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 깜빡임: 한 박자의 앞 60% 동안 보인다 (박자는 등장이 가까울수록 빨라진다)
    if ((w.phase % 1) > 0.6) continue;
    const size = w.boss ? SPAWN_WARN_BOSS_SIZE : SPAWN_WARN_SIZE;
    // 나타날 때 살짝 튀어나오는 크기 (처음 0.1초)
    const pop = Math.min(1, (w.total - w.time) / 0.1);
    const k = size * (0.6 + 0.4 * pop);
    drawOutlinedPolygon([[x, y - k], [x + k * 0.95, y + k * 0.7], [x - k * 0.95, y + k * 0.7]], COLORS.red, w.boss ? OUTLINE_WIDTH : SMALL_OUTLINE_WIDTH * 1.2);
    // 느낌표
    ctx.fillStyle = COLORS.white;
    roundRectPath(x - k * 0.1, y - k * 0.5, k * 0.2, k * 0.62, k * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + k * 0.36, k * 0.12, 0, Math.PI * 2);
    ctx.fill();
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
  // 상태창 바로 아래까지 내려온다 (상태창을 가리지 않게. 접으면 더 위쪽에 멈춘다)
  const hud = hudPanelRect();
  const restY = hud.y + hud.h + 42;
  ctx.translate(CANVAS_WIDTH / 2, -40 + (restY + 40) * slide); // y: -40 → restY 로 내려온다
  ctx.rotate(0.02);
  const h = bannerSubText ? 84 : 56;                  // 부제가 있으면 더 높게
  // 띠 폭: 기본 340px, 글자가 길면 글자 폭에 맞춰 넓힌다
  ctx.font = "34px " + FONT_FAMILY;
  let w = Math.max(340, ctx.measureText(bannerText).width + 60);
  ctx.font = "20px " + FONT_FAMILY;
  w = Math.max(w, ctx.measureText(bannerSubText).width + 60);
  // 돌연변이를 얻은 직후는 보라 띠, 보스 웨이브 안내는 빨간 띠, 보통은 노란 띠
  drawOutlinedRoundRect(-w / 2, -28, w, h, 18, bannerIsMutation ? COLORS.purple : bannerIsBoss ? COLORS.red : COLORS.yellow);
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
  const info = aug.isSupply || aug.isMutation ? aug : aug.levels[level];
  const isHover = i === hoverIndex;

  // 등장 애니메이션: 카드마다 0.08초씩 늦게, 바운스하며 나타난다 (돌연변이 카드는 한 박자 더 늦게)
  const appear = choosingTime - i * 0.08 - (aug.isMutation ? MUTATION_CARD_DELAY : 0);
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

  // 돌연변이 카드는 모양이 따로 (DNA 무늬, 보라 테두리, 리본)
  if (aug.isMutation) {
    drawMutationCardBody(aug, w, h);
    drawOutlinedCircle(left + 6, top + 6, 18, COLORS.outline);
    drawOutlinedText(String(i + 1), left + 6, top + 7, 20, "center", COLORS.yellow);
    ctx.restore();
    return;
  }

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
  } else if (aug.isMutation) {
    levelText = "돌연변이";
    badgeColor = COLORS.purple;
  }
  drawOutlinedRoundRect(-70, top + h - 46, 140, 32, 16, badgeColor);
  drawOutlinedText(levelText, 0, top + h - 30, 18);

  // 8) 왼쪽 위 번호 배지 (이 번호 키를 눌러도 고를 수 있다)
  drawOutlinedCircle(left + 6, top + 6, 18, COLORS.outline);
  drawOutlinedText(String(i + 1), left + 6, top + 7, 20, "center", COLORS.yellow);

  ctx.restore();
}

// 돌연변이 카드 (drawCard 가 카드 가운데로 좌표를 옮기고 몸통을 그린 뒤 부른다)
function drawMutationCardBody(card, w, h) {
  const left = -w / 2, top = -h / 2;
  const purple = COLORS.purple;

  // 1) 배경: 연한 DNA 이중 나선 (사인 곡선 두 가닥이 반 바퀴 어긋나 꼬이고, 사이에 가로 막대)
  ctx.save();
  roundRectPath(left, top, w, h, 20);
  ctx.clip();
  ctx.globalAlpha = MUTATION_HELIX_ALPHA;
  ctx.strokeStyle = purple;
  ctx.lineWidth = 5;
  const amp = w * 0.3, k = (Math.PI * 2) / 150, phase = choosingTime * 2;   // 천천히 돌아간다
  for (const shift of [0, Math.PI]) {
    ctx.beginPath();
    for (let y = top; y <= top + h; y += 6) {
      const x = amp * Math.sin(k * (y - top) + phase + shift);
      if (y === top) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (let y = top + 10; y < top + h; y += 18) {   // 두 가닥을 잇는 염기쌍 막대
    const x = amp * Math.sin(k * (y - top) + phase);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(-x, y); ctx.stroke();
  }
  ctx.restore();

  // 2) 두꺼운 보라 테두리 (바깥 검은 외곽선 안쪽에)
  ctx.save();
  roundRectPath(left + MUTATION_BORDER / 2 + 2, top + MUTATION_BORDER / 2 + 2, w - MUTATION_BORDER - 4, h - MUTATION_BORDER - 4, 17);
  ctx.lineWidth = MUTATION_BORDER;
  ctx.strokeStyle = purple;
  ctx.stroke();
  ctx.restore();

  // 3) 위쪽 보라 띠: 원래 증강 이름 (작게) → 돌연변이 이름 (크게)
  drawOutlinedRoundRect(left + 16, top + 22, w - 32, 70, 14, purple);
  drawOutlinedText(card.aug.name, 0, top + 40, 15, "center", lightenColor(purple, 0.6));
  const big = "→ " + card.name;
  drawOutlinedText(big, 0, top + 70, fitTextSize(big, 28, w - 48));

  // 4) "돌연변이" 리본 (카드 위쪽 가장자리에 걸쳐서, 양 끝이 V 자로 파인 띠)
  ctx.save();
  ctx.translate(0, top + 2);
  ctx.rotate(-0.03);
  const rw = 132, rh = 30;
  drawOutlinedPolygon([[-rw / 2 - 16, -rh / 2], [rw / 2 + 16, -rh / 2], [rw / 2 + 6, 0], [rw / 2 + 16, rh / 2],
    [-rw / 2 - 16, rh / 2], [-rw / 2 - 6, 0]], COLORS.outline, SMALL_OUTLINE_WIDTH);
  drawOutlinedRoundRect(-rw / 2, -rh / 2, rw, rh, 8, purple, SMALL_OUTLINE_WIDTH);
  drawOutlinedText("돌연변이", 0, 1, 19, "center", COLORS.yellow);
  ctx.restore();

  // 5) 개념 · 수식 · 설명
  drawFitText(card.concept, 0, top + 110, 16, w - 40, COLORS.brown);
  drawOutlinedText(card.formula, 0, top + 145, fitTextSize(card.formula, 26, w - 40), "center", purple);
  const desc = fitCardDesc(card.desc);
  ctx.fillStyle = COLORS.outline;
  ctx.font = desc.size + "px " + FONT_FAMILY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let n = 0; n < desc.lines.length; n++) {
    ctx.fillText(desc.lines[n], 0, top + CARD_DESC_TOP + n * desc.lineHeight);
  }

  // 6) 아래쪽: 레벨은 그대로라는 표시
  const level = getAugmentLevel(card.aug.id);
  drawOutlinedRoundRect(-80, top + h - 46, 160, 32, 16, purple);
  drawOutlinedText("Lv." + level + " 그대로 변이", 0, top + h - 30, 17);
}

// 선택 화면에 돌연변이 카드가 있는지
function choicesHaveMutation() {
  return gameState === "choosing" && choices.some(function (c) { return c.isMutation; });
}

// 돌연변이 카드가 뜰 때 화면 흔들림 (x, y) — 그림만 흔들고 게임 값은 바꾸지 않는다 (난수도 안 씀)
function mutationShakeOffset() {
  if (!choicesHaveMutation() || choosingTime >= MUTATION_SHAKE_TIME) return { x: 0, y: 0 };
  const fade = 1 - choosingTime / MUTATION_SHAKE_TIME;   // 점점 잦아든다
  return {
    x: Math.sin(choosingTime * 75) * MUTATION_SHAKE_SIZE * fade,
    y: Math.cos(choosingTime * 61) * MUTATION_SHAKE_SIZE * 0.6 * fade,
  };
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

  // 위쪽 제목 (돌연변이 카드가 있으면 "돌연변이 발생!")
  if (choicesHaveMutation()) drawOutlinedText("돌연변이 발생!", CANVAS_WIDTH / 2, 48, 42, "center", lightenColor(COLORS.purple, 0.35));
  else drawOutlinedText("웨이브 " + wave + " 클리어!", CANVAS_WIDTH / 2, 48, 40, "center", COLORS.yellow);
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
  ["스킬", "Space / 오른쪽 클릭"],
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
  // 글자 크기 14 → 11, 설명 최대 3줄 → 1줄 → 0줄(이름·수식만) 순서로 시도하는 이중 반복문
  for (let maxLines = 3; maxLines >= 0; maxLines--) {
    for (let size = 14; size >= 11; size--) {
      const lineH = size + 4;
      let total = 0;
      const items = owned.map(function (aug) {
        const level = getAugmentLevel(aug.id);
        // 돌연변이했으면 돌연변이 설명
        let lines = wrapText(isMutated(aug.id) ? aug.mutation.desc : aug.levels[level - 1].desc, w - 18, size);
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
          // 잘린 줄 끝에 말줄임표 (0줄이면 설명 없이 이름만)
          if (maxLines > 0) lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…");
        }
        const itemH = 22 + lines.length * lineH + (lines.length > 0 ? 6 : 2);   // 이름 줄 + 설명 줄들 + 간격
        total += itemH;
        return { aug: aug, level: level, lines: lines, h: itemH };
      });
      if (total <= h || (maxLines === 0 && size === 11)) return { size: size, lineH: lineH, items: items };
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
      const mutated = isMutated(item.aug.id);
      drawAugmentDot(item.aug, ax + 8, y + 10, 7, SMALL_OUTLINE_WIDTH * 0.8);
      ctx.font = "17px " + FONT_FAMILY;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = mutated ? COLORS.purple : COLORS.outline;
      // 돌연변이: "연속 복리 Lv.2 (복리 탄환)" 보라 글자
      const title = mutated ? item.aug.mutation.name + " Lv." + item.level + " (" + item.aug.name + ")" : item.aug.name + " Lv." + item.level;
      ctx.fillText(title, ax + 22, y + 10);
      const tw = ctx.measureText(title).width;
      ctx.font = "14px " + FONT_FAMILY;
      ctx.fillStyle = mutated ? COLORS.purple : COLORS.brown;
      ctx.fillText(mutated ? item.aug.mutation.formula : item.aug.formula, ax + 32 + tw, y + 10);
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

  // 성장 체감: 지난 최고 기록과 이번 기록 (기록을 깼으면 아래에서 "신기록!" 스티커)
  const newRecord = wave > runPrevBestWave;
  const recordText = "지난 최고 기록: " + (runPrevBestWave > 0 ? "웨이브 " + runPrevBestWave : "없음") + "  →  이번: 웨이브 " + wave;
  drawOutlinedText(recordText, 0, -18, fitTextSize(recordText, 21, pw - 60), "center", newRecord ? COLORS.green : COLORS.yellow);

  // 코인: 생존 시간 / 번 코인 / 보유 코인 / 잡은 보스
  const coinText = "생존 " + formatTime(runTime) + "  ·  번 코인 +" + lastRunCoins +
    "  ·  보유 " + saveData.coins + "  ·  잡은 보스 " + bossesKilled + "마리";
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
  // 이번 판에 얻은 돌연변이가 있으면 보라 띠로 한 줄 먼저 (그만큼 증강 목록은 한 줄 줄인다)
  let augTop = 42;
  if (runMutations.length > 0) {
    const mutText = "돌연변이: " + runMutations.map(function (id) {
      const aug = AUGMENTS.find(function (a) { return a.id === id; });
      return aug ? aug.mutation.name : id;
    }).join(" · ");
    const size = fitTextSize(mutText, 17, pw - 110);
    ctx.font = size + "px " + FONT_FAMILY;
    const mw = ctx.measureText(mutText).width + 36;
    drawOutlinedRoundRect(-mw / 2, 30, mw, 26, 13, COLORS.purple, SMALL_OUTLINE_WIDTH);
    drawOutlinedText(mutText, 0, 44, size);
    augTop = 72;
  }
  const augLines = wrapText(augText, pw - 60, 16).slice(0, runMutations.length > 0 ? 2 : 3);   // 최대 3줄 (돌연변이가 있으면 2줄)
  // 증강 목록을 한 줄씩 쓰는 반복문
  for (let i = 0; i < augLines.length; i++) {
    drawOutlinedText(augLines[i], 0, augTop + i * 20, 15);
  }

  // 아래쪽 버튼 3개: 다시 시작(R) / 업그레이드(U) / 메뉴(M)
  // 지금 코인으로 살 수 있는 업그레이드가 있으면 업그레이드 버튼을 초록색으로 강조 (콩닥콩닥 + 빨간 점)
  const canUpgrade = anyUpgradeAffordable();
  for (const b of RESULT_BUTTONS) {
    const strong = b.id === "upgrades" && canUpgrade;
    ctx.save();
    ctx.translate(b.dx, 132);
    if (strong) { const s = 1 + RESULT_UPGRADE_PULSE * Math.sin(resultTime * Math.PI * 2 / START_PULSE_PERIOD); ctx.scale(s, s); }
    drawOutlinedRoundRect(-b.w / 2, -20, b.w, 40, 20, strong ? COLORS.green : COLORS.outline);
    drawOutlinedText(b.label, 0, 1, 18, "center", strong ? COLORS.white : COLORS.yellow);
    if (strong) drawOutlinedCircle(b.w / 2 - 6, -18, 8, COLORS.red, SMALL_OUTLINE_WIDTH);
    ctx.restore();
  }

  // 신기록 스티커 (패널 위쪽 가장자리에 비스듬히 붙인다. 제목을 가리지 않게 패널 바깥쪽으로)
  if (newRecord) {
    ctx.save();
    ctx.translate(0, -194);
    ctx.rotate(-0.04);
    const s = 1 + 0.05 * Math.sin(resultTime * Math.PI * 2);
    ctx.scale(s, s);
    drawStickerRect(-86, -28, 172, 56, 20, COLORS.green, 6);
    drawOutlinedText("신기록!", 0, 2, 36, "center", COLORS.yellow);
    ctx.restore();
  }
  ctx.restore();
}

// 결과 화면: 살 수 있는 업그레이드가 있을 때 업그레이드 버튼이 커졌다 작아지는 정도
const RESULT_UPGRADE_PULSE = 0.06;

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
let resetArmTimer = 0;        // 설정 창 "한 번 더 누르면 초기화" 가 남은 시간 (0 이면 평소 상태)
let upgradeSection = "stats"; // 업그레이드 탭에서 보고 있는 구역 ("stats" 능력치 / "skills" 스킬)
let skillShake = [];          // 스킬 카드마다 흔들림이 남은 시간 (코인이 모자랄 때)

// 업그레이드 카드 크기와 위치 (카드 아래 끝이 탭 바 위에서 끝나야 한다)
const UPGRADE_CARD_WIDTH = 300;
const UPGRADE_CARD_HEIGHT = 290;
const UPGRADE_CARD_GAP = 40;
const UPGRADE_CARD_TOP = 112;
// "능력치 / 스킬" 구역 버튼 (카드 위쪽 가운데. 도감의 쪽 버튼과 같은 모양)
const UPGRADE_SECTIONS = [
  { id: "stats", label: "능력치", color: "green" },
  { id: "skills", label: "스킬", color: "blue" },
];
const UPGRADE_SECTION_BUTTON = { w: 170, h: 32, gap: 14, y: 68 };
// 스킬 카드 크기 (3장이 한 줄에 놓인다. 높이와 위쪽은 업그레이드 카드와 같다)
const SKILL_CARD_WIDTH = 270;
const SKILL_CARD_GAP = 30;
// 업그레이드 화면 아래쪽 안내 글자의 높이 (카드와 탭 바 사이)
const UPGRADE_HELP_Y = 418;
// 저장 초기화: 두 번째 누름을 기다리는 시간 (초)
const RESET_CONFIRM_TIME = 3;

// 업그레이드 탭을 여는 함수 (openTab 이 부른다)
function openUpgrades() {
  gameState = "upgrades";
  upgradeShake = UPGRADES.map(function () { return 0; });
  skillShake = SKILLS.map(function () { return 0; });
  lobbyToast = "";
  lobbyToastTimer = 0;
}

// i 번째 업그레이드 카드의 왼쪽 위 위치
function upgradeCardPos(i) {
  const n = UPGRADES.length;
  const total = n * UPGRADE_CARD_WIDTH + (n - 1) * UPGRADE_CARD_GAP;
  return { x: (CANVAS_WIDTH - total) / 2 + i * (UPGRADE_CARD_WIDTH + UPGRADE_CARD_GAP), y: UPGRADE_CARD_TOP };
}

// i 번째 카드 전체의 사각형 (카드 어디를 눌러도 구매)
function upgradeCardRect(i) {
  const p = upgradeCardPos(i);
  return { x: p.x, y: p.y, w: UPGRADE_CARD_WIDTH, h: UPGRADE_CARD_HEIGHT };
}

// i 번째 구역 버튼 사각형
function upgradeSectionRect(i) {
  const B = UPGRADE_SECTION_BUTTON, n = UPGRADE_SECTIONS.length;
  const total = n * B.w + (n - 1) * B.gap;
  return { x: (CANVAS_WIDTH - total) / 2 + i * (B.w + B.gap), y: B.y, w: B.w, h: B.h };
}

// i 번째 스킬 카드 전체의 사각형 (카드 어디를 눌러도 구매 / 장착)
function skillCardRect(i) {
  const n = SKILLS.length;
  const total = n * SKILL_CARD_WIDTH + (n - 1) * SKILL_CARD_GAP;
  return { x: (CANVAS_WIDTH - total) / 2 + i * (SKILL_CARD_WIDTH + SKILL_CARD_GAP), y: UPGRADE_CARD_TOP, w: SKILL_CARD_WIDTH, h: UPGRADE_CARD_HEIGHT };
}

// 능력치 ↔ 스킬 구역 바꾸기
function switchUpgradeSection(id) {
  upgradeSection = id || (upgradeSection === "stats" ? "skills" : "stats");
}

// i 번째 스킬 카드를 눌렀을 때 (사기 / 장착 / 해제, 결과는 알림으로)
function tryPressSkill(i) {
  const skill = SKILLS[i];
  if (!skill) return;
  const result = pressSkill(skill);
  if (result === "bought") showLobbyToast(skill.name + " 구매!" + (saveData.equippedSkill === skill.id ? "  바로 장착했어요" : "  카드를 한 번 더 누르면 장착"));
  else if (result === "equipped") showLobbyToast(skill.name + " 장착! 전투 중 Space · 오른쪽 클릭");
  else if (result === "unequipped") showLobbyToast(skill.name + " 장착 해제");
  else {
    skillShake[i] = 0.35;
    showLobbyToast("코인이 모자라요! (" + skill.price + " 필요)");
  }
}

// i 번째 카드의 구매 버튼 사각형
function upgradeBuyRect(i) {
  const p = upgradeCardPos(i);
  return { x: p.x + 40, y: p.y + UPGRADE_CARD_HEIGHT - 66, w: UPGRADE_CARD_WIDTH - 80, h: 48 };
}

// 점 (x, y) 가 사각형 r 안에 있는지
function insideRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 지금 살 수 있는 업그레이드가 하나라도 있는지 (업그레이드 탭의 빨간 점)
function anyUpgradeAffordable() {
  return UPGRADES.some(function (up) {
    return upgradeLevel(up) < up.maxLevel && saveData.coins >= upgradeCost(up);
  }) || SKILLS.some(function (skill) {
    return !skillOwned(skill.id) && saveData.coins >= skill.price;
  });
}

// i 번째 업그레이드 사기를 시도한다 (결과에 따라 알림 또는 흔들림)
function tryBuyUpgrade(i) {
  const up = UPGRADES[i];
  if (!up) return;
  const result = buyUpgrade(up);
  if (result === "ok") {
    showLobbyToast(up.name + " Lv." + upgradeLevel(up) + "!  " + up.label(up.valueAt(upgradeLevel(up))));
  } else if (result === "poor") {
    upgradeShake[i] = 0.35;                 // 카드가 살짝 흔들린다
    showLobbyToast("코인이 모자라요! (" + upgradeCost(up) + " 필요)");
  } else {
    showLobbyToast(up.name + "은(는) 이미 최대 레벨이에요");
  }
}

// 저장 초기화 버튼 (설정 창): 첫 번째 누름은 "확인 대기", 3초 안에 한 번 더 누르면 실행
function pressResetSave() {
  if (resetArmTimer > 0) {
    resetSave();
    resetArmTimer = 0;
    showLobbyToast("저장을 초기화했어요 (코인 0, 레벨 0)", 2);
  } else {
    resetArmTimer = RESET_CONFIRM_TIME;
  }
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
  // 누르면 카드 가운데를 중심으로 작아졌다 튕겨 돌아온다
  const press = buttonScale("buy:" + i);
  ctx.translate(w / 2, h / 2);
  ctx.scale(press, press);
  ctx.translate(-w / 2, -h / 2);

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
  drawOutlinedRoundRect(bx, by, b.w, b.h, 22, hoverColor("buy:" + i, buttonColor));
  drawOutlinedText(isMax ? "MAX" : "구매", bx + b.w / 2, by + b.h / 2 + 1, 24);

  ctx.restore();
}

// 업그레이드 화면 전체 (위쪽 줄과 탭 바는 drawLobby 가 그린다)
function drawUpgradeScreen() {
  // 위쪽 구역 버튼 (지금 구역은 밝은 색, 나머지는 어두운 색)
  for (let i = 0; i < UPGRADE_SECTIONS.length; i++) {
    const sec = UPGRADE_SECTIONS[i], r = upgradeSectionRect(i), id = "sec:" + sec.id;
    const active = upgradeSection === sec.id;
    drawScaled(r.x + r.w / 2, r.y + r.h / 2, buttonScale(id), function () {
      drawOutlinedRoundRect(r.x, r.y, r.w, r.h, 16, hoverColor(id, active ? COLORS[sec.color] : COLORS.dark), SMALL_OUTLINE_WIDTH);
      drawOutlinedText(sec.label, r.x + r.w / 2, r.y + r.h / 2 + 1, 18, "center", active ? COLORS.white : COLORS.dim);
    });
  }
  if (upgradeSection === "skills") {
    for (let i = 0; i < SKILLS.length; i++) drawSkillCard(SKILLS[i], i);
  } else {
    // 업그레이드 카드들
    for (let i = 0; i < UPGRADES.length; i++) {
      drawUpgradeCard(UPGRADES[i], i);
    }
  }
  // 아래쪽 안내 (알림이 떠 있으면 drawLobbyToast 가 같은 자리에 대신 그린다)
  if (lobbyToastTimer <= 0) {
    const help = upgradeSection === "skills"
      ? "카드나 1 · 2 · 3 키로 구매 · 장착 (하나만) · Tab 능력치 · Esc 전투 탭"
      : "카드를 클릭하거나 1 · 2 키로 구매 · Tab 스킬 · ←→ 탭 이동 · Esc 전투 탭";
    drawOutlinedText(help, CANVAS_WIDTH / 2, UPGRADE_HELP_Y, 17);
  }
}

// 스킬 카드 한 장 (띠: 아이콘 + 이름, 개념, 쿨타임, 설명, 가격, 버튼)
function drawSkillCard(skill, i) {
  const r = skillCardRect(i), w = r.w, h = r.h, id = "skill:" + i;
  const owned = skillOwned(skill.id);
  const equipped = owned && saveData.equippedSkill === skill.id;
  const canBuy = !owned && saveData.coins >= skill.price;

  ctx.save();
  const shake = skillShake[i] > 0 ? Math.sin(skillShake[i] * 60) * 7 * (skillShake[i] / 0.35) : 0;
  ctx.translate(r.x + shake, r.y);
  const press = buttonScale(id);
  ctx.translate(w / 2, h / 2);
  ctx.scale(press, press);
  ctx.translate(-w / 2, -h / 2);

  // 그림자 + 몸통 (장착 중이면 노란 몸통)
  roundRectPath(7, 7, w, h, 22);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(0, 0, w, h, 22, equipped ? lightenColor(COLORS.yellow, 0.55) : COLORS.white);

  // 위쪽 색 띠: 아이콘 + 이름
  drawOutlinedRoundRect(12, 12, w - 24, 60, 16, COLORS[skill.color]);
  drawOutlinedCircle(44, 42, 21, COLORS.dark, SMALL_OUTLINE_WIDTH);
  drawSkillIcon(skill.icon, 44, 42, 14, COLORS.white);
  drawOutlinedText(skill.name, w / 2 + 18, 42, fitTextSize(skill.name, 28, w - 110));

  // 번호 배지
  drawOutlinedCircle(4, 4, 17, COLORS.outline);
  drawOutlinedText(String(i + 1), 4, 5, 19, "center", COLORS.yellow);

  // 개념, 쿨타임
  drawFitText(skill.concept, w / 2, 90, 15, w - 30, COLORS.brown);
  drawOutlinedText("쿨타임 " + skill.cooldown + "초", w / 2, 118, 20, "center", COLORS[skill.color]);

  // 설명 (여러 줄)
  const lines = wrapText(skill.desc, w - 34, 14).slice(0, 4);
  for (let n = 0; n < lines.length; n++) drawFitText(lines[n], w / 2, 146 + n * 20, 14, w - 28, COLORS.outline);

  // 가격 (아직 없을 때만)
  if (!owned) {
    ctx.font = "22px " + FONT_FAMILY;
    const costText = String(skill.price);
    const tw = ctx.measureText(costText).width;
    drawCoinIcon(w / 2 - tw / 2 - 14, 210, 10);
    drawOutlinedText(costText, w / 2 + 6, 210, 22, "center", canBuy ? COLORS.yellow : COLORS.gray);
  } else {
    drawOutlinedText(equipped ? "전투에서 Space · 오른쪽 클릭" : "가지고 있음", w / 2, 210, 15, "center", equipped ? COLORS.green : COLORS.white);
  }

  // 버튼: 구매(초록/회색) · 장착(파랑) · 장착 중(노랑)
  const bx = 34, by = h - 66, bw = w - 68, bh = 48;
  const color = equipped ? COLORS.yellow : owned ? COLORS.blue : (canBuy ? COLORS.green : COLORS.gray);
  drawOutlinedRoundRect(bx, by, bw, bh, 22, hoverColor(id, color));
  drawOutlinedText(equipped ? "장착 중" : owned ? "장착" : "구매", bx + bw / 2, by + bh / 2 + 1, 24);

  ctx.restore();
}

// =============================================================
// 로비 그리기 (위쪽 줄, 탭 바, 전투 탭, 도감, 설정 창)
// =============================================================

// 색을 하양 쪽으로 amount 만큼 섞어 밝게 만든다 ("#RRGGBB" → "rgb(...)")
function lightenColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = function (c) { return Math.round(c + (255 - c) * amount); };
  return "rgb(" + mix((n >> 16) & 255) + "," + mix((n >> 8) & 255) + "," + mix(n & 255) + ")";
}

// 마우스가 올라간 버튼이면 밝은 색, 아니면 원래 색
function hoverColor(id, color) {
  return hoverButton === id ? lightenColor(color, BUTTON_HOVER_LIGHTEN) : color;
}

// 눌린 버튼의 크기 배율: 누르는 순간 작아졌다가, 살짝 커지며 튕긴 뒤 1 로 돌아온다
function buttonScale(id) {
  if (pressedButton !== id || pressTimer <= 0) return 1;
  const t = 1 - pressTimer / BUTTON_PRESS_TIME;               // 0 → 1 로 흐르는 진행도
  return 1 - BUTTON_PRESS_SHRINK * Math.cos(t * Math.PI * 1.5) * (1 - t);
}

// (cx, cy) 를 가운데로 scale 배 키워서 work() 안의 그림을 그린다
function drawScaled(cx, cy, scale, work) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  work();
  ctx.restore();
}

// 그림자가 있는 스티커 둥근 사각형 (그림자는 오른쪽 아래로 depth 만큼)
function drawStickerRect(x, y, w, h, r, fill, depth) {
  roundRectPath(x + depth, y + depth, w, h, r);
  ctx.fillStyle = COLORS.outline;
  ctx.fill();
  drawOutlinedRoundRect(x, y, w, h, r, fill);
}

// ---- 아이콘 (모두 코드로 그린다. s = 아이콘 크기의 기준) ----

// 탭 아이콘: "book" = 펼친 책, "star" = 별, "arrow" = 위 화살표
function drawTabIcon(shape, x, y, s, fill) {
  if (shape === "book") {
    // 왼쪽 장, 오른쪽 장을 따로 그려서 가운데 접힌 선이 보이게 한다
    for (const side of [-1, 1]) {
      drawOutlinedPolygon([
        [x, y - s * 0.62],
        [x + side * s * 0.95, y - s * 0.8],
        [x + side * s * 0.95, y + s * 0.62],
        [x, y + s * 0.8],
      ], fill, SMALL_OUTLINE_WIDTH);
    }
    // 책 안의 글줄 두 개씩
    setOutline(SMALL_OUTLINE_WIDTH * 0.6);
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * s * 0.22, y - s * 0.3 + k * s * 0.38);
        ctx.lineTo(x + side * s * 0.72, y - s * 0.4 + k * s * 0.38);
        ctx.stroke();
      }
    }
  } else if (shape === "star") {
    // 별: 바깥 꼭짓점 5개와 안쪽 꼭짓점 5개를 번갈아 잇는다
    const points = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5;
      const r = k % 2 === 0 ? s : s * 0.45;
      points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    drawOutlinedPolygon(points, fill, SMALL_OUTLINE_WIDTH);
    drawHighlight(x - s * 0.15, y - s * 0.1, s * 0.5);
  } else {
    // 위 화살표: 삼각형 머리 + 네모 몸통
    drawOutlinedPolygon([
      [x, y - s],
      [x + s * 0.85, y - s * 0.05],
      [x + s * 0.38, y - s * 0.05],
      [x + s * 0.38, y + s * 0.9],
      [x - s * 0.38, y + s * 0.9],
      [x - s * 0.38, y - s * 0.05],
      [x - s * 0.85, y - s * 0.05],
    ], fill, SMALL_OUTLINE_WIDTH);
  }
}

// 자물쇠 (잠긴 탭 위에 그린다)
function drawPadlock(x, y, s) {
  setOutline(SMALL_OUTLINE_WIDTH * 2.2);                        // 고리: 외곽선 → 회색 순서로 겹쳐 그린다
  ctx.beginPath();
  ctx.arc(x, y - s * 0.2, s * 0.42, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = COLORS.gray;
  ctx.lineWidth = SMALL_OUTLINE_WIDTH * 0.8;
  ctx.stroke();
  drawOutlinedRoundRect(x - s * 0.62, y - s * 0.2, s * 1.24, s * 0.95, s * 0.2, COLORS.yellow, SMALL_OUTLINE_WIDTH);
  drawOutlinedCircle(x, y + s * 0.22, s * 0.13, COLORS.outline, 0.1);
}

// 톱니바퀴 아이콘: 이빨 8개 + 가운데 구멍
function drawGearIcon(x, y, s, fill, holeColor) {
  const teeth = 8;
  const points = [];
  // 이빨 하나마다 바깥 두 점 + 안쪽 두 점을 넣는 반복문
  for (let k = 0; k < teeth; k++) {
    const a = k * Math.PI * 2 / teeth;
    const half = Math.PI / teeth;
    points.push([x + Math.cos(a - half * 0.95) * s * 0.7, y + Math.sin(a - half * 0.95) * s * 0.7]);
    points.push([x + Math.cos(a - half * 0.45) * s, y + Math.sin(a - half * 0.45) * s]);
    points.push([x + Math.cos(a + half * 0.45) * s, y + Math.sin(a + half * 0.45) * s]);
    points.push([x + Math.cos(a + half * 0.95) * s * 0.7, y + Math.sin(a + half * 0.95) * s * 0.7]);
  }
  drawOutlinedPolygon(points, fill, SMALL_OUTLINE_WIDTH);
  drawOutlinedCircle(x, y, s * 0.32, holeColor, SMALL_OUTLINE_WIDTH);
}

// 깃발 아이콘 (최고 웨이브 표시)
function drawFlagIcon(x, y, s) {
  setOutline(SMALL_OUTLINE_WIDTH);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s);
  ctx.lineTo(x - s * 0.5, y - s);
  ctx.stroke();
  drawOutlinedPolygon([
    [x - s * 0.5, y - s],
    [x + s * 0.8, y - s * 0.55],
    [x - s * 0.5, y - s * 0.1],
  ], COLORS.red, SMALL_OUTLINE_WIDTH);
}

// 동그라미 X 버튼 (설정 창 닫기)
function drawCloseButton(r, id) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  drawScaled(cx, cy, buttonScale(id), function () {
    drawOutlinedCircle(cx, cy, r.w / 2, hoverColor(id, COLORS.red));
    setOutline(SMALL_OUTLINE_WIDTH * 2.4);
    ctx.lineCap = "round";
    const d = r.w * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d);
    ctx.stroke();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = SMALL_OUTLINE_WIDTH * 0.9;
    ctx.stroke();
  });
}

// ---- 위쪽 줄: 왼쪽 코인·최고 웨이브, 가운데 화면 제목(전투 탭 말고), 오른쪽 톱니 ----
function drawLobbyTopBar() {
  const y = LOBBY_TOP_BAR_Y;

  // 코인 칸 (글자 길이에 맞춰 폭이 늘어난다)
  const coinText = String(saveData.coins);
  ctx.font = "22px " + FONT_FAMILY;
  const coinW = Math.max(110, ctx.measureText(coinText).width + 62);
  drawStickerRect(16, y - 20, coinW, 40, 20, COLORS.dark, 4);
  drawCoinIcon(38, y, 13);
  drawOutlinedText(coinText, 60, y + 1, 22, "left", COLORS.yellow);

  // 최고 웨이브 칸
  const waveText = "최고 웨이브 " + saveData.bestWave;
  ctx.font = "18px " + FONT_FAMILY;
  const waveX = 16 + coinW + 12;
  const waveW = ctx.measureText(waveText).width + 52;
  drawStickerRect(waveX, y - 20, waveW, 40, 20, COLORS.dark, 4);
  drawFlagIcon(waveX + 22, y, 11);
  drawOutlinedText(waveText, waveX + 38, y + 1, 18, "left", COLORS.white);

  // 전투 탭: 숫자 조절판으로 바꾼 값을 쓰고 있으면 가운데에 알림 (잊지 않게)
  const tuned = tuningActiveCount();
  if (tuned > 0 && currentTabId() === "battle") {
    const text = "숫자 조절 " + tuned + "개 적용 중";
    ctx.font = "16px " + FONT_FAMILY;
    const tw = ctx.measureText(text).width + 32;
    drawOutlinedRoundRect(CANVAS_WIDTH / 2 - tw / 2, y - 16, tw, 32, 16, COLORS.purple, SMALL_OUTLINE_WIDTH);
    drawOutlinedText(text, CANVAS_WIDTH / 2, y + 1, 16);
  }

  // 가운데 제목 스티커 (도감·업그레이드 화면)
  const tab = LOBBY_TABS.find(function (t) { return t.id === currentTabId(); });
  if (tab && tab.id !== "battle") {
    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, y + 2);
    ctx.rotate(-0.03);
    drawStickerRect(-100, -24, 200, 48, 18, COLORS[tab.color], 5);
    drawOutlinedText(tab.label, 0, 2, 28);
    ctx.restore();
  }

  // 톱니 버튼 (지름 44)
  const G = GEAR_BUTTON;
  drawScaled(G.x, G.y, buttonScale("gear"), function () {
    drawOutlinedCircle(G.x + 3, G.y + 3, G.r, COLORS.outline, 0.1);   // 그림자
    drawOutlinedCircle(G.x, G.y, G.r, hoverColor("gear", COLORS.brown));
    drawGearIcon(G.x, G.y, G.r * 0.66, COLORS.white, hoverColor("gear", COLORS.brown));
  });
}

// ---- 아래쪽 탭 바 (전투·도감·업그레이드 화면이 모두 이 함수 하나를 쓴다) ----
function drawTabBar() {
  // 바탕 띠
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, TAB_BAR_Y, CANVAS_WIDTH, TAB_BAR_HEIGHT);

  // 탭 칸을 하나씩 그리는 반복문
  for (let i = 0; i < LOBBY_TABS.length; i++) {
    const tab = LOBBY_TABS[i];
    const r = tabRect(i);
    const active = tab.id === currentTabId();
    const lift = tabLift[i];
    const id = "tab:" + tab.id;
    const cx = r.x + r.w / 2;

    drawScaled(cx, r.y + r.h / 2, buttonScale(id), function () {
      // 칸 타일: 고른 탭은 밝은 색 + 떠오름, 나머지는 어두운 색
      const tx = r.x + 10, ty = r.y + 10 - lift, tw = r.w - 20, th = r.h - 10 + lift;
      const fill = active ? COLORS[tab.color] : COLORS.dark;
      drawOutlinedRoundRect(tx, ty, tw, th + 12, 20, hoverColor(id, fill));

      // 아이콘 (고른 탭은 조금 더 크게) + 아래 작은 글자
      const iconSize = active ? 17 : 14;
      const iconY = ty + 26;
      drawTabIcon(tab.icon, cx, iconY, iconSize, active ? COLORS.white : COLORS.dim);
      drawOutlinedText(tab.label, cx, ty + 56, active ? 17 : 15, "center", active ? COLORS.white : COLORS.dim);

      // 잠긴 탭: 자물쇠
      if (tab.locked) drawPadlock(cx + 22, iconY + 6, 14);

      // 업그레이드 탭: 살 수 있는 업그레이드가 있으면 아이콘 오른쪽 위에 빨간 점
      if (tab.id === "upgrades" && anyUpgradeAffordable()) {
        drawOutlinedCircle(cx + iconSize + 6, iconY - iconSize + 2, 7, COLORS.red, SMALL_OUTLINE_WIDTH);
      }
    });
  }
}

// ---- 로비 아래쪽 알림 (구매 결과, 저장 초기화 등) ----
function drawLobbyToast() {
  if (lobbyToastTimer <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, lobbyToastTimer / 0.3);   // 끝날 때 흐려짐
  const size = fitTextSize(lobbyToast, 20, CANVAS_WIDTH - 120);
  ctx.font = size + "px " + FONT_FAMILY;
  const w = ctx.measureText(lobbyToast).width + 40;
  // 설정 창이 열려 있으면 창 아래쪽 빈자리에, 아니면 탭 바 바로 위에
  const y = settingsOpen ? Math.min(SETTINGS_PANEL.y + SETTINGS_PANEL.h + 34, CANVAS_HEIGHT - 20) : UPGRADE_HELP_Y;
  drawOutlinedRoundRect(CANVAS_WIDTH / 2 - w / 2, y - 18, w, 36, 18, COLORS.dark, SMALL_OUTLINE_WIDTH);
  drawOutlinedText(lobbyToast, CANVAS_WIDTH / 2, y + 1, size, "center", COLORS.yellow);
  ctx.restore();
}

// ---- 전투 탭 (로비 가운데) ----
function drawMenu() {
  // 1) 장식: 왼쪽에 플레이어, 오른쪽에 웨이브 1~3 적들이 둥실둥실 (탭 바 위에서만)
  //    sin(시간) 은 -1 ~ 1 을 부드럽게 오가므로 위아래로 흔들리는 움직임이 된다
  const decoEnemies = [
    { x: 790, y: 236, wave: 1 },
    { x: 870, y: 318, wave: 2 },
    { x: 780, y: 384, wave: 3 },
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
  player.x = 170;
  player.y = 320 + Math.sin(menuTime * 2.4) * 10;
  player.invincibleTimer = 0;
  player.facing = Math.atan2(318 - player.y, 870 - player.x);
  drawPlayer();

  // 2) 제목 스티커 (위쪽)
  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, 148);
  ctx.rotate(-0.04 + Math.sin(menuTime * 1.5) * 0.01); // 아주 살짝 흔들흔들
  drawStickerRect(-240, -64, 480, 128, 30, COLORS.yellow, 8);
  drawOutlinedText("증강 슈터", 0, -10, 62);
  drawOutlinedText("수학 · 과학 공식으로 살아남기", 0, 38, 21, "center", COLORS.white);
  ctx.restore();

  // 3) 큰 "게임 시작" 버튼: 1.5초마다 3% 커졌다 작아지며 숨 쉰다
  const B = START_BUTTON;
  const pulse = 1 + START_PULSE_AMOUNT * Math.sin(menuTime * Math.PI * 2 / START_PULSE_PERIOD);
  drawScaled(B.x + B.w / 2, B.y + B.h / 2, pulse * buttonScale("start"), function () {
    drawStickerRect(B.x, B.y, B.w, B.h, 30, hoverColor("start", COLORS.yellow), 8);
    drawTabIcon("star", B.x + 46, B.y + B.h / 2 + 1, 21, COLORS.white);
    drawOutlinedText("게임 시작", B.x + B.w / 2 + 24, B.y + B.h / 2 + 2, 44);
  });

  // 4) 시작 버튼 아래: 최고 기록과 조작 안내
  drawOutlinedText("최고 기록: 웨이브 " + saveData.bestWave, CANVAS_WIDTH / 2, B.y + B.h + 30, 20, "center", COLORS.yellow);
  drawOutlinedText("Enter · Space 시작 · ←→ 탭 이동", CANVAS_WIDTH / 2, B.y + B.h + 62, 15);

  // 5) 장착한 스킬 (장착했을 때만 작게)
  const skill = equippedSkill();
  if (skill) {
    const text = "장착 스킬: " + skill.name;
    ctx.font = "16px " + FONT_FAMILY;
    const tw = ctx.measureText(text).width;
    const y = B.y + B.h + 92, x0 = CANVAS_WIDTH / 2 - (tw + 30) / 2;
    drawOutlinedCircle(x0 + 10, y, 12, COLORS[skill.color], SMALL_OUTLINE_WIDTH);
    drawSkillIcon(skill.icon, x0 + 10, y, 8, COLORS.white);
    drawOutlinedText(text, x0 + 30, y + 1, 16, "left");
  }
}

// ---- 도감 탭: 적 / 증강 / 보급 세 쪽 (위쪽 작은 버튼이나 1·2·3 키로 넘긴다) ----

// 도감에 보여 줄 적 종류 (조각·알갱이는 분열형에 포함)
const COLLECTION_ENEMIES = ["basic", "charger", "sine", "splitter", "shooter", "shield", "resonator", "magnet",
  "chargerKing", "splitterKing", "waveLord", "turret", "blackHole"];
// 도감의 쪽 목록 (id, 버튼 글자, 버튼 색)
const COLLECTION_PAGES = [
  { id: "enemies", label: "적", color: "red" },
  { id: "augments", label: "증강", color: "purple" },
  { id: "supplies", label: "보급", color: "green" },
  { id: "skills", label: "스킬", color: "blue" },
  { id: "mutations", label: "돌연변이", color: "purple" },
];
// 도감 위쪽 쪽 버튼 크기와 높이, 내용 패널 위치
const COLLECTION_PAGE_BUTTON = { w: 150, h: 34, gap: 14, y: 76 };
const COLLECTION_PANEL = { x: 24, y: 122, w: 912, h: 314 };

// 지금 보고 있는 도감 쪽
let collectionPage = "enemies";

// i 번째 쪽 버튼 사각형
function collectionPageRect(i) {
  const B = COLLECTION_PAGE_BUTTON, n = COLLECTION_PAGES.length;
  const total = n * B.w + (n - 1) * B.gap;
  return { x: (CANVAS_WIDTH - total) / 2 + i * (B.w + B.gap), y: B.y, w: B.w, h: B.h };
}

// 쪽마다 보여 줄 항목 목록 (그리기와 검사가 함께 쓴다)
function collectionItems(page) {
  if (page === "enemies") return COLLECTION_ENEMIES.map(function (id) { return ENEMY_TYPES[id]; });
  if (page === "augments") return AUGMENTS;
  if (page === "skills") return SKILLS;
  if (page === "mutations") return AUGMENTS.filter(function (aug) { return aug.mutation; });
  return SUPPLIES;
}

// 글 한 줄을 폭 maxWidth 안에 들어가게 (크기를 줄여서) 쓴다
function drawFitText(text, x, y, size, maxWidth, color, align) {
  const fitted = fitTextSize(text, size, maxWidth);
  ctx.font = fitted + "px " + FONT_FAMILY;
  ctx.textAlign = align || "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// 칸(cells)을 cols 칸씩 줄 맞춰 놓을 때 i 번째 칸의 사각형 (패널 안쪽 여백 14, 칸 사이 8)
function collectionCell(i, count, cols) {
  const P = COLLECTION_PANEL, pad = 14, gap = 8;
  const rows = Math.ceil(count / cols);
  const w = (P.w - pad * 2 - gap * (cols - 1)) / cols;
  const h = (P.h - pad * 2 - gap * (rows - 1)) / rows;
  return { x: P.x + pad + (w + gap) * (i % cols), y: P.y + pad + (h + gap) * Math.floor(i / cols), w: w, h: h };
}

function drawCollectionScreen() {
  // 1) 위쪽 쪽 버튼 (지금 쪽은 밝은 색, 나머지는 어두운 색) + 항목 수
  for (let i = 0; i < COLLECTION_PAGES.length; i++) {
    const page = COLLECTION_PAGES[i], r = collectionPageRect(i), id = "col:" + page.id;
    const active = collectionPage === page.id;
    drawScaled(r.x + r.w / 2, r.y + r.h / 2, buttonScale(id), function () {
      drawOutlinedRoundRect(r.x, r.y, r.w, r.h, 17, hoverColor(id, active ? COLORS[page.color] : COLORS.dark), SMALL_OUTLINE_WIDTH);
      drawOutlinedText((i + 1) + "  " + page.label + " " + collectionItems(page.id).length, r.x + r.w / 2, r.y + r.h / 2 + 1, 18,
        "center", active ? COLORS.white : COLORS.dim);
    });
  }

  // 2) 내용 패널
  const P = COLLECTION_PANEL;
  drawStickerRect(P.x, P.y, P.w, P.h, 22, COLORS.white, 6);
  const items = collectionItems(collectionPage);

  if (collectionPage === "enemies") {
    // 적: 두 줄로 나눠 놓는다 (한 줄 칸 수 = 전체의 절반). 위에 그림, 아래 이름과 설명
    // 눈이 아래쪽을 보게 플레이어 위치를 화면 아래로 (그림 전용)
    player.x = CANVAS_WIDTH / 2;
    player.y = CANVAS_HEIGHT + 200;
    const cols = Math.ceil(items.length / 2);
    for (let i = 0; i < items.length; i++) {
      const type = items[i], c = collectionCell(i, items.length, cols), cx = c.x + c.w / 2;
      roundRectPath(c.x, c.y, c.w, c.h, 14);
      ctx.fillStyle = COLORS.background;
      ctx.fill();
      const r = Math.min(type.radius, type.isBoss ? 22 : 17);     // 칸에 들어가게 작게 (보스는 조금 크게)
      drawEnemy({
        type: COLLECTION_ENEMIES[i], radius: r, x: cx, y: c.y + c.h * 0.36 + Math.sin(menuTime * 2 + i) * 2,
        wave: 1, hp: 1, maxHp: 1, hitFlash: 0, dirX: 1, dirY: 0, shieldAngle: Math.PI / 2,
      });
      drawFitText(type.name, cx, c.y + c.h * 0.7, 17, c.w - 12, COLORS.outline);
      drawFitText(type.desc || "", cx, c.y + c.h * 0.87, 12, c.w - 10, COLORS.brown);
      if (type.isBoss) drawOutlinedText("보스", c.x + 10, c.y + 15, 13, "left", COLORS.red);   // 왼쪽 위 구석 (왕관과 안 겹치게)
    }
  } else if (collectionPage === "augments") {
    // 증강: 한 줄에 5칸. 색 띠(이름) + 수식 + 개념
    for (let i = 0; i < items.length; i++) {
      const aug = items[i], c = collectionCell(i, items.length, 5);
      drawOutlinedRoundRect(c.x, c.y, c.w, c.h, 12, COLORS.background, SMALL_OUTLINE_WIDTH);
      drawOutlinedRoundRect(c.x, c.y, c.w, 30, 12, COLORS[aug.color], SMALL_OUTLINE_WIDTH);
      drawOutlinedText(aug.name, c.x + c.w / 2, c.y + 16, fitTextSize(aug.name, 17, c.w - 16));
      drawFitText(aug.formula, c.x + c.w / 2, c.y + 30 + (c.h - 30) * 0.38, 19, c.w - 14, COLORS.outline);
      drawFitText(aug.concept, c.x + c.w / 2, c.y + 30 + (c.h - 30) * 0.76, 13, c.w - 12, COLORS.brown);
    }
  } else if (collectionPage === "mutations") {
    // 돌연변이: 한 줄에 5칸. 한 번이라도 얻은 것만 내용이 보이고, 나머지는 "???" 와 원래 증강 이름만
    for (let i = 0; i < items.length; i++) {
      const aug = items[i], c = collectionCell(i, items.length, 5), cx = c.x + c.w / 2;
      const seen = saveData.seenMutations.indexOf(aug.id) >= 0;
      drawOutlinedRoundRect(c.x, c.y, c.w, c.h, 12, COLORS.background, SMALL_OUTLINE_WIDTH);
      drawOutlinedRoundRect(c.x, c.y, c.w, 30, 12, seen ? COLORS.purple : COLORS.dark, SMALL_OUTLINE_WIDTH);
      if (seen) {
        drawOutlinedText(aug.mutation.name, cx, c.y + 16, fitTextSize(aug.mutation.name, 17, c.w - 16));
        drawFitText(aug.mutation.formula, cx, c.y + 30 + (c.h - 30) * 0.3, 16, c.w - 14, COLORS.purple);
        drawFitText(aug.mutation.concept, cx, c.y + 30 + (c.h - 30) * 0.58, 12, c.w - 12, COLORS.brown);
        drawFitText("원래: " + aug.name, cx, c.y + 30 + (c.h - 30) * 0.83, 12, c.w - 12, COLORS.outline);
      } else {
        drawOutlinedText("???", cx, c.y + 16, 17, "center", COLORS.dim);
        drawFitText("???", cx, c.y + 30 + (c.h - 30) * 0.38, 20, c.w - 14, COLORS.gray);
        drawFitText("원래 증강: " + aug.name, cx, c.y + 30 + (c.h - 30) * 0.76, 12, c.w - 12, COLORS.brown);
      }
    }
  } else if (collectionPage === "skills") {
    // 스킬: 한 줄에 3칸. 색 띠(아이콘 + 이름) + 개념 + 쿨타임 · 가격 + 설명
    for (let i = 0; i < items.length; i++) {
      const skill = items[i], c = collectionCell(i, items.length, 3), cx = c.x + c.w / 2;
      drawOutlinedRoundRect(c.x, c.y, c.w, c.h, 14, COLORS.background, SMALL_OUTLINE_WIDTH);
      drawOutlinedRoundRect(c.x, c.y, c.w, 46, 14, COLORS[skill.color], SMALL_OUTLINE_WIDTH);
      drawSkillIcon(skill.icon, c.x + 34, c.y + 23, 14, COLORS.white);
      drawOutlinedText(skill.name, cx + 10, c.y + 24, 24);
      drawFitText(skill.concept, cx, c.y + 72, 16, c.w - 20, COLORS.brown);
      drawFitText("쿨타임 " + skill.cooldown + "초 · 가격 " + skill.price + " 코인", cx, c.y + 104, 17, c.w - 20, COLORS.outline);
      const lines = wrapText(skill.desc, c.w - 40, 16).slice(0, 5);
      for (let n = 0; n < lines.length; n++) drawFitText(lines[n], cx, c.y + 146 + n * 26, 16, c.w - 30, COLORS.outline);
      if (skillOwned(skill.id)) drawOutlinedText(saveData.equippedSkill === skill.id ? "장착 중" : "가짐", c.x + c.w - 14, c.y + c.h - 18, 15, "right", COLORS.green);
    }
  } else {
    // 보급: 한 줄에 5칸. 색 띠(이름) + 수식 + 개념 + 설명
    for (let i = 0; i < items.length; i++) {
      const card = items[i], c = collectionCell(i, items.length, 5), cx = c.x + c.w / 2;
      drawOutlinedRoundRect(c.x, c.y, c.w, c.h, 14, COLORS.background, SMALL_OUTLINE_WIDTH);
      drawOutlinedRoundRect(c.x, c.y, c.w, 34, 14, COLORS[card.color], SMALL_OUTLINE_WIDTH);
      drawOutlinedText(card.name, cx, c.y + 18, fitTextSize(card.name, 19, c.w - 16));
      drawFitText(card.formula, cx, c.y + 62, 20, c.w - 14, COLORS.outline);
      drawFitText(card.concept, cx, c.y + 90, 13, c.w - 12, COLORS.brown);
      const lines = wrapText(card.desc, c.w - 20, 14).slice(0, 7);
      for (let n = 0; n < lines.length; n++) drawFitText(lines[n], cx, c.y + 124 + n * 22, 14, c.w - 16, COLORS.outline);
    }
  }
}

// ---- 설정 창 (로비 위에 겹쳐 뜬다) ----

// 로비에서만 쓰는 조작법 (설정 창에 전투 조작법과 함께 보여 준다)
const LOBBY_CONTROLS_HELP = [
  ["탭 이동", "← → / 탭 클릭"],
  ["게임 시작", "Enter · Space (전투 탭)"],
  ["뒤로 · 닫기", "Esc"],
];

function drawSettingsOverlay() {
  // 1) 반투명 어두운 배경
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // 2) 가운데 패널
  const P = SETTINGS_PANEL;
  drawStickerRect(P.x, P.y, P.w, P.h, 26, COLORS.background, 8);

  // 3) 제목 스티커 + 닫기(X) 버튼
  ctx.save();
  ctx.translate(P.x + 110, P.y + 8);
  ctx.rotate(-0.04);
  drawStickerRect(-80, -26, 160, 52, 18, COLORS.brown, 5);
  drawGearIcon(-46, 0, 14, COLORS.white, COLORS.brown);
  drawOutlinedText("설정", 14, 2, 30);
  ctx.restore();
  drawCloseButton(settingsCloseRect(), "settings:close");

  // 4) 왼쪽: 조작법 (전투 + 로비)
  const lx = P.x + 34, ly = P.y + 74;
  drawOutlinedText("조작법", lx, ly, 20, "left", COLORS.brown);
  const rows = CONTROLS_HELP.concat(LOBBY_CONTROLS_HELP);
  // 조작법을 한 줄씩 쓰는 반복문 (왼쪽 = 할 일, 오른쪽 = 키)
  for (let i = 0; i < rows.length; i++) {
    const y = ly + 34 + i * 30;
    drawFitText(rows[i][0], lx, y, 16, 88, COLORS.outline, "left");
    drawFitText(rows[i][1], lx + 96, y, 15, 210, COLORS.brown, "left");
  }

  // 가운데 세로 줄
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(P.x + 348, P.y + 74, 3, P.h - 134);

  // 5) 오른쪽 위: 상태창 접기 (켜고 끄기 버튼)
  const rx = P.x + 372;
  const rowTitleY = function (i) { return P.y + 82 + i * SETTINGS_ROW; };
  drawOutlinedText("전투 중 상태창", rx, rowTitleY(0), 18, "left", COLORS.brown);
  const hud = settingsHudRect();
  const folded = hudCollapsed();
  drawScaled(hud.x + hud.w / 2, hud.y + hud.h / 2, buttonScale("settings:hud"), function () {
    drawOutlinedRoundRect(hud.x, hud.y, hud.w, hud.h, 20, hoverColor("settings:hud", folded ? COLORS.gray : COLORS.green));
    drawOutlinedText(folded ? "접어서 보기" : "펼쳐서 보기", hud.x + hud.w / 2, hud.y + hud.h / 2 + 1, 19);
  });
  drawFitText("전투 중에는 Tab 키 · 화살표로도 바꿔요.", rx, hud.y + hud.h + 16, 13, 218, COLORS.outline, "left");

  // 모바일 모드 (조이스틱 · 터치 버튼)
  drawOutlinedText("모바일 모드", rx, rowTitleY(1), 18, "left", COLORS.brown);
  const mob = settingsMobileRect();
  const mobileOn = saveData.mobileMode === true;
  drawScaled(mob.x + mob.w / 2, mob.y + mob.h / 2, buttonScale("settings:mobile"), function () {
    drawOutlinedRoundRect(mob.x, mob.y, mob.w, mob.h, 20, hoverColor("settings:mobile", mobileOn ? COLORS.blue : COLORS.gray));
    drawOutlinedText(mobileOn ? "켜짐 (조이스틱)" : "꺼짐", mob.x + mob.w / 2, mob.y + mob.h / 2 + 1, 19);
  });
  drawFitText("조이스틱 · 일시정지 (디버그는 인증 뒤)", rx, mob.y + mob.h + 16, 13, 218, COLORS.outline, "left");

  // 적 등장 예고 표시 (기본 켜짐)
  drawOutlinedText("적 등장 예고 표시", rx, rowTitleY(2), 18, "left", COLORS.brown);
  const sw = settingsSpawnWarnRect();
  const warnOn = spawnWarnOn();
  drawScaled(sw.x + sw.w / 2, sw.y + sw.h / 2, buttonScale("settings:spawnWarn"), function () {
    drawOutlinedRoundRect(sw.x, sw.y, sw.w, sw.h, 20, hoverColor("settings:spawnWarn", warnOn ? COLORS.red : COLORS.gray));
    drawOutlinedText(warnOn ? "켜짐 (빨간 느낌표)" : "꺼짐", sw.x + sw.w / 2, sw.y + sw.h / 2 + 1, 19);
  });
  drawFitText("적이 나올 자리를 0.8초 먼저 보여 줘요", rx, sw.y + sw.h + 16, 13, 218, COLORS.outline, "left");

  // 6) 오른쪽 아래: 저장 초기화 (두 번 눌러야 실행)
  drawOutlinedText("저장 데이터", rx, rowTitleY(3), 18, "left", COLORS.brown);
  const reset = settingsResetRect();
  const armed = resetArmTimer > 0;
  drawScaled(reset.x + reset.w / 2, reset.y + reset.h / 2, buttonScale("settings:reset"), function () {
    drawOutlinedRoundRect(reset.x, reset.y, reset.w, reset.h, 20, hoverColor("settings:reset", armed ? COLORS.red : COLORS.gray));
    const label = armed ? "한 번 더 누르면 초기화 (" + Math.ceil(resetArmTimer) + ")" : "저장 초기화";
    drawOutlinedText(label, reset.x + reset.w / 2, reset.y + reset.h / 2 + 1, fitTextSize(label, 20, reset.w - 24));
  });
  drawFitText("코인 · 업그레이드 · 최고 웨이브가 지워져요", rx, reset.y + reset.h + 16, 13, 218, COLORS.outline, "left");
  drawFitText("(3초 안에 한 번 더 눌러야 실행)", rx, reset.y + reset.h + 34, 13, 218, COLORS.outline, "left");

  // 7) 왼쪽 아래: 숫자 조절판 (tuning.js, 상수를 바꿔 시험해 보기)
  const tr = settingsTuningRect();
  drawScaled(tr.x + tr.w / 2, tr.y + tr.h / 2, buttonScale("settings:tuning"), function () {
    drawOutlinedRoundRect(tr.x, tr.y, tr.w, tr.h, 20, hoverColor("settings:tuning", COLORS.purple));
    const n = tuningActiveCount();
    // 잠겨 있으면 자물쇠를 그린다 (누르면 비밀번호 창)
    if (!ownerUnlocked) drawPadlock(tr.x + 26, tr.y + tr.h / 2, 14);
    drawOutlinedText(n > 0 ? "숫자 조절 (" + n + "개 바꿈)" : "숫자 조절 (만든 사람용)", tr.x + tr.w / 2 + (ownerUnlocked ? 0 : 10), tr.y + tr.h / 2 + 1, 19);
  });

  // 8) 오른쪽 아래 안내
  drawOutlinedText("Esc 또는 X 버튼으로 닫기", rx, P.y + P.h - 24, 15, "left");
}

// ---- 로비 화면 전체: 지금 탭 내용 → 위쪽 줄 → 탭 바 → 알림 → 설정 창 순서로 겹쳐 그린다 ----
function drawLobby() {
  if (gameState === "menu") drawMenu();
  else if (gameState === "upgrades") drawUpgradeScreen();
  else drawCollectionScreen();
  drawLobbyTopBar();
  drawTabBar();
  if (settingsOpen) drawSettingsOverlay();
  drawLobbyToast();
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
  drawOutlinedText("DEBUG" + (debugInvincible ? " · 무적" : "") + (debugSkillCheat ? " · 스킬" : ""), x, y, 16, "left", COLORS.yellow);
  drawOutlinedText("[ ] 웨이브  G 지급  B 보스  Shift+0 체력  Shift+C 코인  I 무적  K 스킬  F2 끄기", x, y - 22, 13, "left");
  if (debugMessageTimer > 0 && debugMessage) {
    drawOutlinedText(debugMessage, x, y - 44, 15, "left", COLORS.green);
  }
}

// ---- 화면 전체 그리기 ----
function draw() {
  // 모바일 모드 터치 버튼을 지금 화면에 맞게 보이고 숨긴다 (mobile.js)
  if (typeof updateMobileControls === "function") updateMobileControls();
  // 매 프레임 처음에: 게임 좌표 960 × 540 → 실제 픽셀로 확대하는 변환을 정한다
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  drawBackground(); // 배경 (가장 아래, 지난 프레임 그림도 덮어서 지워 준다)
  // 돌연변이 카드가 뜰 때 화면 전체가 살짝 흔들린다 (배경 위의 모든 그림을 옮긴다)
  const shake = mutationShakeOffset();
  if (shake.x !== 0 || shake.y !== 0) ctx.translate(shake.x, shake.y);

  // 로비 화면들(전투 탭·도감·업그레이드)은 따로 그리고 끝낸다 (탭 바와 톱니는 여기에만 있다)
  if (isLobbyState()) {
    drawLobby();
    drawDebug();
    return;
  }

  drawAugmentEffects(); // 증강 효과 범위 (바닥에 깔리듯이)
  drawEnemyAuras();   // 공명형·자석형의 범위 (바닥에)
  drawBullets();    // 총알
  drawParticles();  // 파티클 (적 아래)
  drawEnemies();    // 적
  drawEnemyBullets(); // 적 탄환 (적 위에, 잘 보이게)
  drawPlayer();     // 플레이어
  drawImmuneRing(); // 면역 반응 보호막 고리
  drawSkillEffects(); // 발동 스킬 효과 (잔상, 충격파 고리)
  drawFreezeOverlay(); // 절대 영도 푸른 서리
  drawSpawnWarnings(); // 적 등장 예고 (화면 가장자리의 빨간 세모 느낌표)
  drawPopups();     // 대미지 숫자 (캐릭터들 위에)
  drawHud();        // 웨이브 번호, 체력바, 점수, 증강 목록
  drawSkillHud();   // 장착한 스킬 아이콘 (화면 아래 가운데, 쿨타임)
  drawTimeStopHud(); // 돌연변이 "시간 정지": 다음 정지까지 남은 시간 고리 (왼쪽 아래)
  drawBossBars();   // 보스 체력바
  drawEnrageWarning(); // "과열!" 경고 (웨이브가 너무 길어지면)
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
