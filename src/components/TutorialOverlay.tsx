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
              <div>커서를 움직여 점프할 방향을 조준합니다.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB</div>
            <div>
              <b>우클릭 hold + 드래그</b>
              <div>드래그한 거리만큼 점프 거리가 충전됩니다.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">RMB↑</div>
            <div>
              <b>우클릭 떼기</b>
              <div>설정된 방향과 거리로 점프 발사.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">A / S</div>
            <div>
              <b>궤적 조절</b>
              <div>A로 높게, S로 낮게. 물고기는 A, 새는 S.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">LMB</div>
            <div>
              <b>파리 사냥 (낼름)</b>
              <div>날아다니는 곤충에 커서를 두고 좌클릭.</div>
            </div>
          </div>
          <div className="t-item">
            <div className="t-key">ESC</div>
            <div>
              <b>일시정지</b>
              <div>중간에 잠시 쉬어 가세요.</div>
            </div>
          </div>
        </div>

        <div className="judgments">
          <span style={{ color: "#ffd84d" }}>● Yarr! 중앙 안착 +30</span>
          <span style={{ color: "#7df2a1" }}>● Great 안착 +20</span>
          <span style={{ color: "#cccccc" }}>● Not bad.. 가장자리 +10 (콤보 끊김)</span>
          <span style={{ color: "#ff6a6a" }}>● Miss 즉시 게임오버</span>
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
