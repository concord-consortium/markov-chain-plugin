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

type SignatureGraph = {
  nodes: {id: string, label: string, weight: number, radius: number, x: number, y: number, loopWeight: number}[];
  edges: {source: {id: string}, target: {id: string}, weight: number}[];
};

// loops are drawn from their nodes, not from the edge list, so a loop's width is part of its node's signature
export const graphSignature = (graph: SignatureGraph) => {
  const nodeSignature = graph.nodes.map(n =>
    `${n.id}/${n.label}/${n.weight}/${n.radius}/${n.x}/${n.y}/${n.loopWeight}`);
  const edgeSignature = graph.edges.map(e => `${e.source.id}/${e.target.id}/${e.weight}`);
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

export const calculateNodeFontSize = (d: {label: string, radius: number}) => {
  let label = d.label;
  const maxHeight = ry(d.radius * 2) * settings.marginFactor;
  const maxWidth = d.radius * 2 * settings.marginFactor;

  const text = document.createElement("span");
  text.style.height = "auto";
  text.style.width = "auto";
  text.style.position = "absolute";
  text.style.whiteSpace = "no-wrap";
  text.style.opacity = "0";
  text.textContent = label;
  document.body.appendChild(text);

  let fontSize = maxHeight;
  let truncateLabelAt = label.length - 1;
  while (fontSize > 1) {
    text.style.fontSize = fontSize + "px";
    if ((Math.ceil(text.clientHeight) > maxHeight) || (Math.ceil(text.clientWidth) > maxWidth)) {
      if ((fontSize > settings.minFontSize) || (truncateLabelAt <= 0)) {
        fontSize--;
      } else {
        truncateLabelAt--;
        if (truncateLabelAt >= 0) {
          label = d.label.substring(0, truncateLabelAt) + "...";
          text.textContent = label;
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }
  document.body.removeChild(text);

  return { label, fontSize };
};
