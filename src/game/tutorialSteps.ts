import { ENEMY } from "./constants";
import type { BuffType, EnemyType } from "./types";

/**
 * 튜토리얼 스텝 정의 (데이터-주도).
 *
 * 각 스텝은 "현재 개구리가 서 있는 발판(base)" 기준의 상대 좌표로 한 구간(segment)을
 * 정의한다. 스텝이 완료되면 다음 스텝의 구간이 그 앞에 이어 붙어 하나의 연속 코스가 된다.
 * 본게임과 달리 날씨/악어/난수 스폰/특수연잎은 사용하지 않는다.
 */

export interface TutorialProgress {
  /** 직전에 착지한 연잎 id */
  lastLandPadId: number | null;
  /** 이 스텝에서 잡아먹은 파리 수 */
  fliesEaten: number;
  /** 낙수 없이 연속으로 착지한 횟수 (콤보 단계 게이트) */
  consecutiveLandings: number;
}

/** base(현재 발판) 기준 상대 좌표 발판 */
export interface PadSpec {
  dx: number;
  dz: number;
  radius?: number;
}
export interface EnemySpec {
  type: EnemyType;
  dx: number;
  dy: number;
  dz: number;
  amplitude?: number;
}
export interface ItemSpec {
  type: BuffType;
  dx: number;
  dy: number;
  dz: number;
}

export interface TutorialStep {
  id: string;
  lesson: 1 | 2 | 3;
  instructionPC: string;
  instructionTouch: string;
  /** 실패(낙수/피격) 시 노출할 힌트 */
  hint?: string;
  /** base 기준 앞쪽에 새로 까는 발판들 */
  pads: PadSpec[];
  enemies: EnemySpec[];
  items: ItemSpec[];
  /** pads 중 완료 기준이 되는 인덱스(착지 시 다음 구간의 시작 발판). null이면 점프 없음(파리 단계) */
  targetIndex: number | null;
  isComplete: (p: TutorialProgress, targetPadId: number | null) => boolean;
}

export function freshProgress(): TutorialProgress {
  return {
    lastLandPadId: null,
    fliesEaten: 0,
    consecutiveLandings: 0,
  };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── 레슨 1: 기본 점프 ──
  {
    id: "basic-jump",
    lesson: 1,
    instructionPC:
      "커서를 움직여 방향을 정하고,\n우클릭을 누른 채 드래그해 거리를 맞춘 뒤\n손을 떼어 점프하세요.",
    instructionTouch:
      "화면을 누른 채 끌어 거리를 맞추고,\n손을 떼어 앞 연잎으로 점프하세요.",
    hint: "방향과 거리를 맞춰 앞 연잎 위로 다시 점프해 보세요.",
    pads: [{ dx: 5, dz: 0 }],
    enemies: [],
    items: [],
    targetIndex: 0,
    isComplete: (p, t) => p.lastLandPadId === t,
  },

  // ── 레슨 2-a: 파리 사냥 ──
  {
    id: "fly",
    lesson: 2,
    instructionPC: "앞에 있는 파리에 커서를 올리고 좌클릭으로 잡아먹으세요.",
    instructionTouch: "앞에 있는 파리를 탭해서 잡아먹으세요.",
    hint: "파리에 정확히 조준한 뒤 좌클릭(탭)하세요.",
    pads: [],
    enemies: [],
    items: [{ type: "rangeUp", dx: 1.6, dy: 1.6, dz: 0 }],
    targetIndex: null,
    isComplete: (p) => p.fliesEaten >= 1,
  },

  // ── 레슨 2-b: 판정 / 콤보 ──
  {
    id: "judgment-combo",
    lesson: 2,
    instructionPC:
      "연잎 중앙에 가까울수록 높은 점수 획득!\n연속으로 두 번 착지해 콤보를 쌓아보세요.",
    instructionTouch:
      "연잎 중앙에 가까울수록 높은 점수 획득!\n연속으로 두 번 착지해 콤보를 쌓아보세요.",
    hint: "물에 빠지지 않게 연잎 위로 연속 두 번 착지하세요.",
    pads: [
      { dx: 6, dz: 0 },
      { dx: 13, dz: 0 },
    ],
    enemies: [],
    items: [],
    targetIndex: 1,
    isComplete: (p) => p.consecutiveLandings >= 2,
  },

  // ── 레슨 3-a: 물고기 회피 ──
  {
    id: "fish",
    lesson: 3,
    instructionPC:
      "물고기는 낮게 날면 잡아먹어요.\nA 로 궤적을 높여 머리 위로 넘으세요.",
    instructionTouch:
      "물고기는 낮게 날면 잡아먹어요.\n▲ 로 궤적을 높여 머리 위로 넘으세요.",
    hint: "A(▲) 로 궤적을 더 높여 물고기 위로 넘으세요.",
    pads: [{ dx: 8, dz: 0 }],
    enemies: [{ type: "fish", dx: 4, dy: -0.3, dz: 0, amplitude: 1 }],
    items: [],
    targetIndex: 0,
    isComplete: (p, t) => p.lastLandPadId === t,
  },

  // ── 레슨 3-b: 새 회피 ──
  {
    id: "bird",
    lesson: 3,
    instructionPC: "새는 높게 날면 낚아채요.\nS 로 궤적을 낮춰 아래로 지나가세요.",
    instructionTouch:
      "새는 높게 날면 낚아채요.\n▼ 로 궤적을 낮춰 아래로 지나가세요.",
    hint: "S(▼) 로 궤적을 더 낮춰 새 아래로 지나가세요.",
    pads: [{ dx: 8, dz: 0 }],
    enemies: [
      { type: "bird", dx: 4, dy: ENEMY.BIRD_SPAWN_Y, dz: 0, amplitude: 0.4 },
    ],
    items: [],
    targetIndex: 0,
    isComplete: (p, t) => p.lastLandPadId === t,
  },

  // ── 레슨 3-c: 장애물 회피 (마지막 — 가운데 연잎으로 마무리) ──
  {
    id: "obstacle",
    lesson: 3,
    instructionPC:
      "장애물은 부딪히면 실패!\n조준을 틀어 옆 연잎으로 비껴 건넌 뒤,\n가운데 연잎으로 이어 뛰어 마무리하세요.",
    instructionTouch:
      "장애물은 부딪히면 실패!\n조준을 틀어 옆 연잎으로 비껴 건넌 뒤,\n가운데 연잎으로 이어 뛰어 마무리하세요.",
    hint: "장애물을 피해 옆 연잎으로 건넌 다음, 가운데 연잎으로 이어 뛰세요.",
    pads: [
      { dx: 7, dz: 3 },
      { dx: 12, dz: 0 },
    ],
    enemies: [{ type: "obstacle", dx: 3.2, dy: 0.6, dz: 0 }],
    items: [],
    targetIndex: 1,
    isComplete: (p, t) => p.lastLandPadId === t,
  },
];
