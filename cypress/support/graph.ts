type Edge = { from: string, to: string, value: number };

// restates stateEdgeWeights (graph-utils.ts) rather than importing it, so a change to the plugin's rule fails the tests
export const stateWidths = (edges: Edge[]) => {
  const totals = new Map<string, number>();
  edges.forEach(edge => totals.set(edge.from, (totals.get(edge.from) ?? 0) + edge.value));
  return (edge: Edge) => 2 + 2.5 * edge.value / totals.get(edge.from)!;
};

// selectedNodeColor in graph.tsx
export const selectedNodeColor = "#14f49e3f";

export const rootTransform = () => cy.plugin().find(".graph > svg g.root").invoke("attr", "transform");

export const graphInsideView = () =>
  cy.plugin().find(".graph > svg").should(svg => {
    const view = svg[0].getBoundingClientRect();
    const graph = svg[0].querySelector("g.root")!.getBoundingClientRect();
    expect(graph.left).to.be.at.least(view.left);
    expect(graph.right).to.be.at.most(view.right);
    expect(graph.top).to.be.at.least(view.top);
    expect(graph.bottom).to.be.at.most(view.bottom);
  });

export const ellipse = (label: string) =>
  cy.plugin().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");
