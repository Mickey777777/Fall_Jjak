import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { COLORS } from "./constants";
import { useGameStore } from "../store/useGameStore";

interface Props {
  position: { x: number; y: number; z: number };
  aimDirection: number;
  isCharging: boolean;
  isJumping: boolean;
  jumpProgress: number;
}

/**
 * 작은 복셀 개구리 — 연잎 위에 여유 있게 올라갈 정도의 작은 크기.
 *
 * 구성:
 *  - 둥근 몸통 (낮고 넓은 큐브 두 단)
 *  - 머리 (몸통보다 약간 작고 위로 올라온 큐브)
 *  - 눈 (머리 위로 솟은 두 작은 큐브 + 검은 동공)
 *  - 입 자국 (작은 어두운 슬릿)
 *  - 배 (밝은 크림색 패치)
 *  - 뒷다리 (옆으로 접힌 작은 큐브)
 *  - 혀 (좌클릭 시 짧게 늘어났다 줄어드는 핑크 스트립)
 *
 * 애니메이션:
 *  - idle: 미세 호흡, 가끔 눈 깜빡임
 *  - charging: squash (몸이 낮아지고 다리 접힘)
 *  - jumping: stretch (몸이 늘어남)
 *  - tongue: 좌클릭 후 ~180ms 동안 혀가 앞으로 뻗었다 돌아옴
 */
export default function Frog({
  position,
  aimDirection,
  isCharging,
  isJumping,
  jumpProgress,
}: Props) {
  const ref = useRef<Group>(null);
  const eyeLRef = useRef<Group>(null);
  const eyeRRef = useRef<Group>(null);
  const tongueRef = useRef<Mesh>(null);
  const tongueAt = useGameStore((s) => s.tongueAt);
  // 회전 보간 상태
  const currentYaw = useRef(0);
  const currentPitch = useRef(0);

  useFrame(() => {
    if (!ref.current) return;
    // 개구리의 모델 바닥이 그룹 원점(y=0)에 있지만 연잎 윗면은 약 y=0.18.
    // 그대로 두면 base 큐브의 절반이 연잎 속에 박혀 보인다 (특히 충전 squash 시).
    // 그룹 자체를 살짝 들어 올려 연잎 위에 사뿐히 올라간 모양으로 보정.
    const Y_LIFT = 0.22;
    ref.current.position.set(position.x, position.y + Y_LIFT, position.z);

    // 부드러운 yaw 회전 (각도 wraparound 처리)
    const targetYaw = -aimDirection + Math.PI / 2;
    let diff = targetYaw - currentYaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    currentYaw.current += diff * 0.22;

    // 충전 중에는 앞쪽으로 살짝 기울임 (얼굴이 조준 방향을 향하는 인상)
    const targetPitch = isCharging ? -0.18 : isJumping ? -0.05 : 0;
    currentPitch.current += (targetPitch - currentPitch.current) * 0.18;

    // YXZ 순서로 적용해 pitch가 yaw 이후의 로컬 X축에 걸리도록 함
    ref.current.rotation.order = "YXZ";
    ref.current.rotation.y = currentYaw.current;
    ref.current.rotation.x = currentPitch.current;

    if (isCharging) {
      ref.current.scale.set(1.08, 0.7, 1.08);
    } else if (isJumping) {
      const s = 1 + Math.sin(jumpProgress * Math.PI) * 0.22;
      ref.current.scale.set(0.92, s, 0.92);
    } else {
      const t = performance.now() * 0.003;
      ref.current.scale.set(1 + Math.sin(t) * 0.025, 1 + Math.cos(t) * 0.025, 1);
    }

    // 눈 깜빡임 — 5~7초 주기로 짧게
    const now = performance.now();
    const blinkCycle = (now % 6000) / 6000;
    const blinking = blinkCycle > 0.97;
    const ey = blinking ? 0.04 : 0.24;
    if (eyeLRef.current) eyeLRef.current.scale.y = ey / 0.24;
    if (eyeRRef.current) eyeRRef.current.scale.y = ey / 0.24;

    // 혀 애니메이션
    if (tongueRef.current) {
      const since = now - tongueAt;
      if (since >= 0 && since < 200) {
        const p = since / 200;
        // 0~0.5: 뻗기, 0.5~1.0: 회수
        const extend = p < 0.5 ? p * 2 : (1 - p) * 2;
        tongueRef.current.visible = true;
        tongueRef.current.scale.set(1, 1, 0.2 + extend * 1.1);
        tongueRef.current.position.z = 0.3 + extend * 0.5;
      } else {
        tongueRef.current.visible = false;
      }
    }
  });

  return (
    <group ref={ref}>
      {/* 몸통 - 낮고 넓은 큐브 */}
      <mesh castShadow position={[0, 0.12, -0.02]}>
        <boxGeometry args={[0.52, 0.22, 0.5]} />
        <meshStandardMaterial color={COLORS.FROG_BODY} roughness={1} />
      </mesh>

      {/* 머리 - 살짝 앞으로 올라온 위치 */}
      <mesh castShadow position={[0, 0.32, 0.06]}>
        <boxGeometry args={[0.46, 0.2, 0.42]} />
        <meshStandardMaterial color={COLORS.FROG_BODY} roughness={1} />
      </mesh>

      {/* 배 - 밝은 크림색 */}
      <mesh position={[0, 0.05, 0.12]}>
        <boxGeometry args={[0.34, 0.08, 0.32]} />
        <meshStandardMaterial color={COLORS.FROG_BELLY} roughness={1} />
      </mesh>

      {/* 등 어두운 줄 */}
      <mesh position={[0, 0.245, -0.18]}>
        <boxGeometry args={[0.36, 0.04, 0.18]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} roughness={1} />
      </mesh>

      {/* 뒷다리 (양옆 접힘) */}
      <mesh castShadow position={[-0.27, 0.12, -0.08]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.12, 0.12, 0.3]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} roughness={1} />
      </mesh>
      <mesh castShadow position={[0.27, 0.12, -0.08]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.12, 0.12, 0.3]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} roughness={1} />
      </mesh>

      {/* 앞다리 (작게) */}
      <mesh position={[-0.2, 0.06, 0.18]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.06, 0.18]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} roughness={1} />
      </mesh>

      {/* 눈 — 머리 위로 솟은 두 작은 큐브 (밝은 연두 + 검은 동공) */}
      <group ref={eyeLRef} position={[-0.14, 0.5, 0.06]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.18, 0.16]} />
          <meshStandardMaterial color="#c8f08c" roughness={1} />
        </mesh>
        {/* 동공 */}
        <mesh position={[0, 0, 0.085]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial color={COLORS.FROG_PUPIL} />
        </mesh>
      </group>
      <group ref={eyeRRef} position={[0.14, 0.5, 0.06]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.18, 0.16]} />
          <meshStandardMaterial color="#c8f08c" roughness={1} />
        </mesh>
        <mesh position={[0, 0, 0.085]}>
          <boxGeometry args={[0.09, 0.09, 0.02]} />
          <meshStandardMaterial color={COLORS.FROG_PUPIL} />
        </mesh>
      </group>

      {/* 입 자국 */}
      <mesh position={[0, 0.27, 0.27]}>
        <boxGeometry args={[0.16, 0.025, 0.01]} />
        <meshStandardMaterial color={COLORS.FROG_DARK} />
      </mesh>

      {/* 혀 — 보통은 숨겨져 있고 좌클릭 시만 보임 */}
      <mesh ref={tongueRef} position={[0, 0.27, 0.3]} visible={false}>
        <boxGeometry args={[0.06, 0.04, 1]} />
        <meshStandardMaterial color="#ff5b8a" roughness={1} />
      </mesh>
    </group>
  );
}
