// Pane sizes in px: the graph takes what the row leaves, and the generator what the height leaves.
export interface PaneSizes { input: number, inspect: number, top: number }

export const defaultPaneSizes: PaneSizes = { input: 280, inspect: 260, top: 315 };
export const minPaneSizes = { input: 160, graph: 200, inspect: 220, top: 200, generator: 235 };
// the generator starts at its minimum
export const workspaceHeight = defaultPaneSizes.top + minPaneSizes.generator;

export const paneGap = 8;
// the padding inside every pane's border; a divider's band spans the gap, the borders and most of this padding
export const panePadding = 5;
export const paneBorder = 1;
export const dividerBand = paneGap + 2 * panePadding;
export const collapsedStrip = 32;
export const paneHeader = 26;
// below this workspace width the panes stack
export const stackBelow = 700;
// the workspace's own row is at least one control tall, so a control appearing doesn't move the panes
export const controlsRowHeight = 32;

// the shared toolbar's button size and padding (toolbar.scss), and the workspace's gap between its buttons
export const toolbarButton = 32;
export const toolbarPadding = 4;
export const toolbarGap = 4;
export const toolbarHeight = (tools: number, columns = 1) => {
  const rows = Math.ceil(tools / columns);
  return rows * toolbarButton + (rows - 1) * toolbarGap + 2 * toolbarPadding;
};
export const toolbarWidth = (columns: number) =>
  columns * toolbarButton + (columns - 1) * toolbarGap + 2 * toolbarPadding;
// the height inside the Graph pane's border, header and padding, in a row top px tall
export const graphBodyHeight = (top: number) => top - paneHeader - 2 * paneBorder - 2 * panePadding;
// the height the row's panes are drawn at, from the stored row height: stacked panes are all the starting row's
// height, whatever row height is stored
export const drawnRowHeight = (top: number, stacked: boolean) => stacked ? defaultPaneSizes.top : top;
// the fewest columns whose toolbar fits the Graph pane's body
export const toolbarColumns = (tools: number, bodyHeight: number) => {
  let columns = 1;
  while (columns < tools && toolbarHeight(tools, columns) > bodyHeight) columns++;
  return columns;
};

export type PaneDivider = "input" | "inspect" | "rows";
export interface OpenPanes { input: boolean, graph: boolean, inspect: boolean }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high));

// the size a divider sets, as the pane before it has it (Graph's width for the Graph/Inspect divider), with the
// limits where either pane beside it reaches its minimum; room is the width the open row panes share
export const dividerLimits = (sizes: PaneSizes, divider: PaneDivider, room: number, open: OpenPanes) => {
  const input = open.input ? sizes.input : 0;
  const inspect = open.inspect ? sizes.inspect : 0;
  switch (divider) {
    case "input":
      return { value: sizes.input, min: minPaneSizes.input, max: room - inspect - minPaneSizes.graph };
    case "inspect":
      return { value: room - input - inspect, min: minPaneSizes.graph, max: room - input - minPaneSizes.inspect };
    case "rows":
      return { value: sizes.top, min: minPaneSizes.top, max: workspaceHeight - minPaneSizes.generator };
  }
};

// the least a divider is drawn away from where it was to count as moved, since fitted sizes reached by different sums
// can differ in their last digits
export const minDividerMove = 0.5;

// whether sizes stored as to draw a divider somewhere other than sizes stored as from
export const movesDivider = (from: PaneSizes, to: PaneSizes, divider: PaneDivider, room: number, open: OpenPanes) => {
  const drawn = (stored: PaneSizes) => dividerLimits(fitPaneSizes(stored, room, open), divider, room, open).value;
  return Math.abs(drawn(to) - drawn(from)) >= minDividerMove;
};

// a divider moved by delta px (right or down), stopped where either pane beside it reaches its minimum
export const dragDivider = (sizes: PaneSizes, divider: PaneDivider, delta: number, room: number,
  open: OpenPanes): PaneSizes => {
  const { value, min, max } = dividerLimits(sizes, divider, room, open);
  const moved = clamp(value + delta, min, max);
  switch (divider) {
    case "input":
      return { ...sizes, input: moved };
    case "inspect":
      return { ...sizes, inspect: room - (open.input ? sizes.input : 0) - moved };
    case "rows":
      return { ...sizes, top: moved };
  }
};

// the sizes to store for a divider moved by delta px from stored sizes: a column divider moves from the sizes as
// drawn, so in a row too narrow for the stored sizes it follows the pointer; the row divider keeps the stored widths
export const resizedPanes = (stored: PaneSizes, divider: PaneDivider, delta: number, room: number,
  open: OpenPanes): PaneSizes =>
  dragDivider(divider === "rows" ? stored : fitPaneSizes(stored, room, open), divider, delta, room, open);

// the linked Input pane's split: the text box's share of the pane's body
export const defaultInputSplit = 0.4;
export const minInputPart = 60;
// each part's minimum, or half the body where it is too short for both
export const inputPartMin = (bodyHeight: number) => Math.min(minInputPart, bodyHeight / 2);
// the split as drawn, within both parts' minimums; an unmeasured body draws it as stored
export const drawnInputSplit = (split: number, bodyHeight: number) => bodyHeight > 0
  ? clamp(split, inputPartMin(bodyHeight) / bodyHeight, 1 - inputPartMin(bodyHeight) / bodyHeight)
  : split;
// whether a split stored as to draws the split divider somewhere other than a split stored as from
export const movesInputSplit = (from: number, to: number, bodyHeight: number) =>
  Math.abs(drawnInputSplit(to, bodyHeight) - drawnInputSplit(from, bodyHeight)) * bodyHeight >= minDividerMove;
// the split moved by delta px (down) in a body bodyHeight px tall, stopped where the text box or the table reaches its
// minimum
export const dragInputSplit = (split: number, delta: number, bodyHeight: number) =>
  drawnInputSplit((drawnInputSplit(split, bodyHeight) * bodyHeight + delta) / bodyHeight, bodyHeight);

// in a row narrower than the sizes need, Input and Inspect give up width toward their minimums, in proportion to
// what each has above its minimum, so an open graph keeps its own; sizes that fit come back unchanged, the same object
export const fitPaneSizes = (sizes: PaneSizes, room: number, open: OpenPanes): PaneSizes => {
  const overflow = (open.input ? sizes.input : 0) + (open.inspect ? sizes.inspect : 0) +
    (open.graph ? minPaneSizes.graph : 0) - room;
  const spareInput = open.input ? Math.max(0, sizes.input - minPaneSizes.input) : 0;
  const spareInspect = open.inspect ? Math.max(0, sizes.inspect - minPaneSizes.inspect) : 0;
  const spare = spareInput + spareInspect;
  if (overflow <= 0 || spare === 0) {
    return sizes;
  }
  const cut = Math.min(overflow, spare);
  return {
    ...sizes,
    input: sizes.input - cut * spareInput / spare,
    inspect: sizes.inspect - cut * spareInspect / spare,
  };
};
