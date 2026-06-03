import { useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLORS, LILY, WORLD } from "./constants";
import { isBlinkVisible, movingPadOffset } from "./CollisionSystem";
import type { LilyPadData } from "./types";

const CROC_PUSH_RADIUS = 2.5;
const CROC_PUSH_MAX    = 2.0;

// 점프 발사 출렁 반동 — 물이 잦아들듯, 처음엔 크고 느리게 출렁이다
// 점점 진폭은 줄고 주파수는 빨라진다(chirp).
const LAUNCH_BOUNCE_DUR = 1.5;  // 초 (천천히 오래 출렁)
const LAUNCH_DIP = 0.17;        // 최초 눌림 깊이(m)
const LAUNCH_FREQ0 = 3.4;       // 시작 각주파수 (느릿한 첫 출렁)
const LAUNCH_FREQ_RAMP = 7;     // 시간당 주파수 증가 (완만하게 빨라짐)
const LAUNCH_DECAY = 3.0;       // 진폭 감쇠 (천천히 잦아듦)

// 출렁에 따른 주변 물살 링 — 수면에 동심원으로 퍼졌다 잦아든다
const SLOSH_RING_N = 4;         // 동시에 존재하는 링 수
const SLOSH_RING_DUR = 1.5;     // 물살 지속 (출렁과 동일)
const SLOSH_RING_PERIOD = 1.05; // 링 하나가 끝까지 퍼지는 시간 (느리게)
const SLOSH_RING_EXPAND = 1.5;  // 최대 확장 (pad 반경 배수) — 더 작게
const SLOSH_RING_FADE = 1.9;    // 전체 감쇠율

/** 점프 발사 출렁 반동의 수직 오프셋(m). elapsed = launchAt 이후 경과(초).
 *  연잎(LilyPad)과 그 위 개구리(Frog)가 같은 값으로 함께 까딱이도록 공유한다. */
export function launchBounceY(elapsed: number): number {
  if (elapsed < 0 || elapsed >= LAUNCH_BOUNCE_DUR) return 0;
  const decay = Math.exp(-elapsed * LAUNCH_DECAY);
  const phase = LAUNCH_FREQ0 * elapsed + 0.5 * LAUNCH_FREQ_RAMP * elapsed * elapsed;
  return -LAUNCH_DIP * Math.sin(phase) * decay;
}

interface Props {
  pad: LilyPadData;
  now: number;
  highlight?: boolean;
  /** 조준 방향이 향하는 후보 연잎 여부 — 은은한 외곽 글로우/파문 표시 */
  isCandidate?: boolean;
  crocRef?: MutableRefObject<{ x: number; z: number }>;
}

/**
 * 다양화된 연잎.
 *
 *  - 팔각형 얇은 디스크 + 한쪽이 살짝 파인 잎맥 표현
 *  - 색상/크기/회전을 pad 단위로 미세하게 다르게
 *  - 흰 파편 테두리 폐기 → 얇은 픽셀 물결 링 (rippleAt 트리거 시 잠깐 보임)
 *  - 특수 타입별 명확한 비주얼 (삭은/미끄러운/이동/회전/함정/탄성/점멸)
 */
export default function LilyPad({ pad, now, highlight, isCandidate, crocRef }: Props) {
  const ref = useRef<Group>(null);
  const rippleRef = useRef<Mesh>(null);
  const rippleMatRef = useRef<MeshBasicMaterial>(null);
  const candidateRingRef = useRef<Mesh>(null);
  const candidateRingMatRef = useRef<MeshBasicMaterial>(null);
  const pushOffsetRef = useRef(0);
  // 출렁 물살 링 (연잎과 별개로 수면에 남는 동심원)
  const sloshGroupRef = useRef<Group>(null);
  const sloshRefs = useRef<(Mesh | null)[]>([]);
  const sloshMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);

  // pad 단위 의사난수
  const rnd = useMemo(() => {
    const seed = pad.id * 2654435761;
    return (k: number) => {
      const x = Math.sin(seed + k * 9991) * 10000;
      return x - Math.floor(x);
    };
  }, [pad.id]);

  // 종류별 비주얼 결정
  const visual = useMemo(() => {
    const baseTint = rnd(7); // 0..1 → 같은 종류라도 미세 색차이
    const tweak = (a: number, b: number) => a + (b - a) * baseTint;
    switch (pad.type) {
      case "rotten":
        return {
          top: `rgb(${156 + Math.floor(rnd(1) * 16)}, ${130 + Math.floor(rnd(2) * 20)}, ${68})`,
          rim: "#6b5736",
          spots: true,
          shimmer: false,
        };
      case "slippery":
        return {
          top: `rgb(${170 + Math.floor(rnd(1) * 20)}, ${235 + Math.floor(rnd(2) * 15)}, ${230 + Math.floor(rnd(3) * 16)})`,
          rim: "#7dd3e0",       // 더 밝은 민트
          spots: false,
          shimmer: true,
        };

      case "moving":
        return {
          top: "#5a8fd8",       // 더 진한 블루
          rim: "#2a4a8a",       // 더 진한 네이비
          spots: false,
          shimmer: false,
        };
      case "rotating":
        return {
          top: "#f5d36e",
          rim: "#a87e26",
          spots: false,
          shimmer: false,
        };
      case "trap":
        return {
          top: "#e35f6f",
          rim: "#9a2a3a",
          spots: false,
          shimmer: false,
        };
      case "spring":
        return {
          top: "#c8ff5e",
          rim: "#5a9020",
          spots: false,
          shimmer: false,
        };
      case "blinking":
        return {
          top: "#d6ee8a",
          rim: "#9eb84a",
          spots: false,
          shimmer: true,
        };
      default: {
        // basic — 약간씩 다른 초록색
        const r = 110 + Math.floor(tweak(0, 18));
        const g = 200 + Math.floor(tweak(-12, 20));
        const b = 90 + Math.floor(tweak(-10, 16));
        return {
          top: `rgb(${r}, ${g}, ${b})`,
          rim: `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 70)}, ${Math.max(0, b - 50)})`,
          spots: false,
          shimmer: false,
        };
      }
    }
  }, [pad.type, rnd]);

  // 잎맥 위치 — 한쪽에 작은 V자 홈을 표현
  const veinAngle = useMemo(() => rnd(11) * Math.PI * 2, [rnd]);

  const radius = pad.radius * (pad.visualScale ?? 1) * 0.95;
  const padThickness = 0.14;
  const decoScale = pad.radius / LILY.RADIUS;

  useFrame((_, delta) => {
    if (!ref.current) return;
    const t = now - pad.spawnTime;
    let x = pad.position[0];
    let z = pad.position[2];
    let y = WORLD.PAD_TOP_Y - 0.22;

    // 점프 발사 출렁 — 떠난 직후 쑥 눌렸다 감쇠 진동하며 복귀 (개구리도 같은 함수로 까딱)
    const launchY = pad.launchAt != null ? launchBounceY(now - pad.launchAt) : 0;
    let launchSquash = 0;
    if (pad.launchAt != null) {
      const elapsed = now - pad.launchAt;
      if (elapsed >= 0 && elapsed < LAUNCH_BOUNCE_DUR) {
        const decay = Math.exp(-elapsed * LAUNCH_DECAY);
        const phase =
          LAUNCH_FREQ0 * elapsed + 0.5 * LAUNCH_FREQ_RAMP * elapsed * elapsed;
        launchSquash = 0.14 * Math.abs(Math.sin(phase)) * decay;
      }
    }

    if (pad.type === "moving") {
      const offset = movingPadOffset(pad, now);
      if (pad.axis === "x") x += offset;
      else z += offset;
    }
    if (pad.type === "blinking" && pad.swimShrinkAt != null) {
      // 수영 복귀 점멸 연잎: swimShrinkAt 이후 삭은 연잎과 동일하게 줄어듦
      const shrinkElapsed = now - pad.swimShrinkAt;
      const k = Math.max(0, 1 - shrinkElapsed / LILY.ROTTEN_LIFETIME);
      ref.current.scale.set(k, k, k);
      y -= (1 - k) * 0.3;
    } else if (pad.type === "blinking" && pad.steppedAt == null) {
      const s = isBlinkVisible(pad, now) ? 1 : 0.001;
      ref.current.scale.set(s, s, s);
    } else if (pad.type === "rotten" && pad.steppedAt != null) {
      const aliveAfterStep = now - pad.steppedAt;
      const k = Math.max(0, 1 - aliveAfterStep / LILY.ROTTEN_LIFETIME);
      ref.current.scale.set(k, k, k);
      y -= (1 - k) * 0.3;
    } else {
      ref.current.scale.set(1, 1, 1);
    }
    // 출렁 스쿼시 — 눌릴 때 납작해지고 넓어짐 (기존 스케일에 곱)
    if (launchSquash > 0.001) {
      ref.current.scale.set(
        ref.current.scale.x * (1 + launchSquash * 0.6),
        ref.current.scale.y * (1 - launchSquash),
        ref.current.scale.z * (1 + launchSquash * 0.6),
      );
    }
    const baseRot = pad.visualRotation ?? 0;
    if (pad.type === "rotating") {
      const dir = pad.rotationDirection ?? 1;
      ref.current.rotation.y = baseRot + t * 1.0 * dir;  // 한쪽 방향으로 계속 회전
    
    } else {
      ref.current.rotation.y = baseRot;
    }
    // 가벼운 부유감
    y += Math.sin(t * 1.4 + pad.id) * 0.012;
    // 점프 발사 출렁 반동
    y += launchY;

    // 악어가 지나갈 때 Z축으로 밀려남 (복귀 없음 — 더 많이 밀릴 때만 갱신)
    if (crocRef?.current) {
      const dz = pad.position[2] - crocRef.current.z;
      const dist = Math.hypot(pad.position[0] - crocRef.current.x, dz);
      if (dist < CROC_PUSH_RADIUS) {
        const pushDir = Math.abs(dz) > 0.08 ? Math.sign(dz) : (pad.id % 2 === 0 ? 1 : -1);
        const forcePush = pushDir * (1 - dist / CROC_PUSH_RADIUS) * CROC_PUSH_MAX;
        // 현재보다 더 멀리 밀릴 때만 lerp — 돌아오는 일 없음
        if (Math.abs(forcePush) > Math.abs(pushOffsetRef.current)) {
          pushOffsetRef.current += (forcePush - pushOffsetRef.current) * (1 - Math.exp(-7 * delta));
        }
      }
      z += pushOffsetRef.current;
    }

    ref.current.position.set(x, y, z);

    // 착지 파문 표시
    if (rippleRef.current && rippleMatRef.current) {
      const rippleSince = pad.rippleAt != null ? now - pad.rippleAt : Infinity;
      if (rippleSince < 0.6) {
        const p = rippleSince / 0.6;
        rippleRef.current.visible = true;
        const s = 1 + p * 0.6;
        rippleRef.current.scale.set(s, s, s);
        rippleMatRef.current.opacity = (1 - p) * 0.6;
      } else {
        rippleRef.current.visible = false;
      }
    }

    // 후보 연잎 — 천천히 펄스하는 은은한 외곽 링
    if (candidateRingRef.current && candidateRingMatRef.current) {
      if (isCandidate) {
        const pulse = (Math.sin(now * 3.5) + 1) * 0.5; // 0..1
        candidateRingRef.current.visible = true;
        const s = 1 + pulse * 0.08;
        candidateRingRef.current.scale.set(s, 1, s);
        candidateRingMatRef.current.opacity = 0.22 + pulse * 0.28;
      } else {
        candidateRingRef.current.visible = false;
      }
    }

    // 출렁 물살 링 — 발사 후 수면에 동심원으로 퍼졌다 잦아든다.
    // 연잎(ref)과 달리 출렁이지 않고 수면 높이에 머무르며, 연잎 x/z만 따라간다.
    if (sloshGroupRef.current) {
      const elapsed = pad.launchAt != null ? now - pad.launchAt : Infinity;
      if (elapsed >= 0 && elapsed < SLOSH_RING_DUR) {
        sloshGroupRef.current.visible = true;
        // 수면 높이(연잎 안착 레벨 부근)에 고정 — 출렁 y는 더하지 않는다
        sloshGroupRef.current.position.set(x, WORLD.PAD_TOP_Y - 0.22 + 0.02, z);
        const env = Math.exp(-elapsed * SLOSH_RING_FADE); // 시간이 갈수록 전체적으로 옅게
        for (let i = 0; i < SLOSH_RING_N; i++) {
          const m = sloshRefs.current[i];
          const mat = sloshMatRefs.current[i];
          if (!m || !mat) continue;
          const local = elapsed - i * (SLOSH_RING_PERIOD / SLOSH_RING_N);
          if (local <= 0) {
            m.visible = false;
            continue;
          }
          const cyc = (local / SLOSH_RING_PERIOD) % 1; // 0→1 확장 반복
          const s = radius * (1 + cyc * SLOSH_RING_EXPAND);
          m.visible = true;
          m.scale.set(s, s, s);
          // 퍼질수록(테두리로 갈수록) + 시간이 갈수록 옅어짐
          mat.opacity = (1 - cyc) * (1 - cyc) * 0.42 * env;
        }
      } else {
        sloshGroupRef.current.visible = false;
      }
    }
  });

  return (
    <>
    <group ref={ref} position={pad.position}>
      {/* 얇은 픽셀 물결 링 — 평상시엔 거의 안 보일 정도로 옅음 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, padThickness * 0.5 - 0.06, 0]}
      >
        <ringGeometry args={[radius * 1.02, radius * 1.12, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>

      {/* 착지 파문 — rippleAt 트리거 시 잠깐 커졌다 사라짐 */}
      <mesh
        ref={rippleRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, padThickness * 0.5 - 0.05, 0]}
        visible={false}
      >
        <ringGeometry args={[radius * 1.05, radius * 1.32, 16]} />
        <meshBasicMaterial ref={rippleMatRef} color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* 후보 연잎 — 은은한 펄스 링 (환경 반응처럼) */}
      <mesh
        ref={candidateRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, padThickness * 0.5 - 0.04, 0]}
        visible={false}
      >
        <ringGeometry args={[radius * 1.04, radius * 1.16, 8]} />
        <meshBasicMaterial
          ref={candidateRingMatRef}
          color="#fff7c8"
          transparent
          opacity={0}
        />
      </mesh>

      {/* 림 (진한 색) */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, padThickness * 0.5, 8]} />
        <meshStandardMaterial color={visual.rim} roughness={1} />
      </mesh>

      {/* 윗면 (밝은 색) — 살짝 작게 올려 단차 느낌 */}
      <mesh castShadow position={[0, padThickness * 0.45, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, padThickness * 0.5, 8]} />
        <meshStandardMaterial color={visual.top} roughness={1} />
      </mesh>

      {/* 잎맥 — 한쪽 가장자리에 V자 작은 홈 (어두운 작은 박스) */}
      <mesh
        position={[
          Math.cos(veinAngle) * radius * 0.55,
          padThickness * 0.72,
          Math.sin(veinAngle) * radius * 0.55,
        ]}
        rotation={[0, veinAngle, 0]}
      >
        <boxGeometry args={[radius * 0.55, 0.04, 0.06]} />
        <meshStandardMaterial color={visual.rim} roughness={1} />
      </mesh>

      {/* 빛 받는 하이라이트 (한쪽으로 약간 옮긴 밝은 패치) */}
      <mesh
        position={[
          Math.cos(veinAngle + Math.PI) * radius * 0.18,
          padThickness * 0.73,
          Math.sin(veinAngle + Math.PI) * radius * 0.18,
        ]}
      >
        <boxGeometry args={[radius * 0.5, 0.03, radius * 0.5]} />
        <meshStandardMaterial color={"#d2f4a8"} roughness={1} />
      </mesh>

      {/* 삭은 연잎 반점 */}
      {visual.spots && (
        <>
          <mesh position={[radius * 0.3, padThickness * 0.78, 0.1 * decoScale]}>
            <boxGeometry args={[0.18 * decoScale, 0.03 * decoScale, 0.18 * decoScale]} />
          </mesh>
          <mesh position={[-radius * 0.2, padThickness * 0.78, -0.25 * decoScale]}>
            <boxGeometry args={[0.14 * decoScale, 0.03 * decoScale, 0.14 * decoScale]} />
          </mesh>
        </>
      )}

      {/* 미끄러운 반짝임 */}
      {visual.shimmer && (
        <mesh position={[radius * 0.18, padThickness * 0.8, -radius * 0.18]}>
          <boxGeometry args={[0.16 * decoScale, 0.02 * decoScale, 0.1 * decoScale]} />
        </mesh>
      )}
      {/* Yarr 중앙 표시 — 함정 제외 */}
      {pad.type !== "trap" && (
        <mesh position={[0, padThickness * 0.75 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[LILY.YARR_THRESHOLD * 0.8, 10]} />
          <meshBasicMaterial
            color={highlight ? "#fff39a" : "#ffffff"}
            transparent
            opacity={highlight ? 0.5 : 0.1}
          />
        </mesh>
      )}

      {/* 함정 식충식물 */}
      {pad.type === "trap" && (
        <group position={[0, padThickness, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(a) * 0.32 * decoScale,
                  0.18 * decoScale,
                  Math.sin(a) * 0.32 * decoScale,
                ]}
              >
                <coneGeometry args={[0.1 * decoScale, 0.42 * decoScale, 4]} />
                <meshStandardMaterial color="#5a0a14" />
              </mesh>
            );
          })}
          <mesh position={[0, 0.05 * decoScale, 0]}>
            <boxGeometry args={[0.42 * decoScale, 0.05 * decoScale, 0.42 * decoScale]} />
            <meshStandardMaterial color={"#3a0a14"} />
          </mesh>
        </group>
      )}

      {/* 트램펄린 — 두꺼운 볼륨 + 링 */}
      {pad.type === "spring" && (
        <>
          <mesh position={[0, padThickness * 1.1, 0]}>
            <cylinderGeometry args={[radius * 0.7, radius * 0.85, 0.18 * decoScale, 8]} />
            {/*                                                   ^^^^^^^^^^^^^^^^ 추가 */}
            <meshStandardMaterial color={"#a8e833"} roughness={1} />
          </mesh>
          <mesh position={[0, padThickness * 1.3, 0]}>
            <torusGeometry args={[0.3 * decoScale, 0.06 * decoScale, 5, 8]} />
            {/*                  ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^ 추가 */}
            <meshStandardMaterial color={"#ffffff"} emissive={"#ff9ada"} emissiveIntensity={0.3} />
          </mesh>
        </>
      )}

      {/* 회전 연잎 잎맥 패턴 — 중앙 작은 큐브 */}
      {pad.type === "rotating" && (
        <mesh position={[0, padThickness * 0.85, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.6 * decoScale, 0.04 * decoScale, 0.12 * decoScale]} />
          {/*                  ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 추가 */}
          <meshStandardMaterial color={"#8a6020"} roughness={1} />
        </mesh>
      )}

      {/* 이동형 - 아래 작은 물살 표시 */}
      {pad.type === "moving" && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 0.9, radius * 1.2, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>
      )}
    </group>

    {/* 출렁 물살 링 — 연잎과 별개로 수면에 남는 동심원 (단위 반경 1, scale로 확장) */}
    <group ref={sloshGroupRef} visible={false}>
      {Array.from({ length: SLOSH_RING_N }).map((_, i) => (
        <mesh
          key={`slosh${i}`}
          ref={(el) => { sloshRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.9, 1.0, 28]} />
          <meshBasicMaterial
            ref={(m) => { sloshMatRefs.current[i] = m; }}
            color="#dff4ff"
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
