// =============================================================
// tools/entry/build-ent.js : 증강 슈팅 "엔트리 간단판" 작품(.ent) 만들기
// -------------------------------------------------------------
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js            → entry/증강슈팅_간단판.ent
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js 폴더       → 그 폴더에 temp/ 를 풀어서도 저장 (검사용)
//
// 엔트리는 JavaScript 를 실행할 수 없어서, 게임의 핵심만 엔트리 블록으로 다시 만들었다.
//   - 방향키 / WASD 로 이동, 가장 가까운 적에게 자동 발사
//   - 10웨이브 (5·10웨이브는 보스), 적 3종 (기본·돌격형·사인파형) + 보스 (12방향 탄막)
//   - 웨이브를 깨면 카드 3장 중 하나 고르기 (증강 5종 + 보급 2종, 클릭 또는 1·2·3 키)
// 엔트리 무대는 480 × 270 (가운데가 0,0 / 위쪽이 +y). 게임(960 × 540)의 절반 크기라서
// 거리·속도는 게임 값의 절반, 1초 = 60프레임 으로 바꿔 적었다.
// =============================================================

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { assemble } = require("./assemble.js");
const { svgToPng } = require("./render.js");
const { ART } = require("./art.js");

// ---- 조절용 상수 (엔트리 단위: 길이 = 엔트리 좌표, 시간 = 프레임) ----
const WAVE_COUNT = 10;            // 마지막 웨이브
const BOSS_EVERY = 5;             // 이 웨이브마다 보스
const PLAYER_SPEED = 2.2;         // 플레이어 이동 (프레임당)
const PLAYER_HP = 100;
const BULLET_SPEED = 4.5;         // 총알 속도 (프레임당)
const FIRE_FRAMES = 24;           // 기본 발사 간격 (24프레임 = 0.4초)
const INVINCIBLE_FRAMES = 60;     // 맞은 뒤 무적 (1초)
const WAVE_HEAL = 10;             // 웨이브를 깰 때마다 회복
const SIDE_BULLET_SCALE = 0.6;    // 3방향 탄의 옆 총알 대미지 배율
// 적 [모양 번호, 체력, 속도(프레임당), 크기%, 점수, 접촉 대미지]
const ENEMY = {
  basic: [1, 3, 0.8, 50, 10, 10],
  charger: [2, 4, 0.5, 50, 15, 12],
  sine: [3, 3, 0.7, 50, 15, 10],
  boss: [4, 70, 0.35, 50, 200, 20],
};
const ENEMY_HP_GROWTH = 0.2;      // 웨이브마다 적 체력 +20%
const ENEMY_SPEED_GROWTH = 0.03;  // 웨이브마다 적 속도 +3%
const CHARGER_WALK = 120;         // 돌격형: 걷는 시간 (프레임)
const CHARGER_AIM = 30;           //         멈춰서 조준 (깜빡임)
const CHARGER_DASH = 30;          //         돌진 시간
const CHARGER_DASH_SPEED = 4.5;
const SINE_FREQ = 6;              // 사인파형: 프레임마다 각도 +6° (1초에 한 번 출렁)
const SINE_AMP = 1.6;             //           옆으로 흔들리는 세기
const BOSS_VOLLEY = 180;          // 보스 탄막 간격 (3초)
const BOSS_BULLETS = 12;          // 한 번에 12발 (30° 간격)
const BOSS_BULLET_SPEED = 1.6;
const BOSS_BULLET_DAMAGE = 8;
// 증강 최대 레벨
const MAX = { 촉매: 3, 삼방향: 2, 복리: 3, 지연: 3, 넉백: 3 };
const CATALYST = [0, 0.15, 0.25, 0.33];   // 발사 간격 감소율
const SLOW_RADIUS = [0, 45, 57, 70];      // 시간 지연 반경 (게임 90/115/140 의 절반)
const KNOCKBACK = [0, 4, 8, 12];          // 넉백 거리

// ---- 카드 7장 (번호 = 카드 모양 번호) ----
const CARDS = [
  { name: "촉매", color: "green", concept: "화학 · 반응 속도", formula: "간격 × 0.85", desc: ["촉매가 반응을 빠르게!", "발사 간격 15% 감소", "(Lv2 25%, Lv3 33%)"], tag: "증강 · 최대 Lv3" },
  { name: "3방향 탄", color: "yellow", concept: "수학 · 각도", formula: "360° ÷ n", desc: ["120° 간격으로 3발", "(Lv2: 72° 간격 5발)", "옆 총알은 0.6배"], tag: "증강 · 최대 Lv2" },
  { name: "복리 탄환", color: "yellow", concept: "수학 · 지수함수", formula: "(1 + 0.2)ⁿ", desc: ["공격력이 레벨마다", "1.2배씩 불어난다", "1.2 → 1.44 → 1.73"], tag: "증강 · 최대 Lv3" },
  { name: "시간 지연", color: "green", concept: "물리 · 상대성 이론", formula: "√(1 − (v/c)²)", desc: ["가까이 온 적이", "절반 속도로 느려진다", "(범위가 점점 넓어짐)"], tag: "증강 · 최대 Lv3" },
  { name: "넉백", color: "brown", concept: "물리 · 작용 반작용", formula: "F = ma", desc: ["맞은 적이", "뒤로 밀려난다", "(Lv 마다 더 멀리)"], tag: "증강 · 최대 Lv3" },
  { name: "세포 분열", color: "purple", concept: "생물 · 세포 분열", formula: "최대 체력 +20", desc: ["세포가 늘어난다!", "최대 체력 +20", "체력도 +20"], tag: "보급 카드", supply: true },
  { name: "항상성", color: "green", concept: "생물 · 항상성", formula: "체력 +40%", desc: ["몸이 균형을 되찾는다", "최대 체력의 40%", "만큼 회복"], tag: "보급 카드", supply: true },
];
const AUG_VARS = ["촉매", "삼방향", "복리", "지연", "넉백"];   // 카드 1~5 번이 올리는 증강 변수

// ---- 변수 ----
const GLOBALS = ["배너글", "배너시간", "조준거리", "상태", "웨이브", "체력", "최대체력", "점수", "무적", "남은적", "다음종류",
  "후보거리", "후보x", "후보y", "목표x", "목표y", "목표있음", "발사타이머", "발사간격", "공격력", "쏠vx", "쏠vy",
  "이동x", "이동y", "카드1", "카드2", "카드3", "뽑기", "가능", "고른카드", "탄x", "탄y", "탄시작각", "보스체력", "보스최대", "증강글",
  ...AUG_VARS];
const LOCALS = {
  적: ["복제본", "종류", "적체력", "적최대", "속도", "타이머", "단계", "돌진x", "돌진y", "거리", "느림", "깜빡"],
  총알: ["복제본", "vx", "vy", "몇번째", "각"],
  보조총알: ["복제본", "vx", "vy", "각"],
  적탄: ["복제본", "각", "vx", "vy"],
  카드: ["복제본", "칸", "내카드"],
};

function design(png) {
  const variables = GLOBALS.map((name) => ({ name, value: 0 }));
  for (const obj in LOCALS) for (const name of LOCALS[obj]) variables.push({ name, local: obj, value: 0 });
  const messages = ["적생성", "발사", "탄막", "정리", "카드보이기", "카드선택"];

  // 무대 밖으로 나갔는지 (총알·탄 지우기)
  const outside = (B) => B.or(B.or(B.cmp(B.mathOp("abs", B.myX()), ">", 250), B.cmp(B.mathOp("abs", B.myY()), ">", 145)), B.cmp(B.v("상태"), "=", "끝"));
  const fighting = (B) => B.cmp(B.v("상태"), "=", "전투");

  const objects = [
    // ---------------- 글상자들 (맨 앞) ----------------
    // 배너: 다른 오브젝트가 "배너글"과 "배너시간"(프레임)을 정하면 그동안 보여 준다
    { name: "배너", type: "textBox", text: "", x: 0, y: 20, width: 440, height: 60, font: "bold 30px NanumSquareRound", colour: "#2B2118", visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        B.ifElse(B.cmp(B.v("배너시간"), ">", 0), [B.write(B.v("배너글")), B.show(), B.change("배너시간", -1)], [B.hide()]),
      ])]),
    ] },
    { name: "상태창", type: "textBox", text: "", x: -120, y: 122, width: 230, height: 22, font: "15px NanumSquareRound", textAlign: 0, scripts: (B) => [
      B.when.run([B.forever([
        B.write(B.join("웨이브 ", B.join(B.v("웨이브"), B.join(" / " + WAVE_COUNT + "    체력 ", B.join(B.mathOp("round", B.v("체력")),
          B.join(" / ", B.join(B.v("최대체력"), B.join("    점수 ", B.v("점수"))))))))),
        B.wait(0.1),
      ])]),
    ] },
    { name: "증강목록", type: "textBox", text: "", x: -120, y: 104, width: 230, height: 20, font: "13px NanumSquareRound", colour: "#8A63B8", textAlign: 0, scripts: (B) => [
      B.when.run([B.forever([
        // 가지고 있는 증강만 "이름 Lv" 로 이어 붙인다
        B.set("증강글", ""),
        ...AUG_VARS.map((name, i) => B.iff(B.cmp(B.v(name), ">", 0), [B.set("증강글", B.join(B.v("증강글"), B.join(CARDS[i].name + " Lv", B.join(B.v(name), "  "))))])),
        B.write(B.v("증강글")),
        B.wait(0.2),
      ])]),
    ] },
    { name: "보스체력글", type: "textBox", text: "", x: 120, y: 122, width: 220, height: 22, font: "bold 15px NanumSquareRound", colour: "#D9482B", textAlign: 2, scripts: (B) => [
      B.when.run([B.forever([
        B.ifElse(B.cmp(B.v("보스체력"), ">", 0),
          [B.write(B.join("보스 체력 ", B.join(B.mathOp("ceil", B.v("보스체력")), B.join(" / ", B.v("보스최대")))))],
          [B.write("")]),
        B.wait(0.1),
      ])]),
    ] },
    { name: "안내", type: "textBox", text: "", x: 0, y: -118, width: 440, height: 22, font: "15px NanumSquareRound", scripts: (B) => [
      B.when.run([B.forever([
        B.ifElse(B.cmp(B.v("상태"), "=", "고르기"), [B.write("카드를 눌러 고르세요 (1 · 2 · 3 키)")], [B.write("")]),
        B.wait(0.1),
      ])]),
    ] },

    // ---------------- 카드 (원본은 숨기고, 복제본 3장을 보여 준다) ----------------
    { name: "카드", pictures: CARDS.map((c, i) => ({ name: c.name, png: png["card" + i], width: 240, height: 320 })), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      // 카드 3장 고르기: 이미 뽑은 카드, 최대 레벨 증강은 다시 뽑는다 (보급 2장은 늘 가능하니 끝난다)
      B.when.msg("카드보이기", [B.iff(B.cmp(B.v("복제본"), "=", 0), [
        B.set("카드1", 0), B.set("카드2", 0), B.set("카드3", 0),
        ...[1, 2, 3].flatMap((k) => [
          B.set("가능", 0),
          B.repeatUntil(B.cmp(B.v("가능"), "=", 1), [
            B.set("뽑기", B.rand(1, 7)), B.set("가능", 1),
            B.iff(B.or(B.cmp(B.v("뽑기"), "=", B.v("카드1")), B.cmp(B.v("뽑기"), "=", B.v("카드2"))), [B.set("가능", 0)]),
            ...AUG_VARS.map((name, i) => B.iff(B.and(B.cmp(B.v("뽑기"), "=", i + 1), B.cmp(B.v(name), ">=", MAX[name])), [B.set("가능", 0)])),
          ]),
          B.set("카드" + k, B.v("뽑기")),
          // 원본의 지역 변수를 정해 두고 복제하면, 복제본이 그 값을 그대로 가져간다
          B.set("칸", k), B.set("내카드", B.v("뽑기")), B.clone("self"),
        ]),
      ])]),
      B.when.clone([
        B.set("복제본", 1),
        B.goXY(B.add(-150, B.mul(B.sub(B.v("칸"), 1), 150)), 0),
        { type: "change_to_some_shape", params: [B.v("내카드"), null] },
        B.show(), B.front(),
      ]),
      B.when.click([B.iff(B.and(B.cmp(B.v("복제본"), "=", 1), B.cmp(B.v("상태"), "=", "고르기")), [B.set("고른카드", B.v("내카드")), B.send("카드선택")])]),
      ...[1, 2, 3].map((k) => B.when.key(48 + k, [B.iff(B.and(B.cmp(B.v("복제본"), "=", 0), B.cmp(B.v("상태"), "=", "고르기")), [B.set("고른카드", B.v("카드" + k)), B.send("카드선택")])])),
      B.when.msg("카드선택", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ---------------- 보스 탄 ----------------
    { name: "적탄", pictures: [{ name: "적탄", png: png.enemyBullet, width: 20, height: 20 }], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      B.when.msg("탄막", [B.iff(B.cmp(B.v("복제본"), "=", 0), [
        B.set("각", B.v("탄시작각")),
        B.repeat(BOSS_BULLETS, [B.clone("self"), B.change("각", 360 / BOSS_BULLETS)]),
      ])]),
      B.when.clone([
        B.set("복제본", 1), B.goXY(B.v("탄x"), B.v("탄y")),
        B.set("vx", B.mul(B.mathOp("cos", B.v("각")), BOSS_BULLET_SPEED)), B.set("vy", B.mul(B.mathOp("sin", B.v("각")), BOSS_BULLET_SPEED)),
        B.show(),
        B.forever([
          B.iff(fighting(B), [
            B.moveX(B.v("vx")), B.moveY(B.v("vy")),
            B.iff(B.and(B.touching("플레이어"), B.cmp(B.v("무적"), "<=", 0)), [
              B.change("체력", -BOSS_BULLET_DAMAGE), B.set("무적", INVINCIBLE_FRAMES), B.deleteClone()]),
          ]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ---------------- 적 (원본은 숨기고, "적생성" 신호마다 복제본 하나) ----------------
    // 총알·플레이어보다 목록 위에 있어야 한다: 엔트리는 목록 위 오브젝트의 코드부터 실행한다
    //   → 적이 먼저 "총알에 닿았는가"를 보고 나서, 총알이 자기를 지운다
    //   → 적이 "가장 가까운 적" 후보를 다 적은 뒤에 플레이어가 조준한다
    { name: "적", pictures: [
      { name: "기본", png: png.basic, width: 48, height: 48 }, { name: "돌격형", png: png.charger, width: 52, height: 48 },
      { name: "사인파형", png: png.sine, width: 50, height: 50 }, { name: "보스", png: png.boss, width: 124, height: 124 },
    ], scale: 0.5, visible: false, scripts: (B) => {
      const dx = () => B.sub(B.coord("플레이어", "x"), B.myX());
      const dy = () => B.sub(B.coord("플레이어", "y"), B.myY());
      // (dx, dy) 를 거리로 나누면 플레이어 쪽 길이 1 화살표
      const toward = (axis, scale) => B.mul(B.div(axis === "x" ? dx() : dy(), B.v("거리")), scale);
      const typeIs = (n) => B.cmp(B.v("종류"), "=", n);
      return [
        B.when.run([B.hide(), B.set("복제본", 0)]),
        B.when.msg("적생성", [B.iff(B.cmp(B.v("복제본"), "=", 0), [
          B.set("종류", B.v("다음종류")),
          // 체력 = 기본 체력 × (1 + 0.2 × (웨이브 − 1)). 보스는 70 × (웨이브 ÷ 5)
          ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.set("적최대", e[1]), B.set("속도", e[2])])),
          B.set("적최대", B.mul(B.v("적최대"), B.add(1, B.mul(ENEMY_HP_GROWTH, B.sub(B.v("웨이브"), 1))))),
          B.iff(typeIs(ENEMY.boss[0]), [B.set("적최대", B.mul(ENEMY.boss[1], B.div(B.v("웨이브"), BOSS_EVERY))), B.set("보스최대", B.v("적최대")), B.set("보스체력", B.v("적최대"))]),
          B.set("속도", B.mul(B.v("속도"), B.add(1, B.mul(ENEMY_SPEED_GROWTH, B.sub(B.v("웨이브"), 1))))),
          B.change("남은적", 1),
          B.clone("self"),
        ])]),
        B.when.clone([
          B.set("복제본", 1), B.set("적체력", B.v("적최대")), B.set("타이머", 0), B.set("단계", 0), B.set("깜빡", 0),
          { type: "change_to_some_shape", params: [B.v("종류"), null] },
          // 네 변 중 한 곳의 바깥에서 나온다 (보스는 위에서)
          B.set("뽑기", B.rand(1, 4)),
          B.iff(typeIs(4), [B.set("뽑기", 1)]),
          B.iff(B.cmp(B.v("뽑기"), "=", 1), [B.goXY(B.rand(-200, 200), 150)]),
          B.iff(B.cmp(B.v("뽑기"), "=", 2), [B.goXY(B.rand(-200, 200), -150)]),
          B.iff(B.cmp(B.v("뽑기"), "=", 3), [B.goXY(-255, B.rand(-110, 110))]),
          B.iff(B.cmp(B.v("뽑기"), "=", 4), [B.goXY(255, B.rand(-110, 110))]),
          B.show(),
          B.forever([B.iff(fighting(B), [
            // 1) 총알에 맞았는지 (옆 총알은 0.6배)
            B.iff(B.touching("총알"), [B.change("적체력", B.mul(B.v("공격력"), -1)), B.set("깜빡", 6)]),
            B.iff(B.touching("보조총알"), [B.change("적체력", B.mul(B.v("공격력"), -SIDE_BULLET_SCALE)), B.set("깜빡", 6)]),
            B.iff(B.cmp(B.v("적체력"), "<=", 0), [
              ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.change("점수", e[4])])),
              B.iff(typeIs(4), [B.set("보스체력", 0)]),
              B.change("남은적", -1), B.deleteClone()]),
            B.iff(typeIs(4), [B.set("보스체력", B.v("적체력"))]),
            // 2) 움직이기: 플레이어 쪽 화살표 × 속도 × 느림(시간 지연)
            B.set("거리", B.add(B.dist("플레이어"), 0.01)),
            B.set("느림", 1),
            B.iff(B.and(B.cmp(B.v("지연"), ">", 0), B.cmp(B.v("거리"), "<", B.add(B.mul(B.v("지연"), 12.5), 32.5))), [B.set("느림", 0.5)]),
            B.iff(B.cmp(B.v("깜빡"), ">", 0), [
              B.change("깜빡", -1), B.effect("brightness", 60),
              // 넉백: 맞은 순간(깜빡 = 5) 플레이어 반대쪽으로 밀려난다
              B.iff(B.and(B.cmp(B.v("깜빡"), "=", 5), B.cmp(B.v("넉백"), ">", 0)), [
                B.moveX(toward("x", B.mul(B.v("넉백"), -4))), B.moveY(toward("y", B.mul(B.v("넉백"), -4)))]),
              B.iff(B.cmp(B.v("깜빡"), "=", 0), [B.clearEffects()]),
            ]),
            B.change("타이머", 1),
            // 기본·보스: 곧장 다가온다
            B.iff(B.or(typeIs(1), typeIs(4)), [B.moveX(toward("x", B.mul(B.v("속도"), B.v("느림")))), B.moveY(toward("y", B.mul(B.v("속도"), B.v("느림"))))]),
            // 사인파형: 다가오면서 옆으로 cos(각) 만큼 출렁인다 (옆 방향 = 플레이어 쪽 화살표를 90° 돌린 것)
            B.iff(typeIs(3), [
              B.moveX(B.add(toward("x", B.mul(B.v("속도"), B.v("느림"))), B.mul(toward("y", -SINE_AMP), B.mathOp("cos", B.mul(B.v("타이머"), SINE_FREQ))))),
              B.moveY(B.add(toward("y", B.mul(B.v("속도"), B.v("느림"))), B.mul(toward("x", SINE_AMP), B.mathOp("cos", B.mul(B.v("타이머"), SINE_FREQ))))),
            ]),
            // 돌격형: 걷기 → 멈춰서 깜빡이며 조준 → 그 방향으로 돌진
            B.iff(typeIs(2), [
              B.iff(B.cmp(B.v("단계"), "=", 0), [
                B.moveX(toward("x", B.mul(B.v("속도"), B.v("느림")))), B.moveY(toward("y", B.mul(B.v("속도"), B.v("느림")))),
                B.iff(B.cmp(B.v("타이머"), ">", CHARGER_WALK), [B.set("단계", 1), B.set("타이머", 0)])]),
              B.iff(B.cmp(B.v("단계"), "=", 1), [
                B.ifElse(B.cmp(B.mod(B.v("타이머"), 10), "<", 5), [B.effect("brightness", 50)], [B.clearEffects()]),
                B.iff(B.cmp(B.v("타이머"), ">", CHARGER_AIM), [B.set("단계", 2), B.set("타이머", 0), B.clearEffects(),
                  B.set("돌진x", toward("x", CHARGER_DASH_SPEED)), B.set("돌진y", toward("y", CHARGER_DASH_SPEED))])]),
              B.iff(B.cmp(B.v("단계"), "=", 2), [
                B.moveX(B.mul(B.v("돌진x"), B.v("느림"))), B.moveY(B.mul(B.v("돌진y"), B.v("느림"))),
                B.iff(B.cmp(B.v("타이머"), ">", CHARGER_DASH), [B.set("단계", 0), B.set("타이머", 0)])]),
            ]),
            // 보스: 3초마다 12방향 탄막 (한 번씩 15° 어긋나게)
            B.iff(B.and(typeIs(4), B.cmp(B.mod(B.v("타이머"), BOSS_VOLLEY), "=", 0)), [
              B.set("탄x", B.myX()), B.set("탄y", B.myY()), B.set("탄시작각", B.sub(15, B.v("탄시작각"))), B.send("탄막")]),
            // 3) 가장 가까운 적 후보 (플레이어가 다음에 조준한다)
            B.iff(B.cmp(B.v("거리"), "<", B.v("후보거리")), [B.set("후보거리", B.v("거리")), B.set("후보x", B.myX()), B.set("후보y", B.myY())]),
            // 4) 플레이어와 부딪히면 대미지
            B.iff(B.and(B.touching("플레이어"), B.cmp(B.v("무적"), "<=", 0)), [
              ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.change("체력", -(e[5]))])),
              B.change("체력", B.mul(B.v("웨이브"), -0.5)),
              B.set("무적", INVINCIBLE_FRAMES)]),
          ])]),
        ]),
      ];
    } },

    // ---------------- 총알 (조준한 총알) ----------------
    // 플레이어가 "발사" 신호를 보내면 원본이 방향을 정해 복제본을 만든다
    // 3방향 탄이 있으면 옆 총알은 "보조총알" 오브젝트가 만든다 (대미지가 달라서 따로)
    { name: "총알", pictures: [{ name: "총알", png: png.bullet, width: 18, height: 18 }], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      B.when.msg("발사", [B.iff(B.cmp(B.v("복제본"), "=", 0), [B.set("vx", B.v("쏠vx")), B.set("vy", B.v("쏠vy")), B.clone("self")])]),
      B.when.clone([
        B.set("복제본", 1), B.goTo("플레이어"), B.show(),
        B.forever([
          // 움직이기 "전에" 닿았는지 본다 → 같은 프레임에 적도 이 총알을 볼 수 있다
          B.iff(B.touching("적"), [B.deleteClone()]),
          B.iff(fighting(B), [B.moveX(B.v("vx")), B.moveY(B.v("vy"))]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },
    { name: "보조총알", pictures: [{ name: "옆 총알", png: png.sideBullet, width: 16, height: 16 }], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      // 옆 총알 n − 1 발: 조준 방향을 (360° ÷ n) 씩 돌린다
      //   x' = x·cosθ − y·sinθ,  y' = x·sinθ + y·cosθ  (회전 변환)
      B.when.msg("발사", [B.iff(B.and(B.cmp(B.v("복제본"), "=", 0), B.cmp(B.v("삼방향"), ">", 0)), [
        B.set("각", 0),
        B.repeat(B.mul(B.v("삼방향"), 2), [
          B.change("각", B.div(360, B.add(1, B.mul(B.v("삼방향"), 2)))),
          B.set("vx", B.sub(B.mul(B.v("쏠vx"), B.mathOp("cos", B.v("각"))), B.mul(B.v("쏠vy"), B.mathOp("sin", B.v("각"))))),
          B.set("vy", B.add(B.mul(B.v("쏠vx"), B.mathOp("sin", B.v("각"))), B.mul(B.v("쏠vy"), B.mathOp("cos", B.v("각"))))),
          B.clone("self"),
        ]),
      ])]),
      B.when.clone([
        B.set("복제본", 1), B.goTo("플레이어"), B.show(),
        B.forever([
          B.iff(B.touching("적"), [B.deleteClone()]),
          B.iff(fighting(B), [B.moveX(B.v("vx")), B.moveY(B.v("vy"))]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ---------------- 플레이어 ----------------
    { name: "플레이어", pictures: [{ name: "플레이어", png: png.player, width: 52, height: 52 }], scale: 0.5, x: 0, y: -40, scripts: (B) => {
      const keyPair = (a, b) => B.or(B.key(a), B.key(b));
      return [
        B.when.run([B.goXY(0, -40), B.clearEffects(), B.forever([B.iff(fighting(B), [
          // 1) 이동: 방향키 또는 WASD. 대각선은 0.707 배 (빠르기가 같게)
          B.set("이동x", 0), B.set("이동y", 0),
          B.iff(keyPair(39, 68), [B.change("이동x", 1)]), B.iff(keyPair(37, 65), [B.change("이동x", -1)]),
          B.iff(keyPair(38, 87), [B.change("이동y", 1)]), B.iff(keyPair(40, 83), [B.change("이동y", -1)]),
          B.iff(B.and(B.cmp(B.v("이동x"), "!=", 0), B.cmp(B.v("이동y"), "!=", 0)), [B.set("이동x", B.mul(B.v("이동x"), 0.707)), B.set("이동y", B.mul(B.v("이동y"), 0.707))]),
          B.moveX(B.mul(B.v("이동x"), PLAYER_SPEED)), B.moveY(B.mul(B.v("이동y"), PLAYER_SPEED)),
          // 무대 밖으로 못 나가게
          B.iff(B.cmp(B.myX(), ">", 228), [B.setX(228)]), B.iff(B.cmp(B.myX(), "<", -228), [B.setX(-228)]),
          B.iff(B.cmp(B.myY(), ">", 123), [B.setY(123)]), B.iff(B.cmp(B.myY(), "<", -123), [B.setY(-123)]),
          // 2) 조준: 적들이 이번 프레임에 적어 둔 "가장 가까운 적"
          B.set("목표있음", 0),
          B.iff(B.cmp(B.v("후보거리"), "<", 99999), [B.set("목표있음", 1), B.set("목표x", B.v("후보x")), B.set("목표y", B.v("후보y"))]),
          B.set("후보거리", 99999),
          // 3) 자동 발사: 목표 쪽 길이 1 화살표 × 총알 속도
          B.change("발사타이머", -1),
          B.iff(B.and(B.cmp(B.v("발사타이머"), "<=", 0), B.cmp(B.v("목표있음"), "=", 1)), [
            // 거리 = √((목표x − x)² + (목표y − y)²)
            B.set("조준거리", B.add(B.mathOp("root", B.add(B.mathOp("square", B.sub(B.v("목표x"), B.myX())), B.mathOp("square", B.sub(B.v("목표y"), B.myY())))), 0.01)),
            B.set("쏠vx", B.mul(B.div(B.sub(B.v("목표x"), B.myX()), B.v("조준거리")), BULLET_SPEED)),
            B.set("쏠vy", B.mul(B.div(B.sub(B.v("목표y"), B.myY()), B.v("조준거리")), BULLET_SPEED)),
            B.send("발사"), B.set("발사타이머", B.v("발사간격")),
          ]),
          // 4) 무적이면 깜빡깜빡
          B.ifElse(B.cmp(B.v("무적"), ">", 0), [
            B.change("무적", -1),
            B.ifElse(B.cmp(B.mod(B.v("무적"), 10), "<", 5), [B.effect("transparency", 60)], [B.effect("transparency", 0)]),
          ], [B.effect("transparency", 0)]),
        ])])]),
      ];
    } },
    // 시간 지연 범위 원 (플레이어를 따라다닌다)
    { name: "지연원", pictures: [{ name: "범위", png: png.slowRing, width: 288, height: 288 }], scale: 0.3, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        B.ifElse(B.cmp(B.v("지연"), ">", 0), [
          B.goTo("플레이어"),
          // 반지름 = 지연 × 12.5 + 32.5 (45, 57.5, 70). 그림 반지름 140 → 크기 % = 반지름 ÷ 140 × 100
          B.size(B.mul(B.div(B.add(B.mul(B.v("지연"), 12.5), 32.5), 140), 100)),
          B.show()], [B.hide()]),
      ])]),
    ] },

    // ---------------- 배경 + 게임 진행 (맨 뒤) ----------------
    { name: "배경", pictures: [{ name: "배경", png: png.background, width: 960, height: 540 }], scale: 0.5, scripts: (B) => {
      const banner = (text, sec) => [B.write(text), B.show(), B.wait(sec), B.hide()];
      return [
        B.when.run([
          // 처음 값
          B.set("상태", "준비"), B.set("배너시간", 0), B.set("웨이브", 1), B.set("체력", PLAYER_HP), B.set("최대체력", PLAYER_HP), B.set("점수", 0),
          B.set("무적", 0), B.set("남은적", 0), B.set("후보거리", 99999), B.set("목표있음", 0), B.set("발사타이머", 0),
          B.set("보스체력", 0), B.set("탄시작각", 0), B.set("고른카드", 0),
          ...AUG_VARS.map((n) => B.set(n, 0)),
          B.set("공격력", 1), B.set("발사간격", FIRE_FRAMES),
          B.sendWait("정리"),
          // 웨이브 반복
          B.repeatUntil(B.cmp(B.v("웨이브"), ">", WAVE_COUNT), [
            B.ifElse(B.cmp(B.mod(B.v("웨이브"), BOSS_EVERY), "=", 0),
              [B.set("배너글", B.join("웨이브 ", B.join(B.v("웨이브"), " — 보스!")))],
              [B.set("배너글", B.join("웨이브 ", B.v("웨이브")))]),
            B.set("상태", "준비"), B.set("배너시간", 90), B.wait(1.5),
            B.set("상태", "전투"),
            // 보스 웨이브: 보스부터
            B.iff(B.cmp(B.mod(B.v("웨이브"), BOSS_EVERY), "=", 0), [B.set("다음종류", ENEMY.boss[0]), B.send("적생성"), B.wait(1)]),
            // 졸개 3 + 2 × 웨이브 마리. 3웨이브부터 돌격형, 6웨이브부터 사인파형이 섞인다
            B.repeat(B.add(3, B.mul(B.v("웨이브"), 2)), [
              B.set("뽑기", B.rand(1, 10)), B.set("다음종류", ENEMY.basic[0]),
              B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 3), B.cmp(B.v("뽑기"), "<=", 3)), [B.set("다음종류", ENEMY.charger[0])]),
              B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 6), B.cmp(B.v("뽑기"), ">=", 8)), [B.set("다음종류", ENEMY.sine[0])]),
              B.send("적생성"),
              B.wait(B.sub(0.8, B.mul(B.v("웨이브"), 0.04))),
            ]),
            B.waitUntil(B.cmp(B.v("남은적"), "<=", 0)),
            B.send("정리"),
            B.iff(B.cmp(B.v("웨이브"), "<", WAVE_COUNT), [
              // 웨이브 클리어: 회복하고 카드 고르기
              B.set("체력", B.add(B.v("체력"), WAVE_HEAL)),
              B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
              B.set("상태", "고르기"), B.send("카드보이기"),
              B.waitUntil(B.cmp(B.v("상태"), "=", "전투")),
            ]),
            B.change("웨이브", 1),
          ]),
          B.set("상태", "끝"),
          B.set("배너글", B.join("클리어! 점수 ", B.v("점수"))), B.set("배너시간", 99999999), B.wait(0.2), B.stop("all"),
        ]),
        // 체력이 0 이 되면 게임 오버
        B.when.run([
          B.waitUntil(B.cmp(B.v("체력"), "<=", 0)),
          B.set("체력", 0), B.set("상태", "끝"),
          B.set("배너글", B.join("게임 오버! 웨이브 ", B.join(B.v("웨이브"), B.join("  점수 ", B.v("점수"))))), B.set("배너시간", 99999999),
          B.wait(0.2), B.stop("all"),
        ]),
        // 카드를 골랐을 때: 효과 적용
        B.when.msg("카드선택", [
          ...AUG_VARS.map((name, i) => B.iff(B.cmp(B.v("고른카드"), "=", i + 1), [B.change(name, 1)])),
          B.iff(B.cmp(B.v("고른카드"), "=", 6), [B.change("최대체력", 20), B.change("체력", 20)]),
          B.iff(B.cmp(B.v("고른카드"), "=", 7), [B.change("체력", B.mul(B.v("최대체력"), 0.4))]),
          B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
          // 공격력 = 1.2 ^ 복리 레벨, 발사 간격 = 24 × (1 − 촉매 감소율)
          B.set("공격력", 1), B.repeat(B.v("복리"), [B.set("공격력", B.mul(B.v("공격력"), 1.2))]),
          B.set("발사간격", FIRE_FRAMES),
          ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("촉매"), "=", lv), [B.set("발사간격", B.mul(FIRE_FRAMES, 1 - CATALYST[lv]))])),
          B.set("상태", "전투"),
        ]),
      ];
    } },
  ];
  return { scene: "증강 슈팅", variables, messages, objects };
}

// ---- 만들기: 그림 → PNG, 설계 → project.json, 묶어서 .ent ----
async function build(outFile, extractDir) {
  const keys = ["player", "basic", "charger", "sine", "boss", "bullet", "sideBullet", "enemyBullet", "slowRing", "background"];
  const items = keys.map((k) => { const s = ART[k](); const m = s.match(/width="(\d+)" height="(\d+)"/); return { svg: s, width: +m[1], height: +m[2] }; });
  CARDS.forEach((c) => items.push({ svg: ART.card(c), width: 240, height: 320 }));
  const pngs = await svgToPng(items);
  const png = {};
  keys.forEach((k, i) => { png[k] = pngs[i]; });
  CARDS.forEach((c, i) => { png["card" + i] = pngs[keys.length + i]; });

  const { project, files } = assemble(design(png));
  files.push({ path: "temp/project.json", data: Buffer.from(JSON.stringify(project)) });
  // tar 묶기 (엔트리 오프라인과 같은 tar.gz). 외부 프로그램 없이 직접 만든다
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zlib.gzipSync(tarPack(files), { level: 6 }));
  if (extractDir) for (const f of files) { const p = path.join(extractDir, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
  return { project, files };
}

// 아주 작은 tar 만들기 (파일과 폴더만, ustar 형식)
function tarPack(files) {
  const blocks = [];
  const dirs = new Set();
  for (const f of files) { const parts = f.path.split("/"); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/") + "/"); }
  const entries = [...[...dirs].sort().map((d) => ({ path: d, data: Buffer.alloc(0), dir: true })), ...files];
  for (const e of entries) {
    const h = Buffer.alloc(512);
    h.write(e.path, 0, 100, "utf8");
    h.write(e.dir ? "0000755\0" : "0000644\0", 100);
    h.write("0000000\0", 108); h.write("0000000\0", 116);
    h.write(e.data.length.toString(8).padStart(11, "0") + "\0", 124);
    h.write(Math.floor(Date.UTC(2026, 9, 5) / 1000).toString(8).padStart(11, "0") + "\0", 136);
    h.write("        ", 148);
    h.write(e.dir ? "5" : "0", 156);
    h.write("ustar\0" + "00", 257);
    let sum = 0; for (let i = 0; i < 512; i++) sum += h[i];
    h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    blocks.push(h, e.data, Buffer.alloc((512 - (e.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

module.exports = { design, build, CARDS };

if (require.main === module) {
  const out = path.resolve(__dirname, "..", "..", "entry", "증강슈팅_간단판.ent");
  build(out, process.argv[2]).then(({ project }) => {
    let blocks = 0;
    const count = (b) => { if (!b || typeof b !== "object") return; if (b.type) blocks++; (b.params || []).forEach(count); (b.statements || []).forEach((l) => l.forEach(count)); };
    for (const o of project.objects) JSON.parse(o.script).forEach((s) => s.forEach(count));
    console.log("만들었습니다: " + out + " (오브젝트 " + project.objects.length + "개, 블록 " + blocks + "개)");
  });
}
