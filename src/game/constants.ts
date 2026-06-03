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
  // 카메라 세로 FOV(도). 가로 화면(비율≥1)에서 쓰는 기본값.
  CAMERA_FOV: 45,
  // 세로 모드에서 가로 시야를 넓히려 FOV를 키울 때 허용하는 상한(도).
  CAMERA_FOV_MAX: 60,
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
  // 이동 연잎 위치 공식 sin(t*freq)*amp 의 기본값 (개별 pad에 amplitude/frequency가 없을 때)
  MOVING_DEFAULT_AMP: 1.4,
  MOVING_DEFAULT_FREQ: 0.8,
};

// ──────────────────────────────────────────────
// 점수 / 콤보
// ──────────────────────────────────────────────
export const SCORE = {
  YARR: 30,
  GREAT: 25,
  NOT_BAD: 15,
  // 콤보 배율 단계
  COMBO_TIERS: [
    { combo: 0, mult: 1.0 },
    { combo: 5, mult: 1.2 },
    { combo: 10, mult: 1.4 },
    { combo: 15, mult: 1.6 },
    { combo: 20, mult: 1.8 },
    { combo: 25, mult: 2.0 },
    { combo: 30, mult: 2.2 },
    { combo: 35, mult: 2.4 },
    { combo: 40, mult: 2.6 },
  ],
  FLY_BONUS: 50,
  // 콤보 idle 초기화: 마지막 착지 후 이 시간(초) 안에 다음 착지가 없으면 콤보 리셋.
  // 기본 10초에서 콤보 배율이 한 단계 오를 때마다 0.5초씩 줄어 압박이 커진다 (최소 2초).
  COMBO_IDLE_RESET_BASE: 10,
  COMBO_IDLE_RESET_PER_TIER: 0.5,
  COMBO_IDLE_RESET_MIN: 2,
  // 콤보 끊김 경고: 리셋까지 남은 시간이 제한 시간의 이 비율 이하로 떨어지면 경고 시작(0→1 램프).
  // 0.5 = 절반 남았을 때부터 천천히 깜빡이기 시작해 끝으로 갈수록 강해짐.
  COMBO_IDLE_WARN_FRACTION: 0.5,
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
  // 이보다 낮게 날면 잡힘. 기본 점프 정점(arcHeight 기본 2.2)보다 높게 둬서
  // "기본 점프로는 물고기에 걸리고, A로 궤적을 높여야 통과" → 점프를 강제한다.
  FISH_LUNGE_HEIGHT: 2.4,
  // 이보다 높게 날면 잡힘. 기본 점프 정점(arcHeight 기본 2.2)보다 낮게 둬야
  // "기본 점프로는 새에 걸리고, S로 궤적을 낮춰야 통과" 가 성립한다.
  BIRD_DIVE_HEIGHT: 1.9,
  BIRD_SPAWN_Y: 2.5, // 새 스폰 높이 — 판정선과 맞춰 "보이는 새 아래로 통과"가 자연스럽게
  // 물고기 도약 — 렌더와 충돌이 공유하는 y 공식 (fishLiveY). 잠겨 있을 땐 피격 없음
  FISH_LEAP_FREQ: 1.6, // 솟구침 주기
  FISH_REST_Y: -1.3, // 잠긴 상태 기준 y (몸 최고점도 수면 아래)
  FISH_LEAP_RISE: 2.2, // 도약 상승량 보정 (실제 상승 = leap × (amp + 이 값)) — 판정선(2.4)까지 솟구치도록 상향
  FISH_DEFAULT_AMP: 1, // amplitude 기본값
  FISH_BREACH_Y: -0.5, // 물고기 몸 중심이 이 높이(수면) 위로 솟았을 때만 피격 판정
  // 물고기 히트박스 — 머리-꼬리(x)로 길고 옆(z)으로 좁은 몸에 맞춘 타원 (원형은 옆으로 과대)
  FISH_HALF_LEN: 0.85, // x (머리-꼬리 방향) 반길이
  FISH_HALF_WID: 0.55, // z (옆) 반너비 — 몸(±0.2) + 도약 시 솟구침·개구리 몸 여유
  // 새 히트박스 — 날개 폭(z)이 몸 길이(x)보다 넓은 몸에 맞춘 타원 (가로로 넓음)
  BIRD_HALF_LEN: 1.0, // x (몸통-꼬리) 반길이
  BIRD_HALF_WID: 1.25, // z (날개 폭) 반너비
  // 새 좌우 패트롤 — 렌더와 충돌이 공유 (진동수 / amplitude 기본값)
  BIRD_PATROL_FREQ: 1.1,
  BIRD_DEFAULT_AMP: 1.5,
  CROC_BASE_DISTANCE: 9, // 개구리 뒤 N미터에서 시작
  CROC_SPEED: 1.00, // m/s 기본 속도 (점수 0 기준). 초반은 넉넉, 머뭇대면 가끔 등장
  CROC_SPEED_MAX: 2.60, // m/s 최대 속도 (CROC_SPEED_MAX_SCORE 도달 시)
  CROC_SPEED_MAX_SCORE: 3000, // 이 점수에서 악어 속도가 CROC_SPEED_MAX에 도달
  // 환경 장애물(나뭇가지 더미) — 시각이 비스듬히 누운 길쭉한 막대라 원형이 아닌
  // 방향성 박스(OBB)로 판정해 "보이는 막대"와 히트박스를 일치시킨다.
  // YAW는 EnemyManager 렌더의 메인 박스 rotation[1](0.4)과 맞춤.
  OBSTACLE_YAW: 0.4,
  OBSTACLE_HALF_LEN: 0.95, // 막대 길이 방향 반(half) 길이 (시각 ~0.9 + 약간의 여유)
  OBSTACLE_HALF_WID: 0.45, // 막대 폭 방향 반(half) 너비 (시각 ~0.3 + 개구리 몸 여유)
  OBSTACLE_BLOCK_HEIGHT: 2.2, // 이 높이 미만이면 가로막힘
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
  BIRD: "#604224",
  CROC: "#3e572a",
};

// ──────────────────────────────────────────────
// LocalStorage 키
// ──────────────────────────────────────────────
export const STORAGE = {
  HIGH_SCORE: "fall_jjak_high_score_v1",
  MUTED: "fall_jjak_muted_v1",
};
