import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { InspectPane } from "./inspect-pane";
import { highlightsFor } from "./highlights";
import { bagOfWordsExplanation } from "./inspect-rows";
import { ModeId } from "../authored-state";
import { GraphData } from "../../type";

const graph = {
  nodes: [{ id: "a", label: "a", value: 1 }, { id: "b", label: "b", value: 1 }],
  edges: [{ from: "a", to: "a", value: 0.25 }, { from: "a", to: "b", value: 0.75 }],
};
const highlights = highlightsFor(undefined, []);

const props = {
  selection: undefined, highlights, log: jest.fn(), onSelectState: jest.fn(), onSelectTransition: jest.fn()
};

const renderPane = (mode: ModeId, orderMatters = true, paneGraph: GraphData = graph) =>
  render(<InspectPane mode={mode} orderMatters={orderMatters} graph={paneGraph} {...props} />);

const headers = () => screen.getAllByRole("columnheader").map(header => header.textContent?.replace(/[^A-Za-z]/g, ""));
const openTransitions = () => fireEvent.click(screen.getByRole("tab", { name: "Transitions" }));

describe("InspectPane", () => {
  it("shows Data mode's columns", () => {
    renderPane("useData");
    expect(headers()).toEqual(["State", "Count"]);
    expect(screen.getAllByRole("cell").map(cell => cell.textContent)).toEqual(["a", "1", "b", "1"]);
    openTransitions();
    expect(headers()).toEqual(["Transition", "Count", "Probability"]);
    expect(screen.getAllByRole("cell").map(cell => cell.textContent))
      .toEqual(["a → a", "0.25", "0.25 of 1 = 25%", "a → b", "0.75", "0.75 of 1 = 75%"]);
  });

  it("shows a drawing's states and transitions without counts", () => {
    renderPane("draw");
    expect(headers()).toEqual(["State"]);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
    openTransitions();
    expect(headers()).toEqual(["Transition", "Probability"]);
    expect(screen.getAllByRole("cell").map(cell => cell.textContent)).toEqual(["a → a", "25%", "a → b", "75%"]);
  });

  it("sorts a drawing's transitions by probability", () => {
    const unalphabetical = {
      ...graph, edges: [{ from: "a", to: "a", value: 0.75 }, { from: "a", to: "b", value: 0.25 }]
    };
    renderPane("draw", true, unalphabetical);
    openTransitions();
    fireEvent.click(screen.getByRole("button", { name: /Probability/ }));
    expect(screen.getAllByRole("cell").map(cell => cell.textContent)).toEqual(["a → b", "25%", "a → a", "75%"]);
  });

  it("explains the bag of words in place of the transitions, and keeps the states", () => {
    renderPane("useData", false);
    expect(headers()).toEqual(["State", "Count"]);
    openTransitions();
    expect(screen.getByText(bagOfWordsExplanation)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains the bag of words even with no transitions", () => {
    renderPane("useData", false, { ...graph, edges: [] });
    openTransitions();
    expect(screen.getByText(bagOfWordsExplanation)).toBeInTheDocument();
    expect(screen.queryByText("There are no transitions yet.")).not.toBeInTheDocument();
  });

  it("brings the table back, with its sort, when order matters again", () => {
    const { rerender } = renderPane("useData", false);
    openTransitions();
    const rerenderWith = (orderMatters: boolean) =>
      rerender(<InspectPane mode="useData" orderMatters={orderMatters} graph={graph} {...props} />);
    rerenderWith(true);
    expect(screen.getByRole("columnheader", { name: /Transition/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Count/ }));
    fireEvent.click(screen.getByRole("button", { name: /Count/ }));
    rerenderWith(false);
    rerenderWith(true);
    expect(screen.getByRole("columnheader", { name: /Transition/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Count/ })).toHaveAttribute("aria-sort", "descending");
  });
});
