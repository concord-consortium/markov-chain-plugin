import { settings } from "../../src/components/graph-utils";
import { slotCenter, slotColumns, slotMaxRadius, slotPositions, wobble } from "../../src/components/scan-line-layout";

const width = 1044;
const sentence = "I went to the moon on Monday and it was great you would be so impressed";
const words = sentence.toLowerCase().split(" ");
const shown = () => cy.interactive().find(".workspace-body:not([hidden])");
const graphBox = () => shown().find(".graph-pane .graph");
const orderSwitch = () => shown().find(".setting-switch").filter(":contains('Order matters')").find("[role='switch']");

const start = (authoredState: Record<string, unknown> = {}, frameWidth = width, interactiveState?: unknown) =>
  cy.startInteractive({
    mode: "runtime", width: frameWidth, interactiveState,
    authoredState: { modes: { useData: true, draw: false }, startingText: sentence, ...authoredState },
  });

const textBox = () => shown().find("textarea[aria-label='Your text']");
// the slots a row of the Graph pane holds, from the width the graph measures
const columns = () => graphBox().then(box => slotColumns(box[0].clientWidth));
const inSlot = (word: string, slot: number, across: number) => {
  const center = slotCenter(slot, across);
  return { x: center.x + wobble(word).x, y: center.y + wobble(word).y };
};
// "I went to" opened from saved work with its states at these places
const startSaved = (placed: { x: number, y: number }[]) => start({ startingText: "I went to" }, width, {
  version: 1, caseSensitive: false,
  useData: { positions: placed.reduce<number[]>((all, at) => [...all, at.x, at.y], []) },
});
// types each word and its space, waiting for the graph to take it before the next
const typeWords = (typed: string[], before = 0) => typed.forEach((word, i) => {
  textBox().type(`${word} `);
  graphBox().find("g.node").should("have.length", before + i + 1);
});

type Place = { x: number, y: number, rx: number, ry: number };
// each state's ellipse, by its word
const places = () => graphBox().find("g.node").should("have.length.at.least", 1).then(nodes => {
  const at: Record<string, Place> = {};
  nodes.toArray().forEach(node => {
    const ellipse = node.querySelector("ellipse")!;
    // by id: a long word's label can be cut short to fit its oval
    at[(node as unknown as { __data__: { id: string } }).__data__.id] = {
      x: Number(ellipse.getAttribute("cx")), y: Number(ellipse.getAttribute("cy")),
      rx: Number(ellipse.getAttribute("rx")), ry: Number(ellipse.getAttribute("ry")),
    };
  });
  return at;
});

describe("the interactive's layout", () => {
  it("puts each word in the slot of its order, in rows back and forth across the view, offset by its word", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    columns().then(across => {
      // five slots across the Graph pane at the Activity Player's standard width
      expect(across).to.equal(5);
      places().then(at => {
        const expected = slotPositions(words.map((id, slot) => ({ id, slot })), [], across);
        words.forEach(word => {
          expect(at[word].x, `${word} x`).to.be.closeTo(expected.get(word)!.x, 1e-6);
          expect(at[word].y, `${word} y`).to.be.closeTo(expected.get(word)!.y, 1e-6);
        });
        // more than one row, and the second runs right to left
        const rowOf = (word: string) => Math.round(at[word].y - wobble(word).y);
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

  it("grows a frequent word only to the slots' largest radius", () => {
    // "a" is 4 of the 5 words
    start({ startingText: "a a a a b" });
    graphBox().find("g.node").should("have.length", 2);
    places().should(at => {
      expect(at.a.rx).to.be.closeTo(settings.minRadius + (slotMaxRadius - settings.minRadius) * 0.8, 1e-6);
      expect(at.b.rx).to.be.closeTo(settings.minRadius + (slotMaxRadius - settings.minRadius) * 0.2, 1e-6);
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

  it("puts words typed one at a time where the whole text puts them", () => {
    start();
    graphBox().find("g.node").should("have.length", words.length);
    places().then(pasted => {
      start({ startingText: "" });
      textBox().should("have.value", "");
      typeWords(sentence.split(" "));
      places().should(typed => words.forEach(word =>
        expect([typed[word].x, typed[word].y], word).to.deep.equal([pasted[word].x, pasted[word].y])));
    });
  });

  // a word the student dragged is opened from saved work at the place the drag left it; d3's drag handling throws in
  // Cypress's frame, so the tests start from that saved place
  it("keeps placed words, and a word the student moved, where they are when a new word comes", () => {
    start({ startingText: "" });
    columns().then(across => {
      const moved = { x: inSlot("went", 1, across).x + 40, y: inSlot("went", 1, across).y + 70 };
      const placed = [inSlot("i", 0, across), moved, inSlot("to", 2, across)];
      startSaved(placed);
      graphBox().find("g.node").should("have.length", 3);
      textBox().type(" the ");
      graphBox().find("g.node").should("have.length", 4);
      places().should(after => ["i", "went", "to"].forEach((word, i) => {
        expect(after[word].x, word).to.be.closeTo(placed[i].x, 0.5);
        expect(after[word].y, word).to.be.closeTo(placed[i].y, 0.5);
      }));
    });
  });

  it("moves a new word on to the next free slot when a word the student moved there takes its own", () => {
    // the pane's width, for its slots, before the saved work is opened
    start({ startingText: "" });
    columns().then(across => {
      // "to" saved where a drag left it, on slot 3, where the next word would go
      const moved = slotCenter(3, across);
      const placed = [inSlot("i", 0, across), inSlot("went", 1, across), { x: moved.x + 12, y: moved.y - 9 }];
      startSaved(placed);
      graphBox().find("g.node").should("have.length", 3);
      textBox().type(" the ");
      graphBox().find("g.node").should("have.length", 4);
      places().should(after => {
        const next = inSlot("the", 4, across);
        expect(after.to.x).to.be.closeTo(placed[2].x, 0.5);
        expect(after.the.x).to.be.closeTo(next.x, 1e-6);
        expect(after.the.y).to.be.closeTo(next.y, 1e-6);
      });
    });
  });

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
