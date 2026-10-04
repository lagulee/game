// =============================================================
// game.js : 게임 본체
// -------------------------------------------------------------
// (a) 플레이어 이동 : 게임 루프, 키보드 입력, 화면 밖 제한
// (b) 자동 발사와 적 : 적 생성·추적, 가장 가까운 적 조준, 총알 충돌, 적 체력
// (c) 웨이브와 체력  : 웨이브 3개, 플레이어 체력·무적 시간, 게임 오버·클리어, R 재시작
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
  brown: "#C98A4B",      // 갈색 (보조: 총구, 패널)
};

// 도형 외곽선 두께 (px). 이 숫자 하나로 모든 도형의 외곽선이 바뀐다.
const OUTLINE_WIDTH = 4;

// 글자 외곽선 두께 (px). 선의 절반은 글자 안쪽에 그려지므로 도형보다 조금 두껍게.
const TEXT_OUTLINE_WIDTH = 6;

// 글꼴: Jua → 없으면 Black Han Sans → 그것도 없으면(인터넷이 안 될 때) 기본 고딕
const FONT_FAMILY = '"Jua", "Black Han Sans", sans-serif';

// 배경 모눈 한 칸의 크기 (px)
const GRID_SIZE = 40;

// 플레이어 최고 속도 (1초에 몇 픽셀 움직이는지)
const PLAYER_SPEED = 220;

// 플레이어 몸의 반지름 (픽셀). 얼굴을 그리기 위해 조금 크게 잡았다.
const PLAYER_RADIUS = 18;

// 플레이어 최대 체력
const PLAYER_MAX_HP = 100;

// 적에게 한 번 닿았을 때 잃는 체력 (100 ÷ 20 = 5번 닿으면 게임 오버)
const ENEMY_CONTACT_DAMAGE = 20;

// 맞은 뒤 잠깐 무적이 되는 시간 (초). 이 시간 동안은 또 맞지 않는다.
const PLAYER_INVINCIBLE_TIME = 1.0;

// 자동 발사 간격 (초). 0.4 이면 1초에 2.5발
const FIRE_INTERVAL = 0.4;

// 총알 속도 (px/초)
const BULLET_SPEED = 480;

// 총알 반지름 (픽셀)
const BULLET_RADIUS = 4;

// 총알 한 발의 기본 대미지
const BULLET_DAMAGE = 10;

// 적 기본 속도 (px/초). 1웨이브 속도. 플레이어(220)보다 느려야 도망칠 수 있다.
const ENEMY_BASE_SPEED = 60;

// 웨이브가 하나 올라갈 때마다 늘어나는 적 속도 (px/초)
// 1웨이브 60 → 2웨이브 80 → 3웨이브 100
const ENEMY_SPEED_PER_WAVE = 20;

// 적 반지름 (픽셀)
const ENEMY_RADIUS = 13;

// 적 최대 체력. 기본 대미지 10 × 6방 = 60
// (5~8방 사이로 잡아서, 같은 적을 여러 번 맞히는 "복리 탄환"이 의미 있게 함)
const ENEMY_MAX_HP = 60;

// 웨이브별 적 수. 배열의 칸 수 = 웨이브 수 (지금은 3웨이브)
// 칸을 하나 더 추가하면 4웨이브가 생긴다!
const WAVE_ENEMY_COUNTS = [6, 10, 15];

// 웨이브 중에 적이 하나씩 나타나는 간격 (초)
const WAVE_SPAWN_INTERVAL = 0.8;

// 웨이브와 웨이브 사이 쉬는 시간 (초)
// ※ (d) 단계에서 이 자리에 "증강 선택 화면"이 들어간다.
const WAVE_BREAK_TIME = 2.0;


// =============================================================
// 2. 캔버스 준비
// =============================================================

// HTML에서 id가 "game"인 캔버스를 찾아온다
const canvas = document.getElementById("game");

// 캔버스에 그림을 그릴 수 있게 해 주는 "붓" 객체
const ctx = canvas.getContext("2d");


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

  // 게임 오버나 클리어 화면에서 R 키를 누르면 처음부터 다시 시작
  if (event.code === "KeyR" && (gameState === "gameover" || gameState === "clear")) {
    resetGame();
  }

  // 방향키를 누를 때 웹페이지가 위아래로 스크롤되는 것을 막는다
  if (event.code.startsWith("Arrow")) {
    event.preventDefault();
  }
});

// 키에서 손을 떼는 순간 실행되는 함수를 등록한다
window.addEventListener("keyup", function (event) {
  // 뗀 키를 "안 눌림(false)"으로 기록한다
  keys[event.code] = false;
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
  invincibleTimer: 0,    // 남은 무적 시간 (초). 0보다 크면 맞지 않는다
  facing: 0,             // 바라보는 방향 (각도, 라디안). 0 = 오른쪽. 총구와 눈이 이쪽을 향한다
};

// 지금 화면에 있는 적들의 목록 (배열)
let enemies = [];

// 지금 날아가고 있는 총알들의 목록 (배열)
let bullets = [];

// 다음 적이 나타날 때까지 남은 시간 (초)
let spawnTimer = 0;

// 게임 상태: 지금 어떤 화면인지 기억하는 변수
//   "playing"   : 전투 중
//   "waveBreak" : 웨이브 사이 쉬는 시간
//   "gameover"  : 체력이 0이 되어 게임 오버
//   "clear"     : 마지막 웨이브까지 모두 통과
let gameState = "playing";

// 현재 웨이브 번호 (1부터 시작)
let wave = 1;

// 이번 웨이브에서 아직 나오지 않은(생성할) 적의 수
let enemiesToSpawn = 0;

// 웨이브 사이 쉬는 시간이 얼마나 남았는지 (초)
let waveBreakTimer = 0;


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

  // 속도 = 방향 × 최고 속도
  player.vx = dirX * PLAYER_SPEED;
  player.vy = dirY * PLAYER_SPEED;

  // 위치 = 위치 + 속도 × 시간
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // 화면 밖으로 나가지 않게 가둔다 (몸의 반지름만큼 안쪽까지만 허용)
  player.x = clamp(player.x, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
  player.y = clamp(player.y, PLAYER_RADIUS, CANVAS_HEIGHT - PLAYER_RADIUS);
}

// 화면 가장자리(위·아래·왼쪽·오른쪽 중 하나)에 적 하나를 만든다
function spawnEnemy() {
  // 0, 1, 2, 3 중 하나를 무작위로 뽑아 어느 변에서 나올지 정한다
  const side = Math.floor(Math.random() * 4);

  // 적이 나타날 위치
  let x = 0;
  let y = 0;

  // 화면 바로 바깥(반지름만큼 밖)에서 나타나게 한다
  if (side === 0) {          // 0: 위쪽 변
    x = Math.random() * CANVAS_WIDTH;
    y = -ENEMY_RADIUS;
  } else if (side === 1) {   // 1: 아래쪽 변
    x = Math.random() * CANVAS_WIDTH;
    y = CANVAS_HEIGHT + ENEMY_RADIUS;
  } else if (side === 2) {   // 2: 왼쪽 변
    x = -ENEMY_RADIUS;
    y = Math.random() * CANVAS_HEIGHT;
  } else {                   // 3: 오른쪽 변
    x = CANVAS_WIDTH + ENEMY_RADIUS;
    y = Math.random() * CANVAS_HEIGHT;
  }

  // 적 객체를 만들어 목록에 추가한다
  enemies.push({
    x: x,                     // 가로 위치
    y: y,                     // 세로 위치
    hp: ENEMY_MAX_HP,         // 현재 체력
    maxHp: ENEMY_MAX_HP,      // 최대 체력 (체력바 그릴 때 사용)
    // 이동 속도: 기본 속도 + (웨이브 - 1) × 웨이브당 증가량
    speed: ENEMY_BASE_SPEED + (wave - 1) * ENEMY_SPEED_PER_WAVE,
    wave: wave,               // 몇 웨이브에 태어난 적인지 (나중에 모양을 바꿀 때 사용)
    hitFlash: 0,              // 맞았을 때 하얗게 번쩍이는 남은 시간 (초)
    dead: false,              // 죽었는지 표시. true 면 목록에서 지운다
  });
}

// 웨이브 동안 정해진 수만큼 적을 하나씩 만드는 함수
function updateSpawning(dt) {
  // 이번 웨이브의 적을 이미 다 만들었으면 할 일이 없다
  if (enemiesToSpawn <= 0) return;

  // 남은 시간을 흐른 시간만큼 줄인다
  spawnTimer -= dt;

  // 시간이 다 됐으면 적 하나를 만들고, 남은 수를 1 줄인다
  if (spawnTimer <= 0) {
    spawnEnemy();
    enemiesToSpawn -= 1;
    spawnTimer = WAVE_SPAWN_INTERVAL; // 타이머를 다시 채운다
  }
}

// n번째 웨이브를 시작하는 함수
function startWave(n) {
  wave = n;
  // 배열은 0번 칸부터 시작하므로 n번째 웨이브의 적 수는 [n - 1] 칸에 있다
  enemiesToSpawn = WAVE_ENEMY_COUNTS[n - 1];
  spawnTimer = 0.5;       // 0.5초 뒤 첫 적 등장
  gameState = "playing";
}

// 웨이브가 끝났는지 검사하는 함수
// 끝나는 조건: 더 나올 적이 없고(0), 화면에 남은 적도 없다(0)
function checkWaveEnd() {
  if (enemiesToSpawn > 0 || enemies.length > 0) return;

  if (wave >= WAVE_ENEMY_COUNTS.length) {
    // 마지막 웨이브였으면 클리어!
    gameState = "clear";
  } else {
    // 아니면 잠깐 쉬었다가 다음 웨이브로
    gameState = "waveBreak";
    waveBreakTimer = WAVE_BREAK_TIME;
  }
}

// 적이 플레이어에게 닿았는지 검사하고, 닿았으면 체력을 깎는 함수
function updatePlayerHit(dt) {
  // 무적 시간을 줄인다
  player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);

  // 무적이면 맞지 않으니 검사할 필요가 없다
  if (player.invincibleTimer > 0) return;

  // 모든 적을 하나씩 보면서 플레이어와 겹치는지 검사하는 반복문
  for (const enemy of enemies) {
    if (circlesOverlap(player.x, player.y, PLAYER_RADIUS,
                       enemy.x, enemy.y, ENEMY_RADIUS)) {
      player.hp -= ENEMY_CONTACT_DAMAGE;              // 체력 감소
      player.invincibleTimer = PLAYER_INVINCIBLE_TIME; // 잠깐 무적

      // 체력이 0 이하면 게임 오버
      if (player.hp <= 0) {
        player.hp = 0;
        gameState = "gameover";
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
  player.hp = PLAYER_MAX_HP;
  player.fireTimer = 0;
  player.invincibleTimer = 0;
  player.facing = 0;

  // 적과 총알을 모두 지운다
  enemies = [];
  bullets = [];

  // 1웨이브부터 다시
  startWave(1);
}

// 모든 적을 플레이어 쪽으로 움직이는 함수
function updateEnemies(dt) {
  // 적 목록을 처음부터 끝까지 하나씩 꺼내서 처리하는 반복문
  for (const enemy of enemies) {
    // 적 → 플레이어 방향 (가로·세로 차이)
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 거리가 0이면 나눗셈을 할 수 없으니 건너뛴다
    if (dist > 0) {
      // 방향을 길이 1로 맞춘 뒤(정규화) 속도 × 시간만큼 이동
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
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

  // 총알이 대포 끝(총구)에서 나오도록 출발점을 몸 반지름 + 10 만큼 앞으로
  const muzzle = PLAYER_RADIUS + 10;

  // 총알을 만들어 목록에 추가한다
  bullets.push({
    x: player.x + (dx / dist) * muzzle,  // 총구 위치에서 출발
    y: player.y + (dy / dist) * muzzle,
    vx: (dx / dist) * BULLET_SPEED,      // 가로 속도
    vy: (dy / dist) * BULLET_SPEED,      // 세로 속도
    dead: false,                         // 맞았거나 화면 밖이면 true
  });

  // 다음 발사까지 기다릴 시간을 다시 채운다
  player.fireTimer = FIRE_INTERVAL;
}

// 총알 한 발이 적에게 줄 대미지를 계산하는 함수
// ※ 지금은 기본 대미지 그대로. (e) 단계에서 증강이 이 값을 바꾸게 된다.
function calcDamage(enemy) {
  return BULLET_DAMAGE;
}

// 총알을 움직이고, 적과 부딪쳤는지 검사하는 함수
function updateBullets(dt) {
  // 모든 총알을 하나씩 처리하는 반복문
  for (const bullet of bullets) {
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
                         enemy.x, enemy.y, ENEMY_RADIUS)) {
        // 대미지를 계산해서 적 체력을 깎는다
        enemy.hp -= calcDamage(enemy);
        enemy.hitFlash = 0.08;   // 잠깐 하얗게 번쩍
        bullet.dead = true;      // 총알은 맞으면 사라진다

        // 체력이 0 이하가 되면 적은 죽는다
        if (enemy.hp <= 0) {
          enemy.dead = true;
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
  if (gameState === "playing") {
    // 전투 중 (순서가 중요하다)
    updatePlayer(dt);     // 1) 플레이어 이동
    updateSpawning(dt);   // 2) 적 생성
    updateEnemies(dt);    // 3) 적 이동
    updateAim();          // 4) 가장 가까운 적 쪽으로 대포 돌리기
    updateShooting(dt);   // 5) 자동 발사
    updateBullets(dt);    // 6) 총알 이동과 충돌
    updatePlayerHit(dt);  // 7) 적에게 닿았는지 검사

    // 게임 오버가 아니라면 웨이브가 끝났는지 검사
    if (gameState === "playing") {
      checkWaveEnd();
    }
  } else if (gameState === "waveBreak") {
    // 쉬는 시간: 움직일 수는 있고, 남은 총알도 계속 날아간다
    updatePlayer(dt);
    updateAim();
    updateBullets(dt);
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);

    // 쉬는 시간이 끝나면 다음 웨이브 시작
    waveBreakTimer -= dt;
    if (waveBreakTimer <= 0) {
      startWave(wave + 1);
    }
  }
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
// fill: 안쪽 색 (팔레트 색 중 하나)
function drawOutlinedCircle(x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2); // 0도 ~ 360도 원
  ctx.fillStyle = fill;
  ctx.fill();      // 1) 면 칠하기
  setOutline();
  ctx.stroke();    // 2) 외곽선 그리기
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
function drawOutlinedRoundRect(x, y, w, h, r, fill) {
  roundRectPath(x, y, w, h, r);
  if (fill !== null) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  setOutline();
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
backgroundCanvas.width = CANVAS_WIDTH;
backgroundCanvas.height = CANVAS_HEIGHT;

// 배경 그림을 한 번 만드는 함수: 크림색 바탕 + 연한 모눈선 + 십자 표시
function buildBackground() {
  const bg = backgroundCanvas.getContext("2d"); // 보이지 않는 캔버스의 붓

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
buildBackground(); // 시작할 때 한 번 만들어 둔다

// 미리 만든 배경을 화면에 붙이는 함수
function drawBackground() {
  ctx.drawImage(backgroundCanvas, 0, 0);
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

// ---- 적 (임시 모양) ----
// ※ 다음 스타일 단계에서 화난 얼굴 + 웨이브별 뿔/가시 모양으로 바뀐다
function drawEnemies() {
  // 적 목록을 하나씩 꺼내 그리는 반복문
  for (const enemy of enemies) {
    // 맞은 직후엔 하양, 평소엔 빨강
    ctx.fillStyle = enemy.hitFlash > 0 ? COLORS.white : COLORS.red;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, ENEMY_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 체력바: 하얀 바탕 위에 남은 체력 비율만큼 초록
    const barWidth = ENEMY_RADIUS * 2;
    const barX = enemy.x - ENEMY_RADIUS;
    const barY = enemy.y - ENEMY_RADIUS - 8;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(barX, barY, barWidth, 4);
    ctx.fillStyle = COLORS.green;
    ctx.fillRect(barX, barY, barWidth * ratio, 4);
  }
}

// ---- 총알 (임시 모양) ----
// ※ 다음 스타일 단계에서 외곽선 + 꼬리가 생긴다
function drawBullets() {
  ctx.fillStyle = COLORS.yellow;
  // 총알 목록을 하나씩 꺼내 그리는 반복문
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- 체력바 (스티커 스타일) ----
// 하얀 바탕 → 남은 비율만큼 색 채우기 → 맨 위에 두꺼운 외곽선
function drawBar(x, y, w, h, ratio, fillColor) {
  ratio = clamp(ratio, 0, 1);                 // 비율은 0~1 사이로
  roundRectPath(x, y, w, h, h / 2);           // 1) 바탕
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  if (ratio > 0) {                            // 2) 채우기 (남은 만큼)
    roundRectPath(x, y, w * ratio, h, h / 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  drawOutlinedRoundRect(x, y, w, h, h / 2, null); // 3) 외곽선만 덮어 그리기
}

// ---- 화면 위 정보 (HUD) ----
// ※ (f) 단계에서 점수, 증강 목록이 추가된다
function drawHud() {
  // 갈색 둥근 패널
  drawOutlinedRoundRect(12, 12, 250, 74, 14, COLORS.brown);

  // 웨이브 번호
  drawOutlinedText("웨이브 " + wave + " / " + WAVE_ENEMY_COUNTS.length, 28, 34, 22, "left");

  // 플레이어 체력바: 체력이 30% 이하이면 빨강, 아니면 초록
  const ratio = player.hp / PLAYER_MAX_HP;
  drawBar(28, 54, 218, 18, ratio, ratio <= 0.3 ? COLORS.red : COLORS.green);
}

// ---- 상태 안내 (쉬는 시간 / 게임 오버 / 클리어) ----
function drawOverlay() {
  // 전투 중에는 안내가 없다
  if (gameState === "playing") return;

  // 상태별 큰 제목, 작은 설명, 패널 색
  let title = "";
  let sub = "";
  let panelColor = COLORS.brown;
  if (gameState === "waveBreak") {
    title = "웨이브 " + wave + " 클리어!";
    sub = "잠시 후 다음 웨이브가 시작됩니다";
    panelColor = COLORS.green;
  } else if (gameState === "gameover") {
    title = "게임 오버";
    sub = "R 키를 눌러 다시 시작";
    panelColor = COLORS.red;
  } else if (gameState === "clear") {
    title = "모든 웨이브 클리어!";
    sub = "R 키를 눌러 다시 시작";
    panelColor = COLORS.yellow;
  }

  // 화면 전체를 외곽선 색으로 반투명하게 살짝 덮는다
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = COLORS.outline;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.restore();

  // 가운데 패널 (스티커처럼 살짝 기울여 붙인다)
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.03); // 약 -2도 기울이기
  drawOutlinedRoundRect(-230, -70, 460, 140, 24, panelColor);
  drawOutlinedText(title, 0, -16, 48);
  drawOutlinedText(sub, 0, 38, 22);
  ctx.restore();
}

// ---- 화면 전체 그리기 ----
function draw() {
  drawBackground(); // 배경 (가장 아래, 지난 프레임 그림도 덮어서 지워 준다)
  drawBullets();    // 총알
  drawEnemies();    // 적
  drawPlayer();     // 플레이어
  drawHud();        // 웨이브 번호, 체력바
  drawOverlay();    // 쉬는 시간·게임 오버·클리어 안내 (가장 위)
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

// 1웨이브를 준비하고 게임 루프 시작!
startWave(1);
requestAnimationFrame(gameLoop);
