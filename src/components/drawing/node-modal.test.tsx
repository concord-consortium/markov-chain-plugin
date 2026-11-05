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

  describe("with uniqueLabels", () => {
    const named = {
      nodes: [state("a"), state("b")],
      edges: [{ from: "a", to: "b", value: 1 }],
    };
    const renderUnique = (onChange = jest.fn()) => render(<NodeModal viewMode="drawing" node={named.nodes[0]}
      graph={named} onChange={onChange} onCancel={jest.fn()} uniqueLabels />);
    const nameField = () => screen.getByRole("textbox");
    const save = () => screen.getByRole("button", { name: "Save" });

    it("refuses an empty name, saying why", () => {
      renderUnique();
      fireEvent.change(nameField(), { target: { value: " " } });
      expect(screen.getByRole("alert")).toHaveTextContent("Give the state a name.");
      expect(save()).toBeDisabled();
    });

    it("refuses another state's name, and won't save it with Enter", () => {
      const onChange = jest.fn();
      renderUnique(onChange);
      fireEvent.change(nameField(), { target: { value: "b" } });
      expect(screen.getByRole("alert")).toHaveTextContent(`Another state is already named "b".`);
      fireEvent.submit(nameField());
      expect(onChange).not.toHaveBeenCalled();
    });

    it("saves its own name or a new one", () => {
      const onChange = jest.fn();
      renderUnique(onChange);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fireEvent.change(nameField(), { target: { value: "c" } });
      expect(save()).toBeEnabled();
      fireEvent.click(save());
      expect(onChange).toHaveBeenCalledWith("a", expect.objectContaining({ label: "c" }), expect.anything());
    });
  });

  it("raises no alert while it opens on a state", () => {
    const named = { nodes: [state("a")], edges: [] };
    const props = { viewMode: "drawing" as const, graph: named, onChange: jest.fn(), onCancel: jest.fn() };
    const { rerender, container } = render(<NodeModal {...props} uniqueLabels />);
    const added: Node[] = [];
    const observer = new MutationObserver(records => records.forEach(record => added.push(...record.addedNodes)));
    observer.observe(container, { childList: true, subtree: true });
    rerender(<NodeModal {...props} uniqueLabels node={named.nodes[0]} />);
    added.push(...observer.takeRecords().flatMap(record => [...record.addedNodes]));
    observer.disconnect();
    expect(screen.getByRole("textbox")).toHaveValue("a");
    expect(added.length).toBeGreaterThan(0);
    expect(added.some(node => node.textContent?.includes("Give the state a name."))).toBe(false);
  });

  it("takes any name without uniqueLabels", () => {
    const graphOfTwo = { nodes: [state("a"), state("b")], edges: [] };
    render(<NodeModal viewMode="drawing" node={graphOfTwo.nodes[0]} graph={graphOfTwo} onChange={jest.fn()}
      onCancel={jest.fn()} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-label");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "b" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("saves no value below 0 when a key takes the last share to nothing", async () => {
    const onChange = jest.fn();
    const uneven = {
      nodes: [state("a"), state("b"), state("c"), state("d")],
      edges: [{ from: "a", to: "b", value: 4 }, { from: "a", to: "c", value: 7 }, { from: "a", to: "d", value: 1 }],
    };
    render(<NodeModal viewMode="drawing" node={uneven.nodes[0]} graph={uneven} onChange={onChange}
      onCancel={jest.fn()} accessibleEditor />);
    fireEvent.keyDown(await screen.findByRole("slider", { name: "Probability of c" }),
      { key: "ArrowRight", shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const [, , edges] = onChange.mock.calls[0];
    expect(edges.map((edge: { value: number }) => edge.value >= 0)).toEqual([true, true, true]);
  });

  it("shares a state evenly among arrows of no value, and saves them with values", async () => {
    const onChange = jest.fn();
    const none = {
      nodes: [state("a"), state("b"), state("c")],
      edges: [{ from: "a", to: "b", value: 0 }, { from: "a", to: "c", value: 0 }],
    };
    render(<NodeModal viewMode="drawing" node={none.nodes[0]} graph={none} onChange={onChange}
      onCancel={jest.fn()} accessibleEditor />);
    expect(await screen.findByText("To b: 50%")).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onChange.mock.calls[0][2].map((edge: { value: number }) => edge.value)).toEqual([1, 1]);
  });

  it("names its field and gives its slider keys when accessible", async () => {
    render(<NodeModal viewMode="drawing" node={graph.nodes[0]} graph={graph} onChange={jest.fn()}
      onCancel={jest.fn()} accessibleEditor />);
    expect(screen.getByRole("textbox", { name: "State name" })).toBeInTheDocument();
    expect(await screen.findAllByRole("slider")).toHaveLength(2);
  });
});
