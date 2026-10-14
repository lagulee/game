// =============================================================
// src/ui.js : 설정 화면 · 저장(localStorage) · 감도 계산 표시
// =============================================================

import { DEFAULT_SETTINGS, OTHER_GAME_YAW } from './config/view.js';
import { FLASH_TYPES, TRAINING_DEFAULTS } from './config/flash.js';
import { eDPI, cmPer360, degPerCount, toValorantSens } from './input.js';

const KEY = 'flash-trainer.settings.v1';
const $ = (id) => document.getElementById(id);

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    saved = {};
  }
  const s = { ...DEFAULT_SETTINGS, ...saved };
  s.training = { ...TRAINING_DEFAULTS, ...(saved.training || {}) };
  s.training.enabled = { ...TRAINING_DEFAULTS.enabled, ...((saved.training || {}).enabled || {}) };
  return s;
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)에서도 게임은 돌아간다
  }
}

function num(v, fallback, lo, hi) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** 설정 화면을 settings 객체와 연결한다. 값이 바뀔 때마다 저장하고 onChange 를 부른다. */
export function bindMenu(settings, onChange) {
  const t = settings.training;

  // 플래시 종류 체크박스
  const box = $('flash-types');
  for (const [id, def] of Object.entries(FLASH_TYPES)) {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-type="${id}"> ${def.short}`;
    label.title = def.name;
    box.appendChild(label);
  }

  // 다른 게임 목록
  const sel = $('conv-game');
  for (const [id, g] of Object.entries(OTHER_GAME_YAW)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = `${g.label} (yaw ${g.yaw})`;
    sel.appendChild(o);
  }

  function fill() {
    $('in-dpi').value = settings.dpi;
    $('in-sens').value = settings.sens;
    $('in-vol').value = settings.volume;
    $('in-ring').value = settings.ringVolume;
    $('in-debug').checked = settings.showDebug;
    $('in-dmin').value = t.distMin;
    $('in-dmax').value = t.distMax;
    $('in-windup').value = t.windupScale;
    $('in-count').value = t.count;
    $('in-gapmin').value = t.gapMin;
    $('in-gapmax').value = t.gapMax;
    $('in-behind').checked = t.allowBehind;
    for (const cb of box.querySelectorAll('input')) cb.checked = !!t.enabled[cb.dataset.type];
    showCalc();
  }

  function showCalc() {
    $('out-edpi').textContent = round(eDPI(settings.dpi, settings.sens), 1);
    $('out-cm').textContent = round(cmPer360(settings.dpi, settings.sens), 2);
    $('out-dpc').textContent = round(degPerCount(settings.sens), 5);
    showConv();
  }

  function showConv() {
    const src = parseFloat($('conv-in').value);
    const g = OTHER_GAME_YAW[sel.value];
    $('conv-out').textContent = Number.isFinite(src) && g ? round(toValorantSens(src, g.yaw), 4) : '-';
  }

  function read() {
    settings.dpi = num($('in-dpi').value, settings.dpi, 100, 32000);
    settings.sens = num($('in-sens').value, settings.sens, 0.001, 10);
    settings.volume = num($('in-vol').value, settings.volume, 0, 1);
    settings.ringVolume = num($('in-ring').value, settings.ringVolume, 0, 1);
    settings.showDebug = $('in-debug').checked;
    t.distMin = num($('in-dmin').value, t.distMin, 2, 30);
    t.distMax = Math.max(t.distMin, num($('in-dmax').value, t.distMax, 2, 30));
    t.windupScale = num($('in-windup').value, t.windupScale, 0.5, 3);
    t.count = Math.round(num($('in-count').value, t.count, 1, 3));
    t.gapMin = num($('in-gapmin').value, t.gapMin, 0.5, 10);
    t.gapMax = Math.max(t.gapMin, num($('in-gapmax').value, t.gapMax, 0.5, 15));
    t.allowBehind = $('in-behind').checked;
    for (const cb of box.querySelectorAll('input')) t.enabled[cb.dataset.type] = cb.checked;
    saveSettings(settings);
    showCalc();
    onChange && onChange();
  }

  for (const el of document.querySelectorAll('#menu input')) {
    if (el.id === 'conv-in') continue;
    el.addEventListener('input', read);
    el.addEventListener('change', () => { read(); fill(); });
  }
  $('conv-in').addEventListener('input', showConv);
  sel.addEventListener('change', showConv);
  $('conv-apply').addEventListener('click', () => {
    const src = parseFloat($('conv-in').value);
    const g = OTHER_GAME_YAW[sel.value];
    if (!Number.isFinite(src) || !g) return;
    $('in-sens').value = round(toValorantSens(src, g.yaw), 4);
    read();
  });

  fill();
}

export function round(v, d) {
  if (!Number.isFinite(v)) return '∞';
  const k = 10 ** d;
  return String(Math.round(v * k) / k);
}

let toastTimer = 0;
export function toast(msg, ms = 4000) {
  const el = $('toast');
  el.textContent = msg;
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => { el.textContent = ''; }, ms);
}
