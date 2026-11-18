/**
 * @jest-environment node
 */
/// <reference types="node" />
import { readFileSync } from "fs";
import path from "path";

// The Next Text Probability page draws the logo twice, in its footer and its About dialog, so an id in it would repeat
describe("the Concord logo", () => {
  const svg = readFileSync(path.join(__dirname, "../../assets/concord-logo.svg"), "utf8");

  it("is a drawing with no ids", () => {
    expect(svg).toMatch(/<svg[^>]* viewBox="0 0 389.18 119.4"/);
    expect(svg).toMatch(/<path /);
    expect(svg).not.toMatch(/\sid=/);
  });
});
