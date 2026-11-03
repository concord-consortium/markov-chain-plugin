// Helpers for the Markov Interactive's workspace, in the fake Activity Player page's frame.

// the states' labels, the Graph pane's root group and an ellipse, in the interactive
export const stateEllipse = (label: string) =>
  cy.interactive().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");
export const stateLabels = () =>
  cy.interactive().find("g.node text").then(texts => [...texts].map(text => text.textContent).sort());
export const graphRoot = () => cy.interactive().find(".graph-pane svg g.root");
export const rootTransform = () => graphRoot().invoke("attr", "transform");

// a click event alone, as the plugin's tests click: Cypress's mousedown and mouseup also start d3's drag handling
export const clickState = (label: string) => {
  // the graph reads two clicks on a state within 250 ms as a double-click
  cy.wait(260);
  stateEllipse(label).trigger("click");
};

// the log messages the interactive has sent, as [action, data]
export const loggedEvents = () => cy.interactiveMessages("log")
  .then(messages => (messages as { action: string, data: unknown }[]).map(({ action, data }) => [action, data]));

export const parseTransform = (transform?: string) => {
  const match = /translate\(([-\d.e]+),\s*([-\d.e]+)\)\s*scale\(([-\d.e]+)\)/.exec(transform ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]), k: Number(match[3]) } : { x: 0, y: 0, k: 1 };
};

// two fingers on an element in the interactive, spread apart from its center by each distance in turn and lifted;
// a TouchEvent, unlike a mouse event, has no clientX of its own
export const pinch = (element: Element, spreads: number[]) => {
  const win = element.ownerDocument.defaultView as Window & typeof globalThis;
  const box = element.getBoundingClientRect();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const fingers = (spread: number) => [-1, 1].map((side, identifier) =>
    new win.Touch({ identifier, target: element, clientX: x + side * spread, clientY: y }));
  const fire = (type: string, touches: Touch[], changedTouches: Touch[]) => element.dispatchEvent(
    new win.TouchEvent(type, { touches, targetTouches: touches, changedTouches, bubbles: true, cancelable: true }));
  fire("touchstart", fingers(spreads[0]), fingers(spreads[0]));
  spreads.slice(1).forEach(spread => fire("touchmove", fingers(spread), fingers(spread)));
  fire("touchend", [], fingers(spreads[spreads.length - 1]));
};
