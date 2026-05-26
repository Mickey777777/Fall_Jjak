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

export function playSlurp() {
  blip(540, "sawtooth", 0.07, 0.12);
  setTimeout(() => blip(820, "triangle", 0.08, 0.12), 35);
}

export function playSpring() {
  blip(420, "square", 0.08, 0.16);
  setTimeout(() => blip(720, "square", 0.1, 0.16), 60);
}

export function playCrocSnap() {
  // 악어 잡아먹는 소리 — 낮은 충격 + 찰칵
  blip(65, "sawtooth", 0.22, 0.32);
  setTimeout(() => blip(130, "square", 0.12, 0.22), 85);
  setTimeout(() => blip(200, "square", 0.06, 0.14), 155);
}

let _lastCrocWarnAt = 0;
export function playCrocWarnIfNeeded() {
  const now = performance.now();
  if (now - _lastCrocWarnAt < 3800) return;
  _lastCrocWarnAt = now;
  // 낮은 으르렁 소리
  blip(55, "sawtooth", 0.42, 0.12);
  setTimeout(() => blip(72, "sawtooth", 0.32, 0.08), 190);
}
