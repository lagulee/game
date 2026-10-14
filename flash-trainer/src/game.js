// =============================================================
// src/game.js : 반복 훈련 규칙 · 점수 · 기록
// -------------------------------------------------------------
// 이 파일은 "게임 규칙"이라 발로란트에 대응하는 값이 없다(모두 훈련용 설계).
//   - 라운드: 잠깐 쉬었다가 → 플래시 1~3개를 랜덤 위치/종류로 던짐 → 모두 터지면 채점
//   - 점수: 그 라운드에서 하얗게 보이지 않은 시간 = 눈뽕 지속시간(초). 0초 = 완벽 회피
//           여러 개가 겹치면 [폭발 시각, 폭발 시각 + 지속시간] 구간들의 합집합 길이
//   - 반응 시간: 투척 순간(투척음) → 시점이 REACTION_START_DEG 이상 돌아가기 시작한 순간
// =============================================================

import { FLASH_TYPES, REACTION_START_DEG, GRADE } from './config/flash.js';
import { planThrow } from './flash.js';
import { BOT } from './config/combat.js';

/** 구간 [a, b] 들의 합집합 길이 */
export function unionLength(intervals) {
  const xs = intervals.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  let total = 0;
  let curA = null;
  let curB = null;
  for (const [a, b] of xs) {
    if (curB === null || a > curB) {
      if (curB !== null) total += curB - curA;
      curA = a;
      curB = b;
    } else if (b > curB) {
      curB = b;
    }
  }
  if (curB !== null) total += curB - curA;
  return total;
}

export function grade(sec) {
  return GRADE.find((g) => sec <= g.max) || GRADE[GRADE.length - 1];
}

export class Training {
  constructor({ flashes, combat, look, eye, settings }) {
    this.flashes = flashes;
    this.combat = combat;
    this.look = look;
    this.eye = eye;
    this.settings = settings;
    this.state = 'waiting';
    this.nextAt = 1.5;
    this.round = null;
    this.roundNo = 0;
    this.history = []; // { no, blind, reaction, types, detail }
    this.pending = []; // 아직 던지지 않은 (조금 늦게 던질) 투척
    this.dirty = true;

    flashes.onResult((r) => this.onResult(r));
    if (combat) combat.onBotResult((r) => this.onBotResult(r));
    look.listeners.push((dYaw, dPitch) => this.onLook(dYaw, dPitch));
  }

  pause() {}

  resume() {
    // 감도 테스트 모드를 다녀오면 진행 중이던 플래시가 지워졌을 수 있다 → 라운드를 새로 시작
    if (this.state === 'live' && this.flashes.active.length === 0 && this.pending.length === 0
      && !(this.combat && this.combat.hasPeekBots())) {
      this.state = 'waiting';
      this.round = null;
      this.nextAt = this.flashes.time + 1.0;
    }
    this.dirty = true;
  }

  onLook(dYaw, dPitch) {
    const r = this.round;
    if (!r || r.reaction != null) return;
    r.turned += Math.abs(dYaw) + Math.abs(dPitch);
    if (r.turned >= REACTION_START_DEG) r.reaction = this.flashes.time - r.castAt;
  }

  enabledTypes() {
    const en = this.settings.training.enabled;
    const list = Object.keys(FLASH_TYPES).filter((id) => en[id]);
    return list.length ? list : ['phoenix'];
  }

  startRound() {
    const t = this.settings.training;
    const types = this.enabledTypes();
    this.roundNo++;
    this.round = {
      no: this.roundNo, castAt: this.flashes.time, reaction: null, turned: 0,
      expected: t.count, results: [], types: [],
    };
    for (let i = 0; i < t.count; i++) {
      const typeId = types[Math.floor(Math.random() * types.length)];
      // 동시 투척은 0~0.3초 사이로 살짝 어긋나게 [훈련용 설계]
      this.pending.push({ typeId, at: this.flashes.time + (i === 0 ? 0 : Math.random() * 0.3) });
      this.round.types.push(typeId);
    }
    this.state = 'live';
    this.dirty = true;
  }

  launchPending() {
    const now = this.flashes.time;
    const t = this.settings.training;
    const ready = this.pending.filter((p) => p.at <= now);
    this.pending = this.pending.filter((p) => p.at > now);
    for (const p of ready) {
      const plan = planThrow(p.typeId, {
        eye: this.eye(), yawDeg: this.look.yawDeg, distMin: t.distMin, distMax: t.distMax,
        allowBehind: t.allowBehind, windupScale: t.windupScale, fastScale: t.fastScale,
      });
      this.flashes.launch(plan, this.round.no);
      // 플래시와 함께 피킹: 플래시가 터지는 순간 봇이 폭발 지점 뒤에서 튀어나온다
      if (this.combat && this.settings.combat.botMode === 'peek') {
        this.round.expected++;
        this.combat.spawnPeek({ roundId: this.round.no, pop: plan.pop, at: now + plan.throwAnim + plan.popTime + BOT.peekDelay });
      }
    }
  }

  onResult(r) {
    const round = this.round;
    if (!round || r.f.roundId !== round.no) return;
    round.results.push(r);
    if (round.results.length >= round.expected) this.finishRound();
  }

  onBotResult(r) {
    const round = this.round;
    if (!round || r.roundId !== round.no) return;
    round.results.push({ kind: 'bot', popAt: this.flashes.time, blindSec: 0, ...r });
    if (round.results.length >= round.expected) this.finishRound();
  }

  finishRound() {
    const round = this.round;
    const flashIntervals = round.results.filter((r) => r.kind === 'flash').map((r) => [r.popAt, r.popAt + r.blindSec]);
    const near = round.results.filter((r) => r.kind === 'nearsight').reduce((s, r) => s + r.blindSec, 0);
    const blind = unionLength(flashIntervals) + near;
    const lastEnd = Math.max(...round.results.map((r) => r.popAt + (r.kind === 'flash' ? r.hold + r.fade : 0)), this.flashes.time);
    const bots = round.results.filter((r) => r.kind === 'bot' && !r.skipped);
    const kills = bots.filter((r) => r.killed);
    this.history.unshift({
      no: round.no, blind, reaction: round.reaction, types: round.types.slice(),
      detail: round.results.filter((r) => r.kind !== 'bot').map(summarize),
      bots: bots.length, kills: kills.length, died: bots.some((r) => !r.killed),
      ttk: kills.length ? Math.max(...kills.map((r) => r.ttk)) : null,
    });
    if (this.history.length > 200) this.history.pop();
    const t = this.settings.training;
    this.nextAt = Math.max(lastEnd, this.flashes.time) + t.gapMin + Math.random() * (t.gapMax - t.gapMin);
    this.state = 'waiting';
    this.round = null;
    this.dirty = true;
  }

  update() {
    if (this.state === 'waiting' && this.flashes.time >= this.nextAt) this.startRound();
    if (this.pending.length) this.launchPending();
  }

  stats() {
    const h = this.history;
    if (!h.length) return null;
    const blinds = h.map((x) => x.blind);
    const reacts = h.map((x) => x.reaction).filter((x) => x != null);
    return {
      rounds: h.length,
      avg: blinds.reduce((a, b) => a + b, 0) / h.length,
      best: Math.min(...blinds),
      perfect: blinds.filter((b) => b <= GRADE[0].max).length,
      avgReact: reacts.length ? reacts.reduce((a, b) => a + b, 0) / reacts.length : null,
      bestReact: reacts.length ? Math.min(...reacts) : null,
      botRounds: h.filter((x) => x.bots > 0).length,
      won: h.filter((x) => x.bots > 0 && !x.died).length,
      avgTtk: avg(h.map((x) => x.ttk).filter((x) => x != null)),
    };
  }

  render() {
    const c0 = this.combat && this.combat.stats;
    const key = c0 ? `${c0.shots},${c0.hits},${c0.kills}` : '';
    if (key !== this.combatKey) { this.combatKey = key; this.dirty = true; }
    if (!this.dirty) return;
    this.dirty = false;
    const t = this.settings.training;
    document.getElementById('hud-mode').textContent =
      `반복 훈련 · ${t.count}개 동시 · ${t.distMin}~${t.distMax}m · 윈드업 ×${t.windupScale}`;
    const s = this.stats();
    document.getElementById('hud-stats').innerHTML = s
      ? `라운드 <b>${s.rounds}</b> · 완벽 회피 <b>${s.perfect}</b><br>`
        + `평균 눈뽕 <b>${s.avg.toFixed(2)}s</b> · 최고 <b>${s.best.toFixed(2)}s</b><br>`
        + `평균 반응 <b>${fmtMs(s.avgReact)}</b> · 최고 반응 <b>${fmtMs(s.bestReact)}</b>`
      : '첫 플래시를 기다리는 중… 소리를 잘 들으세요.';
    const c = this.combat && this.combat.stats;
    if (c && c.shots) {
      document.getElementById('hud-stats').innerHTML += `<br>처치 <b>${c.kills}</b> · 명중 <b>${pct(c.hits, c.shots)}</b> · 헤드 <b>${pct(c.heads, c.hits)}</b>`
        + (s && s.botRounds ? `<br>피킹 승리 <b>${s.won}/${s.botRounds}</b> · 평균 처치 <b>${fmtMs(s.avgTtk)}</b>` : '');
    }
    document.getElementById('hud-log').innerHTML = this.history.slice(0, 8).map((x) => {
      const g = grade(x.blind);
      const names = x.types.map((id) => FLASH_TYPES[id].short).join('+');
      const fight = !x.bots ? '' : x.died ? ' · <b>당함</b>' : ` · 처치 ${fmtMs(x.ttk)}`;
      return `<div class="${x.died ? 'bad' : g.cls}">#${x.no} ${names} — ${x.blind.toFixed(2)}s ${g.label} · 반응 ${fmtMs(x.reaction)}${fight}`
        + `<br><span class="dim">${x.detail.join(' / ')}</span></div>`;
    }).join('');
  }
}

function avg(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function pct(a, b) {
  return b ? `${Math.round((a / b) * 100)}%` : '—';
}

function fmtMs(sec) {
  return sec == null ? '—' : `${Math.round(sec * 1000)}ms`;
}

function summarize(r) {
  if (r.kind === 'nearsight') return `근시 ${r.blindSec.toFixed(2)}s${r.destroyed ? ' (눈 파괴)' : ''}`;
  if (r.blocked) return '벽에 가려짐';
  return `각도 ${Math.round(r.theta)}° → ${Math.round(r.factor * 100)}% (최대 ${r.maxBlind.toFixed(2)}s)`;
}
