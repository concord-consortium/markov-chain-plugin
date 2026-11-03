import { toolbarHeight } from "../../src/interactive/workspace/pane-sizes";
import { selectedNodeColor } from "../support/graph";
import {
  clickState, graphRoot, loggedEvents, mousePress, parseTransform, pinch, pressEvents, pressState, pressTab,
  rootTransform, stateEllipse, stateLabels
} from "../support/workspace";

// the Standard layout's full-width item, wide enough that the panes sit side by side
const width = 1044;
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState, ...options });
const textBox = () => cy.interactive().find("textarea[aria-label='Your text']");
// the workspace's fits animate over 250 ms
const afterFit = () => cy.wait(400);
const row = (n: number) => cy.interactive().find(`input[aria-label='Row ${n}']`);
const newRow = () => cy.interactive().find("input[aria-label='New row']");
const commits = () => loggedEvents().invoke("filter", ([action]: [string]) => action === "InputCommitted");
// a paste changes the text box's value in one input event, and commits it whole
const paste = (added: string) => textBox().then(box => {
  const textarea = box[0] as HTMLTextAreaElement;
  const win = textarea.ownerDocument.defaultView as Window & typeof globalThis;
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!;
  setValue.call(textarea, textarea.value + added);
  textarea.dispatchEvent(new win.InputEvent("input", { bubbles: true }));
});
const playButton = () => cy.interactive().find(".generator-pane button").contains("Play");
// queries all, so a should() after it retries until focus is where it expects
const focused = () => cy.get<HTMLIFrameElement>("iframe#interactive").its("0.contentDocument")
  .invoke("querySelector", ":focus") as unknown as Cypress.Chainable<HTMLElement | null>;

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
      stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
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
      paste(" and a dog ran far away");
      afterFit();
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

describe("the workspace's text box", () => {
  it("commits a word once it is finished, not when typing pauses", () => {
    start();
    textBox().type("ca");
    cy.wait(1500);
    cy.interactive().find(".graph-empty").should("exist");
    commits().should("have.length", 0);
    textBox().type("t sat ");
    stateLabels().should("deep.equal", ["cat", "sat"]);
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "separator", tokens: 2, states: 2 }]);
  });

  it("commits a deletion a second after the student stops", () => {
    start({ startingText: "the cat" });
    stateLabels().should("deep.equal", ["cat", "the"]);
    textBox().type("{backspace}");
    cy.wait(500);
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.wait(1000);
    stateLabels().should("deep.equal", ["ca", "the"]);
    loggedEvents().should("deep.include", ["InputCommitted", { view: "text", how: "pause", tokens: 2, states: 2 }]);
  });

  it("commits a cut and a paste at once", () => {
    start({ startingText: "the cat" });
    stateLabels().should("deep.equal", ["cat", "the"]);
    textBox().type("{selectall}{backspace}");
    cy.interactive().find(".graph-empty").should("exist");
    loggedEvents().should("deep.include", ["InputCommitted", { view: "text", how: "remove", tokens: 0, states: 0 }]);
    paste("a dog");
    stateLabels().should("deep.equal", ["a", "dog"]);
    loggedEvents().should("deep.include", ["InputCommitted", { view: "text", how: "insert", tokens: 2, states: 2 }]);
  });

  it("commits on leaving the text box after the press that left it, so the press's click lands", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    pressState("cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "cat", source: "graph" }]);
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    loggedEvents().should("deep.include", ["InputCommitted", { view: "text", how: "blur", tokens: 3, states: 3 }]);
  });

  it("commits after a touch tap on a state, whose mousedown follows its pointerup", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.wait(260);
    stateEllipse("cat").then(ellipse =>
      pressEvents(ellipse[0], ["pointerdown", "pointerup", "mousedown", "focus", 40, "mouseup", "click"], "touch"));
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  // a touch scroll sends no mousedown; a press that becomes a drag sends no mouseup
  it("commits on leaving the text box after a touch scroll or a press that became a drag", () => {
    start();
    textBox().type("the cat sat");
    cy.interactive().find(".graph-pane .pane-body").then(body =>
      pressEvents(body[0], ["pointerdown", "pointercancel", "pointerdown", "mousedown", "pointercancel"], "mouse"));
    textBox().blur({ force: true });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  // a context menu can swallow the mouseup
  it("commits at once on leaving the text box for a secondary-button press", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.wait(260);
    stateEllipse("cat").then(ellipse => pressEvents(ellipse[0], ["pointerdown", "mousedown", "focus"], "mouse", 2));
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  // Ctrl+click on a Mac opens the menu from a primary-button press
  it("commits on leaving the text box after a press that opened a context menu", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.wait(260);
    stateEllipse("cat").then(ellipse => pressEvents(ellipse[0], ["pointerdown", "mousedown", "contextmenu"], "mouse"));
    textBox().blur({ force: true });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  it("commits a deletion with the blur when a press is held past the pause", () => {
    start({ startingText: "the cat sat" });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    cy.wait(260);
    textBox().type("{backspace}");
    stateEllipse("cat").then(ellipse =>
      pressEvents(ellipse[0], ["pointerdown", "mousedown", "focus", 1300, "pointerup", "mouseup", "click"], "touch"));
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    stateLabels().should("deep.equal", ["cat", "sa", "the"]);
  });

  // Play reads the graph as it stands when clicked, so a press on it doesn't hold the commit
  it("commits before a press on Play starts generating", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    playButton().then(button =>
      mousePress(button[0]));
    loggedEvents().should(events => {
      const blurCommit = events.findIndex(([action, data]) => action === "InputCommitted" &&
        Cypress._.isEqual(data, { view: "text", how: "blur", tokens: 3, states: 3 }));
      const played = events.findIndex(([action]) => action === "SequencePlayed");
      expect(blurCommit).to.be.at.least(0);
      expect(played).to.be.greaterThan(blurCommit);
    });
  });

  it("is read-only while a sequence generates", () => {
    start({ startingText: "the cat sat on the mat" });
    playButton().click();
    textBox().should("have.attr", "readonly");
    cy.interactive().find(".input-table input").each(input => expect(input).to.have.attr("readonly"));
    cy.interactive().find(".input-table button.delete-row").each(button => expect(button).to.be.disabled);
  });

  it("saves an edit that leaves the states as they were", () => {
    start({ startingText: "the Cat" });
    stateLabels().should("deep.equal", ["cat", "the"]);
    textBox().focus().then(box => (box[0] as HTMLTextAreaElement).setSelectionRange(4, 5));
    textBox().type("c").blur({ force: true });
    cy.interactiveMessages("interactiveState", { timeout: 5000 })
      .should("deep.include", { version: 1, input: { text: "the cat" } });
    commits().should("have.length", 0);
  });

  it("marks the chosen state's words behind the text", () => {
    start({ startingText: "the cat saw the dog" });
    clickState("the");
    cy.interactive().find(".text-input .backdrop mark.highlight-selected")
      .should("have.length", 2).each(mark => expect(mark.text()).to.equal("the"));
  });
});

describe("the workspace's input table", () => {
  it("shows the text box alone in the text-only view", () => {
    start({ inputView: "text", startingText: "the cat" });
    textBox().should("have.value", "the cat");
    cy.interactive().find(".input-table").should("not.exist");
  });

  it("lists the tokens, a blank line as an empty row", () => {
    start({ inputView: "table", startingText: "the cat\n\nsat." });
    cy.interactive().find("textarea").should("not.exist");
    cy.interactive().find(".input-table input")
      .then(inputs => [...inputs].map(input => (input as HTMLInputElement).value))
      .should("deep.equal", ["the", "cat", "", "sat", ".", ""]);
  });

  it("writes a row's edit into the text when the row is left", () => {
    start({ startingText: "the cat sat" });
    row(2).clear().type("No!").blur({ force: true });
    textBox().should("have.value", "the [No!] sat");
    stateLabels().should("deep.equal", ["no!", "sat", "the"]);
    loggedEvents().should("deep.include", ["InputCommitted", { view: "table", how: "row", tokens: 3, states: 3 }]);
    row(2).clear().blur({ force: true });
    textBox().should("have.value", "the\n\nsat");
  });

  it("adds a row below on Enter, and at the end, and deletes rows", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big").blur({ force: true });
    textBox().should("have.value", "the big cat sat");
    loggedEvents().should("deep.include", ["TableRowAdded", undefined]);
    newRow().type("down").blur({ force: true });
    textBox().should("have.value", "the big cat sat down");
    cy.interactive().find("button[aria-label='Delete row 2']").click();
    textBox().should("have.value", "the cat sat down");
    loggedEvents().should("deep.include", ["TableRowDeleted", undefined]);
  });

  it("adds the end row's words on Enter, staying on the end row", () => {
    start({ startingText: "the cat sat" });
    newRow().type("down{enter}");
    textBox().should("have.value", "the cat sat down");
    focused().should("have.attr", "aria-label", "New row").and("have.value", "");
  });

  it("adds a row Enter opened on Enter, and opens another below it", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big{enter}");
    focused().should("have.attr", "aria-label", "Row 3");
    row(3).type("red");
    row(3).blur({ force: true });
    textBox().should("have.value", "the big red cat sat");
  });

  it("keeps focus in the table when the last row is deleted", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("button[aria-label='Delete row 3']").focus();
    cy.interactive().find("button[aria-label='Delete row 3']").click();
    textBox().should("have.value", "the cat");
    focused().should("have.attr", "aria-label", "Row 2");
  });

  it("commits the text box before a press in the table acts on the text", () => {
    start({ startingText: "the cat sat" });
    textBox().type("s");
    cy.interactive().find("button[aria-label='Delete row 1']").then(button =>
      mousePress(button[0]));
    textBox().should("have.value", "cat sats");
  });

  it("commits a row left for a press on a state once the press ends, so the click lands", () => {
    start({ startingText: "the cat sat" });
    row(2).clear().type("dog");
    pressState("the");
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    textBox().should("have.value", "the dog sat");
  });

  it("deletes the row pressed when a row Enter opened above it goes in", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big");
    cy.interactive().find("button[aria-label='Delete row 4']").then(button =>
      mousePress(button[0]));
    textBox().should("have.value", "the big cat");
  });

  it("adds nothing for a row of brackets alone, and logs no added row", () => {
    start({ startingText: "the cat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("[]{enter}");
    focused().should("have.attr", "aria-label", "Row 2").and("have.value", "");
    row(2).blur({ force: true });
    textBox().should("have.value", "the cat");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("TableRowAdded"));
  });

  it("leaves an input method's Enter to the input method", () => {
    start({ startingText: "the cat" });
    row(1).focus();
    focused().should("have.attr", "aria-label", "Row 1");
    row(1).then(input => {
      const win = input[0].ownerDocument.defaultView as Window & typeof globalThis;
      const enter =
        new win.KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
      input[0].dispatchEvent(enter);
      expect(enter.defaultPrevented, "Enter handled by the table").to.equal(false);
    });
    cy.interactive().find(".input-table input").should("have.length", 3);
  });

  it("keeps the Tab stop on a row Enter added once focus leaves it", () => {
    start({ startingText: "the cat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big");
    pressTab();
    textBox().should("have.value", "the big cat");
    row(2).should("have.attr", "tabindex", "0");
  });

  // dropped under the press, the empty row would move the rows below it up a place
  it("acts on the row pressed below an empty row Enter opened", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    cy.interactive().find("button[aria-label='Delete row 3']").then(button => mousePress(button[0]));
    textBox().should("have.value", "the sat");
    focused().should("have.attr", "aria-label", "Delete row 2");

    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(3).then(input => mousePress(input[0]));
    focused().should("have.attr", "aria-label", "Row 2").and("have.value", "sat");
    stateEllipse("sat").should("have.attr", "fill", selectedNodeColor);
  });

  it("drops a row Enter opened if it is left empty", () => {
    start({ startingText: "the cat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).blur({ force: true });
    cy.interactive().find(".input-table input").should("have.length", 3);
    textBox().should("have.value", "the cat");
  });

  it("refuses a row that would take the input past its limit", () => {
    // two short words, so the graph is small
    const saved = `a${" ".repeat(49993)}b`;
    start({}, { interactiveState: { version: 1, input: { text: saved } } });
    newRow().type("toolong");
    newRow().blur({ force: true });
    cy.interactive().find(".input-table [role='status']").should("contain.text", "at its limit");
    newRow().should("have.value", "");
    // a second refusal is a new note, so it is announced again
    cy.interactive().find(".input-table [role='status'] span").invoke("attr", "data-first", "yes");
    newRow().type("toolong");
    newRow().blur({ force: true });
    cy.interactive().find(".input-table [role='status'] span").should("not.have.attr", "data-first");
    // Enter in a row it refuses leaves the student in that row
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("toolong{enter}");
    focused().should("have.attr", "aria-label", "Row 2").and("have.value", "");
    textBox().invoke("val").should("equal", saved);
  });

  [3, 30].forEach(rows => {
    it(`is one stop in the Tab order with ${rows} rows`, () => {
      start({ startingText: Array.from({ length: rows }, (_, i) => `w${i}`).join(" ") });
      cy.interactive().find(".input-table input").should("have.length", rows + 1);
      textBox().focus();
      pressTab();
      focused().should("have.attr", "aria-label", "Row 1");
      pressTab();
      focused().should("have.attr", "aria-label", "Delete row 1");
      pressTab();
      focused().should(element => {
        expect(element, "the element focused").not.to.equal(null);
        expect(element?.closest(".input-table")).to.equal(null);
      });
    });
  });

  it("moves between rows with Up and Down, choosing each row's state", () => {
    start({ startingText: "the cat sat" });
    row(1).focus();
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "the", source: "table" }]);
    row(1).type("{downArrow}");
    focused().should("have.attr", "aria-label", "Row 2");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    row(2).type("{upArrow}");
    focused().should("have.attr", "aria-label", "Row 1");
  });

  it("moves down from a row Enter opened to the row below it, choosing that row's state", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big{downArrow}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    textBox().should("have.value", "the big cat sat");
    // an empty row Enter opened is dropped from under the focus, which then shows, and chooses, the row below
    row(3).type("{upArrow}{enter}{downArrow}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    pressTab();
    focused().should("have.attr", "aria-label", "Delete row 3");
  });

  it("clears the selection when an empty row is focused", () => {
    start({ startingText: "the cat\n\nsat" });
    clickState("cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    row(3).focus();
    stateEllipse("cat").should("have.attr", "fill", "#fff");
    loggedEvents().should(events => expect(events[events.length - 1]).to.deep.equal(
      ["SelectionCleared", { via: "table" }]));
  });
});
