import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TableSource } from "../tables/table-data";
import { TablesDialog } from "./tables-dialog";

const source: TableSource = {
  mode: "draw", tokens: [], sequenceGroups: [],
  graph: { nodes: [{ id: "1", label: "rain", value: 1 }], edges: [] },
};

describe("TablesDialog", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function(this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function(this: HTMLDialogElement) { this.open = false; };
  });

  it("fails a send it has no sender for, and never reports it saved", async () => {
    const onFinished = jest.fn();
    const onFailed = jest.fn();
    render(
      <TablesDialog action="send" defaultName="Drawing1" choices={[{ word: "States", empty: false }]} source={source}
        onFinished={onFinished} onFailed={onFailed} onCancel={jest.fn()} onClose={jest.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your tables couldn't be saved.");
    expect(onFailed).toHaveBeenCalledWith("Drawing1", ["States"]);
    expect(onFinished).not.toHaveBeenCalled();
  });
});
