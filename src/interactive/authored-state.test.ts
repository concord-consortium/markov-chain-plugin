import {
  defaultAuthoredState, MarkovAuthoredState, modesFor, readAuthoredState, usableModesOf
} from "./authored-state";

// written out rather than taken from defaultAuthoredState, so a changed default fails here
const expectedDefaults: MarkovAuthoredState = {
  version: 1,
  modes: { useData: true, draw: true },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: true },
    graph: { available: true, startsOpen: true },
    inspect: { available: true, startsOpen: true },
    generator: { available: true, startsOpen: true },
  },
  buttons: {
    probabilities: { available: true, startsOn: false },
    sendToCodap: { available: false },
    downloadTables: { available: false },
  },
  inputView: "textAndTable",
  capitalization: "lowercase",
  orderMatters: { startsOn: true, showSwitch: true },
  startingText: "",
};

const customState: MarkovAuthoredState = {
  version: 1,
  modes: { useData: true, draw: false },
  startingMode: "useData",
  panes: {
    input: { available: true, startsOpen: false },
    graph: { available: false, startsOpen: true },
    inspect: { available: false, startsOpen: false },
    generator: { available: true, startsOpen: false },
  },
  buttons: {
    probabilities: { available: true, startsOn: true },
    sendToCodap: { available: true },
    downloadTables: { available: true },
  },
  inputView: "table",
  capitalization: "asTyped",
  orderMatters: { startsOn: false, showSwitch: false },
  startingText: "the cat sat on the mat",
};

describe("usable modes", () => {
  it.each([
    ["draw", { useData: false, draw: true }],
    ["useData", { useData: true, draw: false }],
    ["both", { useData: true, draw: true }],
  ] as const)("saves %s as the two modes' availability, and reads it back", (usable, modes) => {
    expect(modesFor(usable)).toEqual(modes);
    expect(usableModesOf(modes)).toBe(usable);
  });
});

describe("readAuthoredState", () => {
  it.each([
    ["nothing", undefined],
    ["null", null],
    ["{}, what LARA sends for a new interactive", {}],
    ["an unparseable string", "{not json"],
    ["an array", []],
    ["a number", 3],
  ])("reads %s as the defaults", (_, raw) => {
    expect(readAuthoredState(raw)).toEqual(expectedDefaults);
  });

  it("has the defaults written out above", () => {
    expect(defaultAuthoredState).toEqual(expectedDefaults);
  });

  it("returns a complete, valid state unchanged", () => {
    expect(readAuthoredState(customState)).toEqual(customState);
    expect(readAuthoredState(expectedDefaults)).toEqual(expectedDefaults);
  });

  it("reads a JSON string of a state", () => {
    expect(readAuthoredState(JSON.stringify(customState))).toEqual(customState);
  });

  it("changes nothing on a second read", () => {
    const partial = { modes: { draw: false }, panes: { inspect: { available: false } }, inputView: "nope" };
    const once = readAuthoredState(partial);
    expect(readAuthoredState(once)).toEqual(once);
  });

  it("fills in the settings a state doesn't have and keeps the ones it does", () => {
    const read = readAuthoredState({
      version: 1,
      startingMode: "draw",
      panes: { inspect: { available: false } },
      buttons: { probabilities: { startsOn: true } },
      capitalization: "asTyped",
    });
    expect(read).toEqual({
      ...expectedDefaults,
      startingMode: "draw",
      panes: { ...expectedDefaults.panes, inspect: { available: false, startsOpen: true } },
      buttons: { ...expectedDefaults.buttons, probabilities: { available: true, startsOn: true } },
      capitalization: "asTyped",
    });
  });

  it.each([
    ["modes", { modes: "both" }],
    ["a mode", { modes: { useData: "yes", draw: true } }],
    ["the starting mode", { startingMode: "toString" }],
    ["panes", { panes: [] }],
    ["a pane", { panes: { graph: null } }],
    ["a pane's availability", { panes: { inspect: { available: 0 } } }],
    ["a button's starting state", { buttons: { probabilities: { startsOn: "off" } } }],
    ["the download button", { buttons: { downloadTables: { available: "yes" } } }],
    ["the input view", { inputView: "both" }],
    ["the capitalization", { capitalization: "upper" }],
    ["order matters", { orderMatters: { startsOn: "yes", showSwitch: null } }],
    ["the starting text", { startingText: 42 }],
  ])("reads invalid %s as the default", (_, raw) => {
    expect(readAuthoredState(raw)).toEqual(expectedDefaults);
  });

  it("ignores a starting state for a button with no on or off", () => {
    expect(readAuthoredState({ buttons: { sendToCodap: { available: true, startsOn: true } } }).buttons.sendToCodap)
      .toEqual({ available: true });
  });

  it("keeps a starting text longer than the form allows", () => {
    const startingText = "word ".repeat(5000);
    expect(readAuthoredState({ startingText }).startingText).toBe(startingText);
  });

  it("reads no mode available as both available", () => {
    expect(readAuthoredState({ modes: { useData: false, draw: false } }).modes).toEqual({ useData: true, draw: true });
  });

  it("reads the Graph pane as available while Draw is, and as saved without it", () => {
    const panes = { graph: { available: false, startsOpen: false } };
    expect(readAuthoredState({ panes }).panes.graph).toEqual({ available: true, startsOpen: false });
    expect(readAuthoredState({ modes: { useData: true, draw: false }, panes }).panes.graph)
      .toEqual({ available: false, startsOpen: false });
  });

  it.each([
    [{ useData: true, draw: false }, "draw", "useData"],
    [{ useData: false, draw: true }, "useData", "draw"],
  ])("reads a starting mode that isn't available as the available one", (modes, startingMode, expected) => {
    expect(readAuthoredState({ modes, startingMode }).startingMode).toBe(expected);
  });

  it("writes the current version, whatever version it reads", () => {
    expect(readAuthoredState({ version: 0 }).version).toBe(1);
  });
});
