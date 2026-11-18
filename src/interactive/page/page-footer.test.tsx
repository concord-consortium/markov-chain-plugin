import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PageFooter } from "./page-footer";

const newTab = " (opens in a new tab)";
const paragraph = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === "P" && element.textContent === text;

describe("the page footer and its About dialog", () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function(this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function(this: HTMLDialogElement) { this.open = false; };
  });

  afterEach(() => jest.useRealTimers());

  const renderPage = () => render(<PageFooter showLogo />);

  const openAbout = () => {
    const about = within(screen.getByRole("contentinfo")).getByRole("button", { name: "About" });
    about.focus();
    fireEvent.click(about);
    return { about, dialog: screen.getByRole("dialog", { name: "License & Terms of Use" }) };
  };

  it.each([["2031-06-01T12:00:00Z", "2031"], ["2044-01-15T12:00:00Z", "2044"]])(
    "shows the current year in the footer and the dialog, at %s", (now, year) => {
      jest.useFakeTimers({ now: new Date(now), advanceTimers: true });
      renderPage();
      expect(screen.getByRole("contentinfo")).toHaveTextContent(`© ${year} The Concord Consortium, Inc.`);
      const { dialog } = openAbout();
      expect(within(dialog).getByText(`© ${year} The Concord Consortium, Inc.`)).toBeInTheDocument();
    });

  it("hides the separators between the footer's items from screen readers", () => {
    renderPage();
    const separators = within(screen.getByRole("contentinfo")).getAllByText("·");
    expect(separators).toHaveLength(2);
    separators.forEach(separator => expect(separator).toHaveAttribute("aria-hidden", "true"));
  });

  it("links to the Terms of Use in a new tab", () => {
    renderPage();
    const link = within(screen.getByRole("contentinfo")).getByRole("link", { name: `Terms of Use${newTab}` });
    expect(link).toHaveAttribute("href", "https://concord.org/terms-of-use/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("opens the license and Terms of Use statement, focused on the dialog, with the Concord logo", () => {
    renderPage();
    const { dialog } = openAbout();
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByRole("img", { name: "The Concord Consortium" })).toBeInTheDocument();
    expect(within(dialog).getByText(paragraph("Next Text Probability is free, open-source software. The Next Text " +
      `Probability source code is released under the MIT License${newTab}, so you’re welcome to use, modify, and ` +
      "build on it."))).toBeInTheDocument();
    expect(within(dialog).getByText(paragraph("Your use of Next Text Probability at models-resources.concord.org is " +
      `governed by our Terms of Use${newTab}. The hosted version is free for non-commercial use; commercial use ` +
      "requires a separate written agreement. For more information, visit " +
      `concord.org/licensing${newTab} or contact licensing@concord.org.`))).toBeInTheDocument();
    expect(within(dialog).getByText("Next Text Probability is free, open-source software.").tagName).toBe("STRONG");
    expect(within(dialog).getByText("Your use of Next Text Probability at models-resources.concord.org").tagName)
      .toBe("STRONG");
  });

  it.each([
    ["MIT License", "https://github.com/concord-consortium/markov-chain-plugin/blob/master/LICENSE"],
    ["Terms of Use", "https://concord.org/terms-of-use/"],
    ["concord.org/licensing", "https://concord.org/licensing"],
  ])("links %s to its page in a new tab", (name, href) => {
    renderPage();
    const link = within(openAbout().dialog).getByRole("link", { name: `${name}${newTab}` });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links the licensing address as an email, in the same tab", () => {
    renderPage();
    const link = within(openAbout().dialog).getByRole("link", { name: "licensing@concord.org" });
    expect(link).toHaveAttribute("href", "mailto:licensing@concord.org");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("keeps Tab between the dialog's first and last controls", () => {
    renderPage();
    const { dialog } = openAbout();
    const [x, close] = within(dialog).getAllByRole("button", { name: "Close" });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(x).toHaveFocus();
  });

  it.each(["Escape", "×", "Close"])("closes by %s and gives focus back to About", how => {
    renderPage();
    const { about, dialog } = openAbout();
    const [x, close] = within(dialog).getAllByRole("button", { name: "Close" });
    if (how === "Escape") {
      fireEvent.keyDown(dialog, { key: "Escape" });
    } else {
      fireEvent.click(how === "×" ? x : close);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(about).toHaveFocus();
  });

  it("keeps the Escape that closes the dialog from the workspace", () => {
    renderPage();
    const { dialog } = openAbout();
    const heard = jest.fn();
    document.addEventListener("keydown", heard);
    window.addEventListener("keydown", heard);
    fireEvent.keyDown(dialog, { key: "Escape" });
    document.removeEventListener("keydown", heard);
    window.removeEventListener("keydown", heard);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(heard).not.toHaveBeenCalled();
  });
});
