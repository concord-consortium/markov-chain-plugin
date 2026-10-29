import { GraphData, Node } from "../type";
import type { CODAPAttribute, ViewMode } from "../hooks/use-codap";

// the saved shape has to stay as it is, so documents students have already saved keep loading
export const pluginStateValues = (viewMode: ViewMode|undefined, attribute: CODAPAttribute|undefined,
                                  getGraph: () => GraphData) => {
  const values: Record<string, unknown> = { attribute, viewMode };
  if (viewMode === "drawing") {
    const { nodes, edges } = getGraph();
    values.nodes = nodes;
    values.edges = edges;
    values.version = 2; // drawings saved before versioning have no version, which readPluginState reads as 1
  }
  return values;
};

export type SavedPluginState = {
  viewMode?: ViewMode;
  drawing?: { graph: GraphData, version: number };
  attribute?: CODAPAttribute;
};

export const readPluginState = (values: any): SavedPluginState => {
  const viewMode: ViewMode|undefined = values?.viewMode;
  if (viewMode === "drawing") {
    const { nodes, edges, version } = values;
    const drawing = (nodes !== undefined && edges !== undefined)
      ? { graph: { nodes, edges }, version: version ?? 1 }
      : undefined;
    return { viewMode, drawing };
  }
  return { viewMode, attribute: values?.attribute };
};

// version 1 drawings were saved with the origin at the top left, but drawings now have the origin in the center
export const moveOriginToCenter = (nodes: Node[], width: number, height: number) => {
  nodes.forEach(n => {
    n.x = (n.x ?? 0) - width / 2;
    n.y = (n.y ?? 0) - height / 2;
  });
};
