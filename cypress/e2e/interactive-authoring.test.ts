import { defaultAuthoredState, MarkovAuthoredState, maxStartingTextLength } from "../../src/interactive/authored-state";

// invoke() and its() are queries, so an assertion on this retries until the latest save arrives
const lastSaved = () => cy.interactiveMessages("authoredState").invoke("slice", -1).its(0);

const savedOnce = (expected: MarkovAuthoredState) =>
  cy.interactiveMessages("authoredState").should(states => expect(states).to.deep.equal([expected]));

const withChange = (change: Partial<MarkovAuthoredState>): MarkovAuthoredState =>
  ({ ...defaultAuthoredState, ...change });

describe("the interactive's authoring form", () => {
  it("tells LARA it supports authored and interactive state", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactiveMessages("supportedFeatures").should(features => expect(features).to.deep.equal([
      { apiVersion: 1, features: { authoredState: true, interactiveState: true } }
    ]));
  });

  it("shows the defaults for a new interactive, and saves nothing until a change", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#usableModes").should("have.value", "both");
    cy.interactive().find("#startingMode").should("have.value", "useData");
    cy.interactive().find("#inputView").should("have.value", "textAndTable");
    cy.interactive().find("#capitalization").should("have.value", "lowercase");
    cy.interactive().find("#showCaseSwitch").should("be.checked");
    cy.interactive().find("#orderMattersStartsOn").should("be.checked");
    cy.interactive().find("#orderMattersShowSwitch").should("be.checked");
    cy.interactive().find("#startingText").should("have.value", "");
    ["input", "graph", "inspect", "generator"].forEach(pane => {
      cy.interactive().find(`#pane-${pane}`).should("be.checked");
      cy.interactive().find(`#pane-${pane}-startsOpen`).should("be.checked");
    });
    cy.interactive().find("#pane-graph-startsOpen").closest("label")
      .should("have.text", "Open at the start in Data mode");
    cy.interactive().find("#button-probabilities").should("be.checked");
    cy.interactive().find("#button-probabilities-startsOn").should("not.be.checked");
    cy.interactive().find("#button-sendToCodap").should("not.be.checked");
    cy.interactive().find("#button-downloadTables").should("not.be.checked");
    cy.interactiveMessages("authoredState").should("have.length", 0);
  });

  it("lays out its sections in order, with Ordering and Send data buttons as groups inside them", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("legend").then(legends => [...legends].map(legend => {
      const section = legend.parentElement?.parentElement?.closest("fieldset");
      return [legend.textContent, section?.querySelector(":scope > legend")?.textContent ?? null];
    })).should("deep.equal", [
      ["Modes", null], ["Data settings", null], ["Ordering", "Data settings"],
      ["What students can see", null], ["Send data buttons", "What students can see"],
    ]);
    cy.interactive().find("#inputView").should("have.attr", "aria-describedby", "input-view-help");
    cy.interactive().find("#input-view-help").should("contain.text", "a table of its words");
  });

  it("describes the option chosen under the usable modes and the input view", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#modes-help").should("contain.text", "switch between the two");
    cy.interactive().find("#usableModes").select("Draw");
    cy.interactive().find("#modes-help").should("have.text", "Students draw their own chain.");
    cy.interactive().find("#usableModes").select("Data");
    cy.interactive().find("#inputView").select("Table only");
    cy.interactive().find("#input-view-help")
      .should("have.text", "Students type their words into the table; there's no text box.");
  });

  const changes: Array<[string, () => void, MarkovAuthoredState]> = [
    ["the usable modes", () => cy.interactive().find("#usableModes").select("Data"),
      withChange({ modes: { useData: true, draw: false } })],
    ["the starting mode", () => cy.interactive().find("#startingMode").select("Draw"),
      withChange({ startingMode: "draw" })],
    ["the input view", () => cy.interactive().find("#inputView").select("Table only"),
      withChange({ inputView: "table" })],
    ["the case sensitivity students start with",
      () => cy.interactive().find("#capitalization").select("Yes: \"The\" and \"the\" are different words"),
      withChange({ capitalization: "asTyped" })],
    ["the \"Case sensitive\" switch", () => cy.interactive().find("#showCaseSwitch").uncheck(),
      withChange({ showCaseSwitch: false })],
    ["\"Order matters\" starts on", () => cy.interactive().find("#orderMattersStartsOn").uncheck(),
      withChange({ orderMatters: { startsOn: false, showSwitch: true } })],
    ["the \"Order matters\" switch", () => cy.interactive().find("#orderMattersShowSwitch").uncheck(),
      withChange({ orderMatters: { startsOn: true, showSwitch: false } })],
    ["a pane", () => cy.interactive().find("#pane-inspect").uncheck(),
      withChange({ panes: { ...defaultAuthoredState.panes, inspect: { available: false, startsOpen: true } } })],
    ["a pane's starting state", () => cy.interactive().find("#pane-generator-startsOpen").uncheck(),
      withChange({ panes: { ...defaultAuthoredState.panes, generator: { available: true, startsOpen: false } } })],
    ["the Send to CODAP button", () => cy.interactive().find("#button-sendToCodap").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, sendToCodap: { available: true } } })],
    ["the Download data files button", () => cy.interactive().find("#button-downloadTables").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, downloadTables: { available: true } } })],
    ["the probabilities toggle", () => cy.interactive().find("#button-probabilities").uncheck(),
      withChange({
        buttons: { ...defaultAuthoredState.buttons, probabilities: { available: false, startsOn: false } }
      })],
    ["the probabilities' starting state", () => cy.interactive().find("#button-probabilities-startsOn").check(),
      withChange({ buttons: { ...defaultAuthoredState.buttons, probabilities: { available: true, startsOn: true } } })],
  ];
  changes.forEach(([name, act, expected]) => {
    it(`saves ${name}, and only that`, () => {
      cy.startInteractive({ mode: "authoring", authoredState: {} });
      act();
      savedOnce(expected);
    });
  });

  it("saves the starting text as it is typed", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#startingText").type("the cat");
    cy.interactiveMessages("authoredState").should("have.length", "the cat".length);
    lastSaved().should("deep.equal", withChange({ startingText: "the cat" }));
  });

  it("stops the starting text at its limit and says how much is left near it", () => {
    const nearlyFull = "a".repeat(maxStartingTextLength - 2);
    cy.startInteractive({ mode: "authoring", authoredState: withChange({ startingText: nearlyFull }) });
    cy.interactive().find("#starting-text-help").should("contain.text", "2 characters left");
    cy.interactive().find("#startingText").type("b");
    cy.interactive().find("#starting-text-help").should("contain.text", "1 character left.");
    cy.interactive().find("#startingText").type("cd");
    cy.interactive().find("#startingText").invoke("val").should("have.length", maxStartingTextLength);
    lastSaved().its("startingText").should("equal", `${nearlyFull}bc`);
    cy.interactive().find("#starting-text-help").should("contain.text", "0 characters left");
  });

  it("opens showing a saved state", () => {
    const saved = withChange({
      modes: { useData: true, draw: true }, startingMode: "draw", inputView: "text", capitalization: "asTyped",
      showCaseSwitch: false, orderMatters: { startsOn: false, showSwitch: false }, startingText: "a big bag of words",
      panes: {
        input: { available: true, startsOpen: false }, graph: { available: true, startsOpen: false },
        inspect: { available: false, startsOpen: true }, generator: { available: true, startsOpen: false },
      },
      buttons: {
        probabilities: { available: false, startsOn: true }, sendToCodap: { available: true },
        downloadTables: { available: true },
      },
    });
    cy.startInteractive({ mode: "authoring", authoredState: saved });
    cy.interactive().find("#startingMode").should("have.value", "draw");
    cy.interactive().find("#inputView").should("have.value", "text");
    cy.interactive().find("#capitalization").should("have.value", "asTyped");
    cy.interactive().find("#capitalization").find("option:selected")
      .should("have.text", "Yes: \"The\" and \"the\" are different words");
    cy.interactive().find("label[for='capitalization']").should("have.text", "Case sensitive at the start");
    cy.interactive().find("#showCaseSwitch").should("not.be.checked");
    cy.interactive().find("#orderMattersStartsOn").should("not.be.checked");
    cy.interactive().find("#orderMattersShowSwitch").should("not.be.checked");
    cy.interactive().find("#startingText").should("have.value", "a big bag of words");
    ["input", "graph", "generator"].forEach(pane => {
      cy.interactive().find(`#pane-${pane}-startsOpen`).should("not.be.checked");
    });
    cy.interactive().find("#pane-inspect").should("not.be.checked");
    cy.interactive().find("#button-probabilities").should("not.be.checked");
    cy.interactive().find("#button-probabilities-startsOn").should("be.checked");
    cy.interactive().find("#button-sendToCodap").should("be.checked");
    cy.interactive().find("#button-downloadTables").should("be.checked");
  });

  it("offers the starting mode only with both modes, and keeps it to a mode students have", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#usableModes").select("Data");
    cy.interactive().find("#startingMode").should("not.exist");
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#startingMode").should("have.value", "useData");
    cy.interactive().find("#usableModes").select("Draw");
    cy.interactive().find("#startingMode").should("not.exist");
    lastSaved().should("deep.equal", withChange({ modes: { useData: false, draw: true }, startingMode: "draw" }));
  });

  it("hides the Data settings and the Input pane without Data mode, and shows them as they were", () => {
    cy.startInteractive({
      mode: "authoring", authoredState: withChange({
        modes: { useData: false, draw: true }, inputView: "table", orderMatters: { startsOn: false, showSwitch: true },
        panes: { ...defaultAuthoredState.panes, input: { available: true, startsOpen: false } },
      })
    });
    // the form is on the page, so what isn't there was left off rather than not drawn yet
    cy.interactive().find("#pane-inspect-startsOpen").should("exist");
    cy.interactive().find("#usableModes").should("have.value", "draw");
    ["#inputView", "#capitalization", "#showCaseSwitch", "#orderMattersStartsOn", "#orderMattersShowSwitch",
      "#startingText", "#pane-input", "#pane-input-startsOpen", "#pane-graph-startsOpen"].forEach(selector => {
      cy.interactive().find(selector).should("not.exist");
    });
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#inputView").should("have.value", "table");
    cy.interactive().find("#orderMattersStartsOn").should("not.be.checked");
    cy.interactive().find("#pane-input").should("be.checked");
    cy.interactive().find("#pane-input-startsOpen").should("not.be.checked");
    cy.interactive().find("#pane-graph-startsOpen").should("be.checked");
  });

  it("hides a pane's starting state while it isn't available, but not the probabilities'", () => {
    cy.startInteractive({
      mode: "authoring", authoredState: withChange({
        modes: { useData: true, draw: false },
        panes: { ...defaultAuthoredState.panes, inspect: { available: true, startsOpen: false } },
      })
    });
    cy.interactive().find("#pane-graph-startsOpen").closest("label").should("have.text", "Open at the start");
    cy.interactive().find("#pane-inspect").uncheck();
    cy.interactive().find("#pane-inspect-startsOpen").should("not.exist");
    cy.interactive().find("#pane-inspect").check();
    cy.interactive().find("#pane-inspect-startsOpen").should("not.be.checked");
    cy.interactive().find("#pane-inspect").uncheck();
    cy.interactive().find("#pane-graph").uncheck();
    cy.interactive().find("#pane-graph-startsOpen").should("not.exist");
    cy.interactive().find("#button-probabilities").uncheck();
    cy.interactive().find("#button-probabilities-startsOn").should("not.be.disabled").check();
    lastSaved().its("buttons.probabilities").should("deep.equal", { available: false, startsOn: true });
  });

  it("keeps the Graph pane while Draw is available, and says why", () => {
    cy.startInteractive({ mode: "authoring", authoredState: withChange({ modes: { useData: true, draw: false } }) });
    cy.interactive().find("#pane-graph").should("not.be.disabled").uncheck();
    cy.interactive().find("#graph-help").should("not.exist");
    cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
    cy.interactive().find("#pane-graph").should("be.checked").and("be.disabled")
      .and("have.attr", "aria-describedby", "graph-help");
    cy.interactive().find("#graph-help").should("contain.text", "Draw mode needs the Graph pane");
    lastSaved().its("panes.graph.available").should("equal", true);
  });

  it("notes that Send to CODAP needs CODAP on the page, whether or not it is checked", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#button-sendToCodap").should("not.be.checked")
      .and("have.attr", "aria-describedby", "send-to-codap-help");
    cy.interactive().find("#send-to-codap-help").should("contain.text", "Requires a linked CODAP interactive");
    cy.interactive().find("#button-sendToCodap").check();
    cy.interactive().find("#button-sendToCodap").should("be.checked")
      .and("have.attr", "aria-describedby", "send-to-codap-help");
    cy.interactive().find("#send-to-codap-help").should("contain.text", "Requires a linked CODAP interactive");
  });

  it("sizes its frame to the form, growing and shrinking with it", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {} });
    cy.interactive().find("#startingMode");
    cy.frameFitsInteractive();
    cy.get("iframe#interactive").invoke("height").then(withBothModes => {
      cy.interactive().find("#usableModes").select("Data");
      cy.interactive().find("#startingMode").should("not.exist");
      cy.frameFitsInteractive();
      cy.get("iframe#interactive").invoke("height").should("be.lessThan", withBothModes);
      cy.interactive().find("#usableModes").select("Both (with a toggle switch for students)");
      cy.frameFitsInteractive();
      cy.get("iframe#interactive").invoke("height").should("equal", withBothModes);
    });
  });

  it("fits LARA's narrowest authoring column without scrolling sideways", () => {
    cy.startInteractive({ mode: "authoring", authoredState: {}, width: 420 });
    cy.interactive().find("#startingText");
    cy.interactive().then(body => expect(body[0].scrollWidth).to.be.at.most(420));
  });

  describe("a setup that leaves students nothing to work with", () => {
    const alert = () => cy.interactive().find("[role='alert']");
    const dataOnly = withChange({ modes: { useData: true, draw: false } });

    it("isn't sent with the Input pane off and no starting data, until starting data is typed", () => {
      cy.startInteractive({ mode: "authoring", authoredState: {} });
      cy.interactive().find("#usableModes").select("Data");
      savedOnce(dataOnly);
      cy.interactive().find("#pane-input").uncheck();
      alert().should("contain.text", "With the Input pane off, add starting data")
        .and("contain.text", "Your changes aren't saved until this is fixed.");
      savedOnce(dataOnly);
      cy.interactive().find("#startingText").type("the cat");
      alert().should("not.exist");
      lastSaved().should("deep.equal", {
        ...dataOnly, panes: { ...dataOnly.panes, input: { available: false, startsOpen: true } },
        startingText: "the cat",
      });
    });

    it("isn't sent with every pane off", () => {
      cy.startInteractive({ mode: "authoring", authoredState: {} });
      cy.interactive().find("#usableModes").select("Data");
      cy.interactive().find("#startingText").type("the cat");
      ["input", "graph", "inspect", "generator"].forEach(pane => cy.interactive().find(`#pane-${pane}`).uncheck());
      alert().should("contain.text", "Turn on at least one pane, or students will see nothing.");
      lastSaved().its("panes").should(panes => {
        const available = Object.values(panes as Record<string, { available: boolean }>).map(pane => pane.available);
        expect(available).to.include(true);
      });
    });

    it("shows the error for a setup saved before the check, and sends nothing", () => {
      const saved = { ...dataOnly, panes: { ...dataOnly.panes, input: { available: false, startsOpen: true } } };
      cy.startInteractive({ mode: "authoring", authoredState: saved });
      alert().should("contain.text", "With the Input pane off, add starting data");
      cy.interactive().find("#pane-inspect").uncheck();
      cy.interactive().find("#pane-inspect").should("not.be.checked");
      alert().should("contain.text", "With the Input pane off, add starting data");
      cy.interactiveMessages("authoredState").should("have.length", 0);
    });
  });
});
