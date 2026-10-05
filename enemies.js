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
// ---- 보스 전용 항목 ----
//   isBoss       : true 면 보스. 화면 위쪽 큰 체력바, 처치 시 체력 회복
//   timeScaleMin : 시간 지연을 받아도 이 배율 아래로는 느려지지 않는다 (보스 0.6)
//   crown        : true 면 머리에 왕관을 그린다
//   warnLength   : 돌진 예고선 길이 (생략하면 CHARGER_WARN_LENGTH)
// =============================================================


// ---- 공통 ----

// ---- 웨이브 스케일링 : 웨이브가 올라갈수록 적이 얼마나 강해지는지 ----
// w = 웨이브 번호 (1부터). 배율 = 기본 배율(BASE) × (1 + 증가량(GROWTH) × (w − 1))
//   BASE   : 1웨이브부터 이미 몇 배인지 (영구 업그레이드로 따라잡아야 할 "출발선")
//   GROWTH : 한 웨이브마다 BASE 의 몇 % 씩 늘어나는지 (등차수열)
// 아래 숫자를 바꾸면 게임 전체 난이도가 바뀐다. (측정 결과와 조정 후보는
//  tools/balance-results.md 에 있다. tools/balance.js 로 다시 잴 수 있다)

// 체력: 1웨이브 2배, 한 웨이브마다 +12%  (30웨이브: 2 × (1 + 0.12 × 29) = 8.96배)
const ENEMY_HP_BASE = 2.0;
const ENEMY_HP_GROWTH = 0.12;
// 접촉 대미지: 1웨이브 1.5배, 한 웨이브마다 +5%  (30웨이브: 1.5 × 2.45 = 3.675배)
const ENEMY_DMG_BASE = 1.5;
const ENEMY_DMG_GROWTH = 0.05;
// 속도: 1웨이브 1.5배, 한 웨이브마다 +2.5%, 단 2.2배를 넘지 않는다
//   (기본 적 60 × 1.5 = 90. 플레이어 220 보다 느리지만, 무리로 둘러싸면 도망칠 길이 좁아진다)
const ENEMY_SPEED_BASE = 1.5;
const ENEMY_SPEED_STEP = 0.025;
const ENEMY_SPEED_MAX_MULT = 2.2;

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
    desc: "곡선을 그리며 흔들흔들",
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


// ---- 적 행동 도우미 함수 ----

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
