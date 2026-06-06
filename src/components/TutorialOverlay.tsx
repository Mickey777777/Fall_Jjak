import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { IS_TOUCH } from "../game/device";
import { TUTORIAL_STEPS } from "../game/tutorialSteps";

/** 모바일 ▲/▼ 버튼 → TutorialManager의 궤적 조절 로직 구동 (본게임과 동일 이벤트) */
function dispatchArc(dir: 1 | -1) {
  window.dispatchEvent(new CustomEvent("fj:arc", { detail: dir }));
}

// 궤적 조절이 핵심인 스텝에서만 터치 ▲/▼ 노출
const ARC_STEP_IDS = new Set(["fish", "bird"]);
const COMBO_STEP_ID = "judgment-combo";

/**
 * 튜토리얼 진행 오버레이 (DOM). 현재 지시문/진행도/힌트/콤보를 표시하고,
 * 터치 환경에서는 궤적 조절 버튼을 제공한다. 게임 진행은 TutorialManager가 담당.
 */
export default function TutorialOverlay() {
  const step = useGameStore((s) => s.tutorialStep);
  const combo = useGameStore((s) => s.tutorialCombo);
  const hint = useGameStore((s) => s.tutorialHint);
  const setPhase = useGameStore((s) => s.setPhase);
  const resetRun = useGameStore((s) => s.resetRun);

  const exit = () => {
    resetRun();
    setPhase("menu");
  };

  // ESC 로 메뉴 복귀 (다른 오버레이와 일관)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = step >= TUTORIAL_STEPS.length;
  const current = done ? null : TUTORIAL_STEPS[step];
  const showArc = IS_TOUCH && current != null && ARC_STEP_IDS.has(current.id);
  const showCombo = current != null && current.id === COMBO_STEP_ID;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-top">
        <div className="tutorial-progress">
          {TUTORIAL_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`dot ${i < step ? "done" : ""} ${i === step ? "active" : ""}`}
            />
          ))}
        </div>
        <button className="tutorial-exit" onClick={exit} aria-label="나가기">
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="tutorial-banner">
        {done ? (
          <div className="tutorial-instruction done">튜토리얼 완료! 🎉</div>
        ) : (
          <>
            <div className="tutorial-step-label">
              STEP {step + 1} / {TUTORIAL_STEPS.length}
            </div>
            <div className="tutorial-instruction">
              {IS_TOUCH ? current!.instructionTouch : current!.instructionPC}
            </div>
            {showCombo && (
              <div className="tutorial-combo">콤보 {combo}</div>
            )}
            {hint && <div className="tutorial-hint">{hint}</div>}
          </>
        )}
      </div>

      {showArc && (
        <div className="tutorial-arc">
          <button onPointerDown={() => dispatchArc(1)} aria-label="궤적 높이기">
            <ChevronUp aria-hidden="true" />
          </button>
          <button onPointerDown={() => dispatchArc(-1)} aria-label="궤적 낮추기">
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
