import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { App } from "./app";

jest.mock("nanoid", () => ({ nanoid: () => "id" }));

// Jest can't load d3, so the graph is a placeholder
jest.mock("../components/graph", () => ({
  Graph: () => <div />
}));

// jsdom has no ResizeObserver, which the workspace measures itself with
globalThis.ResizeObserver = class {
  observe() { /* nothing to measure */ }
  unobserve() { /* nothing to measure */ }
  disconnect() { /* nothing to measure */ }
};

// the workspace's panes, by their accessible names
const panes = () => screen.getAllByRole("region").map(pane => within(pane).getAllByRole("heading")[0].textContent);

// jsdom's window is its own top window, as a page opened directly is, so these run outside any host. The library
// warns when it makes its client outside a frame, and makes one client per page, so a test checks for the warning
// before anything else in the file could have made the client.
describe("opened outside a host", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("the interactive runs with the default settings, and leaves the library alone", () => {
    render(<App />);
    expect(screen.getByText(/the settings come from this page's link, and nothing is saved/)).toBeInTheDocument();
    expect(panes()).toEqual(["Input", "Graph", "Inspect", "Sequence Generator"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("the interactive takes its settings from its link", () => {
    window.history.replaceState(null, "", "/interactive.html?panes.inspect.available=false&inputView=table");
    render(<App />);
    expect(panes()).toEqual(["Input", "Graph", "Sequence Generator"]);
    expect(screen.getByText("Type some words in the Input pane's table to build the chain.")).toBeInTheDocument();
  });

  it("the workspace shows Download tables when its link turns it on", () => {
    window.history.replaceState(null, "", "/interactive.html?buttons.downloadTables.available=true");
    render(<App />);
    expect(screen.getByRole("button", { name: "Download tables" })).toBeInTheDocument();
  });

  it("the workspace shows no Send to CODAP, even when its link turns it on", () => {
    window.history.replaceState(null, "", "/interactive.html?buttons.sendToCodap.available=true");
    render(<App />);
    expect(screen.queryByRole("button", { name: "Send to CODAP" })).not.toBeInTheDocument();
  });

  it("the workspace shows no Download tables by default", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "Download tables" })).not.toBeInTheDocument();
  });

  it("the report item says what it is, and leaves the library alone", async () => {
    document.body.innerHTML = "<div id=\"app\"></div>";
    await act(async () => { await import("./report-item"); });
    expect(screen.getByText(/It shows a student's answer in the class dashboard/)).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});
