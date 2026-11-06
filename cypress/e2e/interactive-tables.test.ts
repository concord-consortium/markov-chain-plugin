import { clickState } from "../support/workspace";

const width = 1044;
const dataOnly = { useData: true, draw: false };
const drawOnly = { useData: false, draw: true };
const onlyDownload = { buttons: { downloadTables: { available: true } } };
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

  it("wraps as a group onto its own line at the row's widest, still at the right", () => {
    start({
      startingText: "the cat sat", showCaseSwitch: true, orderMatters: { startsOn: true, showSwitch: true },
      panes: { input: { available: false, startsOpen: true } },
    }, { width: 560 });
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
  });

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
