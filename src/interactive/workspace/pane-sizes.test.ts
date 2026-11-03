import {
  defaultPaneSizes, dividerBand, dividerLimits, dragDivider, dragInputSplit, drawnRowHeight, fitPaneSizes,
  graphBodyHeight, movesDivider, resizedPanes, toolbarColumns, toolbarHeight, workspaceHeight
} from "./pane-sizes";

const allOpen = { input: true, graph: true, inspect: true };
// a row 1000 px wide with the default sizes: Input 280, Inspect 260, the graph the 460 left
const room = 1000;

describe("pane sizes", () => {
  it("fits the workspace to a Chromebook's screen", () => {
    expect(workspaceHeight).toBe(550);
  });

  it("measures the toolbar in one or two columns", () => {
    expect(toolbarHeight(5)).toBe(184);
    expect(toolbarHeight(5, 2)).toBe(112);
  });

  it("spans a divider's band across the gap and the panes' padding beside it", () => {
    expect(dividerBand).toBe(18);
  });

  it("puts Data mode's five tools in two columns below a 222 px row", () => {
    expect(toolbarColumns(5, graphBodyHeight(222))).toBe(1);
    expect(toolbarColumns(5, graphBodyHeight(221))).toBe(2);
  });

  it("fits the toolbar to the starting row's height while the panes are stacked", () => {
    expect(drawnRowHeight(200, false)).toBe(200);
    expect(drawnRowHeight(200, true)).toBe(330);
    expect(toolbarColumns(5, graphBodyHeight(drawnRowHeight(200, true)))).toBe(1);
  });
});

describe("dragDivider", () => {
  it("moves each divider", () => {
    expect(dragDivider(defaultPaneSizes, "input", 60, room, allOpen)).toEqual({ input: 340, inspect: 260, top: 330 });
    expect(dragDivider(defaultPaneSizes, "inspect", -40, room, allOpen))
      .toEqual({ input: 280, inspect: 300, top: 330 });
    expect(dragDivider(defaultPaneSizes, "rows", -100, room, allOpen)).toEqual({ input: 280, inspect: 260, top: 230 });
  });

  it("stops the Input/Graph divider at Input's minimum and at the graph's", () => {
    expect(dragDivider(defaultPaneSizes, "input", -500, room, allOpen).input).toBe(160);
    // the room less Inspect's 260 and the graph's 200
    expect(dragDivider(defaultPaneSizes, "input", 500, room, allOpen).input).toBe(540);
  });

  it("stops the Graph/Inspect divider at Inspect's minimum and at the graph's", () => {
    expect(dragDivider(defaultPaneSizes, "inspect", 500, room, allOpen).inspect).toBe(220);
    // the room less Input's 280 and the graph's 200
    expect(dragDivider(defaultPaneSizes, "inspect", -500, room, allOpen).inspect).toBe(520);
  });

  it("stops the row divider at the row's minimum and at the generator's", () => {
    expect(dragDivider(defaultPaneSizes, "rows", -500, room, allOpen).top).toBe(200);
    // the workspace's 550 less the generator's 220
    expect(dragDivider({ ...defaultPaneSizes, top: 250 }, "rows", 200, room, allOpen).top).toBe(330);
  });

  it("doesn't count a collapsed Inspect against Input's maximum", () => {
    expect(dragDivider(defaultPaneSizes, "input", 1000, room, { ...allOpen, inspect: false }).input).toBe(800);
  });
});

describe("dragInputSplit", () => {
  it("moves the split by the drag's share of the body", () => {
    expect(dragInputSplit(0.4, 30, 300)).toBeCloseTo(0.5, 10);
  });

  it("stops where the text box or the table reaches 60 px", () => {
    expect(dragInputSplit(0.4, -200, 300)).toBeCloseTo(0.2, 10);
    expect(dragInputSplit(0.4, 200, 300)).toBeCloseTo(0.8, 10);
  });
});

describe("fitPaneSizes", () => {
  it("returns the same sizes when they fit", () => {
    expect(fitPaneSizes(defaultPaneSizes, room, allOpen)).toBe(defaultPaneSizes);
  });

  it("shrinks Input and Inspect in proportion to what each has above its minimum", () => {
    // 740 needed in 680: Input has 120 spare and Inspect 40, so they give up 45 and 15
    expect(fitPaneSizes(defaultPaneSizes, 680, allOpen)).toEqual({ input: 235, inspect: 245, top: 330 });
  });

  it("stops at both minimums", () => {
    expect(fitPaneSizes(defaultPaneSizes, 300, allOpen)).toEqual({ input: 160, inspect: 220, top: 330 });
  });

  it("holds back no width for a collapsed graph", () => {
    expect(fitPaneSizes(defaultPaneSizes, 600, { ...allOpen, graph: false })).toBe(defaultPaneSizes);
  });
});

describe("dividerLimits", () => {
  it("gives the Graph/Inspect divider the graph's width and the limits where Graph or Inspect stops", () => {
    expect(dividerLimits(defaultPaneSizes, "inspect", room, allOpen)).toEqual({ value: 460, min: 200, max: 500 });
  });
});

describe("resizedPanes", () => {
  it("changes only the size the divider sets in a row with room, so the other keeps the student's width", () => {
    expect(resizedPanes({ input: 400, inspect: 300, top: 330 }, "input", -100, room, allOpen))
      .toEqual({ input: 300, inspect: 300, top: 330 });
  });

  // in 680 px the defaults are drawn at 235 and 245, with the graph at its 200 px minimum
  it("moves from the drawn sizes in a row too narrow for the stored ones", () => {
    const moved = resizedPanes(defaultPaneSizes, "input", -40, 680, allOpen);
    expect(moved).toEqual({ input: 195, inspect: 245, top: 330 });
    expect(fitPaneSizes(moved, 680, allOpen).input).toBe(195);
  });

  it("keeps the stored widths for a row divider drag in a row too narrow for them", () => {
    expect(resizedPanes(defaultPaneSizes, "rows", -20, 680, allOpen)).toEqual({ input: 280, inspect: 260, top: 310 });
  });

  it("never narrows Input for a drag to the right in a row too narrow for the stored sizes", () => {
    const moved = resizedPanes(defaultPaneSizes, "input", 60, 680, allOpen);
    expect(fitPaneSizes(moved, 680, allOpen).input).toBeGreaterThanOrEqual(235);
  });
});

describe("movesDivider", () => {
  // in 580.1 px Input is drawn at 160.075 beside the graph's 200 px minimum, and a drag right refits it to a value
  // that differs from that in its last digits
  it("treats a divider stopped at its limit in a fractional row as unmoved", () => {
    const moved = resizedPanes(defaultPaneSizes, "input", 10, 580.1, allOpen);
    expect(movesDivider(defaultPaneSizes, moved, "input", 580.1, allOpen)).toBe(false);
  });

  it("sees a move of half a pixel or more", () => {
    expect(movesDivider(defaultPaneSizes, { ...defaultPaneSizes, input: 280.5 }, "input", room, allOpen)).toBe(true);
    expect(movesDivider(defaultPaneSizes, { ...defaultPaneSizes, input: 280.4 }, "input", room, allOpen)).toBe(false);
  });
});
