import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  type AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Euler,
  FogExp2,
  type Group,
  type InstancedMesh,
  LineSegments,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  Points,
  Quaternion,
  Vector3,
} from "three";
import { COLORS } from "./constants";
import { useGameStore } from "../store/useGameStore";
import { playThunder } from "./sound";
import { gameNow, gameNowMs } from "./gameClock";
import { initSlots, slotHash, updateSlots } from "./slotRecycler";

// 부드러운 라디얼 그라데이션 텍스처 (먹구름 그림자용) — 가장자리가 자연스럽게 사라짐
let _softTex: CanvasTexture | null = null;
function getSoftTexture() {
  if (_softTex) return _softTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.55, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _softTex = new CanvasTexture(c);
  return _softTex;
}

// 비 — 빗줄기(LineSegments)
const RAIN_N = 600;
const RAIN_STREAK = 1.3; // 줄기 길이(m)

// 강풍 — 바람 줄기(공기 흐름 선) + 날리는 낙엽
const WIND_STREAK_N = 42;
const WIND_STREAK_LEN = 2.2;
const WIND_LEAF_N = 14;

// 안개 — 낮게 깔려 흐르는 안개 자락 + 미세 부유 입자(haze)
const MIST_N = 4;
const HAZE_N = 70;

// 빗방울 수면 파문 — 비가 닿는 곳에 동심원이 톡톡 퍼졌다 사라짐
const RAIN_RIPPLE_N = 22;
const RAIN_RIPPLE_LIFE = 700; // ms
const RAIN_RIPPLE_INTERVAL = 45; // ms 마다 방울

function RainRipples({ frogX, frogZ, active, paused }: { frogX: number; frogZ: number; active: boolean; paused: boolean }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const matRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const drops = useRef(
    Array.from({ length: RAIN_RIPPLE_N }, () => ({ x: 0, z: 0, bornAt: -1e9 })),
  );
  const lastSpawn = useRef(0);
  const cursor = useRef(0);

  useFrame(() => {
    if (paused) return; // 일시정지 시 파문 정지
    const now = gameNowMs();
    if (active && now - lastSpawn.current >= RAIN_RIPPLE_INTERVAL) {
      lastSpawn.current = now;
      const k = Math.random() < 0.5 ? 2 : 1; // 한 번에 1~2개
      for (let n = 0; n < k; n++) {
        const slot = drops.current[cursor.current % RAIN_RIPPLE_N];
        slot.x = frogX + (Math.random() - 0.5) * 26;
        slot.z = frogZ + (Math.random() - 0.5) * 22;
        slot.bornAt = now + n * 12;
        cursor.current++;
      }
    }
    for (let i = 0; i < RAIN_RIPPLE_N; i++) {
      const m = refs.current[i];
      const mat = matRefs.current[i];
      const d = drops.current[i];
      if (!m || !mat) continue;
      const age = (now - d.bornAt) / RAIN_RIPPLE_LIFE;
      if (age < 0 || age > 1) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(d.x, -0.46, d.z);
      const s = 0.12 + age * 0.5;
      m.scale.set(s, s, s);
      mat.opacity = (1 - age) * 0.5;
    }
  });

  return (
    <group>
      {Array.from({ length: RAIN_RIPPLE_N }).map((_, i) => (
        <mesh
          key={`rr${i}`}
          ref={(el) => { refs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.6, 1.0, 14]} />
          <meshBasicMaterial
            ref={(m) => { matRefs.current[i] = m; }}
            color="#cfeaf5"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// 구름 한 덩이의 복셀 형상 (그룹 로컬, ~12폭 기준): [x,y,z, sx,sy,sz]
// 본체(어두움) + 상단 림(밝음) + 가장자리 솜털(옅음)으로 부푼 실루엣
const CLOUD_BODY: number[][] = [
  [0, 0, 0, 10, 2.6, 5],
  [-3.6, 0.3, 0.4, 5, 2.2, 4],
  [3.7, 0.1, -0.5, 4.6, 2.0, 3.8],
  [-1.5, -0.6, -0.6, 4.5, 1.6, 3.2],
  [1.8, -0.5, 0.7, 4.0, 1.5, 3.0],
];
const CLOUD_RIM: number[][] = [
  [0.4, 1.4, 0.2, 5, 1.9, 3.6],
  [-2.2, 1.1, -0.7, 3.6, 1.6, 2.8],
  [2.4, 1.0, 0.9, 3.2, 1.5, 2.6],
];
const CLOUD_FRINGE: number[][] = [
  [-5.4, 0.1, 1.0, 2.6, 1.4, 2.0],
  [5.4, -0.2, -1.0, 2.4, 1.3, 1.9],
  [0.2, -1.3, 2.5, 3.0, 1.2, 1.8],
  [-1.0, 2.0, -1.0, 2.4, 1.2, 1.8],
];

function CloudPuff() {
  return (
    <group>
      {CLOUD_BODY.map((b, i) => (
        <mesh key={`b${i}`} position={[b[0], b[1], b[2]]} renderOrder={50} userData={{ op: 0.93 }}>
          <boxGeometry args={[b[3], b[4], b[5]]} />
          <meshBasicMaterial color="#3a3e54" transparent opacity={0.93} depthWrite={false} depthTest={false} />
        </mesh>
      ))}
      {CLOUD_RIM.map((b, i) => (
        <mesh key={`r${i}`} position={[b[0], b[1], b[2]]} renderOrder={51} userData={{ op: 0.93 }}>
          <boxGeometry args={[b[3], b[4], b[5]]} />
          <meshBasicMaterial color="#565c78" transparent opacity={0.93} depthWrite={false} depthTest={false} />
        </mesh>
      ))}
      {CLOUD_FRINGE.map((b, i) => (
        <mesh key={`f${i}`} position={[b[0], b[1], b[2]]} renderOrder={49} userData={{ op: 0.5 }}>
          <boxGeometry args={[b[3], b[4], b[5]]} />
          <meshBasicMaterial color="#474d68" transparent opacity={0.5} depthWrite={false} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

interface Props {
  frogX: number;
  frogZ: number;
}

// 각 장식은 (instance 수, 슬롯 폭, cullBehind) 트리플로 정의된다.
const WAVE = { N: 64, SPACING: 0.8, CULL: 16 };
const SPARKLE = { N: 30, SPACING: 1.6, CULL: 6 };
const DECO_PAD = { N: 36, SPACING: 1.5, CULL: 12 };
const SEAWEED = { N: 24, SPACING: 2.2, CULL: 4 };

// 안개 튜닝값
const FOG_LERP_SPEED = 0.5;       // 전환 속도 (클수록 빠름, ~5~6초 전환)
const FOG_MAX_DENSITY = 0.06;     // FogExp2 최대 density
const FOG_AMBIENT_MAX = 0.4;      // 안개 ambient light 최대 intensity
const FOG_BG_ON_THRESHOLD = 0.15; // scene.background를 안개색으로 바꾸는 임계값
const FOG_BG_OFF_THRESHOLD = 0.05; // scene.background를 null로 복원하는 임계값

// 먹구름 — 맵에 고정 스폰, Z 축으로 천천히 이동하며 연잎을 가림
const DARK_CLOUD_N = 2;
const CLOUD_Z_RANGE = 15;
const CLOUD_SPEED = 1.2;
const CLOUD_X_SPREAD = 22;


/**
 * 월드 고정 위치의 수면 장식 + 날씨 효과.
 *
 * 모든 instance 는 슬롯 기반으로 자기 월드 좌표에 고정되어 있고,
 * 카메라가 그것을 통과하는 식으로 보인다 (배경이 따라다니지 않음).
 */
export default function WeatherSystem({ frogX, frogZ }: Props) {
  const weather = useGameStore((s) => s.weather);
  const wind = useGameStore((s) => s.wind);
  const phase = useGameStore((s) => s.phase);
  const paused = phase !== "playing"; // 일시정지·메뉴·게임오버 등에서 날씨 모션 정지
  const setLightningFlash = useGameStore((s) => s.setLightningFlash);
  const setLightningShakeAt = useGameStore((s) => s.setLightningShakeAt);
  const { scene } = useThree();

  const fogObj = useMemo(() => new FogExp2(COLORS.FOG, 0), []);
  const fogBgColor = useMemo(() => new Color(COLORS.FOG), []);
  const fogIntensityRef = useRef(0);
  const fogAmbientRef = useRef<AmbientLight>(null);

  useEffect(() => {
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  useFrame((_, dt) => {
    const target = weather === "fog" ? 1 : 0;
    fogIntensityRef.current += (target - fogIntensityRef.current) * FOG_LERP_SPEED * dt;
    const intensity = fogIntensityRef.current;

    if (intensity > 0.001) {
      scene.fog = fogObj;
      fogObj.density = intensity * FOG_MAX_DENSITY;
    } else {
      scene.fog = null;
    }

    if (intensity > FOG_BG_ON_THRESHOLD) {
      scene.background = fogBgColor;
    } else if (intensity < FOG_BG_OFF_THRESHOLD) {
      scene.background = null;
    }

    if (fogAmbientRef.current) {
      fogAmbientRef.current.intensity = intensity * FOG_AMBIENT_MAX;
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
  const cloudGroupRefs = useRef<(Group | null)[]>([]);
  const cloudPresenceRef = useRef(0); // 구름 등장/소멸 페이드 (0→1 lerp)
  const activeCloudCount = useRef(DARK_CLOUD_N);
  const prevWeather = useRef("");

  // 번개 섬광 + 천둥 (폭우 중)
  const lightningRef = useRef<AmbientLight>(null);
  const strikeInRef = useRef(6); // 다음 번개까지 남은 시간(초)
  const flashAgeRef = useRef(99); // 현재 섬광 경과(초), 큰 값=비활성
  const flashStrengthRef = useRef(0); // 현재 번개 세기(가까움 1 / 멀리 0.4)
  const thunderInRef = useRef<number | null>(null); // 천둥까지 남은 지연(초)
  const thunderPowerRef = useRef(1); // 천둥 세기
  const lightningFlashQRef = useRef(0); // store에 쓴 양자화 섬광값
  // 먹구름 수면 그림자
  const cloudShadowRefs = useRef<(Mesh | null)[]>([]);
  const softTex = useMemo(() => getSoftTexture(), []);

  // 먹구름 상태: x, z(드리프트), zDir, h/w/d(크기)
  const darkCloudData = useRef(
    Array.from({ length: DARK_CLOUD_N }, (_, i) => {
      const dir = Math.random() > 0.5 ? 1 : -1;
      return {
        x: i * CLOUD_X_SPREAD + Math.random() * 8,
        z: (Math.random() - 0.5) * CLOUD_Z_RANGE * 1.8,
        zDir: dir,
        h: 1.0 + Math.random() * 0.5,
        w: 11 + Math.random() * 8,
        d: 5 + Math.random() * 3,
        presence: 1, // 구름별 등장 페이드 (리스폰/wrap 시 0으로 리셋)
      };
    }),
  );

  const tmp = useMemo(() => new Matrix4(), []);

  useFrame(() => {
    const t = gameNow();
    // 강풍 반응용 — 바람 방향/세기 (강풍이 아니면 0)
    const windOn = weather === "wind";
    const wDirX = windOn ? Math.cos(wind.direction) : 0;
    const wDirZ = windOn ? Math.sin(wind.direction) : 0;
    const wStr = windOn ? wind.strength : 0;

    // ① 픽셀 물결 라인 — 짧은 흰 막대 (강풍 시 바람 방향으로 빠르게 흐름)
    if (waveRef.current) {
      const mesh = waveRef.current;
      updateSlots(waveSlots.current, frogX, WAVE.SPACING, WAVE.CULL, (i, s) => {
        const x = s * WAVE.SPACING + (slotHash(s, 1) - 0.5) * WAVE.SPACING * 0.6;
        const z = (slotHash(s, 2) - 0.5) * 18;
        const len = 0.9 + slotHash(s, 3) * 1.8;
        // 강풍이면 더 빨리·크게 출렁이고 바람 방향으로 쏠림
        const drift = Math.sin(t * (0.4 + wStr * 0.6) + s * 0.7) * (0.18 + wStr * 0.12);
        tmp.makeScale(len, 0.06, 0.18);
        tmp.setPosition(x + drift + wDirX * wStr * 0.18, -0.45, z + wDirZ * wStr * 0.18);
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
          // 강풍 시 더 빨리 파닥이고 바람 방향으로 눕듯 쏠림
          const sway = Math.sin(t * (0.6 + wStr * 1.6) + s) * (0.06 + wStr * 0.05);
          tmp.makeScale(0.12, 0.55, 0.12);
          tmp.setPosition(x + sway + wDirX * wStr * 0.14, -0.15, z + wDirZ * wStr * 0.14);
          mesh.setMatrixAt(i, tmp);
        },
      );
      mesh.count = SEAWEED.N;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // ──────── 날씨 파티클 (rain/wind/cloud — 이건 환경 효과라 frog 기준이어도 자연스러움) ────────
  // 비 — 짧은 빗줄기(LineSegments): 정점 2개/줄기, 머리(아래) + 꼬리(위, 바람으로 기울어짐)
  const rainGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(RAIN_N * 2 * 3);
    for (let i = 0; i < RAIN_N; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 18;
      const z = (Math.random() - 0.5) * 60;
      arr[i * 6 + 0] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = x;
      arr[i * 6 + 4] = y + RAIN_STREAK;
      arr[i * 6 + 5] = z;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const rainRef = useRef<LineSegments>(null);
  useFrame((_, dt) => {
    if (paused || !rainRef.current || weather !== "rain") return;
    const pos = rainRef.current.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    const driftX = wind.strength * Math.cos(wind.direction) * 4;
    const driftZ = wind.strength * Math.sin(wind.direction) * 4;
    // 바람 기울기 — 줄기가 바람 반대(위)로 누움
    const leanX = -driftX * 0.06;
    const leanZ = -driftZ * 0.06;
    for (let i = 0; i < RAIN_N; i++) {
      const b = i * 6;
      arr[b + 1] -= 30 * dt; // 머리 낙하
      arr[b + 0] += driftX * dt;
      arr[b + 2] += driftZ * dt;
      if (arr[b + 1] < 0) {
        arr[b + 0] = frogX + (Math.random() - 0.5) * 60;
        arr[b + 1] = 16 + Math.random() * 4;
        arr[b + 2] = frogZ + (Math.random() - 0.5) * 60;
      }
      // 꼬리 = 머리 + 줄기 벡터(위 + 바람 기울기)
      arr[b + 3] = arr[b + 0] + leanX;
      arr[b + 4] = arr[b + 1] + RAIN_STREAK;
      arr[b + 5] = arr[b + 2] + leanZ;
    }
    pos.needsUpdate = true;
  });

  const dustGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(130 * 3);
    for (let i = 0; i < 130; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 40;
      arr[i * 3 + 1] = Math.random() * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const dustRef = useRef<Points>(null);
  useFrame((_, dt) => {
    if (paused || !dustRef.current || weather !== "wind") return;
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

  // 바람 줄기 — 바람 방향으로 흐르는 공기 흐름 선 (LineSegments)
  const windStreakGeo = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(WIND_STREAK_N * 2 * 3);
    for (let i = 0; i < WIND_STREAK_N; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = 0.5 + Math.random() * 6;
      const z = (Math.random() - 0.5) * 40;
      arr[i * 6 + 0] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = x;
      arr[i * 6 + 4] = y;
      arr[i * 6 + 5] = z;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const windStreakRef = useRef<LineSegments>(null);
  useFrame((_, dt) => {
    if (paused || !windStreakRef.current || weather !== "wind") return;
    const pos = windStreakRef.current.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    const dirX = Math.cos(wind.direction);
    const dirZ = Math.sin(wind.direction);
    const spd = 11 * (0.5 + wind.strength);
    const len = WIND_STREAK_LEN * (0.6 + wind.strength * 0.7);
    for (let i = 0; i < WIND_STREAK_N; i++) {
      const b = i * 6;
      arr[b + 0] += dirX * spd * dt;
      arr[b + 2] += dirZ * spd * dt;
      if (Math.abs(arr[b + 0] - frogX) > 28 || Math.abs(arr[b + 2] - frogZ) > 24) {
        arr[b + 0] = frogX - dirX * 24 + (Math.random() - 0.5) * 30;
        arr[b + 1] = 0.5 + Math.random() * 6;
        arr[b + 2] = frogZ - dirZ * 22 + (Math.random() - 0.5) * 30;
      }
      // 꼬리는 진행 반대 방향으로 뻗음
      arr[b + 3] = arr[b + 0] - dirX * len;
      arr[b + 4] = arr[b + 1];
      arr[b + 5] = arr[b + 2] - dirZ * len;
    }
    pos.needsUpdate = true;
  });

  // 날리는 낙엽 — 바람 방향으로 빙글빙글 굴러감 (InstancedMesh)
  const leafRef = useRef<InstancedMesh>(null);
  const leafData = useRef(
    Array.from({ length: WIND_LEAF_N }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: 0.3 + Math.random() * 4,
      z: (Math.random() - 0.5) * 30,
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 6,
      bob: Math.random() * 6,
    })),
  );
  const leafQuat = useMemo(() => new Quaternion(), []);
  const leafEuler = useMemo(() => new Euler(), []);
  const leafPos = useMemo(() => new Vector3(), []);
  const leafScale = useMemo(() => new Vector3(0.22, 0.02, 0.14), []);
  const leafColorTmp = useMemo(() => new Color(), []);
  const leafColoredRef = useRef(false);
  useFrame((_, dt) => {
    if (!leafRef.current) return;
    // 최초 1회: 인스턴스별 색 지정 — 1/3은 분홍 꽃잎, 나머지는 낙엽 톤
    if (!leafColoredRef.current) {
      for (let i = 0; i < WIND_LEAF_N; i++) {
        const isPetal = i % 3 === 0;
        leafColorTmp.set(
          isPetal
            ? (i % 2 ? "#ffb0d2" : "#ff97c4") // 꽃잎 분홍
            : (i % 2 ? "#c2873a" : "#9aa840"), // 낙엽 갈색/올리브
        );
        leafRef.current.setColorAt(i, leafColorTmp);
      }
      if (leafRef.current.instanceColor) leafRef.current.instanceColor.needsUpdate = true;
      leafColoredRef.current = true;
    }
    // 강풍이 아니면 숨김(메뉴·다른 날씨 포함). paused보다 먼저 처리해 원점 흰 박스 노출 방지
    if (weather !== "wind") {
      leafRef.current.count = 0;
      return;
    }
    if (paused) return; // 강풍 중 일시정지 → 현재 위치로 정지(count 유지)
    const t = gameNow();
    const dirX = Math.cos(wind.direction);
    const dirZ = Math.sin(wind.direction);
    const spd = 7 * (0.5 + wind.strength);
    leafData.current.forEach((lf, i) => {
      lf.x += dirX * spd * dt;
      lf.z += dirZ * spd * dt;
      lf.y += Math.sin(t * 1.6 + lf.bob) * 0.7 * dt; // 위아래 너풀
      if (lf.y < 0.2) lf.y = 0.2;
      else if (lf.y > 5.5) lf.y = 5.5;
      lf.spin += lf.spinSpeed * dt;
      if (Math.abs(lf.x - frogX) > 26 || Math.abs(lf.z - frogZ) > 22) {
        lf.x = frogX - dirX * 22 + (Math.random() - 0.5) * 24;
        lf.z = frogZ - dirZ * 20 + (Math.random() - 0.5) * 24;
        lf.y = 0.3 + Math.random() * 4;
      }
      leafEuler.set(lf.spin * 0.7, lf.spin, lf.spin * 0.5);
      leafQuat.setFromEuler(leafEuler);
      leafPos.set(lf.x, lf.y, lf.z);
      tmp.compose(leafPos, leafQuat, leafScale);
      leafRef.current!.setMatrixAt(i, tmp);
    });
    leafRef.current.count = WIND_LEAF_N;
    leafRef.current.instanceMatrix.needsUpdate = true;
  });

  // 안개 자락 — 수면 위에 낮게 깔려 천천히 흐르는 부드러운 안개 시트 (안개 농도에 따라 페이드)
  const mistRefs = useRef<(Mesh | null)[]>([]);
  const mistMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const mistData = useRef(
    Array.from({ length: MIST_N }, () => ({
      x: (Math.random() - 0.5) * 44,
      z: (Math.random() - 0.5) * 32,
      vx: 0.35 + Math.random() * 0.4, // 아주 느린 드리프트
      vz: (Math.random() - 0.5) * 0.25,
      w: 14 + Math.random() * 10,
      d: 9 + Math.random() * 6,
      y: 0.4 + Math.random() * 0.6,
      phase: Math.random() * 6,
    })),
  );
  useFrame((_, dt) => {
    if (paused) return; // 일시정지 시 안개 자락 정지
    const intensity = fogIntensityRef.current;
    const t = gameNow();
    for (let i = 0; i < MIST_N; i++) {
      const m = mistRefs.current[i];
      const mat = mistMatRefs.current[i];
      const d = mistData.current[i];
      if (!m || !mat) continue;
      if (intensity < 0.02) {
        m.visible = false;
        continue;
      }
      d.x += d.vx * dt;
      d.z += d.vz * dt;
      // 개구리 기준으로 너무 멀면 반대편으로 리스폰
      if (d.x - frogX > 28) d.x = frogX - 28;
      else if (d.x - frogX < -28) d.x = frogX + 28;
      if (Math.abs(d.z - frogZ) > 24) d.z = frogZ + (Math.random() - 0.5) * 32;
      const breathe = 0.78 + Math.sin(t * 0.4 + d.phase) * 0.22; // 뭉쳤다 옅어짐
      m.visible = true;
      m.position.set(d.x, d.y, d.z);
      m.scale.set(d.w, d.d, 1);
      mat.opacity = intensity * 0.32 * breathe;
    }
  });

  // 안개 미세 부유 입자(haze) — 아주 옅고 느리게 떠다님
  const hazeGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const arr = new Float32Array(HAZE_N * 3);
    for (let i = 0; i < HAZE_N; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 36;
      arr[i * 3 + 1] = 0.3 + Math.random() * 3.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);
  const hazeRef = useRef<Points>(null);
  const hazeMatRef = useRef<import("three").PointsMaterial>(null);
  useFrame((_, dt) => {
    if (paused || !hazeRef.current || !hazeMatRef.current) return;
    const intensity = fogIntensityRef.current;
    hazeMatRef.current.opacity = intensity * 0.4;
    hazeRef.current.visible = intensity > 0.02;
    if (intensity < 0.02) return;
    const t = gameNow();
    const pos = hazeRef.current.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 0] += Math.sin(t * 0.3 + i) * 0.12 * dt + 0.25 * dt; // 느린 부유
      arr[i + 2] += Math.cos(t * 0.25 + i) * 0.12 * dt;
      const dx = arr[i + 0] - frogX;
      const dz = arr[i + 2] - frogZ;
      if (Math.abs(dx) > 22 || Math.abs(dz) > 18) {
        arr[i + 0] = frogX + (Math.random() - 0.5) * 36;
        arr[i + 1] = 0.3 + Math.random() * 3.5;
        arr[i + 2] = frogZ + (Math.random() - 0.5) * 28;
      }
    }
    pos.needsUpdate = true;
  });

  // 먹구름 이동 + 등장/소멸 페이드. 그룹 단위로 위치/스케일/투명도 설정
  useFrame((_, dt) => {
    if (paused) return; // 일시정지 시 구름 정지(현 상태 유지)
    if (weather !== prevWeather.current) {
      if (weather === "cloud") activeCloudCount.current = Math.random() < 0.5 ? 1 : 2;
      prevWeather.current = weather;
    }
    // 등장/소멸을 부드럽게 — presence 0→1 lerp (~3초)
    const target = weather === "cloud" ? 1 : 0;
    cloudPresenceRef.current += (target - cloudPresenceRef.current) * Math.min(1, dt * 0.9);
    const presence = cloudPresenceRef.current;
    if (presence < 0.01) {
      for (const g of cloudGroupRefs.current) if (g) g.visible = false;
      for (const sh of cloudShadowRefs.current) if (sh) sh.visible = false;
      return;
    }
    const clouds = darkCloudData.current;
    const spreadX = DARK_CLOUD_N * CLOUD_X_SPREAD;
    for (const c of clouds) {
      c.z += c.zDir * CLOUD_SPEED * dt;
      const zWrap = CLOUD_Z_RANGE + c.d * 0.6;
      let wrapped = false;
      if (c.z > frogZ + zWrap) { c.z = frogZ - zWrap; wrapped = true; }
      else if (c.z < frogZ - zWrap) { c.z = frogZ + zWrap; wrapped = true; }
      const dx = c.x - frogX;
      if (dx < -CLOUD_X_SPREAD || dx > spreadX + CLOUD_X_SPREAD) {
        c.x = frogX + Math.random() * spreadX;
        c.z = frogZ + (Math.random() - 0.5) * CLOUD_Z_RANGE * 1.6;
        c.zDir = Math.random() > 0.5 ? 1 : -1;
        wrapped = true;
      }
      // 새 위치로 리스폰/wrap된 구름은 다시 페이드 인
      if (wrapped) c.presence = 0;
      c.presence += (1 - c.presence) * Math.min(1, dt * 0.9);
    }
    clouds.forEach((c, i) => {
      const g = cloudGroupRefs.current[i];
      const sh = cloudShadowRefs.current[i];
      const on = i < activeCloudCount.current;
      const op = presence * c.presence; // 전역 페이드 × 구름별 페이드
      if (g) {
        g.visible = on;
        if (on) {
          g.position.set(c.x, c.h + 1.2, c.z);
          g.scale.set(c.w / 12, 1, c.d / 6); // 본체 폭/깊이 변주
          // 투명도 페이드 (각 메시 userData.op 기준)
          g.traverse((obj) => {
            if (obj.userData.op != null) {
              ((obj as Mesh).material as MeshBasicMaterial).opacity = obj.userData.op * op;
            }
          });
        }
      }
      if (sh) {
        sh.visible = on;
        if (on) {
          sh.position.set(c.x, -0.46, c.z);
          sh.scale.set(c.w * 1.15, c.d * 1.35, 1);
          (sh.material as MeshBasicMaterial).opacity = 0.34 * op;
        }
      }
    });
  });

  // 번개 섬광 + 천둥 (폭우 중 무작위 발생) — 가까운/먼 번개 구분
  useFrame((_, dt) => {
    if (paused || !lightningRef.current) return;
    if (weather === "rain") {
      strikeInRef.current -= dt;
      if (strikeInRef.current <= 0) {
        strikeInRef.current = 5 + Math.random() * 9; // 5~14초 간격
        const close = Math.random() < 0.45; // 가까운 번개 45%
        flashStrengthRef.current = close ? 1 : 0.4 + Math.random() * 0.2;
        flashAgeRef.current = 0; // 섬광 시작
        // 가까우면 천둥 즉시·크게(+카메라 흔들림), 멀면 늦게·먹먹
        thunderInRef.current = close ? 0.15 + Math.random() * 0.25 : 0.9 + Math.random() * 1.2;
        thunderPowerRef.current = close ? 1 : 0.35 + Math.random() * 0.2;
        if (close) setLightningShakeAt(gameNowMs());
      }
    }
    // 섬광 엔벨로프 — 초반 강한 번쩍 + 0.12초경 2차 점멸, 빠르게 감쇠
    const a = flashAgeRef.current;
    let lum = 0;
    if (a < 0.5) {
      lum = (Math.exp(-a * 9) + Math.exp(-Math.abs(a - 0.12) * 38) * 0.6) * flashStrengthRef.current;
      flashAgeRef.current += dt;
    }
    lightningRef.current.intensity = Math.min(3, lum) * 2.6;
    // HUD 흰 플래시 — 양자화해 변할 때만 store 갱신
    const qFlash = Math.round(Math.min(1, lum) * 20) / 20;
    if (qFlash !== lightningFlashQRef.current) {
      lightningFlashQRef.current = qFlash;
      setLightningFlash(qFlash);
    }
    // 천둥 — 섬광 뒤 지연 재생
    if (thunderInRef.current != null) {
      thunderInRef.current -= dt;
      if (thunderInRef.current <= 0) {
        thunderInRef.current = null;
        playThunder(thunderPowerRef.current);
      }
    }
  });

  return (
    <group>
      {/* 안개 전용 ambient — intensity는 useFrame에서 fogIntensityRef에 따라 조절 */}
      <ambientLight ref={fogAmbientRef} color="#9ab0bc" intensity={0} />
      {/* 번개 섬광 ambient — 평소 0, 번개 칠 때만 순간 폭발 */}
      <ambientLight ref={lightningRef} color="#dce7ff" intensity={0} />

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

      {/* 비 — 빗줄기 */}
      {weather === "rain" && (
        <lineSegments ref={rainRef} geometry={rainGeometry} frustumCulled={false}>
          <lineBasicMaterial color="#c9eaf5" transparent opacity={0.7} />
        </lineSegments>
      )}
      {/* 빗방울 수면 파문 */}
      <RainRipples frogX={frogX} frogZ={frogZ} active={weather === "rain"} paused={paused} />
      {/* 강풍 먼지 */}
      {weather === "wind" && (
        <points ref={dustRef} geometry={dustGeometry} frustumCulled={false}>
          <pointsMaterial color="#f4f0c0" size={0.12} transparent opacity={0.5} />
        </points>
      )}
      {/* 강풍 — 바람 줄기(공기 흐름 선) */}
      {weather === "wind" && (
        <lineSegments ref={windStreakRef} geometry={windStreakGeo} frustumCulled={false}>
          <lineBasicMaterial color="#eef3e6" transparent opacity={0.2} />
        </lineSegments>
      )}
      {/* 강풍 — 날리는 낙엽 + 꽃잎 (instanceColor로 색 혼합, count=0 게이팅이라 항상 마운트) */}
      <instancedMesh ref={leafRef} args={[undefined, undefined, WIND_LEAF_N]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={1} side={2} />
      </instancedMesh>
      {/* 안개 자락 — 수면 위에 낮게 깔린 부드러운 안개 시트 (가로 평면 + 그라데이션 텍스처) */}
      {Array.from({ length: MIST_N }).map((_, i) => (
        <mesh
          key={`mist${i}`}
          ref={(el) => { mistRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          renderOrder={40}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={(m) => { mistMatRefs.current[i] = m; }}
            map={softTex}
            color="#dde7ea"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 안개 미세 부유 입자(haze) */}
      <points ref={hazeRef} geometry={hazeGeometry} frustumCulled={false}>
        <pointsMaterial
          ref={hazeMatRef}
          color="#e6eef0"
          size={0.1}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {/* 먹구름 — 부푼 복셀 덩어리(본체+림+솜털) 그룹 단위. 그룹 위치/스케일은 useFrame에서 */}
      {Array.from({ length: DARK_CLOUD_N }).map((_, i) => (
        <group
          key={`cloud${i}`}
          ref={(el) => { cloudGroupRefs.current[i] = el; }}
          visible={false}
        >
          <CloudPuff />
        </group>
      ))}
      {/* 먹구름 수면 그림자 — 부드러운 가장자리(그라데이션 텍스처), 구름 아래로 흐름 */}
      {Array.from({ length: DARK_CLOUD_N }).map((_, i) => (
        <mesh
          key={`cshadow${i}`}
          ref={(el) => { cloudShadowRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={softTex}
            color="#161b2e"
            transparent
            opacity={0.34}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
