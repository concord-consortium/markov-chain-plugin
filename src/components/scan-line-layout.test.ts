import { ry } from "./graph-utils";
import {
  maxRadiusPair, maxWobble, plannedScale, slotCenter, slotColumns, slotGap, slotPitch, slotPositions, wobble,
  wobbleSpread
} from "./scan-line-layout";

const words = "i went to the moon on monday and it was great you would be so impressed".split(" ");
const columns = 4;
const inOrder = (ids: string[], from = 0) => ids.map((id, i) => ({ id, slot: from + i }));
const inSlot = (id: string, slot: number) => {
  const center = slotCenter(slot, columns);
  return { x: center.x + wobble(id).x, y: center.y + wobble(id).y };
};

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const deviation = (values: number[]) => Math.sqrt(mean(values.map(v => (v - mean(values)) ** 2)));

describe("wobble", () => {
  const many = Array.from({ length: 2000 }, (_, i) => wobble(`word${i}`));

  it("gives a word the same offset every time, and different words different ones", () => {
    expect(words.map(wobble)).toEqual(words.map(wobble));
    expect(new Set(words.map(w => wobble(w).x)).size).toBe(words.length);
    expect(new Set(words.map(w => wobble(w).y)).size).toBe(words.length);
  });

  (["x", "y"] as const).forEach(axis =>
    it(`spreads ${axis} offsets like a normal distribution, clipped at two standard deviations`, () => {
      const offsets = many.map(offset => offset[axis]);
      expect(Math.abs(mean(offsets))).toBeLessThan(0.7);
      // a normal clipped at two standard deviations keeps about 0.96 of its spread
      expect(deviation(offsets)).toBeGreaterThan(0.9 * wobbleSpread);
      expect(deviation(offsets)).toBeLessThan(wobbleSpread);
      expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(maxWobble);
      const within = offsets.filter(o => Math.abs(o) <= wobbleSpread).length / offsets.length;
      expect(within).toBeGreaterThan(0.64);
      expect(within).toBeLessThan(0.74);
    }));

  it("draws a word's x and y offsets independently", () => {
    const xs = many.map(offset => offset.x);
    const ys = many.map(offset => offset.y);
    const covariance = mean(xs.map((x, i) => (x - mean(xs)) * (ys[i] - mean(ys))));
    expect(Math.abs(covariance / (deviation(xs) * deviation(ys)))).toBeLessThan(0.1);
  });
});

describe("slotColumns", () => {
  it("fits as many slots across the view as its width holds at the planned scale, and at least one", () => {
    const onScreen = slotPitch.across * plannedScale;
    expect(slotColumns(4 * onScreen)).toBe(4);
    expect(slotColumns(5 * onScreen - 1)).toBe(4);
    expect(slotColumns(10)).toBe(1);
  });
});

describe("slotCenter", () => {
  it("fills a row left to right, then the next right to left, starting under where the row before ended", () => {
    const centers = Array.from({ length: 3 * columns }, (_, slot) => slotCenter(slot, columns));
    const rows = [0, 1, 2].map(row => centers.slice(row * columns, (row + 1) * columns));
    rows.forEach((row, index) => {
      row.forEach(center => expect(center.y).toBe(index * slotPitch.down));
      const xs = row.map(center => center.x);
      expect(xs).toEqual([...xs].sort((a, b) => index % 2 === 0 ? a - b : b - a));
      expect(new Set(xs).size).toBe(columns);
    });
    expect(rows[1][0].x).toBe(rows[0][columns - 1].x);
    expect(rows[2][0].x).toBe(rows[1][columns - 1].x);
  });
});

describe("slotPositions", () => {
  it("puts each state in the slot of its order, offset by its wobble", () => {
    const positions = slotPositions(inOrder(words), [], columns);
    words.forEach((word, slot) => expect(positions.get(word)).toEqual(inSlot(word, slot)));
  });

  it("gives words typed one at a time the places they get laid out all at once", () => {
    const atOnce = slotPositions(inOrder(words), [], columns);
    const typed = new Map<string, { x: number, y: number }>();
    words.forEach((word, slot) => {
      const added = slotPositions([{ id: word, slot }], [...typed.values()], columns);
      expect([...added.keys()]).toEqual([word]);
      typed.set(word, added.get(word)!);
    });
    expect(typed).toEqual(atOnce);
  });

  it("returns only the new states, so states already placed keep their places", () => {
    const placed = slotPositions(inOrder(words.slice(0, 3)), [], columns);
    const added = slotPositions(inOrder(words.slice(3), 3), [...placed.values()], columns);
    expect([...added.keys()]).toEqual(words.slice(3));
  });

  it("moves a new state on to the next free slot when a state already there takes its own", () => {
    const placed = slotPositions(inOrder(["a", "b"]), [], columns);
    // dragged a little off slot 2's center, toward slot 1
    const dragged = { x: slotCenter(2, columns).x - 30, y: slotCenter(2, columns).y + 20 };
    const added = slotPositions(inOrder(["c", "d"], 2), [...placed.values(), dragged], columns);
    expect(added.get("c")).toEqual(inSlot("c", 3));
    expect(added.get("d")).toEqual(inSlot("d", 4));
  });

  it("leaves a slot free for a state placed far enough from it that they can't overlap", () => {
    const far = { x: -(slotPitch.across - maxWobble), y: 0 };
    expect(slotPositions(inOrder(["a"]), [far], columns).get("a")).toEqual(inSlot("a", 0));
  });

  it("overlaps no two states it places, at the largest two neighbors can be, with states dragged anywhere", () => {
    // two neighbors' radii add up to at most maxRadiusPair, so a pair checked at half of it each is the worst case
    const radius = maxRadiusPair / 2;
    const many = Array.from({ length: 300 }, (_, i) => `w${i}`);
    const dragged = Array.from({ length: 20 }, (_, i) =>
      ({ x: (i * 97) % (columns * slotPitch.across), y: (i * 61) % (20 * slotPitch.down) }));
    const placed = [...slotPositions(inOrder(many), dragged, columns).values()];
    const clear = (a: { x: number, y: number }, b: { x: number, y: number }) =>
      Math.abs(a.x - b.x) - 2 * radius >= slotGap - 1e-9 || Math.abs(a.y - b.y) - 2 * ry(radius) >= slotGap - 1e-9;
    placed.forEach((a, i) => {
      placed.slice(i + 1).forEach(b => expect(clear(a, b)).toBe(true));
      dragged.forEach(b => expect(clear(a, b)).toBe(true));
    });
  });
});
