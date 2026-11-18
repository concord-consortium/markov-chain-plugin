# Implementation Plan: Next Text Probability pages, with a header, Terms of Use and license

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-35
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Four commits, each building, linting and passing its tests on its own. No dependency or lockfile changes.

The plan's code was built and run in Chrome before it was written up, the production build included, and then removed.

A dev server left running across these steps can keep reporting a moved or new module as unresolved from `eslint-webpack-plugin`'s cache (`node_modules/.cache/eslint-webpack-plugin`), which puts webpack's error overlay over every page and fails every Cypress test, while `npm run lint:build` is clean. Delete that folder and restart the server. The server also has to be restarted after any change to `webpack.config.js`.

---

### Share the dialog Tab wrap

**Summary**: The About dialog needs the same Tab handling as the Tables dialog. Move `wrapTab` out of `tables-dialog.tsx` into its own module, unchanged, so both dialogs use one copy. A refactor with no behavior change.

**Files affected**:
- `src/interactive/wrap-tab.ts`: new, the function moved verbatim with its comment, exported
- `src/interactive/workspace/tables-dialog.tsx`: delete the local `wrapTab`, import it

**Estimated diff size**: ~25 lines

```ts
// src/interactive/wrap-tab.ts
import React from "react";

// A modal dialog holds focus only within its own document, so in a frame Tab would carry on into the host's page.
export const wrapTab = (e: React.KeyboardEvent, dialog: Element) => {
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>("input:enabled, button:enabled"));
  const [first, last] = [controls[0], controls[controls.length - 1]];
  const { activeElement } = dialog.ownerDocument;
  if (!first || activeElement === (e.shiftKey ? first : last) || (e.shiftKey && activeElement === dialog)) {
    e.preventDefault();
    (e.shiftKey ? last : first)?.focus();
  }
};
```

`tables-dialog.tsx` adds `import { wrapTab } from "../wrap-tab";` after the `../tables/table-sender` import (before `./table-buttons`, for `import/order`). The selector stays `input:enabled, button:enabled`: only the first and last controls matter, and in the About dialog those are the × and Close buttons, with the links between them reached by the browser's own Tab order. The existing `tables-dialog.test.tsx` covers the Tables dialog unchanged; the About dialog's tests in the next step fail if its `wrapTab` call is dropped.

---

### Header, footer and About dialog

**Summary**: The shared page parts: the header, the footer with Terms of Use and About, the License & Terms of Use dialog, their links and styles, and the two SVGs, with tests that render them directly. Nothing uses them yet; the next two steps put them on the new pages. Covers R12 to R16 and R18 to R26 at the component level.

**Files affected**:
- `src/assets/concord-logo.svg`: new, the mockup's logo with its three rectangular clip paths removed, so it defines no ids (R26)
- `src/assets/graph-icon.svg`: new, the mockup's header icon with `stroke="currentColor"`
- `src/interactive/_dark-teal.scss`: new, `$dark-teal: #016082`, for the page header here and `demo.scss` in the last step
- `src/interactive/page/page-links.ts`: new, the name, host, URLs, separator and copyright line
- `src/interactive/page/external-link.tsx`, `page-header.tsx`, `about-dialog.tsx`, `page-footer.tsx`, `page.scss`: new
- `src/interactive/page/page-header.test.tsx`, `page-footer.test.tsx`, `concord-logo.test.ts`: new

**Estimated diff size**: ~550 lines (200 of them `page.scss`, 150 tests), plus the 16-line logo file (24 KB of path data). Over the usual ~500, but the styles belong with the markup they style, and the tests with the parts they test.

Jest stubs `.scss` and `.svg` imports, and nothing here is on a page yet, so this step also checks its styles compile with `npx sass --no-source-map src/interactive/page/page.scss`; the two SVGs first go through SVGR in the next step's build.

#### Assets

`src/assets/concord-logo.svg` is the mockup's logo (asset `642052370f5afca435a883976c745618` of https://claude.ai/artifact/C5kWCXYbjVexZMH1MTBUfV, read with the Artifact tool) with the `<defs>` block and every `clip-path="url(#clip-N)"` attribute deleted:

```bash
perl -0pe 's/<defs>.*?<\/defs>//s; s/ clip-path="url\(#clip-\d\)"//g' <mockup logo>.svg > src/assets/concord-logo.svg
```

A copy made this way is in this branch's out-of-band folder as `concord-logo.svg`; drawn 778 px wide in Chrome it differs from the original in 60 anti-aliasing pixels and looks the same.

```svg
<!-- src/assets/graph-icon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><circle cx="12" cy="5" r="3"/><line x1="7" y1="15" x2="10.5" y2="7.5"/><line x1="13.5" y1="7.5" x2="17" y2="15"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
```

Both go through the existing SVGR rule as React components; the build's svgo pass keeps the viewBox (`removeViewBox: false`).

#### `src/interactive/_dark-teal.scss`

```scss
// Concord's dark teal, 7:1 against white as text or as a background under white text
$dark-teal: #016082;
```

#### `src/interactive/page/page-links.ts`

```ts
// The interactive's public name, used only by the Next Text Probability pages; the repo, the build's existing files,
// the URLs and the CODAP plugin keep their own names
export const productName = "Next Text Probability";

// where the hosted interactive is served, as the About dialog's copy names it
export const hostName = "models-resources.concord.org";

export const termsOfUseUrl = "https://concord.org/terms-of-use/";
export const licenseUrl = "https://github.com/concord-consortium/markov-chain-plugin/blob/master/LICENSE";
export const licensingUrl = "https://concord.org/licensing";
export const licensingEmail = "licensing@concord.org";

// between the product's name and a page's own, in the header and the pages' titles
export const titleSeparator = " | ";

export const copyrightLine = () => `© ${new Date().getFullYear()} The Concord Consortium, Inc.`;
```

#### `src/interactive/page/external-link.tsx`

```tsx
import React from "react";

interface Props {
  href: string;
  children: React.ReactNode;
}

// what a screen reader hears after a link that opens in a new tab
export const newTabNote = " (opens in a new tab)";

// a link that opens in a new tab, and says so to a screen reader, as CODAP's ExternalLink does
export const ExternalLink = ({ href, children }: Props) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    { children }<span className="page-visually-hidden">{ newTabNote }</span>
  </a>
);
```

#### `src/interactive/page/page-header.tsx`

```tsx
import React from "react";
import GraphIcon from "../../assets/graph-icon.svg";
import { productName, titleSeparator } from "./page-links";

import "./page.scss";

interface Props {
  // the page's own name after the product's, such as "Authoring"
  subtitle?: string;
  // controls at the header's right
  children?: React.ReactNode;
}

// The bar at the top of a page the interactive is opened on by itself, never inside a host's frame. The divider is
// drawn; a screen reader hears the separator.
export const PageHeader = ({ subtitle, children }: Props) => (
  <header className="page-header">
    <div className="page-header-title">
      <GraphIcon className="page-header-icon" aria-hidden="true" />
      <h1>
        { productName }
        { subtitle && (
          <>
            <span className="page-visually-hidden">{ titleSeparator }</span>
            <span className="page-header-divider" aria-hidden="true" />
            <span className="page-header-subtitle">{ subtitle }</span>
          </>
        ) }
      </h1>
    </div>
    { children }
  </header>
);
```

#### `src/interactive/page/about-dialog.tsx`

```tsx
import React, { useId, useLayoutEffect, useRef } from "react";
import ConcordLogo from "../../assets/concord-logo.svg";
import { wrapTab } from "../wrap-tab";
import { ExternalLink } from "./external-link";
import {
  copyrightLine, hostName, licenseUrl, licensingEmail, licensingUrl, productName, termsOfUseUrl
} from "./page-links";

interface Props {
  onClose: () => void;
  // where focus goes once the dialog has closed
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

// The license and Terms of Use statement, in the wording of CODAP's About dialog
export const AboutDialog = ({ onClose, returnFocusTo }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // the browser focuses the first link, partway through the copy, and gives focus back only after Escape; the opener
  // can take focus only once close() has lifted the dialog's hold on the rest of the page
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener = returnFocusTo.current;
    dialog?.showModal();
    dialog?.focus();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, [returnFocusTo]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  // the workspace hears Escape on the document and the window, to clear the graph's choice or leave a drawing tool
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    if (e.key === "Tab") {
      wrapTab(e, e.currentTarget);
    }
  };

  return (
    <dialog className="about-dialog" ref={dialogRef} tabIndex={-1} aria-labelledby={titleId}
      onCancel={handleCancel} onKeyDown={handleKeyDown}>
      <div className="about-dialog-title-bar">
        <h2 id={titleId}>License &amp; Terms of Use</h2>
        <button type="button" className="about-dialog-x" aria-label="Close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
      <div className="about-dialog-body">
        <ConcordLogo className="about-dialog-logo" role="img" aria-label="The Concord Consortium" />
        <p>
          <strong>{ productName } is free, open-source software.</strong> The { productName } source code is released
          under the <ExternalLink href={licenseUrl}>MIT License</ExternalLink>, so you’re welcome to use, modify, and
          build on it.
        </p>
        <p>
          <strong>Your use of { productName } at { hostName }</strong> is governed by
          our <ExternalLink href={termsOfUseUrl}>Terms of Use</ExternalLink>. The hosted version is free for
          non-commercial use; commercial use requires a separate written agreement. For more information,
          visit <ExternalLink href={licensingUrl}>concord.org/licensing</ExternalLink> or
          contact <a href={`mailto:${licensingEmail}`}>{ licensingEmail }</a>.
        </p>
        <p className="about-dialog-copyright">{ copyrightLine() }</p>
      </div>
      <div className="about-dialog-buttons">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
};
```

Notes on the dialog, each checked in Chrome:
- `preventDefault` on Escape's `keydown` stops the browser's own cancel, so the dialog closes once, through `onClose`; `onCancel` remains for other close requests (such as Android's back gesture). `stopPropagation` keeps the Escape from `useEscape` (document) and `drawing.tsx` (window); a document listener added in the browser heard no Escape while the dialog closed.
- Focus lands on the dialog on open, and returns to About after Escape, ×, and Close.
- The dialog is a sibling of the footer, not inside it, so it isn't announced as part of the contentinfo landmark.

#### `src/interactive/page/page-footer.tsx`

```tsx
import React, { useRef, useState } from "react";
import ConcordLogo from "../../assets/concord-logo.svg";
import { AboutDialog } from "./about-dialog";
import { ExternalLink } from "./external-link";
import { copyrightLine, termsOfUseUrl } from "./page-links";

import "./page.scss";

interface Props {
  // the Concord logo before the copyright line, which names Concord, so it's hidden from screen readers
  showLogo?: boolean;
}

// The row at the bottom of a page the interactive is opened on by itself, never inside a host's frame
export const PageFooter = ({ showLogo }: Props) => {
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <footer className="page-footer">
        { showLogo && <ConcordLogo className="page-footer-logo" aria-hidden="true" /> }
        <span>{ copyrightLine() }</span>
        <span aria-hidden="true">·</span>
        <ExternalLink href={termsOfUseUrl}>Terms of Use</ExternalLink>
        <span aria-hidden="true">·</span>
        <button type="button" className="page-footer-about" ref={aboutRef} onClick={() => setAboutOpen(true)}>
          About
        </button>
      </footer>
      { aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} returnFocusTo={aboutRef} /> }
    </>
  );
};
```

#### `src/interactive/page/page.scss`

```scss
@use "../../components/markov-panel" as *;
@use "../dark-teal" as *;
@use "../visually-hidden";

$footer-text: #595959;
$rule-color: #c7c7c7;
$title-bar-color: #eef3f5;
$close-button-color: #dceff2;

.page-visually-hidden {
  @extend %visually-hidden;
}

.page-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 44px;
  padding: 0 14px;
  box-sizing: border-box;
  color: white;
  background-color: $dark-teal;

  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 18px;
    font-weight: bold;
  }
}

.page-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-header-icon {
  flex: none;
  width: 24px;
  height: 24px;
}

.page-header-divider {
  width: 1px;
  height: 22px;
  background-color: rgba(255, 255, 255, 0.5);
}

.page-header-subtitle {
  font-size: 16px;
  font-weight: normal;
}

.page-footer {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 6px 16px;
  border-top: 1px solid $rule-color;
  font-size: 13px;
  color: $footer-text;

  a,
  .page-footer-about {
    color: $markov-teal;
    text-decoration: underline;
  }

  a:hover,
  .page-footer-about:hover {
    color: $dark-teal;
  }

  .page-footer-about {
    padding: 0;
    border: 0;
    font: inherit;
    background: none;
    cursor: pointer;
  }

  a:focus-visible,
  .page-footer-about:focus-visible {
    outline: 2px solid $markov-teal;
    outline-offset: 2px;
  }
}

.page-footer-logo {
  width: auto;
  height: 22px;
  margin-right: 4px;
}

.about-dialog {
  width: 560px;
  // 16 px from each edge: a modal dialog's containing block is the window without its scrollbars, which 100vw and
  // 100vh include, and the limits leave out the 1 px border on each side
  max-width: calc(100% - 34px);
  max-height: calc(100% - 34px);
  padding: 0;
  border: 1px solid $rule-color;
  border-radius: 3px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  color: #333;

  &::backdrop {
    background-color: rgba(51, 51, 51, 0.5);
  }

  &:focus {
    outline: none;
  }

  a {
    color: $markov-teal;
    text-decoration: underline;
  }

  a:hover {
    color: $dark-teal;
  }

  a:focus-visible,
  button:focus-visible {
    outline: 2px solid $markov-teal;
    outline-offset: 2px;
  }
}

.about-dialog-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 6px 0 12px;
  background-color: $title-bar-color;

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
  }
}

.about-dialog-x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid $markov-teal;
  border-radius: 3px;
  background-color: white;
  cursor: pointer;

  svg {
    stroke: $markov-teal;
    stroke-width: 3;
    stroke-linecap: round;
  }
}

.about-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 4px;

  p {
    margin: 0;
    line-height: 1.5;
  }
}

.about-dialog-logo {
  width: 160px;
  height: auto;
}

.about-dialog-copyright {
  font-size: 13px;
  color: $footer-text;
}

.about-dialog-buttons {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 14px;

  button {
    height: 30px;
    padding: 0 18px;
    border: 1px solid $markov-teal;
    border-radius: 3px;
    font: inherit;
    color: #333;
    background-color: $close-button-color;
    cursor: pointer;
  }
}
```

`components/markov-panel.scss` holds only variables and mixins, so `@use` adds no CSS. The `#c7c7c7` and `#eef3f5` here also appear as `$pane-border-color` and a literal in `workspace.scss`; the authoring page's bundle doesn't load `workspace.scss`, so they are named here rather than imported from it.

#### Tests

`src/interactive/page/page-header.test.tsx`:

```tsx
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
```

`src/interactive/page/page-footer.test.tsx` renders the footer with its logo and drives the dialog. It polyfills `showModal` and `close` as `tables-dialog.test.tsx` does, and uses Testing Library queries only (the repo's lint forbids direct node access in tests):

```tsx
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { newTabNote as newTab } from "./external-link";
import { PageFooter } from "./page-footer";

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
    fireEvent.keyDown(x, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
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
```

`src/interactive/page/concord-logo.test.ts` reads the shipped file, since Jest replaces every imported SVG with a stub; the mockup's original logo, with its `clip-0` to `clip-2`, fails it:

```ts
/**
 * @jest-environment node
 */
/// <reference types="node" />
import { readFileSync } from "fs";
import path from "path";

// The Next Text Probability page draws the logo twice, in its footer and its About dialog, so an id in it would repeat
describe("the Concord logo", () => {
  const svg = readFileSync(path.join(__dirname, "../../assets/concord-logo.svg"), "utf8");

  it("is a drawing with no ids", () => {
    expect(svg).toMatch(/<svg[^>]* viewBox="0 0 389.18 119.4"/);
    expect(svg).toMatch(/<path /);
    expect(svg).not.toMatch(/\sid=/);
  });
});
```

---

### The Next Text Probability interactive page

**Summary**: `App` takes a `page` prop, and a new entry mounts it as `next-text-probability/index.html` with the header, the workspace in `<main>`, and the footer with the logo. The page always shows itself, even in a frame. The shared template takes its title from webpack, so this page's HTML carries "Next Text Probability" and the existing pages keep "Markov Interactive". Covers R1 to R4, R7 to R9, R14, R17 and R25 for this page, and R28 to R30 as they apply to it.

**Files affected**:
- `src/interactive/page/page-links.ts`: adds `PageId`
- `src/interactive/app.tsx`: the `page` prop; `StandaloneApp` renders either form
- `src/interactive/next-text-probability/index.tsx`: new, the entry
- `src/interactive/interactive.scss`: `.standalone-page` column
- `src/interactive/index.html`: `<title>` from the page's `title` option
- `webpack.config.js`: the entry, the page, and a `title` on every interactive page
- `src/interactive/standalone.test.tsx`: the default page shows none of the new parts; the new page shows them
- `src/interactive/hosted.test.tsx`: new, the hosted modes show none of them, and the new page in a frame shows itself
- `src/interactive/webpack-pages.test.ts`: new, the pages' titles and paths
- `cypress/e2e/next-text-probability.test.ts`: new, the page in a browser

**Estimated diff size**: ~190 lines

`page-links.ts` adds, after `productName`:

```ts
// The interactive's pages come in two forms from the same components: its own, which hosts and existing links open,
// and the Next Text Probability pages in next-text-probability/, with the header, footer and About dialog
export type PageId = "markov" | "next-text-probability";

```

`src/interactive/app.tsx`:

```tsx
import { PageFooter } from "./page/page-footer";
import { PageHeader } from "./page/page-header";
import { PageId } from "./page/page-links";
// …
// (the existing comment above StandaloneApp stays)
const StandaloneApp = ({ page }: { page: PageId }) => {
  const nextText = page === "next-text-probability";
  const runtime = <Runtime authoredState={authoredStateFromSearch(window.location.search)} view="standalone" />;
  if (!nextText) {
    return <div className="markov-interactive">{ runtime }</div>;
  }
  return (
    <div className="standalone-page">
      <PageHeader />
      <main className="markov-interactive">{ runtime }</main>
      <PageFooter showLogo />
    </div>
  );
};

interface AppProps {
  page?: PageId;
}

// Hosts load interactive.html; the Next Text Probability page is never a host's, so in another site's frame it still
// shows itself rather than waiting for an init message that won't come
export const App = ({ page = "markov" }: AppProps) =>
  inIframe() && page === "markov" ? <HostedApp /> : <StandaloneApp page={page} />;
```

`src/interactive/index.tsx` is unchanged (`<App />`). `src/interactive/next-text-probability/index.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../app";

createRoot(document.getElementById("app") as HTMLElement).render(<App page="next-text-probability" />);
```

`src/interactive/interactive.scss`, after the `.markov-interactive` rule:

```scss
// the Next Text Probability page: the footer sits at the window's bottom when the window has room below the workspace
.standalone-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  .page-footer {
    margin-top: auto;
  }
}
```

`src/interactive/index.html`: `<title>Markov Interactive</title>` becomes `<title><%= htmlWebpackPlugin.options.title %></title>`.

`webpack.config.js`:

```js
// the interactive's own pages' title; the other pages' titles match their headers (webpack-pages.test.ts)
const interactiveTitle = 'Markov Interactive';
// …
    entry: {
      // …
      'next-text-probability': './src/interactive/next-text-probability/index.tsx',
    },
// …
      // `title: interactiveTitle,` added to the interactive.html, report-item.html and demo.html pages
      // the interactive and its authoring page as Next Text Probability, in a folder of their own; their assets, and
      // the interactive.html the authoring page frames, are in the folder above
      new HtmlWebpackPlugin({
        filename: 'next-text-probability/index.html',
        template: 'src/interactive/index.html',
        title: 'Next Text Probability',
        publicPath: '..',
        chunks: ['next-text-probability'],
      }),
```

The new page goes after the `demo.html` page, before the dev-only pages.

#### Tests

`src/interactive/standalone.test.tsx`: its import adds `fireEvent`. The first test ("the interactive runs with the default settings and no note above it, and leaves the library alone") adds, after its `Activity Player` check:

```tsx
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "About" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Text Probability/)).not.toBeInTheDocument();
```

The report-item test adds, after its text check:

```tsx
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Text Probability/)).not.toBeInTheDocument();
```

and the file ends with:

```tsx
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
```

`src/interactive/hosted.test.tsx` (new) starts the app as LARA and the Activity Player do, with the library's frame check and init message mocked. Each hosted case first checks text from the mode's own content, so a case that rendered only the loading state cannot pass:

```tsx
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
```

`src/interactive/webpack-pages.test.ts` (new) loads the real configuration (the repo's `allowJs` and `esModuleInterop` type it from `webpack.config.js`):

```ts
/**
 * @jest-environment node
 */
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpackConfig from "../../webpack.config.js";
import { productName } from "./page/page-links";

// the pages the production build writes, by file name
const builtPages = () => {
  const config = webpackConfig({}, { mode: "production" });
  const pages = config.plugins.filter(plugin => plugin instanceof HtmlWebpackPlugin);
  return { entries: config.entry as Record<string, string>,
    pages: Object.fromEntries(pages.map(page => [page.userOptions.filename, page.userOptions])) };
};

describe("the build's interactive pages", () => {
  it("titles the Next Text Probability pages as their headers name them", () => {
    const { pages } = builtPages();
    expect(pages["next-text-probability/index.html"].title).toBe(productName);
  });

  it("keeps the interactive's own pages' title", () => {
    const { pages } = builtPages();
    ["interactive.html", "report-item.html", "demo.html"].forEach(page =>
      expect(pages[page].title).toBe("Markov Interactive"));
  });

  it("loads the Next Text Probability pages' assets from the folder above", () => {
    const { entries, pages } = builtPages();
    ["next-text-probability/index.html"].forEach(page => {
      expect(pages[page].publicPath).toBe("..");
      expect(entries[(pages[page].chunks as string[])[0]]).toMatch(/^\.\/src\/interactive\/next-text-probability\//);
    });
  });
});
```

`cypress/e2e/next-text-probability.test.ts` (new). Cypress runs each page inside its own frame, which is how R4 was found:

```ts
const year = new Date().getFullYear();

const openAndCloseAbout = () => {
  cy.contains("footer button", "About").focus();
  cy.focused().click();
  cy.get("dialog").should("be.visible").and("have.focus")
    .and("contain.text", "Next Text Probability is free, open-source software.")
    .should($dialog => expect($dialog[0].matches(":modal")).to.equal(true));
  cy.get("dialog").trigger("keydown", { key: "Escape" });
  cy.get("dialog").should("not.exist");
  cy.focused().should("have.text", "About");
};

describe("the Next Text Probability pages", () => {
  it("shows the interactive with its header, footer and About", () => {
    cy.visit("/next-text-probability/index.html");
    cy.title().should("equal", "Next Text Probability");
    cy.get("header h1").should("have.text", "Next Text Probability");
    cy.get("main").contains("h2", "Graph").should("be.visible");
    cy.get("footer").should("contain.text", `© ${year} The Concord Consortium, Inc.`)
      .find("svg[aria-hidden='true']").should("be.visible");
    cy.get("footer").should("have.css", "border-top-width", "1px");
    openAndCloseAbout();
  });
});
```

---

### The Next Text Probability authoring page

**Summary**: `Demo` takes the same `page` prop and stays in `demo.tsx`, whose two mounting lines move to a new `demo-index.tsx` entry. A second new entry mounts it as `next-text-probability/authoring.html` with the shared header ("Next Text Probability | Authoring", the Standalone link at its right) and footer, framing `../interactive.html`, with none of the Activity Player's views (page widths, teacher's view, report item). The Standalone link now opens `next-text-probability/index.html` and appears only on this page: `demo.html` keeps its own header with its title alone, retitled "Demo Authoring". The link's Cypress tests move with it to the new page, and the README lists the two new pages and says where links are built. Covers R1, R2, R5, R6, R8, R10, R11, R17, R25 and R27, and R28 to R30 as they apply to this page.

**Files affected**:
- `src/interactive/page/page-links.ts`: adds `authoringSubtitle` and `demoPageTitle`
- `src/interactive/demo.tsx`: exports `Demo` with the `page` prop; no longer mounts it; the Standalone link only on the new page, pointing at `index.html`; the page widths, teacher's view and report item only on `demo.html`; the new page's columns in `main` and its frames without object storage; `demo.html`'s title becomes "Demo Authoring"
- `src/interactive/host-messages.ts`: the storage config becomes optional, for the new page's frames
- `src/interactive/demo-index.tsx`: new, the `demo.html` entry
- `src/interactive/next-text-probability/authoring.tsx`: new, the entry
- `src/interactive/demo.scss`: `$teal` comes from `_dark-teal.scss`; the `h1` rule moves into `.demo-header` and the `h2` rule into `.demo-columns`; the authoring header's padding and label and the footer's padding as the mockup, with no rule above the footer
- `webpack.config.js`: the `demo` entry points at `demo-index.tsx`; `demo.html`'s title is "Demo Authoring"; the new entry and page
- `src/interactive/webpack-pages.test.ts`: the authoring page's title and paths, and `demo.html`'s title
- `cypress/support/demo-page.ts`: new, `frameBody` and `messageOf`, shared by the two authoring specs
- `cypress/e2e/next-text-probability.test.ts`: the authoring page, and the Standalone link tests moved from the demo spec
- `cypress/e2e/interactive-demo.test.ts`: the link tests move out; `demo.html` has its new title and no link controls or footer
- `README.md`: the two new pages, `demo.html`'s new title, and where the standalone link is built (R27)

**Estimated diff size**: ~530 lines, about 250 of them the Cypress link tests moving from one spec to the other (134 lines out, 184 in with the new page's tests); `demo.tsx` is +69 −35, much of it the re-indented blocks the page form leaves out.

Keeping `Demo` in `demo.tsx` keeps its diff to the changes; moving it to a new file instead shows as the whole file deleted and re-added.

`page-links.ts`: `export const authoringSubtitle = "Authoring";` after `titleSeparator`, and after it, with the comment "demo.html's title, in its header and, from webpack.config.js, its tab", `export const demoPageTitle = "Demo Authoring";`, so the header and the test of the build's titles share one value. `external-link.tsx` exports the hidden text as `newTabNote` (" (opens in a new tab)", with the comment "what a screen reader hears after a link that opens in a new tab"), which `ExternalLink`, the Open link and `page-footer.test.tsx` (as `newTab`) use.

`src/interactive/demo.tsx`:

```tsx
// imports: drop createRoot; add
import { newTabNote } from "./page/external-link";
import { PageFooter } from "./page/page-footer";
import { PageHeader } from "./page/page-header";
import { authoringSubtitle, demoPageTitle, PageId } from "./page/page-links";

interface HostedFrameProps {
  // interactive.html, from the page's folder
  src: string;
  // whether the host offers object storage, which the Send to CODAP button needs
  objectStorage: boolean;
  // … the existing props
}

const HostedFrame = ({ src, objectStorage, title, mode, authoredState, getInteractiveState, onMessage, width }:
  HostedFrameProps) => {
  // …
    iframe.src = src;
  // …
      endpoint.post("initInteractive", initInteractiveMessage(mode, authoredState, interactiveState, objectStorage));
  // …
  }, [src, objectStorage, mode, authoredState, getInteractiveState, onMessage]);
  // …
};

// where each form of the page finds the interactive it frames
const interactivePaths: Record<PageId, string> = {
  markov: "interactive.html",
  "next-text-probability": "../interactive.html",
};

// the link group's label; the page's users don't know the Activity Player, so nothing here names it
const linkLabel = "Link to the interactive with these settings:";

// The Next Text Probability page with the authoring form's settings, for a collection page or any page outside the
// Activity Player. The page is beside this one, so the link names the same branch or version.
const StandaloneLink = ({ authoredState }: { authoredState: unknown }) => {
  const url = new URL(`index.html${searchFromAuthoredState(readAuthoredState(authoredState))}`,
    window.location.href);
  // … unchanged apart from its wording, below
};

export const Demo = ({ page = "markov" }: { page?: PageId }) => {
  const nextText = page === "next-text-probability";
  const interactiveSrc = interactivePaths[page];
  // … the existing state and callbacks

  // the page width choice, the teacher's view and the report item are the Activity Player's, so only the demo page
  // shows them; the Next Text Probability page previews the interactive at its full width
  const apViews = !nextText;
  const frameWidth = apViews ? demoWidths.find(w => w.id === widthId)?.frameWidth : undefined;
  // the page its link opens is never hosted, so has no object storage; its preview has none either, to match
  const objectStorage = !nextText;
  // the page's main landmark, between its header and footer
  const Columns = nextText ? "main" : "div";

  return (
    <div className="demo">
      { nextText
        ? (
          <PageHeader subtitle={authoringSubtitle}>
            <StandaloneLink authoredState={authoredState} />
          </PageHeader>
        )
        : (
          <header className="demo-header">
            <h1>{ demoPageTitle }</h1>
          </header>
        ) }
      { /* the columns as they are, in <Columns className="demo-columns">, each HostedFrame given */ }
      { /* src={interactiveSrc} objectStorage={objectStorage}, with: */ }
      { /* - the "Activity Player page width" fieldset wrapped in { apViews && ( … ) } */ }
      { /* - the teacher's view's condition { report && ( … ) } becoming { apViews && report && ( … ) } */ }
      { /* - the "Report item, full answer" heading and its iframe wrapped in { apViews && ( <> … </> ) } */ }
      { nextText && <PageFooter /> }
    </div>
  );
};
```

`StandaloneLink`'s wording (R10): `linkLabel` replaces `standaloneWarning` in the label paragraph, the group's `aria-label` becomes "Link to the interactive", and the status says "Link copied" or "The link couldn't be copied". The Open link gets `<span className="demo-visually-hidden">{ newTabNote }</span>` after "Open" (R21). The class names and the `demo-standalone-warning` id stay, since the styles and `aria-describedby` use them.

The three `HostedFrame`s (Authoring, Interactive, Teacher's view) each get `src={interactiveSrc}` and `objectStorage={objectStorage}` as their first props, keeping `src`, `objectStorage`, `title` and `mode` on the opening line and moving the rest to the lines after it to stay within 120 characters (the teacher's view wraps after `key={report.saves}`); the report item's `srcDoc` frame is unchanged apart from its wrapper (its `srcDoc` expression wraps after `report?.state,` at 120 characters). On the new page the width state is still read from `?width=` but never used, and saves still reach `report`, which only `demo.html` shows; the preview's restarts keep typed input as before. `pageTitle` is replaced by `demoPageTitle`, "Demo Authoring" (R6), for the header; the tab's title is in `demo.html` itself (R8). The two lines at the end of the file (`document.title = pageTitle;` and the `createRoot(…).render(<Demo />)`) are deleted: mounting moves to the entries. `StandaloneLink` is otherwise unchanged; its long-link checks measure the new path, which is 16 characters longer than `interactive.html`.

`src/interactive/host-messages.ts`: `initInteractiveMessage` takes a fourth parameter, `objectStorage = true`, and includes `objectStorageConfig` only when it is true (`...(objectStorage ? { objectStorageConfig: { version: 1, type: "demo" } } : {})`), so `fake-ap.ts` is unchanged. Its header comment's last sentence becomes "Their object storage is the library's in-memory store, unless the page asks for none.", wrapped after "store, unless".

`src/interactive/demo-index.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Demo } from "./demo";

createRoot(document.getElementById("app") as HTMLElement).render(<Demo />);
```

`src/interactive/next-text-probability/authoring.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { Demo } from "../demo";

createRoot(document.getElementById("app") as HTMLElement).render(<Demo page="next-text-probability" />);
```

`demo.scss`: add `@use "dark-teal" as *;` before `@use "visually-hidden";`, delete the `$teal` definition and its comment (the comment moved with the value), replace `$teal` with `$dark-teal` (four places), move the `h1 { margin: 0; font-size: 20px; }` rule from `.demo` into `.demo-header` and delete that rule's `justify-content` and `gap`, which spaced the link group the header no longer holds, and move the `h2 { margin: 10px 0 5px; … }` rule from `.demo` into `.demo-columns`, which holds every `h2` the demo pages have. Left in `.demo`, the two rules would also style the shared header's `h1` and the About dialog's `h2` on the new page, since they have the same specificity and `demo.scss` loads later; checked in the browser, the new header's `h1` is 18 px, the dialog's title sits centered in its bar with no margin, and `demo.html`'s `h1` is still 20 px. The `.demo-standalone` styles stay: the new page's header uses them. At the end of the file:

```scss
// the authoring page's header and footer spacing; its footer has no rule above it
.demo .page-header {
  padding: 0 12px;

  .demo-standalone-warning {
    font-size: 14px;
    font-weight: bold;
  }
}

.demo .page-footer {
  padding: 8px 16px;
  border-top: 0;
}
```

`webpack.config.js`: the `demo.html` page's `title: interactiveTitle` becomes `title: 'Demo Authoring'` (R8), and the "keeps the interactive's own pages' title" test drops `demo.html` from its list and asserts `demoPageTitle` for it instead; `demo: './src/interactive/demo-index.tsx'`, `'next-text-probability-authoring': './src/interactive/next-text-probability/authoring.tsx'` in `entry`, and after the new interactive page:

```js
      new HtmlWebpackPlugin({
        filename: 'next-text-probability/authoring.html',
        template: 'src/interactive/index.html',
        title: 'Next Text Probability | Authoring',
        publicPath: '..',
        chunks: ['next-text-probability-authoring'],
      }),
```

#### Tests

`src/interactive/webpack-pages.test.ts` imports `authoringSubtitle` and `titleSeparator` too, checks

```ts
    expect(pages["next-text-probability/authoring.html"].title)
      .toBe(`${productName}${titleSeparator}${authoringSubtitle}`);
```

and runs the assets check over both new pages.

`cypress/support/demo-page.ts` (new), the helpers both authoring specs use (`messageOf` moves here from the demo spec, with its comment):

```ts
// Helpers for the authoring pages, demo.html and next-text-probability/authoring.html, which frame the interactive

export const frameBody = (title: string) =>
  cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body));

// iframe-phone posts an object, or its JSON where a browser can only post text
export const messageOf = (data: unknown) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
};
```

`cypress/e2e/interactive-demo.test.ts`:
- imports `frameBody` and `messageOf` from `../support/demo-page` and drops its own copies, with the `standaloneLink` and `panesIn` helpers, which only the moved tests use;
- moves out, unchanged apart from what the list below says, the eight tests from "links to the interactive standalone with the settings that differ from the defaults" through "opens its link standalone with the panes the runtime shows";
- adds, in their place:

```ts
  it("names itself, with no standalone link or footer", () => {
    cy.visit("/demo.html");
    cy.title().should("equal", "Demo Authoring");
    cy.get("h1").should("have.text", "Demo Authoring").and("have.css", "font-size", "20px");
    cy.get("header").find("button, a").should("not.exist");
    cy.get("footer").should("not.exist");
  });
```

`cypress/e2e/next-text-probability.test.ts`:
- imports `frameBody` and `messageOf` from `../support/demo-page`, and takes the `standaloneLink` and `panesIn` helpers, with their comments, from the demo spec;
- adds, after the first test:

```ts
  it("authors the interactive with its header, footer and About", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.title().should("equal", "Next Text Probability | Authoring");
    cy.get("h1").should("have.text", "Next Text Probability | Authoring").and("have.css", "font-size", "18px");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    ["Authoring", "Interactive"].forEach(title => frameBody(title).find("footer, h1").should("not.exist"));
    cy.get("footer").should("contain.text", `© ${year} The Concord Consortium, Inc.`)
      .find("a").should("have.attr", "href", "https://concord.org/terms-of-use/");
    cy.get("footer svg").should("not.exist");
    cy.get("footer").should("have.css", "border-top-width", "0px");
    cy.get("main").should("have.class", "demo-columns");
    cy.get("body").should("not.contain.text", "Activity Player");
    cy.contains("footer button", "About").click();
    // the demo page's own heading styles stay off the dialog's title
    cy.get("dialog h2").should("have.css", "margin-top", "0px");
    cy.get("dialog").trigger("keydown", { key: "Escape" });
    openAndCloseAbout();
  });
```

- adds, after that, a test that the page has none of the Activity Player's views:

```ts
  it("previews the interactive at full width, with none of the Activity Player's views", () => {
    let saved = false;
    cy.visit("/next-text-probability/authoring.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        saved ||= messageOf(event.data)?.type === "interactiveState";
      })
    });
    cy.get(".demo-widths").should("not.exist");
    cy.get("iframe[title='Report item']").should("not.exist");
    cy.get("iframe[title='Interactive']").invoke("outerWidth")
      .then(width => cy.get(".demo-runtime-frame").invoke("width").should("be.closeTo", width, 2));
    frameBody("Interactive").find(".workspace-body:not([hidden]) .probabilities-toggle").click();
    cy.wrap(null, { timeout: 5000 }).should(() => expect(saved).to.equal(true));
    cy.contains("h2", "Teacher's view").should("not.exist");
    cy.get("iframe[title=\"Teacher's view\"]").should("not.exist");
  });

  it("previews no Send to CODAP button, which the page its link opens can't show", () => {
    cy.visit("/next-text-probability/authoring.html");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    // marks the preview's document, so the check below waits for the one the new settings load
    cy.get("iframe[title='Interactive']").its("0.contentWindow")
      .then(win => { (win as Window & { stale?: boolean }).stale = true; });
    frameBody("Authoring").find("#button-sendToCodap").check();
    cy.get(".demo-standalone a").should("have.attr", "href").and("contain", "buttons.sendToCodap.available=true");
    cy.get("iframe[title='Interactive']").its("0.contentWindow.stale").should("not.exist");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    frameBody("Interactive").should("not.contain.text", "Send to CODAP");
  });
```

  It waits for a real save before looking for the teacher's view, which appears only after one; with the three views left on the new page, it fails. The same steps on `demo.html`, whose frames keep their object storage, show the button, so the test fails if the new page's frames get storage back.
- and then the eight moved tests, inside `describe("the authoring page's standalone link", () => { … })`, with these changes: each `cy.visit("/demo.html…")` becomes `cy.visit("/next-text-probability/authoring.html…")`, dropping the first test's `?width=960`, which the new page ignores; each expected `${origin}/interactive.html?…` becomes `${origin}/next-text-probability/index.html?…` (two of those lines wrap at 120 characters); the expected label, accessible name and status texts follow R10's wording ("Link to the interactive with these settings:", "Link copied", "The link couldn't be copied"); the first test is named "links to the Next Text Probability page with the settings that differ from the defaults" and drops its title and `h1` checks, which the authoring test above makes; the copy test's `writeText` check wraps after `.invoke("attr", "href")`; and the first test's `standaloneLink().should("have.text", "Open")` expects "Open (opens in a new tab)". The Chrome-only test that opens the link in a window of its own now opens the new interactive page, and still checks its panes against the runtime's.

#### README

In the "Markov Interactive" section's list of pages, after `demo.html`:

```markdown
- `next-text-probability/index.html` and `next-text-probability/authoring.html`: the interactive opened on its own
  and its authoring page, as Next Text Probability, with a header, and a footer whose About link shows the license
  and Terms of Use. The authoring page shows the authoring form, a full-width preview, and the link to the interactive
  with those settings; the Activity Player's views stay on `demo.html`. They load their assets, and the authoring page
  frames `interactive.html`, from the folder above.
```

In the list's `demo.html` item, "the Demo and Standalone Authoring page" becomes "the Demo Authoring page". In the "Opened on its own" paragraph, "The demo page builds that link for the settings in its form, to copy or open." (split across two lines after "to") becomes "The authoring page in `next-text-probability/` builds that link for the settings in its form, to copy or open, as a link to `next-text-probability/index.html`, which shows the same interactive with its header and footer.", with the paragraph rewrapped at 120 characters.

## Open Questions

### RESOLVED: Judgment call: what tells a component which page it is on
**Options considered**: A) a boolean such as `branded`; B) `page: "markov" | "next-text-probability"`, defaulting to `"markov"`; C) reading the URL path at run time.
**Decision**: B. It names the page rather than one of its features, so a later page form is a new value rather than a second boolean, and unlike C it can be tested by rendering with a prop.

### RESOLVED: Judgment call: where the shared page parts live
**Options considered**: A) `src/interactive/page/`, imported through `App` and `Demo`; B) inside `app.tsx` and `demo.tsx`; C) under `src/components/`, which the CODAP plugin shares.
**Decision**: A. Both pages need the same parts (B would copy them), and the CODAP plugin has its own About in CODAP (C would put interactive-only code beside plugin code).

### RESOLVED: Judgment call: native `<dialog>` or a library
**Options considered**: A) native `<dialog>` with `showModal`, as `tables-dialog.tsx`; B) `react-modal`, as CLUE-750 used.
**Decision**: A. The repo already has the pattern and its test polyfill, and a dependency for one dialog isn't worth it. The browser checks in requirements.md say what the code must still do itself (initial focus, focus return).

### RESOLVED: Judgment call: how "no repeated id" is tested
**Options considered**: A) count ids in a rendered page in Jest; B) test the shipped logo file for ids; C) a Cypress check.
**Decision**: B. Jest replaces SVGs with a stub, so A could never see the logo's ids; the dialog's only other id comes from `useId`. The file test fails on the mockup's original logo.

## Self-Review

Roles: commit reviewer (does each step build and pass alone), test writer (can each test be written as given, and does it fail when the code it guards breaks), operator, senior engineer, and the accessibility reviewer for the pages as rendered. The plan's code was applied on top of master and run, so each finding below comes from running it.

### Test Writer

#### RESOLVED: each new test fails when the line it guards is broken
Run against deliberate breaks: dropping the dialog's `wrapTab` call, its `stopPropagation`, its initial `focus()` or its focus return each failed one to three tests; dropping the footer from the new page failed two; dropping the header's spoken separator failed one; a hardcoded year failed one of the two pinned clocks; the mockup's original logo failed the logo test; making `App` ignore `page` inside a frame failed the framed-page test; and putting the header and footer on the default page failed its tests.

#### RESOLVED: the hosted test's description overstated its guard
"Input" shows in both the runtime and the report view, so the first check proves only that the case rendered its mode rather than the loading state. The sentence before the test says that.

### Commit Reviewer

#### RESOLVED: the first code step was about 700 lines
With the page parts, both page wirings and the tests in one step, the diff measured about 700 lines. The parts now have their own step with component tests, and the two pages follow as steps of about 190 and 140 lines.

#### RESOLVED: moving `Demo` to a new file showed as a rewrite
Git listed the move as 213 lines deleted and 239 added. `Demo` stays in `demo.tsx` and only its mounting moves to `demo-index.tsx`, so the diff is the change itself (+42 −18).

### Senior Engineer

#### RESOLVED: the old demo header's h1 rule would style the new header
`.demo h1` (20 px) and `.page-header h1` (18 px) have the same specificity, so the shared header's `h1` on the new authoring page would depend on stylesheet order. The rule moves into `.demo-header`.

#### RESOLVED: the Cypress chain in the first draft failed lint
`cy.contains(…).focus().click()` trips `cypress/unsafe-to-chain-command` in `npm run lint:build`. The spec focuses, then clicks `cy.focused()`.

### Operator

#### RESOLVED: a running dev server reports moved or new modules as missing
`eslint-webpack-plugin`'s cache kept an `import/no-unresolved` error for a module created while the server ran, and webpack's error overlay then failed every Cypress test while `npm run lint:build` was clean. The plan's opening paragraph says to clear the cache and restart, and that `webpack.config.js` changes need a restart too.

### Product (Doug's review)

#### RESOLVED: the old demo page and the new one would build two kinds of link
With the Standalone link on both authoring pages, `demo.html` would keep making `interactive.html` links while the new page made `next-text-probability/index.html` links. Doug chose to drop the link from `demo.html` (requirements, R6). Its Cypress tests move with it, so the link's behavior keeps the same coverage on the page that has it; the moved tests passed against `authoring.html` in Chrome, the open-in-a-window one included.

#### RESOLVED: the new authoring page showed the Activity Player's views
As `demo.html`'s copy, the new page kept the page width choice, the teacher's view and the report item, which only matter inside an activity. Doug chose to leave all three to `demo.html` (requirements, R5). Checked in Chrome: the new page previews at its column's full width, and the Cypress test that waits for a save and then looks for the teacher's view passes, and fails when the views are left in.

#### RESOLVED: the new authoring page named the Activity Player
Its users don't know the Activity Player, but the link label read "Standalone link to use outside Activity Player:". The label, the group's name and the copy status now use plain wording, and a Cypress check asserts the page's text never says "Activity Player". At Doug's request the authoring footer also drops its top rule. Both checked in Chrome.

## Self-Review (round 1)

Roles: WCAG accessibility expert, QA engineer, senior engineer, commit reviewer, technical writer. Each finding was checked by running the plan's code in Chrome.

#### RESOLVED: `.demo h2` styled the About dialog's title on the authoring page
The dialog renders inside `.demo`, and `demo.scss`'s `h2` rule outranked the dialog's by load order, giving the title 10 px / 5 px margins off-center in its bar. The rule moves into `.demo-columns`, and the authoring test checks the dialog's `h2` has no top margin (it fails with the rule left in `.demo`).

#### RESOLVED: the header's fixed height clipped the wrapped link group
With a long-link warning at 800 px wide (or zoomed), the link group overflowed the 44 px header above the window. The header takes `min-height: 44px` (R9): still 44 px without a warning, 51 to 56 px with one.

#### RESOLVED: the Open link opened a new tab without saying so
It now carries the visually hidden " (opens in a new tab)" like the page's other new-tab links (R21), and the moved test expects that text.

#### RESOLVED: `demo.html`'s HTML title differed from the one it shows
Webpack writes "Demo Authoring" into `demo.html` (R8), so `Demo` sets no `document.title`, and the webpack-pages test asserts it.

#### RESOLVED: smaller wording fixes
R10 describes `demo.html`'s header by its padding and `h1` (it measures 48.6 px without the buttons, not 50); the README entry says what the new authoring page leaves out; the plan's opening build log, whose counts would go stale, is one sentence.

## Self-Review (round 2)

Roles: a teacher making a link for a collection page, performance engineer, WCAG accessibility expert, QA engineer, Kiley checking against the mockup, security engineer, DevOps engineer. Each finding was checked in headless Chrome against the plan's code with round 1's fixes; the security and DevOps reviews found nothing that held up.

#### RESOLVED: the authoring preview showed Send to CODAP, which the linked page never shows
The frames started with the demo's object storage, so ticking the setting showed the button in the preview, while `index.html`, never hosted, can't. The new page's frames start without object storage (`initInteractiveMessage`'s `objectStorage` flag), a Cypress test checks the preview, and Out of Scope notes the form still offers the setting.

#### RESOLVED: the existing interactive bundles carry the new page parts
`app.tsx` and `demo.tsx` import the header and footer statically, adding about 17 KB raw (7 KB gzipped) to `interactive.*.js` and `demo.*.js`. Accepted and recorded in requirements.md's Technical Notes; loading them lazily took most of it back but adds a loading state and changes two Jest tests.

#### RESOLVED: the authoring page had no `main` landmark
Its columns render as `main` on the new page (R25), checked by the authoring Cypress test; `demo.html` keeps its `div`.

#### RESOLVED: the dialog's 16 px margin shrank beside a scrollbar
`100vw` counts the page's scrollbar; the dialog's limits use `100%`, measured at 15 px from the edge in a 400 × 300 window.

#### RESOLVED: mockup differences missing from "Where the inputs differ"
The hover color (#016082), the interactive header's 14 px padding, the authoring footer's 8 px padding and the 14 px bold link label now match the mockup; the full-width footer rule is listed in the table.

## Self-Review (round 3)

Roles: commit reviewer, a next engineer applying the plan literally, and a requirements checker measuring the pages against the R-numbers. The plan was applied as written, one throwaway commit per step; each commit built, linted and passed its own tests, and the last passed the whole Cypress suite.

#### RESOLVED: no test guarded the `h1` rule's move out of `.demo`
With the rule left in `.demo`, the authoring `h1` measured 20 px and every test passed. The authoring test now expects 18 px and the demo spec 20 px.

#### RESOLVED: the page parts' step compiled none of its styles
Jest stubs `.scss` and `.svg`, and nothing used the parts yet, so a broken `page.scss` would first fail a step later. The step now runs `sass` over it.

#### RESOLVED: lines over 120 characters, and a README sentence across a line break
The plan gives the wrapped forms of the `HostedFrame` openings and the `host-messages.ts` comment, and says the README sentence spans two lines and is rewrapped.

#### RESOLVED: the dialog stopped 15 px from the window's edges
The limits left out the 1 px border on each side; `calc(100% - 34px)` measured 16 px on every side, as R18 asks.
