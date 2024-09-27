import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ProbabilitySelector, percentage, reduceToSum } from "./probability-selector";
import { Node, Edge, GraphData } from "../../type";
import { ViewMode } from "../../hooks/use-codap";

export interface NodeModalProps {
  viewMode: ViewMode;
  node?: Node,
  graph: GraphData;
  onChange: (id: string, newNode: Node, newEdge: Edge[]) => void,
  onCancel: () => void
}

export const NodeModal = ({ viewMode, node, graph, onChange, onCancel }: NodeModalProps) => {
  const [label, setLabel] = useState(node?.label || "");
  const [exactPercentages, _setExactPercentages] = useState<number[]>([]);

  const setExactPercentages = useCallback((percentages: number[]) => {
    // make sure percentages add up to exactly 100%
    const allButLastSum = reduceToSum(percentages.slice(0, -1));
    percentages[percentages.length - 1] = 100 - allButLastSum;
    _setExactPercentages(percentages);
  }, [_setExactPercentages]);

  const fromEdges = useMemo(() => {
    return node ? graph.edges.filter(e => e.from === node.id) : [];
  }, [node, graph.edges]);

  const edgeLabels = useMemo(() => {
    const labels = graph.nodes.reduce<Record<string, string>>((acc, cur) => {
      acc[cur.id] = cur.label;
      return acc;
    }, {});
    return fromEdges.map(e => labels[e.to]);
  }, [graph.nodes, fromEdges]);

  const edgeValues = useMemo(() => fromEdges.map(e => e.value), [fromEdges]);
  const sum = useMemo(() => reduceToSum(edgeValues), [edgeValues]);

  useEffect(() => {
    const percentages = edgeValues.map(edgeValue => percentage(edgeValue / sum));
    setExactPercentages(percentages);
  }, [edgeValues, sum, setExactPercentages]);

  useEffect(() => {
    setLabel(node?.label || "");
  }, [node, setLabel]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (node) {
      let valueIndex = 0;
      const newEdges = graph.edges.map(edge => {
        if (edge.from === node.id) {
          const value = sum * exactPercentages[valueIndex++];
          return { ...edge, value };
        } else {
          return edge;
        }
      });
      onChange(node.id, { ...node, label: label.trim() }, newEdges);
    }
  }, [label, node, exactPercentages, graph.edges, sum, onChange]);

  const handleChangeLabel = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  if (!node) {
    return null;
  }

  if (viewMode === "dataset") {
    return (
      <>
        <div className="nodeModalBackground" />
        <div className="nodeModal">
          <div className="nodeModalContent">
            <div className="nodeModalTitle">State: {label}</div>
            <form>
              <ProbabilitySelector
                viewMode={viewMode}
                exactPercentages={exactPercentages}
                edgeLabels={edgeLabels}
                onChange={setExactPercentages} />
              <div className="nodeModalButtons">
                <button onClick={onCancel}>Close</button>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="nodeModalBackground" />
      <div className="nodeModal">
        <div className="nodeModalContent">
          <div className="nodeModalTitle">Update State</div>
          <form onSubmit={handleSubmit}>
            <input type="text" value={label} onChange={handleChangeLabel} autoFocus={true} />
            <ProbabilitySelector
              viewMode="drawing"
              exactPercentages={exactPercentages}
              edgeLabels={edgeLabels}
              onChange={setExactPercentages} />
            <div className="nodeModalButtons">
              <button type="submit">Save</button>
              <button onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
