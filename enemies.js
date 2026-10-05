// =============================================================
// enemies.js : 적 종류를 모아 두는 파일
// -------------------------------------------------------------
// 적 한 종류 = ENEMY_TYPES 안의 객체 하나. 새 종류를 추가하면
// waves.js 에서 { type: "새이름", count: 5 } 처럼 불러 쓸 수 있다.
//
// 적 종류 객체에 들어가는 항목
//   name          : 적 이름 (안내 띠, 도감에서 보여 줄 이름)
//   desc          : 도감에 보여 줄 짧은 설명 (한 줄)
//   hp            : 최대 체력
//   speed         : 1웨이브 기준 이동 속도 (px/초)
//   radius        : 몸 반지름 (px). 충돌 판정과 그림 크기에 쓰인다
//   color         : 몸 색. game.js 의 COLORS 팔레트 이름
//   contactDamage : 플레이어에게 닿았을 때 깎는 체력
//   score         : 처치 점수 (실제 점수 = score × 웨이브 번호)
//   shape         : 그림 모양 ("basic", "arrow", "diamond", "splitter") - game.js 가 그린다
//   knockResist   : 넉백을 받는 정도 (1 = 그대로 밀림, 0.5 = 절반만, 0 = 안 밀림)
//   getKnockResist(enemy)  (생략 가능)
//     지금 상태에 따라 knockResist 를 바꾸고 싶을 때 (돌격형은 돌진 중에 0)
//
//   init(enemy)              (생략 가능)
//     언제: 이 적이 처음 만들어질 때 한 번
//     적마다 다른 값(무작위 위상, 행동 상태 등)을 준비한다.
//
//   update(enemy, dt, info)
//     언제: 매 프레임, 적 하나하나를 움직일 때
//     info.speed     : 이번 프레임에 낼 수 있는 속도 (= 기본 속도 × timeScale)
//     info.timeScale : 증강(시간 지연 등)이 정한 "이 적의 시간 배율" (1 = 보통, 0.2 = 5배 느림)
//     info.localDt   : 이 적의 시계로 흐른 시간 (= dt × timeScale)
//     ※ 대기·돌진·흔들림 같은 "행동 시간"은 반드시 localDt 로 잰다.
//       그래야 시간 지연 증강을 받으면 예고 시간과 돌진도 똑같이 느려진다.
//
//   onDeath(enemy)
//     언제: 이 적의 체력이 0 이 되어 죽는 순간
//     터지는 효과, 작은 적으로 갈라지기 같은 일을 한다.
//
//   onHurt(enemy)            (생략 가능)
//     언제: 총알에 맞아 체력이 줄었지만 아직 살아 있을 때
//     체력이 몇 % 아래로 내려가면 패턴을 바꾸는 보스에게 쓴다.
//
// ---- 4단계에서 추가된 항목 (생략 가능) ----
//   modifyBulletDamage(enemy, damage, bullet) : 총알에 맞을 때 대미지를 바꿔 돌려준다 (방패형)
//                                               반감기·발열 반응처럼 총알이 아닌 대미지는 거치지 않는다
//   resonance: { range, boost }   : 범위 안의 다른 적 속도 × boost (공명형. 여러 마리가 겹쳐도 한 번만)
//   pullOn(enemy, x, y)           : (x, y) 에 있는 플레이어를 당기는 가속도 { ax, ay } (자석형, 블랙홀)
//   drawAura(enemy)               : 몸보다 먼저 바닥에 범위를 그린다 (공명형 물결, 자석형 자기장)
//   enemy.chargeFlash = true      : 몸이 빠르게 깜빡인다 (사수형: 곧 쏜다는 신호)
//   damageTakenMult(enemy)        : 받는 대미지 배율 (총알·폭발 모두). 블랙홀: 약점이 닫혀 있으면 0.3
//   bendBullet(enemy, bullet, dt) : 플레이어 총알을 휘게 한다 (블랙홀)
//
// ---- 보스 전용 항목 ----
//   isBoss       : true 면 보스. 화면 위쪽 큰 체력바, 처치 시 체력 회복
//   timeScaleMin : 시간 지연을 받아도 이 배율 아래로는 느려지지 않는다 (보스 0.6)
//   crown        : true 면 머리에 왕관을 그린다
//   warnLength   : 돌진 예고선 길이 (생략하면 CHARGER_WARN_LENGTH)
// =============================================================


// ---- 사수형 (물리 · 등속 직선 운동): 거리를 두고 조준탄을 쏜다 ----
const SHOOTER_RANGE = 250;          // 플레이어와 이 거리(px)를 유지하려 한다
const SHOOTER_RANGE_SLACK = 30;     // ± 이만큼은 괜찮은 거리로 본다 (그 안에서는 옆으로 돈다)
const SHOOTER_FIRE_INTERVAL = 2.5;  // 쏘는 간격 (초)
const SHOOTER_WARN_TIME = 0.5;      // 쏘기 전에 몸이 깜빡이는 시간 (초)
const SHOOTER_BULLET_DAMAGE = 12;   // 조준탄 기본 대미지 (× 웨이브 접촉 대미지 배율)

// ---- 방패형 (수학 · 각도): 앞쪽 120° 를 방패로 막는다 ----
const SHIELD_ARC = (Math.PI * 2) / 3;     // 방패가 막는 범위 (120°)
const SHIELD_TURN_RATE = Math.PI / 3;     // 방패가 플레이어 쪽으로 도는 최대 빠르기 (초당 60°)
const SHIELD_REDUCTION = 0.8;             // 방패에 맞은 총알의 대미지 감소율 (0.8 = 80% 감소)

// ---- 공명형 (물리 · 공명): 주변 적을 빠르게 하고, 자기는 멀리 도망친다 ----
const RESONATOR_RANGE = 150;        // 공명 범위 반지름 (px)
const RESONATOR_BOOST = 1.3;        // 범위 안의 다른 적 속도 배율 (+30%). 여러 마리가 겹쳐도 한 번만
const RESONATOR_FLEE_DISTANCE = 320; // 플레이어가 이 거리보다 가까우면 도망친다
const RESONATOR_MARGIN = 30;        // 화면 가장자리에서 이만큼 안쪽까지만 도망친다

// ---- 자석형 (물리 · 만유인력): 가까이 온 플레이어를 끌어당긴다 ----
const MAGNET_RANGE = 220;           // 당기는 범위 반지름 (px)
const MAGNET_STRENGTH = 2900000;    // 당기는 세기 G. 가속도 = G ÷ r²  (r = 220px → 약 60 px/초², 110px → 약 240 px/초²)
const MAGNET_MAX_ACCEL_RATIO = 0.4; // 가속도 상한 = 플레이어 가속도 × 0.4

// ---- 파동 군주 (보스 · 물리 · 파동): 위쪽을 사인 곡선으로 오가며 원형 탄막 ----
const WL_Y = 95;                       // 오가는 높이 (화면 위쪽)
const WL_AMPLITUDE = 330;              // 좌우로 오가는 폭 A (가운데에서 ± px)
const WL_OMEGA = 0.55;                 // 오가는 빠르기 ω (rad/초). 한 번 왕복 2π/ω ≈ 11초
const WL_FIRE_INTERVAL = 3;            // 원형 탄막 간격 (초)
const WL_RING_COUNT = 12;              // 한 겹의 탄환 수 (360° ÷ 12 = 30° 간격)
const WL_SECOND_RING_DELAY = 0.5;      // 화가 나면 두 번째 겹을 이만큼 뒤에 쏜다 (초)
const WL_SECOND_RING_OFFSET = Math.PI / 12;  // 두 번째 겹은 15° 어긋나게
const WL_ENRAGE_RATIO = 0.5;           // 체력이 이 비율 아래면 두 겹
const WL_BULLET_DAMAGE = 14;

// ---- 회전 포대 (보스 · 물리 · 각속도): 가운데에서 4방향 총구를 돌리며 나선 탄막 ----
const TURRET_BARRELS = 4;              // 총구 수 (90° 간격)
const TURRET_OMEGA = 1.0;              // 체력이 가득일 때 각속도 ω (rad/초)
const TURRET_OMEGA_GAIN = 1.2;         // 체력이 줄수록 ω × (1 + 1.2 × 잃은 비율) → 체력 0 에 가까우면 2.2배
const TURRET_FIRE_INTERVAL = 0.3;      // 총구마다 쏘는 간격 (초)
const TURRET_FLIP_TIME = 10;           // 이 시간(초)마다 회전 방향이 반대로
const TURRET_FLIP_WARN = 1;            // 바뀌기 전에 예고하는 시간 (초)
const TURRET_BULLET_DAMAGE = 12;

// ---- 블랙홀 (보스 · 물리 · 중력): 끌어당기고, 사건의 지평선에 닿으면 큰 대미지 ----
const BH_PULL_STRENGTH = 7000000;      // 플레이어를 당기는 세기 G (가속도 = G ÷ r²)
const BH_PULL_MAX_RATIO = 0.25;        // 당기는 가속도 상한 = 플레이어 가속도 × 0.25
const BH_PULL_RANGE = 420;             // 이 거리(px)보다 멀면 당기지 않는다 (멀리 떨어지면 안전)
const BH_HORIZON = 50;                 // 사건의 지평선 반지름 (px). 여기에 닿으면 큰 대미지
const BH_HORIZON_DAMAGE = 40;          // 지평선 대미지 (× 웨이브 접촉 대미지 배율)
const BH_KICK = 320;                   // 지평선에 닿으면 바깥으로 튕겨 내는 속도 (px/초)
const BH_BEND_STRENGTH = 3000000;      // 플레이어 총알을 휘게 하는 세기 (가속도 = G ÷ r²)
const BH_BEND_MAX = 2500;              // 총알을 휘게 하는 가속도 상한 (px/초²)
const BH_WEAK_PERIOD = 8;              // 약점 주기 (초)
const BH_WEAK_TIME = 3;                // 주기의 마지막 이 시간(초) 동안 약점이 드러난다
const BH_ARMOR = 0.3;                  // 약점이 닫혀 있을 때 받는 대미지 배율 (30%)

// ---- 공통 ----

// ---- 웨이브 스케일링 : 웨이브가 올라갈수록 적이 얼마나 강해지는지 ----
// w = 웨이브 번호 (1부터). 배율 = 기본 배율(BASE) × (1 + 증가량(GROWTH) × (w − 1))
//   BASE   : 1웨이브부터 이미 몇 배인지 (영구 업그레이드로 따라잡아야 할 "출발선")
//   GROWTH : 한 웨이브마다 BASE 의 몇 % 씩 늘어나는지 (등차수열)
// 아래 숫자를 바꾸면 게임 전체 난이도가 바뀐다. (측정 결과와 조정 후보는
//  tools/balance-results.md 에 있다. tools/balance.js 로 다시 잴 수 있다)

// 체력: 1웨이브 2배, 한 웨이브마다 +12%  (30웨이브: 2 × (1 + 0.12 × 29) = 8.96배)
const ENEMY_HP_BASE = tune("ENEMY_HP_BASE", 2.0);
const ENEMY_HP_GROWTH = tune("ENEMY_HP_GROWTH", 0.12);
// 접촉 대미지: 1웨이브 1.5배, 한 웨이브마다 +5%  (30웨이브: 1.5 × 2.45 = 3.675배)
const ENEMY_DMG_BASE = tune("ENEMY_DMG_BASE", 1.5);
const ENEMY_DMG_GROWTH = tune("ENEMY_DMG_GROWTH", 0.05);
// 속도: 1웨이브 1.5배, 한 웨이브마다 +2.5%, 단 2.2배를 넘지 않는다
//   (기본 적 60 × 1.5 = 90. 플레이어 220 보다 느리지만, 무리로 둘러싸면 도망칠 길이 좁아진다)
const ENEMY_SPEED_BASE = tune("ENEMY_SPEED_BASE", 1.5);
const ENEMY_SPEED_STEP = tune("ENEMY_SPEED_STEP", 0.025);
const ENEMY_SPEED_MAX_MULT = tune("ENEMY_SPEED_MAX_MULT", 2.2);

// w 웨이브의 속도 배율 = min(2.2, 1.5 × (1 + 0.025 × (w − 1)))
function waveSpeedMult(w) {
  return Math.min(ENEMY_SPEED_MAX_MULT, ENEMY_SPEED_BASE * (1 + ENEMY_SPEED_STEP * (w - 1)));
}

// w 웨이브의 체력 배율 = 2.0 × (1 + 0.12 × (w − 1))
function waveHpMult(w) {
  return ENEMY_HP_BASE * (1 + ENEMY_HP_GROWTH * (w - 1));
}

// w 웨이브의 접촉 대미지 배율 = 1.5 × (1 + 0.05 × (w − 1))
function waveDamageMult(w) {
  return ENEMY_DMG_BASE * (1 + ENEMY_DMG_GROWTH * (w - 1));
}

// 적 종류(type)가 w 웨이브에 태어났을 때의 속도·체력·접촉 대미지를 한 번에 계산
function waveScaledStats(type, w) {
  return {
    speed: type.speed * waveSpeedMult(w),
    hp: type.hp * waveHpMult(w),
    contactDamage: type.contactDamage * waveDamageMult(w),
  };
}

// ---- 돌격형(charger) 조절용 상수 ----
const CHARGER_TRIGGER_DISTANCE = 200; // 플레이어가 이 거리(px) 안에 들어오면 돌진 준비
const CHARGER_APPROACH_TIME = 1.5;    // 접근을 이 시간(초) 넘게 하면 거리와 상관없이 돌진 준비
const CHARGER_WARN_TIME = 0.6;        // 예고(멈춰서 조준) 시간 (초)
const CHARGER_DASH_TIME = 0.5;        // 돌진 시간 (초)
const CHARGER_REST_TIME = 1.0;        // 돌진 후 쉬는 시간 (초)
const CHARGER_DASH_MULT = 3;          // 돌진 속도 = 평소 속도 × 이 값
const CHARGER_WARN_LENGTH = 300;      // 예고선 길이 (px)

// ---- 사인파형(sine) 조절용 상수 ----
const SINE_AMPLITUDE = 40;  // 흔들림 크기 A (px): 가운데 줄에서 양옆으로 최대 40px
const SINE_OMEGA = 2.5;     // 각속도 ω (rad/초): 클수록 빨리 흔들린다. 한 번 왕복 = 2π/ω ≈ 2.5초

// ---- 보스 공통 ----
const BOSS_TIME_SCALE_MIN = 0.6;  // 보스는 시간 지연을 받아도 0.6배보다 느려지지 않는다
const BOSS_ENTER_Y = 170;         // 보스가 화면 위에서 내려와 자리 잡는 높이 (px). 위쪽 보스 체력바 아래

// ---- 돌진 대장(chargerKing) 조절용 상수 ----
const CK_FIRST_WARN_TIME = 0.8;   // 한 사이클의 첫 예고 시간 (초)
const CK_REAIM_TIME = 0.35;       // 연속 돌진 사이의 짧은 재조준 예고 (초)
const CK_DASH_TIME = 0.5;         // 돌진 한 번의 시간 (초)
const CK_DASH_MULT = 4;           // 돌진 속도 = 평소 속도 × 이 값
const CK_DASHES = 3;              // 한 사이클의 연속 돌진 횟수
const CK_DASHES_ENRAGED = 4;      // 체력 50% 아래일 때 연속 돌진 횟수
const CK_ENRAGE_RATIO = 0.5;      // 이 비율 아래로 체력이 떨어지면 화난 상태
const CK_REST_TIME = 2.0;         // 연속 돌진 후 쉬는 시간 (초)
const CK_SUMMON_COUNT = 2;        // 화난 상태에서 쉬기 시작할 때 소환하는 돌격형 수

// ---- 분열의 왕(splitterKing) 조절용 상수 ----
const SK_THRESHOLDS = [0.66, 0.33];  // 이 체력 비율을 지날 때마다 자식을 방출
const SK_RADII = [40, 32, 24];       // 단계별 반지름 (방출할수록 작아진다)
const SK_SPEED_UP = 1.3;             // 방출할 때마다 속도 × 1.3
const SK_RELEASE_COUNT = 3;          // 한 번에 방출하는 splitterChild 수 (120° 간격)

// ---- 분열형(splitter) 조절용 상수 ----
const SPLITTER_SPEED = 55;   // 큰 분열형의 속도
const SPLIT_OFFSET = 20;     // 분열할 때 자식이 좌우로 떨어져 나오는 거리 (px)


// 모든 적 종류를 담는 객체. "이름표: 데이터" 모양으로 적는다.
const ENEMY_TYPES = {
  // ---- 기본 적: 플레이어를 향해 똑바로 다가온다 ----
  basic: {
    name: "기본 적",
    desc: "똑바로 다가온다",
    // 체력: 기본 대미지 10 × 6방 = 60
    // (5~8방 사이로 잡아서, 같은 적을 여러 번 맞히는 "복리 탄환"이 의미 있게 함)
    hp: 60,
    speed: 60,          // 플레이어(220)보다 느려야 도망칠 수 있다
    radius: 16,         // 화난 얼굴을 그리기 위해 조금 크게 잡았다
    color: "red",
    contactDamage: 20,  // 100 ÷ 20 = 5번 닿으면 게임 오버
    knockResist: 1,
    score: 100,
    shape: "basic",

    // 플레이어 쪽으로 똑바로 걸어온다
    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    // 죽으면 조각(파티클)이 사방으로 튀어 나간다
    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y);
    },
  },

  // ---- 돌격형: 다가오다 멈춰서 조준한 뒤, 한 방향으로 빠르게 돌진 ----
  // 행동 순환: 접근 → 예고 → 돌진 → 쉬기 → 다시 접근 ...
  charger: {
    name: "돌격형",
    desc: "멈춰서 조준 → 돌진",
    hp: 40,
    speed: 70,          // 평소에는 기본 적(60)과 비슷하게 걷는다
    radius: 16,
    color: "brown",
    contactDamage: 30,  // 세게 들이받는다
    knockResist: 1,
    score: 120,
    shape: "arrow",

    // 돌진하는 동안은 넉백을 받지 않는다 (달리는 황소는 총알로 못 민다)
    getKnockResist: function (enemy) {
      return enemy.state === "dash" ? 0 : this.knockResist;
    },

    init: function (enemy) {
      enemy.state = "approach"; // 지금 하고 있는 행동
      enemy.stateTime = 0;      // 지금 행동을 시작한 뒤 흐른 시간 (이 적의 시계로)
      enemy.dirX = 1;           // 바라보는/돌진할 방향 (길이 1)
      enemy.dirY = 0;
    },

    update: function (enemy, dt, info) {
      // 행동 시간은 이 적의 시계(localDt)로 잰다 → 시간 지연을 받으면 모든 행동이 느려진다
      enemy.stateTime += info.localDt;
      const dist = distance(enemy.x, enemy.y, player.x, player.y);

      if (enemy.state === "approach") {
        // 1) 접근: 플레이어 쪽을 보며 걸어온다
        aimAt(enemy, player.x, player.y);
        moveToward(enemy, player.x, player.y, info.speed, dt);
        // 가까워졌거나 충분히 걸었으면 예고 단계로
        if (dist < CHARGER_TRIGGER_DISTANCE || enemy.stateTime >= CHARGER_APPROACH_TIME) {
          setEnemyState(enemy, "warn");
        }
      } else if (enemy.state === "warn") {
        // 2) 예고: 멈춰 선다. 방향은 예고가 시작된 순간(접근의 마지막 조준)으로 고정!
        //    예고선이 보이는 동안 그 선 밖으로 피하라는 신호다
        if (enemy.stateTime >= CHARGER_WARN_TIME) {
          setEnemyState(enemy, "dash");
        }
      } else if (enemy.state === "dash") {
        // 3) 돌진: 고정한 방향으로 평소 속도의 3배로 달린다
        const step = info.speed * CHARGER_DASH_MULT * dt;
        enemy.x += enemy.dirX * step;
        enemy.y += enemy.dirY * step;
        // 돌진하다 화면 밖으로 나가 버리지 않게 가장자리에서 멈춘다
        enemy.x = clamp(enemy.x, enemy.radius, CANVAS_WIDTH - enemy.radius);
        enemy.y = clamp(enemy.y, enemy.radius, CANVAS_HEIGHT - enemy.radius);
        if (enemy.stateTime >= CHARGER_DASH_TIME) {
          setEnemyState(enemy, "rest");
        }
      } else if (enemy.state === "rest") {
        // 4) 쉬기: 숨을 고른다 (공격할 기회!)
        if (enemy.stateTime >= CHARGER_REST_TIME) {
          setEnemyState(enemy, "approach");
        }
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.brown);
    },
  },

  // ---- 사인파형: 좌우로 사인 곡선을 그리며 다가온다 ----
  // 진행 방향에 수직인 방향으로 위치가 y = A·sin(ωt + φ) 처럼 흔들린다.
  sine: {
    name: "사인파형",
    desc: "흔들흔들 다가옴",
    hp: 50,
    speed: 60,
    radius: 15,
    color: "purple",
    contactDamage: 20,
    knockResist: 1,
    score: 120,
    shape: "diamond",

    init: function (enemy) {
      enemy.waveTime = 0;                        // 흔들림에 쓰는 시간 t (이 적의 시계로)
      enemy.phase = Math.random() * Math.PI * 2; // 시작 위상 φ: 적마다 흔들림 박자가 다르게
    },

    update: function (enemy, dt, info) {
      enemy.waveTime += info.localDt;

      // 플레이어 쪽 방향 (길이 1)
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fx = dx / dist;
      const fy = dy / dist;

      // 진행 방향에 수직인 방향: (x, y) 를 90도 돌리면 (-y, x)
      const px = -fy;
      const py = fx;

      // 옆으로 흔들리는 속도 = 위치 A·sin(ωt + φ) 를 시간으로 미분한 값
      //   d/dt [A·sin(ωt + φ)] = A·ω·cos(ωt + φ)
      // t 는 이 적의 시계로 흐르므로, 실제 시간으로 바꾸면 timeScale 을 한 번 더 곱한다
      const sideSpeed = SINE_AMPLITUDE * SINE_OMEGA *
        Math.cos(SINE_OMEGA * enemy.waveTime + enemy.phase) * info.timeScale;

      // 앞으로 가는 속도 + 옆으로 흔들리는 속도
      enemy.x += (fx * info.speed + px * sideSpeed) * dt;
      enemy.y += (fy * info.speed + py * sideSpeed) * dt;
      // 그림에서 마름모가 움직이는 쪽으로 기울도록 기록
      enemy.tilt = Math.atan2(fy * info.speed + py * sideSpeed, fx * info.speed + px * sideSpeed);
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.purple);
    },
  },

  // ---- 분열형: 죽으면 작은 분열형 2마리로 갈라진다 ----
  splitter: {
    name: "분열형",
    desc: "죽으면 둘로 갈라짐",
    hp: 60,
    speed: SPLITTER_SPEED,
    radius: 20,
    color: "orange",
    contactDamage: 15,
    knockResist: 1,
    score: 150,
    shape: "splitter",
    innerCircles: 2,    // 몸 안에 비쳐 보이는 작은 원 개수 (= 갈라질 자식 수)

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.orange);
      splitInto(enemy, "splitterChild");
    },
  },

  // 분열형의 자식: 더 작고 빠르다. 죽으면 손자 2마리로 갈라진다
  splitterChild: {
    name: "분열형 조각",
    hp: 30,
    speed: SPLITTER_SPEED * 1.2,
    radius: 14,
    color: "orange",
    contactDamage: 15,
    knockResist: 1,
    score: 60,          // 작을수록 처치 점수가 적다
    shape: "splitter",
    innerCircles: 2,

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.orange);
      splitInto(enemy, "splitterGrandchild");
    },
  },

  // 분열형의 손자: 가장 작고 빠르다. 더는 갈라지지 않는다
  splitterGrandchild: {
    name: "분열형 알갱이",
    hp: 15,
    speed: SPLITTER_SPEED * 1.4,
    radius: 10,
    color: "orange",
    contactDamage: 10,
    knockResist: 1,
    score: 30,
    shape: "splitter",
    innerCircles: 0,

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.orange);
    },
  },

  // =========================================================
  // 보스
  // =========================================================

  // ---- 사수형 (물리 · 등속 직선 운동): 250px 거리를 유지하며 2.5초마다 조준탄 1발 ----
  // 조준탄은 쏜 순간의 플레이어 쪽으로 똑같은 빠르기로 곧게 날아간다 (등속 직선 운동).
  // 그래서 쏘는 순간 옆으로 비켜서면 피할 수 있다. 쏘기 0.5초 전에 몸이 깜빡인다.
  shooter: {
    name: "사수형",
    desc: "거리 두고 조준탄",
    hp: 40,
    speed: 55,
    radius: 15,
    color: "blue",
    contactDamage: 15,
    knockResist: 1,
    score: 130,
    shape: "shooter",

    init: function (enemy) {
      enemy.fireTimer = SHOOTER_FIRE_INTERVAL;   // 다음 발사까지 남은 시간
      enemy.strafe = Math.random() < 0.5 ? -1 : 1; // 알맞은 거리에서 옆으로 도는 방향
      enemy.dirX = 1;
      enemy.dirY = 0;
      enemy.chargeFlash = false;
    },

    update: function (enemy, dt, info) {
      aimAt(enemy, player.x, player.y);           // 총신은 늘 플레이어 쪽
      const dist = distance(enemy.x, enemy.y, player.x, player.y);
      if (dist > SHOOTER_RANGE + SHOOTER_RANGE_SLACK) {
        moveToward(enemy, player.x, player.y, info.speed, dt);          // 멀면 다가간다
      } else if (dist < SHOOTER_RANGE - SHOOTER_RANGE_SLACK) {
        moveToward(enemy, player.x, player.y, -info.speed, dt);         // 가까우면 물러난다
      } else {
        // 알맞은 거리: 플레이어 둘레를 천천히 돈다 (바라보는 방향의 수직)
        enemy.x += -enemy.dirY * enemy.strafe * info.speed * 0.5 * dt;
        enemy.y += enemy.dirX * enemy.strafe * info.speed * 0.5 * dt;
      }
      // 화면 안에 들어온 뒤에는 화면 밖으로 물러나지 않는다
      const onScreen = enemy.x > 0 && enemy.x < CANVAS_WIDTH && enemy.y > 0 && enemy.y < CANVAS_HEIGHT;
      if (onScreen || enemy.entered) {
        enemy.entered = true;
        enemy.x = clamp(enemy.x, enemy.radius, CANVAS_WIDTH - enemy.radius);
        enemy.y = clamp(enemy.y, enemy.radius, CANVAS_HEIGHT - enemy.radius);
        // 발사 타이머 (이 적의 시계 localDt 로 잰다 → 시간 지연을 받으면 늦게 쏜다)
        enemy.fireTimer -= info.localDt;
        enemy.chargeFlash = enemy.fireTimer <= SHOOTER_WARN_TIME;
        if (enemy.fireTimer <= 0) {
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          spawnEnemyBullet(enemy.x + enemy.dirX * enemy.radius, enemy.y + enemy.dirY * enemy.radius, angle, { damage: SHOOTER_BULLET_DAMAGE });
          enemy.fireTimer = SHOOTER_FIRE_INTERVAL;
          enemy.chargeFlash = false;
        }
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.blue);
    },
  },

  // ---- 방패형 (수학 · 각도): 앞쪽 120° 범위에 방패. 방패는 초당 60° 까지만 천천히 돈다 ----
  // 총알이 맞은 방향과 방패 방향 사이의 각도가 60° (120° 의 절반) 안이면 방패에 맞은 것 → 대미지 80% 감소.
  // 방패가 천천히 돌기 때문에, 빠르게 옆이나 뒤로 돌아가서 쏘면 제대로 맞힐 수 있다.
  // 반감기·발열 반응처럼 총알이 아닌 대미지는 방패를 무시한다 (modifyBulletDamage 는 총알에만 쓰인다).
  shield: {
    name: "방패형",
    desc: "옆·뒤가 약점",
    hp: 70,
    speed: 38,
    radius: 18,
    color: "slate",
    contactDamage: 20,
    knockResist: 0.5,
    score: 160,
    shape: "shield",

    init: function (enemy) {
      enemy.shieldAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);  // 처음에는 플레이어 쪽
      enemy.shieldFlash = 0;   // 방패로 막았을 때 반짝이는 남은 시간 (그림 전용)
    },

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
      // 방패를 플레이어 쪽으로, 이번 프레임에 돌 수 있는 만큼만 돌린다 (이 적의 시계 localDt 로)
      const want = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const diff = angleDifference(want, enemy.shieldAngle);
      const maxTurn = SHIELD_TURN_RATE * info.localDt;
      enemy.shieldAngle += clamp(diff, -maxTurn, maxTurn);
      enemy.shieldFlash = Math.max(0, enemy.shieldFlash - dt);
    },

    // 총알이 맞은 방향이 방패 쪽이면 대미지 80% 감소
    modifyBulletDamage: function (enemy, damage, bullet) {
      if (!shieldBlocks(enemy, bullet.x, bullet.y)) return damage;
      enemy.shieldFlash = 0.15;
      return damage * (1 - SHIELD_REDUCTION);
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.slate);
    },
  },

  // ---- 공명형 (물리 · 공명): 반경 150px 안의 다른 적 속도 +30% ----
  // 그네를 그네의 박자에 맞춰 밀면 점점 크게 흔들린다(공명). 공명형은 주변 적의 "박자"를 맞춰 빠르게 만든다.
  // 자기는 약해서 플레이어에게서 멀리 떨어지려 한다 → 먼저 찾아가서 잡는 것이 좋다.
  resonator: {
    name: "공명형",
    desc: "주변 적 +30% 가속",
    hp: 35,
    speed: 60,
    radius: 14,
    color: "pink",
    contactDamage: 10,
    knockResist: 1,
    score: 140,
    shape: "resonator",
    resonance: { range: RESONATOR_RANGE, boost: RESONATOR_BOOST },

    init: function (enemy) {
      enemy.wobble = Math.random() * Math.PI * 2;   // 도망 다닐 때 흔들리는 박자 (적마다 다르게)
    },

    update: function (enemy, dt, info) {
      enemy.wobble += info.localDt * 2;
      const dist = distance(enemy.x, enemy.y, player.x, player.y);
      if (dist < RESONATOR_FLEE_DISTANCE) {
        // 플레이어 반대쪽으로 도망 (조금씩 옆으로 흔들리며)
        const ax = enemy.x - player.x, ay = enemy.y - player.y, len = dist || 1;
        const side = Math.sin(enemy.wobble) * 0.6;
        enemy.x += ((ax / len) - (ay / len) * side) * info.speed * dt;
        enemy.y += ((ay / len) + (ax / len) * side) * info.speed * dt;
      } else {
        // 충분히 멀면 화면 가운데 쪽으로 천천히 (구석에 박혀 있지 않게)
        moveToward(enemy, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, info.speed * 0.3, dt);
      }
      // 화면 안에 들어온 뒤에는 가장자리 안쪽에 머문다
      if (enemy.entered || (enemy.x > RESONATOR_MARGIN && enemy.x < CANVAS_WIDTH - RESONATOR_MARGIN &&
                            enemy.y > RESONATOR_MARGIN && enemy.y < CANVAS_HEIGHT - RESONATOR_MARGIN)) {
        enemy.entered = true;
        enemy.x = clamp(enemy.x, RESONATOR_MARGIN, CANVAS_WIDTH - RESONATOR_MARGIN);
        enemy.y = clamp(enemy.y, RESONATOR_MARGIN, CANVAS_HEIGHT - RESONATOR_MARGIN);
      } else {
        moveToward(enemy, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, info.speed, dt);   // 들어오는 중
      }
    },

    // 공명 범위: 바깥으로 퍼져 나가는 분홍 물결 고리 3개
    drawAura: function (enemy) {
      ctx.save();
      ctx.strokeStyle = COLORS.pink;
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        const t = ((runTime * 0.8 + k / 3) % 1);          // 0 → 1 로 퍼진다
        ctx.globalAlpha = 0.45 * (1 - t);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + (RESONATOR_RANGE - enemy.radius) * t, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.18;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, RESONATOR_RANGE, 0, Math.PI * 2);   // 범위 끝
      ctx.stroke();
      ctx.restore();
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.pink);
    },
  },

  // ---- 자석형 (물리 · 만유인력): 반경 220px 안의 플레이어를 끌어당긴다 ----
  // 당기는 가속도 a = G ÷ r² (거리가 절반이면 4배). 너무 가까우면 끝없이 커지지 않게 상한을 둔다.
  // 끌려가는 속도는 플레이어가 조종하는 속도와 따로 쌓이고, 범위를 벗어나면 마찰로 줄어든다.
  magnet: {
    name: "자석형",
    desc: "끌어당김",
    hp: 80,
    speed: 25,
    radius: 20,
    color: "red",
    contactDamage: 25,
    knockResist: 0.3,
    score: 170,
    shape: "magnet",

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    pullOn: function (enemy, x, y) {
      return gravityPull(enemy.x, enemy.y, x, y, MAGNET_RANGE, MAGNET_STRENGTH, PLAYER_ACCELERATION * MAGNET_MAX_ACCEL_RATIO);
    },

    // 자기장: 범위 원(점선)과, 플레이어가 범위 안이면 끌어당기는 선
    drawAura: function (enemy) {
      ctx.save();
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.22;
      ctx.setLineDash([4, 10]);
      ctx.lineDashOffset = runTime * 30;                   // 안쪽으로 흐르는 느낌
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, MAGNET_RANGE, 0, Math.PI * 2);
      ctx.stroke();
      const d = distance(enemy.x, enemy.y, player.x, player.y);
      if (d <= MAGNET_RANGE) {
        ctx.globalAlpha = 0.5 * (1 - d / MAGNET_RANGE) + 0.15;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(enemy.x, enemy.y);
        ctx.stroke();
      }
      ctx.restore();
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.red);
      spawnParticles(enemy.x, enemy.y, COLORS.blue);
    },
  },

  // ---- 돌진 대장 (물리 · 가속도): 돌격형의 왕. 연속 돌진을 퍼붓는다 ----
  // 순환: 예고 0.8초 → 돌진 → (재조준 0.35초 → 돌진) ... 총 3번 → 쉬기 2초
  // 체력 50% 아래: 4연속 돌진, 쉬기 시작할 때 돌격형 2마리 소환
  chargerKing: {
    name: "돌진 대장",
    desc: "보스 · 연속 돌진",
    isBoss: true,
    hp: 600,
    speed: 70,
    radius: 34,
    color: "brown",
    contactDamage: 30,
    score: 1000,
    shape: "arrow",
    crown: true,
    knockResist: 0,
    timeScaleMin: BOSS_TIME_SCALE_MIN,
    warnLength: 420,

    init: function (enemy) {
      enemy.state = "enter";   // 처음에는 화면 위에서 내려온다
      enemy.stateTime = 0;
      enemy.dirX = 0;
      enemy.dirY = 1;
      enemy.dashesLeft = 0;    // 이번 사이클에 남은 돌진 횟수
      enemy.enraged = false;   // 체력 50% 아래로 내려갔는지
    },

    update: function (enemy, dt, info) {
      // 행동 시간은 보스의 시계(localDt)로 잰다
      enemy.stateTime += info.localDt;

      if (enemy.state === "enter") {
        // 등장: 아래로 걸어 내려와 자리를 잡으면 첫 사이클 시작
        enemy.y += info.speed * dt;
        if (enemy.y >= BOSS_ENTER_Y) startKingCycle(enemy);
      } else if (enemy.state === "warn") {
        // 예고: 멈춰서 떤다. 방향은 예고가 시작된 순간 고정
        if (enemy.stateTime >= enemy.warnTime) setEnemyState(enemy, "dash");
      } else if (enemy.state === "dash") {
        // 돌진: 고정한 방향으로 평소의 4배 속도
        const step = info.speed * CK_DASH_MULT * dt;
        enemy.x = clamp(enemy.x + enemy.dirX * step, enemy.radius, CANVAS_WIDTH - enemy.radius);
        enemy.y = clamp(enemy.y + enemy.dirY * step, enemy.radius, CANVAS_HEIGHT - enemy.radius);
        if (enemy.stateTime >= CK_DASH_TIME) {
          enemy.dashesLeft -= 1;
          if (enemy.dashesLeft > 0) {
            // 아직 돌진이 남았으면 짧게 재조준하고 또 돌진
            aimAt(enemy, player.x, player.y);
            enemy.warnTime = CK_REAIM_TIME;
            setEnemyState(enemy, "warn");
          } else {
            // 다 돌진했으면 쉰다. 화난 상태면 쉬기 시작할 때 부하를 부른다
            setEnemyState(enemy, "rest");
            if (enemy.enraged) summonChargers(enemy);
          }
        }
      } else if (enemy.state === "rest") {
        if (enemy.stateTime >= CK_REST_TIME) startKingCycle(enemy);
      }
    },

    // 맞을 때: 체력이 50% 아래로 내려가면 화난 상태 (다음 사이클부터 4연속 돌진)
    onHurt: function (enemy) {
      if (!enemy.enraged && enemy.hp < enemy.maxHp * CK_ENRAGE_RATIO) {
        enemy.enraged = true;
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.brown);
      spawnParticles(enemy.x, enemy.y, COLORS.yellow);
    },
  },

  // ---- 분열의 왕 (수학 · 등비수열): 맞을수록 작아지고 빨라지며 자식을 뿜는다 ----
  // 체력 66%, 33% 를 지날 때마다 splitterChild 3마리를 120° 간격으로 방출
  // 반지름 40 → 32 → 24, 속도는 1.3배씩 (1 → 1.3 → 1.69: 공비 1.3 인 등비수열)
  // 죽으면 splitter 2마리로 갈라진다
  splitterKing: {
    name: "분열의 왕",
    desc: "보스 · 계속 갈라짐",
    isBoss: true,
    hp: 800,
    speed: 40,
    radius: 40,
    color: "orange",
    contactDamage: 25,
    score: 1500,
    shape: "splitter",
    innerCircles: 3,
    crown: true,
    knockResist: 0,
    timeScaleMin: BOSS_TIME_SCALE_MIN,

    init: function (enemy) {
      enemy.phase = 0; // 지금까지 몇 번 방출했는지 (0, 1, 2)
    },

    update: function (enemy, dt, info) {
      moveToward(enemy, player.x, player.y, info.speed, dt);
    },

    // 맞을 때: 체력 비율이 다음 기준선 아래면 방출 (한 방에 두 기준선을 넘으면 두 번)
    onHurt: function (enemy) {
      while (enemy.phase < SK_THRESHOLDS.length && enemy.hp < enemy.maxHp * SK_THRESHOLDS[enemy.phase]) {
        // 120° (= 2π/3) 간격으로 3마리. 단계마다 시작 각도를 60° 씩 돌려서 다른 방향으로
        const start = -Math.PI / 2 + enemy.phase * (Math.PI / 3);
        // 자식을 하나씩 만드는 반복문
        for (let i = 0; i < SK_RELEASE_COUNT; i++) {
          const angle = start + (Math.PI * 2 * i) / SK_RELEASE_COUNT;
          const child = createEnemy("splitterChild",
            enemy.x + Math.cos(angle) * enemy.radius, enemy.y + Math.sin(angle) * enemy.radius, enemy.wave);
          pushEnemy(child, Math.cos(angle) * 240, Math.sin(angle) * 240); // 바깥으로 튕겨 나간다
          enemies.push(child);
        }
        enemy.phase += 1;
        enemy.radius = SK_RADII[enemy.phase];   // 몸이 작아지고
        enemy.speed *= SK_SPEED_UP;             // 1.3배 빨라진다
        spawnParticles(enemy.x, enemy.y, COLORS.orange);
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.orange);
      spawnParticles(enemy.x, enemy.y, COLORS.yellow);
      splitInto(enemy, "splitter");
    },
  },
};


// ---- 새 보스 3종 (4단계) ----
// 세 보스 모두 화면 위에서 내려와(enter) 자리를 잡은 뒤 패턴을 시작한다.
// 행동 시간은 모두 보스의 시계 localDt 로 잰다 (시간 지연을 받으면 탄막도 느려진다, 단 0.6배까지만).
Object.assign(ENEMY_TYPES, {
  // ---- 파동 군주 (물리 · 파동): x = 가운데 + A·sin(ωt) 로 오가며 3초마다 12발 원형 탄막 ----
  waveLord: {
    name: "파동 군주",
    desc: "보스 · 원형 탄막",
    isBoss: true,
    hp: 1000,
    speed: 60,
    radius: 34,
    color: "blue",
    contactDamage: 30,
    score: 2000,
    shape: "waveLord",
    crown: true,
    knockResist: 0,
    timeScaleMin: BOSS_TIME_SCALE_MIN,

    init: function (enemy) {
      enemy.state = "enter";
      enemy.waveT = 0;                       // 사인 곡선의 시간 t
      enemy.fireTimer = WL_FIRE_INTERVAL;    // 다음 원형 탄막까지
      enemy.secondRingTimer = -1;            // 두 번째 겹까지 남은 시간 (−1 = 없음)
      enemy.ringAngle = 0;                   // 이번 탄막의 시작 각도
    },

    update: function (enemy, dt, info) {
      if (enemy.state === "enter") {
        enemy.y += info.speed * dt;
        if (enemy.y >= WL_Y) { enemy.y = WL_Y; enemy.state = "wave"; enemy.centerX = CANVAS_WIDTH / 2; enemy.waveT = Math.asin(clamp((enemy.x - CANVAS_WIDTH / 2) / WL_AMPLITUDE, -1, 1)) / WL_OMEGA; }
        return;
      }
      // 사인 곡선으로 좌우 왕복 (위아래로도 살짝 출렁)
      enemy.waveT += info.localDt;
      enemy.x = CANVAS_WIDTH / 2 + WL_AMPLITUDE * Math.sin(WL_OMEGA * enemy.waveT);
      enemy.y = WL_Y + 12 * Math.sin(WL_OMEGA * 3 * enemy.waveT);
      // 원형 탄막
      enemy.fireTimer -= info.localDt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer += WL_FIRE_INTERVAL;
        enemy.ringAngle = Math.random() * (Math.PI * 2 / WL_RING_COUNT);  // 매번 조금 다른 각도에서
        fireRing(enemy, enemy.ringAngle);
        // 체력 50% 아래: 0.5초 뒤 15° 어긋난 두 번째 겹
        if (enemy.hp < enemy.maxHp * WL_ENRAGE_RATIO) enemy.secondRingTimer = WL_SECOND_RING_DELAY;
      }
      if (enemy.secondRingTimer >= 0) {
        enemy.secondRingTimer -= info.localDt;
        if (enemy.secondRingTimer < 0) fireRing(enemy, enemy.ringAngle + WL_SECOND_RING_OFFSET);
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.blue);
      spawnParticles(enemy.x, enemy.y, COLORS.yellow);
    },
  },

  // ---- 회전 포대 (물리 · 각속도): 가운데에서 4방향 총구를 각속도 ω 로 돌리며 계속 쏜다 → 나선 ----
  // 총구 각도 θ = θ₀ + ω·t. 일정한 간격으로 쏜 총알들이 저마다 다른 방향으로 곧게 날아가서 나선 팔이 된다.
  // 체력이 줄수록 ω 가 커지고, 10초마다 회전 방향이 바뀐다 (1초 전부터 총구가 깜빡이며 예고).
  turret: {
    name: "회전 포대",
    desc: "보스 · 나선 탄막",
    isBoss: true,
    hp: 1200,
    speed: 80,
    radius: 36,
    color: "slate",
    contactDamage: 30,
    score: 2500,
    shape: "turret",
    crown: true,
    knockResist: 0,
    timeScaleMin: BOSS_TIME_SCALE_MIN,

    init: function (enemy) {
      enemy.state = "enter";
      enemy.spin = 0;                        // 총구 각도 θ
      enemy.spinDir = 1;                     // 회전 방향 (1 = 시계, −1 = 반시계)
      enemy.flipTimer = TURRET_FLIP_TIME;    // 방향이 바뀌기까지
      enemy.fireTimer = TURRET_FIRE_INTERVAL;
      enemy.flipWarn = false;
    },

    update: function (enemy, dt, info) {
      if (enemy.state === "enter") {
        // 화면 가운데로 이동해서 자리 잡기
        moveToward(enemy, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, info.speed, dt);
        if (distance(enemy.x, enemy.y, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2) < 2) enemy.state = "spin";
        return;
      }
      enemy.spin += turretOmega(enemy) * enemy.spinDir * info.localDt;
      // 방향 바꾸기 (1초 전부터 예고)
      enemy.flipTimer -= info.localDt;
      enemy.flipWarn = enemy.flipTimer <= TURRET_FLIP_WARN;
      if (enemy.flipTimer <= 0) {
        enemy.spinDir = -enemy.spinDir;
        enemy.flipTimer += TURRET_FLIP_TIME;
      }
      // 4방향 총구에서 함께 쏜다
      enemy.fireTimer -= info.localDt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer += TURRET_FIRE_INTERVAL;
        for (let k = 0; k < TURRET_BARRELS; k++) {
          const a = enemy.spin + (k * Math.PI * 2) / TURRET_BARRELS;
          spawnEnemyBullet(enemy.x + Math.cos(a) * (enemy.radius + 10), enemy.y + Math.sin(a) * (enemy.radius + 10), a, { damage: TURRET_BULLET_DAMAGE });
        }
      }
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.slate);
      spawnParticles(enemy.x, enemy.y, COLORS.yellow);
    },
  },

  // ---- 블랙홀 (물리 · 중력): 끌어당기고, 사건의 지평선(50px)에 닿으면 큰 대미지 ----
  // 플레이어도, 플레이어의 총알도 블랙홀 쪽으로 휜다 (가속도 = G ÷ r², 상한 있음).
  // 평소에는 대미지가 30% 만 들어가고, 8초마다 3초 동안 약점이 드러나면 그때만 정상으로 들어간다.
  blackHole: {
    name: "블랙홀",
    desc: "보스 · 끌어당김",
    isBoss: true,
    hp: 1600,
    speed: 18,
    radius: 40,
    color: "outline",
    contactDamage: 35,
    score: 3500,
    shape: "blackHole",
    crown: true,
    knockResist: 0,
    timeScaleMin: BOSS_TIME_SCALE_MIN,

    init: function (enemy) {
      enemy.state = "enter";
      enemy.cycle = 0;                       // 약점 주기 시계 (0 ~ 8초)
    },

    update: function (enemy, dt, info) {
      if (enemy.state === "enter") {
        moveToward(enemy, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, info.speed * 4, dt);
        if (enemy.y >= 140) enemy.state = "drift";
      } else {
        moveToward(enemy, player.x, player.y, info.speed, dt);   // 아주 천천히 다가온다
      }
      enemy.cycle = (enemy.cycle + info.localDt) % BH_WEAK_PERIOD;
      // 사건의 지평선: 닿으면 큰 대미지 + 바깥으로 튕겨 낸다 (무적 중이면 튕기기만)
      const d = distance(enemy.x, enemy.y, player.x, player.y);
      if (gameState === "playing" && d < BH_HORIZON + PLAYER_RADIUS) {
        const out = d || 1;
        player.pullVx = ((player.x - enemy.x) / out) * BH_KICK;
        player.pullVy = ((player.y - enemy.y) / out) * BH_KICK;
        if (player.invincibleTimer <= 0 && !(debugMode && debugInvincible)) {
          hurtPlayer(BH_HORIZON_DAMAGE * waveDamageMult(enemy.wave));
          spawnTextPopup(player.x, player.y - PLAYER_RADIUS - 18, "사건의 지평선!", COLORS.red);
        }
      }
    },

    pullOn: function (enemy, x, y) {
      return gravityPull(enemy.x, enemy.y, x, y, BH_PULL_RANGE, BH_PULL_STRENGTH, PLAYER_ACCELERATION * BH_PULL_MAX_RATIO);
    },

    // 플레이어 총알도 휜다 (빠르기는 그대로, 방향만)
    bendBullet: function (enemy, bullet, dt) {
      const a = gravityPull(enemy.x, enemy.y, bullet.x, bullet.y, Infinity, BH_BEND_STRENGTH, BH_BEND_MAX);
      const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
      bullet.vx += a.ax * dt;
      bullet.vy += a.ay * dt;
      const now = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
      bullet.vx *= speed / now;
      bullet.vy *= speed / now;
    },

    damageTakenMult: function (enemy) {
      return blackHoleWeak(enemy) ? 1 : BH_ARMOR;
    },

    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y, COLORS.purple);
      spawnParticles(enemy.x, enemy.y, COLORS.orange);
    },
  },
});

// 파동 군주: 지금 자리에서 12발 원형 탄막 (startAngle 부터 30° 간격)
function fireRing(enemy, startAngle) {
  for (let k = 0; k < WL_RING_COUNT; k++) {
    const a = startAngle + (k * Math.PI * 2) / WL_RING_COUNT;
    spawnEnemyBullet(enemy.x + Math.cos(a) * enemy.radius, enemy.y + Math.sin(a) * enemy.radius, a, { damage: WL_BULLET_DAMAGE });
  }
}

// 회전 포대: 지금 각속도 ω = 기본 ω × (1 + 1.2 × 잃은 체력 비율)
function turretOmega(enemy) {
  const lost = 1 - Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  return TURRET_OMEGA * (1 + TURRET_OMEGA_GAIN * lost);
}

// 블랙홀: 지금 약점이 드러나 있는지 (주기 8초 중 마지막 3초)
function blackHoleWeak(enemy) {
  return enemy.cycle >= BH_WEAK_PERIOD - BH_WEAK_TIME;
}

// ---- 적 행동 도우미 함수 ----

// 각도 a 에서 b 를 뺀 차이를 −π ~ π (−180° ~ 180°) 로 맞춘다
//   예: 350° 와 10° 의 차이는 340° 가 아니라 −20°
function angleDifference(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// (cx, cy) 의 물체가 (x, y) 를 반경 range 안에서 끌어당기는 가속도 { ax, ay }
//   크기 = G ÷ r² (만유인력: 거리의 제곱에 반비례), 단 maxAccel 을 넘지 않는다
function gravityPull(cx, cy, x, y, range, G, maxAccel) {
  const dx = cx - x, dy = cy - y;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r > range || r < 1) return { ax: 0, ay: 0 };
  const a = Math.min(maxAccel, G / (r * r));
  return { ax: (dx / r) * a, ay: (dy / r) * a };
}

// (x, y) 에서 온 총알을 방패형의 방패가 막는지: 총알 방향과 방패 방향의 차이가 120° 의 절반(60°) 안이면 막는다
function shieldBlocks(enemy, x, y) {
  const hitAngle = Math.atan2(y - enemy.y, x - enemy.x);
  return Math.abs(angleDifference(hitAngle, enemy.shieldAngle)) <= SHIELD_ARC / 2;
}

// 적을 (tx, ty) 쪽으로 똑바로 움직인다. speed: 속도(px/초), dt: 흐른 시간(초)
function moveToward(enemy, tx, ty, speed, dt) {
  // 적 → 목표 방향 (가로·세로 차이)
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // 거리가 0이면 나눗셈을 할 수 없으니 건너뛴다
  if (dist > 0) {
    // 방향을 길이 1로 맞춘 뒤(정규화) 속도 × 시간만큼 이동
    enemy.x += (dx / dist) * speed * dt;
    enemy.y += (dy / dist) * speed * dt;
  }
}

// 적이 (tx, ty) 쪽을 바라보게 한다 (dirX, dirY 를 길이 1인 방향으로 맞춘다)
function aimAt(enemy, tx, ty) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 0) {
    enemy.dirX = dx / dist;
    enemy.dirY = dy / dist;
  }
}

// 적을 (vx, vy) 속도로 밀어낸다 (넉백). 종류별 knockResist 만큼만 밀린다.
// 밀리는 속도는 매 프레임 줄어들어서(감쇠) 조금 미끄러지다 멈춘다 → game.js 의 updateEnemies
function pushEnemy(enemy, vx, vy) {
  const type = enemyType(enemy);
  const resist = type.getKnockResist ? type.getKnockResist(enemy) : type.knockResist;
  enemy.knockVx = (enemy.knockVx || 0) + vx * resist;
  enemy.knockVy = (enemy.knockVy || 0) + vy * resist;
}

// 돌진 대장: 새 사이클 시작 (연속 돌진 횟수를 정하고 첫 예고)
function startKingCycle(enemy) {
  enemy.dashesLeft = enemy.enraged ? CK_DASHES_ENRAGED : CK_DASHES;
  aimAt(enemy, player.x, player.y);
  enemy.warnTime = CK_FIRST_WARN_TIME;
  setEnemyState(enemy, "warn");
}

// 돌진 대장: 양옆(바라보는 방향의 수직 양쪽)에 돌격형을 소환
function summonChargers(boss) {
  const px = -boss.dirY;  // 바라보는 방향을 90도 돌린 방향 = 옆 방향
  const py = boss.dirX;
  const gap = boss.radius + 30;
  // 왼쪽(-1), 오른쪽(+1) 에 한 마리씩
  for (const side of [-1, 1]) {
    for (let k = 0; k < CK_SUMMON_COUNT / 2; k++) {
      const x = clamp(boss.x + px * gap * side, 20, CANVAS_WIDTH - 20);
      const y = clamp(boss.y + py * gap * side, 20, CANVAS_HEIGHT - 20);
      enemies.push(createEnemy("charger", x, y, boss.wave));
    }
  }
}

// 적의 행동 상태를 바꾸고, 상태 시간을 0 부터 다시 잰다
function setEnemyState(enemy, state) {
  enemy.state = state;
  enemy.stateTime = 0;
}

// 죽은 적 자리에 childType 적 2마리를 좌우로 SPLIT_OFFSET 만큼 떨어뜨려 만든다
function splitInto(parent, childType) {
  // 왼쪽(-1), 오른쪽(+1) 에 한 마리씩 만드는 반복문
  for (const side of [-1, 1]) {
    enemies.push(createEnemy(childType, parent.x + side * SPLIT_OFFSET, parent.y, parent.wave));
  }
}


// 적 하나를 만들어 돌려주는 함수
// typeId: ENEMY_TYPES 의 이름표 (예: "basic") / waveNumber: 몇 웨이브에 태어났는지
function createEnemy(typeId, x, y, waveNumber) {
  const type = ENEMY_TYPES[typeId];
  const stats = waveScaledStats(type, waveNumber); // 웨이브에 맞게 강해진 수치
  const enemy = {
    type: typeId,             // 어떤 종류인지 (ENEMY_TYPES 에서 찾을 이름표)
    x: x,                     // 가로 위치
    y: y,                     // 세로 위치
    hp: stats.hp,             // 현재 체력 (웨이브 체력 배율 적용)
    maxHp: stats.hp,          // 최대 체력 (체력바 그릴 때 사용)
    radius: type.radius,      // 몸 반지름
    speed: stats.speed,       // 이동 속도 (웨이브 속도 배율 적용)
    contactDamage: stats.contactDamage, // 플레이어에게 닿았을 때 대미지 (웨이브 배율 적용)
    wave: waveNumber,         // 몇 웨이브에 태어난 적인지 (뿔·가시 모양을 정할 때 사용)
    hitFlash: 0,              // 맞았을 때 하얗게 번쩍이는 남은 시간 (초)
    dead: false,              // 죽었는지 표시. true 면 목록에서 지운다
  };
  // 종류별 준비 작업이 있으면 실행 (돌격형의 상태, 사인파형의 위상 등)
  if (type.init) type.init(enemy);
  return enemy;
}

// 적 객체의 종류 데이터를 찾아 주는 함수
function enemyType(enemy) {
  return ENEMY_TYPES[enemy.type];
}
