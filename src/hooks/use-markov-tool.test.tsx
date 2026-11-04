import React, { createRef } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
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
  log: jest.fn(),
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

const toolWithValues = (host = recordingHost("dataset")) => {
  const { result } = renderHook(() => useMarkovTool(host));
  act(() => result.current.handle.dataChanged(["a", "b", "a"]));
  return result;
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

  it("starts no timer for a sequence whose tool unmounts while it generates", async () => {
    const { handle, unmount } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(drawing, 2));
    const intervals = jest.spyOn(window, "setInterval");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    unmount();
    await act(async () => jest.advanceTimersByTime(100));
    expect(intervals).not.toHaveBeenCalled();
    intervals.mockRestore();
  });

  it("logs no step for a sequence whose tool unmounts while it generates", async () => {
    const host = recordingHost("drawing");
    const { handle, unmount } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    unmount();
    await act(async () => jest.advanceTimersByTime(100));
    expect(host.log.mock.calls.map(([event]) => event)).not.toContain("SequenceStepped");
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
  afterEach(() => jest.useRealTimers());

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
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    act(() => result.current.selectState("a", "graph"));
    await act(async () => result.current.generatorProps.onPlay());
    expect(result.current.animating).toBe(true);

    act(() => result.current.clearSelection("escape"));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "graph"));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    const sequence = result.current.graph.nodes;
    const group: SequenceGroup =
      { delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined, sequences: [sequence] };
    act(() => result.current.outputProps.onToggleHighlight(group, sequence));
    expect(result.current.selection).toEqual({ kind: "state", id: "a" });
    expect(host.log.mock.calls.map(([action]) => action)).not.toContain("OutputSelected");
    act(() => result.current.outputProps.onCancel());
  });
});

describe("useMarkovTool's log", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const loggedEvents = (host: ReturnType<typeof recordingHost>) => host.log.mock.calls.map(([event]) => event);

  it("logs a played sequence and the sequence it generates", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    await act(async () => jest.advanceTimersByTime(30000));
    await screen.findByRole("button", { name: "Play" });

    expect(loggedEvents(host)).toEqual(["SequencePlayed", "SequenceGenerated"]);
    const settings = { startingState: "", maxLength: 5, delimiter: " ", fast: false };
    expect(host.log).toHaveBeenNthCalledWith(1, "SequencePlayed", settings);
    const [, generated] = host.log.mock.calls[1];
    expect(generated).toMatchObject(settings);
    expect(generated.sequence).toEqual(host.outputSequence.mock.calls[0][0]);
  });

  it("logs a canceled sequence, and no generated one", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: "Play" });
    await act(async () => jest.advanceTimersByTime(30000));

    expect(loggedEvents(host)).toEqual(["SequencePlayed", "SequenceCanceled"]);
  });

  it("logs a pause, a resume and clearing the outputs", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    await screen.findByRole("button", { name: "Pause" });
    expect(loggedEvents(host)).toEqual(["SequencePlayed", "SequencePaused", "SequenceResumed"]);

    await act(async () => jest.advanceTimersByTime(30000));
    fireEvent.click(await screen.findByRole("button", { name: "Clear Output" }));
    expect(loggedEvents(host)).toContain("OutputCleared");
  });

  it("logs Max Length once when Enter and then a blur commit the same value", () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    const maxLength = screen.getByDisplayValue("5");
    fireEvent.change(maxLength, { target: { value: "8" } });
    fireEvent.keyDown(maxLength, { key: "Enter" });
    fireEvent.blur(maxLength);

    expect(host.log.mock.calls).toEqual([["GeneratorSettingChanged", { setting: "maxLength", value: 8 }]]);
  });

  it("names states by their labels, not their ids", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing({
      nodes: [{ id: "n1", label: "cat", value: 1, x: 0, y: 0 }, { id: "n2", label: "dog", value: 1, x: 100, y: 0 }],
      edges: [{ from: "n1", to: "n2", value: 1 }, { from: "n2", to: "n1", value: 1 }],
    }, 2));
    fireEvent.change(screen.getByDisplayValue("(any)"), { target: { value: "n1" } });
    fireEvent.click(screen.getByRole("button", { name: "Step" }));
    await waitFor(() => expect(host.log).toHaveBeenCalledTimes(2));

    expect(host.log.mock.calls).toEqual([
      ["GeneratorSettingChanged", { setting: "startingState", value: "cat" }],
      ["SequenceStepped", { startingState: "cat", maxLength: 5, delimiter: " ", fast: false }],
    ]);
  });

  it("logs no starting state for a play whose starting state the input has taken out", async () => {
    const host = recordingHost("dataset");
    const { result } = renderHook(() => useMarkovTool(host));
    act(() => result.current.handle.dataChanged(["cat", "sat", "cat"]));
    act(() => result.current.generatorProps.onStartingStateChange({ target: { value: "cat" } } as any));
    act(() => result.current.handle.dataChanged(["the", "sat", "the"]));
    host.log.mockClear();
    await act(async () => result.current.generatorProps.onPlay());
    await act(async () => jest.advanceTimersByTime(30000));
    expect(host.log.mock.calls.map(([event, data]) => [event, data?.startingState])).toEqual(
      [["SequencePlayed", ""], ["SequenceGenerated", ""]]);
  });

  it("logs a renamed starting state's new label for the whole of the next sequence", async () => {
    const host = recordingHost("drawing");
    const { result } = renderHook(() => useMarkovTool(host));
    act(() => result.current.handle.loadDrawing(drawing, 2));
    act(() => result.current.generatorProps.onStartingStateChange({ target: { value: "a" } } as any));
    await act(async () => result.current.generatorProps.onPlay());
    await act(async () => jest.advanceTimersByTime(30000));

    act(() => result.current.view.setGraph(graph => ({
      ...graph, nodes: graph.nodes.map(n => n.id === "a" ? { ...n, label: "A" } : n),
    })));
    host.log.mockClear();
    await act(async () => result.current.generatorProps.onPlay());
    await act(async () => jest.advanceTimersByTime(30000));
    expect(host.log.mock.calls.map(([event, data]) => [event, data?.startingState])).toEqual(
      [["SequencePlayed", "A"], ["SequenceGenerated", "A"]]);
  });

  it("logs the speed Reset restores for the whole of the next sequence", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    act(() => jest.advanceTimersByTime(10));
    host.log.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    await act(async () => jest.advanceTimersByTime(30000));
    await screen.findByRole("button", { name: "Play" });
    expect(host.log.mock.calls.map(([, data]) => data?.fast)).toEqual([false, false]);
  });

  it("logs the other delimiter's text once when its field loses focus with a changed value", () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.change(screen.getByDisplayValue("space"), { target: { value: "other" } });
    const field = screen.getByPlaceholderText("delimiter");
    fireEvent.change(field, { target: { value: "-" } });
    fireEvent.blur(field);
    fireEvent.blur(field);

    expect(host.log.mock.calls).toEqual([
      ["GeneratorSettingChanged", { setting: "delimiterType", value: "other" }],
      ["GeneratorSettingChanged", { setting: "delimiter", value: "-" }],
    ]);
  });

  it("logs a state chosen again with skipToggle once", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    act(() => result.current.selectState("a", "table", true));
    act(() => result.current.selectState("a", "table", true));

    expect(host.log.mock.calls).toEqual([["StateSelected", { state: "a", source: "table" }]]);
  });

  it("logs a state chosen and then chosen again to clear it", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    act(() => result.current.selectState("a", "graph"));
    act(() => result.current.selectState("a", "graph"));

    expect(host.log.mock.calls).toEqual([
      ["StateSelected", { state: "a", source: "graph" }],
      ["SelectionCleared", { via: "toggle" }],
    ]);
  });

  it("logs an output chosen and then chosen again to clear it", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    const sequence = result.current.graph.nodes;
    const group: SequenceGroup =
      { delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined, sequences: [sequence] };
    act(() => result.current.outputProps.onToggleHighlight(group, sequence));
    act(() => result.current.outputProps.onToggleHighlight(group, sequence));

    expect(host.log.mock.calls).toEqual([
      ["OutputSelected", { sequence: ["a", "b"] }],
      ["SelectionCleared", { via: "toggle" }],
    ]);
  });

  it("logs a transition chosen and then chosen again to clear it", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "inspect"));
    act(() => result.current.selectTransition({ from: "a", to: "b" }, "inspect"));

    expect(host.log.mock.calls).toEqual([
      ["TransitionSelected", { from: "a", to: "b", source: "inspect" }],
      ["SelectionCleared", { via: "toggle" }],
    ]);
  });

  it("logs a cleared selection with how it was cleared, and nothing when nothing was chosen", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    act(() => result.current.clearSelection("escape"));
    act(() => result.current.selectState("b", "graph"));
    act(() => result.current.clearSelection("background"));

    expect(host.log.mock.calls).toEqual([
      ["StateSelected", { state: "b", source: "graph" }],
      ["SelectionCleared", { via: "background" }],
    ]);
  });
});
