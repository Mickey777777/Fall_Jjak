import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import LilyPadManager from "../game/LilyPadManager";
import { useGameStore } from "../store/useGameStore";
import { COLORS } from "../game/constants";

interface Props {
  paused: boolean;
}

/**
 * R3F Canvas 래퍼. 빛, 안개, 배경 그라데이션을 여기서 설정한다.
 */
export default function GameCanvas({ paused }: Props) {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const runId = useGameStore((s) => s.runId);

  // ESC = 일시정지 토글 (플레이 중일 때만)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      if (phase === "playing") setPhase("paused");
      else if (phase === "paused") setPhase("playing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, setPhase]);

  return (
    <div className="canvas-wrap">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [-10, 14, -10], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.background = null; // CSS 배경 사용
        }}
      >
        {/* 시야 끝에서 둑/나무가 잘려 보이지 않도록 부드럽게 페이드 */}
        <fog attach="fog" args={[COLORS.FOG, 24, 52]} />
        <Suspense fallback={null}>
          {/* 빛 — 평평하고 채도 높은 픽셀 아트 조명 */}
          <ambientLight intensity={1.05} color={"#ffffff"} />
          <directionalLight
            position={[10, 18, -6]}
            intensity={0.55}
            color={"#ffffff"}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-22}
            shadow-camera-right={22}
            shadow-camera-top={22}
            shadow-camera-bottom={-22}
          />
          <hemisphereLight args={[COLORS.SKY_TOP, "#9bc94a", 0.25]} />

          <LilyPadManager key={runId} paused={paused} />
        </Suspense>
      </Canvas>
    </div>
  );
}
