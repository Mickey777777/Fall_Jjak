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
import CrocEnemy, { SHOW_DIST as CROC_SHOW_DIST, KILL_DIST as CROC_KILL_DIST } from "./CrocEnemy";

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
  BuffType,
  EnemyData,
  ItemData,
  LilyPadData,
  WeatherType,
} from "./types";
import { playComboBreak, playComboFreeze, playComboUp, playCrocSnap, playCrocWarnIfNeeded, playJudgment, playSplash, playSlurp, playSpring, playWhoosh } from "./sound";
import { gameNow, gameNowMs } from "./gameClock";
// 🧪 디버그: 특정 연잎만 스폰 (테스트 끝나면 null로)
const DEBUG_FORCE_PAD_TYPE: LilyPadData["type"] | null = null;

interface Props {
  paused: boolean;
}
// 🧪 디버그: 특정 파리(아이템)만 스폰 + 초반부터 항상 등장 (예: "swim" → 오라/수영 테스트). 끝나면 null로
const DEBUG_FORCE_ITEM_TYPE: ItemData["type"] | null = null;
// 🧪 디버그: 적(새/물고기) 항상 스폰, obstacle 제외 (테스트 끝나면 false로)
const DEBUG_ALWAYS_SPAWN_ENEMY = false;
// 🧪 디버그: 특정 적만 스폰 + 초반부터 항상 등장 ("fish"/"bird"/"obstacle"). 끝나면 null로
// (fish+bird 둘 다 한꺼번에 보려면 이 값을 null로 두고 DEBUG_ALWAYS_SPAWN_ENEMY=true)
const DEBUG_FORCE_ENEMY_TYPE: EnemyData["type"] | null = null;
// 🧪 디버그: 게임 시작 시 들고 시작할 버프 (예: ["swim"] → 수영 부활 테스트). 끝나면 [] 로
const DEBUG_START_BUFFS: BuffType[] = ["comboFreeze"];
// 🧪 디버그: 날씨 고정 (예: "rain" → 폭우/번개 테스트). 자동 사이클 중단. 끝나면 null로
const DEBUG_FORCE_WEATHER: WeatherType | null = null;
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
  const resetCombo = useGameStore((s) => s.resetCombo);
  const addPopup = useGameStore((s) => s.addPopup);
  const expirePopups = useGameStore((s) => s.expirePopups);
  const incrementFlies = useGameStore((s) => s.incrementFlies);
  const incrementPads = useGameStore((s) => s.incrementPads);
  const finishRun = useGameStore((s) => s.finishRun);
  const setWeather = useGameStore((s) => s.setWeather);
  const tickBuffs = useGameStore((s) => s.tickBuffs);
  const addBuff = useGameStore((s) => s.addBuff);
  const consumeSwimBuff = useGameStore((s) => s.consumeSwimBuff);
  const consumeComboFreeze = useGameStore((s) => s.consumeComboFreeze);
  const triggerTongue = useGameStore((s) => s.triggerTongue);
  const setCrocDanger = useGameStore((s) => s.setCrocDanger);
  const setComboIdleWarn = useGameStore((s) => s.setComboIdleWarn);
  // 진짜 일시정지(=paused 페이즈)인지 — 게임오버/메뉴는 사망 연출이 재생돼야 하므로 제외.
  // 델타 기반 모션(악어)을 멈출 때 이 값을 쓴다 (게임 시계 정지 조건과 동일).
  const trulyPaused = useGameStore((s) => s.phase === "paused");

  // ──────── 시뮬레이션 상태 (ref로 보관해 매 프레임 자유롭게 변경) ────────
  const frog = useRef({ x: 0, y: 0, z: 0, padLaunchAt: 0 });
  const arcHeightRef = useRef(JUMP.BASE_ARC);
  const aimDirRef = useRef(0);
  const chargingRef = useRef(false);
  const chargeStartPx = useRef<{ x: number; y: number } | null>(null);
  const chargeDistanceRef = useRef(JUMP.MIN_DISTANCE);
  const jumpPlanRef = useRef<ReturnType<typeof makeJumpPlan> | null>(null);
  const jumpTimeRef = useRef(0);
  const lastFrameRef = useRef(gameNow());
  const padIdRef = useRef(1);
  const enemyIdRef = useRef(1);
  const itemIdRef = useRef(1);
  const popupIdRef = useRef(1);
  const weatherTimer = useRef(0);
  const nextWeatherIn = useRef(20);
  const shakeRef = useRef(0);
  const zoomRef = useRef(false);
  // 마지막 착지 시각(초) — 이후 일정 시간 머뭇거리면 콤보 초기화
  const lastLandAtRef = useRef(gameNow());
  const comboIdleWarnRef = useRef(-1); // 마지막으로 store에 쓴 양자화 경고값 (재렌더 최소화)
  const lastLightningShakeRef = useRef(useGameStore.getState().lightningShakeAt); // 마지막 처리한 번개 흔들림 타임스탬프
  const [yarrBurst, setYarrBurst] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  const [splashAt, setSplashAt] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  // 수영 부활 전용 물보라 — splashAt(죽음 신호)과 분리 (isDead 트리거 방지)
  const [swimSplashAt, setSwimSplashAt] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  const [launchAt, setLaunchAt] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  const [comboBreakAt, setComboBreakAt] = useState<{ x: number; z: number; bornAt: number } | null>(null);
  const [crocSnapAt, setCrocSnapAt] = useState<{ x: number; z: number; cx: number; cz: number; bornAt: number } | null>(null);

  // 악어 위치 (월드 좌표)
  const crocRef = useRef({ x: -ENEMY.CROC_BASE_DISTANCE, z: 0 });
  // 직전 프레임의 경고 상태 — store 업데이트를 변화 시점에만 호출하기 위해
  const crocDangerRef = useRef(-1); // 마지막으로 store에 쓴 양자화 위험도 (재렌더 최소화)

  const slideRef = useRef<{
    vx: number;
    vz: number;
    remaining: number;
    duration: number;
  } | null>(null);
  const swimStabilizedRef = useRef(new Set<number>());
  // 점프 발사 시 떠난 연잎에 출렁 반동을 줄 대기 위치 (프레임 루프에서 가장 가까운 연잎에 태그)
  const launchPadPosRef = useRef<{ x: number; z: number } | null>(null);
  // 수영 부활 헤엄 글라이드 — 떨어진 지점에서 목표 연잎까지 물 위를 헤엄쳐 이동
  const swimGlideRef = useRef<{
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    padId: number;
    startedAt: number; // gameNow()
    duration: number;
    splashFired: boolean; // 도착 직전 물보라를 미리 한 번만 터뜨렸는지
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

  // 🧪 디버그: 게임 시작 시 버프 부여 + 날씨 고정. 컴포넌트는 runId마다 리마운트되므로 매 게임 1회 실행
  useEffect(() => {
    for (const t of DEBUG_START_BUFFS) {
      if (t === "swim") addBuff({ type: "swim", remaining: 9999 });
      else if (t === "rangeUp") addBuff({ type: "rangeUp", remaining: 999 });
      else if (t === "scoreBoost") addBuff({ type: "scoreBoost", remaining: 999 });
      else if (t === "comboFreeze") addBuff({ type: "comboFreeze", remaining: 9999 });
    }
    if (DEBUG_FORCE_WEATHER) {
      const wind =
        DEBUG_FORCE_WEATHER === "wind"
          ? { direction: (Math.random() - 0.5) * Math.PI, strength: 0.8 }
          : { direction: 0, strength: 0 };
      setWeather(DEBUG_FORCE_WEATHER, wind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────── 입력 핸들러 ────────
  useEffect(() => {
    const canvas = gl.domElement;

    // 화면 좌표 → 개구리 기준 조준 방향(±70° 제한)으로 갱신.
    // 빠른 클릭으로 mousemove가 누락되거나 점프 비행 중 갱신이 막혀도
    // 조준이 최신이 되도록, 충전 시작(눌렀을 때)에도 호출한다.
    const updateAimFromClient = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      raycaster.ray.intersectPlane(aimPlane, tmpVec);
      cursorWorld.current.copy(tmpVec);
      // 조준 방향: 개구리 → 커서 (단, X+ 방향에 한해 ±70도로 제한)
      const dx = cursorWorld.current.x - frog.current.x;
      const dz = cursorWorld.current.z - frog.current.z;
      let dir = Math.atan2(dz, dx);
      const limit = (Math.PI / 180) * 70;
      if (dir > limit) dir = limit;
      if (dir < -limit) dir = -limit;
      aimDirRef.current = dir;
      setAim(dir);
    };

    // 충전(드래그) 시작점에서의 화면 거리 → 점프 거리로 변환.
    const updateChargeFromDrag = (clientX: number, clientY: number) => {
      if (!chargeStartPx.current) return;
      const dx = clientX - chargeStartPx.current.x;
      const dy = clientY - chargeStartPx.current.y;
      const px = Math.hypot(dx, dy);
      // rangeUp 버프는 "최댓값"만 늘림 — 최솟값과 평상시 사거리 감각은 그대로 유지
      const hasRangeUp = useGameStore
        .getState()
        .buffs.some((b) => b.type === "rangeUp");
      const maxDist = JUMP.MAX_DISTANCE * (hasRangeUp ? 1.3 : 1);
      const dist = pixelsToDistance(px, maxDist);
      chargeDistanceRef.current = dist;
      setChargeDistance(dist);
    };

    // 충전 시작 — 누른 지점으로 조준을 고정하고 게이지를 켠다.
    const beginCharge = (clientX: number, clientY: number) => {
      if (jumpPlanRef.current) return;
      updateAimFromClient(clientX, clientY);
      chargingRef.current = true;
      chargeStartPx.current = { x: clientX, y: clientY };
      chargeDistanceRef.current = JUMP.MIN_DISTANCE;
      setChargeDistance(JUMP.MIN_DISTANCE);
      setCharging(true);
    };

    // 충전 해제 → 점프 발사.
    const releaseCharge = () => {
      if (!chargingRef.current) return;
      chargingRef.current = false;
      setCharging(false);
      if (jumpPlanRef.current) return;
      // 충전 시점에 이미 rangeUp 최댓값이 반영된 거리가 들어있음 — 추가 보정 불필요
      const dist = chargeDistanceRef.current;
      // 회전 연잎 어긋남 적용 (보이지 않게)
      const finalAim = aimDirRef.current + rotatingShiftRef.current;
      const plan = makeJumpPlan(
        frog.current.x,
        frog.current.z,
        finalAim,
        dist,
        arcHeightRef.current,
        useGameStore.getState().wind,
      );
      jumpPlanRef.current = plan;
      jumpTimeRef.current = 0;
      slideRef.current = null;
      currentPadRef.current = null;
      rotatingShiftRef.current = 0; // ← 한 번 쓰고 초기화
      // 도약 발사 연출 — 떠나는 자리에 물 차고 오름 + 휙 사운드
      setLaunchAt({ x: frog.current.x, z: frog.current.z, bornAt: gameNowMs() });
      playWhoosh();
      // 떠난 연잎이 다이빙대처럼 출렁이도록 — 프레임 루프에서 가장 가까운 연잎에 태그
      launchPadPosRef.current = { x: frog.current.x, z: frog.current.z };
    };

    // 충전 취소(점프하지 않음) — 터치 취소(touchcancel) 등에 사용.
    const cancelCharge = () => {
      if (!chargingRef.current) return;
      chargingRef.current = false;
      setCharging(false);
    };

    // 혀 낼름 + 파리 사냥 시도. 좌클릭/탭 공용.
    // 파리는 공중에 있으므로 ground 투영이 아니라 실제 광선과 파리 3D 위치의 거리로 판정한다.
    const huntFly = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNdc, camera);
      // 잡힌 파리의 월드 좌표 — 혀가 여기까지 뻗음 (없으면 기본 낼름)
      let tonguePos: [number, number, number] | null = null;
      setItems((list) => {
        let collected = false;
        const aim = aimDirRef.current;
        const cosAim = Math.cos(aim);
        const sinAim = Math.sin(aim);
        const next = list.map((it) => {
          if (it.collected) return it;
          // 광선과 파리 3D 위치의 최단 거리
          tmpVec.set(it.position[0], it.position[1], it.position[2]);
          const d = raycaster.ray.distanceToPoint(tmpVec);
          // 개구리와의 거리도 일정 이내여야 함
          const fdx = it.position[0] - frog.current.x;
          const fdz = it.position[2] - frog.current.z;
          const fd = Math.hypot(fdx, fdz);
          // 개구리는 고개를 못 돌리므로 정면에 있는 파리만 혀가 닿음
          const forward = fdx * cosAim + fdz * sinAim;
          // 혀 사거리 — 너무 멀리 있는 파리는 잡을 수 없음 (혀가 짧음)
          if (d < 0.7 && fd < 3.2 && forward > 0) {
            collected = true;
            tonguePos = [it.position[0], it.position[1], it.position[2]];
            incrementFlies();
            const gained = addScore(SCORECONST.FLY_BONUS, "Great");
            addPopup({
              id: ++popupIdRef.current,
              type: "Great",
              text: `+${gained} 낼름!`,
              position: [it.position[0], 2.0, it.position[2]],
              bornAt: gameNowMs(),
              score: gained,
            });
            if (it.type === "swim") addBuff({ type: "swim", remaining: 9999 });
            if (it.type === "rangeUp") addBuff({ type: "rangeUp", remaining: 8 });
            if (it.type === "scoreBoost")
              addBuff({ type: "scoreBoost", remaining: 6 });
            // 콤보 프리징 — 시간제한 없는 1회성 (swim처럼 remaining 큰 값)
            if (it.type === "comboFreeze") addBuff({ type: "comboFreeze", remaining: 9999 });
            playSlurp();
            return { ...it, collected: true, collectedAt: gameNowMs() };
          }
          return it;
        });
        return collected ? next : list;
      });
      // 파리를 잡았으면 그 위치로 혀를 뻗고, 아니면 앞으로 짧게 낼름
      triggerTongue(tonguePos);
    };

    // 궤적 높이 조절 (A/S 키 및 모바일 ▲/▼ 버튼 공용).
    const adjustArc = (dir: 1 | -1) => {
      arcHeightRef.current = Math.min(
        JUMP.ARC_MAX,
        Math.max(JUMP.ARC_MIN, arcHeightRef.current + dir * JUMP.ARC_STEP),
      );
      setArcHeight(arcHeightRef.current);
    };

    // ──────── 마우스 (데스크톱) ────────
    const onMouseMove = (e: MouseEvent) => {
      // 충전 중이면 드래그 거리 = 화면상 우클릭 시작점에서의 거리
      if (chargingRef.current && chargeStartPx.current) {
        updateChargeFromDrag(e.clientX, e.clientY);
      } else if (!jumpPlanRef.current) {
        updateAimFromClient(e.clientX, e.clientY);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (paused) return;
      if (e.button === 2) beginCharge(e.clientX, e.clientY); // 우클릭: 충전 시작
      else if (e.button === 0) huntFly(e.clientX, e.clientY); // 좌클릭: 파리 사냥
    };

    const onMouseUp = (e: MouseEvent) => {
      if (paused) return;
      if (e.button !== 2) return;
      releaseCharge();
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyA") adjustArc(1);
      else if (e.code === "KeyS") adjustArc(-1);
    };

    // 모바일 ▲/▼ 버튼 → 동일한 궤적 조절 로직 구동
    const onArcEvent = (e: Event) => {
      const dir = (e as CustomEvent<number>).detail;
      adjustArc(dir > 0 ? 1 : -1);
    };

    // ──────── 터치 (모바일) ────────
    // 한 손가락 드래그 = 조준+충전+점프, 가벼운 탭 = 파리 사냥.
    // 끌기 임계값으로 둘을 구분해 의도치 않은 미니 점프(=익사)를 막는다.
    const TOUCH_CHARGE_THRESHOLD = 16; // px — 이 이상 끌어야 탭이 아닌 충전으로 인식
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
      e.preventDefault(); // 스크롤/확대 및 합성 마우스 이벤트 방지
      if (paused || touchId !== null) return; // 이미 한 손가락 추적 중이면 무시
      const t = e.changedTouches[0];
      touchId = t.identifier;
      touchStart = { x: t.clientX, y: t.clientY };
      touchCharged = false;
      // 누른 지점으로 조준 고정 (데스크톱 우클릭 누름과 동일)
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
        beginCharge(touchStart.x, touchStart.y); // 충전 기준점 = 최초 터치 지점
        updateChargeFromDrag(t.clientX, t.clientY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = getTrackedTouch(e);
      if (!t) return;
      e.preventDefault();
      if (chargingRef.current) {
        releaseCharge();
      } else if (!touchCharged && touchStart && !paused) {
        // 끌지 않고 뗀 탭 → 파리 사냥 (미니 점프 발생 안 함)
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
    const now = gameNow();
    const dt = Math.min(0.05, now - lastFrameRef.current);
    lastFrameRef.current = now;
    // paused 여부와 관계없이 shake는 항상 감쇠
    shakeRef.current = Math.max(0, shakeRef.current - dt * 3.5);

    if (paused) {
      forceRender((x) => x + 1);
      return;
    }

    expirePopups(gameNowMs());
    tickBuffs(dt);

    // 가까운 번개 — 카메라 흔들림 (WeatherSystem이 lightningShakeAt 갱신)
    {
      const lsa = useGameStore.getState().lightningShakeAt;
      if (lsa !== lastLightningShakeRef.current) {
        lastLightningShakeRef.current = lsa;
        if (lsa > 0) shakeRef.current = Math.max(shakeRef.current, 0.55);
      }
    }

    // ── 콤보 idle 리셋 + 끊김 경고 ──
    // 제한 시간 = 기본 10초에서 콤보 배율 등급이 오를 때마다 0.5초씩 감소(최소 2초).
    // 남은 시간이 경고 구간(COMBO_IDLE_WARN_WINDOW)에 들면 0→1 경고값을 HUD로 보낸다.
    // 비행 중·수영 복귀 중에는 행동 중이므로 제외.
    {
      let warn = 0;
      if (!jumpPlanRef.current && !swimGlideRef.current) {
        const combo = useGameStore.getState().combo;
        if (combo > 0) {
          const tiers = SCORECONST.COMBO_TIERS.filter(
            (tt) => tt.combo > 0 && combo >= tt.combo,
          ).length;
          const idleLimit = Math.max(
            SCORECONST.COMBO_IDLE_RESET_MIN,
            SCORECONST.COMBO_IDLE_RESET_BASE - tiers * SCORECONST.COMBO_IDLE_RESET_PER_TIER,
          );
          const remaining = idleLimit - (now - lastLandAtRef.current);
          if (remaining <= 0) {
            // 콤보 프리징 보유 시 idle 끊김도 1회 막아줌 — 타이머만 리셋
            if (consumeComboFreeze()) {
              addPopup({
                id: ++popupIdRef.current,
                type: "Great",
                text: "콤보 유지!",
                position: [frog.current.x, 2.2, frog.current.z],
                bornAt: gameNowMs(),
                score: 0,
              });
              useGameStore.getState().triggerComboFreeze();
              playComboFreeze();
            } else {
              resetCombo();
              setComboBreakAt({ x: frog.current.x, z: frog.current.z, bornAt: gameNowMs() });
              playComboBreak();
            }
            lastLandAtRef.current = now; // 중복 발동 방지
          } else {
            // 남은 시간이 제한의 절반 이하로 떨어지면 0→1로 선형 상승 (절반=0, 임박=1)
            const warnStart = idleLimit * SCORECONST.COMBO_IDLE_WARN_FRACTION;
            warn = remaining < warnStart ? Math.min(1, (warnStart - remaining) / warnStart) : 0;
          }
        }
      }
      // 0.05 단계로 양자화해 변할 때만 store 갱신 (재렌더 최소화)
      const qWarn = Math.round(warn * 20) / 20;
      if (qWarn !== comboIdleWarnRef.current) {
        comboIdleWarnRef.current = qWarn;
        setComboIdleWarn(qWarn);
      }
    }

    // ── 수영 부활 헤엄 글라이드 ──
    // 물 위를 헤엄쳐 목표 연잎으로 이동하는 동안은 다른 시뮬레이션(착지·낙하·악어)을 멈춘다.
    if (swimGlideRef.current) {
      const g = swimGlideRef.current;
      const t = Math.min(1, (now - g.startedAt) / g.duration);
      const ease = t * t * (3 - 2 * t); // smoothstep
      frog.current.x = g.fromX + (g.toX - g.fromX) * ease;
      frog.current.z = g.fromZ + (g.toZ - g.fromZ) * ease;
      // 살짝 잠겼다가 도착하며 떠오름 (반원 dip)
      frog.current.y = -Math.sin(t * Math.PI) * 0.28;
      // 연잎에 올라설 즈음(중앙 도착 전) 미리 솟아오르는 물보라 — 도착 시점보다 빠르게
      if (!g.splashFired && t >= 0.7) {
        g.splashFired = true;
        setSwimSplashAt({ x: g.toX, z: g.toZ, bornAt: gameNowMs() });
        playSplash();
      }
      if (t >= 1) {
        const arrived = swimGlideRef.current;
        swimGlideRef.current = null;
        arriveFromSwim(arrived.padId, arrived.toX, arrived.toZ);
      }
      forceRender((x) => x + 1); // 카메라·헤엄 포즈가 매 프레임 따라오도록
      return;
    }

    // ── 점프 발사 출렁: 떠난 위치에서 가장 가까운 연잎에 launchAt 태그 ──
    if (launchPadPosRef.current) {
      const lp = launchPadPosRef.current;
      launchPadPosRef.current = null;
      let bestId: number | null = null;
      let bestD = Infinity;
      for (const p of pads) {
        if (p.destroyed) continue;
        // 이동 연잎은 현재 시각 위치로 보정
        let px = p.position[0];
        let pz = p.position[2];
        if (p.type === "moving") {
          const tt = now - p.spawnTime;
          const offset = Math.sin(tt * (p.frequency ?? 0.8)) * (p.amplitude ?? 1.4);
          if (p.axis === "x") px += offset;
          else pz += offset;
        }
        const d = Math.hypot(px - lp.x, pz - lp.z);
        if (d < bestD) {
          bestD = d;
          bestId = p.id;
        }
      }
      if (bestId != null && bestD < 1.6) {
        setPads((list) =>
          list.map((p) => (p.id === bestId ? { ...p, launchAt: now } : p)),
        );
      }
    }

    // ── 악어 이동 및 충돌 ──
    {
      const crocDiff = Math.min(1, useGameStore.getState().score / ENEMY.CROC_SPEED_MAX_SCORE);
      const crocSpeed = ENEMY.CROC_SPEED + (ENEMY.CROC_SPEED_MAX - ENEMY.CROC_SPEED) * crocDiff; // 1.0 → 2.6 m/s (점수 0→3000)
      crocRef.current.x += crocSpeed * dt;
      // Z 방향으로 개구리를 느리게 추적 (프레임독립적 lerp)
      crocRef.current.z += (frog.current.z - crocRef.current.z) * (1 - Math.exp(-1.2 * dt));

      const cdx = frog.current.x - crocRef.current.x;
      const cdz = frog.current.z - crocRef.current.z;
      const crocDist = Math.hypot(cdx, cdz);

      // 경고 (SHOW_DIST=화면 등장 이내) — 거리 비례 위험도 0~1을 양자화해 변할 때만 store 갱신
      const nowWarn = crocDist < CROC_SHOW_DIST;
      const rawDanger = nowWarn
        ? Math.min(1, Math.max(0, (CROC_SHOW_DIST - crocDist) / (CROC_SHOW_DIST - CROC_KILL_DIST)))
        : 0;
      const qDanger = Math.round(rawDanger * 25) / 25; // 0.04 단계
      if (qDanger !== crocDangerRef.current) {
        crocDangerRef.current = qDanger;
        setCrocDanger(qDanger);
      }
      if (nowWarn) playCrocWarnIfNeeded(crocDist);

      // 충돌 (지면에 있을 때만)
      if (!jumpPlanRef.current && crocDist < CROC_KILL_DIST) {
        setCrocSnapAt({
          x: frog.current.x, z: frog.current.z,
          cx: crocRef.current.x, cz: crocRef.current.z,
          bornAt: gameNowMs(),
        });
        shakeRef.current = 1.8;
        addPopup({
          id: ++popupIdRef.current,
          type: "Chomp",
          text: "CHOMP!",
          position: [frog.current.x, 2.2, frog.current.z],
          bornAt: gameNowMs(),
          score: 0,
        });
        playCrocSnap();
        finishRun();
        return;
      }
    }

    // 카메라 shake 감쇠 (paused 전에도 처리됨)
    if (zoomRef.current && now - (zoomReleaseAt.current ?? 0) > 0.35) {
      zoomRef.current = false;
    }

    // 날씨 타이머 — 단, 드래그(충전)로 점프를 조준 중일 땐 날씨 변경을 미룬다.
    // 이미 점프를 결정한 상태에서 바람 등이 바뀌면 불공평하게 작용하기 때문.
    weatherTimer.current += dt;
    if (!DEBUG_FORCE_WEATHER && weatherTimer.current >= nextWeatherIn.current && !chargingRef.current) {
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
      const hit = checkAirborneHit(s, enemies, now);
      if (hit) {
        const sx = frog.current.x;
        const sz = frog.current.z;
        frog.current.y = 0;
        setSplashAt({ x: sx, z: sz, bornAt: gameNowMs() });
        playSplash();
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
          // rotten 만료
          if (now - p.steppedAt >= LILY.ROTTEN_LIFETIME) {
            handleFall(frog.current.x, frog.current.z, p.id);
            return;
          }
        }
      }

      // 4. 점멸 연잎 검사 (기존)
      for (const p of pads) {
        if (p.type !== "blinking") continue;
        const dx = p.position[0] - fx;
        const dz = p.position[2] - fz;
        if (Math.hypot(dx, dz) >= p.radius) continue;

        if (swimStabilizedRef.current.has(p.id)) {
          // 수영 복귀 점멸 연잎: 1초 안정 → 줄어들기 시작 → ROTTEN_LIFETIME 후 붕괴
          if (p.steppedAt != null) {
            const elapsed = now - p.steppedAt;
            if (elapsed >= 1.0 + LILY.ROTTEN_LIFETIME) {
              handleFall(frog.current.x, frog.current.z, p.id);
              return;
            } else if (elapsed >= 1.0 && p.swimShrinkAt == null) {
              // 줄어들기 시작 타임스탬프 기록
              setPads((list) =>
                list.map((pad) =>
                  pad.id === p.id ? { ...pad, swimShrinkAt: now } : pad,
                ),
              );
            }
          }
          continue;
        }

        if (p.steppedAt != null) continue; // 정상 착지로 안정화된 연잎
        const cycle = ((now - p.spawnTime) % LILY.BLINK_PERIOD) / LILY.BLINK_PERIOD;
        // blinking 꺼진 상태
        if (cycle >= LILY.BLINK_VISIBLE_RATIO) {
          handleFall(frog.current.x, frog.current.z, p.id);
          return;
        }
      }

      // 5. 슬라이드 (기존)
      if (slideRef.current) {
        const s = slideRef.current;
        const linear = Math.max(0, s.remaining / s.duration);
        const ratio = Math.pow(linear, 1.5);
        const step = Math.min(s.remaining, dt);
        const dx = s.vx * step * ratio;
        const dz = s.vz * step * ratio;
        frog.current.x += dx;
        frog.current.z += dz;
        // 이동 연잎 위에서는 추적 로직이 매 프레임 frog 위치를 연잎 기준으로
        // 덮어쓰므로, 미끄러짐이 지워지지 않도록 연잎 기준 오프셋에도 누적한다.
        if (currentPadRef.current) {
          currentPadRef.current.offsetX += dx;
          currentPadRef.current.offsetZ += dz;
        }
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
        handleFall(frog.current.x, frog.current.z);
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
    const nowSec = gameNow();
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

    // 점멸 연잎이 지금 켜져(밟을 수 있게) 보이는 상태인지
    const blinkVisible = (p: LilyPadData) => {
      if (p.type !== "blinking" || p.steppedAt != null) return true;
      const cycle = ((nowSec - p.spawnTime) % LILY.BLINK_PERIOD) / LILY.BLINK_PERIOD;
      return cycle < LILY.BLINK_VISIBLE_RATIO;
    };
    const isSafe = (p: LilyPadData) => p.type !== "trap" && blinkVisible(p);

    // 착지점을 실제로 덮는(dist < radius) 안전 연잎 중 중심에 가장 가까운 것을 고른다.
    // 생존 검사(onPad)와 동일한 기준이라 "점수 획득 ⟺ 연잎 위 ⟺ 생존"이 보장된다.
    // (중심거리만 보는 nearestPad는 겹친 연잎에서 올라탄 연잎을 놓칠 수 있어 쓰지 않는다.)
    let pad: LilyPadData | null = null;
    let dist = Infinity;
    for (const p of padsForCollision) {
      if (p.destroyed || !isSafe(p)) continue;
      const d = Math.hypot(p.position[0] - lx, p.position[2] - lz);
      if (d < p.radius && d < dist) {
        dist = d;
        pad = p;
      }
    }

    // 덮는 안전 연잎이 없으면 사망 (물 / 함정 / 꺼진 점멸 모두 동일 처리)
    if (!pad) {
      handleFall(lx, lz);
      return;
    }

    // 판정 (덮는 안전 연잎이므로 Miss는 나오지 않지만, 점수 tier 계산을 위해 호출)
    const j = judgeLanding(dist, pad.radius);
    if (j.type === "Miss") {
      handleFall(lx, lz);
      return;
    }
    // 콤보 배율 적용 — NotBad는 콤보를 끊으므로 배율 혜택을 받지 않는다
    const combo = useGameStore.getState().combo;
    // 콤보 프리징: NotBad로 콤보가 끊길 상황(콤보 1+)이면 1회 소모해 콤보 유지
    const froze = j.type === "NotBad" && combo > 0 && consumeComboFreeze();
    // 프리징으로 콤보를 지켜냈으면 NotBad라도 콤보 배율을 적용한다
    const mult = j.type === "NotBad" && !froze ? 1 : comboMultiplier(combo);
    const raw = Math.round(j.baseScore * mult);
    const gained = addScore(raw, j.type, froze);
    incrementPads();
    lastLandAtRef.current = gameNow(); // 콤보 idle 타이머 갱신

    // 콤보 프리징 발동 — 콤보를 지켜낸 피드백 (얼음 반짝 팝업 + 사운드)
    if (froze) {
      addPopup({
        id: ++popupIdRef.current,
        type: "Great",
        text: "콤보 유지!",
        position: [pad.position[0], 2.2, pad.position[2]],
        bornAt: gameNowMs(),
        score: 0,
      });
      useGameStore.getState().triggerComboFreeze();
      playComboFreeze();
    }

    // 콤보 등급 상승 감지 — 배율이 한 단계 오른 순간 축하 버스트 (등급 5단위)
    const comboAfter = useGameStore.getState().combo;
    if (comboMultiplier(comboAfter) > comboMultiplier(combo)) {
      const tier = Math.floor(comboAfter / 5);
      // 화면 전체 랭크업 연출 트리거 (HUD가 구독)
      useGameStore.getState().triggerComboRankUp(tier, comboMultiplier(comboAfter));
      playComboUp(tier);
      // 등급 높을수록 약간 강한 카메라 펀치
      shakeRef.current = Math.max(shakeRef.current, 0.2 + Math.min(0.25, tier * 0.03));
    }

    // 콤보 끊김 피드백 — 쌓인 콤보(3+)가 NotBad로 리셋되는 순간 회색 조각이 흩어져 떨어짐
    // (프리징으로 콤보를 지켜냈으면 끊김 연출 생략)
    if (j.type === "NotBad" && combo >= 3 && !froze) {
      setComboBreakAt({
        x: pad.position[0],
        z: pad.position[2],
        bornAt: gameNowMs(),
      });
      playComboBreak();
      shakeRef.current = Math.max(shakeRef.current, 0.3);
    }

    // 착지 연잎에 파문 + 출렁 반동(발사 때와 동일한 launchAt) 트리거
    const landAt = gameNow();
    setPads((list) =>
      list.map((p) =>
        p.id === pad.id ? { ...p, rippleAt: landAt, launchAt: landAt } : p,
      ),
    );
    // 개구리도 같은 타이밍으로 발판 출렁을 따라 까딱이도록
    frog.current.padLaunchAt = landAt;

    addPopup({
      id: ++popupIdRef.current,
      type: j.type,
      text: `${judgmentText(j.type)}  +${gained}`,
      position: [pad.position[0] + 0.7, pad.position[1], pad.position[2]],
      bornAt: gameNowMs(),
      score: gained,
    });
    playJudgment(j.type);

    if (j.type === "Yarr") {
      shakeRef.current = 0.4;
      zoomRef.current = true;
      zoomReleaseAt.current = gameNow();
      setYarrBurst({ x: pad.position[0], z: pad.position[2], bornAt: gameNowMs() });
    } else {
      shakeRef.current = Math.max(shakeRef.current, 0.15);
    }

    // 연잎 효과 적용
    if (pad.type === "rotten") {
      setPads((list) =>
        list.map((p) =>
          p.id === pad.id
            ? { ...p, steppedAt: gameNow() }
            : p,
        ),
      );
    }
    // ★ 점멸 연잎도 밟으면 안정화 (steppedAt 기록) — 정상 착지이므로 swim 카운트다운 해제
    if (pad.type === "blinking") {
      swimStabilizedRef.current.delete(pad.id);
      setPads((list) =>
        list.map((p) =>
          p.id === pad.id
            ? { ...p, steppedAt: gameNow() }
            : p,
        ),
      );
    }
    if (pad.type === "slippery" || useGameStore.getState().weather === "rain") {
      // 점프 방향으로 미끄러짐(모멘텀). 거리를 "착지 연잎 크기"에 비례시킨다.
      // 작은 연잎일수록 덜 미끄러지지만, 잘못 착지하면 여전히 미끄러져 죽을 수 있음.
      const incomingDist = Math.hypot(
        plan.endX - plan.startX,
        plan.endZ - plan.startZ,
      );
      // 점프 거리 0~1 정규화 (가까운 점프 0, 최대 사거리 1)
      const momentum = Math.max(
        0,
        Math.min(
          1,
          (incomingDist - JUMP.MIN_DISTANCE) /
          (JUMP.MAX_DISTANCE - JUMP.MIN_DISTANCE),
        ),
      );
      // 연잎 반지름 대비: 짧은 점프 25% ~ 긴 점프 70%
      const slideDist = pad.radius * (0.25 + momentum * 0.45);

      const SLIDE_DURATION = 0.85;
      const initialSpeed = (2.5 * slideDist) / SLIDE_DURATION; // ease-out 보정
      slideRef.current = {
        vx: Math.cos(aimDirRef.current) * initialSpeed,
        vz: Math.sin(aimDirRef.current) * initialSpeed,
        remaining: SLIDE_DURATION,
        duration: SLIDE_DURATION,
      };
    }
    if (pad.type === "rotating") {
      const dir = pad.rotationDirection ?? 1;
      rotatingShiftRef.current = -dir * 0.1;
    }
    if (pad.type === "spring") {
      // 즉시 추가 큰 점프 발사 — 들어온 거리만큼 튀어오름
      playSpring();
      const incomingDist = Math.hypot(
        plan.endX - plan.startX,
        plan.endZ - plan.startZ,
      );
      const bigPlan = makeJumpPlan(
        lx,
        lz,
        aimDirRef.current,
        incomingDist,                              // ← 들어온 거리 그대로
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
  function handleFall(x: number, z: number, excludePadId?: number) {
    // 생존 수영 버프 검사
    if (consumeSwimBuff()) {
      const nowSec = gameNow();
      const excludedPad = excludePadId != null ? pads.find((p) => p.id === excludePadId) : null;
      // swim 안정화된 점멸 연잎이 만료되는 경우는 재복귀 허용 안 함 (일반 exclude처럼 처리)
      const excludeIsBlinking =
        excludedPad?.type === "blinking" &&
        !swimStabilizedRef.current.has(excludePadId ?? -1);
      const excludeIsRotten = excludedPad?.type === "rotten";

      // 복귀 가능 연잎:
      // - 함정 제외
      // - 꺼진 점멸 연잎 제외 (단, 지금 밟고 있던 점멸 연잎은 포함 → 강제로 켜줌)
      // - 비점멸 exclude 연잎 제외
      const usable = pads.filter((p) => {
        if (p.type === "trap" || p.type === "spring") return false;
        if (p.id === excludePadId && !excludeIsBlinking) return false;
        if (p.type === "blinking" && p.steppedAt == null && !swimStabilizedRef.current.has(p.id)) {
          const cycle = ((nowSec - p.spawnTime) % LILY.BLINK_PERIOD) / LILY.BLINK_PERIOD;
          if (cycle >= LILY.BLINK_VISIBLE_RATIO) return false;
        }
        return true;
      });

      // 이동 연잎은 현재 시각 위치로 보정해서 nearestPad에 전달
      const usableWithVisual = usable.map((p) => {
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

      // 이동 연잎: 현재 시각 위치에서 radius*2 이상 멀면 복귀 불가 (이동 반경 전체가 발동 범위가 되는 것 방지)
      const swimCandidates = usableWithVisual.filter((p) => {
        if (p.type !== "moving") return true;
        return Math.hypot(p.position[0] - x, p.position[2] - z) <= p.radius * 2;
      });

      // 삭은 연잎 만료 시: 앞쪽 연잎으로만 복귀 (뒤로 가면 후반에 거리가 줄어 게임 진행 불가)
      const finalCandidates = excludeIsRotten
        ? swimCandidates.filter((p) => p.position[0] >= x - 0.1)
        : swimCandidates;

      const { pad } = nearestPad(x, z, finalCandidates);
      if (pad) {
        // 떨어진 지점에 물보라 → 개구리가 물 위를 헤엄쳐 연잎으로 복귀한다.
        // (특수 연잎 효과·복귀 팝업은 도착 시점 arriveFromSwim에서 처리)
        slideRef.current = null;
        jumpPlanRef.current = null;
        currentPadRef.current = null;
        frog.current.x = x;
        frog.current.z = z;
        frog.current.y = 0;
        setSwimSplashAt({ x, z, bornAt: gameNowMs() });
        playSplash();
        const dist = Math.hypot(pad.position[0] - x, pad.position[2] - z);
        swimGlideRef.current = {
          fromX: x,
          fromZ: z,
          toX: pad.position[0],
          toZ: pad.position[2],
          padId: pad.id,
          startedAt: gameNow(),
          // 거리에 비례하되 0.35~0.7s로 클램프
          duration: Math.min(0.7, Math.max(0.35, dist * 0.12)),
          splashFired: false,
        };
        return;
      }
    }
    frog.current.x = x;
    frog.current.z = z;
    frog.current.y = 0;
    setSplashAt({ x, z, bornAt: gameNowMs() });
    playSplash();
    finishRun();
  }

  /** 수영 헤엄 글라이드가 목표 연잎에 도착했을 때 — 안착 + 특수 연잎 효과 + 복귀 연출 */
  function arriveFromSwim(padId: number, toX: number, toZ: number) {
    const nowSec = gameNow();
    lastLandAtRef.current = nowSec; // 콤보 idle 타이머 갱신 (수영 복귀도 착지)
    const origPad = pads.find((p) => p.id === padId);
    if (!origPad) {
      // 도착 직전 연잎이 사라진 경우 — 안전망: 그 자리에서 낙사 처리
      handleFall(toX, toZ);
      return;
    }

    // 이동 연잎은 도착 시점의 실제 위치로 보정 (글라이드 중 드리프트)
    let px = origPad.position[0];
    let pz = origPad.position[2];
    if (origPad.type === "moving") {
      const t = nowSec - origPad.spawnTime;
      const amp = origPad.amplitude ?? 1.4;
      const freq = origPad.frequency ?? 0.8;
      const offset = Math.sin(t * freq) * amp;
      if (origPad.axis === "x") px += offset;
      else pz += offset;
    }

    frog.current.x = px;
    frog.current.z = pz;
    frog.current.y = 0;
    slideRef.current = null;

    // 이동 연잎이면 추적 재개 (복귀 위치 = 시각 위치이므로 offset = 0)
    if (origPad.type === "moving") {
      currentPadRef.current = { padId, offsetX: 0, offsetZ: 0 };
    } else {
      currentPadRef.current = null;
    }

    // 특수 연잎 효과 적용 (landFrog 착지와 동일한 처리)
    if (origPad.type === "blinking") {
      // 점멸 연잎: 즉시 안정화 (stale state 방지 ref도 업데이트)
      swimStabilizedRef.current.add(padId);
      setPads((list) =>
        list.map((p) => p.id === padId ? { ...p, steppedAt: nowSec } : p),
      );
    } else if (origPad.type === "rotten") {
      // 삭은 연잎: steppedAt 설정해 타이머 시작 (1.2초 내 탈출 필요)
      setPads((list) =>
        list.map((p) => p.id === padId ? { ...p, steppedAt: nowSec } : p),
      );
    } else if (origPad.type === "slippery") {
      // 미끄러운 연잎: 모멘텀 없는 최소 슬라이드
      const slideDist = origPad.radius * 0.25;
      const SLIDE_DURATION = 0.85;
      const speed = (2.5 * slideDist) / SLIDE_DURATION;
      slideRef.current = {
        vx: Math.cos(aimDirRef.current) * speed,
        vz: Math.sin(aimDirRef.current) * speed,
        remaining: SLIDE_DURATION,
        duration: SLIDE_DURATION,
      };
    } else if (origPad.type === "rotating") {
      // 회전 연잎: 다음 점프 방향 편향 적용
      const dir = origPad.rotationDirection ?? 1;
      rotatingShiftRef.current = -dir * 0.1;
    } else if (origPad.type === "spring") {
      // 스프링 연잎: 기본 거리로 즉시 점프 발사
      playSpring();
      const bigPlan = makeJumpPlan(
        frog.current.x,
        frog.current.z,
        aimDirRef.current,
        JUMP.MIN_DISTANCE * 1.5,
        Math.max(arcHeightRef.current, 3.5),
        useGameStore.getState().wind,
      );
      jumpPlanRef.current = bigPlan;
      jumpTimeRef.current = 0;
      currentPadRef.current = null;
    }

    // 복귀 팝업 (솟아오르는 물보라는 글라이드에서 도착 직전 미리 터뜨림)
    addPopup({
      id: ++popupIdRef.current,
      type: "Great",
      text: "수영 복귀!",
      position: [frog.current.x, 1.5, frog.current.z],
      bornAt: gameNowMs(),
      score: 0,
    });
  }
 

  /** 개구리 진행에 따라 뒤쪽 연잎/적/아이템 정리하고 앞쪽에 새로 생성 */
  function cullAndSpawn() {
    const fx = frog.current.x;
    const diff = difficultyOf(useGameStore.getState().distance);
    const score = useGameStore.getState().score;

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
        // 점수가 높아질수록 간격이 최대 1.6배까지 늘어남
        const sparsity = Math.min(1.4, 1 + score / 2000);
        const sizeFactor = Math.max(0.77, 1.2 - score / 1200);
        const gap = gapForDifficulty(diff, Math.random) * sparsity;
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
        let type = DEBUG_FORCE_PAD_TYPE ?? pickPadType(diff, Math.random);

        if (!DEBUG_FORCE_PAD_TYPE && (type === "spring" || type === "trap")) {
          type = "basic";
        }
        // 점수가 높아질수록 basic을 특수 연잎으로 바꿈 (trap 제외)
        if (type === "basic" && !DEBUG_FORCE_PAD_TYPE) {
          const specialChance = Math.min(0.6, 0.1 + score / 1500);
          if (Math.random() < specialChance) {
            const specials: LilyPadData["type"][] = [
              "rotten",
              "slippery",
              "moving",
              "rotating",
              "blinking",
            ];
            type = specials[Math.floor(Math.random() * specials.length)];
          }
        }
        
        const padSizeFactor = type === "basic"
          ? sizeFactor                                  // 일반: 기본 공식
          : Math.max(0.9, 1.2 - score / 1400);          // 특수: 완만한 공식


        maxX += gap;
        const newPad: LilyPadData = {
          id: ++padIdRef.current,
          type,
          position: [maxX, WORLD.PAD_TOP_Y, lat],
          radius: LILY.RADIUS * padSizeFactor, 
          spawnTime: gameNow(),
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

        
        const branchChance = Math.max(0.25, 0.55 - score / 1500);
        const branchCount = Math.random() < branchChance ? (Math.random() < 0.4 ? 2 : 1) : 0;
        //                                                                       
        //                                                                 
        for (let b = 0; b < branchCount; b++) {
          const bx = maxX - gap * (0.4 + Math.random() * 0.5);
          const bz = lat + (-zigSign) * (1.6 + Math.random() * 2.2);
          if (Math.abs(bz) > LILY.MAX_LATERAL * 1.4) continue;

          // ★ 곁가지 타입 결정 — 점수 따라 spring/trap이 등장
          let branchType: LilyPadData["type"] = "basic";
          const dangerChance = Math.min(0.35, score / 2000);  // 최대 35%
          if (Math.random() < dangerChance) {
            branchType = Math.random() < 0.5 ? "spring" : "trap";  // 5:5
          }
          
          kept.push({
            id: ++padIdRef.current,
            type: branchType,
            position: [bx, WORLD.PAD_TOP_Y, bz],
            radius: LILY.RADIUS * sizeFactor * (0.7 + Math.random() * 0.3),
            spawnTime: gameNow(),
            visualRotation: (Math.random() - 0.5) * 0.7,
            visualScale: 0.75 + Math.random() * 0.3,
          });
        }

        // 적 스폰
        const enemySpawnProb =
          DEBUG_ALWAYS_SPAWN_ENEMY || DEBUG_FORCE_ENEMY_TYPE ? 1 : enemyProb(diff);
        if (Math.random() < enemySpawnProb) {
          const roll = DEBUG_ALWAYS_SPAWN_ENEMY ? Math.random() * 0.75 : Math.random();
          const type: EnemyData["type"] =
            DEBUG_FORCE_ENEMY_TYPE ??
            (roll < 0.4 ? "fish" : roll < 0.75 ? "bird" : "obstacle");
          const enemy: EnemyData = {
            id: ++enemyIdRef.current,
            type,
            position: [
              maxX - gap * 0.5,
              type === "fish" ? -0.3 : type === "bird" ? 3.2 : 0.6,
              lat * 0.4 + (Math.random() - 0.5) * 1.4,
            ],
            spawnTime: gameNow(),
            amplitude: 1 + Math.random(),
            active: true,
          };
          setEnemies((es) => [...es, enemy]);
        }
        // 아이템 스폰 — 디버그로 타입을 강제하면 매 연잎마다 항상 스폰 (물고기 디버그와 동일)
        const itemChance = DEBUG_FORCE_ITEM_TYPE ? 1 : 0.13;
        if (Math.random() < itemChance) {
          const r = Math.random();
          const t: ItemData["type"] =
            DEBUG_FORCE_ITEM_TYPE ??
            (r < 0.45
              ? "rangeUp"
              : r < 0.65
                ? "swim"
                : r < 0.83
                  ? "scoreBoost"
                  : "comboFreeze");
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
      list.filter(
        (i) =>
          i.position[0] > fx - LILY.CULL_BEHIND &&
          // 잡힌 파리는 입으로 빨려 들어가는 연출(≈320ms)이 끝난 뒤 제거
          (!i.collected || gameNowMs() - (i.collectedAt ?? 0) < 400),
      ),
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
        isDead={splashAt !== null}
        isSwimming={swimGlideRef.current !== null}
        swimDir={
          swimGlideRef.current
            ? Math.atan2(
                swimGlideRef.current.toZ - swimGlideRef.current.fromZ,
                swimGlideRef.current.toX - swimGlideRef.current.fromX,
              )
            : 0
        }
        crocSnap={crocSnapAt ? { cx: crocSnapAt.cx, cz: crocSnapAt.cz, bornAt: crocSnapAt.bornAt } : null}
      />
      {pads.map((p) => (
        <LilyPad
          key={p.id}
          pad={p}
          now={gameNow()}
          isCandidate={p.id === candidatePadId}
          crocRef={crocRef}
        />
      ))}
      <EnemyManager enemies={enemies} now={gameNow()} />
      <CrocEnemy
        x={crocRef.current.x}
        z={crocRef.current.z}
        now={gameNow()}
        dist={Math.hypot(frog.current.x - crocRef.current.x, frog.current.z - crocRef.current.z)}
        caught={!!crocSnapAt}
        paused={trulyPaused}
      />
      <ItemManager items={items} now={gameNow()} frogRef={frog} />
      <EffectsManager
        frogX={frog.current.x}
        frogZ={frog.current.z}
        aimDir={aimDirRef.current}
        chargeDist={chargeDistanceRef.current}
        arcHeight={arcHeightRef.current}
        isCharging={chargingRef.current}
        isJumping={!!jumpPlanRef.current}
        isSwimming={swimGlideRef.current !== null}
        yarrBurst={yarrBurst}
        splashAt={splashAt}
        swimSplashAt={swimSplashAt}
        launchAt={launchAt}
        comboBreakAt={comboBreakAt}
        crocSnapAt={crocSnapAt}
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
    radius: LILY.RADIUS * 1.2,
    spawnTime: 0,
    visualRotation: 0,
    visualScale: 1.0,
  });
  let x = 0;
  let lastZ = 0;
  let zigSign: 1 | -1 = 1;
  for (let i = 0; i < 10; i++) {
    const gap = gapForDifficulty(0, Math.random);
    x += gap;
    const straight = Math.random() < 0.25;
    if (!straight) zigSign = (zigSign * -1) as 1 | -1;
    const lateralBase = lateralForDifficulty(0, Math.random);
    const lat = straight
      ? lastZ + (Math.random() - 0.5) * 1.2
      : zigSign * Math.abs(lateralBase);
    out.push({
      id: ++padIdRef.current,
      type: "basic",
      position: [x, WORLD.PAD_TOP_Y, lat],
      radius: LILY.RADIUS * 1.2,
      spawnTime: 0,
      visualRotation: (Math.random() - 0.5) * 0.7,
      visualScale: 0.85 + Math.random() * 0.3,
    });

    // ★ 곁가지 — cullAndSpawn과 동일한 로직 (score=0 기준이라 55%)
    const branchCount = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
    for (let b = 0; b < branchCount; b++) {
      const bx = x - gap * (0.4 + Math.random() * 0.5);
      const bz = lat + (-zigSign) * (1.6 + Math.random() * 2.2);
      if (Math.abs(bz) > LILY.MAX_LATERAL * 1.4) continue;
      out.push({
        id: ++padIdRef.current,
        type: "basic",
        position: [bx, WORLD.PAD_TOP_Y, bz],
        radius: LILY.RADIUS * 1.2 * (0.7 + Math.random() * 0.3),
        spawnTime: 0,
        visualRotation: (Math.random() - 0.5) * 0.7,
        visualScale: 0.75 + Math.random() * 0.3,
      });
    }

    lastZ = lat;
  }
  return out;
}