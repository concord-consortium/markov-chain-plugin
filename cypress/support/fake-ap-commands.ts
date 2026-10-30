import type { FakeAp, InteractiveMessage, ItemsType, StartOptions } from "../fake-ap/fake-ap";

Cypress.Commands.add("fakeAp", () => cy.window().its("fakeAp") as Cypress.Chainable<FakeAp>);

Cypress.Commands.add("startInteractive", (options: StartOptions) => {
  cy.visit("/fake-ap.html");
  cy.fakeAp().then(fake => fake.start(options));
});

Cypress.Commands.add("interactive", () =>
  cy.get("iframe#interactive").its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body)));

// its() and invoke() are queries, so a should() after this retries until the messages it expects arrive
Cypress.Commands.add("interactiveMessages", (type: string, options?: Partial<Cypress.Timeoutable>) =>
  cy.fakeAp().its("messages", options)
    .invoke("filter", (message: InteractiveMessage) => message.type === type)
    .invoke("map", (message: InteractiveMessage) => message.content));

// the root element's own height, which, unlike the page's scrollHeight, doesn't grow with the frame; both are read
// again on each retry, since the form can still be settling when the check starts
Cypress.Commands.add("frameFitsInteractive", () => {
  cy.get<HTMLIFrameElement>("iframe#interactive").should(frame => {
    const root = frame[0].contentDocument?.querySelector(".markov-interactive");
    expect(root, "the interactive's root element").not.to.equal(null);
    expect(frame.height()).to.equal(Math.ceil(root?.getBoundingClientRect().height ?? 0));
  });
});

// then() waits for the page's promise, which resolves with the report item's answer
Cypress.Commands.add("requestReportItemAnswer", (itemsType: ItemsType) =>
  cy.fakeAp().then(fake => fake.requestReportItemAnswer(itemsType)));
