import { parseTransform } from "../support/workspace";

const width = 1044;
const words = Array.from({ length: 300 }, (_, i) => `w${i}`);
const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
const textBox = () => shown().find("textarea[aria-label='Your text']");
const graph = () => shown().find(".graph-pane .graph > svg");
const states = () => shown().find(".graph-pane g.node");
const toolButton = (title: string) => shown().find(`.graph-pane button[title='${title}']`);
const scale = () => shown().find(".graph-pane g.root").invoke("attr", "transform")
  .then(transform => parseTransform(transform as unknown as string).k);

// replaces the whole text in one paste, as a student cutting most of a long input does
const pasteOver = (text: string) => textBox().then(box => {
  const area = box[0] as HTMLTextAreaElement;
  const win = area.ownerDocument.defaultView as Window & typeof globalThis;
  Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(area, text);
  area.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: text }));
});

const expectCentered = () => graph().should(svg => {
  const view = svg[0].getBoundingClientRect();
  const drawn = svg[0].querySelector("g.root")!.getBoundingClientRect();
  expect(drawn.width, "graph width").to.be.greaterThan(0);
  expect(drawn.left + drawn.width / 2, "graph center x").to.be.closeTo(view.left + view.width / 2, 10);
  expect(drawn.top + drawn.height / 2, "graph center y").to.be.closeTo(view.top + view.height / 2, 10);
});

// the states left after the cut stay where they were, near the edge of the graph that was
const farthestStates = () => graph().then(svg => {
  const at = words.map((word, index) => {
    const node = [...svg[0].querySelectorAll("g.node")].find(g => g.textContent === word)!;
    const ellipse = node.querySelector("ellipse")!;
    return { place: index, away: Math.hypot(Number(ellipse.getAttribute("cx")), Number(ellipse.getAttribute("cy"))) };
  });
  const { place } = at.slice(1, -1).reduce((far, next) => next.away > far.away ? next : far);
  return words.slice(place - 1, place + 2);
});

describe("a graph mostly removed", () => {
  beforeEach(() => {
    cy.startInteractive({ mode: "runtime", width, authoredState: { startingText: words.join(" ") } });
    states().should("have.length", words.length);
  });

  it("fits what is left into the center of the view", () => {
    farthestStates().then(left => {
      pasteOver(left.join(" "));
      states().should("have.length", 3);
      expectCentered();
    });
  });

  it("brings what is left to the center at Recenter View and Fit View once the student has taken the view", () => {
    farthestStates().then(left => {
      graph().trigger("wheel", { deltaY: 100 });
      pasteOver(left.join(" "));
      states().should("have.length", 3);
      toolButton("Recenter View").click();
      expectCentered();
      scale().then(recentered => {
        toolButton("Fit View").click();
        expectCentered();
        scale().should("be.greaterThan", recentered);
      });
    });
  });
});
