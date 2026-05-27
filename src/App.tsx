import { useGameStore } from "./store/useGameStore";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import MainMenu from "./components/MainMenu";
import PauseMenu from "./components/PauseMenu";
import GameOverScreen from "./components/GameOverScreen";
import ControlOverlay from "./components/ControlOverlay";

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const paused = phase !== "playing";

  return (
    <div className="app">
      <div className="sky-bg" />

      <GameCanvas paused={paused} />
      {phase === "playing" && <HUD />}

      {phase === "menu" && <MainMenu />}
      {phase === "control" && <ControlOverlay />}
      {phase === "paused" && <PauseMenu />}
      {phase === "gameover" && <GameOverScreen />}
    </div>
  );
}
