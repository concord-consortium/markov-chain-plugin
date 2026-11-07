import React from "react";
import { render, screen } from "@testing-library/react";
import { tokenize } from "../input/tokenizer";
import { Highlights } from "./highlights";
import { InputTable } from "./input-table";

const noHighlights = (): Highlights => ({ tokens: new Set(), states: new Set(), transitions: new Map() });

const table = (text: string) => (
  <InputTable rowLayout="prose" text={text} tokens={tokenize(text, "lowercase")} highlights={noHighlights()}
    readOnly={false}
    onCommit={jest.fn()} onRowAdded={jest.fn()} onRowDeleted={jest.fn()} onRowBlur={jest.fn()} afterPress={jest.fn()}
    onTyped={jest.fn()} onLeft={jest.fn()} onFocusToken={jest.fn()} />
);

describe("InputTable", () => {
  afterEach(() => jest.restoreAllMocks());

  // a commit that renders every row of a long input takes a large part of the time a commit may take
  it("renders only the rows a commit changes", () => {
    const { rerender } = render(table("a b c d e"));
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    const createElement = jest.spyOn(React, "createElement");
    rerender(table("a b c d e f"));
    expect(screen.getAllByRole("textbox")).toHaveLength(7);
    // the new word's row, which was the empty row at the end, and the new empty row after it
    expect(createElement.mock.calls.filter(([type]) => type === "input")).toHaveLength(2);
  });
});
