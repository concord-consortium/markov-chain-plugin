import { moveOriginToCenter, pluginStateValues, readPluginState } from "./plugin-state";

// the saved plugin state of the ELA document pnRUlM27cXXrJrofZAXx, as CODAP 3.1.2 stores it
const elaState = {
  viewMode: "drawing",
  nodes: [
    { id: "tAtJ9i49ucYSlhkXy0ag8", label: "i", value: 1, x: -230.23797607421875, y: -65.748046875 },
    { id: "PTVhrTsYJnWs8ubsCdzbh", label: "love", value: 1, x: -96.16904640197754, y: -63.09892272949219 },
    { id: "Yfaoh2IH1AthwJiM3OtJd", label: "class", value: 1, x: 91.7048110961914, y: -52.528053283691406 },
    { id: "9QBp3NJN_89cIVDqUD8AT", label: "!", value: 1, x: 219.72821044921875, y: -50.11452507972717 }
  ],
  edges: [
    { from: "tAtJ9i49ucYSlhkXy0ag8", to: "PTVhrTsYJnWs8ubsCdzbh", value: 1 },
    { from: "Yfaoh2IH1AthwJiM3OtJd", to: "9QBp3NJN_89cIVDqUD8AT", value: 1 }
  ],
  version: 2
};
const attribute = { datasetName: "Mammals", collectionName: "Mammals", attributeName: "Diet" };

describe("pluginStateValues and readPluginState", () => {
  it("saves a restored drawing exactly as it was saved", () => {
    const saved = JSON.parse(JSON.stringify(elaState));
    const { viewMode, drawing } = readPluginState(saved);
    expect(drawing?.version).toBe(2);
    const values = pluginStateValues(viewMode, undefined, () => drawing!.graph);
    expect(JSON.stringify(values)).toBe(JSON.stringify(elaState));
  });

  it("saves only the attribute and mode in dataset mode, and restores the attribute", () => {
    const graph = { nodes: [{ id: "a", label: "a", value: 1 }], edges: [] };
    const values = pluginStateValues("dataset", attribute, () => graph);
    expect(values).toEqual({ attribute, viewMode: "dataset" });
    expect(readPluginState(values)).toEqual({ viewMode: "dataset", attribute });
  });

  it("restores a drawing saved with no version as version 1", () => {
    const { nodes, edges } = elaState;
    expect(readPluginState({ viewMode: "drawing", nodes, edges }).drawing?.version).toBe(1);
  });

  it("restores no graph without a mode, nodes or edges", () => {
    expect(readPluginState(undefined)).toEqual({ viewMode: undefined, attribute: undefined });
    expect(readPluginState({ nodes: [], edges: [] }).drawing).toBeUndefined();
    expect(readPluginState({ viewMode: "drawing", nodes: [] }).drawing).toBeUndefined();
    expect(readPluginState({ viewMode: "drawing", edges: [] }).drawing).toBeUndefined();
  });
});

describe("moveOriginToCenter", () => {
  it("moves each node by minus half the width and height, in place", () => {
    const nodes = [{ id: "a", label: "a", value: 1, x: 100, y: 50 }, { id: "b", label: "b", value: 1 }];
    const [first] = nodes;
    moveOriginToCenter(nodes, 600, 400);
    expect(nodes).toEqual([
      { id: "a", label: "a", value: 1, x: -200, y: -150 },
      { id: "b", label: "b", value: 1, x: -300, y: -200 }
    ]);
    expect(nodes[0]).toBe(first);
  });
});
