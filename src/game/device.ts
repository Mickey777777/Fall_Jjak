/**
 * 터치 기반(모바일/태블릿) 기기 여부.
 */
export const IS_TOUCH =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;
