import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./app";
import { paneTitles } from "./report-summary";

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

  it("the interactive runs with the default settings and no note above it, and leaves the library alone", () => {
    render(<App />);
    expect(screen.queryByText(/Activity Player/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "About" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Text Probability/)).not.toBeInTheDocument();
    expect(panes()).toEqual(["Input", "Graph", "Inspect", "Sequence Generator"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("titles its panes as the report item's summary names them", () => {
    render(<App />);
    expect(panes()).toEqual(Object.values(paneTitles));
  });

  it("the interactive takes its settings from its link", () => {
    window.history.replaceState(null, "", "/interactive.html?panes.inspect.available=false&inputView=table");
    render(<App />);
    expect(panes()).toEqual(["Input", "Graph", "Sequence Generator"]);
    expect(screen.getByText("Type some words in the Input pane's table to build the graph.")).toBeInTheDocument();
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
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Text Probability/)).not.toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("the Next Text Probability page, around the same interactive", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function(this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function(this: HTMLDialogElement) { this.open = false; };
  });

  it("names the interactive in a header above the workspace, and ends with the footer", () => {
    render(<App page="next-text-probability" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Next Text Probability$/);
    expect(within(screen.getByRole("main")).getAllByRole("region")).toHaveLength(4);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("The Concord Consortium, Inc.");
    fireEvent.click(within(footer).getByRole("button", { name: "About" }));
    expect(screen.getByRole("dialog", { name: "License & Terms of Use" })).toBeInTheDocument();
  });
});
