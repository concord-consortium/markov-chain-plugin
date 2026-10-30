describe("the interactive's report item", () => {
  beforeEach(() => {
    cy.startInteractive({ mode: "reportItem", interactiveState: { version: 1 } });
    cy.interactiveMessages("reportItemClientReady").should("deep.equal", [{ compactAnswerReportItemsAvailable: true }]);
    cy.interactiveMessages("height").should("have.length.greaterThan", 0);
  });

  it("answers a full answer with the placeholder", () => {
    cy.requestReportItemAnswer("fullAnswer").then(answer => {
      expect(answer).to.include({ version: "2.1.0", platformUserId: "student1", itemsType: "fullAnswer" });
      expect(answer.items).to.have.length(1);
      expect(answer.items[0].type).to.equal("html");
      expect(answer.items[0].html).to.contain("This student opened the Markov interactive.");
    });
  });

  it("answers a compact answer with no items, for the student the request names", () => {
    cy.requestReportItemAnswer("compactAnswer", "student2")
      .should("deep.include", { platformUserId: "student2", itemsType: "compactAnswer", items: [] });
  });
});
