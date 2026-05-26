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
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = item.position[1] + Math.sin(now * 4 + item.id) * 0.18;
    ref.current.rotation.y = now * 2;
  });
  const color =
    item.type === "rangeUp"
      ? "#f5e26b"
      : item.type === "swim"
        ? "#83d2ff"
        : "#ff9bd1";
  return (
    <group ref={ref} position={item.position}>
      {/* 곤충 몸통 */}
      <mesh>
        <boxGeometry args={[0.22, 0.18, 0.32]} />
        <meshStandardMaterial color={COLORS.FLY} />
      </mesh>
      {/* 날개 */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.55, 0.04, 0.18]} />
        <meshStandardMaterial color="#f4f6ff" transparent opacity={0.85} />
      </mesh>
      {/* 빛나는 오라 */}
      <mesh>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
