import { readAuthoredState } from "./authored-state";
import { settingsSummary } from "./settings-summary";

const listed = (raw: unknown) => settingsSummary(readAuthoredState(raw)).map(({ label, value }) => [label, value]);

describe("settingsSummary", () => {
  it("lists every default setting, in the form's order and with its labels", () => {
    expect(listed({})).toEqual([
      ["Usable mode(s)", "Both (with a toggle switch for students)"],
      ["Starting mode", "Data"],
      ["How students enter their data", "Linked table and text"],
      ["Capital letters", "\"The\" and \"the\" are the same word"],
      ["Start with \"Order matters\" on", "Yes"],
      ["Show students the \"Order matters\" switch", "Yes"],
      ["Starting data", "(empty)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Available"],
      ["Graph pane: Open at the start in Data mode", "Yes"],
      ["Inspect pane", "Available"],
      ["Inspect pane: Open at the start", "Yes"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "No"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Not available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("leaves out what applies only to Data mode, or to a pane that isn't available, as the form does", () => {
    expect(listed({
      modes: { useData: false, draw: true },
      panes: { inspect: { available: false }, generator: { startsOpen: false } },
      buttons: { probabilities: { available: false, startsOn: true }, sendToCodap: { available: true } },
      inputView: "table",
    })).toEqual([
      ["Usable mode(s)", "Draw"],
      ["Graph pane", "Available"],
      ["Inspect pane", "Not available"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "No"],
      ["Probabilities shown at the start", "Yes"],
      ["Show probabilities toggle", "Not available"],
      ["Send to CODAP button", "Available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("lists Data's changed settings, and a Graph pane made unavailable without Draw", () => {
    expect(listed({
      modes: { useData: true, draw: false },
      panes: { graph: { available: false } },
      inputView: "table",
      capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: false },
      startingText: "the cat",
    })).toEqual([
      ["Usable mode(s)", "Data"],
      ["How students enter their data", "Table only"],
      ["Capital letters", "\"The\" and \"the\" are different words"],
      ["Start with \"Order matters\" on", "No"],
      ["Show students the \"Order matters\" switch", "No"],
      ["Starting data", "the cat (7 characters)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Not available"],
      ["Inspect pane", "Available"],
      ["Inspect pane: Open at the start", "Yes"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "No"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Not available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("labels the Graph pane's starting state plainly with Data alone", () => {
    expect(listed({ modes: { useData: true, draw: false } })).toContainEqual(["Graph pane: Open at the start", "Yes"]);
  });

  const startingData = (startingText: string) =>
    listed({ startingText }).find(([label]) => label === "Starting data")?.[1];

  it("shortens a long starting text and counts it", () => {
    expect(startingData("a".repeat(150))).toBe(`${"a".repeat(100)}... (150 characters)`);
    expect(startingData("a".repeat(101))).toBe(`${"a".repeat(100)}... (101 characters)`);
    expect(startingData("a".repeat(100))).toBe(`${"a".repeat(100)} (100 characters)`);
    expect(startingData("a")).toBe("a (1 character)");
  });

  it("never shortens a starting text in the middle of a character", () => {
    expect(startingData(`${"a".repeat(99)}\u{1F600}${"a".repeat(10)}`)).toBe(`${"a".repeat(99)}... (111 characters)`);
  });
});
