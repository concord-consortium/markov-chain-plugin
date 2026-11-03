// Pane sizes in px: the graph takes what the row leaves, and the generator what the height leaves.
export interface PaneSizes { input: number, inspect: number, top: number }

export const defaultPaneSizes: PaneSizes = { input: 280, inspect: 260, top: 330 };
export const minPaneSizes = { input: 160, graph: 200, inspect: 220, top: 200, generator: 210 };
// the generator starts at its minimum
export const workspaceHeight = defaultPaneSizes.top + minPaneSizes.generator;

export const paneGap = 8;
export const dividerBand = 24;
// a pane's inner padding on an edge beside a divider, so the divider's band covers padding and no control
export const panePadding = (dividerBand - paneGap) / 2;
export const collapsedStrip = 32;
export const paneHeader = 26;
// below this workspace width the panes stack
export const stackBelow = 700;
// the workspace's own row is always one control tall, so a control appearing doesn't move the panes
export const controlsRowHeight = 32;

// the shared toolbar's button size and padding (toolbar.scss), and the workspace's gap between its buttons
export const toolbarButton = 32;
export const toolbarPadding = 4;
export const toolbarGap = 4;
export const toolbarHeight = (tools: number, columns: 1 | 2 = 1) => {
  const rows = Math.ceil(tools / columns);
  return rows * toolbarButton + (rows - 1) * toolbarGap + 2 * toolbarPadding;
};
// the height of the Graph pane's body in a row top px tall, less the padding beside a row divider below it
export const graphBodyHeight = (top: number, rowsDivider: boolean) =>
  top - paneHeader - (rowsDivider ? panePadding : 0);
// the row height the Graph pane's toolbar is fitted to: stacked panes are all the starting row's height,
// whatever row height is stored
export const toolbarRowHeight = (top: number, stacked: boolean) => stacked ? defaultPaneSizes.top : top;
// a toolbar taller than the Graph pane's body puts its buttons in two columns
export const toolbarColumns = (tools: number, bodyHeight: number): 1 | 2 =>
  toolbarHeight(tools) <= bodyHeight ? 1 : 2;
