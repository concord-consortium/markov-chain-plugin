type Edge = { from: string, to: string, value: number };

// restates stateEdgeWeights (graph-utils.ts) rather than importing it, so a change to the plugin's rule fails the tests
export const stateWidths = (edges: Edge[]) => {
  const totals = new Map<string, number>();
  edges.forEach(edge => totals.set(edge.from, (totals.get(edge.from) ?? 0) + edge.value));
  return (edge: Edge) => 2 + 2.5 * edge.value / totals.get(edge.from)!;
};

export const rootTransform = () => cy.plugin().find(".graph > svg g.root").invoke("attr", "transform");
