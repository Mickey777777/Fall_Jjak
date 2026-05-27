import {
  CheckCircle2,
  Cloud,
  CloudFog,
  CloudRain,
  Gauge,
  HelpCircle,
  type LucideIcon,
  Star,
  Trophy,
  Waves,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../store/useGameStore";

type HelpTab = "weather" | "buff" | "judgment";
type HelpItem = {
  Icon: LucideIcon;
  name: string;
  description: string;
  color?: string;
};

const WEATHER_HELP: HelpItem[] = [
  {
    Icon: Cloud,
    name: "맑음",
    description: "기본 상태입니다. 시야와 점프 궤적에 별도 방해가 없습니다.",
  },
  {
    Icon: CloudFog,
    name: "안개",
    description: "시야가 제한되어 다음 연잎과 장애물을 미리 파악하기 어려워집니다.",
  },
  {
    Icon: Wind,
    name: "강풍",
    description: "점프 궤적이 바람 방향으로 밀립니다. 바람을 감안해 조준해야 합니다.",
  },
  {
    Icon: CloudRain,
    name: "폭우",
    description: "연잎이 미끄러워져 착지 후 움직임이 더 불안정해집니다.",
  },
  {
    Icon: Cloud,
    name: "구름",
    description: "구름이 지나가며 화면 일부를 가려 순간적으로 판단을 어렵게 만듭니다.",
  },
];

const BUFF_HELP: HelpItem[] = [
  {
    Icon: Gauge,
    name: "사거리",
    color: "#d6bd24",
    description: "잠시 동안 점프 사거리가 늘어나 더 먼 연잎을 노릴 수 있습니다.",
  },
  {
    Icon: Waves,
    name: "수영",
    color: "#3498d8",
    description: "물에 빠졌을 때 한 번 생존해 가까운 연잎으로 복귀합니다.",
  },
  {
    Icon: Star,
    name: "부스트",
    color: "#d65b9f",
    description: "일정 시간 동안 획득 점수가 증가합니다.",
  },
];

const JUDGMENT_HELP: HelpItem[] = [
  {
    Icon: Trophy,
    name: "Yarr! +30",
    color: "#F59E0B",
    description: "연잎 중앙에 아주 가깝게 착지했을 때 받는 최고 판정입니다.",
  },
  {
    Icon: CheckCircle2,
    name: "Great +20",
    color: "#22C55E",
    description: "안정적으로 좋은 위치에 착지했을 때 받는 판정입니다.",
  },
  {
    Icon: Star,
    name: "Not bad.. +10",
    color: "#9CA3AF",
    description: "연잎에 착지했지만 중심에서 조금 벗어났을 때 받는 기본 판정입니다.",
  },
];

export default function MainMenu() {
  const setPhase = useGameStore((s) => s.setPhase);
  const highScore = useGameStore((s) => s.highScore);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="overlay menu">
      <div className="logo">
        <div className="logo-jp">「 폴 짝 」</div>
        <div className="logo-sub">Fall Jjak — 끝없는 연잎 점프</div>
      </div>

      <div className="card">
        <button className="primary" onClick={() => setPhase("playing")}>
          시작하기
        </button>
        <div className="menu-actions">
          <button className="ghost" onClick={() => setPhase("control")}>
            조작법
          </button>
          <button className="ghost help-button" onClick={() => setHelpOpen(true)}>
            <HelpCircle aria-hidden="true" />
            도움말
          </button>
        </div>

        <div className="row hi">Best: {highScore.toLocaleString()}</div>
      </div>

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>("weather");
  const items =
    tab === "weather"
      ? WEATHER_HELP
      : tab === "buff"
        ? BUFF_HELP
        : JUDGMENT_HELP;

  return (
    <div className="help-backdrop" onMouseDown={onClose}>
      <div className="help-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="help-head">
          <div className="help-title">도움말</div>
          <button className="help-close" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="help-tabs">
          <button
            className={tab === "weather" ? "active" : ""}
            onClick={() => setTab("weather")}
          >
            날씨
          </button>
          <button
            className={tab === "buff" ? "active" : ""}
            onClick={() => setTab("buff")}
          >
            버프
          </button>
          <button
            className={tab === "judgment" ? "active" : ""}
            onClick={() => setTab("judgment")}
          >
            판정
          </button>
        </div>

        <div className="help-list">
          {items.map((item) => (
            <div className="help-item" key={item.name}>
              <div className="help-item-name" style={{ color: item.color }}>
                <item.Icon aria-hidden="true" />
                {item.name}
              </div>
              <div className="help-item-desc">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
