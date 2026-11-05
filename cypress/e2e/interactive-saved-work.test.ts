import { defaultAuthoredState } from "../../src/interactive/authored-state";
import { encodeOutputs, maxOutputBytes, savedBytes } from "../../src/interactive/saved-outputs";
import { Node } from "../../src/type";
import { animatedNodeColor, pastDoubleClick, selectedNodeColor } from "../support/graph";
import { divider, loggedEvents, parseTransform, stateEllipse } from "../support/workspace";

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

describe("saving work", () => {
  const fast = "?fastSpeed=20&normalSpeed=20";
  const startingText = "the cat sat the dog";
  const start = (authored: Record<string, unknown> = {}, interactiveState?: unknown) => cy.startInteractive({
    mode: "runtime", width, search: fast, interactiveState, authoredState: { startingText, ...authored },
  });
  const startDrawing = (interactiveState: unknown = undefined) => start({ startingMode: "draw" }, interactiveState);
  const textBox = () => shown().find("textarea[aria-label='Your text']");
  const posts = () => cy.interactiveMessages("interactiveState") as Cypress.Chainable<any[]>;
  // the library sends interactive state 2 seconds after the last save
  const pastDebounce = () => cy.wait(2500);
  const firstPost = () => cy.interactiveMessages("interactiveState", { timeout: 6000 }).should("not.be.empty")
    .its(0) as Cypress.Chainable<any>;
  const lastPost = () => cy.interactiveMessages("interactiveState", { timeout: 6000 }).should("not.be.empty")
    .invoke("at", -1) as Cypress.Chainable<any>;
  const leavePage = () => cy.requestInteractiveState({ unloading: true });
  const graphReady = () => shown().find("g.node").should("have.length.at.least", 1);
  const typeWord = (word: string) => textBox().type(` ${word}`).blur({ force: true });
  const play = () => shown().find(".generator-pane button").contains("Play");
  const playToTheEnd = () => {
    play().click();
    shown().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
  };

  // a drag of a state with a mouse's events, dispatched in the interactive's frame
  const dragState = (label: string, dx: number, dy: number) => stateEllipse(label).then(ellipse => {
    const element = ellipse[0];
    const win = element.ownerDocument.defaultView as Window & typeof globalThis;
    const box = element.getBoundingClientRect();
    const at = (x: number, y: number) => ({
      clientX: box.x + box.width / 2 + x, clientY: box.y + box.height / 2 + y, bubbles: true, cancelable: true,
      view: win, button: 0,
    });
    element.dispatchEvent(new win.MouseEvent("mousedown", at(0, 0)));
    win.dispatchEvent(new win.MouseEvent("mousemove", at(dx / 2, dy / 2)));
    win.dispatchEvent(new win.MouseEvent("mousemove", at(dx, dy)));
    win.dispatchEvent(new win.MouseEvent("mouseup", at(dx, dy)));
  });

  it("posts nothing on open", () => {
    start();
    graphReady();
    pastDebounce();
    posts().should("have.length", 0);
  });

  it("answers a page leave with nothing done by posting nothing", () => {
    start();
    graphReady();
    leavePage();
    posts().should(states => expect(states).to.deep.equal([undefined]));
  });

  it("saves a collapsed pane at a page leave, and not before", () => {
    start();
    graphReady();
    paneToggle("Inspect").click();
    pastDebounce();
    posts().should("have.length", 0);
    leavePage();
    firstPost().its("useData.panes.inspect").should("equal", false);
  });

  it("saves a wheel zoom at a page leave, and not before", () => {
    start();
    graphReady();
    cy.wait(500);
    shown().find(".graph > svg").trigger("wheel", { deltaY: -100 });
    pastDebounce();
    posts().should("have.length", 0);
    leavePage();
    firstPost().its("useData.view.k").should("be.a", "number");
  });

  it("saves a drawing's wheel zoom at a page leave", () => {
    startDrawing({ version: 1, mode: "draw", draw: { drawing } });
    graphReady();
    cy.wait(500);
    shown().find(".graph > svg").trigger("wheel", { deltaY: -100 });
    leavePage();
    firstPost().its("draw.view.k").should("be.a", "number");
  });

  it("saves Inspect's tab and sort and the input's split at a page leave", () => {
    start();
    graphReady();
    shown().find(".inspect-tab").contains("Transitions").click();
    inspectHeader("Probability").find("button").click();
    divider("Resize the text box and the table").focus().type("{downArrow}");
    leavePage();
    firstPost().then(state => {
      expect(state.useData.inspect.tab).to.equal("transitions");
      expect(state.useData.inspect.sorts.transitions).to.deep.equal({ column: "probability", ascending: true });
      expect(state.useData.inputSplit).to.be.greaterThan(0.4);
    });
  });

  it("carries a pane collapsed before a word was typed", () => {
    start();
    graphReady();
    paneToggle("Inspect").click();
    typeWord("ran");
    firstPost().then(state => {
      expect(state.useData.panes.inspect).to.equal(false);
      expect(state.input.text).to.equal(`${startingText} ran`);
    });
  });

  it("saves a pane collapsed by a student with work at a page leave", () => {
    start({}, { version: 1, input: { text: "my words" } });
    graphReady();
    paneToggle("Inspect").click();
    leavePage();
    firstPost().then(state => {
      expect(state.useData.panes.inspect).to.equal(false);
      expect(state.input.text).to.equal("my words");
    });
  });

  it("holds a typed word's position, as drawn", () => {
    start();
    graphReady();
    typeWord("ran");
    shown().find("g.node").should("have.length", 5);
    firstPost().then(state => {
      expect(state.useData.positions).to.have.length(10);
      stateEllipse("ran").then(ellipse => {
        expect(state.useData.positions[8]).to.equal(Math.round(Number(ellipse.attr("cx"))));
        expect(state.useData.positions[9]).to.equal(Math.round(Number(ellipse.attr("cy"))));
      });
    });
  });

  it("gives back at a page leave what a student who did nothing opened with, under a changed page", () => {
    const saved = {
      version: 1, input: { text: "my words" }, mode: "useData", probabilities: true,
      useData: { panes: { inspect: false }, later: 1 },
    };
    start({ startingText: "a changed text", panes: { inspect: { available: false } } }, saved);
    graphReady();
    leavePage();
    posts().should(states => expect(states).to.deep.equal([saved]));
  });

  it("keeps the saved input with no Input pane", () => {
    start({ panes: { ...defaultAuthoredState.panes, input: { available: false, startsOpen: true } } },
      { version: 1, input: { text: "my words" } });
    graphReady();
    shown().find(".probabilities-toggle").click();
    firstPost().its("input.text").should("equal", "my words");
  });

  it("reopens a saved Data mode to the same state", () => {
    start();
    graphReady();
    typeWord("ran");
    playToTheEnd();
    paneToggle("Inspect").click();
    shown().find(".probabilities-toggle").click();
    dragState("cat", 30, 20);
    pastDebounce();
    lastPost().then(saved => {
      start({}, saved);
      graphReady();
      paneToggle("Input").click();
      paneToggle("Input").click();
      leavePage();
      lastPost().should("deep.equal", saved);
    });
  });

  it("reopens a saved drawing to the same state", () => {
    startDrawing({ version: 1, mode: "draw", draw: { drawing } });
    graphReady();
    playToTheEnd();
    pastDebounce();
    lastPost().then(saved => {
      startDrawing(saved);
      graphReady();
      paneToggle("Inspect").click();
      paneToggle("Inspect").click();
      leavePage();
      lastPost().should("deep.equal", saved);
    });
  });

  it("posts nothing while a sequence steps, and once when it is canceled", () => {
    start();
    graphReady();
    shown().find(".probabilities-toggle").click();
    firstPost();
    shown().find(".generator-pane button").contains("Step").click();
    shown().find(".probabilities-toggle").click();
    pastDebounce();
    posts().should("have.length", 1);
    shown().find(".generator-pane button").contains("Cancel").click();
    posts().should("have.length", 1);
    cy.interactiveMessages("interactiveState", { timeout: 6000 }).should("have.length", 2);
  });

  it("saves a sequence as far as it got at a page leave", () => {
    start();
    graphReady();
    shown().find(".generator-pane button").contains("Step").click();
    shown().find(".generator-pane button").contains("Step").click();
    shown().find(".sequence").should("have.length", 1).invoke("text").then(soFar => {
      leavePage();
      firstPost().its("useData.outputs.groups.0.sequences.0").should(sequence => {
        expect(sequence).to.have.length(soFar.split(" ").length);
      });
    });
  });

  it("keeps the other states where they were when a word is typed after reopening", () => {
    start({}, {
      version: 1, input: { text: "a b c" }, caseSensitive: false, useData: { positions: [-90, 0, 0, 60, 90, 0] },
    });
    graphReady();
    typeWord("d");
    shown().find("g.node").should("have.length", 4);
    stateEllipse("a").should("have.attr", "cx", "-90");
    stateEllipse("b").should("have.attr", "cy", "60");
    stateEllipse("c").should("have.attr", "cx", "90");
    firstPost().its("useData.positions").should(positions => {
      expect(positions.slice(0, 6)).to.deep.equal([-90, 0, 0, 60, 90, 0]);
      expect(positions).to.have.length(8);
    });
  });

  describe("posts once for", () => {
    const withOutput = { version: 1, useData: { outputs: outputs([["the", "cat"]]) } };
    const setting = (name: string) => shown().find(`.setting-switch:contains('${name}') [role='switch']`);
    const drawn = { version: 1, mode: "draw", draw: { drawing } };

    const oneArrow = {
      version: 1, mode: "draw", draw: { drawing: { nodes: drawing.nodes, edges: [drawing.edges[0]] } },
    };
    const onStep = () => shown().find(".generator-pane button").contains("Step").click();

    const moments: [string, () => void, () => void, (state: any) => void][] = [
      ["the input's text at a commit", () => start(), () => typeWord("ran"),
        state => expect(state.input.text).to.equal(`${startingText} ran`)],
      ["a sequence finishing", () => start(), playToTheEnd, state => {
        expect(state.useData.outputs.groups[0].sequences).to.have.length(1);
        expect(state.useData.outputs.groups[0].sequences[0].length).to.be.greaterThan(1);
      }],
      ["a sequence canceled", () => start(), () => {
        onStep();
        shown().find(".generator-pane button").contains("Cancel").click();
      }, state => expect(state.useData.outputs.groups[0].sequences).to.have.length(1)],
      ["the output cleared", () => start({}, withOutput),
        () => shown().find(".generator-pane button").contains("Clear Output").click(),
        state => expect(state.useData).not.to.have.property("outputs")],
      ["Max Length", () => start(), () => shown().find(".generate input[type='number']").clear().type("9{enter}"),
        state => expect(state.useData.generator.lengthLimit).to.equal(9)],
      ["the delimiter's type", () => start(), () => shown().find(".generate select").eq(1).select("none"),
        state => expect(state.useData.generator).to.include({ delimiterType: "none", delimiter: "" })],
      ["the starting state", () => start(), () => shown().find(".generate select").first().select("cat"),
        state => expect(state.useData.generator.startingState).to.equal("cat")],
      ["the speed", () => start(), () => shown().find(".speedToggle input").click(),
        state => expect(state.useData.generator.fast).to.equal(true)],
      ["Order matters", () => start(), () => setting("Order matters").click(),
        state => expect(state.orderMatters).to.equal(false)],
      ["Case sensitive", () => start(), () => setting("Case sensitive").click(),
        state => expect(state.caseSensitive).to.equal(true)],
      ["Show probabilities", () => start(), () => shown().find(".probabilities-toggle").click(),
        state => expect(state.probabilities).to.equal(true)],
      ["a Data-mode state dragged", () => start(), () => dragState("cat", 30, 20), state => {
        stateEllipse("cat").then(ellipse => {
          expect(state.useData.positions[2]).to.be.closeTo(Number(ellipse.attr("cx")), 1);
        });
      }],
      ["a state added to a drawing", () => startDrawing(drawn), () => {
        toolButton("Add State").click();
        shown().find(".graph > svg").trigger("click", 60, 60);
      }, state => expect(state.draw.drawing.nodes).to.have.length(3)],
      ["an arrow added to a drawing", () => startDrawing(oneArrow), () => {
        toolButton("Add Transition").click();
        pastDoubleClick();
        stateEllipse("Rain").trigger("click");
        pastDoubleClick();
        stateEllipse("Sun").trigger("click");
      }, state => expect(state.draw.drawing.edges).to.have.length(2)],
      ["a drawn state moved", () => startDrawing(drawn), () => dragState("Sun", 30, 20),
        state => expect(state.draw.drawing.nodes[0].x).not.to.equal(drawing.nodes[0].x)],
      ["a drawn state edited", () => startDrawing(drawn), () => {
        pastDoubleClick();
        stateEllipse("Sun").trigger("click").trigger("click");
        shown().find(".nodeModal input[aria-label='State name']").should("have.value", "Sun").clear().type("Sky");
        shown().find(".nodeModal button").contains("Save").click();
      }, state => expect(state.draw.drawing.nodes[0].label).to.equal("Sky")],
      ["a drawn state deleted", () => startDrawing(drawn), () => {
        toolButton("Delete").click();
        cy.wait(300);
        stateEllipse("Sun").trigger("click");
      }, state => expect(state.draw.drawing.nodes).to.have.length(1)],
      ["an arrow deleted", () => startDrawing(oneArrow), () => {
        toolButton("Delete").click();
        shown().find("line.edge-background").trigger("click", { force: true });
      }, state => expect(state.draw.drawing.edges).to.have.length(0)],
      ["Reset", () => startDrawing(drawn), () => {
        toolButton("Reset").click();
        shown().find(".confirmModal button").contains("Ok").click();
      }, state => expect(state.draw.drawing.nodes).to.have.length(0)],
    ];

    moments.forEach(([name, open, act, check]) => {
      it(name, () => {
        open();
        graphReady();
        cy.wait(300);
        act();
        firstPost();
        pastDebounce();
        posts().should("have.length", 1);
        firstPost().then(check);
      });
    });
  });
});

describe("the output limit", () => {
  const fast = "?fastSpeed=20&normalSpeed=20";
  const message = "You have reached the maximum number of outputs.";
  const authoredState = { startingText: "a b a b a b" };
  const start = (interactiveState: unknown) =>
    cy.startInteractive({ mode: "runtime", width, search: fast, authoredState, interactiveState });

  const oneState = { nodes: [{ id: "x", label: "x", value: 1, x: 0, y: 0 }], edges: [] };

  // Draw mode's outputs, as long sequences of one state, within room bytes of the limit
  const outputsWithin = (room: number) => {
    const sequence = Array.from({ length: 100 }, () => node("x"));
    const sequences = [sequence];
    const bytes = () => savedBytes([[encodeOutputs([]), encodeOutputs([{
      delimiter: " ", lengthLimit: 100, startingState: "", startingNode: undefined, sequences,
    }])], oneState]);
    while (bytes() < maxOutputBytes - 1000) {
      sequences.push(sequence);
    }
    sequences.pop();
    const last: Node[] = [];
    sequences.push(last);
    while (bytes() + 2 < maxOutputBytes - room) {
      last.push(node("x"));
    }
    return encodeOutputs([{
      delimiter: " ", lengthLimit: 100, startingState: "", startingNode: undefined, sequences,
    }]);
  };
  const nearLimit = {
    version: 1, draw: { outputs: outputsWithin(60), drawing: oneState },
  };
  const overLimit = {
    version: 1, draw: { outputs: outputsWithin(-20), drawing: oneState },
  };

  const button = (body: () => Cypress.Chainable<JQuery<HTMLElement>>, name: string) =>
    body().find(".generator-pane button").filter(`:contains('${name}')`);
  const expectStopped = (body: () => Cypress.Chainable<JQuery<HTMLElement>>) => {
    button(body, "Play").should("be.disabled");
    button(body, "Step").should("be.disabled");
  };
  const limitEvents = () => loggedEvents().invoke("filter", ([action]: [string]) => action === "OutputLimitReached");
  const generateOne = () => {
    button(shown, "Play").click();
    shown().contains(".generator-pane button", "Play", { timeout: 15000 });
  };
  const draw = () => shown().find(".mode-switch label").contains("Draw").click();

  it("stops Play and Step in both modes once an output reaches it, and says so", () => {
    start(nearLimit);
    shown().find(".output-limit").should("be.empty").and("have.attr", "role", "status");
    generateOne();
    shown().find(".output-limit").should("have.text", message);
    expectStopped(shown);
    expectStopped(hiddenBody);
    limitEvents().should("have.length", 1).its(0).its(1).its("outputs")
      .should("equal", nearLimit.draw.outputs.groups[0].sequences.length + 1);
  });

  it("clearing the outputs in the other mode brings it back under, and enables them in both", () => {
    start(nearLimit);
    generateOne();
    shown().find(".output-limit").should("have.text", message);
    draw();
    button(shown, "Clear Output").click();
    shown().find(".output-limit").should("be.empty");
    button(shown, "Play").should("be.enabled");
    button(hiddenBody, "Step").should("be.enabled");
  });

  it("lets a sequence stepped past it finish, and only then stops", () => {
    start(nearLimit);
    shown().find(".generator-pane input[type='number']").clear().type("3{enter}");
    // a sequence of three states takes five steps
    Cypress._.times(5, () => button(shown, "Step").should("be.enabled").click());
    expectStopped(shown);
    shown().find(".output-limit").should("have.text", message);
  });

  it("logs each time a drawing grows past it", () => {
    const addState = () => {
      toolButton("Add State").click();
      shown().find(".graph > svg").trigger("click", 60, 60);
      shown().find("g.node").should("have.length", 2);
      toolButton("Select").click();
    };
    start({ ...nearLimit, mode: "draw" });
    shown().find("g.node").should("have.length", 1);
    addState();
    shown().find(".output-limit").should("have.text", message);
    expectStopped(shown);
    limitEvents().should("have.length", 1);

    toolButton("Delete").click();
    cy.wait(300);
    shown().find("g.node").last().find("ellipse").trigger("click", { force: true });
    shown().find("g.node").should("have.length", 1);
    shown().find(".output-limit").should("be.empty");
    addState();
    limitEvents().should("have.length", 2);
  });

  it("counts the outputs of a mode the page doesn't offer", () => {
    cy.startInteractive({
      mode: "runtime", width, interactiveState: overLimit,
      authoredState: { ...authoredState, modes: { useData: true, draw: false } },
    });
    shown().find(".output-limit").should("have.text", message);
    expectStopped(shown);
  });

  it("reopens a state over it whole, with the message, logging nothing", () => {
    start(overLimit);
    hiddenBody().find(".sequence").should("have.length", overLimit.draw.outputs.groups[0].sequences.length);
    shown().find(".output-limit").should("have.text", message);
    expectStopped(shown);
    cy.wait(300);
    loggedEvents().should("have.length", 0);
  });
});
