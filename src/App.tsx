import { useGameStore } from "./store/useGameStore";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import MainMenu from "./components/MainMenu";
import PauseMenu from "./components/PauseMenu";
import GameOverScreen from "./components/GameOverScreen";
import TutorialOverlay from "./components/TutorialOverlay";

export default function App() {
  const phase = useGameStore((s) => s.phase);
  // 캔버스는 메뉴/튜토리얼 화면 뒤에서도 살아있게 둔다 (배경 + 부드러운 전환)
  const isCanvasVisible = phase !== "menu";
  const paused = phase !== "playing";

  return (
    <div className="app">
      {/* 항상 배경에 깔리는 부드러운 그라데이션 */}
      <div className="sky-bg" />

      {isCanvasVisible && <GameCanvas paused={paused} />}
      {phase === "playing" && <HUD />}

      {phase === "menu" && <MainMenu />}
      {phase === "tutorial" && <TutorialOverlay />}
      {phase === "paused" && <PauseMenu />}
      {phase === "gameover" && <GameOverScreen />}
    </div>
  );
}
