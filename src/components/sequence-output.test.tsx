import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SequenceOutput, SequenceOutputProps } from "./sequence-output";
import { Node, SequenceGroup } from "../type";

const a: Node = { id: "a", label: "a", value: 1, x: 0, y: 0 };
const b: Node = { id: "b", label: "b", value: 1, x: 0, y: 0 };

const group = (sequence: Node[]): SequenceGroup => ({
  startingState: "", startingNode: undefined, delimiter: " ", lengthLimit: 5, sequences: [sequence]
});

const props = (sequenceGroups: SequenceGroup[]): SequenceOutputProps => ({
  sequenceGroups,
  graphEmpty: false,
  generationMode: "ready",
  lengthLimit: 5,
  onToggleHighlight: jest.fn(),
  onClear: jest.fn(),
  onCancel: jest.fn(),
});

describe("SequenceOutput", () => {
  // jsdom does no layout, so every element reports a scrollHeight and records what is written to scrollTop
  const scrollTops: number[] = [];
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true, get: () => 0, set: (value: number) => { scrollTops.push(value); }
    });
  });
  afterAll(() => {
    delete (HTMLElement.prototype as any).scrollHeight;
    delete (HTMLElement.prototype as any).scrollTop;
  });
  beforeEach(() => { scrollTops.length = 0; });

  it("does not scroll when it mounts with existing output", () => {
    render(<SequenceOutput {...props([group([a, b]), group([b, a])])} />);
    expect(screen.getByText("b a")).toBeInTheDocument();
    expect(scrollTops).toEqual([]);
  });

  it("heads the output as the plugin does, or with the heading its layout gives", () => {
    const { rerender } = render(<SequenceOutput {...props([])} />);
    expect(screen.getByText("Output:")).toBeInTheDocument();
    rerender(<SequenceOutput {...props([])} heading="Output" />);
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("chooses an output with Enter or Space when its layout asks for keyboard choosing", () => {
    const outputProps = props([group([a, b])]);
    render(<SequenceOutput {...outputProps} keyboardSelect />);
    const output = screen.getByRole("button", { name: "a b" });
    expect(output).toHaveAttribute("tabindex", "0");
    expect(output).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(output, { key: "Enter" });
    fireEvent.keyDown(output, { key: " " });
    fireEvent.keyDown(output, { key: "a" });
    expect(outputProps.onToggleHighlight).toHaveBeenCalledTimes(2);
  });

  it("leaves an output out of the Tab order without keyboard choosing, as the plugin draws it", () => {
    render(<SequenceOutput {...props([group([a, b])])} />);
    expect(screen.getByText("a b")).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button", { name: "a b" })).toBeNull();
  });

  it("scrolls to the bottom when a new group arrives", () => {
    const groups = [group([a, b])];
    const { rerender } = render(<SequenceOutput {...props(groups)} />);
    rerender(<SequenceOutput {...props([...groups, group([b, a])])} />);
    expect(scrollTops).toEqual([500]);
  });
});
