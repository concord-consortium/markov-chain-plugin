import { ry } from "./graph-utils";

// the space between two states beside each other in a row, and the least between two rows
export const scanLineGap = { across: 60, down: 36 };
// the standard deviation of a state's offset from its row, in px; offsets are clipped at two of it
export const rowOffsetSpread = 8;
export const maxRowOffset = 2 * rowOffsetSpread;

const modulus = 2147483647;

// a word's seed in [1, modulus): a polynomial hash of its code points
const seedOf = (text: string) =>
  1 + [...text].reduce((hash, char) => (hash * 131 + (char.codePointAt(0) ?? 0)) % (modulus - 1), 7);

// a state's offset from its row: normal (Box-Muller over the Park-Miller generator), seeded by its id alone, so a
// word sits the same way in every graph
export const rowOffset = (id: string) => {
  let state = seedOf(id);
  const next = () => (state = (state * 48271) % modulus) / modulus;
  // a seed's first draws follow it closely, so close seeds would get close offsets
  next();
  next();
  const normal = Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next());
  return Math.max(-maxRowOffset, Math.min(maxRowOffset, normal * rowOffsetSpread));
};

export interface ScanLineState { id: string, radius: number }

const widthOf = (states: ScanLineState[]) =>
  states.reduce((sum, s) => sum + 2 * s.radius, 0) + scanLineGap.across * Math.max(0, states.length - 1);

// states in order, a row ending before the next state would take it past `width`; a wider state has a row to itself
const wrap = (states: ScanLineState[], width: number) => {
  const rows: ScanLineState[][] = [[]];
  let rowWidth = 0;
  states.forEach(state => {
    const row = rows[rows.length - 1];
    const wider = rowWidth + scanLineGap.across + 2 * state.radius;
    if (row.length > 0 && wider > width) {
      rows.push([state]);
      rowWidth = 2 * state.radius;
    } else {
      row.push(state);
      rowWidth = row.length > 1 ? wider : 2 * state.radius;
    }
  });
  return rows;
};

// half a row's height, with room for its states' offsets
const halfHeight = (row: ScanLineState[]) => Math.max(...row.map(s => ry(s.radius))) + maxRowOffset;

// Rows filling the layout's width, the first left to right and each next one back the other way, every row but the
// last spread to the full width so each starts under the one before it ended; centered on the origin, offsets aside.
const place = (rows: ScanLineState[][]) => {
  const width = Math.max(...rows.map(widthOf));
  const positions = new Map<string, { x: number, y: number }>();
  let y = 0;
  rows.forEach((row, index) => {
    if (index > 0) {
      y += halfHeight(rows[index - 1]) + scanLineGap.down + halfHeight(row);
    }
    const last = index === rows.length - 1;
    const spare = width - widthOf(row);
    const gap = scanLineGap.across + (!last && row.length > 1 ? spare / (row.length - 1) : 0);
    let edge = 0;
    row.forEach(state => {
      const across = edge + state.radius;
      positions.set(state.id, { x: index % 2 === 0 ? across : width - across, y });
      edge += 2 * state.radius + gap;
    });
  });
  const height = y + halfHeight(rows[0]) + halfHeight(rows[rows.length - 1]);
  const top = -halfHeight(rows[0]);
  positions.forEach(at => {
    at.x -= width / 2;
    at.y -= top + height / 2;
  });
  return { positions, width, height };
};

// States in their order, back and forth in rows, the rows chosen so the layout's width to height comes nearest
// `aspect`, each state offset from its row by rowOffset.
export const scanLinePositions = (states: ScanLineState[], aspect: number) => {
  if (states.length === 0) {
    return new Map<string, { x: number, y: number }>();
  }
  const total = widthOf(states);
  let best: ReturnType<typeof place> | undefined;
  let bestScore = Infinity;
  for (let rowCount = 1; rowCount <= states.length; rowCount++) {
    const layout = place(wrap(states, total / rowCount));
    const ratio = layout.width / layout.height;
    const score = Math.abs(Math.log(ratio / aspect));
    if (score < bestScore) {
      best = layout;
      bestScore = score;
    }
    // more rows only make the layout narrower for its height
    if (ratio < aspect) {
      break;
    }
  }
  const positions = best?.positions ?? new Map<string, { x: number, y: number }>();
  positions.forEach((at, id) => (at.y += rowOffset(id)));
  return positions;
};
