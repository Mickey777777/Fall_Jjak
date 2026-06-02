import { ENEMY } from "./constants";
import type { EnemyData, LilyPadData } from "./types";

/**
 * 새의 현재(애니메이션 반영) z 위치 — 렌더와 충돌이 반드시 같은 공식을 써야
 * 보이는 위치와 히트박스가 일치한다.
 */
export function birdLiveZ(enemy: EnemyData, now: number): number {
  const amp = enemy.amplitude ?? ENEMY.BIRD_DEFAULT_AMP;
  return (
    enemy.position[2] +
    Math.sin((now - enemy.spawnTime) * ENEMY.BIRD_PATROL_FREQ) * amp
  );
}

/** 점프 비행 중 적과 닿았는지 확인. 닿았다면 게임오버. */
export function checkAirborneHit(
  position: { x: number; y: number; z: number },
  enemies: EnemyData[],
  now: number,
): EnemyData | null {
  for (const e of enemies) {
    if (!e.active) continue;
    // 새는 z축으로 패트롤하므로 현재 위치로 보정 (fish/obstacle은 고정)
    const ez = e.type === "bird" ? birdLiveZ(e, now) : e.position[2];
    const dx = position.x - e.position[0];
    const dz = position.z - ez;
    const dist2 = dx * dx + dz * dz;
    if (e.type === "fish") {
      // 점프 높이가 낮을 때 수면 위로 솟아오름
      if (position.y < ENEMY.FISH_LUNGE_HEIGHT && dist2 < 1.4 * 1.4) {
        return e;
      }
    } else if (e.type === "bird") {
      // 점프가 너무 높을 때 위에서 낚아챔
      if (position.y > ENEMY.BIRD_DIVE_HEIGHT && dist2 < 1.6 * 1.6) {
        return e;
      }
    } else {
      // 환경 장애물: 수직 영역 전체에서 가로막음
      if (dist2 < 1.2 * 1.2 && position.y < 2.2) {
        return e;
      }
    }
  }
  return null;
}

/** 가장 가까운 연잎과의 평면 거리 */
export function nearestPad(
  x: number,
  z: number,
  pads: LilyPadData[],
): { pad: LilyPadData | null; dist: number } {
  let best: LilyPadData | null = null;
  let bestDist = Infinity;
  for (const p of pads) {
    if (p.destroyed) continue;
    const dx = x - p.position[0];
    const dz = z - p.position[2];
    const d = Math.hypot(dx, dz);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return { pad: best, dist: bestDist };
}
