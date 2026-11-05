import { defaultAuthoredState } from "../../src/interactive/authored-state";
import { encodeOutputs } from "../../src/interactive/saved-outputs";
import { Node } from "../../src/type";
import { animatedNodeColor, selectedNodeColor } from "../support/graph";
import { loggedEvents, parseTransform, stateEllipse } from "../support/workspace";

const width = 1044;
const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
const hiddenBody = () => cy.interactive().find(".workspace-body[hidden]");
const shownView = () => shown().find(".graph > svg g.root").invoke("attr", "transform")
  .then(transform => parseTransform(transform as unknown as string));
const toolButton = (title: string) => shown().find(`.toolbar button[title='${title}']`);
const reopen = (interactiveState: unknown, authoredState: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState, interactiveState });

const node = (label: string): Node => ({ id: label, label, value: 0 });
const outputs = (sequences: string[][]) => encodeOutputs([{
  delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined,
  sequences: sequences.map(sequence => sequence.map(node)),
}]);
const manyOutputs = outputs(Array.from({ length: 60 }, (_, i) => ["a", `output${i}`]));

const drawing = {
  nodes: [
    { id: "n1", label: "Sun", value: 1, x: -120, y: -40 }, { id: "n2", label: "Rain", value: 1, x: 130, y: 60 },
  ],
  edges: [{ from: "n1", to: "n2", value: 3 }, { from: "n2", to: "n1", value: 1 }],
};

const savedGenerator = { startingState: "the", lengthLimit: 7, delimiter: "-", delimiterType: "other", fast: true };

const paneToggle = (name: string) => shown().find(`.pane-toggle[aria-label$=' ${name}']`);
const expectCollapsed = (name: string) => paneToggle(name).should("have.attr", "aria-expanded", "false");
const inspectHeader = (label: string) => shown().find(".inspect-pane th").filter(`:contains('${label}')`);
const selectedTab = () => shown().find(".inspect-tab.selected");
const lastOutputInView = (body: () => Cypress.Chainable<JQuery<HTMLElement>>) =>
  body().find(".inner-output").should(output => {
    const box = output[0];
    expect(box.clientHeight).to.be.greaterThan(0);
    expect(box.scrollHeight).to.be.greaterThan(box.clientHeight);
    expect(box.scrollTop + box.clientHeight).to.be.closeTo(box.scrollHeight, 1);
  });

describe("reopening saved work", () => {
  describe("in Data mode", () => {
    const state = {
      version: 1,
      input: { text: "the cat sat" },
      mode: "useData",
      probabilities: true,
      orderMatters: true,
      caseSensitive: true,
      useData: {
        panes: { input: true, graph: true, inspect: true, generator: true },
        controlsOpen: true,
        sizes: { input: 320, inspect: 240, top: 280 },
        inputSplit: 0.7,
        inspect: {
          tab: "transitions",
          sorts: {
            states: { column: "state", ascending: true }, transitions: { column: "probability", ascending: false },
          },
        },
        generator: savedGenerator,
        outputs: outputs([["the", "cat"], ["cat", "sat"]]),
        selection: { kind: "state", id: "cat" },
        positions: [-100, -50, 20, 70, 150, -20],
      },
    };

    it("shows the input, panes, sizes, split, toggles and Inspect as they were left", () => {
      reopen(state);
      shown().find("textarea[aria-label='Your text']").should("have.value", "the cat sat");
      shown().find(".input-pane").should(pane => expect(pane.outerWidth()).to.be.closeTo(320, 1));
      shown().find(".inspect-pane").should(pane => expect(pane.outerWidth()).to.be.closeTo(240, 1));
      shown().find(".top-row").should(row => expect(row.outerHeight()).to.be.closeTo(280, 1));
      shown().find(".input-text-part").then(part => {
        const shared = part.parent().height()!;
        expect(part.outerHeight()! / shared).to.be.greaterThan(0.6);
      });
      shown().find(".probabilities-toggle").should("have.attr", "aria-pressed", "true");
      selectedTab().should("have.text", "Transitions");
      inspectHeader("Probability").should("have.attr", "aria-sort", "descending");
    });

    it("shows the generator's settings and outputs, and the chosen state", () => {
      reopen(state);
      shown().find(".generate select").first().should("have.value", "the");
      shown().find(".generate input[type='number']").should("have.value", "7");
      shown().find(".generate input[placeholder='delimiter']").should("have.value", "-");
      shown().find(".speedToggle input").should("be.checked");
      shown().find(".sequence").then(sequences => {
        expect([...sequences].map(s => s.textContent)).to.deep.equal(["the cat", "cat sat"]);
      });
      stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    });

    it("puts every state where it was", () => {
      reopen(state);
      [["the", -100, -50], ["cat", 20, 70], ["sat", 150, -20]].forEach(([label, x, y]) => {
        stateEllipse(label as string).should("have.attr", "cx", String(x)).and("have.attr", "cy", String(y));
      });
    });

    it("starts at a saved view, and a wheel zoom carries on from it", () => {
      const view = { x: 30, y: -20, k: 1.5 };
      reopen({ ...state, useData: { ...state.useData, view } });
      shown().find("g.node").should("have.length", 3);
      // past a fit's 250 ms, which would land over the saved view
      cy.wait(500);
      shownView().should("deep.equal", view);
      shown().find(".graph > svg").trigger("wheel", { deltaY: -100 });
      cy.wait(100);
      shownView().then(({ k }) => {
        expect(k).to.be.greaterThan(1.5);
        expect(k).to.be.lessThan(3);
      });
    });

    it("fits the graph with no saved view", () => {
      reopen(state);
      shown().find("g.node").should("have.length", 3);
      cy.wait(500);
      shownView().its("k").should("not.equal", 1);
    });

    it("lights a chosen output and its row", () => {
      reopen({ ...state, useData: { ...state.useData, selection: { kind: "output", group: 0, sequence: 1 } } });
      shown().find(".sequence.highlighted").should("have.text", "cat sat");
      stateEllipse("cat").should("have.attr", "fill", animatedNodeColor);
      stateEllipse("sat").should("have.attr", "fill", animatedNodeColor);
    });

    it("leaves focus where it was, though the delimiter's field shows", () => {
      reopen(state);
      shown().find(".generate input[placeholder='delimiter']").should("exist").then(field => {
        expect(field[0].ownerDocument.activeElement).to.equal(field[0].ownerDocument.body);
      });
    });

    it("saves nothing and logs nothing", () => {
      reopen(state);
      shown().find(".sequence").should("have.length", 2);
      // the library sends interactive state after a 2 second pause
      cy.wait(2500);
      cy.interactiveMessages("interactiveState").should("have.length", 0);
      loggedEvents().should("have.length", 0);
    });

    it("starts collapsed panes collapsed, and a collapsed generator's output at its newest once it opens", () => {
      reopen({
        ...state,
        useData: {
          ...state.useData,
          panes: { input: false, graph: true, inspect: false, generator: false },
          outputs: manyOutputs,
          selection: undefined,
        },
      });
      expectCollapsed("Input");
      expectCollapsed("Inspect");
      expectCollapsed("Sequence Generator");
      paneToggle("Sequence Generator").click();
      lastOutputInView(shown);
    });

    it("reads the input under the saved switches", () => {
      reopen({ version: 1, input: { text: "The the cat" }, orderMatters: false, caseSensitive: true });
      const setting = (name: string) => shown().find(`.setting-switch:contains('${name}') [role='switch']`);
      setting("Order matters").should("have.attr", "aria-checked", "false");
      setting("Case sensitive").should("have.attr", "aria-checked", "true");
      shown().find("g.node").should("have.length", 3);
    });

    it("hides the generator's controls as they were left", () => {
      reopen({ ...state, useData: { ...state.useData, controlsOpen: false } });
      shown().find(".generator-controls").should("have.class", "collapsed");
    });

    it("opens outputs too long for their box at their newest", () => {
      reopen({ ...state, useData: { ...state.useData, outputs: manyOutputs, selection: undefined } });
      lastOutputInView(shown);
    });
  });

  describe("in Draw mode", () => {
    const state = {
      version: 1,
      mode: "draw",
      draw: {
        panes: { inspect: false, generator: true },
        generator: { ...savedGenerator, startingState: "n2", delimiterType: "space", delimiter: " " },
        outputs: encodeOutputs([{
          delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined,
          sequences: [[{ id: "n1", label: "Sun", value: 0 }, { id: "n2", label: "Rain", value: 0 }]],
        }]),
        selection: { kind: "transition", from: "n1", to: "n2" },
        drawing,
      },
    };

    it("shows the mode, drawing, panes, generator and outputs", () => {
      reopen(state);
      shown().find(".mode-switch label").contains("Draw").find("input").should("be.checked");
      shown().find("g.node").should("have.length", 2);
      stateEllipse("Sun").should("have.attr", "cx", "-120").and("have.attr", "cy", "-40");
      stateEllipse("Rain").should("have.attr", "cx", "130").and("have.attr", "cy", "60");
      expectCollapsed("Inspect");
      shown().find(".generate select").first().should("have.value", "n2");
      shown().find(".sequence").should("have.text", "Sun Rain");
    });

    it("lights the chosen transition", () => {
      reopen(state);
      paneToggle("Inspect").click();
      shown().find(".inspect-tab").contains("Transitions").click();
      shown().find(".inspect-pane tbody tr[class*='highlight-']").should("have.length", 1)
        .and("contain.text", "Sun → Rain");
    });

    it("shows the sizes and Inspect as they were left", () => {
      reopen({
        ...state,
        draw: {
          ...state.draw,
          panes: { inspect: true, generator: true },
          sizes: { inspect: 300, top: 260 },
          inspect: { tab: "transitions", sorts: { transitions: { column: "probability", ascending: false } } },
        },
      });
      shown().find(".inspect-pane").should(pane => expect(pane.outerWidth()).to.be.closeTo(300, 1));
      shown().find(".top-row").should(row => expect(row.outerHeight()).to.be.closeTo(260, 1));
      selectedTab().should("have.text", "Transitions");
      inspectHeader("Probability").should("have.attr", "aria-sort", "descending");
    });

    it("fits the drawing with no saved view", () => {
      reopen(state);
      shown().find("g.node").should("have.length", 2);
      cy.wait(500);
      shownView().its("k").should("not.equal", 1);
    });

    it("saves nothing and logs nothing", () => {
      reopen(state);
      shown().find("g.node").should("have.length", 2);
      cy.wait(2500);
      cy.interactiveMessages("interactiveState").should("have.length", 0);
      loggedEvents().should("have.length", 0);
    });

    it("starts at a saved view", () => {
      const view = { x: 10, y: 15, k: 0.8 };
      reopen({ ...state, draw: { ...state.draw, view } });
      shown().find("g.node").should("have.length", 2);
      cy.wait(500);
      shownView().should("deep.equal", view);
    });

    it("starts on the Select tool", () => {
      reopen(state);
      toolButton("Select").should("have.attr", "aria-pressed", "true");
    });

    it("clears the drawing on Reset, rather than going back to it", () => {
      reopen(state);
      shown().find("g.node").should("have.length", 2);
      toolButton("Reset").click();
      shown().find(".confirmModal button").contains("Ok").click();
      shown().find("g.node").should("not.exist");
    });
  });

  it("restores the mode not showing too, whose outputs open at their newest when it shows", () => {
    reopen({
      version: 1,
      input: { text: "a b" },
      mode: "draw",
      useData: { outputs: manyOutputs },
      draw: { drawing },
    });
    hiddenBody().find(".sequence").should("have.length", 60);
    shown().find(".mode-switch label").contains("Data").click();
    lastOutputInView(shown);
  });

  it("opens a state saved on a page with other settings under this page's", () => {
    const panes = {
      ...defaultAuthoredState.panes,
      inspect: { available: false, startsOpen: true },
      generator: { available: true, startsOpen: false },
    };
    reopen({
      version: 1,
      input: { text: "a b" },
      mode: "draw",
      orderMatters: false,
      caseSensitive: true,
      useData: {
        panes: { input: false, inspect: false },
        selection: { kind: "state", id: "gone" },
        generator: { startingState: "gone", lengthLimit: 9 },
        sizes: { input: 1 },
      },
      draw: { drawing },
    }, {
      modes: { useData: true, draw: false }, panes, showCaseSwitch: false, startingText: "c",
      orderMatters: { startsOn: true, showSwitch: false },
    });
    shown().find(".mode-switch").should("not.exist");
    shown().find(".inspect-pane").should("not.exist");
    expectCollapsed("Input");
    expectCollapsed("Sequence Generator");
    shown().find(".controls-row").should("contain.text", "Order matters").and("contain.text", "Yes");
    stateEllipse("a").should("exist");
    shown().find(".generate input[type='number']").should("have.value", "9");
    shown().find(".generate select").first().should("have.value", "");
    shown().find(".input-pane .pane-toggle").click();
    shown().find(".input-pane").should(pane => expect(pane.outerWidth()).to.be.closeTo(160, 1));
  });
});
