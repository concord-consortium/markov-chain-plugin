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

  describe("with openAtNewest", () => {
    let observers: { callback: () => void, target?: Element, disconnected: boolean }[];
    let clientHeight: number;
    const notify = () => observers.filter(observer => observer.target && !observer.disconnected)
      .forEach(observer => observer.callback());

    beforeEach(() => {
      observers = [];
      clientHeight = 0;
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => clientHeight });
      globalThis.ResizeObserver = class {
        private readonly record: { callback: () => void, target?: Element, disconnected: boolean };
        constructor(callback: ResizeObserverCallback) {
          this.record = { callback: () => callback([], this), disconnected: false };
          observers.push(this.record);
        }
        observe(target: Element) { this.record.target = target; }
        unobserve() { /* notified by hand */ }
        disconnect() { this.record.disconnected = true; }
      };
    });
    afterEach(() => {
      delete (HTMLElement.prototype as any).clientHeight;
      delete (globalThis as any).ResizeObserver;
    });

    it("scrolls to the end the first time it has a height, and not while it has none", () => {
      render(<SequenceOutput {...props([group([a, b])])} openAtNewest />);
      expect(observers[0].target).toHaveClass("inner-output");
      notify();
      expect(scrollTops).toEqual([]);
      clientHeight = 100;
      notify();
      expect(scrollTops).toEqual([500]);
      notify();
      expect(scrollTops).toEqual([500]);
    });

    it("stops observing when it unmounts", () => {
      const { unmount } = render(<SequenceOutput {...props([group([a, b])])} openAtNewest />);
      unmount();
      expect(observers.map(observer => observer.disconnected)).toEqual([true]);
    });

    it("makes no observer without the prop", () => {
      render(<SequenceOutput {...props([group([a, b])])} />);
      expect(observers).toEqual([]);
    });
  });

  it("heads the output as the plugin does, or with the heading its layout gives", () => {
    const { rerender } = render(<SequenceOutput {...props([])} />);
    expect(screen.getByText("Output:")).toBeInTheDocument();
    rerender(<SequenceOutput {...props([])} heading="Output" />);
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("marks a group generated without order, collapsed and expanded, and no other group", () => {
    render(<SequenceOutput {...props([{ ...group([a, b]), orderMatters: false }, group([b, a])])} />);
    expect(screen.getAllByText("Orderless")).toHaveLength(1);
    expect(screen.queryByText("Order matters: No")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Orderless"));
    expect(screen.queryByText("Orderless")).not.toBeInTheDocument();
    expect(screen.getByText("Order matters: No")).toBeInTheDocument();
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
