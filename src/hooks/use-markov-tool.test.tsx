import React, { createRef } from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MarkovTool } from "../components/markov-tool";
import { MarkovToolStart, useMarkovTool } from "./use-markov-tool";
import { useClearGoneSelection } from "../interactive/workspace/use-mode-body";
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

  it("unchooses the chosen output when the outputs are cleared, logging only the clearing", () => {
    const host = recordingHost("dataset");
    const result = toolWithValues(host);
    const sequence = result.current.graph.nodes;
    const group: SequenceGroup =
      { delimiter: " ", lengthLimit: 5, startingState: "", startingNode: undefined, sequences: [sequence] };
    act(() => result.current.outputProps.onToggleHighlight(group, sequence));
    expect(result.current.selection).toEqual({ kind: "output", group, sequence });
    host.log.mockClear();

    act(() => result.current.outputProps.onClear());
    expect(result.current.selection).toBeUndefined();
    expect(result.current.graphHighlights.highlightOutputNodes).toBeUndefined();
    expect(host.log.mock.calls).toEqual([["OutputCleared"]]);
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
    const settings = { startingState: "", maxLength: 5, delimiter: " ", fast: false, orderMatters: true };
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
      ["SequenceStepped", { startingState: "cat", maxLength: 5, delimiter: " ", fast: false, orderMatters: true }],
    ]);
  });

  describe("as a bag of words", () => {
    const bagHost = () => ({ ...recordingHost("dataset"), orderMatters: false });
    const playToTheEnd = async (result: { current: ReturnType<typeof useMarkovTool> }) => {
      await act(async () => result.current.generatorProps.onPlay());
      await act(async () => jest.advanceTimersByTime(30000));
    };

    afterEach(() => jest.restoreAllMocks());

    it("runs to Max Length where the chain would stop, and logs that order did not matter", async () => {
      const host = bagHost();
      const { result } = renderHook(() => useMarkovTool(host));
      act(() => result.current.handle.dataChanged(["a", "b"]));
      await playToTheEnd(result);

      expect(host.log).toHaveBeenCalledWith("SequencePlayed", expect.objectContaining({ orderMatters: false }));
      const generated = host.log.mock.calls.find(([event]) => event === "SequenceGenerated")![1];
      expect(generated.sequence).toHaveLength(5);
      expect(generated.orderMatters).toBe(false);
    });

    it("gives a step that is not one of the chain's transitions to the graph", async () => {
      jest.spyOn(Math, "random").mockReturnValue(0.1);
      const host = bagHost();
      const { result } = renderHook(() => useMarkovTool(host));
      act(() => result.current.handle.dataChanged(["a", "a", "b"]));
      const [a, b] = result.current.graph.nodes;
      act(() => result.current.generatorProps.onStartingStateChange({ target: { value: b.id } } as any));
      await act(async () => result.current.generatorProps.onStep());
      await act(async () => result.current.generatorProps.onStep());

      expect(result.current.graph.edges.some(e => e.from === b.id && e.to === a.id)).toBe(false);
      expect(result.current.graphHighlights.highlightEdge).toEqual({ from: b.id, to: a.id, value: 2 });
    });

    it("starts a new output group when order changes, and records it on the group", async () => {
      const first = bagHost();
      const { result, rerender } = renderHook(({ host }) => useMarkovTool(host), { initialProps: { host: first } });
      act(() => result.current.handle.dataChanged(["a", "b"]));
      await playToTheEnd(result);
      await playToTheEnd(result);
      expect(result.current.outputProps.sequenceGroups.map(g => g.orderMatters)).toEqual([false]);

      rerender({ host: { ...first, orderMatters: true } });
      await playToTheEnd(result);
      expect(result.current.outputProps.sequenceGroups.map(g => g.orderMatters)).toEqual([false, true]);
    });
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

  it("puts the Delimiter select back to space on Reset, with the other delimiter's field gone", () => {
    const { handle } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(drawing, 2));
    fireEvent.change(screen.getByDisplayValue("space"), { target: { value: "other" } });
    expect(screen.getByPlaceholderText("delimiter")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    act(() => jest.advanceTimersByTime(10));

    expect(screen.getByDisplayValue("space")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("delimiter")).not.toBeInTheDocument();
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

describe("useMarkovTool's start", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const a = { id: "a", label: "a", value: 0 };
  const b = { id: "b", label: "b", value: 0 };
  const group: SequenceGroup = {
    delimiter: "-", lengthLimit: 2, startingState: "", startingNode: undefined, sequences: [[a, b], [b, a]],
  };

  const startedTool = (start: MarkovToolStart, host = recordingHost("drawing")) =>
    renderHook(() => useMarkovTool(host, start)).result;

  it("keeps every default with no start", () => {
    const { result } = renderHook(() => useMarkovTool(recordingHost("drawing")));
    expect(result.current.graph).toEqual({ nodes: [], edges: [] });
    expect(result.current.selection).toBeUndefined();
    expect(result.current.outputProps.sequenceGroups).toEqual([]);
    expect(result.current.generatorProps).toMatchObject({
      startingState: "", lengthLimit: 5, delimiter: " ", delimiterType: "space", fastSimulation: false,
      delimiterAutoFocus: true,
    });
  });

  it("starts from a graph and outputs", () => {
    const tool = startedTool({ graph: drawing, sequenceGroups: [group] });
    expect(tool.current.graph).toBe(drawing);
    expect(tool.current.outputProps.sequenceGroups).toEqual([group]);
  });

  it("starts from generator settings, and takes the default of any left out", () => {
    const tool = startedTool({ generator: {
      startingState: "a", lengthLimit: 9, delimiter: "-", delimiterType: "other", fast: true,
    } });
    expect(tool.current.generatorProps).toMatchObject({
      startingState: "a", lengthLimit: 9, delimiter: "-", delimiterType: "other", fastSimulation: true,
    });
    const expected = {
      startingState: "", lengthLimit: 5, delimiter: "-", delimiterType: "space", fastSimulation: false,
    };
    expect(startedTool({ generator: { delimiter: "-" } }).current.generatorProps).toMatchObject(expected);
    expect(startedTool({ generator: { delimiter: "-", lengthLimit: undefined } }).current.generatorProps)
      .toMatchObject(expected);
  });

  it("starts a Max Length that's out of range at its nearest allowed value, and logs nothing for committing it", () => {
    const host = recordingHost("drawing");
    const tool = startedTool({ generator: { lengthLimit: -3 } }, host);
    expect(tool.current.generatorProps.lengthLimit).toBe(1);
    act(() => tool.current.generatorProps.onLengthLimitCommit());
    expect(host.log).not.toHaveBeenCalled();
  });

  // the mode body's rule, which would clear a choice whose graph arrived after the first render
  const clearingTool = (start: MarkovToolStart) => renderHook(() => {
    const tool = useMarkovTool(recordingHost("drawing"), start);
    useClearGoneSelection(tool);
    return tool;
  }).result;

  it("keeps a chosen state or transition through the first render, with its graph", () => {
    expect(clearingTool({ graph: drawing, selection: { kind: "state", id: "a" } }).current.selection)
      .toEqual({ kind: "state", id: "a" });
    expect(clearingTool({ graph: drawing, selection: { kind: "transition", from: "a", to: "b" } }).current.selection)
      .toEqual({ kind: "transition", from: "a", to: "b" });
  });

  it("clears a chosen state or transition with no graph to find it in", () => {
    expect(clearingTool({ selection: { kind: "state", id: "a" } }).current.selection).toBeUndefined();
    expect(clearingTool({ selection: { kind: "transition", from: "a", to: "b" } }).current.selection).toBeUndefined();
  });

  it("starts with a chosen output", () => {
    const sequence = group.sequences[1];
    const tool = startedTool({ sequenceGroups: [group], selection: { kind: "output", group, sequence } });
    expect(tool.current.selection).toEqual({ kind: "output", group, sequence });
    expect(tool.current.outputProps.highlightOutput).toEqual({ group, sequence });
  });

  it("logs nothing on a start, or for a committed field that didn't change from it", () => {
    const host = recordingHost("drawing");
    const tool = startedTool({ generator: { lengthLimit: 9, delimiter: "-", delimiterType: "other" } }, host);
    act(() => {
      tool.current.generatorProps.onLengthLimitCommit();
      tool.current.generatorProps.onDelimiterCommit();
    });
    expect(host.log).not.toHaveBeenCalled();
  });

  it("logs a committed field that changed from its start", () => {
    const host = recordingHost("drawing");
    const tool = startedTool({ generator: { lengthLimit: 9 } }, host);
    act(() => tool.current.generatorProps.onLengthLimitChange(
      { target: { value: "8" } } as React.ChangeEvent<HTMLInputElement>));
    act(() => tool.current.generatorProps.onLengthLimitCommit());
    expect(host.log).toHaveBeenCalledWith("GeneratorSettingChanged", { setting: "maxLength", value: 8 });
  });

  it("generates at the speed it started with", async () => {
    const host = recordingHost("drawing");
    const tool = startedTool({ graph: drawing, generator: { fast: true } }, host);
    await act(async () => { await tool.current.generatorProps.onPlay(); });
    act(() => tool.current.generatorProps.onPause());
    expect(host.log).toHaveBeenCalledWith("SequencePaused", expect.objectContaining({ fast: true }));
  });

  it("doesn't focus the delimiter's field until the student chooses a type", () => {
    const tool = startedTool({ generator: { delimiterType: "other" } });
    expect(tool.current.generatorProps.delimiterAutoFocus).toBe(false);
    act(() => tool.current.generatorProps.onDelimiterTypeChange(
      { target: { value: "other" } } as React.ChangeEvent<HTMLSelectElement>));
    expect(tool.current.generatorProps.delimiterAutoFocus).toBe(true);
  });

  it("clears a started drawing on Reset, rather than going back to it", () => {
    const tool = startedTool({ graph: drawing });
    act(() => tool.current.view.onReset());
    act(() => tool.current.view.confirmModal?.onOk?.());
    act(() => { jest.advanceTimersByTime(10); });
    expect(tool.current.graph).toEqual({ nodes: [], edges: [] });
  });

  it("restores a started dataset's graph on Reset", () => {
    const tool = startedTool({ graph: drawing, values: ["a", "b", "a"] }, recordingHost("dataset"));
    act(() => tool.current.view.onReset());
    act(() => tool.current.view.confirmModal?.onOk?.());
    act(() => { jest.advanceTimersByTime(10); });
    expect(tool.current.graph.nodes.map(node => node.label)).toEqual(["a", "b"]);
  });
});
