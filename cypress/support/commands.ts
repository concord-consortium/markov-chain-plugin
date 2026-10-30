import type { FakeCodap } from "../fake-codap/fake-codap";
import type { StartPluginOptions } from "./index";

Cypress.Commands.add("fakeCodap", () => cy.window().its("fakeCodap") as Cypress.Chainable<FakeCodap>);

Cypress.Commands.add("startPlugin", ({ attribute, ...options }: StartPluginOptions = {}) => {
  cy.visit("/fake-codap.html");
  cy.fakeCodap().then(fake => {
    const dataset = options.dataset ?? fake.dataset();
    const savedState = attribute
      ? {
        attribute: { datasetName: dataset.name, collectionName: dataset.collection, attributeName: attribute },
        viewMode: "dataset"
      }
      : options.savedState;
    fake.start({ ...options, savedState });
  });
});

Cypress.Commands.add("plugin", () =>
  cy.get("iframe#plugin").its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body)));

// commands that wait on the plugin return the page's promise from then(), which Cypress waits for
Cypress.Commands.add("releaseInit", () => { cy.fakeCodap().then(fake => fake.releaseInit()); });
Cypress.Commands.add("setAttributeValues", (name: string, values: unknown[]) => {
  cy.fakeCodap().then(fake => fake.setAttributeValues(name, values));
});
Cypress.Commands.add("renameAttribute", (from: string, to: string) => {
  cy.fakeCodap().then(fake => fake.renameAttribute(from, to));
});
Cypress.Commands.add("dropAttribute", (name: string) => { cy.fakeCodap().then(fake => fake.dropAttribute(name)); });
Cypress.Commands.add("notifyCases", operation => { cy.fakeCodap().then(fake => fake.notifyCases(operation)); });
Cypress.Commands.add("getPluginState", () =>
  cy.fakeCodap().then(fake => fake.getInteractiveState()).then(response => response.values));
Cypress.Commands.add("restartPlugin", (savedState: unknown) => {
  cy.fakeCodap().then(fake => fake.restart(savedState));
});
Cypress.Commands.add("resizePlugin", (width: number, height: number) => {
  cy.fakeCodap().then(fake => fake.resize(width, height));
});

// the graph reads two clicks on a state within 250 ms as a double-click (graph.tsx)
const doubleClickTime = 250;

const triggerStateClick = (label: string) => {
  // a click event alone: Cypress's mousedown and mouseup also start d3's drag handling, which throws in this frame
  cy.plugin().find("g.node").filter((i, node) => node.textContent === label).find("ellipse").trigger("click");
};

Cypress.Commands.add("clickState", (label: string) => {
  cy.wait(doubleClickTime + 10);
  triggerStateClick(label);
});
Cypress.Commands.add("doubleClickState", (label: string) => {
  cy.wait(doubleClickTime + 10);
  triggerStateClick(label);
  triggerStateClick(label);
});
