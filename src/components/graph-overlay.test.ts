import { drawnBagArrows, labelHalfHeight, labelHalfWidth, labelPoint } from "./graph-overlay";
import { D3Edge, D3Node } from "./graph-geometry";
import { bagArrows, bagOutgoing } from "./graph-labels";

const arrow = (sourceX: number, sourceY: number, targetX: number, targetY: number) =>
  ({ sourceX, sourceY, targetX, targetY }) as D3Edge;

describe("labelPoint", () => {
  it("sits a third of the way along an arrow, to the right of its direction of travel", () => {
    expect(labelPoint({ edge: arrow(0, 0, 90, 0) })).toEqual({ x: 30, y: 8 });
  });

  it("parts a two-way pair's labels", () => {
    expect(labelPoint({ edge: arrow(90, 0, 0, 0) })).toEqual({ x: 60, y: -8 });
  });

  it("follows the arrow's direction", () => {
    expect(labelPoint({ edge: arrow(0, 0, 0, 90) })).toEqual({ x: -17, y: 30 });
  });

  it("keeps a two-way pair's labels apart on a short diagonal", () => {
    const there = labelPoint({ edge: arrow(0, 0, 30, 30) });
    const back = labelPoint({ edge: arrow(30, 30, 0, 0) });
    const apart = Math.abs(there.x - back.x) >= 2 * labelHalfWidth || Math.abs(there.y - back.y) >= 2 * labelHalfHeight;
    expect(apart).toBe(true);
  });

  it("sits outside a loop's left edge", () => {
    expect(labelPoint({ loop: { x: 100, y: 50, radius: 30 } as D3Node })).toEqual({ x: 51, y: 50 });
  });
});

describe("drawnBagArrows", () => {
  // "the cat the mat the"
  const nodes = [{ id: "the", label: "the", value: 3 }, { id: "cat", label: "cat", value: 1 },
    { id: "mat", label: "mat", value: 1 }];
  const outgoing = bagOutgoing(nodes);
  const d3Node = (id: string, index: number) => ({ id, x: index * 200, y: 0, radius: 30 }) as D3Node;
  const drawnNodes = (...ids: string[]) => new Map(ids.map((id, index) => [id, d3Node(id, index)]));
  const highlights = { outgoing, animating: false, highlightAllNextNodes: false };
  const chosen = (id: string) => bagArrows({ ...highlights, selectedNodeId: id });

  it("draws a state's own arrow as a loop, and gives each arrow its share of the state's arrows", () => {
    const { lines, loops } = drawnBagArrows(chosen("the"), outgoing, "byState", drawnNodes("the", "cat", "mat"));
    expect(loops.map(loop => [loop.node.id, loop.arrowWidth])).toEqual([["the", 3.5]]);
    expect(lines.map(line => [line.target.id, line.weight])).toEqual([["cat", 2.5], ["mat", 2.5]]);
  });

  it("follows the arrow-width rule", () => {
    const { lines, loops } = drawnBagArrows(chosen("the"), outgoing, "equal", drawnNodes("the", "cat", "mat"));
    expect(loops[0].arrowWidth).toBe(2);
    expect(lines.map(line => line.weight)).toEqual([2, 2]);
  });

  it("places the arrows between their states' outlines", () => {
    const { lines } = drawnBagArrows(chosen("the"), outgoing, "byState", drawnNodes("the", "cat"));
    expect(lines.map(line => [line.sourceX, line.targetX])).toEqual([[30, 170]]);
  });

  it("weighs each arrow against its own state's arrows", () => {
    const the = { id: "the", label: "the", value: 3 };
    const cat = { id: "cat", label: "cat", value: 1 };
    const steps = bagArrows({ ...highlights, highlightOutputNodes: [the, cat, the] });
    const { lines } = drawnBagArrows(steps, outgoing, "byState", drawnNodes("the", "cat"));
    expect(lines.map(line => [line.target.id, line.weight])).toEqual([["cat", 2.5], ["the", 3.5]]);
  });

  it("leaves out an arrow to a state not drawn", () => {
    const { lines, loops } = drawnBagArrows(chosen("the"), outgoing, "byState", drawnNodes("the", "cat"));
    expect(loops).toHaveLength(1);
    expect(lines.map(line => line.target.id)).toEqual(["cat"]);
  });

  it("leaves out an arrow from a state not drawn", () => {
    const { lines, loops } = drawnBagArrows(chosen("mat"), outgoing, "byState", drawnNodes("the", "cat"));
    expect(lines).toEqual([]);
    expect(loops).toEqual([]);
  });
});
