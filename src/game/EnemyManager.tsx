import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { COLORS } from "./constants";
import type { EnemyData } from "./types";

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
  useFrame(() => {
    if (!ref.current) return;
    const t = now - enemy.spawnTime;
    if (enemy.type === "fish") {
      // 살짝 위아래로 솟구치는 모션
      const amp = enemy.amplitude ?? 1;
      ref.current.position.y = -0.3 + Math.max(0, Math.sin(t * 1.6) * amp);
    } else if (enemy.type === "bird") {
      // 좌우 패트롤
      const amp = enemy.amplitude ?? 1.5;
      ref.current.position.z = enemy.position[2] + Math.sin(t * 1.1) * amp;
      ref.current.position.y = enemy.position[1] + Math.cos(t * 1.3) * 0.2;
      ref.current.rotation.y = Math.sin(t * 1.1) * 0.4;
    }
  });

  if (enemy.type === "fish") {
    return (
      <group ref={ref} position={enemy.position}>
        <mesh>
          <coneGeometry args={[0.4, 1.0, 6]} />
          <meshStandardMaterial color={COLORS.FISH} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.7]} />
          <meshStandardMaterial color={COLORS.FISH} />
        </mesh>
      </group>
    );
  }
  if (enemy.type === "bird") {
    return (
      <group ref={ref} position={enemy.position}>
        <mesh>
          <boxGeometry args={[0.8, 0.4, 0.5]} />
          <meshStandardMaterial color={COLORS.BIRD} />
        </mesh>
        <mesh position={[0.4, 0.0, 0]}>
          <coneGeometry args={[0.15, 0.4, 4]} />
          <meshStandardMaterial color="#f3c349" />
        </mesh>
        {/* 날개 */}
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.sin(now * 8) * 0.5]}>
          <boxGeometry args={[1.5, 0.08, 0.4]} />
          <meshStandardMaterial color={COLORS.BIRD} />
        </mesh>
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

