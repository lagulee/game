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
//     info.bullet : 마지막 한 방을 날린 총알
//     예: 핵분열 (죽은 자리에서 총알이 갈라져 나감), 발열 반응
//
//   onBulletUpdate(bullet, stats, dt)
//     언제: 매 프레임, 날아가는 총알 하나하나가 움직이기 직전
//     bullet.vx, vy 를 바꾸면 방향이 바뀌고, bullet.age 는 날아간 시간(초)
//     예: 유도 탄환, 푸리에 탄환
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
const ARITH_D = [2, 3];

// 제곱 증폭: 레벨별 "몇 번째 명중마다" 제곱하는지
const SQUARE_EVERY = [3, 2];
// 제곱 증폭: 레벨별 배율 상한 (D²/10 = D × D/10 에서 D/10 이 이 값을 넘지 않게)
const SQUARE_MAX_MULT = [5, 5];

// 3방향 탄: 레벨별 총알 수 n (360° ÷ n 간격으로 퍼진다)
const MULTI_SHOT_COUNT = [3, 5];
// 3방향 탄: 레벨별 총알 하나의 대미지 배율
const MULTI_SHOT_SCALE = [0.6, 0.5];

// 핵분열 연쇄: 레벨별 파편 개수 m (360° ÷ m 간격)
const FISSION_FRAGMENTS = [2, 3];
// 핵분열 연쇄: 레벨별 에너지 = 파편 하나의 대미지가 죽은 적 최대 체력의 몇 배인지
const FISSION_ENERGY = [0.2, 0.25];
// 핵분열 연쇄: 파편이 다시 파편을 낼 때 에너지가 줄어드는 비율 (감쇠)
const FISSION_DECAY = 0.6;
// 핵분열 연쇄: 최대 세대 수 (2 이면 "파편의 파편"까지만)
const FISSION_MAX_GENERATION = 2;
// 핵분열 연쇄: 화면에 동시에 있을 수 있는 파편 수
const FISSION_MAX_FRAGMENTS = 40;
// 핵분열 연쇄: 파편이 날아가는 시간 (초). 0.5초 × 480px/초 ≈ 240px 까지만 날아간다
const FISSION_FRAGMENT_LIFE = 0.5;

// 촉매: 레벨별 발사 간격 감소율 (0.2 = 20% 감소 → 간격 × 0.8)
const CATALYST_REDUCTION = [0.2, 0.3];

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
        desc: "공차가 커진다! d = 2 → 3 (k = 9 인 총알은 10 + 27 = 37)",
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
        desc: "3번째 명중마다 대미지 D 를 D² ÷ 10 으로! (= D × D/10, 배율 최대 5배) 단, D 가 10보다 작으면 오히려 줄어든다",
      },
      {
        every: SQUARE_EVERY[1],
        maxMult: SQUARE_MAX_MULT[1],
        desc: "더 자주 제곱한다! 3번째 → 2번째 명중마다 (배율 최대 5배)",
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
      const mult = Math.min(damage / BULLET_DAMAGE, stats.maxMult);
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
        desc: "적이 죽으면 그 자리에서 파편 2개가 터져 나간다. 파편 대미지 = 죽은 적 최대 체력의 20%. 파편으로 죽인 적도 다시 터진다 (최대 2세대)",
      },
      {
        fragments: FISSION_FRAGMENTS[1],
        energy: FISSION_ENERGY[1],
        desc: "파편이 3개로! 에너지 20% → 25% (다음 세대는 60% 로 감쇠)",
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
      const damageScale = (info.enemy.maxHp * energy) / BULLET_DAMAGE;
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
    ],

    // 발사 간격 × (1 − 감소율)
    modifyFireInterval: function (interval, stats) {
      return interval * (1 - stats.reduction);
    },
  },
];


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
