import { useGameStore } from "../store/useGameStore";
import {Mouse, MousePointer2} from "lucide-react";

export default function TutorialOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);
  const setShowTutorial = useGameStore((s) => s.setShowTutorial);

  return (
    <div className="overlay tutorial">
      <div className="card wide">
        <div className="title">조작법</div>
        <div className="grid">
          <div className="t-item">
            <div className="t-key"><MousePointer2 /></div>
            <div>
              <b>마우스 호버</b>
              <div>커서를 움직여 점프할 방향을 조준.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB</div>
            <div>
              <b>우클릭 꾹! + 쭉!</b>
              <div>쭉! 한 거리만큼 점프 거리가 증가.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB↑</div>
            <div>
              <b>우클릭 떼기</b>
              <div>설정된 방향과 거리로 점프 발사!</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">A / S</div>
            <div>
              <b>궤적 조절</b>
              <div>A로 높게 발사! S로 낮게 발사!</div>
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
              <div>Stop, Wait a minute!</div>
            </div>
          </div>
        </div>

        <div className="judgments">
          <span style={{ color: "#F59E0B" }}>● Yarr! +30</span>
          <span style={{ color: "#22C55E" }}>● Great +20</span>
          <span style={{ color: "#9CA3AF" }}>● Not bad.. +10</span>
        </div>

        <div className="actions">
          <button className="primary" onClick={() => setPhase("playing")}>
            게임 시작!
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              defaultChecked
              onChange={(e) => setShowTutorial(e.target.checked)}
            />
            <span>다음에도 튜토리얼 보기</span>
          </label>
        </div>
      </div>
    </div>
  );
}
