import { ry, settings } from "./graph-utils";

// the standard deviation of a state's offset from its slot, across and down, in px; offsets are clipped at two of it
export const wobbleSpread = 11;
export const maxWobble = 2 * wobbleSpread;
// the least space between two states in neighboring slots, whatever their sizes and offsets
export const slotGap = 10;
// the largest a state's radius grows in the slots, smaller than the plugin's so the slots can sit closer
export const slotMaxRadius = 40;
// A state's radius grows with its share of the text, and two states' shares add up to at most 1, so two radii add up
// to at most this. The slots are spaced for it, so no later count can make neighbors overlap.
export const maxRadiusPair = 2 * settings.minRadius + (slotMaxRadius - settings.minRadius);
// from one slot's center to the next, across a row and down to the next row
export const slotPitch = {
  across: maxRadiusPair + 2 * maxWobble + slotGap,
  down: ry(maxRadiusPair) + 2 * maxWobble + slotGap,
};
// the columns are planned for the graph shown at this scale: five slots across the Graph pane at the Activity Player's
// standard width
export const plannedScale = 0.69;

const modulus = 2147483647;

// a seed in [1, modulus): a polynomial hash of the text's code points in `base`
const seedOf = (text: string, base: number) =>
  1 + [...text].reduce((hash, char) => (hash * base + (char.codePointAt(0) ?? 0)) % (modulus - 1), 7);

// normal (Box-Muller over the Park-Miller generator), clipped at maxWobble
const clippedNormal = (seed: number) => {
  let state = seed;
  const next = () => (state = (state * 48271) % modulus) / modulus;
  // a seed's first draws follow it closely, so close seeds would get close offsets
  next();
  next();
  const normal = Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());
  return Math.max(-maxWobble, Math.min(maxWobble, normal * wobbleSpread));
};

// a state's offset from its slot, seeded by its id alone, so a word sits the same way in every graph; each direction
// has its own hash, so its own seed
export const wobble = (id: string) => ({ x: clippedNormal(seedOf(id, 257)), y: clippedNormal(seedOf(id, 131)) });

// how many slots a row holds in a view this many px wide: the nearest whole number at the planned scale, so a view a
// few px off its usual width keeps its count
export const slotColumns = (viewWidth: number) =>
  Math.max(1, Math.round(viewWidth / (slotPitch.across * plannedScale)));

// a slot's center: rows of `columns` slots, the first left to right and each next one back the other way
export const slotCenter = (slot: number, columns: number) => {
  const row = Math.floor(slot / columns);
  const column = slot % columns;
  return { x: (row % 2 === 0 ? column : columns - 1 - column) * slotPitch.across, y: row * slotPitch.down };
};

type Point = { x: number, y: number };

// a state already in place keeps a slot from a new one when they could overlap, whatever their sizes and offsets
const takes = (at: Point, center: Point) =>
  Math.abs(at.x - center.x) < slotPitch.across - maxWobble && Math.abs(at.y - center.y) < slotPitch.down - maxWobble;

// Positions for new states, each in the slot of its order (`slot`, its place among the graph's states in the order
// they first appear) with its wobble, or the next slot after it that no state in `placed` or placed before it takes.
// States already placed keep their positions and aren't returned.
export const slotPositions = (states: { id: string, slot: number }[], placed: Point[], columns: number) => {
  // the states in place, by the cell of slot centers they fall in: a state can only take the slots at the corners of
  // its cell, since it takes a slot only when it's less than a slot's pitch from its center either way
  const cells = new Map<string, Point[]>();
  const cellOf = (at: Point) => `${Math.floor(at.x / slotPitch.across)},${Math.floor(at.y / slotPitch.down)}`;
  const place = (at: Point) => {
    const key = cellOf(at);
    cells.set(key, [...(cells.get(key) ?? []), at]);
  };
  placed.forEach(place);
  const near = (center: Point) => {
    const column = Math.round(center.x / slotPitch.across);
    const row = Math.round(center.y / slotPitch.down);
    const nearby: Point[] = [];
    [column - 1, column].forEach(x => [row - 1, row].forEach(y => nearby.push(...(cells.get(`${x},${y}`) ?? []))));
    return nearby;
  };
  // a slot found taken stays taken, since states are only added, so it's checked once
  const blocked = new Set<number>();
  const isTaken = (slot: number) => {
    if (!blocked.has(slot)) {
      const center = slotCenter(slot, columns);
      if (near(center).some(other => takes(other, center))) {
        blocked.add(slot);
      }
    }
    return blocked.has(slot);
  };
  const positions = new Map<string, Point>();
  states.forEach(({ id, slot }) => {
    let next = slot;
    while (isTaken(next)) {
      next++;
    }
    const center = slotCenter(next, columns);
    const offset = wobble(id);
    const at = { x: center.x + offset.x, y: center.y + offset.y };
    place(at);
    positions.set(id, at);
  });
  return positions;
};
