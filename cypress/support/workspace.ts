import { pastDoubleClick } from "./graph";

// Helpers for the Markov Interactive's workspace, in the fake Activity Player page's frame.

export const stateEllipse = (label: string) =>
  cy.interactive().find("g.node").filter((i, node) => node.textContent === label).find("ellipse");
// invoke, not then, so a should() after it retries the query until the labels match
export const stateLabels = () => cy.interactive().find("g.node text").invoke("toArray")
  .invoke("map", (text: Element) => text.textContent).invoke("sort");
export const graphRoot = () => cy.interactive().find(".graph-pane svg g.root");
export const rootTransform = () => graphRoot().invoke("attr", "transform");

// a click event alone, as the plugin's tests click: Cypress's mousedown and mouseup also start d3's drag handling
export const clickState = (label: string) => {
  pastDoubleClick();
  stateEllipse(label).trigger("click");
};

// the log messages the interactive has sent, as [action, data]
export const loggedEvents = () => cy.interactiveMessages("log")
  .invoke("map", ({ action, data }: { action: string, data: unknown }) => [action, data]) as
  Cypress.Chainable<[string, unknown][]>;

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

// The events a press sends, in the order the browser sends them for a mouse or a touch, dispatched in the
// interactive's frame at the center of element: DevTools' mouse and touch input there leave Cypress unable to end the
// run. Each event goes to what is under that point when it fires, and the click, as a browser sends it, to what the
// mousedown and mouseup targets share, so a redraw during the press loses it. "focus" moves focus as the press's
// mousedown does, to the control pressed or else off the focused element; a number waits that many ms.
type PressStep =
  "pointerdown" | "pointerup" | "pointercancel" | "mousedown" | "mouseup" | "click" | "contextmenu" | "focus" | number;
export const pressEvents = (element: Element, steps: PressStep[], pointerType: "mouse" | "touch", button = 0) => {
  const doc = element.ownerDocument;
  const win = doc.defaultView as Window & typeof globalThis;
  const box = element.getBoundingClientRect();
  const at = {
    clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true, view: win,
    button
  };
  const targets: Record<string, Element | null> = {};
  const commonAncestor = (a: Element | null, b: Element | null) => {
    let node = a;
    while (node && b && !node.contains(b)) {
      node = node.parentElement;
    }
    return node;
  };
  return steps.reduce((done, step) => done.then(() => {
    if (typeof step === "number") {
      return new Promise<void>(resolve => setTimeout(resolve, step));
    }
    if (step === "focus") {
      const control = targets.mousedown?.closest<HTMLElement>("input, textarea, select, button, a[href], [tabindex]");
      if (control) {
        control.focus();
      } else {
        (doc.activeElement as HTMLElement | null)?.blur();
      }
      return;
    }
    const target = step === "click"
      ? commonAncestor(targets.mousedown, targets.mouseup)
      : doc.elementFromPoint(at.clientX, at.clientY);
    targets[step] = target;
    target?.dispatchEvent(step.startsWith("pointer")
      ? new win.PointerEvent(step, { ...at, pointerType, isPrimary: true })
      : new win.MouseEvent(step, at));
  }), Promise.resolve());
};

// a mouse press and release on element, which moves focus as it starts
export const mousePress = (element: Element) =>
  pressEvents(element, ["pointerdown", "mousedown", "focus", 40, "pointerup", "mouseup", "click"], "mouse");

// a mouse press on a state, after any earlier click on one can no longer make it a double-click
export const pressState = (label: string) => {
  pastDoubleClick();
  stateEllipse(label).then(ellipse => mousePress(ellipse[0]));
};

// Tab in the interactive's frame: focus moves to the next element in document order that takes Tab. The workspace
// uses tabIndex 0 and -1 only, so document order is Tab order. DevTools' key input there, which cy.press() sends,
// leaves Cypress unable to end the run.
export const pressTab = () => cy.get<HTMLIFrameElement>("iframe#interactive").then(frame => {
  const doc = frame[0].contentDocument!;
  const takesTab = [...doc.querySelectorAll<HTMLElement>("input, textarea, button, select, a[href], [tabindex]")]
    .filter(element => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled &&
      element.getClientRects().length > 0);
  const from = doc.activeElement;
  const next = takesTab.find(element => from?.compareDocumentPosition(element) === Node.DOCUMENT_POSITION_FOLLOWING);
  next?.focus();
});

export const divider = (label: string) => cy.interactive().find(`[role='separator'][aria-label='${label}']`);

// a drag of a divider's band, dispatched in one go, as a pointer that moves and releases within one frame does
export const dragEvents = (element: HTMLElement, dx: number, dy: number) => {
  const win = element.ownerDocument.defaultView as Window & typeof globalThis;
  const box = element.getBoundingClientRect();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const fire = (type: string, clientX: number, clientY: number) => element.dispatchEvent(new win.PointerEvent(type,
    { clientX, clientY, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, bubbles: true, view: win }));
  fire("pointerdown", x, y);
  fire("pointermove", x + dx / 2, y + dy / 2);
  fire("pointermove", x + dx, y + dy);
  fire("pointerup", x + dx, y + dy);
  // a real pointerup releases the capture; this one is the real mouse's id, which would otherwise stay captured
  if (element.hasPointerCapture(1)) {
    element.releasePointerCapture(1);
  }
};

// a divider dragged by dx, dy px with a mouse's pointer events, in the interactive's frame
export const dragDivider = (label: string, dx: number, dy: number) =>
  divider(label).then(band => dragEvents(band[0], dx, dy));
