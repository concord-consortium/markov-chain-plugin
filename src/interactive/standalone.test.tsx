import React from "react";
import { act, render, screen } from "@testing-library/react";
import { App } from "./app";

// the value the placeholder lists beside a setting's label
const listed = (label: string) =>
  screen.getAllByRole("definition")[screen.getAllByRole("term").findIndex(term => term.textContent === label)];

// jsdom's window is its own top window, as a page opened directly is, so these run outside any host. The library
// warns when it makes its client outside a frame, and makes one client per page, so a test checks for the warning
// before anything else in the file could have made the client.
describe("opened outside a host", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("the interactive runs with the default settings, and leaves the library alone", () => {
    jest.useFakeTimers();
    render(<App />);
    expect(screen.getByText("Markov interactive: coming soon")).toBeInTheDocument();
    expect(screen.getByText(/the settings come from this page's link, and nothing is saved/)).toBeInTheDocument();
    expect(listed("Usable mode(s)")).toHaveTextContent(/^Both/);

    // past the library's 2 second wait before it sends an interactive state
    act(() => { jest.advanceTimersByTime(3000); });
    expect(warn).not.toHaveBeenCalled();
  });

  it("the interactive takes its settings from its link", () => {
    window.history.replaceState(null, "", "/interactive.html?modes.draw=false&inputView=table");
    render(<App />);
    expect(listed("Usable mode(s)")).toHaveTextContent(/^Data$/);
    expect(listed("How students enter their data")).toHaveTextContent(/^Table only$/);
  });

  it("the report item says what it is, and leaves the library alone", async () => {
    document.body.innerHTML = "<div id=\"app\"></div>";
    await act(async () => { await import("./report-item"); });
    expect(screen.getByText(/It shows a student's answer in the class dashboard/)).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});
