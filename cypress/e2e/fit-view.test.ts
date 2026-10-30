import { graphInsideView, rootTransform } from "../support/graph";

const fixture = "ela/geDiXLf2GyHsWCF2QFnU.json";

describe("Fit view after the graph changes", () => {
  it("fits a drawing saved without a version", () => {
    cy.fixture(fixture).then(({ version, ...state }) => cy.startPlugin({ savedState: state }));
    rootTransform().should("match", /scale/).then(fitted => {
      cy.plugin().find("button[title='Fit View']").click();
      rootTransform().should("equal", fitted);
    });
  });

  it("refits a loaded drawing on Reset", () => {
    cy.fixture(fixture).then(state => cy.startPlugin({ savedState: state }));
    rootTransform().should("match", /scale/).then(fitted => {
      cy.plugin().find(".plusButton").click();
      cy.plugin().find(".plusButton").click();
      rootTransform().should("not.equal", fitted);
      cy.plugin().find("button[title='Reset']").click();
      cy.plugin().contains("button", "Ok").click();
      rootTransform().should("equal", fitted);
    });
  });

  it("refits when the cases change", () => {
    cy.startPlugin({ attribute: "Word" });
    cy.plugin().find("g.node").should("have.length", 5);
    cy.plugin().find("button[title='Fit View']").click();
    rootTransform().should("match", /scale/).then(before => {
      cy.setAttributeValues("Word", ["dog", "ran", "far", "dog"]);
      cy.notifyCases("createCases");
      cy.plugin().find("g.node").should("have.length", 3);
      rootTransform().should("not.equal", before);
    });
  });

  it("refits when a second attribute is dropped", () => {
    cy.startPlugin();
    cy.plugin().contains("button", "Dataset").click();
    cy.dropAttribute("Word");
    cy.plugin().find("g.node").should("have.length", 5);
    cy.plugin().find("button[title='Fit View']").click();
    rootTransform().should("match", /scale/).then(before => {
      cy.dropAttribute("Letter");
      cy.plugin().find("g.node").should("have.length", 3);
      rootTransform().should("not.equal", before);
    });
  });

  it("fits a drawing started after Reset once the plugin is resized", () => {
    cy.startPlugin();
    cy.plugin().contains("button", "Drawing").click();
    cy.plugin().find("button[title='Add State']").click();
    cy.plugin().find(".graph > svg").click();
    cy.plugin().find("g.node").should("have.length", 1);
    cy.plugin().find("button[title='Reset']").click();
    cy.plugin().contains("button", "Ok").click();
    cy.plugin().find("g.node").should("not.exist");
    // Add State stays selected after Reset, and pressing it again would turn it off
    cy.plugin().find(".graph > svg").click();
    cy.plugin().find("g.node").should("have.length", 1);
    cy.resizePlugin(700, 500);
    rootTransform().should("match", /scale/);
    // the state is drawn at the view's center, so this checks the fit's scale and not its centering
    graphInsideView();
  });
});
