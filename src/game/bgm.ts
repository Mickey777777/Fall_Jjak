/**
 * 배경 음악(BGM) 재생 — Pond Lilt 루프.
 *
 * 긴 mp3는 Web Audio 버퍼보다 HTMLAudioElement 루프가 단순하고 메모리 효율적이라
 * sound.ts(효과음)와 달리 Audio 엘리먼트를 쓴다.
 * 게임 플레이 중에만 재생한다(메뉴/조작법/일시정지에서는 정지). 음소거 상태를 그대로 따른다.
 * 사망 시에는 게임오버 화면이 뜨기 전에 fade out으로 끈다.
 */
import { useGameStore } from "../store/useGameStore";
import type { GamePhase } from "./types";

const BGM_VOLUME = 0.12; // SFX보다 낮게 깔리는 배경음
const BGM_FADE_MS = 2200; // 사망 시 fade out 시간 — 게임오버 화면이 뜬 뒤에도 서서히 사라진다
const BGM_SRC = import.meta.env.BASE_URL + "pond-lilt.mp3";
// BGM이 재생되는 phase — 그 외(menu/control/tutorial/paused/gameover)에서는 정지한다.
const PLAY_PHASES: GamePhase[] = ["playing"];

let audio: HTMLAudioElement | null = null;
let fadeRAF: number | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audio) return audio;
  audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.volume = BGM_VOLUME;
  audio.preload = "auto";
  return audio;
}

/** 진행 중인 fade를 중단하고 볼륨을 기본값으로 되돌린다. */
function cancelFade(a: HTMLAudioElement) {
  if (fadeRAF !== null) {
    cancelAnimationFrame(fadeRAF);
    fadeRAF = null;
  }
  a.volume = BGM_VOLUME;
}

/**
 * 현재 store 상태(muted, phase)에 맞춰 재생/정지를 동기화한다.
 * 음소거이거나 재생 대상 phase가 아니면 정지, 그 외에는 (이어서) 재생한다.
 * autoplay 정책으로 play()가 차단되면 reject되며, 사용자 제스처가 다시 호출해 깨운다.
 */
export function syncBgm() {
  const { muted, phase } = useGameStore.getState();
  const a = getAudio();
  if (!a) return;
  cancelFade(a);
  if (muted || !PLAY_PHASES.includes(phase)) {
    a.pause();
  } else {
    a.play().catch(() => {});
  }
}

/** 새 게임 시작 — 노래를 처음으로 되감고 현재 상태에 맞춰 재생한다. */
export function restartBgm() {
  const a = getAudio();
  if (!a) return;
  cancelFade(a);
  a.currentTime = 0;
  syncBgm();
}

/** 사망 시 — 볼륨을 점진적으로 0까지 줄인 뒤 정지한다(자연스러운 끝맺음). */
export function fadeOutBgm() {
  const a = getAudio();
  if (!a) return;
  if (fadeRAF !== null) cancelAnimationFrame(fadeRAF);
  if (a.paused || a.volume <= 0) {
    a.pause();
    a.volume = BGM_VOLUME;
    fadeRAF = null;
    return;
  }
  const startVol = a.volume;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / BGM_FADE_MS);
    a.volume = startVol * (1 - t);
    if (t < 1) {
      fadeRAF = requestAnimationFrame(step);
    } else {
      fadeRAF = null;
      a.pause();
      a.volume = BGM_VOLUME; // 다음 재생을 위해 볼륨 복구
    }
  };
  fadeRAF = requestAnimationFrame(step);
}
