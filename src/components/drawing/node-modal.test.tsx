import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeModal } from "./node-modal";
import { GraphData } from "../../type";

const state = (id: string) => ({ id, label: id, value: 1 });

const renderEditor = (graph: GraphData, onChange = jest.fn()) =>
  render(<NodeModal viewMode="drawing" node={graph.nodes[0]} graph={graph} onChange={onChange} onCancel={jest.fn()} />);

describe("NodeModal", () => {
  const other = { from: "b", to: "a", value: 5 };
  const graph = {
    nodes: [{ ...state("a"), label: "a " }, state("b"), state("c"), state("d")],
    edges: [{ from: "a", to: "b", value: 1 }, other, { from: "a", to: "c", value: 1 }, { from: "a", to: "d", value: 1 }]
  };

  it("shows a state's percentages summing to 100", async () => {
    renderEditor(graph);
    expect(await screen.findByText("To b: 33%")).toBeInTheDocument();
    expect(screen.getByText("To c: 33%")).toBeInTheDocument();
    expect(screen.getByText("To d: 34%")).toBeInTheDocument();
  });

  it("keeps the state's values when saved unchanged", async () => {
    const onChange = jest.fn();
    renderEditor(graph, onChange);
    await screen.findByText("To b: 33%");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [id, node, edges] = onChange.mock.calls[0];
    expect(id).toBe("a");
    expect(node.label).toBe("a");
    expect(edges).toHaveLength(4);
    expect(edges[1]).toBe(other);
    [0, 2, 3].forEach(i => expect(edges[i].value).toBeCloseTo(1));
  });

  it("keeps a single transition's value", async () => {
    const single = { nodes: [state("a"), state("b")], edges: [{ from: "a", to: "b", value: 7 }] };
    const onChange = jest.fn();
    renderEditor(single, onChange);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument();
    expect(onChange.mock.calls[0][2][0].value).toBeCloseTo(7);
  });
});
