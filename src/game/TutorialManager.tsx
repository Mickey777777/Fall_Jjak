import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import Frog from "./Frog";
import LilyPad from "./LilyPad";
import CameraController from "./CameraController";
import EnemyManager from "./EnemyManager";
import ItemManager from "./ItemManager";
import EffectsManager from "./EffectsManager";
import WeatherSystem from "./WeatherSystem";
import BackgroundDecor from "./BackgroundDecor";

import { useGameStore } from "../store/useGameStore";
import { JUMP, LILY, WORLD } from "./constants";
import { makeJumpPlan, pixelsToDistance, sampleJump } from "./JumpController";
import { checkAirborneHit } from "./CollisionSystem";
import { judgeLanding, judgmentText } from "./ScoreSystem";
import { playJudgment, playSlurp, playSplash, playWhoosh } from "./sound";
import { gameNow, gameNowMs } from "./gameClock";
import type { EnemyData, ItemData, LilyPadData } from "./types";
import { TUTORIAL_STEPS, freshProgress, type TutorialProgress } from "./tutorialSteps";

const NO_WIND = { direction: 0, strength: 0 };
const STEP_ADVANCE_MS = 800; // 성공 연출 후 다음 구간 이어붙이기까지
const STEP_RETRY_MS = 800; // 실패 후 구간 시작점으로 복귀까지
const DONE_SHOW_MS = 700; // "완료" 표시 후 본게임으로 이어가기까지

type Fx = { x: number; z: number; bornAt: number } | null;
type Vec2 = { x: number; z: number };

function makePad(id: number, x: number, z: number, radius: number): LilyPadData {
  return {
    id,
    type: "basic",
    position: [x, WORLD.PAD_TOP_Y, z],
    radius,
    spawnTime: 0,
    visualRotation: 0,
    visualScale: 1,
  };
}

/**
 * 튜토리얼 전용 시뮬레이션. 본게임 LilyPadManager와 분리된 단순 루프로,
 * 손으로 배치한 구간을 이어 붙여 하나의 연속 코스를 만든다. 적/날씨/악어/난수 스폰 없음.
 * 마지막 구간을 통과하면 페이드와 함께 본게임으로 전환된다.
 * 순수 모듈(JumpController/ScoreSystem/CollisionSystem)과 렌더러는 본게임과 공유한다.
 */
export default function TutorialManager() {
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);
  const addPopup = useGameStore((s) => s.addPopup);
  const expirePopups = useGameStore((s) => s.expirePopups);
  const setAim = useGameStore((s) => s.setAim);
  const setChargeDistance = useGameStore((s) => s.setChargeDistance);
  const setArcHeight = useGameStore((s) => s.setArcHeight);
  const setCharging = useGameStore((s) => s.setCharging);
  const triggerTongue = useGameStore((s) => s.triggerTongue);
  const setTutorialStep = useGameStore((s) => s.setTutorialStep);
  const setTutorialCombo = useGameStore((s) => s.setTutorialCombo);
  const setTutorialHint = useGameStore((s) => s.setTutorialHint);

  // ── 시뮬레이션 상태 (refs) ──
  const frog = useRef({ x: 0, y: 0, z: 0, padLaunchAt: 0 });
  const arcHeightRef = useRef(JUMP.BASE_ARC);
  const aimDirRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeStartPx = useRef<{ x: number; y: number } | null>(null);
  const chargeDistanceRef = useRef(JUMP.MIN_DISTANCE);
  const jumpPlanRef = useRef<ReturnType<typeof makeJumpPlan> | null>(null);
  const jumpTimeRef = useRef(0);
  const lastFrameRef = useRef(gameNow());
  const popupIdRef = useRef(1);
  const padIdRef = useRef(0);
  const enemyIdRef = useRef(0);
  const itemIdRef = useRef(0);
  const progressRef = useRef<TutorialProgress>(freshProgress());
  const comboDisplayRef = useRef(0);
  const stepRef = useRef(0);
  const targetPadIdRef = useRef<number | null>(null);
  // 연속 코스 좌표 추적
  const currentBaseRef = useRef<Vec2>({ x: 0, z: 0 }); // 개구리가 서 있는 발판(다음 구간의 기준)
  const pendingNextBaseRef = useRef<Vec2>({ x: 0, z: 0 }); // 이번 구간 통과 후의 기준
  const segmentStartRef = useRef<Vec2>({ x: 0, z: 0 }); // 실패 시 복귀 위치
  const transitioningRef = useRef(false);
  const doneRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  // 로직용 데이터 (충돌/사냥은 ref에서 읽는다)
  const padsRef = useRef<LilyPadData[]>([]);
  const enemiesRef = useRef<EnemyData[]>([]);
  const itemsRef = useRef<ItemData[]>([]);

  // 렌더용 상태
  const [pads, setPads] = useState<LilyPadData[]>([]);
  const [enemies, setEnemies] = useState<EnemyData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [splashAt, setSplashAt] = useState<Fx>(null);
  const [yarrBurst, setYarrBurst] = useState<Fx>(null);
  const [launchAt, setLaunchAt] = useState<Fx>(null);
  const [, forceRender] = useState(0);

  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const aimPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), -WORLD.PAD_TOP_Y),
    [],
  );
  const mouseNdc = useMemo(() => new Vector2(), []);
  const tmpVec = useMemo(() => new Vector3(), []);
  const cursorWorld = useRef(new Vector3());

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (!mountedRef.current) return;
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  /** 점프/조준 컨트롤만 기본값으로 (개구리 위치는 건드리지 않음) */
  const resetControls = useCallback(() => {
    aimDirRef.current = 0;
    arcHeightRef.current = JUMP.BASE_ARC;
    chargingRef.current = false;
    chargeStartPx.current = null;
    chargeDistanceRef.current = JUMP.MIN_DISTANCE;
    jumpPlanRef.current = null;
    jumpTimeRef.current = 0;
    setAim(0);
    setArcHeight(JUMP.BASE_ARC);
    setChargeDistance(JUMP.MIN_DISTANCE);
    setCharging(false);
  }, [setAim, setArcHeight, setCharging, setChargeDistance]);

  /** 현재 base 앞에 한 구간(스텝)을 이어 붙인다 — 개구리는 제자리 유지 */
  const appendSegment = useCallback(
    (idx: number) => {
      const step = TUTORIAL_STEPS[idx];
      if (!step) return;
      const base = currentBaseRef.current;
      const now = gameNow();

      const newPads = step.pads.map((spec) =>
        makePad(
          ++padIdRef.current,
          base.x + spec.dx,
          base.z + spec.dz,
          spec.radius ?? LILY.RADIUS * 1.2,
        ),
      );
      const newEnemies: EnemyData[] = step.enemies.map((spec) => ({
        id: ++enemyIdRef.current,
        type: spec.type,
        position: [base.x + spec.dx, spec.dy, base.z + spec.dz],
        spawnTime: now,
        amplitude: spec.amplitude,
        active: true,
      }));
      const newItems: ItemData[] = step.items.map((spec) => ({
        id: ++itemIdRef.current,
        type: spec.type,
        position: [base.x + spec.dx, spec.dy, base.z + spec.dz],
        collected: false,
      }));

      padsRef.current = [...padsRef.current, ...newPads];
      enemiesRef.current = [...enemiesRef.current, ...newEnemies];
      itemsRef.current = [...itemsRef.current, ...newItems];
      setPads(padsRef.current);
      setEnemies(enemiesRef.current);
      setItems(itemsRef.current);

      if (step.targetIndex != null && newPads[step.targetIndex]) {
        const tp = newPads[step.targetIndex];
        targetPadIdRef.current = tp.id;
        pendingNextBaseRef.current = { x: tp.position[0], z: tp.position[2] };
      } else {
        targetPadIdRef.current = null;
        pendingNextBaseRef.current = { x: base.x, z: base.z };
      }
      segmentStartRef.current = { x: base.x, z: base.z };
      progressRef.current = freshProgress();
      comboDisplayRef.current = 0;
      setTutorialCombo(0);
      setSplashAt(null);
      resetControls();
    },
    [resetControls, setTutorialCombo],
  );

  /** 코스 초기화 — 출발 발판 + 첫 구간 */
  const resetCourse = useCallback(() => {
    padIdRef.current = 0;
    enemyIdRef.current = 0;
    itemIdRef.current = 0;
    const startPad = makePad(++padIdRef.current, 0, 0, LILY.RADIUS * 1.4);
    padsRef.current = [startPad];
    enemiesRef.current = [];
    itemsRef.current = [];
    frog.current = { x: 0, y: 0, z: 0, padLaunchAt: 0 };
    currentBaseRef.current = { x: 0, z: 0 };
    appendSegment(0);
  }, [appendSegment]);

  // 스텝 진입(마운트 + 진행)
  useEffect(() => {
    stepRef.current = stepIndex;
    setTutorialStep(stepIndex);
    setTutorialHint(null);
    if (stepIndex === 0) resetCourse();
    else appendSegment(stepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // 언마운트 정리
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      for (const id of timersRef.current) window.clearTimeout(id);
    };
  }, []);

  // 튜토리얼은 본게임과 분리된 세션 — 끝나면 메인 메뉴(로비)로 돌아간다
  const finishTutorial = useCallback(() => {
    resetRun();
    setPhase("menu");
  }, [resetRun, setPhase]);

  const completeStep = useCallback(() => {
    if (transitioningRef.current || doneRef.current) return;
    transitioningRef.current = true;
    setTutorialHint(null);
    const next = stepRef.current + 1;
    const isLast = next >= TUTORIAL_STEPS.length;
    addPopup({
      id: ++popupIdRef.current,
      type: isLast ? "Yarr" : "Great",
      text: isLast ? "튜토리얼 완료!" : "좋아요!",
      position: [frog.current.x, isLast ? 2.4 : 2.2, frog.current.z],
      bornAt: gameNowMs(),
      score: 0,
    });
    if (isLast) {
      doneRef.current = true;
      setTutorialStep(TUTORIAL_STEPS.length); // 오버레이 "완료" 표시 후 본게임으로
      schedule(finishTutorial, DONE_SHOW_MS);
      return;
    }
    schedule(() => {
      transitioningRef.current = false;
      currentBaseRef.current = { ...pendingNextBaseRef.current };
      setStepIndex(next);
    }, STEP_ADVANCE_MS);
  }, [addPopup, finishTutorial, schedule, setTutorialHint, setTutorialStep]);

  const failStep = useCallback(() => {
    if (transitioningRef.current || doneRef.current) return;
    transitioningRef.current = true;
    jumpPlanRef.current = null;
    const step = TUTORIAL_STEPS[stepRef.current];
    setSplashAt({ x: frog.current.x, z: frog.current.z, bornAt: gameNowMs() });
    playSplash();
    setTutorialHint(step?.hint ?? null);
    comboDisplayRef.current = 0;
    setTutorialCombo(0);
    schedule(() => {
      transitioningRef.current = false;
      // 이번 구간의 시작 발판으로 복귀 (코스는 그대로 유지)
      frog.current.x = segmentStartRef.current.x;
      frog.current.y = 0;
      frog.current.z = segmentStartRef.current.z;
      progressRef.current = freshProgress();
      setSplashAt(null);
      resetControls();
    }, STEP_RETRY_MS);
  }, [resetControls, schedule, setTutorialCombo, setTutorialHint]);

  /** 착지 처리 — 덮는 연잎을 찾아 판정, 없으면 실패 */
  const landFrog = useCallback(() => {
    const plan = jumpPlanRef.current;
    if (!plan) return;
    jumpPlanRef.current = null;
    const lx = plan.endX;
    const lz = plan.endZ;
    frog.current.x = lx;
    frog.current.y = 0;
    frog.current.z = lz;

    let pad: LilyPadData | null = null;
    let dist = Infinity;
    for (const p of padsRef.current) {
      const d = Math.hypot(p.position[0] - lx, p.position[2] - lz);
      if (d < p.radius && d < dist) {
        dist = d;
        pad = p;
      }
    }
    if (!pad) {
      failStep();
      return;
    }
    const j = judgeLanding(dist, pad.radius);
    if (j.type === "Miss") {
      failStep();
      return;
    }

    progressRef.current.lastLandPadId = pad.id;
    progressRef.current.consecutiveLandings += 1;
    if (j.type === "Yarr" || j.type === "Great") comboDisplayRef.current += 1;
    else comboDisplayRef.current = 0;
    setTutorialCombo(comboDisplayRef.current);

    const landAt = gameNow();
    frog.current.padLaunchAt = landAt;
    const landedId = pad.id;
    setPads((list) =>
      list.map((p) =>
        p.id === landedId ? { ...p, rippleAt: landAt, launchAt: landAt } : p,
      ),
    );
    addPopup({
      id: ++popupIdRef.current,
      type: j.type,
      text: `${judgmentText(j.type)} +${j.baseScore}`,
      position: [pad.position[0] + 0.7, pad.position[1], pad.position[2]],
      bornAt: gameNowMs(),
      score: j.baseScore,
    });
    playJudgment(j.type);
    if (j.type === "Yarr") {
      setYarrBurst({ x: pad.position[0], z: pad.position[2], bornAt: gameNowMs() });
    }
  }, [addPopup, failStep, setTutorialCombo]);

  // ── 입력 처리 (마우스/터치/키보드 + 모바일 fj:arc) ──
  useEffect(() => {
    const canvas = gl.domElement;
    const blocked = () => transitioningRef.current || doneRef.current;

    const updateAimFromClient = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(aimPlane, tmpVec);
      cursorWorld.current.copy(tmpVec);
      const dx = cursorWorld.current.x - frog.current.x;
      const dz = cursorWorld.current.z - frog.current.z;
      let dir = Math.atan2(dz, dx);
      const limit = (Math.PI / 180) * 70;
      if (dir > limit) dir = limit;
      if (dir < -limit) dir = -limit;
      aimDirRef.current = dir;
      setAim(dir);
    };

    const updateChargeFromDrag = (clientX: number, clientY: number) => {
      if (!chargeStartPx.current) return;
      const dx = clientX - chargeStartPx.current.x;
      const dy = clientY - chargeStartPx.current.y;
      const px = Math.hypot(dx, dy);
      const dist = pixelsToDistance(px);
      chargeDistanceRef.current = dist;
      setChargeDistance(dist);
    };

    const beginCharge = (clientX: number, clientY: number) => {
      if (jumpPlanRef.current) return;
      updateAimFromClient(clientX, clientY);
      chargingRef.current = true;
      chargeStartPx.current = { x: clientX, y: clientY };
      chargeDistanceRef.current = JUMP.MIN_DISTANCE;
      setChargeDistance(JUMP.MIN_DISTANCE);
      setCharging(true);
    };

    const releaseCharge = () => {
      if (!chargingRef.current) return;
      chargingRef.current = false;
      setCharging(false);
      if (jumpPlanRef.current) return;
      setTutorialHint(null);
      const plan = makeJumpPlan(
        frog.current.x,
        frog.current.z,
        aimDirRef.current,
        chargeDistanceRef.current,
        arcHeightRef.current,
        NO_WIND,
      );
      jumpPlanRef.current = plan;
      jumpTimeRef.current = 0;
      setLaunchAt({ x: frog.current.x, z: frog.current.z, bornAt: gameNowMs() });
      playWhoosh();
    };

    const cancelCharge = () => {
      if (!chargingRef.current) return;
      chargingRef.current = false;
      setCharging(false);
    };

    const huntFly = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      let tonguePos: [number, number, number] | null = null;
      const aim = aimDirRef.current;
      const cosAim = Math.cos(aim);
      const sinAim = Math.sin(aim);
      let collected = false;
      const next = itemsRef.current.map((it) => {
        if (it.collected) return it;
        tmpVec.set(it.position[0], it.position[1], it.position[2]);
        const d = raycaster.ray.distanceToPoint(tmpVec);
        const fdx = it.position[0] - frog.current.x;
        const fdz = it.position[2] - frog.current.z;
        const fd = Math.hypot(fdx, fdz);
        const forward = fdx * cosAim + fdz * sinAim;
        if (d < 0.7 && fd < 3.2 && forward > 0) {
          collected = true;
          tonguePos = [it.position[0], it.position[1], it.position[2]];
          progressRef.current.fliesEaten += 1;
          addPopup({
            id: ++popupIdRef.current,
            type: "Great",
            text: "낼름!",
            position: [it.position[0], 2.0, it.position[2]],
            bornAt: gameNowMs(),
            score: 0,
          });
          playSlurp();
          return { ...it, collected: true, collectedAt: gameNowMs() };
        }
        return it;
      });
      if (collected) {
        itemsRef.current = next;
        setItems(next);
      }
      triggerTongue(tonguePos);
    };

    const adjustArc = (dir: 1 | -1) => {
      arcHeightRef.current = Math.min(
        JUMP.ARC_MAX,
        Math.max(JUMP.ARC_MIN, arcHeightRef.current + dir * JUMP.ARC_STEP),
      );
      setArcHeight(arcHeightRef.current);
    };

    // ── 마우스 ──
    const onMouseMove = (e: MouseEvent) => {
      if (chargingRef.current && chargeStartPx.current) {
        updateChargeFromDrag(e.clientX, e.clientY);
      } else if (!jumpPlanRef.current) {
        updateAimFromClient(e.clientX, e.clientY);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (blocked()) return;
      if (e.button === 2) beginCharge(e.clientX, e.clientY);
      else if (e.button === 0) huntFly(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      releaseCharge();
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (blocked()) return;
      if (e.code === "KeyA") adjustArc(1);
      else if (e.code === "KeyS") adjustArc(-1);
    };
    const onArcEvent = (e: Event) => {
      if (blocked()) return;
      const dir = (e as CustomEvent<number>).detail;
      adjustArc(dir > 0 ? 1 : -1);
    };

    // ── 터치 ──
    const TOUCH_CHARGE_THRESHOLD = 16;
    let touchId: number | null = null;
    let touchStart: { x: number; y: number } | null = null;
    let touchCharged = false;

    const getTrackedTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) return t;
      }
      return null;
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (blocked() || touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      touchStart = { x: t.clientX, y: t.clientY };
      touchCharged = false;
      if (!jumpPlanRef.current) updateAimFromClient(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = getTrackedTouch(e);
      if (!t || !touchStart) return;
      e.preventDefault();
      if (chargingRef.current) {
        updateChargeFromDrag(t.clientX, t.clientY);
        return;
      }
      const drag = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      if (drag > TOUCH_CHARGE_THRESHOLD && !jumpPlanRef.current) {
        touchCharged = true;
        beginCharge(touchStart.x, touchStart.y);
        updateChargeFromDrag(t.clientX, t.clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = getTrackedTouch(e);
      if (!t) return;
      e.preventDefault();
      if (chargingRef.current) {
        releaseCharge();
      } else if (!touchCharged && touchStart && !blocked()) {
        huntFly(touchStart.x, touchStart.y);
      }
      touchId = null;
      touchStart = null;
      touchCharged = false;
    };
    const onTouchCancel = (e: TouchEvent) => {
      if (!getTrackedTouch(e)) return;
      cancelCharge();
      touchId = null;
      touchStart = null;
      touchCharged = false;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("fj:arc", onArcEvent as EventListener);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchCancel, { passive: false });
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("fj:arc", onArcEvent as EventListener);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [
    aimPlane,
    camera,
    gl,
    mouseNdc,
    raycaster,
    tmpVec,
    addPopup,
    setAim,
    setArcHeight,
    setCharging,
    setChargeDistance,
    setTutorialHint,
    triggerTongue,
  ]);

  // ── 시뮬레이션 루프 ──
  useFrame(() => {
    const now = gameNow();
    const dt = Math.min(0.05, now - lastFrameRef.current);
    lastFrameRef.current = now;

    if (transitioningRef.current || doneRef.current) {
      forceRender((x) => x + 1);
      return;
    }

    expirePopups(gameNowMs());

    if (jumpPlanRef.current) {
      jumpTimeRef.current += dt;
      const t = jumpTimeRef.current / jumpPlanRef.current.duration;
      const s = sampleJump(jumpPlanRef.current, t);
      frog.current.x = s.x;
      frog.current.y = s.y;
      frog.current.z = s.z;
      if (checkAirborneHit(s, enemiesRef.current, now)) {
        failStep();
        forceRender((x) => x + 1);
        return;
      }
      if (t >= 1) landFrog();
    }

    const step = TUTORIAL_STEPS[stepRef.current];
    if (step && step.isComplete(progressRef.current, targetPadIdRef.current)) {
      completeStep();
    }

    forceRender((x) => x + 1);
  });

  // ── 후보 연잎 (조준 방향에 가장 가까운 전방 연잎) ──
  const now = gameNow();
  let candidatePadId: number | null = null;
  if (!jumpPlanRef.current) {
    const aimDir = aimDirRef.current;
    const cosA = Math.cos(aimDir);
    const sinA = Math.sin(aimDir);
    const maxFwd = JUMP.MAX_DISTANCE + 2;
    let best = Infinity;
    for (const p of pads) {
      const dx = p.position[0] - frog.current.x;
      const dz = p.position[2] - frog.current.z;
      const forward = dx * cosA + dz * sinA;
      if (forward < 0.8 || forward > maxFwd) continue;
      const lateral = Math.abs(-dx * sinA + dz * cosA);
      if (lateral / forward > 0.7) continue;
      const score = lateral + forward * 0.04;
      if (score < best) {
        best = score;
        candidatePadId = p.id;
      }
    }
  }

  return (
    <>
      <CameraController
        targetX={frog.current.x}
        targetZ={frog.current.z}
        shake={0}
        zoomIn={false}
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
        isDead={splashAt !== null}
        isSwimming={false}
        swimDir={0}
        crocSnap={null}
      />
      {pads.map((p) => (
        <LilyPad
          key={p.id}
          pad={p}
          now={now}
          isCandidate={p.id === candidatePadId}
        />
      ))}
      <EnemyManager enemies={enemies} now={now} />
      <ItemManager items={items} now={now} frogRef={frog} />
      <EffectsManager
        frogX={frog.current.x}
        frogZ={frog.current.z}
        aimDir={aimDirRef.current}
        chargeDist={chargeDistanceRef.current}
        arcHeight={arcHeightRef.current}
        isCharging={chargingRef.current}
        isJumping={!!jumpPlanRef.current}
        isSwimming={false}
        yarrBurst={yarrBurst}
        splashAt={splashAt}
        swimSplashAt={null}
        launchAt={launchAt}
        comboBreakAt={null}
        crocSnapAt={null}
      />
    </>
  );
}
