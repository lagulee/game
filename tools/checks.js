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
];
