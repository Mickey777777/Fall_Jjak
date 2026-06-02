import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { COLORS } from "./constants";
import { birdLiveZ } from "./CollisionSystem";
import type { EnemyData } from "./types";

// 물고기 체절별 굽힘 위상/각도 (머리→꼬리)
const FISH_SEG_PHASE = [0, 0.4, 0.8, 1.3];
const FISH_SEG_ANGLE = [0, 0.12, 0.18, 0.26];

interface Props {
  enemies: EnemyData[];
  now: number;
}

/**
 * 물고기 / 새 / 환경 장애물 렌더러.
 * 각 적은 단순한 모양만 그리고, 위치 갱신은 매 프레임 ref로 처리한다.
 */
export default function EnemyManager({ enemies, now }: Props) {
  return (
    <group>
      {enemies.map((e) => (
        <EnemyView key={e.id} enemy={e} now={now} />
      ))}
    </group>
  );
}

function EnemyView({ enemy, now }: { enemy: EnemyData; now: number }) {
  const ref = useRef<Group>(null);
  const segRefs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    if (!ref.current) return;
    const t = now - enemy.spawnTime;
    if (enemy.type === "fish") {
      // 살짝 위아래로 솟구치는 모션
      const amp = enemy.amplitude ?? 1;
      ref.current.position.y = -0.3 + Math.max(0, Math.sin(t * 1.6) * amp);
      // 몸을 마디별로 좌우 물결 (S자 헤엄)
      const segs = segRefs.current;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg) seg.rotation.y = Math.sin(t * 3.5 - FISH_SEG_PHASE[i]) * FISH_SEG_ANGLE[i];
      }
    } else if (enemy.type === "bird") {
      // 좌우 패트롤 — 충돌 판정과 동일한 공식(birdLiveZ) 공유
      ref.current.position.z = birdLiveZ(enemy, now);
      ref.current.position.y = enemy.position[1] + Math.cos(t * 1.3) * 0.2;
      // 기본적으로 개구리(-x) 쪽을 바라보게 하고, 패트롤 시 좌우로 살짝 틂
      ref.current.rotation.y = Math.PI + Math.sin(t * 1.1) * 0.4;
    }
  });

  if (enemy.type === "fish") {
    const upperTeeth = [-0.12, -0.04, 0.04, 0.12];
    const lowerTeeth = [-0.08, 0, 0.08];
    return (
      <group ref={ref} position={enemy.position}>
        {/* 머리 마디 */}
        <group ref={(el) => { segRefs.current[0] = el; }}>
          {/* 머리 */}
          <mesh position={[-0.48, 0, 0]}>
            <boxGeometry args={[0.34, 0.46, 0.38]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 매서운 눈 (양옆) — 노란 홍채 + 검은 동공 */}
          <group position={[-0.52, 0.13, 0.18]}>
            <mesh>
              <boxGeometry args={[0.13, 0.13, 0.05]} />
              <meshStandardMaterial color="#e7c83a" roughness={0.3} />
            </mesh>
            <mesh position={[-0.035, 0, 0.03]}>
              <boxGeometry args={[0.06, 0.09, 0.02]} />
              <meshStandardMaterial color="#101010" />
            </mesh>
          </group>
          <group position={[-0.52, 0.13, -0.18]}>
            <mesh>
              <boxGeometry args={[0.13, 0.13, 0.05]} />
              <meshStandardMaterial color="#e7c83a" roughness={0.3} />
            </mesh>
            <mesh position={[-0.035, 0, -0.03]}>
              <boxGeometry args={[0.06, 0.09, 0.02]} />
              <meshStandardMaterial color="#101010" />
            </mesh>
          </group>
          {/* 벌린 입 — 어두운 입 안 */}
          <mesh position={[-0.62, -0.06, 0]}>
            <boxGeometry args={[0.08, 0.12, 0.34]} />
            <meshStandardMaterial color="#14232a" />
          </mesh>
          {/* 윗니 — 위쪽, 아래로 뾰족 */}
          {upperTeeth.map((z, i) => (
            <mesh key={`up-${i}`} position={[-0.66, 0.01, z]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.035, 0.09, 4]} />
              <meshStandardMaterial color="#f2f2ea" />
            </mesh>
          ))}
          {/* 아래턱 잇몸 */}
          <mesh position={[-0.58, -0.18, 0]}>
            <boxGeometry args={[0.24, 0.1, 0.34]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 아랫니 — 아래쪽, 위로 뾰족 (엇갈림) */}
          {lowerTeeth.map((z, i) => (
            <mesh key={`low-${i}`} position={[-0.66, -0.12, z]}>
              <coneGeometry args={[0.035, 0.09, 4]} />
              <meshStandardMaterial color="#f2f2ea" />
            </mesh>
          ))}
        </group>
        {/* 앞몸통 마디 */}
        <group ref={(el) => { segRefs.current[1] = el; }} position={[-0.31, 0, 0]}>
          <mesh position={[0.12, 0, 0]}>
            <boxGeometry args={[0.44, 0.54, 0.4]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 등지느러미 가시 (앞) */}
          <mesh position={[0.13, 0.31, 0]}>
            <coneGeometry args={[0.07, 0.17, 4]} />
            <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
          </mesh>
          {/* 뒷몸통 마디 */}
          <group ref={(el) => { segRefs.current[2] = el; }} position={[0.31, 0, 0]}>
            <mesh position={[0.2, 0, 0]}>
              <boxGeometry args={[0.42, 0.48, 0.36]} />
              <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
            </mesh>
            {/* 등지느러미 가시 (중/뒤) */}
            <mesh position={[0.0, 0.33, 0]}>
              <coneGeometry args={[0.09, 0.24, 4]} />
              <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
            </mesh>
            <mesh position={[0.2, 0.34, 0]}>
              <coneGeometry args={[0.1, 0.3, 4]} />
              <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
            </mesh>
            {/* 꼬리 마디 */}
            <group ref={(el) => { segRefs.current[3] = el; }} position={[0.3, 0, 0]}>
              <mesh position={[0.2, 0, 0]}>
                <boxGeometry args={[0.22, 0.34, 0.3]} />
                <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
              </mesh>
              <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.4]}>
                <coneGeometry args={[0.26, 0.42, 4]} />
                <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    );
  }
  if (enemy.type === "bird") {
    return (
      <group ref={ref} position={enemy.position}>
        {/* 몸통 (갈색) */}
        <mesh>
          <boxGeometry args={[0.85, 0.5, 0.52]} />
          <meshStandardMaterial color={COLORS.BIRD} />
        </mesh>
        {/* 머리 (흰머리수리 — 흰색) */}
        <mesh position={[0.55, 0.18, 0]}>
          <boxGeometry args={[0.42, 0.42, 0.5]} />
          <meshStandardMaterial color="#f2efe6" />
        </mesh>
        {/* 부리 뿌리 (cere — 머리와 부리를 잇는 노란 피부) */}
        <mesh position={[0.74, 0.13, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.1]} />
          <meshStandardMaterial color="#f3c349" />
        </mesh>
        {/* 윗부리 — 위턱, 하나로 길게 뻗고 끝이 앞으로 모임 */}
        <group position={[0.78, 0.15, 0]} rotation={[0, 0, -0.12]}>
          <mesh position={[0.18, 0, 0]}>
            <boxGeometry args={[0.36, 0.07, 0.19]} />
            <meshStandardMaterial color="#f3c349" />
          </mesh>
        </group>
        {/* 아랫부리 — 아래턱, 윗부리보다 짧고 위로 모임 */}
        <group position={[0.78, 0.09, 0]} rotation={[0, 0, 0.06]}>
          <mesh position={[0.15, 0, 0]}>
            <boxGeometry args={[0.3, 0.06, 0.16]} />
            <meshStandardMaterial color="#d89f33" />
          </mesh>
        </group>
        {/* 눈 — 노란 홍채 + 검은 동공 */}
        <mesh position={[0.66, 0.22, 0.15]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8c43a" />
        </mesh>
        <mesh position={[0.66, 0.22, -0.15]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8c43a" />
        </mesh>
        <mesh position={[0.73, 0.21, 0.15]}>
          <boxGeometry args={[0.09, 0.12, 0.1]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        <mesh position={[0.73, 0.21, -0.15]}>
          <boxGeometry args={[0.09, 0.12, 0.1]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        {/* 꼬리 (흰색) */}
        <mesh position={[-0.52, 0.08, 0]}>
          <boxGeometry args={[0.3, 0.12, 0.4]} />
          <meshStandardMaterial color="#f2efe6" />
        </mesh>
        <mesh position={[-0.74, 0.08, 0]}>
          <boxGeometry args={[0.22, 0.05, 0.52]} />
          <meshStandardMaterial color="#e6e2d6" />
        </mesh>
        {/* 다리 + 발 (노랑) */}
        <mesh position={[0.14, -0.3, 0.15]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.18, -0.41, 0.15]}>
          <boxGeometry args={[0.2, 0.06, 0.14]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.14, -0.3, -0.15]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.18, -0.41, -0.15]}>
          <boxGeometry args={[0.2, 0.06, 0.14]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        {/* 날개 한 쌍 — 크게, 위아래 펄럭임 (박스) */}
        <group position={[0, 0.2, 0.22]} rotation={[-Math.sin(now * 8) * 0.5, 0, 0]}>
          <mesh position={[0, 0, 0.5]}>
            <boxGeometry args={[0.6, 0.08, 1.0]} />
            <meshStandardMaterial color={COLORS.BIRD} />
          </mesh>
          {/* 날개 끝 깃 (어두운 갈색) */}
          <mesh position={[-0.05, 0, 1.05]}>
            <boxGeometry args={[0.4, 0.07, 0.2]} />
            <meshStandardMaterial color="#3a2815" />
          </mesh>
        </group>
        <group position={[0, 0.2, -0.22]} rotation={[Math.sin(now * 8) * 0.5, 0, 0]}>
          <mesh position={[0, 0, -0.5]}>
            <boxGeometry args={[0.6, 0.08, 1.0]} />
            <meshStandardMaterial color={COLORS.BIRD} />
          </mesh>
          <mesh position={[-0.05, 0, -1.05]}>
            <boxGeometry args={[0.4, 0.07, 0.2]} />
            <meshStandardMaterial color="#3a2815" />
          </mesh>
        </group>
      </group>
    );
  }
  // 환경 장애물 (나뭇가지 더미)
  return (
    <group ref={ref} position={enemy.position}>
      <mesh rotation={[0, 0.4, 0.2]}>
        <boxGeometry args={[1.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#5a4622" />
      </mesh>
      <mesh position={[0.4, 0.3, 0.1]} rotation={[0, -0.3, 0.4]}>
        <boxGeometry args={[1.0, 0.3, 0.3]} />
        <meshStandardMaterial color="#3e2f17" />
      </mesh>
    </group>
  );
}

