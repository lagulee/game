// =============================================================
// upgrades.js : 영구 업그레이드 (코인으로 사서, 판이 바뀌어도 남는 성장)
// -------------------------------------------------------------
// 업그레이드 하나 = UPGRADES 배열의 객체 하나. 배열에 추가하면
// 업그레이드 화면에 카드가 하나 더 생긴다.
//
// 업그레이드 객체에 들어가는 항목
//   id         : 저장할 때 쓰는 이름표 (save.js 의 saveData.upgrades[id] 에 레벨이 저장된다)
//   name       : 카드 제목
//   concept    : 어떤 개념에서 왔는지 (카드에 작게 표시)
//   icon       : 아이콘 모양 ("heart" = 하트, "bullet" = 총알)
//   color      : 카드 띠 색 (game.js 의 COLORS 팔레트 이름)
//   baseCost   : 레벨 0 → 1 의 비용
//   costGrowth : 레벨이 오를 때마다 비용이 몇 배가 되는지
//                비용 = round(baseCost × costGrowth ^ 지금 레벨)  ← 등비수열
//   maxLevel   : 최대 레벨
//   valueAt(level) : 그 레벨일 때의 효과 값 (예: 체력 레벨 3 → 130)  ← 등차수열
//   label(value)   : 화면에 보여 줄 글자 (예: "체력 130")
//   apply(level)   : 판을 시작할 때 플레이어에게 효과를 적용하는 함수
// =============================================================

// 업그레이드 비용 공통 값: 비용 = round(40 × 1.15 ^ 지금 레벨)
const UPGRADE_BASE_COST = tune("UPGRADE_BASE_COST", 40);
const UPGRADE_COST_GROWTH = tune("UPGRADE_COST_GROWTH", 1.15);
const UPGRADE_MAX_LEVEL = 30;

// 체력 업그레이드: 레벨당 최대 체력 + 이 값
const UPGRADE_HP_PER_LEVEL = tune("UPGRADE_HP_PER_LEVEL", 10);
// 공격력 업그레이드: 레벨당 기본 대미지 + 이 값
const UPGRADE_DAMAGE_PER_LEVEL = tune("UPGRADE_DAMAGE_PER_LEVEL", 1);

const UPGRADES = [
  {
    id: "vitality",
    name: "체력",
    concept: "생물 · 심폐 지구력",
    icon: "heart",
    color: "red",
    baseCost: UPGRADE_BASE_COST,
    costGrowth: UPGRADE_COST_GROWTH,
    maxLevel: UPGRADE_MAX_LEVEL,
    // 최대 체력 = 100 + 10 × 레벨
    valueAt: function (level) {
      return PLAYER_MAX_HP + UPGRADE_HP_PER_LEVEL * level;
    },
    label: function (value) {
      return "체력 " + value;
    },
    apply: function (level) {
      player.maxHp = this.valueAt(level);
    },
  },
  {
    id: "power",
    name: "공격력",
    concept: "물리 · 운동량",
    icon: "bullet",
    color: "yellow",
    baseCost: UPGRADE_BASE_COST,
    costGrowth: UPGRADE_COST_GROWTH,
    maxLevel: UPGRADE_MAX_LEVEL,
    // 기본 대미지 = 10 + 1 × 레벨
    valueAt: function (level) {
      return BULLET_DAMAGE + UPGRADE_DAMAGE_PER_LEVEL * level;
    },
    label: function (value) {
      return "공격력 " + value;
    },
    apply: function (level) {
      player.damage = this.valueAt(level);
    },
  },
];

// 업그레이드의 지금 레벨 (저장 데이터에서 읽는다. 없으면 0)
function upgradeLevel(up) {
  return saveData.upgrades[up.id] || 0;
}

// 다음 레벨로 올리는 비용 = round(기본 비용 × 증가율 ^ 지금 레벨)
function upgradeCost(up) {
  return Math.round(up.baseCost * Math.pow(up.costGrowth, upgradeLevel(up)));
}

// 업그레이드를 하나 사는 함수. 결과를 글자로 돌려준다.
//   "ok"   : 샀다 (코인을 빼고 레벨을 올리고 바로 저장)
//   "poor" : 코인이 모자라다
//   "max"  : 이미 최대 레벨이다
function buyUpgrade(up) {
  if (upgradeLevel(up) >= up.maxLevel) return "max";
  const cost = upgradeCost(up);
  if (saveData.coins < cost) return "poor";
  saveData.coins -= cost;
  saveData.upgrades[up.id] = upgradeLevel(up) + 1;
  writeSave();
  return "ok";
}

// 판을 시작할 때: 모든 업그레이드 효과를 플레이어에게 적용
function applyUpgrades() {
  // 업그레이드를 하나씩 보며 지금 레벨의 효과를 적용하는 반복문
  for (const up of UPGRADES) {
    up.apply(upgradeLevel(up));
  }
}
