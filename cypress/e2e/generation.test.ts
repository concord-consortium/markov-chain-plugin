const itemsSent = () => cy.fakeCodap().its("items");

describe("Generating sequences", () => {
  it("plays a sequence into the output and to CODAP", () => {
    cy.fixture("chain.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=20&normalSpeed=20" }));
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Play").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    itemsSent().should("deep.equal", ["a", "b", "c"].map(State => ({ "Sequence number": 0, State })));
  });

  it("steps a sequence one state at a time", () => {
    cy.fixture("chain.json").then(state => cy.startPlugin({ savedState: state }));
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b");
    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    itemsSent().should("have.length", 0);
    cy.plugin().contains("button", "Step").click();
    itemsSent().should("deep.equal", ["a", "b", "c"].map(State => ({ "Sequence number": 0, State })));
  });

  it("pauses and resumes", () => {
    cy.fixture("cycle.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=50&normalSpeed=200" }));
    cy.plugin().find("input[type=number]").clear();
    cy.plugin().find("input[type=number]").type("12{enter}");
    cy.plugin().contains("button", "Play").click();
    cy.plugin().contains("button", "Pause").click();
    cy.plugin().find(".sequence").invoke("text").then(paused => {
      cy.wait(1000); // five animation steps at this speed
      cy.plugin().find(".sequence").should("have.text", paused);
    });
    cy.plugin().contains("button", "Resume").click();
    cy.plugin().contains("button", "Play", { timeout: 15000 });
    cy.plugin().find(".sequence").invoke("text").should("match", /^([ab] ){11}[ab]$/);
    itemsSent().should("have.length", 12);
  });

  it("cancels a sequence without sending it to CODAP", () => {
    cy.fixture("cycle.json").then(state =>
      cy.startPlugin({ savedState: state, query: "fastSpeed=20&normalSpeed=100" }));
    cy.plugin().contains("button", "Play").click();
    cy.plugin().contains("button", "Cancel").click();
    cy.plugin().contains("button", "Play").should("be.enabled");
    cy.wait(2000); // twice a whole run at this speed
    itemsSent().should("have.length", 0);
  });
});
