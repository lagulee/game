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
    name: "최대 레벨 증강은 카드 후보에서 빠진다",
    run: function () {
      const maxed = {};
      for (const aug of AUGMENTS) maxed[aug.id] = aug.levels.length;
      ownedAugments = Object.assign({}, maxed);
      const none = pickChoices().length === 0;
      const first = AUGMENTS[0];
      ownedAugments = {}; ownedAugments[first.id] = first.levels.length;
      let leaked = false;
      for (let i = 0; i < 50; i++) if (pickChoices().some((a) => a.id === first.id)) leaked = true;
      return { ok: none && !leaked, detail: "전부 최대 → 후보 " + (none ? "0장" : "있음") + ", 최대 레벨 증강 섞임: " + leaked };
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
      press("BracketRight"); press("BracketRight"); press("BracketRight"); press("BracketRight"); press("BracketRight");
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
    name: "[B] 돌격형: 접근→예고 0.6→돌진 0.5→쉬기 1.0, 돌진은 고정 방향·3배 속도",
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
          if (e.state === "dash") dirAtDash = [e.dirX, e.dirY]; }
        if (e.state === "dash" && e.stateTime > DT * 1.5) dashSpeed = distance(px, py, e.x, e.y) / DT;
        if (e.state === "dash" && dirAtDash && (e.dirX !== dirAtDash[0] || e.dirY !== dirAtDash[1])) return { ok: false, detail: "돌진 중 방향이 바뀜" };
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
  // ---------------- C. 웨이브 5개 ----------------
  {
    name: "[C] 웨이브 5개 구성, 2~5웨이브는 섞어서 나옴, 1웨이브는 순서대로",
    run: function () {
      runMenuAction(0);
      const want = ["basic:10", "basic:8,charger:4", "basic:6,sine:8", "basic:6,charger:4,splitter:4",
        "basic:10,charger:5,sine:5,splitter:3"];
      const got = []; const mixed = [];
      for (let n = 1; n <= WAVES.length; n++) {
        startWave(n);
        const count = {}; for (const t of spawnQueue) count[t] = (count[t] || 0) + 1;
        got.push(Object.keys(count).sort().map((k) => k + ":" + count[k]).join(","));
        // 섞였는지: 같은 종류가 모두 붙어 있지 않으면 섞인 것
        let changes = 0; for (let i = 1; i < spawnQueue.length; i++) if (spawnQueue[i] !== spawnQueue[i - 1]) changes++;
        mixed.push(changes > Object.keys(count).length - 1);
      }
      const ok = WAVES.length === 5 && JSON.stringify(got) === JSON.stringify(want) &&
        JSON.stringify(mixed) === JSON.stringify([false, true, true, true, true]);
      return { ok: ok, detail: got.join(" | ") + " / 섞임 " + mixed.join(",") };
    },
  },
  {
    name: "[C] 새 적 안내 띠: 2웨이브 돌격형, 3웨이브 사인파형, 4웨이브 분열형, 1·5웨이브는 없음",
    run: function () {
      runMenuAction(0);
      const texts = [];
      for (let n = 1; n <= 5; n++) { startWave(n); texts.push(bannerText); }
      const ok = texts[0] === "웨이브 1" && texts[1] === "웨이브 2 · 새 적: 돌격형!" &&
        texts[2] === "웨이브 3 · 새 적: 사인파형!" && texts[3] === "웨이브 4 · 새 적: 분열형!" && texts[4] === "웨이브 5";
      return { ok: ok, detail: texts.join(" / ") };
    },
  },
  {
    name: "[C] 5웨이브를 깨면 게임 클리어 (무적으로 끝까지 플레이)",
    run: function () {
      runMenuAction(0); player.hp = 1e9;
      const DT = 1 / 60; const seen = [];
      for (let f = 0; f < 60 * 60 * 6 && gameState !== "clear"; f++) {
        if (gameState === "choosing") { choosingTime = 1; chooseAugment(0); }
        if (seen[seen.length - 1] !== wave) seen.push(wave);
        player.x = 480 + Math.cos(f / 60) * 300; player.y = 270 + Math.sin(f / 45) * 200;
        update(DT);
      }
      return { ok: gameState === "clear" && seen.join(",") === "1,2,3,4,5", detail: "지나간 웨이브 " + seen.join(",") + " → " + gameState };
    },
  },
];
