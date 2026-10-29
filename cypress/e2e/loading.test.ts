const elaDocuments = [
  "4gqlICXB3YqN3AfivyZZ",
  "9nsC6KpuDstv2N9eGndM",
  "geDiXLf2GyHsWCF2QFnU",
  "lr1YsZHAZ1KYXxk67jD2",
  "pnRUlM27cXXrJrofZAXx"
];

describe("Loading", () => {
  it("shows Loading until CODAP answers interactiveFrame", () => {
    cy.startPlugin({ holdInit: true });
    cy.plugin().contains("Loading ...");
    cy.fakeCodap().its("requests").should("have.length.at.least", 2);
    cy.plugin().contains("Loading ...");
    cy.releaseInit();
    cy.plugin().contains("Select Mode");
  });

  elaDocuments.forEach(id => {
    it(`draws every state and transition of ELA document ${id}`, () => {
      cy.fixture(`ela/${id}.json`).then(state => {
        const transitions = state.edges.filter((e: any) => e.from !== e.to);
        cy.startPlugin({ savedState: state });
        cy.plugin().find("button[title='Add State']").should("exist");
        cy.plugin().find("g.node").should("have.length", state.nodes.length);
        cy.plugin().find("line.edge").should("have.length", transitions.length);
      });
    });
  });
});
