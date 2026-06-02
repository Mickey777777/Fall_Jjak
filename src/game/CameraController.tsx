import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { WORLD } from "./constants";

const DEG = Math.PI / 180;

/**
 * 화면 비율에 맞춘 세로 FOV(도) 계산.
 * Three.js의 fov는 '세로' 기준이라, 세로 모드(비율<1)에선 가로 시야가 급격히 좁아진다.
 * 비율<1일 때는 가로 시야를 비율 1(정사각) 기준으로 유지하도록 세로 FOV를 키우고,
 * 과도한 왜곡은 CAMERA_FOV_MAX로 제한한다. 가로 화면(비율≥1)은 기본값 그대로.
 */
function fovForAspect(aspect: number): number {
  if (aspect >= 1) return WORLD.CAMERA_FOV;
  const vfov = 2 * Math.atan(Math.tan((WORLD.CAMERA_FOV * DEG) / 2) / aspect);
  return Math.min(WORLD.CAMERA_FOV_MAX, vfov / DEG);
}

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
  const desired = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const time = useRef(0);

  useFrame((state, dt) => {
    time.current += dt;

    // 화면 비율에 맞춰 세로 FOV 보정 (세로 모드에서 가로 시야 확보)
    if (camera instanceof PerspectiveCamera) {
      const aspect = state.size.width / Math.max(1, state.size.height);
      const fov = fovForAspect(aspect);
      if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    const [ox, oy, oz] = WORLD.CAMERA_OFFSET;
    const zoom = zoomIn ? 0.85 : 1.0;
    desired.current.set(
      targetX + ox * zoom,
      oy * zoom,
      targetZ + oz * zoom,
    );
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
