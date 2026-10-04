// =============================================================
// enemies.js : 적 종류를 모아 두는 파일
// -------------------------------------------------------------
// 적 한 종류 = ENEMY_TYPES 안의 객체 하나. 새 종류를 추가하면
// waves.js 에서 { type: "새이름", count: 5 } 처럼 불러 쓸 수 있다.
//
// 적 종류 객체에 들어가는 항목
//   name          : 적 이름 (나중에 도감에서 보여 줄 이름)
//   hp            : 최대 체력
//   speed         : 1웨이브 기준 이동 속도 (px/초)
//   radius        : 몸 반지름 (px). 충돌 판정과 그림 크기에 쓰인다
//   color         : 몸 색. game.js 의 COLORS 팔레트 이름
//   contactDamage : 플레이어에게 닿았을 때 깎는 체력
//
//   update(enemy, dt, info)
//     언제: 매 프레임, 적 하나하나를 움직일 때
//     info.speed : 이번 프레임에 낼 수 있는 속도
//                  (= 기본 속도 × 증강(시간 지연 등)이 정한 배율)
//     이 적이 어떻게 움직일지 정한다. (쫓아오기, 빙글빙글 돌기, 순간이동 ...)
//
//   onDeath(enemy)
//     언제: 이 적의 체력이 0 이 되어 죽는 순간
//     터지는 효과, 작은 적으로 갈라지기 같은 일을 한다.
// =============================================================


// 웨이브가 하나 올라갈 때마다 모든 적에게 더해지는 속도 (px/초)
// 기본 적: 1웨이브 60 → 2웨이브 80 → 3웨이브 100
const ENEMY_SPEED_PER_WAVE = 20;

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

    // 플레이어 쪽으로 똑바로 걸어온다
    update: function (enemy, dt, info) {
      // 적 → 플레이어 방향 (가로·세로 차이)
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 거리가 0이면 나눗셈을 할 수 없으니 건너뛴다
      if (dist > 0) {
        // 방향을 길이 1로 맞춘 뒤(정규화) 속도 × 시간만큼 이동
        enemy.x += (dx / dist) * info.speed * dt;
        enemy.y += (dy / dist) * info.speed * dt;
      }
    },

    // 죽으면 조각(파티클)이 사방으로 튀어 나간다
    onDeath: function (enemy) {
      spawnParticles(enemy.x, enemy.y);
    },
  },
};


// 적 하나를 만들어 돌려주는 함수
// typeId: ENEMY_TYPES 의 이름표 (예: "basic") / waveNumber: 몇 웨이브에 태어났는지
function createEnemy(typeId, x, y, waveNumber) {
  const type = ENEMY_TYPES[typeId];
  return {
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
}

// 적 객체의 종류 데이터를 찾아 주는 함수
function enemyType(enemy) {
  return ENEMY_TYPES[enemy.type];
}
