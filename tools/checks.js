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

// 주인 비밀번호를 지문(해시)에서 찾는 도우미. 검사 파일에 비밀번호를 그대로 적지 않으려고
// 0000 ~ 9999 를 차례로 넣어 본다 (4자리라 금방 찾는다)
const FIND_PIN = "function findPin() { for (let i = 0; i < 10000; i++) { const p = String(i).padStart(4, '0');" +
  " if (pinHash(p) === OWNER_PIN_HASH) return p; } return null; }";

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
      startGame(); spawnQueue = []; ownedAugments = { t: 1 };
      enemies.push(createEnemy("basic", player.x + 120, player.y, 1));
      enemies[0].speed = 0;
      for (let f = 0; f < 600 && enemies.length; f++) update(1 / 60);
      const last = calls[calls.length - 1];
      const hits = Math.ceil(createEnemy("basic", 0, 0, 1).maxHp / 10); // 죽을 때까지 맞는 횟수 (웨이브 배율 반영)
      const ok = calls.length === hits && calls.slice(0, hits - 1).every((c) => !c.killed && c.dmg === 10) &&
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
      startGame(); spawnQueue = []; ownedAugments = { t: 1 };
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
    name: "[A] 디버그 모드: 꺼져 있으면 영향 없음, 켜면 [ ] G(지급 창) I 동작",
    run: new Function(PRESS + `
      startGame();
      const hash = () => { draw(); return canvas.toDataURL(); };
      // 1) 꺼진 상태: 키를 눌러도 아무 변화 없음
      const before = JSON.stringify([wave, ownedAugments, hash()]);
      press("BracketRight"); press("KeyG"); press("KeyI");
      const offSame = JSON.stringify([wave, ownedAugments, hash()]) === before && !debugInvincible && !isDebugGiveOpen();
      // 2) 켠 상태
      ownerUnlocked = true; press("F2");
      press("BracketRight"); const w2 = wave;
      for (let i = 0; i < WAVES.length + 3; i++) press("BracketRight"); // 끝까지 누르면 마지막 웨이브에서 멈춘다
      const wMax = wave;
      press("BracketLeft"); const wBack = wave;
      press("KeyG"); const giveBtn = () => document.querySelector(".give-plus");
      giveBtn().click(); const l1 = getAugmentLevel(AUGMENTS[0].id);
      giveBtn().click(); giveBtn().click(); giveBtn().click(); const l2 = getAugmentLevel(AUGMENTS[0].id);
      press("Escape"); resumeTimer = 0;   // 창을 닫으면 "준비!" 0.5초 뒤 재개 → 검사에서는 바로 재개
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
      startGame(); spawnQueue = []; bannerTimer = 0;
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
        Math.abs(gaps[1] - 0.5) < 0.03 && Math.abs(gaps[2] - 1.0) < 0.03 && Math.abs(dashSpeed - e.speed * 3) < 1;
      return { ok: ok, detail: seq + " / 간격 " + gaps.slice(0, 3).join(", ") + "초 / 돌진 속도 " + dashSpeed.toFixed(1) + " (평소 " + e.speed.toFixed(1) + "의 3배)" };
    },
  },
  {
    name: "[B] 돌격형: 시간 지연 배율 0.5 를 받으면 예고·돌진·쉬기 시간이 모두 2배",
    run: function () {
      AUGMENTS.push({ id: "slow", name: "s", levels: [{}], modifyEnemySpeed: function (f) { return f * 0.5; } });
      startGame(); spawnQueue = []; ownedAugments = { slow: 1 };
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
      startGame(); spawnQueue = [];
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
      startGame();
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
    name: "[30D·4D] 30웨이브 구성이 표와 같음 (1~5웨이브는 예전 그대로), 1웨이브만 순서대로, 5웨이브마다 보스",
    run: function () {
      startGame();
      // B 기본 · C 돌격 · S 사인파 · P 분열 · G 사수 · D 방패 · R 공명 · M 자석
      const want = ["B5", "B4 C2", "S4 B3", "P2 C2 B2", "[돌진 대장] B4",
        "B4 S3 C2", "G3 B4", "G3 S4 P2", "G4 C3 B3", "[분열의 왕] G2 S2",
        "B5 C3 P2 G1", "D3 B5", "D3 G3 P3", "D4 C4 S3", "[파동 군주] D2 B3",
        "B6 S4 G2", "R2 B6", "R2 C5 S4", "R3 D3 P3 B3", "[회전 포대] R1 B4",
        "B6 G3 D3", "M2 B6", "M2 C5 G4", "M3 R2 S4 P3", "[돌진 대장 & 분열의 왕] G2 D2",
        "B3 C3 S2 P2 G2 D2", "G3 D3 R2 M2 C3", "S4 P3 M2 R2 G3", "C3 D3 G3 R2 M2 P2", "[블랙홀] G2 D2 R1"];
      const abbr = { basic: "B", charger: "C", sine: "S", splitter: "P", shooter: "G", shield: "D", resonator: "R", magnet: "M" };
      const got = WAVES.map((w) => {
        const bosses = waveBosses(w).map((id) => ENEMY_TYPES[id].name);
        const g = waveGroups(w).map((x) => abbr[x.type] + x.count).join(" ");
        return (bosses.length ? "[" + bosses.join(" & ") + "]" + (g ? " " : "") : "") + g;
      });
      const mixOk = WAVES.every((w, i) => waveIsMixed(w) === (i !== 0));
      const counts = WAVES.map((w) => waveGroups(w).reduce((a, g) => a + g.count, 0));
      const normalOk = counts.every((n, i) => (i + 1) % 5 === 0 || (n >= 5 && n <= 15));
      const bossOk = WAVES.every((w, i) => (waveBosses(w).length > 0) === ((i + 1) % 5 === 0));
      const bad = got.map((g, i) => g === want[i] ? null : (i + 1) + ":" + g).filter(Boolean);
      return { ok: WAVES.length === 30 && bad.length === 0 && mixOk && normalOk && bossOk,
        detail: "웨이브 " + WAVES.length + "개, 다른 칸 " + (bad.join(" ") || "없음") + ", mix " + mixOk + ", 보통 웨이브 5~15마리 " + normalOk + ", 5의 배수만 보스 " + bossOk };
    },
  },
  {
    name: "[30D·4D] 안내 띠: 새 적 첫 등장(2·3·4·7·12·17·22), 보스(빨강), 25웨이브 두 보스, 30웨이브 최종 보스",
    run: function () {
      startGame();
      const t = {};
      for (const n of [1, 2, 3, 4, 5, 6, 7, 10, 12, 15, 17, 20, 22, 25, 30]) { startWave(n); t[n] = bannerText + (bannerIsBoss ? " (빨강)" : ""); }
      const ok = t[1] === "웨이브 1" && t[2] === "웨이브 2 · 새 적: 돌격형!" && t[3] === "웨이브 3 · 새 적: 사인파형!" &&
        t[4] === "웨이브 4 · 새 적: 분열형!" && t[5] === "웨이브 5 · 보스: 돌진 대장! (빨강)" && t[6] === "웨이브 6" &&
        t[7] === "웨이브 7 · 새 적: 사수형!" && t[12] === "웨이브 12 · 새 적: 방패형!" && t[17] === "웨이브 17 · 새 적: 공명형!" && t[22] === "웨이브 22 · 새 적: 자석형!" &&
        t[10] === "웨이브 10 · 보스: 분열의 왕! (빨강)" && t[15] === "웨이브 15 · 보스: 파동 군주! (빨강)" && t[20] === "웨이브 20 · 보스: 회전 포대! (빨강)" &&
        t[25] === "웨이브 25 · 보스: 돌진 대장 & 분열의 왕! (빨강)" && t[30] === "웨이브 30 · 최종 보스: 블랙홀! (빨강)";
      return { ok: ok, detail: Object.keys(t).map((k) => t[k]).join(" / ") };
    },
  },
  {
    name: "[30D] 무적 + 업그레이드 최대로 1 → 30웨이브 자동 진행 후 클리어, 보스 7마리 처치, 결과 화면",
    run: function () {
      saveData.upgrades = { vitality: 30, power: 30 }; // 업그레이드를 다 산 상태로
      startGame(); debugMode = true; debugInvincible = true;
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
      startGame(); spawnQueue = []; ownedAugments = { arithmetic: 1 };
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
      startGame(); ownedAugments = { square: 1 };
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
      startGame(); spawnQueue = [];
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
      startGame(); spawnQueue = []; ownedAugments = { fission: 1 };
      const killWith = (bullet, e) => { const aug = AUGMENTS.find((a) => a.id === "fission");
        aug.onKill(aug.levels[getAugmentLevel("fission") - 1], { enemy: e, x: e.x, y: e.y, bullet: bullet }); };
      const e = createEnemy("basic", 400, 300, 1);
      bullets = []; killWith({ isFragment: false }, e);
      const g1 = bullets.slice();
      const angle = Math.abs(Math.atan2(g1[0].vy, g1[0].vx) - Math.atan2(g1[1].vy, g1[1].vx)) * 180 / Math.PI;
      const dmg1 = g1[0].damageScale * player.damage;                       // 최대 체력 × 0.2
      bullets = []; killWith(g1[0], e); const g2 = bullets.slice();
      const dmg2 = g2[0].damageScale * player.damage;                       // 최대 체력 × 0.2 × 0.6
      bullets = []; killWith(g2[0], e); const g3count = bullets.length;     // 2세대가 죽이면 끝
      ownedAugments = { fission: 2 };
      bullets = []; for (let i = 0; i < 30; i++) killWith({}, e);
      const capped = bullets.filter((b) => b.isFragment).length;
      bullets = []; killWith({}, e); const lv2 = bullets.length; const lv2dmg = bullets[0].damageScale * player.damage;
      // 수명: 0.5초 뒤 사라진다
      bullets = []; killWith({}, createEnemy("basic", 480, 270, 1));
      for (let f = 0; f < 32; f++) updateBullets(1 / 60);
      const goneAfterLife = bullets.length === 0;
      const ok = g1.length === 2 && Math.abs(angle - 180) < 1e-6 && Math.abs(dmg1 - e.maxHp * 0.2) < 1e-9 &&
        g1[0].generation === 1 && g2.length === 2 && g2[0].generation === 2 && Math.abs(dmg2 - e.maxHp * 0.12) < 1e-9 &&
        g3count === 0 && capped === 40 && lv2 === 3 && Math.abs(lv2dmg - e.maxHp * 0.25) < 1e-9 && goneAfterLife &&
        g1.every((b) => b.fromAugment);
      return { ok: ok, detail: "1세대 " + g1.length + "개 " + angle.toFixed(0) + "° 간격 " + dmg1 + " / 2세대 " + dmg2.toFixed(1) +
        " / 3세대 " + g3count + "개 / 제한 " + capped + " / Lv2 " + lv2 + "개 " + lv2dmg + " / 수명 후 사라짐=" + goneAfterLife };
    },
  },
  {
    name: "[증강] 촉매: 발사 간격 × 0.8 (Lv.1), × 0.7 (Lv.2), 실제 발사 수도 늘어남",
    run: function () {
      startGame();
      ownedAugments = {}; const base = fireInterval();
      ownedAugments = { catalyst: 1 }; const lv1 = fireInterval();
      ownedAugments = { catalyst: 2 }; const lv2 = fireInterval();
      // 10초 동안 쏜 횟수 비교 (멈춰 있는 과녁 하나)
      const shots = (own) => { startGame(); spawnQueue = []; ownedAugments = own; player.hp = 1e9;
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
      startGame(); spawnQueue = []; player.x = 100; player.y = 100; player.fireTimer = 1e9;
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
    name: "[디버그] G: 증강·보급 전체 목록 창 → 클릭으로 지급, 최대 레벨이면 버튼 잠김, 전투 중엔 멈췄다가 닫으면 재개, 로비에선 안 열림",
    run: new Function(PRESS + `
      goToMenu(); ownerUnlocked = true; press("F2");
      press("KeyG"); const noLobby = !isDebugGiveOpen();
      startGame(); for (let i = 0; i < 10; i++) update(1 / 60);
      press("KeyG");
      const open = isDebugGiveOpen() && paused;
      const augBtns = [...document.querySelectorAll(".give-plus")], supBtns = [...document.querySelectorAll(".give-supplies button")];
      const counts = augBtns.length === AUGMENTS.length && supBtns.length === SUPPLIES.length;
      augBtns.forEach((b) => b.click());
      const allOne = AUGMENTS.every((a) => getAugmentLevel(a.id) === 1);
      for (let i = 0; i < 5; i++) augBtns[0].click();
      const capped = getAugmentLevel(AUGMENTS[0].id) === AUGMENTS[0].levels.length && augBtns[0].disabled;
      player.hp = 10; supBtns[SUPPLIES.findIndex((s) => s.id === "homeostasis")].click(); const healed = player.hp > 10;
      press("KeyG"); const closed = !isDebugGiveOpen() && !paused;
      debugMode = false; press("KeyG"); const offNo = !isDebugGiveOpen();
      const ok = noLobby && open && counts && allOne && capped && healed && closed && offNo;
      return { ok: ok, detail: "로비에선 안 열림 " + noLobby + " / 열림·일시정지 " + open + " / 버튼 증강 " + augBtns.length + "개·보급 " + supBtns.length + "개 " + counts +
        " / 모두 Lv1 " + allOne + " / 최대에서 잠김 " + capped + " / 보급 사용 " + healed + " / G 로 닫고 재개 " + closed + " / 디버그 꺼지면 안 열림 " + offNo };
    `),
  },
  {
    name: "[Lv.3] 증강 모두 3레벨, Lv.3 수치가 요청대로",
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
      startGame();
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
    name: "[30A·성장D] 웨이브 배율: 속도 ≤ MAX, 체력 HP_BASE×(1+HP_GROWTH(w−1)), 대미지 DMG_BASE×(1+DMG_GROWTH(w−1)), 웨이브 회복 비율, 항상성 40%",
    run: function () {
      let maxSpeed = 0;
      for (let w = 1; w <= 30; w++) maxSpeed = Math.max(maxSpeed, waveSpeedMult(w));
      const e30 = createEnemy("basic", 0, 0, 30), e1 = createEnemy("basic", 0, 0, 1);
      startGame(); player.maxHp = 200; player.hp = 50; spawnQueue = []; enemies = []; checkWaveEnd(); const heal = player.hp; // + 200 × 비율
      player.hp = 50; SUPPLIES.find((s) => s.id === "homeostasis").apply(); const homeo = player.hp;                       // +80
      const near = (a, b) => Math.abs(a - b) < 1e-9;
      const ok = maxSpeed <= ENEMY_SPEED_MAX_MULT && near(waveSpeedMult(1), ENEMY_SPEED_BASE) && near(waveHpMult(1), ENEMY_HP_BASE) &&
        near(waveHpMult(30), ENEMY_HP_BASE * (1 + ENEMY_HP_GROWTH * 29)) && near(waveDamageMult(30), ENEMY_DMG_BASE * (1 + ENEMY_DMG_GROWTH * 29)) &&
        near(e1.maxHp, 60 * ENEMY_HP_BASE) && near(e1.contactDamage, 20 * ENEMY_DMG_BASE) && near(e30.speed, 60 * waveSpeedMult(30)) &&
        near(heal, 50 + 200 * WAVE_CLEAR_HEAL_RATIO) && homeo === 130;
      return { ok: ok, detail: "최대 속도 배율 " + maxSpeed.toFixed(3) + " / 1웨이브 기본 적 체력 " + e1.maxHp + ", 접촉 " + e1.contactDamage +
        " / 30웨이브 체력 " + e30.maxHp.toFixed(1) + ", 접촉 " + e30.contactDamage.toFixed(1) + ", 속도 " + e30.speed.toFixed(1) +
        " / 최대 200일 때 웨이브 회복 50→" + heal + ", 항상성 50→" + homeo };
    },
  },
  // ---------------- 30웨이브 B: 회복과 진행 ----------------
  {
    name: "[30B] 웨이브 클리어 회복 = 최대 체력 × WAVE_CLEAR_HEAL_RATIO (최대까지), 보스 처치 최대 체력 50% 회복, 챕터 번호, Shift+0",
    run: new Function(PRESS + `
      startGame();
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
      ownerUnlocked = true; press("F2"); press("Digit0", true); const full = player.hp === player.maxHp;
      const ok = Math.abs(h1 - (50 + 100 * WAVE_CLEAR_HEAL_RATIO)) < 1e-9 && h2 === Math.min(100, 95 + 100 * WAVE_CLEAR_HEAL_RATIO) && h3 === 80 && bossesKilled === 1 && ch === "1,1,2,2,3,6" && offNoHeal && full;
      return { ok: ok, detail: "클리어 50→" + h1 + ", 95→" + h2 + " / 보스 처치 20→" + h3 + " (최대 120) / 챕터 " + ch + " / 디버그 꺼짐 무시=" + offNoHeal + ", Shift+0=" + full };
    `),
  },
  // ---------------- 30웨이브 C: 보스 ----------------
  {
    name: "[30C] 돌진 대장: 예고 0.8 → 3연속 돌진(재조준 0.35) → 쉬기 2, 체력 50% 아래면 4연속 + 돌격형 2마리 소환",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0;
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
        Math.abs(reaim - 0.35) < 0.03 && Math.abs(rest - 2) < 0.03 && summons.slice(0, 3).join(",") === "0,2,2" && boss.enraged;
      return { ok: ok, detail: "사이클별 돌진 " + cycles.join(",") + " / 첫 예고 " + firstWarn + "초, 재조준 " + reaim + "초, 쉬기 " + rest + "초 / 쉬기 시작 때 소환 " + summons.join(",") + " (2번째 사이클 도중 50% 아래)" };
    },
  },
  {
    name: "[30C] 분열의 왕: 66%·33% 에서 자식 3마리(120°)·반지름 40→32→24·속도 ×1.3, 죽으면 분열형 2마리",
    run: function () {
      startGame(); spawnQueue = [];
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
      startGame(); spawnQueue = []; ownedAugments = { slow: 1 };
      const boss = createEnemy("splitterKing", 480, 100, 1), e = createEnemy("basic", 200, 100, 1);
      enemies = [boss, e]; player.fireTimer = 1e9; updateEnemies(1 / 60);
      return { ok: boss.slowFactor === 0.6 && Math.abs(e.slowFactor - 0.2) < 1e-12, detail: "보스 " + boss.slowFactor + "배, 기본 적 " + e.slowFactor + "배" };
    },
  },
  {
    name: "[30C] 보스 웨이브: 2초 뒤 보스 등장, 졸개는 한 마리씩 3초 간격(수는 표 × WAVE_COUNT_MULT), 빨간 띠, 모두 죽어야 끝",
    run: function () {
      startGame();
      WAVES.splice(0, WAVES.length, { boss: "chargerKing", groups: [{ type: "basic", count: 2 }] }, [{ type: "basic", count: 1 }]);
      startWave(1);
      const banner = bannerText, red = bannerIsBoss;
      const DT = 1 / 60; let t = 0; const appear = [];
      const minions = scaledCount(2);
      const want = ["chargerKing@2.0"];
      for (let i = 0; i < minions; i++) want.push("basic@" + (5 + 3 * i).toFixed(1));
      for (let f = 0; f < 60 * (3 + 3 * minions); f++) {
        player.fireTimer = 1e9; player.invincibleTimer = 1e9;
        update(DT); t += DT;
        for (const e of enemies) if (!e.__seen) { e.__seen = true; appear.push(e.type + "@" + t.toFixed(1)); }
      }
      const stillPlaying1 = gameState === "playing";
      // 졸개만 다 죽여도 보스가 있으면 계속
      enemies = enemies.filter((e) => enemyType(e).isBoss); checkWaveEnd(); const stillPlaying2 = gameState === "playing";
      enemies = []; checkWaveEnd();
      const ok = banner === "웨이브 1 · 보스: 돌진 대장!" && red && appear.length === want.length && appear.every((x, i) => x.split("@")[0] === want[i].split("@")[0] && Math.abs(Number(x.split("@")[1]) - Number(want[i].split("@")[1])) <= 0.15) &&
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
  // ---------------- 성장 B: 코인 ----------------
  {
    name: "[성장B] 코인: 전투 중에만 시간이 흐름, 초당 1×(1+0.15(w−1)), 웨이브당 60초 상한, 보스 50×챕터, 판 끝에 저장",
    run: function () {
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      startGame(); spawnQueue = []; debugMode = true; debugInvincible = true;
      const far = () => { const e = createEnemy("basic", 940, 520, 1); e.hp = e.maxHp = 1e9; e.speed = 0; return e; };
      enemies = [far()];
      const step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { player.fireTimer = 1e9; update(1 / 60); } };
      step(10); const t1 = runTime, c1 = runCoins;                     // 1웨이브 10초 → 10코인
      gameState = "choosing"; step(5); gameState = "menu"; step(5);     // 카드·메뉴 시간은 안 셈
      const t2 = runTime;
      gameState = "playing"; startWave(5); spawnQueue = []; bossQueue = []; enemies = [far()];
      const before5 = runCoins; step(100); const c5 = runCoins - before5; // 5웨이브: 60초 상한 × 1.6 = 96
      // 보스 보너스 (챕터 3 = 웨이브 11)
      wave = 11; ENEMY_TYPES.tb = Object.assign({}, ENEMY_TYPES.basic, { isBoss: true });
      const b = createEnemy("tb", 300, 300, 11); b.hp = 0.001; enemies = [b, far()];
      const beforeBoss = runCoins;
      bullets = [{ x: 300, y: 300, vx: 0, vy: 0, age: 0, damageScale: 1, dead: false }]; updateBullets(0);
      const bossBonus = runCoins - beforeBoss;
      // 판 끝: 내림한 코인 저장, 최고 웨이브
      const expected = Math.floor(runCoins);
      endGame("gameover");
      const saved = loadSave();
      const ok = Math.abs(t1 - 10) < 0.02 && Math.abs(c1 - 10) < 0.02 && Math.abs(t2 - t1) < 1e-9 &&
        Math.abs(c5 - 96) < 0.02 && Math.abs(bossBonus - 150) < 1e-9 && saved.coins === expected && lastRunCoins === expected && saved.bestWave === 11;
      return { ok: ok, detail: "1웨이브 10초 → 시간 " + t1.toFixed(2) + ", 코인 " + c1.toFixed(2) + " / 카드·메뉴 10초 동안 시간 +" + (t2 - t1).toFixed(2) +
        " / 5웨이브 100초 버텨도 코인 " + c5.toFixed(2) + " / 보스(챕터 3) +" + bossBonus.toFixed(2) + " / 저장 " + saved.coins + "코인, 최고 웨이브 " + saved.bestWave };
    },
  },
  // ---------------- 성장 C: 업그레이드 ----------------
  {
    name: "[성장C] 업그레이드: 비용 round(40×1.15^L), 구매/부족/MAX, 즉시 저장, 판 시작 때 체력·공격력 적용",
    run: function () {
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      const hp = UPGRADES.find((u) => u.id === "vitality"), pw = UPGRADES.find((u) => u.id === "power");
      const costs = []; for (let L = 0; L < 5; L++) { saveData.upgrades.vitality = L; costs.push(upgradeCost(hp)); }
      saveData.upgrades.vitality = 29; const cost29 = upgradeCost(hp);
      saveData.upgrades = {}; saveData.coins = 100;
      const r1 = buyUpgrade(hp);                       // 40 → 남은 60
      const r2 = buyUpgrade(hp);                       // 46 → 남은 14
      const r3 = buyUpgrade(hp);                       // 53 필요 → 부족
      const savedNow = loadSave();
      saveData.upgrades.power = 30; const r4 = buyUpgrade(pw);
      saveData.upgrades.power = 5;
      startGame();                                 // 판 시작 → 업그레이드 적용
      const applied = player.maxHp === 120 && player.hp === 120 && player.damage === 15;
      const dmg = calcDamage({}, { damageScale: 1 });
      const want = [40, 46, 53, 61, 70];
      const ok = JSON.stringify(costs) === JSON.stringify(want) && cost29 === Math.round(40 * Math.pow(1.15, 29)) &&
        r1 === "ok" && r2 === "ok" && r3 === "poor" && r4 === "max" && savedNow.coins === 14 && savedNow.upgrades.vitality === 2 &&
        applied && dmg === 15;
      return { ok: ok, detail: "비용 " + costs.join(",") + "… Lv29→30 " + cost29 + " / 구매 " + [r1, r2, r3, r4].join(",") +
        " / 저장된 코인 " + savedNow.coins + ", 체력 Lv" + savedNow.upgrades.vitality + " / 판 시작: 최대 체력 " + player.maxHp + ", 공격력 " + player.damage + ", 한 발 " + dmg };
    },
  },
  {
    name: "[성장C] player.damage 사용: 제곱 증폭은 D²/player.damage, 핵분열 파편 대미지는 최대 체력×에너지 그대로",
    run: function () {
      startGame(); player.damage = 20; ownedAugments = { square: 2 };
      AUGMENTS.forEach((a) => a.reset && a.reset());
      calcDamage({}, { damageScale: 1 }); const sq = calcDamage({}, { damageScale: 2 });   // D=40 → 40 × 40/20 = 80
      ownedAugments = { fission: 1 }; bullets = [];
      const aug = AUGMENTS.find((a) => a.id === "fission"); const e = createEnemy("basic", 400, 300, 1);
      aug.onKill(aug.levels[0], { enemy: e, x: 400, y: 300, bullet: {} });
      const frag = bullets[0].damageScale * player.damage;   // 최대 체력 × 0.2 (공격력과 상관없이)
      return { ok: sq === 80 && Math.abs(frag - e.maxHp * 0.2) < 1e-9, detail: "제곱 " + sq + " / 파편 " + frag + " (적 최대 체력 " + e.maxHp + "의 20%)" };
    },
  },
  {
    name: "[성장C] 화면 이동과 입력: 메뉴→업그레이드, 1·2 키 구매, Esc 메뉴, 결과 화면 U, 저장 초기화는 3초 안에 두 번",
    run: new Function(PRESS + `
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave(); saveData.coins = 200;
      goToMenu(); openTab("upgrades");
      const opened = gameState === "upgrades";
      press("Digit1"); press("Digit2"); press("Digit2");
      const lv = upgradeLevel(UPGRADES[0]) + "," + upgradeLevel(UPGRADES[1]);   // 40, 40, 46 → 1,2 (남은 74)
      saveData.coins = 0; press("Digit1"); const shook = upgradeShake[0] > 0;
      press("Escape"); const back = gameState === "menu";
      // 결과 화면에서 U
      startGame(); endGame("gameover"); press("KeyU"); const fromResult = gameState === "upgrades";
      // 저장 초기화: 한 번 누르면 대기, 3초 지나면 취소, 3초 안에 두 번이면 실행
      saveData.coins = 500; pressResetSave(); const armed = resetArmTimer > 0;
      for (let i = 0; i < 200; i++) update(1 / 60);          // 3.3초
      pressResetSave(); const notYet = saveData.coins === 500; // 시간이 지나서 다시 "대기"만
      for (let i = 0; i < 60; i++) update(1 / 60);           // 1초
      pressResetSave(); const cleared = saveData.coins === 0 && JSON.stringify(loadSave()) === JSON.stringify(defaultSave());
      // Shift+C (디버그)
      press("KeyC", true); const offNoCoin = saveData.coins === 0;
      ownerUnlocked = true; press("F2"); press("KeyC", true); const debugCoin = saveData.coins === 1000 && loadSave().coins === 1000;
      const ok = opened && lv === "1,2" && shook && back && fromResult && armed && notYet && cleared && offNoCoin && debugCoin;
      return { ok: ok, detail: "열림 " + opened + " / 레벨 " + lv + " / 모자랄 때 흔들림 " + shook + " / Esc " + back + " / 결과 U " + fromResult +
        " / 초기화 대기 " + armed + ", 3초 지나 취소 " + notYet + ", 두 번이면 초기화 " + cleared + " / Shift+C 꺼짐 무시 " + offNoCoin + ", 켜면 +1000 " + debugCoin };
    `),
  },
  // ---------------- 화면 / UI ----------------
  {
    name: "[화면] 캔버스는 16:9로 창에 맞춤, 실제 픽셀 = 보이는 크기 × devicePixelRatio, 마우스 좌표는 960×540 으로 정확히 변환",
    run: function () {
      fitCanvas();
      const ratio = canvas.clientWidth / canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const pxOk = canvas.width === Math.round(canvas.clientWidth * dpr) && Math.abs(renderScale - canvas.width / 960) < 1e-12;
      const r = canvas.getBoundingClientRect();
      // 게임 좌표 몇 곳을 화면 좌표로 바꿨다가 getMousePos 로 되돌려 본다
      let worst = 0;
      for (const [gx, gy] of [[0, 0], [480, 270], [959, 539], [123, 456]]) {
        const ev = { clientX: r.left + canvas.clientLeft + gx * canvas.clientWidth / 960,
                     clientY: r.top + canvas.clientTop + gy * canvas.clientHeight / 540 };
        const p = getMousePos(ev);
        worst = Math.max(worst, Math.abs(p.x - gx), Math.abs(p.y - gy));
      }
      const ok = Math.abs(ratio - 16 / 9) < 0.01 && pxOk && worst < 0.01;
      return { ok: ok, detail: "보이는 크기 " + canvas.clientWidth + "×" + canvas.clientHeight + " (비율 " + ratio.toFixed(3) +
        "), 실제 픽셀 " + canvas.width + "×" + canvas.height + ", 마우스 변환 최대 오차 " + worst.toFixed(4) + "px" };
    },
  },
  {
    name: "[일시정지] P·Esc·상태창 클릭·창 포커스 잃음 → 모두 멈춤, 계속하기 0.5초 뒤 재개, 카드 화면에선 안 멈춤, 로비로 가면 코인 저장",
    run: new Function(PRESS + `
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      startGame();
      for (let i = 0; i < 150; i++) update(1 / 60);              // 적과 총알이 생기도록 2.5초 진행
      const snap = () => JSON.stringify([runTime, runCoins, waveCoinTime, spawnTimer, bannerTimer, player.x, player.y,
        enemies.map((e) => [e.x, e.y, e.hp]), bullets.map((b) => [b.x, b.y]), popups.length]);
      // 1) P 키
      press("KeyP"); const pP = paused; const s1 = snap();
      for (let i = 0; i < 120; i++) update(1 / 60);
      const frozen = snap() === s1;
      // 2) 계속하기 → 0.5초 동안은 여전히 멈춤, 그 뒤 움직임
      press("Escape"); const resumedFlag = !paused;
      for (let i = 0; i < 27; i++) update(1 / 60);               // 0.45초
      const stillFrozen = snap() === s1;
      for (let i = 0; i < 6; i++) update(1 / 60);                // 0.55초
      const moving = snap() !== s1;
      // 3) 창 포커스 잃음
      window.dispatchEvent(new Event("blur")); const pBlur = paused; resumeGame(); for (let i = 0; i < 40; i++) update(1 / 60);
      // 4) 상태창 클릭
      const r = canvas.getBoundingClientRect(), hp = hudPanelRect();
      canvas.dispatchEvent(new MouseEvent("click", { clientX: r.left + canvas.clientLeft + (hp.x + 60) * canvas.clientWidth / 960,
        clientY: r.top + canvas.clientTop + (hp.y + 100) * canvas.clientHeight / 540 }));
      const pClick = paused;
      // 5) 일시정지 창 버튼 위치에서 클릭 → 계속하기
      const br = pauseButtonRect(0);
      canvas.dispatchEvent(new MouseEvent("click", { clientX: r.left + canvas.clientLeft + (br.x + 20) * canvas.clientWidth / 960,
        clientY: r.top + canvas.clientTop + (br.y + 20) * canvas.clientHeight / 540 }));
      const resumedByButton = !paused && resumeTimer > 0;
      for (let i = 0; i < 40; i++) update(1 / 60);
      // 6) 카드 선택 화면에서는 P 를 눌러도 안 멈춤
      openChoiceScreen(); press("KeyP"); const noPauseInCards = !paused;
      // 7) 일시정지 → 로비로: 코인 저장
      debugMode = true; debugInvincible = true; // 이 부분은 죽지 않게
      choosingTime = 1; chooseAugment(0); for (let i = 0; i < 60 * 20; i++) update(1 / 60);
      debugMode = false;
      const earned = Math.floor(runCoins); pauseGame();
      const lb = pauseButtonRect(2);
      canvas.dispatchEvent(new MouseEvent("click", { clientX: r.left + canvas.clientLeft + (lb.x + 20) * canvas.clientWidth / 960,
        clientY: r.top + canvas.clientTop + (lb.y + 20) * canvas.clientHeight / 540 }));
      const toLobby = gameState === "menu" && loadSave().coins === earned && earned > 0;
      const ok = pP && frozen && resumedFlag && stillFrozen && moving && pBlur && pClick && resumedByButton && noPauseInCards && toLobby;
      return { ok: ok, detail: "P " + pP + " / 2초 동안 그대로 " + frozen + " / 계속 후 0.45초 멈춤 " + stillFrozen + ", 0.55초 움직임 " + moving +
        " / 포커스 잃음 " + pBlur + " / 상태창 클릭 " + pClick + " / 계속하기 버튼 " + resumedByButton + " / 카드 화면 안 멈춤 " + noPauseInCards +
        " / 로비로 코인 저장 " + toLobby + " (" + earned + ")" };
    `),
  },
  {
    name: "[체력] 세포 분열 2번 → 최대 체력 +40, 팝업·번쩍임, 체력바 길이·숫자, 다음 웨이브와 결과 화면까지 유지 / 항상성 '+N 회복'",
    run: function () {
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      startGame(); spawnQueue = []; enemies = [];
      const cell = SUPPLIES.find((s) => s.id === "cellDivision"), homeo = SUPPLIES.find((s) => s.id === "homeostasis");
      const base = player.maxHp, barBase = hpBarWidth(1000);
      const pick = (card) => { gameState = "choosing"; choices = [card]; choosingTime = 1; chooseAugment(0); };
      pick(cell);
      const popup1 = popups.some((p) => p.text === "최대 체력 +20"), flash = hpFlashTimer > 0;
      spawnQueue = []; enemies = []; checkWaveEnd();            // 웨이브 클리어 → 카드 화면
      pick(cell);
      const afterTwo = player.maxHp, waveNow = wave;
      for (let i = 0; i < 120; i++) update(1 / 60);              // 다음 웨이브 진행
      const keptInWave = player.maxHp === base + 40;
      const bar = hpBarWidth(1000);
      player.hp = 70; const text = hpText();
      endGame("gameover");
      const keptInResult = player.maxHp === base + 40 && hpText() === "70 / " + (base + 40);
      // 항상성
      startGame(); player.hp = 30; pick(homeo);
      const homeoPopup = popups.some((p) => p.text === "+40 회복");
      // 체력바 길이 상한: 최대 체력이 아주 커도 상태창 폭에서 멈춤
      player.maxHp = 1000; const capped = hpBarWidth(HUD_WIDTH - 32);
      const ok = popup1 && flash && afterTwo === base + 40 && keptInWave && waveNow >= 3 &&
        Math.abs(bar - barBase * (base + 40) / base) < 1e-9 && text === "70 / " + (base + 40) && keptInResult &&
        homeoPopup && capped === HUD_WIDTH - 32;
      return { ok: ok, detail: "최대 체력 " + base + " → " + afterTwo + " / 팝업 " + popup1 + ", 번쩍임 " + flash +
        " / 다음 웨이브 유지 " + keptInWave + " / 체력바 " + barBase + "px → " + bar.toFixed(0) + "px / 글자 '" + text + "' / 결과 화면 유지 " + keptInResult +
        " / 항상성 팝업 " + homeoPopup + " / 길이 상한 " + capped + "px" };
    },
  },
  {
    name: "[상태창] Tab·화살표로 접기/펼치기, 접은 상태 저장·다음 판 유지, 화살표 말고 나머지를 누르면 일시정지",
    run: new Function(PRESS + `
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      startGame();
      const tall = hudPanelRect().h;
      press("Tab"); const collapsed = hudCollapsed() && hudPanelRect().h === HUD_COLLAPSED_HEIGHT;
      const saved = loadSave().hudCollapsed === true;
      resetGame(); const keptNextRun = hudCollapsed();
      saveData = loadSave(); const keptReload = hudCollapsed();
      // 화살표 클릭 → 펼치기 (일시정지 안 됨)
      const r = canvas.getBoundingClientRect();
      const click = (gx, gy) => canvas.dispatchEvent(new MouseEvent("click", { clientX: r.left + canvas.clientLeft + gx * canvas.clientWidth / 960,
        clientY: r.top + canvas.clientTop + gy * canvas.clientHeight / 540 }));
      const ar = hudArrowRect(); click(ar.x + ar.w / 2, ar.y + ar.h / 2);
      const expanded = !hudCollapsed() && !paused && hudPanelRect().h === tall;
      // 나머지 부분 클릭 → 일시정지
      const p = hudPanelRect(); click(p.x + 40, p.y + p.h - 20);
      const pausedByPanel = paused && !hudCollapsed();
      draw(); // 펼친·접은 상태 모두 그리기 오류 없음
      resumeGame(); press("Tab"); draw(); press("Tab");
      const ok = collapsed && saved && keptNextRun && keptReload && expanded && pausedByPanel;
      return { ok: ok, detail: "Tab 접기 " + collapsed + " (높이 " + tall + " → " + HUD_COLLAPSED_HEIGHT + ") / 저장 " + saved + " / 다음 판 유지 " + keptNextRun +
        " / 다시 읽어도 유지 " + keptReload + " / 화살표로 펼치기(일시정지 아님) " + expanded + " / 나머지 클릭 일시정지 " + pausedByPanel };
    `),
  },
  // ---------------- 로비 ----------------
  {
    name: "[로비] 탭 3개: 클릭·←→ 로 도감/전투/업그레이드 화면이 열림, 잠긴 탭은 무시, 빨간 점, Enter 는 전투 탭에서만 시작, 결과 화면 M·U",
    run: new Function(PRESS + `
      const cr = canvas.getBoundingClientRect();
      const click = (gx, gy) => {
        const o = { clientX: cr.left + canvas.clientLeft + gx * canvas.clientWidth / 960, clientY: cr.top + canvas.clientTop + gy * canvas.clientHeight / 540 };
        canvas.dispatchEvent(new MouseEvent("mousedown", o)); canvas.dispatchEvent(new MouseEvent("click", o)); };
      const clickRect = (r) => click(r.x + r.w / 2, r.y + r.h / 2);
      const tabIndex = (id) => LOBBY_TABS.findIndex((t) => t.id === id);
      // 캔버스의 게임 좌표 (gx, gy) 픽셀 색이 탭 바 바탕색(외곽선 색)인지
      const isBarColor = (gx, gy) => { const d = ctx.getImageData(Math.floor(gx * renderScale), Math.floor(gy * renderScale), 1, 1).data;
        return d[0] === 0x2B && d[1] === 0x21 && d[2] === 0x18; };
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      goToMenu();
      const startTab = gameState === "menu" && currentTabId() === "battle";
      // 탭 클릭: 각 탭이 맞는 화면을 연다 (그릴 때 탭 바가 같이 그려지는지도 본다)
      const opened = {};
      for (const id of ["collection", "upgrades", "battle"]) {
        clickRect(tabRect(tabIndex(id)));
        draw();
        opened[id] = gameState + (isBarColor(3, CANVAS_HEIGHT - 3) ? "+탭바" : "");
      }
      const clickOk = opened.collection === "collection+탭바" && opened.upgrades === "upgrades+탭바" && opened.battle === "menu+탭바";
      // ←→ 키 (끝에서는 멈춤)
      const seq = [];
      for (const k of ["ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight", "ArrowRight"]) { press(k); seq.push(currentTabId()); }
      const arrowOk = seq.join(",") === "collection,collection,battle,upgrades,upgrades";
      // Esc = 전투 탭으로, 도감에서 Enter 는 시작 안 함
      press("Escape"); const escBack = gameState === "menu";
      openTab("collection"); press("Enter"); press("Space"); const noStartInCollection = gameState === "collection";
      // 잠긴 탭: 자물쇠, 클릭·키로 안 열림
      LOBBY_TABS.push({ id: "secret", label: "비밀", icon: "star", color: "red", locked: true }); goToMenu();
      clickRect(tabRect(LOBBY_TABS.length - 1)); press("ArrowRight"); press("ArrowRight"); openTab("secret");
      const lockedIgnored = gameState === "upgrades"; draw();
      LOBBY_TABS.pop(); goToMenu();
      // 빨간 점: 살 수 있는 업그레이드가 있을 때만
      saveData.coins = 0; const dotOff = !anyUpgradeAffordable();
      saveData.coins = 1000; const dotOn = anyUpgradeAffordable(); draw();
      saveData.coins = 0;
      // 전투 탭에서 Enter → 게임 시작, 결과 화면 M → 전투 탭, U → 업그레이드 탭
      press("Enter"); const started = gameState === "playing";
      endGame("gameover"); press("KeyM"); const resultM = gameState === "menu";
      clickRect(START_BUTTON); const startByClick = gameState === "playing";
      endGame("gameover"); press("KeyU"); const resultU = gameState === "upgrades" && enemies.length === 0;
      goToMenu();
      const ok = startTab && clickOk && arrowOk && escBack && noStartInCollection && lockedIgnored && dotOff && dotOn && started && resultM && startByClick && resultU;
      return { ok: ok, detail: "처음 " + startTab + " / 클릭 " + JSON.stringify(opened) + " / ←→ " + seq.join(",") + " / Esc " + escBack +
        " / 도감에서 Enter 무시 " + noStartInCollection + " / 잠긴 탭 무시 " + lockedIgnored + " / 빨간 점 " + dotOff + "," + dotOn +
        " / Enter 시작 " + started + " / 시작 버튼 " + startByClick + " / 결과 M " + resultM + ", U " + resultU };
    `),
  },
  {
    name: "[로비] 설정 창: 톱니로 열기, X·Esc 로 닫기, 열려 있는 동안 뒤 화면은 안 눌림, 상태창 접기·저장 초기화(두 번) 동작",
    run: new Function(PRESS + `
      const cr = canvas.getBoundingClientRect();
      const click = (gx, gy) => {
        const o = { clientX: cr.left + canvas.clientLeft + gx * canvas.clientWidth / 960, clientY: cr.top + canvas.clientTop + gy * canvas.clientHeight / 540 };
        canvas.dispatchEvent(new MouseEvent("mousedown", o)); canvas.dispatchEvent(new MouseEvent("click", o)); };
      const clickRect = (r) => click(r.x + r.w / 2, r.y + r.h / 2);
      const tabIndex = (id) => LOBBY_TABS.findIndex((t) => t.id === id);
      // 캔버스의 게임 좌표 (gx, gy) 픽셀 색이 탭 바 바탕색(외곽선 색)인지
      const isBarColor = (gx, gy) => { const d = ctx.getImageData(Math.floor(gx * renderScale), Math.floor(gy * renderScale), 1, 1).data;
        return d[0] === 0x2B && d[1] === 0x21 && d[2] === 0x18; };
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave(); saveData.coins = 300; writeSave();
      goToMenu();
      const G = GEAR_BUTTON;
      click(G.x, G.y); const openByGear = settingsOpen; draw();
      // 열려 있는 동안: 탭 위치 클릭, Enter, ←→ 는 무시
      clickRect(tabRect(tabIndex("upgrades"))); press("Enter"); press("ArrowRight");
      const blocked = settingsOpen && gameState === "menu";
      press("Escape"); const closedByEsc = !settingsOpen && gameState === "menu";
      // 업그레이드 탭에서도 열림, X 버튼으로 닫기
      openTab("upgrades"); click(G.x, G.y); const openInUpgrades = settingsOpen; draw();
      clickRect(settingsCloseRect()); const closedByX = !settingsOpen && gameState === "upgrades";
      // 상태창 접기 버튼
      click(G.x, G.y);
      const hud0 = hudCollapsed(); clickRect(settingsHudRect()); const hudToggled = hudCollapsed() === !hud0 && loadSave().hudCollapsed === !hud0;
      clickRect(settingsHudRect());
      // 저장 초기화: 한 번 = 대기, 두 번 = 초기화. 닫으면 대기 취소
      clickRect(settingsResetRect()); const armed = resetArmTimer > 0 && saveData.coins === 300; draw();
      press("Escape"); const disarmed = resetArmTimer === 0 && saveData.coins === 300;
      click(G.x, G.y); clickRect(settingsResetRect()); clickRect(settingsResetRect());
      const cleared = saveData.coins === 0 && loadSave().coins === 0 && settingsOpen; draw();
      press("Escape");
      // 설정 창이 닫힌 전투 탭에서 Esc 는 아무 일도 없음
      openTab("battle"); press("Escape"); const escIdle = gameState === "menu" && !settingsOpen;
      const ok = openByGear && blocked && closedByEsc && openInUpgrades && closedByX && hudToggled && armed && disarmed && cleared && escIdle;
      return { ok: ok, detail: "톱니로 열림 " + openByGear + " / 뒤 화면 막힘 " + blocked + " / Esc 닫기 " + closedByEsc + " / 업그레이드 탭에서 열림 " + openInUpgrades +
        ", X 닫기 " + closedByX + " / 상태창 접기 " + hudToggled + " / 초기화 대기 " + armed + ", 닫으면 취소 " + disarmed + ", 두 번이면 초기화 " + cleared + " / 전투 탭 Esc 무시 " + escIdle };
    `),
  },
  {
    name: "[로비] 게임 중(전투·카드 선택)에는 탭 바·톱니가 없음: 그 자리를 눌러도 아무 일 없음",
    run: new Function(PRESS + `
      const cr = canvas.getBoundingClientRect();
      const click = (gx, gy) => {
        const o = { clientX: cr.left + canvas.clientLeft + gx * canvas.clientWidth / 960, clientY: cr.top + canvas.clientTop + gy * canvas.clientHeight / 540 };
        canvas.dispatchEvent(new MouseEvent("mousedown", o)); canvas.dispatchEvent(new MouseEvent("click", o)); };
      const clickRect = (r) => click(r.x + r.w / 2, r.y + r.h / 2);
      const tabIndex = (id) => LOBBY_TABS.findIndex((t) => t.id === id);
      // 캔버스의 게임 좌표 (gx, gy) 픽셀 색이 탭 바 바탕색(외곽선 색)인지
      const isBarColor = (gx, gy) => { const d = ctx.getImageData(Math.floor(gx * renderScale), Math.floor(gy * renderScale), 1, 1).data;
        return d[0] === 0x2B && d[1] === 0x21 && d[2] === 0x18; };
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      startGame();
      for (let i = 0; i < 60; i++) update(1 / 60);
      const snap = () => JSON.stringify([gameState, paused, settingsOpen, wave, runTime, player.x, player.y, hudCollapsed(), enemies.length, saveData]);
      const before = snap();
      for (let i = 0; i < LOBBY_TABS.length; i++) clickRect(tabRect(i));
      click(GEAR_BUTTON.x, GEAR_BUTTON.y); press("ArrowLeft"); press("ArrowRight");
      const playingSame = snap() === before && gameState === "playing";
      draw(); const noBarPlaying = !isBarColor(3, CANVAS_HEIGHT - 3);
      // 카드 선택 화면
      openChoiceScreen(); const ch = snap();
      for (let i = 0; i < LOBBY_TABS.length; i++) clickRect(tabRect(i));
      click(GEAR_BUTTON.x, GEAR_BUTTON.y);
      const choosingSame = snap() === ch && gameState === "choosing";
      draw(); const noBarChoosing = !isBarColor(3, CANVAS_HEIGHT - 3);
      goToMenu(); draw(); const barInLobby = isBarColor(3, CANVAS_HEIGHT - 3);
      const ok = playingSame && noBarPlaying && choosingSame && noBarChoosing && barInLobby;
      return { ok: ok, detail: "전투 중 클릭 무시 " + playingSame + ", 탭 바 안 그림 " + noBarPlaying + " / 카드 화면 클릭 무시 " + choosingSame +
        ", 탭 바 안 그림 " + noBarChoosing + " / 로비에서는 탭 바 그림 " + barInLobby };
    `),
  },
  // ---------------- 압박 (초반 성장 체감) ----------------
  {
    name: "[압박] 무리 등장: WAVE_SPAWN_BATCH 마리가 서로 다른 변에서 동시에, WAVE_SPAWN_INTERVAL 간격, 적 수 = 표 × WAVE_COUNT_MULT 반올림",
    run: function () {
      startGame(); debugMode = true; debugInvincible = true;
      const table = waveGroups(WAVES[1]).reduce((a, g) => a + g.count, 0);
      const want = waveGroups(WAVES[1]).reduce((a, g) => a + Math.round(g.count * WAVE_COUNT_MULT), 0);
      enemies = []; spawnQueue = []; startWave(2); bannerTimer = 0;
      const queued = spawnQueue.length;
      const DT = 1 / 60; let t = 0; const batches = [];
      const sideOf = (e) => e.y < 0 ? "위" : e.y > CANVAS_HEIGHT ? "아래" : e.x < 0 ? "왼쪽" : "오른쪽";
      while (spawnQueue.length > 0 && t < 60) {
        player.fireTimer = 1e9;
        const before = enemies.length;
        const fresh = [];
        update(DT); t += DT;
        for (let i = before; i < enemies.length; i++) fresh.push(sideOf(enemies[i]));
        if (fresh.length) batches.push({ t: +t.toFixed(2), sides: fresh });
      }
      debugMode = false;
      const sizesOk = batches.slice(0, -1).every((b) => b.sides.length === WAVE_SPAWN_BATCH);
      const distinct = batches.every((b) => new Set(b.sides).size === Math.min(b.sides.length, 4));
      const gaps = batches.slice(1).map((b, i) => +(b.t - batches[i].t).toFixed(2));
      const gapOk = gaps.every((g) => Math.abs(g - WAVE_SPAWN_INTERVAL) < 0.05);
      const ok = queued === want && sizesOk && distinct && gapOk && batches.length === Math.ceil(want / WAVE_SPAWN_BATCH);
      return { ok: ok, detail: "2웨이브 표 " + table + "마리 × " + WAVE_COUNT_MULT + " → " + queued + "마리 (기대 " + want + ") / 무리 " +
        batches.map((b) => b.sides.join("·")).join(" | ") + " / 간격 " + gaps.join(",") };
    },
  },
  {
    name: "[압박] 과열: ENRAGE_TIME 이후 매초 ENRAGE_RATE 씩 빨라짐(복리), 플레이어 속도 × ENRAGE_MAX_PLAYER_RATIO 상한, 다음 웨이브엔 초기화, 무적 시간",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0;
      const e = createEnemy("basic", 100, 100, 1); enemies = [e, createEnemy("basic", 900, 500, 1)];
      const stepX = () => { const x0 = e.x, y0 = e.y; e.x = 100; e.y = 100; player.x = 700; player.y = 100; updateEnemies(0.1); const d = Math.hypot(e.x - 100, e.y - 100); return d / 0.1; };
      waveTime = ENRAGE_TIME - 1; const vBefore = stepX(); const calmBefore = !isEnraged();
      waveTime = ENRAGE_TIME + 10; const v10 = stepX(); const enraged = isEnraged();
      waveTime = ENRAGE_TIME + 1000; const vMax = stepX();
      const expect10 = e.speed * Math.pow(1 + ENRAGE_RATE, 10);
      draw();  // "과열!" 경고 그리기 오류 없음
      spawnQueue = []; enemies = []; checkWaveEnd(); choosingTime = 1; chooseAugment(0); const reset = gameState === "playing" && waveTime === 0 && !isEnraged();
      // 무적 시간
      enemies = [createEnemy("basic", player.x, player.y, 1)]; player.invincibleTimer = 0; updatePlayerHit(1 / 60);
      const inv = player.invincibleTimer;
      const ok = calmBefore && Math.abs(vBefore - e.speed) < 1e-6 && enraged && Math.abs(v10 - expect10) < 1e-6 &&
        Math.abs(vMax - ENRAGE_MAX_PLAYER_RATIO * PLAYER_SPEED) < 1e-6 && reset && inv === PLAYER_INVINCIBLE_TIME;
      return { ok: ok, detail: "과열 전 " + vBefore.toFixed(1) + " / 10초 뒤 " + v10.toFixed(1) + " (기대 " + expect10.toFixed(1) + ") / 상한 " + vMax.toFixed(1) +
        " / 다음 웨이브 초기화 " + reset + " / 무적 " + inv + "초" };
    },
  },
  {
    name: "[결과] 지난 최고 → 이번 웨이브, 기록을 깨면 신기록, 살 수 있는 업그레이드가 있으면 업그레이드 버튼 강조",
    run: function () {
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave(); saveData.bestWave = 3; saveData.coins = 0;
      startGame(); wave = 5; runCoins = 10; endGame("gameover");
      const rec = runPrevBestWave === 3 && saveData.bestWave === 5 && wave > runPrevBestWave; draw();
      const poor = !anyUpgradeAffordable();
      for (let i = 0; i < 30; i++) update(1 / 60); const animT = resultTime > 0.4;
      startGame(); wave = 4; runCoins = 100; endGame("gameover");
      const noRec = runPrevBestWave === 5 && saveData.bestWave === 5 && !(wave > runPrevBestWave); draw();
      const rich = anyUpgradeAffordable();
      const ok = rec && noRec && poor && rich && animT;
      return { ok: ok, detail: "3→5 신기록 " + rec + " / 5→4 신기록 아님 " + noRec + " / 코인 10: 강조 안 함 " + poor + ", 코인 110: 강조 " + rich + " / 애니메이션 시간 " + animT };
    },
  },
  // ---------------- 숫자 조절판 ----------------
  {
    name: "[조절판] tune(): 저장값 우선·정수/최솟값 다듬기·이상한 값 무시, 설정 창에서 열기(주인 비밀번호), 잠그기, 열린 동안 게임 키 무시, 적용하면 저장 후 다시 시작, Esc 닫기",
    run: new Function(PRESS + FIND_PIN + `
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave();
      const keep = tuningOverrides;
      tuningOverrides = { T_A: 1.6, WAVE_SPAWN_BATCH: 2.6, PLAYER_SPEED: "빠르게", FIRE_INTERVAL: -3 };
      const a = tune("T_A", 2), b = tune("WAVE_SPAWN_BATCH", 3), c = tune("PLAYER_SPEED", 220), d = tune("FIRE_INTERVAL", 0.4), e = tune("T_NONE", 7);
      delete tuningDefaults.T_A; delete tuningDefaults.T_NONE;
      const tuneOk = a === 1.6 && b === 3 && c === 220 && d === 0.05 && e === 7;
      tuningOverrides = {};
      // 설정 창 → 숫자 조절 버튼
      goToMenu(); openSettings();
      const cr = canvas.getBoundingClientRect(), tr = settingsTuningRect();
      canvas.dispatchEvent(new MouseEvent("click", { clientX: cr.left + canvas.clientLeft + (tr.x + 20) * canvas.clientWidth / 960,
        clientY: cr.top + canvas.clientTop + (tr.y + 20) * canvas.clientHeight / 540 }));
      // 잠겨 있으면 비밀번호 창부터: 틀리면 그대로, 맞으면 조절판이 열린다
      const askedPin = !isTuningOpen() && document.querySelector(".pin-input") !== null;
      const pin = document.querySelector(".pin-input");
      pin.value = "1234"; pin.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const wrongStays = !ownerUnlocked && !isTuningOpen() && document.querySelector(".pin-message").textContent !== "";
      pin.value = findPin(); document.querySelector(".pin-ok").click();
      const opened = askedPin && wrongStays && ownerUnlocked && isTuningOpen() && !settingsOpen && document.querySelectorAll(".tuning-row").length === Object.keys(TUNING_INFO).length;
      press("Enter"); press("ArrowLeft"); const blocked = gameState === "menu";
      // 값 바꾸고 적용 (다시 시작은 가짜로)
      let reloaded = 0; const realReload = window.tuningReload; window.tuningReload = () => { reloaded++; };
      const input = [...document.querySelectorAll(".tuning-row")].find((r) => r.textContent.includes("ENEMY_HP_BASE")).querySelector("input");
      input.value = "1.6"; input.dispatchEvent(new Event("input"));
      const marked = input.parentElement.classList.contains("tuning-changed");
      document.querySelector(".tuning-apply").click();
      const saved = JSON.parse(window.__fakeStorage[TUNING_KEY] || "{}");
      const applied = reloaded === 1 && !isTuningOpen() && saved.ENEMY_HP_BASE === 1.6 && Object.keys(saved).length === 1 && tuningActiveCount() === 1;
      draw();   // 로비 "숫자 조절 1개 적용 중"
      // 다시 열어서 Esc 로 닫기, 모두 기본값으로 적용하면 저장도 지워짐
      openTuningPanel(); document.querySelector(".tuning-row input").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const escClosed = !isTuningOpen();
      openTuningPanel(); document.querySelector(".tuning-reset").click(); document.querySelector(".tuning-apply").click();
      const cleared = !(TUNING_KEY in window.__fakeStorage) && tuningActiveCount() === 0;
      // 잠그기 버튼 → 다음에 열 때 다시 비밀번호
      openTuningPanel(); document.querySelector(".tuning-lock").click();
      openTuningPanel(); const relocked = !ownerUnlocked && !isTuningOpen() && document.querySelector(".pin-input") !== null; closePinPrompt();
      window.tuningReload = realReload; tuningOverrides = keep;
      const ok = tuneOk && opened && blocked && marked && applied && escClosed && cleared && relocked;
      return { ok: ok, detail: "tune " + [a, b, c, d, e].join(",") + " / 비밀번호 창 → 틀리면 안 열림, 맞으면 열림 " + opened + " / 잠그기 " + relocked + " / 게임 키 무시 " + blocked + " / 바꾼 줄 표시 " + marked +
        " / 적용: 저장·다시 시작 " + applied + " / Esc 닫기 " + escClosed + " / 기본값으로 적용 시 저장 지움 " + cleared };
    `),
  },
  {
    name: "[잠금] 디버그 모드: 비밀번호 없이는 F2 로 안 켜지고 디버그 키도 안 먹음, 전투 중이면 비밀번호 동안 멈춤, 맞히면 켜짐, 끄기는 언제든",
    run: new Function(PRESS + FIND_PIN + `
      for (const k in window.__fakeStorage) delete window.__fakeStorage[k];
      saveData = loadSave(); lockOwner();
      startGame(); for (let i = 0; i < 30; i++) update(1 / 60);
      press("F2");
      const asked = !debugMode && document.querySelector(".pin-input") !== null && paused;
      press("KeyC", true); press("KeyI"); const noCheat = saveData.coins === 0 && !debugInvincible;   // 창이 떠 있는 동안 게임 키 무시
      const pin = document.querySelector(".pin-input");
      pin.value = "0000"; document.querySelector(".pin-ok").click(); const wrong = !debugMode && !ownerUnlocked;
      document.querySelector(".pin-cancel").click(); const cancelled = !debugMode && !isOverlayOpen();
      press("KeyC", true); const stillOff = saveData.coins === 0;
      press("F2"); const p2 = document.querySelector(".pin-input"); p2.value = findPin();
      p2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const on = debugMode && ownerUnlocked && !isOverlayOpen();
      press("F2"); const off = !debugMode;
      press("F2"); const noAskAgain = debugMode && !isOverlayOpen();    // 한 번 맞히면 다시 안 물음
      const ok = asked && noCheat && wrong && cancelled && stillOff && on && off && noAskAgain;
      return { ok: ok, detail: "F2 → 비밀번호 창·일시정지 " + asked + " / 창 떠 있을 때 치트 키 무시 " + noCheat + " / 틀리면 안 켜짐 " + wrong +
        " / 취소 " + cancelled + " / 맞히면 켜짐 " + on + " / 끄기 " + off + " / 다시 켤 땐 안 물음 " + noAskAgain };
    `),
  },
  // ---------------- 증강 14개 준비 ----------------
  {
    name: "[준비] 총알 충돌 반지름·관통(같은 적 두 번 X), killEnemy 의 onKill(explosion 표시), damageEnemy, onEnemyUpdate 훅",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0;
      // 관통 1: 일렬로 선 적 3마리 중 앞의 2마리만 맞고 사라진다
      const es = [0, 1, 2].map((i) => { const e = createEnemy("basic", 300 + i * 40, 300, 1); e.hp = e.maxHp = 1000; return e; });
      enemies = es.slice();
      const b = createBullet(1, 0, { x: 250, y: 300, fromAugment: true }); b.pierce = 1;
      for (let i = 0; i < 30; i++) updateBullets(1 / 60);
      const hits = es.map((e) => e.hp < 1000 ? 1 : 0).join("");
      const pierceOk = hits === "110" && b.dead;
      // 반지름: 적 가장자리에서 12px 떨어진 곳을 지나가는 총알 (기본 반지름 5 → 빗나감, 15 → 맞음)
      const far = createEnemy("basic", 500, 300, 1); far.hp = far.maxHp = 1000; enemies = [far];
      const miss = createBullet(0, 1, { x: 500 + far.radius + 12, y: 200, fromAugment: true });
      for (let i = 0; i < 30; i++) updateBullets(1 / 60);
      const missed = far.hp === 1000;
      const big = createBullet(0, 1, { x: 500 + far.radius + 12, y: 200, fromAugment: true }); big.radius = 15;
      for (let i = 0; i < 30; i++) updateBullets(1 / 60);
      const radiusOk = missed && far.hp < 1000;
      // onKill: 총알 처치 / 폭발 처치 구별, onEnemyUpdate 호출
      const kills = []; let enemyUpdates = 0;
      AUGMENTS.push({ id: "probe", name: "p", levels: [{}], onKill: (st, info) => kills.push(info.explosion ? "폭발" : (info.bullet ? "총알" : "?")),
        onEnemyUpdate: () => { enemyUpdates++; } });
      ownedAugments = { probe: 1 };
      const a = createEnemy("basic", 600, 300, 1), c = createEnemy("basic", 700, 300, 1); a.hp = 1; enemies = [a, c];
      createBullet(1, 0, { x: 580, y: 300, fromAugment: true });
      for (let i = 0; i < 10; i++) updateBullets(1 / 60);
      const scoreBefore = score; damageEnemy(c, 1e6, { explosion: true }); const scored = score > scoreBefore;
      updateEnemies(1 / 60);
      AUGMENTS.pop();
      const ok = pierceOk && radiusOk && kills.join(",") === "총알,폭발" && scored && c.dead && enemyUpdates > 0;
      return { ok: ok, detail: "관통 1: 맞은 적 " + hits + " / 반지름 5 빗나감 " + missed + ", 15 맞음 " + radiusOk + " / onKill " + kills.join(",") + " / 폭발 처치 점수 " + scored };
    },
  },
  {
    name: "[증강+] 푸리에 탄환: 옆으로 A·sin(ωt) 흔들림(진폭 20/30/40, 처음 0.25초는 0→A), 앞으로는 그대로, 늘 같은 거리의 적도 맞음, 충돌 반지름 +3/+5/+7, Lv.3 관통 1",
    run: function () {
      const aug = AUGMENTS.find((a) => a.id === "fourier");
      const res = [];
      for (let lv = 1; lv <= 3; lv++) {
        startGame(); spawnQueue = []; enemies = []; ownedAugments = { fourier: lv };
        const b = createBullet(1, 0, { x: 100, y: 270, fromAugment: true });
        let maxDev = 0, worst = 0;
        for (let i = 0; i < 30; i++) {
          updateBullets(1 / 60);
          const dev = b.y - 270;                           // 옆(세로)으로 벗어난 거리
          const want = -fourierOffset(aug.levels[lv - 1].amplitude, b.age);   // 옆 방향 = 진행 방향을 90° 돌린 쪽 (처음 0.25초는 진폭이 커지는 중)
          maxDev = Math.max(maxDev, Math.abs(dev)); worst = Math.max(worst, Math.abs(Math.abs(dev) - Math.abs(want)));
        }
        const forward = (b.x - 100) / b.age;               // 앞으로 간 평균 속도
        res.push({ lv, maxDev: +maxDev.toFixed(1), worst: +worst.toFixed(1), forward: Math.round(forward), radius: b.radius, pierce: b.pierce });
      }
      // Lv.3 관통: 일렬로 선 적 3마리 중 앞의 2마리
      startGame(); spawnQueue = []; ownedAugments = { fourier: 3 };
      // (총알이 크게 흔들리므로 적을 촘촘히 세운다: 흔들림이 충돌 거리보다 작은 구간)
      const es = [0, 1, 2].map((i) => { const e = createEnemy("basic", 135 + i * 10, 270, 1); e.hp = e.maxHp = 1000; return e; });
      enemies = es.slice(); createBullet(1, 0, { x: 120, y: 270, fromAugment: true });
      for (let i = 0; i < 40; i++) updateBullets(1 / 60);
      const hits = es.map((e) => e.hp < 1000 ? 1 : 0).join("");
      // 늘 같은 거리(물결 꼭대기 근처 70~110px)에 있는 작은 적도 맞힐 수 있어야 한다 (예전에는 모두 빗나가 웨이브가 끝나지 않았다)
      const near = [];
      for (const d of [70, 90, 110]) {
        startGame(); spawnQueue = []; ownedAugments = { fourier: 1 };
        const g = createEnemy("splitterGrandchild", 400 - d, 270, 1); g.hp = g.maxHp = 1000; enemies = [g];
        const shot = createBullet(-1, 0, { x: 400, y: 270, fromAugment: true });
        for (let i = 0; i < 30 && !shot.dead; i++) updateBullets(1 / 60);
        near.push(g.hp < 1000 ? 1 : 0);
      }
      const ok = res.every((r, i) => Math.abs(r.maxDev - [20, 30, 40][i]) < 1.5 && r.worst < 3 && Math.abs(r.forward - BULLET_SPEED) < 2 &&
        r.radius === BULLET_RADIUS + [3, 5, 7][i] && r.pierce === [0, 0, 1][i]) && hits === "110" && near.join("") === "111";
      return { ok: ok, detail: res.map((r) => "Lv" + r.lv + " 최대 흔들림 " + r.maxDev + "px(오차 " + r.worst + "), 앞 속도 " + r.forward + ", 반지름 " + r.radius + ", 관통 " + r.pierce).join(" / ") + " / Lv3 맞은 적 " + hits + " / 70·90·110px 작은 적 맞음 " + near.join("") };
    },
  },
  {
    name: "[증강+] 중력 렌즈: 반경 R(80/110/140) 안의 가장 가까운 적 쪽으로 휨, 가속도 ∝ 1/r²(상한), 빠르기 그대로, 빗나갈 총알이 맞음",
    run: function () {
      const inv = gravityAccel(50) / gravityAccel(100);            // 거리 절반 → 4배
      const capped = gravityAccel(5) === GRAVITY_MAX_ACCEL;
      // 적 옆 45px 를 지나가는 총알: 렌즈 없으면 빗나감, 있으면 맞음
      const shoot = (own, offset) => {
        startGame(); spawnQueue = []; ownedAugments = own;
        const e = createEnemy("basic", 400, 270, 1); e.hp = e.maxHp = 1000; enemies = [e];
        const b = createBullet(1, 0, { x: 200, y: 270 + offset, fromAugment: true });
        let speedOk = true;
        for (let i = 0; i < 60 && !b.dead; i++) { updateBullets(1 / 60); if (!b.dead && Math.abs(Math.hypot(b.vx, b.vy) - BULLET_SPEED) > 1e-6) speedOk = false; }
        return { hit: e.hp < 1000, speedOk };
      };
      const none = shoot({}, 45), lens = shoot({ gravityLens: 1 }, 45);
      // 반경: 적 중심에서 120px 떨어진 총알은 Lv.1(80) 에서 안 휘고, Lv.3(140) 에서 휜다
      const bend = (lv) => {
        startGame(); spawnQueue = []; ownedAugments = { gravityLens: lv };
        const e = createEnemy("basic", 400, 270, 1); enemies = [e];
        const b = createBullet(1, 0, { x: 400, y: 150, fromAugment: true }); b.x = 400; updateBullets(1 / 60);
        return b.vy;   // 적은 아래쪽 → 휘면 vy > 0
      };
      const lv1 = bend(1), lv3 = bend(3);
      const ok = Math.abs(inv - 4) < 1e-9 && capped && !none.hit && lens.hit && lens.speedOk && lv1 === 0 && lv3 > 0 &&
        AUGMENTS.find((a) => a.id === "gravityLens").levels.map((l) => l.range).join(",") === "80,110,140";
      return { ok: ok, detail: "a(50)/a(100) = " + inv + ", 가까우면 상한 " + capped + " / 45px 옆: 렌즈 없음 맞음=" + none.hit + ", 렌즈 맞음=" + lens.hit +
        " (빠르기 그대로 " + lens.speedOk + ") / 120px 떨어진 적: Lv1 vy " + lv1.toFixed(1) + ", Lv3 vy " + lv3.toFixed(1) };
    },
  },
  {
    name: "[증강+] 반감기: 맞은 적이 4초 동안 매초 지금 체력의 p%(4/6/8) 잃음, 다시 맞으면 갱신, 보스는 절반, 절대 0 이 되지 않음",
    run: function () {
      const hitOnce = (e) => { const b = createBullet(1, 0, { x: e.x - 40, y: e.y, fromAugment: true }); for (let i = 0; i < 10 && !b.dead; i++) updateBullets(1 / 60); };
      const res = [];
      for (let lv = 1; lv <= 3; lv++) {
        startGame(); spawnQueue = []; ownedAugments = { halfLife: lv };
        const e = createEnemy("basic", 400, 270, 1); e.hp = e.maxHp = 1000; e.speed = 0; enemies = [e];
        hitOnce(e); const after = e.hp;
        for (let i = 0; i < 60; i++) updateEnemies(1 / 60);
        res.push(1 - e.hp / after);                       // 1초 동안 잃은 비율
      }
      // 4초 뒤 멈춤, 다시 맞으면 갱신
      startGame(); spawnQueue = []; ownedAugments = { halfLife: 1 };
      const e = createEnemy("basic", 400, 270, 1); e.hp = e.maxHp = 1000; e.speed = 0; enemies = [e];
      hitOnce(e);
      for (let i = 0; i < 60 * 3; i++) updateEnemies(1 / 60);
      hitOnce(e); const refreshed = e.decayTime === HALFLIFE_DURATION;
      for (let i = 0; i < 60 * 4 + 5; i++) updateEnemies(1 / 60);
      const h = e.hp; for (let i = 0; i < 60; i++) updateEnemies(1 / 60); const stopped = e.hp === h;
      // 체력이 아주 작아도 0 이 되지 않음 (1000초 동안 붕괴)
      e.hp = 0.001; e.decayTime = 1e9; e.decayRate = 0.08;
      for (let i = 0; i < 1000; i++) updateEnemies(1); const neverZero = e.hp > 0 && enemies.includes(e);
      // 보스는 절반
      const boss = createEnemy("splitterKing", 300, 270, 1); boss.speed = 0; enemies = [boss]; hitOnce(boss);
      const bossRate = boss.decayRate;
      draw();   // 점선 고리 그리기 오류 없음
      const ok = res.every((r, i) => Math.abs(r - [0.04, 0.06, 0.08][i]) < 1e-6) && refreshed && stopped && neverZero && Math.abs(bossRate - 0.02) < 1e-12;
      return { ok: ok, detail: "1초 동안 잃은 비율 " + res.map((r) => (r * 100).toFixed(2) + "%").join(", ") + " / 다시 맞으면 4초 갱신 " + refreshed +
        " / 4초 뒤 멈춤 " + stopped + " / 0 이 안 됨 " + neverZero + " (1000초 뒤 체력 " + e.hp.toExponential(1) + ") / 보스 붕괴율 " + bossRate };
    },
  },
  {
    name: "[증강+] 발열 반응: 처치하면 반경 R(60/80/100) 안 적에게 최대 체력 × q(15/20/25%), 폭발로 죽은 적은 다시 안 터짐",
    run: function () {
      const res = [];
      for (let lv = 1; lv <= 3; lv++) {
        startGame(); spawnQueue = []; ownedAugments = { exothermic: lv };
        const R = [60, 80, 100][lv - 1], q = [0.15, 0.2, 0.25][lv - 1];
        const dead = createEnemy("basic", 400, 270, 1); dead.hp = 1;
        const inside = createEnemy("basic", 400 + R - 2, 270, 1), outside = createEnemy("basic", 400 - R - 4, 270, 1);
        inside.hp = inside.maxHp = 10000; outside.hp = outside.maxHp = 10000;
        enemies = [dead, inside, outside];
        const b = createBullet(0, 1, { x: 400, y: 230, fromAugment: true }); for (let i = 0; i < 10 && !b.dead; i++) updateBullets(1 / 60);
        res.push({ lv, dealt: +(10000 - inside.hp).toFixed(3), want: +(dead.maxHp * q).toFixed(3), out: outside.hp === 10000 });
      }
      // 연쇄 없음: A 처치 → B(폭발로 죽음) → B 옆의 C 는 안 맞음
      startGame(); spawnQueue = []; ownedAugments = { exothermic: 1 };
      const A = createEnemy("basic", 300, 270, 1), B = createEnemy("basic", 350, 270, 1), C = createEnemy("basic", 400, 270, 1);
      A.hp = 1; B.hp = 1; C.hp = C.maxHp = 10000; enemies = [A, B, C];
      const b2 = createBullet(0, 1, { x: 300, y: 230, fromAugment: true }); for (let i = 0; i < 10 && !b2.dead; i++) updateBullets(1 / 60);
      const chainOk = A.dead && B.dead && C.hp === 10000;
      draw();
      const ok = res.every((r) => Math.abs(r.dealt - r.want) < 1e-6 && r.out) && chainOk;
      return { ok: ok, detail: res.map((r) => "Lv" + r.lv + " 안쪽 적 " + r.dealt + " (기대 " + r.want + "), 바깥 안 맞음 " + r.out).join(" / ") + " / 폭발로 죽은 적은 안 터짐 " + chainOk };
    },
  },
  {
    name: "[증강+] 르샤틀리에: 대미지 배율 = 1 + k(1 − 체력 비율), k = 0.5/0.8/1.2",
    run: function () {
      const rows = [];
      for (let lv = 1; lv <= 3; lv++) {
        startGame(); ownedAugments = { leChatelier: lv }; player.maxHp = 200;
        const k = [0.5, 0.8, 1.2][lv - 1];
        const at = (hp) => { player.hp = hp; return calcDamage({}, { damageScale: 1 }) / player.damage; };
        rows.push({ lv, full: at(200), half: at(100), near0: at(1), want: [1, 1 + k * 0.5, 1 + k * (1 - 1 / 200)] });
      }
      const ok = rows.every((r) => Math.abs(r.full - r.want[0]) < 1e-12 && Math.abs(r.half - r.want[1]) < 1e-12 && Math.abs(r.near0 - r.want[2]) < 1e-12);
      return { ok: ok, detail: rows.map((r) => "Lv" + r.lv + " 체력 100% ×" + r.full.toFixed(2) + ", 50% ×" + r.half.toFixed(2) + ", 거의 0 ×" + r.near0.toFixed(3)).join(" / ") };
    },
  },
  {
    name: "[증강+] 증강 14개·보급 5개, 이름·id 겹침 없음",
    run: function () {
      const ids = AUGMENTS.map((a) => a.id).concat(SUPPLIES.map((s) => s.id));
      const ok = AUGMENTS.length === 14 && SUPPLIES.length === 5 && new Set(ids).size === ids.length;
      return { ok: ok, detail: "증강 " + AUGMENTS.length + "개, 보급 " + SUPPLIES.length + "개 / " + ids.join(",") };
    },
  },
  // ---------------- 보급 카드 3개 ----------------
  {
    name: "[보급+] ATP 충전: 다음 웨이브 동안 발사 간격 30% 감소 (촉매와 곱해짐), 웨이브를 깨면 끝, 상태창 아이콘",
    run: function () {
      startGame(); spawnQueue = []; enemies = [];
      const base = fireInterval();
      const atp = SUPPLIES.find((c) => c.id === "atp");
      checkWaveEnd(); choices = [atp]; choosingTime = 1; chooseAugment(0);      // 카드로 고르고 다음 웨이브 시작
      const during = fireInterval(), icons = activeEffectIcons().map((i) => i.icon).join(",");
      ownedAugments = { catalyst: 1 }; const withCat = fireInterval();
      draw();
      spawnQueue = []; enemies = []; checkWaveEnd();                              // 그 웨이브를 깨면 끝
      const after = fireInterval();
      const ok = Math.abs(during - base * 0.7) < 1e-12 && Math.abs(withCat - base * 0.8 * 0.7) < 1e-12 && icons === "bolt" &&
        Math.abs(after - base * 0.8) < 1e-12 && player.tempEffects.length === 0;
      return { ok: ok, detail: "간격 " + base + " → " + during.toFixed(3) + " (촉매와 함께 " + withCat.toFixed(3) + ") / 아이콘 " + icons + " / 웨이브 뒤 " + after.toFixed(3) };
    },
  },
  {
    name: "[보급+] 면역 반응: 다음 웨이브 동안 피격 2회를 대미지 없이 막음, 3번째부터 맞음, 고리·아이콘(남은 횟수), 웨이브를 깨면 끝",
    run: function () {
      startGame(); spawnQueue = []; enemies = [];
      applySupply(SUPPLIES.find((c) => c.id === "immune"));
      const hp0 = player.hp, log = [];
      for (let n = 0; n < 3; n++) {
        enemies = [createEnemy("basic", player.x, player.y, 1)]; player.invincibleTimer = 0;
        updatePlayerHit(1 / 60);
        const sh = getTempEffect("immune");
        log.push(player.hp + "/" + (sh ? sh.charges : 0));
        if (n === 0) { draw(); var badge = activeEffectIcons()[0].badge; }
      }
      const blockedTwice = log[0] === hp0 + "/1" && log[1] === hp0 + "/0" && player.hp < hp0;
      applySupply(SUPPLIES.find((c) => c.id === "immune")); spawnQueue = []; enemies = []; checkWaveEnd();
      const cleared = !getTempEffect("immune");
      const ok = blockedTwice && badge === "1" && cleared && popups.some((p) => p.text === "막음!");
      return { ok: ok, detail: "피격 3번: " + log.join(" → ") + " (체력/남은 보호막) / 아이콘 숫자 " + badge + " / 웨이브 뒤 끝 " + cleared };
    },
  },
  {
    name: "[보급+] 광합성: 이번 판 동안 웨이브 클리어 회복 +5%p, 여러 번 쌓임, 다음 판엔 초기화, 아이콘 +N%",
    run: function () {
      startGame(); spawnQueue = []; enemies = []; player.maxHp = 200;
      const photo = SUPPLIES.find((c) => c.id === "photosynthesis");
      const h0 = waveClearHeal();
      applySupply(photo); const h1 = waveClearHeal();
      applySupply(photo); const h2 = waveClearHeal();
      const badge = activeEffectIcons().find((i) => i.icon === "leaf").badge;
      player.hp = 50; checkWaveEnd(); const healed = player.hp;                   // 웨이브 클리어: 200 × (0.05 + 0.1)
      const keptAfterWave = player.healBonus > 0;
      startGame(); const reset = player.healBonus === 0;
      const ok = Math.abs(h1 - h0 - 200 * 0.05) < 1e-9 && Math.abs(h2 - h0 - 200 * 0.1) < 1e-9 &&
        Math.abs(healed - (50 + 200 * (WAVE_CLEAR_HEAL_RATIO + 0.1))) < 1e-9 && keptAfterWave && reset && badge === "+10%";
      return { ok: ok, detail: "회복량 " + h0 + " → " + h1 + " → " + h2 + " / 웨이브 클리어 50 → " + healed + " / 웨이브 뒤에도 유지 " + keptAfterWave + " / 새 판 초기화 " + reset + " / 아이콘 " + badge };
    },
  },
  {
    name: "[보급+] 체력이 낮을 때 반드시 나오는 보급은 회복 카드(항상성·세포 분열)만, 보급 모두 카드에 나올 수 있음",
    run: function () {
      startGame(); player.hp = 10;
      const seen = new Set(), rescueOnly = [];
      for (let i = 0; i < 300; i++) {
        ownedAugments = {}; const picks = pickChoices();
        const sup = picks.filter((c) => c.isSupply); if (sup.length) rescueOnly.push(sup.every((c) => c.rescue));
      }
      // 증강을 모두 최대로 → 카드 3장이 모두 보급 (5개 중에서 무작위)
      const maxed = {}; for (const a of AUGMENTS) maxed[a.id] = a.levels.length;
      player.hp = player.maxHp;
      for (let i = 0; i < 200; i++) { ownedAugments = maxed; for (const c of pickChoices()) seen.add(c.id); }
      const ok = rescueOnly.length > 0 && rescueOnly.every(Boolean) && seen.size === SUPPLIES.length;
      return { ok: ok, detail: "저체력 보장 " + rescueOnly.length + "번 모두 회복 카드 " + rescueOnly.every(Boolean) + " / 나온 보급 " + [...seen].join(",") };
    },
  },
  {
    name: "[도감] 적·증강·보급 세 쪽: 버튼 클릭·1/2/3 키로 넘김, 증강 14개·보급 5개가 모두 나오고 글자가 칸 안에 들어감",
    run: new Function(PRESS + `
      goToMenu(); openTab("collection");
      const cr = canvas.getBoundingClientRect();
      const clickRect = (r) => canvas.dispatchEvent(new MouseEvent("click", { clientX: cr.left + canvas.clientLeft + (r.x + r.w / 2) * canvas.clientWidth / 960,
        clientY: cr.top + canvas.clientTop + (r.y + r.h / 2) * canvas.clientHeight / 540 }));
      clickRect(collectionPageRect(1)); const byClick = collectionPage === "augments"; draw();
      press("Digit3"); const byKey = collectionPage === "supplies"; draw();
      press("Digit1"); const back = collectionPage === "enemies"; draw();
      const counts = [collectionItems("enemies").length, collectionItems("augments").length, collectionItems("supplies").length].join("/");
      // 가장 작은 글자(12px)로 줄여도 칸을 넘는 글자가 있는지
      const tooWide = [];
      const check = (text, size, max, label) => { ctx.font = Math.max(12, fitTextSize(text, size, max)) + "px " + FONT_FAMILY; if (ctx.measureText(text).width > max + 0.5) tooWide.push(label); };
      const ecols = Math.ceil(COLLECTION_ENEMIES.length / 2);
      COLLECTION_ENEMIES.forEach((id, i) => { const c = collectionCell(i, COLLECTION_ENEMIES.length, ecols); check(ENEMY_TYPES[id].name, 17, c.w - 12, ENEMY_TYPES[id].name); check(ENEMY_TYPES[id].desc, 12, c.w - 10, ENEMY_TYPES[id].desc); });
      AUGMENTS.forEach((a, i) => { const c = collectionCell(i, AUGMENTS.length, 5); check(a.name, 17, c.w - 16, a.name); check(a.formula, 19, c.w - 14, a.formula); check(a.concept, 13, c.w - 12, a.concept); });
      SUPPLIES.forEach((card, i) => { const c = collectionCell(i, SUPPLIES.length, 5); check(card.formula, 20, c.w - 14, card.formula);
        if (wrapText(card.desc, c.w - 20, 14).length > 7) tooWide.push(card.name + " 설명 줄 수"); });
      const ok = byClick && byKey && back && counts === COLLECTION_ENEMIES.length + "/14/5" && tooWide.length === 0;
      return { ok: ok, detail: "클릭 " + byClick + " / 키 " + byKey + "," + back + " / 항목 수 " + counts + " / 넘치는 글자 " + (tooWide.join(",") || "없음") };
    `),
  },
  {
    name: "[일시정지] 증강 14개를 모두 가져도 '가진 증강' 목록이 창 안에 들어감 (설명을 줄이다 안 되면 이름·수식만)",
    run: function () {
      startGame(); for (const a of AUGMENTS) ownedAugments[a.id] = 3;
      const owned = AUGMENTS.slice();
      const fits = [];
      for (const n of [3, 6, 9, 14]) {
        const layout = layoutPauseAugments(owned.slice(0, n), PAUSE_PANEL.w - 360, PAUSE_PANEL.h - 80);   // drawPauseScreen 과 같은 영역
        const total = layout.items.reduce((t, it) => t + it.h, 0);
        fits.push(n + "개 " + total + "px");
        if (total > PAUSE_PANEL.h - 80) return { ok: false, detail: "넘침: " + fits.join(", ") };
      }
      pauseGame(); draw();
      return { ok: true, detail: fits.join(", ") + " (영역 380px)" };
    },
  },
  {
    name: "[디버그] G 창에서 증강 삭제: − 는 레벨 −1 (Lv.1 에서 누르면 삭제), 모두 삭제, 레벨 0 이면 − 버튼 잠김, 효과도 사라짐",
    run: new Function(PRESS + `
      startGame(); ownerUnlocked = true; press("F2"); spawnQueue = [];
      ownedAugments = { catalyst: 3, fourier: 1, halfLife: 2 };
      press("KeyG");
      const cellOf = (id) => document.querySelectorAll(".give-cell")[AUGMENTS.findIndex((a) => a.id === id)];
      const minus = (id) => cellOf(id).querySelector(".give-minus");
      const interval0 = fireInterval();
      minus("catalyst").click(); const down = getAugmentLevel("catalyst") === 2 && fireInterval() > interval0;
      minus("fourier").click(); const removed = !("fourier" in ownedAugments) && minus("fourier").disabled;
      const plusText = cellOf("catalyst").querySelector(".give-plus").textContent.includes("Lv.2");
      // 지운 증강은 효과도 없음: 반감기를 지우면 붕괴가 멈춘다
      const e = createEnemy("basic", 400, 270, 1); e.hp = e.maxHp = 1000; e.speed = 0; e.decayTime = 4; e.decayRate = 0.06; enemies = [e];
      document.querySelector(".give-clear").click();
      const allGone = Object.keys(ownedAugments).length === 0 && document.querySelector(".give-clear").disabled &&
        [...document.querySelectorAll(".give-minus")].every((b) => b.disabled);
      const hp = e.hp; updateEnemies(1); const noDecay = e.hp === hp;
      press("Escape");
      const ok = down && removed && plusText && allGone && noDecay;
      return { ok: ok, detail: "촉매 Lv3→2 (간격도 돌아옴) " + down + " / 푸리에 Lv1 에서 − → 삭제, 버튼 잠김 " + removed + " / 글자 갱신 " + plusText +
        " / 모두 삭제 " + allGone + " / 지운 반감기는 붕괴 멈춤 " + noDecay };
    `),
  },
  // ---------------- 4단계 A: 적 탄환 ----------------
  {
    name: "[적탄] 속도 160, 맞으면 기본 대미지 × 웨이브 접촉 배율 + 무적(무적 중엔 통과), 면역 보호막이 막음, 시간 지연 범위에서 느려짐, 웨이브 끝나면 사라짐",
    run: function () {
      startGame(); spawnQueue = []; enemies = [createEnemy("basic", 900, 500, 1)]; enemies[0].speed = 0;
      player.x = 480; player.y = 270; player.vx = 0; player.vy = 0;
      // 1) 속도
      const b = spawnEnemyBullet(100, 100, 0, { damage: 10 });
      updateEnemyBullets(0.5); const speed = (b.x - 100) / 0.5;
      // 2) 맞기: 왼쪽 60px 에서 플레이어 쪽으로
      enemyBullets = []; const hp0 = player.hp;
      spawnEnemyBullet(420, 270, 0, { damage: 10 });
      for (let i = 0; i < 40; i++) updateEnemyBullets(1 / 60);
      const dmg = hp0 - player.hp, inv = player.invincibleTimer > 0;
      // 무적 중에 온 총알은 통과
      const hp1 = player.hp; const pass = spawnEnemyBullet(420, 270, 0, { damage: 10 });
      for (let i = 0; i < 20; i++) updateEnemyBullets(1 / 60);
      const passed = player.hp === hp1 && !pass.dead;
      // 3) 면역 보호막
      enemyBullets = []; player.invincibleTimer = 0; applySupply(SUPPLIES.find((c) => c.id === "immune"));
      const hp2 = player.hp; spawnEnemyBullet(420, 270, 0, { damage: 10 });
      for (let i = 0; i < 40; i++) updateEnemyBullets(1 / 60);
      const blocked = player.hp === hp2 && getTempEffect("immune").charges === 1;
      // 4) 시간 지연: 플레이어가 최고 속도로 움직일 때 범위 안의 탄환은 느려짐, 밖은 그대로
      enemyBullets = []; ownedAugments = { timeDilation: 1 }; player.vx = PLAYER_SPEED; player.vy = 0;
      const near = spawnEnemyBullet(player.x, player.y - 60, 0), far = spawnEnemyBullet(player.x, player.y - 200, 0);
      updateEnemyBullets(0.1);
      const slowNear = near.slowFactor < 1 && Math.abs((near.x - player.x) / 0.1 - ENEMY_BULLET_SPEED * near.slowFactor) < 1e-6, normalFar = far.slowFactor === 1;
      draw();
      // 5) 웨이브 끝 → 사라짐
      spawnQueue = []; enemies = []; checkWaveEnd(); const cleared = enemyBullets.length === 0;
      const ok = Math.abs(speed - 160) < 1e-9 && Math.abs(dmg - 10 * waveDamageMult(1)) < 1e-9 && inv && passed && blocked && slowNear && normalFar && cleared;
      return { ok: ok, detail: "속도 " + speed + " / 대미지 " + dmg + " (10 × " + waveDamageMult(1) + "), 무적 " + inv + ", 무적 중 통과 " + passed + " / 보호막 " + blocked +
        " / 시간 지연 안 " + near.slowFactor.toFixed(2) + "배, 밖 " + far.slowFactor + "배 / 웨이브 끝 사라짐 " + cleared };
    },
  },
  // ---------------- 4단계 B: 새 적 ----------------
  {
    name: "[새 적] 사수형: 250px 거리 유지, 2.5초마다 조준탄 1발, 쏘기 0.5초 전 깜빡임, 조준탄은 쏜 순간의 플레이어 쪽으로",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0; debugMode = true; debugInvincible = true;
      player.x = 480; player.y = 270;
      const e = createEnemy("shooter", 80, 270, 1); enemies = [e];
      const shots = [], flashBefore = [];
      let t = 0, lastFlash = false, flashStart = 0;
      for (let f = 0; f < 60 * 12; f++) {
        player.fireTimer = 1e9; player.x = 480; player.y = 270;
        const n = enemyBullets.length;
        update(1 / 60); t += 1 / 60;
        if (e.chargeFlash && !lastFlash) flashStart = t;
        lastFlash = e.chargeFlash;
        if (enemyBullets.length > n) {
          const b = enemyBullets[enemyBullets.length - 1];
          const aimErr = Math.abs(Math.atan2(b.vy, b.vx) - Math.atan2(270 - b.y, 480 - b.x));
          shots.push({ t: +t.toFixed(2), aimErr });
          flashBefore.push(+(t - flashStart).toFixed(2));
        }
      }
      debugMode = false;
      const dist = distance(e.x, e.y, 480, 270);
      const gaps = shots.slice(1).map((s, i) => +(s.t - shots[i].t).toFixed(2));
      const ok = shots.length >= 4 && gaps.every((g) => Math.abs(g - 2.5) < 0.05) && flashBefore.every((f) => Math.abs(f - 0.5) < 0.05) &&
        shots.every((s) => s.aimErr < 0.05) && Math.abs(dist - SHOOTER_RANGE) <= SHOOTER_RANGE_SLACK + 2;
      return { ok: ok, detail: "발사 " + shots.length + "번, 간격 " + gaps.join(",") + " / 깜빡임 시작 → 발사 " + flashBefore.join(",") + "초 / 12초 뒤 거리 " + dist.toFixed(0) + "px" };
    },
  },
  {
    name: "[새 적] 방패형: 앞 120° 에 맞으면 대미지 80% 감소, 옆·뒤는 그대로, 방패는 초당 60° 까지만 돎, 반감기·발열 반응은 방패 무시",
    run: function () {
      const hitFrom = (angleDeg) => {   // 방패는 0°(오른쪽)를 보고 있을 때, angleDeg 방향에서 날아온 총알
        startGame(); spawnQueue = []; ownedAugments = {};
        const e = createEnemy("shield", 480, 270, 1); e.hp = e.maxHp = 1000; e.shieldAngle = 0; e.speed = 0; enemies = [e];
        const a = angleDeg * Math.PI / 180;
        const b = createBullet(-Math.cos(a), -Math.sin(a), { x: 480 + Math.cos(a) * 60, y: 270 + Math.sin(a) * 60, fromAugment: true });
        for (let i = 0; i < 20 && !b.dead; i++) updateBullets(1 / 60);
        return 1000 - e.hp;
      };
      const front = hitFrom(0), edgeIn = hitFrom(55), side = hitFrom(90), back = hitFrom(180);
      // 방패 회전 빠르기: 플레이어가 뒤쪽(180°)에 있으면 1초에 60° 만 돈다
      startGame(); spawnQueue = [];
      const e = createEnemy("shield", 480, 270, 1); e.shieldAngle = 0; e.speed = 0; enemies = [e];
      player.x = 300; player.y = 270;
      for (let i = 0; i < 60; i++) { player.x = 300; player.y = 270; player.fireTimer = 1e9; updateEnemies(1 / 60); }
      const turned = Math.abs(e.shieldAngle) * 180 / Math.PI;
      // 총알이 아닌 대미지: 발열 반응 폭발(damageEnemy)과 반감기 붕괴는 방패를 무시한다
      e.hp = e.maxHp = 1000; e.shieldAngle = 0;
      damageEnemy(e, 100, { explosion: true }); const exoFull = e.hp === 900;
      ownedAugments = { halfLife: 1 }; e.decayTime = 4; e.decayRate = 0.04; updateEnemies(1);
      const decayFull = Math.abs(e.hp - 900 * 0.96) < 1e-6;
      draw();
      const ok = Math.abs(front - 10 * 0.2) < 1e-9 && Math.abs(edgeIn - 2) < 1e-9 && side === 10 && back === 10 && Math.abs(turned - 60) < 1 && exoFull && decayFull;
      return { ok: ok, detail: "앞 " + front + " / 55° " + edgeIn + " / 옆 " + side + " / 뒤 " + back + " (기본 10) / 1초 동안 방패 " + turned.toFixed(1) + "° 회전 / 발열 반응 그대로 " + exoFull + ", 반감기 그대로 " + decayFull };
    },
  },
  {
    name: "[새 적] 공명형: 반경 150px 안의 다른 적 속도 ×1.3 (여러 마리여도 겹치지 않음), 범위 밖·자기 자신은 그대로, 플레이어에게서 도망",
    run: function () {
      startGame(); spawnQueue = [];
      const r1 = createEnemy("resonator", 480, 270, 1), r2 = createEnemy("resonator", 500, 270, 1);
      const near = createEnemy("basic", 560, 270, 1), far = createEnemy("basic", 480 + 200, 100, 1);
      enemies = [r1, near, far];
      const one = resonanceFactor(near), outside = resonanceFactor(far), self = resonanceFactor(r1);
      enemies = [r1, r2, near, far]; const two = resonanceFactor(near);
      // 실제 이동 속도: 1초 동안 움직인 거리
      player.x = 900; player.y = 270; enemies = [r1, near]; r1.speed = 0;
      const x0 = near.x; updateEnemies(1 / 60);
      const moved = (near.x - x0) * 60;   // 한 프레임 이동 × 60 = 초당 속도 (범위를 벗어나기 전에 잰다)
      // 도망: 플레이어가 가까이 있으면 멀어진다 (화면 안쪽에 머문다)
      startGame(); spawnQueue = [];
      const r = createEnemy("resonator", 480, 270, 1); r.entered = true; enemies = [r];
      player.x = 430; player.y = 270;
      for (let i = 0; i < 180; i++) { player.x = 430; player.y = 270; player.fireTimer = 1e9; updateEnemies(1 / 60); }
      const fled = distance(r.x, r.y, 430, 270), inside = r.x >= RESONATOR_MARGIN && r.x <= CANVAS_WIDTH - RESONATOR_MARGIN;
      draw();
      const ok = one === 1.3 && two === 1.3 && outside === 1 && self === 1 && Math.abs(moved - near.speed * 1.3) < 1e-6 && fled > 200 && inside;
      return { ok: ok, detail: "범위 안 ×" + one + ", 두 마리 겹쳐도 ×" + two + ", 밖 ×" + outside + ", 자기 자신 ×" + self + " / 속도 " + moved.toFixed(1) + "px (기본 " + near.speed + ") / 3초 뒤 플레이어와 거리 " + fled.toFixed(0) + "px" };
    },
  },
  {
    name: "[새 적] 자석형: 반경 220px 안의 플레이어를 끌어당김, 가속도 ∝ 1/r² (상한 = 플레이어 가속도의 40%), 범위 밖은 0, 도망치면 벗어날 수 있음",
    run: function () {
      startGame(); spawnQueue = [];
      const m = createEnemy("magnet", 480, 270, 1); m.speed = 0; enemies = [m];
      const T = ENEMY_TYPES.magnet;
      const a = (d) => { const v = T.pullOn(m, 480 + d, 270); return Math.hypot(v.ax, v.ay); };
      const ratio = a(100) / a(200), cap = a(30), outside = a(230), dir = T.pullOn(m, 600, 270).ax < 0;
      // 가만히 서 있으면 끌려간다
      player.x = 640; player.y = 270; player.vx = 0; player.vy = 0;
      for (const k in keys) keys[k] = false;
      for (let i = 0; i < 60; i++) { updatePlayer(1 / 60); }
      const pulled = 640 - player.x;
      // 반대쪽으로 달리면 벗어난다
      player.x = 640; player.vx = 0; player.pullVx = 0; keys.KeyD = true;
      for (let i = 0; i < 120; i++) updatePlayer(1 / 60);
      keys.KeyD = false;
      const escaped = player.x > 640 + 150;
      draw();
      const ok = Math.abs(ratio - 4) < 1e-9 && Math.abs(cap - PLAYER_ACCELERATION * 0.4) < 1e-9 && outside === 0 && dir && pulled > 10 && escaped;
      return { ok: ok, detail: "a(100)/a(200) = " + ratio + ", 가까우면 상한 " + cap + " px/초², 범위 밖 " + outside + " / 1초 서 있으면 " + pulled.toFixed(1) + "px 끌려감 / 2초 달리면 벗어남 " + escaped + " (x " + player.x.toFixed(0) + ")" };
    },
  },
  {
    name: "[새 적] 새 적 4종 모두 시간 지연(속도 배율)·과열을 받음, 웨이브 배율 적용, 도감에 등록",
    run: function () {
      const ids = ["shooter", "shield", "resonator", "magnet"];
      const res = [];
      for (const id of ids) {
        const step = (setup) => {
          startGame(); spawnQueue = []; ownedAugments = {}; AUGMENTS.push({ id: "slow", name: "s", levels: [{}], modifyEnemySpeed: (f) => f * 0.5 });
          const e = createEnemy(id, 480, 100, 1); e.entered = true; enemies = [e]; player.x = 480; player.y = 500;
          if (id === "resonator") { player.x = 480; player.y = 130; }   // 공명형은 도망치는 쪽으로 잰다
          setup();
          const x0 = e.x, y0 = e.y; updateEnemies(1 / 60);
          AUGMENTS.pop();
          return Math.hypot(e.x - x0, e.y - y0);
        };
        const normal = step(() => {}), slow = step(() => { ownedAugments = { slow: 1 }; }), enraged = step(() => { waveTime = ENRAGE_TIME + 10; });
        const e10 = createEnemy(id, 0, 0, 10), e1 = createEnemy(id, 0, 0, 1);
        res.push({ id, slowRatio: slow / normal, enrageRatio: enraged / normal, hpScaled: Math.abs(e10.maxHp / e1.maxHp - waveHpMult(10) / waveHpMult(1)) < 1e-9 });
      }
      const inCollection = ids.every((id) => COLLECTION_ENEMIES.includes(id) && ENEMY_TYPES[id].desc);
      // (공명형은 옆으로 흔들리는 박자도 이 적의 시계로 흘러서 정확히 0.5배는 아니다)
      const ok = res.every((r) => Math.abs(r.slowRatio - 0.5) < 0.06 && r.enrageRatio > 1.2 && r.hpScaled) && inCollection;
      return { ok: ok, detail: res.map((r) => r.id + " 시간 지연 ×" + r.slowRatio.toFixed(2) + ", 과열 ×" + r.enrageRatio.toFixed(2) + ", 체력 배율 " + r.hpScaled).join(" / ") + " / 도감 " + inCollection };
    },
  },
  // ---------------- 4단계 C: 새 보스 ----------------
  {
    name: "[새 보스] 파동 군주: 위쪽에서 x = 가운데 + A·sin(ωt), 3초마다 12발(30° 간격), 체력 50% 아래면 0.5초 뒤 15° 어긋난 두 번째 겹",
    run: function () {
      const run = (hpRatio) => {
        startGame(); spawnQueue = []; bannerTimer = 0; debugMode = true; debugInvincible = true;
        const b = createEnemy("waveLord", 480, -34, 15); enemies = [b];
        const rings = []; let t = 0, xs = [];
        for (let f = 0; f < 60 * 13; f++) {
          player.fireTimer = 1e9; player.x = 480; player.y = 480; b.hp = b.maxHp * hpRatio;
          const n = enemyBullets.length; update(1 / 60); t += 1 / 60;
          if (enemyBullets.length > n) rings.push({ t: +t.toFixed(2), n: enemyBullets.length - n, a: enemyBullets.slice(n).map((q) => Math.atan2(q.vy, q.vx)) });
          if (b.state === "wave") xs.push([b.waveT, b.x]);
        }
        debugMode = false;
        const sineErr = Math.max(...xs.map(([wt, x]) => Math.abs(x - (480 + WL_AMPLITUDE * Math.sin(WL_OMEGA * wt)))));
        return { rings, sineErr, y: b.y };
      };
      const calm = run(1), angry = run(0.4);
      const gaps = calm.rings.slice(1).map((r, i) => +(r.t - calm.rings[i].t).toFixed(2));
      const spacing = calm.rings[0].a.map((a, i, arr) => { const d = ((arr[(i + 1) % 12] - a) * 180 / Math.PI + 360) % 360; return Math.round(d); });
      const pairGap = +(angry.rings[1].t - angry.rings[0].t).toFixed(2);
      const offset = Math.round((((angry.rings[1].a[0] - angry.rings[0].a[0]) * 180 / Math.PI) % 30 + 30) % 30);
      const ok = calm.rings.every((r) => r.n === 12) && gaps.every((g) => Math.abs(g - 3) < 0.05) && spacing.every((d) => d === 30) &&
        calm.sineErr < 1e-6 && calm.y < 120 && Math.abs(pairGap - 0.5) < 0.05 && offset === 15;
      return { ok: ok, detail: "탄막 " + calm.rings.length + "번 (각 " + calm.rings[0].n + "발, 간격 " + gaps.join(",") + "초, 각도 간격 " + [...new Set(spacing)].join(",") + "°) / 사인 곡선 오차 " + calm.sineErr.toExponential(1) +
        " / 화나면: 두 번째 겹 " + pairGap + "초 뒤, " + offset + "° 어긋남" };
    },
  },
  {
    name: "[새 보스] 회전 포대: 가운데에 자리, 4방향 총구로 계속 발사, 체력이 줄수록 ω 증가, 10초마다 방향 반대 (1초 전 예고)",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0; debugMode = true; debugInvincible = true;
      const b = createEnemy("turret", 480, -36, 20); enemies = [b];
      let t = 0, centerAt = null; const flips = [], warnStarts = []; let lastDir = 1, lastWarn = false; let burst = 0;
      for (let f = 0; f < 60 * 26; f++) {
        player.fireTimer = 1e9; player.x = 100; player.y = 480;
        const n = enemyBullets.length; update(1 / 60); t += 1 / 60;
        if (b.state === "spin" && centerAt === null) centerAt = +t.toFixed(2);
        if (enemyBullets.length > n) burst = enemyBullets.length - n;
        if (b.flipWarn && !lastWarn) warnStarts.push(+t.toFixed(2));
        if (b.spinDir !== lastDir) { flips.push(+t.toFixed(2)); lastDir = b.spinDir; }
        lastWarn = b.flipWarn;
      }
      debugMode = false;
      const atCenter = distance(b.x, b.y, 480, 270) < 3;
      const w1 = turretOmega({ hp: 1, maxHp: 1 }), w0 = turretOmega({ hp: 0.5, maxHp: 1 }), wLow = turretOmega({ hp: 0, maxHp: 1 });
      const flipGap = +(flips[1] - flips[0]).toFixed(2), warnLead = +(flips[0] - warnStarts[0]).toFixed(2);
      const ok = atCenter && burst === 4 && flips.length >= 2 && Math.abs(flipGap - 10) < 0.05 && Math.abs(warnLead - 1) < 0.05 && w1 < w0 && w0 < wLow && Math.abs(wLow / w1 - 2.2) < 1e-9;
      return { ok: ok, detail: "가운데 도착 " + centerAt + "초, 자리 " + atCenter + " / 한 번에 " + burst + "발 / ω 체력 100% " + w1 + ", 50% " + w0.toFixed(2) + ", 0% " + wLow.toFixed(2) +
        " / 방향 전환 " + flips.join(",") + "초 (간격 " + flipGap + "), 예고 " + warnLead + "초 전" };
    },
  },
  {
    name: "[새 보스] 블랙홀: 1/r² 로 끌어당김(상한, 420px 밖은 안 당김), 사건의 지평선(50px) 큰 대미지·튕겨냄, 플레이어 총알이 휨, 8초마다 3초 약점 (평소 30%)",
    run: function () {
      startGame(); spawnQueue = []; bannerTimer = 0;
      const b = createEnemy("blackHole", 480, 270, 30); b.state = "drift"; b.speed = 0; enemies = [b];
      const T = ENEMY_TYPES.blackHole, acc = (d) => { const v = T.pullOn(b, 480 + d, 270); return Math.hypot(v.ax, v.ay); };
      const ratio = acc(200) / acc(400), cap = acc(60), farZero = acc(BH_PULL_RANGE + 10) === 0;
      // 사건의 지평선
      player.x = 480 + BH_HORIZON + 10; player.y = 270; player.invincibleTimer = 0; player.hp = player.maxHp = 1000; const hp0 = player.hp;
      b.cycle = 0; updateEnemies(1 / 60);
      const horizonDmg = hp0 - player.hp, kicked = player.pullVx > 0;
      // 플레이어 총알이 휜다: 블랙홀 옆 120px 를 지나가는 총알
      player.x = 100; player.y = 470; player.invincibleTimer = 1e9;
      const shot = createBullet(1, 0, { x: 300, y: 270 - 120, fromAugment: true });
      updateBullets(1 / 60); const bent = shot.vy > 0;
      // 약점: 주기 8초 중 마지막 3초. 평소 30%, 약점 100%
      const dmgAt = (cycle) => { b.cycle = cycle; b.hp = b.maxHp = 100000; const q = createBullet(1, 0, { x: 400, y: 270, fromAugment: true }); for (let i = 0; i < 20 && !q.dead; i++) updateBullets(1 / 60); return 100000 - b.hp; };
      const closed = dmgAt(1), open = dmgAt(6), weakFlags = [0, 4.9, 5.0, 7.9].map((c) => { b.cycle = c; return blackHoleWeak(b) ? 1 : 0; }).join("");
      b.cycle = 1; b.hp = b.maxHp = 1000; damageEnemy(b, 100, { explosion: true }); const exoClosed = 1000 - b.hp;
      draw();
      const ok = Math.abs(ratio - 4) < 1e-9 && farZero && Math.abs(cap - PLAYER_ACCELERATION * BH_PULL_MAX_RATIO) < 1e-9 && Math.abs(horizonDmg - BH_HORIZON_DAMAGE * waveDamageMult(30)) < 1e-6 &&
        kicked && bent && Math.abs(closed - 3) < 1e-9 && Math.abs(open - 10) < 1e-9 && weakFlags === "0011" && Math.abs(exoClosed - 30) < 1e-9;
      return { ok: ok, detail: "a(200)/a(400) = " + ratio + ", 상한 " + cap + ", " + BH_PULL_RANGE + "px 밖은 0 " + farZero + " / 지평선 대미지 " + horizonDmg.toFixed(1) + ", 튕겨냄 " + kicked + " / 총알 휨 " + bent +
        " / 총알 대미지 평소 " + closed + ", 약점 " + open + " / 약점 시각 0·4.9·5·7.9초 → " + weakFlags + " / 폭발도 30% " + exoClosed };
    },
  },
  {
    name: "[새 보스] 반감기는 새 보스 3종에게도 절반만 (4% → 2%)",
    run: function () {
      const rates = [];
      for (const id of ["waveLord", "turret", "blackHole", "chargerKing"]) {
        startGame(); spawnQueue = []; ownedAugments = { halfLife: 1 };
        const b = createEnemy(id, 480, 270, 15); b.speed = 0; b.state = "drift"; b.cycle = 6; enemies = [b];
        const q = createBullet(1, 0, { x: 400, y: 270, fromAugment: true }); for (let i = 0; i < 20 && !q.dead; i++) updateBullets(1 / 60);
        rates.push(id + " " + b.decayRate);
      }
      return { ok: rates.every((r) => r.endsWith(" 0.02")), detail: rates.join(" / ") };
    },
  },
  // ---------------- 4단계 D: 웨이브 재구성 ----------------
  {
    name: "[웨이브] 새 적 첫 등장 웨이브는 그 적 2~3마리 + 기본 적만, 챕터마다 주인공(그 챕터의 새 적)이 첫 등장 뒤 모든 보통 웨이브에, 챕터 6 은 모든 종류",
    run: function () {
      const debut = { shooter: 7, shield: 12, resonator: 17, magnet: 22 };
      const problems = [];
      for (const id in debut) {
        const g = waveGroups(WAVES[debut[id] - 1]);
        const star = g.find((x) => x.type === id);
        const others = g.filter((x) => x.type !== id);
        if (!star || star.count < 2 || star.count > 3 || others.some((x) => x.type !== "basic")) problems.push(debut[id] + "웨이브 구성");
        // 첫 등장 전에는 나오지 않는다
        for (let w = 1; w < debut[id]; w++) if (waveGroups(WAVES[w - 1]).some((x) => x.type === id)) problems.push(id + " 가 " + w + "웨이브에 먼저 나옴");
        // 같은 챕터의 첫 등장 뒤 보통 웨이브에는 꼭 나온다
        const chapterEnd = Math.ceil(debut[id] / 5) * 5 - 1;
        for (let w = debut[id]; w <= chapterEnd; w++) if (!waveGroups(WAVES[w - 1]).some((x) => x.type === id)) problems.push(w + "웨이브에 주인공 " + id + " 없음");
      }
      const ch6 = new Set(); for (let w = 26; w <= 29; w++) for (const x of waveGroups(WAVES[w - 1])) ch6.add(x.type);
      const all8 = ["basic", "charger", "sine", "splitter", "shooter", "shield", "resonator", "magnet"].every((t) => ch6.has(t));
      if (!all8) problems.push("챕터 6 에 빠진 종류");
      const bosses = [5, 10, 15, 20, 25, 30].map((w) => waveBosses(WAVES[w - 1]).join("&")).join(" / ");
      if (bosses !== "chargerKing / splitterKing / waveLord / turret / chargerKing&splitterKing / blackHole") problems.push("보스 순서");
      return { ok: problems.length === 0, detail: (problems.join(", ") || "문제 없음") + " / 보스 " + bosses + " / 챕터 6 종류 " + [...ch6].join(",") };
    },
  },
  {
    name: "[디버그] B: 보스 선택 창 (5·10·15·20·25·30웨이브), 누르면 그 보스와 바로 전투 (로비에서도), 디버그 꺼지면 안 열림",
    run: new Function(PRESS + `
      goToMenu(); ownerUnlocked = true; press("F2");
      press("KeyB"); const open = isDebugBossOpen();
      const btns = [...document.querySelectorAll(".give-boss")];
      const labels = btns.map((b) => b.textContent).join(" | ");
      btns[2].click();   // 15웨이브: 파동 군주 (로비에서 눌렀으니 새 판 시작)
      for (let i = 0; i < 60 * 3; i++) { player.fireTimer = 1e9; update(1 / 60); }
      const fight = gameState === "playing" && wave === 15 && enemies.some((e) => e.type === "waveLord") && !isDebugBossOpen();
      // 전투 중에도: 30웨이브 블랙홀
      press("KeyB"); const pausedWhileOpen = paused;
      document.querySelectorAll(".give-boss")[5].click();
      for (let i = 0; i < 60 * 3; i++) { player.fireTimer = 1e9; update(1 / 60); }
      const fight30 = wave === 30 && enemies.some((e) => e.type === "blackHole") && !paused;
      debugMode = false; press("KeyB"); const offNo = !isDebugBossOpen();
      const ok = open && btns.length === 6 && fight && pausedWhileOpen && fight30 && offNo;
      return { ok: ok, detail: "열림 " + open + " / 버튼 " + labels + " / 로비에서 15웨이브 " + fight + " / 전투 중 열면 멈춤 " + pausedWhileOpen + ", 30웨이브 " + fight30 + " / 디버그 꺼짐 " + offNo };
    `),
  },
];
