// Brings the first lit row or word of a pane into view, scrolling only the pane's own scroller, by as little as it
// takes, so the page around the interactive never moves.

const scrollWithin = (container: HTMLElement, element: Element) => {
  const box = element.getBoundingClientRect();
  const view = container.getBoundingClientRect();
  // a table's header sticks to the scroller's top, over the rows
  const top = view.top + (container.querySelector("thead")?.getBoundingClientRect().height ?? 0);
  if (box.top < top) {
    container.scrollTop -= top - box.top;
  } else if (box.bottom > view.bottom) {
    container.scrollTop += Math.min(box.bottom - view.bottom, box.top - top);
  }
};

export const scrollToLit = (root: ParentNode, scroller: string, lit: string) => {
  const container = root.querySelector<HTMLElement>(scroller);
  const element = container?.querySelector(lit);
  if (container && element) {
    scrollWithin(container, element);
  }
};

// the text box's first mark, which sits in the backdrop at the place its word has in the text box's content
export const scrollTextToMark = (root: ParentNode) => {
  const textarea = root.querySelector<HTMLTextAreaElement>(".text-input textarea");
  const mark = root.querySelector<HTMLElement>(".text-input .backdrop mark");
  if (!textarea || !mark) {
    return;
  }
  const top = mark.offsetTop;
  const bottom = top + mark.offsetHeight;
  if (top < textarea.scrollTop) {
    textarea.scrollTop = top;
  } else if (bottom > textarea.scrollTop + textarea.clientHeight) {
    textarea.scrollTop = bottom - textarea.clientHeight;
  }
};
