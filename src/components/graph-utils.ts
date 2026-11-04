import { Edge } from "../type";

export type GraphSettings = {
  minRadius: number;
  maxRadius: number;
  minStroke: number;
  maxStroke: number;
  marginFactor: number;
  minFontSize: number;
};

export const settings: GraphSettings = {
  minRadius: 25,
  maxRadius: 75,
  minStroke: 2,
  maxStroke: 4.5,
  marginFactor: 0.8,
  minFontSize: 10,
};

export const ry = (radius: number) => radius / 2;

// an edge's width shows its probability among the edges leaving its own state, loops included
export const stateEdgeWeights = (edges: Edge[]) => {
  const stateTotals = new Map<string, number>();
  edges.forEach(edge => stateTotals.set(edge.from, (stateTotals.get(edge.from) ?? 0) + edge.value));

  const { minStroke, maxStroke } = settings;
  return (edge: Edge) => {
    const total = stateTotals.get(edge.from) ?? 0;
    return total > 0 ? minStroke + ((maxStroke - minStroke) * (edge.value / total)) : minStroke;
  };
};

// "byState": an arrow's share of its own state's outgoing arrows; "equal": every arrow the thinnest width
export type ArrowWidths = "byState" | "equal";
export const edgeWeights = (edges: Edge[], widths: ArrowWidths) =>
  widths === "equal" ? () => settings.minStroke : stateEdgeWeights(edges);

type SignatureGraph = {
  nodes: {id: string, label: string, weight: number, radius: number, x: number, y: number, loopWeight: number}[];
  edges: {source: {id: string}, target: {id: string}, weight: number, value: number}[];
};

// loops are drawn from their nodes, not from the edge list, so a loop's width is part of its node's signature;
// an arrow of no value is drawn differently whatever its width
export const graphSignature = (graph: SignatureGraph) => {
  const nodeSignature = graph.nodes.map(n =>
    `${n.id}/${n.label}/${n.weight}/${n.radius}/${n.x}/${n.y}/${n.loopWeight}`);
  const edgeSignature = graph.edges.map(e => `${e.source.id}/${e.target.id}/${e.weight}/${e.value > 0}`);
  return `${nodeSignature}::${edgeSignature}`;
};

// arrowhead markers are sized in line widths; the tip is this many widths past the line's end
export const arrowHeadReach = 3;

export const pullBackLineEnd = (x1: number, y1: number, x2: number, y2: number, width: number) => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const pullBack = Math.min(arrowHeadReach * width, Math.max(0, length - 1));
  if (pullBack <= 0) {
    return { x: x2, y: y2 };
  }
  const ratio = (length - pullBack) / length;
  return { x: x1 + (x2 - x1) * ratio, y: y1 + (y2 - y1) * ratio };
};

const startLoopAngle = 0.25 * Math.PI;
// where a loop (a circle of radius ry centered rx left of its state) crosses back over the state's outline
const endLoopAngle = 2 * Math.PI - Math.acos(2 / 3);

// the arc's end angle that puts the tip of its arrowhead, which points along the arc's tangent, on the state's outline
const trimmedLoopEndAngle = (a: number, arrowWidth: number) => {
  const b = ry(a);
  const reach = arrowHeadReach * arrowWidth;
  const tipOutside = (angle: number) => {
    const tipX = -a + b * Math.cos(angle) - reach * Math.sin(angle);
    const tipY = b * Math.sin(angle) + reach * Math.cos(angle);
    return (tipX / a) ** 2 + (tipY / b) ** 2 > 1;
  };
  // trimming by the arc length of the reach always overshoots, since the tangent cuts the curve short
  let low = 0;
  let high = reach / b;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (tipOutside(endLoopAngle - mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return endLoopAngle - high;
};

export const nodeLoopPath = (node: {x: number, y: number, radius: number}, arrowWidth = 0) => {
  const a = node.radius;
  const b = ry(node.radius);
  const clockwise = false;

  const circle = { x: node.x - a, y: node.y };
  const radius = b;
  const endAngle = trimmedLoopEndAngle(a, arrowWidth);

  const startX = circle.x + radius * Math.cos(startLoopAngle);
  const startY = circle.y + radius * Math.sin(startLoopAngle);
  const endX = circle.x + radius * Math.cos(endAngle);
  const endY = circle.y + radius * Math.sin(endAngle);

  const largeArc = Math.abs(endAngle - startLoopAngle) <= Math.PI ? "0" : "1";
  const sweepFlag = clockwise ? "0" : "1";

  const d = "M " + startX + "," + startY + " A " + radius + "," + radius + " 0 " +
            largeArc + "," + sweepFlag + " " + endX + "," + endY;

  return d;
};

// A label being fitted: the font shrinks to settings.minFontSize, then the label is cut short with "...", then the
// font shrinks again; text is the hidden element it is measured in.
interface LabelFit {
  original: string;
  label: string;
  fontSize: number;
  truncateLabelAt: number;
  maxHeight: number;
  maxWidth: number;
  done: boolean;
  text: HTMLElement;
}

const stepLabelFit = (fit: LabelFit, height: number, width: number) => {
  if ((Math.ceil(height) > fit.maxHeight) || (Math.ceil(width) > fit.maxWidth)) {
    if ((fit.fontSize > settings.minFontSize) || (fit.truncateLabelAt <= 0)) {
      fit.fontSize--;
    } else {
      fit.truncateLabelAt--;
      fit.label = fit.original.substring(0, fit.truncateLabelAt) + "...";
      fit.text.textContent = fit.label;
    }
  } else {
    fit.done = true;
  }
};

// Every state's label and font size. Each label has its own element, and the labels take their steps together, all
// sizes set and then all read, so each step lays the page out once for all of them.
export const calculateNodeFontSizes = (nodes: {label: string, radius: number}[]) => {
  const fits: LabelFit[] = nodes.map(d => {
    const text = document.createElement("span");
    text.style.height = "auto";
    text.style.width = "auto";
    text.style.position = "absolute";
    text.style.whiteSpace = "no-wrap";
    text.style.opacity = "0";
    text.textContent = d.label;
    document.body.appendChild(text);
    const maxHeight = ry(d.radius * 2) * settings.marginFactor;
    return {
      original: d.label, label: d.label, fontSize: maxHeight, truncateLabelAt: d.label.length - 1, maxHeight,
      maxWidth: d.radius * 2 * settings.marginFactor, done: false, text
    };
  });
  let fitting = fits;
  for (;;) {
    fitting = fitting.filter(fit => !fit.done && fit.fontSize > 1);
    if (fitting.length === 0) {
      break;
    }
    fitting.forEach(fit => { fit.text.style.fontSize = fit.fontSize + "px"; });
    const measured = fitting.map(fit => [fit.text.clientHeight, fit.text.clientWidth]);
    fitting.forEach((fit, i) => stepLabelFit(fit, measured[i][0], measured[i][1]));
  }
  fits.forEach(fit => document.body.removeChild(fit.text));
  return fits.map(({ label, fontSize }) => ({ label, fontSize }));
};

// with keepPositions, a state already drawn or given a position keeps it rather than being laid out
export const isPlaced = (keepPositions: boolean, drawn: boolean, node: { x?: number, y?: number }) =>
  keepPositions && (drawn || (node.x != null && node.y != null));

// with keepPositions: lay out every state when more than half are new, only the new ones otherwise,
// and none when none is new
export const layoutFor = (placed: number, total: number): "whole" | "new" | "none" =>
  placed === total ? "none" : (total - placed) * 2 > total ? "whole" : "new";

// the distance the layout aims for between the centers of two states of these radii
export const linkDistance = (radius: number, otherRadius: number) => (radius + otherRadius) * 1.5;

const startDistance = linkDistance(settings.minRadius, settings.minRadius);
const startAngles = 12;

// Where a new state starts: the layout's distance between two of the smallest states from the first placed state
// with an arrow to it, at the spot nearest the layout's center (the origin) that is that far from every other placed
// state, so a chain added a word at a time winds around the graph rather than running off in one direction; where no
// spot is that clear, the clearest one.
// With no placed source, at the origin.
export const startPosition = (id: string, edges: { from: string, to: string }[],
  placed: Map<string, { x: number, y: number }>) => {
  const sourceEdge = edges.find(edge => edge.to === id && placed.has(edge.from));
  const source = sourceEdge && placed.get(sourceEdge.from);
  if (!sourceEdge || !source) {
    return { x: 0, y: 0 };
  }
  const others = [...placed].filter(([other]) => other !== sourceEdge.from && other !== id).map(([, at]) => at);
  const candidates = Array.from({ length: startAngles }, (_, i) => {
    const angle = 2 * Math.PI * i / startAngles;
    const at = { x: source.x + startDistance * Math.cos(angle), y: source.y + startDistance * Math.sin(angle) };
    const clearance = Math.min(Infinity, ...others.map(o => Math.hypot(o.x - at.x, o.y - at.y)));
    return { at, clearance, fromCenter: Math.hypot(at.x, at.y) };
  });
  const clear = candidates.filter(c => c.clearance >= startDistance);
  const best = clear.length > 0
    ? clear.reduce((a, b) => b.fromCenter < a.fromCenter ? b : a)
    : candidates.reduce((a, b) => b.clearance > a.clearance ? b : a);
  return best.at;
};

// Where each of the new states (in order) starts, each also clear of the new states started before it, so states a
// commit adds from one state don't start on one spot, and a chain added in one commit starts from its own states.
// None start when the whole graph is laid out, which places every state itself.
export const startPositions = (ids: string[], edges: { from: string, to: string }[],
  placed: Map<string, { x: number, y: number }>) => {
  const starts = new Map<string, { x: number, y: number }>();
  if (layoutFor(placed.size, placed.size + ids.length) !== "new") {
    return starts;
  }
  const started = new Map(placed);
  ids.forEach(id => {
    const start = startPosition(id, edges, started);
    started.set(id, start);
    starts.set(id, start);
  });
  return starts;
};
