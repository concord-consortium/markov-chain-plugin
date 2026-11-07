import { maxCsvBytes } from "../../src/interactive/input/csv-limits";
import { minInputPart, minPaneSizes } from "../../src/interactive/workspace/pane-sizes";
import { clickState, dragDivider, loggedEvents, stateEllipse, stateLabels } from "../support/workspace";

const width = 1044;
const dataOnly = { useData: true, draw: false };
const allowed = { modes: dataOnly, allowCsvUpload: true };
const orderOff = { orderMatters: { startsOn: false, showSwitch: true } };
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({ mode: "runtime", width, authoredState: { ...allowed, ...authoredState }, ...options });

const uploadButton = (options?: Partial<Cypress.Timeoutable>) => cy.interactive().find(".csv-upload-button", options);
const fileInput = () => cy.interactive().find("input[type='file']");
const choose = (contents: string) => fileInput()
  .selectFile({ contents: Cypress.Buffer.from(contents), fileName: "data.csv" }, { force: true });
const status = () => cy.interactive().find(".csv-upload-status");
const question = () => cy.interactive().find(".csv-upload-question");
const replace = () => question().find("button").contains("Replace");
const cancel = () => question().find("button").contains("Cancel");
const textBox = () => cy.interactive().find("textarea[aria-label='Your text']");
// every row but the empty one at the end, where a row is added
const tableValues = () => cy.interactive().find(".input-table input").invoke("toArray")
  .invoke("map", (input: HTMLInputElement) => input.value).invoke("slice", 0, -1);
const eventsNamed = (...names: string[]) =>
  loggedEvents().invoke("filter", ([action]: [string]) => names.includes(action));
const box = (element: JQuery<HTMLElement>) => element[0].getBoundingClientRect();

const codapFile = "# name: data\n# attribute -- name: weather\n# attribute -- name: day\n" +
  "weather,day\nsunny,1\nrainy,2\n,3\nSunny,4\n";
const words = "word\ncat\ndog\n";

describe("the interactive's Upload CSV button", () => {
  it("shows only when the author allows it, in Data mode with an Input pane", () => {
    start({ allowCsvUpload: false });
    cy.interactive().find(".input-pane").should("exist");
    uploadButton().should("not.exist");
    start({ panes: { input: { available: false, startsOpen: true } }, startingText: "a b" });
    cy.interactive().find(".graph-pane").should("exist");
    uploadButton().should("not.exist");
    start({ modes: { useData: false, draw: true } });
    cy.interactive().find(".graph-pane").should("exist");
    uploadButton().should("not.exist");
  });

  (["text", "table", "textAndTable"] as const).forEach(inputView => {
    it(`shows in the ${inputView} view, after the switches`, () => {
      start({ inputView });
      uploadButton().should("have.text", "Upload CSV").and("be.enabled");
      cy.interactive().find(".input-controls .setting-switches + .csv-upload-button").should("exist");
    });
  });

  it("names what it does to a screen reader, and keeps the file input out of the Tab order", () => {
    start();
    uploadButton().invoke("attr", "aria-describedby").then(id => {
      cy.interactive().find(`[id='${id}']`)
        .should("have.text", "Starts your input from the first column of a CSV file.");
    });
    fileInput().should("have.attr", "tabindex", "-1").and("have.attr", "accept", ".csv,text/csv");
  });

  it("opens the file chooser", () => {
    start();
    fileInput().then(input => {
      cy.stub(input[0], "click").as("chooser");
    });
    uploadButton().click();
    cy.get("@chooser").should("have.been.calledOnce");
  });

  it("goes with the collapsed Input pane", () => {
    start();
    uploadButton().should("be.visible");
    cy.interactive().find("button[aria-label='Collapse Input']").click();
    uploadButton().should("not.be.visible");
  });

  it("fills the table, the text box and the graph from a file, as prose with order on", () => {
    start();
    choose(codapFile);
    tableValues().should("deep.equal", ["sunny", "rainy", "", "Sunny"]);
    textBox().should("have.value", "sunny rainy\n\nSunny");
    stateLabels().should("deep.equal", ["rainy", "sunny"]);
    status().should("have.text", "Read 3 values from the column \"weather\".");
    eventsNamed("CsvUploaded", "InputCommitted").should("deep.equal", [
      ["CsvUploaded", { rows: 4, tokens: 4, states: 2, mode: "useData" }]
    ]);
  });

  it("writes the file's values one to a line with order off", () => {
    start(orderOff);
    choose(codapFile);
    textBox().should("have.value", "sunny\nrainy\n\nSunny");
  });

  it("keeps the states' capitalization with Case sensitive on", () => {
    start({ capitalization: "asTyped" });
    choose(codapFile);
    stateLabels().should("deep.equal", ["Sunny", "rainy", "sunny"]);
  });

  it("says when it read one value, and from a column with no name", () => {
    start();
    choose(",n\ncat,1\n");
    status().should("have.text", "Read 1 value from the first column.").and("have.attr", "role", "status");
  });

  it("writes a large count with a comma", () => {
    start();
    choose(`word\n${"a\n".repeat(1234)}`);
    status().should("have.text", "Read 1,234 values from the column \"word\".");
  });

  it("works in the text view, with no table", () => {
    start({ inputView: "text" });
    choose(words);
    textBox().should("have.value", "cat dog");
    stateLabels().should("deep.equal", ["cat", "dog"]);
  });

  it("works in the table view, with no text box", () => {
    start({ inputView: "table" });
    choose(words);
    tableValues().should("deep.equal", ["cat", "dog"]);
  });

  it("asks before replacing a word typed just before the press", () => {
    start();
    fileInput().then(input => {
      cy.stub(input[0], "click");
    });
    textBox().type("mine");
    uploadButton().click();
    choose(words);
    question().should("exist");
  });

  it("asks before replacing words, and Cancel leaves them", () => {
    start({ startingText: "the old words" });
    choose(words);
    question().should("contain.text", "Replace your words with the file's?");
    replace().should("have.focus");
    cancel().click();
    question().should("not.exist");
    uploadButton().should("have.focus");
    textBox().should("have.value", "the old words");
    eventsNamed("CsvUploaded", "CsvUploadRefused").should("have.length", 0);
  });

  it("replaces the words on Replace, returning focus to the button", () => {
    start({ startingText: "the old words" });
    choose(words);
    replace().click();
    question().should("not.exist");
    textBox().should("have.value", "cat dog");
    uploadButton().should("have.focus");
    status().should("have.text", "Read 2 values from the column \"word\".");
  });

  it("writes the text in the layout showing at Replace, not when the file was chosen", () => {
    start({ startingText: "the old words" });
    choose(words);
    replace().should("have.focus");
    cy.interactive().find(".setting-switch").contains("Order matters").click();
    replace().click();
    textBox().should("have.value", "cat\ndog");
  });

  it("refuses at Replace a file that no longer fits in the layout showing", () => {
    start({ startingText: "the old words", orderMatters: { startsOn: true, showSwitch: true } });
    choose(`word\n${"a\n".repeat(16667)}${".\n".repeat(16667)}`);
    replace().should("have.focus");
    cy.interactive().find(".setting-switch").contains("Order matters").click();
    replace().click();
    status().should("contain.text", "This file is too big");
    textBox().should("have.value", "the old words");
  });

  it("brings the status line back on Cancel", () => {
    start();
    choose(words);
    textBox().should("have.value", "cat dog");
    choose(words);
    question().should("exist");
    cancel().click();
    status().should("have.text", "Read 2 values from the column \"word\".");
  });

  it("drops the question for a second file chosen while it shows", () => {
    start({ startingText: "the old words" });
    choose(words);
    question().should("exist");
    choose("word\n");
    question().should("not.exist");
    status().should("have.text", "This file has no values to use.");
  });

  it("clears a chosen state the upload removes", () => {
    start({ startingText: "the old words" });
    clickState("old");
    cy.interactive().find(".text-input mark").should("exist");
    choose(words);
    replace().click();
    cy.interactiveMessages("interactiveState").should(states => {
      const last = states[states.length - 1] as { input?: { text: string }, useData?: { selection?: unknown } };
      expect(last.input?.text).to.equal("cat dog");
      expect(last.useData?.selection).to.equal(undefined);
    });
  });

  it("cancels on Escape, keeping the chosen state", () => {
    start({ startingText: "the old words" });
    clickState("old");
    cy.interactive().find(".text-input mark").should("exist");
    choose(words);
    replace().should("have.focus").trigger("keydown", { key: "Escape" });
    question().should("not.exist");
    uploadButton().should("have.focus");
    cy.interactive().find(".text-input mark").should("exist");
    eventsNamed("SelectionCleared").should("have.length", 0);
  });

  it("refuses a file with no values, leaving the input", () => {
    start({ startingText: "the old words" });
    choose("word\n");
    status().should("have.text", "This file has no values to use.");
    question().should("not.exist");
    textBox().should("have.value", "the old words");
    eventsNamed("CsvUploadRefused").should("deep.equal", [
      ["CsvUploadRefused", { reason: "noValues", mode: "useData" }]
    ]);
  });

  it("refuses a file whose text would pass the input's limit", () => {
    start({ startingText: "the old words", ...orderOff });
    choose(`word\n${"a\n".repeat(25001)}`);
    status().should("have.text", "This file is too big: its values come to more than 50,000 characters.");
    textBox().should("have.value", "the old words");
    eventsNamed("CsvUploadRefused").should("deep.equal", [
      ["CsvUploadRefused", { reason: "tooLong", mode: "useData" }]
    ]);
  });

  it("refuses a file past 2 MB", () => {
    start({ startingText: "the old words" });
    cy.get<HTMLIFrameElement>("iframe#interactive").then(frame => {
      const win = frame[0].contentWindow as Window & typeof globalThis;
      cy.spy(win.Blob.prototype, "arrayBuffer").as("read");
    });
    fileInput().selectFile({
      contents: Cypress.Buffer.alloc(maxCsvBytes + 1, "a"), fileName: "data.csv"
    }, { force: true });
    status().should("have.text", "This file is too big to read.");
    cy.get("@read").should("not.have.been.called");
    choose(words);
    cy.get("@read").should("have.been.calledOnce");
    cancel().click();
    textBox().should("have.value", "the old words");
    eventsNamed("CsvUploadRefused").should("deep.equal", [
      ["CsvUploadRefused", { reason: "tooLarge", mode: "useData" }]
    ]);
  });

  it("reads the same file chosen twice in a row", () => {
    start();
    choose(words);
    textBox().should("have.value", "cat dog");
    fileInput().should("have.prop", "value", "");
    choose(words);
    question().should("exist");
    status().should("have.text", "");
    replace().click();
    eventsNamed("CsvUploaded").should("have.length", 2);
  });

  it("reads a file of exactly 2 MB", () => {
    start();
    fileInput().selectFile({ contents: Cypress.Buffer.alloc(maxCsvBytes, "a"), fileName: "data.csv" }, { force: true });
    status().should("have.text", "This file has no values to use.");
  });

  it("is disabled while a sequence plays", () => {
    start({ startingText: "a b a b a b" });
    cy.interactive().find(".generator-pane button").contains("Play").click();
    uploadButton().should("be.disabled");
    cy.interactive().contains(".generator-pane button", "Play", { timeout: 15000 }).should("be.enabled");
    uploadButton().should("be.enabled");
  });

  it("can't replace the input while a sequence plays", () => {
    start({ startingText: "a b a b a b" });
    choose(words);
    replace().should("be.enabled");
    cy.interactive().find(".generator-pane button").contains("Play").click();
    replace().should("be.disabled");
  });

  it("returns focus to the button when a sequence ends, after Cancel during it", () => {
    start({ startingText: "a b a b a b" });
    choose(words);
    cy.interactive().find(".generator-pane button").contains("Play").click();
    uploadButton().should("be.disabled");
    cancel().click();
    uploadButton({ timeout: 15000 }).should("be.enabled").and("be.focused");
  });

  it("leaves focus where the student moved it, after Cancel during a sequence", () => {
    start({ startingText: "a b a b a b" });
    choose(words);
    cy.interactive().find(".generator-pane button").contains("Play").click();
    uploadButton().should("be.disabled");
    cancel().click();
    textBox().focus();
    uploadButton({ timeout: 15000 }).should("be.enabled");
    textBox().should("be.focused");
  });

  it("saves the uploaded text and positions, and a restart from them shows the words where they were", () => {
    start();
    choose(words);
    const lastState = () => cy.interactiveMessages("interactiveState").invoke("at", -1) as Cypress.Chainable<any>;
    lastState().should(state => {
      expect(state.input.text).to.equal("cat dog");
      expect(state.useData.positions).to.have.length(4);
    }).then(interactiveState => {
      const [catX, catY, dogX, dogY] = interactiveState.useData.positions;
      start({}, { interactiveState });
      tableValues().should("deep.equal", ["cat", "dog"]);
      stateLabels().should("deep.equal", ["cat", "dog"]);
      stateEllipse("cat").should("have.attr", "cx", String(catX)).and("have.attr", "cy", String(catY));
      stateEllipse("dog").should("have.attr", "cx", String(dogX)).and("have.attr", "cy", String(dogY));
    });
  });

  it("shows grayed out and takes no file in the report view", () => {
    cy.startInteractive({
      mode: "report", width, authoredState: allowed, interactiveState: { version: 1, input: { text: "the cat" } }
    });
    uploadButton().should("be.disabled").and("have.css", "opacity", "0.5");
    fileInput().should("be.disabled");
  });

  it("clears the status line when a commit changes the input", () => {
    start();
    choose(words);
    status().should("contain.text", "Read 2 values");
    textBox().type(" more ");
    status().should("have.text", "");
  });

  it("keeps the status line through a commit that changes nothing", () => {
    start();
    choose(words);
    status().should("contain.text", "Read 2 values");
    textBox().focus();
    uploadButton().focus();
    status().should("contain.text", "Read 2 values");
  });

  it("shares the switches' line where the pane is wide enough", () => {
    start({}, { width: 600 });
    cy.interactive().find(".setting-switches").then(switches => {
      uploadButton().should(button => {
        expect(box(button).top).to.be.lessThan(box(switches).bottom);
        expect(box(button).bottom).to.be.greaterThan(box(switches).top);
      });
    });
  });

  it("stays inside the Input pane at its narrowest", () => {
    start();
    dragDivider("Resize Input and Graph", -1000, 0);
    cy.interactive().find(".input-pane").should(pane => expect(box(pane).width).to.equal(minPaneSizes.input));
    cy.interactive().find(".input-pane .pane-body").then(body => {
      uploadButton().should(button => expect(box(button).right).to.be.at.most(box(body).right));
    });
  });

  it("leaves the text box and the table their minimum height at the starting sizes", () => {
    start();
    choose(words);
    status().should("contain.text", "Read 2 values");
    textBox().should(text => expect(box(text).height).to.be.at.least(minInputPart));
    cy.interactive().find(".input-table").should(table => expect(box(table).height).to.be.at.least(minInputPart));
  });
});
