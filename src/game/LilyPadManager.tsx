import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import Frog from "./Frog";
import LilyPad from "./LilyPad";
import CameraController from "./CameraController";
import EnemyManager from "./EnemyManager";
import ItemManager from "./ItemManager";
import WeatherSystem from "./WeatherSystem";
import EffectsManager from "./EffectsManager";
import BackgroundDecor from "./BackgroundDecor";
import CrocEnemy from "./CrocEnemy";

import { useGameStore } from "../store/useGameStore";
import { ENEMY, JUMP, LILY, WORLD, SCORE as SCORECONST } from "./constants";
import {
  difficultyOf,
  enemyProb,
  gapForDifficulty,
  lateralForDifficulty,
  pickPadType,
  pickWeather,
  weatherIntervalFor,
} from "./DifficultySystem";
import { makeJumpPlan, pixelsToDistance, sampleJump } from "./JumpController";
import { checkAirborneHit, nearestPad } from "./CollisionSystem";
import { comboMultiplier, judgeLanding, judgmentText } from "./ScoreSystem";
import type {
  EnemyData,
  ItemData,
  JudgmentPopup,
  LilyPadData,
} from "./types";
import { playCrocSnap, playCrocWarnIfNeeded, playJudgment, playPlop, playSlurp, playSpring } from "./sound";
import { playJudgment, playPlop, playSlurp, playSpring } from "./sound";
// 🧪 디버그: 특정 연잎만 스폰 (테스트 끝나면 null로)
const DEBUG_FORCE_PAD_TYPE: LilyPadData["type"] | null = null;

interface Props {
  paused: boolean;
}

/**
 * 게임의 메인 시뮬레이션 루프.
 *
 * - 연잎/적/아이템 생성 및 관리
 * - 입력 (마우스, A/S, 좌클릭) 처리
 * - 점프 트윈 및 착지 판정
 * - 점수/콤보/난이도/날씨 갱신
 */
export default function LilyPadManager({ paused }: Props) {
  // ──────── Zustand 액션들 ────────
  const setAim = useGameStore((s) => s.setAim);
  const setChargeDistance = useGameStore((s) => s.setChargeDistance);
  const setArcHeight = useGameStore((s) => s.setArcHeight);
  const setCharging = useGameStore((s) => s.setCharging);
  const setDistance = useGameStore((s) => s.setDistance);
  const addScore = useGameStore((s) => s.addScore);
  const addPopup = useGameStore((s) => s.addPopup);
  const expirePopups = useGameStore((s) => s.expirePopups);
  const incrementFlies = useGameStore((s) => s.incrementFlies);
  const incrementPads = useGameStore((s) => s.incrementPads);
  const finishRun = useGameStore((s) => s.finishRun);
  const setWeather = useGameStore((s) => s.setWeather);
  const tickBuffs = useGameStore((s) => s.tickBuffs);
  const addBuff = useGameStore((s) => s.addBuff);
  const consumeSwimBuff = useGameStore((s) => s.consumeSwimBuff);
  const triggerTongue = useGameStore((s) => s.triggerTongue);
  const setCrocWarning = useGameStore((s) => s.setCrocWarning);

  // ──────── 시뮬레이션 상태 (ref로 보관해 매 프레임 자유롭게 변경) ────────
  const frog = useRef({ x: 0, y: 0, z: 0 });
  const arcHeightRef = useRef(JUMP.BASE_ARC);
  const aimDirRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeStartPx = useRef<{ x: number; y: number } | null>(null);
  const chargeDistanceRef = useRef(JUMP.MIN_DISTANCE);
  const jumpPlanRef = useRef<ReturnType<typeof makeJumpPlan> | null>(null);
  const jumpTimeRef = useRef(0);
  const lastFrameRef = useRef(performance.now() / 1000);
  const padIdRef = useRef(1);
  const enemyIdRef = useRef(1);
  const itemIdRef = useRef(1);
  const popupIdRef = useRef(1);
  const weatherTimer = useRef(0);
  const nextWeatherIn = useRef(20);
  const shakeRef = useRef(0);
  const zoomRef = useRef(false);
  const [yarrBurst, setYarrBurst] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  /** 카메라가 따라가는 "지면" 위치 — 착지할 때만 갱신되어 공중 비행 동안 배경이 흔들리지 않음 */
  const landedPos = useRef({ x: 0, z: 0 });

  // 악어 위치 (월드 좌표)
  const crocRef = useRef({ x: -ENEMY.CROC_BASE_DISTANCE, z: 0 });
  // 직전 프레임의 경고 상태 — store 업데이트를 변화 시점에만 호출하기 위해
  const crocWasWarnRef = useRef(false);

  const slideRef = useRef<{
    vx: number;
    vz: number;
    remaining: number;
    duration: number;
  } | null>(null);
  const rotatingShiftRef = useRef(0);
  const currentPadRef = useRef<{
    padId: number;
    offsetX: number;
    offsetZ: number;
  } | null>(null);
  // 마우스 월드 좌표 (raycast 결과)
  const cursorWorld = useRef(new Vector3());
  // raycast 유틸
  const raycaster = useMemo(() => new Raycaster(), []);
  const aimPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), -WORLD.PAD_TOP_Y),
    [],
  );
  const mouseNdc = useMemo(() => new Vector2(), []);
  const tmpVec = useMemo(() => new Vector3(), []);

  const { camera, gl } = useThree();

  // 가시 상태(렌더용)
  const [pads, setPads] = useState<LilyPadData[]>(() => initialPads(padIdRef));
  const [enemies, setEnemies] = useState<EnemyData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [, forceRender] = useState(0);

  // ──────── 입력 핸들러 ────────
  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(aimPlane, tmpVec);
      cursorWorld.current.copy(tmpVec);

      // 충전 중이면 드래그 거리 = 화면상 우클릭 시작점에서의 거리
      if (chargingRef.current && chargeStartPx.current) {
        const dx = e.clientX - chargeStartPx.current.x;
        const dy = e.clientY - chargeStartPx.current.y;
        const px = Math.hypot(dx, dy);
        const dist = pixelsToDistance(px);
        chargeDistanceRef.current = dist;
        setChargeDistance(dist);
      } else if (!jumpPlanRef.current) {
        // 조준 방향: 개구리 → 커서 (단, X+ 방향에 한해 ±70도로 제한)
        const dx = cursorWorld.current.x - frog.current.x;
        const dz = cursorWorld.current.z - frog.current.z;
        let dir = Math.atan2(dz, dx);
        // X+(=0 rad) 기준 ±70° 제한
        const limit = (Math.PI / 180) * 70;
        if (dir > limit) dir = limit;
        if (dir < -limit) dir = -limit;
        aimDirRef.current = dir;
        setAim(dir);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (paused) return;
      if (e.button === 2) {
        // 우클릭: 충전 시작
        if (jumpPlanRef.current) return;
        chargingRef.current = true;
        chargeStartPx.current = { x: e.clientX, y: e.clientY };
        chargeDistanceRef.current = JUMP.MIN_DISTANCE;
        setChargeDistance(JUMP.MIN_DISTANCE);
        setCharging(true);
      } else if (e.button === 0) {
        // 좌클릭: 혀 낼름 + 파리 사냥 시도
        triggerTongue();
        // 클릭 지점으로 raycaster 재설정 — 파리는 공중에 있으므로 ground 투영이 아니라
        // 실제 광선과 파리 3D 위치의 거리로 판정해야 정확하다.
        const rect = canvas.getBoundingClientRect();
        mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseNdc, camera);
        setItems((list) => {
          let collected = false;
          const next = list.map((it) => {
            if (it.collected) return it;
            // 광선과 파리 3D 위치의 최단 거리
            tmpVec.set(it.position[0], it.position[1], it.position[2]);
            const d = raycaster.ray.distanceToPoint(tmpVec);
            // 개구리와의 거리도 일정 이내여야 함
            const fd = Math.hypot(
              it.position[0] - frog.current.x,
              it.position[2] - frog.current.z,
            );
            // 혀 사거리 — 너무 멀리 있는 파리는 잡을 수 없음 (혀가 짧음)
            if (d < 0.7 && fd < 3.2) {
              collected = true;
              incrementFlies();
              addScore(SCORECONST.FLY_BONUS, "Great");
              addPopup({
                id: ++popupIdRef.current,
                type: "Great",
                text: `+${SCORECONST.FLY_BONUS} 낼름!`,
                position: [it.position[0], 2.0, it.position[2]],
                bornAt: performance.now(),
                score: SCORECONST.FLY_BONUS,
              });
              if (it.type === "swim") addBuff({ type: "swim", remaining: 9999 });
              if (it.type === "rangeUp")
                addBuff({ type: "rangeUp", remaining: 8 });
              if (it.type === "scoreBoost")
                addBuff({ type: "scoreBoost", remaining: 6 });
              playSlurp();
              return { ...it, collected: true };
            }
            return it;
          });
          return collected ? next : list;
        });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (paused) return;
      if (e.button !== 2) return;
      if (!chargingRef.current) return;
      chargingRef.current = false;
      setCharging(false);
      // 점프 발사
      if (jumpPlanRef.current) return;
      const dist = chargeDistanceRef.current;
      const buffs = useGameStore.getState().buffs;
      const rangeBonus = buffs.find((b) => b.type === "rangeUp") ? 1.3 : 1;
      // 회전 연잎 어긋남 적용 (보이지 않게)
      const finalAim = aimDirRef.current + rotatingShiftRef.current;
      const plan = makeJumpPlan(
        frog.current.x,
        frog.current.z,
        finalAim,  // ← aimDirRef.current → finalAim
        dist * rangeBonus,
        arcHeightRef.current,
        useGameStore.getState().wind,
      );
      jumpPlanRef.current = plan;
      jumpTimeRef.current = 0;
      slideRef.current = null;
      currentPadRef.current = null;
      rotatingShiftRef.current = 0;  // ← 한 번 쓰고 초기화
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyA") {
        arcHeightRef.current = Math.min(
          JUMP.ARC_MAX,
          arcHeightRef.current + JUMP.ARC_STEP,
        );
        setArcHeight(arcHeightRef.current);
      } else if (e.code === "KeyS") {
        arcHeightRef.current = Math.max(
          JUMP.ARC_MIN,
          arcHeightRef.current - JUMP.ARC_STEP,
        );
        setArcHeight(arcHeightRef.current);
      }
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    aimPlane,
    camera,
    gl,
    mouseNdc,
    paused,
    raycaster,
    setAim,
    setArcHeight,
    setCharging,
    setChargeDistance,
    tmpVec,
    addBuff,
    addPopup,
    addScore,
    incrementFlies,
  ]);

  // ──────── 시뮬레이션 루프 ────────
  useFrame(() => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastFrameRef.current);
    lastFrameRef.current = now;
    if (paused) {
      forceRender((x) => x + 1);
      return;
    }

    expirePopups(performance.now());
    tickBuffs(dt);

    // ── 악어 이동 및 충돌 ──
    {
      const diff = difficultyOf(useGameStore.getState().distance);
      const crocSpeed = ENEMY.CROC_SPEED * (1 + diff * 2);
      crocRef.current.x += crocSpeed * dt;
      // Z 방향으로 개구리를 느리게 추적 (프레임독립적 lerp)
      crocRef.current.z += (frog.current.z - crocRef.current.z) * (1 - Math.exp(-1.2 * dt));

      const cdx = frog.current.x - crocRef.current.x;
      const cdz = frog.current.z - crocRef.current.z;
      const crocDist = Math.hypot(cdx, cdz);

      // 경고 (4.5m 이내) — 상태 변화 시에만 store 갱신
      const nowWarn = crocDist < 4.5;
      if (nowWarn !== crocWasWarnRef.current) {
        crocWasWarnRef.current = nowWarn;
        setCrocWarning(nowWarn);
      }
      if (nowWarn) playCrocWarnIfNeeded();

      // 충돌 (지면에 있을 때만)
      if (!jumpPlanRef.current && crocDist < 1.8) {
        playCrocSnap();
        finishRun();
        return;
      }
    }

    // 카메라 shake 감쇠
    shakeRef.current = Math.max(0, shakeRef.current - dt * 2.5);
    if (zoomRef.current && now - (zoomReleaseAt.current ?? 0) > 0.35) {
      zoomRef.current = false;
    }

    // 날씨 타이머
    weatherTimer.current += dt;
    if (weatherTimer.current >= nextWeatherIn.current) {
      const current = useGameStore.getState().weather;
      const next = pickWeather(current, Math.random);
      const wind =
        next === "wind"
          ? {
            direction: (Math.random() - 0.5) * Math.PI,
            strength: 0.6 + Math.random() * 0.4,
          }
          : { direction: 0, strength: 0 };
      setWeather(next, wind);
      weatherTimer.current = 0;
      nextWeatherIn.current = weatherIntervalFor(
        difficultyOf(useGameStore.getState().distance),
        Math.random,
      );
    }

    // 점프 진행
    if (jumpPlanRef.current) {
      jumpTimeRef.current += dt;
      const t = jumpTimeRef.current / jumpPlanRef.current.duration;
      const s = sampleJump(jumpPlanRef.current, t);
      frog.current.x = s.x;
      frog.current.y = s.y;
      frog.current.z = s.z;

      // 공중 충돌 검사
      const hit = checkAirborneHit(s, enemies);
      if (hit) {
        // 즉시 사망
        playPlop();
        finishRun();
        jumpPlanRef.current = null;
        return;
      }

      if (t >= 1) {
        landFrog();
      }
    } else {
      // 1. 움직이는 연잎 따라가기
      if (currentPadRef.current) {
        const cp = currentPadRef.current;
        const p = pads.find((x) => x.id === cp.padId);
        if (p && p.type === "moving") {
          const t = now - p.spawnTime;
          const amp = p.amplitude ?? 1.4;
          const freq = p.frequency ?? 0.8;
          const offset = Math.sin(t * freq) * amp;
          const vx = p.position[0] + (p.axis === "x" ? offset : 0);
          const vz = p.position[2] + (p.axis === "x" ? 0 : offset);
          frog.current.x = vx + cp.offsetX;
          frog.current.z = vz + cp.offsetZ;
        } else if (!p) {
          currentPadRef.current = null;
        }
      }

      // 2. 갱신된 위치로 fx/fz 재계산
      const fx = frog.current.x;
      const fz = frog.current.z;

      // 3. rotten 만료 검사 (기존)
      for (const p of pads) {
        if (p.type !== "rotten" || p.steppedAt == null) continue;
        const dx = p.position[0] - fx;
        const dz = p.position[2] - fz;
        if (Math.hypot(dx, dz) < p.radius) {
          if (now - p.steppedAt >= LILY.ROTTEN_LIFETIME) {
            playPlop();
            finishRun();
            return;
          }
        }
      }

      // 4. 점멸 연잎 검사 (기존)
      for (const p of pads) {
        if (p.type !== "blinking") continue;
        const dx = p.position[0] - fx;
        const dz = p.position[2] - fz;
        if (Math.hypot(dx, dz) < p.radius) {
          const cycle = ((now - p.spawnTime) % LILY.BLINK_PERIOD) / LILY.BLINK_PERIOD;
          if (cycle >= LILY.BLINK_VISIBLE_RATIO) {
            playPlop();
            finishRun();
            return;
          }
        }
      }

      // 5. 슬라이드 (기존)
      if (slideRef.current) {
        const s = slideRef.current;
        const linear = Math.max(0, s.remaining / s.duration);
        const ratio = Math.pow(linear, 1.5);
        const step = Math.min(s.remaining, dt);
        frog.current.x += s.vx * step * ratio;
        frog.current.z += s.vz * step * ratio;
        s.remaining -= dt;
        if (s.remaining <= 0) slideRef.current = null;
      }

      // 6. ★ 연잎 밖으로 나갔는지 검사 — 물 위에 있으면 사망
      let onPad = false;
      for (const p of pads) {
        let pvx = p.position[0];
        let pvz = p.position[2];
        if (p.type === "moving") {
          const t = now - p.spawnTime;
          const amp = p.amplitude ?? 1.4;
          const freq = p.frequency ?? 0.8;
          const offset = Math.sin(t * freq) * amp;
          if (p.axis === "x") pvx += offset;
          else pvz += offset;
        }
        if (Math.hypot(pvx - frog.current.x, pvz - frog.current.z) < p.radius) {
          onPad = true;
          break;
        }
      }
      if (!onPad) {
        playPlop();
        finishRun();
        return;
      }
    }
    // 연잎/적/아이템 청소 및 보충
    cullAndSpawn();

    forceRender((x) => x + 1);
  });

  const zoomReleaseAt = useRef<number | null>(null);

  /** 착지 처리 */
  function landFrog() {
    const plan = jumpPlanRef.current!;
    jumpPlanRef.current = null;
    const lx = plan.endX;
    const lz = plan.endZ;
    frog.current.x = lx;
    frog.current.y = 0;
    frog.current.z = lz;
    setDistance(lx);

    // ★ 움직이는 연잎의 현재 시각 위치를 반영한 사본 만들기
    const nowSec = performance.now() / 1000;
    const padsForCollision = pads.map((p) => {
      if (p.type !== "moving") return p;
      const t = nowSec - p.spawnTime;
      const amp = p.amplitude ?? 1.4;
      const freq = p.frequency ?? 0.8;
      const offset = Math.sin(t * freq) * amp;
      const newPos: [number, number, number] =
        p.axis === "x"
          ? [p.position[0] + offset, p.position[1], p.position[2]]
          : [p.position[0], p.position[1], p.position[2] + offset];
      return { ...p, position: newPos };
    });

    const { pad, dist } = nearestPad(lx, lz, padsForCollision);  // ← pads → padsForCollision
    if (!pad) {
      handleFall(lx, lz);
      return;
    }
    // 함정 연잎이면 즉시 사망
    if (pad.type === "trap") {
      handleFall(lx, lz);
      return;
    }
    // 점멸 연잎 비활성화 상태에서 밟으면 사망
    if (pad.type === "blinking") {
      const cycle =
        ((performance.now() / 1000 - pad.spawnTime) % LILY.BLINK_PERIOD) / LILY.BLINK_PERIOD;
      if (cycle >= LILY.BLINK_VISIBLE_RATIO) {
        handleFall(lx, lz);
        return;
      }
    }
    // 판정
    const j = judgeLanding(dist);
    if (j.type === "Miss") {
      handleFall(lx, lz);
      return;
    }
    // 콤보 배율 적용
    const combo = useGameStore.getState().combo;
    const mult = comboMultiplier(combo);
    const raw = Math.round(j.baseScore * mult);
    const gained = addScore(raw, j.type);
    incrementPads();

    // 카메라가 따라갈 지면 위치 갱신 — 이제부터 카메라가 새 자리로 부드럽게 미끄러진다
    landedPos.current.x = lx;
    landedPos.current.z = lz;

    // 착지 연잎에 파문 트리거
    setPads((list) =>
      list.map((p) =>
        p.id === pad.id ? { ...p, rippleAt: performance.now() / 1000 } : p,
      ),
    );

    addPopup({
      id: ++popupIdRef.current,
      type: j.type,
      text: `${judgmentText(j.type)}  +${gained}`,
      position: [pad.position[0], 1.5, pad.position[2]],
      bornAt: performance.now(),
      score: gained,
    });
    playJudgment(j.type);

    if (j.type === "Yarr") {
      shakeRef.current = 0.4;
      zoomRef.current = true;
      zoomReleaseAt.current = performance.now() / 1000;
      setYarrBurst({ x: pad.position[0], z: pad.position[2], bornAt: performance.now() });
    } else {
      shakeRef.current = Math.max(shakeRef.current, 0.15);
    }

    // 연잎 효과 적용
    if (pad.type === "rotten") {
      setPads((list) =>
        list.map((p) =>
          p.id === pad.id
            ? { ...p, steppedAt: performance.now() / 1000 }
            : p,
        ),
      );
    }
    if (pad.type === "slippery" || useGameStore.getState().weather === "rain") {
      // 점프 방향으로 살짝 미끄러짐 — 모멘텀이 남은 듯한 느낌
      const SLIDE_DIST = 0.75;       // 총 밀려나는 거리 (연잎 반지름보다 작게)
      const SLIDE_DURATION = 0.85;  // 미끄러지는 시간(초)
      const initialSpeed = (2.5 * SLIDE_DIST) / SLIDE_DURATION; // ease-out 보정
      slideRef.current = {
        vx: Math.cos(aimDirRef.current) * initialSpeed,
        vz: Math.sin(aimDirRef.current) * initialSpeed,
        remaining: SLIDE_DURATION,
        duration: SLIDE_DURATION,
      };
    }
    if (pad.type === "rotating") {
      const dir = pad.rotationDirection ?? 1;
      rotatingShiftRef.current = dir * 0.2;
    }
    if (pad.type === "spring") {
      // 즉시 추가 큰 점프 발사 (자동)
      playSpring();
      const bigPlan = makeJumpPlan(
        lx,
        lz,
        aimDirRef.current,
        JUMP.MAX_DISTANCE * 1.05,
        Math.max(arcHeightRef.current, 3.5),
        useGameStore.getState().wind,
      );
      jumpPlanRef.current = bigPlan;
      jumpTimeRef.current = 0;
    }
    if (pad.type === "moving") {
      currentPadRef.current = {
        padId: pad.id,
        offsetX: lx - pad.position[0],  // pad.position은 padsForCollision의 시각 위치
        offsetZ: lz - pad.position[2],
      };
    } else {
      currentPadRef.current = null;
    }
  }

  function handleFall(x: number, z: number) {
    // 생존 수영 버프 검사
    if (consumeSwimBuff()) {
      const { pad } = nearestPad(x, z, pads);
      if (pad) {
        frog.current.x = pad.position[0];
        frog.current.z = pad.position[2];
        frog.current.y = 0;
        landedPos.current.x = pad.position[0];
        landedPos.current.z = pad.position[2];
        addPopup({
          id: ++popupIdRef.current,
          type: "Great",
          text: "수영 복귀!",
          position: [frog.current.x, 1.5, frog.current.z],
          bornAt: performance.now(),
          score: 0,
        });
        return;
      }
    }
    playPlop();
    finishRun();
  }

  /** 개구리 진행에 따라 뒤쪽 연잎/적/아이템 정리하고 앞쪽에 새로 생성 */
  function cullAndSpawn() {
    const fx = frog.current.x;
    const diff = difficultyOf(useGameStore.getState().distance);

    setPads((list) => {
      let kept = list.filter((p) => p.position[0] > fx - LILY.CULL_BEHIND);
      // 가장 멀리 있는 연잎의 X 위치
      let maxX = kept.reduce(
        (m, p) => (p.position[0] > m ? p.position[0] : m),
        fx,
      );
      // 직전 안전 경로의 z 위치 — 지그재그 배치를 위해 추적
      let lastZ =
        kept.length > 0 ? kept[kept.length - 1].position[2] : 0;
      let zigSign: 1 | -1 = lastZ < 0 ? 1 : -1;
      while (maxX < fx + LILY.SPAWN_AHEAD * (LILY.MAX_GAP + 4)) {
        const gap = gapForDifficulty(diff, Math.random);
        // 지그재그 — 다음 패드는 이전과 반대 쪽으로 향함 (가끔 직진)
        const straight = Math.random() < 0.25;
        if (!straight) zigSign = (zigSign * -1) as 1 | 1;
        const lateralBase = lateralForDifficulty(diff, Math.random);
        let lat = straight
          ? lastZ + (Math.random() - 0.5) * 1.2
          : zigSign * Math.abs(lateralBase);
        // 다음 연잎이 최대 점프 사거리 안에 들어오도록 z 위치를 clamp.
        // 92% 안전 마진을 둬서 너무 빡빡한 각도는 피한다.
        const maxDz = Math.sqrt(
          Math.max(0, JUMP.MAX_DISTANCE * JUMP.MAX_DISTANCE - gap * gap),
        ) * 0.92;
        const desiredDz = lat - lastZ;
        if (Math.abs(desiredDz) > maxDz) {
          lat = lastZ + Math.sign(desiredDz) * maxDz;
        }
        const type = DEBUG_FORCE_PAD_TYPE ?? pickPadType(diff, Math.random);
        maxX += gap;
        const newPad: LilyPadData = {
          id: ++padIdRef.current,
          type,
          position: [maxX, WORLD.PAD_TOP_Y, lat],
          radius: LILY.RADIUS,
          spawnTime: performance.now() / 1000,
          visualRotation: (Math.random() - 0.5) * 0.7,
          visualScale: 0.88 + Math.random() * 0.28,
          ...(type === "moving"
            ? {
              amplitude: 0.8 + Math.random() * 1.2,
              frequency: 0.4 + Math.random() * 0.6,
              axis: (Math.random() < 0.5 ? "x" : "z") as "x" | "z",
            }
            : {}),
          ...(type === "rotating"
            ? {
              rotationDirection: (Math.random() < 0.5 ? 1 : -1) as 1 | -1,
            }
            : {}),
        };
        kept.push(newPad);
        lastZ = lat;

        // 곁가지 — 안전 경로 옆에 비대칭 장식용(?) basic 연잎을 1~2개 추가
        // 게임플레이로도 이용 가능하지만 보통은 가지 않는 경로
        const branchCount = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
        for (let b = 0; b < branchCount; b++) {
          const bx = maxX - gap * (0.4 + Math.random() * 0.5);
          const bz = lat + (-zigSign) * (1.6 + Math.random() * 2.2);
          if (Math.abs(bz) > LILY.MAX_LATERAL * 1.4) continue;
          kept.push({
            id: ++padIdRef.current,
            type: "basic",
            position: [bx, WORLD.PAD_TOP_Y, bz],
            radius: LILY.RADIUS * (0.7 + Math.random() * 0.3),
            spawnTime: performance.now() / 1000,
            visualRotation: (Math.random() - 0.5) * 0.7,
            visualScale: 0.75 + Math.random() * 0.3,
          });
        }

        // 적 스폰
        if (Math.random() < enemyProb(diff)) {
          const roll = Math.random();
          const enemy: EnemyData = {
            id: ++enemyIdRef.current,
            type: roll < 0.4 ? "fish" : roll < 0.75 ? "bird" : "obstacle",
            position: [
              maxX - gap * 0.5,
              roll < 0.4 ? -0.3 : roll < 0.75 ? 3.2 : 0.6,
              lat * 0.4 + (Math.random() - 0.5) * 1.4,
            ],
            spawnTime: performance.now() / 1000,
            amplitude: 1 + Math.random(),
            active: true,
          };
          setEnemies((es) => [...es, enemy]);
        }
        // 아이템 스폰
        if (Math.random() < 0.13) {
          const t =
            Math.random() < 0.55
              ? "rangeUp"
              : Math.random() < 0.7
                ? "swim"
                : "scoreBoost";
          const item: ItemData = {
            id: ++itemIdRef.current,
            type: t,
            position: [
              maxX - gap * 0.6,
              1.4 + Math.random() * 0.6,
              lat + (Math.random() - 0.5) * 2,
            ],
            collected: false,
          };
          setItems((is) => [...is, item]);
        }
      }
      return kept;
    });
    setEnemies((list) => list.filter((e) => e.position[0] > fx - LILY.CULL_BEHIND));
    setItems((list) =>
      list.filter((i) => !i.collected && i.position[0] > fx - LILY.CULL_BEHIND),
    );
  }

  // ──────── 후보 연잎 선택 (조준 방향에 가장 가까운 전방 연잎) ────────
  // 매 프레임 render 함수에서 계산 — 별도 state 없이 즉시 사용.
  let candidatePadId: number | null = null;
  if (!jumpPlanRef.current) {
    const aimDir = aimDirRef.current;
    const buffs = useGameStore.getState().buffs;
    const rangeBonus = buffs.find((b) => b.type === "rangeUp") ? 1.3 : 1;
    const maxFwd = JUMP.MAX_DISTANCE * rangeBonus + 2;
    let best = Infinity;
    const cosA = Math.cos(aimDir);
    const sinA = Math.sin(aimDir);
    for (const p of pads) {
      if (p.destroyed) continue;
      const dx = p.position[0] - frog.current.x;
      const dz = p.position[2] - frog.current.z;
      const forward = dx * cosA + dz * sinA;
      if (forward < 0.8 || forward > maxFwd) continue;
      const lateral = Math.abs(-dx * sinA + dz * cosA);
      // 각도 허용 범위 (대략 ±35°)
      if (lateral / forward > 0.7) continue;
      // 가까운 거리 가중 + 조준선과의 수직 거리
      const score = lateral + forward * 0.04;
      if (score < best) {
        best = score;
        candidatePadId = p.id;
      }
    }
  }

  // ──────── 렌더 ────────
  return (
    <>
      <CameraController
        targetX={frog.current.x}
        targetZ={frog.current.z}
        shake={shakeRef.current}
        zoomIn={zoomRef.current}
      />
      <WeatherSystem frogX={frog.current.x} frogZ={frog.current.z} />
      <BackgroundDecor frogX={frog.current.x} frogZ={frog.current.z} />
      <Frog
        position={frog.current}
        aimDirection={aimDirRef.current}
        isCharging={chargingRef.current}
        isJumping={!!jumpPlanRef.current}
        jumpProgress={
          jumpPlanRef.current
            ? jumpTimeRef.current / jumpPlanRef.current.duration
            : 0
        }
      />
      {pads.map((p) => (
        <LilyPad
          key={p.id}
          pad={p}
          now={performance.now() / 1000}
          isCandidate={p.id === candidatePadId}
        />
      ))}
      <EnemyManager enemies={enemies} now={performance.now() / 1000} />
      <CrocEnemy
        x={crocRef.current.x}
        z={crocRef.current.z}
        now={performance.now() / 1000}
        danger={crocWasWarnRef.current}
      />
      <ItemManager items={items} now={performance.now() / 1000} />
      <EffectsManager
        frogX={frog.current.x}
        frogZ={frog.current.z}
        aimDir={aimDirRef.current}
        chargeDist={chargeDistanceRef.current}
        arcHeight={arcHeightRef.current}
        isCharging={chargingRef.current}
        isJumping={!!jumpPlanRef.current}
        yarrBurst={yarrBurst}
      />
    </>
  );
}

/** 시작 시 깔아두는 연잎들 — 첫 점프부터 자연스러운 경로를 보장한다. */
function initialPads(padIdRef: { current: number }): LilyPadData[] {
  const out: LilyPadData[] = [];
  // 개구리 발 밑 연잎
  out.push({
    id: ++padIdRef.current,
    type: "basic",
    position: [0, WORLD.PAD_TOP_Y, 0],
    radius: LILY.RADIUS,
    spawnTime: 0,
    visualRotation: 0,
    visualScale: 1.0,
  });
  let x = 0;
  for (let i = 0; i < 10; i++) {
    x += 2.6 + Math.random() * 1.6;
    const lat = (Math.random() - 0.5) * 4.0;
    out.push({
      id: ++padIdRef.current,
      type: "basic",
      position: [x, WORLD.PAD_TOP_Y, lat],
      radius: LILY.RADIUS,
      spawnTime: 0,
      visualRotation: (Math.random() - 0.5) * 0.7,
      visualScale: 0.85 + Math.random() * 0.3,
    });
  }
  return out;
}
