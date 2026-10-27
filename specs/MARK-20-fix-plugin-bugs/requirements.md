# Fix the Markov plugin bugs found by the code review

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-20
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Fix the eleven defects that the MARK-7 code review and the MARK-5 runtime check marked **Fix**: two crashes, a Reset that empties the graph in dataset mode, a script-injection hole in label measuring, wrong arrow widths and arrowheads, an unsorted Starting State list, a Max Length that accepts 0, a redundant dataset request on every Play, and sequence numbers that restart after a reopen. Each fix lands as its own commit with a unit test that fails without it.

## Project Owner Overview

The Markov plugin is used in the "SY25-26: AI Text Generation for ELA" module, which loads the plugin's top-level address, so every release reaches its students. A code review (MARK-7) and a run of the released plugin in CODAP 3.1.2 with the five ELA documents (MARK-5) found a set of bugs. Typing the word "constructor" blanks the plugin; dataset mode crashes on missing or numeric values; arrow widths look the same in any real drawing, and saving a state in the state editor makes its arrows thick and every other arrow thin; the Starting State list was never sorted; Max Length accepts 0; Reset in Use Data mode leaves the graph empty; and output sequence numbers restart at 0 after a document is reopened.

Rebecca confirmed every visible change on 2026-10-27: the sorted Starting State list, per-state arrow widths from 2 to 4.5 px with arrowheads sized to their lines (Option B with scaled heads), the state editor no longer changing other states' arrows, continued sequence numbers, Max Length's minimum of 1, and the numeric-attribute fix. Reset in Use Data mode was added on 2026-10-27 by Doug; it changes only dataset mode, which ELA doesn't use. Nothing else about how the ELA documents load, restore, draw or generate changes, and the saved document format is untouched.

## Background

The scope comes from one document, `plugin-bugs.md` in the stream's oob folder (`~/oob/global/streams/markov-chain-fy27/`). It combines MARK-7's findings (`mark-7-findings.md`) and MARK-5's results (`mark-5-results.md`) and gives each a status. This story covers exactly the rows marked **Fix**: 1, 2 (with 2b), 3B, 3A, 3C, 4, 8, 9, 11, M3 and 7a. Row 8 was first routed to MARK-12, then moved here on 2026-10-27 (channel #1278), because MARK-12 changes only when Reset requests its fit, not what Reset restores. Its Constraints section applies throughout. The numbers below are that document's row numbers, kept so the commits, the tests and the review can be traced back to it.

This branch, `MARK-20-fix-plugin-bugs`, is cut from MARK-6's branch (`MARK-6-deploy-and-release`, PR #81, in review). MARK-6 changes only docs and `src/hooks/use-codap.ts` (it reads `PluginVersion` from `package.json`), which moves that file's lines down by one against master. Every file and line reference here was checked on this branch; where `plugin-bugs.md` cites master's line in `use-codap.ts`, this spec gives the branch's.

MARK-8 (build and test tooling: Jest 30, TypeScript 6, Node 24) will be rebased onto this story afterward. Its spec is written against a base with no tests, so this story keeps its footprint small: tests import only new pure modules, and nothing changes in packages, the Jest config, `tsconfig.json` or `src/global.d.ts` (MARK-8's channel note #1271).

The plugin has no unit tests today. Jest 28 is configured (`package.json` `jest` block, jsdom, ts-jest), and a throwaway test written for this spec ran under it on this branch (Node 20): a `.ts` test file under `src/` with no imports from components passes. These are the first tests in the repo.

The reviewer is Maureen E. Zitouni (Mau), who is new to the repo, so the PR is one small commit per bug, each readable on its own.

## Requirements

### General

- **G1. One commit per fix, in this order:** 1, 2, 3B, 3A, 3C, 4, 8, 9, 11, M3, 7a. Each commit builds, lints and passes the tests on its own. M3 lands before 7a, which uses M3's existence check, and 8 lands after 2, whose graph builder it reuses.
- **G2. Each commit adds a Jest test that fails without its fix.** The test exercises the code the plugin actually runs: the logic moves into a new module, and the component or hook keeps only a one-line call into it, so there is nothing left at the call site that a test would need to cover. Where a commit also changes a call site that no Jest test can reach (a component that imports `.scss`, d3 or nanoid), the done condition's manual check covers it.
- **G3. Tests import only new pure modules.** A new module imports none of `.scss`, d3, nanoid or `utils/codap-interface` (which pulls in iframe-phone). Code that talks to CODAP takes the request function as a parameter, so a test passes a mock. Tests use no Jest 28-only APIs and no `@testing-library/react-hooks`; jsdom is used only where a DOM is needed.
- **G4. No new packages, and no change to the Jest config, `tsconfig.json` or `src/global.d.ts`.**
- **G5. The saved state is unchanged.** Drawing mode still saves `{viewMode, nodes, edges, version: 2}` and dataset mode `{attribute, viewMode}` (`hooks/use-codap.ts:50-67`); no fix bumps the version.
- **G6. Done when** every test passes, `npm run build` passes with `lint:build` still at its 21 `no-console` warnings (moved `console.log` calls stay, new code adds none), `npm run lint` is clean, and the five ELA documents load, restore and generate as before in `https://codap.concord.org/app/`, apart from the visible changes listed below. The manual check also draws a state with a loop (no ELA document has one), adds a loop to a state with no other outgoing arrow and then deletes it, selects a state and plays a sequence (no large black heads on the click targets), saves a state in the state editor, plays with Max Length 0, opens the Starting State list, and in dataset mode drops a numeric attribute and an attribute with empty cells from a sample dataset (Mammals has both), then presses Reset.

### 1. "constructor" in Create From Text crashes the plugin

- **R1.1** Words and transitions typed into Create From Text are counted in objects with no prototype, so a word that is an `Object.prototype` property name ("constructor" is the only one that survives lowercasing and the parser's punctuation stripping) becomes an ordinary state.
- **R1.2** The order of states is unchanged: words that are canonical integers (`2`, `10`, but not `01` or `-1`) still come first in ascending numeric order, then the other words in the order they first appear. That is how a JavaScript object orders its keys, and it is why the fix is not a `Map`, which keeps insertion order.
- **R1.3** Test: parsing `the constructor built the house` gives four states, `constructor` with count 1 and the right transitions; parsing `go 10 then 2` gives the states in the order `2, 10, go, then`.
- **Visible:** no, except that the crash is gone.

### 2. Missing or non-text values crash dataset mode (with 2b)

- **R2.1** Every value read for the dropped attribute becomes a string: `undefined` and `null` become `""` (a break in the chain, like an empty cell today), and numbers, booleans and anything else go through `String()`. No state ever has an undefined label, and numeric attributes give string labels, so the Starting State sort can no longer meet a number from dataset mode.
- **R2.2 (2b)** When the values request is rejected (a timeout or a closed connection), the plugin keeps its current graph and does not throw. A reply with `success: false` still gives no values, as today.
- **R2.3** Nothing else changes: no "attribute not found" message and no rename tracking.
- **R2.4** Test: values `["a", undefined, "b", null, "", 3, "a", 3]` give states `a`, `b`, `3` with no undefined label, no transition across the `undefined`, `null` or `""`, and `3` as the string `"3"`; with the request mocked to reject, the result says "no update" instead of throwing; with `success: false`, the result is an empty list.
- **Visible:** dataset mode only, which ELA doesn't use: attributes with missing or numeric values stop blanking the plugin.

### 3B. The state editor saves values 100 times too large

- **R3B.1** Saving in a state's editor sets each outgoing value to `sum * percentage / 100`, so the state's total is kept and only its ratios change.
- **R3B.2** Documents already saved with inflated values are left as they are. Generation never depended on the scale, and after 3A their widths draw correctly too.
- **R3B.3** Test: saving `[1, 1, 1]` with its unchanged percentages gives values within floating-point tolerance of `[1, 1, 1]` (an exact comparison fails even after the fix, since the percentages are thirds); saving `[1, 3]` with percentages `[50, 50]` gives `[2, 2]`; edges from other states are returned unchanged.
- **Visible:** yes. Today every Save multiplies that state's outgoing values by 100 (even a Save that only renames, and repeated Saves compound), so its arrows draw thick and all others thin. After the fix its arrows keep their widths.

### 3A. Arrow widths are a share of the whole graph

- **R3A.1** Each arrow's width (loops included) is `minStroke + (maxStroke - minStroke) * value / stateTotal`, where `stateTotal` is the sum of its own state's outgoing values, loops included. A state's widths show its own probabilities and never depend on other states.
- **R3A.2** `maxStroke` drops from 7 to 4.5 px; `minStroke` stays 2 (Option B). There is no special case for a state's single outgoing arrow: it is 100% and draws at 4.5 px.
- **R3A.3** A state whose outgoing total is 0 draws its arrows at `minStroke`, never `NaN`.
- **R3A.4** Node sizes keep today's whole-graph share.
- **R3A.5** Adding or deleting a loop redraws the graph even when no other arrow's width changes. `Graph` redraws only when its graph signature changes (`graph.tsx:200-204`), and the signature lists each node's id, label, value, radius and position and each non-loop edge's width, but not the loop's width. Today adding or deleting a loop changes the whole-graph total, so every other arrow's width changes and the graph redraws; with per-state widths, a loop on a state with no other outgoing arrow changes no listed value, so the new loop never appears and a deleted one stays drawn. The signature includes each node's loop width.
- **R3A.6** Test: outgoing values `[1, 1]` from one state and `[10, 10]` from another give four equal widths; `[1, 3]` gives widths 2.625 and 3.875 (the second's share above `minStroke` is three times the first's); a loop counts as one of its state's outgoing arrows; changing one state's values changes no other state's widths; a state with all-zero values gives `minStroke`; adding a loop to a state with no other outgoing arrow changes the graph signature.
- **Visible:** yes, in every drawing, ELA included, and in dataset mode: widths run from 2 to 4.5 px (`arrow-widths-preview-5.html`, Option B).

### 3C. Arrowheads don't scale with their line

- **R3C.1** Every arrowhead marker uses `markerUnits="strokeWidth"`, so a head scales with its line: the notched path `M 0 0 4 2 0 4 1 2 0 0`, `refX` 1 (the notch), `refY` 2, `markerWidth` and `markerHeight` 4, `orient` auto, filled with no outline stroke. That is about 8 px long on a 2 px line and 18 px on a 4.5 px line. All eight markers (`arrow`, `loopArrow`, `animatedArrow`, `incomingArrow`, `outgoingArrow`, `selectedLoopArrow`, `unselectedArrow`, `unselectedLoopArrow`) keep their colors and opacities.
- **R3C.2** Each visible edge line ends 3 line widths (notch to tip) short of where it meets the target state's outline, so the head's tip touches the outline. The pull-back never makes a line shorter than 1 px, and a line already 1 px or shorter is left as it is. The transparent click targets (`line.edge-background`) keep their full length.
- **R3C.3** A loop's arc ends where its circle crosses back over its state's outline, at the angle `2 * PI - acos(2 / 3)` (today it ends at `1.75 * PI`, slightly inside the outline), and the drawn loop then ends early by the angle that puts its head's tip, 3 line widths along the arc's tangent from the loop's end, on the outline. (An angle of 3 line widths divided by the loop circle's radius, the arc length, overshoots: the tangent cuts the curve short, by up to 6.5 px on the smallest state with a full-width loop.) The loop's transparent click target and the ghost loop keep the untrimmed arc.
- **R3C.4** Only edge lines (`line.edge`) get a `marker-end`. The selected-state highlight (`graph.tsx:302`, `:308`, `:317`) and the animation reset (`:839`) select `line.edge` instead of every `line`; otherwise the 15 px click targets draw 60-unit heads.
- **R3C.5** Test: an edge's line end is pulled back along the edge by 3 times its width; a wider line is pulled back proportionally further; a line shorter than its pull-back keeps 1 px; an untrimmed loop ends on its state's outline; and the tip of a trimmed loop's head lies on its state's outline for small and large states and thin and full-width loops.
- **Visible:** yes, in every drawing: heads grow with their lines (`arrow-widths-final-option-b.png`). The rubberband line drawn while adding an edge (2 px) and the dashed ghost loop (1 px) also get heads sized to their lines, about 8 px and 4 px.

### 4. The Starting State list is never sorted

- **R4.1** The Starting State list is sorted by `String(a.label).localeCompare(String(b.label), undefined, {numeric: true})`: alphabetical, punctuation first, "State 2" before "State 10", and numeric labels in numeric order. The comparator never throws on a non-string label.
- **R4.2** Test: `["zebra", "apple", "mango"]` sorts to `apple, mango, zebra`; `["State 10", "State 2"]` and `[10, 2]` sort with 2 first, without throwing; pnRU's labels `i, love, class, !` sort to `!, class, i, love`.
- **Visible:** yes: the list is alphabetical in every document with states, ELA included (pnRU's becomes `! class i love`).

### 8. Reset in dataset mode empties the graph

- **R8.1** In dataset mode, Reset rebuilds the graph from the last values the plugin received for the dropped attribute, the same way a drop builds it. Drawing mode is unchanged: it restores the drawing the document loaded with, as today.
- **R8.2** Reset's other steps stay as they are: the settings go back to their defaults, the output list clears, the graph is cleared and then restored inside the same timeout, and the fit and opacity steps run as today. MARK-12, which changes when Reset requests its fit, adapts on rebase.
- **R8.3** The values Reset uses are forgotten on Back To Main Menu, with the drawing's initial graph, so a later Reset can't bring back an attribute from before the menu.
- **R8.4** Test, through the function Reset uses to decide what to restore: drawing mode with an initial graph gives that graph; dataset mode with values gives the graph built from them; dataset mode with no values, and drawing mode with no initial graph, give nothing.
- **Visible:** yes, in dataset mode only: the graph comes back after Reset instead of the drop-an-attribute screen.

### 9. State labels are inserted as HTML

- **R9.1** Measuring a state's label sets the measuring element's `textContent`, both for the full label and for each truncated one, so a label is never parsed as HTML.
- **R9.2** Test: measuring `<b>x</b>` puts those exact characters in the measuring element and creates no child element; measuring `x &amp; y` measures those exact characters, not `x & y`; with a measured width that forces truncation, every truncated label is also set as text.
- **Visible:** no, except for labels containing markup or entity-like text.

### 11. Max Length 0 or below adds an empty output

- **R11.1** When the Max Length field loses focus or Enter is pressed in it, a value below 1 is set back to 1. Typing is not clamped on each keystroke. An empty field stays empty, and Play and Step stay disabled for it as today.
- **R11.2** Play and Step clamp the value they read to at least 1, so a sequence is never generated with a length below 1, and the output header shows the clamped value.
- **R11.3** Test: the clamp gives 1 for 0 and for a negative number, keeps 5, and keeps an empty value empty.
- **Visible:** yes: Max Length can't stay below 1.

### M3. The output dataset's existence check never matches

- **RM3.1** The output dataset is found in the `dataContextList` reply by `name === "Sequence Data"`, and `create dataContext` is sent only when it is missing.
- **RM3.2** The case table request is left exactly as it is: `create component` is still sent on every Play, so a closed or minimized table still reopens and the table still comes to the front, as today. Its never-matching check (`use-codap.ts:209`) stays with it.
- **RM3.3** Test: with a `dataContextList` reply copied from MARK-5's capture (`{name: "Sequence Data", guid, title: "Output Sequences", id}`), no `create dataContext` is sent and `create component` still is; with an empty list, both are sent; with the dataset listed and the `componentList` request rejected, `create component` is still sent (the table check starts from nothing, Technical Notes, M3).
- **Visible:** no.

### 7a. Sequence numbers restart at 0 after reopening

- **R7a.1** The first sequence a session outputs, when the output dataset already exists, is numbered one more than the highest `Sequence number` already in the dataset, read with `get dataContext[Sequence Data].itemSearch[*]`. Values are read with `Number()`, and only finite ones count, so a cell a student typed text into is ignored rather than making the next number `NaN`.
- **R7a.2** When the dataset doesn't exist yet, or the request fails, numbering starts at 0, as today. After the first output, numbering continues from the session's own counter.
- **R7a.3** The collections and grouping are unchanged.
- **R7a.4** Test: with a mocked `itemSearch[*]` reply whose items are numbered 0 to 4, plus one with text in its `Sequence number`, the next two outputs are numbered 5 and 6; with no dataset, they are numbered 0 and 1.
- **Visible:** yes: after a reopen, new sequences are numbered after the existing ones. None of the five saved ELA documents has a "Sequence Data" dataset, so a fresh copy is unchanged; the change shows in a student's saved copy that already has outputs.

## Technical Notes

### Where each fix lives (checked on this branch)

| # | Code | Notes |
|---|---|---|
| 1 | `components/drawing.tsx:293-325` (`handleTextChange`; regexes at `:41-42`; counting at `:301-314`) | The crash is `label.length` at `components/graph.tsx:221`. A throwaway test confirmed it: today "constructor" yields the global `Object` function as a state with undefined id and label, and `nodes[word].value++` writes `NaN` onto `Object.value`. Edge keys contain `\|`, so they can't hit a prototype name, but they move to the same kind of object for consistency. |
| 2, 2b | `utils/codap-helper.ts:202-214` (`getValuesForAttribute`; `tResult.success` at `:208`, the unchecked value at `:210`); `hooks/use-graph.ts:7-43` (`updateGraph`); `hooks/use-codap.ts:79-88` (`handleDataChanged`) | `getValuesForAttribute` has one caller (`use-codap.ts:81`). `getCaseValues` (`:180`) has the same `.success` bug but no caller; it is left for MARK-14's dead-code work. |
| 3B | `components/drawing/node-modal.tsx:49-63` (`handleSubmit`, the multiply at `:55`) | `percentage` in `probability-selector.tsx:44` is `n * 100` with no rounding, and `setExactPercentages` forces the last to `100 - rest` (`:18-23`). `probability-selector.tsx` imports `.scss`, so a test can't import it. |
| 3A | `components/graph.tsx:396-447` (the d3 graph effect; whole-graph total at `:403`, `edgeWeight` at `:426`, loops at `:430-431`, node radius at `:417`, the signature check at `:444`); `settings` at `:116-123`; `graphSignature` at `:200-204` | Zero-value edges exist (drawn dashed, `lineDashArray` `:245`): the state editor can set a share to 0%. A drawn edge starts at value 1 (`drawing.tsx:149`). |
| 3C | `components/graph.tsx:487-514` (`addArrowMarker` and the eight markers); edge lines `:689-711` and `tick` `:625-629`; loops `:733-750`, `nodeLoopPath` `:178-198`; `line` selections at `:302`, `:308`, `:317`, `:839` | `calculateEdges` (`:144-176`) puts each edge's end on the target ellipse; the click targets (`:669-687`) share those coordinates. Loop backgrounds (`:715-731`) and the ghost loop (`:772-805`) also use `nodeLoopPath`. The selection at `:364` (`unhighlightNonOutput`) sets only opacity and can stay. |
| 4 | `components/app.tsx:400-401` | With fix 2 in place, dataset labels are always strings, so `String()` here only guards drawings; the numeric option still orders `2` before `10`. |
| 8 | `components/app.tsx:526-550` (`handleReset`; restore at `:541-543`), `:102-104` (`onCODAPDataChanged`), `:552-563` (`handleReturnToMainMenu`); `components/dataset.tsx:77` (dataset mode's toolbar offers Reset) | Only drawing mode sets `initialGraph` (`hooks/use-codap.ts:96-102`, in `setPluginState`). `handleDataChanged` (`use-codap.ts:79-88`) skips values equal to the last ones it saw, so editing the table doesn't bring the graph back; only a new drop does. `plugin-bugs.md` cites master's lines for `use-codap.ts`. |
| 9 | `components/graph.tsx:206-243` (`calculateNodeFontSize`; `innerHTML` at `:217` and `:231`) | jsdom reports 0 for `clientWidth` and `clientHeight`, so the truncation branch runs only if the test gives the element a measured size. |
| 11 | `components/app.tsx:308-311` (`handleChangeLengthLimit`), `:417-422` (the input), `:192-218` (`generateNewSequence`, the read at `:196`, the group's `lengthLimit` at `:204-206`); Play and Step disabled at `:450`, `:457` | `min={1}` only limits the spinner. Step also goes through `generateNewSequence`. |
| M3 | `hooks/use-codap.ts:152-230` (`guaranteeOutputDatasetAndCaseTable`; dataset check at `:163`, table check at `:209`) | `plugin-bugs.md` cites master's lines (151-229, 162, 208). The function reuses one variable, `tFoundValue`, for both checks; once the dataset check matches, a failed `componentList` reply would leave the dataset entry in it and skip the table request. Today the dataset check never matches, so this is new with the fix: the table check must start from nothing. |
| 7a | `hooks/use-codap.ts:46` (`sequenceNumber` state), `:148-150` (`incrementSequenceNumber`), `:232-249` (`outputToDataset`) | `plugin-bugs.md` cites master's line 45. `incrementSequenceNumber` is used only by `outputToDataset`. |

### Reply shapes (CODAP 3.1.2, from MARK-5's capture)

- `get dataContextList`: `{"success":true,"values":[{"name":"Sequence Data","guid":667035179064476,"title":"Output Sequences","id":667035179064476}]}`. No `type` field, which is why today's `type === "text"` never matches.
- `get componentList`: the table is listed as `{"hidden":false,"id":...,"name":"Sequence Data","title":"Output Sequences","type":"caseTable"}`, with no `dataContext` field.
- `get dataContext[Sequence Data].itemSearch[*]` (captured for this spec in 3.1.2): `{"success":true,"values":[{"id":774329115517853,"values":{"State":"i","Sequence number":0}}, ...]}`. A number stays a number, text typed into the cell stays a string (`"abc"`), and an empty cell is `""`, which `Number()` reads as 0 (harmless for a maximum). With no dataset: `{"success":false,"values":{"error":"DataContext not found"}}`.
- A repeated `create dataContext` for an existing name returns the existing dataset (same id) and adds no second one, which is why today's redundant request has no visible effect.
- `codapInterface.sendRequest` rejects on a timeout or a closed connection (`utils/codap-interface.ts:325-379`) and resolves with the reply otherwise, `success: false` included.

### New modules

Each fix's logic moves into a new module that imports only `src/type.ts` and the other new modules (G3). Their names and exact signatures are the implementation spec's; what they hold is fixed here:

- the text parser (1);
- the attribute-value fetch and the graph built from values (2), taking the request function as a parameter;
- the state editor's value update (3B);
- the graph's drawing settings (`settings`, `ry`), arrow widths and the graph signature (3A), line and loop pull-back (3C) and label measuring (9), moved out of `graph.tsx` so there is one copy of `settings`;
- the Starting State comparator (4), Reset's choice of what to restore (8) and the Max Length clamp (11);
- the output dataset check (M3) and the sequence numbering and item output (7a), taking the request function as a parameter.

### Prototype (stage 4)

Every fix was built for real as throwaway code on this branch: the new modules, their tests, and every call site wired. With all of it in place, `tsc --noEmit` and `npm run lint` were clean, `npm run build` passed with `lint:build` at 21 warnings, and 24 tests passed. Each fix was then reverted in its module one at a time (17 mutations, including each half of 2, 3A, 3C, 4, 9 and 7a), and each turned its test red. In CODAP 3.1.2 the wired build drew "the the cat sat on the mat. the constructor built the house" with no crash, a sorted Starting State list, widths of 2.5 px for the five arrows leaving "the" and 4.5 px for single exits, `strokeWidth` markers, no marker on any click target, and a visible loop head. The prototype was deleted.

### Testing

- `npm test` runs Jest 28 with jsdom and ts-jest. There are no tests today (`npm test` exits 1 with "No tests found").
- A test file under `src/` that imports a module with no `.scss`, d3 or nanoid import runs as is; nothing in the Jest config needs to change. Checked with a throwaway `*.test.ts` using `describe`, `it`, `expect` and `jest.fn`: it passes `npm run lint`, `lint:build` and `tsc --noEmit` with the current config, and `npm test` picks it up through `testRegex`.

## Out of Scope

From `plugin-bugs.md`:

- **7b and M2, the visible output-table changes:** grouping by sequence, a step attribute, and opening the table clear of the graph.
- **12, a deleted starting state**, and **12b** (dropped).
- **The table half of M3:** `create component` keeps being sent on every Play.
- **5 and M4, dead code** (MARK-14), including `getCaseValues`'s identical `.success` bug.
- **10, fit to view** (waits for a MARK-11 test).
- **M5, the repeated dirty notifications**, and **M1, the tile title and size** (dropped).
- **MARK-16's description**, which needs updating now that per-state widths are the default; not this story's change.
- **DOM-level tests** of the drawn graph (marker attributes, which lines carry a head): Jest can't load `Graph`, so those belong with MARK-11's Cypress harness.

## Open Questions

### RESOLVED: Judgment call: how to meet "the test has to exercise the call" when components can't load under Jest
**Context**: `plugin-bugs.md` asks that, where a fix is a helper plus the call that uses it, a test exercise the call. `App`, `Drawing`, `Graph` and `NodeModal` can't load under Jest (`.scss`, d3, nanoid), and tests may import only new pure modules.
**Options considered**:
- A) Move each fix's whole logic into the new module, leave a one-line call at the site, and cover that call with the manual check (G2, G6).
- B) Add a Jest `moduleNameMapper` entry or transform so components load.
- C) Test the hooks with React Testing Library.

**Decision**: A. B is a Jest config change (G4) and would not fix d3 and nanoid without more config; C needs `render` on a component that imports a hook, which is not a new pure module. For the CODAP code (2, M3, 7a), passing the request function in lets the test run the same function the hook calls. Doug confirmed at stage 8 (2026-10-27) that the manual CODAP check is enough for the component call sites.

### RESOLVED: Judgment call: 3C's tests on marker attributes and click targets
**Context**: `plugin-bugs.md` lists "a marker's size follows its line's stroke-width" and "no `line.edge-background` gets a `marker-end`" as extra tests.
**Options considered**:
- A) Test only the geometry in Jest (R3C.5) and cover the marker attributes and the click targets in the manual check.
- B) Export the marker attributes and selector strings as constants and assert their values.

**Decision**: A. B's assertions are true by construction (they restate the constant), so they would not catch a selector reverted in `graph.tsx`. The click-target heads are 60 px black heads across the whole drawing, which the manual check can't miss.

### RESOLVED: Judgment call: where fix 2 converts values
**Context**: values could be converted where they are read from CODAP or where the graph is built.
**Options considered**:
- A) Convert where they are read, so `valuesRef`, the change check and `onCODAPDataChanged` all see strings, and build the graph from strings.
- B) Convert only in the graph builder.

**Decision**: A. `OnCODAPDataChanged` is already typed `string[]`; converting at the read makes that type true. The graph builder moves into the same module so the test covers the whole chain from reply to states.

### RESOLVED: Low confidence: the exact `itemSearch[*]` reply shape
**Context**: MARK-5 confirmed `itemSearch[*]` returns every item but did not paste the reply. 7a's test fixture and parser depend on where `Sequence number` sits in each item.
**Options considered**:
- A) Capture the reply in CODAP 3.1.2 before writing the implementation spec.
- B) Write the parser to the expected shape and rely on the manual check.

**Decision**: A, done on 2026-10-27 in `https://codap.concord.org/app/` (3.1.2) through CODAP's Data Interactive API Tester plugin, in a new unsaved document. The reply is `{"success":true,"values":[{"id":...,"values":{"State":"i","Sequence number":0}}, ...]}`; a number stays a number, text a student typed stays a string (`"abc"`), and an empty cell is `""`. With no dataset, the reply is `{"success":false,"values":{"error":"DataContext not found"}}`. Recorded under Technical Notes.

### RESOLVED: Low confidence: how a trimmed loop looks
**Context**: no ELA document has a loop, and MARK-5's previews never drew one. A loop's arc ends slightly inside its state's ellipse (the end point at 1.75 pi on a circle of radius `ry` centered at `x - rx` is inside the ellipse), under the white node fill.
**Options considered**:
- A) Trim by the head's reach as `plugin-bugs.md` says and check a drawn loop by eye.
- B) Also move the loop's end onto the outline.

**Decision**: B, revised at stage 4. A was first chosen on the reasoning that today's head tip sits on that same inside point. A browser check of a wired prototype build in CODAP 3.1.2 refuted it: today's 12 px head pokes out past the outline and is visible, but the trimmed 4-unit head sat wholly under the node and disappeared. The loop circle (center `x - rx`, radius `ry = rx / 2`) meets the ellipse where `cos(theta) = 2/3`, independent of the state's size, so the untrimmed loop now ends at `2 * PI - acos(2 / 3)` (about 3 degrees past today's end), and the trim puts the tip there. Rechecked in the browser: the loop's head shows on the outline. R3C.3 and R3C.5 say so. Doug confirmed ending loops on the outline at stage 8 (2026-10-27).

### RESOLVED: Low confidence: `lint:build` warning count after the moves
**Context**: `lint:build` reports no-console warnings; moving `guaranteeOutputDatasetAndCaseTable` and `getValuesForAttribute` moves their `console.log` calls. Measured on this branch: `lint:build` gives 21 warnings (all `no-console`) and `lint` is clean.
**Options considered**:
- A) Keep the moved `console.log` calls and add none, so the count stays 21.
- B) Drop them in the moved code.

**Decision**: A. The logs are the plugin's only trace of a failed CODAP request, and changing them is not a bug fix. New code adds no `console` call, so `lint:build` stays at 21 warnings at every commit (G6).

## Self-Review

Roles: Senior Engineer, QA Engineer, Commit Reviewer (Mau's view), Security Engineer, Teacher and Student (the ELA module). Each finding below was checked against the code or with a throwaway test before it was written; findings that did not survive were dropped.

### QA Engineer

#### RESOLVED: `plugin-bugs.md`'s order test could not fail
The text `2 7 10 go then and` is already in ascending order, so a `Map` would give the same order and the test would pass on the wrong fix (confirmed with a throwaway test). R1.3 now uses `go 10 then 2`, which a plain object orders `2, 10, go, then` and a `Map` orders `go, 10, then, 2`.

#### RESOLVED: the manual check did not cover dataset mode or the click targets
Fixes 2 and 4 are dataset-mode crashes and 3C's selector change only shows when a state is selected or a sequence plays. G6 now lists both.

### Senior Engineer

#### RESOLVED: "number-like" was too loose in R1.2
Only canonical integer keys sort first in a plain object; `01`, `-1` and decimals keep insertion order (the parser splits `1.5` at the period anyway). R1.2 now says so.

#### RESOLVED: R3C.2 did not say what happens to a line already shorter than 1 px
Two overlapping states can give a near-zero line. R3C.2 now leaves such a line alone.

### Commit Reviewer

#### RESOLVED: would the first test commit need any config?
Checked: a test file passes lint, `lint:build`, `tsc` and Jest with today's config, so the first commit carries only its fix, its module and its test (Testing notes).

### Third review

Roles: New Engineer (follows the implementation plan literally), React and Hooks Reviewer, CODAP API Reviewer, Accessibility Reviewer (the Max Length field). Each step was built in order as throwaway code; the findings that touch the implementation only are recorded in the implementation spec's third review.

#### RESOLVED: RM3.3 did not test the table check's reset
M3's fix starts the table check from nothing (Technical Notes, M3), but RM3.3's two cases never make the `componentList` request fail, so deleting that reset left them green (checked with a throwaway test). RM3.3 now adds the case: the dataset listed and the `componentList` request rejected still sends `create component`.
