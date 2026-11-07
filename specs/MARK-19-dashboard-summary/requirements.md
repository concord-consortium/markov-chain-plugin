# The AP Interactive's Summary of Each Student's Work in the Dashboard

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-19
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

The class dashboard's side panel shows a short plain text summary of a student's work at the moment the history scrubber is on, in place of the placeholder and the inline "View Work" view. A teacher can see what changed from step to step without opening the full view.

## Project Owner Overview

Teachers scrubbing through a student's history in the side panel see nothing change today unless they open "View Work", and that view is cramped. This story replaces it with three lines under "The student has saved work in the interactive.": what the student built, their outputs, and their settings. The lines change as the scrubber moves. "Open in new tab" stays for the full read-only view, and still opens the moment the scrubber is on.

Rebecca Ellis's preferred layout, with "View Work" opening the stats below the scrubber, needs a change to the class dashboard and isn't part of this story. The summary was sent to Rebecca on 2026-11-07 and her reply is open; the design stands unless she changes it.

## Background

MARK-17 saves a student's whole state, makes the dashboard's scrubber step through saved moments, and left a placeholder in the report item ("A summary of their work comes in a later version."). Its R27 dropped `hideViewInline` so moving the scrubber changed something a teacher could see. With a summary that changes per step, the inline view is no longer needed, and Rebecca's "Friday Nov 6 Updates" asks for stats rather than the view. The "Steps recorded" part of that section belongs to MARK-28.

The dashboard already does what the summary needs (Technical Notes): each step sends `getReportItemAnswer` with that step's state, and the report item's HTML is drawn above the scrubber.

## Requirements

### What the teacher sees

- **R1.** The full answer's HTML starts with "The student has saved work in the interactive." (no "Markov"), followed by three lines describing the saved moment. The placeholder's text goes.
- **R2.** Line one names the mode showing in that moment and what is in it:
  - Data mode: `Data: 42 words, 9 states`.
  - Draw mode: `Drawing: 5 states, 7 arrows`.
  - Words are the input's word tokens, the filled rows of the input table (a blank line is an empty row and no word), so a punctuation mark the tokenizer keeps is a word and a bracketed `[New York]` is one word. States are the graph's states. Arrows are the drawing's arrows, including a state's arrow to itself.
- **R3.** Line two is `Outputs: 3, latest: the cat sat on the mat`, for the mode showing. The count is the outputs that match that moment's settings (R5). "Latest" is the newest of those outputs, written as the student sees it, with its own delimiter.
- **R4.** Line three is that moment's settings:
  - Data mode: `Settings: start (any), max length 20, order matters on` (or `off`).
  - Draw mode: `Settings: start A, max length 10`. Draw mode has no "Order matters" switch, so the line leaves it out.
  - The start is the state's label, or `(any)`.
- **R5.** An output matches when its starting state, Max Length and "Order matters" equal the ones on line three of the same moment. Delimiter isn't compared, since it changes how an output is written and not what is generated, and the summary doesn't show it. An output's starting state is the one its heading in the output list shows: one generated into a new group after its chosen state left the graph is `(any)`. States compare by id, so a drawn state renamed after its outputs were made still counts them, though their heading keeps the old name. Outputs made before a setting changed stop counting at the step where it changed, and count again if the student goes back to those settings.
- **R6.** The summary reports what "Open in new tab" shows for the same moment. The mode, input, case rule, "Order matters", starting state and Max Length are all read by the rules the read-only view uses (MARK-17's R17), so:
  - a student who never changed the input is counted from the authored starting text (MARK-17's R2);
  - with no Input pane the saved input is ignored;
  - "Case sensitive" and "Order matters" apply only where the page shows that switch;
  - a saved mode the page doesn't offer falls back to the starting mode;
  - a starting state no longer in the graph reads as `(any)`;
  - a Max Length left empty, or a state with no generator settings, reads as the default, 5. A saved state doesn't always hold its own: an empty field saves no `lengthLimit`, and a state from before MARK-17 has no generator settings.
- **R7.** Nothing is left out for lack of work. With no outputs matching, line two is `Outputs: 0`, with no "latest". With no words or drawing, line one is `Data: 0 words, 0 states` or `Drawing: 0 states, 0 arrows`. A student whose state holds no work, such as one who only collapsed a pane (MARK-17's R13), gets the summary of the page as authored, which is what the read-only view shows them. All three lines show on every page, including one with no Sequence generator pane, where the read-only view has no outputs or settings to compare them with.
- **R8.** Counts use the singular for one: `1 word`, `1 state`, `1 arrow`.

### Safety and layout

- **R9.** Everything the student wrote is HTML-escaped: outputs and state labels, in both modes. The HTML is drawn in a same-origin `srcdoc` frame in the teacher's dashboard, so a label such as `<img src=x onerror=...>` must arrive as text.
- **R10.** A latest output or starting state over 60 characters is cut to 60 and ends with `…`. Characters are counted by code point, so a surrogate pair isn't split, though an emoji built from several code points (a skin tone, a family) can lose its later parts. The cut comes before escaping, so an entity isn't split. Unbroken text wraps inside the panel rather than scrolling sideways.
- **R11.** The answer keeps both the `.tall` and `.wide` blocks, since the dashboard shows one or the other: `tall` in the side panel and `wide` in the question's response lists. In each, the sentence sits above the three lines.
- **R12.** The output is deterministic: the same state and authored state give the same HTML. The dashboard can post 2 to 3 requests per step, so the answer is built and sent synchronously in the handler, and a repeat changes nothing the teacher sees.

### The links and the compact answer

- **R13.** The links item sets `hideViewInline: true`, so "View Work" goes. "Open in new tab" stays and opens the moment the scrubber is on.
- **R14.** The compact answer stays empty, since the grid shows only a score, and building it reads nothing from the state.

### What else changes

- **R15.** The demo page's "Report item, full answer" shows the summary of the state the runtime last saved, or of the authored page before any save, in a frame tall enough for all four lines (it is 60px today). The placeholder's constant goes.
- **R16.** `README.md`'s description of `report-item.html` and the comments in `report-item-answer.ts` change to match. The demo page's Cypress test checks the summary of its starting text (`Data: 11 words, 7 states`) in place of the placeholder, that the frame follows a save, and that it holds all four lines without scrolling.
- **R17.** The CODAP plugin does not change. No file under `src/components` or `src/hooks` changes, and the built `index.*.js` and `main.*.css` are byte-identical to master's.

### Tests

- **R18.** Jest covers each rule R2 to R12 on the summary's own function, and that a compact answer has no items and a full answer has the links item with `hideViewInline`. The summary's copies of the generator's `(any)` label and default Max Length are each asserted against the real value, so neither can drift (Technical Notes).
- **R19.** Cypress, on the fake Activity Player page: the report item answers a full answer built from the state and authored state in the request, in both modes, and a second request with a different state gives a different answer in the same frame, as a scrubber step does.
- **R20.** On learn staging, on the branch build: in the class dashboard, a teacher sees the summary change as they move the scrubber, in both modes, with no "View Work" link, and "Open in new tab" opens the step the scrubber is on. This is a hand check, recorded in the PR's test notes.

## Technical Notes

### What was checked in `portal-report` (master)

- **The flow.** `Answer` (`js/containers/portal-dashboard/answer.tsx`) swaps its `answer` to the history entry when the scrubber moves. `IframeAnswer` (`js/components/report/iframe-answer.tsx`) sees the new answer and dispatches `getReportItemAnswer`. `processReportItemRequests` (`js/reducers/report-reducer.ts`) parses the answer's `reportState` and posts `interactiveState` and `authoredState`, each parsed. Whatever fails to parse is sent as it was, and either can be `null`, so the summary reads both through the existing readers.
- **The authored state is the one saved with that step**, not the page's current one.
- **Layout.** `render()` draws the report items, then the iframe if open, then `InteractiveStateHistoryRangeInput`, unconditionally, so the summary sits above the scrubber whatever `hideViewInline` says. Links come first because the item list does.
- **The frame.** `IframeAnswerReportItem` draws an `html` item as `<iframe srcDoc=...>`, with no `sandbox`, sized to its content by a `ResizeObserver`, and with a key that includes the history id, so each step is a new frame. A `srcdoc` frame shares the dashboard's origin, which is why R9 matters.
- **Injected styles.** `updateReportItemAnswerItems` prepends only the font and `.tall`/`.wide` display rules. `.wide` is `display: flex; flex-direction: row`.
- **Orientation.** `overlay-student-response.tsx` passes `tall`. The popup lists pass `wide`.

### Checked by running it (throwaway code, since deleted)

A prototype built on `restoreWork`, run in Jest and through a production build:

- `restoreWork` gives everything the summary needs, and agrees with the read-only view by construction. With `caseSensitive: true` saved on a page with no case switch, `The the` is 1 state under `restoreWork`; reading `caseSensitive` straight off the state, as the first sketch of this story did, gives 2.
- `null`, `{}`, `{ version: 1 }`, an unparseable string, a JSON string and a state from MARK-15 all read without throwing.
- 50,000 characters of input took about 10 ms.
- The report item's bundle grows by about 10 KB (to about 311 KB), since it now pulls in the readers and the tokenizer. The demo page's grows by about 7 KB.
- Rendered in headless Chrome with the dashboard's injected styles at 320px: an unbroken 60-character output scrolled the frame sideways without `overflow-wrap: anywhere`, and wrapped with it. In `.wide`, two sibling paragraphs sat side by side with no gap, so each block wraps its paragraphs in one child, which stacks them in both orientations.

### The two values the summary repeats

The summary needs the generator's `(any)` label and its default Max Length, and takes neither from shared code, so `src/components` and `src/hooks` stay as they are.

- `AnyStartingState` is exported by `generator.tsx`, which the report item shouldn't import, since that brings a React component and its SVGs. `report-summary.ts` has its own `anyStartLabel`, and a test asserts it equals `AnyStartingState`.
- `defaultLengthLimit` isn't exported from `use-markov-tool.tsx`. The summary does need a default: `toolParts` saves `clampLengthLimit(undefined)` for an empty field, which `JSON.stringify` drops (run: the saved generator had no `lengthLimit`), and a state from before MARK-17 has no generator at all. Both reopen at 5 in the read-only view, so the summary has to say 5 to agree with it (R6). `report-summary.ts` has its own `defaultMaxLength`, and a test renders `useMarkovTool` with no saved settings and asserts `generatorProps.lengthLimit` equals it. The test reads the value the hook really opens at, so changing the hook's default fails it with no export needed.

### Other notes

- Saved `startingState` is an id, and in Draw mode an id isn't the label, so the label comes from the graph.
- The generator keeps a chosen state after it leaves the graph, and generates as `(any)`. Run through the real workspace (choose `cat`, change the input, generate): the select shows `(any)`, the heading `(any)/3/" "`, and the save holds `startingState: "cat"` on both the generator and the group, with no `start`. So a group's `startingState` isn't what it started from; its `startingNode` is what the heading shows (R5).
- A group's `startingNode` is set once, and `generateNewSequence` adds to the last group when `startingState` matches, whatever the graph holds now, so a heading can be wrong for a later output. Run through the real workspace: `a c`, generated after `cat` left, sits under the heading `cat`, and line two reads `Outputs: 0` at `start (any)`; `cat a b`, generated once `cat` came back, sits under `(any)`, and reads `Outputs: 0` at `start cat`. Line two stays in step with the headings a teacher can open. A group saves nothing better, and the cause is in `src/hooks`.
- A group's `orderMatters` is undefined in older saves, and the output pane reads that as on (`group.orderMatters === false` is the only orderless case).
- `generateNewSequence` compares a group only to the last one, so groups with the same settings can repeat in a list. Counting filters every group.
- A sequence in a save is at least one state long, even one saved part way through (MARK-17's R4). An empty one in a damaged state counts and shows no "latest".
- Outputs aren't cleared when the input changes, and a group doesn't record the text it came from, so outputs from earlier text still count while the settings match.

### Checked by building the proposed code (throwaway, since deleted)

The whole change was written out as the implementation spec describes and run, then removed:

- Jest, all suites, passed, including the new tests. Each of 24 mutations of the summary and the answer (dropping one compared setting, comparing `group.startingState`, taking the oldest output, skipping escaping, splitting by code unit, not clamping Max Length, matching the start by label, reading Data mode's order in Draw mode, showing "View Work", answering a compact answer with items, dropping the state or the authored state, changing either repeated value) failed at least one test. A 25th, `readOnly: false`, changes nothing the summary reads, so no test can see it.
- Cypress `interactive-report-item.test.ts` and `interactive-demo.test.ts` passed in Chrome, including two requests with different states in one frame. Dropping the authored state in the handler, or the escaping, failed `interactive-report-item.test.ts`.
- Both `tsc` projects and all three lint configs were clean.
- The plugin's `index.*.js` and `main.*.css` were byte-identical to master's.
- Rendered with the dashboard's injected styles, a 200-character output was cut at 60 with `…` and wrapped at 320px in `.tall`; in `.wide` the sentence sat above the three lines. An unbroken output and start together didn't scroll sideways at 320px in either block.
- 60,000 randomly damaged states and authored states, deep-frozen as the library hands them over or sent as JSON strings, gave no exception, no unescaped `<` or `>`, and no `NaN`, `undefined` or `null` in the HTML.
- For 3,000 states, half of them damaged, under varied authored states, the mode, states, start, Max Length and output count all matched what `useMarkovTool` opens with, counting outputs by their headings. Saves from the real workspace agreed with the read-only view too: Max Length changed and changed back, Max Length emptied, order off, and a drawing whose ids aren't its labels.
- The demo's starting text, `the cat sat on the mat. the cat ran.`, reads `Data: 11 words, 7 states`, since both full stops are words and `.` is a state.

## Out of Scope

- Rebecca's layout with "View Work" opening the stats below the scrubber, or any other change to the class dashboard.
- Which student actions make a step (MARK-28).
- Showing the delimiter, speed, "Case sensitive" or "Show probabilities" in the summary.
- The note on `report-item.html` opened on its own, which still names the Markov interactive for a developer.
- Anything in the CODAP plugin, and any change to what is saved.

## Open Questions

### RESOLVED: What does "outputs that match the current settings" mean once settings change after outputs exist?
**Context**: "Current" has to mean the settings of the moment the scrubber is on, since each step is its own saved state. A student with 12 outputs at Max Length 20 who changes it to 10 reads `Outputs: 0` at that step, the same as a student with no outputs, and "latest" goes away until they generate again. The full list stays in "Open in new tab".
**Options considered**:
- A) As Jira and the note to Rebecca say: count only matching outputs, and "latest" is the newest of those (R3, R5). The drop to 0 shows the settings changed.
- B) Keep the match but show the total too: `Outputs: 3 of 12, latest: ...`.
- C) Count every output in the mode, and "latest" is the newest overall.

**Decision**: A (Doug). This, the zeros (R7), punctuation counting as a word (R2) and the 60-character cut (R10) are going to Rebecca as defaults; the spec changes if she answers differently.

### RESOLVED: Low confidence: should punctuation count as a word on the "Data" line?
**Context**: The tokenizer keeps `.,?!:;` as words, and they are states on the graph, so `the cat sat.` reads `Data: 4 words, 4 states`. A teacher may count 3.
**Options considered**:
- A) Count them, matching the input table's rows and the graph's states (R2).
- B) Leave punctuation out of the word count only.

**Decision**: A. A teacher who opens the work in a new tab sees `.` as a row and a state, and B would make "words" disagree with both. The count is a rough measure of how much the student has, not a word count for grading.

### RESOLVED: Judgment call: read saved work through `restoreWork`, or straight off the state?
**Options considered**:
- A) `input.text` through the tokenizer with `caseSensitive`, falling back to `startingText`, as the first sketch said.
- B) `restoreWork`, as the read-only view does.

**Decision**: B. A disagrees with "Open in new tab" on a page with no Input pane or no case switch, and repeats rules that already exist.

### RESOLVED: Judgment call: what is compared when matching outputs?
**Options considered**:
- A) Every field that splits a group: starting state, Max Length, "Order matters", delimiter.
- B) Only the three the summary shows.

**Decision**: B. A teacher can check the count against line three. Under A, changing a space delimiter to a comma would zero the count with nothing on the line to explain it.

### RESOLVED: Judgment call: what does a student with no state show?
**Options considered**:
- A) The sentence alone.
- B) The summary of the authored page.

**Decision**: B. It is what the read-only view shows (MARK-17's R22), and it needs no second path. The dashboard's `hasResponse` shows "No response" for a null or empty state, so only a state with keys gets here.

## Self-Review

Reviewed as senior engineer, security engineer, QA engineer, teacher, and accessibility reviewer. Each finding was checked against the code, and the fixes are in the requirements above.

- The demo's report item frame is fixed at 60px, which would clip the four lines (R15).
- R7 described a missing state reaching the summary. `hasResponse` stops a null or empty state first, so R7 now names the case that does reach it.
- `requestReportItemAnswer` on the fake Activity Player page always sends the state it was started with, so R19's second request needs an optional state argument.

A second review, as senior engineer, QA engineer, security engineer, teacher and accessibility reviewer, ran the proposed code and the real workspace. The fixes to R2, R5 and R10 and to the tests came from it (implementation.md, Self-Review).

A third review, as senior engineer, QA engineer and teacher, reran the fuzz and the real workspace on the current code. R5 said a heading shows where an output really started, which a shared group can break (Other notes), and R16's demo test now follows a save.

A fourth review, as senior engineer, QA engineer, new developer and accessibility reviewer, followed the steps literally and read the summary's accessibility tree in Chrome. R5 now says a renamed state keeps its outputs, and R16's demo test checks the frame's height, which nothing failed on at 60px. In that tree the three lines are separate text nodes in reading order.

### Teacher

#### RESOLVED: What do lines two and three say on a page with no Sequence generator pane?
An author can turn the pane off, which leaves the read-only view with no outputs or settings to show, while the summary still reads `Outputs: 0` and its settings, or `Outputs: 1, latest: a` if outputs were saved before the author turned it off (run on the proposed code). This isn't the "zeros show" decision, which is about a student with no work.
- A) Keep all three lines.
- B) Leave out lines two and three on such a page, a small check on `config.panes` in `reportSummaryLines`.

**Decision**: A (Doug). One path on every page, and an author removing the generator after students start is rare. R7 says so.

### Accessibility

#### RESOLVED: Should the summary name its own frame?
The dashboard draws the frame with no `title`, and the document in it has no `<title>` or `lang`, so in Chrome's accessibility tree both the frame and its document have an empty name. The report item can't reach the frame's attribute. Starting the html with a `<title>` names the document (run: `Summary of saved work`), and the frame stays unnamed.
- A) Leave it: the frame belongs to the dashboard, and the placeholder had the same gap.
- B) Add a `<title>` to `reportSummaryHtml`, which is a new string for Doug or Rebecca Ellis to word.

**Decision**: A. The frame belongs to the dashboard, a `<title>` wouldn't name it, and B adds wording nobody has agreed. A named frame is a change to the class dashboard.
