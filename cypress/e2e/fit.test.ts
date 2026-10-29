import { rootTransform } from "../support/graph";

describe("Fit and recenter", () => {
  beforeEach(() => {
    cy.fixture("ela/geDiXLf2GyHsWCF2QFnU.json").then(state => cy.startPlugin({ savedState: state }));
    rootTransform().should("match", /scale/);
  });

  it("fits a loaded drawing inside the view", () => {
    cy.plugin().find(".graph > svg").then(svg => {
      const view = svg[0].getBoundingClientRect();
      const graph = svg[0].querySelector("g.root")!.getBoundingClientRect();
      expect(graph.left).to.be.at.least(view.left);
      expect(graph.right).to.be.at.most(view.right);
      expect(graph.top).to.be.at.least(view.top);
      expect(graph.bottom).to.be.at.most(view.bottom);
    });
  });

  it("returns to the fitted view after zooming in", () => {
    rootTransform().then(fitted => {
      cy.plugin().find(".plusButton").click();
      cy.plugin().find(".plusButton").click();
      rootTransform().should("not.equal", fitted);
      cy.plugin().find("button[title='Fit View']").click();
      rootTransform().should("equal", fitted);
    });
  });

  it("recenters the graph and keeps the zoom", () => {
    rootTransform().then(fitted => {
      // the wheel zooms about the pointer, so zooming near a corner moves the graph off center
      cy.plugin().find(".graph > svg").trigger("wheel", 20, 20, { deltaY: -300 });
      rootTransform().should("not.equal", fitted).then(zoomed => {
        const scale = /scale\(([^)]+)\)/.exec(zoomed!)![1];
        cy.plugin().find("button[title='Recenter View']").click();
        rootTransform().should("contain", `scale(${scale})`).and("not.equal", zoomed);
      });
    });
  });
});
