/**
 * 「폴 짝」 게임 상수
 *
 * 모든 튜닝 값은 여기에 모아둔다. 게임플레이가 어색하게 느껴진다면
 * 우선 이 파일의 숫자들을 만지는 것으로 시작.
 */

// ──────────────────────────────────────────────
// 월드 / 카메라
// ──────────────────────────────────────────────
export const WORLD = {
  // 개구리는 항상 X+ 방향으로만 전진한다.
  FORWARD: { x: 1, z: 0 },
  // 카메라 오프셋 (개구리 기준 상대 위치) — 더 가깝게 당겨 화면을 꽉 채움
  CAMERA_OFFSET: [-8, 10, -8] as [number, number, number],
  CAMERA_LOOK_AHEAD: 4.5,
  // 연잎이 떠 있는 수면 높이
  WATER_Y: 0,
  // 연잎 윗면 높이 (착지 평면)
  PAD_TOP_Y: 0.3,
};

// ──────────────────────────────────────────────
// 점프
// ──────────────────────────────────────────────
export const JUMP = {
  MIN_DISTANCE: 2.5,
  MAX_DISTANCE: 9.0,
  // 우클릭 드래그 픽셀 → 거리(미터) 변환
  CHARGE_PIXELS_PER_METER: 35,
  // 점프 기본 포물선 정점 높이
  BASE_ARC: 2.2,
  // A/S 키 누적 조정량 (한 점프당)
  ARC_STEP: 0.3,
  ARC_MIN: 0.8,
  ARC_MAX: 4.5,
  // 점프 비행 시간 (초) — 거리에 약간 비례
  TIME_BASE: 0.45,
  TIME_PER_METER: 0.04,
};

// ──────────────────────────────────────────────
// 연잎
// ──────────────────────────────────────────────
export const LILY = {
  RADIUS: 1.0,
  // Yarr 판정 거리 (연잎 중심에서)
  YARR_THRESHOLD: 0.25,
  GREAT_THRESHOLD: 0.55,
  SPAWN_AHEAD: 12,
  // 다음 점프 후보까지 간격을 줄여 더 조밀하게
  MIN_GAP: 2.4,
  MAX_GAP: 4.6,
  // 좌우 흔들림 확대 (지그재그 배치) — 폭을 더 넓혀 화면을 가로지르는 인상
  MAX_LATERAL: 7.0,
  CULL_BEHIND: 12,
  ROTTEN_LIFETIME: 1.2,
  // 장식용(밟을 수 없는) 작은 연잎 밀도
  DECORATIVE_DENSITY: 1.4, // 한 메인 연잎당 평균 N개
  BLINK_PERIOD: 2,
  BLINK_VISIBLE_RATIO: 0.5,
};

// ──────────────────────────────────────────────
// 점수 / 콤보
// ──────────────────────────────────────────────
export const SCORE = {
  YARR: 30,
  GREAT: 20,
  NOT_BAD: 10,
  // 콤보 배율 단계
  COMBO_TIERS: [
    { combo: 0, mult: 1.0 },
    { combo: 5, mult: 1.5 },
    { combo: 10, mult: 2.0 },
    { combo: 20, mult: 3.0 },
    { combo: 40, mult: 4.0 },
  ],
  FLY_BONUS: 50,
};

// ──────────────────────────────────────────────
// 동적 난이도
// ──────────────────────────────────────────────
export const DIFFICULTY = {
  // 거리(미터)에 비례해 0..1 로 정규화. 약 600m에서 1.0 도달.
  DISTANCE_FOR_MAX: 600,
  // 특수 연잎 등장 확률 (난이도 0 → 1)
  SPECIAL_PROB_MIN: 0.2,
  SPECIAL_PROB_MAX: 0.75,
  // 적/장애물 스폰 확률
  ENEMY_PROB_MIN: 0.0,
  ENEMY_PROB_MAX: 0.35,
  // 아이템 스폰 확률
  ITEM_PROB: 0.12,
  // 날씨 변경 주기 (초)
  WEATHER_INTERVAL_MIN: 14,
  WEATHER_INTERVAL_MAX: 26,
};

// ──────────────────────────────────────────────
// 적 / 환경
// ──────────────────────────────────────────────
export const ENEMY = {
  FISH_LUNGE_HEIGHT: 1.6, // 이보다 낮게 날면 잡힘
  BIRD_DIVE_HEIGHT: 2.6, // 이보다 높게 날면 잡힘
  CROC_BASE_DISTANCE: 9, // 개구리 뒤 N미터에서 시작
  CROC_SPEED: 1.00, // m/s 기본 속도 (점수 0 기준). 초반은 넉넉, 머뭇대면 가끔 등장
  CROC_SPEED_MAX: 2.60, // m/s 최대 속도 (CROC_SPEED_MAX_SCORE 도달 시)
  CROC_SPEED_MAX_SCORE: 3000, // 이 점수에서 악어 속도가 CROC_SPEED_MAX에 도달
};

// ──────────────────────────────────────────────
// 색상 팔레트 (Crossy Road 스타일 — 밝고 채도 높게)
// ──────────────────────────────────────────────
export const COLORS = {
  // 수면 — 밝은 시안
  WATER_TOP: "#5cc3e8",
  WATER_BOTTOM: "#3aa3d4",
  WATER_RIPPLE: "#ffffff",
  // 하늘
  FOG: "#cfeaf5",
  SKY_TOP: "#74cfee",
  SKY_BOTTOM: "#b8e5f3",
  // 잔디 둑
  GRASS_TOP: "#c7e26a",
  GRASS_DARK: "#9bc94a",
  GRASS_TUFT: "#7eb840",
  // 개구리
  FROG_BODY: "#6dc352",
  FROG_DARK: "#3f9333",
  FROG_BELLY: "#a8df8c",
  FROG_EYE: "#ffffff",
  FROG_PUPIL: "#101010",
  // 연잎
  LILY_TOP: "#7ed26a",
  LILY_TOP_LIGHT: "#9be07f",
  LILY_BASIC: "#5fbc52",
  LILY_BASIC_DARK: "#3a9437",
  LILY_RIPPLE: "#ffffff",
  LILY_ROTTEN: "#8c7a4a",
  LILY_SLIPPERY: "#8fdfee",
  LILY_MOVING: "#7eb6f5",
  LILY_ROTATING: "#f0c14a",
  LILY_TRAP: "#e35f6f",
  LILY_SPRING: "#ff8ad8",
  LILY_BLINKING: "#d6ee8a",
  // 적/아이템
  FLY: "#202020",
  FISH: "#5a8eab",
  BIRD: "#9a78c8",
  CROC: "#3e572a",
};

// ──────────────────────────────────────────────
// LocalStorage 키
// ──────────────────────────────────────────────
export const STORAGE = {
  HIGH_SCORE: "fall_jjak_high_score_v1",
  MUTED: "fall_jjak_muted_v1",
};
