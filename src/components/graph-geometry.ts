import { pullBackLineEnd, ry } from "./graph-utils";

export type D3Node = {
  index: number,
  id: string;
  label: string;
  x: number,
  y: number,
  fx?: number | null,
  fy?: number | null,
  // with keepPositions, a state that keeps its position rather than being laid out
  placed?: boolean,
  radius: number,
  loops: boolean
  loopWeight: number,
  weight: number;
};

export type D3Edge = {
  source: D3Node,
  target: D3Node,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  weight: number;
  value: number;
};

export type D3Graph = {
  nodes: D3Node[],
  edges: D3Edge[],
};

export type FindLineBetweenEllipsesArgs = {
  x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, nodeEdgeCount: {source: D3Node, count: number}
};
export type FindPointOnEllipseArgs = {
  x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, a: number, b: number, angleDelta: number
};

const bidirectionalEdgeAngle = 10 * (Math.PI / 180);
const Pi2 = Math.PI * 2;

export const normalizeAngle = (radians: number): number => {
  return radians - Pi2 * Math.floor(radians / Pi2);
};

export const findPointOnEllipse = ({ x1, y1, x2, y2, cx, cy, a, b, angleDelta }: FindPointOnEllipseArgs) => {
  const angle = normalizeAngle(Math.atan2(y2 - y1, x2 - x1) + angleDelta);
  return { x: cx + a * Math.cos(angle), y: cy + b * Math.sin(angle) };
};

export const findLineBetweenEllipses = ({ x1, y1, r1, x2, y2, r2, nodeEdgeCount }: FindLineBetweenEllipsesArgs) => {
  const angleDelta = nodeEdgeCount.count > 1 ? bidirectionalEdgeAngle : 0;
  return [
    findPointOnEllipse({ x1, y1, x2, y2, cx: x1, cy: y1, a: r1, b: ry(r1), angleDelta }),
    findPointOnEllipse({ x1: x2, y1: y2, x2: x1, y2: y1, cx: x2, cy: y2, a: r2, b: ry(r2), angleDelta: -angleDelta })
  ];
};

export const calculateEdges = (edges: D3Edge[]) => {
  const getKey = (edge: D3Edge) => {
    const ids = [edge.source.id, edge.target.id];
    ids.sort();
    return ids.join(":");
  };
  const nodeEdgeCounts = edges.reduce<Map<string,{source: D3Node, count: number}>>((acc, edge) => {
    const key = getKey(edge);
    const entry = acc.get(key) || { source: edge.source, count: 0 };
    entry.count++;
    acc.set(key, entry);
    return acc;
  }, new Map());

  return edges.map(edge => {
    const [sourceEdge, targetEdge] =
      findLineBetweenEllipses({
        x1: edge.source.x,
        y1: edge.source.y,
        r1: edge.source.radius,
        x2: edge.target.x,
        y2: edge.target.y,
        r2: edge.target.radius,
        nodeEdgeCount: nodeEdgeCounts.get(getKey(edge))!
      });
    edge.sourceX = sourceEdge.x;
    edge.sourceY = sourceEdge.y;
    edge.targetX = targetEdge.x;
    edge.targetY = targetEdge.y;
    return edge;
  });
};

export const lineDashArray = (edge: D3Edge) => edge.value ? "" : "4";

export const lineEnd = (edge: D3Edge) =>
  pullBackLineEnd(edge.sourceX, edge.sourceY, edge.targetX, edge.targetY, edge.weight);
