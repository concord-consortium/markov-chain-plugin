import { labelPoint } from "./graph-overlay";
import { D3Edge, D3Node } from "./graph-geometry";

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
    expect(labelPoint({ edge: arrow(0, 0, 0, 90) })).toEqual({ x: -8, y: 30 });
  });

  it("sits outside a loop's left edge", () => {
    expect(labelPoint({ loop: { x: 100, y: 50, radius: 30 } as D3Node })).toEqual({ x: 51, y: 50 });
  });
});
