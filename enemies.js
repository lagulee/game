// =============================================================
// enemies.js : 적 종류를 모아 두는 파일
// -------------------------------------------------------------
// 적 한 종류 = ENEMY_TYPES 안의 객체 하나. 새 종류를 추가하면
// waves.js 에서 { type: "새이름", count: 5 } 처럼 불러 쓸 수 있다.
//
// 적 종류 객체에 들어가는 항목
//   name          : 적 이름 (안내 띠, 나중에 도감에서 보여 줄 이름)
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
// =============================================================


// ---- 공통 ----

// 웨이브가 하나 올라갈 때마다 모든 적에게 더해지는 속도 (px/초)
// 기본 적: 1웨이브 60 → 2웨이브 80 → 3웨이브 100
const ENEMY_SPEED_PER_WAVE = 20;

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

// ---- 분열형(splitter) 조절용 상수 ----
const SPLITTER_SPEED = 55;   // 큰 분열형의 속도
const SPLIT_OFFSET = 20;     // 분열할 때 자식이 좌우로 떨어져 나오는 거리 (px)


// 모든 적 종류를 담는 객체. "이름표: 데이터" 모양으로 적는다.
const ENEMY_TYPES = {
  // ---- 기본 적: 플레이어를 향해 똑바로 다가온다 ----
  basic: {
    name: "기본 적",
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
  const enemy = {
    type: typeId,             // 어떤 종류인지 (ENEMY_TYPES 에서 찾을 이름표)
    x: x,                     // 가로 위치
    y: y,                     // 세로 위치
    hp: type.hp,              // 현재 체력
    maxHp: type.hp,           // 최대 체력 (체력바 그릴 때 사용)
    radius: type.radius,      // 몸 반지름
    // 이동 속도: 종류별 기본 속도 + (웨이브 - 1) × 웨이브당 증가량
    speed: type.speed + (waveNumber - 1) * ENEMY_SPEED_PER_WAVE,
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
