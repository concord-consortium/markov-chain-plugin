import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Drawing } from "./drawing";
import { Tool } from "./toolbar";

jest.mock("nanoid", () => ({ nanoid: () => "new" }));

// Jest can't load d3, so the graph is a placeholder that hands its callbacks to the test
let mockGraphProps: any;
jest.mock("./graph", () => ({
  zoomInStep: 1.1,
  zoomOutStep: 0.9,
  Graph: (props: any) => {
    mockGraphProps = props;
    return <div className="graph"><svg data-testid="graph-svg" /></div>;
  }
}));

const workspaceTools: Tool[] = ["select", "addNode", "delete", "zoomIn", "zoomOut"];

const baseProps = {
  highlightAllNextNodes: false,
  graph: { nodes: [{ id: "a", label: "a", value: 1, x: 0, y: 0 }], edges: [] },
  animating: false,
  graphOpacity: 1,
  setGraph: jest.fn(),
  setHighlightNode: jest.fn(),
  setSelectedNodeId: jest.fn(),
  onReset: jest.fn(),
  onReturnToMainMenu: jest.fn(),
  onFitView: jest.fn(),
  onRecenterView: jest.fn(),
  log: jest.fn(),
};

const button = (name: string) => screen.getByTitle(name);

describe("Drawing", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the plugin's toolbar and corner zoom buttons without a tool list", () => {
    render(<Drawing {...baseProps} />);
    expect(button("Create From Text")).toBeInTheDocument();
    expect(screen.queryByTitle("Zoom In")).not.toBeInTheDocument();
    expect(mockGraphProps.zoomButtons).toBe(true);
    expect(button("Select")).not.toHaveAttribute("aria-pressed");
  });

  it("shows the tools it is given, and zooms from them in place of the corner buttons", () => {
    const onUserZoom = jest.fn();
    render(<Drawing {...baseProps} tools={workspaceTools} onUserZoom={onUserZoom} />);
    expect(screen.queryByTitle("Create From Text")).not.toBeInTheDocument();
    expect(mockGraphProps.zoomButtons).toBe(false);
    expect(mockGraphProps.onUserZoom).toBe(onUserZoom);

    fireEvent.click(button("Zoom In"));
    expect(onUserZoom).toHaveBeenCalledTimes(1);
    expect(mockGraphProps.zoomRequest).toEqual({ id: 1, by: 1.1 });
    fireEvent.click(button("Zoom Out"));
    expect(mockGraphProps.zoomRequest).toEqual({ id: 2, by: 0.9 });
  });

  it("gives the graph the same size callback on every render", () => {
    const { rerender } = render(<Drawing {...baseProps} />);
    const first = mockGraphProps.onDimensions;
    rerender(<Drawing {...baseProps} graphOpacity={0.5} />);
    expect(mockGraphProps.onDimensions).toBe(first);
  });

  it("tells the latest onDimensions the size", () => {
    const latest = jest.fn();
    const { rerender } = render(<Drawing {...baseProps} onDimensions={jest.fn()} />);
    rerender(<Drawing {...baseProps} onDimensions={latest} />);
    act(() => mockGraphProps.onDimensions({ width: 100, height: 50 }));
    expect(latest).toHaveBeenCalledWith({ width: 100, height: 50 });
  });

  it("places a click from its SVG's position, wherever that is", () => {
    render(<Drawing {...baseProps} tools={workspaceTools} />);
    act(() => mockGraphProps.onDimensions({ width: 100, height: 50 }));
    screen.getByTestId("graph-svg").getBoundingClientRect = () => ({ left: 300, top: 200 }) as DOMRect;
    fireEvent.click(button("Add State"));
    act(() => mockGraphProps.onClick({ clientX: 360, clientY: 230 }));

    const addState = baseProps.setGraph.mock.calls[0][0];
    expect(addState({ nodes: [], edges: [] }).nodes[0]).toMatchObject({ x: 10, y: 5 });
  });

  it("passes arrow and background clicks to the graph only in the select tool", () => {
    const onEdgeSelect = jest.fn();
    const onBackgroundClick = jest.fn();
    render(<Drawing {...baseProps} tools={workspaceTools} onEdgeSelect={onEdgeSelect}
      onBackgroundClick={onBackgroundClick} />);
    expect(mockGraphProps.onEdgeSelect).toBe(onEdgeSelect);
    expect(mockGraphProps.onBackgroundClick).toBe(onBackgroundClick);

    fireEvent.click(button("Add State"));
    expect(mockGraphProps.onEdgeSelect).toBeUndefined();
    expect(mockGraphProps.onBackgroundClick).toBeUndefined();
  });

  it("shows the tool in use after Escape, and one press chooses a tool again", () => {
    render(<Drawing {...baseProps} tools={workspaceTools} />);
    fireEvent.click(button("Add State"));
    expect(button("Add State")).toHaveAttribute("aria-pressed", "true");
    expect(button("Zoom In")).not.toHaveAttribute("aria-pressed");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(button("Select")).toHaveAttribute("aria-pressed", "true");
    expect(button("Add State")).toHaveAttribute("aria-pressed", "false");
    expect(mockGraphProps.drawingMode).toBe("select");

    fireEvent.click(button("Add State"));
    expect(mockGraphProps.drawingMode).toBe("addNode");
  });

  it("ignores Escape while hidden", () => {
    render(<div hidden><Drawing {...baseProps} tools={workspaceTools} /></div>);
    fireEvent.click(screen.getByTitle("Add State"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockGraphProps.drawingMode).toBe("addNode");
  });

  describe("while a transition is half drawn", () => {
    const tools: Tool[] = ["select", "addEdge"];
    const startTransition = () => {
      fireEvent.click(screen.getByTitle("Add Transition"));
      act(() => mockGraphProps.onNodeClick("a"));
      fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    };

    it("follows the mouse with its rubber band", () => {
      render(<Drawing {...baseProps} tools={tools} />);
      startTransition();
      expect(mockGraphProps.rubberBand).toMatchObject({ from: "a" });
    });

    it("draws no rubber band while hidden", () => {
      render(<div hidden><Drawing {...baseProps} tools={tools} /></div>);
      startTransition();
      expect(mockGraphProps.rubberBand).toBeUndefined();
    });
  });

  describe("with the state editor open", () => {
    const openEditor = () => act(() => mockGraphProps.onNodeDoubleClick("a"));

    it("closes the editor on Escape, leaving the choice, with closeEditorOnEscape", () => {
      render(<Drawing {...baseProps} tools={workspaceTools} closeEditorOnEscape />);
      openEditor();
      expect(screen.getByText("Update State")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByText("Update State")).not.toBeInTheDocument();
      expect(baseProps.setHighlightNode).not.toHaveBeenCalled();
    });

    it("leaves the editor open on Escape without it", () => {
      render(<Drawing {...baseProps} />);
      openEditor();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.getByText("Update State")).toBeInTheDocument();
    });
  });

  it("passes the workspace's graph options through", () => {
    const selectedEdge = { from: "a", to: "a" };
    render(<Drawing {...baseProps} probabilityLabels arrowWidths="equal" selectedEdge={selectedEdge}
      fitTransitionMs={250} />);
    expect(mockGraphProps).toMatchObject({
      probabilityLabels: true, arrowWidths: "equal", selectedEdge, fitTransitionMs: 250
    });
  });
});
