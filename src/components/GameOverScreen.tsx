import { useGameStore } from "../store/useGameStore";

export default function GameOverScreen() {
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const padsLanded = useGameStore((s) => s.padsLanded);
  const fliesEaten = useGameStore((s) => s.fliesEaten);
  const distance = useGameStore((s) => s.distance);
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);

  const isNew = score === highScore && score > 0;

  return (
    <div className="overlay gameover">
      <div className="card big">
        <div className="title">{isNew ? "🏆 신기록!" : "Game Over"}</div>
        <div className="big-score">{score.toLocaleString()}</div>

        <div className="stats">
          <Stat label="이동 거리" value={`${distance.toFixed(1)} m`} />
          <Stat label="밟은 연잎" value={`${padsLanded}`} />
          <Stat label="최고 콤보" value={`${maxCombo}`} />
          <Stat label="잡아먹은 파리" value={`${fliesEaten}`} />
          <Stat label="최고 점수" value={highScore.toLocaleString()} />
        </div>

        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              resetRun();
              setPhase("playing");
            }}
          >
            Retry
          </button>
          <button
            className="ghost"
            onClick={() => {
              resetRun();
              setPhase("menu");
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
