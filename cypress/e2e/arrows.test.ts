import { stateWidths } from "../support/graph";

const markerIds = [
  "arrow", "loopArrow", "animatedArrow", "incomingArrow", "outgoingArrow",
  "selectedLoopArrow", "unselectedArrow", "unselectedLoopArrow"
];

const expectHeadsOnlyOnVisibleLines = () => {
  cy.plugin().find("line.edge:not([marker-end])").should("not.exist");
  cy.plugin().find("path.loop:not([marker-end])").should("not.exist");
  cy.plugin().find("line.edge-background[marker-end]").should("not.exist");
  cy.plugin().find("path.loop-background[marker-end]").should("not.exist");
};

describe("Arrows", () => {
  it("draws each transition's width as its share of its state's outgoing transitions", () => {
    cy.fixture("ela/9nsC6KpuDstv2N9eGndM.json").then(state => {
      const width = stateWidths(state.edges);
      cy.startPlugin({ savedState: state });
      cy.plugin().find("line.edge").should("have.length", state.edges.length).each(line => {
        // d3 keeps each line's edge as its bound data
        const { source, target } = (line[0] as any).__data__;
        const edge = state.edges.find((e: any) => e.from === source.id && e.to === target.id);
        expect(Number(line.attr("stroke-width"))).to.be.closeTo(width(edge), 1e-9);
      });
    });
  });

  it("counts a loop as one of its state's outgoing transitions", () => {
    cy.fixture("chain.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("button[title='Add Transition']").click();
      cy.doubleClickState("a");
      cy.plugin().find("path.loop").should("have.length", 1).and("have.attr", "stroke-width", "3.25");
      cy.plugin().find("line.edge").filter((i, line) => (line as any).__data__.source.id === "a")
        .should("have.attr", "stroke-width", "3.25");
    });
  });

  it("scales every arrowhead with its line and puts none on the click targets", () => {
    cy.fixture("chain.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("marker").should(markers => expect([...markers].map(m => m.id)).to.have.members(markerIds))
        .each(marker => expect(marker.attr("markerUnits")).to.equal("strokeWidth"));
      cy.plugin().find("button[title='Add Transition']").click();
      cy.doubleClickState("b");
      cy.plugin().find("path.loop").should("have.length", 1);
      expectHeadsOnlyOnVisibleLines();

      cy.plugin().find("button[title='Select']").click();
      cy.clickState("b");
      cy.plugin().find("line.edge[marker-end='url(#incomingArrow)']").should("exist");
      expectHeadsOnlyOnVisibleLines();

      cy.clickState("b");
      cy.plugin().find("select").first().select("a");
      cy.plugin().contains("button", "Step").click();
      cy.plugin().contains("button", "Step").click();
      cy.plugin().find("[marker-end='url(#animatedArrow)']").should("exist");
      expectHeadsOnlyOnVisibleLines();
    });
  });
});
