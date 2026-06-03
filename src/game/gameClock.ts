/**
 * 게임 내부 시계 — 일시정지(또는 메뉴/게임오버) 동안 멈추는 시간축.
 *
 * 모든 게임플레이 타임스탬프/애니메이션은 `performance.now()`(벽시계) 대신
 * 이 모듈의 `gameNow()` / `gameNowMs()`를 써야 한다. 그래야 일시정지 동안
 * 흐른 실제 시간이 게임 시간에 반영되지 않아 새·물고기·콤보 타이머 등이
 * 멈췄다가 재개될 때 튀지 않는다.
 *
 * 구현: 게임 시간 = 벽시계 - 누적 일시정지 시간. 일시정지 중에는 기준 시각을
 * 정지 시점으로 고정하므로 별도의 매 프레임 갱신(advance) 없이도 멈춘다.
 * 호출 순서에 의존하지 않는다.
 */

let pausedAccumMs = 0; // 지금까지 일시정지로 흘려보낸 누적 벽시계 ms
let pauseStartMs = 0; // 현재 일시정지가 시작된 벽시계 ms (0이면 진행 중)

/** 일시정지 진입 — 게임 시계를 멈춘다 (중복 호출 안전) */
export function pauseClock(): void {
  if (pauseStartMs === 0) pauseStartMs = performance.now();
}

/** 일시정지 해제 — 멈춰 있던 시간만큼 누적치에 더하고 시계를 재개 (중복 호출 안전) */
export function resumeClock(): void {
  if (pauseStartMs !== 0) {
    pausedAccumMs += performance.now() - pauseStartMs;
    pauseStartMs = 0;
  }
}

/** 일시정지 동안 멈추는 게임 시간 (ms) — `performance.now()` 대체 */
export function gameNowMs(): number {
  const base = pauseStartMs !== 0 ? pauseStartMs : performance.now();
  return base - pausedAccumMs;
}

/** 일시정지 동안 멈추는 게임 시간 (초) — `performance.now() / 1000` 대체 */
export function gameNow(): number {
  return gameNowMs() / 1000;
}
