import {
  graphBodyHeight, panePadding, toolbarColumns, toolbarHeight, toolbarRowHeight, workspaceHeight
} from "./pane-sizes";

describe("pane sizes", () => {
  it("fits the workspace to a Chromebook's screen", () => {
    expect(workspaceHeight).toBe(540);
  });

  it("measures the toolbar in one or two columns", () => {
    expect(toolbarHeight(5)).toBe(184);
    expect(toolbarHeight(5, 2)).toBe(112);
  });

  it("pads a pane's edge beside a divider to the divider's band", () => {
    expect(panePadding).toBe(8);
  });

  it("puts Data mode's five tools in two columns below a 218 px row, or 210 px with no row divider", () => {
    expect(toolbarColumns(5, graphBodyHeight(218, true))).toBe(1);
    expect(toolbarColumns(5, graphBodyHeight(217, true))).toBe(2);
    expect(toolbarColumns(5, graphBodyHeight(210, false))).toBe(1);
    expect(toolbarColumns(5, graphBodyHeight(209, false))).toBe(2);
  });

  it("fits the toolbar to the starting row's height while the panes are stacked", () => {
    expect(toolbarRowHeight(200, false)).toBe(200);
    expect(toolbarRowHeight(200, true)).toBe(330);
    expect(toolbarColumns(5, graphBodyHeight(toolbarRowHeight(200, true), false))).toBe(1);
  });
});
