import {
  defaultPaneSizes, emptyRowSpare, minInputPart, minPaneSizes, paneBorder, paneGap, paneHeader, panePadding, stackBelow,
  toolbarHeight, workspaceHeight
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
const dataOnly = { useData: true, draw: false };
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState: { modes: dataOnly, ...authoredState }, ...options });
// the workspace's own row holding a table button, for the tests whose heights are measured with the row there
const startWithRow = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  start({ buttons: { downloadTables: { available: true } }, ...authoredState }, options);
const textBox = () => cy.interactive().find("textarea[aria-label='Your text']");
// the workspace's fits animate over 250 ms
const afterFit = () => cy.wait(400);
const row = (n: number) => cy.interactive().find(`input[aria-label='Row ${n}']`);
const inspectRow = (label: string) => cy.interactive().find(".inspect-pane tbody tr")
  .filter((i, tr) => (tr as HTMLTableRowElement).cells[0].textContent === label);
const inspectTab = (label: string) => cy.interactive().find(".inspect-tab").contains(label);
const newRow = () => cy.interactive().find("input[aria-label='New row']");
const lastSavedInput = () => cy.interactiveMessages("interactiveState", { timeout: 5000 })
  .should("not.be.empty").invoke("at", -1).its("input");
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
const maxLength = () => cy.interactive().find(".generator-pane input[type='number']");
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

  it("doesn't redraw the graph for typing that hasn't committed, or for choosing a state", () => {
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
    cy.interactive().find(".nodeModal").should("contain.text", "the")
      .and("contain.text", "Transition Probabilities").and("contain.text", "100%");
    loggedEvents().should("deep.include", ["StateDialogOpened", { state: "the", mode: "useData" }]);
    cy.interactive().type("{esc}");
    cy.interactive().find(".nodeModal").should("not.exist");
    // Escape closes the dialog and keeps the state chosen
    cy.interactive().find(".clear-highlight").should("exist");
  });

  it("asks for words while the graph is empty", () => {
    start();
    cy.interactive().find(".graph-empty").should("have.text", "Type some words in the Input pane to build the graph.");
    textBox().type("the cat").blur({ force: true });
    cy.interactive().find(".graph-empty").should("not.exist");
  });

  it("asks for words in the table in the table-only view", () => {
    start({ inputView: "table" });
    cy.interactive().find(".graph-empty")
      .should("have.text", "Type some words in the Input pane's table to build the graph.");
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
    lastSavedInput().should("deep.equal", { text: "the cat sat" });
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
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "escape", mode: "useData" }]);

    clickState("cat");
    cy.interactive().find(".clear-highlight").click();
    stateEllipse("cat").should("have.attr", "fill", "#fff");
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "button", mode: "useData" }]);
  });

  it("keeps focus in the controls row when the focused Clear highlight button goes", () => {
    start({ startingText: "the cat sat", modes: { useData: true, draw: true } });
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

    // the chosen tab is the Inspect pane's own state, which only a pane body kept mounted still has
    inspectTab("Transitions").click();
    cy.interactive().find("button[aria-label='Collapse Inspect']").click();
    cy.interactive().find("button[aria-label='Expand Inspect']").click();
    inspectTab("Transitions").should("have.attr", "aria-selected", "true");

    [1, 2, 3].forEach(() => cy.interactive().find("button[title='Zoom In']").click());
    rootTransform().then(zoomed => {
      cy.interactive().find("button[aria-label='Collapse Graph']").click();
      cy.interactive().find(".graph-pane .graph > svg")
        .should(svg => expect(svg[0].getBoundingClientRect().width).to.equal(0));
      cy.interactive().find("button[aria-label='Expand Graph']").click();
      afterFit();
      rootTransform().should("not.equal", zoomed);
    });
    loggedEvents().should("deep.include", ["PaneClosed", { pane: "graph", mode: "useData" }])
      .and("deep.include", ["PaneOpened", { pane: "graph", mode: "useData" }]);
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

  // fewer new states than old, so the graph adds them rather than being laid out again, which would follow it again
  it("stops following once the student zooms, and follows again after Fit", () => {
    cy.interactive().find("button[title='Zoom In']").click();
    rootTransform().then(zoomed => {
      typeWords(" and a dog");
      cy.interactive().find("g.node").should("have.length", 8);
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
      cy.interactive().find("g.node").should("have.length", 8);
      rootTransform().should("equal", zoomed);
    });
  });

  it("stops following after a pan", () => {
    rootTransform().then(before => {
      cy.interactive().find(".graph-pane .graph > svg").then(svg => {
        const win = svg[0].ownerDocument.defaultView as Window & typeof globalThis;
        const box = svg[0].getBoundingClientRect();
        const mouse = (type: string, target: EventTarget, dx: number) => target.dispatchEvent(new win.MouseEvent(type, {
          clientX: box.x + 5 + dx, clientY: box.y + 5, button: 0, bubbles: true, cancelable: true, view: win
        }));
        mouse("mousedown", svg[0], 0);
        mouse("mousemove", win, 30);
        mouse("mouseup", win, 30);
      });
      rootTransform().should("not.equal", before);
    });
    rootTransform().then(panned => {
      typeWords(" and a dog");
      cy.interactive().find("g.node").should("have.length", 8);
      rootTransform().should("equal", panned);
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
      cy.interactive().find("g.node").should("have.length", 8);
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
      ["InputCommitted", { view: "text", how: "separator", tokens: 2, states: 2, mode: "useData" }]);
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
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "insert", tokens: 3, states: 3, mode: "useData" }]);
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
    // read once, since a retry would pass for a commit seconds late
    cy.interactive().then(body => expect(body.find("g.node text").toArray().map(text => text.textContent).sort())
      .to.deep.equal(["ca", "the"]));
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "pause", tokens: 2, states: 2, mode: "useData" }]);
  });

  it("commits a cut and a paste at once", () => {
    start({ startingText: "the cat" });
    stateLabels().should("deep.equal", ["cat", "the"]);
    textBox().type("{selectall}{backspace}");
    cy.interactive().find(".graph-empty").should("exist");
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "remove", tokens: 0, states: 0, mode: "useData" }]);
    paste("a dog");
    stateLabels().should("deep.equal", ["a", "dog"]);
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "insert", tokens: 2, states: 2, mode: "useData" }]);
  });

  it("commits on leaving the text box after the press that left it, so the press's click lands", () => {
    start();
    textBox().type("the cat sat");
    stateLabels().should("deep.equal", ["cat", "the"]);
    pressState("cat");
    stateEllipse("cat").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "cat", source: "graph", mode: "useData" }]);
    stateLabels().should("deep.equal", ["cat", "sat", "the"]);
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "text", how: "blur", tokens: 3, states: 3, mode: "useData" }]);
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
      pressEvents(body[0], ["pointerdown", "pointercancel"], "touch")
        .then(() => pressEvents(body[0], ["pointerdown", "mousedown", "pointercancel"], "mouse")));
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
      pressEvents(ellipse[0], ["pointerdown", "mousedown", "focus", 1300, "pointerup", "mouseup", "click"], "mouse"));
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
        Cypress._.isEqual(data, { view: "text", how: "blur", tokens: 3, states: 3, mode: "useData" }));
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
    lastSavedInput().should("deep.equal", { text: "the cat" });
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
    loggedEvents().should("deep.include",
      ["InputCommitted", { view: "table", how: "row", tokens: 3, states: 3, mode: "useData" }]);
    row(2).clear().blur({ force: true });
    textBox().should("have.value", "the\n\nsat");
  });

  it("adds a row below on Enter, and at the end, and deletes rows", () => {
    start({ startingText: "the cat sat" });
    row(1).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 2");
    row(2).type("big").blur({ force: true });
    textBox().should("have.value", "the big cat sat");
    loggedEvents().should("deep.include", ["TableRowAdded", { mode: "useData" }]);
    newRow().type("down").blur({ force: true });
    textBox().should("have.value", "the big cat sat down");
    cy.interactive().find("button[aria-label='Delete row 2']").click();
    textBox().should("have.value", "the cat sat down");
    loggedEvents().should("deep.include", ["TableRowDeleted", { mode: "useData" }]);
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

  it("deletes a row pressed after letters were added to the front of its word", () => {
    start({ startingText: "the cat sat" });
    row(2).focus().type("{moveToStart}s");
    cy.interactive().find("button[aria-label='Delete row 2']").then(button => mousePress(button[0]));
    textBox().should("have.value", "the sat");
    loggedEvents().should("deep.include", ["TableRowDeleted", { mode: "useData" }]);
  });

  it("deletes only the row pressed when the words after it repeat its word", () => {
    start({ startingText: "the the the" });
    row(2).focus().type("{moveToStart}s");
    cy.interactive().find("button[aria-label='Delete row 2']").then(button => mousePress(button[0]));
    textBox().should("have.value", "the the");
  });

  it("keeps a row left unedited for a press on its delete button that ended without a click", () => {
    start({ startingText: "the cat sat" });
    // a press lands only once the frame is tall enough to show the button
    cy.frameFitsInteractive();
    row(2).focus();
    cy.interactive().find("button[aria-label='Delete row 2']").then(button =>
      pressEvents(button[0], ["pointerdown", "mousedown", "focus", 40, "pointerup", "mouseup"], "mouse"));
    row(3).clear().type("ran").blur({ force: true });
    textBox().should("have.value", "the cat ran");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("TableRowDeleted"));
  });

  it("keeps the word below a blank row pressed when emptying the first row took that blank row too", () => {
    start({ startingText: "the\n\ncat sat" });
    row(1).clear();
    cy.interactive().find("button[aria-label='Delete row 2']").then(button => mousePress(button[0]));
    textBox().should("have.value", "cat sat");
  });

  it("deletes the row pressed when an emptied row above it goes", () => {
    start({ startingText: "the cat sat" });
    row(1).clear();
    cy.interactive().find("button[aria-label='Delete row 3']").then(button => mousePress(button[0]));
    row(1).should("have.value", "cat");
    cy.interactive().find("input[aria-label='Row 2']").should("not.exist");
  });

  it("keeps the row under a secondary-button press, committing the row left", () => {
    start({ startingText: "the cat sat" });
    row(1).clear().type("dog");
    cy.interactive().find("button[aria-label='Delete row 2']").then(button =>
      pressEvents(button[0], ["pointerdown", "mousedown", "focus", "contextmenu"], "mouse", 2));
    textBox().should("have.value", "dog cat sat");
    row(3).clear().type("ran").blur({ force: true });
    textBox().should("have.value", "dog cat ran");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("TableRowDeleted"));
  });

  it("forgets a press on a delete button that ended without a click", () => {
    start({ startingText: "the cat sat" });
    // a press lands only once the frame is tall enough to show the button
    cy.frameFitsInteractive();
    cy.interactive().find("button[aria-label='Delete row 1']").then(button =>
      pressEvents(button[0], ["pointerdown", "mousedown", "focus", 40, "pointerup", "mouseup"], "mouse"));
    row(3).clear().type("ran").blur({ force: true });
    textBox().should("have.value", "the cat ran");
    loggedEvents().should(events => expect(events.map(([action]) => action)).not.to.include("TableRowDeleted"));
  });

  it("deletes the row pressed by itself when the limit refuses it with the edit of the row left", () => {
    const rest = `${" ".repeat(49994)}c`;
    // one switch, so the refusal's message leaves row 2 in view for the click
    start({ orderMatters: { startsOn: true, showSwitch: false } },
      { interactiveState: { version: 1, input: { text: `a bb${rest}` } } });
    row(1).clear().type("longword");
    cy.interactive().find("button[aria-label='Delete row 2']").then(button => mousePress(button[0]));
    textBox().invoke("val").should("equal", `a${rest}`);
    row(1).should("have.value", "a");
    row(2).should("have.value", "c");
    loggedEvents().should("deep.include", ["TableRowDeleted", { mode: "useData" }]);
  });

  it("deletes the row of a delete button activated from the keyboard, with no press", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("button[aria-label='Delete row 2']").focus();
    cy.interactive().find("button[aria-label='Delete row 2']").trigger("click");
    textBox().should("have.value", "the sat");
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

  it("opens Enter's row in the place of an emptied first row", () => {
    start({ startingText: "the cat sat" });
    row(1).clear().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 1").and("have.value", "");
    focused().should("have.attr", "tabindex", "0");
    row(2).should("have.value", "cat").and("have.attr", "tabindex", "-1");
    row(1).type("dog").blur({ force: true });
    textBox().should("have.value", "dog cat sat");
  });

  it("opens Enter's row in the place of an emptied last row", () => {
    start({ startingText: "the cat sat" });
    row(3).clear().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "");
    row(2).should("have.value", "cat");
    row(3).type("dog").blur({ force: true });
    textBox().should("have.value", "the cat dog");
  });

  it("opens Enter's row below the blank line an emptied row joins", () => {
    start({ startingText: "the\n\ncat sat" });
    row(3).clear().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "");
    row(4).should("have.value", "sat");
    row(3).type("dog").blur({ force: true });
    textBox().should("have.value", "the\n\ndog sat");
  });

  it("opens Enter's row below an emptied row that stays as a blank line", () => {
    start({ startingText: "the cat sat" });
    row(2).clear().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "");
    row(4).should("have.value", "sat");
  });

  it("opens Enter's row below a blank row", () => {
    start({ startingText: "the\n\ncat" });
    row(2).focus().type("{enter}");
    focused().should("have.attr", "aria-label", "Row 3").and("have.value", "");
    row(4).should("have.value", "cat");
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

  it("gives Tab only the current row's input and delete button", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".input-table input").should("have.length", 4);
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

  it("moves between rows with Up and Down, choosing each row's state", () => {
    start({ startingText: "the cat sat" });
    row(1).focus();
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "the", source: "table", mode: "useData" }]);
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
      ["SelectionCleared", { via: "table", mode: "useData" }]));
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

  it("says which rows go into and out of the chosen state, and underlines its words in the text", () => {
    start({ startingText: "the cat sat on the mat" });
    clickState("cat");
    cy.interactive().find(".text-input .backdrop mark").should("have.length", 1)
      .and("have.css", "box-shadow", "rgb(23, 121, 145) 0px -2px 0px 0px inset");
    inspectTab("Transitions").click();
    const description = (label: string) => inspectRow(label).find("button").then(button =>
      (button.attr("aria-describedby") ?? "").split(" ").filter(Boolean)
        .map(id => button[0].ownerDocument.getElementById(id)!.textContent));
    description("the → cat").should("include", "Into the chosen state");
    description("cat → sat").should("include", "Out of the chosen state");
    description("sat → on")
      .should("not.include", "Into the chosen state").and("not.include", "Out of the chosen state");
  });

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
    loggedEvents().should("deep.include", ["InspectTabChosen", { tab: "transitions", mode: "useData" }]);
  });

  it("chooses a state from an Inspect row, anywhere in it, and from a table row", () => {
    start({ startingText: "the cat sat" });
    inspectRow("the").find("td").eq(1).click();
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().should("deep.include", ["StateSelected", { state: "the", source: "inspect", mode: "useData" }]);
    row(3).focus();
    stateEllipse("sat").should("have.attr", "fill", selectedNodeColor);
    inspectRow("sat").should("have.class", "highlight-selected");
    loggedEvents().should("deep.include", ["StateSelected", { state: "sat", source: "table", mode: "useData" }]);
  });

  it("lights a transition chosen from Inspect and from the graph's arrow", () => {
    start({ startingText: "the cat sat on the mat" });
    inspectTab("Transitions").click();
    inspectRow("the → cat").click();
    inspectRow("the → cat").should("have.class", "highlight-chosen")
      .find("button").should("have.attr", "aria-pressed", "true");
    loggedEvents().should("deep.include",
      ["TransitionSelected", { from: "the", to: "cat", source: "inspect", mode: "useData" }]);
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
    loggedEvents().should("deep.include",
      ["TransitionSelected", { from: "sat", to: "on", source: "graph", mode: "useData" }]);
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
    cy.interactive().find(".text-input .backdrop mark.highlight-output").should("have.length.at.least", 1)
      .and("have.css", "box-shadow", "rgb(192, 0, 107) 0px -2px 0px 0px inset");
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
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "toggle", mode: "useData" }]);
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
    loggedEvents().should("deep.include", ["SelectionCleared", { via: "background", mode: "useData" }]);
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

  it("takes a chosen output's highlight away with Clear Output", () => {
    start({ startingText: "a b a b" });
    playButton().click();
    // the button reads Pause while the sequence plays
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence-output .sequence").should("have.length", 1).click();
    tableRows().eq(0).should("have.class", "highlight-output");
    cy.interactive().find(".clear-highlight").should("exist");
    cy.interactive().contains(".generator-pane button", "Clear Output").click();
    cy.interactive().find(".sequence-output .sequence").should("not.exist");
    cy.interactive().find(".clear-highlight").should("not.exist");
    tableRows().eq(0).should("not.have.class", "highlight-output");
    stateEllipse("a").should("have.attr", "fill", "#fff");
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
    cy.interactive().find(".inspect-panel").should(panel => {
      const lit = panel[0].querySelector("tbody tr.highlight-selected")!.getBoundingClientRect();
      const view = panel[0].getBoundingClientRect();
      expect(lit.top).to.be.at.least(view.top);
      expect(lit.bottom).to.be.at.most(view.bottom + 1);
    });
    cy.interactive().find(".input-table-rows").should(rows => expect(rows[0].scrollTop).to.be.greaterThan(0));
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
      .should("deep.include",
        ["InspectSorted", { tab: "states", column: "count", direction: "descending", mode: "useData" }]);
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

  // Enter and Space choose a row by the browser's own button activation, which needs trusted key input
  it("keeps its rows to one stop in the Tab order, and Down moves to the second row without choosing", () => {
    start({ startingText: "s00 s01 s02" });
    cy.interactive().find(".inspect-pane tbody tr").should("have.length", 3);
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

describe("the workspace's dividers", () => {
  const widthOf = (selector: string) => cy.interactive().find(selector).invoke("outerWidth");
  const height = (selector: string) => cy.interactive().find(selector).invoke("outerHeight");
  const resized = () => loggedEvents().invoke("filter", ([action]: [string]) => action === "PaneResized");

  it("ends a drag when the browser cancels its pointer, moving no further", () => {
    startWithRow({ startingText: "the cat sat" });
    divider("Resize Input and Graph").then(band => {
      const win = band[0].ownerDocument.defaultView as Window & typeof globalThis;
      const fire = (type: string, clientX: number) => band[0].dispatchEvent(new win.PointerEvent(type,
        { clientX, clientY: 100, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, bubbles: true }));
      fire("pointerdown", 300);
      fire("pointermove", 340);
      fire("pointercancel", 340);
      fire("pointermove", 400);
      if (band[0].hasPointerCapture(1)) {
        band[0].releasePointerCapture(1);
      }
    });
    resized().should("have.length", 1).its(0)
      .should("deep.equal",
        ["PaneResized", { divider: "input", sizes: { input: 320, inspect: 260, top: 315 }, mode: "useData" }]);
  });

  it("moves space between Input and Graph, and stops Input at its minimum", () => {
    startWithRow({ startingText: "the cat sat" });
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
      .should("deep.equal",
        ["PaneResized", { divider: "input", sizes: { input: 340, inspect: 260, top: 315 }, mode: "useData" }]);
    dragDivider("Resize Input and Graph", -1000, 0);
    widthOf(".input-pane").should("equal", 160);
  });

  it("stops Inspect at its minimum", () => {
    startWithRow({ startingText: "the cat sat" });
    dragDivider("Resize Graph and Inspect", 1000, 0);
    widthOf(".inspect-pane").should("equal", 220);
  });

  it("moves space between the panes and the generator, keeping the reported height", () => {
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" }, { width: 730 });
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
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat on the mat" });
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
    startWithRow({ startingText: "the cat sat on the mat" });
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
    startWithRow({ startingText: "the cat sat on the mat" });
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
    startWithRow({ startingText: "the cat sat on the mat" });
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
    startWithRow({ startingText: "the cat" });
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
    startWithRow({ startingText: "the cat sat" });
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
      startWithRow({ startingText: "the cat sat", ...options });
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

  describe("with the Sequence Generator collapsed", () => {
    const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
    const drawnHeight = (selector: string) => shown().find(selector).invoke("outerHeight");
    const workspaceBottom = () => cy.interactive().find(".markov-workspace").then(workspace =>
      workspace[0].getBoundingClientRect().height);
    const toggleGenerator = (action: string) =>
      shown().find(`button[aria-label='${action} Sequence Generator']`).click();

    (["Data", "Draw"] as const).forEach(mode => {
      it(`keeps the workspace's height in ${mode} mode, the row taking what the generator gave up`, () => {
        startWithRow({ startingText: "the cat sat", modes: { useData: true, draw: true } });
        if (mode === "Draw") {
          shown().find(".mode-switch label").contains("Draw").click();
        }
        workspaceBottom().then(opened => {
          toggleGenerator("Collapse");
          drawnHeight(".top-row").should("equal", workspaceHeight - paneHeader - 2 * paneBorder);
          workspaceBottom().should("equal", opened);
          cy.frameFitsInteractive();
          toggleGenerator("Expand");
          drawnHeight(".top-row").should("equal", defaultPaneSizes.top);
          workspaceBottom().should("equal", opened);
        });
      });
    });

    it("goes back to the row height the student chose when the generator reopens", () => {
      startWithRow({ startingText: "the cat sat" });
      dragDivider("Resize the panes and the generator", 0, -40);
      drawnHeight(".top-row").should("equal", defaultPaneSizes.top - 40);
      toggleGenerator("Collapse");
      drawnHeight(".top-row").should("be.greaterThan", defaultPaneSizes.top);
      toggleGenerator("Expand");
      drawnHeight(".top-row").should("equal", defaultPaneSizes.top - 40);
    });

    it("fits a followed graph to the taller row", () => {
      // a saved column, which the row's height limits
      const letters = "abcdefghijklmnopqrstuvwxyz".split("");
      const positions = letters.reduce<number[]>((all, _, i) => [...all, 0, i * 60], []);
      startWithRow({ startingText: letters.join(" ") }, {
        interactiveState: { version: 1, caseSensitive: false, useData: { positions } },
      });
      const scale = () => shown().find(".graph-pane g.root").invoke("attr", "transform")
        .then(transform => parseTransform(transform as unknown as string).k);
      shown().find(".graph-pane g.node").should("have.length", 26);
      cy.wait(500);
      scale().then(before => {
        toggleGenerator("Collapse");
        cy.wait(500);
        scale().should("be.greaterThan", before);
      });
    });

    it("opens a page saved with the generator collapsed at the full height", () => {
      cy.startInteractive({
        mode: "runtime", width: 1044, authoredState: { startingText: "the cat sat" },
        interactiveState: { version: 1, useData: { panes: { generator: false } } },
      });
      drawnHeight(".top-row").should("equal", workspaceHeight - paneHeader - 2 * paneBorder);
    });
  });

  it("puts the generator first with Input, Graph and Inspect turned off", () => {
    startWithRow({ panes: { input: { available: false }, graph: { available: false }, inspect: { available: false } },
      modes: { useData: true, draw: false }, startingText: "a b" });
    cy.interactive().find(".top-row").should("not.exist");
    cy.interactive().find(".workspace-body > section").first().should("have.class", "generator-pane");
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

  it("keeps the toolbar inside the Graph pane just below the row height that fits one column", () => {
    startWithRow({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, -100);
    height(".top-row").should("equal", 215);
    toolbarInsideGraphPane(2);
    dragDivider("Resize the panes and the generator", 0, 7);
    height(".top-row").should("equal", 222);
    toolbarInsideGraphPane(1);
  });

  it("zooms the graph with the toolbar's zoom buttons", () => {
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" });
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
    startWithRow({ startingText: "the cat sat" });
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
    cy.startInteractive({
      mode: "runtime", width: 690, authoredState: { modes: dataOnly, startingText: "the cat sat" }
    });
    cy.interactive().find(".markov-workspace").should("have.class", "stacked");
    cy.interactive().find("[role='separator']").not("[aria-label='Resize the text box and the table']")
      .should("not.exist");
    cy.interactive().find(".top-row .pane").each(pane => expect(pane[0].style.flex).to.equal(""));
    cy.interactive().find("button[aria-label='Collapse Inspect']").click();
    cy.interactive().find(".inspect-pane").invoke("outerHeight").should("equal", paneHeader + 2 * paneBorder);
  });

  it("draws the stacked panes at the starting row height whatever row height the student chose", () => {
    startWithRow({ startingText: "the cat sat" });
    dragDivider("Resize the panes and the generator", 0, -1000);
    height(".generator-pane").should("equal", workspaceHeight - minPaneSizes.top);
    cy.get("iframe#interactive").invoke("attr", "width", "690");
    cy.interactive().find(".markov-workspace").should("have.class", "stacked");
    height(".generator-pane").should("equal", minPaneSizes.generator);
    height(".graph-pane").should("equal", defaultPaneSizes.top);
  });
});

describe("the workspace's Case sensitive switch", () => {
  const caseSetting = () => cy.interactive().find(".setting-switch:contains('Case sensitive')");
  const caseSwitch = () => cy.interactive().find(".setting-switch:contains('Case sensitive') [role='switch']");
  const caseLabel = () => cy.interactive().find(".controls-row .setting-label").filter(":contains('Case sensitive')");

  it("clears a chosen state that the new rule takes out of the graph", () => {
    start({ startingText: "The cat" });
    clickState("the");
    cy.interactive().find(".clear-highlight").should("exist");
    caseSwitch().click();
    stateLabels().should("deep.equal", ["The", "cat"]);
    cy.interactive().find(".clear-highlight").should("not.exist");
  });

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
    caseSetting().should("contain.text", "No");
    tableValues().then(before => {
      caseSwitch().click();
      caseSwitch().should("have.attr", "aria-checked", "true");
      caseSetting().should("contain.text", "Yes");
      states().should(rows => {
        expect(rows).to.deep.include(["The", "1"]);
        expect(rows).to.deep.include(["the", "1"]);
      });
      textBox().should("have.value", "The cat. the cat");
      tableValues().should("deep.equal", before);
    });
    cy.interactive().find(".inspect-pane tbody tr").its("length").then(count => {
      loggedEvents().should("deep.include",
        ["CaseSensitivityChanged", { caseSensitive: true, states: count, mode: "useData" }]);
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
    caseLabel().should("have.text", "Case sensitive: No");
    caseSwitch().should("not.exist");
    start({ startingText: "the cat", showCaseSwitch: false, capitalization: "asTyped" });
    caseLabel().should("have.text", "Case sensitive: Yes");
  });

  it("sits in the workspace's own row with no Input pane", () => {
    start({ startingText: "the cat", panes: { input: { available: false } } });
    cy.interactive().find(".controls-row .setting-switch").filter(":contains('Case sensitive')").should("exist");
  });

  it("wraps its name to stay inside an Input pane at its minimum width", () => {
    start({ startingText: "the cat" });
    dragDivider("Resize Input and Graph", -1000, 0);
    cy.interactive().find(".input-pane").invoke("outerWidth").should("equal", minPaneSizes.input);
    cy.interactive().find(".input-pane .pane-body").then(body => {
      const box = body[0].getBoundingClientRect();
      caseSetting().should(setting => {
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

  [width, stackBelow, 560].forEach(frameWidth =>
    it(`leaves the panes' gap around its edges at ${frameWidth} px`, () => {
      start({ startingText: "the cat sat" }, { width: frameWidth });
      cy.interactive().find(".markov-workspace").should(workspace => {
        const outer = workspace[0].getBoundingClientRect();
        // the panes' row, as nothing is in the workspace's own row
        const controls = workspace[0].querySelector(".top-row")!.getBoundingClientRect();
        const generator = workspace[0].querySelector(".generator-pane")!.getBoundingClientRect();
        expect(workspace.hasClass("stacked")).to.equal(frameWidth < stackBelow);
        expect(controls.left - outer.left).to.be.closeTo(paneGap, 0.5);
        expect(controls.top - outer.top).to.be.closeTo(paneGap, 0.5);
        expect(outer.right - generator.right).to.be.closeTo(paneGap, 0.5);
        expect(outer.bottom - generator.bottom).to.be.closeTo(paneGap, 0.5);
      });
      cy.frameFitsInteractive();
    }));

  it("lets the workspace's own row wrap at 700 px", () => {
    start({ startingText: "the cat sat", panes: { input: { available: false } } }, { width: 700 });
    cy.interactive().find(".markov-workspace").should("not.have.class", "stacked");
    clickState("cat");
    cy.interactive().find(".clear-highlight").should("exist");
    cy.interactive().find(".controls-row").should("have.css", "flex-wrap", "wrap")
      .and(controlsRow => expect(controlsRow[0].scrollWidth).to.be.at.most(controlsRow[0].clientWidth));
  });
});

describe("the workspace's modes", () => {
  const drawOnly = { useData: false, draw: true };
  const bothModes = { useData: true, draw: true };
  const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
  const toolButton = (title: string) => shown().find(`.toolbar button[title='${title}']`);
  const drawingSvg = () => shown().find(".graph > svg");
  const shownState = (label: string) =>
    shown().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");
  const shownLabels = () => shown().find("g.node text").invoke("toArray")
    .invoke("map", (text: Element) => text.textContent);
  const clickShownState = (label: string) => {
    pastDoubleClick();
    shownState(label).trigger("click");
  };
  const nameField = () => shown().find(".nodeModal input[aria-label='State name']");
  // opens the state editor, once it has filled in the state's name
  const openEditor = (label: string) => {
    pastDoubleClick();
    shownState(label).trigger("click").trigger("click");
    nameField().should("have.value", label);
  };
  const clickDrawing = (x: number, y: number) => drawingSvg().trigger("click", x, y);
  const switchTo = (label: "Data" | "Draw") => shown().find(".mode-switch label").contains(label).click();
  const startDrawing = (authoredState: Record<string, unknown> = {}) =>
    start({ modes: drawOnly, startingMode: "draw", ...authoredState });
  // three states in a row, each from a click, leaving the Select tool chosen
  const drawThreeStates = () => {
    toolButton("Add State").click();
    [100, 220, 340].forEach(x => clickDrawing(x, 80));
    shown().find("g.node").should("have.length", 3);
    toolButton("Select").click();
  };
  const drawTransition = (from: string, to: string) => {
    toolButton("Add Transition").click();
    clickShownState(from);
    clickShownState(to);
    toolButton("Select").click();
  };
  const inspectCells = () => shown().find(".inspect-pane td").invoke("toArray")
    .invoke("map", (cell: Element) => cell.textContent);
  const shownTab = (label: string) => shown().find(".inspect-tab").contains(label);
  const thumb = (label: string) => shown().find(`[role='slider'][aria-label='Probability of ${label}']`);
  const save = () => shown().find(".nodeModal button").contains("Save");
  const setMaxLength = (length: number) =>
    shown().find(".generator-pane input[type='number']").clear().type(`${length}{enter}`);
  const play = () => shown().find(".generator-pane button").contains("Play");
  const playToTheEnd = () => {
    play().click();
    shown().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
  };
  const scale = () => shown().find(".graph > svg g.root").invoke("attr", "transform")
    .then(transform => parseTransform(transform as unknown as string).k);

  describe("the switch", () => {
    it("shows with both modes, and starts on the authored mode", () => {
      start({ modes: bothModes, startingMode: "draw", startingText: "the cat" });
      shown().find(".mode-switch input").should("have.length", 2);
      shown().find(".mode-switch label").contains("Draw").find("input").should("be.checked");
      shown().find(".input-pane").should("not.exist");
    });

    it("is absent with one mode", () => {
      start({ startingText: "the cat" });
      cy.interactive().find(".markov-workspace").should("exist");
      cy.interactive().find(".mode-switch").should("not.exist");
    });

    it("keeps focus on the shown mode's chosen radio when it hid the one that had it", () => {
      start({ modes: bothModes, startingText: "the cat" });
      shown().find(".mode-switch input").eq(1).then(radio => {
        (radio[0] as HTMLInputElement).focus();
        (radio[0] as HTMLInputElement).click();
      });
      shown().find(".mode-switch label").contains("Draw").find("input").should("be.checked");
      focused().should(element => {
        expect(element?.matches(":checked")).to.equal(true);
        expect(element?.closest(".workspace-body")?.hasAttribute("hidden")).to.equal(false);
      });
    });

    it("can't change while a sequence plays, and each mode's log says which it is", () => {
      start({ modes: bothModes, startingText: "a b a b a b" });
      play().click();
      shown().find(".mode-switch input").should("be.disabled");
      shown().find(".generator-pane button").contains("Cancel").click();
      shown().find(".mode-switch input").should("be.enabled");
      loggedEvents().should(events => {
        expect(events.find(([action]) => action === "SequencePlayed")?.[1]).to.include({ mode: "useData" });
      });

      switchTo("Draw");
      loggedEvents().should("deep.include", ["ModeSwitched", { mode: "draw" }]);
      toolButton("Add State").click();
      clickDrawing(100, 80);
      loggedEvents().should("deep.include", ["StateAdded", { state: "State 1", mode: "draw" }]);
    });
  });

  describe("drawing", () => {
    it("adds a state where the graph is clicked, wherever the pane sits", () => {
      startDrawing();
      toolButton("Add State").click();
      clickDrawing(300, 120);
      shownState("State 1").then(ellipse => drawingSvg().should(svg => {
        const view = svg[0].getBoundingClientRect();
        const box = ellipse[0].getBoundingClientRect();
        expect(view.left + 300).to.be.within(box.left, box.right);
        expect(view.top + 120).to.be.within(box.top, box.bottom);
        expect(box.left + box.width / 2).to.be.closeTo(view.left + 300, 2);
      }));
    });

    it("names a new state past the ones in use", () => {
      startDrawing();
      drawThreeStates();
      toolButton("Delete").click();
      clickShownState("State 2");
      shown().find("g.node").should("have.length", 2);
      toolButton("Add State").click();
      clickDrawing(460, 80);
      shownLabels().should("deep.equal", ["State 1", "State 3", "State 4"]);
    });

    it("edits a state's probabilities in an editor that covers the interactive", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 1", "State 3");
      shownTab("Transitions").click();
      inspectCells().should("deep.equal", ["State 1 → State 2", "50%", "State 1 → State 3", "50%"]);

      openEditor("State 1");
      play().then(button => {
        const box = button[0].getBoundingClientRect();
        const covering = button[0].ownerDocument.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        expect(!!covering?.closest(".nodeModal, .nodeModalBackground")).to.equal(true);
      });
      thumb("State 2").trigger("keydown", { key: "ArrowRight", shiftKey: true });
      save().click();
      inspectCells().should("deep.equal", ["State 1 → State 2", "60%", "State 1 → State 3", "40%"]);
    });

    it("moves a slider handle by a key reached with Tab, and by a touch drag", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 1", "State 3");
      openEditor("State 1");
      thumb("State 2").should("exist");
      nameField().focus();
      pressTab();
      focused().should(element => expect(element?.getAttribute("aria-label")).to.equal("Probability of State 2"));
      thumb("State 2").trigger("keydown", { key: "ArrowRight" });
      shown().find(".nodeModal").should("contain.text", "To State 2: 51%");

      thumb("State 2").then(circle => {
        const element = circle[0] as unknown as SVGCircleElement;
        const win = element.ownerDocument.defaultView as Window & typeof globalThis;
        const box = element.getBoundingClientRect();
        const fire = (type: string, clientX: number) => element.dispatchEvent(new win.PointerEvent(type, {
          clientX, clientY: box.y, pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, view: win
        }));
        fire("pointerdown", box.x);
        fire("pointermove", box.x - 40);
        fire("pointerup", box.x - 40);
        if (element.hasPointerCapture(1)) {
          element.releasePointerCapture(1);
        }
      });
      shown().find(".nodeModal").should(modal => {
        expect(Number(/To State 2: (\d+)%/.exec(modal.text())?.[1])).to.be.lessThan(51);
      });
    });

    it("saves a key's step to the Inspect probability", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 1", "State 3");
      shownTab("Transitions").click();
      openEditor("State 1");
      thumb("State 2").trigger("keydown", { key: "ArrowRight" });
      save().click();
      inspectCells().should("deep.equal", ["State 1 → State 2", "51%", "State 1 → State 3", "49%"]);
    });

    it("chooses a transition from its arrow, and clears it when it is deleted", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      shownTab("Transitions").click();
      shown().find("line.edge-background").trigger("click", { force: true });
      loggedEvents().should("deep.include",
        ["TransitionSelected", { from: "State 1", to: "State 2", source: "graph", mode: "draw" }]);
      shown().find(".inspect-pane tbody tr[class*='highlight-']").should("have.length", 1);

      toolButton("Delete").click();
      shown().find("line.edge-background").trigger("click", { force: true });
      shown().find("line.edge").should("not.exist");
      shown().find(".clear-highlight").should("not.exist");
      loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
    });

    it("clears a state deleted during a play once the play ends", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 2", "State 1");
      shown().find(".generator-pane select").first().select("State 1");
      clickShownState("State 3");
      toolButton("Delete").click();
      setMaxLength(2);
      play().click();
      shown().find("g.node").filter((i, node) => node.textContent === "State 3").find("ellipse").trigger("click");
      shown().find("g.node").should("have.length", 2);
      shown().find(".clear-highlight").should("exist");
      shown().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
      shown().find(".clear-highlight").should("not.exist");
    });

    it("refuses an empty name and one another state has", () => {
      startDrawing();
      drawThreeStates();
      openEditor("State 2");
      nameField().clear();
      shown().find(".nodeModalProblem").should("have.text", "Give the state a name.");
      save().should("be.disabled");
      nameField().type("State 1");
      shown().find(".nodeModalProblem").should("have.text", `Another state is already named "State 1".`);
      save().should("be.disabled");
      nameField().type("0");
      shown().find(".nodeModalProblem").should("not.exist");
      save().should("be.enabled");
    });

    it("closes the state editor on Escape, leaving the state chosen", () => {
      startDrawing();
      drawThreeStates();
      openEditor("State 1");
      shown().find(".nodeModal").should("exist");
      cy.interactive().type("{esc}");
      shown().find(".nodeModal").should("not.exist");
      shownState("State 1").should("have.attr", "fill", selectedNodeColor);
      loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
    });

    it("clears a chosen state on a click on the background in the Select tool", () => {
      startDrawing();
      drawThreeStates();
      clickShownState("State 1");
      shown().find(".clear-highlight").should("exist");
      clickDrawing(500, 250);
      shown().find(".clear-highlight").should("not.exist");
      loggedEvents().should("deep.include", ["SelectionCleared", { via: "background", mode: "draw" }]);
    });

    it("returns to Select on Escape, showing it, and one press takes up a tool again", () => {
      startDrawing();
      toolButton("Add State").click();
      cy.interactive().type("{esc}");
      toolButton("Select").should("have.attr", "aria-pressed", "true");
      toolButton("Add State").should("have.attr", "aria-pressed", "false");
      toolButton("Add State").click();
      clickDrawing(100, 80);
      shown().find("g.node").should("have.length", 1);
    });

    it("asks before Reset, which clears the drawing and Draw mode's outputs and not Data mode's", () => {
      start({ modes: bothModes, startingText: "a b" });
      playToTheEnd();
      switchTo("Draw");
      drawThreeStates();
      setMaxLength(1);
      playToTheEnd();
      shown().find(".sequence").should("have.length", 1);

      toolButton("Reset").click();
      shown().find(".confirmModal button").contains("Ok").click();
      shown().find("g.node").should("not.exist");
      shown().find(".sequence").should("not.exist");
      switchTo("Data");
      shown().find(".sequence").should("have.length", 1);
    });

    it("adds a state on a click that moves a pixel", () => {
      startDrawing();
      toolButton("Add State").click();
      drawingSvg().then(svg => {
        const win = svg[0].ownerDocument.defaultView as Window & typeof globalThis;
        const box = svg[0].getBoundingClientRect();
        const at = { clientX: box.x + 100, clientY: box.y + 80, bubbles: true, cancelable: true, view: win, button: 0 };
        svg[0].dispatchEvent(new win.MouseEvent("mousedown", at));
        win.dispatchEvent(new win.MouseEvent("mousemove", { ...at, clientX: at.clientX + 1 }));
        win.dispatchEvent(new win.MouseEvent("mouseup", { ...at, clientX: at.clientX + 1 }));
        svg[0].dispatchEvent(new win.MouseEvent("click", { ...at, clientX: at.clientX + 1 }));
      });
      shown().find("g.node").should("have.length", 1);
    });

    it("lights a chosen state's Transitions rows", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 3", "State 1");
      shownTab("Transitions").click();
      clickShownState("State 1");
      shown().find(".inspect-pane tbody tr.highlight-out").should("contain.text", "State 1 → State 2");
      shown().find(".inspect-pane tbody tr.highlight-in").should("contain.text", "State 3 → State 1");
    });

    it("brings a drawing off the middle of the pane into view on Fit View and on returning to it", () => {
      const inView = () => drawingSvg().should(svg => {
        const view = svg[0].getBoundingClientRect();
        const ellipses = svg[0].querySelectorAll("g.node ellipse");
        expect(ellipses).to.have.length(2);
        ellipses.forEach(ellipse => {
          const box = ellipse.getBoundingClientRect();
          expect(box.left).to.be.at.least(view.left);
          expect(box.right).to.be.at.most(view.right);
          expect(box.top).to.be.at.least(view.top);
          expect(box.bottom).to.be.at.most(view.bottom);
        });
      });
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      toolButton("Add State").click();
      clickDrawing(500, 200);
      clickDrawing(620, 220);
      toolButton("Select").click();
      toolButton("Fit View").click();
      afterFit();
      inView();
      switchTo("Data");
      switchTo("Draw");
      afterFit();
      inView();
    });

    it("keeps a generating step's candidates and labels on Escape", () => {
      startDrawing({ buttons: { probabilities: { available: true, startsOn: true } } });
      drawThreeStates();
      drawTransition("State 1", "State 2");
      shown().find(".generator-pane select").first().select("State 1");
      shown().find(".generator-pane button").contains("Step").click();
      shown().find("text.probability-label").should("have.length", 1);
      shown().find("line.edge[stroke-dasharray='4']").should("exist");
      cy.interactive().type("{esc}");
      cy.wait(100);
      shown().find("text.probability-label").should("have.length", 1);
      shown().find("line.edge[stroke-dasharray='4']").should("exist");
    });

    it("keeps the tool's icon at the pointer, wherever the pane sits", () => {
      startDrawing();
      toolButton("Add State").click();
      drawingSvg().then(svg => {
        const win = svg[0].ownerDocument.defaultView as Window & typeof globalThis;
        win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 300, clientY: 200, bubbles: true, view: win }));
      });
      shown().find(".dragIcon").should(icon => {
        const box = icon[0].getBoundingClientRect();
        expect(box.left).to.equal(280);
        expect(box.top).to.equal(180);
      });
    });

    it("clears a chosen state on Escape", () => {
      startDrawing();
      drawThreeStates();
      clickShownState("State 1");
      cy.interactive().type("{esc}");
      shown().find(".clear-highlight").should("not.exist");
      loggedEvents().should("deep.include", ["SelectionCleared", { via: "escape", mode: "draw" }]);
    });

    it("chooses states and transitions from Inspect", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      shown().find(".inspect-pane tbody tr").contains("State 2").click();
      shownState("State 2").should("have.attr", "fill", selectedNodeColor);
      shown().find(".inspect-pane tbody tr[class*='highlight-']").should("have.length", 1);
      loggedEvents().should("deep.include", ["StateSelected", { state: "State 2", source: "inspect", mode: "draw" }]);

      shownTab("Transitions").click();
      shown().find(".inspect-pane tbody tr").contains("State 1 → State 2").click();
      shown().find(".inspect-pane tbody tr[class*='highlight-']").should("have.length", 1);
      loggedEvents().should("deep.include",
        ["TransitionSelected", { from: "State 1", to: "State 2", source: "inspect", mode: "draw" }]);
    });

    it("stacks its panes below 700 px", () => {
      start({ modes: drawOnly, startingMode: "draw" }, { width: 690 });
      cy.interactive().find(".markov-workspace").should("have.class", "stacked");
      shown().find("[role='separator']").should("not.exist");
      shown().find(".inspect-pane").should(pane => expect(pane[0].style.flex).to.equal(""));
    });

    it("closes Reset's confirmation on Escape, leaving the choice and the tool", () => {
      startDrawing();
      drawThreeStates();
      clickShownState("State 1");
      toolButton("Add State").click();
      toolButton("Reset").click();
      shown().find(".confirmModal").should("exist");
      cy.interactive().type("{esc}");
      shown().find(".confirmModal").should("not.exist");
      shownState("State 1").should("have.attr", "fill", selectedNodeColor);
      toolButton("Add State").should("have.attr", "aria-pressed", "true");
      loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
    });

    it("leaves a student's view alone after a Recenter View on a blank drawing", () => {
      startDrawing();
      toolButton("Recenter View").click();
      drawThreeStates();
      drawingSvg().trigger("wheel", { deltaY: -200 });
      shown().find(".graph > svg g.root").invoke("attr", "transform").then(view => {
        dragDivider("Resize Graph and Inspect", -60, 0);
        afterFit();
        shown().find(".graph > svg g.root").should("have.attr", "transform", view);
      });
    });

    it("shows no candidate on a loop of no value", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 1");
      shown().find("path.loop").should("have.length", 1);
      drawTransition("State 1", "State 2");
      openEditor("State 1");
      [1, 2, 3, 4, 5].forEach(() => thumb("State 1").trigger("keydown", { key: "ArrowLeft", shiftKey: true }));
      save().click();
      shown().find(".generator-pane select").first().select("State 1");
      shown().find(".generator-pane button").contains("Step").click();
      shown().find("line.edge").should("have.attr", "stroke-dasharray", "4");
      shown().find("path.loop").should("not.have.attr", "stroke-dasharray", "4");
    });

    it("ends a sequence at a state whose arrows all have no value", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 1", "State 3");
      openEditor("State 1");
      thumb("State 2").trigger("keydown", { key: "ArrowRight", shiftKey: true });
      [1, 2, 3, 4].forEach(() => thumb("State 2").trigger("keydown", { key: "ArrowRight", shiftKey: true }));
      save().click();
      shownTab("Transitions").click();
      inspectCells().should("deep.equal", ["State 1 → State 2", "100%", "State 1 → State 3", "0%"]);
      toolButton("Delete").click();
      shown().find("line.edge-background").filter((i, line) =>
        (line as any).__data__.target.label === "State 2").trigger("click", { force: true });
      shown().find("line.edge").should("have.length", 1);
      toolButton("Select").click();
      shown().find(".generator-pane select").first().select("State 1");
      playToTheEnd();
      shown().find(".sequence").should("have.text", "State 1");
    });

    it("leaves a zoom alone after Reset", () => {
      startDrawing();
      toolButton("Zoom In").click();
      toolButton("Reset").click();
      shown().find(".confirmModal button").contains("Ok").click();
      shown().find(".confirmModal").should("not.exist");
      drawThreeStates();
      scale().then(zoomed => {
        dragDivider("Resize Graph and Inspect", -60, 0);
        afterFit();
        scale().should("equal", zoomed);
      });
    });

    it("keeps a chosen output, and its faded arrows, through other changes", () => {
      startDrawing();
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 3", "State 2");
      shown().find(".generator-pane select").first().select("State 1");
      setMaxLength(2);
      playToTheEnd();
      shown().find(".sequence").first().click();
      const fadedArrow = () => shown().find("line.edge").filter((i, line) =>
        (line as any).__data__.source.label === "State 3");
      fadedArrow().should("have.css", "opacity", "0.35");

      toolButton("Zoom In").click();
      toolButton("Fit View").click();
      shown().find(".sequence.highlighted").should("have.length", 1);

      toolButton("Add Transition").click();
      fadedArrow().should("have.css", "opacity", "0.35");
      shown().find("line.edge").filter((i, line) => (line as any).__data__.source.label === "State 1")
        .should("have.attr", "stroke", animatedArrowColor);
    });

    it("keeps the notes clear of its toolbar", () => {
      startDrawing({ buttons: { probabilities: { available: true, startsOn: true } } });
      drawThreeStates();
      drawTransition("State 1", "State 2");
      clickShownState("State 1");
      shown().find(".graph-notes p").should(note => {
        const toolbar = note[0].closest(".graph-pane-content")!.querySelector(".toolbar")!;
        expect(note[0].getBoundingClientRect().left).to.be.at.least(toolbar.getBoundingClientRect().right);
      });
    });

    it("clears a chosen state when it is deleted, without logging a clear", () => {
      startDrawing();
      drawThreeStates();
      clickShownState("State 1");
      toolButton("Delete").click();
      clickShownState("State 1");
      shown().find("g.node").should("have.length", 2);
      shown().find(".clear-highlight").should("not.exist");
      loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
    });

    it("scrolls Inspect to a state chosen in the graph", () => {
      startDrawing();
      toolButton("Add State").click();
      Array.from({ length: 16 }, (_, i) => i).forEach(i => clickDrawing(60 + (i % 8) * 80, i < 8 ? 60 : 180));
      shown().find("g.node").should("have.length", 16);
      toolButton("Select").click();
      clickShownState("State 9");
      shown().find(".inspect-pane .inspect-panel").should(panel => {
        const lit = panel[0].querySelector("tr[class*='highlight-']")!.getBoundingClientRect();
        const view = panel[0].getBoundingClientRect();
        expect(lit.top).to.be.at.least(view.top);
        expect(lit.bottom).to.be.at.most(view.bottom);
      });
    });
  });

  describe("the Draw pane's toolbar", () => {
    const lefts = () => shown().find(".toolbar button").then(buttons =>
      new Set([...buttons].map(button => Math.round(button.getBoundingClientRect().left))).size);

    it("has its nine tools in two columns at the starting row, and three at the smallest", () => {
      startDrawing();
      shown().find(".toolbar button").then(buttons => {
        expect([...buttons].map(button => button.title)).to.deep.equal([
          "Select", "Add State", "Add Transition", "Delete", "Fit View", "Recenter View", "Zoom In", "Zoom Out", "Reset"
        ]);
      });
      lefts().should("equal", 2);

      dragDivider("Resize the panes and the generator", 0, -1000);
      shown().find(".top-row").invoke("outerHeight").should("equal", minPaneSizes.top);
      lefts().should("equal", 3);
      shown().find(".graph-pane .pane-body").then(body => {
        const pane = body[0].getBoundingClientRect();
        shown().find(".toolbar button").each(button => {
          const box = button[0].getBoundingClientRect();
          expect(box.top).to.be.at.least(pane.top);
          expect(box.bottom).to.be.at.most(pane.bottom);
          expect(box.left).to.be.at.least(pane.left);
          expect(box.right).to.be.at.most(pane.right);
        });
      });
    });

    it("zooms the drawing, with no zoom buttons in the graph's corner", () => {
      startDrawing();
      drawThreeStates();
      shown().find(".zoomButtons").should("not.exist");
      toolButton("Zoom In").click();
      scale().should("be.closeTo", 1.1, 0.001);
    });

    it("has no way to collapse the Graph pane", () => {
      startDrawing();
      shown().find(".graph-pane .pane-header .pane-toggle").should("not.exist");
      shown().find(".inspect-pane .pane-header .pane-toggle").should("exist");
    });

    it("keeps the student's view through a divider drag once they zoom", () => {
      startDrawing();
      drawThreeStates();
      drawingSvg().trigger("wheel", { deltaY: -200 });
      scale().then(zoomed => {
        expect(zoomed).to.be.above(1);
        dragDivider("Resize Graph and Inspect", -60, 0);
        afterFit();
        scale().should("equal", zoomed);
      });
    });
  });

  describe("switching", () => {
    it("leaves each mode's pane sizes as they were", () => {
      start({ modes: bothModes, startingText: "the cat" });
      dragDivider("Resize Graph and Inspect", -60, 0);
      shown().find(".inspect-pane").invoke("outerWidth").should("equal", defaultPaneSizes.inspect + 60);
      switchTo("Draw");
      shown().find(".inspect-pane").invoke("outerWidth").should("equal", defaultPaneSizes.inspect);
      switchTo("Data");
      shown().find(".inspect-pane").invoke("outerWidth").should("equal", defaultPaneSizes.inspect + 60);
    });

    it("leaves Draw mode's tool alone on an Escape in Data mode", () => {
      start({ modes: bothModes, startingText: "the cat" });
      switchTo("Draw");
      toolButton("Add State").click();
      switchTo("Data");
      cy.interactive().type("{esc}");
      switchTo("Draw");
      toolButton("Add State").should("have.attr", "aria-pressed", "true");
    });

    it("draws a drawing's arrowheads with Data mode's graph hidden", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      drawThreeStates();
      drawTransition("State 1", "State 2");
      shown().find("line.edge").then(line => {
        const marker = line[0].ownerDocument.querySelector(line.attr("marker-end")!.slice(4, -1));
        expect(marker?.closest("[hidden]")).to.equal(null);
      });
    });

    it("keeps a drawing's speed its own, from its own label", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      shown().find(".generator-pane label").contains("Simulation Speed").click();
      shown().find(".generator-pane input[type='checkbox']").should("be.checked");
      switchTo("Data");
      shown().find(".generator-pane input[type='checkbox']").should("not.be.checked");
    });

    it("leaves the view to a student who zooms a drawing first drawn after switching to it", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      drawThreeStates();
      drawingSvg().trigger("wheel", { deltaY: -200 });
      scale().then(zoomed => {
        expect(zoomed).to.be.above(1);
        shown().find(".divider[aria-label='Resize Graph and Inspect']").then(band => {
          dragEvents(band[0], -60, 0);
        });
        afterFit();
        scale().should("equal", zoomed);
      });
    });

    it("leaves the view to a student who zooms a drawing from the toolbar, too", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      drawThreeStates();
      toolButton("Zoom In").click();
      scale().then(zoomed => {
        expect(zoomed).to.be.above(1);
        shown().find(".divider[aria-label='Resize Graph and Inspect']").then(band => dragEvents(band[0], -60, 0));
        afterFit();
        scale().should("equal", zoomed);
      });
    });

    it("leaves Draw mode's choice alone on an Escape in Data mode", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      drawThreeStates();
      clickShownState("State 1");
      switchTo("Data");
      cy.interactive().type("{esc}");
      switchTo("Draw");
      shownState("State 1").should("have.attr", "fill", selectedNodeColor);
    });

    it("fits a mode's graph again when it shows, following the graph once more", () => {
      start({ modes: bothModes, startingText: "a b" });
      afterFit();
      toolButton("Fit View").click();
      afterFit();
      scale().then(fitted => {
        drawingSvg().trigger("wheel", { deltaY: -400 });
        scale().should("not.equal", fitted);
        // d3-zoom's wheel gesture lasts 150 ms, and a fit inside it reads as the student's own zoom
        cy.wait(200);
        switchTo("Draw");
        switchTo("Data");
        afterFit();
        scale().should("be.closeTo", fitted, 0.01);
        shown().find("textarea[aria-label='Your text']").type(" c d e f g h i j ");
        shownLabels().should("have.length", 10);
        shown().find(".graph > svg g.root").should(root => {
          expect(parseTransform(root.attr("transform")).k).to.be.below(fitted);
        });
      });
    });

    it("fits a mode's graph to its panes as drawn once it shows, at a width the graph is narrow", () => {
      start({
        modes: bothModes, startingText: "one two three four five six seven eight nine ten eleven twelve thirteen"
      }, { width: 720 });
      switchTo("Draw");
      switchTo("Data");
      afterFit();
      afterFit();
      shown().find(".graph-pane .pane-body").should(body => {
        const pane = body[0].getBoundingClientRect();
        const ellipses = body[0].querySelectorAll("g.node ellipse");
        expect(ellipses).to.have.length(13);
        ellipses.forEach(ellipse => {
          const box = ellipse.getBoundingClientRect();
          expect(box.left).to.be.at.least(pane.left);
          expect(box.right).to.be.at.most(pane.right);
        });
      });
    });

    it("can't change while a drawing's sequence plays", () => {
      start({ modes: bothModes, startingText: "a b" });
      switchTo("Draw");
      drawThreeStates();
      drawTransition("State 1", "State 2");
      drawTransition("State 2", "State 1");
      shown().find(".generator-pane select").first().select("State 1");
      play().click();
      shown().find(".mode-switch input").should("be.disabled");
    });

    it("keeps each mode's work, both ways", () => {
      start({ modes: bothModes, startingText: "a b" });
      shown().find("textarea[aria-label='Your text']").type(" c ");
      shownLabels().should("deep.equal", ["a", "b", "c"]);
      setMaxLength(1);
      playToTheEnd();
      clickShownState("a");
      switchTo("Draw");
      drawThreeStates();
      setMaxLength(1);
      playToTheEnd();
      clickShownState("State 2");

      const dataIsAsLeft = () => {
        shown().find("textarea[aria-label='Your text']").should("have.value", "a b c ");
        shownLabels().should("deep.equal", ["a", "b", "c"]);
        shown().find(".sequence").should("have.length", 1);
        shownState("a").should("have.attr", "fill", selectedNodeColor);
      };
      const drawIsAsLeft = () => {
        shownLabels().should("deep.equal", ["State 1", "State 2", "State 3"]);
        shown().find(".sequence").should("have.length", 1);
        shownState("State 2").should("have.attr", "fill", selectedNodeColor);
      };
      [1, 2].forEach(() => {
        switchTo("Data");
        dataIsAsLeft();
        switchTo("Draw");
        drawIsAsLeft();
      });
    });

    it("keeps each mode's Inspect tab and sort", () => {
      const shownHeader = (label: string) => shown().find(".inspect-pane th").filter((i, th) =>
        th.textContent?.trim().startsWith(label) ?? false);
      start({ modes: bothModes, startingText: "a b a" });
      shownTab("Transitions").click();
      shownHeader("Count").find("button").click();
      shownHeader("Count").should("have.attr", "aria-sort", "ascending");
      switchTo("Draw");
      drawThreeStates();
      shownTab("States").should("have.attr", "aria-selected", "true");
      shownHeader("State").find("button").click();
      shownHeader("State").should("have.attr", "aria-sort", "descending");

      [1, 2].forEach(() => {
        switchTo("Data");
        shownTab("Transitions").should("have.attr", "aria-selected", "true");
        shownHeader("Count").should("have.attr", "aria-sort", "ascending");
        switchTo("Draw");
        shownTab("States").should("have.attr", "aria-selected", "true");
        shownHeader("State").should("have.attr", "aria-sort", "descending");
      });
    });

    it("keeps each mode's generator settings", () => {
      const startingState = () => shown().find(".generator-pane select").first();
      const maxLengthField = () => shown().find(".generator-pane input[type='number']");
      start({ modes: bothModes, startingText: "a b a" });
      startingState().select("b");
      setMaxLength(3);
      switchTo("Draw");
      drawThreeStates();
      startingState().select("State 2");
      setMaxLength(7);

      [1, 2].forEach(() => {
        switchTo("Data");
        startingState().find("option:selected").should("have.text", "b");
        maxLengthField().should("have.value", "3");
        switchTo("Draw");
        startingState().find("option:selected").should("have.text", "State 2");
        maxLengthField().should("have.value", "7");
      });
    });

    it("keeps where each mode's states are", () => {
      const position = (label: string) => shownState(label).then(ellipse =>
        [Number(ellipse.attr("cx")), Number(ellipse.attr("cy"))]);
      // the layout moves a mode's states until it settles
      const settledPosition = (label: string) => {
        cy.wait(3000);
        return position(label);
      };
      const isAt = (label: string, [x, y]: number[]) => position(label).should(([atX, atY]) => {
        expect(atX).to.be.closeTo(x, 0.5);
        expect(atY).to.be.closeTo(y, 0.5);
      });
      start({ modes: bothModes, startingText: "a b a" });
      settledPosition("b").then(dataPlace => {
        switchTo("Draw");
        drawThreeStates();
        settledPosition("State 2").then(drawPlace => {
          [1, 2].forEach(() => {
            switchTo("Data");
            isAt("b", dataPlace as unknown as number[]);
            switchTo("Draw");
            isAt("State 2", drawPlace as unknown as number[]);
          });
        });
      });
    });
  });
});

describe("the workspace's probabilities", () => {
  const toggle = () => cy.interactive().find(".probabilities-toggle");
  const labels = () => cy.interactive().find("text.probability-label");
  const labelTexts = () => labels().invoke("toArray").invoke("map", (label: Element) => label.textContent);
  const notes = () => cy.interactive().find(".graph-notes").invoke("children").invoke("toArray")
    .invoke("map", (note: Element) => note.textContent);
  const on = { buttons: { probabilities: { available: true, startsOn: true } } };
  const generatorButton = (label: string) => cy.interactive().find(".generator-pane button").contains(label);
  const rounding = "Percents are rounded, so they may not add up to 100%";

  it("labels a chosen state's arrows while the toggle is on, and logs it", () => {
    start({ startingText: "the cat the mat" });
    clickState("the");
    labels().should("not.exist");
    toggle().should("have.attr", "aria-pressed", "false").click();
    toggle().should("have.attr", "aria-pressed", "true");
    labelTexts().should("deep.equal", ["50%", "50%"]);
    loggedEvents().should("deep.include", ["ProbabilitiesToggled", { on: true, mode: "useData" }]);
    cy.interactive().find(".probability-labels").should("have.css", "pointer-events", "none");
    toggle().click();
    labels().should("not.exist");
  });

  it("labels a generating step's candidates, and then only the transition it chose", () => {
    start({ startingText: "the cat the mat the cat", ...on });
    cy.interactive().find(".generator-pane select").first().select("the");
    generatorButton("Step").click();
    labelTexts().should("deep.equal", ["67%", "33%"]);
    generatorButton("Step").click();
    labels().should("have.length", 1).should(label => {
      expect(label.attr("data-from")).to.equal("the");
      expect(label.text()).to.equal(label.attr("data-to") === "cat" ? "67%" : "33%");
    });
  });

  it("labels no candidates and no chosen output with probabilities off", () => {
    start({ startingText: "a b a c" });
    cy.interactive().find(".generator-pane select").first().select("a");
    maxLength().clear();
    maxLength().type("2{enter}");
    generatorButton("Step").click();
    cy.interactive().find("line.edge[stroke-dasharray='4']").should("exist");
    labels().should("not.exist");
    cy.interactive().find(".generator-pane button").contains("Cancel").click();
    playButton().click();
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence").first().click();
    cy.interactive().find(".sequence.highlighted").should("have.length", 1);
    labels().should("not.exist");
  });

  it("labels a chosen output's steps at full strength and the paths not taken faded", () => {
    start({ startingText: "a b a c", ...on });
    cy.interactive().find(".generator-pane select").first().select("a");
    maxLength().clear();
    maxLength().type("2{enter}");
    playButton().click();
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence").first().click();
    cy.interactive().find("text.probability-label:not(.faded)").should("have.length", 1);
    cy.interactive().find("text.probability-label.faded").should("have.length", 1).should(label => {
      expect(getComputedStyle(label[0]).fill).to.equal("rgb(118, 118, 118)");
      expect(getComputedStyle(label[0]).opacity).to.equal("1");
    });
  });

  it("moves a label with its arrow while a state is dragged", () => {
    start({ startingText: "the cat the mat", ...on });
    clickState("the");
    labels().should("have.length", 2);
    const matLabel = () => cy.interactive().find("text.probability-label[data-to]")
      .filter((i, label) => (label as unknown as { __data__: { to: string } }).__data__.to === "mat");
    matLabel().invoke("attr", "x").then(before => {
      stateEllipse("mat").then(ellipse => {
        const win = ellipse[0].ownerDocument.defaultView as Window & typeof globalThis;
        const box = ellipse[0].getBoundingClientRect();
        const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, view: win };
        ellipse[0].dispatchEvent(new win.MouseEvent("mousedown", at));
        win.dispatchEvent(new win.MouseEvent("mousemove", { ...at, clientX: at.clientX + 60 }));
      });
      matLabel().should(label => expect(label.attr("x")).not.to.equal(before));
      stateEllipse("mat").then(ellipse => {
        const win = ellipse[0].ownerDocument.defaultView as Window & typeof globalThis;
        win.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, view: win }));
      });
    });
  });

  it("sits in the Graph pane's header in both modes, and not in the controls row", () => {
    const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
    start({ startingText: "the cat", modes: { useData: true, draw: true } });
    (["Data", "Draw"] as const).forEach(current => {
      shown().find(".graph-pane .pane-header .probabilities-toggle").should("be.visible").then(button => {
        const header = button[0].closest(".pane-header") as HTMLElement;
        const [inner, outer] = [button[0].getBoundingClientRect(), header.getBoundingClientRect()];
        expect(inner.top).to.be.at.least(outer.top);
        expect(inner.bottom).to.be.at.most(outer.bottom);
        const [title, collapse] = [header.querySelector("h2")!, header.querySelector(".pane-toggle")];
        expect(title.getBoundingClientRect().right).to.be.at.most(inner.left);
        // Draw mode's Graph pane can't collapse
        expect(collapse !== null).to.equal(current === "Data");
        if (collapse) {
          expect(inner.right).to.be.at.most(collapse.getBoundingClientRect().left);
        }
      });
      shown().find(".controls-row .probabilities-toggle").should("not.exist");
      shown().find(".mode-switch label").contains(current === "Data" ? "Draw" : "Data").click();
    });
  });

  it("leaves the Graph pane's header while the pane is collapsed, keeping its setting", () => {
    start({ startingText: "the cat the mat" });
    toggle().click();
    cy.interactive().find(".graph-pane .pane-toggle").click();
    toggle().should("not.exist");
    cy.interactive().find(".graph-pane .pane-toggle").click();
    toggle().should("have.attr", "aria-pressed", "true");
  });

  it("stays as authored without the toggle", () => {
    start({ startingText: "the cat the mat", buttons: { probabilities: { available: false, startsOn: true } } });
    cy.interactive().find(".markov-workspace").should("exist");
    toggle().should("not.exist");
    clickState("the");
    labelTexts().should("deep.equal", ["50%", "50%"]);
  });

  it("hides the toggle in Data mode without a Graph pane", () => {
    start({ startingText: "the cat", panes: { graph: { available: false } } });
    cy.interactive().find(".inspect-pane").should("exist");
    toggle().should("not.exist");
  });

  it("shows the toggle in Draw mode, whose Graph pane is always there", () => {
    start({ modes: { useData: false, draw: true }, startingMode: "draw", panes: { graph: { available: false } } });
    toggle().should("exist");
  });

  it("shares the toggle between the modes, and follows a drawing's weights", () => {
    const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
    start({ startingText: "the cat", modes: { useData: true, draw: true } });
    shown().find(".probabilities-toggle").click();
    shown().find(".mode-switch label").contains("Draw").click();
    shown().find(".probabilities-toggle").should("have.attr", "aria-pressed", "true");
    shown().find(".probabilities-toggle").click();
    loggedEvents().should("deep.include", ["ProbabilitiesToggled", { on: false, mode: "draw" }]);
    shown().find(".probabilities-toggle").click();

    shown().find(".toolbar button[title='Add State']").click();
    [100, 220, 340].forEach(x => shown().find(".graph > svg").trigger("click", x, 80));
    shown().find("g.node").should("have.length", 3);
    shown().find(".toolbar button[title='Add Transition']").click();
    const clickDrawn = (label: string) => {
      pastDoubleClick();
      shown().find("g.node").filter((i, node) => node.textContent === label).find("ellipse").trigger("click");
    };
    ["State 1", "State 2", "State 1", "State 3"].forEach(clickDrawn);
    shown().find(".toolbar button[title='Select']").click();
    pastDoubleClick();
    shown().find("g.node").filter((i, node) => node.textContent === "State 1").find("ellipse")
      .trigger("click").trigger("click");
    shown().find(".nodeModal input[aria-label='State name']").should("have.value", "State 1");
    shown().find("[role='slider']").trigger("keydown", { key: "ArrowRight", shiftKey: true });
    shown().find(".nodeModal button").contains("Save").click();
    shown().find("text.probability-label").invoke("toArray")
      .invoke("map", (label: Element) => label.textContent).should("deep.equal", ["60%", "40%"]);
  });

  it("notes the rounding only while labels show", () => {
    start({ startingText: "the cat the" });
    toggle().click();
    notes().should("deep.equal", []);
    clickState("the");
    labels().should("have.length", 1);
    notes().should("deep.equal", [rounding]);
    cy.interactive().find(".graph-notes").should("have.css", "pointer-events", "none")
      .and("have.attr", "aria-live", "polite");
    toggle().click();
    notes().should("deep.equal", []);
  });

  it("has no rounding note for a chosen state with no arrows out of it", () => {
    start({ startingText: "the cat", ...on });
    clickState("cat");
    cy.interactive().find(".clear-highlight").should("exist");
    labels().should("not.exist");
    notes().should("deep.equal", []);
  });

  it("keeps the rounding note through both halves of a generating step", () => {
    start({ startingText: "the cat the", ...on });
    notes().should("deep.equal", []);
    generatorButton("Step").click();
    notes().should("deep.equal", [rounding]);
    generatorButton("Step").click();
    labels().should("have.length", 1);
    notes().should("deep.equal", [rounding]);
  });
});

describe("the workspace's Order matters switch", () => {
  const off = { orderMatters: { startsOn: false, showSwitch: true } };
  const orderSetting = () => cy.interactive().find(".setting-switch").filter(":contains('Order matters')");
  const orderSwitch = () => orderSetting().find("[role='switch']");
  const orderLabel = () => cy.interactive().find(".controls-row .setting-label")
    .filter(":contains('Order matters')");
  const bagLines = () => cy.interactive().find(".bag-arrows line");
  const bagLoops = () => cy.interactive().find(".bag-arrows path");
  const notes = () => cy.interactive().find(".graph-notes").invoke("children").invoke("toArray")
    .invoke("map", (note: Element) => note.textContent);
  const outgoingOnly = "Only arrows out of the chosen word are drawn";
  const finished = () =>
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
  const inspectTransitions = () => cy.interactive().find(".inspect-tab").contains("Transitions");

  it("shows no arrows until a state is chosen, then only its own, and notes that", () => {
    start({ startingText: "the cat the mat the", ...off });
    cy.interactive().find("g.node").should("have.length", 3);
    cy.interactive().find("line.edge, path.loop").should("not.exist");
    bagLines().should("not.exist");
    notes().should("deep.equal", []);

    clickState("the");
    bagLines().should("have.length", 2);
    bagLoops().should("have.length", 1);
    bagLines().each(line => expect((line[0] as any).__data__.source.label).to.equal("the"));
    notes().should("deep.equal", [outgoingOnly]);
  });

  it("has no note about the chosen word's arrows while order matters", () => {
    start({ startingText: "the cat" });
    clickState("the");
    cy.interactive().find(".clear-highlight").should("exist");
    notes().should("deep.equal", []);
  });

  it("drops the note about the chosen word's arrows while a sequence steps", () => {
    start({ startingText: "the cat the mat the", ...off });
    clickState("the");
    notes().should("deep.equal", [outgoingOnly]);
    cy.interactive().find(".generator-pane button").contains("Step").click();
    notes().should("deep.equal", []);
  });

  it("generates by count once turned off, in a group of its own", () => {
    start({ startingText: "a b" });
    maxLength().clear();
    maxLength().type("2{enter}");
    playButton().click();
    finished();
    cy.interactive().find(".group .header").should("have.length", 1).and("not.contain.text", "Orderless");
    orderSwitch().click();
    playButton().click();
    finished();
    cy.interactive().find(".group .header").should("have.length", 2);
    cy.interactive().find(".group .header").last().should("contain.text", "Orderless");
    loggedEvents().should(events => {
      const generated = events.filter(([action]) => action === "SequenceGenerated");
      expect(generated.map(([, data]) => (data as { orderMatters: boolean }).orderMatters))
        .to.deep.equal([true, false]);
    });
  });

  it("moves a chosen state's arrows with it while it is dragged", () => {
    start({ startingText: "the cat the mat the", ...off });
    clickState("the");
    bagLines().should("have.length", 2);
    const arrowStart = () => bagLines().first().invoke("attr", "x1");
    const loopPath = () => bagLoops().first().invoke("attr", "d");
    arrowStart().then(x => loopPath().then(d => {
      stateEllipse("the").then(ellipse => {
        const win = ellipse[0].ownerDocument.defaultView as Window & typeof globalThis;
        const box = ellipse[0].getBoundingClientRect();
        const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, view: win };
        ellipse[0].dispatchEvent(new win.MouseEvent("mousedown", at));
        win.dispatchEvent(new win.MouseEvent("mousemove", { ...at, clientX: at.clientX + 60 }));
      });
      bagLines().first().should(line => expect(line.attr("x1")).not.to.equal(x));
      bagLoops().first().should(loop => expect(loop.attr("d")).not.to.equal(d));
      stateEllipse("the").then(ellipse => {
        const win = ellipse[0].ownerDocument.defaultView as Window & typeof globalThis;
        win.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, view: win }));
      });
    }));
  });

  it("leaves every state where it is, switched either way", () => {
    start({ startingText: "the cat the mat the" });
    afterFit();
    const places = () => cy.interactive().find("g.node ellipse").then(ellipses =>
      [...ellipses].map(ellipse => `${ellipse.getAttribute("cx")},${ellipse.getAttribute("cy")}`));
    places().then(before => {
      expect(before).to.have.length(3);
      orderSwitch().click();
      cy.interactive().find("line.edge").should("not.exist");
      places().should("deep.equal", before);
      orderSwitch().click();
      cy.interactive().find("line.edge").should("exist");
      places().should("deep.equal", before);
    });
  });

  describe("with probabilities on", () => {
    const both = { ...off, buttons: { probabilities: { available: true, startsOn: true } } };
    const labelTexts = () => cy.interactive().find("text.probability-label").invoke("toArray")
      .invoke("map", (label: Element) => label.textContent).invoke("sort");

    it("labels a chosen state's arrows by the states' counts", () => {
      start({ startingText: "the cat the mat the", ...both });
      clickState("cat");
      labelTexts().should("deep.equal", ["20%", "20%", "60%"]);
    });

    it("dashes and labels a step's candidates, and then draws and labels only the step taken", () => {
      start({ startingText: "the cat the mat the", ...both });
      cy.interactive().find(".generator-pane select").first().select("cat");
      cy.interactive().find(".generator-pane button").contains("Step").click();
      cy.interactive().find(".bag-arrows line[stroke-dasharray='4']").should("have.length", 2);
      cy.interactive().find(".bag-arrows path[stroke-dasharray='4']").should("have.length", 1);
      labelTexts().should("deep.equal", ["20%", "20%", "60%"]);
      cy.interactive().find(".generator-pane button").contains("Step").click();
      cy.interactive().find(".bag-arrows line, .bag-arrows path").should("have.length", 1);
      cy.interactive().find(".bag-arrows [stroke-dasharray='4']").should("not.exist");
      // the word's share of all the words, whatever it came from
      const shares: Record<string, string> = { the: "60%", cat: "20%", mat: "20%" };
      cy.interactive().find("text.probability-label").should("have.length", 1).should(label => {
        expect(label.attr("data-from")).to.equal("cat");
        expect(label.text()).to.equal(shares[label.attr("data-to")!]);
      });
    });

    it("labels exactly a chosen output's steps, with nothing faded", () => {
      start({ startingText: "the cat the mat the", ...both });
      cy.interactive().find(".generator-pane select").first().select("cat");
      maxLength().clear();
      maxLength().type("2{enter}");
      playButton().click();
      finished();
      cy.interactive().find(".sequence").first().click();
      cy.interactive().find("text.probability-label").should("have.length", 1);
      cy.interactive().find("text.probability-label.faded").should("not.exist");
      cy.interactive().find(".bag-arrows line, .bag-arrows path").should("have.length", 1);
    });
  });

  it("fades no state when one is chosen, whatever the chain's transitions", () => {
    start({ startingText: "a b c d", ...off });
    clickState("a");
    bagLines().should("have.length", 3);
    stateEllipse("d").should("have.css", "opacity", "1");
    cy.interactive().find("g.node").filter((i, node) => node.textContent === "d").find("text")
      .should("have.css", "opacity", "1");
  });

  it("does nothing on a click on an arrow", () => {
    start({ startingText: "the cat the mat the", ...off });
    clickState("the");
    bagLines().first().trigger("click", { force: true });
    stateEllipse("the").should("have.attr", "fill", selectedNodeColor);
    loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("TransitionSelected"));
  });

  it("opens no state dialog on a double-click", () => {
    start({ startingText: "the cat", ...off });
    pastDoubleClick();
    stateEllipse("the").trigger("click").trigger("click");
    cy.wait(100);
    cy.interactive().find(".nodeModal").should("not.exist");
  });

  it("explains the bag of words in Inspect, and brings the table back with its sort", () => {
    start({ startingText: "the cat the mat the" });
    inspectTransitions().click();
    cy.interactive().find(".inspect-pane th button").contains("Count").click();
    orderSwitch().click();
    cy.interactive().find(".inspect-explanation").should("contain.text", "All states are connected");
    cy.interactive().find(".inspect-pane table").should("not.exist");
    orderSwitch().click();
    cy.interactive().find(".inspect-pane th").contains("Count").closest("th")
      .should("have.attr", "aria-sort", "ascending");
  });

  it("generates to Max Length where the chain would end, in a group marked Orderless", () => {
    start({ startingText: "a b", ...off });
    cy.interactive().find(".generator-pane select").first().select("a");
    cy.interactive().find(".generator-pane input[role='switch']").click({ force: true });
    playButton().click();
    finished();
    cy.interactive().find(".sequence").first().invoke("text").should(text => expect(text.split(" ")).to.have.length(5));
    cy.interactive().find(".group .header").should("contain.text", "Orderless");
    cy.interactive().find(".group .header").click();
    cy.interactive().find(".group .header").should("contain.text", "Order matters: No");
  });

  it("writes a word added in the table on a line of its own, and leaves no blank line when it goes", () => {
    start({ startingText: "the", inputView: "textAndTable", ...off });
    newRow().type("dog{enter}");
    textBox().should("have.value", "the\ndog");
    cy.interactive().find("button[aria-label='Delete row 2']").click();
    textBox().should("have.value", "the\n");
  });

  it("leaves no blank line between the words when a listed word in the middle goes", () => {
    start({ startingText: "the\ndog\ncat", inputView: "textAndTable", ...off });
    cy.interactive().find("button[aria-label='Delete row 2']").click();
    textBox().should("have.value", "the\ncat");
  });

  it("clears a chosen transition when turned off, logging only the switch", () => {
    start({ startingText: "the cat the mat" });
    inspectTransitions().click();
    inspectRow("the → cat").find("button").click();
    cy.interactive().find(".clear-highlight").should("exist");
    orderSwitch().click();
    cy.interactive().find(".clear-highlight").should("not.exist");
    loggedEvents().should("deep.include", ["OrderMattersToggled", { on: false, mode: "useData" }]);
    loggedEvents().then(events => expect(events.map(([action]) => action)).not.to.include("SelectionCleared"));
  });

  it("keeps a chosen output when turned off", () => {
    start({ startingText: "a b" });
    maxLength().clear();
    maxLength().type("1{enter}");
    playButton().click();
    finished();
    cy.interactive().find(".sequence").first().click();
    orderSwitch().click();
    cy.interactive().find(".sequence.highlighted").should("have.length", 1);
  });

  it("can't change while a sequence plays", () => {
    start({ startingText: "a b a b a b" });
    playButton().click();
    orderSwitch().should("be.disabled");
  });

  it("reads Yes or No beside the switch, and is absent in Draw mode", () => {
    start({ startingText: "the cat", modes: { useData: true, draw: true } });
    orderSetting().should("contain.text", "Yes");
    orderSwitch().click();
    orderSetting().should("contain.text", "No");
    cy.interactive().find(".workspace-body:not([hidden]) .mode-switch label").contains("Draw").click();
    cy.interactive().find(".workspace-body:not([hidden]) .setting-switch").should("not.exist");
    cy.interactive().find(".workspace-body:not([hidden]) .setting-label").should("not.exist");
  });

  it("shows a read-only label with the switch hidden", () => {
    start({ startingText: "the cat", orderMatters: { startsOn: false, showSwitch: false } });
    orderSetting().should("not.exist");
    orderLabel().should("have.text", "Order matters: No");
  });

  it("shows both read-only labels with both switches hidden, Order matters first", () => {
    start({ startingText: "the cat", showCaseSwitch: false, orderMatters: { startsOn: true, showSwitch: false } });
    cy.interactive().find(".controls-row .setting-label").should(labels => {
      expect([...labels].map(label => label.textContent)).to.deep.equal(["Order matters: Yes", "Case sensitive: No"]);
    });
  });

  it("says so when order matters and the switch is hidden", () => {
    start({ startingText: "the cat", orderMatters: { startsOn: true, showSwitch: false } });
    orderLabel().should("have.text", "Order matters: Yes");
  });

  it("stays inside the Input pane at its minimum, above Case sensitive", () => {
    start({ startingText: "the cat" });
    dragDivider("Resize Input and Graph", -1000, 0);
    cy.interactive().find(".input-pane").invoke("outerWidth").should("equal", minPaneSizes.input);
    cy.interactive().find(".input-pane .pane-body").then(body => {
      const box = body[0].getBoundingClientRect();
      cy.interactive().find(".input-pane .setting-switches .setting-switch").should(settings => {
        expect(settings).to.have.length(2);
        const [order, caseSensitive] = [...settings].map(setting => setting.getBoundingClientRect());
        expect(settings[0].textContent).to.contain("Order matters");
        expect(order.bottom).to.be.at.most(caseSensitive.top + 1);
        expect(order.right).to.be.at.most(box.right);
        expect(caseSensitive.right).to.be.at.most(box.right);
      });
    });
  });

  it("sits in the workspace's own row with no Input pane, first", () => {
    start({ startingText: "the cat", panes: { input: { available: false } } });
    cy.interactive().find(".controls-row .setting-switches .setting-switch").should(settings => {
      expect(settings).to.have.length(2);
      expect(settings[0].textContent).to.contain("Order matters");
    });
  });

  it("keeps the row's widest case inside the workspace at 700 px, wrapping where it can't fit", () => {
    start({
      startingText: "the cat", modes: { useData: true, draw: true }, panes: { input: { available: false } }
    }, { width: 700 });
    clickState("cat");
    const controls = () => cy.interactive().find(".workspace-body:not([hidden]) .controls-row");
    controls().find(".clear-highlight").should("exist");
    controls().should(controlsRow => {
      const right = controlsRow[0].closest(".markov-workspace")!.getBoundingClientRect().right;
      expect(controlsRow[0].children).to.have.length.above(2);
      [...controlsRow[0].children].forEach(control => {
        expect(control.getBoundingClientRect().right).to.be.at.most(right);
      });
    });
    controls().invoke("css", "width", "400px");
    controls().should(controlsRow => {
      const switchBottom = controlsRow[0].querySelector(".mode-switch")!.getBoundingClientRect().bottom;
      const groupTop = controlsRow[0].querySelector(".setting-switches")!.getBoundingClientRect().top;
      expect(groupTop).to.be.at.least(switchBottom);
    });
  });
});

describe("the workspace's keyboard and narrow-screen touches", () => {
  it("rings a control focused from the keyboard in the workspace's teal", () => {
    start({ startingText: "the cat" });
    cy.interactive().find(".input-pane .pane-toggle").focus();
    cy.interactive().find(".input-pane .pane-toggle").should(toggle => {
      expect(toggle[0].matches(":focus-visible")).to.equal(true);
      expect(toggle.css("outline-style")).to.equal("solid");
      expect(toggle.css("outline-width")).to.equal("2px");
      expect(toggle.css("outline-color")).to.equal("rgb(23, 121, 145)");
    });
  });

  it("tells a screen reader that Data mode's Select tool is on", () => {
    start({ startingText: "the cat" });
    cy.interactive().find(".graph-pane .toolbar button[title='Select']").should("have.attr", "aria-pressed", "true");
  });

  it("keeps the generator's buttons inside its pane at 320 px", () => {
    start({ startingText: "the cat" }, { width: 320 });
    cy.interactive().find(".generator-pane").should(pane => {
      const right = pane[0].getBoundingClientRect().right;
      pane.find("button").each((_, button) => {
        expect(button.getBoundingClientRect().right, button.textContent!).to.be.at.most(right);
      });
      const page = pane[0].ownerDocument.documentElement;
      expect(page.scrollWidth).to.be.at.most(page.clientWidth);
    });
  });
});

describe("the workspace's fit and finish from testing", () => {
  const bothModes = { useData: true, draw: true };
  const box = (selector: string) => cy.interactive().find(selector).first()
    .then(element => element[0].getBoundingClientRect());
  const generateOutput = () => {
    playButton().click();
    // the button reads Pause while the sequence plays
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    cy.interactive().find(".sequence-output .sequence").should("have.length", 1).click();
  };

  it("reads straight and curly double quotes as one state of their own, and commits on a typed one", () => {
    start({ startingText: "she said “hi” and he said" });
    inspectRow("\"").find("td").eq(1).should("have.text", "2");
    inspectRow("hi").find("td").eq(1).should("have.text", "1");
    textBox().type(" \"hi\"");
    inspectRow("\"").find("td").eq(1).should("have.text", "4");
    inspectRow("hi").find("td").eq(1).should("have.text", "2");
  });

  it("has no row above the panes when nothing is in it, and gives its height to the generator", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find(".controls-row").should("not.exist");
    cy.interactive().find(".markov-workspace").invoke("outerHeight").should("equal", 614);
    box(".top-row").then(topRow => box(".markov-workspace").then(workspace =>
      expect(topRow.top - workspace.top).to.be.closeTo(paneGap, 0.5)));
    cy.interactive().find(".generator-pane").invoke("outerHeight")
      .should("equal", workspaceHeight + emptyRowSpare - defaultPaneSizes.top);
  });

  it("gives an empty row's height to the panes above a collapsed generator", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("button[aria-label='Collapse Sequence Generator']").click();
    cy.interactive().find(".markov-workspace").invoke("outerHeight").should("equal", 614);
  });

  it("keeps the row while it holds a control, at its height", () => {
    start({ startingText: "the cat sat", modes: bothModes });
    cy.interactive().find(".workspace-body:not([hidden]) .controls-row").should("exist");
    cy.interactive().find(".markov-workspace").invoke("outerHeight").should("equal", 614);
    cy.interactive().find(".workspace-body:not([hidden]) .generator-pane").invoke("outerHeight")
      .should("equal", workspaceHeight - defaultPaneSizes.top);
  });

  it("has no row in a drawing with no buttons", () => {
    start({ modes: { useData: false, draw: true } });
    cy.interactive().find(".controls-row").should("not.exist");
    cy.interactive().find(".markov-workspace").invoke("outerHeight").should("equal", 614);
  });

  it("puts Clear highlight in the Graph pane's header with no row, so choosing moves no pane", () => {
    start({ startingText: "the cat sat" });
    box(".top-row").then(before => {
      clickState("cat");
      cy.interactive().find(".graph-pane .pane-header .clear-highlight").should("be.visible");
      box(".top-row").should(after => expect(after.top).to.equal(before.top));
    });
    cy.interactive().find(".graph-pane .clear-highlight").focus();
    cy.interactive().find(".graph-pane .clear-highlight").click();
    cy.interactive().find(".clear-highlight").should("not.exist");
    stateEllipse("cat").should("have.attr", "fill", "#fff");
    focused().should("have.class", "pane-header-controls");
  });

  it("puts Clear highlight in Inspect's header with no row while the Graph pane is collapsed", () => {
    start({ startingText: "the cat sat" });
    cy.interactive().find("button[aria-label='Collapse Graph']").click();
    inspectRow("cat").find("button").click();
    cy.interactive().find(".inspect-pane .pane-header .clear-highlight").should("be.visible").click();
    inspectRow("cat").should("not.have.class", "highlight-selected");
  });

  it("bolds every lit Inspect row, and only those", () => {
    const weights = () => cy.interactive().find(".inspect-pane tbody tr").then(rows =>
      [...rows as JQuery<HTMLTableRowElement>]
        .map(tr => `${tr.cells[0].textContent}:${getComputedStyle(tr).fontWeight}`));
    start({ startingText: "the cat sat on the mat" });
    weights().should("deep.equal", ["cat:400", "mat:400", "on:400", "sat:400", "the:400"]);
    clickState("cat");
    weights().should("deep.equal", ["cat:700", "mat:400", "on:400", "sat:400", "the:400"]);
    inspectTab("Transitions").click();
    weights().should("include.members", ["the → cat:700", "cat → sat:700", "sat → on:400"]);
    inspectRow("sat → on").find("button").click();
    weights().should("include.members", ["sat → on:700", "the → cat:400"]);
  });

  it("bolds an output's Inspect rows and says they are in it", () => {
    start({ startingText: "a b a b" });
    generateOutput();
    inspectRow("a").should("have.css", "font-weight", "700").find("button").then(button =>
      expect((button.attr("aria-describedby") ?? "").split(" ").filter(Boolean)
        .map(id => button[0].ownerDocument.getElementById(id)!.textContent)).to.include("In the highlighted output"));
  });

  // the columns share out the table's width by their text, so a bold row may shift them by under a pixel
  it("keeps the Inspect table's columns within a pixel and its rows' heights when a row turns bold", () => {
    start({ startingText: "extraordinarily magnificent extraordinarily wonderful magnificent" });
    inspectTab("Transitions").click();
    const sizes = () => cy.interactive().find(".inspect-pane table").then(table =>
      [...table[0].querySelectorAll("th, tbody tr")].map(cell => {
        const rect = cell.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }));
    sizes().then(before => {
      cy.interactive().find(".inspect-pane tbody tr button").first().click();
      cy.interactive().find(".inspect-pane tbody tr.highlight-chosen").should("have.css", "font-weight", "700");
      sizes().should(after => {
        expect(after).to.have.length(before.length).and.length.above(4);
        after.forEach((size, i) => {
          expect(size.width).to.be.closeTo(before[i].width, 1);
          expect(size.height).to.equal(before[i].height);
        });
      });
    });
  });

  it("clears a highlighted output when the text changes the graph, and keeps it when it doesn't", () => {
    start({ startingText: "a b a b" });
    generateOutput();
    textBox().type(" ");
    cy.interactive().find(".sequence-output .sequence").should("have.attr", "aria-pressed", "true");
    textBox().type("c ");
    cy.interactive().find(".sequence-output .sequence").should("have.attr", "aria-pressed", "false");
    cy.interactive().find(".inspect-pane tbody tr.highlight-output").should("not.exist");
    cy.interactive().find(".text-input .backdrop mark").should("not.exist");
  });

  it("clears a highlighted output when a table row changes the graph", () => {
    start({ startingText: "a b a b" });
    generateOutput();
    row(4).clear().type("c").blur({ force: true });
    cy.interactive().find(".sequence-output .sequence").should("have.attr", "aria-pressed", "false");
  });

  it("keeps a chosen state the text still has when the text changes", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    textBox().type(" on");
    textBox().type(" ");
    inspectRow("on").should("exist");
    inspectRow("cat").should("have.class", "highlight-selected");
  });
});
