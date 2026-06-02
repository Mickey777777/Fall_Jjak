import type { Vector3Tuple } from "three";

export type GamePhase = "menu" | "control" | "playing" | "paused" | "gameover";

export type JudgmentType = "Yarr" | "Great" | "NotBad" | "Miss" | "Chomp";

export type LilyPadType =
  | "basic"
  | "rotten"
  | "slippery"
  | "moving"
  | "rotating"
  | "trap"
  | "spring"
  | "blinking";

export type WeatherType = "clear" | "fog" | "wind" | "rain" | "cloud";

export type EnemyType = "fish" | "bird" | "obstacle";

export type BuffType = "rangeUp" | "swim" | "scoreBoost";

export interface LilyPadData {
  id: number;
  type: LilyPadType;
  position: Vector3Tuple;
  radius: number;
  // For moving / rotating / blinking pads
  spawnTime: number;
  amplitude?: number;
  frequency?: number;
  axis?: "x" | "z";
  destroyed?: boolean;
  // Lifetime for rotten pads (seconds after first step)
  steppedAt?: number;
  // 시각용 변동: 살짝 다른 회전·크기 비율
  visualRotation?: number;
  visualScale?: number;
  // 착지 파문 트리거
  rippleAt?: number;
  rotationDirection?: 1 | -1;  // 1 = 반시계, -1 = 시계
  // 수영 복귀 점멸 연잎: 이 시간부터 줄어들기 시작 (null이면 아직 안정)
  swimShrinkAt?: number;
}

export interface EnemyData {
  id: number;
  type: EnemyType;
  position: Vector3Tuple;
  spawnTime: number;
  // Bird patrol amplitude / fish lunge timing etc.
  amplitude?: number;
  active: boolean;
}

export interface ItemData {
  id: number;
  type: BuffType;
  position: Vector3Tuple;
  collected: boolean;
}

export interface ActiveBuff {
  type: BuffType;
  remaining: number; // seconds
}

export interface JudgmentPopup {
  id: number;
  type: JudgmentType;
  text: string;
  position: Vector3Tuple;
  bornAt: number;
  score: number;
}

export interface WindState {
  direction: number; // radians
  strength: number; // 0..1
}
