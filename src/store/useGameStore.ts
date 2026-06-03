import { create } from "zustand";
import { STORAGE } from "../game/constants";
import { gameNowMs } from "../game/gameClock";
import type {
  ActiveBuff,
  GamePhase,
  JudgmentPopup,
  JudgmentType,
  WeatherType,
  WindState,
} from "../game/types";

const loadHighScore = (): number => {
  try {
    const v = localStorage.getItem(STORAGE.HIGH_SCORE);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const loadMuted = (): boolean => {
  try {
    return localStorage.getItem(STORAGE.MUTED) === "1";
  } catch {
    return false;
  }
};

interface GameState {
  phase: GamePhase;
  /** 매 새 게임마다 1 씩 증가 — LilyPadManager 재마운트용 key */
  runId: number;
  // 점수
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  // 진행
  distance: number; // 누적 이동 미터
  padsLanded: number;
  fliesEaten: number;
  // 판정
  lastJudgment: JudgmentType | null;
  lastJudgmentAt: number;
  // 화면 표시용 점수 popup 리스트
  popups: JudgmentPopup[];
  // 점프 상태 (HUD 미리보기용)
  aimDirection: number; // radians around Y
  chargeDistance: number; // 0..MAX
  arcHeight: number;
  isCharging: boolean;
  // 혀 낼름 애니메이션 (좌클릭 순간)
  tongueAt: number; // performance.now()
  // 파리를 잡았을 때 그 월드 좌표 — 혀가 여기까지 뻗음. null이면 기본 짧은 낼름
  tongueTarget: [number, number, number] | null;
  // 환경
  weather: WeatherType;
  wind: WindState;
  // 버프
  buffs: ActiveBuff[];
  // 옵션
  muted: boolean;
  showTutorial: boolean;
  // ──────────── 액션 ────────────
  setPhase: (p: GamePhase) => void;
  resetRun: () => void;
  finishRun: () => void;
  addScore: (raw: number, judgment: JudgmentType, keepCombo?: boolean) => number;
  resetCombo: () => void;
  addPopup: (popup: JudgmentPopup) => void;
  expirePopups: (now: number) => void;
  setAim: (rad: number) => void;
  setChargeDistance: (d: number) => void;
  setArcHeight: (h: number) => void;
  setCharging: (c: boolean) => void;
  triggerTongue: (target?: [number, number, number] | null) => void;
  setWeather: (w: WeatherType, wind?: WindState) => void;
  addBuff: (b: ActiveBuff) => void;
  tickBuffs: (dt: number) => void;
  consumeSwimBuff: () => boolean;
  /** 콤보 프리징 1회 소모 — 보유 시 true 반환하고 버프 제거 */
  consumeComboFreeze: () => boolean;
  setDistance: (d: number) => void;
  incrementFlies: () => void;
  incrementPads: () => void;
  toggleMute: () => void;
  setShowTutorial: (b: boolean) => void;
  /** 악어 근접 위험도 0~1 (WARN_DIST=0 → KILL_DIST=1). 0이면 경고 숨김 */
  crocDanger: number;
  setCrocDanger: (v: number) => void;
  /** 콤보 idle 끊김 경고 0~1 (남은 시간이 경고 구간 진입하면 0→1로 상승). 0이면 숨김 */
  comboIdleWarn: number;
  setComboIdleWarn: (v: number) => void;
  /** 번개 섬광 세기 0~1 — HUD 흰 플래시 오버레이용 (WeatherSystem이 양자화해 갱신) */
  lightningFlash: number;
  setLightningFlash: (v: number) => void;
  /** 가까운 번개 발생 타임스탬프 — LilyPadManager가 감지해 카메라 흔들림 */
  lightningShakeAt: number;
  setLightningShakeAt: (v: number) => void;
  /** 콤보 등급(배율) 상승 이벤트 — 화면 전체 랭크업 연출용. at은 트리거 타임스탬프(0이면 없음) */
  comboRankUpAt: number;
  comboRankTier: number;
  comboRankMult: number;
  triggerComboRankUp: (tier: number, mult: number) => void;
  /** 콤보 프리징 발동 타임스탬프 — HUD 콤보 칩 얼음 연출용(0이면 없음) */
  comboFreezeAt: number;
  triggerComboFreeze: () => void;
}

const initialRunState = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  distance: 0,
  padsLanded: 0,
  fliesEaten: 0,
  lastJudgment: null as JudgmentType | null,
  lastJudgmentAt: 0,
  popups: [] as JudgmentPopup[],
  aimDirection: 0,
  chargeDistance: 0,
  arcHeight: 2.2,
  isCharging: false,
  tongueAt: 0,
  tongueTarget: null as [number, number, number] | null,
  weather: "clear" as WeatherType,
  wind: { direction: 0, strength: 0 } as WindState,
  buffs: [] as ActiveBuff[],
  crocDanger: 0,
  comboIdleWarn: 0,
  lightningFlash: 0,
  lightningShakeAt: 0,
  comboRankUpAt: 0,
  comboRankTier: 0,
  comboRankMult: 1,
  comboFreezeAt: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  runId: 0,
  highScore: loadHighScore(),
  muted: loadMuted(),
  showTutorial: true,
  ...initialRunState,

  setPhase: (p) => set({ phase: p }),
  resetRun: () => set({ ...initialRunState, runId: get().runId + 1 }),
  finishRun: () => {
    const { score, highScore } = get();
    if (score > highScore) {
      try {
        localStorage.setItem(STORAGE.HIGH_SCORE, String(score));
      } catch {
        /* ignore */
      }
      set({ highScore: score });
    }
    set({ phase: "gameover", isCharging: false });
  },
  addScore: (raw, judgment, keepCombo = false) => {
    const { combo, buffs, score, maxCombo } = get();
    // 콤보 배율 계산은 ScoreSystem 쪽에서 처리하지만, 기본 합산은 여기서.
    const boost = buffs.find((b) => b.type === "scoreBoost") ? 1.5 : 1.0;
    const gained = Math.round(raw * boost);
    // keepCombo(콤보 프리징 발동): 판정과 무관하게 현재 콤보를 그대로 유지
    const nextCombo = keepCombo
      ? combo
      : judgment === "Yarr" || judgment === "Great"
        ? combo + 1
        : 0;
    set({
      score: score + gained,
      combo: nextCombo,
      maxCombo: Math.max(maxCombo, nextCombo),
      lastJudgment: judgment,
      lastJudgmentAt: performance.now(),
    });
    return gained;
  },
  resetCombo: () => {
    if (get().combo > 0) set({ combo: 0 });
  },
  addPopup: (popup) =>
    set((s) => ({
      popups: [...s.popups.slice(-12), popup],
    })),
  expirePopups: (now) =>
    set((s) => ({
      popups: s.popups.filter((p) => now - p.bornAt < 900),
    })),

  setAim: (rad) => set({ aimDirection: rad }),
  setChargeDistance: (d) => set({ chargeDistance: d }),
  setArcHeight: (h) => set({ arcHeight: h }),
  setCharging: (c) => set({ isCharging: c }),
  triggerTongue: (target = null) => set({ tongueAt: gameNowMs(), tongueTarget: target }),

  setWeather: (w, wind) =>
    set({
      weather: w,
      wind: wind ?? { direction: 0, strength: 0 },
    }),

  addBuff: (b) =>
    set((s) => {
      const others = s.buffs.filter((x) => x.type !== b.type);
      return { buffs: [...others, b] };
    }),
  tickBuffs: (dt) =>
    set((s) => ({
      buffs: s.buffs
        .map((b) => ({ ...b, remaining: b.remaining - dt }))
        .filter((b) => b.remaining > 0),
    })),
  consumeSwimBuff: () => {
    const { buffs } = get();
    const idx = buffs.findIndex((b) => b.type === "swim");
    if (idx < 0) return false;
    set({ buffs: buffs.filter((_, i) => i !== idx) });
    return true;
  },
  consumeComboFreeze: () => {
    const { buffs } = get();
    const idx = buffs.findIndex((b) => b.type === "comboFreeze");
    if (idx < 0) return false;
    set({ buffs: buffs.filter((_, i) => i !== idx) });
    return true;
  },

  setDistance: (d) => set({ distance: d }),
  incrementFlies: () => set((s) => ({ fliesEaten: s.fliesEaten + 1 })),
  incrementPads: () => set((s) => ({ padsLanded: s.padsLanded + 1 })),
  toggleMute: () => {
    const next = !get().muted;
    try {
      localStorage.setItem(STORAGE.MUTED, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ muted: next });
  },
  setShowTutorial: (b) => set({ showTutorial: b }),
  setCrocDanger: (v) => set({ crocDanger: v }),
  setComboIdleWarn: (v) => set({ comboIdleWarn: v }),
  setLightningFlash: (v) => set({ lightningFlash: v }),
  setLightningShakeAt: (v) => set({ lightningShakeAt: v }),
  triggerComboRankUp: (tier, mult) =>
    set({ comboRankUpAt: performance.now(), comboRankTier: tier, comboRankMult: mult }),
  triggerComboFreeze: () => set({ comboFreezeAt: performance.now() }),
}));
