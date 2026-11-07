import { defaultAuthoredState, MarkovAuthoredState } from "../../src/interactive/authored-state";
import { clickState, stateLabels } from "../support/workspace";

// the workspace's panes, by their titles
const panes = () => cy.interactive().find(".markov-workspace section.pane:visible > .pane-header h2")
  .then(titles => [...titles].map(title => title.textContent));

describe("the interactive's runtime", () => {
  it("shows the panes and input view the authored state gives", () => {
    const authoredState: MarkovAuthoredState = {
      ...defaultAuthoredState,
      modes: { useData: true, draw: false },
      panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } },
      buttons: {
        probabilities: { available: true, startsOn: true }, sendToCodap: { available: true },
        downloadTables: { available: false }
      },
      inputView: "text",
      capitalization: "asTyped",
      orderMatters: { startsOn: false, showSwitch: false },
      startingText: "the cat sat",
    };
    cy.startInteractive({ mode: "runtime", authoredState, width: 1044 });
    panes().should("deep.equal", ["Input", "Graph", "Sequence Generator"]);
    cy.interactive().find("textarea[aria-label='Your text']").should("have.value", "the cat sat");
    cy.interactive().find(".input-table").should("not.exist");
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  it("ignores settings in its link, taking only the authored state", () => {
    cy.startInteractive({
      mode: "runtime", width: 1044,
      authoredState: { modes: { useData: true, draw: false }, panes: { inspect: { available: false } } },
      search: "?modes.draw=true&panes.inspect.available=true&panes.input.available=false",
    });
    panes().should("deep.equal", ["Input", "Graph", "Sequence Generator"]);
  });

  it("shows the default workspace for an interactive never authored", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, width: 1044 });
    panes().should("deep.equal", ["Input", "Graph", "Inspect", "Sequence Generator"]);
    cy.interactive().find(".input-pane .linked-input textarea[aria-label='Your text']").should("exist");
    cy.interactive().find(".input-pane .linked-input .input-table").should("exist");
  });

  [["no interactive state", undefined], ["{}", {}]].forEach(([name, interactiveState]) => {
    it(`saves nothing when it opens with ${name}`, () => {
      cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState });
      cy.interactive().find("section.input-pane");
      // past the library's 2 second pause
      cy.wait(2500);
      cy.interactiveMessages("interactiveState").should("have.length", 0);
    });
  });

  it("leaves an existing interactive state alone", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState: { version: 1 } });
    cy.interactive().find("section.input-pane");
    cy.wait(2500);
    cy.interactiveMessages("interactiveState").should("have.length", 0);
  });

  it("says so when started in a mode it doesn't support", () => {
    cy.startInteractive({ mode: "unknown", authoredState: {} });
    cy.interactive().find(".unsupported-mode")
      .should("have.text", "The Markov interactive doesn't support unknown mode yet.");
  });

  it("sizes its frame to the workspace, and stops asking for a new height", () => {
    cy.startInteractive({ mode: "runtime", authoredState: { startingText: "the cat sat" }, width: 1044 });
    cy.interactive().find(".markov-workspace");
    cy.frameFitsInteractive();
    // taller than a frame's default 150px, so a frame that never resized would fail
    cy.get("iframe#interactive").invoke("height").should("be.greaterThan", 150);
    // past the fonts' and the graph's first layouts
    cy.wait(1000);
    cy.interactiveMessages("height").its("length").then(before => {
      cy.wait(3000);
      cy.interactiveMessages("height").should("have.length", before);
    });
  });

  it("keeps its height while a state is chosen and cleared", () => {
    cy.startInteractive({ mode: "runtime", authoredState: { startingText: "the cat sat" }, width: 1044 });
    cy.interactive().find("g.node").should("have.length", 3);
    cy.frameFitsInteractive();
    cy.get("iframe#interactive").invoke("height").then(height => {
      cy.interactiveMessages("height").its("length").then(before => {
        clickState("cat");
        cy.interactive().find(".clear-highlight").should("be.visible").click();
        cy.interactive().find(".clear-highlight").should("not.exist");
        // the workspace reports a new height a frame after it resizes
        cy.wait(100);
        cy.frameFitsInteractive();
        cy.get("iframe#interactive").invoke("height").should("equal", height);
        cy.interactiveMessages("height").invoke("slice", before)
          .should(heights => heights.forEach(h => expect(h).to.equal(height)));
      });
    });
  });

  it("shows the workspace in Lato", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, width: 1044 });
    cy.interactive().find(".markov-workspace");
    cy.get<HTMLIFrameElement>("iframe#interactive").then(frame => frame[0].contentDocument!.fonts.ready);
    // a font can start loading after ready resolves, so this retries
    cy.get<HTMLIFrameElement>("iframe#interactive").should(frame => {
      const doc = frame[0].contentDocument!;
      const faces = [...doc.fonts].filter(face => face.family.replace(/"/g, "") === "Lato");
      expect(faces.some(face => face.status === "loaded"), "a loaded Lato face").to.equal(true);
      const workspace = doc.querySelector(".markov-workspace")!;
      expect(doc.defaultView!.getComputedStyle(workspace).fontFamily).to.match(/^"?Lato/);
    });
  });
});
