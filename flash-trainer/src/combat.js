// =============================================================
// src/combat.js : 총(밴달) 사격과 봇
// -------------------------------------------------------------
// [발로란트와 동일] 밴달 피해량(머리 160 / 몸 40 / 다리 34), 연사 속도 9.75발/s, 탄창 25, 봇 체력 150
// [근사 구현]
//   - 탄 퍼짐: 발로란트의 고정 반동 패턴이 아니라 "연사할수록 넓어지는 원뿔"로 단순화
//   - 이동 사격 부정확도, 재장전 시간, 봇 몸 크기 · 무빙
//   - 피킹 봇: 플래시가 터지는 순간 폭발 지점 뒤쪽에서 튀어나와 좌우로 무빙한다.
//     정해진 시간(botReact) 안에 못 잡으면 "당함"으로 기록한다(봇이 실제로 조준하지는 않는다).
// =============================================================

import * as THREE from '../vendor/three.module.min.js';
import { GUN, BOT } from './config/combat.js';
import { ARENA_HALF, segmentBlocked, segmentHit, pointInsideAny, MAP_BOXES } from './map.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------
// 순수 함수 (tests/unit.test.mjs 에서 검사)
// ---------------------------------------------------------------

/** 부위별 피해량 [발로란트와 동일: 밴달 0~50m] */
export function damageFor(part) {
  return GUN.damage[part] ?? 0;
}

/** 지금 쏘는 한 발의 퍼짐 각도(도) [근사] */
export function spreadDeg(sprayCount, moveState) {
  const spray = Math.min(GUN.maxSprayDeg, GUN.firstShotSpreadDeg + sprayCount * GUN.spreadPerShotDeg);
  const move = moveState === 'run' ? GUN.moveSpreadDeg : moveState === 'walk' ? GUN.walkSpreadDeg : 0;
  return spray + move;
}

/**
 * 광선이 봇의 어느 부위에 맞는지. 머리 → 몸 → 다리 중 가장 가까운 것.
 * @returns {{dist:number, part:'head'|'body'|'legs'} | null}
 */
export function rayHitBot(eye, dir, bot) {
  let best = null;
  // 머리: 구
  const c = [bot.x, BOT.headY, bot.z];
  const oc = [c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]];
  const along = oc[0] * dir[0] + oc[1] * dir[1] + oc[2] * dir[2];
  if (along > 0) {
    const perp2 = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - along * along;
    if (perp2 <= BOT.headR * BOT.headR) best = { dist: along - Math.sqrt(BOT.headR * BOT.headR - perp2), part: 'head' };
  }
  const far = [eye[0] + dir[0] * 200, eye[1] + dir[1] * 200, eye[2] + dir[2] * 200];
  const boxes = [
    { part: 'body', min: [bot.x - BOT.bodyHalf, BOT.bodyMinY, bot.z - BOT.bodyHalf], max: [bot.x + BOT.bodyHalf, BOT.bodyMaxY, bot.z + BOT.bodyHalf] },
    { part: 'legs', min: [bot.x - BOT.legsHalf, 0, bot.z - BOT.legsHalf], max: [bot.x + BOT.legsHalf, BOT.legsMaxY, bot.z + BOT.legsHalf] },
  ];
  for (const b of boxes) {
    const h = segmentHit(eye, far, [b]);
    // segmentHit 은 바닥도 면으로 친다. 바닥에 먼저 맞으면(봇 앞 바닥) 봇은 안 맞은 것
    if (h && !(h.normal[1] === 1 && h.point[1] === 0)) {
      const d = h.t * 200;
      if (!best || d < best.dist) best = { dist: d, part: b.part };
    }
  }
  return best;
}

/** 벽(또는 바닥)까지 거리. 없으면 Infinity */
export function wallDistance(eye, dir, boxes = MAP_BOXES) {
  const far = [eye[0] + dir[0] * 200, eye[1] + dir[1] * 200, eye[2] + dir[2] * 200];
  const h = segmentHit(eye, far, boxes);
  return h ? h.t * 200 : Infinity;
}

/** dir 을 기준으로 최대 coneDeg 안에서 무작위로 흔든 방향 */
export function jitterDir(dir, coneDeg, rng = Math.random) {
  if (coneDeg <= 0) return dir.slice();
  // dir 에 수직인 두 축
  const up = Math.abs(dir[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let u = cross(dir, up);
  u = norm(u);
  const v = cross(dir, u);
  const r = Math.tan(coneDeg * DEG) * Math.sqrt(rng());
  const a = rng() * Math.PI * 2;
  return norm([dir[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r,
    dir[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r,
    dir[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]);
}

function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** 플래시 폭발 지점 뒤쪽에서 봇이 나올 자리 */
export function peekSpot(eye, pop, rng = Math.random) {
  const dx = pop[0] - eye[0];
  const dz = pop[2] - eye[2];
  const base = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < 16; i++) {
    const off = (i === 0 ? 0 : (rng() * 2 - 1) * 20) * DEG;
    const ang = Math.atan2(dx, -dz) + off;
    const d = base + BOT.peekBehind[0] + rng() * (BOT.peekBehind[1] - BOT.peekBehind[0]);
    const x = eye[0] + Math.sin(ang) * d;
    const z = eye[2] - Math.cos(ang) * d;
    if (Math.abs(x) > ARENA_HALF - 1.5 || Math.abs(z) > ARENA_HALF - 1.5) continue;
    if (pointInsideAny([x, 1, z], 0.6)) continue;
    if (segmentBlocked(eye, [x, BOT.headY, z])) continue;
    return { x, z, ang };
  }
  return null;
}

// ---------------------------------------------------------------
// 실행 (브라우저 전용)
// ---------------------------------------------------------------

export class Combat {
  constructor({ scene, camera, audio, flashes, eye, look, settings }) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.flashes = flashes;
    this.eye = eye;
    this.look = look;
    this.moveState = 'still';
    this.settings = settings;
    this.bots = [];
    this.firing = false;
    this.lastShot = -Infinity;
    this.spray = 0;
    this.ammo = GUN.magazine;
    this.reloadUntil = 0;
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0 };
    this.listeners = [];
    this.tracers = [];
    this.respawnAt = [];
    this.hurtEl = document.getElementById('hurt');
    this.ammoEl = document.getElementById('ammo');
    this.crossEl = document.getElementById('crosshair');
    this.hurt = 0;
    this.buildGun();
  }

  get time() { return this.flashes.time; }

  onBotResult(fn) { this.listeners.push(fn); }

  // ---- 총 모양 (화면 오른쪽 아래) [연출] ----
  buildGun() {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
    const accent = new THREE.MeshLambertMaterial({ color: 0xc8463c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), dark);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), dark);
    barrel.position.set(0, 0.02, -0.42);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), accent);
    mag.position.set(0, -0.1, -0.05);
    mag.rotation.x = 0.25;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), dark);
    stock.position.set(0, -0.02, 0.32);
    g.add(body, barrel, mag, stock);
    this.muzzle = new THREE.PointLight(0xffc070, 0, 4);
    this.muzzle.position.set(0, 0.02, -0.6);
    g.add(this.muzzle);
    // 시야각이 103°로 넓어서 총을 작게, 화면 오른쪽 아래 구석에 둔다
    g.scale.setScalar(0.32);
    this.gunBase = new THREE.Vector3(0.17, -0.14, -0.42);
    g.position.copy(this.gunBase);
    this.gun = g;
    this.camera.add(g);
    this.scene.add(this.camera); // 카메라에 붙인 물체를 그리려면 카메라도 장면에 있어야 한다
    this.gunKick = 0;
  }

  setFiring(v) {
    this.firing = v;
    if (v) this.tryFire();
  }

  reload() {
    if (this.ammo === GUN.magazine || this.time < this.reloadUntil) return;
    this.reloadUntil = this.time + GUN.reloadTime;
    this.audio.beep(this.eye(), 500, 0.08);
  }

  clear() {
    for (const b of this.bots) this.removeBot(b);
    this.bots = [];
    this.respawnAt = [];
    this.firing = false;
  }

  // ---- 봇 만들기 ----
  makeBotMesh() {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9534f });
    const dark = new THREE.MeshLambertMaterial({ color: 0x7a2a2a });
    const head = new THREE.Mesh(new THREE.SphereGeometry(BOT.headR, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf0c8a0 }));
    head.position.y = BOT.headY;
    const body = new THREE.Mesh(new THREE.BoxGeometry(BOT.bodyHalf * 2, BOT.bodyMaxY - BOT.bodyMinY, BOT.bodyHalf * 2), skin);
    body.position.y = (BOT.bodyMinY + BOT.bodyMaxY) / 2;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(BOT.legsHalf * 2, BOT.legsMaxY, BOT.legsHalf * 2), dark);
    legs.position.y = BOT.legsMaxY / 2;
    g.add(head, body, legs);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  /** 플래시와 함께 튀어나오는 봇 예약 */
  spawnPeek({ roundId, pop, at }) {
    const bot = {
      kind: 'peek', roundId, pop, spawnAt: at, alive: false, hp: BOT.hp, mesh: this.makeBotMesh(),
      x: 0, z: 0, bx: 0, bz: 0, px: 1, pz: 0, phase: Math.random() * 6, done: false,
    };
    this.bots.push(bot);
    return bot;
  }

  spawnAlways() {
    const e = this.eye();
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 8 + Math.random() * 10;
      const pop = [e[0] + Math.sin(a) * d, 1.5, e[2] - Math.cos(a) * d];
      const spot = peekSpot(e, pop);
      if (!spot) continue;
      const bot = {
        kind: 'always', alive: false, hp: BOT.hp, mesh: this.makeBotMesh(), spawnAt: this.time, x: 0, z: 0,
        bx: 0, bz: 0, px: 1, pz: 0, phase: Math.random() * 6, done: false, spot,
      };
      this.bots.push(bot);
      return;
    }
  }

  appear(bot) {
    const e = this.eye();
    const spot = bot.spot || peekSpot(e, bot.pop);
    if (!spot) {
      // 자리를 못 찾으면 이 봇은 없던 일로 (결과: 처치도 당함도 아님)
      this.finish(bot, { skipped: true });
      return;
    }
    bot.bx = spot.x;
    bot.bz = spot.z;
    // 무빙 방향: 플레이어를 바라보는 방향에 수직
    bot.px = Math.cos(spot.ang);
    bot.pz = Math.sin(spot.ang);
    bot.alive = true;
    bot.appearedAt = this.time;
    bot.deadline = this.time + this.settings.combat.botReact;
    bot.mesh.visible = true;
    this.placeBot(bot);
  }

  placeBot(bot) {
    const t = this.time - bot.appearedAt + bot.phase;
    const w = BOT.strafeSpeed / BOT.strafeRange;
    const off = Math.sin(t * w) * BOT.strafeRange;
    bot.x = bot.bx + bot.px * off;
    bot.z = bot.bz + bot.pz * off;
    if (pointInsideAny([bot.x, 1, bot.z], 0.3)) { bot.x = bot.bx; bot.z = bot.bz; }
    bot.mesh.position.set(bot.x, 0, bot.z);
    const e = this.eye();
    bot.mesh.rotation.y = Math.atan2(e[0] - bot.x, e[2] - bot.z);
  }

  removeBot(bot) {
    this.scene.remove(bot.mesh);
    bot.mesh.traverse((o) => o.geometry && o.geometry.dispose());
  }

  finish(bot, res) {
    if (bot.done) return;
    bot.done = true;
    bot.alive = false;
    this.removeBot(bot);
    if (bot.kind === 'peek') for (const fn of this.listeners) fn({ roundId: bot.roundId, ...res });
    if (bot.kind === 'always') this.respawnAt.push(this.time + 0.6);
  }

  // ---- 사격 ----
  tryFire() {
    const now = this.time;
    if (now < this.reloadUntil) return;
    if (this.ammo <= 0) { this.reload(); return; }
    if (now - this.lastShot < 1 / GUN.fireRate - 1e-6) return;
    if (now - this.lastShot > GUN.recoverTime) this.spray = 0;
    this.lastShot = now;
    this.ammo--;
    this.stats.shots++;
    const e = this.eye();
    const f = this.look.forward();
    const dir = jitterDir([f.x, f.y, f.z], spreadDeg(this.spray, this.moveState));
    this.spray++;
    this.audio.shot();
    this.muzzle.intensity = 3;
    this.gunKick = 1;

    // 가장 가까운 것: 벽 / 봇 / 레이나 눈
    let hitDist = wallDistance(e, dir);
    let target = null;
    for (const b of this.bots) {
      if (!b.alive) continue;
      const h = rayHitBot(e, dir, b);
      if (h && h.dist < hitDist) { hitDist = h.dist; target = { bot: b, part: h.part }; }
    }
    const eyeHit = this.flashes.hitTestEyes(e, dir);
    if (eyeHit && eyeHit.dist < hitDist) {
      hitDist = eyeHit.dist;
      target = { eyeHit };
    }
    const end = Number.isFinite(hitDist) ? hitDist : 100;
    this.addTracer(e, dir, end);

    if (target && target.bot) {
      const b = target.bot;
      const dmg = damageFor(target.part);
      b.hp -= dmg;
      this.stats.hits++;
      if (target.part === 'head') this.stats.heads++;
      this.audio.hit(target.part === 'head');
      this.hitMarker(target.part === 'head');
      if (b.hp <= 0) {
        this.stats.kills++;
        this.audio.kill();
        this.finish(b, { killed: true, ttk: now - b.appearedAt, head: target.part === 'head' });
      }
    } else if (target && target.eyeHit) {
      target.eyeHit.apply(damageFor('body'));
      this.stats.hits++;
      this.audio.hit(false);
      this.hitMarker(false);
    }
  }

  hitMarker(head) {
    this.crossEl.classList.remove('hit', 'head');
    void this.crossEl.offsetWidth; // 애니메이션 다시 시작
    this.crossEl.classList.add(head ? 'head' : 'hit');
  }

  addTracer(e, dir, dist) {
    // 총구 근처에서 시작하는 짧은 선 [연출]
    const start = new THREE.Vector3(0.17, -0.13, -0.62).applyMatrix4(this.camera.matrixWorld);
    const endP = new THREE.Vector3(e[0] + dir[0] * dist, e[1] + dir[1] * dist, e[2] + dir[2] * dist);
    const geo = new THREE.BufferGeometry().setFromPoints([start, endP]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  // ---- 매 프레임 ----
  update(dt, { running, moveState }) {
    this.moveState = moveState;
    const now = this.time;
    const mode = this.settings.combat.botMode;

    if (this.reloadUntil && now >= this.reloadUntil) {
      this.reloadUntil = 0;
      this.ammo = GUN.magazine;
    }
    if (running && this.firing) this.tryFire();

    // 상주 봇 수 맞추기
    if (mode === 'always') {
      const alive = this.bots.filter((b) => b.kind === 'always' && !b.done).length;
      this.respawnAt = this.respawnAt.filter((t) => t > now); // 부활 대기 끝난 자리는 아래에서 채운다
      const want = this.settings.combat.alwaysCount - alive - this.respawnAt.length;
      for (let i = 0; i < want; i++) this.spawnAlways();
    } else {
      for (const b of this.bots) if (b.kind === 'always') this.finish(b, {});
      this.respawnAt = [];
    }

    for (const b of this.bots) {
      if (b.done) continue;
      if (!b.alive) {
        if (now >= b.spawnAt) this.appear(b);
        continue;
      }
      this.placeBot(b);
      if (b.kind === 'peek' && now >= b.deadline) {
        // 시간 안에 못 잡음 → 봇이 쏜 것으로 처리
        this.audio.botShot([b.x, BOT.headY, b.z]);
        this.hurt = 1;
        this.finish(b, { killed: false });
      }
    }
    this.bots = this.bots.filter((b) => !b.done);

    // 연출
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 60);
    this.gunKick = Math.max(0, this.gunKick - dt * 14);
    this.gun.position.z = this.gunBase.z + this.gunKick * 0.015;
    this.gun.rotation.x = this.gunKick * 0.05;
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.8;
    }
    for (const t of this.tracers.filter((x) => x.life <= 0)) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    if (this.hurtEl) this.hurtEl.style.opacity = this.hurt.toFixed(3);
    if (this.ammoEl) {
      this.ammoEl.textContent = now < this.reloadUntil ? '재장전…' : `${this.ammo} / ${GUN.magazine}`;
    }
  }

  /** 피킹 봇이 아직 남아 있는지 (라운드 정리용) */
  hasPeekBots() {
    return this.bots.some((b) => b.kind === 'peek' && !b.done);
  }
}
