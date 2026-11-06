import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeModal } from "./node-modal";
import { graphFromValues } from "../../utils/chain-graph";
import { GraphData } from "../../type";

const state = (id: string) => ({ id, label: id, value: 1 });

const renderEditor = (graph: GraphData, onChange = jest.fn()) =>
  render(<NodeModal viewMode="drawing" node={graph.nodes[0]} graph={graph} onChange={onChange} onCancel={jest.fn()} />);

describe("NodeModal's read-only view of a state with no transitions out", () => {
  const renderDialog = (values: string[], id: string, viewMode: "dataset" | "drawing" = "dataset") => {
    const graph = graphFromValues(values);
    return render(<NodeModal viewMode={viewMode} node={graph.nodes.find(node => node.id === id)} graph={graph}
      onChange={jest.fn()} onCancel={jest.fn()} />);
  };

  it("says None for the only state", async () => {
    renderDialog(["a"], "a");
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.getByText("Transition Probabilities")).toBeInTheDocument();
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument();
  });

  it("says None for the last word of a longer text", async () => {
    renderDialog(["the", "cat", "sat"], "sat");
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument();
  });

  it("lists a state's transitions, and no None, when it has them", async () => {
    renderDialog(["the", "cat", "sat"], "cat");
    expect(await screen.findByText("To sat: 100%")).toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });

  it("leaves the drawing view's dialog without the section, as it was", async () => {
    renderDialog(["a"], "a", "drawing");
    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByText("Transition Probabilities")).not.toBeInTheDocument();
    expect(screen.queryByText("None")).not.toBeInTheDocument();
  });
});

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
    const save = await screen.findByRole("button", { name: "Save" });
    expect(screen.queryByText(/^To /)).not.toBeInTheDocument();
    fireEvent.click(save);
    expect(onChange.mock.calls[0][2][0].value).toBeCloseTo(7);
  });
});
