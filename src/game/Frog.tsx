import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLORS } from "./constants";
import { useGameStore } from "../store/useGameStore";
import type { BuffType } from "./types";

// 버프 오라 — 활성 버프 1개당 발밑 링 1개 + 주위를 도는 반짝이
const AURA_SLOTS = 3;
const AURA_SPARKLES = 5;
function buffAuraColor(t: BuffType) {
  return t === "rangeUp" ? "#f5e26b" : t === "swim" ? "#83d2ff" : "#ff9bd1";
}

interface Props {
  position: { x: number; y: number; z: number };
  aimDirection: number;
  isCharging: boolean;
  isJumping: boolean;
  jumpProgress: number;
  isDead?: boolean;
  isSwimming?: boolean;
  /** 수영 글라이드 이동 방향(월드 각도) — 헤엄 중 머리가 이 방향을 향한다 */
  swimDir?: number;
  crocSnap?: { cx: number; cz: number; bornAt: number } | null;
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
  isDead = false,
  isSwimming = false,
  swimDir = 0,
  crocSnap = null,
}: Props) {
  const ref = useRef<Group>(null);
  const eyeLRef = useRef<Group>(null);
  const eyeRRef = useRef<Group>(null);
  const tongueRef = useRef<Group>(null);
  const tongueAt = useGameStore((s) => s.tongueAt);
  const tongueTarget = useGameStore((s) => s.tongueTarget);
  const buffs = useGameStore((s) => s.buffs);
  const wind = useGameStore((s) => s.wind);
  const tongueTmp = useRef(new Vector3());
  // 버프 오라 (몸체와 별개 그룹 → squash/회전 영향 안 받음)
  const auraRef = useRef<Group>(null);
  const auraRingRefs = useRef<(Mesh | null)[]>([]);
  const auraRingMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const sparkleRefs = useRef<(Mesh | null)[]>([]);
  const sparkleMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  // 회전 보간 상태
  const currentYaw = useRef(0);
  const currentPitch = useRef(0);
  // 사망 애니메이션
  const deathAtRef = useRef<number | null>(null);
  const wasDeadRef = useRef(false);
  // 악어 사망 애니메이션
  const crocAtRef = useRef<number | null>(null);
  const wasCrocRef = useRef(false);

  useFrame(() => {
    if (!ref.current) return;

    // 버프 오라 — 활성 버프 색으로 발밑 링이 맥동하고 반짝이가 주위를 돈다
    if (auraRef.current) {
      const showAura = !isDead && !crocSnap && buffs.length > 0;
      auraRef.current.visible = showAura;
      if (showAura) {
        const tnow = performance.now() / 1000;
        // 연잎 윗면(월드 ~0.18)보다 살짝 위에 링이 깔리도록 — 발밑이 연잎에 가려지지 않게
        auraRef.current.position.set(position.x, position.y + 0.2, position.z);
        for (let i = 0; i < AURA_SLOTS; i++) {
          const m = auraRingRefs.current[i];
          const mat = auraRingMatRefs.current[i];
          if (!m || !mat) continue;
          const b = buffs[i];
          if (!b) {
            m.visible = false;
            continue;
          }
          m.visible = true;
          mat.color.set(buffAuraColor(b.type));
          const pulse = Math.sin(tnow * 4 + i * 1.3) * 0.5 + 0.5;
          // 만료 임박(2초 미만, swim 제외) 시 빠르게 깜빡임
          const expiring = b.type !== "swim" && b.remaining < 2;
          const blink = expiring ? (Math.sin(tnow * 22) > 0 ? 1 : 0.2) : 1;
          const s = 1 + i * 0.16 + pulse * 0.12;
          m.scale.set(s, s, s);
          mat.opacity = (0.22 + pulse * 0.22) * blink;
        }
        const primary = buffs[0];
        for (let i = 0; i < AURA_SPARKLES; i++) {
          const sp = sparkleRefs.current[i];
          const spm = sparkleMatRefs.current[i];
          if (!sp || !spm) continue;
          spm.color.set(buffAuraColor(primary.type));
          const a = tnow * 1.6 + (i / AURA_SPARKLES) * Math.PI * 2;
          sp.position.set(
            Math.cos(a) * 0.45,
            0.1 + Math.sin(tnow * 3 + i) * 0.18,
            Math.sin(a) * 0.45,
          );
          const tw = Math.sin(tnow * 6 + i * 2) * 0.5 + 0.5;
          sp.scale.setScalar(0.05 + tw * 0.05);
          spm.opacity = 0.4 + tw * 0.5;
        }
      }
    }

    // 사망 시 물속으로 빠지는 애니메이션
    if (isDead) {
      if (!wasDeadRef.current) {
        deathAtRef.current = performance.now();
        wasDeadRef.current = true;
      }
      const deadAge = (performance.now() - (deathAtRef.current ?? performance.now())) / 1000;
      // 0~0.08s: 수면에 찰싹 납작해지고 바로 숨김
      const squashT = Math.min(1, deadAge / 0.08);
      const scaleX = 1 + squashT * 0.7;
      const scaleY = Math.max(0.02, 1 - squashT * 0.95);
      ref.current.position.set(position.x, 0.22 * (1 - squashT), position.z);
      ref.current.scale.set(scaleX, scaleY, scaleX);
      ref.current.visible = deadAge < 0.1;
      return;
    }
    if (wasDeadRef.current) {
      wasDeadRef.current = false;
      deathAtRef.current = null;
      ref.current.visible = true;
    }

    // 악어에 잡아먹히는 애니메이션 — 악어 쪽으로 빨려들어가며 소멸
    if (crocSnap) {
      if (!wasCrocRef.current) {
        crocAtRef.current = performance.now();
        wasCrocRef.current = true;
      }
      const t = Math.min(1, (performance.now() - (crocAtRef.current ?? performance.now())) / 280);
      const ease = t * t; // ease-in: 점점 빠르게
      const dx = crocSnap.cx - position.x;
      const dz = crocSnap.cz - position.z;
      const len = Math.hypot(dx, dz) || 1;
      ref.current.position.set(
        position.x + (dx / len) * ease * 0.9,
        0.22 * (1 - ease),
        position.z + (dz / len) * ease * 0.9,
      );
      ref.current.scale.setScalar(Math.max(0, 1 - ease));
      ref.current.visible = t < 1.0;
      return;
    }
    if (wasCrocRef.current) {
      wasCrocRef.current = false;
      crocAtRef.current = null;
      ref.current.visible = true;
      ref.current.scale.setScalar(1);
    }

    const Y_LIFT = 0.22;
    ref.current.position.set(position.x, position.y + Y_LIFT, position.z);

    // 부드러운 yaw 회전 (각도 wraparound 처리)
    // 헤엄 중에는 이동 방향(swimDir)을, 그 외엔 조준 방향을 향한다
    const yawSource = isSwimming ? swimDir : aimDirection;
    const targetYaw = -yawSource + Math.PI / 2;
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
    ref.current.rotation.z = 0;

    // 강풍 — 바람 쪽으로 살짝 기울임(버티는 자세). 헤엄 중엔 적용 안 함(헤엄이 rotation.z 사용)
    if (!isSwimming && wind.strength > 0) {
      const rel = wind.direction - aimDirection;
      ref.current.rotation.z = -Math.sin(rel) * wind.strength * 0.22;
      ref.current.rotation.x = currentPitch.current + Math.cos(rel) * wind.strength * 0.13;
    }

    if (isSwimming) {
      // 헤엄 — 물 위에 납작하게 퍼져 좌우로 파닥이며 나아간다
      const t = performance.now() * 0.018;
      ref.current.scale.set(1.22 + Math.sin(t) * 0.06, 0.6, 1.12);
      ref.current.rotation.z = Math.sin(t) * 0.12;
    } else if (isCharging) {
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

    // 혀 애니메이션 — 피벗은 입(그룹 원점), +z로 뻗는 혀 박스를 회전·스케일
    if (tongueRef.current) {
      const since = now - tongueAt;
      // 파리를 잡으면 멀리까지 닿아야 하므로 시간을 거리에 비례해 늘림
      const targeted = tongueTarget != null;
      const dur = targeted ? 320 : 200;
      if (since >= 0 && since < dur) {
        const p = since / dur;
        // 0~0.4: 뻗기, 0.4~1.0: 회수 (살짝 머문 뒤 빠르게 회수)
        const extend = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        tongueRef.current.visible = true;
        if (targeted && ref.current) {
          // 파리 월드 좌표 → 개구리 로컬 좌표 (개구리의 yaw/pitch/scale 반영)
          ref.current.updateMatrixWorld();
          const t = tongueTmp.current.set(
            tongueTarget![0],
            tongueTarget![1],
            tongueTarget![2],
          );
          ref.current.worldToLocal(t);
          // 입(피벗 [0,0.27,0.3]) 기준 방향 벡터
          const dx = t.x - 0;
          const dy = t.y - 0.27;
          const dz = t.z - 0.3;
          const horiz = Math.hypot(dx, dz) || 1e-4;
          const dist = Math.hypot(dx, dy, dz);
          tongueRef.current.rotation.order = "YXZ";
          tongueRef.current.rotation.y = Math.atan2(dx, dz);
          tongueRef.current.rotation.x = -Math.atan2(dy, horiz);
          tongueRef.current.scale.set(1, 1, Math.max(0.05, dist * extend));
        } else {
          // 기본 낼름 — 앞으로 짧게
          tongueRef.current.rotation.set(0, 0, 0);
          tongueRef.current.scale.set(1, 1, 0.4 + extend * 1.0);
        }
      } else {
        tongueRef.current.visible = false;
      }
    }
  });

  return (
    <>
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

      {/* 혀 — 입(피벗)에서 +z로 뻗음. 보통 숨겨져 있고 좌클릭 시만 보임.
           파리를 잡으면 그 방향·거리로 회전·신장해 실제로 닿는다 (scale.z = 거리) */}
      <group ref={tongueRef} position={[0, 0.27, 0.3]} visible={false}>
        {/* 혀 줄기 — 그룹 z 0..1 차지, 그룹 scale.z로 길이 조절 */}
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[0.06, 0.04, 1]} />
          <meshStandardMaterial color="#ff5b8a" roughness={1} />
        </mesh>
        {/* 끈끈한 혀끝 — 파리를 붙잡는 부분 (줄기 끝에 위치) */}
        <mesh position={[0, 0, 1]}>
          <boxGeometry args={[0.12, 0.09, 0.05]} />
          <meshStandardMaterial color="#ff7ba3" roughness={1} />
        </mesh>
      </group>
    </group>

    {/* 버프 오라 — 몸체와 별개 그룹(squash 영향 없음), useFrame에서 개구리를 따라감 */}
    <group ref={auraRef} visible={false}>
      {Array.from({ length: AURA_SLOTS }).map((_, i) => (
        <mesh
          key={`aura${i}`}
          ref={(el) => { auraRingRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.34, 0.5, 28]} />
          <meshBasicMaterial
            ref={(m) => { auraRingMatRefs.current[i] = m; }}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {Array.from({ length: AURA_SPARKLES }).map((_, i) => (
        <mesh key={`spk${i}`} ref={(el) => { sparkleRefs.current[i] = el; }}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            ref={(m) => { sparkleMatRefs.current[i] = m; }}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
    </>
  );
}
