# Next Text Probability pages, with a header, Terms of Use and license

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-35
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Mockup**: https://claude.ai/artifact/C5kWCXYbjVexZMH1MTBUfV (Kiley's Design canvas, 11/13)
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

The build gains a `next-text-probability/` folder with two pages: `index.html`, the interactive opened on its own, and `authoring.html`, its authoring page. Both are named **Next Text Probability**, with a header, and a footer whose About link opens a License & Terms of Use dialog. They are the same React components as `interactive.html` and `demo.html`, told by a prop which page they are on; the new authoring page leaves out the Activity Player's views (page widths, teacher's view, report item). The new authoring page is the only place that builds a standalone link, so `demo.html` loses its Copy and Open buttons; otherwise the existing pages, and the interactive inside an activity, in the class dashboard and as the report item, stay exactly as they are.

## Project Owner Overview

Concord's hosted apps (CODAP, CLUE and the Geo simulations) are all gaining the same statement: the software is free and open source under the MIT License, and the hosted version is free for non-commercial use under Concord's Terms of Use, with commercial use needing a separate agreement. This story brings that statement to the interactive, on the two pages people open on their own: the interactive that a collection page links to, and the authoring page used to try settings and build that link.

It does so on new pages, under the interactive's new public name, **Next Text Probability**, chosen by Rebecca Ellis with Kiley Brown (Slack, 11/11 to 11/16) because it is only a Markov chain when "Order matters" is on. The new pages live in a folder of their own, so the name stays with them and a later story can give them their own web address. The new authoring page builds links to the new interactive page, and it is now the only page that builds them: the current authoring page keeps working for trying settings but loses its Copy and Open buttons, so nobody has to choose between two kinds of link. The new authoring page shows just the authoring form, the link and a preview of the interactive; the views that only matter inside an activity (the Activity Player's page widths, the teacher's view and the report item) stay on the current page. Collection pages pick up the name and the statement from then on. Everything else that exists today keeps its name and looks the same: the CODAP plugin, the current interactive page and the links already made to it, and what students see inside an activity.

## Background

The repo builds two products: the CODAP plugin (`index.html`) and the Activity Player interactive (`interactive.html`, `report-item.html`, `demo.html`; README, "Markov Interactive"). Each page is an `HtmlWebpackPlugin` page in `webpack.config.js` with its own entry, from one shared HTML template (`src/interactive/index.html`, `<title>Markov Interactive</title>`), and each loads its scripts from the build's `assets/` folder (`publicPath: '.'`).

`interactive.html` (`src/interactive/index.tsx` mounting `App` from `app.tsx`) runs in one of two ways, chosen by `inIframe()`:

- **Hosted** (`HostedApp`): LARA or the Activity Player sends an init message, and the interactive shows the authoring form, the student's runtime, or the class dashboard's read-only report view.
- **Standalone** (`StandaloneApp`): opened directly, as a collection page links to it. It takes its settings from URL parameters (`url-settings.ts`), saves nothing, and since MARK-28 shows no note above the workspace. The workspace is a fixed 614 px tall (`pane-sizes.ts`, `workspaceHeight`) and full width; in a 1280 × 800 window it fills the top 614 px and leaves the rest blank.

`demo.html` (`src/interactive/demo.tsx`, which both defines `Demo` and mounts it) is the authoring page: a 100vh column with a teal (#016082) header holding the h1 "Demo and Standalone Authoring" (`pageTitle`, also its `document.title`) and the Standalone link's Copy and Open buttons, over two scrolling columns that frame `interactive.html` in authoring, runtime and report modes. Its Standalone link is `interactive.html` with the form's settings, beside the page.

Builds deploy with `aws s3 sync` of `dist/` (the s3-deploy-action), subfolders included, to `models-resources.concord.org/markov-chain-plugin/branch/<name>/` and `version/<tag>/`. The plugin's top-level `index.html` is the one page served from elsewhere: `index-top.html` is built with an absolute `publicPath` and the release workflow copies it up a level.

The other stories in the terms-of-use stream (CLUE-750, HURR-70, SE-4, TE-10, WM-67 and FM-5) settled shared details that this story's Jira text predates: CODAP's curly apostrophe in "you’re", `rel="noopener noreferrer"` with a visually hidden " (opens in a new tab)" on new-tab links as CODAP's `ExternalLink` does, the mailto link in the same tab, and tests that pin the clock to two different years. This spec follows them, as Doug confirmed (11/17).

### Where the inputs differ

The Jira description and AI instructions are the scope, with two changes Doug made after the first spec (11/17): the header, footer and dialog go on new pages in `next-text-probability/` instead of on `interactive.html` and `demo.html`, and `demo.html` loses its standalone link so the new authoring page is the only place that builds one. Both wait on an OK from Rebecca Ellis and Kiley Brown, after which the Jira story is updated. The Slack conversation (11/11 to 11/16) chose the name. Kiley's mockup predates both and differs in these places, to be listed for Kiley:

| Place | Mockup | This spec |
|---|---|---|
| Pages | The standalone `interactive.html` and `demo.html` | `next-text-probability/index.html` and `next-text-probability/authoring.html`; the existing pages unchanged apart from `demo.html` losing its Copy and Open |
| Header | "Markov Chain Interactive" | "Next Text Probability" |
| Authoring header | "Markov Chain Interactive" + divider + "Authoring" | "Next Text Probability" + divider + "Authoring" |
| Authoring page contents | The Activity Player page width choice and a "Report item, full answer" section, with a note that the preview is as the Activity Player shows it | The authoring form, the Standalone link and a full-width preview only; the width choice, teacher's view and report item stay on `demo.html` |
| Authoring link label | "Standalone link to use outside Activity Player:" | "Link to the interactive with these settings:", with no mention of the Activity Player anywhere on the page |
| Authoring footer | A 1 px #c7c7c7 rule above the footer | No rule (Doug, 11/17); the interactive page keeps its rule |
| Interactive page footer rule | Inset 10 px from each edge, inside the page's padding | The window's full width |
| Dialog paragraph 1 | "The Markov Chain interactive is free, open-source software. Its source code is released under…" | "Next Text Probability is free, open-source software. The Next Text Probability source code is released under…" (CODAP's wording) |
| Dialog paragraph 2 lead-in | "Your use of the Markov Chain interactive at models-resources.concord.org" | "Your use of Next Text Probability at models-resources.concord.org" |
| Apostrophe | "you're" (straight) | "you’re" (curly, as CODAP) |
| MIT License link | `…/markov-chain-plugin/blob/main/LICENSE` | `…/markov-chain-plugin/blob/master/LICENSE` (the default branch is `master`; LICENSE is MIT, "Copyright (c) 2018 Concord Consortium") |
| New-tab links | `rel="noopener"` | `rel="noopener noreferrer"` plus a visually hidden " (opens in a new tab)" |

The mockup's open question about the host is settled by the repo: every build the repo deploys is on models-resources.concord.org (README, "Deployment") and no other host serves it, so the copy names that host.

## Requirements

### The pages

- **R1.** The build writes two new pages: `next-text-probability/index.html`, the interactive opened on its own, and `next-text-probability/authoring.html`, its authoring page.
- **R2.** They are the same components as `interactive.html` and `demo.html` (`App` and `Demo`), told which page they are on by a `page` prop, `"markov"` (the default) or `"next-text-probability"`. Each page has its own few-line entry that mounts its component with its prop, and its own webpack page; nothing else is duplicated.
- **R3.** The existing pages are otherwise unchanged: `interactive.html` (hosted in every mode, and opened on its own), `demo.html` and `report-item.html` show no header, footer, About or the new name, and `interactive.html` and `report-item.html` keep their title, "Markov Interactive". Tests fail if any of the new parts appears. Links already made to `interactive.html` keep working.
- **R4.** `next-text-probability/index.html` always shows its own page, header and footer included, even inside another site's frame: hosts load `interactive.html`, so this page never waits for a host's init message.
- **R5.** The new pages load their scripts and styles from the build's `assets/` in the folder above. `authoring.html` shows the authoring form and one preview of the interactive at the full width of its column, both framing the one hosted interactive, `../interactive.html`, and its Standalone link opens `next-text-probability/index.html` with the form's settings. The preview starts without object storage, as that page has none, so it shows no Send to CODAP button. It has none of the Activity Player's views: no page width choice (Standard, iPad Friendly, Responsive), no teacher's view of a save, and no report item. Those stay on `demo.html`, where trying settings as they'd look in an activity still makes sense.
- **R6.** `demo.html` has no Standalone link: its header shows only its title, with no Copy, Open, link warnings or copy status. Its title, in the header and the browser tab, becomes "Demo Authoring", since it no longer builds standalone links; it stays out of the new name. It still frames the interactive in authoring, runtime and report modes for trying settings. The new authoring page is the only page that builds a standalone link.
- **R7.** The workspace keeps its size and behavior: `workspaceHeight`, the pane layout and the frame-height reporting are unchanged, and the header and footer sit around it.
- **R8.** The new pages' titles are in their HTML, so a link preview or a search result shows them before any script runs: "Next Text Probability" and "Next Text Probability | Authoring". `demo.html`'s, "Demo Authoring", is in its HTML too.

### Header

- **R9.** On `index.html`: a full-width bar at least 44 px tall (growing with its content), background #016082, white text, holding the graph icon (24 px, white strokes, decorative, from the mockup) and the name "Next Text Probability" as the page's `h1` (18 px bold), above the workspace at the top of the page.
- **R10.** On `authoring.html`: the same bar with the graph icon, then an `h1` that reads "Next Text Probability", a thin white divider (1 px, 50% opacity, decorative), and "Authoring" (16 px, regular weight). The Standalone link group (its label, Copy and Open, the long-link warnings and the copy status) sits at the header's right, unchanged in behavior apart from where its link points and its wording: nothing on the page mentions the Activity Player, which its users don't know. A long-link warning shows only a few words ("Long link: some sites may cut it short", or "Too long to open: shorten the starting text") and gives screen readers its full sentence, and the title stays on one line, so a warning never makes the header taller; below 800 px wide, where the label alone fills the header, the words are left out and only screen readers hear the warning. The label reads "Link to the interactive with these settings:" (in place of "Standalone link to use outside Activity Player:"), the group's accessible name "Link to the interactive", and the copy status "Link copied" or "The link couldn't be copied". `demo.html` keeps its own header (its 10 px padding and 20 px `h1`), now titled "Demo Authoring" and without the link group.
- **R11.** The authoring `h1`'s accessible name is "Next Text Probability | Authoring": the divider is drawn, and a screen reader hears the separator.

### Footer

- **R12.** Both new pages end with a footer row, right-aligned, 13 px Lato, text #595959, with a 1 px #c7c7c7 rule above it on `index.html` and none on `authoring.html`: `© {year} The Concord Consortium, Inc.` · `Terms of Use` · `About`, the dots decorative and hidden from screen readers.
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

- **R22.** Opening the dialog moves focus to the dialog itself, so its title is announced, not to the first link in the copy; Tab and Shift+Tab stay among its controls (×, the four links, Close); Esc, × and Close each close it, and focus returns to the About button.
- **R23.** Esc that closes the dialog does nothing else: the workspace's own Escape handling (clearing the graph's chosen state or transition, ending a drawing tool) does not run.
- **R24.** Every new link and button is reachable by Tab in reading order and shows a visible focus ring with at least 3:1 contrast against what is behind it.
- **R25.** The header is the page's banner and the footer its contentinfo landmark; on `index.html` the workspace, and on `authoring.html` the two columns, are in a `main` landmark between them. The icon, the divider and the dots are hidden from screen readers.
- **R26.** What this story adds repeats no element id, with the dialog open or closed. `index.html` draws the logo twice (footer and dialog), and the mockup's SVG defines `clip-0` to `clip-2`, so the logo the repo ships has no ids. (The workspace already repeats its arrow-marker ids, `arrow`, `loopArrow` and six more, on master; that is not this story's to fix.)

### Documentation

- **R27.** The README's "Markov Interactive" section lists the two new pages and what they are for. Its description of `demo.html` uses the page's new title, "Demo Authoring"; its "Opened on its own" paragraph, which says the demo page builds the standalone link, names the new authoring page and `next-text-probability/index.html` instead; its other descriptions of the existing pages stay as they are.

### Tests

- **R28.** Unit tests of the shared parts assert: the header's `h1` and its accessible name with and without "Authoring"; the footer's copyright line, in the footer and the dialog, under two different pinned clocks, as literal years; the Terms of Use link's href, target, rel and accessible name; that About opens the dialog named "License & Terms of Use", focused, with the logo; the copy word for word including the curly apostrophe and the two bold lead-ins; each link's literal href, target and rel (none on the mailto) and accessible name; Tab and Shift+Tab wrapping; closing by Esc, × and Close with focus back on About; and that an Escape that closes the dialog reaches no `keydown` listener on the document or the window. Tests that render `App` assert that `page="next-text-probability"` shows the header, the workspace in `main`, and the footer whose About opens the dialog, and still does inside a frame; and that the default page, opened on its own and hosted in each mode, and `report-item.html`, show none of it.
- **R29.** A unit test of the build's configuration asserts the new pages' titles against the name and separator the header uses, the existing pages' title, and that the new pages load assets from the folder above; a test of the logo file asserts it defines no ids (Jest replaces SVGs with a stub, so a rendered page can't show them).
- **R30.** A Cypress spec opens both new pages in the dev server and checks their titles, headers, footers and the About dialog as a real modal; that `authoring.html`'s frames load the interactive with no header or footer inside them; and that `authoring.html` has no page width choice or report item, previews at the full width of its column, shows no teacher's view after the interactive saves, says nothing about the Activity Player, and has no rule above its footer while `index.html` has one. The existing demo spec's standalone link tests (the link and its settings, Copy and its status, the copy failures, the long-link warning, refusing a link too long to open, and opening it in Chrome) move to the new spec and run against `authoring.html`, with the link opening `next-text-probability/index.html`. The demo spec instead checks that `demo.html` has its title and no link controls or footer.

## Technical Notes

- **Pages and entry points**: `src/interactive/index.tsx` mounts `App` from `app.tsx` (`StandaloneApp`, `HostedApp`); `src/interactive/demo.tsx` defines `Demo` and mounts it at the bottom (`document.title = pageTitle; createRoot(…)`); `src/interactive/report-item.tsx`; `src/interactive/index.html`, the shared template; `webpack.config.js`, one `entry` and one `HtmlWebpackPlugin` per page, each with `publicPath: '.'`.
- **Paths from a subfolder** (checked with a production build): with `publicPath: '..'`, `dist/next-text-probability/index.html` loads `../assets/next-text-probability.<hash>.js` and its CSS, which resolve on models-resources and in the dev server. `HtmlWebpackPlugin`'s `title` option fills `<%= htmlWebpackPlugin.options.title %>` in the template.
- **Inside a frame**: `App` takes the hosted branch whenever `inIframe()` is true. Cypress runs every page inside its own frame, so the first build of the new `index.html` sat at "Loading..." there, as it would in any site that embeds it; R4 comes from that run.
- **Shared parts**: the header, footer and dialog are imported by the `next-text-probability` and `next-text-probability-authoring` bundles, through `App` and `Demo`. They must not import the CODAP host or utilities (`import-boundary.test.ts`).
- **Existing dialog pattern**: `src/interactive/workspace/tables-dialog.tsx` uses a native `<dialog>` with `showModal()`, a `wrapTab` helper that keeps Tab inside the dialog, and an Escape `keydown` handler that calls `stopPropagation` because `use-mode-body.ts` (`useEscape`, on the document) and `components/drawing.tsx` (on the window) act on Escape. jsdom lacks `showModal`; `tables-dialog.test.tsx` polyfills it.
- **Native dialog focus in Chrome** (checked with a throwaway page): `showModal()` focuses the first focusable element inside, here the "MIT License" link in the middle of paragraph 1; Escape returned focus to the opener, but `close()` from a click handler left focus on the body. So R22's focus placement on open and return on close are done by the code.
- **Escape**: a React `onKeyDown` on the dialog that calls `stopPropagation` keeps the event from the document and window listeners (checked with a throwaway Jest test).
- **SVGs**: every `.svg` imported from TypeScript becomes a React component through SVGR with svgo (viewBox kept, ids not minified); in Jest every `.svg` maps to `__mocks__/fileMock.js`.
- **Concord logo**: the mockup's logo is an SVG Kiley converted from her EPS files, 389.18 × 119.4, ten `path`s in three `clipPath`s, no `<text>`, no scripts or external references. Through the repo's SVGR settings it keeps the ids `clip-0` to `clip-2`, so two inline copies duplicate them (R26). The three clip paths are plain rectangles left over from the conversion: with them removed, the logo drawn 778 px wide differs in 60 anti-aliasing pixels out of about 239,000 inked ones and looks the same (checked in Chrome). The implementation step says how that copy is made.
- **Graph icon**: the mockup's inline 24 × 24 SVG (three circles joined by three lines, white 2 px strokes). The repo has no icon like it.
- **Colors already in the repo**: #016082 (`$teal` in `demo.scss`), #177991 (`$markov-teal` in `components/markov-panel.scss`), #c7c7c7 (`$pane-border-color` in `workspace.scss`), #eef3f5 (pane headers in `workspace.scss`). #595959 on white is 7:1; #177991 on white is 5.0:1.
- **Bundle size**: `App` and `Demo` import the header, footer, dialog and logo statically, so `interactive.*.js` and `demo.*.js` each grow by about 17 KB (7 KB gzipped) for parts only the new pages show. Accepted over loading them lazily.
- **Branch build for Kiley's review**: `https://models-resources.concord.org/markov-chain-plugin/branch/add-next-text-probability-header/next-text-probability/index.html` and `…/next-text-probability/authoring.html` (the deploy strips the Jira key from the branch name).
- **Release**: ships in Markov 0.6.0; MARK-35's PR merges before 0.6.0 is cut (MARK-4 owns the release).

## Out of Scope

- Serving `next-text-probability/` from a host of its own, such as next-text-probability.concord.org. The folder is not self-contained: its assets and the `interactive.html` the authoring page frames are in the folder above, so that story needs either a distribution over the whole version folder that maps `/` to the folder, or absolute paths as `index-top.html` uses. It also has to choose which version the host serves.
- Any change to `interactive.html`, `demo.html` or `report-item.html` as people see them, apart from `demo.html` losing its Standalone link (R6), and to the hosted interactive (Activity Player runtime, class dashboard view, LARA authoring).
- The CODAP plugin (`index.html`): it runs inside CODAP, whose About dialog already carries this statement.
- Renaming anything: the CODAP plugin, the package, existing UI strings and titles, the README's product names, the repo, the build's existing file names and the URLs.
- A third-party library acknowledgements list (a planned follow-on, as CLUE-804 is for CLUE).
- Usage tracking for commercial use, changes to the software license, and localizing the legal copy.
- Hiding the "Send to CODAP button" setting on the new authoring page. It is `interactive.html`'s own authoring form (R3), so it still offers the setting, which the standalone page can't show.

## Open Questions

### RESOLVED: New pages in their own folder instead of changing the existing pages
**Context**: The first spec put the header, footer and dialog on `interactive.html` and `demo.html`.
**Options considered**: A) change the existing pages; B) new pages in `next-text-probability/`, from the same components with a prop, the existing pages unchanged.
**Decision**: B (Doug, 11/17). The name stays with the new pages, nothing anyone links to today changes, and the folder can later get its own host. This replaces the earlier tab-title answer: the new pages carry the new titles and the existing pages keep theirs.

### RESOLVED: Whether demo.html keeps its Standalone link
**Context**: With both authoring pages building links, one would make `interactive.html` links and the other `next-text-probability/index.html` links, with nothing on either saying which to use.
**Options considered**: A) both keep it; B) only the new authoring page has it; C) both build links to the new page.
**Decision**: B (Doug, 11/17): R6. Links already made to `interactive.html` keep working, and `demo.html` still serves for trying settings.

### RESOLVED: The Activity Player's views on the new authoring page
**Context**: The page width choice, the teacher's view and the report item show the interactive as an activity in the Activity Player would. The new authoring page is for making standalone links, which open the interactive on its own, at the browser's width.
**Options considered**: A) keep them, as the mockup's authoring board does; B) drop all three from the new page and keep them on `demo.html`.
**Decision**: B (Doug, 11/17): R5. A difference from the mockup, listed for Kiley.

### RESOLVED: Activity Player wording and the footer rule on the new authoring page
**Context**: The new authoring page's users don't know what the Activity Player is, and the link label said "Standalone link to use outside Activity Player:". The mockup draws a rule above the authoring page's footer.
**Options considered**: A) keep the label and the rule; B) plain wording with no mention of the Activity Player, and no rule above the authoring footer.
**Decision**: B (Doug, 11/17): R10 and R12. The interactive page's footer keeps its rule.

### RESOLVED: demo.html's title
**Context**: "Demo and Standalone Authoring" describes a page that builds standalone links, which `demo.html` no longer does (R6).
**Options considered**: A) keep the title; B) "Demo Authoring".
**Decision**: B (Doug, 11/17). The new name stays off the existing pages.

### RESOLVED: The stream's link and apostrophe details over Jira's literal text
**Context**: Jira says `rel="noopener"` and types a straight apostrophe; CLUE-750 and the Geo apps use CODAP's curly apostrophe and `rel="noopener noreferrer"` with a visually hidden " (opens in a new tab)".
**Options considered**: A) the stream's; B) Jira's literally.
**Decision**: A (Doug, 11/17): R19 and R21 as written.

### RESOLVED: Judgment call: the new interactive page inside a frame
**Options considered**: A) as `interactive.html` does, act as a hosted interactive in any frame (and wait for an init message); B) always show its own page.
**Decision**: B (R4). Hosts are given `interactive.html`; a site that embeds the new page in a plain frame would otherwise show "Loading..." forever, as the first build did in Cypress.

### RESOLVED: Judgment call: titles in the HTML or set by the script
**Options considered**: A) the shared template's "Markov Interactive", replaced by the script once it runs; B) each page's title written into its HTML by webpack.
**Decision**: B (R8). Link previews and search results read the HTML, and the new interactive page is the one collection pages link to. A unit test keeps the titles in agreement with the header's name (R29).

### RESOLVED: Judgment call: footer at the window's bottom or right under the workspace
**Options considered**: A) directly after the workspace, leaving blank space below it; B) at the window's bottom when there is room, as the mockup draws it.
**Decision**: B, matching the mockup (R17). On a short window both are the same.

### RESOLVED: Judgment call: copyright line inside the dialog
**Options considered**: A) the two paragraphs only, as Jira's "Exact copy"; B) the two paragraphs and the mockup's `© {year}` line under them.
**Decision**: B. Jira's done-when asks the pages to match the mockup, and the line adds no wording of its own. CODAP shows the copyright in its dialog too.

### RESOLVED: The README
**Context**: Doug's scope keeps the README's names as they are. The new pages are new files a reader of the README's "Markov Interactive" section would not otherwise know about, and the Standalone link on the new authoring page now points into the folder.
**Options considered**:
- A) Add the two pages to the section's list, naming the folder and the product, and leave the existing descriptions as they are (R27).
- B) Leave the README untouched in this story.

**Decision**: A (Doug, 11/17): R27 as written.

## Self-Review

Roles: WCAG accessibility expert, QA engineer, senior engineer, Kiley as acceptance reviewer against the mockup, and a scope reviewer for the name. Each finding below was checked in the code or by running something before it was written here.

### WCAG Accessibility Expert

#### RESOLVED: Escape in the dialog would also reach the workspace
`use-mode-body.ts` (`useEscape`) listens for Escape on the document and `components/drawing.tsx` on the window; both clear the graph's choice or end a drawing tool. An Escape meant to close the About dialog would do that too. R23 says it must not, and a throwaway Jest test confirmed a React `stopPropagation` on the dialog keeps the event from both.

### QA Engineer

#### RESOLVED: "the graph's selection is left alone" could not be tested as stated
The interactive's unit tests mock the graph (Jest can't load d3), so there is nothing to observe. R28 asserts what R23 depends on instead: no `keydown` listener on the document or the window hears an Escape that closes the dialog.

#### RESOLVED: the new interactive page showed "Loading..." in Cypress
Cypress runs each page inside a frame, so `App` took its hosted branch and waited for a host. A site embedding the page would see the same. R4 now says the page always shows itself, and R28 tests it in a frame.

### Senior Engineer

#### RESOLVED: the logo's clip-path ids repeat on the new interactive page
The repo's SVGR and svgo settings keep the logo's `clip-0` to `clip-2` ids (checked by running the logo through them), and `index.html` draws the logo in the footer and in the dialog. R26 says no id repeats, and R29 tests the shipped file.

#### RESOLVED: the pages' titles would show the old name until the script runs
The shared template's `<title>` is "Markov Interactive", which link previews and search results read. R8 puts each new page's title in its HTML.

### Kiley (acceptance against the mockup)

#### RESOLVED: the authoring h1's size
The existing demo header's `h1` is 20 px; the mockup draws 18 px bold. R10 gives the new header 18 px and leaves `demo.html`'s at 20 px.

### Scope reviewer

#### RESOLVED: Background named a local planning document
Background pointed at a file on one machine for the stream's shared details, which no reader of the repo can open. It now names the stories that share them.
