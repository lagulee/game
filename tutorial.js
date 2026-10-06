// =============================================================
// tutorial.js : 튜토리얼 (로비 난이도 줄의 맨 왼쪽)
// -------------------------------------------------------------
// 30웨이브가 아니라 따로 만든 4웨이브짜리 짧은 판이다. (rules.js 의 DIFFICULTIES "tutorial" 이 이 웨이브 표를 쓴다)
//   웨이브 1: 기본 적 3마리 (느리게)      → "이동하세요, 공격은 자동"
//   웨이브 2: 돌격형 2마리                → 첫 예고선이 뜨는 순간 게임이 느려지고 "빨간 선 밖으로 피하세요"
//   웨이브 3: 기본 적 + 사인파형          → "같은 카드를 또 고르면 레벨업"
//   웨이브 4: 약한 돌진 대장              → "5웨이브마다 보스가 나옵니다"
// 안내는 화면 아래 말풍선 띠로 띄우고, 조건 (이동했다 · 피했다 · 카드를 골랐다) 을 채우면 다음 안내로 넘어간다.
// 말풍선의 "건너뛰기" 버튼은 지금 안내를 바로 넘긴다.
// 튜토리얼 규칙 (rules.js): 영구 업그레이드 · 스킬 없음, 체력은 1 아래로 안 내려감, 기록 · 코인 저장 안 함.
// 끝까지 깨면 코인 TUTORIAL_REWARD 를 한 번만 준다 (saveData.tutorialDone).
// =============================================================

// ---- 조절용 상수 ----
const TUTORIAL_REWARD = 100;          // 처음 끝냈을 때 주는 코인
const TUTORIAL_MOVE_DISTANCE = 150;   // 이만큼 (px) 움직이면 "이동했다"
const TUTORIAL_SLOW = 0.25;           // 돌격형 예고선이 처음 뜨면 게임 속도를 이만큼으로 (피할 때까지)
const TUTORIAL_HINT_TIME = 5;         // 읽기만 하는 안내가 떠 있는 시간 (초)
const TUTORIAL_BUBBLE = { x: 150, y: 462, w: 660, h: 58 };   // 아래쪽 말풍선 띠 (게임 좌표)

// ---- 튜토리얼 웨이브 표 (waves.js 와 같은 모양. 마릿수는 늘리지 않는다: rules 의 exactCounts) ----
const TUTORIAL_WAVES = [
  [{ type: "basic", count: 3 }],
  [{ type: "charger", count: 2 }],
  { mix: true, groups: [{ type: "basic", count: 2 }, { type: "sine", count: 2 }] },
  { boss: "chargerKing", groups: [] },
];

// ---- 안내 단계 ----
//   ready(): 이 안내를 띄울 때가 됐는지 / done(): 조건을 채웠는지 / text: 말풍선 글자 (함수면 그때그때)
//   slow: true 면 떠 있는 동안 게임이 느려진다
const TUTORIAL_STEPS = [
  {
    id: "move",
    text: function () {
      return saveData.mobileMode ? "화면 왼쪽을 눌러 이동해 보세요. 공격은 자동이에요!" : "WASD 또는 방향키로 이동해 보세요. 공격은 자동이에요!";
    },
    ready: function () { return gameState === "playing"; },
    done: function () { return tutorial.moved >= TUTORIAL_MOVE_DISTANCE; },
  },
  {
    id: "clear",
    text: "가장 가까운 적을 자동으로 쏴요. 적을 모두 잡으면 웨이브 클리어!",
    ready: function () { return gameState === "playing"; },
    done: function () { return gameState === "choosing" || wave >= 2; },
  },
  {
    id: "card",
    text: "웨이브를 깨면 카드를 한 장 골라 증강을 얻어요 (클릭 또는 1 · 2 · 3)",
    ready: function () { return gameState === "choosing"; },
    done: function () { return tutorial.picks >= 1; },
  },
  {
    id: "dodge",
    text: "돌격형이 빨간 선을 따라 돌진해요. 빨간 선 밖으로 피하세요!",
    slow: true,
    ready: function () { return tutorial.warnSeen; },
    done: function () { return tutorial.dodged; },
  },
  {
    id: "levelup",
    text: "같은 카드를 또 고르면 레벨업! 가진 증강은 오른쪽 위에 보여요",
    ready: function () { return gameState === "playing" && wave >= 3; },
    done: function () { return tutorial.stepTime >= TUTORIAL_HINT_TIME || wave >= 4; },
  },
  {
    id: "boss",
    text: "5웨이브마다 보스가 나와요. 보스를 잡으면 체력이 회복돼요!",
    ready: function () { return gameState === "playing" && wave >= 4; },
    done: function () { return tutorial.stepTime >= TUTORIAL_HINT_TIME; },
  },
];

// ---- 상태 ----
function newTutorialState() {
  return {
    step: 0,          // 지금 안내 번호 (TUTORIAL_STEPS 의 칸)
    stepTime: 0,      // 지금 안내가 떠 있던 시간 (초)
    moved: 0,         // 움직인 거리 (px)
    lastX: null, lastY: null,
    picks: 0,         // 고른 카드 수
    warnSeen: false,  // 돌격형 예고선을 본 적이 있는지
    warnHp: 0,        // 예고선이 뜬 순간의 체력 (돌진이 끝났을 때 그대로면 "피했다")
    watched: null,    // 지켜보는 돌격형
    dodged: false,
    cleared: false,   // 4웨이브를 모두 깼는지
    reward: 0,        // 이번에 받은 보상 코인 (결과 화면)
  };
}
let tutorial = newTutorialState();

// 지금 판이 튜토리얼인지
function inTutorial() {
  return currentRules.tutorial === true;
}

// 지금 떠 있는 안내 (없으면 null)
function activeTutorialStep() {
  if (!inTutorial()) return null;
  const step = TUTORIAL_STEPS[tutorial.step];
  return step && step.ready() ? step : null;
}

// 게임 속도 배율 (돌격형 예고선 안내가 떠 있는 동안만 느리게)
function tutorialTimeScale() {
  const step = activeTutorialStep();
  return step && step.slow ? TUTORIAL_SLOW : 1;
}

// 매 프레임 (전투 중 · 카드 고르기 중): 조건을 살피고 다음 안내로
function updateTutorial(dt) {
  if (!inTutorial()) return;
  // 움직인 거리
  if (tutorial.lastX !== null) tutorial.moved += Math.hypot(player.x - tutorial.lastX, player.y - tutorial.lastY);
  tutorial.lastX = player.x; tutorial.lastY = player.y;
  // 돌격형 예고선: 처음 뜨는 순간을 잡고, 그 돌격형의 돌진이 끝났을 때 체력이 그대로면 "피했다"
  if (!tutorial.dodged) {
    const charger = tutorial.watched;
    if (charger && (charger.dead || charger.state === "rest" || charger.state === "approach")) {
      if (player.hp >= tutorial.warnHp) tutorial.dodged = true;
      tutorial.watched = null;   // 맞았으면 다음 예고선을 다시 기다린다
    }
    if (!tutorial.watched) {
      const warning = enemies.find(function (e) { return e.type === "charger" && e.state === "warn" && !e.dead; });
      if (warning) { tutorial.watched = warning; tutorial.warnSeen = true; tutorial.warnHp = player.hp; }
    }
  }
  // 지금 안내: 떠 있는 동안 시간을 재고, 조건을 채웠으면 다음으로 (떠 있지 않아도 이미 채웠으면 넘긴다)
  if (activeTutorialStep()) tutorial.stepTime += dt;
  advanceTutorial();
}

// 조건을 채운 안내를 모두 넘긴다
function advanceTutorial() {
  while (TUTORIAL_STEPS[tutorial.step] && TUTORIAL_STEPS[tutorial.step].done()) nextTutorialStep();
}

function nextTutorialStep() {
  tutorial.step += 1;
  tutorial.stepTime = 0;
}

// 카드를 골랐을 때 (game.js 의 chooseAugment 가 부른다)
function tutorialOnPick() {
  if (!inTutorial()) return;
  tutorial.picks += 1;
  advanceTutorial();
}

// 말풍선 "건너뛰기" 버튼 사각형
function tutorialSkipRect() {
  const B = TUTORIAL_BUBBLE;
  return { x: B.x + B.w - 108, y: B.y + 12, w: 96, h: 34 };
}

// 건너뛰기: 지금 안내를 바로 넘긴다
function skipTutorialStep() {
  if (!activeTutorialStep()) return false;
  if (TUTORIAL_STEPS[tutorial.step].id === "dodge") { tutorial.dodged = true; tutorial.watched = null; }
  nextTutorialStep();
  return true;
}

// 4웨이브를 모두 깼을 때 (game.js 의 commitRunProgress 가 부른다): 처음이면 코인 보상
function finishTutorial() {
  tutorial.cleared = true;
  tutorial.reward = 0;
  if (!saveData.tutorialDone) {
    saveData.tutorialDone = true;
    saveData.coins += TUTORIAL_REWARD;
    tutorial.reward = TUTORIAL_REWARD;
  }
}

// 아래쪽 말풍선 띠: 왼쪽에 꼬리, 가운데 글자, 오른쪽에 건너뛰기
function drawTutorialBubble() {
  const step = activeTutorialStep();
  if (!step) return;
  const B = TUTORIAL_BUBBLE;
  const text = typeof step.text === "function" ? step.text() : step.text;
  ctx.save();
  // 뒤에 플레이어 · 적 · 적 탄환이 있으면 반투명 (상태창과 같은 방식)
  if (somethingUnder(B)) ctx.globalAlpha = HUD_FADE_ALPHA + 0.15;
  // 나타날 때 0.2초 동안 90% → 100% 로 살짝 커진다
  const pop = 0.9 + 0.1 * Math.min(1, tutorial.stepTime / 0.2);
  ctx.translate(B.x + B.w / 2, B.y + B.h / 2);
  ctx.scale(pop, pop);
  ctx.translate(-(B.x + B.w / 2), -(B.y + B.h / 2));
  // 꼬리 (왼쪽 아래로)
  drawOutlinedPolygon([[B.x + 40, B.y + B.h - 4], [B.x + 18, B.y + B.h + 14], [B.x + 70, B.y + B.h - 4]], COLORS.white, SMALL_OUTLINE_WIDTH);
  drawStickerRect(B.x, B.y, B.w, B.h, 20, COLORS.white, 5);
  // 단계 번호 동그라미
  drawOutlinedCircle(B.x + 30, B.y + B.h / 2, 17, COLORS.blue, SMALL_OUTLINE_WIDTH);
  drawOutlinedText(String(tutorial.step + 1), B.x + 30, B.y + B.h / 2 + 1, 18);
  drawFitText(text, B.x + 56 + (B.w - 56 - 120) / 2, B.y + B.h / 2 + 1, 19, B.w - 56 - 124, COLORS.outline);
  // 건너뛰기 버튼
  const r = tutorialSkipRect();
  drawOutlinedRoundRect(r.x, r.y, r.w, r.h, 16, COLORS.gray, SMALL_OUTLINE_WIDTH);
  drawOutlinedText("건너뛰기", r.x + r.w / 2, r.y + r.h / 2 + 1, 16);
  ctx.restore();
  // 느려진 동안: 화면 위쪽에 "느린 화면" 표시
  if (step.slow) drawOutlinedText("느린 화면 ×" + TUTORIAL_SLOW, CANVAS_WIDTH / 2, B.y - 18, 16, "center", COLORS.blue);
}

// ---- 로비: 처음 켠 사람에게 한 번만 "튜토리얼부터 해볼까요?" 말풍선 ----
// (튜토리얼을 끝냈거나, 이미 한 번 보여 줬으면 (판을 시작하면 본 것으로 친다) 보이지 않는다)
function tutorialPromptVisible() {
  return gameState === "menu" && !settingsOpen && !helpOpen && !saveData.tutorialDone && !saveData.tutorialPrompted;
}
