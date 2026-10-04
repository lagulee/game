// =============================================================
// game.js : 게임 본체
// -------------------------------------------------------------
// (a) 플레이어 이동 : 게임 루프, 키보드 입력, 화면 밖 제한
// (b) 자동 발사와 적 : 적 생성·추적, 가장 가까운 적 조준, 총알 충돌, 적 체력
// (c) 웨이브와 체력  : 웨이브 3개, 플레이어 체력·무적 시간, 게임 오버·클리어, R 재시작
// =============================================================


// =============================================================
// 1. 조절용 상수 (숫자를 바꿔 보며 실험해 보세요!)
// =============================================================

// 캔버스(게임 화면) 크기. index.html의 width/height와 같아야 한다.
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;

// 플레이어 최고 속도 (1초에 몇 픽셀 움직이는지)
const PLAYER_SPEED = 220;

// 플레이어 몸의 반지름 (픽셀). 원으로 그린다.
const PLAYER_RADIUS = 14;

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

  // 총알을 만들어 목록에 추가한다
  bullets.push({
    x: player.x,                         // 플레이어 위치에서 출발
    y: player.y,
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
    updateShooting(dt);   // 4) 자동 발사
    updateBullets(dt);    // 5) 총알 이동과 충돌
    updatePlayerHit(dt);  // 6) 적에게 닿았는지 검사

    // 게임 오버가 아니라면 웨이브가 끝났는지 검사
    if (gameState === "playing") {
      checkWaveEnd();
    }
  } else if (gameState === "waveBreak") {
    // 쉬는 시간: 움직일 수는 있고, 남은 총알도 계속 날아간다
    updatePlayer(dt);
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
// 7. 그리기
// =============================================================

// 플레이어를 파란 원으로 그린다
function drawPlayer() {
  ctx.fillStyle = "#4fc3ff";                                 // 칠할 색: 하늘색
  ctx.beginPath();                                           // 새 도형 그리기 시작
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2); // 원 모양 (0도 ~ 360도)
  ctx.fill();                                                // 색칠하기
}

// 모든 적을 빨간 원 + 머리 위 작은 체력바로 그린다
function drawEnemies() {
  // 적 목록을 하나씩 꺼내 그리는 반복문
  for (const enemy of enemies) {
    // 맞은 직후엔 흰색, 평소엔 빨간색
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : "#ff5d6c";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, ENEMY_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 체력바: 회색 바탕 위에 남은 체력 비율만큼 초록색으로 칠한다
    const barWidth = ENEMY_RADIUS * 2;              // 바 전체 길이 = 적 지름
    const barX = enemy.x - ENEMY_RADIUS;            // 바 왼쪽 끝
    const barY = enemy.y - ENEMY_RADIUS - 8;        // 적 머리 위
    const ratio = Math.max(0, enemy.hp / enemy.maxHp); // 남은 체력 비율 (0~1)
    ctx.fillStyle = "#444";
    ctx.fillRect(barX, barY, barWidth, 4);
    ctx.fillStyle = "#6be675";
    ctx.fillRect(barX, barY, barWidth * ratio, 4);
  }
}

// 모든 총알을 노란 점으로 그린다
function drawBullets() {
  ctx.fillStyle = "#ffe066";
  // 총알 목록을 하나씩 꺼내 그리는 반복문
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 화면 전체를 그리는 함수
function draw() {
  // 지난 프레임의 그림을 모두 지운다
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawBullets();  // 총알 (가장 아래)
  drawEnemies();  // 적
  drawPlayer();   // 플레이어
  drawHud();      // 웨이브 번호, 체력바 (화면 위에 겹쳐 그림)
  drawOverlay();  // 쉬는 시간·게임 오버·클리어 안내 (가장 위)
}

// 화면 왼쪽 위에 웨이브 번호와 플레이어 체력바를 그린다
// ※ (f) 단계에서 점수, 증강 목록과 함께 더 예쁘게 다듬는다
function drawHud() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("웨이브 " + wave + " / " + WAVE_ENEMY_COUNTS.length, 16, 30);

  // 체력바: 바탕(회색) 위에 남은 체력 비율만큼 초록색
  const ratio = player.hp / PLAYER_MAX_HP;
  ctx.fillStyle = "#444";
  ctx.fillRect(16, 42, 200, 14);
  ctx.fillStyle = "#6be675";
  ctx.fillRect(16, 42, 200 * ratio, 14);
}

// 게임 상태에 따라 화면 가운데에 안내 문구를 그린다
function drawOverlay() {
  // 전투 중에는 안내 문구가 없다
  if (gameState === "playing") return;

  // 상태별로 보여 줄 큰 제목과 작은 설명
  let title = "";
  let sub = "";
  if (gameState === "waveBreak") {
    title = "웨이브 " + wave + " 클리어!";
    sub = "잠시 후 다음 웨이브가 시작됩니다";
  } else if (gameState === "gameover") {
    title = "게임 오버";
    sub = "R 키를 눌러 다시 시작";
  } else if (gameState === "clear") {
    title = "모든 웨이브 클리어!";
    sub = "R 키를 눌러 다시 시작";
  }

  // 화면 전체를 반투명 검정으로 살짝 덮는다
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 가운데 정렬로 글자를 쓴다
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "48px sans-serif";
  ctx.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.font = "20px sans-serif";
  ctx.fillText(sub, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
}


// =============================================================
// 8. 게임 루프 (게임의 심장)
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

// 1웨이브를 준비하고 게임 루프 시작!
startWave(1);
requestAnimationFrame(gameLoop);
