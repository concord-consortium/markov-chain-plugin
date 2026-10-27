import {
  arrowHeadReach, calculateNodeFontSize, graphSignature, nodeLoopPath, pullBackLineEnd, stateEdgeWeights
} from "./graph-utils";

describe("stateEdgeWeights", () => {
  it("compares an edge only with the other edges leaving its state", () => {
    const edges = [
      {from: "a", to: "b", value: 1}, {from: "a", to: "c", value: 1},
      {from: "b", to: "a", value: 10}, {from: "b", to: "c", value: 10},
    ];
    const weight = stateEdgeWeights(edges);
    expect(new Set(edges.map(weight)).size).toBe(1);
  });

  it("scales from 2 to 4.5 by probability, loops included", () => {
    const weight = stateEdgeWeights([{from: "a", to: "b", value: 1}, {from: "a", to: "a", value: 3}]);
    expect(weight({from: "a", to: "b", value: 1})).toBeCloseTo(2.625);
    expect(weight({from: "a", to: "a", value: 3})).toBeCloseTo(3.875);
    expect(stateEdgeWeights([{from: "a", to: "b", value: 5}])({from: "a", to: "b", value: 5})).toBe(4.5);
  });

  it("leaves other states' widths alone when one state's values change", () => {
    const before = [
      {from: "a", to: "b", value: 1}, {from: "b", to: "a", value: 1}, {from: "b", to: "c", value: 3}
    ];
    const after = [{from: "a", to: "b", value: 100}, ...before.slice(1)];
    expect(after.slice(1).map(stateEdgeWeights(after))).toEqual(before.slice(1).map(stateEdgeWeights(before)));
  });

  it("draws a state with no outgoing value at the minimum width", () => {
    expect(stateEdgeWeights([{from: "a", to: "b", value: 0}])({from: "a", to: "b", value: 0})).toBe(2);
  });
});

describe("graphSignature", () => {
  it("changes when only a node's loop width changes", () => {
    const node = {id: "a", label: "a", weight: 1, radius: 30, x: 0, y: 0, loopWeight: 0};
    expect(graphSignature({nodes: [node], edges: []}))
      .not.toEqual(graphSignature({nodes: [{...node, loopWeight: 4.5}], edges: []}));
  });
});

describe("pullBackLineEnd", () => {
  it("pulls the end back along the line by 3 line widths", () => {
    expect(pullBackLineEnd(0, 0, 100, 0, 2)).toEqual({x: 94, y: 0});
    const end = pullBackLineEnd(0, 0, 30, 40, 4.5);
    expect(Math.hypot(30 - end.x, 40 - end.y)).toBeCloseTo(13.5);
  });

  it("never leaves a line shorter than 1 px", () => {
    expect(pullBackLineEnd(0, 0, 5, 0, 4)).toEqual({x: 1, y: 0});
    expect(pullBackLineEnd(0, 0, 0.5, 0, 4)).toEqual({x: 0.5, y: 0});
  });
});

describe("nodeLoopPath", () => {
  const endPoint = (d: string) => d.split(" ").pop()?.split(",").map(Number) ?? [];
  const outlineValue = (node: {x: number, y: number, radius: number}, x: number, y: number) =>
    ((x - node.x) / node.radius) ** 2 + ((y - node.y) / (node.radius / 2)) ** 2;

  it("ends an untrimmed loop on its state's outline", () => {
    const node = {x: 10, y: 20, radius: 50};
    const [x, y] = endPoint(nodeLoopPath(node));
    expect(outlineValue(node, x, y)).toBeCloseTo(1);
  });

  it("puts the tip of a trimmed loop's arrowhead on its state's outline", () => {
    [25, 50, 75].forEach(radius => [2, 4.5].forEach(width => {
      const node = {x: 10, y: 20, radius};
      const [x, y] = endPoint(nodeLoopPath(node, width));
      // the loop's circle is centered rx left of its state and drawn with increasing angle
      const angle = Math.atan2(y - node.y, x - (node.x - radius));
      const reach = arrowHeadReach * width;
      expect(outlineValue(node, x - reach * Math.sin(angle), y + reach * Math.cos(angle))).toBeCloseTo(1, 3);
    }));
  });
});

describe("calculateNodeFontSize", () => {
  const spyOnMeasuring = () => {
    const appendChild = jest.spyOn(document.body, "appendChild");
    return () => appendChild.mock.calls[0][0] as HTMLElement;
  };

  afterEach(() => jest.restoreAllMocks());

  it("measures markup in a label as text", () => {
    const measured = spyOnMeasuring();
    calculateNodeFontSize({label: "<b>x</b>", radius: 50});
    expect(measured().textContent).toBe("<b>x</b>");
    expect(measured().children).toHaveLength(0);
  });

  it("measures an entity in a label as the characters typed", () => {
    const measured = spyOnMeasuring();
    calculateNodeFontSize({label: "x &amp; y", radius: 50});
    expect(measured().textContent).toBe("x &amp; y");
  });

  it("sets truncated labels as text too", () => {
    // jsdom measures every element as 0 wide, so give each character a width
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function(this: HTMLElement) { return (this.textContent?.length ?? 0) * 5; });
    const measured = spyOnMeasuring();
    const {label} = calculateNodeFontSize({label: "<i>abcdefgh</i>", radius: 30});
    expect(label).toBe("<i>abc...");
    expect(measured().textContent).toBe("<i>abc...");
    expect(measured().children).toHaveLength(0);
  });
});
