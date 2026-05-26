import { useGameStore } from "../store/useGameStore";

export default function MainMenu() {
  const setPhase = useGameStore((s) => s.setPhase);
  const highScore = useGameStore((s) => s.highScore);

  return (
    <div className="overlay menu">
      <div className="logo">
        <div className="logo-jp">「 폴 짝 」</div>
        <div className="logo-sub">Fall Jjak — 끝없는 연잎 점프</div>
      </div>

      <div className="card">
        <button className="primary" onClick={() => setPhase("playing")}>
          시작하기
        </button>
        <button className="ghost" onClick={() => setPhase("control")}>
          조작법 확인
        </button>

        <div className="row hi">최고 점수: {highScore.toLocaleString()}</div>
      </div>
    </div>
  );
}
