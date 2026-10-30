// colors from graph.tsx
const selectedNodeColor = "#14f49e3f";
const incomingArrowColor = "#0081ff";
const outgoingArrowColor = "#ff9900";
const animatedNodeColor = "#FF00877f";
const animatedArrowColor = "#FF0087";
const faded = "[style*='opacity: 0.35']";

const edge = (from: string, to: string) =>
  cy.plugin().find("line.edge").filter((i, line) => {
    const { source, target } = (line as any).__data__;
    return source.id === from && target.id === to;
  });
const ellipse = (label: string) =>
  cy.plugin().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");
const expectUnfaded = (labels: string[]) => labels.forEach(label => {
  ellipse(label).should("not.match", faded);
  cy.plugin().find("g.node text").filter((i, text) => text.textContent === label).should("not.match", faded);
});

describe("Highlighting", () => {
  beforeEach(() => {
    cy.fixture("chain.json").then(state => cy.startPlugin({ savedState: state }));
    cy.plugin().find("g.node").should("have.length", 4);
  });

  it("colors a selected state's transitions and fades the rest", () => {
    cy.clickState("b");
    ellipse("b").should("have.attr", "fill", selectedNodeColor);
    edge("a", "b").should("have.attr", "stroke", incomingArrowColor)
      .and("have.attr", "marker-end", "url(#incomingArrow)");
    edge("b", "c").should("have.attr", "stroke", outgoingArrowColor)
      .and("have.attr", "marker-end", "url(#outgoingArrow)");
    ellipse("d").should("match", faded);
    edge("d", "a").should("match", faded);
    cy.plugin().find("g.node text").filter((i, text) => text.textContent === "d").should("match", faded);
    expectUnfaded(["a", "b", "c"]);

    cy.clickState("b");
    ellipse("b").should("have.attr", "fill", "#fff");
    cy.plugin().find(`line.edge[stroke='${incomingArrowColor}'], line.edge[stroke='${outgoingArrowColor}']`)
      .should("not.exist");
    cy.plugin().find(`g.node ellipse${faded}, line.edge${faded}, g.node text${faded}`).should("not.exist");
  });

  it("follows each step of a sequence", () => {
    cy.plugin().find("select").first().select("a");
    cy.plugin().contains("button", "Step").click();
    ellipse("a").should("have.attr", "fill", animatedNodeColor);
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor).and("have.attr", "stroke-dasharray", "4");

    cy.plugin().contains("button", "Step").click();
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor)
      .and("have.attr", "stroke-dasharray", "")
      .and("have.attr", "marker-end", "url(#animatedArrow)");
    ellipse("b").should("have.attr", "fill", animatedNodeColor);
    ellipse("a").should("have.attr", "fill", "#fff");

    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().contains("button", "Step").click();
    cy.plugin().find(".sequence").should("have.text", "a b c");
    cy.plugin().find(`g.node ellipse[fill='${animatedNodeColor}']`).should("not.exist");
    cy.plugin().find(`line.edge[stroke='${animatedArrowColor}']`).should("not.exist");
  });

  it("highlights a selected output's path", () => {
    cy.plugin().find("select").first().select("a");
    for (let i = 0; i < 5; i++) {
      cy.plugin().contains("button", "Step").click();
    }
    cy.plugin().find(".sequence").should("have.text", "a b c").click();
    cy.plugin().find(".sequence.highlighted").should("exist");
    ["a", "b", "c"].forEach(label => ellipse(label).should("have.attr", "fill", animatedNodeColor));
    edge("a", "b").should("have.attr", "stroke", animatedArrowColor);
    edge("b", "c").should("have.attr", "stroke", animatedArrowColor);
    ellipse("d").should("match", faded);
    edge("d", "a").should("match", faded);
    cy.plugin().find("g.node text").filter((i, text) => text.textContent === "d").should("match", faded);
    expectUnfaded(["a", "b", "c"]);

    cy.plugin().find(".sequence").click();
    cy.plugin().find(".sequence.highlighted").should("not.exist");
    cy.plugin().find(`g.node ellipse[fill='${animatedNodeColor}']`).should("not.exist");
    cy.plugin().find(`g.node ellipse${faded}, g.node text${faded}`).should("not.exist");
  });
});
