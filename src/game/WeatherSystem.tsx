import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  type InstancedMesh,
  Matrix4,
  Points,
} from "three";
import { COLORS } from "./constants";
import { useGameStore } from "../store/useGameStore";
import { initSlots, slotHash, updateSlots } from "./slotRecycler";

interface Props {
  frogX: number;
  frogZ: number;
}

// 각 장식은 (instance 수, 슬롯 폭, cullBehind) 트리플로 정의된다.
const WAVE = { N: 64, SPACING: 0.8, CULL: 16 };
const SPARKLE = { N: 30, SPACING: 1.6, CULL: 6 };
const DECO_PAD = { N: 60, SPACING: 1.0, CULL: 14 };
const SEAWEED = { N: 24, SPACING: 2.2, CULL: 4 };

/**
 * 월드 고정 위치의 수면 장식 + 날씨 효과.
 *
 * 모든 instance 는 슬롯 기반으로 자기 월드 좌표에 고정되어 있고,
 * 카메라가 그것을 통과하는 식으로 보인다 (배경이 따라다니지 않음).
 */
export default function WeatherSystem({ frogX, frogZ }: Props) {
  const weather = useGameStore((s) => s.weather);
  const wind = useGameStore((s) => s.wind);
  const { scene } = useThree();

  useFrame(() => {
    if (weather === "fog") {
      if (!scene.fog) scene.fog = new Fog(COLORS.FOG, 16, 42);
    } else {
      scene.fog = null;
    }
  });

  // ──────── 슬롯 메모리 ────────
  const waveSlots = useRef<number[]>(initSlots(WAVE.N, WAVE.CULL));
  const sparkleSlots = useRef<number[]>(initSlots(SPARKLE.N, SPARKLE.CULL));
  const decoPadSlots = useRef<number[]>(initSlots(DECO_PAD.N, DECO_PAD.CULL));
  const seaweedSlots = useRef<number[]>(initSlots(SEAWEED.N, SEAWEED.CULL));

  // ──────── InstancedMesh refs ────────
  const waveRef = useRef<InstancedMesh>(null);
  const sparkleRef = useRef<InstancedMesh>(null);
  const decoPadLightRef = useRef<InstancedMesh>(null);
  const decoPadDarkRef = useRef<InstancedMesh>(null);
  const seaweedRef = useRef<InstancedMesh>(null);

  const tmp = useMemo(() => new Matrix4(), []);

  useFrame(() => {
    const t = performance.now() / 1000;

    // ① 픽셀 물결 라인 — 짧은 흰 막대
    if (waveRef.current) {
      const mesh = waveRef.current;
      updateSlots(waveSlots.current, frogX, WAVE.SPACING, WAVE.CULL, (i, s) => {
        const x = s * WAVE.SPACING + (slotHash(s, 1) - 0.5) * WAVE.SPACING * 0.6;
        const z = (slotHash(s, 2) - 0.5) * 18;
        const len = 0.9 + slotHash(s, 3) * 1.8;
        // 슬롯의 정체성을 유지하되 살짝 좌우 출렁임만 시간으로 변화
        const drift = Math.sin(t * 0.4 + s * 0.7) * 0.18;
        tmp.makeScale(len, 0.06, 0.18);
        tmp.setPosition(x + drift, -0.45, z);
        mesh.setMatrixAt(i, tmp);
      });
      mesh.count = WAVE.N;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ② 반짝임 — 깜빡거리는 작은 큐브
    if (sparkleRef.current) {
      const mesh = sparkleRef.current;
      updateSlots(
        sparkleSlots.current,
        frogX,
        SPARKLE.SPACING,
        SPARKLE.CULL,
        (i, s) => {
          const x =
            s * SPARKLE.SPACING + (slotHash(s, 17) - 0.5) * SPARKLE.SPACING * 0.7;
          const z = (slotHash(s, 18) - 0.5) * 16;
          // 슬롯별 시간 위상으로 깜빡임 — 위치는 고정
          const phase = (t * 0.9 + slotHash(s, 19) * 6) % 2.5;
          const visible = phase < 0.8;
          const scl = visible ? 0.16 + Math.sin(phase * 4) * 0.04 : 0.001;
          tmp.makeScale(scl, 0.04, scl);
          tmp.setPosition(x, -0.4, z);
          mesh.setMatrixAt(i, tmp);
        },
      );
      mesh.count = SPARKLE.N;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ③ 작은 장식 패드 (두 톤) — 한 슬롯에 한 패드, 톤은 hash 로 분기
    if (decoPadLightRef.current && decoPadDarkRef.current) {
      const light = decoPadLightRef.current;
      const dark = decoPadDarkRef.current;
      let lightIdx = 0;
      let darkIdx = 0;
      updateSlots(
        decoPadSlots.current,
        frogX,
        DECO_PAD.SPACING,
        DECO_PAD.CULL,
        (_, s) => {
          const x =
            s * DECO_PAD.SPACING + (slotHash(s, 7) - 0.5) * DECO_PAD.SPACING * 0.7;
          const z = (slotHash(s, 31) - 0.5) * 18;
          const size = 0.32 + slotHash(s, 9) * 0.35;
          const isDark = slotHash(s, 11) > 0.62;
          tmp.makeScale(size, 0.14, size);
          tmp.setPosition(x, -0.18, z);
          if (isDark) dark.setMatrixAt(darkIdx++, tmp);
          else light.setMatrixAt(lightIdx++, tmp);
        },
      );
      light.count = lightIdx;
      dark.count = darkIdx;
      light.instanceMatrix.needsUpdate = true;
      dark.instanceMatrix.needsUpdate = true;
    }

    // ④ 수초 — 수면 아래에서 가늘게 솟은 어두운 큐브
    if (seaweedRef.current) {
      const mesh = seaweedRef.current;
      updateSlots(
        seaweedSlots.current,
        frogX,
        SEAWEED.SPACING,
        SEAWEED.CULL,
        (i, s) => {
          const x =
            s * SEAWEED.SPACING + (slotHash(s, 41) - 0.5) * SEAWEED.SPACING * 0.6;
          const z = (slotHash(s, 42) - 0.5) * 16;
          // 시간 흐름에 따라 살짝 흔들림 (작아서 좌표가 어긋나도 안 보임 수준)
          const sway = Math.sin(t * 0.6 + s) * 0.06;
          tmp.makeScale(0.12, 0.55, 0.12);
          tmp.setPosition(x + sway, -0.15, z);
          mesh.setMatrixAt(i, tmp);
        },
      );
      mesh.count = SEAWEED.N;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // ──────── 날씨 파티클 (rain/wind/cloud — 이건 환경 효과라 frog 기준이어도 자연스러움) ────────
  const rainGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = Math.random() * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const rainRef = useRef<Points>(null);
  useFrame((_, dt) => {
    if (!rainRef.current || weather !== "rain") return;
    const pos = rainRef.current.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= 30 * dt;
      arr[i + 0] += wind.strength * Math.cos(wind.direction) * 4 * dt;
      arr[i + 2] += wind.strength * Math.sin(wind.direction) * 4 * dt;
      if (arr[i + 1] < 0) {
        arr[i + 1] = 16 + Math.random() * 4;
        arr[i + 0] = frogX + (Math.random() - 0.5) * 60;
        arr[i + 2] = frogZ + (Math.random() - 0.5) * 60;
      }
    }
    pos.needsUpdate = true;
  });

  const dustGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = Math.random() * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const dustRef = useRef<Points>(null);
  useFrame((_, dt) => {
    if (!dustRef.current || weather !== "wind") return;
    const pos = dustRef.current.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    const cx = Math.cos(wind.direction);
    const cz = Math.sin(wind.direction);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 0] += cx * 6 * dt * (0.5 + wind.strength);
      arr[i + 2] += cz * 6 * dt * (0.5 + wind.strength);
      const dx = arr[i + 0] - frogX;
      const dz = arr[i + 2] - frogZ;
      if (Math.abs(dx) > 30 || Math.abs(dz) > 30) {
        arr[i + 0] = frogX + (Math.random() - 0.5) * 30;
        arr[i + 1] = 0.5 + Math.random() * 4;
        arr[i + 2] = frogZ + (Math.random() - 0.5) * 30;
      }
    }
    pos.needsUpdate = true;
  });

  const cloudPositions = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, i) => ({
        offsetX: (i - 2) * 22 + Math.random() * 6,
        offsetZ: (Math.random() - 0.5) * 24,
        height: 8 + Math.random() * 2,
      })),
    [],
  );

  return (
    <group>
      {/* 수면 — 거대한 단색 평면 (개구리 따라가도 무방, 색이 균일해 차이가 안 보임) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[frogX + 10, -0.5, frogZ]}
        receiveShadow
        frustumCulled={false}
      >
        <planeGeometry args={[300, 120]} />
        <meshStandardMaterial
          color={new Color(COLORS.WATER_TOP)}
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>

      {/* 모든 장식 — 슬롯 리사이클러로 월드 좌표에 고정 */}
      <instancedMesh
        ref={waveRef}
        args={[undefined, undefined, WAVE.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
      </instancedMesh>
      <instancedMesh
        ref={sparkleRef}
        args={[undefined, undefined, SPARKLE.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={decoPadLightRef}
        args={[undefined, undefined, DECO_PAD.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#79c25c"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={decoPadDarkRef}
        args={[undefined, undefined, DECO_PAD.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#4a9a3a"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={seaweedRef}
        args={[undefined, undefined, SEAWEED.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#2e7438"} roughness={1} />
      </instancedMesh>

      {/* 비 */}
      {weather === "rain" && (
        <points ref={rainRef} geometry={rainGeometry}>
          <pointsMaterial
            color="#c9eaf5"
            size={0.14}
            transparent
            opacity={0.85}
            sizeAttenuation
          />
        </points>
      )}
      {/* 강풍 먼지 */}
      {weather === "wind" && (
        <points ref={dustRef} geometry={dustGeometry}>
          <pointsMaterial color="#f4f0c0" size={0.12} transparent opacity={0.8} />
        </points>
      )}
      {/* 구름 */}
      {weather === "cloud" &&
        cloudPositions.map((c, i) => (
          <mesh
            key={`cl-${i}`}
            position={[frogX + c.offsetX, c.height, frogZ + c.offsetZ]}
          >
            <boxGeometry args={[12, 1.4, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        ))}
    </group>
  );
}
