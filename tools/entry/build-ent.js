// =============================================================
// tools/entry/build-ent.js : 증강 슈팅 "엔트리 간단판" 작품(.ent) 만들기
// -------------------------------------------------------------
// 사용법 (프로젝트 폴더에서)
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js            → entry/증강슈팅_간단판.ent
//   NODE_PATH=$(npm root -g) node tools/entry/build-ent.js 폴더       → 그 폴더에 temp/ 를 풀어서도 저장 (검사용)
//
// 엔트리는 JavaScript 를 실행할 수 없어서, 게임의 핵심을 엔트리 블록으로 다시 만들었다.
//   - 메뉴 (게임 시작 · 조작법 · 카드 도감 · 최고 기록), 일시정지, 결과 화면 (다시 하기 · 메뉴로)
//   - 방향키 / WASD 로 이동, 가장 가까운 적에게 자동 발사
//   - 10웨이브 (5·10웨이브는 보스), 적 3종 (기본·돌격형·사인파형) + 보스 (12방향 탄막)
//   - 웨이브를 깨면 카드 3장 중 하나 고르기 (증강 6종 + 보급 2종, 클릭 또는 1·2·3 키)
//   - 대미지 숫자 (클수록 크게, 큰 한 방은 노랑 / 내가 맞으면 빨강 / 회복은 초록), 적 체력바, 보스 체력바
//   - 상태창 (챕터 · 웨이브, 체력바, 점수) + 증강 목록
// 엔트리 무대는 480 × 270 (가운데가 0,0 / 위쪽이 +y). 게임(960 × 540)의 절반 크기라서
// 거리·속도는 게임 값의 절반, 1초 = 60프레임 으로 바꿔 적었다.
// 상태(변수 "상태")에 따라 화면이 바뀐다:
//   메뉴 → (게임 시작) → 준비(웨이브 안내) → 전투 → 카드준비 → 고르기 → 준비 ... → 결과
//   메뉴 ↔ 조작법 / 도감,  전투 ↔ 멈춤
// =============================================================

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { assemble } = require("./assemble.js");
const { svgToPng } = require("./render.js");
const { ART, C } = require("./art.js");

// ---- 조절용 상수 (엔트리 단위: 길이 = 엔트리 좌표, 시간 = 프레임) ----
const WAVE_COUNT = 10;            // 마지막 웨이브
const BOSS_EVERY = 5;             // 이 웨이브마다 보스 (챕터 하나 = 5웨이브)
const PLAYER_SPEED = 2.2;         // 플레이어 이동 (프레임당)
const PLAYER_HP = 100;
const BASE_DAMAGE = 10;           // 기본 공격력 (게임과 같다)
const BIG_HIT = 20;               // 이 대미지 이상이면 노란 숫자 (기본 공격력의 2배)
const BULLET_SPEED = 4.5;         // 총알 속도 (프레임당)
const FIRE_FRAMES = 24;           // 기본 발사 간격 (24프레임 = 0.4초)
const INVINCIBLE_FRAMES = 60;     // 맞은 뒤 무적 (1초)
const WAVE_HEAL = 10;             // 웨이브를 깰 때마다 회복
const SIDE_BULLET_SCALE = 0.6;    // 3방향 탄의 옆 총알 대미지 배율
// 적 [모양 번호, 체력, 속도(프레임당), 점수, 접촉 대미지, 반지름(체력바·숫자 높이)]
const ENEMY = {
  basic: [1, 30, 0.8, 10, 10, 12],
  charger: [2, 40, 0.5, 15, 12, 12],
  sine: [3, 30, 0.7, 15, 10, 13],
  boss: [4, 700, 0.35, 200, 20, 31],
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
// 대미지 숫자 (게임의 팝업과 같다: 0.1초 동안 0.3배 → 1.6배, 0.25초까지 1배로, 0.15초 뒤부터 떠오름, 마지막 40% 동안 투명)
const POPUP_LIFE = 48;            // 0.8초
const POPUP_RISE = 0.42;          // 떠오르는 속도 (게임 1초 50px → 엔트리 프레임당 0.42)
// 증강 최대 레벨
const MAX = { 촉매: 3, 삼방향: 2, 복리: 3, 지연: 3, 넉백: 3, 분산: 3 };
const CATALYST = [0, 0.15, 0.25, 0.33];   // 발사 간격 감소율
const VARIANCE_MEAN = 1.1;                // 분산 증폭: 평균 배율 (게임과 같다)

// ---- 카드 8장 (번호 = 카드 모양 번호). 1~6 은 증강, 7~8 은 보급 ----
const CARDS = [
  { name: "촉매", color: "green", concept: "화학 · 반응 속도", formula: "간격 × 0.85", desc: ["촉매가 반응을 빠르게!", "발사 간격 15% 감소", "(Lv2 25%, Lv3 33%)"], tag: "증강 · 최대 Lv3" },
  { name: "3방향 탄", color: "yellow", concept: "수학 · 각도", formula: "360° ÷ n", desc: ["120° 간격으로 3발", "(Lv2: 72° 간격 5발)", "옆 총알은 0.6배"], tag: "증강 · 최대 Lv2" },
  { name: "복리 탄환", color: "yellow", concept: "수학 · 지수함수", formula: "(1 + 0.2)ⁿ", desc: ["공격력이 레벨마다", "1.2배씩 불어난다", "1.2 → 1.44 → 1.73"], tag: "증강 · 최대 Lv3" },
  { name: "시간 지연", color: "green", concept: "물리 · 상대성 이론", formula: "√(1 − (v/c)²)", desc: ["가까이 온 적이", "절반 속도로 느려진다", "(범위가 점점 넓어짐)"], tag: "증강 · 최대 Lv3" },
  { name: "넉백", color: "brown", concept: "물리 · 작용 반작용", formula: "F = ma", desc: ["맞은 적이", "뒤로 밀려난다", "(Lv 마다 더 멀리)"], tag: "증강 · 최대 Lv3" },
  { name: "분산 증폭", color: "red", concept: "통계 · 평균과 분산", formula: "평균 1.1, 분산 ↑", desc: ["한 발마다 0.2배 ~ 2.5배", "크게 흔들린다", "(Lv2 3배, Lv3 3.5배)"], tag: "증강 · 최대 Lv3" },
  { name: "세포 분열", color: "purple", concept: "생물 · 세포 분열", formula: "최대 체력 +20", desc: ["세포가 늘어난다!", "최대 체력 +20", "체력도 +20"], tag: "보급 카드", supply: true },
  { name: "항상성", color: "green", concept: "생물 · 항상성", formula: "체력 +40%", desc: ["몸이 균형을 되찾는다", "최대 체력의 40%", "만큼 회복"], tag: "보급 카드", supply: true },
];
const AUG_VARS = ["촉매", "삼방향", "복리", "지연", "넉백", "분산"];   // 카드 1~6 번이 올리는 증강 변수
const CARD_COUNT = CARDS.length;
const SUPPLY_CELL = 7, SUPPLY_HEAL = 8;

// 대미지 숫자 색 (번호 → 모양 이름 앞글자, 그림 색)
const POPUP_COLORS = [["흰", C.white], ["노랑", C.yellow], ["빨강", C.red], ["초록", C.green]];
const GLYPHS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-"];

// ---- 변수 ----
const GLOBALS = ["상태", "웨이브", "체력", "최대체력", "점수", "최고웨이브", "결과종류", "신기록", "도달웨이브",
  "배너글", "배너시간", "조준거리", "무적", "남은적", "다음종류",
  "후보거리", "후보x", "후보y", "목표x", "목표y", "목표있음", "발사타이머", "발사간격", "공격력", "쏠vx", "쏠vy",
  "이동x", "이동y", "카드1", "카드2", "카드3", "뽑기", "가능", "고른카드", "탄x", "탄y", "탄시작각", "보스체력", "보스최대",
  "분산배율", "분산높음", "분산p", "바만듦", "회복량", "받은대미지", "타이머숨",
  ...AUG_VARS];
const LOCALS = {
  적: ["복제본", "종류", "적체력", "적최대", "속도", "타이머", "단계", "돌진x", "돌진y", "거리", "느림", "깜빡", "회전", "번호", "반지름", "맞은대미지", "변"],
  총알: ["복제본", "vx", "vy", "나이"],
  보조총알: ["복제본", "vx", "vy", "각", "나이"],
  적탄: ["복제본", "각", "vx", "vy"],
  카드: ["복제본", "칸", "내카드"],
  숫자: ["복제본", "값", "색", "부호", "중심x", "중심y", "오프셋", "글자", "높이", "크기비", "나이", "배율", "글자수", "자릿수", "자리", "i", "색이름"],
  적체력바: ["복제본", "내번호", "비율"],
  도감카드: ["복제본", "칸"],
  메뉴장식: ["복제본", "칸", "기준x", "기준y"],
  상태판: ["이전최대", "번쩍"],
  체력바: ["칸"],
  증강판: ["줄수"],
};
// 대기열 리스트: 적이 넣고 "숫자"·"적체력바" 오브젝트가 읽는다
const LISTS = ["팝업x", "팝업y", "팝업값", "팝업색", "팝업부호", "바x", "바y", "바비율"];

// 화면 묶음 (상태 이름 목록)
const IN_GAME = ["준비", "전투", "카드준비", "고르기", "멈춤", "결과"];

function design(png) {
  const variables = GLOBALS.map((name) => ({ name, value: 0 }));
  for (const obj in LOCALS) for (const name of LOCALS[obj]) variables.push({ name, local: obj, value: 0 });
  const messages = ["게임시작", "메뉴로", "적생성", "발사", "탄막", "정리", "카드보이기", "카드선택"];

  // ---- 자주 쓰는 블록 묶음 ----
  const stateIs = (B, s) => B.cmp(B.v("상태"), "=", s);
  const stateIn = (B, list) => list.slice(1).reduce((acc, st) => B.or(acc, stateIs(B, st)), stateIs(B, list[0]));
  const fighting = (B) => stateIs(B, "전투");
  // 무대 밖으로 나갔는지 (총알·탄 지우기)
  const outside = (B) => B.or(B.cmp(B.mathOp("abs", B.myX()), ">", 250), B.cmp(B.mathOp("abs", B.myY()), ">", 145));
  // 이 상태들에서만 보이기 (매 프레임)
  const showIn = (B, list, extra) => B.ifElse(extra ? B.and(stateIn(B, list), extra) : stateIn(B, list), [B.show()], [B.hide()]);
  // 대미지 숫자 대기열에 하나 넣기: 색 1 흰, 2 노랑, 3 빨강, 4 초록, 5 "최대 체력 +20" 글자 / 부호 0 없음, 1 +, 2 −
  const popup = (B, x, y, val, color, sign) => [B.listAdd("팝업x", x), B.listAdd("팝업y", y), B.listAdd("팝업값", val), B.listAdd("팝업색", color), B.listAdd("팝업부호", sign)];
  const clearList = (B, name) => B.repeatUntil(B.cmp(B.listLen(name), "=", 0), [B.listRemove(name, 1)]);
  // 버튼: 보일 상태 + 마우스를 올리면 밝게 + 누르면 할 일
  const button = (name, key, x, y, states, onClick, extraScripts) => ({
    name, pictures: [{ name: name, png: png[key], width: png.size[key][0], height: png.size[key][1] }], scale: 0.5, x, y, visible: false,
    scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        showIn(B, states),
        B.ifElse(B.touching("mouse"), [B.effect("brightness", 15)], [B.effect("brightness", 0)]),
      ])]),
      B.when.click([B.iff(stateIn(B, states), onClick(B))]),
      ...(extraScripts ? extraScripts(B) : []),
    ],
  });
  const pic = (key) => png[key];

  const objects = [
    // ================= 결과 화면 =================
    button("다시하기버튼", "btnRetry", -64, -58, ["결과"], (B) => [B.send("게임시작")]),
    button("결과메뉴버튼", "btnMenu", 64, -58, ["결과"], (B) => [B.send("메뉴로")]),
    { name: "결과웨이브", type: "textBox", text: "", x: 0, y: 26, width: 260, height: 22, font: "bold 17px NanumSquareRound", colour: C.outline, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["결과"]),
        B.write(B.join("도달 웨이브  ", B.join(B.v("도달웨이브"), " / " + WAVE_COUNT))), B.wait(0.1)])]),
    ] },
    { name: "결과점수", type: "textBox", text: "", x: 0, y: 4, width: 260, height: 22, font: "bold 17px NanumSquareRound", colour: C.brown, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["결과"]), B.write(B.join("점수  ", B.v("점수"))), B.wait(0.1)])]),
    ] },
    { name: "결과최고", type: "textBox", text: "", x: 0, y: -18, width: 260, height: 20, font: "bold 14px NanumSquareRound", colour: C.purple, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["결과"]),
        B.ifElse(B.cmp(B.v("신기록"), "=", 1),
          [B.write(B.join("최고 기록: 웨이브 ", B.join(B.v("최고웨이브"), "  신기록!")))],
          [B.write(B.join("최고 기록: 웨이브 ", B.v("최고웨이브")))]),
        B.wait(0.1)])]),
    ] },
    { name: "결과판", pictures: [{ name: "게임 오버", png: pic("panelOver"), width: 576, height: 376 }, { name: "클리어", png: pic("panelClear"), width: 576, height: 376 }],
      scale: 0.5, x: 0, y: 6, visible: false, scripts: (B) => [
        B.when.run([B.hide(), B.forever([showIn(B, ["결과"]),
          B.ifElse(B.cmp(B.v("결과종류"), "=", "클리어"), [B.shape("결과판", "클리어")], [B.shape("결과판", "게임 오버")])])]),
      ] },

    // ================= 일시정지 =================
    button("계속버튼", "btnResume", -64, -40, ["멈춤"], (B) => [B.set("상태", "전투")]),
    button("멈춤메뉴버튼", "btnMenu", 64, -40, ["멈춤"], (B) => [B.send("메뉴로")]),
    { name: "일시정지판", pictures: [{ name: "일시정지", png: pic("panelPause"), width: 536, height: 316 }], scale: 0.5, x: 0, y: 8, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["멈춤"])])]),
    ] },

    // ================= 조작법 · 도감 =================
    button("조작법닫기버튼", "btnClose", 0, -84, ["조작법"], (B) => [B.set("상태", "메뉴")]),
    { name: "조작법판", pictures: [{ name: "조작법", png: pic("panelHelp"), width: 616, height: 416 }], scale: 0.5, x: 0, y: 2, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["조작법"])])]),
    ] },
    button("도감닫기버튼", "btnClose", 0, -114, ["도감"], (B) => [B.set("상태", "메뉴")]),
    { name: "도감카드", pictures: CARDS.map((c, i) => ({ name: c.name, png: pic("card" + i), width: 240, height: 320 })), scale: 0.27, visible: false, scripts: (B) => [
      // 8장을 4 × 2 로 늘어놓는다 (원본은 숨기고 복제본 8장)
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 0), B.repeat(CARD_COUNT, [B.change("칸", 1), B.clone("self")])]),
      B.when.clone([
        B.set("복제본", 1), B.shapeV(B.v("칸")),
        B.goXY(B.add(-117, B.mul(B.mod(B.sub(B.v("칸"), 1), 4), 78)), 0),
        B.iff(B.cmp(B.v("칸"), ">", 4), [B.setY(-46)]), B.iff(B.cmp(B.v("칸"), "<=", 4), [B.setY(44)]),
        B.forever([showIn(B, ["도감"])]),
      ]),
    ] },
    { name: "도감판", pictures: [{ name: "도감", png: pic("panelCollection"), width: 916, height: 536 }], scale: 0.5, x: 0, y: 0, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["도감"])])]),
    ] },

    // ================= 메뉴 =================
    button("시작버튼", "btnStart", 0, -14, ["메뉴"], (B) => [B.send("게임시작")], (B) => [
      // 1.5초마다 3% 커졌다 작아지며 숨 쉰다 (게임과 같다)
      B.when.run([B.forever([B.size(B.mul(B.add(1, B.mul(0.03, B.mathOp("sin", B.mul(B.v("타이머숨"), 4)))), 102))])]),
    ]),
    button("조작법버튼", "btnHelp", -64, -64, ["메뉴"], (B) => [B.set("상태", "조작법")]),
    button("도감버튼", "btnBook", 64, -64, ["메뉴"], (B) => [B.set("상태", "도감")]),
    { name: "최고기록글", type: "textBox", text: "", x: 0, y: -92, width: 300, height: 20, font: "bold 14px NanumSquareRound", colour: C.brown, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["메뉴"]), B.write(B.join("최고 기록: 웨이브 ", B.v("최고웨이브"))), B.wait(0.1)])]),
    ] },
    { name: "메뉴안내", type: "textBox", text: "", x: 0, y: -113, width: 400, height: 18, font: "12px NanumSquareRound", colour: C.outline, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.write("Enter · Space 시작   ·   방향키 / WASD 이동   ·   P 일시정지"), B.forever([showIn(B, ["메뉴"])])]),
    ] },
    { name: "메뉴제목", pictures: [{ name: "제목", png: pic("menuTitle"), width: 540, height: 170 }], scale: 0.5, x: 0, y: 70, visible: false, scripts: (B) => [
      // 아주 살짝 흔들흔들
      B.when.run([B.hide(), B.forever([showIn(B, ["메뉴"]), B.rotateToV(B.add(-2, B.mul(0.6, B.mathOp("sin", B.mul(B.v("타이머숨"), 1.5)))))])]),
    ] },
    { name: "메뉴장식", pictures: [
      { name: "플레이어", png: pic("player"), width: 52, height: 52 }, { name: "기본", png: pic("basic"), width: 48, height: 48 },
      { name: "돌격형", png: pic("charger"), width: 52, height: 48 }, { name: "사인파형", png: pic("sine"), width: 50, height: 50 },
    ], scale: 0.8, visible: false, scripts: (B) => [
      // 왼쪽에 플레이어, 오른쪽에 적 셋이 둥실둥실 (sin 으로 위아래)
      B.when.run([B.hide(), B.set("복제본", 0), B.set("칸", 0),
        ...[[-175, 4], [168, 46], [205, 0], [162, -40]].flatMap(([x, y]) => [B.change("칸", 1), B.set("기준x", x), B.set("기준y", y), B.clone("self")])]),
      B.when.clone([B.set("복제본", 1), B.shapeV(B.v("칸")),
        B.forever([showIn(B, ["메뉴"]), B.goXY(B.v("기준x"), B.add(B.v("기준y"), B.mul(5, B.mathOp("sin", B.add(B.mul(B.v("타이머숨"), 2.2), B.mul(B.v("칸"), 75))))))])]),
    ] },

    // ================= 화면 어둡게 (결과 · 일시정지 · 조작법 · 도감) =================
    { name: "어둡게", pictures: [{ name: "어둡게", png: pic("dim"), width: 960, height: 540 }], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, ["결과", "멈춤", "조작법", "도감"])])]),
    ] },

    // ================= 웨이브 안내 띠 · 카드 =================
    // 배너: 다른 오브젝트가 "배너글"과 "배너시간"(프레임)을 정하면 그동안 보여 준다
    { name: "배너", type: "textBox", text: "", x: 0, y: 30, width: 270, height: 32, font: "bold 22px NanumSquareRound", colour: C.outline, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        B.ifElse(B.and(B.cmp(B.v("배너시간"), ">", 0), stateIn(B, IN_GAME)), [B.write(B.v("배너글")), B.show(), B.change("배너시간", -1)], [B.hide()]),
      ])]),
    ] },
    { name: "배너띠", pictures: [{ name: "띠", png: pic("bannerStrip"), width: 560, height: 96 }], scale: 0.5, x: 0, y: 30, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME, B.cmp(B.v("배너시간"), ">", 0))])]),
    ] },
    { name: "안내", type: "textBox", text: "", x: 0, y: -118, width: 440, height: 24, font: "bold 15px NanumSquareRound", colour: C.outline, scripts: (B) => [
      B.when.run([B.forever([
        B.ifElse(stateIs(B, "고르기"), [B.write("카드를 눌러 고르세요 (1 · 2 · 3 키)")], [B.write("")]),
        B.wait(0.1),
      ])]),
    ] },
    { name: "카드", pictures: CARDS.map((c, i) => ({ name: c.name, png: pic("card" + i), width: 240, height: 320 })), scale: 0.62, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      // 카드 3장 고르기: 이미 뽑은 카드, 최대 레벨 증강은 다시 뽑는다 (보급 2장은 늘 가능하니 끝난다)
      B.when.msg("카드보이기", [B.iff(B.cmp(B.v("복제본"), "=", 0), [
        B.set("카드1", 0), B.set("카드2", 0), B.set("카드3", 0),
        ...[1, 2, 3].flatMap((k) => [
          B.set("가능", 0),
          B.repeatUntil(B.cmp(B.v("가능"), "=", 1), [
            B.set("뽑기", B.rand(1, CARD_COUNT)), B.set("가능", 1),
            B.iff(B.or(B.cmp(B.v("뽑기"), "=", B.v("카드1")), B.cmp(B.v("뽑기"), "=", B.v("카드2"))), [B.set("가능", 0)]),
            ...AUG_VARS.map((name, i) => B.iff(B.and(B.cmp(B.v("뽑기"), "=", i + 1), B.cmp(B.v(name), ">=", MAX[name])), [B.set("가능", 0)])),
          ]),
          B.set("카드" + k, B.v("뽑기")),
          // 원본의 지역 변수를 정해 두고 복제하면, 복제본이 그 값을 그대로 가져간다
          B.set("칸", k), B.set("내카드", B.v("뽑기")), B.clone("self"),
        ]),
        // 3장을 다 만든 뒤에야 고를 수 있다 (만드는 도중에 고르면 늦게 나온 카드가 남는다)
        B.set("상태", "고르기"),
      ])]),
      B.when.clone([
        B.set("복제본", 1),
        B.goXY(B.add(-155, B.mul(B.sub(B.v("칸"), 1), 155)), 2),
        B.shapeV(B.v("내카드")),
        B.show(),
        B.forever([B.ifElse(B.touching("mouse"), [B.effect("brightness", 10)], [B.effect("brightness", 0)])]),
      ]),
      B.when.click([B.iff(B.and(B.cmp(B.v("복제본"), "=", 1), stateIs(B, "고르기")), [B.set("고른카드", B.v("내카드")), B.send("카드선택")])]),
      ...[1, 2, 3].map((k) => B.when.key(48 + k, [B.iff(B.and(B.cmp(B.v("복제본"), "=", 0), stateIs(B, "고르기")), [B.set("고른카드", B.v("카드" + k)), B.send("카드선택")])])),
      B.when.msg("카드선택", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ================= 증강 목록 (오른쪽 위) =================
    // 가진 증강만, 카드 순서대로 한 줄씩. 줄 위치 = 앞쪽에 가진 증강 수
    ...AUG_VARS.map((name, k) => ({
      name: "증강줄" + (k + 1), pictures: [1, 2, 3].slice(0, MAX[name]).map((lv) => ({ name: "Lv" + lv, png: pic("aug" + k + "_" + lv), width: 220, height: 38 })),
      scale: 0.5, x: 169, y: 90, visible: false,
      scripts: (B) => [
        B.when.run([B.hide(), B.forever([
          showIn(B, IN_GAME, B.cmp(B.v(name), ">", 0)),
          B.iff(B.cmp(B.v(name), ">", 0), [
            B.shapeV(B.v(name)),
            // 첫 줄 자리에서, 앞쪽 증강 중 가진 것의 수만큼 한 줄(19)씩 아래로
            B.setY(93.5),
            ...AUG_VARS.slice(0, k).map((other) => B.iff(B.cmp(B.v(other), ">", 0), [B.moveY(-19)])),
          ]),
          B.wait(0.05),
        ])]),
      ],
    })),
    { name: "증강판", pictures: [1, 2, 3, 4, 5, 6].map((rows) => ({ name: rows + "줄", png: pic("augPanel" + rows), width: 248, height: 60 + rows * 38 })), scale: 0.5, x: 170, y: 100, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        // 가진 증강 수 = 줄 수. 패널 위쪽 끝을 화면 위(129)에 맞춘다: 가운데 y = 114 − 9.5 × 줄 수
        B.set("줄수", 0),
        ...AUG_VARS.map((name) => B.iff(B.cmp(B.v(name), ">", 0), [B.change("줄수", 1)])),
        showIn(B, IN_GAME, B.cmp(B.v("줄수"), ">", 0)),
        B.iff(B.cmp(B.v("줄수"), ">", 0), [B.shapeV(B.v("줄수")), B.setY(B.sub(114, B.mul(9.5, B.v("줄수"))))]),
        B.wait(0.05),
      ])]),
    ] },

    // ================= 상태창 (왼쪽 위) =================
    { name: "웨이브글", type: "textBox", text: "", x: -138, y: 116, width: 168, height: 20, font: "bold 13px NanumSquareRound", colour: C.white, textAlign: 1, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME),
        // 챕터 = 5웨이브마다 하나 (게임과 같은 "챕터 1 · 웨이브 3 / 10")
        B.write(B.join("챕터 ", B.join(B.mathOp("ceil", B.div(B.v("도달웨이브"), BOSS_EVERY)),
          B.join(" · 웨이브 ", B.join(B.v("도달웨이브"), " / " + WAVE_COUNT))))),
        B.wait(0.1)])]),
    ] },
    { name: "체력글", type: "textBox", text: "", x: -140, y: 96, width: 150, height: 18, font: "bold 12px NanumSquareRound", colour: C.outline, visible: false, scripts: (B) => [
      // 체력이 소수여도 살아 있으면 1 이상으로 보이게 올림 (게임과 같다)
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME), B.write(B.join(B.mathOp("ceil", B.v("체력")), B.join(" / ", B.mathOp("round", B.v("최대체력"))))), B.wait(0.05)])]),
    ] },
    { name: "점수글", type: "textBox", text: "", x: -138, y: 75, width: 168, height: 20, font: "bold 14px NanumSquareRound", colour: C.yellow, textAlign: 1, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME), B.write(B.join("점수 ", B.v("점수"))), B.wait(0.1)])]),
    ] },
    { name: "체력바", pictures: [
      ...Array.from({ length: 21 }, (_, i) => ({ name: "초록" + i, png: pic("hp" + i), width: 304, height: 38 })),
      ...Array.from({ length: 21 }, (_, i) => ({ name: "빨강" + i, png: pic("hpRed" + i), width: 304, height: 38 })),
    ], scale: 0.5, x: -140, y: 96, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME),
        // 남은 비율을 20칸으로. 30% 이하면 빨강 (모양 22번부터)
        B.set("칸", B.mathOp("round", B.mul(B.div(B.v("체력"), B.v("최대체력")), 20))),
        B.iff(B.cmp(B.v("칸"), "<", 0), [B.set("칸", 0)]),
        B.ifElse(B.cmp(B.div(B.v("체력"), B.v("최대체력")), "<=", 0.3), [B.shapeV(B.add(B.v("칸"), 22))], [B.shapeV(B.add(B.v("칸"), 1))]),
      ])]),
    ] },
    { name: "상태판", pictures: [{ name: "상태판", png: pic("hudPanel"), width: 368, height: 136 }], scale: 0.5, x: -140, y: 97, visible: false, scripts: (B) => [
      // 최대 체력이 늘면 번쩍 (게임의 체력바 번쩍임 대신 상태판 전체가 깜빡)
      B.when.run([B.hide(), B.set("이전최대", PLAYER_HP), B.set("번쩍", 0), B.forever([showIn(B, IN_GAME),
        B.iff(B.cmp(B.v("최대체력"), ">", B.v("이전최대")), [B.set("번쩍", 36)]),
        B.set("이전최대", B.v("최대체력")),
        B.ifElse(B.cmp(B.v("번쩍"), ">", 0), [B.change("번쩍", -1),
          B.ifElse(B.cmp(B.mod(B.v("번쩍"), 8), "<", 4), [B.effect("brightness", 35)], [B.effect("brightness", 0)])], [B.effect("brightness", 0)]),
      ])]),
    ] },

    // ================= 보스 체력바 (화면 위 가운데) =================
    // 상태창(오른쪽 끝 −48)과 증강 목록(왼쪽 끝 108) 사이 가운데
    { name: "보스바", pictures: Array.from({ length: 21 }, (_, i) => ({ name: "보스" + i, png: pic("boss" + i), width: 304, height: 80 })), scale: 0.5, x: 30, y: 114, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([showIn(B, IN_GAME, B.cmp(B.v("보스체력"), ">", 0)),
        B.shapeV(B.add(B.mathOp("round", B.mul(B.div(B.v("보스체력"), B.add(B.v("보스최대"), 0.001)), 20)), 1))])]),
    ] },

    // ================= 대미지 숫자 =================
    // 적·플레이어가 "팝업" 리스트에 넣으면, 원본이 글자 하나씩 복제본을 만든다 (숫자 "23" = 복제본 2개)
    // 크기 = 8 + √대미지 × 1.5 (게임: 16 + √대미지 × 3 의 절반) → 클수록 큰 숫자
    { name: "숫자", pictures: [
      ...POPUP_COLORS.flatMap(([cn], ci) => GLYPHS.map((g, gi) => ({ name: cn + g, png: pic("glyph" + ci + "_" + gi), width: 28, height: 40 }))),
      { name: "최대체력", png: pic("wordMaxHp"), width: 200, height: 40 },
    ], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.forever([
        B.repeatUntil(B.cmp(B.listLen("팝업값"), "=", 0), [
          B.set("값", B.mathOp("round", B.listItem("팝업값", 1))), B.set("색", B.listItem("팝업색", 1)), B.set("부호", B.listItem("팝업부호", 1)),
          B.set("중심x", B.add(B.listItem("팝업x", 1), B.div(B.rand(-35, 35), 10))), B.set("중심y", B.listItem("팝업y", 1)),
          ...["팝업x", "팝업y", "팝업값", "팝업색", "팝업부호"].map((l) => B.listRemove(l, 1)),
          B.iff(B.cmp(B.v("값"), "<", 1), [B.set("값", 1)]), B.iff(B.cmp(B.v("값"), ">", 999), [B.set("값", 999)]),
          B.set("높이", B.add(8, B.mul(B.mathOp("root", B.v("값")), 1.5))),
          B.ifElse(B.cmp(B.v("색"), "=", 5), [
            // "최대 체력 +20" 글자 (크기 일정)
            B.set("글자", "최대체력"), B.set("오프셋", 0), B.set("높이", 11), B.set("크기비", 3), B.clone("self"),
          ], [
            B.set("크기비", 0.85),   // 글자 그림 28 × 40: 엔트리 "크기" = (가로 + 세로) ÷ 2 → 높이의 0.85
            ...POPUP_COLORS.map(([cn], ci) => B.iff(B.cmp(B.v("색"), "=", ci + 1), [B.set("색이름", cn)])),
            B.set("자릿수", 1), B.set("자리", 1),
            B.iff(B.cmp(B.v("값"), ">=", 10), [B.set("자릿수", 2), B.set("자리", 10)]),
            B.iff(B.cmp(B.v("값"), ">=", 100), [B.set("자릿수", 3), B.set("자리", 100)]),
            B.set("글자수", B.v("자릿수")), B.iff(B.cmp(B.v("부호"), ">", 0), [B.change("글자수", 1)]),
            B.set("i", 0),
            // 부호 (+ 또는 −)
            B.iff(B.cmp(B.v("부호"), ">", 0), [
              B.set("오프셋", B.mul(B.sub(B.v("i"), B.div(B.sub(B.v("글자수"), 1), 2)), B.mul(B.v("높이"), 0.6))),
              B.ifElse(B.cmp(B.v("부호"), "=", 1), [B.set("글자", B.join(B.v("색이름"), "+"))], [B.set("글자", B.join(B.v("색이름"), "-"))]),
              B.clone("self"), B.change("i", 1)]),
            // 숫자 자리마다 하나: (값 ÷ 자리) 의 몫을 10 으로 나눈 나머지
            B.repeat(B.v("자릿수"), [
              B.set("오프셋", B.mul(B.sub(B.v("i"), B.div(B.sub(B.v("글자수"), 1), 2)), B.mul(B.v("높이"), 0.6))),
              B.set("글자", B.join(B.v("색이름"), B.mod(B.mathOp("floor", B.div(B.v("값"), B.v("자리"))), 10))),
              B.clone("self"), B.change("i", 1), B.set("자리", B.div(B.v("자리"), 10)),
            ]),
          ]),
        ]),
      ])]),
      B.when.clone([
        B.set("복제본", 1), B.set("나이", 0), B.shapeV(B.v("글자")), B.front(),
        B.forever([
          B.change("나이", 1),
          // 바운스: 0.3배 → 1.6배 (6프레임) → 1배 (15프레임까지)
          B.set("배율", 1),
          B.iff(B.cmp(B.v("나이"), "<", 15), [B.set("배율", B.sub(1.6, B.mul(0.6, B.div(B.sub(B.v("나이"), 6), 9))))]),
          B.iff(B.cmp(B.v("나이"), "<", 6), [B.set("배율", B.add(0.3, B.mul(1.3, B.div(B.v("나이"), 6))))]),
          B.size(B.mul(B.mul(B.v("높이"), B.v("크기비")), B.v("배율"))),
          // 0.15초 뒤부터 위로 떠오른다
          B.iff(B.cmp(B.v("나이"), ">", 9), [B.change("중심y", POPUP_RISE)]),
          B.goXY(B.add(B.v("중심x"), B.mul(B.v("오프셋"), B.v("배율"))), B.v("중심y")),
          // 마지막 40% 동안 점점 투명
          B.ifElse(B.cmp(B.v("나이"), ">", POPUP_LIFE * 0.6), [B.effect("transparency", B.mul(B.div(B.sub(B.v("나이"), POPUP_LIFE * 0.6), POPUP_LIFE * 0.4), 100))], [B.effect("transparency", 0)]),
          B.show(),
          B.iff(B.cmp(B.v("나이"), ">=", POPUP_LIFE), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ================= 적 머리 위 체력바 =================
    // 적이 "바x·바y·바비율" 리스트의 자기 번호 칸에 위치와 남은 비율을 적는다. 한 대라도 맞은 적만 보인다 (게임과 같다)
    { name: "적체력바", pictures: Array.from({ length: 21 }, (_, i) => ({ name: "칸" + i, png: pic("ebar" + i), width: 54, height: 18 })), scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0), B.forever([
        B.iff(B.cmp(B.v("바만듦"), "<", B.listLen("바비율")), [B.change("바만듦", 1), B.set("내번호", B.v("바만듦")), B.clone("self")]),
      ])]),
      B.when.clone([B.set("복제본", 1), B.forever([
        B.iff(B.cmp(B.v("내번호"), ">", B.listLen("바비율")), [B.deleteClone()]),
        B.set("비율", B.listItem("바비율", B.v("내번호"))),
        B.iff(B.cmp(B.v("비율"), "<", 0), [B.deleteClone()]),
        B.ifElse(B.cmp(B.v("비율"), ">=", 1), [B.hide()], [
          B.shapeV(B.add(B.mathOp("round", B.mul(B.v("비율"), 20)), 1)),
          B.goXY(B.listItem("바x", B.v("내번호")), B.listItem("바y", B.v("내번호"))), B.show()]),
      ])]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ================= 보스 탄 =================
    { name: "적탄", pictures: [{ name: "적탄", png: pic("enemyBullet"), width: 20, height: 20 }], scale: 0.5, visible: false, scripts: (B) => [
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
              B.change("체력", -BOSS_BULLET_DAMAGE), B.set("무적", INVINCIBLE_FRAMES),
              ...popup(B, B.coord("플레이어", "x"), B.add(B.coord("플레이어", "y"), 14), BOSS_BULLET_DAMAGE, 3, 2),
              B.deleteClone()]),
          ]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ================= 적 (원본은 숨기고, "적생성" 신호마다 복제본 하나) =================
    // 총알·플레이어보다 목록 위에 있어야 한다: 엔트리는 목록 위 오브젝트의 코드부터 실행한다
    //   → 적이 먼저 "총알에 닿았는가"를 보고 나서, 총알이 자기를 지운다
    //   → 적이 "가장 가까운 적" 후보를 다 적은 뒤에 플레이어가 조준한다
    { name: "적", pictures: [
      { name: "기본", png: pic("basic"), width: 48, height: 48 }, { name: "돌격형", png: pic("charger"), width: 52, height: 48 },
      { name: "사인파형", png: pic("sine"), width: 50, height: 50 }, { name: "보스", png: pic("boss"), width: 124, height: 124 },
    ], scale: 0.5, visible: false, scripts: (B) => {
      const dx = () => B.sub(B.coord("플레이어", "x"), B.myX());
      const dy = () => B.sub(B.coord("플레이어", "y"), B.myY());
      // (dx, dy) 를 거리로 나누면 플레이어 쪽 길이 1 화살표
      const toward = (axis, scale) => B.mul(B.div(axis === "x" ? dx() : dy(), B.v("거리")), scale);
      const typeIs = (n) => B.cmp(B.v("종류"), "=", n);
      const rnd01 = () => B.div(B.rand(0, 1000), 1000);
      // 총알 하나에 맞았을 때: 분산 증폭 배율 → 대미지 → 숫자 (2배 이상이면 노랑)
      const hit = (scale) => [
        B.set("분산배율", 1),
        B.iff(B.cmp(B.v("분산"), ">", 0), [
          // 분산 증폭 (게임과 같다): 큰 쪽 [1, 최대] 이 나올 확률 p 를 평균이 1.1 이 되게 정한다
          B.set("분산높음", B.add(2, B.mul(0.5, B.v("분산")))),
          B.set("분산p", B.div(VARIANCE_MEAN - 0.6, B.sub(B.div(B.add(1, B.v("분산높음")), 2), 0.6))),
          B.ifElse(B.cmp(rnd01(), "<", B.v("분산p")),
            [B.set("분산배율", B.add(1, B.mul(rnd01(), B.sub(B.v("분산높음"), 1))))],
            [B.set("분산배율", B.add(0.2, B.mul(rnd01(), 0.8)))]),
        ]),
        B.set("맞은대미지", B.mul(B.mul(B.v("공격력"), scale), B.v("분산배율"))),
        B.change("적체력", B.mul(B.v("맞은대미지"), -1)), B.set("깜빡", 6),
        ...popup(B, B.myX(), B.add(B.myY(), B.v("반지름")), B.v("맞은대미지"), 1, 0),
        B.iff(B.cmp(B.v("맞은대미지"), ">=", BIG_HIT), [B.listSet("팝업색", B.listLen("팝업색"), 2)]),
      ];
      return [
        B.when.run([B.hide(), B.set("복제본", 0)]),
        B.when.msg("적생성", [B.iff(B.cmp(B.v("복제본"), "=", 0), [
          B.set("종류", B.v("다음종류")),
          // 체력 = 기본 체력 × (1 + 0.2 × (웨이브 − 1)). 보스는 700 × (웨이브 ÷ 5)
          ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.set("적최대", e[1]), B.set("속도", e[2]), B.set("반지름", e[5])])),
          B.set("적최대", B.mul(B.v("적최대"), B.add(1, B.mul(ENEMY_HP_GROWTH, B.sub(B.v("웨이브"), 1))))),
          B.iff(typeIs(ENEMY.boss[0]), [B.set("적최대", B.mul(ENEMY.boss[1], B.div(B.v("웨이브"), BOSS_EVERY))), B.set("보스최대", B.v("적최대")), B.set("보스체력", B.v("적최대"))]),
          B.set("속도", B.mul(B.v("속도"), B.add(1, B.mul(ENEMY_SPEED_GROWTH, B.sub(B.v("웨이브"), 1))))),
          // 체력바 칸 하나 (번호 = 리스트 길이)
          B.listAdd("바x", 0), B.listAdd("바y", 0), B.listAdd("바비율", 1), B.set("번호", B.listLen("바비율")),
          B.change("남은적", 1),
          B.clone("self"),
        ])]),
        B.when.clone([
          B.set("복제본", 1), B.set("적체력", B.v("적최대")), B.set("타이머", 0), B.set("단계", 0), B.set("깜빡", 0),
          B.shapeV(B.v("종류")),
          // 네 변 중 한 곳의 바깥에서 나온다 (보스는 위에서)
          B.set("변", B.rand(1, 4)),
          B.iff(typeIs(4), [B.set("변", 1)]),
          B.iff(B.cmp(B.v("변"), "=", 1), [B.goXY(B.rand(-200, 200), 150)]),
          B.iff(B.cmp(B.v("변"), "=", 2), [B.goXY(B.rand(-200, 200), -150)]),
          B.iff(B.cmp(B.v("변"), "=", 3), [B.goXY(-255, B.rand(-110, 110))]),
          B.iff(B.cmp(B.v("변"), "=", 4), [B.goXY(255, B.rand(-110, 110))]),
          B.show(),
          B.forever([B.iff(fighting(B), [
            // 1) 총알에 맞았는지 (옆 총알은 0.6배)
            B.iff(B.touching("총알"), hit(1)),
            B.iff(B.touching("보조총알"), hit(SIDE_BULLET_SCALE)),
            B.iff(B.cmp(B.v("적체력"), "<=", 0), [
              ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.change("점수", e[3])])),
              B.iff(typeIs(4), [B.set("보스체력", 0)]),
              B.listSet("바비율", B.v("번호"), -1),
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
            //   바라보는 각 = atan(dy ÷ dx) (dx 가 음수면 +180°). 엔트리 방향은 시계 방향이 + 라서 − 를 붙인다
            B.iff(B.and(typeIs(2), B.cmp(B.v("단계"), "!=", 2)), [
              B.set("회전", B.mathOp("atan_radian", B.div(dy(), B.add(dx(), 0.001)))),
              B.iff(B.cmp(dx(), "<", 0), [B.change("회전", 180)]),
              B.rotateToV(B.mul(B.v("회전"), -1))]),
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
            // 4) 플레이어와 부딪히면 대미지 (빨간 숫자)
            B.iff(B.and(B.touching("플레이어"), B.cmp(B.v("무적"), "<=", 0)), [
              ...Object.values(ENEMY).map((e) => B.iff(typeIs(e[0]), [B.set("받은대미지", e[4])])),
              B.change("받은대미지", B.mul(B.v("웨이브"), 0.5)),
              B.change("체력", B.mul(B.v("받은대미지"), -1)),
              ...popup(B, B.coord("플레이어", "x"), B.add(B.coord("플레이어", "y"), 14), B.v("받은대미지"), 3, 2),
              B.set("무적", INVINCIBLE_FRAMES)]),
            // 5) 머리 위 체력바 칸 (보스는 화면 위 큰 체력바가 대신 → 늘 가득으로 적어 숨긴다)
            B.listSet("바x", B.v("번호"), B.myX()), B.listSet("바y", B.v("번호"), B.add(B.myY(), B.add(B.v("반지름"), 5))),
            B.ifElse(typeIs(4), [B.listSet("바비율", B.v("번호"), 1)], [B.listSet("바비율", B.v("번호"), B.div(B.v("적체력"), B.v("적최대")))]),
          ])]),
        ]),
        B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
      ];
    } },

    // ================= 총알 (조준한 총알) =================
    // 플레이어가 "발사" 신호를 보내면 원본이 방향을 정해 복제본을 만든다
    // 3방향 탄이 있으면 옆 총알은 "보조총알" 오브젝트가 만든다 (대미지가 달라서 따로)
    { name: "총알", pictures: [{ name: "총알", png: pic("bullet"), width: 18, height: 18 }], scale: 0.5, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.set("복제본", 0)]),
      B.when.msg("발사", [B.iff(B.cmp(B.v("복제본"), "=", 0), [B.set("vx", B.v("쏠vx")), B.set("vy", B.v("쏠vy")), B.clone("self")])]),
      B.when.clone([
        B.set("복제본", 1), B.goTo("플레이어"), B.show(),
        B.set("나이", 0),
        B.forever([
          // 움직이기 "전에" 닿았는지 본다 → 같은 프레임에 적도 이 총알을 볼 수 있다
          // 태어난 프레임에는 보지 않는다 (적이 플레이어에 붙어 있으면 적이 보기도 전에 지워지므로)
          B.iff(B.and(B.cmp(B.v("나이"), ">", 0), B.touching("적")), [B.deleteClone()]),
          B.iff(fighting(B), [B.moveX(B.v("vx")), B.moveY(B.v("vy")), B.change("나이", 1)]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },
    { name: "보조총알", pictures: [{ name: "옆 총알", png: pic("sideBullet"), width: 16, height: 16 }], scale: 0.5, visible: false, scripts: (B) => [
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
        B.set("나이", 0),
        B.forever([
          B.iff(B.and(B.cmp(B.v("나이"), ">", 0), B.touching("적")), [B.deleteClone()]),
          B.iff(fighting(B), [B.moveX(B.v("vx")), B.moveY(B.v("vy")), B.change("나이", 1)]),
          B.iff(outside(B), [B.deleteClone()]),
        ]),
      ]),
      B.when.msg("정리", [B.iff(B.cmp(B.v("복제본"), "=", 1), [B.deleteClone()])]),
    ] },

    // ================= 플레이어 =================
    { name: "플레이어", pictures: [{ name: "플레이어", png: pic("player"), width: 52, height: 52 }], scale: 0.5, x: 0, y: -40, visible: false, scripts: (B) => {
      const keyPair = (a, b) => B.or(B.key(a), B.key(b));
      return [
        B.when.run([B.hide()]),
        B.when.msg("게임시작", [B.goXY(0, -40), B.clearEffects()]),
        B.when.run([B.forever([showIn(B, IN_GAME), B.iff(fighting(B), [
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
            B.ifElse(B.cmp(B.mod(B.v("무적"), 10), "<", 5), [B.effect("transparency", 45)], [B.effect("transparency", 0)]),
          ], [B.effect("transparency", 0)]),
        ])])]),
      ];
    } },
    // 시간 지연 범위 원 (플레이어를 따라다닌다)
    { name: "지연원", pictures: [{ name: "범위", png: pic("slowRing"), width: 288, height: 288 }], scale: 0.3, visible: false, scripts: (B) => [
      B.when.run([B.hide(), B.forever([
        B.ifElse(B.and(stateIn(B, IN_GAME), B.cmp(B.v("지연"), ">", 0)), [
          B.goTo("플레이어"),
          // 반지름 = 지연 × 12.5 + 32.5 (45, 57.5, 70). 엔트리의 "크기"는 가로·세로 평균 길이라서 지름(반지름 × 2)을 넣는다
          B.size(B.mul(B.add(B.mul(B.v("지연"), 12.5), 32.5), 2)),
          B.show()], [B.hide()]),
      ])]),
    ] },

    // ================= 배경 + 게임 진행 (맨 뒤) =================
    { name: "배경", pictures: [{ name: "배경", png: pic("background"), width: 960, height: 540 }], scale: 0.5, scripts: (B) => {
      const resultScreen = (kind, reached) => [
        B.set("상태", "결과"), B.set("결과종류", kind), B.set("도달웨이브", reached), B.set("신기록", 0),
        B.iff(B.cmp(B.v("도달웨이브"), ">", B.v("최고웨이브")), [B.set("최고웨이브", B.v("도달웨이브")), B.set("신기록", 1)]),
        B.set("배너시간", 0),
      ];
      return [
        // 처음: 메뉴 (최고 기록은 작품을 다시 시작하기 전까지 남는다)
        B.when.run([B.set("상태", "메뉴"), B.set("최고웨이브", 0), B.set("타이머숨", 0), B.set("보스체력", 0), B.set("배너시간", 0)]),
        // 메뉴 장식이 쓰는 시간 (프레임마다 +1)
        B.when.run([B.forever([B.change("타이머숨", 1)])]),
        // 키보드: Enter·Space 시작, P·Esc 일시정지·닫기, R 다시 하기, M 메뉴로
        ...[13, 32].map((k) => B.when.key(k, [B.iff(stateIs(B, "메뉴"), [B.send("게임시작")])])),
        ...[80, 27].map((k) => B.when.key(k, [
          B.ifElse(stateIs(B, "전투"), [B.set("상태", "멈춤")], [
            B.ifElse(stateIs(B, "멈춤"), [B.set("상태", "전투")], [
              B.iff(B.or(stateIs(B, "조작법"), stateIs(B, "도감")), [B.set("상태", "메뉴")])])])])),
        B.when.key(82, [B.iff(stateIs(B, "결과"), [B.send("게임시작")])]),
        B.when.key(77, [B.iff(B.or(stateIs(B, "결과"), stateIs(B, "멈춤")), [B.send("메뉴로")])]),

        // ---- 게임 시작: 처음 값 → 웨이브 반복 ----
        B.when.msg("게임시작", [
          B.set("상태", "준비"), B.set("배너시간", 0), B.set("웨이브", 1), B.set("도달웨이브", 1),
          B.set("체력", PLAYER_HP), B.set("최대체력", PLAYER_HP), B.set("점수", 0),
          B.set("무적", 0), B.set("남은적", 0), B.set("후보거리", 99999), B.set("목표있음", 0), B.set("발사타이머", 0),
          B.set("보스체력", 0), B.set("탄시작각", 0), B.set("고른카드", 0),
          ...AUG_VARS.map((n) => B.set(n, 0)),
          B.set("공격력", BASE_DAMAGE), B.set("발사간격", FIRE_FRAMES),
          B.sendWait("정리"),
          ...LISTS.map((l) => clearList(B, l)), B.set("바만듦", 0),
          // 웨이브 반복
          B.repeatUntil(B.cmp(B.v("웨이브"), ">", WAVE_COUNT), [
            B.set("도달웨이브", B.v("웨이브")),
            B.ifElse(B.cmp(B.mod(B.v("웨이브"), BOSS_EVERY), "=", 0),
              [B.set("배너글", B.join("웨이브 ", B.join(B.v("웨이브"), " — 보스!")))],
              [B.set("배너글", B.join("웨이브 ", B.v("웨이브")))]),
            B.set("상태", "준비"), B.set("배너시간", 90), B.wait(1.5),
            B.set("상태", "전투"),
            // 보스 웨이브: 보스부터
            B.iff(B.cmp(B.mod(B.v("웨이브"), BOSS_EVERY), "=", 0), [B.set("다음종류", ENEMY.boss[0]), B.send("적생성"), B.wait(1)]),
            // 졸개 3 + 2 × 웨이브 마리. 3웨이브부터 돌격형, 6웨이브부터 사인파형이 섞인다
            B.repeat(B.add(3, B.mul(B.v("웨이브"), 2)), [
              B.waitUntil(fighting(B)),   // 일시정지 동안은 나오지 않게
              B.set("뽑기", B.rand(1, 10)), B.set("다음종류", ENEMY.basic[0]),
              B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 3), B.cmp(B.v("뽑기"), "<=", 3)), [B.set("다음종류", ENEMY.charger[0])]),
              B.iff(B.and(B.cmp(B.v("웨이브"), ">=", 6), B.cmp(B.v("뽑기"), ">=", 8)), [B.set("다음종류", ENEMY.sine[0])]),
              B.send("적생성"),
              B.wait(B.sub(0.8, B.mul(B.v("웨이브"), 0.04))),
            ]),
            B.waitUntil(B.cmp(B.v("남은적"), "<=", 0)),
            B.waitUntil(fighting(B)),
            B.send("정리"),
            B.iff(B.cmp(B.v("웨이브"), "<", WAVE_COUNT), [
              // 웨이브 클리어: 회복(초록 숫자)하고 카드 고르기
              B.set("회복량", B.sub(B.v("최대체력"), B.v("체력"))),
              B.iff(B.cmp(B.v("회복량"), ">", WAVE_HEAL), [B.set("회복량", WAVE_HEAL)]),
              B.iff(B.cmp(B.v("회복량"), ">=", 1), [B.change("체력", B.v("회복량")),
                ...popup(B, B.coord("플레이어", "x"), B.add(B.coord("플레이어", "y"), 16), B.v("회복량"), 4, 1)]),
              B.set("상태", "카드준비"), B.send("카드보이기"),
              B.waitUntil(fighting(B)),
            ]),
            B.change("웨이브", 1),
          ]),
          ...resultScreen("클리어", WAVE_COUNT),
        ]),
        // 체력이 0 이 되면 게임 오버 (웨이브 반복을 멈춘다)
        B.when.msg("게임시작", [
          B.waitUntil(B.cmp(B.v("체력"), "<=", 0)),
          B.stop("otherThread"),
          B.set("체력", 0),
          ...resultScreen("게임 오버", B.v("웨이브")),
        ]),
        // 메뉴로: 진행 중인 게임을 멈추고 정리
        B.when.msg("메뉴로", [B.stop("otherThread"), B.set("보스체력", 0), B.set("배너시간", 0), B.send("정리"), B.set("상태", "메뉴")]),
        // 카드를 골랐을 때: 효과 적용
        B.when.msg("카드선택", [
          ...AUG_VARS.map((name, i) => B.iff(B.cmp(B.v("고른카드"), "=", i + 1), [B.change(name, 1)])),
          B.iff(B.cmp(B.v("고른카드"), "=", SUPPLY_CELL), [B.change("최대체력", 20), B.change("체력", 20),
            ...popup(B, B.coord("플레이어", "x"), B.add(B.coord("플레이어", "y"), 16), 20, 5, 0)]),
          B.iff(B.cmp(B.v("고른카드"), "=", SUPPLY_HEAL), [
            B.set("회복량", B.sub(B.v("최대체력"), B.v("체력"))),
            B.iff(B.cmp(B.v("회복량"), ">", B.mul(B.v("최대체력"), 0.4)), [B.set("회복량", B.mul(B.v("최대체력"), 0.4))]),
            B.change("체력", B.v("회복량")),
            ...popup(B, B.coord("플레이어", "x"), B.add(B.coord("플레이어", "y"), 16), B.v("회복량"), 4, 1)]),
          B.iff(B.cmp(B.v("체력"), ">", B.v("최대체력")), [B.set("체력", B.v("최대체력"))]),
          // 공격력 = 10 × 1.2 ^ 복리 레벨, 발사 간격 = 24 × (1 − 촉매 감소율)
          B.set("공격력", BASE_DAMAGE), B.repeat(B.v("복리"), [B.set("공격력", B.mul(B.v("공격력"), 1.2))]),
          B.set("발사간격", FIRE_FRAMES),
          ...[1, 2, 3].map((lv) => B.iff(B.cmp(B.v("촉매"), "=", lv), [B.set("발사간격", B.mul(FIRE_FRAMES, 1 - CATALYST[lv]))])),
          B.set("상태", "전투"),
        ]),
      ];
    } },
  ];
  return { scene: "증강 슈팅", variables, lists: LISTS, messages, objects };
}

// ---- 그림 목록 (이름 → SVG) ----
function artList() {
  const list = {
    player: ART.player(), basic: ART.basic(), charger: ART.charger(), sine: ART.sine(), boss: ART.boss(),
    bullet: ART.bullet(), sideBullet: ART.sideBullet(), enemyBullet: ART.enemyBullet(), slowRing: ART.slowRing(), background: ART.background(),
    hudPanel: ART.hudPanel(), dim: ART.dim(), bannerStrip: ART.bannerStrip(), menuTitle: ART.menuTitle(),
    wordMaxHp: ART.word("최대 체력 +20", C.green, 200),
    btnStart: ART.button("게임 시작", "yellow", 300, 84, 40),
    btnHelp: ART.button("조작법", "blue", 200, 64, 28), btnBook: ART.button("카드 도감", "purple", 200, 64, 28),
    btnRetry: ART.button("다시 하기 (R)", "green", 220, 64, 26), btnMenu: ART.button("메뉴로 (M)", "brown", 220, 64, 26),
    btnResume: ART.button("계속하기 (P)", "yellow", 220, 64, 26), btnClose: ART.button("닫기 (Esc)", "brown", 200, 56, 24),
    panelOver: ART.panel("게임 오버", "red", [], 560, 360), panelClear: ART.panel("클리어!", "green", [], 560, 360),
    panelPause: ART.panel("일시정지", "purple", [["P · Esc 로 계속", C.outline, 26, 150]], 520, 300),
    panelHelp: ART.panel("조작법", "blue", [
      ["방향키 · WASD : 이동", C.outline, 25, 120], ["총은 가장 가까운 적에게 자동 발사!", C.outline, 25, 160],
      ["웨이브를 깨면 카드 3장 중 하나 (클릭 · 1 2 3)", C.outline, 23, 200], ["P · Esc : 일시정지", C.outline, 25, 240],
      ["5 · 10웨이브는 보스! 10웨이브를 깨면 클리어", C.outline, 23, 280]], 600, 400),
    panelCollection: ART.panel("카드 도감", "purple", [], 900, 520),
  };
  for (let i = 0; i <= 20; i++) {
    list["hp" + i] = ART.hpBar(i, false); list["hpRed" + i] = ART.hpBar(i, true);
    list["ebar" + i] = ART.enemyBar(i); list["boss" + i] = ART.bossBar(i);
  }
  POPUP_COLORS.forEach(([, color], ci) => GLYPHS.forEach((g, gi) => { list["glyph" + ci + "_" + gi] = ART.glyph(g === "-" ? "−" : g, color); }));
  for (let rows = 1; rows <= 6; rows++) list["augPanel" + rows] = ART.augPanel(rows);
  AUG_VARS.forEach((name, k) => { for (let lv = 1; lv <= MAX[name]; lv++) list["aug" + k + "_" + lv] = ART.augRow(CARDS[k].color, CARDS[k].name, lv); });
  CARDS.forEach((c, i) => { list["card" + i] = ART.card(c); });
  return list;
}

// ---- 만들기: 그림 → PNG, 설계 → project.json, 묶어서 .ent ----
async function build(outFile, extractDir) {
  const svgs = artList();
  const keys = Object.keys(svgs);
  const items = keys.map((k) => { const m = svgs[k].match(/width="(\d+)" height="(\d+)"/); return { svg: svgs[k], width: +m[1], height: +m[2] }; });
  const pngs = await svgToPng(items);
  const png = { size: {} };
  keys.forEach((k, i) => { png[k] = pngs[i]; png.size[k] = [items[i].width, items[i].height]; });

  const { project, files } = assemble(design(png));
  files.push({ path: "temp/project.json", data: Buffer.from(JSON.stringify(project)) });
  // tar 묶기 (엔트리 오프라인과 같은 tar.gz). 외부 프로그램 없이 직접 만든다
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zlib.gzipSync(tarPack(files), { level: 6 }));
  if (extractDir) {
    fs.rmSync(path.join(extractDir, "temp"), { recursive: true, force: true });
    for (const f of files) { const p = path.join(extractDir, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
  }
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
  build(out, process.argv[2]).then(({ project, files }) => {
    let blocks = 0;
    const count = (b) => { if (!b || typeof b !== "object") return; if (b.type) blocks++; (b.params || []).forEach(count); (b.statements || []).forEach((l) => l.forEach(count)); };
    for (const o of project.objects) JSON.parse(o.script).forEach((s) => s.forEach(count));
    console.log("만들었습니다: " + out + " (오브젝트 " + project.objects.length + "개, 블록 " + blocks + "개, 그림 " + (files.length - 1) / 2 + "개, " + Math.round(fs.statSync(out).size / 1024) + "KB)");
  });
}
