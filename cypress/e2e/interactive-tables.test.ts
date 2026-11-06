import { fileGap } from "../../src/interactive/tables/file-gap";
import { clickState } from "../support/workspace";

const width = 1044;
const dataOnly = { useData: true, draw: false };
const drawOnly = { useData: false, draw: true };
const onlyDownload = { buttons: { downloadTables: { available: true } } };
const onlySend = { buttons: { sendToCodap: { available: true } } };
const bothButtons = { buttons: { sendToCodap: { available: true }, downloadTables: { available: true } } };
const start = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
  cy.startInteractive({
    mode: "runtime", width, authoredState: { modes: dataOnly, ...onlyDownload, ...authoredState }, ...options
  });
const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
const tableButton = (label: string) => shown().find(".table-buttons button").contains(label);
const downloadButton = () => tableButton("Download tables");
const textBox = () => shown().find("textarea[aria-label='Your text']");
const generatorButton = (label: string) => shown().find(".generator-pane button").contains(label);
const box = (element: JQuery<HTMLElement>) => element[0].getBoundingClientRect();
const dialog = () => cy.interactive().find("dialog.tables-dialog");
const nameField = () => dialog().find(".tables-dialog-name input");
const submit = () => dialog().find("button[type='submit']");
// a key's keydown, which comes back saying whether the page stopped the browser's own handling
const pressKey = (element: HTMLElement, key: string, shiftKey = false) => {
  const win = element.ownerDocument.defaultView as Window & typeof globalThis;
  const event = new win.KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
};
const focused = () => cy.get<HTMLIFrameElement>("iframe#interactive").its("0.contentDocument")
  .invoke("querySelector", ":focus") as unknown as Cypress.Chainable<HTMLElement | null>;

const offWith = (reason: string) => {
  downloadButton().should("have.attr", "aria-disabled", "true").and("have.attr", "title", reason)
    .invoke("attr", "aria-describedby").then(id => {
      shown().find(`[id='${id}']`).should("have.text", reason);
    });
};

const isOn = () => {
  downloadButton().should("have.attr", "aria-disabled", "false").and("not.have.attr", "title");
  downloadButton().should("not.have.attr", "aria-describedby");
};

describe("the Download tables button", () => {
  it("is left out unless the author turned it on", () => {
    cy.startInteractive({
      mode: "runtime", width, authoredState: { modes: dataOnly, startingText: "the cat" },
    });
    shown().find(".controls-row").should("exist");
    shown().find(".table-buttons").should("not.exist");
  });

  it("shows on the Activity Player's page", () => {
    start({ startingText: "the cat" });
    downloadButton().should("be.visible");
  });

  it("is left out of a report", () => {
    cy.startInteractive({
      mode: "report", width, authoredState: { modes: dataOnly, ...onlyDownload },
      interactiveState: { version: 1, input: { text: "the cat" } },
    });
    shown().find(".controls-row").should("exist");
    shown().find(".table-buttons").should("not.exist");
  });

  it("sits at the row's right end, right of Clear highlight once a state is chosen", () => {
    start({ startingText: "the cat sat" });
    const atRightEnd = () => shown().find(".controls-row").then(row => {
      shown().find(".table-buttons").then(group => {
        expect(box(group).right).to.be.closeTo(box(row).right, 1);
      });
    });
    atRightEnd();
    clickState("cat");
    shown().find(".clear-highlight").then(clear => {
      shown().find(".table-buttons").then(group => {
        expect(box(group).left).to.be.greaterThan(box(clear).right);
      });
    });
    atRightEnd();
  });

  const wrapCases: [string, Record<string, unknown>, number][] = [
    ["both buttons at the narrowest side-by-side width", bothButtons, 700],
    ["Download alone in a stacked workspace", onlyDownload, 560],
  ];
  wrapCases.forEach(([name, buttons, frameWidth]) => it(`wraps as a group at the row's widest, with ${name}`, () => {
    start({
      ...buttons, startingText: "the cat sat", showCaseSwitch: true,
      orderMatters: { startsOn: true, showSwitch: true }, panes: { input: { available: false, startsOpen: true } },
    }, { width: frameWidth });
    clickState("cat");
    shown().find(".clear-highlight").should("exist");
    shown().find(".controls-row").then(row => {
      shown().find(".controls-row > :first-child").then(first => {
        shown().find(".table-buttons").then(group => {
          expect(box(group).top).to.be.at.least(box(first).bottom);
          expect(box(group).right).to.be.closeTo(box(row).right, 1);
          expect(box(group).bottom).to.be.at.most(box(row).bottom);
        });
      });
    });
    cy.interactive().find(".markov-workspace").then(workspace => {
      shown().find(".table-buttons").then(group => {
        expect(box(group).right).to.be.at.most(box(workspace).right);
      });
    });
  }));

  it("is off with its reason with no words, and on once there are some", () => {
    start();
    offWith("Add some words first.");
    textBox().type("the cat ");
    isOn();
  });

  it("is off with Draw mode's reason in an empty drawing", () => {
    start({ modes: drawOnly, startingMode: "draw" });
    offWith("Draw something first.");
  });

  it("goes by the showing mode, not the other mode's work", () => {
    start({ modes: { useData: true, draw: true }, startingText: "the cat" });
    isOn();
    shown().find(".mode-switch label").contains("Draw").click();
    offWith("Draw something first.");
  });

  it("is off while a sequence plays and while it is paused", () => {
    start({ startingText: "a b a b a" });
    isOn();
    generatorButton("Play").click();
    offWith("Wait for the sequence to finish.");
    generatorButton("Pause").click();
    generatorButton("Resume").should("exist");
    offWith("Wait for the sequence to finish.");
  });
});

describe("the tables popup", () => {
  const choice = (label: string) => dialog().find("fieldset label").contains(label);
  const checkbox = (label: string) => choice(label).find("input");
  const choiceLabels = () => dialog().find("fieldset label").invoke("toArray")
    .invoke("map", (label: Element) => label.textContent);
  const cancel = () => dialog().find("button").contains("Cancel");
  const open = () => downloadButton().click();
  const expectFocusOnButton = () => focused().should(element => {
    expect(element?.textContent).to.equal("Download tables");
  });
  const expectStateStaysChosen = () => shown().find(".clear-highlight").should("exist");
  const drawing = {
    nodes: [{ id: "n1", label: "Sun", value: 1, x: 0, y: 0 }, { id: "n2", label: "Rain", value: 1, x: 90, y: 0 }],
    edges: [{ from: "n1", to: "n2", value: 1 }],
  };
  const outputs = {
    groups: [{ delimiter: " ", lengthLimit: 5, startingState: "", sequences: [[0, 1]] }], states: ["a", "b"],
  };
  // stretches the gap between files, so a test can act while the popup is busy
  const slowDownloads = () => cy.get<HTMLIFrameElement>("iframe#interactive").its("0.contentWindow").then(win => {
    const { setTimeout: realSetTimeout } = win as Window & typeof globalThis;
    (win as any).setTimeout = (handler: () => void, ms: number) =>
      realSetTimeout.call(win, handler, ms === fileGap ? 1500 : ms);
  });
  const pressDownloadThenSeeBusy = () => {
    slowDownloads();
    submit().click();
    submit().should("have.text", "Downloading...");
  };

  it("opens titled for its button, with the first name and its focus inside", () => {
    start({ startingText: "the cat sat" });
    open();
    dialog().should("have.attr", "open");
    dialog().find("h2").should("have.text", "Download tables");
    dialog().invoke("attr", "aria-labelledby").then(id => {
      dialog().find(`[id='${id}']`).should("have.text", "Download tables");
    });
    nameField().should("have.value", "Data1").and("have.attr", "maxlength", "50");
    focused().should(element => expect(element?.closest("dialog")).to.exist);
  });

  it("sits under the row, not at the center of a tall frame", () => {
    start({ startingText: "the cat sat" });
    open();
    dialog().then(element => expect(box(element).top).to.be.closeTo(40, 1));
  });

  it("gives focus back to the button after Cancel and after the browser's cancel event", () => {
    start({ startingText: "the cat sat" });
    open();
    cancel().click();
    dialog().should("not.exist");
    expectFocusOnButton();
    downloadButton().focus().click();
    dialog().trigger("cancel");
    dialog().should("not.exist");
    expectFocusOnButton();
  });

  it("leaves the graph's choice alone when Escape is pressed", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    open();
    nameField().type("{esc}");
    expectStateStaysChosen();
  });

  it("stays open, focused and deaf to Escape while it is busy", () => {
    start({ startingText: "the cat sat" });
    clickState("cat");
    open();
    pressDownloadThenSeeBusy();
    focused().should(element => expect(element?.tagName).to.equal("DIALOG"));
    dialog().type("{esc}");
    expectStateStaysChosen();
    dialog().then(element => expect(pressKey(element[0], "Escape").defaultPrevented).to.equal(true));
    dialog().trigger("cancel");
    dialog().should("have.attr", "open");
  });

  describe("Tab", () => {
    it("wraps from the last control to the first and back, so it can't reach the host's page", () => {
      start({ startingText: "the cat sat" });
      open();
      submit().focus().then(button => expect(pressKey(button[0], "Tab").defaultPrevented).to.equal(true));
      focused().should(element => expect(element?.getAttribute("type")).to.equal("text"));
      nameField().then(field => expect(pressKey(field[0], "Tab", true).defaultPrevented).to.equal(true));
      focused().should(element => expect(element?.textContent).to.equal("Download"));
    });

    it("leaves Tab to the browser between the first and last controls", () => {
      start({ startingText: "the cat sat" });
      open();
      nameField().focus().then(field => expect(pressKey(field[0], "Tab").defaultPrevented).to.equal(false));
    });

    it("skips a turned-off control when it wraps", () => {
      start({ startingText: "the cat sat" });
      open();
      nameField().clear();
      cancel().focus().then(button => expect(pressKey(button[0], "Tab").defaultPrevented).to.equal(true));
      focused().should(element => expect(element?.getAttribute("type")).to.equal("text"));
    });

    it("stays on the dialog while every control is off", () => {
      start({ startingText: "the cat sat" });
      open();
      pressDownloadThenSeeBusy();
      dialog().then(element => expect(pressKey(element[0], "Tab").defaultPrevented).to.equal(true));
      focused().should(element => expect(element?.tagName).to.equal("DIALOG"));
    });
  });

  it("stays open when the backdrop is clicked", () => {
    start({ startingText: "the cat sat" });
    open();
    dialog().click(-20, -20, { force: true });
    dialog().should("have.attr", "open");
  });

  it("offers every table in Data mode, with Outputs faded until there are some", () => {
    start({ startingText: "the cat sat" });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Transitions", "Outputs (none yet)"]);
    ["Input data", "States", "Transitions"].forEach(label => checkbox(label).should("be.checked").and("be.enabled"));
    checkbox("Outputs").should("not.be.checked").and("be.disabled");
    choice("Outputs").should("have.class", "empty").and("have.css", "opacity", "0.5");
  });

  it("offers Outputs checked once there are some", () => {
    start({ startingText: "a b a" }, { interactiveState: { version: 1, useData: { outputs } } });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Transitions", "Outputs"]);
    checkbox("Outputs").should("be.checked").and("be.enabled");
  });

  it("marks Transitions empty with one word", () => {
    start({ startingText: "cat" });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Transitions (none yet)", "Outputs (none yet)"]);
    checkbox("Transitions").should("not.be.checked").and("be.disabled");
  });

  it("offers no Transitions with Order matters off", () => {
    start({ startingText: "the cat sat", orderMatters: { startsOn: false, showSwitch: true } });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Outputs (none yet)"]);
  });

  it("offers no Outputs without the Sequence Generator", () => {
    start({ startingText: "the cat sat", panes: { generator: { available: false, startsOpen: true } } });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Transitions"]);
  });

  it("offers the tables with the Input and Inspect panes hidden", () => {
    start({
      startingText: "the cat sat",
      panes: { input: { available: false, startsOpen: true }, inspect: { available: false, startsOpen: true } },
    });
    open();
    choiceLabels().should("deep.equal", ["Input data", "States", "Transitions", "Outputs (none yet)"]);
  });

  it("offers no Input data in Draw mode", () => {
    start({ modes: drawOnly, startingMode: "draw" }, { interactiveState: { version: 1, draw: { drawing } } });
    open();
    choiceLabels().should("deep.equal", ["States", "Transitions", "Outputs (none yet)"]);
    nameField().should("have.value", "Drawing1");
  });

  it("starts each opening over", () => {
    start({ startingText: "the cat sat" });
    open();
    checkbox("States").uncheck();
    nameField().clear().type("Mine");
    cancel().click();
    open();
    checkbox("States").should("be.checked");
    nameField().should("have.value", "Data1");
  });

  it("turns Download off with an empty name or nothing checked", () => {
    start({ startingText: "the cat sat" });
    open();
    submit().should("be.enabled").and("have.text", "Download");
    nameField().clear();
    submit().should("be.disabled");
    nameField().type("   ");
    submit().should("be.disabled");
    nameField().type("Mine");
    submit().should("be.enabled");
    ["Input data", "States", "Transitions"].forEach(label => checkbox(label).uncheck());
    submit().should("be.disabled");
    checkbox("States").check();
    submit().should("be.enabled");
  });

  it("ignores a second submit while it is busy", () => {
    start({ startingText: "the cat sat" });
    open();
    pressDownloadThenSeeBusy();
    dialog().find("form").then(form => (form[0] as HTMLFormElement).requestSubmit());
    cy.interactive().find("dialog.tables-dialog", { timeout: 10000 }).should("not.exist");
    open();
    nameField().should("have.value", "Data2");
  });

  it("downloads only the chosen tables, under the trimmed name", () => {
    start({ startingText: "the [a, b] cat" });
    open();
    nameField().clear().type("  Mine/1  ");
    checkbox("Transitions").uncheck();
    submit().click();
    dialog().should("not.exist");
    expectFocusOnButton();
    cy.readFile("cypress/downloads/Mine_1_Transitions.csv").should("not.exist");
    cy.readFile("cypress/downloads/Mine_1_Input.csv").should("equal",
      "\uFEFFWord,Position\r\nthe,1\r\n\"a, b\",2\r\ncat,3\r\n");
    cy.readFile("cypress/downloads/Mine_1_States.csv").should("equal",
      "\uFEFFState,Count\r\n\"a, b\",1\r\ncat,1\r\nthe,1\r\n");
  });

  it("numbers names per mode, and Cancel leaves the count", () => {
    start({ startingText: "the cat sat", modes: { useData: true, draw: true } },
      { interactiveState: { version: 1, draw: { drawing } } });
    open();
    cancel().click();
    open();
    nameField().should("have.value", "Data1");
    submit().click();
    dialog().should("not.exist");
    open();
    nameField().should("have.value", "Data2");
    cancel().click();
    shown().find(".mode-switch label").contains("Draw").click();
    open();
    nameField().should("have.value", "Drawing1");
    submit().click();
    dialog().should("not.exist");
    cy.readFile("cypress/downloads/Drawing1_States.csv").should("equal", "\uFEFFState\r\nRain\r\nSun\r\n");
    open();
    nameField().should("have.value", "Drawing2");
    cy.interactiveMessages("log").invoke("filter", ({ action }: { action: string }) => action === "TablesDownloaded")
      .invoke("map", ({ data }: { data: { mode: string } }) => data.mode).should("deep.equal", ["useData", "draw"]);
  });

  it("saves the count, so the next name carries on after a reopen", () => {
    start({ startingText: "the cat sat" });
    open();
    submit().click();
    dialog().should("not.exist");
    cy.interactiveMessages("interactiveState", { timeout: 5000 }).should("not.be.empty").invoke("at", -1)
      .then((state: any) => {
        expect(state.useData.tablesSaved).to.equal(1);
        start({ startingText: "the cat sat" }, { interactiveState: state });
      });
    open();
    nameField().should("have.value", "Data2");
  });

  it("logs each step with its mode", () => {
    start({ startingText: "the cat sat" });
    open();
    cancel().click();
    open();
    dialog().trigger("cancel");
    open();
    checkbox("Transitions").uncheck();
    checkbox("Input data").uncheck();
    checkbox("Input data").check();
    submit().click();
    dialog().should("not.exist");
    cy.interactiveMessages("log").invoke("filter", ({ action }: { action: string }) => action.startsWith("Tables"))
      .invoke("map", ({ action, data }: { action: string, data: unknown }) => [action, data])
      .should("deep.equal", [
        ["TablesDialogOpened", { action: "download", mode: "useData" }],
        ["TablesDialogCanceled", { action: "download", mode: "useData" }],
        ["TablesDialogOpened", { action: "download", mode: "useData" }],
        ["TablesDialogCanceled", { action: "download", mode: "useData" }],
        ["TablesDialogOpened", { action: "download", mode: "useData" }],
        ["TablesDownloaded", { name: "Data1", tables: ["Input", "States"], mode: "useData" }],
      ]);
  });

  it("opens nothing from an off button, which stays in the Tab order", () => {
    start();
    downloadButton().should("not.have.attr", "disabled");
    downloadButton().should("not.have.attr", "tabindex");
    downloadButton().click();
    dialog().should("not.exist");
    cy.interactiveMessages("log").invoke("filter", ({ action }: { action: string }) => action.startsWith("Tables"))
      .should("have.length", 0);
  });
});

describe("Send to CODAP", () => {
  const sendButton = () => tableButton("Send to CODAP");
  const checkbox = (label: string) => dialog().find("fieldset label").contains(label).find("input");
  const close = () => dialog().find("button").contains("Close");
  const startSend = (authoredState: Record<string, unknown> = {}, options: Record<string, unknown> = {}) =>
    start({ ...onlySend, startingText: "the cat sat", ...authoredState }, options);
  const refusingStore = { objectStorageConfig: { version: 2, type: "demo" } };
  const tableEvents = () => cy.interactiveMessages("log")
    .invoke("filter", ({ action }: { action: string }) => action.startsWith("TablesSen"))
    .invoke("map", ({ action, data }: { action: string, data: unknown }) => [action, data]);
  const saved = "Your tables have been saved as Mine. " +
    "Open the CODAP window on this page and choose this name in the Datalog plugin.";
  const failed = "Your tables couldn't be saved. Check your connection and try again.";

  it("shows when the author turned it on and the host has object storage", () => {
    startSend();
    sendButton().should("be.visible");
  });

  it("is left out unless the author turned it on", () => {
    start({ startingText: "the cat sat" });
    downloadButton().should("exist");
    shown().find(".table-buttons button").should("have.length", 1);
  });

  it("is left out with a host that has no object storage", () => {
    startSend({}, { objectStorageConfig: null });
    shown().find(".controls-row").should("exist");
    shown().find(".table-buttons").should("not.exist");
  });

  it("is left out of a report", () => {
    cy.startInteractive({
      mode: "report", width, authoredState: { modes: dataOnly, ...onlySend },
      interactiveState: { version: 1, input: { text: "the cat" } },
    });
    shown().find(".controls-row").should("exist");
    shown().find(".table-buttons").should("not.exist");
  });

  it("comes before Download tables", () => {
    start({ ...bothButtons, startingText: "the cat sat" });
    shown().find(".table-buttons button").invoke("toArray").invoke("map", (button: Element) => button.textContent)
      .should("deep.equal", ["Send to CODAP", "Download tables"]);
  });

  it("shares a count with Download tables", () => {
    start({ ...bothButtons, startingText: "the cat sat" });
    downloadButton().click();
    submit().click();
    dialog().should("not.exist");
    sendButton().click();
    nameField().should("have.value", "Data2");
  });

  it("opens the popup titled for its button, with Send", () => {
    startSend();
    sendButton().click();
    dialog().find("h2").should("have.text", "Send to CODAP");
    submit().should("have.text", "Send");
  });

  it("reads Saving... while it saves", () => {
    startSend();
    sendButton().click();
    submit().then(button => {
      const labels: (string | null)[] = [];
      const win = button[0].ownerDocument.defaultView as Window & typeof globalThis;
      new win.MutationObserver(() => labels.push(button[0].textContent))
        .observe(button[0], { characterData: true, childList: true, subtree: true });
      cy.wrap(labels).as("labels");
    });
    submit().click();
    close().should("exist");
    cy.get("@labels").should("include", "Saving...");
  });

  it("says where to find the tables until the student closes it, then gives focus back", () => {
    startSend();
    sendButton().click();
    nameField().clear().type("Mine");
    submit().click();
    dialog().find("p").should("have.text", saved);
    focused().should(element => expect(element?.textContent).to.equal("Close"));
    close().invoke("attr", "aria-describedby").then(id => {
      dialog().find(`[id='${id}']`).should("have.text", saved);
    });
    cy.wait(3000);
    dialog().find("p").should("have.text", saved);
    close().then(button => expect(pressKey(button[0], "Tab").defaultPrevented).to.equal(true));
    focused().should(element => expect(element?.textContent).to.equal("Close"));
    close().click();
    dialog().should("not.exist");
    focused().should(element => expect(element?.textContent).to.equal("Send to CODAP"));
    sendButton().click();
    nameField().should("have.value", "Data2");
  });

  it("closes the confirmation with the browser's cancel event, without logging a cancel", () => {
    startSend();
    sendButton().click();
    submit().click();
    close().should("exist");
    dialog().trigger("cancel");
    dialog().should("not.exist");
    focused().should(element => expect(element?.textContent).to.equal("Send to CODAP"));
    cy.interactiveMessages("log")
      .invoke("filter", ({ action }: { action: string }) => action === "TablesDialogCanceled")
      .should("have.length", 0);
    sendButton().click();
    nameField().should("have.value", "Data2");
  });

  it("keeps the popup and its choices after a failed save, and leaves the count", () => {
    startSend({}, refusingStore);
    sendButton().click();
    nameField().clear().type("Mine");
    checkbox("States").uncheck();
    submit().click();
    dialog().find("[role='alert']").should("have.text", failed);
    nameField().should("have.value", "Mine");
    checkbox("States").should("not.be.checked");
    checkbox("Transitions").should("be.checked");
    submit().should("be.enabled").and("have.text", "Send");
    focused().should(element => expect(element?.tagName).to.equal("DIALOG"));
    dialog().then(element => expect(pressKey(element[0], "Tab", true).defaultPrevented).to.equal(true));
    focused().should(element => expect(element?.textContent).to.equal("Send"));
    tableEvents().should("deep.equal", [
      ["TablesSendFailed", { name: "Mine", tables: ["Input", "Transitions"], mode: "useData" }],
    ]);
    dialog().find("button").contains("Cancel").click();
    sendButton().click();
    nameField().should("have.value", "Data1");
  });

  it("logs a send and saves the count", () => {
    startSend();
    sendButton().click();
    submit().click();
    close().should("exist");
    tableEvents().should("deep.equal", [
      ["TablesSent", { name: "Data1", tables: ["Input", "States", "Transitions"], mode: "useData" }],
    ]);
    cy.interactiveMessages("interactiveState", { timeout: 5000 }).should("not.be.empty").invoke("at", -1)
      .its("useData.tablesSaved").should("equal", 1);
  });

  describe("the limit on the Outputs table", () => {
    // small as saved, since a state is stored once, and 1.2 MB as a table
    const longState = "x".repeat(2000);
    const outputsOf = (count: number) => ({
      states: [longState], groups: [{
        delimiter: " ", lengthLimit: 5, startingState: "", sequences: Array.from({ length: count }, () => [0]),
      }],
    });
    const interactiveState = { version: 1, useData: { outputs: outputsOf(600) } };
    const expectStopped = () => {
      generatorButton("Play").should("be.disabled");
      generatorButton("Step").should("be.disabled");
      shown().find(".output-limit").should("have.text", "You have reached the maximum number of outputs.");
    };

    it("stops generating where Send to CODAP shows", () => {
      startSend({ startingText: "a b a" }, { interactiveState });
      expectStopped();
    });

    it("counts the other mode's Outputs table too", () => {
      startSend({ startingText: "a b a", modes: { useData: true, draw: true }, startingMode: "useData" },
        { interactiveState: { version: 1, draw: { outputs: outputsOf(600) } } });
      expectStopped();
    });

    it("stops generating when a sequence ending reaches it, and logs that", () => {
      startSend({ startingText: `${longState} ${longState}` }, {
        interactiveState: {
          version: 1, useData: { outputs: outputsOf(490), generator: { lengthLimit: 5, fast: true } },
        },
      });
      generatorButton("Play").should("be.enabled").click();
      shown().find(".output-limit", { timeout: 20000 })
        .should("have.text", "You have reached the maximum number of outputs.");
      expectStopped();
      cy.interactiveMessages("log")
        .invoke("filter", ({ action }: { action: string }) => action === "OutputLimitReached")
        .should("have.length", 1).its(0).its("data.outputs").should("equal", 491);
    });

    it("leaves other pages to the saved limit alone", () => {
      start({ startingText: "a b a" }, { interactiveState });
      generatorButton("Play").should("be.enabled");
      generatorButton("Step").should("be.enabled");
      shown().find(".output-limit").should("be.empty");
    });
  });
});
