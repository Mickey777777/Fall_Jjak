import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { BUFF_COLORS, COLORS } from "./constants";
import { gameNowMs } from "./gameClock";
import type { ItemData } from "./types";

interface FrogPos {
  current: { x: number; y: number; z: number };
}

interface Props {
  items: ItemData[];
  now: number;
  frogRef: FrogPos;
}

// 잡힌 파리가 입으로 빨려 들어가는 연출 길이 (ms) — 혀 신장(320ms)과 동기화
const EAT_DURATION = 320;
// 혀가 파리에 닿는 시점 비율 (혀 extend peak = 0.4) — 이전엔 제자리, 이후 끌려옴
const EAT_REACH = 0.4;

/**
 * 공중에 떠다니는 곤충 아이템 (좌클릭으로 잡아먹는다).
 * 타입에 따라 색만 다르게 표시. 잡히면 입으로 빨려 들어가며 사라진다.
 */
export default function ItemManager({ items, now, frogRef }: Props) {
  return (
    <group>
      {items.map((it) => (
        <ItemView key={it.id} item={it} now={now} frogRef={frogRef} />
      ))}
    </group>
  );
}

function ItemView({ item, now, frogRef }: { item: ItemData; now: number; frogRef: FrogPos }) {
  const ref = useRef<Group>(null);
  const wingLRef = useRef<Group>(null);
  const wingRRef = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;

    // 잡힌 파리 — 혀가 닿는 시점(EAT_REACH) 이후 입으로 빨려 들어가며 축소
    if (item.collected) {
      const t = (gameNowMs() - (item.collectedAt ?? 0)) / EAT_DURATION;
      if (t >= 1) {
        ref.current.visible = false;
        return;
      }
      ref.current.visible = true;
      ref.current.rotation.y = now * 6; // 끌려오며 빠르게 회전
      if (t < EAT_REACH) {
        // 혀가 닿기 전 — 제자리 (살짝 떨림)
        ref.current.position.set(item.position[0], item.position[1], item.position[2]);
        ref.current.scale.setScalar(1);
      } else {
        // 입(개구리 위쪽)으로 끌려오며 작아짐
        // 혀끝(선형으로 회수)에 파리가 붙어 함께 끌려오도록 선형 보간
        const k = (t - EAT_REACH) / (1 - EAT_REACH); // 0→1
        const f = frogRef.current;
        const mx = f.x, my = f.y + 0.49, mz = f.z; // 입 근사 위치
        ref.current.position.set(
          item.position[0] + (mx - item.position[0]) * k,
          item.position[1] + (my - item.position[1]) * k,
          item.position[2] + (mz - item.position[2]) * k,
        );
        ref.current.scale.setScalar(Math.max(0.01, 1 - k));
      }
      return;
    }

    ref.current.position.y = item.position[1] + Math.sin(now * 4 + item.id) * 0.18;
    ref.current.rotation.y = now * 2;
    ref.current.scale.setScalar(1);
    // 날개 펄럭임 — 몸통 옆을 축으로 빠르게 위아래
    const flap = Math.sin(now * 28 + item.id) * 0.7;
    if (wingLRef.current) wingLRef.current.rotation.z = 0.5 + flap;
    if (wingRRef.current) wingRRef.current.rotation.z = -0.5 - flap;
  });
  const color = BUFF_COLORS[item.type];
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
