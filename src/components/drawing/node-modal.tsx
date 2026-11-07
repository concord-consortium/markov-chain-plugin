import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ProbabilitySelector } from "./probability-selector";
import { Node, Edge, GraphData, ViewMode } from "../../type";
import { applyStatePercentages, percentage, reduceToSum } from "./state-editor";
import { labelProblem } from "./state-labels";

export interface NodeModalProps {
  viewMode: ViewMode;
  node?: Node,
  graph: GraphData;
  onChange: (id: string, newNode: Node, newEdge: Edge[]) => void,
  onCancel: () => void;
  // refuses an empty label, or one another state has
  uniqueLabels?: boolean;
  // names the label field, and gives the slider keys, touch and pen
  accessibleEditor?: boolean;
}

export const NodeModal = ({
  viewMode, node, graph, onChange, onCancel, uniqueLabels, accessibleEditor
}: NodeModalProps) => {
  const [label, setLabel] = useState(node?.label || "");
  // set while rendering, so a node never renders with the last one's label, which could read as a problem with it
  const [labelNode, setLabelNode] = useState(node);
  if (node !== labelNode) {
    setLabelNode(node);
    setLabel(node?.label || "");
  }
  const [exactPercentages, _setExactPercentages] = useState<number[]>([]);

  const setExactPercentages = useCallback((percentages: number[]) => {
    // make sure percentages add up to exactly 100%
    const allButLastSum = reduceToSum(percentages.slice(0, -1));
    const last = 100 - allButLastSum;
    // a key can take the last share to nothing, which rounding could leave just below 0
    percentages[percentages.length - 1] = accessibleEditor ? Math.max(0, last) : last;
    _setExactPercentages(percentages);
  }, [_setExactPercentages, accessibleEditor]);

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

  // arrows of no value share the state evenly in the editor, whose slider has nothing else to work from
  const evenShares = !!accessibleEditor && sum === 0;

  useEffect(() => {
    const percentages = edgeValues.map(edgeValue => evenShares ? 100 / edgeValues.length : percentage(edgeValue / sum));
    setExactPercentages(percentages);
  }, [edgeValues, sum, evenShares, setExactPercentages]);

  const problem = uniqueLabels && node ? labelProblem(label, node.id, graph.nodes) : undefined;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (node && !problem) {
      const newEdges = applyStatePercentages(graph.edges, node.id, evenShares ? edgeValues.length : sum,
        exactPercentages);
      onChange(node.id, { ...node, label: label.trim() }, newEdges);
    }
  }, [label, node, problem, exactPercentages, graph.edges, sum, evenShares, edgeValues, onChange]);

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
            <div className="nodeModalTitle">State: { label }</div>
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
            <input
              type="text"
              value={label}
              onChange={handleChangeLabel}
              autoFocus={true}
              aria-label={accessibleEditor ? "State name" : undefined}
            />
            { problem && <div className="nodeModalProblem" role="alert">{ problem }</div> }
            <ProbabilitySelector
              viewMode="drawing"
              exactPercentages={exactPercentages}
              edgeLabels={edgeLabels}
              onChange={setExactPercentages}
              accessible={accessibleEditor} />
            <div className="nodeModalButtons">
              <button type="submit" disabled={!!problem}>Save</button>
              <button type="button" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
