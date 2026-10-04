// =============================================================
// tools/checks.js : 동작 검사 목록 (tools/regress.js 가 하나씩 실행한다)
// -------------------------------------------------------------
// 각 검사의 run 함수는 "게임 페이지 안에서" 실행된다.
// 그래서 game.js 의 변수와 함수(update, enemies, player ...)를 바로 쓸 수 있다.
// 게임 루프는 멈춰 있으므로 update(1 / 60) 을 직접 불러 시간을 흘린다.
// 결과는 { ok: 통과했는지, detail: 짧은 설명 } 으로 돌려준다.
// =============================================================

// 키를 누른 것처럼 이벤트를 보내는 도우미 (페이지 안에서 쓰려고 문자열로 넣는다)
const PRESS = "function press(code, shift) {" +
  " window.dispatchEvent(new KeyboardEvent('keydown', { code: code, shiftKey: !!shift }));" +
  " window.dispatchEvent(new KeyboardEvent('keyup', { code: code, shiftKey: !!shift })); }";

module.exports = [
  {
    name: "최대 레벨 증강은 카드 후보에서 빠진다 (빈자리는 보급 카드)",
    run: function () {
      const maxed = {};
      for (const aug of AUGMENTS) maxed[aug.id] = aug.levels.length;
      ownedAugments = Object.assign({}, maxed);
      const all = pickChoices();
      const onlySupplies = all.length > 0 && all.every((c) => c.isSupply);
      const first = AUGMENTS[0];
      ownedAugments = {}; ownedAugments[first.id] = first.levels.length;
      let leaked = false;
      for (let i = 0; i < 50; i++) if (pickChoices().some((a) => a.id === first.id)) leaked = true;
      return { ok: onlySupplies && !leaked, detail: "전부 최대 → " + all.map((c) => c.name).join(",") + " / 최대 레벨 증강 섞임: " + leaked };
    },
  },
  // ---------------- A. 준비 작업 ----------------
  {
    name: "[A] onHit 훅: 대미지 적용 직후, info 에 enemy·bullet·damage·killed",
    run: function () {
      const calls = [];
      let dmgInfoHasBullet = false;
      AUGMENTS.push({ id: "t", name: "t", levels: [{}],
        modifyDamage: function (d, s, info) { if (info.bullet) dmgInfoHasBullet = true; return d; },
        onHit: function (s, info) { calls.push({ hpAfter: info.enemy.hp, dmg: info.damage, killed: info.killed, hasBullet: !!info.bullet, dead: info.enemy.dead }); } });
      runMenuAction(0); spawnQueue = []; ownedAugments = { t: 1 };
      enemies.push(createEnemy("basic", player.x + 120, player.y, 1));
      enemies[0].speed = 0;
      for (let f = 0; f < 600 && enemies.length; f++) update(1 / 60);
      const last = calls[calls.length - 1];
      const ok = calls.length === 6 && calls.slice(0, 5).every((c) => !c.killed && c.dmg === 10) &&
        last.killed && last.hpAfter <= 0 && !last.dead && calls.every((c) => c.hasBullet) && dmgInfoHasBullet;
      return { ok: ok, detail: "호출 " + calls.length + "회, 마지막 killed=" + (last && last.killed) + ", 죽는 처리 전 호출=" + (last && !last.dead) };
    },
  },
  {
    name: "[A] createBullet 옵션: damageScale, fromAugment, generation",
    run: function () {
      let fires = 0;
      AUGMENTS.push({ id: "t", name: "t", levels: [{}],
        onFire: function (s, info) {
          fires++;
          createBullet(info.dirY, -info.dirX, { damageScale: 0.6, fromAugment: true, generation: 1 });
          createBullet(-info.dirY, info.dirX); // fromAugment 를 깜빡해도 무한 반복되면 안 된다
        } });
      runMenuAction(0); spawnQueue = []; ownedAugments = { t: 1 };
      const b = createBullet(1, 0, {});
      const extra = bullets.filter((x) => x !== b);
      const opts = extra[0].damageScale === 0.6 && extra[0].fromAugment && extra[0].generation === 1;
      const def = b.damageScale === 1 && !b.fromAugment && b.generation === 0;
      // 대미지 배율 적용 확인
      ownedAugments = {};
      const e = createEnemy("basic", 0, 0, 1);
      const dmg = calcDamage(e, { damageScale: 0.6 });
      return { ok: fires === 1 && bullets.length === 3 && opts && def && Math.abs(dmg - 6) < 1e-9,
        detail: "onFire " + fires + "회, 총알 " + bullets.length + "개, 0.6배 대미지=" + dmg };
    },
  },
  {
    name: "[A] 디버그 모드: 꺼져 있으면 영향 없음, 켜면 [ ] Shift+숫자 I 동작",
    run: new Function(PRESS + `
      runMenuAction(0);
      const hash = () => { draw(); return canvas.toDataURL(); };
      // 1) 꺼진 상태: 키를 눌러도 아무 변화 없음
      const before = JSON.stringify([wave, ownedAugments, hash()]);
      press("BracketRight"); press("Digit1", true); press("KeyI");
      const offSame = JSON.stringify([wave, ownedAugments, hash()]) === before && !debugInvincible;
      // 2) 켠 상태
      press("F2");
      press("BracketRight"); const w2 = wave;
      for (let i = 0; i < WAVES.length + 3; i++) press("BracketRight"); // 끝까지 누르면 마지막 웨이브에서 멈춘다
      const wMax = wave;
      press("BracketLeft"); const wBack = wave;
      press("Digit1", true); const l1 = getAugmentLevel(AUGMENTS[0].id);
      press("Digit1", true); press("Digit1", true); const l2 = getAugmentLevel(AUGMENTS[0].id);
      press("KeyI");
      enemies = [createEnemy("basic", player.x, player.y, 1)]; spawnQueue = [];
      const hp0 = player.hp; update(1 / 60); const invOk = player.hp === hp0;
      // 3) 다시 끄면 무적도 효과 없음
      press("F2"); player.invincibleTimer = 0; update(1 / 60); const offHurt = player.hp < hp0;
      const ok = offSame && w2 === 2 && wMax === WAVES.length && wBack === WAVES.length - 1 &&
        l1 === 1 && l2 === AUGMENTS[0].levels.length && invOk && offHurt;
      return { ok: ok, detail: "꺼짐 무변화=" + offSame + ", 웨이브 " + w2 + "/" + wMax + "/" + wBack +
        ", 증강 Lv" + l1 + "→" + l2 + ", 무적=" + invOk + ", 끈 뒤 피격=" + offHurt };
    `),
  },
  // ---------------- B. 새 적 3종 ----------------
  {
    name: "[B] 돌격형: 접근→예고 0.6→돌진 0.5→쉬기 1.0, 예고 시작 때 방향 고정, 돌진 3배 속도",
    run: function () {
      runMenuAction(0); spawnQueue = []; bannerTimer = 0;
      player.x = 100; player.y = 270;
      const e = createEnemy("charger", 900, 270, 1); enemies = [e];
      const DT = 1 / 60;
      const log = []; let last = e.state, t = 0, dashStart = null, dirAtDash = null, dashSpeed = 0;
      for (let f = 0; f < 60 * 8; f++) {
        const px = e.x, py = e.y;
        player.fireTimer = 1e9; // 이 검사에서는 플레이어가 쏘지 않는다 (돌격형이 죽지 않게)
        update(DT); t += DT;
        if (e.state !== last) { log.push(e.state + "@" + t.toFixed(2)); last = e.state;
        }
        if (e.state === "dash" && e.stateTime > DT * 1.5) dashSpeed = distance(px, py, e.x, e.y) / DT;
        if (e.state === "warn" && e.stateTime <= DT * 1.5) dirAtDash = [e.dirX, e.dirY]; // 예고 시작 때 방향
        if ((e.state === "warn" || e.state === "dash") && dirAtDash && (e.dirX !== dirAtDash[0] || e.dirY !== dirAtDash[1])) return { ok: false, detail: "예고·돌진 중 방향이 바뀜" };
        player.y = 270 + Math.sin(t * 3) * 120; // 플레이어가 위아래로 움직여도 돌진 방향은 고정
      }
      // 상태가 바뀐 시각 사이 간격
      const times = log.map((x) => Number(x.split("@")[1]));
      const gaps = []; for (let i = 1; i < times.length; i++) gaps.push(+(times[i] - times[i - 1]).toFixed(2));
      const seq = log.map((x) => x.split("@")[0]).slice(0, 5).join(">");
      const ok = seq === "warn>dash>rest>approach>warn" && Math.abs(gaps[0] - 0.6) < 0.03 &&
        Math.abs(gaps[1] - 0.5) < 0.03 && Math.abs(gaps[2] - 1.0) < 0.03 && Math.abs(dashSpeed - 210) < 1;
      return { ok: ok, detail: seq + " / 간격 " + gaps.slice(0, 3).join(", ") + "초 / 돌진 속도 " + dashSpeed.toFixed(1) + " (평소 70의 3배)" };
    },
  },
  {
    name: "[B] 돌격형: 시간 지연 배율 0.5 를 받으면 예고·돌진·쉬기 시간이 모두 2배",
    run: function () {
      AUGMENTS.push({ id: "slow", name: "s", levels: [{}], modifyEnemySpeed: function (f) { return f * 0.5; } });
      runMenuAction(0); spawnQueue = []; ownedAugments = { slow: 1 };
      player.x = 100; player.y = 270;
      const e = createEnemy("charger", 260, 270, 1); enemies = [e]; // 가까워서 바로 예고 시작
      const DT = 1 / 60; let last = e.state, t = 0; const times = [];
      for (let f = 0; f < 60 * 8; f++) {
        player.fireTimer = 1e9; player.invincibleTimer = 1e9;
        update(DT); t += DT; if (e.state !== last) { times.push(t); last = e.state; }
      }
      const gaps = []; for (let i = 1; i < times.length; i++) gaps.push(+(times[i] - times[i - 1]).toFixed(2));
      const ok = Math.abs(gaps[0] - 1.2) < 0.04 && Math.abs(gaps[1] - 1.0) < 0.04 && Math.abs(gaps[2] - 2.0) < 0.04;
      return { ok: ok, detail: "예고 " + gaps[0] + "초, 돌진 " + gaps[1] + "초, 쉬기 " + gaps[2] + "초" };
    },
  },
  {
    name: "[B] 사인파형: 옆 흔들림 폭 2A = 80px, 주기 2π/ω ≈ 2.51초, 위상은 적마다 다름",
    run: function () {
      runMenuAction(0); spawnQueue = [];
      player.x = 480; player.y = 1e6; // 아주 아래쪽 → 진행 방향은 아래, 옆 방향은 x
      const e = createEnemy("sine", 480, 100, 1); e.speed = 0; enemies = [e]; // 앞으로는 안 가고 흔들림만
      const DT = 1 / 600; let minX = 1e9, maxX = -1e9; const peaks = []; let prev = e.x, prevV = 0;
      for (let f = 0; f < 600 * 6; f++) {
        enemyType(e).update(e, DT, { speed: 0, timeScale: 1, localDt: DT });
        minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x);
        const v = e.x - prev; if (prevV > 0 && v <= 0) peaks.push(f * DT); prev = e.x; prevV = v;
      }
      const period = peaks.length > 1 ? peaks[1] - peaks[0] : 0;
      const phases = new Set(); for (let i = 0; i < 5; i++) phases.add(createEnemy("sine", 0, 0, 1).phase.toFixed(3));
      // 시간 배율 0.5 → 폭은 그대로, 주기는 2배
      const e2 = createEnemy("sine", 480, 100, 1); let p2 = []; prev = e2.x; prevV = 0;
      for (let f = 0; f < 600 * 12; f++) {
        enemyType(e2).update(e2, DT, { speed: 0, timeScale: 0.5, localDt: DT * 0.5 });
        const v = e2.x - prev; if (prevV > 0 && v <= 0) p2.push(f * DT); prev = e2.x; prevV = v;
      }
      const period2 = p2[1] - p2[0];
      const ok = Math.abs(maxX - minX - 80) < 0.5 && Math.abs(period - 2 * Math.PI / 2.5) < 0.01 &&
        phases.size === 5 && Math.abs(period2 - 2 * period) < 0.02;
      return { ok: ok, detail: "폭 " + (maxX - minX).toFixed(2) + "px, 주기 " + period.toFixed(3) + "초, 느려졌을 때 주기 " + period2.toFixed(3) + "초" };
    },
  },
  {
    name: "[B] 분열형: 2→4마리로 갈라지고 손자는 안 갈라짐, 모두 죽어야 웨이브 끝, 점수 150/60/30",
    run: function () {
      runMenuAction(0);
      WAVES.splice(0, WAVES.length, [{ type: "splitter", count: 1 }], [{ type: "basic", count: 1 }]);
      startWave(1); spawnQueue = [];
      enemies = [createEnemy("splitter", 480, 270, 1)];
      const kill = (e) => { e.hp = 0.0001; bullets = [{ x: e.x, y: e.y, vx: 0, vy: 0, age: 0, damageScale: 1, dead: false }]; updateBullets(0); };
      const s0 = score;
      kill(enemies[0]);
      const gen1 = enemies.map((e) => e.type + "@" + e.x).join(",");
      const scoreA = score - s0;
      kill(enemies[0]);
      const gen2 = enemies.map((e) => e.type).sort().join(",");
      const scoreB = score - s0 - scoreA;
      checkWaveEnd(); const stillPlaying = gameState === "playing";
      const gc = enemies.find((e) => e.type === "splitterGrandchild");
      kill(gc);
      const scoreC = score - s0 - scoreA - scoreB;
      const noSplit = enemies.filter((e) => e.type === "splitterGrandchild").length === 1;
      while (enemies.length) kill(enemies[0]); // 갈라져 나온 적까지 전부
      checkWaveEnd();
      const ok = gen1 === "splitterChild@460,splitterChild@500" &&
        gen2 === "splitterChild,splitterGrandchild,splitterGrandchild" && stillPlaying && noSplit &&
        scoreA === 150 && scoreB === 60 && scoreC === 30 && gameState === "choosing";
      return { ok: ok, detail: "1세대 " + gen1 + " / 점수 " + scoreA + "," + scoreB + "," + scoreC + " / 남은 적 있을 때 계속=" + stillPlaying + " / 다 죽으면 " + gameState };
    },
  },
  // ---------------- 웨이브 구성 (30웨이브) ----------------
  {
    name: "[30D] 30웨이브 구성이 표와 같음, 1웨이브만 순서대로, 5웨이브마다 보스",
    run: function () {
      runMenuAction(0);
      const want = ["B5", "B4 C2", "S4 B3", "P2 C2 B2", "[돌진 대장] B4", "B4 S3 C2", "C4 P2", "S5 P2", "B4 C3 S3", "[분열의 왕] S4",
        "B5 C3 P2", "S6 C3", "P4 B4", "C5 S4 P2", "[돌진 대장] C2 S4", "B6 S4 P2", "C6 P3", "S7 B4", "P4 C4 S3", "[분열의 왕] C4 S4",
        "B6 C4 S4", "P5 S5", "C7 B5", "P4 C4 S4 B2", "[돌진 대장] P2 C4", "S8 P4", "C6 P4 B4", "B6 S6 C2", "P5 C5 S4", "[돌진 대장 & 분열의 왕]"];
      const abbr = { basic: "B", charger: "C", sine: "S", splitter: "P" };
      const got = WAVES.map((w) => {
        const bosses = waveBosses(w).map((id) => ENEMY_TYPES[id].name);
        const g = waveGroups(w).map((x) => abbr[x.type] + x.count).join(" ");
        return (bosses.length ? "[" + bosses.join(" & ") + "]" + (g ? " " : "") : "") + g;
      });
      const mixOk = WAVES.every((w, i) => waveIsMixed(w) === (i !== 0));
      const counts = WAVES.map((w) => waveGroups(w).reduce((a, g) => a + g.count, 0));
      const normalOk = counts.every((n, i) => (i + 1) % 5 === 0 || (n >= 5 && n <= 14));
      const bossOk = WAVES.every((w, i) => (waveBosses(w).length > 0) === ((i + 1) % 5 === 0));
      const bad = got.map((g, i) => g === want[i] ? null : (i + 1) + ":" + g).filter(Boolean);
      return { ok: WAVES.length === 30 && bad.length === 0 && mixOk && normalOk && bossOk,
        detail: "웨이브 " + WAVES.length + "개, 다른 칸 " + (bad.join(" ") || "없음") + ", mix " + mixOk + ", 보통 웨이브 5~14마리 " + normalOk + ", 5의 배수만 보스 " + bossOk };
    },
  },
  {
    name: "[30D] 안내 띠: 2·3·4웨이브 새 적, 5·10웨이브 보스(빨강), 30웨이브 최종 보스",
    run: function () {
      runMenuAction(0);
      const t = {};
      for (const n of [1, 2, 3, 4, 5, 6, 10, 30]) { startWave(n); t[n] = bannerText + (bannerIsBoss ? " (빨강)" : ""); }
      const ok = t[1] === "웨이브 1" && t[2] === "웨이브 2 · 새 적: 돌격형!" && t[3] === "웨이브 3 · 새 적: 사인파형!" &&
        t[4] === "웨이브 4 · 새 적: 분열형!" && t[5] === "웨이브 5 · 보스: 돌진 대장! (빨강)" && t[6] === "웨이브 6" &&
        t[10] === "웨이브 10 · 보스: 분열의 왕! (빨강)" && t[30] === "웨이브 30 · 최종 보스: 돌진 대장 & 분열의 왕! (빨강)";
      return { ok: ok, detail: Object.keys(t).map((k) => t[k]).join(" / ") };
    },
  },
  {
    name: "[30D] 무적으로 1 → 30웨이브 자동 진행 후 클리어, 보스 7마리 처치, 결과 화면",
    run: function () {
      runMenuAction(0); debugMode = true; debugInvincible = true;
      const DT = 1 / 60; const seen = []; let f = 0; const waveTime = {}; let t = 0;
      for (; f < 60 * 60 * 40 && gameState !== "clear"; f++) {
        if (gameState === "choosing") { choosingTime = 1; chooseAugment(0); }
        if (seen[seen.length - 1] !== wave) seen.push(wave);
        waveTime[wave] = (waveTime[wave] || 0) + DT;
        player.x = 480 + Math.cos(f / 60) * 300; player.y = 270 + Math.sin(f / 45) * 200;
        update(DT); t += DT;
      }
      let order = true; for (let i = 0; i < seen.length; i++) if (seen[i] !== i + 1) order = false;
      draw(); // 결과 화면 그리기에서 오류가 나지 않는지
      const bossTimes = [5, 10, 15, 20, 25, 30].map((w) => w + ":" + Math.round(waveTime[w]) + "초").join(" ");
      return { ok: gameState === "clear" && seen.length === 30 && order && bossesKilled === 7,
        detail: "지나간 웨이브 " + seen.length + "개 (순서대로=" + order + ") → " + gameState + ", 보스 " + bossesKilled + "마리, 게임 시간 " + (t / 60).toFixed(1) + "분 / 보스 웨이브 " + bossTimes };
    },
  },
  // ---------------- 새 증강 ----------------
  {
    name: "[증강] 등차 탄환: k = 0~9 반복, 대미지 = 10 + d·k, 복리보다 먼저 계산",
    run: function () {
      runMenuAction(0); spawnQueue = []; ownedAugments = { arithmetic: 1 };
      const aug = AUGMENTS.find((a) => a.id === "arithmetic");
      const ks = []; const dmg = [];
      for (let i = 0; i < 12; i++) {
        const b = createBullet(1, 0); ks.push(b.arithK);
        dmg.push(calcDamage({}, b)); // 매번 다른 적 → 복리 n = 0
      }
      ownedAugments = { arithmetic: 2, compound: 1 };
      lastHitEnemy = null; aug.reset();
      const e = {}; const b0 = createBullet(1, 0); const b1 = createBullet(1, 0); const b2 = createBullet(1, 0);
      calcDamage(e, b0); calcDamage(e, b1); const both = calcDamage(e, b2); // k=2, n=2 → (10+6)×1.15²
      const ok = ks.join(",") === "0,1,2,3,4,5,6,7,8,9,0,1" && dmg[9] === 28 && dmg[10] === 10 &&
        Math.abs(both - 16 * 1.15 * 1.15) < 1e-9;
      return { ok: ok, detail: "k=" + ks.join(",") + " / k=9 대미지 " + dmg[9] + " / 등차+복리 " + both.toFixed(3) };
    },
  },
  {
    name: "[증강] 제곱 증폭: N번째 명중마다 D²/10 (상한 5배), 다른 증강보다 나중에 계산",
    run: function () {
      runMenuAction(0); ownedAugments = { square: 1 };
      const seq = []; for (let i = 0; i < 6; i++) seq.push(calcDamage({}, { damageScale: 1 }));
      // 등차(+d·k)가 먼저 적용된 뒤 제곱: k=9, d=2 → D=28 → 28 × 2.8 = 78.4
      AUGMENTS.forEach((a) => a.reset && a.reset());
      ownedAugments = { square: 2, arithmetic: 1 };
      calcDamage({}, { damageScale: 1, arithK: 9 });
      const afterArith = calcDamage({}, { damageScale: 1, arithK: 9 });
      // 상한: D=80 → 배율 8 이지만 5배까지만 → 400
      AUGMENTS.forEach((a) => a.reset && a.reset()); ownedAugments = { square: 2 };
      calcDamage({}, { damageScale: 8 }); const capped = calcDamage({}, { damageScale: 8 });
      // D < 10 이면 줄어든다: D = 6 → 3.6
      AUGMENTS.forEach((a) => a.reset && a.reset());
      calcDamage({}, { damageScale: 0.6 }); const small = calcDamage({}, { damageScale: 0.6 });
      const ok = seq.join(",") === "10,10,10,10,10,10" && Math.abs(afterArith - 78.4) < 1e-9 &&
        capped === 400 && Math.abs(small - 3.6) < 1e-9;
      return { ok: ok, detail: "기본 10 은 제곱해도 10 / 등차 후 제곱 " + afterArith.toFixed(1) + " / 상한 " + capped + " / D=6 → " + small.toFixed(1) };
    },
  },
  {
    name: "[증강] 3방향 탄: n발이 360°/n 간격, 모두 damageScale, onFire 는 한 번만",
    run: function () {
      runMenuAction(0); spawnQueue = [];
      let fires = 0;
      AUGMENTS.push({ id: "count", name: "c", levels: [{}], onFire: function () { fires++; } });
      const angles = (list) => list.map((b) => Math.round(Math.atan2(b.vy, b.vx) * 180 / Math.PI)).sort((x, y) => x - y).join(",");
      ownedAugments = { multiShot: 1, count: 1 };
      bullets = []; createBullet(1, 0); const lv1 = angles(bullets); const s1 = bullets.map((b) => b.damageScale).join(",");
      ownedAugments = { multiShot: 2, count: 1, arithmetic: 1 };
      bullets = []; createBullet(0, -1); const lv2 = angles(bullets); const s2 = bullets.map((b) => b.damageScale).join(",");
      const ksSame = new Set(bullets.map((b) => b.arithK)).size === 1;
      const ok = lv1 === "-120,0,120" && s1 === "0.6,0.6,0.6" && lv2 === "-162,-90,-18,54,126" &&
        s2 === "0.5,0.5,0.5,0.5,0.5" && fires === 2 && ksSame;
      return { ok: ok, detail: "Lv1 각도 " + lv1 + " / Lv2 각도 " + lv2 + " / onFire " + fires + "회 / 같은 k=" + ksSame };
    },
  },
  {
    name: "[증강] 핵분열 연쇄: 파편 m개(360°/m), 대미지 = 최대 체력×에너지, 감쇠 60%, 2세대까지, 40개 제한",
    run: function () {
      runMenuAction(0); spawnQueue = []; ownedAugments = { fission: 1 };
      const killWith = (bullet, e) => { const aug = AUGMENTS.find((a) => a.id === "fission");
        aug.onKill(aug.levels[getAugmentLevel("fission") - 1], { enemy: e, x: e.x, y: e.y, bullet: bullet }); };
      const e = createEnemy("basic", 400, 300, 1);
      bullets = []; killWith({ isFragment: false }, e);
      const g1 = bullets.slice();
      const angle = Math.abs(Math.atan2(g1[0].vy, g1[0].vx) - Math.atan2(g1[1].vy, g1[1].vx)) * 180 / Math.PI;
      const dmg1 = g1[0].damageScale * BULLET_DAMAGE;                       // 60 × 0.2 = 12
      bullets = []; killWith(g1[0], e); const g2 = bullets.slice();
      const dmg2 = g2[0].damageScale * BULLET_DAMAGE;                       // 12 → 60 × 0.12 = 7.2
      bullets = []; killWith(g2[0], e); const g3count = bullets.length;     // 2세대가 죽이면 끝
      ownedAugments = { fission: 2 };
      bullets = []; for (let i = 0; i < 30; i++) killWith({}, e);
      const capped = bullets.filter((b) => b.isFragment).length;
      bullets = []; killWith({}, e); const lv2 = bullets.length; const lv2dmg = bullets[0].damageScale * BULLET_DAMAGE;
      // 수명: 0.5초 뒤 사라진다
      bullets = []; killWith({}, createEnemy("basic", 480, 270, 1));
      for (let f = 0; f < 32; f++) updateBullets(1 / 60);
      const goneAfterLife = bullets.length === 0;
      const ok = g1.length === 2 && Math.abs(angle - 180) < 1e-6 && Math.abs(dmg1 - 12) < 1e-9 &&
        g1[0].generation === 1 && g2.length === 2 && g2[0].generation === 2 && Math.abs(dmg2 - 7.2) < 1e-9 &&
        g3count === 0 && capped === 40 && lv2 === 3 && Math.abs(lv2dmg - 15) < 1e-9 && goneAfterLife &&
        g1.every((b) => b.fromAugment);
      return { ok: ok, detail: "1세대 " + g1.length + "개 " + angle.toFixed(0) + "° 간격 " + dmg1 + " / 2세대 " + dmg2.toFixed(1) +
        " / 3세대 " + g3count + "개 / 제한 " + capped + " / Lv2 " + lv2 + "개 " + lv2dmg + " / 수명 후 사라짐=" + goneAfterLife };
    },
  },
  {
    name: "[증강] 촉매: 발사 간격 × 0.8 (Lv.1), × 0.7 (Lv.2), 실제 발사 수도 늘어남",
    run: function () {
      runMenuAction(0);
      ownedAugments = {}; const base = fireInterval();
      ownedAugments = { catalyst: 1 }; const lv1 = fireInterval();
      ownedAugments = { catalyst: 2 }; const lv2 = fireInterval();
      // 10초 동안 쏜 횟수 비교 (멈춰 있는 과녁 하나)
      const shots = (own) => { runMenuAction(0); spawnQueue = []; ownedAugments = own; player.hp = 1e9;
        enemies = [createEnemy("basic", player.x + 150, player.y, 1)]; enemies[0].hp = enemies[0].maxHp = 1e9; enemies[0].speed = 0;
        let n = 0; const orig = createBullet;
        for (let f = 0; f < 600; f++) { const before = bullets.length; update(1 / 60); if (bullets.length > before) n++; }
        return n; };
      const n0 = shots({}), n1 = shots({ catalyst: 1 });
      const ok = Math.abs(base - 0.4) < 1e-12 && Math.abs(lv1 - 0.32) < 1e-12 && Math.abs(lv2 - 0.28) < 1e-12 && n1 > n0;
      return { ok: ok, detail: "간격 " + base + " → " + lv1.toFixed(2) + " → " + lv2.toFixed(2) + " / 10초 발사 " + n0 + "발 → " + n1 + "발" };
    },
  },
  {
    name: "[증강] 넉백: 총알 방향으로 약 v₀/6 px 밀림, knockResist, 돌격형은 돌진 중 안 밀림",
    run: function () {
      runMenuAction(0); spawnQueue = []; player.x = 100; player.y = 100; player.fireTimer = 1e9;
      const slide = (type, level, setup) => {
        ownedAugments = { knockback: level };
        const e = createEnemy(type, 600, 400, 1); e.speed = 0; if (setup) setup(e); enemies = [e];
        const aug = AUGMENTS.find((a) => a.id === "knockback");
        aug.onHit(aug.levels[level - 1], { enemy: e, bullet: { vx: 0, vy: 480 } }); // 아래로 날아가던 총알
        const y0 = e.y, x0 = e.x;
        for (let f = 0; f < 300; f++) { player.fireTimer = 1e9; updateEnemies(1 / 60); }
        return { dy: e.y - y0, dx: e.x - x0 };
      };
      const lv1 = slide("basic", 1), lv2 = slide("basic", 2);
      ENEMY_TYPES.basic.knockResist = 0.5; const half = slide("basic", 1); ENEMY_TYPES.basic.knockResist = 1;
      const dash = slide("charger", 2, (e) => { setEnemyState(e, "dash"); e.dirX = 0; e.dirY = 0; });
      const rest = slide("charger", 2, (e) => { setEnemyState(e, "rest"); e.stateTime = -100; });
      const ok = Math.abs(lv1.dy - 40) < 1.5 && Math.abs(lv2.dy - 60) < 1.5 && Math.abs(half.dy - 20) < 1 &&
        Math.abs(lv1.dx) < 1e-9 && Math.abs(dash.dy) < 1e-9 && Math.abs(rest.dy - 60) < 1.5;
      return { ok: ok, detail: "Lv1 " + lv1.dy.toFixed(1) + "px, Lv2 " + lv2.dy.toFixed(1) + "px, 저항 0.5 → " + half.dy.toFixed(1) +
        "px, 돌진 중 " + dash.dy.toFixed(1) + "px, 쉬는 중 " + rest.dy.toFixed(1) + "px" };
    },
  },
  // ---------------- 카드 / 디버그 ----------------
  {
    name: "[카드] 모든 증강·레벨(과 보급 카드)의 설명·수식·이름이 카드 안에 들어감",
    run: function () {
      const problems = []; const sizes = [];
      const cards = AUGMENTS.map((a) => ({ name: a.name, formula: a.formula, descs: a.levels.map((l) => l.desc) }));
      if (typeof SUPPLIES !== "undefined") SUPPLIES.forEach((s) => cards.push({ name: s.name, formula: s.formula, descs: [s.desc] }));
      for (const card of cards) {
        card.descs.forEach((d, i) => {
          const fit = fitCardDesc(d);
          const lastLine = CARD_DESC_TOP + (fit.lines.length - 1) * fit.lineHeight;
          ctx.font = fit.size + "px " + FONT_FAMILY;
          const widest = Math.max.apply(null, fit.lines.map((l) => ctx.measureText(l).width));
          if (lastLine > CARD_DESC_BOTTOM || widest > CARD_WIDTH - 40) problems.push(card.name + " Lv." + (i + 1));
          if (fit.size < 17) sizes.push(card.name + " Lv." + (i + 1) + "=" + fit.size + "px");
        });
        const fs = fitTextSize(card.formula, 30, CARD_WIDTH - 34); ctx.font = fs + "px " + FONT_FAMILY;
        if (ctx.measureText(card.formula).width > CARD_WIDTH - 34) problems.push(card.name + " 수식");
        const ns = fitTextSize(card.name, 30, CARD_WIDTH - 44); ctx.font = ns + "px " + FONT_FAMILY;
        if (ctx.measureText(card.name).width > CARD_WIDTH - 44) problems.push(card.name + " 이름");
      }
      return { ok: problems.length === 0, detail: problems.length ? "넘침: " + problems.join(", ") : "모두 들어감" + (sizes.length ? " (줄인 글자: " + sizes.join(", ") + ")" : "") };
    },
  },
  {
    name: "[디버그] Shift+1~9 로 증강 9개를 순서대로 지급",
    run: new Function(PRESS + `
      runMenuAction(0);
      press("F2");
      const got = [];
      for (let i = 1; i <= 9; i++) { press("Digit" + i, true); }
      for (const aug of AUGMENTS) got.push(aug.id + ":" + getAugmentLevel(aug.id));
      const ok = AUGMENTS.length === 9 && AUGMENTS.every((a) => getAugmentLevel(a.id) === 1);
      return { ok: ok, detail: got.join(" ") };
    `),
  },
  {
    name: "[Lv.3] 증강 9개 모두 3레벨, Lv.3 수치가 요청대로",
    run: function () {
      const L3 = {}; for (const a of AUGMENTS) L3[a.id] = a.levels[2];
      const allThree = AUGMENTS.every((a) => a.levels.length === 3);
      const ok = allThree && L3.compound.r === 0.25 && L3.variance.maxMult === 3.5 && L3.timeDilation.radius === 160 &&
        L3.arithmetic.d === 4 && L3.square.every === 2 && L3.square.maxMult === 7 &&
        L3.multiShot.n === 6 && L3.multiShot.scale === 0.5 && L3.fission.fragments === 3 && L3.fission.energy === 0.3 &&
        L3.catalyst.reduction === 0.4 && L3.knockback.speed === 480;
      // 분산 Lv.3 평균이 1배인지 (20만 발)
      ownedAugments = { variance: 3 }; let sum = 0, max = 0;
      for (let i = 0; i < 200000; i++) { const d = calcDamage({}, { damageScale: 1 }); sum += d; max = Math.max(max, d); }
      const mean = sum / 200000;
      return { ok: ok && Math.abs(mean - 10) < 0.05 && max <= 35, detail: "3레벨=" + allThree + ", 분산 Lv3 평균 " + mean.toFixed(3) + " 최대 " + max.toFixed(1) };
    },
  },
  // ---------------- 보급 카드 ----------------
  {
    name: "[보급] 빈자리 채우기, 체력 40% 미만이면 보급 1장 보장, 효과와 maxHp",
    run: function () {
      runMenuAction(0);
      // 증강 후보가 1장뿐 → 1장 + 보급 2장
      ownedAugments = {}; for (const a of AUGMENTS) ownedAugments[a.id] = a.levels.length;
      delete ownedAugments.catalyst;
      const one = pickChoices().map((c) => c.isSupply ? "보급" : c.id).sort().join(",");
      // 체력 30/100 → 매번 보급 정확히 1장 / 체력 50 → 보급 0장
      ownedAugments = {}; let lowOk = true, highOk = true;
      player.hp = 30; for (let i = 0; i < 200; i++) { const p = pickChoices(); if (p.length !== 3 || p.filter((c) => c.isSupply).length !== 1) lowOk = false; }
      player.hp = 50; for (let i = 0; i < 200; i++) { if (pickChoices().some((c) => c.isSupply)) highOk = false; }
      // 효과
      const homeo = SUPPLIES.find((s) => s.id === "homeostasis"), cell = SUPPLIES.find((s) => s.id === "cellDivision");
      player.hp = 30; homeo.apply(); const h1 = player.hp;
      player.hp = 90; homeo.apply(); const h2 = player.hp;              // 100 을 넘지 않음
      cell.apply(); const m1 = player.maxHp, h3 = player.hp;            // 최대 120, 체력 100 → 120
      // 체력 40% 기준도 maxHp 를 따른다: 최대 120 일 때 체력 45 는 37.5% → 보급 보장
      player.hp = 45; const p45 = pickChoices().filter((c) => c.isSupply).length;
      // 카드로 고르기: 보급은 레벨 기록 없이 몇 번이든
      ownedAugments = {}; player.hp = 10; let picks = 0;
      for (let n = 0; n < 3; n++) { gameState = "choosing"; choosingTime = 1; choices = [homeo]; wave = 1; chooseAugment(0); picks++; }
      const healedTwice = player.hp === Math.min(player.maxHp, 10 + 40 * 3) && Object.keys(ownedAugments).length === 0;
      resetGame(); const reset = player.maxHp === 100 && player.hp === 100;
      const ok = one === "catalyst,보급,보급" && lowOk && highOk && h1 === 70 && h2 === 100 && m1 === 120 && h3 === 120 &&
        p45 === 1 && healedTwice && reset;
      return { ok: ok, detail: "후보 1장 → " + one + " / 저체력 보장 " + lowOk + " / 50%에선 없음 " + highOk +
        " / 항상성 30→" + h1 + ", 90→" + h2 + " / 세포 분열 최대 " + m1 + " 체력 " + h3 + " / 3번 고르기 " + healedTwice + " / 다시 시작 시 100: " + reset };
    },
  },
  // ---------------- 30웨이브 A: 웨이브 스케일링 ----------------
  {
    name: "[30A] 속도 배율은 1~30웨이브 내내 1.6 이하, 체력 30웨이브 3.03배, 대미지 1.87배",
    run: function () {
      let maxSpeed = 0;
      for (let w = 1; w <= 30; w++) maxSpeed = Math.max(maxSpeed, waveSpeedMult(w));
      const e30 = createEnemy("basic", 0, 0, 30), e1 = createEnemy("basic", 0, 0, 1);
      const ok = maxSpeed <= 1.6 && waveSpeedMult(1) === 1 && Math.abs(waveSpeedMult(25) - 1.6) < 1e-12 &&
        Math.abs(waveHpMult(30) - 3.03) < 1e-9 && Math.abs(waveDamageMult(30) - 1.87) < 1e-9 &&
        Math.abs(e30.speed - 96) < 1e-9 && Math.abs(e30.maxHp - 181.8) < 1e-9 && Math.abs(e30.contactDamage - 37.4) < 1e-9 &&
        e1.speed === 60 && e1.maxHp === 60 && e1.contactDamage === 20;
      return { ok: ok, detail: "최대 속도 배율 " + maxSpeed + " / 30웨이브 기본 적: 속도 " + e30.speed.toFixed(1) +
        ", 체력 " + e30.maxHp.toFixed(1) + ", 접촉 " + e30.contactDamage.toFixed(1) };
    },
  },
  // ---------------- 30웨이브 B: 회복과 진행 ----------------
  {
    name: "[30B] 웨이브 클리어 +10 (최대까지), 보스 처치 최대 체력 50% 회복, 챕터 번호, Shift+0",
    run: new Function(PRESS + `
      runMenuAction(0);
      // 웨이브 클리어 회복
      spawnQueue = []; enemies = []; player.hp = 50; checkWaveEnd(); const h1 = player.hp;
      gameState = "playing"; spawnQueue = []; enemies = []; player.hp = 95; checkWaveEnd(); const h2 = player.hp;
      // 보스 처치 회복 (시험용 보스 종류)
      ENEMY_TYPES.testBoss = Object.assign({}, ENEMY_TYPES.basic, { isBoss: true });
      gameState = "playing"; player.hp = 20; player.maxHp = 120;
      const boss = createEnemy("testBoss", 300, 300, 1); boss.hp = 0.001; enemies = [boss, createEnemy("basic", 800, 100, 1)];
      bullets = [{ x: 300, y: 300, vx: 0, vy: 0, age: 0, damageScale: 1, dead: false }]; updateBullets(0);
      const h3 = player.hp;
      // 챕터
      const ch = [1, 5, 6, 10, 11, 30].map(chapterOf).join(",");
      // Shift+0
      player.hp = 5; press("Digit0", true); const offNoHeal = player.hp === 5;
      press("F2"); press("Digit0", true); const full = player.hp === player.maxHp;
      const ok = h1 === 60 && h2 === 100 && h3 === 80 && bossesKilled === 1 && ch === "1,1,2,2,3,6" && offNoHeal && full;
      return { ok: ok, detail: "클리어 50→" + h1 + ", 95→" + h2 + " / 보스 처치 20→" + h3 + " (최대 120) / 챕터 " + ch + " / 디버그 꺼짐 무시=" + offNoHeal + ", Shift+0=" + full };
    `),
  },
  // ---------------- 30웨이브 C: 보스 ----------------
  {
    name: "[30C] 돌진 대장: 예고 0.8 → 3연속 돌진(재조준 0.35) → 쉬기 2, 체력 50% 아래면 4연속 + 돌격형 2마리 소환",
    run: function () {
      runMenuAction(0); spawnQueue = []; bannerTimer = 0;
      player.x = 480; player.y = 400;
      const boss = createEnemy("chargerKing", 480, -34, 1); enemies = [boss];
      const DT = 1 / 60; let t = 0; const log = []; let last = boss.state; let dashes = 0; const cycles = []; const summons = [];
      for (let f = 0; f < 60 * 22; f++) {
        player.fireTimer = 1e9; player.invincibleTimer = 1e9; player.x = 480; player.y = 400;
        const before = enemies.length;
        update(DT); t += DT;
        if (boss.state !== last) {
          log.push(boss.state + "@" + t.toFixed(2));
          if (boss.state === "dash") dashes++;
          if (boss.state === "rest") { cycles.push(dashes); dashes = 0; summons.push(enemies.length - before); }
          last = boss.state;
        }
        // 두 번째 사이클 도중에 체력을 49% 로 깎는다 → 세 번째 사이클부터 화난 상태
        if (cycles.length === 1 && boss.hp === boss.maxHp && boss.state === "dash") { boss.hp = boss.maxHp * 0.49; enemyType(boss).onHurt(boss); }
      }
      const times = log.map((x) => Number(x.split("@")[1]));
      const firstWarn = +(times[1] - times[0]).toFixed(2);           // warn → dash
      const reaim = +(times[3] - times[2]).toFixed(2);               // 두 번째 warn 시간
      const restIdx = log.findIndex((x) => x.startsWith("rest"));
      const rest = +(times[restIdx + 1] - times[restIdx]).toFixed(2);
      const ok = cycles[0] === 3 && cycles[1] === 3 && cycles[2] === 4 && Math.abs(firstWarn - 0.8) < 0.03 &&
        Math.abs(reaim - 0.35) < 0.03 && Math.abs(rest - 2) < 0.03 && summons.join(",") === "0,2,2" && boss.enraged;
      return { ok: ok, detail: "사이클별 돌진 " + cycles.join(",") + " / 첫 예고 " + firstWarn + "초, 재조준 " + reaim + "초, 쉬기 " + rest + "초 / 쉬기 시작 때 소환 " + summons.join(",") + " (2번째 사이클 도중 50% 아래)" };
    },
  },
  {
    name: "[30C] 분열의 왕: 66%·33% 에서 자식 3마리(120°)·반지름 40→32→24·속도 ×1.3, 죽으면 분열형 2마리",
    run: function () {
      runMenuAction(0); spawnQueue = [];
      const boss = createEnemy("splitterKing", 480, 270, 1); enemies = [boss];
      const s0 = boss.speed;
      boss.hp = boss.maxHp * 0.70; enemyType(boss).onHurt(boss); const a = [enemies.length - 1, boss.radius];
      boss.hp = boss.maxHp * 0.65; enemyType(boss).onHurt(boss); const b = [enemies.length - 1, boss.radius, boss.speed / s0];
      const kids = enemies.filter((e) => e.type === "splitterChild");
      const angles = kids.map((k) => Math.round(Math.atan2(k.y - boss.y, k.x - boss.x) * 180 / Math.PI)).sort((x, y) => x - y).join(",");
      boss.hp = boss.maxHp * 0.10; enemyType(boss).onHurt(boss); const c = [enemies.length - 1, boss.radius, boss.speed / s0];
      // 넉백 안 받음
      pushEnemy(boss, 500, 0); const noKnock = !boss.knockVx;
      // 죽으면 분열형 2마리
      enemies = [boss]; boss.hp = 0.001;
      bullets = [{ x: boss.x, y: boss.y, vx: 0, vy: 0, age: 0, damageScale: 1, dead: false }]; updateBullets(0);
      const after = enemies.map((e) => e.type).join(",");
      const ok = a[0] === 0 && a[1] === 40 && b[0] === 3 && b[1] === 32 && Math.abs(b[2] - 1.3) < 1e-9 && angles === "-90,30,150" &&
        c[0] === 6 && c[1] === 24 && Math.abs(c[2] - 1.69) < 1e-9 && noKnock && after === "splitter,splitter";
      return { ok: ok, detail: "70%: 자식 " + a[0] + " / 65%: 자식 " + b[0] + ", 반지름 " + b[1] + ", 속도 ×" + b[2].toFixed(2) + ", 각도 " + angles +
        " / 10%: 자식 " + c[0] + ", 반지름 " + c[1] + ", 속도 ×" + c[2].toFixed(2) + " / 넉백 없음 " + noKnock + " / 죽은 뒤 " + after };
    },
  },
  {
    name: "[30C] 보스는 시간 지연을 받아도 0.6배 아래로 안 느려짐 (보통 적은 0.2배)",
    run: function () {
      AUGMENTS.push({ id: "slow", name: "s", levels: [{}], modifyEnemySpeed: function (f) { return f * 0.2; } });
      runMenuAction(0); spawnQueue = []; ownedAugments = { slow: 1 };
      const boss = createEnemy("splitterKing", 480, 100, 1), e = createEnemy("basic", 200, 100, 1);
      enemies = [boss, e]; player.fireTimer = 1e9; updateEnemies(1 / 60);
      return { ok: boss.slowFactor === 0.6 && Math.abs(e.slowFactor - 0.2) < 1e-12, detail: "보스 " + boss.slowFactor + "배, 기본 적 " + e.slowFactor + "배" };
    },
  },
  {
    name: "[30C] 보스 웨이브: 2초 뒤 보스 등장, 졸개 3초 간격, 빨간 띠, 보스와 졸개가 모두 죽어야 끝",
    run: function () {
      runMenuAction(0);
      WAVES.splice(0, WAVES.length, { boss: "chargerKing", groups: [{ type: "basic", count: 2 }] }, [{ type: "basic", count: 1 }]);
      startWave(1);
      const banner = bannerText, red = bannerIsBoss;
      const DT = 1 / 60; let t = 0; const appear = [];
      for (let f = 0; f < 60 * 10; f++) {
        player.fireTimer = 1e9; player.invincibleTimer = 1e9;
        const before = enemies.map((e) => e.type).join();
        update(DT); t += DT;
        for (const e of enemies) if (!e.__seen) { e.__seen = true; appear.push(e.type + "@" + t.toFixed(1)); }
      }
      const stillPlaying1 = gameState === "playing";
      // 졸개만 다 죽여도 보스가 있으면 계속
      enemies = enemies.filter((e) => enemyType(e).isBoss); checkWaveEnd(); const stillPlaying2 = gameState === "playing";
      enemies = []; checkWaveEnd();
      const ok = banner === "웨이브 1 · 보스: 돌진 대장!" && red && appear.join(",") === "chargerKing@2.0,basic@5.0,basic@8.0" &&
        stillPlaying1 && stillPlaying2 && gameState === "choosing";
      return { ok: ok, detail: banner + " (빨강=" + red + ") / 등장 " + appear.join(", ") + " / 보스만 남아도 계속=" + stillPlaying2 + " / 다 죽으면 " + gameState };
    },
  },
  // ---------------- 성장 A: 저장 장치 ----------------
  {
    name: "[성장A] 저장: 기본값, 저장 후 다시 읽기, 깨진 데이터·이상한 값은 기본값, 저장소 오류에도 동작",
    run: function () {
      const box = window.__fakeStorage;
      for (const k in box) delete box[k];
      const fresh = JSON.stringify(loadSave());
      saveData = loadSave(); saveData.coins = 123; saveData.upgrades.vitality = 4; saveData.bestWave = 7; writeSave();
      const back = loadSave();
      const roundTrip = back.coins === 123 && back.upgrades.vitality === 4 && back.bestWave === 7 && back.version === SAVE_VERSION;
      box[SAVE_KEY] = "{깨진 데이터"; const broken = JSON.stringify(loadSave());
      box[SAVE_KEY] = JSON.stringify({ coins: -5, bestWave: "많이", upgrades: { power: 2.7, vitality: NaN } });
      const weird = loadSave();
      // 저장소가 아예 오류를 내는 환경
      const real = window.localStorage;
      Object.defineProperty(window, "localStorage", { get: () => { throw new Error("막힘"); }, configurable: true });
      let noThrow = true, wrote;
      try { const d = loadSave(); wrote = writeSave(); if (d.coins !== 0) noThrow = false; } catch (e) { noThrow = false; }
      Object.defineProperty(window, "localStorage", { value: real, configurable: true });
      const def = JSON.stringify(defaultSave());
      const ok = fresh === def && roundTrip && broken === def && weird.coins === 0 && weird.bestWave === 0 &&
        weird.upgrades.power === 2 && weird.upgrades.vitality === 0 && noThrow && wrote === false;
      return { ok: ok, detail: "기본 " + fresh + " / 다시 읽기 " + roundTrip + " / 깨진 데이터 → 기본 " + (broken === def) +
        " / 이상한 값 → " + JSON.stringify(weird) + " / 저장소 오류에도 동작 " + noThrow };
    },
  },
];
