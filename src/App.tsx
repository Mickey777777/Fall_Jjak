import { useEffect, useState } from "react";
import { useGameStore } from "./store/useGameStore";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import MainMenu from "./components/MainMenu";
import PauseMenu from "./components/PauseMenu";
import GameOverScreen from "./components/GameOverScreen";
import ControlOverlay from "./components/ControlOverlay";

const GAMEOVER_DELAY_MS = 1000;

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const paused = phase !== "playing";
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    if (phase === "gameover") {
      const t = setTimeout(() => setShowGameOver(true), GAMEOVER_DELAY_MS);
      return () => clearTimeout(t);
    }
    setShowGameOver(false);
  }, [phase]);

  return (
    <div className="app">
      <div className="sky-bg" />

      <GameCanvas paused={paused} />
      {phase === "playing" && <HUD />}

      {phase === "menu" && <MainMenu />}
      {phase === "control" && <ControlOverlay />}
      {phase === "paused" && <PauseMenu />}
      {showGameOver && <GameOverScreen />}
    </div>
  );
}
