import { ellipse } from "../support/graph";

// the browser only fires a click when the press and release land on the same element, which synthetic
// click events skip, so the click tests press the mouse through Chrome's DevTools protocol
const mouse = (type: string, x: number, y: number) =>
  Cypress.automation("remote:debugger:protocol", {
    command: "Input.dispatchMouseEvent",
    params: { type, x, y, button: "left", clickCount: 1 }
  });

const stateCenter = (label: string) =>
  cy.get("iframe#plugin").then($frame => {
    const frame = $frame[0] as HTMLIFrameElement;
    const inPlugin = [...frame.contentDocument!.querySelectorAll("g.node")]
      .find(node => node.textContent === label)!.querySelector("ellipse")!.getBoundingClientRect();
    const inPage = frame.getBoundingClientRect();
    const aut = window.top!.document.querySelector<HTMLIFrameElement>("iframe.aut-iframe")!;
    const inTop = aut.getBoundingClientRect();
    const scale = inTop.width / aut.contentWindow!.innerWidth;
    return {
      x: inTop.x + (inPage.x + inPlugin.x + inPlugin.width / 2) * scale,
      y: inTop.y + (inPage.y + inPlugin.y + inPlugin.height / 2) * scale
    };
  });

const pressAndRelease = ({ x, y }: { x: number, y: number }) =>
  cy.then(() => mouse("mouseMoved", x, y)
    .then(() => mouse("mousePressed", x, y))
    // a still mouse can report a move to the same point while pressed
    .then(() => mouse("mouseMoved", x, y))
    .then(() => new Promise(resolve => setTimeout(resolve, 40)))
    .then(() => mouse("mouseReleased", x, y)));

describe("Clicks on states", () => {
  beforeEach(() => {
    cy.startPlugin();
    cy.plugin().contains("button", "Drawing").click();
    cy.plugin().find("button[title='Create From Text']").click();
    cy.plugin().find("textarea").type("a b a c a b");
    cy.plugin().find("button[title='Select']").click();
    cy.plugin().find("g.node").should("have.length", 3);
  });

  it("selects a state on a click", () => {
    ellipse("a").should("have.attr", "fill", "#fff");
    stateCenter("a").then(pressAndRelease);
    ellipse("a").should("not.have.attr", "fill", "#fff");
  });

  it("opens the state editor on a double-click", () => {
    cy.plugin().find(".nodeModal").should("not.exist");
    stateCenter("a").then(point => {
      pressAndRelease(point);
      cy.wait(100);
      pressAndRelease(point);
    });
    cy.plugin().find(".nodeModal").should("exist");
  });

  it("saves a dragged state's new position", () => {
    cy.getPluginState().then(before => {
      const saved = before.nodes.find((n: any) => n.label === "a");
      stateCenter("a").then(({ x, y }) => cy.then(() => mouse("mouseMoved", x, y)
        .then(() => mouse("mousePressed", x, y))
        .then(() => mouse("mouseMoved", x + 20, y + 10))
        .then(() => mouse("mouseMoved", x + 50, y + 25))
        .then(() => mouse("mouseReleased", x + 50, y + 25))));
      cy.getPluginState().then(after => {
        const moved = after.nodes.find((n: any) => n.label === "a");
        expect(moved.x).not.to.be.closeTo(saved.x, 1);
        expect(moved.y).not.to.be.closeTo(saved.y, 1);
      });
    });
  });

  it("draws the rubber band before the mouse move returns", () => {
    cy.plugin().find("button[title='Add Transition']").click();
    cy.clickState("c");
    cy.plugin().find("line.rubberband").should("not.exist");
    cy.get<HTMLIFrameElement>("iframe#plugin").its("0.contentWindow").then(win => {
      win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 100, clientY: 100 }));
      expect(win.document.querySelectorAll("line.rubberband")).to.have.length(1);
    });
  });
});
