import React from "react";
import { render, screen } from "@testing-library/react";
import { App } from "./app";

let mockInitMessage: object | undefined;
jest.mock("@concord-consortium/lara-interactive-api", () => ({
  ...jest.requireActual("@concord-consortium/lara-interactive-api"),
  inIframe: () => true,
  useInitMessage: () => mockInitMessage,
  setSupportedFeatures: jest.fn(),
  setHeight: jest.fn(),
}));
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

// Inside an activity, in the class dashboard and in LARA's authoring the host's page is around the interactive, so
// it adds no header, footer or About dialog of its own
describe("started by a host", () => {
  it.each([
    ["runtime", "Input"], ["report", "This is a student's saved work. It can't be changed here."],
    ["authoring", "Usable mode(s)"],
  ])("shows no header, footer or About in %s mode", (mode, shown) => {
    mockInitMessage = { mode, authoredState: null, interactiveState: null };
    render(<App />);
    expect(screen.getAllByText(shown).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "About" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Text Probability/)).not.toBeInTheDocument();
  });
});

describe("the Next Text Probability page in another site's frame", () => {
  // a page waiting for a host would show its loading state
  beforeEach(() => { mockInitMessage = undefined; });

  it("shows itself with its header and footer, waiting for no host", () => {
    render(<App page="next-text-probability" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Next Text Probability$/);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });
});
