// =============================================================
// src/main.js : 화면 준비 · 게임 루프 · 모드 전환
// -------------------------------------------------------------
// 모드
//   'train'    : 반복 훈련 (플래시가 계속 날아온다)
//   'senstest' : 감도 테스트 (cm/360 만큼 움직이면 360° 도는지 확인)
// =============================================================

import * as THREE from '../vendor/three.module.min.js';
import { HORIZONTAL_FOV_DEG, EYE_HEIGHT, RUN_SPEED, WALK_MULT, PLAYER_RADIUS } from './config/view.js';
import { LookState, Keys, lockPointer, verticalFovDeg, cmPer360, countsToCm } from './input.js';
import { MAP_BOXES, PLAYER_SPAWN, ARENA_HALF, resolvePlayer, setMap } from './map.js';
import { loadSettings, bindMenu, toast, round } from './ui.js';
import { AudioFX } from './audio.js';
import { FlashSystem } from './flash.js';
import { Training } from './game.js';

const $ = (id) => document.getElementById(id);

// ---------- 설정 ----------
const settings = loadSettings();
setMap(settings.map);
const audio = new AudioFX(() => settings);
bindMenu(settings, () => {
  audio.applyVolume();
  if (settings.map !== builtMap) buildMap(); // 맵을 바꾸면 바로 다시 짓는다
});

// ---------- Three.js 기본 ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a7c7);
scene.fog = new THREE.Fog(0x87a7c7, 40, 90);

const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 200);
camera.rotation.order = 'YXZ'; // 좌우(yaw) 먼저, 그다음 상하(pitch) — FPS 카메라 표준

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // [발로란트와 동일] 수평 FOV 103° 를 유지하도록 수직 FOV 를 계산
  camera.fov = verticalFovDeg(HORIZONTAL_FOV_DEG, camera.aspect);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// 조명
scene.add(new THREE.HemisphereLight(0xdfefff, 0x50463c, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(12, 30, 8);
scene.add(sun);

// 바닥: 1m 격자 무늬 (거리감 · 회전 확인용)
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5d6168';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#4b4f55';
  g.lineWidth = 4;
  g.strokeRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ARENA_HALF * 2, ARENA_HALF * 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2),
  new THREE.MeshLambertMaterial({ map: gridTexture() }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// 구조물: map.js 의 상자 데이터 그대로
const mapGroup = new THREE.Group();
scene.add(mapGroup);
let builtMap = null;
function buildMap() {
  setMap(settings.map);
  builtMap = settings.map;
  for (const obj of [...mapGroup.children]) {
    mapGroup.remove(obj);
    obj.geometry.dispose();
  }
  for (const b of MAP_BOXES) {
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ color: b.color }));
    mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    mapGroup.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x222222 }));
    edges.position.copy(mesh.position);
    mapGroup.add(edges);
  }
  // 플레이어를 새 맵의 시작 위치로
  player.x = PLAYER_SPAWN.x;
  player.z = PLAYER_SPAWN.z;
}

// 감도 테스트용 방위 표시 기둥 (북=빨강, 동·서·남=흰색)
const markers = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const a = (i * Math.PI) / 2;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 0.15),
    new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff3030 : 0xffffff }));
  m.position.set(Math.sin(a) * 6, 1.5, -Math.cos(a) * 6);
  markers.add(m);
}
markers.visible = false;
scene.add(markers);

// ---------- 플레이어 ----------
const look = new LookState(() => settings);
const keys = new Keys();
const player = { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z };
buildMap();

function eye() {
  return [player.x, EYE_HEIGHT, player.z];
}

// ---------- 플래시 · 훈련 ----------
const flashes = new FlashSystem({ scene, audio, look, eye, settings });
const training = new Training({ flashes, look, eye, settings, audio });

// ---------- 모드 · 포인터 락 ----------
let mode = 'train';
let running = false; // 포인터 락 상태에서만 true

async function start(newMode) {
  mode = newMode;
  audio.unlock(); // 브라우저는 사용자가 클릭한 뒤에만 소리를 낼 수 있다
  const r = await lockPointer(canvas);
  if (!r.ok) {
    toast(r.message, 6000);
    return;
  }
  toast(r.message, r.raw ? 2500 : 8000);
}

$('btn-train').addEventListener('click', () => start('train'));
$('btn-senstest').addEventListener('click', () => start('senstest'));
canvas.addEventListener('click', () => { if (!running) start(mode); });

document.addEventListener('pointerlockchange', () => {
  running = document.pointerLockElement === canvas;
  $('menu').classList.toggle('hidden', running);
  if (running) enterMode();
  else training.pause();
});
document.addEventListener('pointerlockerror', () => toast('포인터 락 오류. 다시 클릭해 주세요.'));

function enterMode() {
  const isTest = mode === 'senstest';
  $('senstest').classList.toggle('hidden', !isTest);
  $('hud').classList.toggle('hidden', isTest);
  markers.visible = isTest;
  if (isTest) {
    flashes.clear();
    look.resetTest();
    look.pitchDeg = 0;
  } else {
    training.resume();
  }
}

// 마우스: 이벤트가 올 때마다 바로 각도로 바꾼다 (프레임과 무관) [발로란트와 동일한 방식]
document.addEventListener('mousemove', (e) => {
  if (!running) return;
  look.applyMouse(e.movementX, e.movementY);
});

// 마우스 버튼: 레이나 눈 쏘기
document.addEventListener('mousedown', (e) => {
  if (!running || e.button !== 0) return;
  if (mode === 'train') flashes.shoot(eye(), look.forward());
});

addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.code === 'KeyR' && mode === 'senstest') look.resetTest();
});

// ---------- 화면 갱신 ----------
function updateMovement(dt) {
  let f = 0;
  let s = 0;
  if (keys.has('KeyW')) f += 1;
  if (keys.has('KeyS')) f -= 1;
  if (keys.has('KeyD')) s += 1;
  if (keys.has('KeyA')) s -= 1;
  if (!f && !s) return;
  const len = Math.hypot(f, s);
  const speed = RUN_SPEED * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? WALK_MULT : 1);
  const yaw = (look.yawDeg * Math.PI) / 180;
  const fx = Math.sin(yaw);
  const fz = -Math.cos(yaw);
  // 오른쪽 = 앞 방향을 시계 방향으로 90°
  const rx = Math.cos(yaw);
  const rz = Math.sin(yaw);
  player.x += ((fx * f + rx * s) / len) * speed * dt;
  player.z += ((fz * f + rz * s) / len) * speed * dt;
  resolvePlayer(player, PLAYER_RADIUS);
}

function updateSensTest() {
  const yaw = look.yawDeg;
  $('st-angle').textContent = yaw.toFixed(1);
  const cm = countsToCm(look.totalCountsX, settings.dpi);
  $('st-turns').textContent = `${(yaw / 360).toFixed(3)} 바퀴 · 누적 ${look.totalCountsX} 카운트 = ${cm.toFixed(2)} cm`;
  $('st-detail').textContent = `DPI ${settings.dpi} · 감도 ${settings.sens} · 1카운트 ${round(settings.sens * 0.07, 5)}° · 위아래 ${look.pitchDeg.toFixed(1)}°`;
  $('st-cm').textContent = round(cmPer360(settings.dpi, settings.sens), 2);
  $('st-needle').setAttribute('transform', `rotate(${yaw % 360})`);
}

let last = performance.now();
function frame(now) {
  // 다음 프레임을 먼저 예약한다: 한 프레임에서 오류가 나도 게임이 멈추지 않게
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    step(dt);
  } catch (err) {
    console.error(err);
  }
}

function step(dt) {

  if (running) updateMovement(dt);

  // 카메라 = 플레이어 눈
  camera.position.set(player.x, EYE_HEIGHT, player.z);
  camera.rotation.y = (-look.yawDeg * Math.PI) / 180;
  camera.rotation.x = (look.pitchDeg * Math.PI) / 180;

  audio.setListener(eye(), look.forward());

  if (mode === 'senstest') {
    updateSensTest();
  } else if (running) {
    training.update(dt);
  }
  // 플래시는 일시정지 중에도 연출(페이드)이 끝나도록 계속 갱신하되, 새 투척은 training 이 막는다
  flashes.update(running ? dt : 0, settings.showDebug);
  training.render();

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// 자동 검사(tests/smoke)용 손잡이. 게임 동작에는 영향 없음
window.__ft = { look, settings, player, flashes, training, camera, setMode: (m) => { mode = m; enterMode(); }, setRunning: (v) => { running = v; } };
