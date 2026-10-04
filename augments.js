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
//   color   : 카드 띠 색. game.js 의 COLORS 팔레트 이름 ("yellow", "red", "green", "brown")
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
//     info.enemy  : 맞은 적
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
//     총알을 더 쏘려면 createBullet(방향x, 방향y) 를 부르면 된다. (onFire 는 다시 안 불림)
//     예: 3방향 탄, 반동
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
