// =============================================================
// tools/entry/sprites.js : 웹 게임의 그리기 코드로 엔트리 그림(PNG)을 만든다
// -------------------------------------------------------------
// 웹 게임(index.html)을 브라우저에서 열고, 게임의 그리기 함수(drawEnemy, drawOutlinedText, drawBar ...)로
// 그림 조각을 하나씩 그려서 PNG 로 잘라 낸다. 그래서 엔트리 그림이 웹 게임과 똑같다.
// 그림 크기는 웹 게임 크기 그대로 (엔트리에서는 50% 로 넣는다: 엔트리 무대 480 × 270 = 웹 960 × 540 의 절반)
//
// makeSprites(spec) → { 이름: { png: Buffer, w, h, adv? } }
//   spec: build-ent.js 가 넘겨주는 목록 (카드 글, 글자 목록 등)
// =============================================================

const path = require("path");
const { chromium } = require("playwright");
const { startServer } = require("../serve.js");

// ---- 브라우저 안에서 실행되는 함수 (게임의 전역 함수와 변수를 그대로 쓴다) ----
function drawAll(spec) {
  const out = {};
  canvas.width = 1100; canvas.height = 1100;          // 그림을 그릴 큰 도화지 (게임 루프는 멈춰 있다)
  const tmp = document.createElement("canvas");
  const C = COLORS;
  const D2R = Math.PI / 180;

  // 가운데를 (0, 0) 으로 두고 draw() 로 그린 뒤 w × h 만큼 잘라 저장
  function shot(key, w, h, draw, extra) {
    w = Math.ceil(w); h = Math.ceil(h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    draw();
    ctx.restore();
    tmp.width = w; tmp.height = h;
    const t = tmp.getContext("2d");
    t.clearRect(0, 0, w, h);
    t.drawImage(canvas, 0, 0, w, h, 0, 0, w, h);
    out[key] = Object.assign({ png: tmp.toDataURL("image/png"), w, h }, extra || {});
  }
  // 엔트리 각도(반시계, 0° = 오른쪽) → 캔버스 방향 벡터 (아래가 +y)
  const dirVec = (deg) => [Math.cos(deg * D2R), -Math.sin(deg * D2R)];
  // 눈이 deg 쪽을 보게: 플레이어를 그쪽 멀리에 둔다
  const lookAt = (deg) => { const v = dirVec(deg); player.x = v[0] * 1000; player.y = v[1] * 1000; };
  const fake = (type, extra) => Object.assign({ type, x: 0, y: 0, radius: ENEMY_TYPES[type].radius, wave: 1, hp: 1, maxHp: 1, hitFlash: 0, dirX: 1, dirY: 0, state: "", stateTime: 0, tilt: 0 }, extra || {});
  const DIRS = [0, 1, 2, 3, 4, 5, 6, 7];

  // ================= 플레이어 =================
  const PR = PLAYER_RADIUS;
  for (const d of DIRS) {
    shot("p_body_" + d, PR * 2 + 10, PR * 2 + 10, () => {
      const f = -d * 45 * D2R;   // 캔버스 각도
      drawOutlinedCircle(0, 0, PR, C.green);
      drawHighlight(0, 0, PR);
      const lookX = Math.cos(f) * 3, lookY = Math.sin(f) * 2;
      for (const side of [-1, 1]) {
        const ex = side * PR * 0.36 + lookX, ey = -PR * 0.15 + lookY;
        ctx.fillStyle = C.outline; ctx.beginPath(); ctx.arc(ex, ey, PR * 0.17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(ex - 1, ey - 1.5, PR * 0.06, 0, Math.PI * 2); ctx.fill();
      }
      setOutline(2.5);
      ctx.beginPath(); ctx.arc(lookX, PR * 0.25 + lookY, PR * 0.22, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    });
  }
  // 총구 (오른쪽을 향함. 엔트리에서 목표 쪽으로 돌린다. 회전 중심 = 플레이어 중심)
  shot("p_gun", 2 * (PR * 1.3 + 14), 24, () => { drawOutlinedRoundRect(PR * 0.3, -6, PR + 10, 12, 4, C.brown); });

  // ================= 적 =================
  // 기본 적: 웨이브 1 (동그라미), 2 (뿔), 3+ (가시 몸)
  for (const v of [1, 2, 3]) for (const d of DIRS) for (const fl of [0, 1]) {
    lookAt(d * 45);
    shot("e_basic" + v + "_" + d + "_" + fl, 66, 66, () => drawEnemy(fake("basic", { wave: v, hitFlash: fl })));
  }
  // 돌격형: 화살촉이 16방향, 얼굴은 똑바로 (눈은 그 방향)
  for (let a = 0; a < 16; a++) for (const fl of [0, 1]) {
    const v = dirVec(a * 22.5); lookAt(a * 22.5);
    shot("e_charger_" + a + "_" + fl, 64, 64, () => drawEnemy(fake("charger", { dirX: v[0], dirY: v[1], hitFlash: fl })));
  }
  // 사인파형 (기우는 것은 엔트리에서 돌린다)
  for (const d of DIRS) for (const fl of [0, 1]) { lookAt(d * 45); shot("e_sine_" + d + "_" + fl, 56, 56, () => drawEnemy(fake("sine", { hitFlash: fl }))); }
  // 분열형(분열의 왕이 죽으면 2마리) · 분열형 조각(분열의 왕이 방출)
  for (const t of ["splitter", "splitterChild"]) for (const d of DIRS) for (const fl of [0, 1]) {
    lookAt(d * 45); shot("e_" + t + "_" + d + "_" + fl, 52, 52, () => drawEnemy(fake(t, { hitFlash: fl })));
  }

  // ================= 보스 =================
  for (let a = 0; a < 16; a++) for (const fl of [0, 1]) {
    const v = dirVec(a * 22.5); lookAt(a * 22.5);
    shot("b_ck_" + a + "_" + fl, 150, 150, () => drawEnemy(fake("chargerKing", { dirX: v[0], dirY: v[1], hitFlash: fl })));
  }
  [40, 32, 24].forEach((r, p) => {
    for (const d of DIRS) for (const fl of [0, 1]) { lookAt(d * 45); shot("b_sk" + p + "_" + d + "_" + fl, 120, 130, () => drawEnemy(fake("splitterKing", { radius: r, hitFlash: fl }))); }
  });
  // 파동 군주: 물결 테두리(따로 돌린다) + 몸
  const WR = ENEMY_TYPES.waveLord.radius;
  shot("b_wl_ring", WR * 2.6, WR * 2.6, () => {
    const pts = []; const n = 48;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const rr = WR * (1.12 + 0.1 * Math.sin(a * 8)); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    drawOutlinedPolygon(pts, C.purple, SMALL_OUTLINE_WIDTH);
  });
  for (const d of DIRS) for (const fl of [0, 1]) {
    lookAt(d * 45);
    shot("b_wl_" + d + "_" + fl, 120, 130, () => { const e = fake("waveLord", { hitFlash: fl }); drawOutlinedCircle(0, 0, WR * 0.92, fl ? C.white : C.blue); drawHighlight(0, 0, WR * 0.85); drawEnemyFace(e, WR); drawCrown(WR); });
  }
  // 회전 포대: 몸(둥근 사각형) / 총구 4개(돌린다, 예고 때 노랑) / 회전 방향 화살표
  const TR = ENEMY_TYPES.turret.radius;
  for (const d of DIRS) for (const fl of [0, 1]) {
    lookAt(d * 45);
    shot("b_tu_" + d + "_" + fl, 120, 130, () => { const e = fake("turret", { hitFlash: fl });
      drawOutlinedRoundRect(-TR * 0.85, -TR * 0.85, TR * 1.7, TR * 1.7, TR * 0.45, fl ? C.white : C.slate); drawHighlight(-TR * 0.2, -TR * 0.2, TR * 0.7); drawEnemyFace(e, TR); drawCrown(TR); });
  }
  for (const warn of [0, 1]) {
    shot("b_tu_barrels" + warn, TR * 2.9, TR * 2.9, () => {
      for (let k = 0; k < TURRET_BARRELS; k++) { ctx.save(); ctx.rotate((k * Math.PI * 2) / TURRET_BARRELS);
        drawOutlinedRoundRect(TR * 0.5, -TR * 0.22, TR * 0.85, TR * 0.44, 4, warn ? C.yellow : C.dark, SMALL_OUTLINE_WIDTH); ctx.restore(); }
    });
  }
  for (const dir of [1, -1]) {
    shot("b_tu_arrow" + (dir > 0 ? "cw" : "ccw"), TR * 3.2, TR * 3.2, () => {
      setOutline(SMALL_OUTLINE_WIDTH); ctx.beginPath();
      ctx.arc(0, 0, TR * 1.45, -0.6 * dir - Math.PI / 2, 0.6 * dir - Math.PI / 2, dir < 0); ctx.stroke();
    });
  }
  // 블랙홀: 강착 원반 / 몸 / 사건의 지평선 점선 / 약점 고리 / "약점!"
  const BR = ENEMY_TYPES.blackHole.radius;
  shot("b_bh_disk", BR * 4, BR * 4, () => {
    ctx.beginPath(); ctx.ellipse(0, 0, BR * 1.9, BR * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.orange; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; setOutline(SMALL_OUTLINE_WIDTH); ctx.stroke();
  });
  for (const d of DIRS) for (const fl of [0, 1]) {
    lookAt(d * 45);
    shot("b_bh_" + d + "_" + fl, 120, 130, () => { const e = fake("blackHole"); drawOutlinedCircle(0, 0, BR, fl ? C.white : C.outline); drawEnemyFace(e, BR); drawCrown(BR); });
  }
  shot("b_bh_horizon", BH_HORIZON * 2 + 8, BH_HORIZON * 2 + 8, () => {
    ctx.setLineDash([6, 6]); ctx.strokeStyle = C.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, BH_HORIZON, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  });
  shot("b_bh_weak", BR * 1.6, BR * 1.6, () => { ctx.strokeStyle = C.yellow; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, BR * 0.7, 0, Math.PI * 2); ctx.stroke(); });
  shot("b_bh_weaktext", 80, 32, () => drawOutlinedText("약점!", 0, 0, 18, "center", C.yellow));

  // ================= 총알 · 예고선 · 파티클 =================
  bullets = [{ x: 0, y: 0, vx: 1, vy: 0 }];
  shot("bullet", 2 * (BULLET_TAIL_LENGTH + 8), 24, () => drawBullets());
  enemyBullets = [{ x: 0, y: 0, vx: 1, vy: 0, radius: ENEMY_BULLET_RADIUS }];
  shot("ebullet", 48, 28, () => drawEnemyBullets());
  bullets = []; enemyBullets = [];
  for (const [key, len, wid] of [["warn", CHARGER_WARN_LENGTH, 4], ["warnBoss", ENEMY_TYPES.chargerKing.warnLength, 7]]) {
    shot(key, 2 * (len + wid), wid + 6, () => { ctx.setLineDash([14, 10]); ctx.strokeStyle = C.red; ctx.lineWidth = wid; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke(); ctx.setLineDash([]); });
  }
  for (const shape of ["circle", "square", "triangle"]) for (const cn of ["red", "brown", "purple", "orange", "yellow", "blue", "slate"]) {
    particles = [{ x: 0, y: 0, size: 11, rotation: 0, shape, color: C[cn], age: 0 }];
    shot("pt_" + shape + "_" + cn, 34, 34, () => drawParticles());
  }
  particles = [];

  // ================= 글자 (테두리 글자 한 글자씩) =================
  // 40px 로 그린다. adv = 다음 글자까지의 폭
  ctx.font = "40px " + FONT_FAMILY;
  spec.glyphs.forEach((ch, gi) => {
    ctx.font = "40px " + FONT_FAMILY;
    const adv = ch === " " ? 12 : ctx.measureText(ch).width;
    spec.glyphColors.forEach(([cn, col]) => {
      shot("g_" + cn + "_" + gi, adv + 12, 56, () => { if (ch !== " ") drawOutlinedText(ch, 0, 1, 40, "center", col); }, { adv });
    });
  });

  // ================= 상태창 =================
  shot("hud_panel", HUD_WIDTH + 10, spec.hudHeight + 10, () => drawOutlinedRoundRect(-HUD_WIDTH / 2, -spec.hudHeight / 2, HUD_WIDTH, spec.hudHeight, 14, C.brown));
  spec.hpWidths.forEach((w, wi) => {
    for (const red of [0, 1]) for (let lv = 0; lv <= 20; lv++) {
      shot("hp_" + wi + "_" + red + "_" + lv, w + 8, 30, () => drawBar(-w / 2, -11, w, 22, lv / 20, red ? C.red : C.green));
    }
    // 최대 체력이 늘 때 번쩍임: 하얀 빛 + 노란 테두리
    shot("hpflash_" + wi, w + 16, 40, () => {
      roundRectPath(-w / 2, -11, w, 22, 11); ctx.fillStyle = C.white; ctx.globalAlpha = 0.6; ctx.fill(); ctx.globalAlpha = 1;
      roundRectPath(-w / 2 - 4, -15, w + 8, 30, 15); ctx.strokeStyle = C.yellow; ctx.lineWidth = 3; ctx.stroke();
    });
  });
  // 증강 목록: 4개까지는 한 줄씩(폭 220), 5개부터는 두 열로 작게 (게임과 같다)
  for (let n = 1; n <= 4; n++) shot("aug_panel" + n, 230, 54 + n * 32, () => { const h = 44 + n * 32; drawOutlinedRoundRect(-110, -h / 2, 220, h, 14, C.brown); drawOutlinedText("증강", -94, -h / 2 + 22, 20, "left"); });
  for (const n of [5, 6]) shot("aug_panel" + n, 326, 122, () => { drawOutlinedRoundRect(-158, -56, 316, 112, 14, C.brown); drawOutlinedText("증강 " + n + "개", -144, -36, 17, "left"); });
  spec.augs.forEach((aug, ai) => {
    for (let lv = 1; lv <= aug.max; lv++) {
      shot("aug_row_" + ai + "_" + lv, 220, 32, () => {
        drawOutlinedCircle(-84, 0, 9, C[aug.color], SMALL_OUTLINE_WIDTH);
        drawOutlinedText(aug.name, -66, 0, 18, "left");
        drawOutlinedText("Lv." + lv, 94, 0, 18, "right", C.yellow);
      });
      shot("aug_crow_" + ai + "_" + lv, 150, 24, () => {
        drawOutlinedCircle(-61, 0, 7, C[aug.color], SMALL_OUTLINE_WIDTH * 0.8);
        drawOutlinedText(aug.name, -48, 0, 15, "left");
        drawOutlinedText(String(lv), 65, 0, 15, "right", C.yellow);
      });
    }
  });
  // 적 머리 위 체력바 (웹: 폭 max(r × 2.2, 24), 높이 7, 초록)
  for (const er of spec.ebarRadii || []) {
    const bw = Math.max(er * 2 * 2.2, 24);
    for (let lv = 0; lv <= 20; lv++) shot("ebar_" + er + "_" + lv, Math.ceil(bw) + 6, 13, () => drawBar(-bw / 2, -3.5, bw, 7, lv / 20, C.green, SMALL_OUTLINE_WIDTH));
  }
  // 보스 이름 + 보스 체력바
  spec.bosses.forEach((name, i) => shot("boss_name" + i, 200, 30, () => drawOutlinedText(name, 0, 0, 20, "center", C.yellow)));
  for (let lv = 0; lv <= 20; lv++) shot("boss_bar_" + lv, BOSS_BAR_WIDTH + 8, 26, () => drawBar(-BOSS_BAR_WIDTH / 2, -9, BOSS_BAR_WIDTH, 18, lv / 20, C.red));

  // ================= 웨이브 띠 (배너) =================
  for (const [cn, col] of [["yellow", C.yellow], ["red", C.red]]) for (const h of [56, 84]) {
    shot("banner_" + cn + h, 350, h + 8, () => drawOutlinedRoundRect(-170, -h / 2, 340, h, 18, col));
  }
  for (let w = 1; w <= spec.waveCount; w++) shot("banner_t" + w, 300, 50, () => drawOutlinedText("웨이브 " + w, 0, 0, 34));
  spec.bannerSubs.forEach((s, i) => shot("banner_s" + i, 340, 32, () => drawOutlinedText(s, 0, 0, 20)));

  // ================= 카드 고르기 =================
  for (let w = 1; w <= spec.waveCount; w++) shot("choice_t" + w, 420, 56, () => drawOutlinedText("웨이브 " + w + " 클리어!", 0, 0, 40, "center", C.yellow));
  shot("choice_sub", 560, 34, () => drawOutlinedText("증강을 하나 고르세요  (클릭 또는 1 · 2 · 3 키)", 0, 0, 20));
  // 카드 (게임의 drawCard 와 같은 순서로 그린다. 기울이기·크기·번호 배지는 엔트리에서)
  const CW = CARD_WIDTH, CH = CARD_HEIGHT;
  spec.cards.forEach((card) => {
    shot(card.key, CW + 10, CH + 10, () => {
      const left = -CW / 2 - 3, top = -CH / 2 - 3, accent = C[card.color];
      roundRectPath(left + 7, top + 7, CW, CH, 20); ctx.fillStyle = C.outline; ctx.fill();
      drawOutlinedRoundRect(left, top, CW, CH, 20, C.white);
      drawOutlinedRoundRect(left + 12, top + 12, CW - 24, 58, 14, accent);
      drawOutlinedText(card.name, -3, top + 41, fitTextSize(card.name, 30, CW - 44));
      ctx.font = "16px " + FONT_FAMILY; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = C.brown;
      ctx.fillText(card.concept, -3, top + 92);
      drawOutlinedText(card.formula, -3, top + 135, fitTextSize(card.formula, 30, CW - 34), "center", accent);
      const desc = fitCardDesc(card.desc);
      ctx.fillStyle = C.outline; ctx.font = desc.size + "px " + FONT_FAMILY;
      for (let n = 0; n < desc.lines.length; n++) ctx.fillText(desc.lines[n], -3, top + CARD_DESC_TOP + n * desc.lineHeight);
      drawOutlinedRoundRect(-73, top + CH - 46, 140, 32, 16, C[card.badgeColor]);
      drawOutlinedText(card.badge, -3, top + CH - 30, 18);
    });
  });
  for (const i of [1, 2, 3]) shot("card_num" + i, 44, 44, () => { drawOutlinedCircle(0, 0, 18, C.outline); drawOutlinedText(String(i), 0, 1, 20, "center", C.yellow); });

  // ================= 어둡게 · 일시정지 · 결과 · 메뉴 =================
  for (const [k, a] of [["dim45", 0.45], ["dim55", 0.55]]) shot(k, 960, 540, () => { ctx.globalAlpha = a; ctx.fillStyle = C.outline; ctx.fillRect(-480, -270, 960, 540); ctx.globalAlpha = 1; });
  // 일시정지 창 (게임과 같은 배치: 왼쪽 버튼 자리 · 조작법, 오른쪽 가진 증강)
  const P = { w: 800, h: 460 };
  shot("pause_panel", P.w + 30, P.h + 50, () => {
    const L = -P.w / 2, T = -P.h / 2 + 10;
    roundRectPath(L + 8, T + 8, P.w, P.h, 26); ctx.fillStyle = C.outline; ctx.fill();
    drawOutlinedRoundRect(L, T, P.w, P.h, 26, C.background);
    ctx.save(); ctx.translate(L + 160, T + 6); ctx.rotate(-0.04); drawOutlinedRoundRect(-110, -26, 220, 52, 18, C.yellow); drawOutlinedText("일시정지", 0, 1, 30); ctx.restore();
    const hx = L + 34, hy = T + 290;
    drawOutlinedText("조작법", hx, hy, 20, "left", C.brown);
    spec.controls.forEach(([a, b], i) => {
      const y = hy + 28 + i * 22;
      ctx.font = "15px " + FONT_FAMILY; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      ctx.fillStyle = C.brown; ctx.fillText(a, hx, y); ctx.fillStyle = C.outline; ctx.fillText(b, hx + 92, y);
    });
    const ax = L + 330;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = C.outline; ctx.fillRect(ax - 18, T + 30, 3, P.h - 60); ctx.restore();
    drawOutlinedText("가진 증강", ax, T + 34, 20, "left", C.brown);
  });
  for (const [key, label, color] of spec.pauseButtons) shot(key, 262, 62, () => {
    roundRectPath(-125 + 5, -25 + 5, 250, 50, 20); ctx.fillStyle = C.outline; ctx.fill();
    drawOutlinedRoundRect(-125, -25, 250, 50, 20, C[color]); drawOutlinedText(label, 0, 1, 24);
  });
  // 일시정지 창의 증강 한 칸 (색 동그라미 · 이름 Lv · 수식 · 설명 2줄까지)
  spec.augs.forEach((aug, ai) => {
    for (let lv = 1; lv <= aug.max; lv++) {
      shot("pause_aug_" + ai + "_" + lv, 420, 64, () => {
        const x0 = -205, y0 = -30;
        drawOutlinedCircle(x0 + 8, y0 + 10, 7, C[aug.color], SMALL_OUTLINE_WIDTH * 0.8);
        ctx.font = "17px " + FONT_FAMILY; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.outline;
        const title = aug.name + " Lv." + lv; ctx.fillText(title, x0 + 22, y0 + 10);
        const tw = ctx.measureText(title).width;
        ctx.font = "14px " + FONT_FAMILY; ctx.fillStyle = C.brown; ctx.fillText(aug.formula, x0 + 32 + tw, y0 + 10);
        const lines = wrapText(aug.levelDesc[lv - 1], 392, 14).slice(0, 2);
        ctx.font = "14px " + FONT_FAMILY; ctx.fillStyle = C.outline;
        lines.forEach((ln, n) => ctx.fillText(ln, x0 + 22, y0 + 22 + 18 * (n + 0.5) + 2));
      });
    }
  });
  shot("pause_noaug", 600, 30, () => { ctx.font = "16px " + FONT_FAMILY; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.outline; ctx.fillText("아직 가진 증강이 없어요. 웨이브를 깨고 카드를 골라 보세요!", -205, 0); });
  shot("ready", 200, 80, () => drawOutlinedText("준비!", 0, 0, 44, "center", C.yellow));
  // 결과 창 (빨강 = 게임 오버, 노랑 = 모든 웨이브 클리어)
  for (const [key, title, color] of [["result_over", "게임 오버", C.red], ["result_clear", "모든 웨이브 클리어!", C.yellow]]) {
    shot(key, 590, 360, () => {
      roundRectPath(-280 + 8, -165 + 8, 560, 330, 26); ctx.fillStyle = C.outline; ctx.fill();
      drawOutlinedRoundRect(-280, -165, 560, 330, 26, color); drawOutlinedText(title, 0, -128, 46);
    });
  }
  for (const [key, label] of spec.resultButtons) shot(key, 180, 48, () => { drawOutlinedRoundRect(-80, -20, 160, 40, 20, C.outline); drawOutlinedText(label, 0, 1, 18, "center", C.yellow); });
  shot("sticker_new", 96, 60, () => { ctx.rotate(0.2); drawOutlinedRoundRect(-38, -16, 76, 32, 12, C.green); drawOutlinedText("NEW!", 0, 1, 20); });
  shot("sticker_record", 200, 80, () => { drawStickerRect(-86, -28, 172, 56, 20, C.green, 6); drawOutlinedText("신기록!", 0, 2, 36, "center", C.yellow); });
  // 메뉴
  shot("menu_title", 510, 150, () => { drawStickerRect(-240, -64, 480, 128, 30, C.yellow, 8); drawOutlinedText("증강 슈터", 0, -10, 62); drawOutlinedText("수학 · 과학 공식으로 살아남기", 0, 38, 21, "center", C.white); });
  if (spec.menuHint) shot("menu_hint", 420, 34, () => { drawOutlinedText(spec.menuHint, 0, 0, 15); });
  const SB = START_BUTTON;
  shot("menu_start", SB.w + 20, SB.h + 20, () => {
    const x = -SB.w / 2, y = -SB.h / 2;
    drawStickerRect(x, y, SB.w, SB.h, 30, C.yellow, 8); drawTabIcon("star", x + 46, 1, 21, C.white); drawOutlinedText("게임 시작", 24, 2, 44);
  });
  for (const [key, label, color] of spec.menuButtons) shot(key, 230, 70, () => { drawStickerRect(-105, -26, 210, 52, 22, C[color], 6); drawOutlinedText(label, 0, 1, 24); });
  // 조작법 · 도감 창 (일시정지 창과 같은 크림색 패널 + 제목 스티커)
  for (const [key, title, lines] of spec.infoPanels) shot(key, 830, 510, () => {
    const L = -400, T = -230;
    roundRectPath(L + 8, T + 8, 800, 460, 26); ctx.fillStyle = C.outline; ctx.fill();
    drawOutlinedRoundRect(L, T, 800, 460, 26, C.background);
    ctx.save(); ctx.translate(L + 160, T + 6); ctx.rotate(-0.04); drawOutlinedRoundRect(-110, -26, 220, 52, 18, C.yellow); drawOutlinedText(title, 0, 1, 30); ctx.restore();
    lines.forEach(([a, b], i) => {
      const y = T + 90 + i * 44;
      drawOutlinedText(a, L + 80, y, 24, "left", C.brown);
      ctx.font = "22px " + FONT_FAMILY; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = C.outline; ctx.fillText(b, L + 260, y);
    });
  });
  // 배경 (게임의 buildBackground 와 같다: 크림색 + 옅은 모눈선 + 4칸마다 +)
  shot("background", 960, 540, () => {
    ctx.translate(-480, -270);
    ctx.fillStyle = C.background; ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = C.outline; ctx.globalAlpha = 0.06; ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, 540); ctx.stroke(); }
    for (let y = 0; y <= 540; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(960, y + 0.5); ctx.stroke(); }
    ctx.globalAlpha = 0.15; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (let x = GRID_SIZE * 2; x < 960; x += GRID_SIZE * 4) for (let y = GRID_SIZE * 2; y < 540; y += GRID_SIZE * 4) {
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
  // 시간 지연 범위 (멈춤 = 옅게 / 움직임 = 진하게) · "시간 ×0.20"
  spec.slowRadii.forEach((r, i) => {
    for (const s of [0, 1]) shot("slow_" + i + "_" + s, r * 2 + 12, r * 2 + 12, () => {
      ctx.globalAlpha = 0.08 + 0.17 * s; ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.5 * s; ctx.setLineDash([10, 8]); setOutline(SMALL_OUTLINE_WIDTH); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
  });
  shot("slow_text", 140, 30, () => drawOutlinedText("시간 ×" + TIME_MIN_FACTOR.toFixed(2), 0, 0, 16));
  return out;
}

async function makeSprites(spec) {
  const root = path.resolve(__dirname, "..", "..");
  const server = await startServer(root);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
  // 게임 루프를 멈추고(그리기를 우리가 한다), 저장소는 가짜로
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    const box = {};
    Object.defineProperty(window, "localStorage", { value: { getItem: (k) => (k in box ? box[k] : null), setItem: (k, v) => { box[k] = String(v); }, removeItem: (k) => { delete box[k]; }, clear: () => {} }, configurable: true });
  });
  await page.goto(server.url + "index.html");
  await page.evaluate(async () => { try { await document.fonts.load("40px Jua"); await document.fonts.load('40px "Black Han Sans"'); } catch (e) {} await document.fonts.ready; });
  const raw = await page.evaluate(drawAll, spec);
  await browser.close();
  server.close();
  const out = {};
  for (const k in raw) out[k] = Object.assign({}, raw[k], { png: Buffer.from(raw[k].png.split(",")[1], "base64") });
  return out;
}

module.exports = { makeSprites };
