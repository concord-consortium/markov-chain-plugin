import { toolbarHeight } from "../../src/interactive/workspace/pane-sizes";
import {
  clickState, graphRoot, loggedEvents, parseTransform, pinch, rootTransform, stateEllipse, stateLabels
} from "../support/workspace";

// the Standard layout's full-width item, wide enough that the panes sit side by side
const width = 1044;
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState, ...options });
const textBox = () => cy.interactive().find("textarea[aria-label='Your text']");
// the workspace's fits animate over 250 ms
const afterFit = () => cy.wait(400);

describe("the interactive's workspace", () => {
  it("lays out Data mode's toolbar at the height the workspace computes for it", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".graph-pane .toolbar button").should("have.length", 5);
    cy.interactive().find(".graph-pane .toolbar").invoke("outerHeight").should("equal", toolbarHeight(5));
    cy.interactive().find(".graph-pane .zoomButtons").should("not.exist");
  });

  it("keeps the graph drawn while the student types and chooses", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("g.node").should("have.length", 3);
    graphRoot().then(root => {
      root[0].setAttribute("data-drawn", "first");
      textBox().type(" do");
      clickState("cat");
      stateEllipse("cat").should("have.attr", "fill", "#14f49e3f");
      graphRoot().should("have.attr", "data-drawn", "first");
    });
  });

  it("opens a state's read-only probabilities on a double-click, and logs it", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("g.node").should("have.length", 3);
    cy.wait(260);
    stateEllipse("the").trigger("click").trigger("click");
    cy.interactive().find(".nodeModal").should("contain.text", "the");
    loggedEvents().should("deep.include", ["StateDialogOpened", { state: "the" }]);
    cy.interactive().type("{esc}");
    cy.interactive().find(".nodeModal").should("not.exist");
    // Escape closes the dialog and keeps the state chosen
    cy.interactive().find(".clear-highlight").should("exist");
  });

  it("asks for words while the graph is empty", () => {
    start();
    cy.interactive().find(".graph-empty").should("have.text", "Type some words in the Input pane to build the chain.");
    textBox().type("the cat").blur({ force: true });
    cy.interactive().find(".graph-empty").should("not.exist");
  });

  it("asks for words in the table in the table-only view", () => {
    start({ inputView: "table" });
    cy.interactive().find(".graph-empty")
      .should("have.text", "Type some words in the Input pane's table to build the chain.");
  });

  it("builds the graph from the starting text alone with no Input pane", () => {
    start({ modes: { useData: true, draw: false }, panes: { input: { available: false } }, startingText: "a b a" },
      { interactiveState: { version: 1, input: { text: "x y" } } });
    stateLabels().should("deep.equal", ["a", "b"]);
  });

  it("says no data was provided with no Input pane and no starting text", () => {
    start({ modes: { useData: true, draw: false }, panes: { input: { available: false } } });
    cy.interactive().find(".graph-empty").should("have.text", "No data was provided for this activity.");
  });

  it("saves the input when it commits, and shows it when it opens again", () => {
    start({ startingText: "the cat" });
    textBox().type(" sat").blur({ force: true });
    cy.interactiveMessages("interactiveState", { timeout: 5000 })
      .should("deep.include", { version: 1, input: { text: "the cat sat" } });
    start({ startingText: "the cat" }, { interactiveState: { version: 1, input: { text: "the cat sat" } } });
    textBox().should("have.value", "the cat sat");
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  it("clears the selection with Escape and with the Clear highlight button", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".clear-highlight").should("not.exist");
    clickState("cat");
    cy.interactive().find(".clear-highlight").should("be.visible");
    cy.interactive().type("{esc}");
    cy.interactive().find(".clear-highlight").should("not.exist");
    stateEllipse("cat").should("have.attr", "fill", "#fff");
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "escape" }]);

    clickState("cat");
    cy.interactive().find(".clear-highlight").click();
    stateEllipse("cat").should("have.attr", "fill", "#fff");
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "button" }]);
  });

  it("keeps a collapsed pane's contents and fits the graph when its pane reopens", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("g.node").should("have.length", 3);
    cy.interactive().find("button[aria-label='Collapse Input']").should("have.attr", "aria-expanded", "true").click();
    cy.interactive().find("section.input-pane .pane-body").should("have.css", "display", "none");
    cy.interactive().find("button[aria-label='Expand Input']").should("have.attr", "aria-expanded", "false").click();
    textBox().should("be.visible").and("have.value", "the cat sat");

    [1, 2, 3].forEach(() => cy.interactive().find("button[title='Zoom In']").click());
    rootTransform().then(zoomed => {
      cy.interactive().find("button[aria-label='Collapse Graph']").click();
      cy.interactive().find(".graph-pane .graph > svg")
        .should(svg => expect(svg[0].getBoundingClientRect().width).to.equal(0));
      cy.interactive().find("button[aria-label='Expand Graph']").click();
      afterFit();
      rootTransform().should("not.equal", zoomed);
    });
    loggedEvents().should("deep.include", ["PaneClosed", { pane: "graph" }])
      .and("deep.include", ["PaneOpened", { pane: "graph" }]);
  });
});

describe("the workspace's view of the graph", () => {
  const typeWords = (words: string) => {
    textBox().type(words).blur({ force: true });
    afterFit();
  };

  beforeEach(() => {
    start({ startingText: "the cat sat on the mat" });
    cy.interactive().find("g.node").should("have.length", 5);
    afterFit();
  });

  it("follows the graph as it grows", () => {
    rootTransform().then(before => {
      typeWords(" and a dog ran far away");
      rootTransform().should("not.equal", before);
    });
  });

  // fewer new states than old, so the graph adds them rather than being laid out again, which would follow it again
  it("stops following once the student zooms, and follows again after Fit", () => {
    cy.interactive().find("button[title='Zoom In']").click();
    rootTransform().then(zoomed => {
      typeWords(" and a dog");
      rootTransform().should("equal", zoomed);
    });
    cy.interactive().find("button[title='Fit View']").click();
    afterFit();
    rootTransform().then(fitted => {
      typeWords(" ran far");
      rootTransform().should("not.equal", fitted);
    });
  });

  it("follows again when most of the states are new", () => {
    cy.interactive().find("button[title='Zoom In']").click();
    rootTransform().then(zoomed => {
      typeWords(" and a dog ran far away");
      rootTransform().should("not.equal", zoomed);
    });
  });

  it("stops following after a wheel zoom", () => {
    cy.interactive().find(".graph-pane .graph > svg").trigger("wheel", { deltaY: -200 });
    afterFit();
    rootTransform().then(zoomed => {
      typeWords(" and a dog");
      rootTransform().should("equal", zoomed);
    });
  });

  // DevTools' touch input leaves Cypress unable to end the run, so the touches are made in the frame
  it("stops following after a pinch", () => {
    cy.get<HTMLIFrameElement>("iframe#interactive").then(frame => {
      Object.defineProperty(frame[0].contentWindow!.navigator, "maxTouchPoints", { get: () => 5 });
    });
    // the zoom takes touches once it is set up again, which a render does
    textBox().type(" ").blur({ force: true });
    afterFit();
    rootTransform().then(before => {
      cy.interactive().find(".graph-pane .graph > svg").then(svg => pinch(svg[0], [20, 40, 60, 80]));
      rootTransform().should(after => expect(parseTransform(after).k).to.be.greaterThan(parseTransform(before).k));
    });
    rootTransform().then(pinched => {
      typeWords(" and a dog");
      rootTransform().should("equal", pinched);
    });
  });
});
