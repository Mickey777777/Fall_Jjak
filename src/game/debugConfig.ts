/**
 * 🧪 디버그 설정 — 특정 연잎/아이템/적/날씨를 강제 스폰하거나 시작 버프를 부여한다.
 *
 * 모든 값은 프로덕션 빌드(`import.meta.env.DEV === false`)에서 강제로 "끔" 기본값이
 * 되어, 실수로 켠 채 배포돼도 Vite가 죽은 분기를 제거한다. 테스트할 때만 아래
 * DEV 블록의 값을 바꾼다(끝나면 다시 끔 기본값으로).
 */
import type { BuffType, EnemyType, ItemData, LilyPadType, WeatherType } from "./types";

interface DebugConfig {
  /** 특정 연잎만 스폰 (예: "spring"). null이면 정상 스폰 */
  forcePadType: LilyPadType | null;
  /** 특정 파리(아이템)만 스폰 + 초반부터 항상 등장 (예: "swim"). null이면 정상 */
  forceItemType: ItemData["type"] | null;
  /** 적(새/물고기) 항상 스폰, obstacle 제외 */
  alwaysSpawnEnemy: boolean;
  /** 특정 적만 스폰 + 초반부터 항상 등장 ("fish"/"bird"/"obstacle"). null이면 정상 */
  forceEnemyType: EnemyType | null;
  /** 게임 시작 시 들고 시작할 버프 (예: ["swim"]). []면 없음 */
  startBuffs: BuffType[];
  /** 날씨 고정 (예: "rain"). 자동 사이클 중단. null이면 정상 */
  forceWeather: WeatherType | null;
}

// 프로덕션에서 강제되는 "끔" 기본값.
const OFF: DebugConfig = {
  forcePadType: null,
  forceItemType: null,
  alwaysSpawnEnemy: false,
  forceEnemyType: null,
  startBuffs: [],
  forceWeather: null,
};

// 개발 중에만 적용되는 값. 테스트가 끝나면 OFF와 같게 되돌린다.
const DEV: DebugConfig = {
  forcePadType: null,
  forceItemType: null,
  alwaysSpawnEnemy: false,
  forceEnemyType: null,
  startBuffs: [],
  forceWeather: null,
};

export const DEBUG: DebugConfig = import.meta.env.DEV ? DEV : OFF;
