import { demoWidths, readDemoWidth } from "./demo-widths";

describe("demo widths", () => {
  it("gives a full-width item's width in each fixed Activity Player layout", () => {
    expect(demoWidths.map(w => [w.id, w.frameWidth]))
      .toEqual([["1100", 1044], ["960", 904], ["responsive", undefined]]);
  });

  it.each([
    ["?width=960", "960"],
    ["?width=responsive", "responsive"],
    ["?width=1100", "1100"],
    ["", "1100"],
    ["?width=800", "1100"],
    ["?other=1&width=960", "960"],
  ])("reads %j as %s", (search, expected) => {
    expect(readDemoWidth(search)).toBe(expected);
  });
});
