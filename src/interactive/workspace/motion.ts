// how long the graph's fits move the view: at once for a student whose system asks for reduced motion
export const fitDuration = (ms: number) =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
