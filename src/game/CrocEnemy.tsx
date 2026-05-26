import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshStandardMaterial } from "three";
import { COLORS } from "./constants";

interface Props {
  x: number;
  z: number;
  now: number;
  danger: boolean;
}

/**
 * 뒤에서 쫓아오는 악어 — 복셀 스타일 3D 모델.
 * 몸통은 X+ 방향(전진 방향)을 향한다.
 * danger=true 시 턱을 벌리고 눈이 붉게 변한다.
 */
export default function CrocEnemy({ x, z, now, danger }: Props) {
  const rootRef = useRef<Group>(null);
  const snoutRef = useRef<Group>(null);
  const leftEyeMatRef = useRef<MeshStandardMaterial>(null);
  const rightEyeMatRef = useRef<MeshStandardMaterial>(null);

  useFrame(() => {
    if (!rootRef.current) return;

    // 걷는 좌우 흔들림
    rootRef.current.rotation.y = Math.sin(now * 4.2) * 0.06;
    // 수면 위 출렁임
    rootRef.current.position.y = 0.22 + Math.sin(now * 2.6) * 0.03;

    // 턱 벌리기 (위험 시 반복 개폐)
    if (snoutRef.current) {
      const open = danger ? Math.abs(Math.sin(now * 7.0)) * 0.22 : 0;
      snoutRef.current.position.y = open;
    }

    // 눈 색상 (위험 시 빨간색)
    const eyeColor = danger ? "#ff3030" : "#f0f0e8";
    if (leftEyeMatRef.current) leftEyeMatRef.current.color.set(eyeColor);
    if (rightEyeMatRef.current) rightEyeMatRef.current.color.set(eyeColor);
  });

  return (
    <group ref={rootRef} position={[x, 0.22, z]}>
      {/* 몸통 */}
      <mesh>
        <boxGeometry args={[2.0, 0.45, 0.85]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      {/* 등 능선 */}
      <mesh position={[0.0, 0.27, 0]}>
        <boxGeometry args={[1.5, 0.13, 0.42]} />
        <meshStandardMaterial color="#2d3f1e" />
      </mesh>
      {/* 머리 */}
      <mesh position={[1.18, 0.02, 0]}>
        <boxGeometry args={[0.96, 0.38, 0.72]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      {/* 아랫턱 (고정) */}
      <mesh position={[1.72, -0.10, 0]}>
        <boxGeometry args={[0.62, 0.14, 0.48]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      {/* 윗턱 (danger 시 위로 들림) */}
      <group ref={snoutRef} position={[1.35, 0.08, 0]}>
        <mesh position={[0.37, 0, 0]}>
          <boxGeometry args={[0.62, 0.15, 0.50]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 이빨 */}
        <mesh position={[0.58, -0.11, 0.15]}>
          <boxGeometry args={[0.07, 0.14, 0.07]} />
          <meshStandardMaterial color="#fffff0" />
        </mesh>
        <mesh position={[0.58, -0.11, -0.15]}>
          <boxGeometry args={[0.07, 0.14, 0.07]} />
          <meshStandardMaterial color="#fffff0" />
        </mesh>
        <mesh position={[0.40, -0.11, 0]}>
          <boxGeometry args={[0.07, 0.12, 0.07]} />
          <meshStandardMaterial color="#fffff0" />
        </mesh>
      </group>
      {/* 꼬리 */}
      <mesh position={[-1.27, -0.05, 0]}>
        <boxGeometry args={[0.95, 0.30, 0.52]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      <mesh position={[-1.97, -0.12, 0]}>
        <boxGeometry args={[0.55, 0.18, 0.30]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      {/* 눈 흰자 */}
      <mesh position={[1.05, 0.27, 0.30]}>
        <boxGeometry args={[0.20, 0.20, 0.20]} />
        <meshStandardMaterial ref={leftEyeMatRef} color="#f0f0e8" />
      </mesh>
      <mesh position={[1.05, 0.27, -0.30]}>
        <boxGeometry args={[0.20, 0.20, 0.20]} />
        <meshStandardMaterial ref={rightEyeMatRef} color="#f0f0e8" />
      </mesh>
      {/* 동공 */}
      <mesh position={[1.16, 0.27, 0.30]}>
        <boxGeometry args={[0.09, 0.09, 0.09]} />
        <meshStandardMaterial color="#101010" />
      </mesh>
      <mesh position={[1.16, 0.27, -0.30]}>
        <boxGeometry args={[0.09, 0.09, 0.09]} />
        <meshStandardMaterial color="#101010" />
      </mesh>
      {/* 앞다리 */}
      <mesh position={[0.52, -0.27, 0.52]}>
        <boxGeometry args={[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      <mesh position={[0.52, -0.27, -0.52]}>
        <boxGeometry args={[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      {/* 뒷다리 */}
      <mesh position={[-0.42, -0.27, 0.52]}>
        <boxGeometry args={[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
      <mesh position={[-0.42, -0.27, -0.52]}>
        <boxGeometry args={[0.28, 0.26, 0.28]} />
        <meshStandardMaterial color={COLORS.CROC} />
      </mesh>
    </group>
  );
}
