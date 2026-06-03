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

/** 물고기 도약 정도(0=완전히 잠김, 1=최고로 솟구침) — 렌더와 충돌이 공유. */
export function fishLeap(enemy: EnemyData, now: number): number {
  return Math.max(0, Math.sin((now - enemy.spawnTime) * ENEMY.FISH_LEAP_FREQ));
}

/**
 * 물고기 본체의 현재 y — 렌더(EnemyManager)와 반드시 같은 공식을 써야
 * "보이는 물고기"와 히트박스(솟구친 순간만 위협)가 일치한다.
 */
export function fishLiveY(enemy: EnemyData, now: number): number {
  const amp = enemy.amplitude ?? ENEMY.FISH_DEFAULT_AMP;
  return ENEMY.FISH_REST_Y + fishLeap(enemy, now) * (amp + ENEMY.FISH_LEAP_RISE);
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
    if (e.type === "fish") {
      // 물고기가 수면 위로 솟구쳐 있을 때(fishLiveY > 수면)만 위협 — 잠겨 있으면 안 잡힘.
      // 또 머리-꼬리(x)로 길고 옆(z)으로 좁아 원형 대신 타원으로 판정 → 옆을 비껴가면 안 잡힘.
      if (
        position.y < ENEMY.FISH_LUNGE_HEIGHT &&
        fishLiveY(e, now) > ENEMY.FISH_BREACH_Y
      ) {
        const nx = dx / ENEMY.FISH_HALF_LEN;
        const nz = dz / ENEMY.FISH_HALF_WID;
        if (nx * nx + nz * nz < 1) return e;
      }
    } else if (e.type === "bird") {
      // 점프가 너무 높을 때 위에서 낚아챔. 새는 날개 폭(z)이 몸 길이(x)보다 넓어
      // 가로로 넓은 타원으로 판정 → 앞뒤 여백 과대 판정을 줄임.
      if (position.y > ENEMY.BIRD_DIVE_HEIGHT) {
        const nx = dx / ENEMY.BIRD_HALF_LEN;
        const nz = dz / ENEMY.BIRD_HALF_WID;
        if (nx * nx + nz * nz < 1) return e;
      }
    } else {
      // 환경 장애물(나뭇가지 더미): 시각이 yaw≈0.4로 비스듬히 누운 길쭉한 막대다.
      // 과거엔 반경 1.2 원형으로 판정해 막대 옆으로 너무 넓게 잡혀(폭 ~0.3인데 1.2),
      // "보이지 않는 곳에서 맞는" 느낌을 줬다. 막대 방향에 맞춘 OBB로 판정한다.
      if (position.y < ENEMY.OBSTACLE_BLOCK_HEIGHT) {
        const cos = Math.cos(ENEMY.OBSTACLE_YAW);
        const sin = Math.sin(ENEMY.OBSTACLE_YAW);
        // 월드 상대좌표(dx,dz)를 막대 로컬축으로 회전 → 길이축/폭축으로 분해
        const localLen = dx * cos - dz * sin;
        const localWid = dx * sin + dz * cos;
        if (
          Math.abs(localLen) < ENEMY.OBSTACLE_HALF_LEN &&
          Math.abs(localWid) < ENEMY.OBSTACLE_HALF_WID
        ) {
          return e;
        }
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
