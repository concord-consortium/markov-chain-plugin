import { fitDuration } from "./motion";

const prefer = (reduce: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
  })) as unknown as typeof window.matchMedia;
};

describe("fitDuration", () => {
  const original = window.matchMedia;
  afterEach(() => (window.matchMedia = original));

  it("keeps the fit's animation unless the system asks for reduced motion", () => {
    prefer(false);
    expect(fitDuration(250)).toBe(250);
  });

  it("moves the view at once when the system asks for reduced motion", () => {
    prefer(true);
    expect(fitDuration(250)).toBe(0);
  });
});
