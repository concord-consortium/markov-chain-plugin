import { ry, settings } from "./graph-utils";

// the standard deviation of a state's offset from its slot, across and down, in px; offsets are clipped at two of it
export const wobbleSpread = 11;
export const maxWobble = 2 * wobbleSpread;
// the least space between two states in neighboring slots, whatever their sizes and offsets
export const slotGap = 10;
// A state's radius grows with its share of the text, and two states' shares add up to at most 1, so two radii add up
// to at most this. The slots are spaced for it, so no later count can make neighbors overlap.
export const maxRadiusPair = 2 * settings.minRadius + (settings.maxRadius - settings.minRadius);
// from one slot's center to the next, across a row and down to the next row
export const slotPitch = {
  across: maxRadiusPair + 2 * maxWobble + slotGap,
  down: ry(maxRadiusPair) + 2 * maxWobble + slotGap,
};
// the columns are planned for the graph shown at this scale, where a typical word still reads
export const plannedScale = 0.7;

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

// how many slots a row holds in a view this many px wide
export const slotColumns = (viewWidth: number) =>
  Math.max(1, Math.floor(viewWidth / (slotPitch.across * plannedScale)));

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
  const taken = [...placed];
  const positions = new Map<string, Point>();
  states.forEach(({ id, slot }) => {
    let next = slot;
    while (taken.some(other => takes(other, slotCenter(next, columns)))) {
      next++;
    }
    const center = slotCenter(next, columns);
    const offset = wobble(id);
    const at = { x: center.x + offset.x, y: center.y + offset.y };
    taken.push(at);
    positions.set(id, at);
  });
  return positions;
};
