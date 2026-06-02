import { JUMP } from "./constants";

/**
 * 포물선 점프 보간기.
 * 시작점/도착점/정점 높이/지속시간을 받아 진행률 t(0..1)에서의 좌표를 반환한다.
 */
export interface JumpPlan {
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  arcHeight: number;
  duration: number;
  /** 바람 영향 (x, z) — 비행 중 누적 가속도로 작용 */
  windX: number;
  windZ: number;
}

export function makeJumpPlan(
  startX: number,
  startZ: number,
  direction: number,
  distance: number,
  arcHeight: number,
  wind: { direction: number; strength: number },
): JumpPlan {
  const endX = startX + Math.cos(direction) * distance;
  const endZ = startZ + Math.sin(direction) * distance;
  const duration =
    JUMP.TIME_BASE + JUMP.TIME_PER_METER * Math.max(0, distance);
  // 바람은 점프 길이에 비례해 도착점을 휘게 만든다.
  const windFactor = wind.strength * Math.min(1, distance / JUMP.MAX_DISTANCE);
  const windX = Math.cos(wind.direction) * windFactor * 1.6;
  const windZ = Math.sin(wind.direction) * windFactor * 1.6;
  return {
    startX,
    startZ,
    endX: endX + windX,
    endZ: endZ + windZ,
    arcHeight: Math.max(JUMP.ARC_MIN, Math.min(JUMP.ARC_MAX, arcHeight)),
    duration,
    windX,
    windZ,
  };
}

export function sampleJump(plan: JumpPlan, t: number): {
  x: number;
  y: number;
  z: number;
} {
  const u = Math.min(1, Math.max(0, t));
  const x = plan.startX + (plan.endX - plan.startX) * u;
  const z = plan.startZ + (plan.endZ - plan.startZ) * u;
  // 포물선: 4 * h * t * (1 - t) → 정점 높이 h
  const y = 4 * plan.arcHeight * u * (1 - u);
  return { x, y, z };
}

/** 충전(드래그) 픽셀 → 점프 거리 변환 (rangeUp 등으로 최댓값만 확장 가능) */
export function pixelsToDistance(px: number, maxDistance: number = JUMP.MAX_DISTANCE): number {
  const safePx = Math.max(0, px);  // 음수 방어
  const raw = JUMP.MIN_DISTANCE + safePx / JUMP.CHARGE_PIXELS_PER_METER;
  return Math.min(maxDistance, raw);
}
