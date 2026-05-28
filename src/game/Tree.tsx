import { type GroupProps, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type Group, Vector3 } from "three";

interface TreeProps extends GroupProps {
  /** 결정론적 형태 결정용 시드 */
  seed?: number;
  /**
   * 트리 종류
   * - apple: 녹색 캐노피 + 빨강 열매
   * - orange: 녹색 캐노피 + 주황 열매
   * - cherry: 분홍 캐노피, 열매 없음 (벚꽃)
   * - plain: 녹색 캐노피, 열매 없음
   */
  variant?: "apple" | "orange" | "cherry" | "plain";
  /** 면 당 디테일 큐브 개수 (0 이면 디테일 생략) */
  detailCount?: number;
}

const TRUNK_COLOR = "#5C4033";
const CANOPY_COLOR = "#7ed26a"; // 일반 캐노피 (밝은 연두)
const CHERRY_CANOPY_COLOR = "#f7c3d8"; // 벚꽃 캐노피 (옅은 분홍)
const APPLE_COLOR = "#e34a3e"; // 사과 열매
const ORANGE_COLOR = "#f08a3a"; // 주황 열매

const TRUNK_WIDTH = 0.35;
const DETAIL_SIZE = 0.18;
const DETAIL_PROTRUDE = 0.12;
const MIN_CANOPY = 4;
const MAX_CANOPY = 6;

const _tmpVec = new Vector3();

function hash(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Canopy = { size: number; pos: [number, number, number] };
type Detail = { pos: [number, number, number] };

function computeFaceDetails(
  seed: number,
  canopies: Canopy[],
  count: number,
  faceDim: 0 | 2,
  faceDir: 1 | -1,
  saltOffset: number,
): Detail[] {
  // 해당 face 방향으로 가장 외곽에 있는 캐노피 찾기 → 다른 캐노피에 박히지 않게
  let outer = canopies[0];
  let outerEdge = canopies[0].pos[faceDim] + faceDir * canopies[0].size * 0.5;
  for (const c of canopies) {
    const edge = c.pos[faceDim] + faceDir * c.size * 0.5;
    if ((faceDir > 0 && edge > outerEdge) || (faceDir < 0 && edge < outerEdge)) {
      outerEdge = edge;
      outer = c;
    }
  }
  const list: Detail[] = [];
  const half = outer.size * 0.5;
  for (let i = 0; i < count; i++) {
    const t1 = (hash(seed, 130 + saltOffset + i) - 0.5) * outer.size * 0.75;
    const t2 = (hash(seed, 140 + saltOffset + i) - 0.5) * outer.size * 0.75;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (faceDim === 0) {
      dx = faceDir * (half + DETAIL_PROTRUDE);
      dy = t1;
      dz = t2;
    } else {
      dz = faceDir * (half + DETAIL_PROTRUDE);
      dx = t1;
      dy = t2;
    }
    list.push({ pos: [outer.pos[0] + dx, outer.pos[1] + dy, outer.pos[2] + dz] });
  }
  return list;
}

export default function Tree({
  seed = 0,
  variant = "apple",
  detailCount = 4,
  ...groupProps
}: TreeProps) {
  const wrapperRef = useRef<Group>(null);
  const zPosRef = useRef<Group>(null);
  const zNegRef = useRef<Group>(null);

  const canopies = useMemo<Canopy[]>(() => {
    const count =
      MIN_CANOPY + Math.floor(hash(seed, 1) * (MAX_CANOPY - MIN_CANOPY + 1));
    const list: Canopy[] = [];
    const mainSize = 1.1 + hash(seed, 10) * 0.4;
    list.push({ size: mainSize, pos: [0, 0, 0] });
    for (let i = 1; i < count; i++) {
      const size = 0.55 + hash(seed, 10 + i) * 0.5;
      const angle = hash(seed, 20 + i) * Math.PI * 2;
      const radius = mainSize * 0.45 + hash(seed, 25 + i) * 0.3;
      const ox = Math.cos(angle) * radius;
      const oz = Math.sin(angle) * radius;
      const oy = (hash(seed, 40 + i) - 0.4) * 0.7;
      list.push({ size, pos: [ox, oy, oz] });
    }
    return list;
  }, [seed]);

  // 면별 디테일 — -X 면(항상 표시) + ±Z 면(카메라 방향에 따라 토글)
  // cherry / plain 은 열매 없음
  const hasFruit = variant === "apple" || variant === "orange";
  const effectiveDetailCount = hasFruit ? detailCount : 0;
  const detailsX = useMemo(
    () => computeFaceDetails(seed, canopies, effectiveDetailCount, 0, -1, 0),
    [seed, canopies, effectiveDetailCount],
  );
  const detailsZNeg = useMemo(
    () => computeFaceDetails(seed, canopies, effectiveDetailCount, 2, -1, 1000),
    [seed, canopies, effectiveDetailCount],
  );
  const detailsZPos = useMemo(
    () => computeFaceDetails(seed, canopies, effectiveDetailCount, 2, 1, 2000),
    [seed, canopies, effectiveDetailCount],
  );

  // 매 프레임 카메라 위치와 비교해서 보이는 Z 면만 표시
  useFrame(({ camera }) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.getWorldPosition(_tmpVec);
    const dz = camera.position.z - _tmpVec.z;
    if (zPosRef.current) zPosRef.current.visible = dz > 0;
    if (zNegRef.current) zNegRef.current.visible = dz < 0;
  });

  const trunkHeight = 1.4 + hash(seed, 0) * 0.6;
  const canopyBaseY = trunkHeight + canopies[0].size * 0.4;
  const canopyColor =
    variant === "cherry" ? CHERRY_CANOPY_COLOR : CANOPY_COLOR;
  const detailColor = variant === "orange" ? ORANGE_COLOR : APPLE_COLOR;

  return (
    <group ref={wrapperRef} {...groupProps}>
      {/* 기둥 */}
      <mesh position={[0, trunkHeight * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[TRUNK_WIDTH, trunkHeight, TRUNK_WIDTH]} />
        <meshStandardMaterial color={TRUNK_COLOR} roughness={1} />
      </mesh>
      {/* 캐노피 */}
      {canopies.map((c, i) => (
        <mesh
          key={`canopy-${i}`}
          position={[c.pos[0], canopyBaseY + c.pos[1], c.pos[2]]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[c.size, c.size, c.size]} />
          <meshStandardMaterial color={canopyColor} roughness={1} />
        </mesh>
      ))}
      {/* -X 면 디테일 — 항상 표시 (카메라 쪽) */}
      <group>
        {detailsX.map((d, i) => (
          <mesh
            key={`det-x-${i}`}
            position={[d.pos[0], canopyBaseY + d.pos[1], d.pos[2]]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[DETAIL_SIZE, DETAIL_SIZE, DETAIL_SIZE]} />
            <meshStandardMaterial color={detailColor} roughness={1} />
          </mesh>
        ))}
      </group>
      {/* +Z 면 디테일 — 카메라가 트리의 +Z 쪽일 때만 보임 */}
      <group ref={zPosRef}>
        {detailsZPos.map((d, i) => (
          <mesh
            key={`det-zp-${i}`}
            position={[d.pos[0], canopyBaseY + d.pos[1], d.pos[2]]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[DETAIL_SIZE, DETAIL_SIZE, DETAIL_SIZE]} />
            <meshStandardMaterial color={detailColor} roughness={1} />
          </mesh>
        ))}
      </group>
      {/* -Z 면 디테일 — 카메라가 트리의 -Z 쪽일 때만 보임 */}
      <group ref={zNegRef}>
        {detailsZNeg.map((d, i) => (
          <mesh
            key={`det-zn-${i}`}
            position={[d.pos[0], canopyBaseY + d.pos[1], d.pos[2]]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[DETAIL_SIZE, DETAIL_SIZE, DETAIL_SIZE]} />
            <meshStandardMaterial color={detailColor} roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
