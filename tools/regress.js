// =============================================================
// tools/regress.js : 회귀 검사 장치
// -------------------------------------------------------------
// "코드를 고쳤는데 예전 동작이 몰래 바뀌지 않았나?"를 자동으로 확인한다.
//
// 원리
//   1) Math.random 을 "항상 같은 순서로 같은 값이 나오는" 가짜로 바꾼다 (고정 시드)
//   2) 게임 루프를 멈추고, 1/60초씩 update() 를 직접 불러 정해진 입력으로 플레이한다
//   3) 플레이어·적·총알·점수와 화면 그림의 지문(해시)을 줄줄이 기록한다
//   4) 저장해 둔 기록(tools/golden/*.txt)과 한 글자라도 다르면 "다름"으로 알려 준다
//
// 검사 항목
//   [옛 설정] 기본 적만 나오는 3웨이브 + 기존 증강 3개 → golden/old-config.txt 와 같아야 한다
//   [새 설정] 지금의 waves.js 그대로                    → golden/new-config.txt 와 같아야 한다
//   [동작 검사] 훅, 디버그 모드, 새 적 행동 등을 하나씩 확인 (PASS / FAIL)
//
// 사용법 (프로젝트 폴더에서, Playwright 가 설치된 환경)
//   NODE_PATH=$(npm root -g) node tools/regress.js                검사만
//   NODE_PATH=$(npm root -g) node tools/regress.js --record-new   새 설정 기록을 다시 만든다
//      (웨이브·적 구성을 일부러 바꿨을 때만 사용)
//   NODE_PATH=$(npm root -g) node tools/regress.js --record-old 폴더
//      (처음 한 번: 예전 버전 코드가 있는 폴더에서 옛 설정 기록을 만든다)
// =============================================================

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GOLDEN = path.join(__dirname, "golden");

// ---- 브라우저 안에서 돌릴 공통 준비 코드 ----
function initScript() {
  let seed = 12345;
  // 고정 시드 난수 (선형 합동 생성기)
  Math.random = function () {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  window.__reseed = (s) => { seed = s; };
  window.requestAnimationFrame = () => 0; // 게임 루프는 검사기가 직접 돌린다
}

// ---- 브라우저 안에서 돌릴 시나리오 실행기 ----
// config: "old" 이면 옛 설정으로 바꾼 뒤 실행
function scenarioRunner(config) {
  const DT = 1 / 60;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }

  if (config === "legacy") {
    // "옛 규칙" 되돌리기: 새로 바뀐 규칙만 예전 방식으로 바꿔 끼운다.
    // 이 상태에서 기록이 golden/old-config-legacy.txt 와 같으면
    // → 새 규칙 말고는 아무것도 바뀌지 않았다는 증거가 된다.
    if (typeof waveScaledStats === "function") {
      // A 이전: 속도는 웨이브마다 +20, 체력·접촉 대미지는 웨이브와 상관없이 그대로
      window.waveScaledStats = function (type, w) {
        return { speed: type.speed + (w - 1) * 20, hp: type.hp, contactDamage: type.contactDamage };
      };
    }
    if (typeof waveClearHeal === "function") {
      window.waveClearHeal = function () { return 0; }; // B 이전: 웨이브를 깨도 회복 없음
    }
    config = "old";
  }

  if (config === "old") {
    // 옛 설정: 기본 적만 나오는 3웨이브 (mix 없음)
    WAVES.splice(0, WAVES.length,
      [{ type: "basic", count: 6 }],
      [{ type: "basic", count: 10 }],
      [{ type: "basic", count: 15 }]);
    // 옛 설정: 증강은 처음 3개만, 레벨은 2단계까지 (새 증강·Lv.3 이 추가돼도 옛 기록이 그대로 비교되도록)
    const keep = ["compound", "variance", "timeDilation"];
    for (let i = AUGMENTS.length - 1; i >= 0; i--) {
      if (!keep.includes(AUGMENTS[i].id)) AUGMENTS.splice(i, 1);
      else AUGMENTS[i].levels = AUGMENTS[i].levels.slice(0, 2);
    }
    // 옛 설정: 보급 카드 없음
    if (typeof SUPPLIES !== "undefined") SUPPLIES.splice(0, SUPPLIES.length);
  }

  function snap() {
    return {
      st: gameState, w: wave, sc: score, hp: player.hp,
      p: [r3(player.x), r3(player.y), r3(player.vx), r3(player.vy), r3(player.facing)],
      e: enemies.map((e) => [r3(e.x), r3(e.y), r3(e.hp), r3(e.speed)]),
      b: bullets.map((b) => [r3(b.x), r3(b.y)]),
      pop: popups.map((q) => q.value), par: particles.length,
      own: JSON.stringify(ownedAugments), ch: choices.map((c) => c.id), best: bestScore,
    };
  }
  const keyPatterns = [["KeyD"], ["KeyS"], ["KeyA", "KeyS"], ["KeyW"], [], ["KeyD", "KeyW"], ["KeyA"], ["ArrowDown"], []];
  function setKeys(list) { for (const k in keys) keys[k] = false; for (const k of list) keys[k] = true; }

  const log = [];
  function runScenario(name, seedValue, setup, frames) {
    __reseed(seedValue);
    goToMenu();
    for (let i = 0; i < 20; i++) update(DT);
    draw();
    log.push(name + " menuDraw " + hash(canvas.toDataURL()));
    runMenuAction(0);
    setup();
    let choosingFrames = 0;
    for (let f = 0; f < frames; f++) {
      setKeys(keyPatterns[Math.floor(f / 75) % keyPatterns.length]);
      if (gameState === "choosing") {
        choosingFrames++;
        if (choosingFrames === 40) chooseAugment(f % choices.length);
      } else choosingFrames = 0;
      if (gameState === "gameover" || gameState === "clear") {
        draw();
        log.push(name + " f" + f + " END " + JSON.stringify(snap()) + " draw " + hash(canvas.toDataURL()));
        break;
      }
      update(DT);
      if (f % 20 === 0) log.push(name + " f" + f + " " + JSON.stringify(snap()));
      if (f % 150 === 0) { draw(); log.push(name + " f" + f + " draw " + hash(canvas.toDataURL())); }
    }
  }

  if (config === "old") {
    runScenario("A", 777, () => {}, 9000);
    runScenario("B", 4242, () => { ownedAugments = { compound: 2, variance: 2, timeDilation: 2 }; }, 9000);
    runScenario("C", 99, () => { ownedAugments = { compound: 1, timeDilation: 1 }; player.hp = 100000; }, 12000);
    // 카드 후보 검사 (최대 레벨 증강은 빠져야 한다)
    __reseed(5);
    const pick = [];
    for (const own of [{}, { compound: 2 }, { compound: 2, variance: 2 }, { compound: 2, variance: 2, timeDilation: 2 }, { compound: 1, variance: 2 }]) {
      ownedAugments = own;
      for (let t = 0; t < 30; t++) pick.push(JSON.stringify(own) + "=>" + pickChoices().map((a) => a.id).sort().join(","));
    }
    log.push("D " + [...new Set(pick)].join(" | "));
  } else {
    // 새 설정: 지금의 waves.js 그대로
    runScenario("N1", 2024, () => {}, 12000);
    runScenario("N2", 31, () => { ownedAugments = { compound: 1, timeDilation: 1 }; player.hp = 1000000; }, 30000);
  }
  return log;
}

// ---- 동작 검사 목록 ----
// 각 검사는 브라우저 안에서 돌아가는 함수. { ok: true/false, detail: "설명" } 을 돌려준다.
const CHECKS = require("./checks.js");

async function openGame(browser, gameDir) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(initScript);
  await page.goto("file://" + path.join(gameDir, "index.html"));
  await page.evaluate(async () => {
    try { await document.fonts.load("20px Jua"); await document.fonts.load('20px "Black Han Sans"'); } catch (e) {}
    await document.fonts.ready;
  });
  return { page, errors };
}

async function trace(browser, gameDir, config) {
  const { page, errors } = await openGame(browser, gameDir);
  const log = await page.evaluate(scenarioRunner, config);
  await page.close();
  if (errors.length) log.push("PAGE ERRORS " + JSON.stringify(errors));
  return log.join("\n") + "\n";
}

function compare(label, actual, file) {
  if (!fs.existsSync(file)) {
    console.log("  ? " + label + ": 기록 파일이 없음 (" + path.relative(ROOT, file) + ")");
    return true;
  }
  const expected = fs.readFileSync(file, "utf8");
  if (actual === expected) {
    console.log("  PASS " + label + ": 기록과 완전히 같음 (" + actual.split("\n").length + "줄)");
    return true;
  }
  const a = actual.split("\n"), e = expected.split("\n");
  let i = 0;
  while (i < a.length && a[i] === e[i]) i++;
  console.log("  FAIL " + label + ": " + (i + 1) + "번째 줄부터 다름");
  console.log("     기록: " + (e[i] || "(없음)").slice(0, 200));
  console.log("     지금: " + (a[i] || "(없음)").slice(0, 200));
  return false;
}

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch();
  let allOk = true;

  if (args[0] === "--record-old") {
    const dir = path.resolve(args[1]);
    fs.writeFileSync(path.join(GOLDEN, "old-config.txt"), await trace(browser, dir, "old"));
    console.log("옛 설정 기록을 만들었습니다: " + dir);
    await browser.close();
    return;
  }
  if (args[0] === "--record-old-current") {
    // 옛 설정 기록을 "지금 규칙"으로 다시 만든다 (규칙을 일부러 바꿨을 때만)
    fs.writeFileSync(path.join(GOLDEN, "old-config.txt"), await trace(browser, ROOT, "old"));
    console.log("옛 설정 기록을 지금 규칙으로 다시 만들었습니다.");
  }
  if (args[0] === "--record-new" || args[0] === "--record-old-current") {
    fs.writeFileSync(path.join(GOLDEN, "new-config.txt"), await trace(browser, ROOT, "new"));
    console.log("새 설정 기록을 다시 만들었습니다.");
  }

  console.log("[기록 비교]");
  allOk = compare("옛 설정 (기본 적 3웨이브 + 증강 3개)", await trace(browser, ROOT, "old"), path.join(GOLDEN, "old-config.txt")) && allOk;
  allOk = compare("새 설정 (지금 waves.js)", await trace(browser, ROOT, "new"), path.join(GOLDEN, "new-config.txt")) && allOk;
  // 옛 규칙 되돌리기 검사: 화면 그림(draw)은 HUD 글자 등이 바뀔 수 있으니 빼고, 상태 기록만 비교
  const stateOnly = (text) => text.split("\n").filter((l) => !/ draw /.test(l) && !/ menuDraw /.test(l)).map((l) => l.replace(/ draw [0-9a-f]+$/, "")).join("\n");
  const legacyFile = path.join(GOLDEN, "old-config-legacy.txt");
  if (fs.existsSync(legacyFile)) {
    const now = stateOnly(await trace(browser, ROOT, "legacy"));
    const want = stateOnly(fs.readFileSync(legacyFile, "utf8"));
    if (now === want) console.log("  PASS 옛 규칙 되돌리기: 새 규칙(웨이브 스케일링·회복)만 예전으로 바꾸면 이전 기록과 완전히 같음");
    else { allOk = false; compare("옛 규칙 되돌리기", now, legacyFile + ".state"); }
  }

  console.log("[동작 검사]");
  for (const check of CHECKS) {
    const { page, errors } = await openGame(browser, ROOT);
    let result;
    try {
      result = await page.evaluate(check.run);
    } catch (e) {
      result = { ok: false, detail: "검사 중 오류: " + e.message };
    }
    if (errors.length) result = { ok: false, detail: "페이지 오류: " + errors.join(" / ") };
    console.log("  " + (result.ok ? "PASS " : "FAIL ") + check.name + (result.detail ? " — " + result.detail : ""));
    allOk = allOk && result.ok;
    await page.close();
  }

  await browser.close();
  console.log(allOk ? "\n결과: 모두 통과" : "\n결과: 실패한 항목이 있습니다");
  process.exit(allOk ? 0 : 1);
})();
