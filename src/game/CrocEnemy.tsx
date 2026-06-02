import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLORS } from "./constants";

interface Props {
  x: number;
  z: number;
  now: number;
  dist: number;
  /** 악어가 개구리를 잡아먹은 상태 — true면 물살 정리 */
  caught?: boolean;
}

const WATER_Y     = -0.50;
const SUBMERGED_Y = -2.20;
const SURFACE_Y   =  0.50;  // 머리가 충분히 부상하는 높이
const LUNGE_AMP   =  0.12;  // 런지 시 소폭 수직 상승 (대부분은 피치로 처리)
const LUNGE_PITCH =  0.40;  // 런지 시 머리가 들리는 피치 (rad) — 머리부터 솟고 꼬리는 잠김
const HIDE_SIL_Y  = -0.85;  // 본체↔실루엣 전환 높이. 본체 최고점(눈, origin+0.48)이 실루엣 눈높이
                            // (-0.37)와 일치하는 지점 → 전환 순간 눈만 빼꼼(실루엣과 동일). 이후 물
                            // 평면(WATER_Y=-0.5, 불투명)이 잠긴 부분을 잘라 보이는 면적이 점차 늘어남.
const RISE_START  =  4.6;   // 이 거리부터 서서히 떠오르기 시작. 몸이 수면을 뚫는 거리(=0.5*RISE_START+1.3)가
                            // 턱 벌리기 시작(WARN_DIST=3.6)과 일치하도록 맞춤 → 몸 등장과 입 벌림 타이밍 동기화
       const WARN_DIST   =  3.6;  // 턱 벌리기 시작 (로컬 — 입 벌림 연출용). 가까이서야 벌리도록 좁힘
export const SHOW_DIST   =  5.8;  // 악어가 화면 하단에 등장하는 거리 → HUD 경고·으르렁 시작
export const KILL_DIST   =  2.6;

const BACK   = "#2d3f1e";   // 등 능선/스큐트 (어두운 녹색)
const BELLY  = "#c7c4a0";   // 배 (밝은 베이지)
const TOOTH  = "#f0eedd";

const RING_N     = 8;       // 트레일 물결 링 풀 크기
const RING_LIFE  = 1.5;     // 링 수명 (s)
const RING_SPAWN = 0.22;    // 링 생성 간격 (s)

export default function CrocEnemy({ x, z, now, dist, caught = false }: Props) {
  const subRef        = useRef<Group>(null);
  const headRef       = useRef<Group>(null);
  const snoutRef      = useRef<Group>(null);
  const upperTeethRef = useRef<Group>(null);
  const lowerTeethRef = useRef<Group>(null);

  // 물살(항적) 포말 — 악어를 따라다니는 그룹
  const wakeRef       = useRef<Group>(null);
  const bowMatRef   = useRef<MeshBasicMaterial>(null);
  const churnMatRef = useRef<MeshBasicMaterial>(null);

  // 트레일 물결 링 — 지나간 자리에 월드 좌표로 남음
  const ringGroupRef = useRef<Group>(null);
  const ringState    = useRef(Array.from({ length: RING_N }, () => ({ x: 0, z: 0, t: -999 })));
  const ringCursor   = useRef(0);
  const ringTimer    = useRef(0);

  const yRef       = useRef(SUBMERGED_Y);
  const jawRef     = useRef(0);
  const crocYawRef = useRef(0);
  const prevXRef   = useRef(x);
  const prevZRef   = useRef(z);


  useFrame((_, delta) => {
    const bob = Math.sin(now * 2.2) * 0.015;

    // ── 잡아먹은 후 이펙트 정리 + 본체 고정 ──
    if (caught) {
      jawRef.current = 0;
      if (headRef.current) {
        headRef.current.position.set(x, Math.max(yRef.current, SURFACE_Y) + bob, z);
        headRef.current.rotation.z = 0;
        headRef.current.visible    = true;
      }
      if (subRef.current)       subRef.current.visible       = false;
      if (snoutRef.current)     snoutRef.current.rotation.z  = 0;
      if (upperTeethRef.current) upperTeethRef.current.visible = false;
      if (lowerTeethRef.current) lowerTeethRef.current.visible = false;
      if (bowMatRef.current)   bowMatRef.current.opacity  = 0;
      if (churnMatRef.current) churnMatRef.current.opacity = 0;
      if (ringGroupRef.current) {
        for (const c of ringGroupRef.current.children) c.visible = false;
      }
      return;
    }

    // ── Yaw (Z 추적에 따른 몸 방향) ──
    const dxMove = x - prevXRef.current;
    const dzMove = z - prevZRef.current;
    prevXRef.current = x;
    prevZRef.current = z;
    if (Math.abs(dxMove) > 0.0001 || Math.abs(dzMove) > 0.0001) {
      const targetYaw = -Math.atan2(dzMove, dxMove);
      crocYawRef.current += (targetYaw - crocYawRef.current) * (1 - Math.exp(-5 * delta));
    }

    // ── 부상/잠수 — 거리에 따라 연속적으로 부드럽게 상승 (프레임레이트 독립) ──
    const phase1 = dist < WARN_DIST;
    const phase3 = dist < KILL_DIST;

    // RISE_START(서서히 부상 시작) → KILL_DIST(완전 부상)를 smoothstep으로 보간.
    // 한 구간을 통째로 천천히 올라오므로 갑자기 솟구치지 않고 자연스럽게 떠오름.
    const riseT  = Math.min(1, Math.max(0, (RISE_START - dist) / (RISE_START - KILL_DIST)));
    const eased  = riseT * riseT * (3 - 2 * riseT);  // smoothstep — 시작/끝이 부드러움
    const baseY  = SUBMERGED_Y + eased * (SURFACE_Y - SUBMERGED_Y);
    yRef.current += (baseY - yRef.current) * (1 - Math.exp(-3.2 * delta));

    // ── 턱 (프레임레이트 독립) ──
    const closeT    = phase1 ? Math.max(0, (WARN_DIST - dist) / (WARN_DIST - KILL_DIST)) : 0;
    const targetJaw = phase3 ? 0 : closeT * (Math.PI / 2);
    jawRef.current += (targetJaw - jawRef.current) * (1 - Math.exp(-(phase3 ? 20 : 7) * delta));

    const lungeT      = jawRef.current / (Math.PI / 2);
    const lungeOffset = lungeT * LUNGE_AMP;
    const lungePitch  = lungeT * LUNGE_PITCH;

    if (subRef.current) {
      subRef.current.position.set(x, WATER_Y + bob, z);
      subRef.current.rotation.y = crocYawRef.current;
      subRef.current.visible = yRef.current < HIDE_SIL_Y;
    }
    if (headRef.current) {
      headRef.current.position.set(x, yRef.current + lungeOffset + bob, z);
      headRef.current.rotation.z = lungePitch;
      headRef.current.visible = yRef.current > HIDE_SIL_Y;
    }
    if (snoutRef.current) {
      snoutRef.current.rotation.z = jawRef.current;
    }

    const teethVisible = jawRef.current > 0.18;
    if (upperTeethRef.current) upperTeethRef.current.visible = teethVisible;
    if (lowerTeethRef.current) lowerTeethRef.current.visible = teethVisible;

    // ── 물살(항적) ──
    const surfaceFrac = Math.min(1, Math.max(0, (yRef.current - SUBMERGED_Y) / (SURFACE_Y - SUBMERGED_Y)));
    const pulse = 0.85 + Math.sin(now * 5.0) * 0.15;

    if (wakeRef.current) {
      wakeRef.current.position.set(x, WATER_Y + 0.02 + bob * 0.5, z);
      wakeRef.current.rotation.y = crocYawRef.current;
      wakeRef.current.scale.z = 1 + Math.sin(now * 3.0) * 0.05;
    }
    if (bowMatRef.current)   bowMatRef.current.opacity  = (0.20 + 0.46 * surfaceFrac) * pulse;
    if (churnMatRef.current) churnMatRef.current.opacity = (0.14 + 0.40 * surfaceFrac) * pulse;

    // ── 트레일 물결 링 ──
    const dt = Math.min(0.05, delta);
    ringTimer.current += dt;
    if (ringTimer.current >= RING_SPAWN) {
      ringTimer.current -= RING_SPAWN;
      const s = ringState.current[ringCursor.current];
      s.x = x + 0.5; s.z = z; s.t = now;
      ringCursor.current = (ringCursor.current + 1) % RING_N;
    }
    if (ringGroupRef.current) {
      const kids = ringGroupRef.current.children;
      for (let i = 0; i < kids.length; i++) {
        const m = kids[i] as Mesh;
        const s = ringState.current[i];
        const age = now - s.t;
        if (age >= 0 && age < RING_LIFE) {
          const k = age / RING_LIFE;
          m.visible = true;
          m.position.set(s.x, WATER_Y + 0.025, s.z);
          const r = 0.35 + k * 1.7;
          m.scale.set(r, r, 1);
          (m.material as MeshBasicMaterial).opacity = (1 - k) * 0.5 * (0.45 + 0.55 * surfaceFrac);
        } else {
          m.visible = false;
        }
      }
    }
  });

  return (
    <>
      {/* ── 물살(항적) — 악어를 따라다니며 물을 가르는 포말 ── */}
      <group ref={wakeRef} position={[x, WATER_Y + 0.02, z]}>
        {/* 뱃머리 물마루 — 주둥이가 밀어내는 솟은 물결 */}
        <mesh position={[2.05, 0.07, 0]} rotation={[0, 0, 0.14]}>
          <boxGeometry args={[0.55, 0.14, 0.92]} />
          <meshBasicMaterial ref={bowMatRef} color="#eef7f5" transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* 몸 주변 거품 churn */}
        <mesh position={[0.2, -0.01, 0]}>
          <boxGeometry args={[1.8, 0.03, 1.04]} />
          <meshBasicMaterial ref={churnMatRef} color="#eaf4f2" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* ── 트레일 물결 링 — 지나간 자리에 퍼지며 사라짐 (월드 고정 풀) ── */}
      <group ref={ringGroupRef}>
        {Array.from({ length: RING_N }).map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.82, 1.0, 28]} />
            <meshBasicMaterial color="#eef7f5" transparent opacity={0} depthWrite={false} side={DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* ── 수면 실루엣 (잠수 중: 눈·콧등·긴 등줄기만 수면 위로) ── */}
      <group ref={subRef} position={[x, WATER_Y, z]}>
        {/* 콧등 */}
        <mesh position={[1.00, 0.05, 0]}>
          <boxGeometry args={[0.62, 0.10, 0.52]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        <mesh position={[1.29, 0.045, 0]}>
          <boxGeometry args={[0.26, 0.08, 0.24]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 콧구멍 */}
        <mesh position={[1.37, 0.09, 0.06]}><boxGeometry args={[0.06, 0.05, 0.06]} /><meshStandardMaterial color="#182610" /></mesh>
        <mesh position={[1.37, 0.09, -0.06]}><boxGeometry args={[0.06, 0.05, 0.06]} /><meshStandardMaterial color="#182610" /></mesh>
        {/* 눈 융기 */}
        <mesh position={[1.04, 0.13, 0.26]}><boxGeometry args={[0.16, 0.14, 0.18]} /><meshStandardMaterial color="#ffe040" /></mesh>
        <mesh position={[1.04, 0.13, -0.26]}><boxGeometry args={[0.16, 0.14, 0.18]} /><meshStandardMaterial color="#ffe040" /></mesh>
        <mesh position={[1.10, 0.13, 0.26]}><boxGeometry args={[0.06, 0.07, 0.06]} /><meshStandardMaterial color="#080808" /></mesh>
        <mesh position={[1.10, 0.13, -0.26]}><boxGeometry args={[0.06, 0.07, 0.06]} /><meshStandardMaterial color="#080808" /></mesh>
        {/* 등줄기 몸통 — 수면에 살짝 드러난 연속된 등 (돌기 사이를 메워 척추뼈처럼 안 보이게) */}
        <mesh position={[0.78, 0.02, 0]}><boxGeometry args={[0.72, 0.10, 0.50]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[0.12, 0.02, 0]}><boxGeometry args={[0.88, 0.09, 0.46]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-0.62, 0.015, 0]}><boxGeometry args={[0.92, 0.08, 0.38]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-1.38, 0.01, 0]}><boxGeometry args={[0.84, 0.07, 0.28]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-2.06, 0.005, 0]}><boxGeometry args={[0.62, 0.06, 0.18]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        {/* 등줄기 — 몸통 위로 솟은 스큐트 돌기 (잠수한 악어 특유의 실루엣) */}
        <mesh position={[0.55, 0.10, 0]}><boxGeometry args={[0.28, 0.16, 0.34]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[0.08, 0.10, 0]}><boxGeometry args={[0.26, 0.16, 0.32]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-0.42, 0.09, 0]}><boxGeometry args={[0.24, 0.14, 0.30]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-0.92, 0.08, 0]}><boxGeometry args={[0.22, 0.13, 0.26]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-1.42, 0.07, 0]}><boxGeometry args={[0.18, 0.11, 0.22]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-1.90, 0.06, 0]}><boxGeometry args={[0.15, 0.10, 0.17]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-2.34, 0.05, 0]}><boxGeometry args={[0.12, 0.08, 0.12]} /><meshStandardMaterial color={BACK} /></mesh>
      </group>

      {/* ── 본체 (부상/런지 시 머리+목+상체+꼬리가 통째로 솟아오름) ── */}
      <group ref={headRef} position={[x, SUBMERGED_Y, z]}>

        {/* ===== 가슴/어깨 ===== */}
        <mesh position={[0.22, -0.04, 0]}>
          <boxGeometry args={[0.62, 0.58, 0.90]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 등 큰 덩어리 */}
        <mesh position={[-0.42, -0.06, 0]}>
          <boxGeometry args={[0.82, 0.60, 0.92]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 배 (밝은 면) */}
        <mesh position={[-0.30, -0.40, 0]}>
          <boxGeometry args={[1.70, 0.16, 0.76]} />
          <meshStandardMaterial color={BELLY} />
        </mesh>
        {/* 목 — 어깨와 두개골 연결 */}
        <mesh position={[0.56, 0.00, 0]}>
          <boxGeometry args={[0.42, 0.50, 0.76]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>

        {/* ===== 꼬리 — 뒤로 갈수록 내려가며 가늘어져 수면 아래로 잠김 ===== */}
        <mesh position={[-1.02, -0.24, 0]}><boxGeometry args={[0.70, 0.50, 0.74]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-1.60, -0.48, 0]}><boxGeometry args={[0.60, 0.42, 0.56]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-2.10, -0.72, 0]}><boxGeometry args={[0.50, 0.34, 0.40]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-2.52, -0.94, 0]}><boxGeometry args={[0.40, 0.26, 0.26]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[-2.88, -1.12, 0]}><boxGeometry args={[0.32, 0.20, 0.16]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>

        {/* ===== 등 능선 스큐트 — 척추 따라 솟았다가 꼬리로 잠김 ===== */}
        <mesh position={[0.06, 0.30, 0]}><boxGeometry args={[0.20, 0.18, 0.34]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-0.42, 0.32, 0]}><boxGeometry args={[0.24, 0.22, 0.40]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-1.02, 0.18, 0]}><boxGeometry args={[0.22, 0.20, 0.34]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-1.60, -0.08, 0]}><boxGeometry args={[0.20, 0.18, 0.26]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-2.10, -0.36, 0]}><boxGeometry args={[0.16, 0.15, 0.18]} /><meshStandardMaterial color={BACK} /></mesh>
        <mesh position={[-2.52, -0.60, 0]}><boxGeometry args={[0.12, 0.12, 0.12]} /><meshStandardMaterial color={BACK} /></mesh>

        {/* ===== 앞다리 (어깨 옆, 물살을 가르는 모습) ===== */}
        <mesh position={[0.18, -0.38, 0.50]}><boxGeometry args={[0.20, 0.34, 0.18]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[0.18, -0.38, -0.50]}><boxGeometry args={[0.20, 0.34, 0.18]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[0.30, -0.54, 0.54]}><boxGeometry args={[0.26, 0.10, 0.22]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>
        <mesh position={[0.30, -0.54, -0.54]}><boxGeometry args={[0.26, 0.10, 0.22]} /><meshStandardMaterial color={COLORS.CROC} /></mesh>

        {/* ===== 목구멍/턱 밑 — 아랫턱과 몸통(목)을 잇는 바닥 (입 벌릴 때 사이로 배경이 안 보이게) ===== */}
        {/* 윗면은 아랫턱 윗면(≈ -0.04) 높이에 맞춰 입 닫을 때 윗턱을 뚫지 않도록 함 */}
        <mesh position={[1.07, -0.17, 0]}>
          <boxGeometry args={[1.43, 0.28, 0.56]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 턱 밑 배 (밝은 면) */}
        <mesh position={[1.03, -0.30, 0]}>
          <boxGeometry args={[1.51, 0.10, 0.50]} />
          <meshStandardMaterial color={BELLY} />
        </mesh>
        {/* ===== 아랫턱 (머리에 고정) ===== */}
        <mesh position={[1.78, -0.12, 0]}>
          <boxGeometry args={[0.50, 0.16, 0.48]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        <mesh position={[1.78, -0.20, 0]}>
          <boxGeometry args={[0.48, 0.08, 0.44]} />
          <meshStandardMaterial color={BELLY} />
        </mesh>
        <mesh position={[2.09, -0.13, 0]}>
          <boxGeometry args={[0.34, 0.13, 0.34]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        <mesh position={[2.34, -0.14, 0]}>
          <boxGeometry args={[0.24, 0.11, 0.22]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        <mesh position={[2.53, -0.15, 0]}>
          <boxGeometry args={[0.16, 0.09, 0.14]} />
          <meshStandardMaterial color={COLORS.CROC} />
        </mesh>
        {/* 아랫니 — 입 닫힐 때 숨김 */}
        <group ref={lowerTeethRef}>
          <mesh position={[1.88, 0.00,  0.16]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
          <mesh position={[1.88, 0.00, -0.16]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
          <mesh position={[2.12, 0.00,  0.11]}><boxGeometry args={[0.05, 0.11, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
          <mesh position={[2.12, 0.00, -0.11]}><boxGeometry args={[0.05, 0.11, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
          <mesh position={[2.34, -0.01,  0.07]}><boxGeometry args={[0.04, 0.09, 0.04]} /><meshStandardMaterial color={TOOTH} /></mesh>
          <mesh position={[2.34, -0.01, -0.07]}><boxGeometry args={[0.04, 0.09, 0.04]} /><meshStandardMaterial color={TOOTH} /></mesh>
        </group>

        {/* ===== 윗턱 전체 — 피벗 x=0.70(머리 뒤쪽)에서 위로 열림 ===== */}
        <group ref={snoutRef} position={[0.70, 0, 0]}>
          {/* 두개골 기부 (높게) */}
          <mesh position={[0.22, 0.12, 0]}>
            <boxGeometry args={[0.48, 0.42, 0.82]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 두개골 크라운 */}
          <mesh position={[0.16, 0.40, 0]}>
            <boxGeometry args={[0.40, 0.24, 0.58]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 광대/볼 — 양옆 볼륨 */}
          <mesh position={[0.50, 0.06, 0.30]}>
            <boxGeometry args={[0.36, 0.32, 0.22]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          <mesh position={[0.50, 0.06, -0.30]}>
            <boxGeometry args={[0.36, 0.32, 0.22]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 눈 위 융기 */}
          <mesh position={[0.44, 0.36, 0]}>
            <boxGeometry args={[0.30, 0.16, 0.58]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 눈 (머리 위로 돌출) */}
          <mesh position={[0.40, 0.48,  0.28]}><boxGeometry args={[0.16, 0.16, 0.18]} /><meshStandardMaterial color="#ffe040" /></mesh>
          <mesh position={[0.40, 0.48, -0.28]}><boxGeometry args={[0.16, 0.16, 0.18]} /><meshStandardMaterial color="#ffe040" /></mesh>
          <mesh position={[0.48, 0.48,  0.28]}><boxGeometry args={[0.07, 0.08, 0.07]} /><meshStandardMaterial color="#080808" /></mesh>
          <mesh position={[0.48, 0.48, -0.28]}><boxGeometry args={[0.07, 0.08, 0.07]} /><meshStandardMaterial color="#080808" /></mesh>
          {/* 콧등 연결부 — 두개골 기부와 첫 주둥이 마디 사이 중앙(눈썹 아래) 빈 노치를 메움 */}
          <mesh position={[0.57, 0.08, 0]}>
            <boxGeometry args={[0.34, 0.26, 0.46]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 긴 주둥이 — 여러 마디로 가늘게 (악어다운 길고 좁은 입) */}
          <mesh position={[0.84, 0.04, 0]}>
            <boxGeometry args={[0.30, 0.20, 0.50]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          <mesh position={[1.08, 0.05, 0]}>
            <boxGeometry args={[0.28, 0.16, 0.42]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          <mesh position={[1.32, 0.05, 0]}>
            <boxGeometry args={[0.28, 0.13, 0.34]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          <mesh position={[1.55, 0.045, 0]}>
            <boxGeometry args={[0.26, 0.11, 0.28]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          <mesh position={[1.78, 0.04, 0]}>
            <boxGeometry args={[0.22, 0.10, 0.22]} />
            <meshStandardMaterial color={COLORS.CROC} />
          </mesh>
          {/* 콧구멍 (코끝 위) */}
          <mesh position={[1.84, 0.10,  0.05]}>
            <boxGeometry args={[0.06, 0.05, 0.06]} />
            <meshStandardMaterial color="#182610" />
          </mesh>
          <mesh position={[1.84, 0.10, -0.05]}>
            <boxGeometry args={[0.06, 0.05, 0.06]} />
            <meshStandardMaterial color="#182610" />
          </mesh>
          {/* 구강 내부 천장 — 입 벌릴 때 드러남 */}
          <mesh position={[1.30, -0.06, 0]}>
            <boxGeometry args={[1.20, 0.03, 0.36]} />
            <meshStandardMaterial color="#c05840" />
          </mesh>
          {/* 윗니 — 입 닫힐 때 숨김 */}
          <group ref={upperTeethRef}>
            <mesh position={[1.74, -0.07,  0.10]}><boxGeometry args={[0.05, 0.12, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.74, -0.07, -0.10]}><boxGeometry args={[0.05, 0.12, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.54, -0.07,  0.13]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.54, -0.07, -0.13]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.32, -0.07,  0.15]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.32, -0.07, -0.15]}><boxGeometry args={[0.06, 0.13, 0.06]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.10, -0.06,  0.11]}><boxGeometry args={[0.05, 0.11, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
            <mesh position={[1.10, -0.06, -0.11]}><boxGeometry args={[0.05, 0.11, 0.05]} /><meshStandardMaterial color={TOOTH} /></mesh>
          </group>
        </group>

      </group>
    </>
  );
}
