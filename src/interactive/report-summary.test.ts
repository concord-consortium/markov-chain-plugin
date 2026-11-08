import { renderHook } from "@testing-library/react";
import { AnyStartingState } from "../components/generator";
import { MarkovHost } from "../components/host";
import { useMarkovTool } from "../hooks/use-markov-tool";
import { Node, SequenceGroup } from "../type";
import {
  anyStartLabel, defaultMaxLength, maxSummaryText, reportSummaryHtml, reportSummaryLines
} from "./report-summary";
import { encodeOutputs } from "./saved-outputs";

const node = (label: string): Node => ({ id: label, label, value: 0 });
const group = (startingState: string, lengthLimit: number, sequences: string[][],
  more: Partial<SequenceGroup> = {}): SequenceGroup => ({
  startingState, startingNode: startingState ? node(startingState) : undefined, delimiter: " ", lengthLimit,
  orderMatters: true, sequences: sequences.map(sequence => sequence.map(node)), ...more,
});
const generator = (lengthLimit?: number, startingState = "") => ({ startingState, lengthLimit });
const dataState = (groups: SequenceGroup[], settings = generator(20), more = {}) => ({
  version: 1, input: { text: "a b a" }, orderMatters: true,
  useData: { outputs: encodeOutputs(groups), generator: settings }, ...more,
});
const drawing = {
  nodes: [{ id: "n1", label: "Hot", value: 1 }, { id: "n2", label: "Cold", value: 1 }],
  edges: [{ from: "n1", to: "n2", value: 1 }, { from: "n2", to: "n2", value: 1 }],
};

describe("the generator's values the summary repeats", () => {
  it("has the generator's label for no starting state", () => {
    expect(anyStartLabel).toBe(AnyStartingState);
  });

  it("has the Max Length a tool opens at with none saved", () => {
    const host = { viewMode: "dataset", log: jest.fn() } as unknown as MarkovHost;
    const { result } = renderHook(() => useMarkovTool(host));
    expect(defaultMaxLength).toBe(result.current.generatorProps.lengthLimit);
  });
});

// the lines from the one naming the mode on
const counts = (state: unknown, authored: unknown = null) => {
  const lines = reportSummaryLines(state, authored);
  return lines.slice(lines.findIndex(line => /^(Data|Drawing):/.test(line)));
};

describe("reportSummaryLines", () => {
  it("gives the six lines in order, for a page as authored", () => {
    expect(reportSummaryLines({ version: 1 }, { startingText: "a b a" })).toEqual([
      "View: Input, Graph, Inspect, Sequence Generator", "Order matters: Yes", "Case sensitive: No",
      "Data: 2 states, 2 transitions", "Settings: start (any), max length 5", "Outputs: 0",
    ]);
  });

  it("counts each state and each transition in Data mode, with a state's transition to itself", () => {
    expect(counts({ version: 1, input: { text: "the cat the the." } })[0]).toBe("Data: 3 states, 4 transitions");
  });

  it("counts no transitions with order off, as the graph and Inspect show none", () => {
    expect(counts({ version: 1, input: { text: "a b a" }, orderMatters: false })[0])
      .toBe("Data: 2 states, 0 transitions");
  });

  it("says one state and one transition in the singular", () => {
    expect(counts({ version: 1, input: { text: "a b" } })[0]).toBe("Data: 2 states, 1 transition");
    expect(counts({ version: 1, input: { text: "a" } })[0]).toBe("Data: 1 state, 0 transitions");
  });

  it("describes a drawing by its states and arrows, with the start's label", () => {
    const state = { version: 1, mode: "draw", draw: { drawing, generator: generator(10, "n1") } };
    expect(counts(state))
      .toEqual(["Drawing: 2 states, 2 transitions", "Settings: start Hot, max length 10", "Outputs: 0"]);
    const one = { nodes: drawing.nodes, edges: drawing.edges.slice(0, 1) };
    expect(counts({ version: 1, mode: "draw", draw: { drawing: one } })[0]).toBe("Drawing: 2 states, 1 transition");
  });

  it("counts a drawing's arrows whatever Data mode's order switch says", () => {
    expect(counts({ version: 1, mode: "draw", orderMatters: false, draw: { drawing } })[0])
      .toBe("Drawing: 2 states, 2 transitions");
  });

  it("gives empty work as zeros", () => {
    expect(counts({ version: 1 }))
      .toEqual(["Data: 0 states, 0 transitions", "Settings: start (any), max length 5", "Outputs: 0"]);
    expect(counts({ version: 1, mode: "draw" })[0]).toBe("Drawing: 0 states, 0 transitions");
  });

  describe("the View line", () => {
    it("lists only the open panes, in the workspace's order", () => {
      const state = { version: 1, useData: { panes: { input: false, inspect: false } } };
      expect(reportSummaryLines(state, null)[0]).toBe("View: Graph, Sequence Generator");
    });

    it("leaves out a pane the author doesn't offer, and opens one as the author starts it", () => {
      const authored = { panes: { inspect: { available: false }, generator: { startsOpen: false } } };
      expect(reportSummaryLines({ version: 1 }, authored)[0]).toBe("View: Input, Graph");
    });

    it("says none when every pane is collapsed", () => {
      const panes = { input: false, graph: false, inspect: false, generator: false };
      expect(reportSummaryLines({ version: 1, useData: { panes } }, null)[0]).toBe("View: none");
    });

    it("lists the mode showing's panes, where a drawing has no Input pane and its Graph pane is always open", () => {
      const state = {
        version: 1, mode: "draw", useData: { panes: { inspect: false } },
        draw: { panes: { graph: false, generator: false } },
      };
      expect(reportSummaryLines(state, null)[0]).toBe("View: Graph, Inspect");
    });
  });

  describe("the switch lines", () => {
    it("reads the saved settings", () => {
      expect(reportSummaryLines({ version: 1, orderMatters: false, caseSensitive: true }, null).slice(1, 3))
        .toEqual(["Order matters: No", "Case sensitive: Yes"]);
    });

    it("leaves both out in Draw mode, which has neither switch", () => {
      const state = { version: 1, mode: "draw", orderMatters: false, caseSensitive: true, draw: { drawing } };
      expect(reportSummaryLines(state, null)).toEqual([
        "View: Graph, Inspect, Sequence Generator", "Drawing: 2 states, 2 transitions",
        "Settings: start (any), max length 5", "Outputs: 0",
      ]);
    });

    it("reads the author's settings where the page shows no switch", () => {
      const authored = {
        capitalization: "asTyped", showCaseSwitch: false, orderMatters: { startsOn: false, showSwitch: false },
      };
      expect(reportSummaryLines({ version: 1, orderMatters: true, caseSensitive: false }, authored).slice(1, 3))
        .toEqual(["Order matters: No", "Case sensitive: Yes"]);
    });
  });

  it("counts matching outputs across every group", () => {
    const groups = [group("", 20, [["a"], ["a", "b"]]), group("", 5, [["b"]]), group("", 20, [["b", "a"]])];
    expect(counts(dataState(groups))[2]).toBe("Outputs: 3");
  });

  it("counts an empty output", () => {
    expect(counts(dataState([group("", 20, [["a"], []])]))[2]).toBe("Outputs: 2");
  });

  it("compares the starting state, Max Length and order, and not the delimiter", () => {
    const groups = [
      group("a", 20, [["a"]]), group("", 7, [["b"]]), group("", 20, [["a"]], { orderMatters: false }),
      group("", 20, [["a", "b"]], { delimiter: "-" }),
    ];
    expect(counts(dataState(groups))[2]).toBe("Outputs: 1");
  });

  it("counts orderless outputs once order is off", () => {
    const groups = [group("", 20, [["a"]]), group("", 20, [["b"], ["c"]], { orderMatters: false })];
    expect(counts(dataState(groups, generator(20), { orderMatters: false }))[2]).toBe("Outputs: 2");
  });

  it("reads an output saved with no order setting as ordered", () => {
    const groups = [group("", 20, [["a"]], { orderMatters: undefined })];
    expect(counts(dataState(groups))[2]).toBe("Outputs: 1");
  });

  it("counts only the mode showing", () => {
    const state = { ...dataState([group("", 5, [["a"]])]), mode: "draw", draw: { drawing } };
    expect(counts(state)[2]).toBe("Outputs: 0");
  });

  it("counts a drawing's outputs whatever Data mode's order switch says", () => {
    const outputs = encodeOutputs([group("", 5, [["a"]], { orderMatters: undefined })]);
    const state = { version: 1, mode: "draw", orderMatters: false, draw: { drawing, outputs } };
    expect(counts(state)[2]).toBe("Outputs: 1");
  });

  it("keeps every line on a page with no Sequence generator pane", () => {
    const authored = { panes: { generator: { available: false } } };
    expect(reportSummaryLines(dataState([group("", 20, [["a"]])]), authored)).toEqual([
      "View: Input, Graph, Inspect", "Order matters: Yes", "Case sensitive: No", "Data: 2 states, 2 transitions",
      "Settings: start (any), max length 20", "Outputs: 1",
    ]);
  });

  it("uses the starting text when the student never changed the input", () => {
    expect(counts({ version: 1 }, { startingText: "a b" })[0]).toBe("Data: 2 states, 1 transition");
  });

  it("ignores saved input on a page with no Input pane", () => {
    const authored = { startingText: "a", panes: { input: { available: false } } };
    expect(counts({ version: 1, input: { text: "a b" } }, authored)[0]).toBe("Data: 1 state, 0 transitions");
  });

  it("applies a saved case setting only where the page shows the switch", () => {
    const state = { version: 1, caseSensitive: true };
    expect(counts(state, { startingText: "The the" })[0]).toBe("Data: 2 states, 1 transition");
    expect(counts(state, { startingText: "The the", showCaseSwitch: false })[0]).toBe("Data: 1 state, 1 transition");
  });

  it("falls back to the starting mode when the saved mode isn't offered", () => {
    const authored = { modes: { useData: true, draw: false } };
    expect(counts({ version: 1, mode: "draw", draw: { drawing } }, authored)[0]).toMatch(/^Data:/);
  });

  it("reads a starting state that has left the graph as (any)", () => {
    const groups = [group("", 20, [["a"]])];
    expect(counts(dataState(groups, generator(20, "gone"))).slice(1))
      .toEqual(["Settings: start (any), max length 20", "Outputs: 1"]);
  });

  it("compares a drawn state by its id, so renaming it keeps its outputs", () => {
    const startingNode = { id: "n1", label: "Old name", value: 0 };
    const outputs = encodeOutputs([group("n1", 5, [["a"]], { startingNode })]);
    const state = { version: 1, mode: "draw", draw: { drawing, outputs, generator: generator(5, "n1") } };
    expect(counts(state).slice(1)).toEqual(["Settings: start Hot, max length 5", "Outputs: 1"]);
  });

  it("compares the start an output's heading shows, which the one chosen may not be", () => {
    const noStart = { startingNode: undefined };
    const groups = [group("gone", 20, [["a"]], noStart), group("gone", 20, [["b"]])];
    expect(counts(dataState(groups, generator(20, "gone")))[2]).toBe("Outputs: 1");
    const backAgain = [group("a", 20, [["b"]], noStart)];
    expect(counts(dataState(backAgain, generator(20, "a")))[2]).toBe("Outputs: 0");
  });

  it("reads an empty Max Length as the default, and clamps one below 1", () => {
    expect(counts(dataState([], generator(undefined)))[1]).toBe("Settings: start (any), max length 5");
    expect(counts(dataState([], generator(0)))[1]).toBe("Settings: start (any), max length 1");
  });

  it("reads states and authored states as strings, and unreadable ones as nothing", () => {
    expect(counts(JSON.stringify({ version: 1, input: { text: "a" } }))[0]).toBe("Data: 1 state, 0 transitions");
    expect(counts({ version: 1 }, "{\"startingText\":\"b c\"}")[0]).toBe("Data: 2 states, 1 transition");
    expect(counts("not json", "not json")[0]).toBe("Data: 0 states, 0 transitions");
    expect(counts(null, null)[0]).toBe("Data: 0 states, 0 transitions");
  });

  it("cuts a long start by code point", () => {
    const long = "😀".repeat(maxSummaryText + 1);
    expect(counts(dataState([], generator(20, long), { input: { text: long } }))[1])
      .toBe(`Settings: start ${"😀".repeat(maxSummaryText)}…, max length 20`);
  });

  it("leaves a start of exactly the limit whole", () => {
    const text = "x".repeat(maxSummaryText);
    expect(counts(dataState([], generator(20, text), { input: { text } }))[1])
      .toBe(`Settings: start ${text}, max length 20`);
  });
});

describe("reportSummaryHtml", () => {
  const attack = "<img src=x onerror=alert(1)>&";
  const escaped = "&lt;img src=x onerror=alert(1)&gt;&amp;";

  it("holds the sentence and the lines in both the tall and wide blocks", () => {
    const content = "<div style=\"overflow-wrap: anywhere\"><p>The student has saved work in the interactive.</p>" +
      "<p>View: Input, Graph, Inspect, Sequence Generator<br>Order matters: Yes<br>Case sensitive: No<br>" +
      "Data: 1 state, 0 transitions<br>Settings: start (any), max length 5<br>Outputs: 0</p></div>";
    expect(reportSummaryHtml({ version: 1, input: { text: "a" } }, null))
      .toBe(`<div class="tall">${content}</div><div class="wide">${content}</div>`);
  });

  it("escapes a drawn state's label", () => {
    const labeled = { nodes: [{ id: "n1", label: attack, value: 1 }], edges: [] };
    const draw = { drawing: labeled, generator: generator(5, "n1") };
    const html = reportSummaryHtml({ version: 1, mode: "draw", draw }, null);
    expect(html).not.toContain("<img");
    expect(html).toContain(`start ${escaped},`);
  });

  it("cuts before escaping, so an entity isn't split", () => {
    const text = `${"x".repeat(maxSummaryText - 1)}&more`;
    expect(reportSummaryHtml(dataState([], generator(20, text), { input: { text } }), null))
      .toContain(`start ${"x".repeat(maxSummaryText - 1)}&amp;…,`);
  });

  it("gives the same html for the same state", () => {
    const state = dataState([group("", 20, [["a"]])]);
    expect(reportSummaryHtml(state, null)).toBe(reportSummaryHtml(JSON.parse(JSON.stringify(state)), null));
  });
});
