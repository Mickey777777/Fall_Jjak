import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  type Group,
  type InstancedMesh,
  type Mesh,
  Matrix4,
} from "three";
import Tree from "./Tree";
import { initSlots, slotHash, updateSlots } from "./slotRecycler";
import { useGameStore } from "../store/useGameStore";

interface Props {
  frogX: number;
  frogZ: number;
}

/**
 * 강 양쪽 둑의 배경 장식. 모두 슬롯 리사이클러로 월드 좌표에 고정된다.
 */
const BANK_Z = 12.5;

// 각 장식의 (instance 수, 슬롯 폭, cullBehind)
const GRASS = { N: 80, SPACING: 1.0, CULL: 12 };
const TREE = { N: 14, SPACING: 4.5, CULL: 3 };
const REED = { N: 28, SPACING: 2.4, CULL: 4 };
const FLOWER = { N: 22, SPACING: 3.0, CULL: 3 };
const PEBBLE = { N: 18, SPACING: 3.6, CULL: 3 };
const TRASH = { N: 6, SPACING: 12.0, CULL: 1 };
const OUTER_FLOWER = { N: 40, SPACING: 1.8, CULL: 3 };
const MUSHROOM = { N: 16, SPACING: 3.6, CULL: 2 };

// 인덱스 → 트리 종류 (벚꽃 3 : 사과 3 : 주황 2 : 일반 2 비율)
function treeVariant(idx: number): "cherry" | "apple" | "orange" | "plain" {
  const v = ((idx % 10) + 10) % 10;
  return v < 3 ? "cherry" : v < 6 ? "apple" : v < 8 ? "orange" : "plain";
}

export default function BackgroundDecor({ frogX }: Props) {
  // 게임 재시작마다 runId 가 +1 → hash 오프셋으로 사용해 트리 위치/모양/종류가 매번 달라짐
  const runId = useGameStore((s) => s.runId);
  const treeSeedOffset = runId * 13;
  const treeVariantOffset = runId * 3;
  const treeSlotOffset = runId * 997;
  // 슬롯 메모리
  const grassNorthSlots = useRef<number[]>(initSlots(GRASS.N, GRASS.CULL));
  const grassSouthSlots = useRef<number[]>(initSlots(GRASS.N, GRASS.CULL));
  const treeSlots = useRef<number[]>(initSlots(TREE.N, TREE.CULL));
  const reedSlots = useRef<number[]>(initSlots(REED.N, REED.CULL));
  const flowerSlots = useRef<number[]>(initSlots(FLOWER.N, FLOWER.CULL));
  const pebbleSlots = useRef<number[]>(initSlots(PEBBLE.N, PEBBLE.CULL));
  const trashSlots = useRef<number[]>(initSlots(TRASH.N, TRASH.CULL));
  const outerFlowerSlots = useRef<number[]>(initSlots(OUTER_FLOWER.N, OUTER_FLOWER.CULL));
  const mushroomSlots = useRef<number[]>(initSlots(MUSHROOM.N, MUSHROOM.CULL));
  // InstancedMesh refs
  const grassNorthRef = useRef<InstancedMesh>(null);
  const grassNorthDarkRef = useRef<InstancedMesh>(null);
  const grassSouthRef = useRef<InstancedMesh>(null);
  const grassSouthDarkRef = useRef<InstancedMesh>(null);
  const dirtNorthRef = useRef<InstancedMesh>(null);
  const dirtSouthRef = useRef<InstancedMesh>(null);
  // 카메라 따라가는 큰 평면들 (둑 외곽 잔디, 먼 평지)
  const groundNorthRef = useRef<Mesh>(null);
  const groundSouthRef = useRef<Mesh>(null);
  const hillNorthRef = useRef<Mesh>(null);
  const hillSouthRef = useRef<Mesh>(null);
  const treeNorthRefs = useRef<(Group | null)[]>([]);
  const treeSouthRefs = useRef<(Group | null)[]>([]);
  const reedRef = useRef<InstancedMesh>(null);
  const flowerPetalRef = useRef<InstancedMesh>(null);
  const flowerCenterRef = useRef<InstancedMesh>(null);
  const pebbleRef = useRef<InstancedMesh>(null);
  const canRef = useRef<InstancedMesh>(null);
  const outerFlowerPetalRef = useRef<InstancedMesh>(null);
  const outerFlowerCenterRef = useRef<InstancedMesh>(null);
  const outerFlower2PetalRef = useRef<InstancedMesh>(null);
  const mushroomStemRef = useRef<InstancedMesh>(null);
  const mushroomCapRef = useRef<InstancedMesh>(null);
  const mushroomDotRef = useRef<InstancedMesh>(null);

  const tmp = useMemo(() => new Matrix4(), []);

  useFrame(() => {
    // ⓪ 카메라 따라가는 큰 배경 메시들 — frogX 스냅으로 이동
    const xSnap = Math.floor(frogX);
    if (groundNorthRef.current) groundNorthRef.current.position.x = xSnap;
    if (groundSouthRef.current) groundSouthRef.current.position.x = xSnap;
    if (hillNorthRef.current) hillNorthRef.current.position.x = xSnap;
    if (hillSouthRef.current) hillSouthRef.current.position.x = xSnap;

    // ① 잔디 둑 — 양쪽에 각각 안쪽(밝은) + 바깥쪽(진한) + 흙 단면
    const placeGrass = (
      slots: number[],
      sign: 1 | -1,
      lightMesh: InstancedMesh | null,
      darkMesh: InstancedMesh | null,
      dirtMesh: InstancedMesh | null,
    ) => {
      if (!lightMesh || !darkMesh || !dirtMesh) return;
      updateSlots(slots, frogX, GRASS.SPACING, GRASS.CULL, (i, s) => {
        const x = s * GRASS.SPACING;
        // 안쪽(밝은) 잔디
        const innerH = 0.6 + slotHash(s, 1) * 0.4;
        tmp.makeScale(1, innerH, 1);
        tmp.setPosition(x, -0.2, sign * (BANK_Z - 0.5));
        lightMesh.setMatrixAt(i, tmp);
        // 바깥쪽(진한) 잔디
        const outerH = 0.7 + slotHash(s, 2) * 0.5;
        tmp.makeScale(1, outerH, 1);
        tmp.setPosition(x, -0.15, sign * (BANK_Z + 0.6));
        darkMesh.setMatrixAt(i, tmp);
        // 흙 단면
        tmp.makeScale(1, 0.5, 0.5);
        tmp.setPosition(x, -0.7, sign * (BANK_Z - 0.85));
        dirtMesh.setMatrixAt(i, tmp);
      });
      lightMesh.count = GRASS.N;
      darkMesh.count = GRASS.N;
      dirtMesh.count = GRASS.N;
      lightMesh.instanceMatrix.needsUpdate = true;
      darkMesh.instanceMatrix.needsUpdate = true;
      dirtMesh.instanceMatrix.needsUpdate = true;
    };
    placeGrass(
      grassNorthSlots.current,
      1,
      grassNorthRef.current,
      grassNorthDarkRef.current,
      dirtNorthRef.current,
    );
    placeGrass(
      grassSouthSlots.current,
      -1,
      grassSouthRef.current,
      grassSouthDarkRef.current,
      dirtSouthRef.current,
    );

    // ② 나무 — 양쪽 둑에 배치. 열매가 -X 면에만 그려지므로 회전 0 고정(카메라를 향함)
    updateSlots(treeSlots.current, frogX, TREE.SPACING, TREE.CULL, (i, s) => {
      const sh = s + treeSlotOffset;
      const xN = s * TREE.SPACING + (slotHash(sh, 3) - 0.5) * TREE.SPACING * 0.5;
      const zN = BANK_Z + 1.5 + slotHash(sh, 5) * 1.2;
      const gN = treeNorthRefs.current[i];
      if (gN) {
        gN.position.set(xN, -0.2, zN);
        gN.rotation.y = 0;
      }
      const xS = s * TREE.SPACING + (slotHash(sh, 4) - 0.5) * TREE.SPACING * 0.5;
      const zS = -(BANK_Z + 1.5 + slotHash(sh, 6) * 1.2);
      const gS = treeSouthRefs.current[i];
      if (gS) {
        gS.position.set(xS, -0.2, zS);
        gS.rotation.y = 0;
      }
    });

    // ③ 갈대
    if (reedRef.current) {
      const mesh = reedRef.current;
      updateSlots(reedSlots.current, frogX, REED.SPACING, REED.CULL, (i, s) => {
        const side: 1 | -1 = slotHash(s, 41) > 0.5 ? 1 : -1;
        const x = s * REED.SPACING + (slotHash(s, 42) - 0.5) * REED.SPACING * 0.7;
        const z = side * (BANK_Z - 0.3 + slotHash(s, 43) * 0.6);
        const height = 0.5 + slotHash(s, 44) * 0.6;
        tmp.makeScale(0.18, height, 0.18);
        tmp.setPosition(x, height * 0.5 - 0.2, z);
        mesh.setMatrixAt(i, tmp);
      });
      mesh.count = REED.N;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ④ 꽃 (잎 + 중심)
    if (flowerPetalRef.current && flowerCenterRef.current) {
      const petal = flowerPetalRef.current;
      const center = flowerCenterRef.current;
      updateSlots(
        flowerSlots.current,
        frogX,
        FLOWER.SPACING,
        FLOWER.CULL,
        (i, s) => {
          const side: 1 | -1 = slotHash(s, 51) > 0.5 ? 1 : -1;
          const x =
            s * FLOWER.SPACING + (slotHash(s, 52) - 0.5) * FLOWER.SPACING * 0.6;
          const z = side * (BANK_Z - 0.4 + slotHash(s, 53) * 0.3);
          const y = 0.3 + slotHash(s, 55) * 0.2;
          tmp.makeScale(0.18, 0.18, 0.18);
          tmp.setPosition(x, y, z);
          petal.setMatrixAt(i, tmp);
          tmp.makeScale(0.08, 0.08, 0.08);
          tmp.setPosition(x, y + 0.08, z);
          center.setMatrixAt(i, tmp);
        },
      );
      petal.count = FLOWER.N;
      center.count = FLOWER.N;
      petal.instanceMatrix.needsUpdate = true;
      center.instanceMatrix.needsUpdate = true;
    }

    // ⑤ 돌
    if (pebbleRef.current) {
      const mesh = pebbleRef.current;
      updateSlots(
        pebbleSlots.current,
        frogX,
        PEBBLE.SPACING,
        PEBBLE.CULL,
        (i, s) => {
          const side: 1 | -1 = slotHash(s, 61) > 0.5 ? 1 : -1;
          const x =
            s * PEBBLE.SPACING + (slotHash(s, 62) - 0.5) * PEBBLE.SPACING * 0.7;
          const z = side * (BANK_Z - 1.5 - slotHash(s, 63) * 0.7);
          tmp.makeScale(0.22, 0.18, 0.22);
          tmp.setPosition(x, -0.2, z);
          mesh.setMatrixAt(i, tmp);
        },
      );
      mesh.count = PEBBLE.N;
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ⑤-b 외곽 띠 위 작은 꽃 (두 색) — 잎은 hash 로 핑크 vs 보라 두 그룹에 나눠 배치
    if (
      outerFlowerPetalRef.current &&
      outerFlowerCenterRef.current &&
      outerFlower2PetalRef.current
    ) {
      const petal = outerFlowerPetalRef.current;
      const petal2 = outerFlower2PetalRef.current;
      const center = outerFlowerCenterRef.current;
      // 미사용 인스턴스는 화면 밖으로 밀어내기 위한 큰 음수 Y
      const HIDE_Y = -100;
      updateSlots(
        outerFlowerSlots.current,
        frogX,
        OUTER_FLOWER.SPACING,
        OUTER_FLOWER.CULL,
        (i, s) => {
          const side: 1 | -1 = slotHash(s, 81) > 0.5 ? 1 : -1;
          const x =
            s * OUTER_FLOWER.SPACING +
            (slotHash(s, 82) - 0.5) * OUTER_FLOWER.SPACING * 0.7;
          const z = side * (BANK_Z + 1.0 + slotHash(s, 83) * 2.6);
          const y = -0.05 + slotHash(s, 84) * 0.04;
          const isPink = slotHash(s, 85) > 0.45;
          // 꽃 잎 — 색상 그룹에 따라 한 쪽만 표시
          tmp.makeScale(0.22, 0.22, 0.22);
          tmp.setPosition(x, isPink ? y : HIDE_Y, z);
          petal.setMatrixAt(i, tmp);
          tmp.setPosition(x, isPink ? HIDE_Y : y, z);
          petal2.setMatrixAt(i, tmp);
          // 중심 (공통)
          tmp.makeScale(0.10, 0.10, 0.10);
          tmp.setPosition(x, y + 0.10, z);
          center.setMatrixAt(i, tmp);
        },
      );
      petal.count = OUTER_FLOWER.N;
      petal2.count = OUTER_FLOWER.N;
      center.count = OUTER_FLOWER.N;
      petal.instanceMatrix.needsUpdate = true;
      petal2.instanceMatrix.needsUpdate = true;
      center.instanceMatrix.needsUpdate = true;
    }

    // ⑤-c 외곽 띠 위 버섯 — 줄기 + 빨강 갓 + 흰 점
    if (mushroomStemRef.current && mushroomCapRef.current && mushroomDotRef.current) {
      const stem = mushroomStemRef.current;
      const cap = mushroomCapRef.current;
      const dot = mushroomDotRef.current;
      updateSlots(mushroomSlots.current, frogX, MUSHROOM.SPACING, MUSHROOM.CULL, (i, s) => {
        const side: 1 | -1 = slotHash(s, 91) > 0.5 ? 1 : -1;
        const x =
          s * MUSHROOM.SPACING + (slotHash(s, 92) - 0.5) * MUSHROOM.SPACING * 0.6;
        const z = side * (BANK_Z + 1.3 + slotHash(s, 93) * 2.0);
        const stemH = 0.20 + slotHash(s, 94) * 0.10;
        const baseY = -0.05;
        tmp.makeScale(0.12, stemH, 0.12);
        tmp.setPosition(x, baseY + stemH * 0.5, z);
        stem.setMatrixAt(i, tmp);
        const capR = 0.26 + slotHash(s, 95) * 0.08;
        tmp.makeScale(capR, 0.12, capR);
        tmp.setPosition(x, baseY + stemH + 0.06, z);
        cap.setMatrixAt(i, tmp);
        tmp.makeScale(0.07, 0.04, 0.07);
        tmp.setPosition(x, baseY + stemH + 0.13, z);
        dot.setMatrixAt(i, tmp);
      });
      stem.count = MUSHROOM.N;
      cap.count = MUSHROOM.N;
      dot.count = MUSHROOM.N;
      stem.instanceMatrix.needsUpdate = true;
      cap.instanceMatrix.needsUpdate = true;
      dot.instanceMatrix.needsUpdate = true;
    }

    // ⑥ 캔/병 (오염 요소 소량)
    if (canRef.current) {
      const mesh = canRef.current;
      updateSlots(trashSlots.current, frogX, TRASH.SPACING, TRASH.CULL, (i, s) => {
        const side: 1 | -1 = slotHash(s, 71) > 0.5 ? 1 : -1;
        const x = s * TRASH.SPACING + (slotHash(s, 72) - 0.5) * TRASH.SPACING * 0.7;
        const z = side * (BANK_Z - 1.2 - slotHash(s, 73) * 1.0);
        tmp.makeScale(0.16, 0.32, 0.16);
        tmp.setPosition(x, 0.0, z);
        mesh.setMatrixAt(i, tmp);
      });
      mesh.count = TRASH.N;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 둑 잔디 - 안쪽 밝은 */}
      <instancedMesh
        ref={grassNorthRef}
        args={[undefined, undefined, GRASS.N]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#c7e26a"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={grassSouthRef}
        args={[undefined, undefined, GRASS.N]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#c7e26a"} roughness={1} />
      </instancedMesh>
      {/* 둑 잔디 - 바깥쪽 진한 */}
      <instancedMesh
        ref={grassNorthDarkRef}
        args={[undefined, undefined, GRASS.N]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#92bf3e"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={grassSouthDarkRef}
        args={[undefined, undefined, GRASS.N]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#92bf3e"} roughness={1} />
      </instancedMesh>
      {/* 흙 단면 (양쪽) */}
      <instancedMesh
        ref={dirtNorthRef}
        args={[undefined, undefined, GRASS.N]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#7a4d2c"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={dirtSouthRef}
        args={[undefined, undefined, GRASS.N]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#7a4d2c"} roughness={1} />
      </instancedMesh>

      {/* 둑 외곽 잔디 평면 — 카메라 따라 X 이동, 양쪽 모두 시야 끝까지 끊김 없이 덮음 */}
      <mesh
        ref={groundNorthRef}
        position={[0, -0.25, BANK_Z + 2.5]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[260, 0.4, 5]} />
        <meshStandardMaterial color={"#92bf3e"} roughness={1} />
      </mesh>
      <mesh
        ref={groundSouthRef}
        position={[0, -0.25, -(BANK_Z + 2.5)]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[260, 0.4, 5]} />
        <meshStandardMaterial color={"#92bf3e"} roughness={1} />
      </mesh>

      {/* 멀리 평지 — 둑 외곽보다 살짝 어두운 잔디 지면 */}
      <mesh
        ref={hillNorthRef}
        position={[0, -0.3, BANK_Z + 13]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[320, 0.4, 18]} />
        <meshStandardMaterial color={"#7eb045"} roughness={1} />
      </mesh>
      <mesh
        ref={hillSouthRef}
        position={[0, -0.3, -(BANK_Z + 13)]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[320, 0.4, 18]} />
        <meshStandardMaterial color={"#7eb045"} roughness={1} />
      </mesh>

      {/* 나무 — 북쪽 둑. seed/variant 에 runId 오프셋 → 게임마다 다른 모양·종류 */}
      {Array.from({ length: TREE.N }).map((_, i) => (
        <group
          key={`tree-n-${i}`}
          ref={(g) => {
            treeNorthRefs.current[i] = g;
          }}
        >
          <Tree
            seed={(i + treeSeedOffset) * 7 + 13}
            variant={treeVariant(i + treeVariantOffset)}
            detailCount={2}
          />
        </group>
      ))}
      {/* 나무 — 남쪽 둑. 북쪽과 다른 오프셋으로 종류·모양 분산 */}
      {Array.from({ length: TREE.N }).map((_, i) => (
        <group
          key={`tree-s-${i}`}
          ref={(g) => {
            treeSouthRefs.current[i] = g;
          }}
        >
          <Tree
            seed={(i + treeSeedOffset + 100) * 7 + 13}
            variant={treeVariant(i + treeVariantOffset + 5)}
            detailCount={2}
          />
        </group>
      ))}

      {/* 갈대 */}
      <instancedMesh
        ref={reedRef}
        args={[undefined, undefined, REED.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#3e7e2e"} roughness={1} />
      </instancedMesh>

      {/* 꽃 잎 / 중심 */}
      <instancedMesh
        ref={flowerPetalRef}
        args={[undefined, undefined, FLOWER.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#ff7eb5"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={flowerCenterRef}
        args={[undefined, undefined, FLOWER.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#fff7a3"} roughness={1} />
      </instancedMesh>

      {/* 돌 */}
      <instancedMesh
        ref={pebbleRef}
        args={[undefined, undefined, PEBBLE.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#9c9c9c"} roughness={1} />
      </instancedMesh>

      {/* 외곽 띠 위 작은 꽃 — 핑크 / 보라 두 색 + 노랑 중심 */}
      <instancedMesh
        ref={outerFlowerPetalRef}
        args={[undefined, undefined, OUTER_FLOWER.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#ffb1d6"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={outerFlower2PetalRef}
        args={[undefined, undefined, OUTER_FLOWER.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#b793f0"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={outerFlowerCenterRef}
        args={[undefined, undefined, OUTER_FLOWER.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#fff3a0"} roughness={1} />
      </instancedMesh>

      {/* 외곽 띠 위 버섯 — 흰 줄기 + 빨강 갓 + 흰 점 */}
      <instancedMesh
        ref={mushroomStemRef}
        args={[undefined, undefined, MUSHROOM.N]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#fff5dc"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={mushroomCapRef}
        args={[undefined, undefined, MUSHROOM.N]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#e34a4a"} roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={mushroomDotRef}
        args={[undefined, undefined, MUSHROOM.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#fff5dc"} roughness={1} />
      </instancedMesh>

      {/* 캔/병 */}
      <instancedMesh
        ref={canRef}
        args={[undefined, undefined, TRASH.N]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#c44a4a"} roughness={1} />
      </instancedMesh>
    </group>
  );
}
