import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarkovTool } from "./markov-tool";
import { MarkovHost, MarkovToolHandle } from "./host";
import { GraphData, ViewMode } from "../type";

let mockId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${mockId++}` }));

// Jest can't load d3, so the graph is a placeholder that hands its callbacks to the test
let mockGraphProps: any;
jest.mock("./graph", () => ({
  Graph: (props: any) => {
    mockGraphProps = props;
    return <div />;
  }
}));

const recordingHost = (viewMode?: ViewMode) => ({
  viewMode,
  setViewMode: jest.fn(),
  markDirty: jest.fn(),
  outputSequence: jest.fn((labels: string[]) => Promise.resolve()),
}) satisfies MarkovHost;

const renderTool = (host: MarkovHost, { loadState = "loaded", dragging = false }: {
  loadState?: "loading" | "loaded", dragging?: boolean } = {}) => {
  const handle = createRef<MarkovToolHandle>();
  const view = render(<MarkovTool ref={handle} host={host} loadState={loadState} dragging={dragging} />);
  return { handle, ...view };
};

const drawing: GraphData = {
  nodes: [{ id: "a", label: "a", value: 1, x: 100, y: 50 }, { id: "b", label: "b", value: 1, x: 200, y: 150 }],
  edges: [{ from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 1 }],
};

describe("MarkovTool", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows loading until the host has its state, then the mode menu", () => {
    const host = recordingHost();
    const { rerender } = renderTool(host, { loadState: "loading" });
    expect(screen.getByText("Loading ...")).toBeInTheDocument();

    rerender(<MarkovTool host={host} loadState="loaded" dragging={false} />);
    expect(screen.queryByText("Loading ...")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Select Mode" })).toBeInTheDocument();
  });

  it("asks the host for dataset mode and marks it dirty", () => {
    const host = recordingHost();
    renderTool(host);
    fireEvent.click(screen.getByRole("button", { name: "Dataset" }));
    expect(host.setViewMode).toHaveBeenCalledWith("dataset");
    expect(host.markDirty).toHaveBeenCalledTimes(1);
  });

  it("asks the host for drawing mode and marks it dirty", () => {
    const host = recordingHost();
    renderTool(host);
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(host.setViewMode).toHaveBeenCalledWith("drawing");
    expect(host.markDirty).toHaveBeenCalledTimes(1);
  });

  it("loads a version 2 drawing as it is, and Reset restores it", () => {
    const { handle } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(drawing, 2));

    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
    expect(handle.current!.getGraph()).toEqual(drawing);

    act(() => mockGraphProps.onDragStop("a", { x: 5, y: 5 }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    act(() => jest.advanceTimersByTime(10));
    expect(handle.current!.getGraph()).toEqual(drawing);
  });

  it("moves an unversioned drawing's origin to the center once the graph has its size", () => {
    const { handle } = renderTool(recordingHost("drawing"));
    act(() => handle.current!.loadDrawing(JSON.parse(JSON.stringify(drawing)), 1));
    act(() => jest.advanceTimersByTime(10));
    expect(handle.current!.getGraph().nodes).toHaveLength(0);

    act(() => mockGraphProps.onDimensions({ width: 200, height: 100 }));
    act(() => jest.advanceTimersByTime(10));
    expect(handle.current!.getGraph().nodes.map(n => [n.x, n.y])).toEqual([[0, 0], [100, 100]]);
  });

  it("builds dataset mode's graph from the host's values without marking it dirty, and Reset rebuilds it", () => {
    const host = recordingHost("dataset");
    const { handle } = renderTool(host);
    const before = handle.current;
    act(() => handle.current!.dataChanged(["a", "b", "a"]));

    expect(handle.current).toBe(before);
    expect(handle.current!.getGraph().nodes.map(n => n.label)).toEqual(["a", "b"]);
    expect(host.markDirty).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    expect(handle.current!.getGraph().nodes).toHaveLength(0);
    act(() => jest.advanceTimersByTime(10));
    expect(handle.current!.getGraph().nodes.map(n => n.label)).toEqual(["a", "b"]);
  });

  it("shows the host's drag highlight", () => {
    const host = recordingHost("dataset");
    const { container, rerender } = renderTool(host, { dragging: true });
    expect(container.innerHTML).toMatch(/^<div class="app dragging">/);

    rerender(<MarkovTool host={host} loadState="loaded" dragging={false} />);
    expect(container.innerHTML).toMatch(/^<div class="app">/);
  });

  it("outputs a finished sequence's labels once, and a canceled one not at all", async () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    await act(async () => jest.advanceTimersByTime(30000));
    await screen.findByRole("button", { name: "Play" });

    expect(host.outputSequence).toHaveBeenCalledTimes(1);
    const [labels] = host.outputSequence.mock.calls[0];
    expect(labels).toHaveLength(5);
    labels.forEach(label => expect(["a", "b"]).toContain(label));

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Pause" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: "Play" });
    await act(async () => jest.advanceTimersByTime(30000));
    expect(host.outputSequence).toHaveBeenCalledTimes(1);
  });

  it("marks the host dirty when the drawing changes", () => {
    const host = recordingHost("drawing");
    const { handle } = renderTool(host);
    act(() => handle.current!.loadDrawing(drawing, 2));
    host.markDirty.mockClear();

    act(() => mockGraphProps.onDragStop("a", { x: 5, y: 5 }));
    expect(handle.current!.getGraph().nodes[0]).toMatchObject({ x: 5, y: 5 });
    expect(host.markDirty).toHaveBeenCalled();
  });
});
