import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, LinearFilter } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { useGameStore } from "../store/useGameStore";
import { BUFF, JUMP } from "./constants";
import { gameNowMs } from "./gameClock";
import type { JudgmentPopup } from "./types";

interface Props {
  frogX: number;
  frogZ: number;
  aimDir: number;
  chargeDist: number;
  arcHeight: number;
  isCharging: boolean;
  isJumping: boolean;
  isSwimming: boolean;
  yarrBurst: { x: number; z: number; bornAt: number } | null;
  splashAt: { x: number; z: number; bornAt: number } | null;
  swimSplashAt: { x: number; z: number; bornAt: number } | null;
  launchAt: { x: number; z: number; bornAt: number } | null;
  comboBreakAt: { x: number; z: number; bornAt: number } | null;
  crocSnapAt: { x: number; z: number; cx: number; cz: number; bornAt: number } | null;
}

const SPLASH_DUR = 1400;
const SPLASH_RINGS = 3;
const SPLASH_DROPS = 14;
const CROC_DUR = 900;
const CROC_RINGS = 2;
const CROC_SPIKES = 12;

// 일회성 이펙트는 수명(age=1) 이후 5% 여유까지만 렌더하고 그 뒤엔 갱신을 멈춘다.
const EFFECT_TAIL = 1.05;

/**
 * 일회성 이펙트의 수명 게이트 — bornAt/durMs로 age를 구하고, 그룹 가시성을
 * EFFECT_TAIL 기준으로 토글한다. age와 계속 진행 여부(alive)를 돌려준다.
 */
function tickEffectGroup(group: Group | null, bornAt: number, durMs: number) {
  const age = (gameNowMs() - bornAt) / durMs;
  if (group) group.visible = age <= EFFECT_TAIL;
  return { age, alive: age <= EFFECT_TAIL };
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
  isSwimming,
  yarrBurst,
  splashAt,
  swimSplashAt,
  launchAt,
  comboBreakAt,
  crocSnapAt,
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
    const rangeBuff = buffs.find((b) => b.type === "rangeUp");
    const rangeBonus = rangeBuff ? BUFF.RANGE_MULT : 1;
    const rangeBlink =
      rangeBuff && rangeBuff.remaining < 2
        ? Math.sin(gameNowMs() * 0.02) > 0
        : false;
    // rangeUp은 최댓값만 확장 — 최솟값은 그대로
    const d = Math.max(
      JUMP.MIN_DISTANCE,
      Math.min(JUMP.MAX_DISTANCE * rangeBonus, chargeDist),
    );
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
      mat.color.set(rangeBuff ? "#ffd84d" : "#fff5b0");
      mat.opacity = rangeBlink ? 0.18 + 0.2 * fade : 0.35 + 0.5 * fade;
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
          renderOrder={60}
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
        const age = (gameNowMs() - p.bornAt) / 900;
        const y = 0.35;
        const opacity = Math.max(0, 1 - age);
        const popScale = popupPopScale(p.type, age);
        return (
          <PopupText
            key={p.id}
            popup={p}
            y={y}
            opacity={opacity}
            popScale={popScale}
          />
        );
      })}

      <SwimWake active={isSwimming} x={frogX} z={frogZ} />
      {yarrBurst ? <YarrBurst burst={yarrBurst} /> : null}
      {splashAt ? <SplashEffect splash={splashAt} /> : null}
      {swimSplashAt ? <SplashEffect key={swimSplashAt.bornAt} splash={swimSplashAt} /> : null}
      {launchAt ? <LaunchEffect key={launchAt.bornAt} launch={launchAt} /> : null}
      {comboBreakAt ? <ComboBreak key={comboBreakAt.bornAt} brk={comboBreakAt} /> : null}
      {crocSnapAt ? <CrocSnapEffect snap={crocSnapAt} /> : null}
    </group>
  );
}

function PopupText({
  popup,
  y,
  opacity,
  popScale,
}: {
  popup: JudgmentPopup;
  y: number;
  opacity: number;
  popScale: number;
}) {
  const [fontReady, setFontReady] = useState(false);
  const texture = useMemo(
    () => createPopupTexture(popup.text, popupColor(popup.type)),
    [fontReady, popup.text, popup.type],
  );

  useEffect(() => {
    if (!document.fonts) return;

    let cancelled = false;
    document.fonts.load('900 44px "Galmuri11"').then(() => {
      if (!cancelled) setFontReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite
      position={[popup.position[0], popup.position[1] + y, popup.position[2]]}
      scale={[
        (2.4 + popup.text.length * 0.08) * popScale,
        0.62 * popScale,
        1,
      ]}
    >
      <spriteMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthTest={false}
      />
    </sprite>
  );
}

function createPopupTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 44px "Galmuri11", "Press Start 2P", "DungGeunMo", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // pixel-art drop shadow — hard offset, no blur
    ctx.fillStyle = "rgba(18, 10, 6, 0.65)";
    ctx.fillText(text, cx + 3, cy + 4);

    // main text
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function popupPopScale(type: string, age: number) {
  const strength = type === "Yarr" ? 0.45 : type === "Great" ? 0.22 : type === "Chomp" ? 0.6 : 0;
  if (strength === 0 || age >= 0.32) return 1;

  const t = age / 0.32;
  const wave = Math.sin(t * Math.PI);
  return 1 + wave * strength;
}

function YarrBurst({ burst }: { burst: { x: number; z: number; bornAt: number } }) {
  const age = (gameNowMs() - burst.bornAt) / 1000;
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
    case "Yarr":   return "#ffd84d";
    case "Great":  return "#7df2a1";
    case "NotBad": return "#cccccc";
    case "Chomp":  return "#ff8c00";
    default:       return "#ff6a6a";
  }
}

// 실제 중력(9.8 m/s²) 기반. age는 0→1 / SPLASH_DUR ms.
// y = v0 * tSec - 0.5 * 9.8 * tSec²  (tSec = age * SPLASH_DUR/1000)
const _S = SPLASH_DUR / 1000; // seconds per age-unit
const DROP_PARAMS = [
  // 큰 중앙 물방울 — 높이 ~1.4m
  ...Array.from({ length: 6 }, (_, i) => ({
    angle: (i / 6) * Math.PI * 2,
    horiz: 0.7 + i * 0.18,
    v0: 5.2 + (i % 3) * 0.5,
    r: 0.10,
    col: i % 2 === 0 ? "#e8f8ff" : "#aee9ff",
  })),
  // 중간 물방울 — 높이 ~0.8m
  ...Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * Math.PI * 2 + 0.31,
    horiz: 1.4 + (i % 4) * 0.4,
    v0: 3.8 + (i % 4) * 0.4,
    r: 0.065,
    col: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#7ecef4" : "#a8d8ea",
  })),
  // 잔물결 스프레이 — 넓게 퍼짐
  ...Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2 + 0.6,
    horiz: 2.2 + (i % 3) * 0.6,
    v0: 2.2 + (i % 3) * 0.5,
    r: 0.038,
    col: "#b3e8f7",
  })),
];

function SplashEffect({ splash }: { splash: { x: number; z: number; bornAt: number } }) {
  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh>(null);
  const flashMatRef = useRef<MeshBasicMaterial>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const dropRefs = useRef<(Mesh | null)[]>([]);
  const dropMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const NUM_DROPS = DROP_PARAMS.length;

  useFrame(() => {
    const { age, alive } = tickEffectGroup(groupRef.current, splash.bornAt, SPLASH_DUR);
    if (!alive) return;

    const tSec = age * _S;

    // 임팩트 플래시 (0~0.18 age)
    if (flashRef.current && flashMatRef.current) {
      const ft = age / 0.18;
      flashRef.current.scale.setScalar(1 + ft * 3.5);
      flashMatRef.current.opacity = Math.max(0, (1 - ft) * 0.88);
    }

    // 물결 링 (각 링 순차 등장)
    for (let i = 0; i < SPLASH_RINGS; i++) {
      const m = ringRefs.current[i];
      const mat = ringMatRefs.current[i];
      if (!m || !mat) continue;
      const delay = i * 0.12;
      const t = Math.min(1, Math.max(0, age - delay) / (1 - delay));
      m.scale.setScalar(0.15 + t * (4.5 + i * 1.4));
      mat.opacity = Math.max(0, (1 - t * t) * (0.7 - i * 0.12));
    }

    // 물방울 (실제 중력 물리)
    for (let i = 0; i < NUM_DROPS; i++) {
      const d = dropRefs.current[i];
      const mat = dropMatRefs.current[i];
      if (!d || !mat) continue;
      const { angle, horiz, v0 } = DROP_PARAMS[i];
      const y = Math.max(0, v0 * tSec - 4.9 * tSec * tSec);
      d.position.set(
        splash.x + Math.cos(angle) * horiz * tSec,
        y,
        splash.z + Math.sin(angle) * horiz * tSec,
      );
      d.visible = y > 0.015 || age < 0.06;
      mat.opacity = Math.max(0, 1 - age / 0.85);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 임팩트 플래시 디스크 */}
      <mesh
        ref={flashRef}
        position={[splash.x, 0.06, splash.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="#ffffff"
          transparent
          opacity={0.88}
          depthWrite={false}
        />
      </mesh>

      {/* 물결 링 */}
      {Array.from({ length: SPLASH_RINGS }).map((_, i) => (
        <mesh
          key={`sr${i}`}
          ref={(el) => { ringRefs.current[i] = el; }}
          position={[splash.x, 0.05 + i * 0.01, splash.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.08, 0.20, 36]} />
          <meshBasicMaterial
            ref={(m) => { ringMatRefs.current[i] = m; }}
            color={i === 0 ? "#d0f4ff" : "#7ecef4"}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 물방울 */}
      {DROP_PARAMS.map((p, i) => (
        <mesh
          key={`sd${i}`}
          ref={(el) => { dropRefs.current[i] = el; }}
          position={[splash.x, 0, splash.z]}
        >
          <sphereGeometry args={[p.r, 6, 4]} />
          <meshBasicMaterial
            ref={(m) => { dropMatRefs.current[i] = m; }}
            color={p.col}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

const SPIKE_PARAMS = Array.from({ length: CROC_SPIKES }, (_, i) => ({
  angle: (i / CROC_SPIKES) * Math.PI * 2,
  maxDist: 1.1 + (i % 3) * 0.3,
  col: i % 3 === 0 ? "#ff8800" : i % 3 === 1 ? "#ffcc00" : "#ff4400",
  scaleX: 0.22 + (i % 4) * 0.05,
}));

function CrocSnapEffect({ snap }: { snap: { x: number; z: number; bornAt: number } }) {
  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh>(null);
  const flashMatRef = useRef<MeshBasicMaterial>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const spikeRefs = useRef<(Mesh | null)[]>([]);
  const spikeMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const { age, alive } = tickEffectGroup(groupRef.current, snap.bornAt, CROC_DUR);
    if (!alive) return;

    // 흰 플래시 (0~0.2)
    if (flashRef.current && flashMatRef.current) {
      const ft = age / 0.2;
      flashRef.current.scale.setScalar(1 + ft * 5);
      flashMatRef.current.opacity = Math.max(0, (1 - ft) * 0.92);
    }

    // 오렌지 충격파 링
    for (let i = 0; i < CROC_RINGS; i++) {
      const m = ringRefs.current[i];
      const mat = ringMatRefs.current[i];
      if (!m || !mat) continue;
      const delay = i * 0.14;
      const t = Math.min(1, Math.max(0, age - delay) / (1 - delay));
      m.scale.setScalar(0.15 + t * (5 + i * 1.8));
      mat.opacity = Math.max(0, (1 - t * t) * 0.72);
    }

    // 방사형 스파이크
    for (let i = 0; i < CROC_SPIKES; i++) {
      const s = spikeRefs.current[i];
      const mat = spikeMatRefs.current[i];
      if (!s || !mat) continue;
      const { angle, maxDist, scaleX } = SPIKE_PARAMS[i];
      const p = Math.min(1, age / 0.58);
      const ease = 1 - (1 - p) * (1 - p); // ease-out
      const dist = ease * maxDist;
      const y = 0.28 + Math.sin(p * Math.PI) * (0.45 + (i % 3) * 0.12);
      s.position.set(
        snap.x + Math.cos(angle) * dist,
        y,
        snap.z + Math.sin(angle) * dist,
      );
      s.scale.set(scaleX * 2.2, scaleX, scaleX);
      mat.opacity = Math.max(0, 1 - age / 0.78);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 임팩트 플래시 */}
      <mesh
        ref={flashRef}
        position={[snap.x, 0.12, snap.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="#ffffff"
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>

      {/* 충격파 링 */}
      {Array.from({ length: CROC_RINGS }).map((_, i) => (
        <mesh
          key={`cr${i}`}
          ref={(el) => { ringRefs.current[i] = el; }}
          position={[snap.x, 0.1 + i * 0.03, snap.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.08, 0.2, 32]} />
          <meshBasicMaterial
            ref={(m) => { ringMatRefs.current[i] = m; }}
            color={i === 0 ? "#ff8800" : "#ffcc00"}
            transparent
            opacity={0.72}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 방사형 스파이크 */}
      {SPIKE_PARAMS.map((p, i) => (
        <mesh
          key={`cs${i}`}
          ref={(el) => { spikeRefs.current[i] = el; }}
          position={[snap.x, 0.28, snap.z]}
          rotation={[0, -p.angle, Math.PI / 4]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            ref={(m) => { spikeMatRefs.current[i] = m; }}
            color={p.col}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// ──────── 점프 발사 이펙트 (도약 순간 물 차고 오름) ────────
const LAUNCH_DUR = 520;
const LAUNCH_DROPS = 8;
const LAUNCH_DROP_PARAMS = Array.from({ length: LAUNCH_DROPS }, (_, i) => ({
  angle: (i / LAUNCH_DROPS) * Math.PI * 2 + 0.25,
  horiz: 1.0 + (i % 3) * 0.35,
  v0: 2.4 + (i % 3) * 0.55,
  r: 0.05 + (i % 2) * 0.02,
}));

function LaunchEffect({ launch }: { launch: { x: number; z: number; bornAt: number } }) {
  const groupRef = useRef<Group>(null);
  const dropRefs = useRef<(Mesh | null)[]>([]);
  const dropMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const { age, alive } = tickEffectGroup(groupRef.current, launch.bornAt, LAUNCH_DUR);
    if (!alive) return;
    const tSec = age * (LAUNCH_DUR / 1000);

    // 발 차고 오르며 튀어오르는 물방울 (중력 낙하) — 동심원 물살은 연잎(LilyPad)이 담당
    for (let i = 0; i < LAUNCH_DROPS; i++) {
      const d = dropRefs.current[i];
      const mat = dropMatRefs.current[i];
      if (!d || !mat) continue;
      const { angle, horiz, v0 } = LAUNCH_DROP_PARAMS[i];
      const y = Math.max(0, v0 * tSec - 4.9 * tSec * tSec);
      d.position.set(
        launch.x + Math.cos(angle) * horiz * tSec,
        y,
        launch.z + Math.sin(angle) * horiz * tSec,
      );
      d.visible = y > 0.01;
      mat.opacity = Math.max(0, 1 - age / 0.8);
    }
  });

  return (
    <group ref={groupRef}>
      {LAUNCH_DROP_PARAMS.map((p, i) => (
        <mesh
          key={`ld${i}`}
          ref={(el) => { dropRefs.current[i] = el; }}
          position={[launch.x, 0, launch.z]}
        >
          <sphereGeometry args={[p.r, 5, 4]} />
          <meshBasicMaterial
            ref={(m) => { dropMatRefs.current[i] = m; }}
            color="#bfeeff"
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

// ──────── 수영 항적 (헤엄칠 때 뒤로 남는 물살) ────────
const SWIM_WAKE_N = 16;         // 링 풀 크기 (간격이 좁아진 만큼 늘려 수명 보장)
const SWIM_WAKE_LIFE = 750;     // 각 링 수명(ms)
const SWIM_WAKE_INTERVAL = 50;  // 링 방출 간격(ms) — 더 촘촘하게
const SWIM_WAKE_Y = 0.06;       // 수면 높이

function SwimWake({ active, x, z }: { active: boolean; x: number; z: number }) {
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  // 각 링이 "떨어진" 자리와 시각 (제자리에서 퍼지며 사라짐 → 항적처럼 뒤에 남음)
  const drops = useRef(
    Array.from({ length: SWIM_WAKE_N }, () => ({ x: 0, z: 0, bornAt: -1e9 })),
  );
  const lastDrop = useRef(0);
  const cursor = useRef(0);

  useFrame(() => {
    const now = gameNowMs();
    // 헤엄 중에는 일정 간격으로 현재 위치에 새 물살 링을 떨어뜨린다
    if (active && now - lastDrop.current >= SWIM_WAKE_INTERVAL) {
      lastDrop.current = now;
      const slot = drops.current[cursor.current % SWIM_WAKE_N];
      slot.x = x;
      slot.z = z;
      slot.bornAt = now;
      cursor.current++;
    }
    for (let i = 0; i < SWIM_WAKE_N; i++) {
      const m = ringRefs.current[i];
      const mat = ringMatRefs.current[i];
      const d = drops.current[i];
      if (!m || !mat) continue;
      const age = (now - d.bornAt) / SWIM_WAKE_LIFE;
      if (age < 0 || age > 1) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(d.x, SWIM_WAKE_Y, d.z);
      const s = 0.25 + age * 0.85; // 제자리에서 퍼짐
      m.scale.set(s, s, s);
      mat.opacity = (1 - age) * (1 - age) * 0.42;
    }
  });

  return (
    <group>
      {Array.from({ length: SWIM_WAKE_N }).map((_, i) => (
        <mesh
          key={`wake${i}`}
          ref={(el) => { ringRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.62, 0.8, 20]} />
          <meshBasicMaterial
            ref={(m) => { ringMatRefs.current[i] = m; }}
            color="#dff4ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ──────── 콤보 끊김 이펙트 (쌓인 콤보가 리셋될 때 회색 조각이 흩어져 떨어짐) ────────
const BREAK_DUR = 850;
const BREAK_SHARDS = 14;
const BREAK_SHARD_PARAMS = Array.from({ length: BREAK_SHARDS }, (_, i) => ({
  angle: (i / BREAK_SHARDS) * Math.PI * 2 + 0.3,
  horiz: 1.1 + (i % 4) * 0.4, // 바깥으로 흩어지는 속도
  v0: 1.9 + (i % 3) * 0.6, // 처음 더 높이 튀어오름
  scale: 0.08 + (i % 3) * 0.03, // 조각 크기
  spin: (i % 2 === 0 ? 1 : -1) * (3 + (i % 3)),
}));

function ComboBreak({ brk }: { brk: { x: number; z: number; bornAt: number } }) {
  const groupRef = useRef<Group>(null);
  const flashRef = useRef<Mesh>(null);
  const flashMatRef = useRef<MeshBasicMaterial>(null);
  const shardRefs = useRef<(Mesh | null)[]>([]);
  const shardMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const { age, alive } = tickEffectGroup(groupRef.current, brk.bornAt, BREAK_DUR);
    if (!alive) return;
    const tSec = age * (BREAK_DUR / 1000);

    // 시작 순간 회색 플래시 — 콤보가 깨지는 타이밍을 확실히 알림
    if (flashRef.current && flashMatRef.current) {
      const ft = age / 0.22;
      flashRef.current.scale.setScalar(1 + ft * 4.5);
      flashMatRef.current.opacity = Math.max(0, (1 - ft) * 0.8);
    }

    // 회색 조각 — 살짝 튀었다 중력으로 떨어지며 흩어짐 (콤보가 깨져 떨어지는 느낌)
    for (let i = 0; i < BREAK_SHARDS; i++) {
      const s = shardRefs.current[i];
      const mat = shardMatRefs.current[i];
      if (!s || !mat) continue;
      const { angle, horiz, v0, scale, spin } = BREAK_SHARD_PARAMS[i];
      const y = 0.5 + v0 * tSec - 5.0 * tSec * tSec; // 위로 튀었다 낙하
      s.position.set(
        brk.x + Math.cos(angle) * horiz * tSec,
        Math.max(0.02, y),
        brk.z + Math.sin(angle) * horiz * tSec,
      );
      s.rotation.set(age * spin, age * spin * 0.7, age * spin);
      s.scale.setScalar(scale);
      mat.opacity = Math.max(0, 1 - age / 0.92);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 시작 플래시 */}
      <mesh
        ref={flashRef}
        position={[brk.x, 0.4, brk.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.5, 20]} />
        <meshBasicMaterial
          ref={flashMatRef}
          color="#8b979d"
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      {/* 부서져 떨어지는 조각 (어두운 회색) */}
      {BREAK_SHARD_PARAMS.map((_, i) => (
        <mesh
          key={`brk${i}`}
          ref={(el) => { shardRefs.current[i] = el; }}
          position={[brk.x, 0.5, brk.z]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            ref={(m) => { shardMatRefs.current[i] = m; }}
            color={i % 2 === 0 ? "#828f96" : "#525d63"}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
