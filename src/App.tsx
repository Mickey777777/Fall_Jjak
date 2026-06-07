import { useEffect, useState } from "react";
import { useGameStore } from "./store/useGameStore";
import { syncBgm, restartBgm, fadeOutBgm } from "./game/bgm";
import { playClick, playHover } from "./game/sound";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import MainMenu from "./components/MainMenu";
import PauseMenu from "./components/PauseMenu";
import GameOverScreen from "./components/GameOverScreen";
import ControlOverlay from "./components/ControlOverlay";
import TutorialOverlay from "./components/TutorialOverlay";

const GAMEOVER_DELAY_MS = 1000;

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const weather = useGameStore((s) => s.weather);
  const muted = useGameStore((s) => s.muted);
  const runId = useGameStore((s) => s.runId);
  const paused = phase !== "playing";
  const [showGameOver, setShowGameOver] = useState(false);

  // BGM은 첫 사용자 제스처가 있어야 재생된다(autoplay 정책).
  // 캡처 단계로 등록해 다른 핸들러가 이벤트를 가로채도 무조건 잡고,
  // 제스처마다 syncBgm으로 (메뉴 이탈 등) 현재 상태에 맞춰 깨운다.
  useEffect(() => {
    const wake = () => syncBgm();
    window.addEventListener("pointerdown", wake, true);
    window.addEventListener("keydown", wake, true);
    return () => {
      window.removeEventListener("pointerdown", wake, true);
      window.removeEventListener("keydown", wake, true);
    };
  }, []);

  // phase(재생 대상 여부) / 음소거 변화를 BGM에 반영. 일시정지 해제는 멈춘 지점부터 이어진다.
  // 사망(gameover) 시에는 즉시 정지가 아니라 fade out으로 자연스럽게 끈다.
  useEffect(() => {
    if (phase === "gameover") fadeOutBgm();
    else syncBgm();
  }, [phase, muted]);

  // 새 게임 시작(runId 증가) — 노래를 처음부터. phase effect 뒤에 두어 되감기가 마지막에 적용된다.
  useEffect(() => {
    restartBgm();
  }, [runId]);

  // 모든 UI 버튼의 클릭/호버에 효과음. 캡처 단계로 위임해 버튼마다 따로 붙이지 않는다.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) playClick();
    };
    const onOver = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      // mouseover는 버튼 내부 자식으로 이동할 때도 발생 — 버튼 바깥에서 들어온 경우만 1회.
      const from = e.relatedTarget as Node | null;
      if (from && btn.contains(from)) return;
      playHover();
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("mouseover", onOver, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("mouseover", onOver, true);
    };
  }, []);

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
      {/* 날씨별 화면 색감 — 페이즈와 무관하게 유지(죽어도 안 사라짐), 안개처럼 점진 전환 */}
      <div className={`weather-grade weather-${weather}`} />
      {phase === "playing" && <HUD />}

      {phase === "menu" && <MainMenu />}
      {phase === "control" && <ControlOverlay />}
      {phase === "tutorial" && <TutorialOverlay />}
      {phase === "paused" && <PauseMenu />}
      {showGameOver && <GameOverScreen />}
    </div>
  );
}
