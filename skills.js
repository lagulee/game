// =============================================================
// skills.js : 발동 스킬 (상점에서 코인으로 사서, 한 판에 1개만 장착)
// -------------------------------------------------------------
// 전투 중 Space 키 또는 마우스 오른쪽 클릭으로 쓴다 (모바일 모드는 오른쪽 아래 "스킬" 버튼).
// 쓰고 나면 쿨타임 동안 다시 못 쓴다. 쿨타임은 전투 중에만 흐른다 (일시정지 · 카드 고르기 중에는 멈춤),
// 웨이브가 바뀌어도 초기화되지 않는다. 새 판을 시작하면 바로 쓸 수 있다.
//
// 스킬 하나 = SKILLS 배열의 객체 하나. 배열에 추가하면 업그레이드 탭의 스킬 구역과 도감에 카드가 하나 더 생긴다.
//   id       : 저장할 때 쓰는 이름표 (save.js 의 saveData.ownedSkills, saveData.equippedSkill)
//   name     : 이름
//   concept  : 어떤 개념에서 왔는지 (카드에 작게 표시)
//   icon     : 아이콘 모양 ("dash" = 화살표 돌진, "wave" = 동심원, "snow" = 눈송이) → game.js 의 drawSkillIcon
//   color    : 띠 색 (game.js 의 COLORS 팔레트 이름)
//   price    : 가격 (코인)
//   cooldown : 쿨타임 (초)
//   desc     : 설명
//   activate : 쓸 때 할 일 (game.js 의 전역 변수 player, enemies, skillState 등을 쓴다)
//
// 스킬을 장착하지 않으면 (업그레이드 0) 게임은 스킬이 없던 때와 완전히 같다 (tools/regress.js 로 확인).
// =============================================================

// ---- 관성 질주 (물리 · 관성): 이동 방향으로 짧게 돌진, 그동안 무적 ----
const SKILL_DASH_DISTANCE = 180;   // 돌진 거리 (px)
const SKILL_DASH_TIME = 0.15;      // 돌진에 걸리는 시간 (초). 이 시간 동안 무적
const SKILL_DASH_COOLDOWN = 6;     // 쿨타임 (초)
const SKILL_DASH_PRICE = 300;      // 가격 (코인)

// ---- 충격파 (물리 · 파동): 둘레의 적을 밀쳐 내고 적 탄환을 지운다 ----
const SKILL_SHOCK_RADIUS = 160;      // 반경 (px)
const SKILL_SHOCK_DAMAGE_MULT = 2;   // 대미지 = 기본 대미지 × 이 값
const SKILL_SHOCK_PUSH = 520;        // 밀쳐 내는 처음 속도 (px/초, 넉백처럼 줄어든다). 보스는 밀리지 않는다
const SKILL_SHOCK_COOLDOWN = 12;
const SKILL_SHOCK_PRICE = 600;

// ---- 절대 영도 (화학 · 분자 운동): 잠깐 모든 적과 적 탄환이 느려진다 ----
const SKILL_FREEZE_TIME = 3;         // 지속 시간 (초)
const SKILL_FREEZE_ENEMY = 0.3;      // 적 · 적 탄환 속도 배율
const SKILL_FREEZE_BOSS = 0.6;       // 보스 속도 배율
const SKILL_FREEZE_COOLDOWN = 20;
const SKILL_FREEZE_PRICE = 1000;

// 쿨타임이 끝나 준비되면 아이콘이 한 번 튀어 오르는 시간 (초)
const SKILL_READY_BOUNCE_TIME = 0.35;

const SKILLS = [
  {
    id: "dash",
    name: "관성 질주",
    concept: "물리 · 관성",
    icon: "dash",
    color: "blue",
    price: SKILL_DASH_PRICE,
    cooldown: SKILL_DASH_COOLDOWN,
    desc: "움직이던 방향으로 " + SKILL_DASH_DISTANCE + "px 를 " + SKILL_DASH_TIME + "초 만에 돌진. 돌진하는 동안 무적",
    activate: function () {
      // 방향: 지금 누르고 있는 이동 방향. 안 누르고 있으면 대포가 보는 방향
      let d = moveInputDir();
      if (d.x === 0 && d.y === 0) d = { x: Math.cos(player.facing), y: Math.sin(player.facing) };
      const speed = SKILL_DASH_DISTANCE / SKILL_DASH_TIME;   // 거리 = 속력 × 시간
      skillState.dashTime = SKILL_DASH_TIME;
      skillState.dashVx = d.x * speed;
      skillState.dashVy = d.y * speed;
      // 무적: 원래 무적 시간과 돌진 시간 중 긴 쪽
      player.invincibleTimer = Math.max(player.invincibleTimer, SKILL_DASH_TIME);
      skillState.trail = [];
    },
  },
  {
    id: "shockwave",
    name: "충격파",
    concept: "물리 · 파동",
    icon: "wave",
    color: "purple",
    price: SKILL_SHOCK_PRICE,
    cooldown: SKILL_SHOCK_COOLDOWN,
    desc: "반경 " + SKILL_SHOCK_RADIUS + "px 안의 적에게 기본 대미지 × " + SKILL_SHOCK_DAMAGE_MULT + ", 밀쳐 내고 (보스는 안 밀림) 그 안의 적 탄환을 지운다",
    activate: function () {
      // 반경 안의 적 (거리 = 가운데끼리)
      const hit = enemies.filter(function (e) {
        return !e.dead && distance(player.x, player.y, e.x, e.y) <= SKILL_SHOCK_RADIUS;
      });
      for (const e of hit) {
        const d = distance(player.x, player.y, e.x, e.y) || 1;
        if (!enemyType(e).isBoss) pushEnemy(e, ((e.x - player.x) / d) * SKILL_SHOCK_PUSH, ((e.y - player.y) / d) * SKILL_SHOCK_PUSH);
        damageEnemy(e, player.damage * SKILL_SHOCK_DAMAGE_MULT, "skill");
      }
      // 반경 안의 적 탄환은 사라진다
      for (const b of enemyBullets) {
        if (distance(player.x, player.y, b.x, b.y) <= SKILL_SHOCK_RADIUS) b.dead = true;
      }
      enemyBullets = enemyBullets.filter(function (b) { return !b.dead; });
      skillState.rings.push({ x: player.x, y: player.y, age: 0 });
    },
  },
  {
    id: "absoluteZero",
    name: "절대 영도",
    concept: "화학 · 분자 운동",
    icon: "snow",
    color: "slate",
    price: SKILL_FREEZE_PRICE,
    cooldown: SKILL_FREEZE_COOLDOWN,
    desc: SKILL_FREEZE_TIME + "초 동안 모든 적과 적 탄환의 속도가 " + Math.round(SKILL_FREEZE_ENEMY * 100) + "% 로 (보스는 " + Math.round(SKILL_FREEZE_BOSS * 100) + "%). 분자가 거의 멈춘다",
    activate: function () {
      skillState.freezeTime = SKILL_FREEZE_TIME;
    },
  },
];

// 이름표로 스킬 찾기 (없으면 null)
function skillById(id) {
  return SKILLS.find(function (s) { return s.id === id; }) || null;
}

// 그 스킬을 가지고 있는지 (디버그 K 를 켜면 모든 스킬이 해금된다)
function skillOwned(id) {
  return saveData.ownedSkills.indexOf(id) >= 0 || (debugMode && debugSkillCheat);
}

// 지금 장착한 스킬 (없거나, 가지고 있지 않으면 null)
function equippedSkill() {
  const id = saveData.equippedSkill;
  return id && skillOwned(id) ? skillById(id) : null;
}

// 이번 판 전투에서 쓸 수 있는 스킬 (규칙이 스킬을 막으면 null: 튜토리얼 · 오늘의 도전)
function battleSkill() {
  return currentRules.useSkills ? equippedSkill() : null;
}

// 스킬 카드를 눌렀을 때: 없으면 사고 (장착한 스킬이 없으면 바로 장착), 있으면 장착 / 해제
//   결과: "bought" | "equipped" | "unequipped" | "poor"
function pressSkill(skill) {
  if (!skillOwned(skill.id)) {
    if (saveData.coins < skill.price) return "poor";
    saveData.coins -= skill.price;
    saveData.ownedSkills.push(skill.id);
    if (!equippedSkill()) saveData.equippedSkill = skill.id;
    writeSave();
    return "bought";
  }
  if (saveData.equippedSkill === skill.id) {
    saveData.equippedSkill = null;
    writeSave();
    return "unequipped";
  }
  saveData.equippedSkill = skill.id;
  writeSave();
  return "equipped";
}
