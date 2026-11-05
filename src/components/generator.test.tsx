import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Generator, GeneratorProps } from "./generator";
import { MarkovTool } from "./markov-tool";
import { MarkovHost, MarkovToolHandle } from "./host";
import { GraphData } from "../type";

jest.mock("nanoid", () => ({ nanoid: () => "id" }));

// Jest can't load d3, so the graph is a placeholder
jest.mock("./graph", () => ({
  Graph: () => <div />
}));

const host: MarkovHost = {
  viewMode: "drawing",
  setViewMode: jest.fn(),
  markDirty: jest.fn(),
  outputSequence: () => Promise.resolve(),
  log: jest.fn(),
};

const drawing: GraphData = {
  nodes: [{ id: "a", label: "a", value: 1, x: 100, y: 50 }, { id: "b", label: "b", value: 1, x: 200, y: 150 }],
  edges: [{ from: "a", to: "b", value: 1 }, { from: "b", to: "a", value: 1 }],
};

const renderGenerator = () => {
  const handle = createRef<MarkovToolHandle>();
  render(<MarkovTool ref={handle} host={host} loadState="loaded" dragging={false} />);
  act(() => handle.current!.loadDrawing(drawing, 2));
};

// each step's output promise settles before the next step's timer fires
const playToTheEnd = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await screen.findByRole("button", { name: "Pause" });
  for (let i = 0; i < 40; i++) {
    await act(async () => jest.advanceTimersByTime(500));
  }
  await screen.findByRole("button", { name: "Play" });
};

const delimiterSelect = () => screen.getByDisplayValue("space");
const delimiterField = () => screen.queryByPlaceholderText("delimiter");

describe("Generator", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows the other delimiter's field only for other, and joins the output with its text", async () => {
    renderGenerator();
    expect(delimiterField()).not.toBeInTheDocument();

    fireEvent.change(delimiterSelect(), { target: { value: "other" } });
    fireEvent.change(delimiterField()!, { target: { value: "-" } });
    await playToTheEnd();
    expect(screen.getAllByText('"-"')).toHaveLength(1);
    expect(screen.getByText(/^[ab](-[ab]){4}$/)).toBeInTheDocument();
  });

  it("removes the field for none, and joins the next output with nothing", async () => {
    renderGenerator();
    fireEvent.change(delimiterSelect(), { target: { value: "other" } });
    fireEvent.change(delimiterField()!, { target: { value: "-" } });
    fireEvent.change(screen.getByDisplayValue("other ..."), { target: { value: "none" } });
    expect(delimiterField()).not.toBeInTheDocument();

    await playToTheEnd();
    expect(screen.getAllByText("(none)")).toHaveLength(1);
    expect(screen.getByText(/^[ab]{5}$/)).toBeInTheDocument();
  });

  it("commits Max Length when its field loses focus", () => {
    renderGenerator();
    const maxLength = screen.getByDisplayValue("5");
    fireEvent.change(maxLength, { target: { value: "0" } });
    expect(maxLength).toHaveValue(0);

    fireEvent.blur(maxLength);
    expect(maxLength).toHaveValue(1);
  });
});

const generatorProps = (overrides: Partial<GeneratorProps> = {}): GeneratorProps => ({
  nodes: [{ id: "a", label: "a", value: 1 }], graphEmpty: false, generationMode: "ready", startingState: "",
  lengthLimit: 5, delimiter: " ", delimiterType: "space", fastSimulation: false, onStartingStateChange: jest.fn(),
  onLengthLimitChange: jest.fn(), onLengthLimitCommit: jest.fn(), onDelimiterTypeChange: jest.fn(),
  onDelimiterChange: jest.fn(), onDelimiterCommit: jest.fn(), onSpeedChange: jest.fn(), onPlay: jest.fn(),
  onPause: jest.fn(), onResume: jest.fn(), onStep: jest.fn(), ...overrides,
});

describe("Generator's delimiter field", () => {
  const props = generatorProps({ delimiter: "-", delimiterType: "other" });

  it("takes focus as it shows", () => {
    render(<Generator {...props} />);
    expect(screen.getByPlaceholderText("delimiter")).toHaveFocus();
  });

  it("leaves focus where it was with delimiterAutoFocus false", () => {
    render(<Generator {...props} delimiterAutoFocus={false} />);
    expect(screen.getByPlaceholderText("delimiter")).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});

describe("Generator at the limit", () => {
  const props = generatorProps();

  it("disables Play and Step", () => {
    render(<Generator {...props} limitReached />);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Step" })).toBeDisabled();
  });

  it("leaves them enabled below it", () => {
    render(<Generator {...props} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Step" })).toBeEnabled();
  });
});
