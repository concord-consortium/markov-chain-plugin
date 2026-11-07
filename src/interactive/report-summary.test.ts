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

describe("reportSummaryLines", () => {
  it("counts each word token and each state in Data mode, with the punctuation the tokenizer keeps", () => {
    expect(reportSummaryLines({ version: 1, input: { text: "the cat [New York] the." } }, null)[0])
      .toBe("Data: 5 words, 4 states");
  });

  it("counts no word for a blank line", () => {
    expect(reportSummaryLines({ version: 1, input: { text: "a b\n\n\nc a" } }, null)[0])
      .toBe("Data: 4 words, 3 states");
  });

  it("says one word and one state in the singular", () => {
    expect(reportSummaryLines({ version: 1, input: { text: "cat" } }, null)[0]).toBe("Data: 1 word, 1 state");
  });

  it("describes a drawing, with the start's label and no order line", () => {
    const state = { version: 1, mode: "draw", draw: { drawing, generator: generator(10, "n1") } };
    expect(reportSummaryLines(state, null)).toEqual([
      "Drawing: 2 states, 2 arrows", "Outputs: 0", "Settings: start Hot, max length 10"
    ]);
  });

  it("says one arrow in the singular", () => {
    const one = { nodes: drawing.nodes, edges: drawing.edges.slice(0, 1) };
    expect(reportSummaryLines({ version: 1, mode: "draw", draw: { drawing: one } }, null)[0])
      .toBe("Drawing: 2 states, 1 arrow");
  });

  it("gives empty work as zeros, with no latest", () => {
    expect(reportSummaryLines({ version: 1 }, null))
      .toEqual(["Data: 0 words, 0 states", "Outputs: 0", "Settings: start (any), max length 5, order matters on"]);
    expect(reportSummaryLines({ version: 1, mode: "draw" }, null)[0]).toBe("Drawing: 0 states, 0 arrows");
  });

  it("counts matching outputs across every group, and takes the newest matching one as latest", () => {
    const groups = [
      group("", 20, [["a"], ["a", "b"]]), group("", 5, [["b"]]), group("", 20, [["b", "a"]]),
      group("", 5, [["newest"]]),
    ];
    expect(reportSummaryLines(dataState(groups), null)[1]).toBe("Outputs: 3, latest: b a");
  });

  it("takes the newest output in a group as latest", () => {
    expect(reportSummaryLines(dataState([group("", 20, [["old"], ["new"]])]), null)[1])
      .toBe("Outputs: 2, latest: new");
  });

  it("counts an empty output, and shows no latest for it", () => {
    expect(reportSummaryLines(dataState([group("", 20, [["a"], []])]), null)[1]).toBe("Outputs: 2");
  });

  it("compares the starting state, Max Length and order, and not the delimiter", () => {
    const groups = [
      group("a", 20, [["a"]]), group("", 7, [["b"]]), group("", 20, [["a"]], { orderMatters: false }),
      group("", 20, [["a", "b"]], { delimiter: "-" }),
    ];
    expect(reportSummaryLines(dataState(groups), null)[1]).toBe("Outputs: 1, latest: a-b");
  });

  it("counts orderless outputs once order is off", () => {
    const groups = [group("", 20, [["a"]]), group("", 20, [["b"]], { orderMatters: false })];
    expect(reportSummaryLines(dataState(groups, generator(20), { orderMatters: false }), null).slice(1)).toEqual([
      "Outputs: 1, latest: b", "Settings: start (any), max length 20, order matters off"
    ]);
  });

  it("reads an output saved with no order setting as ordered", () => {
    const groups = [group("", 20, [["a"]], { orderMatters: undefined })];
    expect(reportSummaryLines(dataState(groups), null)[1]).toBe("Outputs: 1, latest: a");
  });

  it("counts only the mode showing", () => {
    const state = { ...dataState([group("", 5, [["a"]])]), mode: "draw", draw: { drawing } };
    expect(reportSummaryLines(state, null)[1]).toBe("Outputs: 0");
  });

  it("counts a drawing's outputs whatever Data mode's order switch says", () => {
    const outputs = encodeOutputs([group("", 5, [["a"]], { orderMatters: undefined })]);
    const state = { version: 1, mode: "draw", orderMatters: false, draw: { drawing, outputs } };
    expect(reportSummaryLines(state, null)[1]).toBe("Outputs: 1, latest: a");
  });

  it("keeps all three lines on a page with no Sequence generator pane", () => {
    const authored = { panes: { generator: { available: false } } };
    expect(reportSummaryLines(dataState([group("", 20, [["a"]])]), authored)).toEqual([
      "Data: 3 words, 2 states", "Outputs: 1, latest: a", "Settings: start (any), max length 20, order matters on"
    ]);
  });

  it("uses the starting text when the student never changed the input", () => {
    expect(reportSummaryLines({ version: 1 }, { startingText: "a b" })[0]).toBe("Data: 2 words, 2 states");
  });

  it("ignores saved input on a page with no Input pane", () => {
    const authored = { startingText: "a", panes: { input: { available: false } } };
    expect(reportSummaryLines({ version: 1, input: { text: "a b" } }, authored)[0]).toBe("Data: 1 word, 1 state");
  });

  it("applies a saved case setting only where the page shows the switch", () => {
    const state = { version: 1, caseSensitive: true };
    expect(reportSummaryLines(state, { startingText: "The the" })[0]).toBe("Data: 2 words, 2 states");
    expect(reportSummaryLines(state, { startingText: "The the", showCaseSwitch: false })[0])
      .toBe("Data: 2 words, 1 state");
  });

  it("applies saved order only where the page shows the switch", () => {
    const authored = { orderMatters: { startsOn: true, showSwitch: false } };
    expect(reportSummaryLines({ version: 1, orderMatters: false }, authored)[2]).toContain("order matters on");
  });

  it("falls back to the starting mode when the saved mode isn't offered", () => {
    const authored = { modes: { useData: true, draw: false } };
    expect(reportSummaryLines({ version: 1, mode: "draw", draw: { drawing } }, authored)[0]).toMatch(/^Data:/);
  });

  it("reads a starting state that has left the graph as (any)", () => {
    const groups = [group("", 20, [["a"]])];
    expect(reportSummaryLines(dataState(groups, generator(20, "gone")), null).slice(1)).toEqual([
      "Outputs: 1, latest: a", "Settings: start (any), max length 20, order matters on"
    ]);
  });

  it("compares a drawn state by its id, so renaming it keeps its outputs", () => {
    const startingNode = { id: "n1", label: "Old name", value: 0 };
    const outputs = encodeOutputs([group("n1", 5, [["a"]], { startingNode })]);
    const state = { version: 1, mode: "draw", draw: { drawing, outputs, generator: generator(5, "n1") } };
    expect(reportSummaryLines(state, null).slice(1))
      .toEqual(["Outputs: 1, latest: a", "Settings: start Hot, max length 5"]);
  });

  it("compares the start an output's heading shows, which the one chosen may not be", () => {
    const noStart = { startingNode: undefined };
    const groups = [group("gone", 20, [["a"]], noStart), group("gone", 20, [["b"]])];
    expect(reportSummaryLines(dataState(groups, generator(20, "gone")), null)[1]).toBe("Outputs: 1, latest: a");
    const backAgain = [group("a", 20, [["b"]], noStart)];
    expect(reportSummaryLines(dataState(backAgain, generator(20, "a")), null)[1]).toBe("Outputs: 0");
  });

  it("reads an empty Max Length as the default, and clamps one below 1", () => {
    expect(reportSummaryLines(dataState([], generator(undefined)), null)[2]).toContain("max length 5,");
    expect(reportSummaryLines(dataState([], generator(0)), null)[2]).toContain("max length 1,");
  });

  it("reads states and authored states as strings, and unreadable ones as nothing", () => {
    expect(reportSummaryLines(JSON.stringify({ version: 1, input: { text: "a" } }), null)[0])
      .toBe("Data: 1 word, 1 state");
    expect(reportSummaryLines({ version: 1 }, "{\"startingText\":\"b c\"}")[0]).toBe("Data: 2 words, 2 states");
    expect(reportSummaryLines("not json", "not json")[0]).toBe("Data: 0 words, 0 states");
    expect(reportSummaryLines(null, null)[0]).toBe("Data: 0 words, 0 states");
  });

  it("cuts a long output and a long start by code point", () => {
    const long = "😀".repeat(maxSummaryText + 1);
    const state = dataState([group(long, 20, [[long]])], generator(20, long), { input: { text: long } });
    const cut = `${"😀".repeat(maxSummaryText)}…`;
    expect(reportSummaryLines(state, null).slice(1)).toEqual([
      `Outputs: 1, latest: ${cut}`, `Settings: start ${cut}, max length 20, order matters on`
    ]);
  });

  it("leaves text of exactly the limit whole", () => {
    const text = "x".repeat(maxSummaryText);
    expect(reportSummaryLines(dataState([group("", 20, [[text]])]), null)[1]).toBe(`Outputs: 1, latest: ${text}`);
  });
});

describe("reportSummaryHtml", () => {
  const attack = "<img src=x onerror=alert(1)>&";
  const escaped = "&lt;img src=x onerror=alert(1)&gt;&amp;";

  it("holds the sentence and the three lines in both the tall and wide blocks", () => {
    const content = "<div style=\"overflow-wrap: anywhere\"><p>The student has saved work in the interactive.</p>" +
      "<p>Data: 1 word, 1 state<br>Outputs: 0<br>Settings: start (any), max length 5, order matters on</p></div>";
    expect(reportSummaryHtml({ version: 1, input: { text: "a" } }, null))
      .toBe(`<div class="tall">${content}</div><div class="wide">${content}</div>`);
  });

  it("escapes a drawn state's label and an output", () => {
    const labeled = { nodes: [{ id: "n1", label: attack, value: 1 }], edges: [] };
    const outputs = encodeOutputs([group("n1", 5, [[attack]])]);
    const html = reportSummaryHtml({
      version: 1, mode: "draw", draw: { drawing: labeled, outputs, generator: generator(5, "n1") }
    }, null);
    expect(html).not.toContain("<img");
    expect(html).toContain(`latest: ${escaped}<br>`);
    expect(html).toContain(`start ${escaped},`);
  });

  it("cuts before escaping, so an entity isn't split", () => {
    const text = `${"x".repeat(maxSummaryText - 1)}&more`;
    expect(reportSummaryHtml(dataState([group("", 20, [[text]])]), null))
      .toContain(`latest: ${"x".repeat(maxSummaryText - 1)}&amp;…<br>`);
  });

  it("gives the same html for the same state", () => {
    const state = dataState([group("", 20, [["a"]])]);
    expect(reportSummaryHtml(state, null)).toBe(reportSummaryHtml(JSON.parse(JSON.stringify(state)), null));
  });
});
