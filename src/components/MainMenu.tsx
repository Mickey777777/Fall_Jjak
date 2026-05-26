import { useGameStore } from "../store/useGameStore";

export default function MainMenu() {
  const setPhase = useGameStore((s) => s.setPhase);
  const highScore = useGameStore((s) => s.highScore);
  const showTutorial = useGameStore((s) => s.showTutorial);
  const setShowTutorial = useGameStore((s) => s.setShowTutorial);

  const start = () => {
    setPhase(showTutorial ? "tutorial" : "playing");
  };

  return (
    <div className="overlay menu">
      <div className="logo">
        <div className="logo-jp">「 폴 짝 」</div>
        <div className="logo-sub">Fall Jjak — 끝없는 연잎 점프</div>
      </div>

      <div className="card">
        <button className="primary" onClick={start}>
          시작하기
        </button>
        <button
          className="ghost"
          onClick={() => {
            setPhase("playing");
          }}
        >
          튜토리얼 건너뛰고 바로 플레이
        </button>

        <div className="row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showTutorial}
              onChange={(e) => setShowTutorial(e.target.checked)}
            />
            <span>다음에도 튜토리얼 보기</span>
          </label>
        </div>
        <div className="row hi">최고 점수: {highScore.toLocaleString()}</div>
      </div>

      <div className="credits">
        팀명 크누씨에스이이십오 · 캐주얼 아케이드 스코어 어택
      </div>
    </div>
  );
}
