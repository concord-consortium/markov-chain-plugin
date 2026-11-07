# Implementation Plan: The AP Interactive's Summary of Each Student's Work in the Dashboard

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-19
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Two small commits, each building and passing on its own, so a reviewer new to the code can read one idea at a time. Nothing under `src/components` or `src/hooks` changes, and the plugin's bundle stays byte-identical (R17). Every step's code below was built and run on master before this plan was written (requirements, "Checked by building the proposed code").

Checks after each step: `npm test`, `npx tsc --noEmit`, `npx tsc --noEmit -p cypress`, `npm run lint`, `npm run lint:build`, `npm run lint:style`. After the last, Cypress `interactive-report-item.test.ts` and `interactive-demo.test.ts` against the dev server, then `npm run build:webpack` and the byte check:

```bash
cmp dist/assets/index.*.js <master build>/assets/index.*.js
cmp dist/assets/main.*.css <master build>/assets/main.*.css
```

(Build `origin/master` in a separate worktree or copy with its own `node_modules`, or keep a copy of `dist/` taken before the branch's first commit. A symlinked `node_modules` changes webpack's module ids, so the bundle differs for no real reason. The file names carry content hashes, so the same names already mean the same bytes.)

---

### The summary of a saved moment

**Summary**: A pure function from a state and an authored state to the three lines (R2 to R8), and one to the HTML (R9 to R12), with their Jest tests (R18). It reads the work through `restoreWork`, the function the read-only view uses, so the two can't disagree (R6). Nothing calls it yet.

**Files affected**:
- `src/interactive/report-summary.ts`: new.
- `src/interactive/report-summary.test.ts`: new.

**Estimated diff size**: ~280 lines, most of it tests

Notes for the reviewer:

- `{ readOnly: true }` only drops the saved zoom, which the summary doesn't read.
- `restoredMode` always sets `graph`, `sequenceGroups` and `generator`, though `MarkovToolStart` types them as optional, so the summary casts where it reads them rather than adding fallbacks no test could reach. `import type` keeps the hook out of the report item's bundle.
- `anyStartLabel` and `defaultMaxLength` repeat the generator's values, each held to the real one by a test (requirements, "The two values the summary repeats").
- Outputs compare on `group.startingNode`, not `group.startingState`. The generator keeps a chosen state after it leaves the graph, so `startingState` can name a state the output never started from; `startingNode` is what its heading in the output list shows, so the count agrees with the headings. It can be wrong for a later output in the same group (requirements, Other notes).
- Words are the sum of the states' `value`s: `chainsToGraph` counts each occurrence of a label, and breaks (`""`) aren't states, so the sum is the number of word tokens.
- Escaping covers `&`, `<` and `>`, which is enough for text inside an element; nothing student-written goes into an attribute.
- The `overflow-wrap: anywhere` is inline because the dashboard injects its own `<style>` and nothing else; a second `<style>` in the item would also work, but one attribute is less to read.

```ts
import { clampLengthLimit } from "../components/app-utils";
import type { MarkovToolStart } from "../hooks/use-markov-tool";
import { readAuthoredState } from "./authored-state";
import { readInteractiveState } from "./interactive-state";
import { restoreWork } from "./workspace/restore-work";
import { workspaceConfig } from "./workspace/workspace-config";

export const maxSummaryText = 60;

// what the generator shows for no starting state, and the Max Length it opens at when none is saved
export const anyStartLabel = "(any)";
export const defaultMaxLength = 5;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// by code point, so a surrogate pair isn't split
const cutShort = (text: string) => {
  const characters = [...text];
  return characters.length > maxSummaryText ? `${characters.slice(0, maxSummaryText).join("")}…` : text;
};

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// The three lines for a saved moment, read as the teacher's read-only view reads it, so the two agree. An output counts
// when its heading's settings match the third line; a delimiter changes only how it is written.
export const reportSummaryLines = (interactiveState: unknown, authoredState: unknown): string[] => {
  const authored = readAuthoredState(authoredState);
  const restored = restoreWork(readInteractiveState(interactiveState), authored, {
    useData: workspaceConfig(authored, "useData"), draw: workspaceConfig(authored, "draw"),
  }, { readOnly: true });
  const inData = restored.mode === "useData";
  // restoreWork always fills these in
  const { graph, generator, sequenceGroups } = restored[restored.mode].tool as Required<MarkovToolStart>;
  const startingState = generator.startingState ?? "";
  const lengthLimit = clampLengthLimit(generator.lengthLimit) ?? defaultMaxLength;
  const orderMatters = !inData || restored.orderMatters;

  const outputs = sequenceGroups
    .filter(group => (group.startingNode?.id ?? "") === startingState && group.lengthLimit === lengthLimit &&
      (group.orderMatters !== false) === orderMatters)
    .flatMap(group => group.sequences.map(sequence => sequence.map(node => node.label).join(group.delimiter)));
  const latest = outputs[outputs.length - 1];
  const start = graph.nodes.find(node => node.id === startingState)?.label ?? anyStartLabel;
  const words = graph.nodes.reduce((count, node) => count + node.value, 0);

  return [
    inData
      ? `Data: ${counted(words, "word")}, ${counted(graph.nodes.length, "state")}`
      : `Drawing: ${counted(graph.nodes.length, "state")}, ${counted(graph.edges.length, "arrow")}`,
    `Outputs: ${outputs.length}${latest ? `, latest: ${cutShort(latest)}` : ""}`,
    `Settings: start ${cutShort(start)}, max length ${lengthLimit}` +
      (inData ? `, order matters ${orderMatters ? "on" : "off"}` : ""),
  ];
};

// The dashboard shows one block or the other. Each holds a single child so its paragraphs stack in the row the wide
// block is, and the student's text is escaped because the dashboard draws this in a frame on its own origin.
export const reportSummaryHtml = (interactiveState: unknown, authoredState: unknown) => {
  const lines = reportSummaryLines(interactiveState, authoredState).map(escapeHtml).join("<br>");
  const content = "<div style=\"overflow-wrap: anywhere\"><p>The student has saved work in the interactive.</p>" +
    `<p>${lines}</p></div>`;
  return `<div class="tall">${content}</div><div class="wide">${content}</div>`;
};
```

```ts
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
```

---

### Answer the dashboard with the summary, without "View Work"

**Summary**: The report item passes the request's `interactiveState` and `authoredState` to the answer, whose links item gets `hideViewInline: true` (R1, R13, R14). The placeholder goes, and with it the demo page's import of it: its report item frame shows the summary of the runtime's last save, or of the authored page before one, tall enough for four lines (R15). The fake Activity Player page learns to send a different state per request, so Cypress can check a scrubber step in one frame (R19). README describes the new answer (R16). The demo goes in this commit rather than its own because its Cypress test reads the placeholder's text and would fail in between.

**Files affected**:
- `src/interactive/report-item-answer.ts`: build the full answer from the summary; delete `placeholderReportHtml`.
- `src/interactive/report-item-answer.test.ts`: rewritten.
- `src/interactive/report-item.tsx`: pass the states through.
- `cypress/fake-ap/fake-ap.ts`, `cypress/support/fake-ap-commands.ts`, `cypress/support/fake-ap.d.ts`: an optional `interactiveState` argument to `requestReportItemAnswer`, defaulting to the one the page started with.
- `cypress/e2e/interactive-report-item.test.ts`: rewritten.
- `src/interactive/demo.tsx`: the import, the comment on `report`, and the frame's `srcDoc`.
- `src/interactive/demo.scss`: `.demo-report-item` height 60px to 130px.
- `cypress/e2e/interactive-demo.test.ts`: the report item test.
- `README.md`: the `report-item.html` bullet.

**Estimated diff size**: ~110 lines

```ts
// src/interactive/report-item-answer.ts
import type { IReportItemAnswerItem } from "@concord-consortium/lara-interactive-api";
import { reportSummaryHtml } from "./report-summary";

// The grid draws its own answered icon and reads only a score from a compact answer, so a compact answer has no items.
// hideViewInline leaves "Open in new tab" as the only link; the summary is what changes as the scrubber moves.
export const reportItemAnswerItems = (itemsType: "fullAnswer" | "compactAnswer", interactiveState: unknown,
  authoredState: unknown): IReportItemAnswerItem[] =>
  itemsType === "compactAnswer"
    ? []
    : [
      { type: "links", hideViewInline: true },
      { type: "html", html: reportSummaryHtml(interactiveState, authoredState) },
    ];
```

```ts
// src/interactive/report-item-answer.test.ts
import { reportItemAnswerItems } from "./report-item-answer";
import { reportSummaryHtml } from "./report-summary";

describe("reportItemAnswerItems", () => {
  const state = { version: 1, orderMatters: false };
  const authored = { startingText: "the cat" };

  it("answers a full answer with only the new tab link, and the summary of both states it is given", () => {
    expect(reportItemAnswerItems("fullAnswer", state, authored)).toEqual([
      { type: "links", hideViewInline: true }, { type: "html", html: reportSummaryHtml(state, authored) }
    ]);
  });

  it("answers a compact answer with no items", () => {
    expect(reportItemAnswerItems("compactAnswer", state, authored)).toEqual([]);
  });
});
```

```ts
// src/interactive/report-item.tsx, the handler
    handler: ({ platformUserId, version, itemsType, interactiveState, authoredState }) => {
      const items = reportItemAnswerItems(itemsType, interactiveState, authoredState);
      sendReportItemAnswer({ version, platformUserId, itemsType, items });
    }
```

```ts
// cypress/fake-ap/fake-ap.ts
const requestReportItemAnswer = (itemsType: ItemsType, platformUserId = "student1",
  interactiveState = options.interactiveState) => new Promise<any>(resolve => {
  awaitingAnswer = resolve;
  // the dashboard sends no requestId, and the library's listener answers only a request without one
  phone?.post("getReportItemAnswer", {
    version: "2.1.0", platformUserId, itemsType,
    interactiveState: interactiveState ?? null, authoredState: options.authoredState ?? null
  });
});

// cypress/support/fake-ap-commands.ts
Cypress.Commands.add("requestReportItemAnswer", (itemsType: ItemsType, platformUserId?: string,
  interactiveState?: unknown) =>
  cy.fakeAp().then(fake => fake.requestReportItemAnswer(itemsType, platformUserId, interactiveState)));

// cypress/support/fake-ap.d.ts
      /**
       * Asks the report item for a student's answer (student1's by default), as the class dashboard does, with the
       * state the page started with unless one is given, as a scrubber step gives another.
       */
      requestReportItemAnswer(itemsType: ItemsType, platformUserId?: string,
        interactiveState?: unknown): Chainable<any>;
```

```ts
// cypress/e2e/interactive-report-item.test.ts
const drawing = {
  nodes: [{ id: "n1", label: "<b>Hot</b>", value: 1 }, { id: "n2", label: "Cold", value: 1 }],
  edges: [{ from: "n1", to: "n2", value: 1 }],
};

describe("the interactive's report item", () => {
  beforeEach(() => {
    cy.startInteractive({
      mode: "reportItem", interactiveState: { version: 1, input: { text: "the cat sat" } },
      authoredState: { startingText: "authored" },
    });
    cy.interactiveMessages("reportItemClientReady").should("deep.equal", [{ compactAnswerReportItemsAvailable: true }]);
    cy.interactiveMessages("height").should("have.length.greaterThan", 0);
  });

  it("answers a full answer with the summary of the state in the request, and only the new tab link", () => {
    cy.requestReportItemAnswer("fullAnswer").then(answer => {
      expect(answer).to.include({ version: "2.1.0", platformUserId: "student1", itemsType: "fullAnswer" });
      expect(answer.items).to.have.length(2);
      expect(answer.items[0]).to.deep.equal({ type: "links", hideViewInline: true });
      expect(answer.items[1].html).to.contain("The student has saved work in the interactive.");
      expect(answer.items[1].html).to.contain("Data: 3 words, 3 states");
    });
  });

  it("answers each request from its own state, as a scrubber step does", () => {
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1, input: { text: "the cat" } })
      .then(answer => expect(answer.items[1].html).to.contain("Data: 2 words, 2 states"));
    const draw = { drawing, generator: { startingState: "n1" } };
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1, mode: "draw", draw }).then(answer => {
      expect(answer.items[1].html).to.contain("Drawing: 2 states, 1 arrow");
      expect(answer.items[1].html).to.contain("start &lt;b&gt;Hot&lt;/b&gt;");
    });
  });

  it("reads the authored state in the request", () => {
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1 })
      .then(answer => expect(answer.items[1].html).to.contain("Data: 1 word, 1 state"));
  });

  it("answers a compact answer with no items, for the student the request names", () => {
    cy.requestReportItemAnswer("compactAnswer", "student2")
      .should("deep.include", { platformUserId: "student2", itemsType: "compactAnswer", items: [] });
  });
});
```

The starting text is one word, so `the cat sat` reading 3 proves the saved input wins over it, and `{ version: 1 }` reading 1 proves the request's authored state reaches the summary.

```tsx
// src/interactive/demo.tsx
// replaces the import of placeholderReportHtml
import { reportSummaryHtml } from "./report-summary";
// ...
  // the state and authored state the teacher's view and the report item show; each save starts the view again, as a
  // scrubber step does
  const [report, setReport] = useState<{ saves: number, state: unknown, authoredState: unknown }>();
// ...
          <h2>Report item, full answer</h2>
          <iframe title="Report item" className="demo-report-item"
            srcDoc={reportItemDocument(reportSummaryHtml(report?.state, report?.authoredState ?? runtimeAuthoredState))}
          />
```

`report` is set on each `interactiveState` the runtime posts, with the authored state it was started under, so the frame follows saves the way the teacher's view above it does. Before the first save it summarizes `runtimeAuthoredState`, the page as a new student sees it.

```ts
// cypress/e2e/interactive-demo.test.ts
  it("shows the report item's full answer, of the authored page and then of a save", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "The student has saved work in the interactive.")
      .and("contain", "Data: 11 words, 7 states");
    cy.get<HTMLIFrameElement>("iframe[title='Report item']").should(([frame]) => {
      expect(frame.contentDocument?.documentElement.scrollHeight).to.equal(frame.clientHeight);
    });
    frameBody("Interactive").find("textarea[aria-label='Your text']").type(" the dog").blur({ force: true });
    frameText("Report item").should("contain", "Data: 13 words, 8 states");
  });

  it("summarizes the authored page as it changes, before any save", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "Data: 11 words, 7 states");
    frameBody("Authoring").find("#startingText").clear().type("a b");
    frameText("Report item").should("contain", "Data: 2 words, 2 states");
  });

  it("summarizes a save with the authored state it was made under", () => {
    let saved = false;
    cy.visit("/demo.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        saved ||= messageOf(event.data)?.type === "interactiveState";
      })
    });
    frameBody("Interactive").find(".workspace-body:not([hidden]) .probabilities-toggle").click();
    cy.wrap(null, { timeout: 5000 }).should(() => expect(saved).to.equal(true));
    frameBody("Authoring").find("#startingText").clear().type("a b");
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").should((doc: Document) => {
      expect(doc.querySelector<HTMLTextAreaElement>("textarea[aria-label='Your text']")?.value).to.equal("a b");
    });
    frameText("Report item").should("contain", "Data: 11 words, 7 states");
  });
```

README, the `report-item.html` bullet becomes:

> - `report-item.html`: its report item, which answers the class dashboard with a short summary of a student's saved work (what they built, their outputs and their settings) and an "Open in new tab" link to their read-only work. With "Save Answer History" on, the summary follows the dashboard's scrubber through each saved moment.

MARK-17's closed spec still describes R27's inline view; closed specs are a record of that story and aren't edited.


## Open Questions

### RESOLVED: Judgment call: several commits, or one?
**Options considered**:
- A) One commit, about 390 lines.
- B) Two: the pure function, then the wiring with the demo and README.

**Decision**: B. A newer reviewer reads the rules on their own before seeing how they reach the dashboard, and each commit is green on its own.

### RESOLVED: Where do the generator's `(any)` label and default Max Length come from?
**Options considered**:
- A) Move both to `app-utils.ts` and import them. The plugin's bundle came out byte-identical, but plugin source files change.
- B) Keep copies in `report-summary.ts`, each asserted against the real value by a test.

**Decision**: B (Doug). MARK-19 stays in the report item's files, and the tests stop the copies drifting.

### RESOLVED: Should `RestoredMode.tool` be narrowed in `restore-work.ts`?
**Options considered**:
- A) Narrow the type, so the summary needs no cast.
- B) Leave `restore-work.ts` alone and cast in the summary.

**Decision**: B. The report item doesn't need the change: it is one cast in one place, and it keeps the workspace's code out of this story.

## Self-Review

Reviewed as commit reviewer, test writer, senior engineer and operator. Each finding was checked against the code, and the plan above carries the fix.

- The demo goes with the report item's commit, because that commit changes what the demo's frame shows and `interactive-demo.test.ts` would otherwise fail in between.
- `fake-ap.d.ts`'s doc comment for `requestReportItemAnswer` didn't mention the new argument; the plan replaces it.
- Each commit's checks were confirmed against the throwaway build: the first adds only new files, and the second's two Cypress specs passed.
- R20 is a hand check on staging with the branch build, which comes from CI's S3 deploy once the branch is pushed. No step adds it; it goes in the PR's test notes.
- Outputs compared `group.startingState`, which missed outputs generated after the chosen state left the graph. The filter now compares `startingNode`, with a test (requirements, R5).
- No test failed when the authored state was dropped between the request and the summary: the Jest test passed `null`, and Cypress's saved input hid it. Both now depend on it.
- Nothing failed when a drawing's outputs were compared to Data mode's "Order matters". A test now saves it off in Draw mode.
- The Cypress drawing's `<b>Hot</b>` label never reached an answer, so it checked nothing. The test now sets it as the start and asserts the escaped text.
- The demo frame staying at 60px passed every test, so its test now checks that the frame doesn't scroll (failed at 60px, passed at 130px).
- The byte check needs a production build of the branch, which the checks didn't name.
- Three mutations passed every test, so each has a test now: comparing `startingNode.label` in the filter, since every fixture's id was its label; the demo's frame ignoring the save, since its test stopped before one; and an authored state sent as a string being ignored, since saved input hid it.

