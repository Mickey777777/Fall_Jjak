import { SCORE, LILY } from "./constants";
import type { JudgmentType } from "./types";

/**
 * 착지 오차(연잎 중심까지의 평면 거리)를 받아 판정 종류와 기본 점수를 반환.
 */
export function judgeLanding(distFromCenter: number): {
  type: JudgmentType;
  baseScore: number;
} {
  if (distFromCenter > LILY.RADIUS) {
    return { type: "Miss", baseScore: 0 };
  }
  // 정규화: 0 ≈ 중앙, 1 ≈ 가장자리
  if (distFromCenter <= LILY.YARR_THRESHOLD) {
    return { type: "Yarr", baseScore: SCORE.YARR };
  }
  if (distFromCenter <= LILY.GREAT_THRESHOLD) {
    return { type: "Great", baseScore: SCORE.GREAT };
  }
  return { type: "NotBad", baseScore: SCORE.NOT_BAD };
}

/** 현재 콤보에 대응하는 배율 반환 */
export function comboMultiplier(combo: number): number {
  let mult = 1.0;
  for (const tier of SCORE.COMBO_TIERS) {
    if (combo >= tier.combo) mult = tier.mult;
  }
  return mult;
}

/** 판정 텍스트 (HUD 표기용) */
export function judgmentText(t: JudgmentType): string {
  switch (t) {
    case "Yarr":
      return "Yarr!";
    case "Great":
      return "Great";
    case "NotBad":
      return "Not bad..";
    case "Miss":
      return "Miss";
  }
}

/** 판정 색상 */
export function judgmentColor(t: JudgmentType): string {
  switch (t) {
    case "Yarr":
      return "#ffd84d";
    case "Great":
      return "#7df2a1";
    case "NotBad":
      return "#c9c9c9";
    case "Miss":
      return "#ff6a6a";
  }
}
