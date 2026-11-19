import React from "react";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("the page header", () => {
  it("names the interactive", () => {
    render(<PageHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Next Text Probability" })).toBeInTheDocument();
  });

  it("names a page after the interactive, with the separator a screen reader hears, and holds its controls", () => {
    render(<PageHeader subtitle="Authoring"><button type="button">Copy</button></PageHeader>);
    expect(screen.getByRole("heading", { level: 1, name: "Next Text Probability | Authoring" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
