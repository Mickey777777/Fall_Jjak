import { ChevronDown, ChevronUp, MousePointer2, Pause } from "lucide-react";
import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { IS_TOUCH } from "../game/device";

const MOUSE_CONTROLS = [
  {
    key: <MousePointer2 />,
    title: "마우스 커서",
    desc: "커서를 움직여 점프할 방향을 조절.",
  },
  {
    key: "RMB",
    title: "우클릭 유지 + 드래그",
    desc: "드래그한 거리만큼 점프 거리 증가.",
  },
  { key: "RMB", title: "우클릭 놓기", desc: "설정한 방향과 거리로 점프." },
  { key: "A / S", title: "궤적 조절", desc: "A로 높게, S로 낮게 점프." },
  { key: "LMB", title: "파리 사냥", desc: "날아다니는 파리에 커서를 두고 좌클릭." },
  { key: "ESC", title: "일시정지", desc: "게임을 멈춤." },
];

const TOUCH_CONTROLS = [
  {
    key: "누르기",
    title: "조준",
    desc: "눌러서 점프할 방향을 조절.",
  },
  {
    key: "드래그",
    title: "충전",
    desc: "드래그한 거리만큼 점프 거리 증가.",
  },
  { key: "떼기", title: "점프", desc: "설정한 방향과 거리로 점프." },
  { key: "탭", title: "파리 사냥", desc: "날아다니는 파리를 탭." },
  {
    key: (
      <>
        <ChevronUp />
        <ChevronDown />
      </>
    ),
    title: "궤적 조절",
    desc: "▲로 높게, ▼로 낮게 점프.",
  },
  { key: <Pause />, title: "일시정지", desc: "게임을 멈춤." },
];

export default function ControlOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);
  const controls = IS_TOUCH ? TOUCH_CONTROLS : MOUSE_CONTROLS;

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
          {controls.map((c, i) => (
            <div className="t-item" key={i}>
              <div className="t-key">{c.key}</div>
              <div>
                <b>{c.title}</b>
                <div>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
