// =============================================================
// src/input.js : 마우스 감도(시점 회전) · 키보드 입력
// -------------------------------------------------------------
// [발로란트와 동일]
//   Δyaw(도)   = movementX × sens × 0.07
//   Δpitch(도) = movementY × sens × 0.07   (마우스를 몸 쪽으로 당기면 아래를 본다)
//   → 마우스가 보낸 "카운트"를 그대로 각도로 바꾼다. deltaTime 을 곱하지 않으므로
//     프레임 속도(FPS)와 상관없이 같은 거리를 움직이면 같은 각도만큼 돈다.
// [근사 / 환경 차이]
//   - 브라우저는 OS 마우스 가속을 거친 값을 줄 수 있다. 그래서 Pointer Lock 의
//     unadjustedMovement(raw 입력)를 요청하고, 안 되면 안내 문구를 띄운다.
// =============================================================

import { VALORANT_YAW, PITCH_LIMIT_DEG, CM_PER_INCH } from './config/view.js';

// ---------- 순수 계산 함수 (테스트에서 직접 불러 쓴다) ----------

/** 1카운트당 회전각(도) */
export function degPerCount(sens) {
  return sens * VALORANT_YAW;
}

/** eDPI = DPI × 감도 */
export function eDPI(dpi, sens) {
  return dpi * sens;
}

/** 한 바퀴(360°) 도는 데 필요한 마우스 이동 거리(cm) = (360 × 2.54) / (DPI × sens × 0.07) */
export function cmPer360(dpi, sens) {
  const d = dpi * sens * VALORANT_YAW;
  return d > 0 ? (360 * CM_PER_INCH) / d : Infinity;
}

/** 다른 게임 감도 → 발로란트 감도 = 원본 감도 × (원본 yaw / 0.07) */
export function toValorantSens(sourceSens, sourceYaw) {
  return sourceSens * (sourceYaw / VALORANT_YAW);
}

/**
 * 수평 FOV 를 유지하는 수직 FOV(도). Three.js 카메라는 수직 FOV 를 받기 때문에 바꿔 준다.
 * tan(v/2) = tan(h/2) / 화면비
 */
export function verticalFovDeg(horizontalDeg, aspect) {
  const h = (horizontalDeg * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI;
}

/** 마우스 카운트 → 이동 거리(cm) */
export function countsToCm(counts, dpi) {
  return (counts / dpi) * CM_PER_INCH;
}

// ---------- 시점 상태 ----------

export class LookState {
  constructor(getSettings) {
    this.getSettings = getSettings;
    // yaw: 오른쪽으로 돌면 증가(나침반 방향). 360을 넘어도 그대로 누적한다(감도 테스트용).
    this.yawDeg = 0;
    this.pitchDeg = 0;
    // 감도 테스트용 누적값
    this.totalCountsX = 0;
    this.totalCountsY = 0;
    // 시점이 움직일 때 알려 줄 함수들 (반응 시간 측정용)
    this.listeners = [];
  }

  /** 마우스 이동량(카운트)을 그대로 각도로 바꿔 더한다. [발로란트와 동일] */
  applyMouse(dx, dy) {
    const k = degPerCount(this.getSettings().sens);
    const dYaw = dx * k;
    const before = this.pitchDeg;
    this.yawDeg += dYaw;
    // 화면 좌표계에서 movementY > 0 은 마우스를 아래로(몸 쪽으로) 움직인 것 → 아래를 본다 → pitch 감소
    this.pitchDeg = clamp(this.pitchDeg - dy * k, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG);
    this.totalCountsX += dx;
    this.totalCountsY += dy;
    const dPitch = this.pitchDeg - before;
    for (const fn of this.listeners) fn(dYaw, dPitch);
  }

  /** 시선 방향 단위벡터 (x: 오른쪽, y: 위, z: 앞이 -z 인 Three.js 좌표) */
  forward() {
    const yaw = (this.yawDeg * Math.PI) / 180;
    const pitch = (this.pitchDeg * Math.PI) / 180;
    const c = Math.cos(pitch);
    return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
  }

  resetTest() {
    this.yawDeg = 0;
    this.totalCountsX = 0;
    this.totalCountsY = 0;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------- 포인터 락 (브라우저 전용) ----------

/**
 * 포인터 락을 건다. 결과: { ok, raw, message }
 * raw=true 이면 OS 마우스 가속이 꺼진 입력.
 */
export async function lockPointer(element) {
  if (!element.requestPointerLock) {
    return { ok: false, raw: false, message: '이 브라우저는 Pointer Lock 을 지원하지 않습니다.' };
  }
  // 1) raw 입력 요청
  try {
    const p = element.requestPointerLock({ unadjustedMovement: true });
    if (p && typeof p.then === 'function') {
      await p;
      // 크롬 계열만 unadjustedMovement 를 실제로 처리한다. 다른 브라우저는 옵션을 무시하고 성공할 수 있다.
      const chromium = !!(navigator.userAgentData && navigator.userAgentData.brands
        && navigator.userAgentData.brands.some((b) => /Chromium/i.test(b.brand)));
      return chromium
        ? { ok: true, raw: true, message: 'raw 입력 켜짐 (OS 마우스 가속 꺼짐)' }
        : { ok: true, raw: false, message: '포인터 락은 켜졌지만 raw 입력 여부를 확인할 수 없습니다. Windows 「포인터 정확도 향상」을 꺼 주세요.' };
    }
    // 옛 브라우저: Promise 를 돌려주지 않음 → raw 여부 모름
    return { ok: true, raw: false, message: 'raw 입력 미지원 브라우저. Windows 「포인터 정확도 향상」을 꺼 주세요.' };
  } catch (err) {
    // 2) raw 가 안 되면 일반 포인터 락으로 대체
    if (err && err.name === 'NotSupportedError') {
      try {
        await element.requestPointerLock();
        return { ok: true, raw: false, message: '이 OS/브라우저는 raw 입력을 지원하지 않아 일반 모드로 실행합니다. OS 마우스 가속을 꺼 주세요.' };
      } catch (e2) {
        return { ok: false, raw: false, message: '포인터 락 실패: ' + (e2 && e2.message) };
      }
    }
    return { ok: false, raw: false, message: '포인터 락 실패(잠시 후 다시 클릭): ' + (err && err.message) };
  }
}

// ---------- 키보드 ----------

export class Keys {
  constructor() {
    this.down = new Set();
    addEventListener('keydown', (e) => this.down.add(e.code));
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }
  has(code) {
    return this.down.has(code);
  }
}
