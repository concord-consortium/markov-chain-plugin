const labels = () => cy.plugin().find("g.node text").then(texts => texts.toArray().map(text => text.textContent));

describe("Dataset mode", () => {
  beforeEach(() => {
    cy.startPlugin();
    cy.plugin().contains("button", "Dataset").click();
    cy.plugin().contains("first drag an attribute");
    cy.dropAttribute("Word");
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("builds the graph from a dropped attribute and rebuilds it when cases change", () => {
    labels().should("have.members", ["the", "cat", "sat", "on", "mat"]);
    cy.setAttributeValues("Word", ["dog", "ran", "dog"]);
    cy.notifyCases("createCases");
    cy.plugin().find("g.node").should("have.length", 2);
    labels().should("have.members", ["dog", "ran"]);
  });

  it("rebuilds the graph on Reset", () => {
    cy.plugin().find("button[title='Reset']").click();
    cy.plugin().contains("button", "Ok").click();
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("keeps running when the dropped attribute is renamed", () => {
    cy.renameAttribute("Word", "Words");
    cy.notifyCases("updateCases");
    cy.plugin().contains("first drag an attribute");
    cy.plugin().find("g.node").should("not.exist");
  });
});

describe("Drawing mode", () => {
  beforeEach(() => {
    cy.startPlugin();
    cy.plugin().contains("button", "Drawing").click();
    cy.plugin().find("button[title='Create From Text']").click();
    cy.plugin().find("textarea").type("the cat sat on the mat");
    cy.plugin().find("g.node").should("have.length", 5);
  });

  it("builds a state for each distinct word typed", () => {
    labels().should("have.members", ["the", "cat", "sat", "on", "mat"]);
  });

  it("draws the same graph after saving and reopening", () => {
    cy.getPluginState().then(state => {
      expect(state.nodes).to.have.length(5);
      expect(state.edges).to.have.length(5);
      cy.restartPlugin(state);
      cy.plugin().find("g.node").should("have.length", 5).each(node => {
        const saved = state.nodes.find((n: any) => n.label === node.text());
        expect(Number(node.find("ellipse").attr("cx"))).to.be.closeTo(saved.x, 1e-6);
        expect(Number(node.find("ellipse").attr("cy"))).to.be.closeTo(saved.y, 1e-6);
      });
      cy.plugin().find("line.edge").should("have.length", state.edges.length);
    });
  });

  it("goes back to the mode menu", () => {
    cy.plugin().find("button[title='Back to Main']").click();
    cy.plugin().contains("button", "Ok").click();
    cy.plugin().contains("Select Mode");
  });
});
