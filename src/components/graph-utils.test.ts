import {
  arrowHeadReach, calculateNodeFontSizes, edgeWeights, graphSignature, isPlaced, layoutFor, nodeLoopPath,
  pullBackLineEnd, linkDistance, settings, startPosition, startPositions, stateEdgeWeights
} from "./graph-utils";

describe("stateEdgeWeights", () => {
  it("compares an edge only with the other edges leaving its state", () => {
    const edges = [
      { from: "a", to: "b", value: 1 }, { from: "a", to: "c", value: 1 },
      { from: "b", to: "a", value: 10 }, { from: "b", to: "c", value: 10 },
    ];
    const weight = stateEdgeWeights(edges);
    expect(new Set(edges.map(weight)).size).toBe(1);
  });

  it("scales from 2 to 4.5 by probability, loops included", () => {
    const weight = stateEdgeWeights([{ from: "a", to: "b", value: 1 }, { from: "a", to: "a", value: 3 }]);
    expect(weight({ from: "a", to: "b", value: 1 })).toBeCloseTo(2.625);
    expect(weight({ from: "a", to: "a", value: 3 })).toBeCloseTo(3.875);
    expect(stateEdgeWeights([{ from: "a", to: "b", value: 5 }])({ from: "a", to: "b", value: 5 })).toBe(4.5);
  });

  it("leaves other states' widths alone when one state's values change", () => {
    const before = [
      { from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 1 }, { from: "b", to: "c", value: 3 }
    ];
    const after = [{ from: "a", to: "b", value: 100 }, ...before.slice(1)];
    expect(after.slice(1).map(stateEdgeWeights(after))).toEqual(before.slice(1).map(stateEdgeWeights(before)));
  });

  it("draws a state with no outgoing value at the minimum width", () => {
    expect(stateEdgeWeights([{ from: "a", to: "b", value: 0 }])({ from: "a", to: "b", value: 0 })).toBe(2);
  });
});

describe("edgeWeights", () => {
  const oneOfFour = { from: "a", to: "b", value: 1 };
  const threeOfFour = { from: "a", to: "c", value: 3 };
  const edges = [oneOfFour, threeOfFour];

  it("gives every arrow the thinnest width with equal widths", () => {
    const weight = edgeWeights(edges, "equal");
    expect(weight(oneOfFour)).toBe(2);
    expect(weight(threeOfFour)).toBe(2);
  });

  it("gives each arrow its share of its state's arrows by state", () => {
    const weight = edgeWeights(edges, "byState");
    expect(weight(oneOfFour)).toBe(2.625);
    expect(weight(threeOfFour)).toBe(3.875);
  });
});

describe("graphSignature", () => {
  it("changes when only a node's loop width changes", () => {
    const node = { id: "a", label: "a", weight: 1, radius: 30, x: 0, y: 0, loopWeight: 0 };
    expect(graphSignature({ nodes: [node], edges: [] }))
      .not.toEqual(graphSignature({ nodes: [{ ...node, loopWeight: 4.5 }], edges: [] }));
  });

  it("changes when an arrow of the same width gains or loses all its value", () => {
    const edge = { source: { id: "a" }, target: { id: "b" }, weight: 2, value: 1 };
    expect(graphSignature({ nodes: [], edges: [edge] }))
      .not.toEqual(graphSignature({ nodes: [], edges: [{ ...edge, value: 0 }] }));
  });

  it("stays the same when an arrow of the same width only changes value", () => {
    const edge = { source: { id: "a" }, target: { id: "b" }, weight: 2, value: 1 };
    expect(graphSignature({ nodes: [], edges: [edge] }))
      .toEqual(graphSignature({ nodes: [], edges: [{ ...edge, value: 3 }] }));
  });
});

describe("pullBackLineEnd", () => {
  it("pulls the end back along the line by 3 line widths", () => {
    expect(pullBackLineEnd(0, 0, 100, 0, 2)).toEqual({ x: 94, y: 0 });
    const end = pullBackLineEnd(0, 0, 30, 40, 4.5);
    expect(Math.hypot(30 - end.x, 40 - end.y)).toBeCloseTo(13.5);
  });

  it("never leaves a line shorter than 1 px", () => {
    expect(pullBackLineEnd(0, 0, 5, 0, 4)).toEqual({ x: 1, y: 0 });
    expect(pullBackLineEnd(0, 0, 0.5, 0, 4)).toEqual({ x: 0.5, y: 0 });
  });
});

describe("nodeLoopPath", () => {
  const endPoint = (d: string) => d.split(" ").pop()?.split(",").map(Number) ?? [];
  const outlineValue = (node: {x: number, y: number, radius: number}, x: number, y: number) =>
    ((x - node.x) / node.radius) ** 2 + ((y - node.y) / (node.radius / 2)) ** 2;

  it("ends an untrimmed loop on its state's outline", () => {
    const node = { x: 10, y: 20, radius: 50 };
    const [x, y] = endPoint(nodeLoopPath(node));
    expect(outlineValue(node, x, y)).toBeCloseTo(1);
  });

  it("puts the tip of a trimmed loop's arrowhead on its state's outline", () => {
    [25, 50, 75].forEach(radius => [2, 4.5].forEach(width => {
      const node = { x: 10, y: 20, radius };
      const [x, y] = endPoint(nodeLoopPath(node, width));
      // the loop's circle is centered rx left of its state and drawn with increasing angle
      const angle = Math.atan2(y - node.y, x - (node.x - radius));
      const reach = arrowHeadReach * width;
      expect(outlineValue(node, x - reach * Math.sin(angle), y + reach * Math.cos(angle))).toBeCloseTo(1, 3);
    }));
  });
});

describe("calculateNodeFontSizes", () => {
  const spyOnMeasuring = () => {
    const appendChild = jest.spyOn(document.body, "appendChild");
    return () => appendChild.mock.calls[0][0] as HTMLElement;
  };

  afterEach(() => jest.restoreAllMocks());

  it("measures markup in a label as text", () => {
    const measured = spyOnMeasuring();
    calculateNodeFontSizes([{ label: "<b>x</b>", radius: 50 }]);
    expect(measured().textContent).toBe("<b>x</b>");
    expect(measured().children).toHaveLength(0);
  });

  it("measures an entity in a label as the characters typed", () => {
    const measured = spyOnMeasuring();
    calculateNodeFontSizes([{ label: "x &amp; y", radius: 50 }]);
    expect(measured().textContent).toBe("x &amp; y");
  });

  it("sets truncated labels as text too", () => {
    // jsdom measures every element as 0 wide, so give each character a width
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function(this: HTMLElement) { return (this.textContent?.length ?? 0) * 5; });
    const measured = spyOnMeasuring();
    const [{ label }] = calculateNodeFontSizes([{ label: "<i>abcdefgh</i>", radius: 30 }]);
    expect(label).toBe("<i>abc...");
    expect(measured().textContent).toBe("<i>abc...");
    expect(measured().children).toHaveLength(0);
  });

  // a large graph draws slowly when each label lays the page out once for each size it tries
  it("sets every label's size before measuring any, and takes the labels out of the page after", () => {
    const sizedWhenFirstMeasured: string[] = [];
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function(this: HTMLElement) {
      if (sizedWhenFirstMeasured.length === 0) {
        sizedWhenFirstMeasured.push(...[...document.body.children].map(child => (child as HTMLElement).style.fontSize));
      }
      return (this.textContent?.length ?? 0) * 5;
    });
    const sizes = calculateNodeFontSizes([
      { label: "a", radius: 30 }, { label: "abcdefghijk", radius: 30 }, { label: "abc", radius: 50 }
    ]);
    expect(sizes.map(size => size.label)).toEqual(["a", "abcdef...", "abc"]);
    expect(sizedWhenFirstMeasured).toEqual(["24px", "24px", "40px"]);
    expect(document.body.children).toHaveLength(0);
  });
});

describe("isPlaced", () => {
  it("places a state already drawn or given both coordinates, with keepPositions", () => {
    expect(isPlaced(true, false, { x: 10, y: 20 })).toBe(true);
    expect(isPlaced(true, false, { x: 10 })).toBe(false);
    expect(isPlaced(true, false, {})).toBe(false);
    expect(isPlaced(true, true, {})).toBe(true);
  });

  it("places nothing without keepPositions", () => {
    expect(isPlaced(false, false, { x: 10, y: 20 })).toBe(false);
    expect(isPlaced(false, true, {})).toBe(false);
  });
});

describe("layoutFor", () => {
  it("lays out the whole graph when more than half its states are new", () => {
    expect(layoutFor(0, 10)).toBe("whole");
    expect(layoutFor(4, 10)).toBe("whole");
  });

  it("lays out only the new states when at most half are new", () => {
    expect(layoutFor(5, 10)).toBe("new");
    expect(layoutFor(9, 10)).toBe("new");
  });

  it("lays out nothing when no state is new", () => {
    expect(layoutFor(10, 10)).toBe("none");
  });
});

// the layout's distance between the centers of two of the smallest states
const distance = linkDistance(settings.minRadius, settings.minRadius);

describe("linkDistance", () => {
  it("aims for one and a half times the two radii", () => {
    expect(linkDistance(20, 30)).toBe(75);
  });
});

describe("startPosition", () => {
  const placed = new Map([["a", { x: 100, y: 50 }]]);

  const at = (angle: number, from: { x: number, y: number }) => ({
    x: from.x + distance * Math.cos(angle * Math.PI / 180), y: from.y + distance * Math.sin(angle * Math.PI / 180)
  });
  // to the hundredth of a px, with -0 as 0
  const rounded = ({ x, y }: { x: number, y: number }) =>
    ({ x: Math.round(x * 100) / 100 + 0, y: Math.round(y * 100) / 100 + 0 });
  const startOfB = (edges: { from: string, to: string }[], states: Map<string, { x: number, y: number }>) =>
    rounded(startPosition("b", edges, states));

  it("starts a new state an arrow's length from its placed source, on the side toward the center", () => {
    const edges = [{ from: "c", to: "d" }, { from: "a", to: "b" }];
    expect(startOfB(edges, placed)).toEqual(rounded(at(210, { x: 100, y: 50 })));
  });

  it("starts a state from the first of its placed sources, in arrow order", () => {
    const sources = new Map([["a", { x: 100, y: 50 }], ["c", { x: -200, y: 0 }]]);
    const edges = [{ from: "c", to: "b" }, { from: "a", to: "b" }];
    expect(startOfB(edges, sources)).toEqual(rounded(at(0, { x: -200, y: 0 })));
  });

  it("starts a state clear of the other placed states, not on them", () => {
    const states = new Map([["a", { x: 100, y: 10 }], ["c", { x: 30, y: 10 }]]);
    expect(startOfB([{ from: "a", to: "b" }], states)).toEqual(rounded(at(270, { x: 100, y: 10 })));
  });

  it("starts a state where it is clearest when no spot is an arrow's length from every state", () => {
    const states = new Map([
      ["a", { x: 0, y: 0 }], ["c", { x: 50, y: 0 }], ["d", { x: -45, y: 5 }], ["e", { x: 0, y: 50 }],
      ["f", { x: 0, y: -50 }]
    ]);
    expect(startOfB([{ from: "a", to: "b" }], states)).toEqual(rounded(at(210, { x: 0, y: 0 })));
  });

  it("winds a chain added a state at a time around the center rather than running it in a line", () => {
    const chain = new Map([["s0", { x: 0, y: 0 }]]);
    for (let i = 1; i < 12; i++) {
      chain.set(`s${i}`, startPosition(`s${i}`, [{ from: `s${i - 1}`, to: `s${i}` }], chain));
    }
    const farthest = Math.max(...[...chain.values()].map(p => Math.hypot(p.x, p.y)));
    expect(farthest).toBeLessThan(4 * distance);
  });

  it("starts a state with no placed source at the origin", () => {
    expect(startPosition("b", [{ from: "b", to: "a" }], placed)).toEqual({ x: 0, y: 0 });
  });

  it("ignores an arrow from a state that isn't placed", () => {
    expect(startPosition("b", [{ from: "c", to: "b" }], placed)).toEqual({ x: 0, y: 0 });
  });
});

describe("startPositions", () => {
  const placed = new Map([["a", { x: 100, y: 0 }], ["z", { x: -300, y: 0 }]]);

  it("starts the states a commit adds from one state an arrow's length apart", () => {
    const starts = startPositions(["b", "c"], [{ from: "a", to: "b" }, { from: "a", to: "c" }], placed);
    const [b, c] = [starts.get("b")!, starts.get("c")!];
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeGreaterThanOrEqual(distance - 0.001);
  });

  it("starts a chain added in one commit from its own new states", () => {
    const starts = startPositions(["b", "c"], [{ from: "a", to: "b" }, { from: "b", to: "c" }], placed);
    const [b, c] = [starts.get("b")!, starts.get("c")!];
    expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(distance);
  });

  it("starts only the states it is given, and leaves the placed ones out", () => {
    expect([...startPositions(["b"], [{ from: "a", to: "b" }], placed).keys()]).toEqual(["b"]);
  });

  // a whole layout places every state, so searching for a start for each would be wasted, and slow for a large graph
  it("starts none when more than half the states are new, since the whole graph is laid out", () => {
    const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }];
    expect(startPositions(["b", "c", "d"], edges, placed).size).toBe(0);
  });
});
