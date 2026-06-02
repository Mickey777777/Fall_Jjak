import { SCORE, LILY } from "./constants";
import type { JudgmentType } from "./types";

/**
 * 착지 오차(연잎 중심까지의 평면 거리)와 착지한 연잎 반지름을 받아
 * 판정 종류와 기본 점수를 반환.
 *
 * Miss 경계는 연잎 실제 반지름과 일치해야 한다 — 그래야 "점수 획득 ⟺ 연잎 위
 * ⟺ 생존"이 보장되고, 테두리 착지 시 점수와 동시에 추락하는 일이 없다.
 */
export function judgeLanding(distFromCenter: number, padRadius: number): {
  type: JudgmentType;
  baseScore: number;
} {
  // 생존 검사(onPad)가 `dist < radius`이므로 경계를 정확히 일치시킨다.
  if (distFromCenter >= padRadius) {
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
    default:
      return "";
  }
}

/** 판정 색상 */
export function judgmentColor(t: JudgmentType): string {
  switch (t) {
    case "Yarr":
      return "#F59E0B";
    case "Great":
      return "#22C55E";
    case "NotBad":
      return "#9CA3AF";
    case "Miss":
      return "#ff6a6a";
    default:
      return "#ffffff";
  }
}
