# Next Text Probability pages, with a header, Terms of Use and license

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-35

**Status**: **Closed**

## Overview

The build gains a `next-text-probability/` folder with two pages: `index.html`, the interactive opened on its own, and `authoring.html`, its authoring page. Both are named **Next Text Probability**, the interactive's new public name, with a header, and a footer whose About link opens a License & Terms of Use dialog stating that the software is MIT licensed and the hosted version is free for non-commercial use under Concord's Terms of Use. They are the same React components as `interactive.html` and `demo.html`, told by a `page` prop which page they are on; the new authoring page leaves out the Activity Player's views (page widths, teacher's view, report item). The new authoring page is the only place that builds a standalone link, so `demo.html` loses its Copy and Open buttons and is retitled "Demo Authoring"; otherwise the existing pages, and the interactive inside an activity, in the class dashboard and as the report item, stay exactly as they are.

Concord's other hosted apps (CODAP, CLUE and the Geo simulations) carry the same statement. The new pages live in a folder of their own so the name stays with them and a later story can give them their own web address.

## Requirements

### The pages

- **R1.** The build writes two new pages: `next-text-probability/index.html`, the interactive opened on its own, and `next-text-probability/authoring.html`, its authoring page.
- **R2.** They are the same components as `interactive.html` and `demo.html` (`App` and `Demo`), told which page they are on by a `page` prop, `"markov"` (the default) or `"next-text-probability"`. Each page has its own few-line entry that mounts its component with its prop, and its own webpack page; nothing else is duplicated.
- **R3.** The existing pages are otherwise unchanged: `interactive.html` (hosted in every mode, and opened on its own), `demo.html` and `report-item.html` show no shared Next Text Probability header, footer, About or the new name (`demo.html` keeps its own title-only header, R6 and R10), and `interactive.html` and `report-item.html` keep their title, "Markov Interactive". Tests fail if any of the new parts appears. Links already made to `interactive.html` keep working.
- **R4.** `next-text-probability/index.html` always shows its own page, header and footer included, even inside another site's frame: hosts load `interactive.html`, so this page never waits for a host's init message.
- **R5.** The new pages load their scripts and styles from the build's `assets/` in the folder above. `authoring.html` shows the authoring form and one preview of the interactive at the full width of its column, both framing the one hosted interactive, `../interactive.html`, and its Standalone link opens `next-text-probability/index.html` with the form's settings. The preview starts without object storage, as that page has none, so it shows no Send to CODAP button. It has none of the Activity Player's views: no page width choice (Standard, iPad Friendly, Responsive), no teacher's view of a save, and no report item. Those stay on `demo.html`, where trying settings as they'd look in an activity still makes sense.
- **R6.** `demo.html` has no Standalone link: its header shows only its title, with no Copy, Open, link warnings or copy status. Its title, in the header and the browser tab, becomes "Demo Authoring", since it no longer builds standalone links; it stays out of the new name. It still frames the interactive in authoring, runtime and report modes for trying settings. The new authoring page is the only page that builds a standalone link.
- **R7.** The workspace keeps its size and behavior: `workspaceHeight`, the pane layout and the frame-height reporting are unchanged, and the header and footer sit around it.
- **R8.** The new pages' titles are in their HTML, so a link preview or a search result shows them before any script runs: "Next Text Probability" and "Next Text Probability | Authoring". `demo.html`'s, "Demo Authoring", is in its HTML too. `next-text-probability/index.html` alone also sets a device-width viewport, so phones lay it out at their own width, where the workspace stacks its panes; the other pages, which hosts frame or which are unsupported at phone width, keep the browser's default.

### Header

- **R9.** On `index.html`: a full-width bar at least 44 px tall (growing with its content), background #016082, white text, holding the graph icon (24 px, white strokes, decorative, from the mockup) and the name "Next Text Probability" as the page's `h1` (18 px bold), above the workspace at the top of the page.
- **R10.** On `authoring.html`: the same bar with the graph icon, then an `h1` that reads "Next Text Probability", a thin white divider (1 px, 50% opacity, decorative), and "Authoring" (16 px, regular weight). The Standalone link group (its label, Copy and Open, the long-link warnings and the copy status) sits at the header's right, unchanged in behavior apart from where its link points and its wording: nothing on the page mentions the Activity Player, which its users don't know. A long-link warning shows only a few words ("Long link: some sites may cut it short", or "Too long to open: shorten the starting text"), hidden from screen readers, and its full sentence goes to a polite live region, so a screen reader hears it when it appears while the author types in the authoring frame. The title stays on one line, so from 800 px wide up a warning never makes the header taller. Below 800 px, where the label alone fills the header, a long link's advice is left out (only screen readers hear it), but a refused link's warning stays, since it says why Copy and Open are off, and may make the header taller there. The label reads "Link to the interactive with these settings:" (in place of "Standalone link to use outside Activity Player:"), the group's accessible name "Link to the interactive", and the copy status "Link copied" or "The link couldn't be copied". `demo.html` keeps its own header (its 10 px padding and 20 px `h1`), now titled "Demo Authoring" and without the link group.
- **R11.** The authoring `h1`'s accessible name is "Next Text Probability | Authoring": the divider is drawn, and a screen reader hears the separator.

### Footer

- **R12.** Both new pages end with a footer row, right-aligned, 13 px Lato, text #595959, with a 1 px #c7c7c7 rule above it: `© {year} The Concord Consortium, Inc.` · `Terms of Use` · `About`, the dots decorative and hidden from screen readers.
- **R13.** `{year}` is the current year from the viewer's clock when the page renders.
- **R14.** The `index.html` footer alone also shows the full-color Concord logo, 22 px tall, before the copyright line, with empty alt text (the copyright line names Concord). The authoring footer has no logo.
- **R15.** "Terms of Use" is a link to https://concord.org/terms-of-use/ that opens in a new tab.
- **R16.** "About" is a button styled as a link (#177991, underlined), and opens the About dialog.
- **R17.** Placement: on `index.html` the footer sits at the bottom of the window when the window is taller than the header, workspace and footer, and directly after the workspace otherwise (the page then scrolls). On `authoring.html` it is the last row of the 100vh column, always in view, and the two columns give up its height.

### About dialog

- **R18.** A modal dialog titled "License & Terms of Use" (its accessible name, from its `h2`), on both new pages, laid out as the mockup: 560 px wide (never wider than the window less 16 px each side, scrolling inside when taller than the window), white, 1 px #c7c7c7 border, 3 px radius; a 32 px #eef3f5 title bar with the 14 px bold title and a 22 px × button named "Close" (1 px #177991 border); a body with the Concord logo 160 px wide, alt text "The Concord Consortium", then the copy, then the copyright line (13 px, #595959); a Close button at the bottom right (30 px tall, #dceff2 background, 1 px #177991 border); a dimmed backdrop.
- **R19.** The copy, word for word, with the bold lead-ins in bold and CODAP's curly apostrophe:
  > **Next Text Probability is free, open-source software.** The Next Text Probability source code is released under the MIT License, so you’re welcome to use, modify, and build on it.
  >
  > **Your use of Next Text Probability at models-resources.concord.org** is governed by our Terms of Use. The hosted version is free for non-commercial use; commercial use requires a separate written agreement. For more information, visit concord.org/licensing or contact licensing@concord.org.
  >
  > © {year} The Concord Consortium, Inc.
- **R20.** Links in the copy, underlined, #177991: "MIT License" → https://github.com/concord-consortium/markov-chain-plugin/blob/master/LICENSE; "Terms of Use" → https://concord.org/terms-of-use/; "concord.org/licensing" → https://concord.org/licensing; "licensing@concord.org" → `mailto:licensing@concord.org`.
- **R21.** New-tab links (R15, the first three of R20, and the authoring page's Open link) have `target="_blank"`, `rel="noopener noreferrer"`, and a visually hidden " (opens in a new tab)" in their accessible names. The mailto link opens in the same tab, with neither attribute and no hint.

### Keyboard and screen readers

- **R22.** Opening the dialog moves focus to the dialog itself, so reading starts at its title with no control focused, not to its first control, the × button; Tab and Shift+Tab stay among its controls (×, the four links, Close); Esc, × and Close each close it, and focus returns to the About button.
- **R23.** Esc that closes the dialog does nothing else: the workspace's own Escape handling (clearing the graph's chosen state or transition, ending a drawing tool) does not run, including the repeats of a held Escape that reach About once the dialog has closed; a new Escape press reaches the workspace as usual.
- **R24.** Every new link and button is reachable by Tab in reading order and shows a visible focus ring with at least 3:1 contrast against what is behind it.
- **R25.** The header is the page's banner and the footer its contentinfo landmark; on `index.html` the workspace, and on `authoring.html` the two columns, are in a `main` landmark between them. The icon, the divider and the dots are hidden from screen readers.
- **R26.** What this story adds repeats no element id, with the dialog open or closed. `index.html` draws the logo twice (footer and dialog), and the mockup's SVG defines `clip-0` to `clip-2`, so the logo the repo ships has no ids. (The workspace already repeats its arrow-marker ids, `arrow`, `loopArrow` and six more, on master; that is not this story's to fix.)

### Documentation

- **R27.** The README's "Markov Interactive" section lists the two new pages and what they are for. Its description of `demo.html` uses the page's new title, "Demo Authoring"; its "Opened on its own" paragraph, which says the demo page builds the standalone link, names the new authoring page and `next-text-probability/index.html` instead; its other descriptions of the existing pages stay as they are.

### Tests

- **R28.** Unit tests of the shared parts assert: the header's `h1` and its accessible name with and without "Authoring"; the footer's copyright line, in the footer and the dialog, under two different pinned clocks, as literal years; the Terms of Use link's href, target, rel and accessible name; that About opens the dialog named "License & Terms of Use", focused, with the logo; the copy word for word including the curly apostrophe and the two bold lead-ins; each link's literal href, target and rel (none on the mailto) and accessible name; Tab and Shift+Tab wrapping; closing by Esc, × and Close with focus back on About; and that an Escape that closes the dialog reaches no `keydown` listener on the document or the window. Tests that render `App` assert that `page="next-text-probability"` shows the header, the workspace in `main`, and the footer whose About opens the dialog, and still does inside a frame; and that the default page, opened on its own and hosted in each mode, and `report-item.html`, show none of it.
- **R29.** A unit test of the build's configuration asserts the new pages' titles against the name and separator the header uses, the existing pages' title, and that the new pages load assets from the folder above; a test of the logo file asserts it defines no ids (Jest replaces SVGs with a stub, so a rendered page can't show them).
- **R30.** A Cypress spec opens both new pages in the dev server and checks their titles, headers, footers and the About dialog as a real modal; that `authoring.html`'s frames load the interactive with no header or footer inside them; and that `authoring.html` has no page width choice or report item, previews at the full width of its column, shows no teacher's view after the interactive saves, and says nothing about the Activity Player; and that both pages have a rule above their footers. The existing demo spec's standalone link tests (the link and its settings, Copy and its status, the copy failures, the long-link warning, refusing a link too long to open, and opening it in Chrome) move to the new spec and run against `authoring.html`, with the link opening `next-text-probability/index.html`. The demo spec instead checks that `demo.html` has its title and no link controls or footer.

## Technical Notes

- **Pages and entry points**: `src/interactive/index.tsx` and `next-text-probability/index.tsx` mount `App` from `app.tsx` (`StandaloneApp`, `HostedApp`); `src/interactive/demo.tsx` defines `Demo`, mounted by `demo-index.tsx` (`demo.html`) and `next-text-probability/authoring.tsx`; `src/interactive/report-item.tsx`; `src/interactive/index.html`, the shared template, titled by each page's webpack `title`; `webpack.config.js`, one `entry` and one `HtmlWebpackPlugin` per page, with `publicPath: '.'`, or `'..'` for the pages in `next-text-probability/`.
- **Paths from a subfolder** (checked with a production build): with `publicPath: '..'`, `dist/next-text-probability/index.html` loads `../assets/next-text-probability.<hash>.js` and its CSS, which resolve on models-resources and in the dev server. `HtmlWebpackPlugin`'s `title` option fills `<%= htmlWebpackPlugin.options.title %>` in the template.
- **Inside a frame**: `App` takes the hosted branch whenever `inIframe()` is true. Cypress runs every page inside its own frame, so the first build of the new `index.html` sat at "Loading..." there, as it would in any site that embeds it; R4 comes from that run.
- **Shared parts**: the header, footer and dialog are imported by the `next-text-probability` and `next-text-probability-authoring` bundles, through `App` and `Demo`. They must not import the CODAP host or utilities (`import-boundary.test.ts`).
- **Existing dialog pattern**: `src/interactive/workspace/tables-dialog.tsx` uses a native `<dialog>` with `showModal()`, a `wrapTab` helper that keeps Tab inside the dialog, and an Escape `keydown` handler that calls `stopPropagation` because `use-mode-body.ts` (`useEscape`, on the document) and `components/drawing.tsx` (on the window) act on Escape. jsdom lacks `showModal`; `tables-dialog.test.tsx` polyfills it.
- **Native dialog focus in Chrome** (checked with a throwaway page): `showModal()` focuses the first focusable element inside, the × button in the title bar (checked again in Chrome 152 on the shipped dialog); Escape and `close()` both return focus to the element focused before `showModal()`. So R22's focus placement on open, and its return to About on close, are done by the code.
- **Escape**: a React `onKeyDown` on the dialog that calls `stopPropagation` keeps the event from the document and window listeners (checked with a throwaway Jest test).
- **SVGs**: every `.svg` imported from TypeScript becomes a React component through SVGR with svgo (viewBox kept, ids not minified); in Jest every `.svg` maps to `__mocks__/fileMock.js`.
- **Concord logo**: the mockup's logo is an SVG Kiley converted from her EPS files, 389.18 × 119.4, ten `path`s in three `clipPath`s, no `<text>`, no scripts or external references. Through the repo's SVGR settings it keeps the ids `clip-0` to `clip-2`, so two inline copies duplicate them (R26). The three clip paths are plain rectangles left over from the conversion: with them removed, the logo drawn 778 px wide differs in 60 anti-aliasing pixels out of about 239,000 inked ones and looks the same (checked in Chrome). `src/assets/concord-logo.svg` is the mockup's logo with its `<defs>` block and `clip-path` attributes deleted.
- **Graph icon**: the mockup's inline 24 × 24 SVG (three circles joined by three lines, white 2 px strokes). The repo has no icon like it.
- **Colors already in the repo**: #016082 (`$dark-teal` in `src/interactive/_dark-teal.scss`), #177991 (`$markov-teal` in `components/markov-panel.scss`), #c7c7c7 (`$pane-border-color` in `workspace.scss`), #eef3f5 (pane headers in `workspace.scss`). #595959 on white is 7:1; #177991 on white is 5.0:1.
- **Bundle size**: `App` and `Demo` import the header, footer, dialog and logo statically, so `interactive.*.js` and `demo.*.js` each grow by about 17 KB (7 KB gzipped) for parts only the new pages show. Accepted over loading them lazily.
- **Branch build for Kiley's review**: `https://models-resources.concord.org/markov-chain-plugin/branch/add-next-text-probability-header/next-text-probability/index.html` and `…/next-text-probability/authoring.html` (the deploy strips the Jira key from the branch name).
- **Release**: ships in Markov 0.6.0; MARK-35's PR merges before 0.6.0 is cut (MARK-4 owns the release).

### Differences from Kiley's mockup

The mockup (https://claude.ai/artifact/C5kWCXYbjVexZMH1MTBUfV, 11/13) predates the decision to use new pages and the new name. Where it and the Jira story differ, the story wins:

| Place | Mockup | This spec |
|---|---|---|
| Pages | The standalone `interactive.html` and `demo.html` | `next-text-probability/index.html` and `next-text-probability/authoring.html`; the existing pages unchanged apart from `demo.html` losing its Copy and Open |
| Header | "Markov Chain Interactive" | "Next Text Probability" |
| Authoring header | "Markov Chain Interactive" + divider + "Authoring" | "Next Text Probability" + divider + "Authoring" |
| Authoring page contents | The Activity Player page width choice and a "Report item, full answer" section, with a note that the preview is as the Activity Player shows it | The authoring form, the Standalone link and a full-width preview only; the width choice, teacher's view and report item stay on `demo.html` |
| Authoring link label | "Standalone link to use outside Activity Player:" | "Link to the interactive with these settings:", with no mention of the Activity Player anywhere on the page |
| Interactive page footer rule | Inset 10 px from each edge, inside the page's padding | The window's full width |
| Dialog paragraph 1 | "The Markov Chain interactive is free, open-source software. Its source code is released under…" | "Next Text Probability is free, open-source software. The Next Text Probability source code is released under…" (CODAP's wording) |
| Dialog paragraph 2 lead-in | "Your use of the Markov Chain interactive at models-resources.concord.org" | "Your use of Next Text Probability at models-resources.concord.org" |
| Apostrophe | "you're" (straight) | "you’re" (curly, as CODAP) |
| MIT License link | `…/markov-chain-plugin/blob/main/LICENSE` | `…/markov-chain-plugin/blob/master/LICENSE` (the default branch is `master`; LICENSE is MIT, "Copyright (c) 2018 Concord Consortium") |
| New-tab links | `rel="noopener"` | `rel="noopener noreferrer"` plus a visually hidden " (opens in a new tab)" |

## Out of Scope

- Serving `next-text-probability/` from a host of its own, such as next-text-probability.concord.org. The folder is not self-contained: its assets and the `interactive.html` the authoring page frames are in the folder above, so that story needs either a distribution over the whole version folder that maps `/` to the folder, or absolute paths as `index-top.html` uses. It also has to choose which version the host serves.
- Any change to `interactive.html`, `demo.html` or `report-item.html` as people see them, apart from `demo.html` losing its Standalone link (R6), and to the hosted interactive (Activity Player runtime, class dashboard view, LARA authoring).
- The CODAP plugin (`index.html`): it runs inside CODAP, whose About dialog already carries this statement.
- Renaming anything: the CODAP plugin, the package, existing UI strings and titles, the README's product names, the repo, the build's existing file names and the URLs.
- A third-party library acknowledgements list (a planned follow-on, as CLUE-804 is for CLUE).
- Usage tracking for commercial use, changes to the software license, and localizing the legal copy.
- Hiding the "Send to CODAP button" setting on the new authoring page. It is `interactive.html`'s own authoring form (R3), so it still offers the setting, which the standalone page can't show.

## Decisions

### Requirements

### New pages in their own folder instead of changing the existing pages
**Context**: The first spec put the header, footer and dialog on `interactive.html` and `demo.html`.
**Options considered**:
- A) Change the existing pages
- B) New pages in `next-text-probability/`, from the same components with a prop

**Decision**: B (Doug, 11/17). The name stays with the new pages, nothing anyone links to today changes, and the folder can later get its own host.

---

### Whether demo.html keeps its Standalone link
**Context**: With both authoring pages building links, one would make `interactive.html` links and the other `next-text-probability/index.html` links, with nothing saying which to use.
**Options considered**:
- A) Both keep it
- B) Only the new authoring page has it
- C) Both build links to the new page

**Decision**: B (Doug, 11/17): R6. Links already made to `interactive.html` keep working, and `demo.html` still serves for trying settings. The link's Cypress tests moved with it.

---

### The Activity Player's views on the new authoring page
**Context**: The page width choice, the teacher's view and the report item show the interactive as an activity would. The new page makes standalone links, which open at the browser's width.
**Options considered**:
- A) Keep them, as the mockup does
- B) Leave all three to `demo.html`

**Decision**: B (Doug, 11/17): R5.

---

### Activity Player wording on the new authoring page
**Context**: The page's users don't know what the Activity Player is, and the link label said "Standalone link to use outside Activity Player:".
**Options considered**:
- A) Keep the label
- B) Plain wording with no mention of the Activity Player

**Decision**: B (Doug, 11/17): R10. Both footers keep the rule the mockup draws (R12).

---

### demo.html's title
**Context**: "Demo and Standalone Authoring" describes a page that builds standalone links, which `demo.html` no longer does.
**Options considered**:
- A) Keep the title
- B) "Demo Authoring"

**Decision**: B (Doug, 11/17). The new name stays off the existing pages.

---

### The stream's link and apostrophe details over Jira's literal text
**Context**: Jira says `rel="noopener"` and types a straight apostrophe; CLUE-750 and the Geo apps use CODAP's curly apostrophe and `rel="noopener noreferrer"` with a visually hidden " (opens in a new tab)".
**Options considered**:
- A) The stream's
- B) Jira's literally

**Decision**: A (Doug, 11/17): R19 and R21.

---

### The new interactive page inside a frame
**Context**: `App` takes its hosted branch in any frame, so the first build sat at "Loading..." in Cypress, as it would in any site that embeds it.
**Options considered**:
- A) Act as a hosted interactive in any frame, as `interactive.html` does
- B) Always show its own page

**Decision**: B (R4). Hosts are given `interactive.html`.

---

### Titles in the HTML or set by the script
**Context**: Link previews and search results read the HTML title, and the new interactive page is the one collection pages link to.
**Options considered**:
- A) The template's "Markov Interactive", replaced by the script
- B) Each page's title written into its HTML by webpack

**Decision**: B (R8), with a unit test keeping the titles in agreement with the header's name and with `demoPageTitle`.

---

### Footer placement on the interactive page
**Context**: The workspace is a fixed 614 px tall, leaving blank space below it in a tall window.
**Options considered**:
- A) Directly after the workspace
- B) At the window's bottom when there is room, as the mockup draws it

**Decision**: B (R17).

---

### Copyright line inside the dialog
**Context**: Jira's exact copy has two paragraphs; the mockup adds a `© {year}` line under them.
**Options considered**:
- A) The two paragraphs only
- B) The paragraphs and the copyright line

**Decision**: B. Jira asks the pages to match the mockup, the line adds no wording of its own, and CODAP shows it too.

---

### The README
**Context**: The new pages are files a reader of the README's "Markov Interactive" section would not otherwise know about.
**Options considered**:
- A) List the two pages and say where the link is built, leaving the other descriptions alone
- B) Leave the README untouched

**Decision**: A (Doug, 11/17): R27.

---

### The long-link warning in the authoring header
**Context**: Seen locally after implementation (11/18), the long-link warning beside the link label wrapped "Next Text Probability" onto two lines and made the header taller.
**Options considered**:
- A) Leave it, since the warning is rare
- B) Shorten the warning and keep the title on one line
- C) Move the warning out of the header

**Decision**: B (Doug, 11/18): R10. The warning shows a few words, and its full sentence goes to a live region for screen readers. Below 800 px a long link's advice is left out, but a refused link's warning stays, since it explains the disabled Copy and Open (after review on the PR). Below about 550 px the authoring page scrolls sideways, which is unsupported (its form column alone is 435 px).

---

### Implementation

### What tells a component which page it is on
**Options considered**:
- A) A boolean such as `branded`
- B) `page: "markov" | "next-text-probability"`, defaulting to `"markov"`
- C) Reading the URL path at run time

**Decision**: B. It names the page rather than one of its features, and unlike C it can be tested by rendering with a prop.

---

### Where the shared page parts live
**Options considered**:
- A) `src/interactive/page/`, imported through `App` and `Demo`
- B) Inside `app.tsx` and `demo.tsx`
- C) Under `src/components/`, which the CODAP plugin shares

**Decision**: A. Both pages need the same parts, and the plugin has its About in CODAP.

---

### Native `<dialog>` or a library
**Options considered**:
- A) Native `<dialog>` with `showModal`, as `tables-dialog.tsx` does
- B) `react-modal`, as CLUE-750 used

**Decision**: A. The repo has the pattern and its test polyfill. The code sets initial focus on the dialog and returns focus to About itself, since Chrome focuses the × button on open and returns focus only to whatever was focused before it opened. The dialog has no `tabindex`, which the HTML standard doesn't allow on `<dialog>`: Chrome lets `focus()` reach it anyway (its own `autofocus` does not), and the unit tests' `showModal` stand-in makes it focusable as a browser does. `wrapTab` moved to its own module so both dialogs share it.

---

### How "no repeated id" is tested
**Options considered**:
- A) Count ids in a rendered page in Jest
- B) Test the shipped logo file
- C) A Cypress check

**Decision**: B. Jest replaces SVGs with a stub, so A could never see the logo's ids. The shipped logo has the mockup's three rectangular clip paths removed.

---

### Keeping Demo in demo.tsx
**Context**: Moving `Demo` to a new file showed in git as the whole file deleted and re-added.
**Decision**: `Demo` stays in `demo.tsx`; only its mounting moved to `demo-index.tsx`, so the diff is the change itself.

---

### The demo stylesheet's heading rules
**Context**: `.demo h1` and `.demo h2` had the same specificity as the shared header's `h1` and the dialog's `h2`, and `demo.scss` loads later, so they restyled both on the new authoring page.
**Decision**: The `h1` rule moved into `.demo-header` and the `h2` rule into `.demo-columns`; Cypress checks the 18 px and 20 px headings and the dialog title's margin.

---

### No object storage in the authoring preview
**Context**: The new page's link opens a page that is never hosted, so it can't show Send to CODAP, but the preview had the demo's object storage and showed the button.
**Decision**: `initInteractiveMessage` takes an `objectStorage` flag, and the new page's frames start without it; a Cypress test checks the preview.

---

### Bundle size
**Context**: `App` and `Demo` import the page parts statically, adding about 17 KB (7 KB gzipped) to `interactive.*.js` and `demo.*.js`.
**Decision**: Accepted over loading them lazily, which adds a loading state.

---

### One source for repeated values
**Context**: Review found "Demo Authoring" and the hidden " (opens in a new tab)" written in more than one place.
**Decision**: `demoPageTitle` (in `page-links.ts`, checked against `webpack.config.js` by the build test) and `newTabNote` (in `external-link.tsx`) are the single sources.
