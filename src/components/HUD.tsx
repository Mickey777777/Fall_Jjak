import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { comboMultiplier, judgmentColor, judgmentText } from "../game/ScoreSystem";
import { JUMP } from "../game/constants";

/**
 * 간소화된 HUD — 큰 점수 + 콤보 칩 + 가벼운 충전 바.
 * 반투명 박스 패널을 모두 제거하고 그림자 텍스트로 처리한다.
 */
export default function HUD() {
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const combo = useGameStore((s) => s.combo);
  const lastJudgment = useGameStore((s) => s.lastJudgment);
  const lastJudgmentAt = useGameStore((s) => s.lastJudgmentAt);
  const chargeDist = useGameStore((s) => s.chargeDistance);
  const isCharging = useGameStore((s) => s.isCharging);
  const arcHeight = useGameStore((s) => s.arcHeight);
  const buffs = useGameStore((s) => s.buffs);
  const weather = useGameStore((s) => s.weather);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const judgmentVisible =
    lastJudgment != null && performance.now() - lastJudgmentAt < 700;

  const mult = comboMultiplier(combo);
  const chargeRatio = Math.max(
    0,
    Math.min(1, (chargeDist - JUMP.MIN_DISTANCE) / (JUMP.MAX_DISTANCE - JUMP.MIN_DISTANCE)),
  );
  const arcRatio = Math.max(
    0,
    Math.min(1, (arcHeight - JUMP.ARC_MIN) / (JUMP.ARC_MAX - JUMP.ARC_MIN)),
  );

  return (
    <div className="hud" onContextMenu={(e) => e.preventDefault()}>
      {/* 좌상단 — 큰 점수 (라벨 없음, 그림자 텍스트만) */}
      <div className="score-big">
        <div className="score-num">{score.toLocaleString()}</div>
        <div className="score-hi">BEST {highScore.toLocaleString()}</div>
      </div>

      {/* 우상단 — 콤보 칩 (콤보 1 이상일 때만 표시) */}
      {combo > 0 && (
        <div className="combo-chip">
          <span className="combo-num">×{combo}</span>
          <span className="combo-mult">{mult.toFixed(1)}배</span>
        </div>
      )}

      {/* 가운데 상단 — 판정 텍스트 (애니메이션) */}
      <div className="hud-center">
        {judgmentVisible && lastJudgment ? (
          <div
            className="judgment"
            key={lastJudgmentAt}
            style={{ color: judgmentColor(lastJudgment) }}
          >
            {judgmentText(lastJudgment)}
          </div>
        ) : null}
      </div>

      {/* 좌측 하단 — 날씨 작은 칩 (clear일 땐 숨김) */}
      {weather !== "clear" && (
        <div className="weather-chip">{weatherLabel(weather)}</div>
      )}

      {/* 우측 하단 — 버프 작은 칩들 */}
      <div className="buff-row">
        {buffs.map((b) => (
          <div className="buff-chip" key={b.type} style={{ background: buffColor(b.type) }}>
            {buffEmoji(b.type)}
            {b.remaining < 9000 ? ` ${b.remaining.toFixed(1)}s` : ""}
          </div>
        ))}
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
        <div className="charge-hint">{isCharging ? "Release!" : "Right-click hold"}</div>
      </div>

      {/* 우상단 끝 — 음소거 + ESC 힌트 */}
      <button className="mute-btn" onClick={toggleMute} title="음소거">
        {muted ? "🔇" : "🔊"}
      </button>
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

function weatherLabel(w: string) {
  return (
    {
      clear: "맑음",
      fog: "🌫 안개",
      wind: "💨 강풍",
      rain: "🌧 호우",
      cloud: "☁ 구름",
    }[w] ?? w
  );
}
function buffEmoji(t: string) {
  return (
    { rangeUp: "🦘 사거리", swim: "💧 수영", scoreBoost: "✨ 부스트" }[t] ?? t
  );
}
function buffColor(t: string) {
  return (
    { rangeUp: "#f5e26b", swim: "#83d2ff", scoreBoost: "#ff9bd1" }[t] ?? "#ccc"
  );
}
