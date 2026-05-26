import { DIFFICULTY, LILY } from "./constants";
import type { LilyPadType, WeatherType } from "./types";

/** 누적 이동 거리에서 0..1 사이의 난이도를 산출 */
export function difficultyOf(distance: number): number {
  return Math.min(1, distance / DIFFICULTY.DISTANCE_FOR_MAX);
}

/** 난이도에 따른 연잎 간격 (m) 반환 — 멀어질수록 변동성이 커진다 */
export function gapForDifficulty(diff: number, rand: () => number): number {
  const min = LILY.MIN_GAP + diff * 0.6;
  const max = LILY.MAX_GAP + diff * 2.0;
  return min + rand() * (max - min);
}

/** 좌우 흔들림 폭 — 시작부터 충분히 넓게, 난이도가 오를수록 더 넓어짐 */
export function lateralForDifficulty(diff: number, rand: () => number): number {
  const range = LILY.MAX_LATERAL * (0.55 + diff * 0.45);
  return (rand() * 2 - 1) * range;
}

/** 새 연잎 타입을 난이도에 따라 가중 추첨 */
export function pickPadType(diff: number, rand: () => number): LilyPadType {
  const specialProb =
    DIFFICULTY.SPECIAL_PROB_MIN +
    diff * (DIFFICULTY.SPECIAL_PROB_MAX - DIFFICULTY.SPECIAL_PROB_MIN);
  if (rand() > specialProb) return "basic";
  const choices: LilyPadType[] = [
    "rotten",
    "slippery",
    "moving",
    "rotating",
    "trap",
    "spring",
    "blinking",
  ];
  return choices[Math.floor(rand() * choices.length)];
}

/** 적 출현 확률 (한 연잎 구간당) */
export function enemyProb(diff: number): number {
  return (
    DIFFICULTY.ENEMY_PROB_MIN +
    diff * (DIFFICULTY.ENEMY_PROB_MAX - DIFFICULTY.ENEMY_PROB_MIN)
  );
}

/** 날씨 한 번 변경 후 다음 변경까지의 시간(초) */
export function weatherIntervalFor(diff: number, rand: () => number): number {
  // 난이도가 높아질수록 짧아진다.
  const base =
    DIFFICULTY.WEATHER_INTERVAL_MAX -
    diff * (DIFFICULTY.WEATHER_INTERVAL_MAX - DIFFICULTY.WEATHER_INTERVAL_MIN);
  return base + (rand() - 0.5) * 4;
}

/** 다음 날씨를 골라 반환 (현재 날씨 제외) */
export function pickWeather(current: WeatherType, rand: () => number): WeatherType {
  const all: WeatherType[] = ["clear", "fog", "wind", "rain", "cloud"];
  const filtered = all.filter((w) => w !== current);
  return filtered[Math.floor(rand() * filtered.length)];
}
