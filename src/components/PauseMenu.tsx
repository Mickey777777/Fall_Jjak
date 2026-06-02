import { useGameStore } from "../store/useGameStore";

export default function PauseMenu() {
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);

  return (
    <div className="overlay pause">
      <div className="card">
        <div className="title">일시정지</div>
        <button className="primary" onClick={() => setPhase("playing")}>
          계속하기
        </button>
        <button
          className="ghost restart"
          onClick={() => {
            resetRun();
            setPhase("playing");
          }}
        >
          다시하기
        </button>
        <button className="ghost restart" onClick={() => setPhase("menu")}>
          메인으로
        </button>
      </div>
    </div>
  );
}
