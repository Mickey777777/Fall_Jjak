/**
 * 슬롯 리사이클러 — 무한 스크롤 월드의 장식 배치용.
 *
 * ## 문제
 *
 * 매 프레임 `floor(frogX) + 상수` 로 위치를 계산하면, 개구리가 1m 전진할 때
 * 모든 instance도 1m 전진해서 마치 배경이 개구리를 따라다니는 컨베이어 벨트처럼 보인다.
 *
 * ## 해결
 *
 * 각 instance는 **자기 슬롯(slot)** 을 가지고, 슬롯은 월드 좌표 단위(SPACING)로 매핑된다.
 * - 슬롯 S 의 월드 X = `S * SPACING + hash(S) * SPACING`
 * - 슬롯은 한 번 설정되면 절대 바뀌지 않는다.
 * - 단, instance 의 슬롯이 카메라 뒤로 너무 멀어지면 (`s < playerSlot - cullBehind`)
 *   슬롯을 N 만큼 증가시켜 카메라 앞쪽 (`s + N`) 으로 한 번에 점프시킨다.
 *   이 점프는 카메라 시야 밖에서 일어나므로 보이지 않는다.
 *
 * 이 구조에서 instance 의 월드 위치는 슬롯 점프가 일어나기 전까지 항상 동일하다.
 * → 개구리가 움직여도 instance 는 월드에 고정되어 있고, 카메라 이동만으로 화면 밖으로 빠진다.
 */

/** 초기 슬롯 배열 — `i - cullBehind` 부터 시작해 N 개. */
export function initSlots(N: number, cullBehind: number): number[] {
  const a = new Array<number>(N);
  for (let i = 0; i < N; i++) a[i] = i - cullBehind;
  return a;
}

/**
 * 슬롯을 갱신하고 모든 instance 를 순회한다.
 * @param slots       슬롯 배열 (mutate)
 * @param playerWorldX 개구리 월드 X (단위: 미터)
 * @param spacing     슬롯 한 칸의 월드 폭 (미터)
 * @param cullBehind  카메라 뒤로 몇 슬롯까지 두고, 그 이상 멀어지면 앞으로 점프
 * @param visit       각 instance 에 대해 호출되는 콜백 (instanceIdx, 월드 슬롯)
 */
export function updateSlots(
  slots: number[],
  playerWorldX: number,
  spacing: number,
  cullBehind: number,
  visit: (instanceIdx: number, slot: number) => void,
): void {
  const playerSlot = Math.floor(playerWorldX / spacing);
  const min = playerSlot - cullBehind;
  const N = slots.length;
  for (let i = 0; i < N; i++) {
    let s = slots[i];
    while (s < min) s += N;
    slots[i] = s;
    visit(i, s);
  }
}

/** 슬롯 단위의 결정론적 hash (Math.sin 기반). 결과는 0..1 . */
export function slotHash(slot: number, salt: number = 0): number {
  const x = Math.sin(slot * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
