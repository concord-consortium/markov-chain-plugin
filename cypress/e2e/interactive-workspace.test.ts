import {
  defaultPaneSizes, minInputPart, minPaneSizes, paneBorder, paneGap, paneHeader, panePadding, toolbarHeight,
  workspaceHeight
} from "../../src/interactive/workspace/pane-sizes";
import {
  animatedArrowColor, animatedNodeColor, outgoingArrowColor, pastDoubleClick, selectedNodeColor
} from "../support/graph";
import {
  clickState, divider, dragDivider, dragEvents, graphRoot, loggedEvents, mousePress, parseTransform, pinch,
  pressEvents, pressState, pressTab, rootTransform, stateEllipse, stateLabels
} from "../support/workspace";

// the Standard layout's full-width item, wide enough that the panes sit side by side
const width = 1044;
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState, ...options });
const textBox = () => cy.interactive().find("textarea[aria-label='Your text']");
// the workspace's fits animate over 250 ms
const afterFit = () => cy.wait(400);
const row = (n: number) => cy.interactive().find(`input[aria-label='Row ${n}']`);
const inspectRow = (label: string) => cy.interactive().find(".inspect-pane tbody tr")
  .filter((i, tr) => (tr as HTMLTableRowElement).cells[0].textContent === label);
const inspectTab = (label: string) => cy.interactive().find(".inspect-tab").contains(label);
const newRow = () => cy.interactive().find("input[aria-label='New row']");
const commits = () => loggedEvents().invoke("filter", ([action]: [string]) => action === "InputCommitted");
// the text box's value replaced by text(value), in one input event of init's kind
const inputText = (text: (value: string) => string, init: InputEventInit = {}) => textBox().then(box => {
  const textarea = box[0] as HTMLTextAreaElement;
  const win = textarea.ownerDocument.defaultView as Window & typeof globalThis;
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!;
  setValue.call(textarea, text(textarea.value));
  textarea.dispatchEvent(new win.InputEvent("input", { ...init, bubbles: true }));
});
// a paste changes the text box's value in one input event, and commits it whole
const paste = (added: string) => inputText(value => value + added);
// an input method's composition starting or ending in the text box
const composition = (type: "compositionstart" | "compositionend", data: string) => textBox().then(box => {
  const win = box[0].ownerDocument.defaultView as Window & typeof globalThis;
  box[0].dispatchEvent(new win.CompositionEvent(type, { data, bubbles: true }));
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

  it("draws its controls in the generator buttons' color", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    cy.interactive().find(".generator-pane button").contains("Play").then(play => {
      const teal = getComputedStyle(play[0]).borderTopColor;
      const controls: [string, "borderTopColor" | "borderBottomColor" | "color"][] = [
        [".clear-highlight", "borderTopColor"],
        ["textarea[aria-label='Your text']", "borderTopColor"],
        [".input-table input", "borderTopColor"],
        [".inspect-tab", "borderTopColor"],
        [".inspect-tabs", "borderBottomColor"],
        [".controls-toggle", "color"],
      ];
      controls.forEach(([selector, property]) => {
        cy.interactive().find(selector).first()
          .should(element => expect(getComputedStyle(element[0])[property], selector).to.equal(teal));
      });
    });
  });

  it("heads the generator's controls beside the output's heading, with their toggle 10 px in from the line", () => {
    start({ startingText: "the cat sat" });
    const box = (selector: string) => cy.interactive().find(selector).first()
      .then(found => found[0].getBoundingClientRect());
    const middle = (rect: DOMRect) => rect.top + rect.height / 2;
    cy.interactive().find(".generator-controls-header h3").should("have.text", "Controls");
    cy.interactive().find(".sequence-output > label").should("have.text", "Output");
    box(".generator-controls-header h3").then(heading => box(".sequence-output > label").then(output =>
      expect(middle(heading)).to.be.closeTo(middle(output), 1)));
    box(".controls-toggle").then(toggle => {
      expect([toggle.width, toggle.height]).to.deep.equal([20, 20]);
      box(".generator-controls select").then(select => expect(toggle.right).to.be.closeTo(select.right, 0.5));
      box(".generator-controls")
        .then(column => expect(column.right - paneBorder - toggle.right).to.be.closeTo(10, 0.5));
    });
    cy.interactive().find(".generator-controls-header svg path").invoke("attr", "d").then(minus =>
      cy.interactive().find(".pane-header .pane-toggle svg path").first().should("have.attr", "d", minus));
    cy.interactive().find(".generator-pane").then(pane => {
      const border = getComputedStyle(pane[0]).borderTopColor;
      const hasTheLine = () => cy.interactive().find(".generator-controls").should(column => {
        expect(getComputedStyle(column[0]).borderRightColor).to.equal(border);
        expect(getComputedStyle(column[0]).borderRightWidth).to.equal(`${paneBorder}px`);
      });
      hasTheLine();
      cy.interactive().find(".controls-toggle").click();
      cy.interactive().find(".controls-toggle").should("have.attr", "aria-expanded", "false");
      cy.interactive().find(".generator-controls-header h3").should("not.exist");
      hasTheLine();
    });
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
    pastDoubleClick();
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

  it("keeps focus in the controls row when the focused Clear highlight button goes", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    cy.interactive().find(".clear-highlight").focus();
    cy.interactive().find(".clear-highlight").type("{esc}");
    cy.interactive().find(".clear-highlight").should("not.exist");
    focused().should("have.class", "controls-row");

    clickState("cat");
    cy.interactive().find(".clear-highlight").focus();
    cy.interactive().find(".clear-highlight").click();
    cy.interactive().find(".clear-highlight").should("not.exist");
    focused().should("have.class", "controls-row");
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

  // the states' spread across their narrowest direction, as a share of the widest (their principal axes), is near 0
  // for states in a line
  it("spreads a chain of new words around the graph rather than along a line", () => {
    const words = ["and", "a", "dog", "ran", "far", "away", "from", "here"];
    textBox().type(` ${words.join(" ")} `);
    cy.interactive().find("g.node").should("have.length", 5 + words.length);
    cy.interactive().find("g.node ellipse").then(ellipses => {
      const centers = ellipses.toArray()
        .map(e => ({ x: Number(e.getAttribute("cx")), y: Number(e.getAttribute("cy")) }));
      const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
      const mx = mean(centers.map(c => c.x));
      const my = mean(centers.map(c => c.y));
      const xx = mean(centers.map(c => (c.x - mx) ** 2));
      const yy = mean(centers.map(c => (c.y - my) ** 2));
      const xy = mean(centers.map(c => (c.x - mx) * (c.y - my)));
      const root = Math.sqrt(((xx - yy) / 2) ** 2 + xy ** 2);
      const narrowest = (xx + yy) / 2 - root;
      const widest = (xx + yy) / 2 + root;
      expect(Math.sqrt(narrowest / widest)).to.be.greaterThan(0.45);
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

  it("commits nothing for a letter typed over a selected word that starts with it", () => {
    start({ startingText: "the cat sat" });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    inputText(() => "the c sat", { inputType: "insertText", data: "c" });
    textBox().should("have.value", "the c sat");
    cy.wait(1500);
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    commits().should("have.length", 0);
  });

  it("commits a paste over a selected word at once, though it shares the word's ending", () => {
    start({ startingText: "the cat sat" });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    inputText(() => "the bat sat", { inputType: "insertFromPaste" });
    stateLabels().should("deep.equal", ["bat", "sat", "the"]);
    loggedEvents().should("deep.include", ["InputCommitted", { view: "text", how: "insert", tokens: 3, states: 3 }]);
  });

  it("commits an input method's text when its composition ends, not while it composes", () => {
    start({ startingText: "the cat" });
    const compose = (text: string) =>
      inputText(() => `the cat ${text}`, { inputType: "insertCompositionText", data: text, isComposing: true });
    composition("compositionstart", "");
    compose("に");
    compose("にほん");
    // a space cycles through the input method's candidates, inside the composition
    compose("日本");
    compose("ni hao");
    cy.wait(1500);
    commits().should("have.length", 0);
    stateLabels().should("deep.equal", ["cat", "the"]);
    compose("日本");
    composition("compositionend", "日本");
    stateLabels().should("deep.equal", ["cat", "the", "日本"]);
    commits().should("have.length", 1).its(0).its(1).should("have.property", "how", "insert");
  });

  it("commits nothing for an emoji typed into a word", () => {
    start({ startingText: "the cat" });
    inputText(value => `${value}🍕`, { inputType: "insertText", data: "🍕" });
    textBox().should("have.value", "the cat🍕");
    cy.wait(1500);
    commits().should("have.length", 0);
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
    pastDoubleClick();
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
    pastDoubleClick();
    stateEllipse("cat").then(ellipse => pressEvents(ellipse[0], ["pointerdown", "mousedown", "focus"], "mouse", 2));
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  // Ctrl+click on a Mac opens the menu from a primary-button press
  it("commits on leaving the text box after a press that opened a context menu", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    pastDoubleClick();
    stateEllipse("cat").then(ellipse => pressEvents(ellipse[0], ["pointerdown", "mousedown", "contextmenu"], "mouse"));
    textBox().blur({ force: true });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
  });

  it("commits a deletion with the blur when a press is held past the pause", () => {
    start({ startingText: "the cat sat" });
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    pastDoubleClick();
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

  it("lists text typed in the text box as rows, a bracketed group as one row", () => {
    start({ startingText: "the cat" });
    textBox().type(" [ice cream] sat ");
    cy.interactive().find(".input-table input")
      .should(inputs => expect([...inputs].map(input => (input as HTMLInputElement).value))
        .to.deep.equal(["the", "cat", "ice cream", "sat", ""]));
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

  it("deletes the row pressed, not the one moved under the press when the row left is emptied", () => {
    start({ startingText: "the cat sat" });
    row(1).clear();
    cy.interactive().find("button[aria-label='Delete row 1']").then(button => mousePress(button[0]));
    row(1).should("have.value", "cat");
    row(2).should("have.value", "sat");
  });

  it("deletes the row pressed when an emptied row above it goes", () => {
    start({ startingText: "the cat sat" });
    row(1).clear();
    cy.interactive().find("button[aria-label='Delete row 3']").then(button => mousePress(button[0]));
    row(1).should("have.value", "cat");
    cy.interactive().find("input[aria-label='Row 2']").should("not.exist");
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
      // the divider between the text box and the table comes first
      pressTab();
      focused().should("have.attr", "aria-label", "Resize the text box and the table");
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

  it("moves down from an emptied row to the row that was below it", () => {
    start({ startingText: "the cat sat" });
    row(1).clear().type("{downArrow}");
    focused().should("have.value", "cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
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

describe("the workspace's linked highlighting", () => {
  const tableRows = () => cy.interactive().find(".input-table-rows tbody tr");
  const marks = () => cy.interactive().find(".text-input .backdrop mark")
    .invoke("toArray").invoke("map", (mark: Element) => `${mark.className}:${mark.textContent}`);
  const lineFrom = (selector: string, from: string, to: string) => cy.interactive().find(selector).filter((i, line) => {
    const data = (line as unknown as { __data__: { source: { id: string }, target: { id: string } } }).__data__;
    return data.source.id === from && data.target.id === to;
  });
  // the wide band that takes an arrow's clicks, and the arrow drawn over it
  const arrow = (from: string, to: string) => lineFrom("line.edge-background", from, to);
  const drawnArrow = (from: string, to: string) => lineFrom("line.edge", from, to);

  it("lights a state chosen in the graph in Inspect, the table and the text", () => {
    start({ startingText: "the cat sat on the mat" });
    clickState("cat");
    inspectRow("cat").should("have.class", "highlight-selected")
      .find("button").should("have.attr", "aria-pressed", "true");
    inspectRow("the").should("not.have.class", "highlight-selected");
    tableRows().eq(1).should("have.class", "highlight-selected");
    tableRows().eq(0).should("not.have.class", "highlight-selected");
    marks().should("deep.equal", ["highlight-selected:cat"]);
    inspectTab("Transitions").click();
    inspectRow("the → cat").should("have.class", "highlight-in");
    inspectRow("cat → sat").should("have.class", "highlight-out");
    inspectRow("sat → on").should("not.have.class", "highlight-in").and("not.have.class", "highlight-out");
    loggedEvents().should("deep.include", ["InspectTabChosen", { tab: "transitions" }]);
  });

  it("chooses a state from an Inspect row, anywhere in it, and from a table row", () => {
    start({ startingText: "the cat sat" });
    inspectRow("the").find("td").eq(1).click();
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "the", source: "inspect" }]);
    row(3).focus();
    stateEllipse("sat").should("have.attr", "fill", selectedNodeColor);
    inspectRow("sat").should("have.class", "highlight-selected");
    loggedEvents().should("deep.include", ["StateSelected", { state: "sat", source: "table" }]);
  });

  it("lights a transition chosen from Inspect and from the graph's arrow", () => {
    start({ startingText: "the cat sat on the mat" });
    inspectTab("Transitions").click();
    inspectRow("the → cat").click();
    inspectRow("the → cat").should("have.class", "highlight-chosen")
      .find("button").should("have.attr", "aria-pressed", "true");
    loggedEvents().should("deep.include", ["TransitionSelected", { from: "the", to: "cat", source: "inspect" }]);
    tableRows().eq(0).should("have.class", "highlight-selected");
    tableRows().eq(1).should("have.class", "highlight-selected");
    tableRows().eq(4).should("not.have.class", "highlight-selected");
    marks().should("deep.equal", ["highlight-selected:the", "highlight-selected:cat"]);
    inspectTab("States").click();
    inspectRow("the").should("have.class", "highlight-selected");
    inspectRow("cat").should("have.class", "highlight-selected");
    drawnArrow("the", "cat").should("have.attr", "stroke", outgoingArrowColor).and("have.css", "opacity", "1");
    drawnArrow("sat", "on").should("have.css", "opacity", "0.35");
    stateEllipse("the").should("have.css", "opacity", "1");
    stateEllipse("cat").should("have.css", "opacity", "1");
    stateEllipse("sat").should("have.css", "opacity", "0.35");

    pastDoubleClick();
    // the arrows' wide click bands overlap
    arrow("sat", "on").trigger("click", { force: true });
    loggedEvents().should("deep.include", ["TransitionSelected", { from: "sat", to: "on", source: "graph" }]);
    inspectRow("sat").should("have.class", "highlight-selected");
    marks().should("deep.equal", ["highlight-selected:sat", "highlight-selected:on"]);
  });

  it("disables Clear highlight while a sequence is generated", () => {
    start({ startingText: "a b c a b c a b c" });
    clickState("a");
    cy.interactive().find(".clear-highlight").should("be.enabled");
    playButton().click();
    cy.interactive().find(".clear-highlight").should("be.disabled");
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".clear-highlight").should("be.enabled");
  });

  it("lights an output in pink", () => {
    start({ startingText: "a b a b" });
    playButton().click();
    // the button reads Pause while the sequence plays
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence-output .sequence").should("have.length", 1).click();
    loggedEvents().should(events => expect(events.map(([action]) => action)).to.include("OutputSelected"));
    tableRows().eq(0).should("have.class", "highlight-output");
    cy.interactive().find(".inspect-pane tbody tr.highlight-output").should("have.length.at.least", 1);
    cy.interactive().find(".text-input .backdrop mark.highlight-output").should("have.length.at.least", 1);
    stateEllipse("a").should("have.attr", "fill", animatedNodeColor);
    stateEllipse("b").should("have.attr", "fill", animatedNodeColor);
    drawnArrow("a", "b").should("have.attr", "stroke", animatedArrowColor);
  });

  it("unchooses an Inspect row clicked again, and keeps a table row chosen while it is clicked again", () => {
    start({ startingText: "the cat sat" });
    inspectRow("cat").click();
    inspectRow("cat").should("have.class", "highlight-selected");
    inspectRow("cat").click();
    inspectRow("cat").should("not.have.class", "highlight-selected");
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "toggle" }]);
    row(2).click();
    row(2).click();
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
  });

  it("clears the selection on a click in the graph's background", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    inspectRow("cat").should("have.class", "highlight-selected");
    cy.interactive().find(".graph-pane .graph > svg").click(5, 5);
    inspectRow("cat").should("not.have.class", "highlight-selected");
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "background" }]);
  });

  it("clears a chosen state that a commit takes out of the graph, logging nothing", () => {
    start({ startingText: "the cat sat" });
    clickState("sat");
    stateEllipse("sat").should("have.attr", "fill", selectedNodeColor);
    textBox().type("{backspace}{backspace}{backspace}{backspace}").blur({ force: true });
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.interactive().find(".clear-highlight").should("not.exist");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
  });

  it("clears a chosen transition that a commit takes out of the graph, logging nothing", () => {
    start({ startingText: "the cat sat" });
    inspectTab("Transitions").click();
    inspectRow("cat → sat").click();
    inspectRow("cat → sat").should("have.class", "highlight-chosen");
    textBox().type("{backspace}{backspace}{backspace}{backspace}").blur({ force: true });
    stateLabels().should("deep.equal", ["cat", "the"]);
    cy.interactive().find(".clear-highlight").should("not.exist");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
  });

  it("keeps a chosen output through a commit that takes one of its states out", () => {
    start({ startingText: "a b a b" });
    playButton().click();
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence-output .sequence").should("have.length", 1).click();
    tableRows().eq(0).should("have.class", "highlight-output");
    textBox().type(" c").blur({ force: true });
    stateLabels().should("deep.equal", ["a", "b", "c"]);
    textBox().clear().type("a c ").blur({ force: true });
    stateLabels().should("deep.equal", ["a", "c"]);
    cy.interactive().find(".clear-highlight").should("exist");
    tableRows().eq(0).should("have.class", "highlight-output");
  });

  it("brings a lit Inspect row scrolled above the view out from under the table's header", () => {
    start({ startingText: Array.from({ length: 40 }, (_, i) => `s${String(i).padStart(2, "0")}`).join(" ") });
    cy.interactive().find(".inspect-panel").scrollTo("bottom");
    clickState("s00");
    cy.interactive().find(".inspect-panel").should(panel => {
      // the header cells stick to the top, while the thead itself scrolls away
      const head = panel[0].querySelector("th")!.getBoundingClientRect();
      const lit = panel[0].querySelector("tbody tr.highlight-selected")!.getBoundingClientRect();
      expect(lit.top).to.be.at.least(head.bottom - 1);
    });
  });

  it("scrolls the other panes to the first lit row or word, and not the pane the choice was made in", () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    start({ startingText: [...words, "end"].join(" ") });
    cy.interactive().find(".input-table-rows").scrollTo("bottom");
    row(61).focus();
    stateEllipse("end").should("have.attr", "fill", selectedNodeColor);
    textBox().should(box => expect(box[0].scrollTop).to.equal(0));
    cy.interactive().find(".inspect-panel").should(panel => {
      const lit = panel[0].querySelector("tbody tr.highlight-selected")!.getBoundingClientRect();
      const view = panel[0].getBoundingClientRect();
      expect(lit.top).to.be.at.least(view.top);
      expect(lit.bottom).to.be.at.most(view.bottom + 1);
    });
    cy.interactive().find(".input-table-rows").scrollTo("top");
    textBox().scrollTo("top");
    inspectRow("w59").click();
    inspectRow("w59").should("have.class", "highlight-selected");
    cy.interactive().find(".input-table-rows").should(rows => expect(rows[0].scrollTop).to.be.greaterThan(0));
    textBox().should(box => expect(box[0].scrollTop).to.be.greaterThan(0));
  });
});

describe("the workspace's Inspect pane", () => {
  const header = (label: string) => cy.interactive().find(".inspect-pane th").filter((i, th) =>
    th.textContent!.startsWith(label));
  const firstColumn = () => cy.interactive().find(".inspect-pane tbody tr")
    .invoke("toArray").invoke("map", (tr: HTMLTableRowElement) => tr.cells[0].textContent);

  it("starts alphabetical and sorts by a header, ascending then descending", () => {
    // three orders that all differ
    start({ startingText: "a a b c c c" });
    firstColumn().should("deep.equal", ["a", "b", "c"]);
    header("State").should("have.attr", "aria-sort", "ascending");
    header("Count").should("have.attr", "aria-sort", "none").find("button").click();
    header("Count").should("have.attr", "aria-sort", "ascending");
    header("State").should("have.attr", "aria-sort", "none");
    firstColumn().should("deep.equal", ["b", "a", "c"]);
    header("Count").find("button").click();
    header("Count").should("have.attr", "aria-sort", "descending");
    firstColumn().should("deep.equal", ["c", "a", "b"]);
    loggedEvents()
      .should("deep.include", ["InspectSorted", { tab: "states", column: "count", direction: "descending" }]);
  });

  it("says there are no states with no input", () => {
    start();
    cy.interactive().find(".inspect-pane").should("contain.text", "There are no states yet.");
  });

  it("says there are no transitions on a Transitions tab with states and none", () => {
    start({ startingText: "the" });
    inspectTab("Transitions").click();
    cy.interactive().find(".inspect-empty").should("have.text", "There are no transitions yet.");
  });

  it("follows each commit", () => {
    start({ startingText: "the cat" });
    firstColumn().should("deep.equal", ["cat", "the"]);
    textBox().type(" sat ");
    firstColumn().should("deep.equal", ["cat", "sat", "the"]);
  });

  it("keeps its tab and sort while collapsed", () => {
    start({ startingText: "the cat sat the" });
    inspectTab("Transitions").click();
    header("Count").find("button").click();
    cy.interactive().find("button[aria-label='Collapse Inspect']").click();
    cy.interactive().find("button[aria-label='Expand Inspect']").click();
    inspectTab("Transitions").should("have.attr", "aria-selected", "true");
    header("Count").should("have.attr", "aria-sort", "ascending");
  });

  it("opens the chosen tab into its panel, with no line under it", () => {
    start({ startingText: "the cat" });
    inspectTab("States").should("have.css", "border-bottom-color", "rgb(255, 255, 255)").then(tab => {
      const list = tab[0].closest("[role='tablist']")!.getBoundingClientRect();
      expect(tab[0].getBoundingClientRect().bottom).to.be.closeTo(list.bottom, 0.5);
    });
    inspectTab("Transitions").should("not.have.css", "border-bottom-color", "rgb(255, 255, 255)");
  });

  it("moves between tabs with the arrow keys", () => {
    start({ startingText: "the cat" });
    inspectTab("States").focus();
    inspectTab("States").type("{rightArrow}");
    focused().should("have.text", "Transitions").and("have.attr", "aria-selected", "true");
  });

  [3, 30].forEach(states => {
    // Enter and Space choose a row by the browser's own button activation, which needs trusted key input
    it(`is one stop in the Tab order with ${states} states, and Down moves to the second row without choosing`, () => {
      start({ startingText: Array.from({ length: states }, (_, i) => `s${String(i).padStart(2, "0")}`).join(" ") });
      cy.interactive().find(".inspect-pane tbody tr").should("have.length", states);
      inspectTab("States").focus();
      pressTab();
      focused().should("contain.text", "State");
      pressTab();
      focused().should("contain.text", "Count");
      pressTab();
      focused().should("have.text", "s00");
      pressTab();
      focused().should(element => expect(element?.closest(".inspect-pane tbody")).to.equal(null));
      cy.interactive().find(".inspect-row-button").first().focus();
      cy.interactive().find(".inspect-row-button").first().type("{downArrow}");
      focused().should("have.text", "s01");
      // the keys' hint is read on the row Tab reaches, not on every row the arrows pass
      cy.interactive().find(".inspect-row-button[aria-describedby]").should("have.length", 1)
        .and("have.text", "s01");
      stateEllipse("s01").should("have.attr", "fill", "#fff");
      cy.interactive().find(".inspect-row-button").eq(1).click();
      stateEllipse("s01").should("have.attr", "fill", selectedNodeColor);
    });
  });
});

describe("the workspace's dividers", () => {
  const widthOf = (selector: string) => cy.interactive().find(selector).invoke("outerWidth");
  const height = (selector: string) => cy.interactive().find(selector).invoke("outerHeight");
  const resized = () => loggedEvents().invoke("filter", ([action]: [string]) => action === "PaneResized");

  it("moves space between Input and Graph, and stops Input at its minimum", () => {
    start({ startingText: "the cat sat" });
    // the frame's own scrollbar goes once it fits the workspace, which widens the row
    cy.frameFitsInteractive();
    widthOf(".input-pane").should("equal", 280);
    widthOf(".graph-pane").then(graph => {
      widthOf(".top-row").then(rowWidth => {
        dragDivider("Resize Input and Graph", 60, 0);
        widthOf(".input-pane").should("equal", 340);
        widthOf(".graph-pane").should("equal", graph! - 60);
        widthOf(".top-row").should("equal", rowWidth);
      });
    });
    resized().should("have.length", 1).its(0)
      .should("deep.equal", ["PaneResized", { divider: "input", sizes: { input: 340, inspect: 260, top: 315 } }]);
    dragDivider("Resize Input and Graph", -1000, 0);
    widthOf(".input-pane").should("equal", 160);
  });

  it("stops Inspect at its minimum", () => {
    start({ startingText: "the cat sat" });
    dragDivider("Resize Graph and Inspect", 1000, 0);
    widthOf(".inspect-pane").should("equal", 220);
  });

  it("moves space between the panes and the generator, keeping the reported height", () => {
    start({ startingText: "the cat sat" });
    cy.frameFitsInteractive();
    cy.get("iframe#interactive").invoke("height").then(frameHeight => {
      dragDivider("Resize the panes and the generator", 0, -100);
      height(".top-row").should("equal", 215);
      height(".generator-pane").should("equal", 335);
      cy.frameFitsInteractive();
      cy.get("iframe#interactive").invoke("height").should("equal", frameHeight);
    });
    dragDivider("Resize the panes and the generator", 0, -1000);
    height(".top-row").should("equal", 200);
  });

  it("moves a divider 10 px with the arrow keys, logging once when it loses focus", () => {
    start({ startingText: "the cat sat" });
    divider("Resize Input and Graph").focus();
    divider("Resize Input and Graph").type("{rightArrow}{rightArrow}");
    widthOf(".input-pane").should("equal", 300);
    divider("Resize Input and Graph").should("have.attr", "aria-valuenow", "300")
      .and("have.attr", "aria-valuemin", "160");
    resized().should("have.length", 0);
    divider("Resize Input and Graph").blur({ force: true });
    resized().should("have.length", 1);
  });

  it("moves the Graph/Inspect, row and split dividers 10 px with the arrow keys", () => {
    start({ startingText: "the cat sat" });
    divider("Resize Graph and Inspect").focus();
    divider("Resize Graph and Inspect").type("{rightArrow}");
    widthOf(".inspect-pane").should("equal", 250);
    divider("Resize the panes and the generator").focus();
    divider("Resize the panes and the generator").type("{upArrow}");
    height(".top-row").should("equal", 305);
    height(".input-text-part .text-input").then(before => {
      divider("Resize the text box and the table").focus();
      divider("Resize the text box and the table").type("{downArrow}");
      height(".input-text-part .text-input").should("be.closeTo", before! + 10, 1);
    });
    divider("Resize the text box and the table").blur({ force: true });
    resized().should("have.length", 3);
  });

  it("keeps the chosen widths, logging nothing, for a key that can't move a divider in a narrow row", () => {
    start({ startingText: "the cat sat" }, { width: 730 });
    cy.frameFitsInteractive();
    divider("Resize Input and Graph").should(band => {
      expect(band.attr("aria-valuenow")).to.equal(band.attr("aria-valuemax"));
    });
    divider("Resize Input and Graph").focus();
    divider("Resize Input and Graph").type("{rightArrow}");
    divider("Resize Input and Graph").blur({ force: true });
    cy.get("iframe#interactive").invoke("attr", "width", String(width));
    cy.frameFitsInteractive();
    widthOf(".input-pane").should("equal", 280);
    resized().should("have.length", 0);
  });

  it("moves the linked view's split between the text box and the table", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".linked-input").then(linked => {
      const body = linked[0].clientHeight - paneGap - 2 * panePadding;
      height(".input-text-part .text-input").should("be.closeTo", 0.4 * body, 1);
      height(".input-table-part .input-table").then(table => {
        dragDivider("Resize the text box and the table", 0, 50);
        height(".input-text-part .text-input").should("be.closeTo", 0.4 * body + 50, 1);
        height(".input-table-part .input-table").should("be.closeTo", table! - 50, 1);
      });
    });
    resized().should("have.length", 1).its(0).its(1).should("have.property", "divider", "inputSplit");
    // a press and release without a move
    divider("Resize the text box and the table").then(band => {
      const element = band[0];
      const win = element.ownerDocument.defaultView as Window & typeof globalThis;
      const box = element.getBoundingClientRect();
      ["pointerdown", "pointerup"].forEach(type => element.dispatchEvent(new win.PointerEvent(type, {
        clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, pointerId: 1, pointerType: "mouse",
        isPrimary: true, button: 0, bubbles: true, view: win,
      })));
      if (element.hasPointerCapture(1)) {
        element.releasePointerCapture(1);
      }
    });
    cy.wait(100);
    resized().should("have.length", 1);
    dragDivider("Resize the text box and the table", 0, -1000);
    height(".input-text-part .text-input").should("be.closeTo", 60, 1);
  });

  it("fits the graph after a drag while the view follows it, and not after the student zoomed", () => {
    start({ startingText: "the cat sat on the mat" });
    cy.interactive().find("button[title='Fit View']").click();
    afterFit();
    // a narrower graph pane fits the graph smaller
    rootTransform().then(before => {
      dragDivider("Resize Input and Graph", 200, 0);
      afterFit();
      rootTransform().should(after => expect(parseTransform(after).k).to.be.lessThan(parseTransform(before).k));
    });
    cy.interactive().find("button[title='Zoom In']").click();
    afterFit();
    rootTransform().then(zoomed => {
      dragDivider("Resize Input and Graph", -100, 0);
      afterFit();
      rootTransform().should("equal", zoomed);
    });
  });

  it("doesn't fit the graph again for a later change of its size after a key moved a divider", () => {
    start({ startingText: "the cat sat on the mat" });
    // a graph pane narrow enough that its width limits the fit, so a wider pane would fit the graph larger
    dragDivider("Resize Input and Graph", 1000, 0);
    afterFit();
    divider("Resize Input and Graph").focus();
    divider("Resize Input and Graph").type("{leftArrow}");
    afterFit();
    divider("Resize Input and Graph").blur({ force: true });
    resized().should("have.length", 2);
    afterFit();
    rootTransform().then(before => {
      cy.get("iframe#interactive").invoke("attr", "width", "1150");
      afterFit();
      rootTransform().should("equal", before);
    });
  });

  it("doesn't fit the graph again when the student zooms before the graph measures a drag's new size", () => {
    start({ startingText: "the cat sat on the mat" });
    dragDivider("Resize Input and Graph", 1000, 0);
    afterFit();
    cy.interactive().find("button[title='Zoom In']").then(zoomIn => {
      divider("Resize Input and Graph").then(band => {
        dragEvents(band[0], -200, 0);
        zoomIn[0].click();
      });
    });
    afterFit();
    rootTransform().then(zoomed => {
      cy.interactive().find("button[title='Fit View']").click();
      afterFit();
      rootTransform().should("not.equal", zoomed);
    });
  });

  it("fits the graph again when it measures the size a key drew just before the divider lost focus", () => {
    start({ startingText: "the cat sat on the mat" });
    dragDivider("Resize Input and Graph", 1000, 0);
    afterFit();
    divider("Resize Input and Graph").focus();
    widthOf(".input-pane").then(before => {
      divider("Resize Input and Graph").then(band => new Cypress.Promise<number>(resolve => {
        const element = band[0];
        const win = element.ownerDocument.defaultView as Window & typeof globalThis;
        element.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
        // React draws the move in a microtask, and the graph measures its new size only in a later frame
        win.queueMicrotask(() => {
          const drawn = element.ownerDocument.querySelector<HTMLElement>(".input-pane")!.offsetWidth;
          element.blur();
          resolve(drawn);
        });
      })).should("equal", before! - 10);
    });
    resized().should("have.length", 2);
    afterFit();
    rootTransform().then(fitted => {
      cy.interactive().find("button[title='Fit View']").click();
      afterFit();
      rootTransform().should("equal", fitted);
    });
  });

  it("keeps the split the student chose, logging nothing, for a key that can't move the split divider", () => {
    start({ startingText: "the cat" });
    dragDivider("Resize the panes and the generator", 0, -1000);
    cy.interactive().find(".top-row").invoke("outerHeight").should("equal", minPaneSizes.top);
    divider("Resize the text box and the table").focus();
    divider("Resize the text box and the table").type("{downArrow}");
    divider("Resize the text box and the table").blur({ force: true });
    dragDivider("Resize the panes and the generator", 0, 1000);
    cy.interactive().find(".top-row").invoke("outerHeight").should("equal", defaultPaneSizes.top);
    cy.interactive().find(".linked-input").should(linked => {
      const body = linked[0].clientHeight - paneGap - 2 * panePadding;
      const text = linked[0].querySelector(".text-input")!.getBoundingClientRect().height;
      expect(text).to.be.closeTo(0.4 * body, 1);
    });
    loggedEvents().should(events => expect(events.filter(([action, data]) =>
      action === "PaneResized" && (data as { divider: string }).divider === "inputSplit")).to.have.length(0));
  });

  it("joins only open neighbors", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("button[aria-label='Collapse Inspect']").click();
    divider("Resize Input and Graph").should("exist");
    divider("Resize Graph and Inspect").should("not.exist");
  });

  [
    { name: "collapsed", options: {}, collapse: true },
    // Draw mode always has the graph, so it is Data mode alone
    { name: "turned off", options: { panes: { graph: { available: false } }, modes: { useData: true, draw: false } },
      collapse: false },
  ].forEach(({ name, options, collapse }) => {
    it(`shares the row between Input and Inspect in proportion with the Graph pane ${name}`, () => {
      start({ startingText: "the cat sat", ...options });
      if (collapse) {
        cy.interactive().find("button[aria-label='Collapse Graph']").click();
      }
      cy.interactive().find(".top-row").then(topRow => {
        cy.interactive().find(".inspect-pane").should(inspect =>
          expect(inspect[0].getBoundingClientRect().right).to.be.closeTo(topRow[0].getBoundingClientRect().right, 1));
      });
      cy.interactive().find(".input-pane").then(input => cy.interactive().find(".inspect-pane").then(inspect => {
        const together = input[0].getBoundingClientRect().width + inspect[0].getBoundingClientRect().width;
        expect(input[0].getBoundingClientRect().width).to.be.closeTo(together * 280 / 540, 2);
      }));
      divider("Resize Input and Graph").should("not.exist");
    });
  });

  it("puts the generator first with Input, Graph and Inspect turned off", () => {
    start({ panes: { input: { available: false }, graph: { available: false }, inspect: { available: false } },
      modes: { useData: true, draw: false }, startingText: "a b" });
    cy.interactive().find(".top-row").should("not.exist");
    cy.interactive().find(".markov-workspace > section").first().should("have.class", "generator-pane");
    divider("Resize the panes and the generator").should("not.exist");
  });

  const toolbarInsideGraphPane = (columns: number) =>
    cy.interactive().find(".graph-pane .toolbar button").should(buttons => {
      expect(buttons).to.have.length(5);
      const lefts = new Set([...buttons].map(button => Math.round(button.getBoundingClientRect().left)));
      expect(lefts.size).to.equal(columns);
      const box = buttons[0].closest(".pane-body")!.getBoundingClientRect();
      [...buttons].forEach(button => {
        const b = button.getBoundingClientRect();
        expect(b.top).to.be.at.least(box.top);
        expect(b.bottom).to.be.at.most(box.bottom);
        expect(b.left).to.be.at.least(box.left);
        expect(b.right).to.be.at.most(box.right);
      });
    });

  it("puts the toolbar in two columns inside the Graph pane in a 200 px row", () => {
    start({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, -1000);
    height(".top-row").should("equal", 200);
    toolbarInsideGraphPane(2);
  });

  it("keeps the toolbar inside the Graph pane just below the row height that fits one column", () => {
    start({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, -100);
    height(".top-row").should("equal", 215);
    toolbarInsideGraphPane(2);
    dragDivider("Resize the panes and the generator", 0, 7);
    height(".top-row").should("equal", 222);
    toolbarInsideGraphPane(1);
  });

  it("zooms the graph with the toolbar's zoom buttons", () => {
    start({ startingText: "the cat sat" });
    afterFit();
    rootTransform().then(before => {
      cy.interactive().find("button[title='Zoom In']").click();
      rootTransform().should(after => expect(parseTransform(after).k).to.be.greaterThan(parseTransform(before).k));
    });
    rootTransform().then(before => {
      cy.interactive().find("button[title='Zoom Out']").click();
      rootTransform().should(after => expect(parseTransform(after).k).to.be.lessThan(parseTransform(before).k));
    });
  });

  it("fits the generator's default controls at its minimum, and scrolls them with the other delimiter", () => {
    start({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, 1000);
    height(".generator-pane").should("equal", minPaneSizes.generator);
    cy.interactive().find(".generator-controls").should(controls =>
      expect(controls[0].scrollHeight).to.be.at.most(controls[0].clientHeight));
    cy.interactive().find(".generator-controls select").last().select("other");
    cy.interactive().find(".generator-controls").should(controls => {
      expect(controls[0].scrollHeight).to.be.greaterThan(controls[0].clientHeight);
      expect(controls.css("overflow-y")).to.equal("auto");
    });
  });

  it("pads and colors the generator's contents as the other panes', and centers the panes' toggles", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".input-pane-content").then(input => {
      cy.interactive().find(".generator-pane-content")
        .should("have.css", "padding-top", input.css("padding-top"))
        .and("have.css", "padding-bottom", input.css("padding-bottom"))
        .and("have.css", "background-color", "rgba(0, 0, 0, 0)");
    });
    cy.interactive().find(".pane-toggle").each(button => {
      const box = button[0].getBoundingClientRect();
      const icon = button[0].querySelector("svg")!.getBoundingClientRect();
      expect(icon.left + icon.width / 2).to.be.closeTo(box.left + box.width / 2, 0.5);
      expect(icon.top + icon.height / 2).to.be.closeTo(box.top + box.height / 2, 0.5);
    });
  });

  it("centers the column dividers on their gaps, and keeps the row divider off the generator", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".top-row").should(topRow => {
      const panes = [...topRow[0].querySelectorAll(":scope > .pane")].map(pane => pane.getBoundingClientRect());
      const bands = [...topRow[0].querySelectorAll(".divider.vertical")].map(band => band.getBoundingClientRect());
      expect(bands).to.have.length(2);
      const toggles = [...topRow[0].querySelectorAll(":scope > .pane .pane-toggle")]
        .map(toggle => toggle.getBoundingClientRect());
      bands.forEach((band, i) => {
        expect(band.left + band.width / 2).to.be.closeTo((panes[i].right + panes[i + 1].left) / 2, 0.5);
        expect(band.left).to.be.at.least(toggles[i].right);
      });
      const rows = topRow[0].querySelector(":scope > .divider.horizontal")!.getBoundingClientRect();
      const generator = topRow[0].ownerDocument.querySelector(".generator-pane")!.getBoundingClientRect();
      expect(rows.bottom).to.be.closeTo(generator.top, 0.5);
      expect(rows.top).to.be.closeTo(topRow[0].getBoundingClientRect().bottom - panePadding, 0.5);
    });
  });

  it("stacks the panes below 700 px, with no dividers and no inline widths", () => {
    cy.startInteractive({ mode: "runtime", width: 690, authoredState: { startingText: "the cat sat" } });
    cy.interactive().find(".markov-workspace").should("have.class", "stacked");
    cy.interactive().find("[role='separator']").not("[aria-label='Resize the text box and the table']")
      .should("not.exist");
    cy.interactive().find(".top-row .pane").each(pane => expect(pane[0].style.flex).to.equal(""));
    cy.interactive().find("button[aria-label='Collapse Inspect']").click();
    cy.interactive().find(".inspect-pane").invoke("outerHeight").should("equal", paneHeader + 2 * paneBorder);
  });

  it("draws the stacked panes at the starting row height whatever row height the student chose", () => {
    start({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, -1000);
    height(".generator-pane").should("equal", workspaceHeight - minPaneSizes.top);
    cy.get("iframe#interactive").invoke("attr", "width", "690");
    cy.interactive().find(".markov-workspace").should("have.class", "stacked");
    height(".generator-pane").should("equal", minPaneSizes.generator);
  });
});

describe("the workspace's Case sensitive switch", () => {
  const caseSwitch = () => cy.interactive().find(".setting-switch [role='switch']");
  const states = () => cy.interactive().find(".inspect-pane tbody tr").invoke("toArray")
    .invoke("map", (tr: HTMLTableRowElement) => [tr.cells[0].textContent, tr.cells[1].textContent]) as
    unknown as Cypress.Chainable<string[][]>;
  const tableValues = () => cy.interactive().find(".input-table-rows tbody input")
    .invoke("toArray").invoke("map", (input: HTMLInputElement) => input.value);

  it("reads the input again when switched, leaving the text and the table as typed", () => {
    start({ startingText: "The cat. the cat" });
    states().should(rows => {
      expect(rows).to.deep.include(["the", "2"]);
      expect(rows.map(([state]) => state)).not.to.include("The");
    });
    caseSwitch().should("have.attr", "aria-checked", "false");
    cy.interactive().find(".input-pane .setting-switch").should("contain.text", "No");
    tableValues().then(before => {
      caseSwitch().click();
      caseSwitch().should("have.attr", "aria-checked", "true");
      cy.interactive().find(".input-pane .setting-switch").should("contain.text", "Yes");
      states().should(rows => {
        expect(rows).to.deep.include(["The", "1"]);
        expect(rows).to.deep.include(["the", "1"]);
      });
      textBox().should("have.value", "The cat. the cat");
      tableValues().should("deep.equal", before);
    });
    cy.interactive().find(".inspect-pane tbody tr").its("length").then(count => {
      loggedEvents().should("deep.include", ["CaseSensitivityChanged", { caseSensitive: true, states: count }]);
    });
    commits().should("have.length", 0);
  });

  it("starts at the author's Yes, and switching to No makes \"The\" and \"the\" one state", () => {
    start({ startingText: "The cat. the cat", capitalization: "asTyped" });
    caseSwitch().should("have.attr", "aria-checked", "true");
    states().should(rows => {
      expect(rows).to.deep.include(["The", "1"]);
      expect(rows).to.deep.include(["the", "1"]);
    });
    caseSwitch().click();
    states().should(rows => {
      expect(rows).to.deep.include(["the", "2"]);
      expect(rows.map(([state]) => state)).not.to.include("The");
    });
    loggedEvents().should(events => expect(events.some(([action, data]) =>
      action === "CaseSensitivityChanged" && (data as { caseSensitive: boolean }).caseSensitive === false))
      .to.equal(true));
  });

  it("hides the switch with the collapsed Input pane", () => {
    start({ startingText: "the cat" });
    cy.interactive().find("button[aria-label='Collapse Input']").click();
    caseSwitch().should("not.be.visible");
  });

  it("can't be used while a sequence is generated", () => {
    start({ startingText: "a b c a b c a b c" });
    playButton().click();
    caseSwitch().should("be.disabled");
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    caseSwitch().should("be.enabled");
  });

  it("is a read-only label in the workspace's own row when the author hides it", () => {
    start({ startingText: "the cat", showCaseSwitch: false });
    cy.interactive().find(".controls-row .setting-label").should("have.text", "Case sensitive: No");
    caseSwitch().should("not.exist");
    start({ startingText: "the cat", showCaseSwitch: false, capitalization: "asTyped" });
    cy.interactive().find(".controls-row .setting-label").should("have.text", "Case sensitive: Yes");
  });

  it("sits in the workspace's own row with no Input pane", () => {
    start({ startingText: "the cat", panes: { input: { available: false } } });
    cy.interactive().find(".controls-row .setting-switch [role='switch']").should("exist");
  });

  it("wraps its name to stay inside an Input pane at its minimum width", () => {
    start({ startingText: "the cat" });
    dragDivider("Resize Input and Graph", -1000, 0);
    cy.interactive().find(".input-pane").invoke("outerWidth").should("equal", minPaneSizes.input);
    cy.interactive().find(".input-pane .pane-body").then(body => {
      const box = body[0].getBoundingClientRect();
      cy.interactive().find(".input-pane .setting-switch").should(setting => {
        expect(setting[0].getBoundingClientRect().right).to.be.at.most(box.right);
        const name = setting[0].querySelector(".setting-switch-name")!;
        expect(name.scrollWidth).to.be.at.most(name.clientWidth);
      });
    });
  });

  it("keeps the text box and the table each half the room the switch leaves at the smallest Input pane", () => {
    start({ startingText: "the cat" });
    dragDivider("Resize the panes and the generator", 0, -1000);
    cy.interactive().find(".top-row").invoke("outerHeight").should("equal", minPaneSizes.top);
    dragDivider("Resize Input and Graph", -1000, 0);
    cy.interactive().find(".input-pane").invoke("outerWidth").should("equal", minPaneSizes.input);
    [-1000, 1000].forEach(dy => {
      dragDivider("Resize the text box and the table", 0, dy);
      cy.interactive().find(".linked-input").should(linked => {
        const body = linked[0].clientHeight - paneGap - 2 * panePadding;
        expect(body).to.be.below(2 * minInputPart);
        const text = linked[0].querySelector(".text-input")!.getBoundingClientRect().height;
        const table = linked[0].querySelector(".input-table")!.getBoundingClientRect().height;
        expect(text).to.be.closeTo(body / 2, 1);
        expect(table).to.be.closeTo(body / 2, 1);
      });
    });
    divider("Resize the text box and the table").should(band =>
      expect(Number(band.attr("aria-valuemin"))).to.be.at.most(Number(band.attr("aria-valuemax"))));
  });

  it("lets the workspace's own row wrap at 700 px", () => {
    start({ startingText: "the cat sat", panes: { input: { available: false } } }, { width: 700 });
    cy.interactive().find(".markov-workspace").should("not.have.class", "stacked");
    clickState("cat");
    cy.interactive().find(".clear-highlight").should("exist");
    cy.interactive().find(".controls-row").should("have.css", "flex-wrap", "wrap");
  });
});
