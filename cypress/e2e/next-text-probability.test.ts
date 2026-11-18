const year = new Date().getFullYear();

const openAndCloseAbout = () => {
  cy.contains("footer button", "About").focus();
  cy.focused().click();
  cy.get("dialog").should("be.visible").and("have.focus")
    .and("contain.text", "Next Text Probability is free, open-source software.")
    .should($dialog => expect($dialog[0].matches(":modal")).to.equal(true));
  cy.get("dialog").trigger("keydown", { key: "Escape" });
  cy.get("dialog").should("not.exist");
  cy.focused().should("have.text", "About");
};

describe("the Next Text Probability pages", () => {
  it("shows the interactive with its header, footer and About", () => {
    cy.visit("/next-text-probability/index.html");
    cy.title().should("equal", "Next Text Probability");
    cy.get("header h1").should("have.text", "Next Text Probability");
    cy.get("main").contains("h2", "Graph").should("be.visible");
    cy.get("footer").should("contain.text", `© ${year} The Concord Consortium, Inc.`)
      .find("svg[aria-hidden='true']").should("be.visible");
    cy.get("footer").should("have.css", "border-top-width", "1px");
    openAndCloseAbout();
  });
});
