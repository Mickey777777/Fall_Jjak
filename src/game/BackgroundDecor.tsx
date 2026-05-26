import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4 } from "three";
import { initSlots, slotHash, updateSlots } from "./slotRecycler";

interface Props {
  frogX: number;
  frogZ: number;
}

/**
 * 멀리 보이는 둑 + 나무 + 갈대 + 꽃 + 돌 + 캔.
 * 모두 슬롯 리사이클러로 월드 좌표에 고정되어 있다.
 */
const BANK_Z = 12.5;

// 각 장식의 (instance 수, 슬롯 폭, cullBehind)
const GRASS = { N: 44, SPACING: 1.0, CULL: 10 };
const TREE = { N: 16, SPACING: 5.0, CULL: 2 };
const REED = { N: 28, SPACING: 2.4, CULL: 4 };
const FLOWER = { N: 22, SPACING: 3.0, CULL: 3 };
const PEBBLE = { N: 18, SPACING: 3.6, CULL: 3 };
const TRASH = { N: 6, SPACING: 12.0, CULL: 1 };

export default function BackgroundDecor({ frogX }: Props) {
  // 슬롯 메모리
  const grassNorthSlots = useRef<number[]>(initSlots(GRASS.N, GRASS.CULL));
  const grassSouthSlots = useRef<number[]>(initSlots(GRASS.N, GRASS.CULL));
  const treeSlots = useRef<number[]>(initSlots(TREE.N, TREE.CULL));
  const reedSlots = useRef<number[]>(initSlots(REED.N, REED.CULL));
  const flowerSlots = useRef<number[]>(initSlots(FLOWER.N, FLOWER.CULL));
  const pebbleSlots = useRef<number[]>(initSlots(PEBBLE.N, PEBBLE.CULL));
  const trashSlots = useRef<number[]>(initSlots(TRASH.N, TRASH.CULL));

  // InstancedMesh refs
  const grassNorthRef = useRef<InstancedMesh>(null);
  const grassNorthDarkRef = useRef<InstancedMesh>(null);
  const grassSouthRef = useRef<InstancedMesh>(null);
  const grassSouthDarkRef = useRef<InstancedMesh>(null);
  const dirtNorthRef = useRef<InstancedMesh>(null);
  const dirtSouthRef = useRef<InstancedMesh>(null);
  const treeTrunkRef = useRef<InstancedMesh>(null);
  const treeLeafRef = useRef<InstancedMesh>(null);
  const reedRef = useRef<InstancedMesh>(null);
  const flowerPetalRef = useRef<InstancedMesh>(null);
  const flowerCenterRef = useRef<InstancedMesh>(null);
  const pebbleRef = useRef<InstancedMesh>(null);
  const canRef = useRef<InstancedMesh>(null);

  const tmp = useMemo(() => new Matrix4(), []);

  useFrame(() => {
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
        // 각 슬롯의 잔디는 매 m 마다 한 칸 — 슬롯에 따른 미세 높이 변동
        const x = s * GRASS.SPACING; // 정수 슬롯이라 깔끔히 정렬
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

    // ② 나무 — 슬롯별 트렁크 + 잎. side 는 hash 로 결정해 양쪽에 분산
    if (treeTrunkRef.current && treeLeafRef.current) {
      const trunks = treeTrunkRef.current;
      const leaves = treeLeafRef.current;
      updateSlots(treeSlots.current, frogX, TREE.SPACING, TREE.CULL, (i, s) => {
        const side: 1 | -1 = slotHash(s, 0) < 0.5 ? 1 : -1;
        const x = s * TREE.SPACING + (slotHash(s, 3) - 0.5) * TREE.SPACING * 0.6;
        const z = side * (BANK_Z + 1.5 + slotHash(s, 5) * 1.2);
        const trunkH = 1.6 + slotHash(s, 7) * 0.8;
        tmp.makeScale(0.6, trunkH, 0.6);
        tmp.setPosition(x, trunkH * 0.5 - 0.2, z);
        trunks.setMatrixAt(i, tmp);
        const leafH = 1.2 + slotHash(s, 11) * 0.4;
        tmp.makeScale(1.7, leafH, 1.7);
        tmp.setPosition(x, trunkH + leafH * 0.5 - 0.2, z);
        leaves.setMatrixAt(i, tmp);
      });
      trunks.count = TREE.N;
      leaves.count = TREE.N;
      trunks.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
    }

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

      {/* 나무 줄기 */}
      <instancedMesh
        ref={treeTrunkRef}
        args={[undefined, undefined, TREE.N]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#6e4a26"} roughness={1} />
      </instancedMesh>
      {/* 나무 잎 */}
      <instancedMesh
        ref={treeLeafRef}
        args={[undefined, undefined, TREE.N]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={"#5fbc52"} roughness={1} />
      </instancedMesh>

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
