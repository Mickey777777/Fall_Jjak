import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { COLORS } from "./constants";
import type { ItemData } from "./types";

interface Props {
  items: ItemData[];
  now: number;
}

/**
 * 공중에 떠다니는 곤충 아이템 (좌클릭으로 잡아먹는다).
 * 타입에 따라 색만 다르게 표시.
 */
export default function ItemManager({ items, now }: Props) {
  return (
    <group>
      {items.map((it) =>
        it.collected ? null : <ItemView key={it.id} item={it} now={now} />,
      )}
    </group>
  );
}

function ItemView({ item, now }: { item: ItemData; now: number }) {
  const ref = useRef<Group>(null);
  const wingLRef = useRef<Group>(null);
  const wingRRef = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = item.position[1] + Math.sin(now * 4 + item.id) * 0.18;
    ref.current.rotation.y = now * 2;
    // 날개 펄럭임 — 몸통 옆을 축으로 빠르게 위아래
    const flap = Math.sin(now * 28 + item.id) * 0.7;
    if (wingLRef.current) wingLRef.current.rotation.z = 0.5 + flap;
    if (wingRRef.current) wingRRef.current.rotation.z = -0.5 - flap;
  });
  const color =
    item.type === "rangeUp"
      ? "#f5e26b"
      : item.type === "swim"
        ? "#83d2ff"
        : "#ff9bd1";
  return (
    <group ref={ref} position={item.position}>
      {/* 몸통 — 둥글둥글 통통한 큐브 */}
      <mesh>
        <boxGeometry args={[0.26, 0.24, 0.3]} />
        <meshStandardMaterial color={COLORS.FLY} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* 배 — 뒤로 살짝 이어진 작은 큐브 */}
      <mesh position={[0, -0.02, -0.18]}>
        <boxGeometry args={[0.2, 0.18, 0.14]} />
        <meshStandardMaterial color={COLORS.FLY} roughness={0.45} metalness={0.15} />
      </mesh>

      {/* 큰 눈 — 흰자 + 검은 동공 (귀여움 포인트) */}
      <group position={[-0.09, 0.07, 0.13]}>
        <mesh>
          <boxGeometry args={[0.13, 0.15, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.06, 0.08, 0.02]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
      </group>
      <group position={[0.09, 0.07, 0.13]}>
        <mesh>
          <boxGeometry args={[0.13, 0.15, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.06, 0.08, 0.02]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
      </group>

      {/* 더듬이 한 쌍 */}
      <mesh position={[-0.05, 0.2, 0.12]} rotation={[0.5, 0, 0.25]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#101010" />
      </mesh>
      <mesh position={[0.05, 0.2, 0.12]} rotation={[0.5, 0, -0.25]}>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#101010" />
      </mesh>

      {/* 날개 한 쌍 — 몸통 옆을 축으로 펄럭임 */}
      <group ref={wingLRef} position={[-0.1, 0.13, -0.04]}>
        <mesh position={[-0.16, 0, 0]}>
          <boxGeometry args={[0.32, 0.02, 0.2]} />
          <meshStandardMaterial color="#f4f6ff" transparent opacity={0.6} />
        </mesh>
      </group>
      <group ref={wingRRef} position={[0.1, 0.13, -0.04]}>
        <mesh position={[0.16, 0, 0]}>
          <boxGeometry args={[0.32, 0.02, 0.2]} />
          <meshStandardMaterial color="#f4f6ff" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* 빛나는 오라 (버프 타입 색) */}
      <mesh>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
