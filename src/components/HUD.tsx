import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { comboMultiplier } from "../game/ScoreSystem";
import { JUMP } from "../game/constants";
import type { BuffType, WeatherType } from "../game/types";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudFog,
  CloudRain,
  Gauge,
  Pause,
  Star,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from "lucide-react";
import { IS_TOUCH } from "../game/device";

/** 모바일 ▲/▼ 버튼 → LilyPadManager의 궤적 조절 로직 구동 */
function dispatchArc(dir: 1 | -1) {
  window.dispatchEvent(new CustomEvent("fj:arc", { detail: dir }));
}

/**
 * 간소화된 HUD — 큰 점수 + 콤보 칩 + 가벼운 충전 바.
 * 반투명 박스 패널을 모두 제거하고 그림자 텍스트로 처리한다.
 */
export default function HUD() {
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const combo = useGameStore((s) => s.combo);
  const chargeDist = useGameStore((s) => s.chargeDistance);
  const isCharging = useGameStore((s) => s.isCharging);
  const arcHeight = useGameStore((s) => s.arcHeight);
  const buffs = useGameStore((s) => s.buffs);
  const weather = useGameStore((s) => s.weather);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const crocDanger = useGameStore((s) => s.crocDanger);
  const setPhase = useGameStore((s) => s.setPhase);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const mult = comboMultiplier(combo);
  const chargeRatio = Math.max(
    0,
    Math.min(1, (chargeDist - JUMP.MIN_DISTANCE) / (JUMP.MAX_DISTANCE - JUMP.MIN_DISTANCE)),
  );
  const arcRatio = Math.max(
    0,
    Math.min(1, (arcHeight - JUMP.ARC_MIN) / (JUMP.ARC_MAX - JUMP.ARC_MIN)),
  );
  const weatherMeta = getWeatherMeta(weather);
  const WeatherIcon = weatherMeta.Icon;

  return (
    <div className="hud" onContextMenu={(e) => e.preventDefault()}>
      {crocDanger > 0 && (
        <>
          <div
            className="croc-danger-vignette"
            style={{
              ["--danger" as string]: crocDanger,
              // 멀면 0.7s → 가까우면 0.25s로 깜빡임 가속
              animationDuration: `${(0.7 - crocDanger * 0.45).toFixed(3)}s`,
            }}
          />
          <div
            className="croc-warning-text"
            style={{
              ["--danger" as string]: crocDanger,
              animationDuration: `${(0.7 - crocDanger * 0.45).toFixed(3)}s`,
            }}
          >
            악어!
          </div>
        </>
      )}
      {/* 좌상단 — 큰 점수 (라벨 없음, 그림자 텍스트만) */}
      <div className="score-big">
        <div className="score-num">{score.toLocaleString()}</div>
        <div className="score-hi">BEST {highScore.toLocaleString()}</div>
      </div>

      {/* 중앙 상단 — 콤보 칩 (콤보 1 이상일 때만 표시) */}
      {combo > 0 && (
        <div className="combo-chip" key={combo}>
          <span className="combo-num">×{combo}</span>
          <span className="combo-mult">{mult.toFixed(1)}배</span>
        </div>
      )}

      {/* 좌측 하단 — 날씨 작은 칩 (clear일 땐 숨김) */}
      {weather !== "clear" && (
        <div className="weather-chip">
          <WeatherIcon />
          <span>{weatherMeta.label}</span>
        </div>
      )}

      {/* 우측 하단 — 버프 작은 칩들 */}
      <div className="buff-row">
        {buffs.map((b) => {
          const buffMeta = getBuffMeta(b.type);
          const BuffIcon = buffMeta.Icon;

          return (
            <div className="buff-chip" key={b.type} style={{ background: buffColor(b.type) }}>
              <BuffIcon />
              <span>{buffMeta.label}</span>
              {b.remaining < 9000 ? <span>{b.remaining.toFixed(1)}s</span> : null}
            </div>
          );
        })}
      </div>

      {/* 가운데 하단 — 충전 게이지 (얇은 바) + 궤적 SVG 작은 미리보기 */}
      <div className="charge-zone">
        <div className="arc-mini">
          <ArcMeter ratio={arcRatio} />
        </div>
        <div className="charge-bar">
          <div
            className="charge-fill"
            style={{ width: `${chargeRatio * 100}%`, opacity: isCharging ? 1 : 0.35 }}
          />
        </div>
        <div className="charge-hint">
          {isCharging
            ? IS_TOUCH
              ? "놓아서 점프!"
              : "Release!"
            : IS_TOUCH
              ? "끌어서 충전 · 탭으로 사냥"
              : "Right-click hold"}
        </div>
      </div>

      {/* 우상단 끝 — 음소거 */}
      <button className="mute-btn" onClick={toggleMute} title="음소거">
        {muted ? <VolumeX /> : <Volume2 />}
      </button>

      {/* 모바일 전용 가상 버튼 — 키보드/ESC 대체 */}
      {IS_TOUCH && (
        <>
          <button
            className="pause-btn"
            onClick={() => setPhase("paused")}
            title="일시정지"
          >
            <Pause />
          </button>
          <div className="arc-buttons">
            <button onClick={() => dispatchArc(1)} title="궤적 높이기">
              <ChevronUp />
            </button>
            <button onClick={() => dispatchArc(-1)} title="궤적 낮추기">
              <ChevronDown />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ArcMeter({ ratio }: { ratio: number }) {
  const peak = 36 - ratio * 28;
  return (
    <svg width="92" height="34" viewBox="0 0 92 34">
      <path
        d={`M 6 28 Q 46 ${peak - 10} 86 28`}
        stroke="#fff5b0"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getWeatherMeta(w: WeatherType) {
  return {
    clear: { Icon: Cloud, label: "맑음" },
    fog: { Icon: CloudFog, label: "안개" },
    wind: { Icon: Wind, label: "강풍" },
    rain: { Icon: CloudRain, label: "폭우" },
    cloud: { Icon: Cloud, label: "구름" },
  }[w];
}

function getBuffMeta(t: BuffType) {
  return {
    rangeUp: { Icon: Gauge, label: "사거리" },
    swim: { Icon: Waves, label: "수영" },
    scoreBoost: { Icon: Star, label: "부스트" },
  }[t];
}
function buffColor(t: BuffType) {
  return (
    { rangeUp: "#f5e26b", swim: "#83d2ff", scoreBoost: "#ff9bd1" }[t] ?? "#ccc"
  );
}
