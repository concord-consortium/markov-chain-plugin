/// <reference types="node" />
import fs from "fs";
import path from "path";
import { logEvents } from "./log-events";

// the backticked name in the first column of each table row
const documentedEvents = () => {
  const doc = fs.readFileSync(path.join(__dirname, "../../LOGGED-EVENTS.md"), "utf8");
  return doc.split("\n")
    .map(line => line.match(/^\|\s*`(\w+)`\s*\|/)?.[1])
    .filter((name): name is string => !!name);
};

describe("logEvents", () => {
  it("lists exactly the events LOGGED-EVENTS.md describes", () => {
    const documented = documentedEvents();
    expect(documented.length).toBeGreaterThan(0);
    expect([...documented].sort()).toEqual([...logEvents].sort());
  });
});
