import { defaultAuthoredState, MarkovAuthoredState } from "../../src/interactive/authored-state";

const listedSettings = () => cy.interactive().find(".runtime-placeholder dl").then(list =>
  [...list.find("dt")].map((term, i) => [term.textContent, list.find("dd")[i].textContent]));

describe("the interactive's placeholder runtime", () => {
  it("lists every authored setting with its value", () => {
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
    cy.startInteractive({ mode: "runtime", authoredState, width: 600 });
    cy.interactive().should("contain.text", "Markov interactive: coming soon");
    listedSettings().should("deep.equal", [
      ["Usable mode(s)", "Data"],
      ["How students enter their data", "Text only"],
      ["Capital letters", "\"The\" and \"the\" are different words"],
      ["Start with \"Order matters\" on", "No"],
      ["Show students the \"Order matters\" switch", "No"],
      ["Starting data", "the cat sat (11 characters)"],
      ["Input pane", "Available"],
      ["Input pane: Open at the start", "Yes"],
      ["Graph pane", "Available"],
      ["Graph pane: Open at the start", "Yes"],
      ["Inspect pane", "Not available"],
      ["Sequence generator pane", "Available"],
      ["Sequence generator pane: Open at the start", "Yes"],
      ["Probabilities shown at the start", "Yes"],
      ["Show probabilities toggle", "Available"],
      ["Send to CODAP button", "Available"],
      ["Download data files button", "Not available"],
    ]);
  });

  it("ignores settings in its link, taking only the authored state", () => {
    cy.startInteractive({
      mode: "runtime", width: 600,
      authoredState: { modes: { useData: true, draw: false }, panes: { inspect: { available: false } } },
      search: "?modes.draw=true&panes.inspect.available=true&inputView=table",
    });
    listedSettings().should("deep.include", ["Usable mode(s)", "Data"])
      .and("deep.include", ["Inspect pane", "Not available"])
      .and("deep.include", ["How students enter their data", "Linked table and text"]);
  });

  it("lists the defaults for an interactive never authored", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {} });
    listedSettings().its(0).should("deep.equal", ["Usable mode(s)", "Both (with a toggle switch for students)"]);
  });

  [["no interactive state", undefined], ["{}", {}]].forEach(([name, interactiveState]) => {
    it(`saves a version when it opens with ${name}`, () => {
      cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState });
      // the library sends interactive state after a 2 second pause
      cy.interactiveMessages("interactiveState", { timeout: 5000 }).should(states => {
        expect(states).to.deep.equal([{ version: 1 }]);
      });
    });
  });

  it("leaves an existing interactive state alone", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, interactiveState: { version: 1 } });
    cy.interactive().should("contain.text", "coming soon");
    cy.wait(2500);
    cy.interactiveMessages("interactiveState").should("have.length", 0);
  });

  it("sizes its frame to the placeholder", () => {
    cy.startInteractive({ mode: "runtime", authoredState: {}, width: 600 });
    cy.interactive().find(".runtime-placeholder dl");
    cy.frameFitsInteractive();
    // taller than a frame's default 150px, so a frame that never resized would fail
    cy.get("iframe#interactive").invoke("height").should("be.greaterThan", 150);
  });
});
