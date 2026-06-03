import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CanvasTexture } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLORS } from "./constants";
import { birdLiveZ } from "./CollisionSystem";
import type { EnemyData } from "./types";

// 물고기 체절별 굽힘 위상/각도 (머리→꼬리)
const FISH_SEG_PHASE = [0, 0.4, 0.8, 1.3];
const FISH_SEG_ANGLE = [0, 0.12, 0.18, 0.26];

interface Props {
  enemies: EnemyData[];
  now: number;
}

/**
 * 물고기 / 새 / 환경 장애물 렌더러.
 * 각 적은 단순한 모양만 그리고, 위치 갱신은 매 프레임 ref로 처리한다.
 */
export default function EnemyManager({ enemies, now }: Props) {
  return (
    <group>
      {enemies.map((e) => (
        <EnemyView key={e.id} enemy={e} now={now} />
      ))}
    </group>
  );
}

function EnemyView({ enemy, now }: { enemy: EnemyData; now: number }) {
  const ref = useRef<Group>(null);
  const segRefs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    if (!ref.current) return;
    const t = now - enemy.spawnTime;
    if (enemy.type === "fish") {
      // 평소엔 물 평면(y=-0.5) 아래로 완전히 잠겨 보이지 않고(거품·음파로만 위치 암시),
      // 주기적으로 수면을 뚫고 솟구쳤다 다시 잠긴다. REST_Y는 몸 최고점(+~0.49)까지
      // 수면 아래에 들어가도록 충분히 낮춘다.
      const amp = enemy.amplitude ?? 1;
      const REST_Y = -1.3;
      const leap = Math.max(0, Math.sin(t * 1.6));
      ref.current.position.y = REST_Y + leap * (amp + 1.7);
      // 솟구칠 때 머리부터 들리고 떨어질 때 머리부터 내리꽂는 포물선 자세 (높이 비례)
      ref.current.rotation.z = -Math.cos(t * 1.6) * 0.5 * Math.max(0.15, leap);
      // 몸을 마디별로 좌우 물결 (S자 헤엄)
      const segs = segRefs.current;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg) seg.rotation.y = Math.sin(t * 3.5 - FISH_SEG_PHASE[i]) * FISH_SEG_ANGLE[i];
      }
    } else if (enemy.type === "bird") {
      // 좌우 패트롤 — 충돌 판정과 동일한 공식(birdLiveZ) 공유
      ref.current.position.z = birdLiveZ(enemy, now);
      ref.current.position.y = enemy.position[1] + Math.cos(t * 1.3) * 0.2;
      // 기본적으로 개구리(-x) 쪽을 바라보게 하고, 패트롤 시 좌우로 살짝 틂
      ref.current.rotation.y = Math.PI + Math.sin(t * 1.1) * 0.4;
    }
  });

  if (enemy.type === "fish") {
    const upperTeeth = [-0.12, -0.04, 0.04, 0.12];
    const lowerTeeth = [-0.08, 0, 0.08];
    return (
      <group>
        {/* 수면 텔레그래프 — 물고기가 잠겨 있을 때 보글보글 + 음파로 위치를 알린다 */}
        <FishTelegraph enemy={enemy} now={now} />
        {/* 물고기 본체 (수면 아래로 잠겼다 솟구침) */}
        <group ref={ref} position={enemy.position}>
          {/* 머리 마디 */}
        <group ref={(el) => { segRefs.current[0] = el; }}>
          {/* 머리 */}
          <mesh position={[-0.48, 0, 0]}>
            <boxGeometry args={[0.34, 0.46, 0.38]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 매서운 눈 (양옆) — 노란 홍채 + 검은 동공 */}
          <group position={[-0.52, 0.13, 0.18]}>
            <mesh>
              <boxGeometry args={[0.13, 0.13, 0.05]} />
              <meshStandardMaterial color="#e7c83a" roughness={0.3} />
            </mesh>
            <mesh position={[-0.035, 0, 0.03]}>
              <boxGeometry args={[0.06, 0.09, 0.02]} />
              <meshStandardMaterial color="#101010" />
            </mesh>
          </group>
          <group position={[-0.52, 0.13, -0.18]}>
            <mesh>
              <boxGeometry args={[0.13, 0.13, 0.05]} />
              <meshStandardMaterial color="#e7c83a" roughness={0.3} />
            </mesh>
            <mesh position={[-0.035, 0, -0.03]}>
              <boxGeometry args={[0.06, 0.09, 0.02]} />
              <meshStandardMaterial color="#101010" />
            </mesh>
          </group>
          {/* 벌린 입 — 어두운 입 안 */}
          <mesh position={[-0.62, -0.06, 0]}>
            <boxGeometry args={[0.08, 0.12, 0.34]} />
            <meshStandardMaterial color="#14232a" />
          </mesh>
          {/* 윗니 — 위쪽, 아래로 뾰족 */}
          {upperTeeth.map((z, i) => (
            <mesh key={`up-${i}`} position={[-0.66, 0.01, z]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.035, 0.09, 4]} />
              <meshStandardMaterial color="#f2f2ea" />
            </mesh>
          ))}
          {/* 아래턱 잇몸 */}
          <mesh position={[-0.58, -0.18, 0]}>
            <boxGeometry args={[0.24, 0.1, 0.34]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 아랫니 — 아래쪽, 위로 뾰족 (엇갈림) */}
          {lowerTeeth.map((z, i) => (
            <mesh key={`low-${i}`} position={[-0.66, -0.12, z]}>
              <coneGeometry args={[0.035, 0.09, 4]} />
              <meshStandardMaterial color="#f2f2ea" />
            </mesh>
          ))}
        </group>
        {/* 앞몸통 마디 */}
        <group ref={(el) => { segRefs.current[1] = el; }} position={[-0.31, 0, 0]}>
          <mesh position={[0.12, 0, 0]}>
            <boxGeometry args={[0.44, 0.54, 0.4]} />
            <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
          </mesh>
          {/* 등지느러미 가시 (앞) */}
          <mesh position={[0.13, 0.31, 0]}>
            <coneGeometry args={[0.07, 0.17, 4]} />
            <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
          </mesh>
          {/* 뒷몸통 마디 */}
          <group ref={(el) => { segRefs.current[2] = el; }} position={[0.31, 0, 0]}>
            <mesh position={[0.2, 0, 0]}>
              <boxGeometry args={[0.42, 0.48, 0.36]} />
              <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
            </mesh>
            {/* 등지느러미 가시 (중/뒤) */}
            <mesh position={[0.0, 0.33, 0]}>
              <coneGeometry args={[0.09, 0.24, 4]} />
              <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
            </mesh>
            <mesh position={[0.2, 0.34, 0]}>
              <coneGeometry args={[0.1, 0.3, 4]} />
              <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
            </mesh>
            {/* 꼬리 마디 */}
            <group ref={(el) => { segRefs.current[3] = el; }} position={[0.3, 0, 0]}>
              <mesh position={[0.2, 0, 0]}>
                <boxGeometry args={[0.22, 0.34, 0.3]} />
                <meshStandardMaterial color={COLORS.FISH} roughness={0.5} />
              </mesh>
              <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.4]}>
                <coneGeometry args={[0.26, 0.42, 4]} />
                <meshStandardMaterial color="#2b4a5c" roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>
        </group>
      </group>
    );
  }
  if (enemy.type === "bird") {
    return (
      <>
      {/* 수면에 드리운 새 그림자 — 상공 위협의 위치를 알린다 */}
      <BirdShadow enemy={enemy} now={now} />
      <group ref={ref} position={enemy.position}>
        {/* 몸통 (갈색) */}
        <mesh>
          <boxGeometry args={[0.85, 0.5, 0.52]} />
          <meshStandardMaterial color={COLORS.BIRD} />
        </mesh>
        {/* 머리 (흰머리수리 — 흰색) */}
        <mesh position={[0.55, 0.18, 0]}>
          <boxGeometry args={[0.42, 0.42, 0.5]} />
          <meshStandardMaterial color="#f2efe6" />
        </mesh>
        {/* 부리 뿌리 (cere — 머리와 부리를 잇는 노란 피부) */}
        <mesh position={[0.74, 0.13, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.1]} />
          <meshStandardMaterial color="#f3c349" />
        </mesh>
        {/* 윗부리 — 위턱, 하나로 길게 뻗고 끝이 앞으로 모임 */}
        <group position={[0.78, 0.15, 0]} rotation={[0, 0, -0.12]}>
          <mesh position={[0.18, 0, 0]}>
            <boxGeometry args={[0.36, 0.07, 0.19]} />
            <meshStandardMaterial color="#f3c349" />
          </mesh>
        </group>
        {/* 아랫부리 — 아래턱, 윗부리보다 짧고 위로 모임 */}
        <group position={[0.78, 0.09, 0]} rotation={[0, 0, 0.06]}>
          <mesh position={[0.15, 0, 0]}>
            <boxGeometry args={[0.3, 0.06, 0.16]} />
            <meshStandardMaterial color="#d89f33" />
          </mesh>
        </group>
        {/* 눈 — 노란 홍채 + 검은 동공 */}
        <mesh position={[0.66, 0.22, 0.15]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8c43a" />
        </mesh>
        <mesh position={[0.66, 0.22, -0.15]}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#e8c43a" />
        </mesh>
        <mesh position={[0.73, 0.21, 0.15]}>
          <boxGeometry args={[0.09, 0.12, 0.1]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        <mesh position={[0.73, 0.21, -0.15]}>
          <boxGeometry args={[0.09, 0.12, 0.1]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        {/* 꼬리 (흰색) */}
        <mesh position={[-0.52, 0.08, 0]}>
          <boxGeometry args={[0.3, 0.12, 0.4]} />
          <meshStandardMaterial color="#f2efe6" />
        </mesh>
        <mesh position={[-0.74, 0.08, 0]}>
          <boxGeometry args={[0.22, 0.05, 0.52]} />
          <meshStandardMaterial color="#e6e2d6" />
        </mesh>
        {/* 다리 + 발 (노랑) */}
        <mesh position={[0.14, -0.3, 0.15]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.18, -0.41, 0.15]}>
          <boxGeometry args={[0.2, 0.06, 0.14]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.14, -0.3, -0.15]}>
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        <mesh position={[0.18, -0.41, -0.15]}>
          <boxGeometry args={[0.2, 0.06, 0.14]} />
          <meshStandardMaterial color="#e0a93a" />
        </mesh>
        {/* 날개 한 쌍 — 크게, 위아래 펄럭임 (박스) */}
        <group position={[0, 0.2, 0.22]} rotation={[-Math.sin(now * 8) * 0.5, 0, 0]}>
          <mesh position={[0, 0, 0.5]}>
            <boxGeometry args={[0.6, 0.08, 1.0]} />
            <meshStandardMaterial color={COLORS.BIRD} />
          </mesh>
          {/* 날개 끝 깃 (어두운 갈색) */}
          <mesh position={[-0.05, 0, 1.05]}>
            <boxGeometry args={[0.4, 0.07, 0.2]} />
            <meshStandardMaterial color="#3a2815" />
          </mesh>
        </group>
        <group position={[0, 0.2, -0.22]} rotation={[Math.sin(now * 8) * 0.5, 0, 0]}>
          <mesh position={[0, 0, -0.5]}>
            <boxGeometry args={[0.6, 0.08, 1.0]} />
            <meshStandardMaterial color={COLORS.BIRD} />
          </mesh>
          <mesh position={[-0.05, 0, -1.05]}>
            <boxGeometry args={[0.4, 0.07, 0.2]} />
            <meshStandardMaterial color="#3a2815" />
          </mesh>
        </group>
      </group>
      </>
    );
  }
  // 환경 장애물 (나뭇가지 더미)
  return (
    <group ref={ref} position={enemy.position}>
      <mesh rotation={[0, 0.4, 0.2]}>
        <boxGeometry args={[1.4, 0.5, 0.5]} />
        <meshStandardMaterial color="#5a4622" />
      </mesh>
      <mesh position={[0.4, 0.3, 0.1]} rotation={[0, -0.3, 0.4]}>
        <boxGeometry args={[1.0, 0.3, 0.3]} />
        <meshStandardMaterial color="#3e2f17" />
      </mesh>
    </group>
  );
}

// ──────── 물고기 수면 텔레그래프 (낚시 게임의 "낚시 스팟"처럼) ────────
// 물고기가 잠겨 안 보일 때: 어두운 물그림자(깊이) + 스팟 경계 링 + 수면에 톡톡 튀는
// 잔물결(핑) + 보글보글 + 퍼지는 음파로 "여기 물고기 있음"을 활기차게 표시한다.
const FISH_BUBBLES = 7;
const BUBBLE_PARAMS = Array.from({ length: FISH_BUBBLES }, (_, i) => ({
  speed: 0.55 + (i % 3) * 0.13, // 상승 주기 속도
  phase: i / FISH_BUBBLES, // 시작 위상 (서로 어긋나 연속적으로 보글거림)
  dx: Math.cos(i * 2.3) * 0.3, // 수면 분포 (결정적)
  dz: Math.sin(i * 1.7) * 0.3,
  r: 0.04 + (i % 3) * 0.014,
}));
const FISH_SONAR_RINGS = 2;
// 수면 곳곳에 톡톡 튀는 잔물결 — 물고기가 수면을 건드리는 듯한 낚시 스팟의 핵심 연출
const FISH_PINGS = 6;
const PING_PARAMS = Array.from({ length: FISH_PINGS }, (_, i) => ({
  dx: Math.cos(i * 2.7) * (0.16 + (i % 3) * 0.17), // 스팟 안 흩어진 위치
  dz: Math.sin(i * 3.9) * (0.16 + (i % 3) * 0.17),
  speed: 0.7 + (i % 4) * 0.16, // 각자 다른 주기로 튐
  phase: (i * 0.37) % 1,
  maxR: 0.2 + (i % 3) * 0.09,
}));

function FishTelegraph({ enemy, now }: { enemy: EnemyData; now: number }) {
  const shadowRef = useRef<Mesh>(null);
  const shadowMatRef = useRef<MeshBasicMaterial>(null);
  const boundaryRef = useRef<Mesh>(null);
  const boundaryMatRef = useRef<MeshBasicMaterial>(null);
  const bubbleRefs = useRef<(Mesh | null)[]>([]);
  const bubbleMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const ringMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);
  const pingRefs = useRef<(Mesh | null)[]>([]);
  const pingMatRefs = useRef<(MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const t = now - enemy.spawnTime;
    const leap = Math.max(0, Math.sin(t * 1.6));
    // 물고기가 깊을수록(leap≈0) 강하게, 수면을 뚫고 솟구치면(leap↑) 빠르게 사라짐
    const alpha = enemy.active ? Math.max(0, 1 - leap * 3) : 0;

    // 어두운 물그림자 — 잠긴 물고기 덩어리가 비치듯 수면이 어둑하게 일렁임
    if (shadowRef.current && shadowMatRef.current) {
      const breathe = 0.85 + Math.sin(t * 2.4) * 0.15;
      shadowRef.current.scale.setScalar(breathe);
      shadowMatRef.current.opacity = alpha * 0.4;
    }

    // 스팟 경계 링 — 낚시 포인트 영역을 둥글게 표시하며 천천히 맥동
    if (boundaryRef.current && boundaryMatRef.current) {
      const pulse = (Math.sin(t * 2.0) + 1) * 0.5; // 0..1
      boundaryRef.current.scale.setScalar(0.95 + pulse * 0.1);
      boundaryMatRef.current.opacity = alpha * (0.3 + pulse * 0.18);
    }

    // 톡톡 튀는 잔물결 — 스팟 곳곳에서 점→확장하며 사라짐 (물고기가 수면을 건드리는 듯)
    for (let i = 0; i < FISH_PINGS; i++) {
      const m = pingRefs.current[i];
      const mat = pingMatRefs.current[i];
      if (!m || !mat) continue;
      const p = PING_PARAMS[i];
      const cyc = (t * p.speed + p.phase) % 1; // 0→1
      m.position.set(p.dx, -0.455, p.dz);
      m.scale.setScalar(Math.max(0.001, p.maxR * cyc));
      mat.opacity = alpha * (1 - cyc) * 0.6;
    }

    // 보글보글 — 수면에서 떠올라 톡 터지는 작은 거품
    for (let i = 0; i < FISH_BUBBLES; i++) {
      const m = bubbleRefs.current[i];
      const mat = bubbleMatRefs.current[i];
      if (!m || !mat) continue;
      const p = BUBBLE_PARAMS[i];
      const cyc = (t * p.speed + p.phase) % 1; // 0→1 상승
      m.position.set(p.dx, -0.5 + cyc * 0.42, p.dz);
      const pop = cyc > 0.82 ? (1 - cyc) / 0.18 : 1; // 꼭대기에서 톡 터짐
      m.scale.setScalar(Math.max(0.001, (0.5 + cyc * 0.7) * pop));
      mat.opacity = alpha * 0.8 * pop;
    }

    // 음파 — 스팟 전체로 퍼지는 큰 동심원
    for (let i = 0; i < FISH_SONAR_RINGS; i++) {
      const m = ringRefs.current[i];
      const mat = ringMatRefs.current[i];
      if (!m || !mat) continue;
      const cyc = (t * 0.5 + i / FISH_SONAR_RINGS) % 1; // 0→1 확장
      m.scale.setScalar(0.3 + cyc * 2.1);
      mat.opacity = alpha * (1 - cyc) * 0.5;
    }
  });

  return (
    <group position={[enemy.position[0], 0, enemy.position[2]]}>
      {/* 어두운 물그림자 — 깊은 물(물고기 덩어리) */}
      <mesh ref={shadowRef} position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.72, 24]} />
        <meshBasicMaterial
          ref={shadowMatRef}
          color="#1d4250"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {/* 스팟 경계 링 — 낚시 포인트 영역 */}
      <mesh ref={boundaryRef} position={[0, -0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.9, 40]} />
        <meshBasicMaterial
          ref={boundaryMatRef}
          color="#bfeefc"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {/* 톡톡 튀는 잔물결 (핑) — 단위 반경 1, scale로 확장 */}
      {PING_PARAMS.map((_, i) => (
        <mesh
          key={`fp${i}`}
          ref={(el) => { pingRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.58, 1.0, 16]} />
          <meshBasicMaterial
            ref={(mm) => { pingMatRefs.current[i] = mm; }}
            color="#dff4ff"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 보글보글 거품 */}
      {BUBBLE_PARAMS.map((p, i) => (
        <mesh key={`fb${i}`} ref={(el) => { bubbleRefs.current[i] = el; }}>
          <sphereGeometry args={[p.r, 6, 5]} />
          <meshBasicMaterial
            ref={(mm) => { bubbleMatRefs.current[i] = mm; }}
            color="#bfe2ea"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 음파 링 — 수면 바로 위(−0.46)에 평평하게 */}
      {Array.from({ length: FISH_SONAR_RINGS }).map((_, i) => (
        <mesh
          key={`fr${i}`}
          ref={(el) => { ringRefs.current[i] = el; }}
          position={[0, -0.462, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.32, 0.5, 28]} />
          <meshBasicMaterial
            ref={(mm) => { ringMatRefs.current[i] = mm; }}
            color="#2a5f70"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ──────── 새 그림자 (상공 위협의 수면 투영) ────────
// 새는 높이 날아 시야 밖이기 쉬우므로, 수면에 드리운 그림자로 현재 위치를 알린다.
// 가장자리가 부드럽게 사라지는 라디얼 그라데이션 텍스처 — 딱딱한 원판보다 자연스러운 그림자.
let _shadowTex: CanvasTexture | null = null;
function getShadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.45, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _shadowTex = new CanvasTexture(c);
  return _shadowTex;
}

function BirdShadow({ enemy, now }: { enemy: EnemyData; now: number }) {
  const ref = useRef<Mesh>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const tex = useMemo(() => getShadowTexture(), []);
  useFrame(() => {
    if (!ref.current || !matRef.current) return;
    const t = now - enemy.spawnTime;
    // 새의 현재 위치(렌더와 동일 공식) 바로 아래 수면
    const lz = birdLiveZ(enemy, now);
    ref.current.position.set(enemy.position[0], -0.46, lz);
    // 새의 실제 고도(렌더와 동일: position[1] + 끄덕임)에 따라 그림자가 커지고 옅어짐
    const alt = enemy.position[1] + Math.cos(t * 1.3) * 0.2;
    const k = Math.max(0, alt - 0.5); // 수면 위 높이 (rest ≈ 2.7)
    const size = 1.0 + k * 0.12;
    // 날개폭(z축)이 길어 그림자도 z로 살짝 길쭉, 날갯짓에 미세하게 호흡
    const breathe = 1 + Math.sin(now * 6) * 0.04;
    ref.current.scale.set(size * breathe, size * 1.3 * breathe, 1);
    matRef.current.opacity = enemy.active ? Math.max(0.18, 0.44 - k * 0.03) : 0;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1.3, 1.3]} />
      <meshBasicMaterial
        ref={matRef}
        map={tex}
        color="#0c1d26"
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}

