import { ry, settings } from "./graph-utils";
import { maxRowOffset, rowOffset, rowOffsetSpread, scanLineGap, scanLinePositions } from "./scan-line-layout";

const words = "i went to the moon on monday and it was great you would be so impressed".split(" ");
const states = words.map((id, index) => ({ id, radius: settings.minRadius + (index % 3) * 10 }));
const radiusOf = new Map(states.map(s => [s.id, s.radius]));

// the rows as laid out, top to bottom, by each state's place before its offset
const rowsOf = (positions: Map<string, { x: number, y: number }>) => {
  const rows = new Map<number, string[]>();
  positions.forEach((at, id) => {
    const y = Math.round(at.y - rowOffset(id));
    rows.set(y, [...(rows.get(y) ?? []), id]);
  });
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids);
};

describe("rowOffset", () => {
  it("gives a word the same offset every time, and different words different ones", () => {
    expect(words.map(rowOffset)).toEqual(words.map(rowOffset));
    expect(new Set(words.map(rowOffset)).size).toBe(words.length);
  });

  it("spreads offsets about the row like a normal distribution, clipped at two standard deviations", () => {
    const offsets = Array.from({ length: 2000 }, (_, i) => rowOffset(`word${i}`));
    const mean = offsets.reduce((sum, o) => sum + o, 0) / offsets.length;
    const deviation = Math.sqrt(offsets.reduce((sum, o) => sum + (o - mean) ** 2, 0) / offsets.length);
    expect(Math.abs(mean)).toBeLessThan(0.5);
    // a normal clipped at two standard deviations keeps about 0.96 of its spread
    expect(deviation).toBeGreaterThan(0.9 * rowOffsetSpread);
    expect(deviation).toBeLessThan(rowOffsetSpread);
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(maxRowOffset);
    const within = offsets.filter(o => Math.abs(o) <= rowOffsetSpread).length / offsets.length;
    expect(within).toBeGreaterThan(0.64);
    expect(within).toBeLessThan(0.74);
  });
});

describe("scanLinePositions", () => {
  it("places nothing for no states, and one state at the origin, offset", () => {
    expect(scanLinePositions([], 2).size).toBe(0);
    expect(scanLinePositions([{ id: "moon", radius: 25 }], 2).get("moon")).toEqual({ x: 0, y: rowOffset("moon") });
  });

  it("gives the same text the same layout", () => {
    expect(scanLinePositions(states, 2)).toEqual(scanLinePositions(states.map(s => ({ ...s })), 2));
  });

  it("offsets each state from its row by its own offset", () => {
    const rows = rowsOf(scanLinePositions(states, 2));
    expect(rows.flat()).toHaveLength(words.length);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.length).toBeLessThan(words.length);
  });

  it("keeps the words' order, each row back the other way from the one before", () => {
    const positions = scanLinePositions(states, 2);
    const rows = rowsOf(positions);
    expect(rows.flat()).toEqual(words);
    rows.forEach((row, index) => {
      const xs = row.map(id => positions.get(id)!.x);
      const sorted = [...xs].sort((a, b) => index % 2 === 0 ? a - b : b - a);
      expect(xs).toEqual(sorted);
    });
  });

  it("starts each row under where the one before ended, the rows but the last as wide as the layout", () => {
    const positions = scanLinePositions(states, 2);
    const rows = rowsOf(positions);
    const left = (id: string) => positions.get(id)!.x - radiusOf.get(id)!;
    const right = (id: string) => positions.get(id)!.x + radiusOf.get(id)!;
    const edges = rows.slice(0, -1).map(row => [Math.min(...row.map(left)), Math.max(...row.map(right))]);
    edges.forEach(([l, r]) => {
      expect(l).toBeCloseTo(edges[0][0]);
      expect(r).toBeCloseTo(edges[0][1]);
    });
    rows.slice(1).forEach((row, index) => {
      const ended = rows[index][rows[index].length - 1];
      expect(Math.abs(positions.get(row[0])!.x - positions.get(ended)!.x))
        .toBeLessThanOrEqual(Math.abs(radiusOf.get(row[0])! - radiusOf.get(ended)!) + 0.001);
    });
  });

  it("chooses the rows whose width to height comes nearest the view's", () => {
    const extent = (aspect: number) => {
      const positions = scanLinePositions(states, aspect);
      const xs = [...positions].map(([id, at]) => [at.x - radiusOf.get(id)!, at.x + radiusOf.get(id)!]).flat();
      const ys = [...positions].map(([id, at]) => [at.y - ry(radiusOf.get(id)!), at.y + ry(radiusOf.get(id)!)]).flat();
      return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    };
    expect(rowsOf(scanLinePositions(states, 100))).toHaveLength(1);
    expect(rowsOf(scanLinePositions(states, 0.01))).toHaveLength(words.length);
    expect(extent(1)).toBeLessThan(extent(3));
    expect(extent(3)).toBeLessThan(extent(20));
  });

  it("overlaps no two states, leaving at least the gaps between them", () => {
    [0.5, 1, 2, 3, 6].forEach(aspect => {
      const positions = [...scanLinePositions(states, aspect)];
      positions.forEach(([a, at], i) => positions.slice(i + 1).forEach(([b, bt]) => {
        const across = Math.abs(at.x - bt.x) - radiusOf.get(a)! - radiusOf.get(b)!;
        const down = Math.abs(at.y - bt.y) - ry(radiusOf.get(a)!) - ry(radiusOf.get(b)!);
        expect(across >= scanLineGap.across - 0.001 || down >= scanLineGap.down - 0.001).toBe(true);
      }));
    });
  });

  it("centers the layout on the origin before the offsets", () => {
    const positions = scanLinePositions(states, 2);
    const xs = states.flatMap(s => [positions.get(s.id)!.x - s.radius, positions.get(s.id)!.x + s.radius]);
    const ys = states.flatMap(s => [-1, 1].map(side =>
      positions.get(s.id)!.y - rowOffset(s.id) + side * (ry(s.radius) + maxRowOffset)));
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
    expect(Math.min(...ys) + Math.max(...ys)).toBeCloseTo(0);
  });
});
