import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarkovTool } from "./markov-tool";
import { MarkovHost, MarkovToolHandle } from "./host";
import { GraphData } from "../type";

jest.mock("nanoid", () => ({ nanoid: () => "new" }));

// Jest can't load d3, so the graph is a placeholder that hands its callbacks to the test
let mockGraphProps: any;
jest.mock("./graph", () => ({
  Graph: (props: any) => {
    mockGraphProps = props;
    return <div />;
  }
}));

const drawing: GraphData = {
  nodes: [{ id: "n1", label: "cat", value: 1, x: 0, y: 0 }, { id: "n2", label: "dog", value: 1, x: 100, y: 0 }],
  edges: [{ from: "n1", to: "n2", value: 1 }],
};

const drawingLog = () => {
  const host: MarkovHost = {
    viewMode: "drawing", setViewMode: jest.fn(), markDirty: jest.fn(), outputSequence: () => Promise.resolve(),
    log: jest.fn(),
  };
  const handle = createRef<MarkovToolHandle>();
  render(<MarkovTool ref={handle} host={host} loadState="loaded" dragging={false} />);
  act(() => handle.current!.loadDrawing(drawing, 2));
  return host.log as jest.Mock;
};

describe("Drawing's log", () => {
  it("logs a transition added only when it wasn't there, by its states' labels", () => {
    const log = drawingLog();
    fireEvent.click(screen.getByTitle("Add Transition"));
    act(() => mockGraphProps.onNodeClick("n1"));
    act(() => mockGraphProps.onNodeClick("n2"));
    act(() => mockGraphProps.onNodeClick("n2"));
    act(() => mockGraphProps.onNodeClick("n1"));

    expect(log.mock.calls).toEqual([["TransitionAdded", { from: "dog", to: "cat" }]]);
  });

  it("logs Create From Text only when its words change", () => {
    const log = drawingLog();
    fireEvent.click(screen.getByTitle("Create From Text"));
    const text = screen.getByRole("textbox");
    fireEvent.change(text, { target: { value: "the cat" } });
    fireEvent.change(text, { target: { value: "the cat " } });
    fireEvent.change(text, { target: { value: "the cat sat" } });

    expect(log.mock.calls).toEqual([["TextToGraph", { words: 2 }], ["TextToGraph", { words: 3 }]]);
  });

  it("logs a state added, moved and deleted by its label", () => {
    const log = drawingLog();
    act(() => mockGraphProps.onDragStop("n1", { x: 5, y: 5 }));
    fireEvent.click(screen.getByTitle("Add State"));
    act(() => mockGraphProps.onClick({ clientX: 0, clientY: 0 }));
    fireEvent.click(screen.getByTitle("Delete"));
    act(() => mockGraphProps.onNodeClick("n2"));

    expect(log.mock.calls).toEqual([
      ["StateMoved", { state: "cat" }],
      ["StateAdded", { state: "State 3" }],
      ["StateDeleted", { state: "dog" }],
    ]);
  });
});

describe("Drawing's log of changes to the graph", () => {
  it("logs a transition deleted by its states' labels", () => {
    const log = drawingLog();
    fireEvent.click(screen.getByTitle("Delete"));
    act(() => mockGraphProps.onEdgeClick({ from: "n1", to: "n2" }));

    expect(log.mock.calls).toEqual([["TransitionDeleted", { from: "cat", to: "dog" }]]);
  });

  it("logs a state edited, with its new name and transitions", () => {
    const log = drawingLog();
    act(() => mockGraphProps.onNodeDoubleClick("n1"));
    fireEvent.change(screen.getByDisplayValue("cat"), { target: { value: "kitten" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(log.mock.calls).toEqual([
      ["StateDialogOpened", { state: "cat" }],
      ["StateEdited", { state: "kitten", transitions: [{ to: "dog", value: 1 }] }],
    ]);
  });

  it("logs a reset once it is confirmed", () => {
    const log = drawingLog();
    fireEvent.click(screen.getByTitle("Reset"));
    expect(log).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));

    expect(log.mock.calls).toEqual([["GraphReset", undefined]]);
  });
});

describe("Dataset's log", () => {
  it("logs a state's dialog opened and a state moved", () => {
    const host: MarkovHost = {
      viewMode: "dataset", setViewMode: jest.fn(), markDirty: jest.fn(), outputSequence: () => Promise.resolve(),
      log: jest.fn(),
    };
    const handle = createRef<MarkovToolHandle>();
    render(<MarkovTool ref={handle} host={host} loadState="loaded" dragging={false} />);
    act(() => handle.current!.dataChanged(["the", "cat"]));
    act(() => mockGraphProps.onNodeDoubleClick("cat"));
    act(() => mockGraphProps.onDragStop("the", { x: 5, y: 5 }));

    expect((host.log as jest.Mock).mock.calls).toEqual([
      ["StateDialogOpened", { state: "cat" }],
      ["StateMoved", { state: "the" }],
    ]);
  });
});
