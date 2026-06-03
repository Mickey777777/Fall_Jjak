import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { WORLD } from "./constants";
import { useGameStore } from "../store/useGameStore";

interface Props {
  targetX: number;
  targetZ: number;
  shake?: number; // 0..1
  zoomIn?: boolean;
}

/**
 * 개구리를 부드럽게 따라가는 쿼터뷰 카메라.
 * Yarr 판정 직후엔 짧은 줌인/플래시를, 게임오버 후엔 천천히 회전한다.
 */
export default function CameraController({
  targetX,
  targetZ,
  shake = 0,
  zoomIn = false,
}: Props) {
  const { camera } = useThree();
  const weather = useGameStore((s) => s.weather);
  const wind = useGameStore((s) => s.wind);
  const desired = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const time = useRef(0);

  useFrame((_, dt) => {
    time.current += dt;
    const [ox, oy, oz] = WORLD.CAMERA_OFFSET;
    const zoom = zoomIn ? 0.85 : 1.0;
    desired.current.set(
      targetX + ox * zoom,
      oy * zoom,
      targetZ + oz * zoom,
    );
    // 강풍 — 바람 방향으로 저주파 드리프트 + 미세 버펫팅
    if (weather === "wind" && wind.strength > 0) {
      const t = time.current;
      const s = wind.strength;
      const sway = (Math.sin(t * 1.2) * 0.5 + Math.sin(t * 3.3) * 0.18) * s * 0.28;
      desired.current.x += Math.cos(wind.direction) * sway + (Math.random() - 0.5) * s * 0.04;
      desired.current.z += Math.sin(wind.direction) * sway + (Math.random() - 0.5) * s * 0.04;
    }
    // shake
    if (shake > 0) {
      desired.current.x += (Math.random() - 0.5) * shake * 0.4;
      desired.current.y += (Math.random() - 0.5) * shake * 0.4;
      desired.current.z += (Math.random() - 0.5) * shake * 0.4;
    }
    // 재시작 등으로 카메라가 멀리 있으면 즉시 스냅, 그렇지 않으면 부드럽게 lerp
    const distSq = camera.position.distanceToSquared(desired.current);
    if (distSq > 2500) {
      // 50m 이상 차이 — 새 게임 시작 등 → 즉시 이동
      camera.position.copy(desired.current);
    } else {
      camera.position.lerp(desired.current, Math.min(1, dt * 4.5));
    }
    lookAt.current.set(
      targetX + WORLD.CAMERA_LOOK_AHEAD,
      0.4,
      targetZ,
    );
    camera.lookAt(lookAt.current);
  });

  return null;
}
