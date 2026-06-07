/**
 * Web Audio API 기반의 가벼운 효과음 합성.
 *
 * 외부 파일 의존 없이 sin/triangle 톤만으로 판정/점프/탈락음을 만든다.
 * 음소거 상태일 때는 모두 무시.
 */
import { useGameStore } from "../store/useGameStore";
import type { JudgmentType } from "./types";

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function isMuted() {
  return useGameStore.getState().muted;
}

function blip(
  freq: number,
  type: OscillatorType,
  duration: number,
  gain = 0.18,
) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    // 사용자 제스처가 있어야 재생됨. 한 번 시도해 깨운다.
    c.resume().catch(() => {});
  }
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playJudgment(t: JudgmentType) {
  switch (t) {
    case "Yarr":
      blip(880, "triangle", 0.12);
      setTimeout(() => blip(1320, "triangle", 0.16), 70);
      break;
    case "Great":
      blip(660, "triangle", 0.14);
      break;
    case "NotBad":
      blip(330, "sine", 0.18);
      break;
    case "Miss":
      blip(180, "sawtooth", 0.3);
      break;
  }
}

export function playPlop() {
  blip(200, "sine", 0.18, 0.22);
  setTimeout(() => blip(110, "sine", 0.25, 0.18), 60);
}

export function playSplash() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  // 저음 충격
  blip(75, "sine", 0.32, 0.30);
  setTimeout(() => blip(115, "sine", 0.22, 0.22), 35);

  // 노이즈 버스트 (물 튀는 소리)
  const sr = c.sampleRate;
  const frames = Math.ceil(sr * 0.38);
  const buf = c.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bpf = c.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = 1400;
  bpf.Q.value = 0.7;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.14, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  src.connect(bpf);
  bpf.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.4);

  // 방울 떨어지는 고음
  setTimeout(() => blip(750, "sine", 0.09, 0.06), 90);
  setTimeout(() => blip(560, "sine", 0.11, 0.05), 160);
}

export function playSlurp() {
  blip(540, "sawtooth", 0.07, 0.12);
  setTimeout(() => blip(820, "triangle", 0.08, 0.12), 35);
}

export function playSpring() {
  blip(420, "square", 0.08, 0.16);
  setTimeout(() => blip(720, "square", 0.1, 0.16), 60);
}

/** UI 버튼 클릭 — 필터된 노이즈로 만든 짧은 "틱"(톤 멜로디와 음색이 겹치지 않게) */
export function playClick() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;

  const dur = 0.028;
  const sr = c.sampleRate;
  const frames = Math.ceil(sr * dur);
  const buf = c.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bpf = c.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = 2400;
  bpf.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bpf);
  bpf.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
}

/** UI 버튼 호버 — 클릭보다 더 작고 높은 미묘한 "사락" */
export function playHover() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;

  const dur = 0.018;
  const sr = c.sampleRate;
  const frames = Math.ceil(sr * dur);
  const buf = c.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bpf = c.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = 3400;
  bpf.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.05, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bpf);
  bpf.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
}

/** 점프 발사 — 짧게 솟구치는 "휙" (상승 피치 스윕 + 가벼운 바람 노이즈) */
export function playWhoosh() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;

  // 상승 피치 스윕
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(260, t0);
  osc.frequency.exponentialRampToValueAtTime(620, t0 + 0.16);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.22);

  // 가벼운 바람 노이즈
  const sr = c.sampleRate;
  const frames = Math.ceil(sr * 0.16);
  const buf = c.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpf = c.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 900;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.06, t0);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(hpf);
  hpf.connect(ng);
  ng.connect(c.destination);
  src.start(t0);
  src.stop(t0 + 0.18);
}

/** 천둥 — 저주파 우르릉(필터 노이즈) + 초반 크랙. power 1=가까움(크고 밝게) / 0=멀리(작고 먹먹) */
export function playThunder(power = 1) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;
  const p = Math.max(0.2, Math.min(1, power));

  // 저주파 럼블 — 길게 감쇠하는 lowpass 노이즈 (멀수록 더 먹먹하게 컷)
  const dur = 1.4 + p * 0.6;
  const sr = c.sampleRate;
  const frames = Math.ceil(sr * dur);
  const buf = c.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 180 + p * 220; // 가까울수록 고역 살아남음
  lpf.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.34 * p, t0 + 0.05); // 초반 쾅
  g.gain.exponentialRampToValueAtTime(0.13 * p, t0 + 0.5); // 우르릉
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lpf);
  lpf.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);

  // 가까울 때만 또렷한 크랙 한 방
  if (p > 0.6) blip(95, "sawtooth", 0.22, 0.12 * p);
}

/** 콤보 끊김 — 쌓인 콤보가 리셋될 때의 하강 "뿜~" (실망감) */
export function playComboBreak() {
  blip(330, "triangle", 0.12, 0.13);
  setTimeout(() => blip(247, "triangle", 0.14, 0.12), 80); // 단3도 아래
  setTimeout(() => blip(165, "sine", 0.22, 0.12), 175); // 더 아래로 처짐
}

/** 콤보 등급 상승 — 등급(tier)이 높을수록 더 높은 음에서 시작하는 상승 아르페지오 */
export function playComboUp(tier: number) {
  // tier 0..N → 시작 음 상승 (반음 단위 비례)
  const base = 523 * Math.pow(2, Math.min(tier, 8) / 12); // C5에서 반음씩
  blip(base, "triangle", 0.1, 0.14);
  setTimeout(() => blip(base * 1.26, "triangle", 0.1, 0.14), 70); // 장3도
  setTimeout(() => blip(base * 1.5, "triangle", 0.14, 0.15), 145); // 완전5도
  // 높은 등급일수록 옥타브 반짝임 추가
  if (tier >= 3) setTimeout(() => blip(base * 2, "sine", 0.16, 0.1), 220);
}

/** 콤보 프리징 발동 — 콤보를 지켜낸 순간의 차가운 반짝임(높은 사인 음 상행) */
export function playComboFreeze() {
  blip(1046, "sine", 0.12, 0.12); // C6
  setTimeout(() => blip(1318, "sine", 0.12, 0.12), 60); // E6
  setTimeout(() => blip(1568, "sine", 0.18, 0.11), 120); // G6
}

export function playCrocSnap() {
  // 악어 잡아먹는 소리 — 낮은 충격 + 찰칵
  blip(65, "sawtooth", 0.22, 0.32);
  setTimeout(() => blip(130, "square", 0.12, 0.22), 85);
  setTimeout(() => blip(200, "square", 0.06, 0.14), 155);
}

let _lastCrocWarnAt = 0;
export function playCrocWarnIfNeeded(dist: number) {
  const now = performance.now();
  // 5.8m(화면 등장) → 3800ms, 2.6m(임박) → 1000ms 으르렁 간격
  const t = Math.min(1, Math.max(0, (dist - 2.6) / (5.8 - 2.6)));
  const interval = 1000 + t * 2800;
  if (now - _lastCrocWarnAt < interval) return;
  _lastCrocWarnAt = now;
  blip(55, "sawtooth", 0.42, 0.12);
  setTimeout(() => blip(72, "sawtooth", 0.32, 0.08), 190);
}
