import React, { createRef } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MarkovTool } from "../components/markov-tool";
import { useMarkovTool } from "./use-markov-tool";
import { MarkovHost, MarkovToolHandle } from "../components/host";
import { GraphData, SequenceGroup, ViewMode } from "../type";

jest.mock("nanoid", () => ({ nanoid: () => "id" }));

// Jest can't load d3, so the graph is a placeholder
jest.mock("../components/graph", () => ({
  Graph: () => <div />
}));

const recordingHost = (viewMode?: ViewMode) => ({
  viewMode,
  setViewMode: jest.fn(),
  markDirty: jest.fn(),
  outputSequence: jest.fn((labels: string[]) => Promise.resolve()),
}) satisfies MarkovHost;

const renderTool = (host: MarkovHost) => {
  const handle = createRef<MarkovToolHandle>();
  const view = render(<MarkovTool ref={handle} host={host} loadState="loaded" dragging={false} />);
  return { handle, ...view };
};

const drawing: GraphData = {
  nodes: [{ id: "a", label: "a", value: 1, x: 100, y: 50 }, { id: "b", label: "b", value: 1, x: 200, y: 150 }],
  edges: [{ from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 1 }],
};

describe("useMarkovTool", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("stops a playing sequence's timer when it unmounts", async () => {
    const { handle, unmount } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("stops waiting for the graph's size to move an old drawing's origin when it unmounts", () => {
    const { handle, unmount } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(JSON.parse(JSON.stringify(drawing)), 1));
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();
    act(() => jest.advanceTimersByTime(10));
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("useMarkovTool's selection", () => {
  const toolWithValues = () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("dataset")));
    act(() => result.current.handle.dataChanged(["a", "b", "a"]));
    return result;
  };

  it("chooses a transition, and clears it when it is chosen again", () => {
    const result = toolWithValues();
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    expect(result.current.selection).toEqual({ kind: "transition", from: "a", to: "b" });
    expect(result.current.graphHighlights.selectedEdge).toEqual({ from: "a", to: "b" });

    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    expect(result.current.selection).toBeUndefined();
  });

  it("replaces a chosen transition with a state, and a state with a transition", () => {
    const result = toolWithValues();
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "inspect"));
    act(() => result.current.selectState("a", "inspect"));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    expect(result.current.graphHighlights.selectedEdge).toBeUndefined();

    act(() => result.current.selectTransition({ from: "b", to: "a" }, "inspect"));
    expect(result.current.selection).toEqual({ kind: "transition", from: "b", to: "a" });
    expect(result.current.graphHighlights.selectedNodeId).toBeUndefined();
  });

  it("clears whatever is chosen", () => {
    const result = toolWithValues();
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    act(() => result.current.clearSelection("escape"));
    expect(result.current.selection).toBeUndefined();

    act(() => result.current.selectState("b", "table", true));
    act(() => result.current.clearSelection("button"));
    expect(result.current.selection).toBeUndefined();
  });

  it("keeps one of a state, a transition and an output chosen at a time", () => {
    const result = toolWithValues();
    const sequence = result.current.graph.nodes;
    const group: SequenceGroup =
      { delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined, sequences: [sequence] };

    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    act(() => result.current.outputProps.onToggleHighlight(group, sequence));
    expect(result.current.selection).toEqual({ kind: "output", group, sequence });
    expect(result.current.graphHighlights.selectedEdge).toBeUndefined();

    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    expect(result.current.graphHighlights.highlightOutputNodes).toBeUndefined();

    act(() => result.current.outputProps.onToggleHighlight(group, sequence));
    act(() => result.current.clearSelection("escape"));
    expect(result.current.graphHighlights.highlightOutputNodes).toBeUndefined();
  });

  it("chooses and clears nothing while a sequence plays", async () => {
    jest.useFakeTimers();
    const result = toolWithValues();
    act(() => result.current.selectState("a", "graph"));
    await act(async () => result.current.generatorProps.onPlay());
    expect(result.current.animating).toBe(true);

    act(() => result.current.clearSelection("escape"));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    act(() => result.current.outputProps.onCancel());
    jest.useRealTimers();
  });
});
