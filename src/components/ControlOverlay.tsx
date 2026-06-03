import { MousePointer2 } from "lucide-react";
import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore";

export default function ControlOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);

  // ESC 로 닫기 (메뉴로 복귀) — 키보드 포커스 링이 남지 않도록 blur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        setPhase("menu");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPhase]);

  return (
    <div className="overlay control">
      <div className="card wide">
        <div className="help-head">
          <div className="title">조작법</div>
          <button className="help-close" onClick={() => setPhase("menu")}>
            닫기
          </button>
        </div>
        <div className="grid">
          <div className="t-item">
            <div className="t-key">
              <MousePointer2 />
            </div>
            <div>
              <b>마우스 커서</b>
              <div>커서를 움직여 점프할 방향을 조절.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB</div>
            <div>
              <b>우클릭 유지 + 드래그</b>
              <div>드래그한 거리만큼 점프 거리 증가.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB</div>
            <div>
              <b>우클릭 놓기</b>
              <div>설정한 방향과 거리로 점프.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">A / S</div>
            <div>
              <b>궤적 조절</b>
              <div>A로 높게, S로 낮게 점프.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">LMB</div>
            <div>
              <b>파리 사냥</b>
              <div>날아다니는 파리에 커서를 두고 좌클릭.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">ESC</div>
            <div>
              <b>일시정지</b>
              <div>게임을 멈춤.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
