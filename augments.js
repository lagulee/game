// =============================================================
// augments.js : 증강(능력 카드) 데이터를 모아 두는 파일
// -------------------------------------------------------------
// 증강 하나 = 객체 하나. AUGMENTS 배열에 객체를 하나 추가하면
// 증강 선택 화면에 자동으로 등장한다.
//
// 증강 객체에 들어가는 항목
//   id      : 증강을 구별하는 영어 이름표 (겹치면 안 됨)
//   name    : 카드 제목
//   concept : 어떤 수학·과학 개념에서 왔는지
//   formula : 카드 가운데 크게 보여 줄 수식
//   color   : 카드 띠 색. game.js 의 COLORS 팔레트 이름 ("yellow", "red", "green", "brown", "purple", "orange")
//   order   : (생략 가능, 기본 0) modifyDamage 를 부르는 순서. 작은 수가 먼저.
//             덧셈으로 늘리는 증강은 음수, 마지막에 계산해야 하는 증강은 큰 수를 준다.
//   levels  : 레벨별 수치와 설명을 담은 배열.
//             [0] 칸 = Lv.1, [1] 칸 = Lv.2 ...
//             같은 증강을 또 고르면 다음 칸으로 레벨업한다.
//             칸 수가 곧 최대 레벨이다.
//
// ---- 효과 함수(훅) : 필요한 것만 넣으면 된다 ----
// game.js 가 정해진 순간에 "가지고 있는 증강"의 함수를 불러 준다.
// stats 에는 지금 레벨의 수치(levels 의 한 칸)가 들어온다.
// 같은 훅을 가진 증강이 여러 개면 AUGMENTS 배열 순서대로 차례로 불린다.
//
// [값을 바꾸는 훅] 받은 값을 바꿔서 return 해야 한다
//
//   modifyDamage(damage, stats, info)
//     언제: 총알이 적에게 맞는 순간, 대미지를 정할 때
//     damage 에는 이미 총알의 대미지 배율(bullet.damageScale)이 곱해져 있다
//     info.enemy  : 맞은 적
//     info.bullet : 맞힌 총알
//     info.streak : 같은 적을 연속으로 맞힌 횟수 (첫 명중 = 0)
//     예: 복리 탄환, 분산 증폭
//
//   modifyEnemySpeed(factor, stats, info)
//     언제: 매 프레임, 적 하나하나가 움직이기 직전
//     factor 는 속도 배율 (1 = 원래 속도, 0.5 = 절반 속도)
//     info.enemy         : 이 적
//     info.distance      : 이 적과 플레이어 사이 거리
//     info.playerSpeed   : 플레이어의 지금 속력 v
//     info.playerMaxSpeed: 플레이어 최고 속도
//     예: 시간 지연
//
//   modifyFireInterval(interval, stats)
//     언제: 총알을 한 발 쏜 직후, 다음 발사까지 기다릴 시간(초)을 정할 때
//     작게 return 하면 더 빨리 쏜다 (0.4 → 0.2 이면 두 배 빠르게)
//     예: 촉매
//
// [알림을 받는 훅] return 할 필요 없음. 필요하면 게임 상태를 직접 바꾼다
//
//   onFire(stats, info)
//     언제: 가장 가까운 적을 향해 총알을 한 발 쏜 바로 다음
//     info.bullet     : 방금 쏜 총알
//     info.dirX, dirY : 쏜 방향 (길이 1인 화살표)
//     info.target     : 조준한 적
//     info.player     : 플레이어 (반동으로 밀어낼 때 player.vx, vy 를 바꾼다)
//     총알을 더 쏘려면 createBullet(방향x, 방향y, { fromAugment: true }) 를 부른다.
//       fromAugment: true 인 총알은 onFire 를 다시 부르지 않는다 (무한 반복 방지)
//       damageScale: 0.6 처럼 주면 그 총알은 60% 대미지
//     예: 3방향 탄, 반동
//
//   onHit(stats, info)
//     언제: 총알이 적에게 맞아 대미지가 적용된 직후 (죽었으면 죽는 처리보다 먼저)
//     info.enemy  : 맞은 적
//     info.bullet : 맞힌 총알
//     info.damage : 이번에 준 대미지
//     info.killed : 이번 한 방으로 죽었으면 true
//     예: 넉백, 지속 대미지
//
//   onKill(stats, info)
//     언제: 총알에 맞은 적의 체력이 0 이 되어 죽는 순간 (점수를 더한 바로 다음)
//     info.enemy  : 죽은 적
//     info.x, y   : 죽은 위치
//     info.bullet : 마지막 한 방을 날린 총알 (폭발로 죽었으면 없음)
//     info.explosion : 발열 반응 폭발로 죽었으면 true
//     예: 핵분열 (죽은 자리에서 총알이 갈라져 나감), 발열 반응
//
//   onBulletUpdate(bullet, stats, dt)
//     언제: 매 프레임, 날아가는 총알 하나하나가 움직이기 직전
//     bullet.vx, vy 를 바꾸면 방향이 바뀌고, bullet.age 는 날아간 시간(초)
//     bullet.radius 는 충돌 반지름, bullet.pierce 는 더 뚫고 지나갈 수 있는 적 수
//     예: 푸리에 탄환, 중력 렌즈
//
//   onEnemyUpdate(enemy, stats, dt)
//     언제: 매 프레임, 적 하나하나가 움직인 직후
//     예: 반감기 (붕괴 중인 적의 체력을 줄인다)
//
// [준비 훅]
//
//   reset()
//     언제: 새 게임을 시작할 때 (R 키, 메뉴에서 시작)
//     증강이 혼자 세던 숫자(발사 번호, 명중 횟수 등)를 처음으로 되돌린다.
//
// [그리는 훅]
//
//   drawEffect(stats, info)
//     언제: 매 프레임, 배경을 그린 직후 (캐릭터들보다 아래에 깔린다)
//     info.x, y : 플레이어 위치 / info.playerSpeed, playerMaxSpeed
//     예: 시간 지연 범위 원
// =============================================================


// ---- 증강 조절용 상수 (숫자를 바꿔 보며 실험해 보세요!) ----

// 복리 탄환: 연속 명중 횟수 n 의 최댓값. (1.2)^10 ≈ 6.2배 까지만 커진다.
const COMPOUND_MAX_N = 10;

// 분산 증폭: 가장 약하게 맞을 때의 배율
const VARIANCE_MIN_MULT = 0.2;

// 시간 지연: 빛의 속도 역할을 하는 c = 플레이어 최고 속도 × 이 값
// 0.85 이면 최고 속도의 85%만 내도 v/c = 1 이 되어 효과가 가장 세진다.
const TIME_C_RATIO = 0.85;

// 시간 지연: 적 속도 배율의 최솟값 (적이 완전히 멈추지는 않게)
const TIME_MIN_FACTOR = 0.2;

// 등차 탄환: 발사 번호 k 가 0 부터 몇까지 올라가는지 (10 이면 0~9 를 반복)
const ARITH_CYCLE = 10;
// 등차 탄환: 레벨별 공차 d ([Lv.1, Lv.2, ...])
const ARITH_D = [2, 3, 4];

// 제곱 증폭: 레벨별 "몇 번째 명중마다" 제곱하는지
const SQUARE_EVERY = [3, 2, 2];
// 제곱 증폭: 레벨별 배율 상한 (D² ÷ 기본 대미지 = D × (D ÷ 기본 대미지) 에서 뒤쪽 배율이 이 값을 넘지 않게)
const SQUARE_MAX_MULT = [5, 5, 7];

// 3방향 탄: 레벨별 총알 수 n (360° ÷ n 간격으로 퍼진다)
const MULTI_SHOT_COUNT = [3, 5, 6];
// 3방향 탄: 레벨별 총알 하나의 대미지 배율
const MULTI_SHOT_SCALE = [0.6, 0.5, 0.5];

// 핵분열 연쇄: 레벨별 파편 개수 m (360° ÷ m 간격)
const FISSION_FRAGMENTS = [2, 3, 3];
// 핵분열 연쇄: 레벨별 에너지 = 파편 하나의 대미지가 죽은 적 최대 체력의 몇 배인지
const FISSION_ENERGY = [0.2, 0.25, 0.3];
// 핵분열 연쇄: 파편이 다시 파편을 낼 때 에너지가 줄어드는 비율 (감쇠)
const FISSION_DECAY = 0.6;
// 핵분열 연쇄: 최대 세대 수 (2 이면 "파편의 파편"까지만)
const FISSION_MAX_GENERATION = 2;
// 핵분열 연쇄: 화면에 동시에 있을 수 있는 파편 수
const FISSION_MAX_FRAGMENTS = 40;
// 핵분열 연쇄: 파편이 날아가는 시간 (초). 0.5초 × 480px/초 ≈ 240px 까지만 날아간다
const FISSION_FRAGMENT_LIFE = 0.5;

// 촉매: 레벨별 발사 간격 감소율 (0.2 = 20% 감소 → 간격 × 0.8)
const CATALYST_REDUCTION = [0.2, 0.3, 0.4];

// 넉백: 레벨별 처음 밀어내는 속도 (px/초)
const KNOCKBACK_SPEED = [240, 360, 480];
// 넉백: 밀리는 속도가 줄어드는 감쇠율 (1/초). 총 밀리는 거리 ≈ 처음 속도 ÷ 감쇠율
//   240 ÷ 6 = 40px, 360 ÷ 6 = 60px, 480 ÷ 6 = 80px
const KNOCKBACK_DECAY = 6;

// 푸리에 탄환: 레벨별 진폭 A (px). 총알이 진행 방향의 옆으로 A·sin(ωt) 만큼 흔들린다
const FOURIER_AMPLITUDE = [20, 30, 40];
// 푸리에 탄환: 각속도 ω (rad/초). 한 번 출렁이는 데 2π/ω ≈ 0.52초 (그동안 약 250px 날아간다)
const FOURIER_OMEGA = 12;
// 푸리에 탄환: 레벨별 충돌 반지름 증가 (px)
const FOURIER_RADIUS_BONUS = [3, 5, 7];
// 푸리에 탄환: 레벨별 관통 수 (1 이면 적 1마리를 뚫고 지나간다)
const FOURIER_PIERCE = [0, 0, 1];

// 중력 렌즈: 레벨별 끌어당기는 반경 R (px). 총알에서 R 안에 있는 가장 가까운 적 쪽으로 휜다
const GRAVITY_RANGE = [80, 110, 140];
// 중력 렌즈: 당기는 세기 G. 가속도 = G ÷ r² (r = 총알과 적 사이 거리)
//   r = 100px → 1000 px/초², r = 50px → 4000 px/초² (거리가 절반이면 4배)
const GRAVITY_STRENGTH = 10000000;
// 중력 렌즈: 가속도 상한 (px/초²). 아주 가까울 때 1/r² 이 끝없이 커지지 않게
const GRAVITY_MAX_ACCEL = 6000;
// 중력 렌즈: 쏜 뒤 이 시간(초)까지만 휜다 (적 둘레를 영원히 빙빙 도는 총알이 생기지 않게)
const GRAVITY_MAX_AGE = 2;

// 반감기: 레벨별 붕괴율 p (0.04 = 매초 지금 체력의 4% 를 잃는다)
const HALFLIFE_RATE = [0.04, 0.06, 0.08];
// 반감기: 한 번 맞으면 붕괴가 이어지는 시간 (초). 다시 맞으면 처음부터 다시 4초
const HALFLIFE_DURATION = 4;
// 반감기: 보스는 붕괴율이 이 배율만큼만 (0.5 = 절반)
const HALFLIFE_BOSS_MULT = 0.5;

// 발열 반응: 레벨별 폭발 반경 R (px)
const EXO_RADIUS = [60, 80, 100];
// 발열 반응: 레벨별 폭발 대미지 = 죽은 적 최대 체력의 몇 배인지 (0.15 = 15%)
const EXO_RATIO = [0.15, 0.2, 0.25];
// 발열 반응: 폭발 고리가 퍼지는 시간 (초, 그림 전용)
const EXO_FLASH_TIME = 0.3;

// 발열 반응 폭발 고리 목록 { x, y, r, born } (그림 전용)
let exoBlasts = [];

// 르샤틀리에: 레벨별 k. 대미지 배율 = 1 + k × (1 − 체력 비율)
//   체력이 가득이면 1배, 체력이 0 에 가까우면 (1 + k)배
const LECHATELIER_K = [0.5, 0.8, 1.2];

// 모든 증강을 담는 배열(목록)
const AUGMENTS = [
  {
    id: "compound",
    name: "복리 탄환",
    concept: "수학 · 지수함수",
    formula: "(1 + r)ⁿ",
    color: "yellow",
    levels: [
      // Lv.1
      {
        r: 0.15,
        desc: "같은 적을 연속으로 맞힐수록 대미지가 (1+r)ⁿ 배로 불어난다. 적이 바뀌면 n = 0. (r = 0.15, n 최대 10)",
      },
      // Lv.2
      {
        r: 0.2,
        desc: "복리 이율이 오른다! r = 0.15 → 0.2 (n 최대 10)",
      },
      // Lv.3
      {
        r: 0.25,
        desc: "이율 최고! r = 0.2 → 0.25 (10번 연속이면 1.25¹⁰ ≈ 9.3배)",
      },
    ],

    // 대미지 × (1 + r)^n
    modifyDamage: function (damage, stats, info) {
      // n = 연속 명중 횟수. 단, COMPOUND_MAX_N 을 넘지 않게 자른다
      const n = Math.min(info.streak, COMPOUND_MAX_N);
      // Math.pow(a, b) = a 의 b 제곱
      return damage * Math.pow(1 + stats.r, n);
    },
  },
  {
    id: "variance",
    name: "분산 증폭",
    concept: "통계 · 평균과 분산",
    formula: "평균 1, 분산 ↑",
    color: "red",
    levels: [
      {
        maxMult: 2.5,
        desc: "평균 대미지는 그대로 두고, 한 발마다 0.2배 ~ 2.5배 사이에서 크게 흔들린다.",
      },
      {
        maxMult: 3.0,
        desc: "더 크게 흔들린다! 최대 배율 2.5배 → 3배 (평균은 여전히 1배)",
      },
      {
        maxMult: 3.5,
        desc: "극한의 분산! 최대 배율 3배 → 3.5배 (그래도 평균은 1배)",
      },
    ],

    // 대미지 × (무작위 배율). 배율의 평균이 정확히 1 이 되도록 뽑는다.
    modifyDamage: function (damage, stats, info) {
      const low = VARIANCE_MIN_MULT; // 가장 작은 배율 (0.2)
      const high = stats.maxMult;    // 가장 큰 배율 (2.5 또는 3)

      // [아이디어] 배율을 "1보다 작은 쪽"과 "1보다 큰 쪽" 두 구간으로 나눈다.
      //   작은 쪽 구간 [0.2, 1]   에서 고르게 뽑으면 평균 = (0.2 + 1) / 2 = 0.6
      //   큰 쪽 구간   [1, high]  에서 고르게 뽑으면 평균 = (1 + high) / 2
      //   큰 쪽이 나올 확률을 p 라고 하면, 전체 평균은
      //     0.6 × (1 − p) + 큰쪽평균 × p
      //   이 값이 1 이 되도록 p 를 구하면
      //     p = (1 − 0.6) / (큰쪽평균 − 0.6)
      //   high = 2.5 → p = 0.4 / 1.15 ≈ 0.348 (약 35%)
      //   high = 3.0 → p = 0.4 / 1.4  ≈ 0.286 (약 29%)
      //   high = 3.5 → p = 0.4 / 1.65 ≈ 0.242 (약 24%)
      const lowMean = (low + 1) / 2;
      const highMean = (1 + high) / 2;
      const p = (1 - lowMean) / (highMean - lowMean);

      let mult;
      if (Math.random() < p) {
        mult = 1 + Math.random() * (high - 1);  // 큰 쪽: 1 ~ high
      } else {
        mult = low + Math.random() * (1 - low); // 작은 쪽: 0.2 ~ 1
      }
      return damage * mult;
    },
  },
  {
    id: "timeDilation",
    name: "시간 지연",
    concept: "물리 · 특수 상대성 이론",
    formula: "√(1 − (v/c)²)",
    color: "green",
    levels: [
      {
        radius: 100,
        desc: "빠르게 움직일수록 반경 100px 안의 적이 느려진다. 속도 배율 = √(1 − (v/c)²), 최소 0.2배",
      },
      {
        radius: 130,
        desc: "시간이 느려지는 범위가 넓어진다! 반경 100px → 130px",
      },
      {
        radius: 160,
        desc: "시간 지연 범위 최대! 반경 130px → 160px",
      },
    ],

    // 반경 안의 적 속도 × √(1 − (v/c)²)
    modifyEnemySpeed: function (factor, stats, info) {
      // 범위 밖의 적은 영향 없음
      if (info.distance > stats.radius) return factor;
      return factor * timeDilationFactor(info.playerSpeed, info.playerMaxSpeed);
    },


    // 플레이어 주변에 시간 지연 범위 원을 그린다.
    // 효과가 셀수록(배율이 작을수록) 원이 진해진다.
    drawEffect: function (stats, info) {
      const f = timeDilationFactor(info.playerSpeed, info.playerMaxSpeed);
      const strength = (1 - f) / (1 - TIME_MIN_FACTOR); // 0(효과 없음) ~ 1(최대)

      ctx.save();
      // 1) 안쪽을 초록색으로 옅게 칠한다
      ctx.globalAlpha = 0.08 + 0.17 * strength;
      ctx.fillStyle = COLORS.green;
      ctx.beginPath();
      ctx.arc(info.x, info.y, stats.radius, 0, Math.PI * 2);
      ctx.fill();
      // 2) 테두리는 점선으로
      ctx.globalAlpha = 0.3 + 0.5 * strength;
      ctx.setLineDash([10, 8]);           // 10px 선, 8px 빈칸 반복
      setOutline(SMALL_OUTLINE_WIDTH);
      ctx.stroke();
      ctx.restore();

      // 3) 움직이는 중이면 원 아래에 지금 배율을 숫자로 보여 준다
      if (strength > 0.01) {
        drawOutlinedText("시간 ×" + f.toFixed(2), info.x, info.y + stats.radius + 14, 16);
      }
    },
  },
  {
    id: "arithmetic",
    name: "등차 탄환",
    concept: "수학 · 등차수열",
    formula: "a + d·k",
    color: "purple",
    order: -10, // 덧셈이라 가장 먼저 (그 위에 복리·분산 같은 곱셈이 얹힌다)
    levels: [
      {
        d: ARITH_D[0],
        desc: "발사할 때마다 번호 k 가 0, 1, 2 … 9 로 올라가고, 대미지 = 기본 + d × k. 10발마다 k = 0. (d = 2)",
      },
      {
        d: ARITH_D[1],
        desc: "공차가 커진다! d = 2 → 3 (k = 9 이면 10 + 27 = 37)",
      },
      {
        d: ARITH_D[2],
        desc: "공차 최대! d = 3 → 4 (k = 9 이면 10 + 36 = 46)",
      },
    ],

    // 증강이 혼자 세는 숫자: 다음에 쏠 총알의 번호 k
    shotNumber: 0,

    reset: function () {
      this.shotNumber = 0;
    },

    // 쏠 때: 총알에 지금 번호 k 를 적어 두고, 번호를 1 올린다 (10이 되면 0으로)
    onFire: function (stats, info) {
      info.bullet.arithK = this.shotNumber;
      this.shotNumber = (this.shotNumber + 1) % ARITH_CYCLE; // % 는 나머지: 9 다음은 0
    },

    // 맞을 때: 대미지 + d × k (총알의 대미지 배율도 똑같이 곱한다)
    modifyDamage: function (damage, stats, info) {
      const k = info.bullet ? info.bullet.arithK : undefined;
      if (k === undefined) return damage; // 번호가 없는 총알(파편 등)은 그대로
      return damage + stats.d * k * info.bullet.damageScale;
    },
  },
  {
    id: "square",
    name: "제곱 증폭",
    concept: "수학 · 거듭제곱",
    formula: "D² ÷ 10",
    color: "red",
    order: 100, // 다른 대미지 증강이 모두 적용된 "마지막 대미지"를 제곱해야 하므로 맨 마지막
    levels: [
      {
        every: SQUARE_EVERY[0],
        maxMult: SQUARE_MAX_MULT[0],
        desc: "3번째 명중마다 대미지 D → D² ÷ 10 (= D × D/10, 최대 5배). D 가 10보다 작으면 오히려 줄어든다!",
      },
      {
        every: SQUARE_EVERY[1],
        maxMult: SQUARE_MAX_MULT[1],
        desc: "더 자주 제곱한다! 3번째 → 2번째 명중마다 (배율 최대 5배)",
      },
      {
        every: SQUARE_EVERY[2],
        maxMult: SQUARE_MAX_MULT[2],
        desc: "상한이 풀린다! 2번째 명중마다, 배율 최대 5배 → 7배",
      },
    ],

    // 증강이 혼자 세는 숫자: 지금까지 명중한 횟수
    hitCount: 0,

    reset: function () {
      this.hitCount = 0;
    },

    // N번째 명중마다 D → D² / 10
    modifyDamage: function (damage, stats, info) {
      this.hitCount += 1;
      if (this.hitCount % stats.every !== 0) return damage; // N의 배수 번째가 아니면 그대로

      // D²/10 = D × (D/10). 곱하는 배율 D/10 은 상한까지만
      // (거듭제곱의 성질: 1보다 큰 수는 제곱하면 커지고, 1보다 작은 수는 제곱하면 작아진다.
      //  그래서 D 가 10보다 작으면 배율 D/10 이 1보다 작아 대미지가 줄어든다)
      const mult = Math.min(damage / player.damage, stats.maxMult); // 기본 대미지(공격력 업그레이드 포함) 기준
      return damage * mult;
    },
  },
  {
    id: "multiShot",
    name: "3방향 탄",
    concept: "수학 · 각도",
    formula: "360° ÷ n",
    color: "yellow",
    levels: [
      {
        n: MULTI_SHOT_COUNT[0],
        scale: MULTI_SHOT_SCALE[0],
        desc: "한 번에 3발을 360° ÷ 3 = 120° 간격으로 쏜다. 대신 모든 총알 대미지 0.6배",
      },
      {
        n: MULTI_SHOT_COUNT[1],
        scale: MULTI_SHOT_SCALE[1],
        desc: "5발로 늘어난다! 360° ÷ 5 = 72° 간격, 대미지 0.5배",
      },
      {
        n: MULTI_SHOT_COUNT[2],
        scale: MULTI_SHOT_SCALE[2],
        desc: "6발! 360° ÷ 6 = 60° 간격 (정육각형 모양), 대미지 0.5배",
      },
    ],

    // 쏠 때: 조준한 총알을 기준으로 (360° ÷ n) 씩 돌린 방향으로 n - 1 발을 더 쏜다
    onFire: function (stats, info) {
      info.bullet.damageScale = stats.scale; // 조준한 총알도 대미지가 줄어든다
      const step = (Math.PI * 2) / stats.n;  // 360° 를 라디안으로 쓰면 2π
      // 1번째부터 n-1번째 추가 총알을 만드는 반복문
      for (let i = 1; i < stats.n; i++) {
        // 방향 (x, y) 를 각도 θ 만큼 돌리는 공식 (회전 변환)
        //   x' = x·cosθ − y·sinθ,  y' = x·sinθ + y·cosθ
        const theta = step * i;
        const dirX = info.dirX * Math.cos(theta) - info.dirY * Math.sin(theta);
        const dirY = info.dirX * Math.sin(theta) + info.dirY * Math.cos(theta);
        // fromAugment: true → 이 총알 때문에 onFire 가 다시 불리지 않는다
        const extra = createBullet(dirX, dirY, { damageScale: stats.scale, fromAugment: true });
        extra.arithK = info.bullet.arithK; // 같은 순간에 쏜 총알이니 등차 번호도 같다
      }
    },
  },
  {
    id: "fission",
    name: "핵분열 연쇄",
    concept: "물리 · 연쇄 반응",
    formula: "k > 1 → 폭주",
    color: "orange",
    levels: [
      {
        fragments: FISSION_FRAGMENTS[0],
        energy: FISSION_ENERGY[0],
        desc: "적이 죽으면 파편 2개가 터져 나간다. 파편 대미지 = 죽은 적 최대 체력의 20%. 파편이 죽인 적도 터진다 (최대 2세대)",
      },
      {
        fragments: FISSION_FRAGMENTS[1],
        energy: FISSION_ENERGY[1],
        desc: "파편이 3개로! 에너지 20% → 25% (다음 세대는 60% 로 감쇠)",
      },
      {
        fragments: FISSION_FRAGMENTS[2],
        energy: FISSION_ENERGY[2],
        desc: "에너지가 더 세진다! 파편 3개, 에너지 25% → 30%",
      },
    ],

    // =========================================================
    // 연쇄 반응의 원리
    //   파편 하나가 평균 k마리를 죽이면 연쇄가 이어진다.
    //   k < 1이면 연쇄가 사그라들고, k > 1이면 폭주한다.
    //   그래서 세대 제한과 감쇠가 필요하다.
    //   - 감쇠: 세대가 내려갈수록 에너지(대미지)가 60% 로 줄어 k 가 점점 작아진다
    //   - 세대 제한: 2세대 파편이 죽인 적은 더 이상 파편을 내지 않는다
    //   - 개수 제한: 화면의 파편이 40개를 넘지 않는다 (게임이 느려지지 않게)
    // =========================================================
    onKill: function (stats, info) {
      const killer = info.bullet;
      let energy;      // 이번에 터질 파편의 에너지
      let generation;  // 이번에 터질 파편의 세대

      if (killer && killer.isFragment) {
        // 파편이 죽인 적: 세대 제한을 넘으면 더 이상 터지지 않는다
        if (killer.generation >= FISSION_MAX_GENERATION) return;
        energy = killer.energy * FISSION_DECAY; // 에너지 감쇠
        generation = killer.generation + 1;
      } else {
        // 보통 총알이 죽인 적: 1세대 파편
        energy = stats.energy;
        generation = 1;
      }

      // 화면에 남은 파편 자리만큼만 만든다
      const alive = bullets.filter(function (b) { return b.isFragment && !b.dead; }).length;
      const count = Math.min(stats.fragments, FISSION_MAX_FRAGMENTS - alive);
      if (count <= 0) return;

      // 파편 하나의 대미지 = 죽은 적 최대 체력 × 에너지 → 총알 대미지 배율로 바꿔 둔다
      const damageScale = (info.enemy.maxHp * energy) / player.damage;
      const start = Math.random() * Math.PI * 2;       // 첫 파편 방향만 무작위
      const step = (Math.PI * 2) / stats.fragments;    // 360° ÷ m 간격
      // 파편을 하나씩 만드는 반복문
      for (let i = 0; i < count; i++) {
        const angle = start + step * i;
        const frag = createBullet(Math.cos(angle), Math.sin(angle), {
          x: info.x, y: info.y,          // 죽은 적 자리에서 출발
          damageScale: damageScale,
          fromAugment: true,             // onFire 를 다시 부르지 않는다
          generation: generation,
          color: COLORS.orange,
          life: FISSION_FRAGMENT_LIFE,
        });
        frag.isFragment = true;
        frag.energy = energy;
      }
    },
  },
  {
    id: "catalyst",
    name: "촉매",
    concept: "화학 · 반응 속도",
    formula: "간격 × 0.8",
    color: "green",
    levels: [
      {
        reduction: CATALYST_REDUCTION[0],
        desc: "촉매는 반응에 필요한 에너지 언덕을 낮춰 반응을 빠르게 한다. 발사 간격 20% 감소 (0.4초 → 0.32초)",
      },
      {
        reduction: CATALYST_REDUCTION[1],
        desc: "더 좋은 촉매! 발사 간격 30% 감소 (0.4초 → 0.28초)",
      },
      {
        reduction: CATALYST_REDUCTION[2],
        desc: "최고의 촉매! 발사 간격 40% 감소 (0.4초 → 0.24초)",
      },
    ],

    // 발사 간격 × (1 − 감소율)
    modifyFireInterval: function (interval, stats) {
      return interval * (1 - stats.reduction);
    },
  },
  {
    id: "knockback",
    name: "넉백",
    concept: "물리 · 작용 반작용",
    formula: "v₀ ÷ 감쇠율",
    color: "brown",
    levels: [
      {
        speed: KNOCKBACK_SPEED[0],
        desc: "총알이 적을 밀면, 적도 총알을 민다(작용 반작용). 맞은 적이 총알 방향으로 약 40px 밀려난다",
      },
      {
        speed: KNOCKBACK_SPEED[1],
        desc: "더 세게 민다! 처음 속도 240 → 360 (약 60px)",
      },
      {
        speed: KNOCKBACK_SPEED[2],
        desc: "가장 세게 민다! 처음 속도 360 → 480 (약 80px)",
      },
    ],

    // 맞힌 순간: 총알이 날아가던 방향으로 적을 민다
    onHit: function (stats, info) {
      const b = info.bullet;
      const len = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
      // 총알 진행 방향(길이 1) × 처음 속도
      pushEnemy(info.enemy, (b.vx / len) * stats.speed, (b.vy / len) * stats.speed);
    },
  },
  {
    id: "fourier",
    name: "푸리에 탄환",
    concept: "수학 · 삼각함수",
    formula: "A·sin(ωt)",
    color: "purple",
    levels: [
      {
        amplitude: FOURIER_AMPLITUDE[0], radiusBonus: FOURIER_RADIUS_BONUS[0], pierce: FOURIER_PIERCE[0],
        desc: "총알이 옆으로 A·sin(ωt) 만큼 물결치며 날아가 더 넓게 훑는다. 진폭 20px, 충돌 반지름 +3px",
      },
      {
        amplitude: FOURIER_AMPLITUDE[1], radiusBonus: FOURIER_RADIUS_BONUS[1], pierce: FOURIER_PIERCE[1],
        desc: "물결이 커진다! 진폭 20 → 30px, 충돌 반지름 +5px",
      },
      {
        amplitude: FOURIER_AMPLITUDE[2], radiusBonus: FOURIER_RADIUS_BONUS[2], pierce: FOURIER_PIERCE[2],
        desc: "진폭 40px, 충돌 반지름 +7px, 그리고 적 1마리를 뚫고 지나간다!",
      },
    ],

    // =========================================================
    // 물결치는 총알의 원리
    //   옆으로 벗어난 거리를 y(t) = A·sin(ωt) 로 만들고 싶다.
    //   위치를 시간으로 미분하면 속도: y'(t) = A·ω·cos(ωt)
    //   게임은 1/60초씩 끊어서 움직이므로, 미분 대신 "이번 프레임 동안 옆으로 가야 할 거리"
    //   A·sin(ωt) − A·sin(ω(t − dt)) 를 dt 로 나눈 값을 옆 속도로 쓴다 (평균 변화율).
    //   그러면 총알이 쌓아 가는 옆 거리가 정확히 A·sin(ωt) 가 된다.
    //   (앞으로 가는 속도는 그대로 두고, 옆 속도만 따로 더했다가 다음 프레임에 뺀다.
    //    그래서 중력 렌즈처럼 앞 방향을 휘게 하는 증강과 함께 써도 된다)
    // =========================================================
    onBulletUpdate: function (bullet, stats, dt) {
      // 처음 한 번: 충돌 반지름을 키우고 관통 수를 정한다
      if (!bullet.fourier) {
        bullet.fourier = { latX: 0, latY: 0 };       // 지난 프레임에 더한 옆 속도
        bullet.radius = bulletRadius(bullet) + stats.radiusBonus;
        bullet.pierce = Math.max(bullet.pierce || 0, stats.pierce);
      }
      const f = bullet.fourier;
      // 지난번에 더한 옆 속도를 빼면 "앞으로 가는" 속도만 남는다
      const fx = bullet.vx - f.latX, fy = bullet.vy - f.latY;
      const len = Math.sqrt(fx * fx + fy * fy) || 1;
      // 진행 방향을 90° 돌린 방향 = 옆 방향 (길이 1)
      const px = -fy / len, py = fx / len;
      // 옆 속도 = 이번 프레임의 옆 거리 변화 ÷ dt  (bullet.age 는 이미 이번 프레임만큼 늘어 있다)
      const t = bullet.age;
      const lateral = dt > 0
        ? stats.amplitude * (Math.sin(FOURIER_OMEGA * t) - Math.sin(FOURIER_OMEGA * (t - dt))) / dt
        : 0;
      f.latX = px * lateral;
      f.latY = py * lateral;
      bullet.vx = fx + f.latX;
      bullet.vy = fy + f.latY;
    },
  },
  {
    id: "gravityLens",
    name: "중력 렌즈",
    concept: "물리 · 만유인력",
    formula: "a = G ÷ r²",
    color: "brown",
    levels: [
      {
        range: GRAVITY_RANGE[0],
        desc: "총알이 반경 80px 안의 가장 가까운 적 쪽으로 휜다. 휘는 세기는 거리의 제곱에 반비례 (1/r²)",
      },
      {
        range: GRAVITY_RANGE[1],
        desc: "중력이 미치는 범위가 넓어진다! 반경 80px → 110px",
      },
      {
        range: GRAVITY_RANGE[2],
        desc: "블랙홀급 렌즈! 반경 110px → 140px",
      },
    ],

    // 반경 R 안의 가장 가까운 적 쪽으로 a = G ÷ r² 만큼 끌어당긴다 (빠르기는 그대로, 방향만 휜다)
    onBulletUpdate: function (bullet, stats, dt) {
      if (bullet.age > GRAVITY_MAX_AGE) return;
      // 반경 안에서 가장 가까운 적 찾기
      let target = null, best = stats.range;
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const d = Math.sqrt((enemy.x - bullet.x) ** 2 + (enemy.y - bullet.y) ** 2);
        if (d < best) { best = d; target = enemy; }
      }
      if (!target) return;
      const a = gravityAccel(best);
      const speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
      const r = best || 1;
      // 적 쪽 방향(길이 1) × 가속도 × 시간 만큼 속도를 바꾼다
      bullet.vx += ((target.x - bullet.x) / r) * a * dt;
      bullet.vy += ((target.y - bullet.y) / r) * a * dt;
      // 빠르기는 원래대로 되돌린다 (방향만 휘게)
      const now = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;
      bullet.vx *= speed / now;
      bullet.vy *= speed / now;
    },
  },
  {
    id: "halfLife",
    name: "반감기",
    concept: "물리 · 지수 붕괴",
    formula: "N = N₀(1 − p)ᵗ",
    color: "purple",
    levels: [
      {
        rate: HALFLIFE_RATE[0],
        desc: "맞은 적이 4초 동안 붕괴한다. 매초 지금 체력의 4% 를 잃는다 (다시 맞으면 4초 갱신, 보스는 절반)",
      },
      {
        rate: HALFLIFE_RATE[1],
        desc: "붕괴가 빨라진다! 매초 4% → 6%",
      },
      {
        rate: HALFLIFE_RATE[2],
        desc: "강한 방사능! 매초 6% → 8%",
      },
    ],

    // 맞은 적을 "붕괴 중"으로 만든다 (이미 붕괴 중이면 4초를 다시 채운다)
    onHit: function (stats, info) {
      if (info.killed) return;
      const enemy = info.enemy;
      enemy.decayTime = HALFLIFE_DURATION;
      enemy.decayRate = stats.rate * (enemyType(enemy).isBoss ? HALFLIFE_BOSS_MULT : 1);
    },

    // =========================================================
    // 지수 붕괴
    //   1초가 지날 때마다 체력이 (1 − p) 배가 된다: N = N₀ × (1 − p)ᵗ
    //   한 프레임(dt 초) 동안에는 (1 − p)^dt 배를 곱하면 된다.
    //   "현재 체력"에 비례해서 줄어들기 때문에 체력이 적을수록 조금씩만 줄어든다.
    //   그래서 반감기만으로는 체력이 절대 0 이 되지 않는다 (곱하기만 하므로 0 에 다가갈 뿐).
    //   마무리는 총알이 해야 한다!
    //   (참고: p = 4% 이면 체력이 절반이 되는 데 ln 2 ÷ −ln 0.96 ≈ 17초 = 반감기)
    // =========================================================
    onEnemyUpdate: function (enemy, stats, dt) {
      if (!(enemy.decayTime > 0) || enemy.dead) return;
      enemy.hp *= Math.pow(1 - enemy.decayRate, dt);
      enemy.decayTime = Math.max(0, enemy.decayTime - dt);
    },

    // 붕괴 중인 적 둘레에 보라색 점선 고리 (남은 시간이 줄수록 흐려진다)
    drawEffect: function () {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.purple;
      for (const enemy of enemies) {
        if (!(enemy.decayTime > 0)) continue;
        ctx.globalAlpha = 0.35 + 0.65 * (enemy.decayTime / HALFLIFE_DURATION);
        ctx.lineDashOffset = -enemy.decayTime * 20;     // 고리가 빙글빙글 도는 느낌
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: "exothermic",
    name: "발열 반응",
    concept: "화학 · 에너지 방출",
    formula: "열 = 최대 체력 × q",
    color: "orange",
    levels: [
      {
        radius: EXO_RADIUS[0], ratio: EXO_RATIO[0],
        desc: "적이 죽을 때 열을 내뿜는다. 반경 60px 안의 적에게 죽은 적 최대 체력의 15% 대미지 (폭발로 죽은 적은 다시 안 터짐)",
      },
      {
        radius: EXO_RADIUS[1], ratio: EXO_RATIO[1],
        desc: "더 뜨겁게! 반경 60 → 80px, 대미지 15% → 20%",
      },
      {
        radius: EXO_RADIUS[2], ratio: EXO_RATIO[2],
        desc: "폭발적인 발열! 반경 80 → 100px, 대미지 20% → 25%",
      },
    ],

    reset: function () {
      exoBlasts = [];
    },

    // 적이 죽으면 그 자리에서 열이 퍼진다
    onKill: function (stats, info) {
      // 폭발로 죽은 적은 다시 폭발하지 않는다 (연쇄 폭발이 끝없이 이어지지 않게)
      if (info.explosion) return;
      const heat = info.enemy.maxHp * stats.ratio;
      exoBlasts.push({ x: info.x, y: info.y, r: stats.radius, born: runTime });
      // 지금 살아 있는 적들을 미리 적어 둔다 (폭발 중에 새로 생긴 적, 예: 분열형 자식은 안 맞는다)
      const targets = enemies.filter(function (e) {
        return !e.dead && e !== info.enemy &&
          Math.sqrt((e.x - info.x) ** 2 + (e.y - info.y) ** 2) <= stats.radius;
      });
      for (const target of targets) {
        damageEnemy(target, heat, { explosion: true });
      }
    },

    // 폭발 고리: 반경 R 까지 퍼지면서 흐려진다
    drawEffect: function () {
      exoBlasts = exoBlasts.filter(function (b) { return runTime - b.born < EXO_FLASH_TIME; });
      ctx.save();
      for (const blast of exoBlasts) {
        const t = Math.max(0, runTime - blast.born) / EXO_FLASH_TIME;   // 0 → 1
        ctx.globalAlpha = 0.6 * (1 - t);
        ctx.fillStyle = COLORS.orange;
        ctx.beginPath();
        ctx.arc(blast.x, blast.y, blast.r * (0.4 + 0.6 * t), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: "leChatelier",
    name: "르샤틀리에",
    concept: "화학 · 평형 이동",
    formula: "1 + k(1 − 체력 비율)",
    color: "yellow",
    levels: [
      {
        k: LECHATELIER_K[0],
        desc: "평형이 깨지면 반대쪽으로 움직여 버틴다. 체력이 낮을수록 대미지 × (1 + k × 잃은 비율), k = 0.5",
      },
      {
        k: LECHATELIER_K[1],
        desc: "더 강하게 버틴다! k = 0.5 → 0.8 (체력이 거의 없으면 1.8배)",
      },
      {
        k: LECHATELIER_K[2],
        desc: "궁지에 몰린 반격! k = 0.8 → 1.2 (체력이 거의 없으면 2.2배)",
      },
    ],

    // 대미지 × (1 + k × (1 − 지금 체력 ÷ 최대 체력))
    modifyDamage: function (damage, stats) {
      const ratio = Math.max(0, Math.min(1, player.hp / player.maxHp));   // 체력 비율 (0 ~ 1)
      return damage * (1 + stats.k * (1 - ratio));
    },
  },
];


// =============================================================
// 중력 렌즈의 가속도 (만유인력: 거리의 제곱에 반비례)
//   a = G ÷ r²  → 거리가 2배 멀면 1/4, 절반이면 4배
//   단, 아주 가까우면 r² 이 0 에 가까워 a 가 끝없이 커지므로 상한에서 자른다
// =============================================================
function gravityAccel(distance) {
  const r = Math.max(1, distance);
  return Math.min(GRAVITY_MAX_ACCEL, GRAVITY_STRENGTH / (r * r));
}


// =============================================================
// 시간 지연 계산 (상대성 이론의 "로런츠 인자" 를 게임용으로 바꾼 것)
//   v : 플레이어의 지금 속력
//   c : 이 게임의 "빛의 속도" = 플레이어 최고 속도 × TIME_C_RATIO
//   배율 = √(1 − (v/c)²)
//   - 가만히 있으면 v = 0 → √1 = 1 (적 속도 그대로)
//   - 빠를수록 (v/c) 가 1 에 가까워져 → 배율이 0 에 가까워짐 (적이 느려짐)
// =============================================================
function timeDilationFactor(playerSpeed, playerMaxSpeed) {
  const c = playerMaxSpeed * TIME_C_RATIO;
  // v/c 가 1 을 넘으면 루트 안이 음수가 되므로 1 로 고정한다
  const ratio = Math.min(1, playerSpeed / c);
  const factor = Math.sqrt(1 - ratio * ratio);
  // 너무 느려지지 않게 최솟값 아래로는 내려가지 않는다
  return Math.max(TIME_MIN_FACTOR, factor);
}


// =============================================================
// 보급 카드 : 레벨이 없고, 몇 번이든 고를 수 있는 카드
// -------------------------------------------------------------
// 증강 카드가 3장보다 적을 때 남는 자리를 채우고,
// 체력이 낮으면(최대 체력의 40% 아래) 3장 중 1장은 반드시 나온다.
//   isSupply: true  → game.js 가 보급 카드로 알아본다
//   apply()         → 고른 순간 한 번 실행되는 효과
// =============================================================

// 항상성: 최대 체력의 이 비율만큼 회복 (0.4 = 40%)
const SUPPLY_HEAL_RATIO = 0.4;
// 세포 분열: 늘어나는 최대 체력과 함께 회복하는 체력
const SUPPLY_MAX_HP_UP = 20;
const SUPPLY_DIVISION_HEAL = 20;

const SUPPLIES = [
  {
    id: "homeostasis",
    isSupply: true,
    name: "항상성",
    concept: "생물 · 항상성",
    formula: "체력 +40%",
    color: "green",
    desc: "몸은 언제나 원래 상태로 돌아가려 한다(항상성). 최대 체력의 40% 를 회복한다",
    apply: function () {
      healPlayer(player.maxHp * SUPPLY_HEAL_RATIO);
    },
  },
  {
    id: "cellDivision",
    isSupply: true,
    name: "세포 분열",
    concept: "생물 · 세포 분열",
    formula: "최대 체력 +20",
    color: "purple",
    desc: "세포가 둘로 나뉘며 몸이 자란다. 최대 체력이 20 늘고, 체력도 20 회복한다",
    apply: function () {
      player.maxHp += SUPPLY_MAX_HP_UP;
      healPlayer(SUPPLY_DIVISION_HEAL);
    },
  },
];
