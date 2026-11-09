import { rowOffset, scanLinePositions } from "../../src/components/scan-line-layout";

const width = 1044;
const sentence = "I went to the moon on Monday and it was great you would be so impressed";
const words = sentence.toLowerCase().split(" ");
const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
const graphBox = () => shown().find(".graph-pane .graph");
const orderSwitch = () => shown().find(".setting-switch").filter(":contains('Order matters')").find("[role='switch']");

const start = (authoredState: Record<string, unknown> = {}, frameWidth = width) =>
  cy.startInteractive({
    mode: "runtime", width: frameWidth,
    authoredState: { modes: { useData: true, draw: false }, startingText: sentence, ...authoredState },
  });

type Place = { x: number, y: number, rx: number, ry: number };
// each state's ellipse, by its word
const places = () => graphBox().find("g.node").should("have.length.at.least", 1).then(nodes => {
  const at: Record<string, Place> = {};
  nodes.toArray().forEach(node => {
    const ellipse = node.querySelector("ellipse")!;
    at[node.textContent!] = {
      x: Number(ellipse.getAttribute("cx")), y: Number(ellipse.getAttribute("cy")),
      rx: Number(ellipse.getAttribute("rx")), ry: Number(ellipse.getAttribute("ry")),
    };
  });
  return at;
});

describe("the interactive's layout", () => {
  it("lays the words out in rows in the text's order, back and forth to fill the view, each offset by its word", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    graphBox().then(box => {
      const aspect = box[0].clientWidth / box[0].clientHeight;
      places().then(at => {
        const expected = scanLinePositions(words.map(id => ({ id, radius: at[id].rx })), aspect);
        words.forEach(word => {
          expect(at[word].x, `${word} x`).to.be.closeTo(expected.get(word)!.x, 1e-6);
          expect(at[word].y, `${word} y`).to.be.closeTo(expected.get(word)!.y, 1e-6);
        });
        // more than one row, and the second runs right to left
        const rowOf = (word: string) => Math.round(at[word].y - rowOffset(word));
        const rows = [...new Set(words.map(rowOf))];
        expect(rows.length).to.be.greaterThan(1);
        const second = words.filter(word => rowOf(word) === rows[1]);
        expect(at[second[0]].x).to.be.greaterThan(at[second[1]].x);
      });
    });
  });

  it("fits the view to the rows from the start", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    graphBox().find("svg").should(svg => {
      const view = svg[0].getBoundingClientRect();
      const drawn = svg[0].querySelector("g.root")!.getBoundingClientRect();
      expect(drawn.left).to.be.at.least(view.left);
      expect(drawn.right).to.be.at.most(view.right);
      expect(drawn.top).to.be.at.least(view.top);
      expect(drawn.bottom).to.be.at.most(view.bottom);
    });
  });

  it("puts each word in the same place with Order matters on and off, and switching moves none", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    places().then(on => {
      start({ orderMatters: { startsOn: false, showSwitch: true } });
      graphBox().find("g.node").should("have.length", words.length);
      places().should("deep.equal", on);
      orderSwitch().click();
      graphBox().find("line.edge").should("exist");
      places().should("deep.equal", on);
    });
  });

  [width, 560].forEach(frameWidth => it(`overlaps no two words at ${frameWidth} px`, () => {
    start({}, frameWidth);
    graphBox().find("g.node").should("have.length", words.length);
    graphBox().find("g.node ellipse").should(ellipses => {
      const boxes = ellipses.toArray().map(e => e.getBoundingClientRect());
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
        const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
        expect(apart, "two words' ellipses apart").to.equal(true);
      }));
    });
  }));

  it("keeps the words in place when the text adds some, placing only the new ones", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    places().then(before => {
      shown().find("textarea[aria-label='Your text']").type("{end}\nand i loved it");
      graphBox().find("g.node").should("have.length", words.length + 1);
      places().should(after => {
        // a word's size follows its count, which the new text changes
        words.forEach(word =>
          expect([after[word].x, after[word].y], word).to.deep.equal([before[word].x, before[word].y]));
        expect(after).to.have.property("loved");
      });
    });
  });
});
