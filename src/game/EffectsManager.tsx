import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import { useGameStore } from "../store/useGameStore";
import { JUMP } from "./constants";

interface Props {
  frogX: number;
  frogZ: number;
  aimDir: number;
  chargeDist: number;
  arcHeight: number;
  isCharging: boolean;
  isJumping: boolean;
  yarrBurst: { x: number; z: number; bornAt: number } | null;
}

/**
 * 충전 중에만 보이는 공중 아치 점선 + 판정 popup.
 *
 * - 공중 아치 13 개: 개구리 앞쪽에 펼쳐져 점프 궤적을 보여줌
 * - 전체 궤적의 5 ~ 70% 만 표시 → 후반 30% 는 가려져 정확한 착지점 노출 안 됨
 * - 멀어질수록 크기/투명도 감소
 */
const ARCH_DOTS = 13;

export default function EffectsManager({
  frogX,
  frogZ,
  aimDir,
  chargeDist,
  arcHeight,
  isCharging,
  isJumping,
  yarrBurst,
}: Props) {
  const popups = useGameStore((s) => s.popups);
  const archRefs = useRef<(Mesh | null)[]>([]);
  const archMats = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const visible = isCharging && !isJumping;
    if (!visible) {
      for (let i = 0; i < ARCH_DOTS; i++) {
        const d = archRefs.current[i];
        if (d) d.visible = false;
      }
      return;
    }

    const buffs = useGameStore.getState().buffs;
    const rangeBonus = buffs.find((b) => b.type === "rangeUp") ? 1.3 : 1;
    const d =
      Math.max(JUMP.MIN_DISTANCE, Math.min(JUMP.MAX_DISTANCE, chargeDist)) *
      rangeBonus;
    const dirX = Math.cos(aimDir);
    const dirZ = Math.sin(aimDir);

    // 공중 아치 — 5 ~ 70% 구간을 보여줌 (마지막 30% 는 여전히 가려짐)
    const archStart = 0.05;
    const archEnd = 0.70;
    for (let i = 0; i < ARCH_DOTS; i++) {
      const dot = archRefs.current[i];
      const mat = archMats.current[i];
      if (!dot || !mat) continue;
      const t = i / (ARCH_DOTS - 1);
      const u = archStart + t * (archEnd - archStart);
      const x = frogX + dirX * d * u;
      const z = frogZ + dirZ * d * u;
      const y = 4 * arcHeight * u * (1 - u) + 0.45;
      dot.position.set(x, y, z);
      dot.visible = true;
      // 마지막 점이 너무 흐려지지 않게 fade 범위 완화
      const fade = 1 - t * 0.85;
      const s = 0.17 * (0.4 + 0.6 * fade);
      dot.scale.set(s, s, s);
      mat.opacity = 0.35 + 0.5 * fade;
    }
  });

  return (
    <group>
      {/* 공중 아치 — 높이 표시 전용 */}
      {Array.from({ length: ARCH_DOTS }).map((_, i) => (
        <mesh
          key={`arch-${i}`}
          ref={(el) => {
            archRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            ref={(m) => {
              archMats.current[i] = m;
            }}
            color="#fff5b0"
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}

      {/* 판정 popup */}
      {popups.map((p) => {
        const age = (performance.now() - p.bornAt) / 900;
        const y = 0.5 + age * 1.6;
        const opacity = Math.max(0, 1 - age);
        return (
          <mesh
            key={p.id}
            position={[p.position[0], p.position[1] + y, p.position[2]]}
            rotation={[-0.5, 0, 0]}
          >
            <planeGeometry args={[2.5 + p.text.length * 0.05, 0.5]} />
            <meshBasicMaterial
              color={popupColor(p.type)}
              transparent
              opacity={opacity * 0.85}
            />
          </mesh>
        );
      })}

      {yarrBurst ? <YarrBurst burst={yarrBurst} /> : null}
    </group>
  );
}

function YarrBurst({ burst }: { burst: { x: number; z: number; bornAt: number } }) {
  const age = (performance.now() - burst.bornAt) / 1000;
  if (age > 1) return null;

  const p = Math.min(1, age);
  const opacity = Math.max(0, 1 - p);
  const rays = Array.from({ length: 14 });

  return (
    <group position={[burst.x, 0.34, burst.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1 + p * 2.2, 1 + p * 2.2, 1]}>
        <ringGeometry args={[0.35, 0.48, 32]} />
        <meshBasicMaterial color="#ffd84d" transparent opacity={opacity * 0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[0.7 + p * 1.4, 0.7 + p * 1.4, 1]}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color="#fff6a6" transparent opacity={opacity * 0.55} />
      </mesh>
      {rays.map((_, i) => {
        const a = (i / rays.length) * Math.PI * 2;
        const dist = 0.45 + p * 1.8;
        const y = 0.16 + Math.sin(p * Math.PI) * (0.45 + (i % 3) * 0.08);
        const scale = 0.09 + (i % 4) * 0.018;

        return (
          <mesh
            key={i}
            position={[Math.cos(a) * dist, y, Math.sin(a) * dist]}
            rotation={[0, -a, Math.PI / 4]}
            scale={[scale * 1.8, scale, scale]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#ffe45c" : "#fff6b8"}
              transparent
              opacity={opacity}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function popupColor(t: string) {
  switch (t) {
    case "Yarr":
      return "#ffd84d";
    case "Great":
      return "#7df2a1";
    case "NotBad":
      return "#cccccc";
    default:
      return "#ff6a6a";
  }
}
