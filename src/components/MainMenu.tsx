import {
  CheckCircle2,
  Cloud,
  CloudFog,
  CloudRain,
  Droplets,
  EyeOff,
  Gauge,
  HelpCircle,
  MoveHorizontal,
  RotateCw,
  Skull,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useGameStore } from "../store/useGameStore";

type HelpTab = "weather" | "buff" | "lilypad" | "judgment";
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

const LILYPAD_HELP: HelpItem[] = [
  {
    Icon: Timer,
    name: "썩은 연잎",
    color: "#9c8244",
    description: "한 번 밟으면 잠시 뒤 사라집니다.",
  },
  {
    Icon: Droplets,
    name: "미끄러운 연잎",
    color: "#7dd3e0",
    description: "착지 후 몸이 미끄러져 위치가 밀립니다.",
  },
  {
    Icon: MoveHorizontal,
    name: "움직이는 연잎",
    color: "#5a8fd8",
    description: "좌우 또는 앞뒤로 움직입니다.",
  },
  {
    Icon: RotateCw,
    name: "회전 연잎",
    color: "#f5d36e",
    description: "착지 후 다음 조준 방향이 살짝 틀어집니다.",
  },
  {
    Icon: Skull,
    name: "함정 연잎",
    color: "#e35f6f",
    description: "밟으면 바로 실패합니다.",
  },
  {
    Icon: Zap,
    name: "스프링 연잎",
    color: "#c8ff5e",
    description: "착지하면 탄성으로 튀어 오릅니다.",
  },
  {
    Icon: EyeOff,
    name: "점멸 연잎",
    color: "#d6ee8a",
    description: "나타났다 사라지기를 반복합니다.",
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
    Icon: Sparkles,
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
        : tab === "lilypad"
          ? LILYPAD_HELP
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
            className={tab === "lilypad" ? "active" : ""}
            onClick={() => setTab("lilypad")}
          >
            연잎
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
