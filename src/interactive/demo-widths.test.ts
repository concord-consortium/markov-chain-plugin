import { readDemoWidth } from "./demo-widths";

describe("demo widths", () => {
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
