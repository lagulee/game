// =============================================================
// src/audio.js : 효과음 (전부 WebAudio 로 합성, 외부 파일 없음)
// -------------------------------------------------------------
// [근사 구현] 발로란트 실제 소리 파일이 아니라 비슷한 "신호" 역할만 하는 합성음이다.
//   - 투척음: 짧은 바람 소리(잡음) — 어디서 던졌는지 3D 위치로 들린다
//   - 비행음: 요원별로 다른 웅웅거림 — 플래시를 따라 움직인다
//   - 폭발음: 잡음 터짐 + 낮은 쿵
//   - 이명: 2.6 kHz 근처 사인파. 눈뽕 세기만큼 커졌다가 화면과 같이 페이드아웃
//     (발로란트에 이명이 있다는 출처는 찾지 못함 → docs/flash-spec.md 3절)
// =============================================================

import { BLIND } from './config/flash.js';

const FLIGHT_TONE = {
  // 요원별 비행음 기본 주파수(Hz)와 떨림 속도(Hz) [근사값]
  phoenix: [180, 18],
  skye: [520, 9],
  yoru: [300, 30],
  kayoOver: [240, 12],
  kayoUnder: [240, 12],
  breach: [90, 6],
  reyna: [410, 4],
};

export class AudioFX {
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.ctx = null;
    this.ringNodes = null;
  }

  /** 첫 클릭 때 오디오를 켠다 (브라우저 자동재생 정책) */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      // 이명은 따로 볼륨을 조절할 수 있게 별도 통로
      this.ringBus = this.ctx.createGain();
      this.ringBus.connect(this.ctx.destination);
      this.noise = this.makeNoise();
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  applyVolume() {
    if (!this.ctx) return;
    const s = this.getSettings();
    this.master.gain.value = s.volume;
    this.ringBus.gain.value = s.ringVolume;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 듣는 사람(플레이어) 위치 · 방향 */
  setListener(pos, fwd) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setValueAtTime(pos[0], t);
      L.positionY.setValueAtTime(pos[1], t);
      L.positionZ.setValueAtTime(pos[2], t);
      L.forwardX.setValueAtTime(fwd.x, t);
      L.forwardY.setValueAtTime(fwd.y, t);
      L.forwardZ.setValueAtTime(fwd.z, t);
      L.upX.setValueAtTime(0, t);
      L.upY.setValueAtTime(1, t);
      L.upZ.setValueAtTime(0, t);
    } else {
      L.setPosition(pos[0], pos[1], pos[2]);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.rolloffFactor = 1;
    this.movePanner(p, pos);
    p.connect(this.master);
    return p;
  }

  movePanner(p, pos) {
    if (p.positionX) {
      const t = this.ctx.currentTime;
      p.positionX.setValueAtTime(pos[0], t);
      p.positionY.setValueAtTime(pos[1], t);
      p.positionZ.setValueAtTime(pos[2], t);
    } else {
      p.setPosition(pos[0], pos[1], pos[2]);
    }
  }

  noiseBurst(dest, { dur, gain, freq, q = 1, sweepTo = null, type = 'bandpass' }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** 투척음: 휙 */
  throwSound(pos) {
    if (!this.ctx) return;
    this.noiseBurst(this.panner(pos), { dur: 0.28, gain: 0.9, freq: 700, q: 2, sweepTo: 2400 });
  }

  /** 비행음: 플래시를 따라다니는 소리. { move(pos), stop() } 를 돌려준다 */
  flight(typeId, pos) {
    if (!this.ctx) return { move() {}, stop() {}, rise() {} };
    const [base, wob] = FLIGHT_TONE[typeId] || [300, 10];
    const t = this.ctx.currentTime;
    const pan = this.panner(pos);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    out.connect(pan);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = base;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = base * 4;
    // 떨림(트레몰로)
    const trem = this.ctx.createGain();
    trem.gain.value = 0.5;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = wob;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(trem.gain);
    osc.connect(lp).connect(trem).connect(out);
    osc.start(t);
    lfo.start(t);
    const self = this;
    return {
      move(p) { self.movePanner(pan, p); },
      stop() {
        const t2 = self.ctx.currentTime;
        out.gain.cancelScheduledValues(t2);
        out.gain.setValueAtTime(out.gain.value, t2);
        out.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.05);
        osc.stop(t2 + 0.08);
        lfo.stop(t2 + 0.08);
      },
      // 윈드업 동안 음을 올려 "곧 터진다" 신호
      rise(sec) {
        const t2 = self.ctx.currentTime;
        osc.frequency.setValueAtTime(osc.frequency.value, t2);
        osc.frequency.exponentialRampToValueAtTime(base * 2.5, t2 + sec);
      },
    };
  }

  /** 짧은 삑 (케이/오 튕김 윈드업, 스카이 재사용 등) */
  beep(pos, freq = 1200, dur = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.panner(pos));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** 폭발음 */
  pop(pos) {
    if (!this.ctx) return;
    const p = this.panner(pos);
    this.noiseBurst(p, { dur: 0.35, gain: 1.4, freq: 3000, q: 0.7, type: 'highpass' });
    this.noiseBurst(p, { dur: 0.5, gain: 1.2, freq: 140, q: 0.8, type: 'lowpass' });
  }

  /** 사격음 (레이나 눈 쏘기) */
  shot() {
    if (!this.ctx) return;
    this.noiseBurst(this.master, { dur: 0.12, gain: 0.5, freq: 1800, q: 0.6, type: 'bandpass' });
  }

  /**
   * 이명: strength(0~1) 크기로 시작해 hold 초 유지, fade 초 동안 사라짐.
   * 화면 눈뽕과 같은 시간표를 쓴다. 이미 울리고 있으면 더 센 쪽으로 다시 건다.
   */
  ring(strength, hold, fade) {
    if (!this.ctx || strength <= 0) return;
    const t = this.ctx.currentTime;
    if (this.ringNodes) {
      try { this.ringNodes.forEach((n) => n.stop(t + 0.02)); } catch (e) { /* 이미 멈춤 */ }
    }
    const g = this.ctx.createGain();
    const peak = 0.18 * strength;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.setValueAtTime(peak, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + Math.max(0.05, fade));
    g.connect(this.ringBus);
    const f = BLIND.ringFreq;
    const o1 = this.ctx.createOscillator();
    o1.frequency.value = f;
    const o2 = this.ctx.createOscillator(); // 살짝 다른 주파수 → 맥놀이(웅-웅)
    o2.frequency.value = f * 1.004;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.5;
    o1.connect(g);
    o2.connect(g2).connect(g);
    const end = t + hold + fade + 0.1;
    o1.start(t); o2.start(t);
    o1.stop(end); o2.stop(end);
    this.ringNodes = [o1, o2];
  }
}
