import { defaultAuthoredState, MarkovAuthoredState, readAuthoredState } from "./authored-state";
import { authoredStateFromSearch, searchFromAuthoredState, urlSettings } from "./url-settings";

const customState: MarkovAuthoredState = {
  ...defaultAuthoredState,
  modes: { useData: true, draw: false },
  panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
  buttons: {
    probabilities: { available: true, startsOn: true },
    sendToCodap: { available: true },
    downloadTables: { available: true },
  },
  inputView: "table",
  capitalization: "asTyped",
  orderMatters: { startsOn: false, showSwitch: false },
  startingText: "the cat & the hat = 2?\nYes: 100% \"sure\"",
};

describe("settings in a link", () => {
  it("covers every setting by its path, each one true or false, or text", () => {
    expect(urlSettings.map(([path, fallback]) => [path.join("."), typeof fallback])).toEqual([
      ["modes.useData", "boolean"],
      ["modes.draw", "boolean"],
      ["startingMode", "string"],
      ["panes.input.available", "boolean"],
      ["panes.input.startsOpen", "boolean"],
      ["panes.graph.available", "boolean"],
      ["panes.graph.startsOpen", "boolean"],
      ["panes.inspect.available", "boolean"],
      ["panes.inspect.startsOpen", "boolean"],
      ["panes.generator.available", "boolean"],
      ["panes.generator.startsOpen", "boolean"],
      ["buttons.probabilities.available", "boolean"],
      ["buttons.probabilities.startsOn", "boolean"],
      ["buttons.sendToCodap.available", "boolean"],
      ["buttons.downloadTables.available", "boolean"],
      ["inputView", "string"],
      ["capitalization", "string"],
      ["orderMatters.startsOn", "boolean"],
      ["orderMatters.showSwitch", "boolean"],
      ["startingText", "string"],
    ]);
  });

  it("reads each setting it is given, and the default for the rest", () => {
    const search = "?modes.draw=false&panes.inspect.available=false&buttons.probabilities.startsOn=true" +
      "&orderMatters.showSwitch=false&inputView=table&startingText=the+cat+sat";
    expect(authoredStateFromSearch(search)).toEqual({
      ...defaultAuthoredState,
      modes: { useData: true, draw: false },
      panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
      buttons: { ...defaultAuthoredState.buttons, probabilities: { available: true, startsOn: true } },
      inputView: "table",
      orderMatters: { startsOn: true, showSwitch: false },
      startingText: "the cat sat",
    });
  });

  it.each([
    ["true or false as other text", "?modes.draw=no&panes.inspect.available=FALSE&buttons.probabilities.startsOn=yes"],
    ["a choice that isn't one", "?inputView=sideways&startingMode=fly"],
    ["an unknown setting", "?panes.zoom.available=false&buttons.sendToCodap.startsOn=true&width=960"],
    ["no mode", "?modes.useData=false&modes.draw=false"],
    ["nothing", ""],
  ])("reads %s as the defaults", (_, search) => {
    expect(authoredStateFromSearch(search)).toEqual(readAuthoredState({}));
  });

  it("puts only the settings that differ from the defaults in a link", () => {
    expect(searchFromAuthoredState(defaultAuthoredState)).toBe("");
    expect(searchFromAuthoredState({ ...defaultAuthoredState, inputView: "text" })).toBe("?inputView=text");
  });

  it("reads back the settings it puts in a link", () => {
    expect(authoredStateFromSearch(searchFromAuthoredState(customState))).toEqual(customState);
  });
});
