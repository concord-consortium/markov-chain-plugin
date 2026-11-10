# The AP Interactive's Workspace, with Linked Text, Table and Inspect Panel

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-15

**Status**: **Closed**

## Overview

Replace the AP interactive's runtime placeholder with the student's workspace: an Input pane (text, table, or both, linked), the graph, an Inspect pane with the states and transitions, and the sequence generator with its output below. Everything a student clicks lights up in every pane that shows it. The workspace runs MARK-14's shared Markov components through an Activity Player host, which saves the student's input and logs their interactions.

MARK-13 gave the AP interactive its authoring form and a placeholder that lists the settings. This story is the first one students can use: they type or table their words, and the graph, the counts and the probabilities update together. Every authored setting decides what loads and what starts open, so the stories after this one (MARK-16's probabilities, bag of words and Draw mode; MARK-17's saved work; MARK-18's Send to CODAP) slot into the same workspace without rework. The CODAP plugin, and the ELA module that uses it, do not change for users.

It builds on MARK-13 (PR #88: `src/interactive/`, its authored state, the runtime placeholder, report mode, the standalone page and the demo) and MARK-14 (PR #89: `MarkovHost`, `useMarkovTool(host)` returning a `MarkovToolApi` with a stable `handle`, `Generator` and `SequenceOutput` as components, and `chainsToGraph`/`graphFromValues`). The source is Rebecca Ellis's "Markov Tech Specs (AP)" doc and her answers to the student-view mockup questions (2026-11-02).

## Requirements

### The workspace and its host

- **R1.** In `runtime` mode the interactive shows the workspace in place of MARK-13's placeholder. `report` mode keeps MARK-13's placeholder and note (R13 of MARK-13) until MARK-17 builds the read-only view.
- **R2.** The workspace runs the shared core's tool state, the generator, the output and the graph, through an AP host that implements MARK-14's `MarkovHost`:
  - Data mode reaches the core as its `"dataset"` view mode, since in both the graph is rebuilt from a list of values with an empty value as a break, and probabilities are read-only. `setViewMode` does nothing, since the workspace has no mode menu and no Back to Main Menu.
  - The workspace hands the core each committed input as values through the core's `dataChanged` (R18), so the core never sees text or rows.
  - `markDirty` does nothing: the core calls it only in its drawing view and on choosing a mode, and the workspace saves when the input commits (R31).
  - `outputSequence` resolves at once and sends nothing (MARK-18 adds the data saved for CODAP).
  - Every host function keeps its identity across renders, as MARK-14's `MarkovHost` comment requires.
  - The workspace has no loading state: it renders only once the init message has arrived, carrying both states, and the standalone page has its settings at once.
- **R3.** The shared core's state (the graph, the selection, generation and its animation, the output's sequence groups, the generator's settings) is usable without `MarkovTool`'s CODAP layout, so the workspace lays out the same graph, generator and output in its own panes. The CODAP plugin keeps its layout and behavior exactly: MARK-14's tests, and every other existing plugin test, pass unchanged.
- **R4.** `MarkovHost` gains `log(event, data)`, called by the shared core at each interaction R33 lists. The CODAP host's `log` does nothing, so the CODAP plugin sends CODAP nothing new. The AP host's `log` calls the library's `log`. The standalone page's does nothing.
- **R5.** Opened standalone (MARK-13's R14), the interactive shows the workspace with its URL's settings and MARK-13's note that nothing is saved; it saves and logs nothing and makes no library call. Inside a host the URL is still ignored.

### Loading from the authored settings

- **R6.** One pure function maps an authored state (as `readAuthoredState` reads it) and a mode to the workspace's configuration: which panes are present and which start open, what the Input pane holds, the tokenizer's starting capitalization and whether students get the "Case sensitive" switch (R16a), and the controls later stories render (the Data/Draw switch, the "Order matters" switch and its starting value, the probabilities toggle and its starting value, Send to CODAP and Download tables). The workspace renders from it.
- **R7.** **Modes.** The workspace opens in `startingMode`. In this story, Draw mode shows a short message that it arrives in a later version in place of the workspace; MARK-16 builds it, and its Data/Draw switch (shown only with both modes). The configuration for Draw mode is complete here: no Input pane, the Graph pane always present and open, and Inspect and the generator as authored.
- **R8.** **Panes in Data mode.** Input, Graph, Inspect and the Sequence generator each appear only when `available`, and start open or collapsed as `startsOpen` says. A collapsed pane keeps its contents and state (the input, the graph's layout, the selected tab and sort, the generator's settings and the outputs) and shows them unchanged when reopened.
- **R9.** **Input view (Data mode).** `text`: the text box only. `table`: the table only. `textAndTable`: the text box above the table, linked (R20). The Input pane's view never changes at runtime.
- **R10.** **Settings that belong to later stories** are in the configuration but not rendered here: the "Order matters" switch and its starting value (MARK-16; until then every graph is a Markov chain), the probabilities toggle and its starting value (MARK-16; shown only where the Graph pane is present), Send to CODAP and Download tables (MARK-18).

### Layout

- **R11.** The Input, Graph and Inspect panes sit side by side, in that order, with the Sequence generator below them across the full width. A pane that is not present takes no space, and the panes that remain share the row:
  - The graph is the pane that stretches. When the Graph pane is collapsed, or not present, Input and Inspect share the row in proportion to their widths (25-50-25 becomes 50-0-50, 25-25-50 becomes 33-0-67). One of them open alone takes the row.
  - When none of Input, Graph and Inspect is present, the row isn't drawn and the Sequence generator sits at the top of the workspace.
- **R12.** Each pane has a header with its title (Input, Graph, Inspect, Sequence Generator) and a button that collapses and reopens it, which says which it will do, reports `aria-expanded`, and works from the keyboard. Draw mode's Graph pane is the exception: it is always open, so it has no collapse button (MARK-16 builds it). The generator's controls (starting state, length, delimiter, speed, Play and Step) sit in a column on the left of the output and collapse on their own, so the output can take the generator's full width. The column has a "Controls" heading, lined up with the output's heading, with its collapse button on the heading's row, the same 20 px button and icon as the panes', 10 px in from a thin line in the pane border's color between the column and the output. The heading hides when the controls collapse; the button and the line stay. In the workspace the output's heading reads "Output", with no colon, through an option of the shared output that the plugin doesn't set.
- **R13.** The workspace is laid out for a full-width Activity Player item (1,044 px in the Standard layout, 904 px in iPad Friendly). The workspace keeps the panes' 8 px gap around its edges. Below 700 px of the interactive's width the side-by-side panes stack, so a narrower placement has no sideways scrolling. The workspace's own row of controls above the panes (Clear highlight and the case control here; MARK-16 and MARK-18 add theirs) wraps onto another line when its controls don't fit. A mode with nothing in the row besides Clear highlight (no mode switch, setting switch or label, or table buttons) has no row: the panes take its 40 px, the generator when it's open and the row of panes otherwise, and Clear highlight goes in the Graph pane's header, or Inspect's when the Graph pane is collapsed or absent, so it appearing never moves the panes. Nothing in the workspace is sized from the viewport: the frame is sized to the reported height, so the panes have set heights (R13a) and the graph fills its pane.
- **R13a.** **Resizing panes.** Students resize the panes by dragging dividers: one between Input and Graph, one between Graph and Inspect, and one between the row of panes and the Sequence generator.
  - Dragging a divider moves space between the two panes beside it, and the workspace's total width and height stay the same. The panes start at Input 280 px, Inspect 260 px, the graph the rest, the row 315 px tall, the generator 235 px tall with its output scrolling: 614 px with the workspace's own row and the panes' 8 px gap around its edges, which fits a Chromebook's 1366 by 768 screen below the browser's toolbars and the Activity Player's header. The generator starts at its minimum, so the divider above it first moves only up.
  - Each pane has a minimum: Input 160 px wide, Graph 200 px, Inspect 220 px; the row 200 px tall, the generator 235 px tall. The controls column scrolls when it is taller than the generator's body, which only the "other" delimiter makes it at the minimum. A divider stops when either pane beside it reaches its minimum; dragging never collapses a pane.
  - A divider shows only between two open panes: not beside a collapsed strip, not between Input and Inspect when the Graph pane is collapsed or not present, not above a collapsed or absent generator, not below a row whose panes are all collapsed, and not below 700 px, where the panes stack.
  - When the workspace is narrower than the chosen widths allow, Input and Inspect give up width, down to their minimums, so the graph keeps its own; the chosen widths come back when there is room again.
  - Each divider is a focusable separator that reports its position and range to a screen reader; the arrow keys move it 10 px. It works with a mouse, a pen and touch, and can be grabbed anywhere in a band across the gap between the panes, their borders and 4 px of the 5 px of padding every pane's contents keep beside it, 18 px in all, so grabbing a divider never presses a button or a scrollbar. The row's divider band is 13 px and doesn't reach the generator's header. The 18 px band is below WCAG 2.2's 24 px target size (2.5.8), and so are the panes' 20 px collapse buttons, whose 24 px spacing circle overlaps the band beside them by 1 px.
  - In the linked view (`textAndTable`) a fourth divider sits between the text box and the table, starting the text box at 40% of the Input pane's height. It moves space between the two, each keeping at least 60 px, or half their height where they have less than 120 px, and it shows wherever the Input pane is open in that view, stacked or not.
  - A collapsed pane reopens at the size it had, and the graph is fitted when its pane reopens. When a drag or a keyboard move ends, the graph is fitted if the view is following the graph (R29c), and otherwise keeps the student's view.
  - While the generator is collapsed, the row takes the height the generator gave up, so the workspace's height stays the same, and gives it back when the generator reopens; stacked panes keep their heights.
  - The sizes are workspace state beside which panes are open, ready for MARK-17 to save; this story saves none (R31).
- **R13b.** **Font.** The interactive's pages (the workspace hosted and standalone, the report placeholder and the authoring form) use Lato, as the Activity Player and Concord's question interactives do: Google Fonts' Lato stylesheet (weights 400 and 700) and `'Lato', arial, helvetica, sans-serif` on the body. A state's label in the graph is sized by measuring it in the page's font. The CODAP plugin keeps its font.
- **R13c.** **Keyboard and narrow screens.** Every control in the workspace focused from the keyboard shows a 2 px teal (#177991) outline, 4.5:1 or better against the panes. At 320 px the generator's Clear Output and Cancel go onto two lines rather than past the pane's edge. With the system's reduced motion set, Fit, Recenter and the automatic fits move the view at once. The generator's Starting State, Max Length and Delimiter fields are named by their labels and the other delimiter's field is "Other delimiter"; the plugin shares these. Data mode's Select tool, the only tool there, reports itself pressed.
- **R14.** Outputs in the generator's output alternate between very light background colors, sequence by sequence; a highlighted output keeps the output highlight. The CODAP plugin's output is unchanged.

### The tokenizer

- **R15.** One tokenizer turns the input into states, and the text box and the table both use it:
  - Text splits at whitespace, and each of `. , ? ! : ;` is a token of its own.
  - Each double quote is a token of its own, and straight `"` and curly `“` `”` all have the one state `"`, so text pasted from Google Docs or Word builds the same graph as typed text. Single quotes, straight or curly, stay part of the word (`girls'`, `don't`). The plugin's text still drops double quotes.
  - `( ) { } _ + = | \ / < >` separate tokens and are dropped, as the plugin's text does today.
  - Square brackets keep a token whole: `[No!]` and `[ice cream]` are one token each (`No!`, `ice cream`), trimmed at the ends. A bracket runs from `[` to the next `]` on the same line with no other `[` between; any other `[` or `]` is dropped (`[a [b] c]` gives `a`, `b`, `c`), and `[]` gives nothing.
  - A blank line (two or more line breaks with only whitespace between them) breaks the chain. Several blank lines in a row are one break, and blank lines before the first token or after the last break nothing.
  - Each token keeps where it is in the text (its start and end, a bracketed token's brackets included), so the text box can highlight it and a table edit can replace it.
- **R16.** **Capitalization.** With `lowercase` (the default) a token's state is its text lowercased; with `asTyped` it is the text as typed. The text box and the table always show what the student typed; only the graph, Inspect and the generator's states use the lowercased form.
- **R16a.** **Students choose case sensitivity.** MARK-13's authored state gains one setting, whether students see a "Case sensitive" switch (on by default); its existing capitalization setting, still defaulting to `lowercase`, becomes the switch's starting value, labeled in the form as case sensitive Yes or No. The authored state's version stays 1.
  - In Data mode, with the switch shown, it sits at the top of the Input pane, or in the workspace's own row when there is no Input pane, and is hidden with a collapsed Input pane. When the author hides it, the workspace's own row shows a read-only "Case sensitive: Yes" or "Case sensitive: No" label. Draw mode shows neither. The switch's name wraps where the space is narrower than the switch, so it stays inside an Input pane at its 160 px minimum.
  - The switch and the label are one shared component pair that MARK-16's "Order matters" switch and label use too. Clicking the switch's name or its Yes or No flips it, as clicking its track does.
  - Changing the switch re-reads the input with the new rule and hands the core the new values, as a commit does: the graph keeps the places of states that still exist, Inspect keeps its tab and sort, a chosen state or transition that no longer exists is cleared, and the text, the table and the outputs already generated don't change. It can't be used while a sequence is being generated. It logs `CaseSensitivityChanged`.
- **R17.** **A table row** is one token as typed, trimmed at the ends: it is never split. Brackets are removed from a row. A row that is empty or only whitespace is a break.

### The Input pane

- **R18.** **Commits.** The graph, Inspect and the linked table update when the input commits, not on every keystroke: in the text box when the student types whitespace, one of `. , ? ! : ;`, a double quote or `]`, pastes or drops text, inserts several characters at once, or removes several (a cut, or deleting a selection), or leaves the text box, and, after deleting characters one at a time, when the student stops for one second. A word being typed never commits until it is finished. In the table, a commit happens when a row loses focus or a row is added or deleted. Each commit hands the core the tokens' states in order, with an empty value for each break.
- **R19.** **The table** lists the tokens one per row, a break as an empty row. A student can edit a row, add a row below the one they are in (Enter), delete a row (a button on each row), and add a row at the end. Two empty rows in a row become one when the second commits. An emptied first or last row leaves the text with the whitespace beside it, since no break can stand there. Leaving a row commits its edit, which can move the rows below it; Up and Down then reach the row that was beside it, Enter opens its row in the emptied row's place, and a Delete button pressed as the row is left deletes the row it was on, in the same commit, whatever the row's own edit (a blank row the edit already removed stays gone).
- **R20.** **Linked text and table** (`textAndTable`): the text is the one source of the input, and the table is its tokens. Typing in the text box updates the table at each commit. Editing a row changes that token's text in the text box when the row loses focus, leaving the rest of the text as typed; a row the tokenizer would split, or with a character the text drops, is written in brackets (`[No!]`, `[ice cream]`, `[a+b]`). Adding a row inserts its token after the row above, separated by a space (none before `. , ? ! : ;`); deleting one removes its token and one space beside it; an empty row is written as a blank line.
- **R21.** **Starting input.** The input starts as the student's saved text, or else the authored starting text. When the author turns the Input pane off in Data mode, the graph is built once from the starting text and students explore it without editing it; nothing about the input is saved. With no starting text either, the Graph pane says "No data was provided for this activity." In table-only mode the starting text fills the table through the tokenizer. While a sequence is being generated, the text box and the table are read-only.
- **R21a.** **Authoring refuses a setup with nothing to work with.** The authoring form shows an error, and doesn't send the setup to the Activity Player, while Data mode is usable with the Input pane off and an empty or whitespace-only starting text, or while every pane is off. The error names what to change and says the change isn't saved until then.

### The Inspect pane

- **R22.** Two tabs, States and Transitions, in the ARIA tabs pattern.
  - **States:** State and Count.
  - **Transitions:** Transition (`the → cat`), Count, and Probability as "2 of 3 = 67%", rounded to a whole percent.
  - Both start sorted alphabetically (Transitions by the first state, then the second), the comparison the generator's starting-state list uses. Clicking a column's header sorts by it ascending, again descending; the header reports `aria-sort` and shows ▲, ▼ or ↕. Equal values keep alphabetical order.
  - With no input it says there are no states yet.
- **R23.** The tables follow every commit, and keep the student's tab and sort.

### Linked highlighting

- **R24.** **One selection** for the whole workspace: a state, a transition, an output, or nothing. Choosing one replaces the last.
  - A state is chosen by clicking it in the graph, clicking its row in Inspect States, or focusing a row of the input table. Focusing an empty row clears the selection.
  - A transition is chosen by clicking its arrow in the graph or its row in Inspect Transitions.
  - An output is chosen by clicking it in the output.
  - The text box is not a source: clicking in it places the cursor.
  - Every source but the graph works from the keyboard. Each table is one stop in the Tab order, and Up and Down move between its rows. Each output takes Tab and is chosen with Enter or Space, an option of the shared output that only the workspace sets. A chosen Inspect row or output reports `aria-pressed`.
- **R25.** **What lights up.**
  - A state: in the graph as a selected state is today; its Inspect States row; the Transitions rows into and out of it; and every table row and text-box word that is that state.
  - A word lit in the text box also has a 2 px line under it, teal for a chosen state or transition and dark pink (#c0006b) for an output, so its pale fill isn't its only mark. A Transitions row lit as into or out of the chosen state is described as "Into the chosen state" or "Out of the chosen state", which its border shows by color, and an Inspect row lit for an output as "In the highlighted output". Every lit Inspect row's text is bold, so its fill or border isn't its only mark.
  - A transition: its arrow and its two states, the rest faded; its Transitions row and its two States rows; and every place in the table and the text where the first state is directly followed by the second.
  - An output, in pink: its path in the graph; the States rows of its states and the Transitions rows of its steps; and every table row and word that is one of its states.
  - In each pane other than the one the choice was made in, the first highlighted row or word scrolls into view.
- **R26.** The text box shows highlights behind the student's text while it stays an ordinary, editable text box.
- **R27.** **Unclicking.** Clicking the chosen thing again clears it (a table row stays chosen while it has focus); so do clicking the graph's background, pressing Escape in the workspace, and a Clear highlight button shown while something is chosen. Clear Output also clears a chosen output.
- **R28.** While a sequence plays or steps, nothing can be chosen, and the generator's own highlighting shows in the graph. A commit that removes the chosen state or transition clears the selection. In Data mode, a commit, a CSV upload or the case switch that changes the values hands the graph also clears a chosen output, which was made from the old values; a chosen state or transition that still exists stays.

### The graph and the generator

- **R29.** The Graph pane shows the graph as the plugin's dataset mode does (auto-arranged, dragging, zoom, double-click for a state's read-only probabilities), with a toolbar of Select, Fit, Recenter, Zoom In and Zoom Out. Fit and Recenter bring the graph to the view's center even when it sits away from the origin, as what is left of a long input cut short can. The graph's corner zoom buttons aren't drawn in the workspace. Reset and Back to Main Menu are left out. With no input the pane says to type or table some words. The workspace's toolbar buttons sit 4 px apart rather than 10 px, and go into two columns when the pane is shorter than the toolbar (Data mode's five tools below a 222 px row). While stacked, the column count follows the starting row's height. The plugin's toolbar is unchanged.
- **R29a.** **The graph keeps still while the input grows.** When a commit changes the graph, the states already drawn stay where they are and only new states are placed, each in its slot (MARK-16's R10b), so a text typed a word at a time ends up where the whole text would. This is an option of the shared `Graph` that the workspace turns on. With it on, a state that arrives with an x and a y is treated as placed, ready for MARK-17's saved positions.
- **R29b.** **Speed with a large input.** With a 20,000-character input (about 4,000 tokens and 700 states), a commit that adds a word redraws the graph in under 600 ms in headless Chrome, measured and recorded in the PR (not a CI assertion). The shared `Graph` stops laying out again a graph it has already laid out.
- **R29c.** **The view follows the graph until the student takes it.** After a commit the graph is fitted to its pane, until the student zooms or pans (the wheel, a background drag, or Zoom In and Zoom Out). From then on commits leave the view where the student put it. Fit returns to following; so does a commit laid out whole. The workspace's fits animate over 250 ms. The CODAP plugin fits after every change, instantly, as today.
- **R30.** The Sequence generator pane holds MARK-14's `Generator` and `SequenceOutput` with the plugin's behavior: Play, Pause, Resume, Step, Cancel, Clear Output, both speeds, and output highlighting. They, and the state dialog, look as they do in the plugin, through styles shared with the workspace without changing the plugin's compiled CSS.

### Saved state

- **R31.** The interactive state gains the student's input: `{ version: 1, input: { text } }`, handed to the library's `setInteractiveState` at each commit that changes it and read back when the interactive opens. The library posts a state 2 seconds after the last call, so steady typing saves at each pause. MARK-13's `{ version: 1 }` still reads as no saved input, and is still saved when the interactive opens with none. Everything else a student sees is MARK-17's.
- **R32.** Reading an interactive state never fails: a missing, `{}`, JSON-string or malformed state, or an `input.text` that isn't a string, reads as no saved input. The input takes up to 50,000 characters, in the text box and through the table's edits: a row edit that would pass the limit is refused, with a note. The interactive state's reader and `readAuthoredState` parse their input with one shared function.

### Logging

- **R33.** The interactions logged, with their data, are listed in `LOGGED-EVENTS.md`, which MARK-16 to MARK-19 extend. The shared core logs:
  - **Generator:** `SequencePlayed`, `SequenceStepped`, `SequencePaused`, `SequenceResumed` and `SequenceCanceled`, each with the generator's settings; `SequenceGenerated` with the sequence's states and the settings; `GeneratorSettingChanged` (a text field's on losing focus with a changed value); `OutputCleared`; `OutputSelected`.
  - **Graph:** `StateSelected` and `TransitionSelected` with `source` (`graph`, `inspect` or `table`); `SelectionCleared` with `via` (`toggle`, `background`, `escape`, `button` or `table`); `StateDialogOpened`; `StateMoved`. The workspace draws its own graph pane, so in the AP `StateDialogOpened` and `StateMoved` come from `workspace.tsx` and `graph-pane.tsx`.
  - **Drawing view** (reached in the AP with MARK-16): `StateAdded`, `TransitionAdded`, `StateDeleted`, `TransitionDeleted`, `StateEdited`, `TextToGraph`, `GraphReset`.
  - Fit, Recenter, zoom and tool changes are not logged.
- **R34.** The workspace logs `InputCommitted` (view, token and state counts, and how it committed), `TableRowAdded`, `TableRowDeleted`, `PaneOpened` and `PaneClosed`, `PaneResized` (the divider and the resulting sizes, once per drag, and once when a divider the keys moved loses focus), `InspectTabChosen`, `InspectSorted`, and `CaseSensitivityChanged` (`caseSensitive` and the number of states).
- **R35.** Event names come from one typed list, and a Jest test fails if that list and `LOGGED-EVENTS.md` differ in either direction.

### Cleanups moved from MARK-14

- **R36.** `registerObservers` and its call are deleted. Of `codap-helper.ts`'s exports only `initializePlugin` stays; the unused ones (`getCaseValues`, with its unchecked `.success`, among them) and the CODAP host's commented-out imports go. CODAP is sent the same requests as before.
- **R37.** `graph.tsx` is split into modules by concern (the component, the drawing, the highlighting, the edge geometry), with no change in what it draws or how it responds. Its unused `mode` prop goes. The drag handlers and `d3.drag()` are typed with `d3.D3DragEvent` in place of `any` (Ethan McElroy's MARK-14 review).
- **R38.** The interactive's code may import the shared core but never the CODAP host or utilities, enforced by extending MARK-14's lint boundary to `src/interactive/` and adding `codap-request` to it (Ethan McElroy's MARK-14 review). A Jest test lints a CODAP import in an interactive file and fails without the rule.
- **R38a.** The shared core stops what it started when it unmounts: the generator's animation interval and the loop that waits for the graph's size before moving an older drawing's origin. A Jest test fails if either cleanup is deleted (Maureen E. Zitouni's MARK-14 review).
- **R38b.** Tests cover the generator's delimiter controls and committing Max Length on losing focus, each failing if the line it guards is removed (Maureen E. Zitouni's MARK-14 review).

### Verification

- **R39.** Jest covers the pure parts with expected values written out: the tokenizer, the table's edits, the graph's placement rules (R29a), the dividers' limits and the narrow fit, the toolbar's height and two-column flip, the authoring check, the configuration function, the case switch's settings, the Inspect rows and sorting, the highlights, reading the interactive state, and the log list.
- **R40.** Cypress, on MARK-13's fake Activity Player page, covers the commits, linked editing, each input view, each selection and way of unclicking, the output's pink path, collapsing, each divider (limits, keys, reported height), following the graph, the generator's 235 px fit, the toolbar's measured height and two columns, the proportional row, the no-data message, saved input on reopen, the log messages, a steady reported height, Lato, the case switch and label, the controls row's wrap, and the authoring form's new setting and error. MARK-13's runtime and demo tests that read the placeholder now check the workspace; `standalone.test.tsx` stubs `Graph` and `ResizeObserver`.
- **R41.** Every existing plugin test passes unchanged, apart from `log: jest.fn()` in `markov-tool.test.tsx`'s recording host and the `calculateNodeFontSize` cases in `graph-utils.test.ts`, which call the renamed `calculateNodeFontSizes`. The plugin's test files gain only new cases and shared helpers: an `isPlaced` block in `graph-utils.test.ts`, the output's keyboard and heading options in `sequence-output.test.tsx`, the state with no transitions in `node-modal.test.tsx`, a Step-clears-fading case in `highlighting.test.ts`, and the double-click wait and graph colors in the Cypress support files. The CODAP plugin's production build differs from MARK-14's only in the code the plugin-side changes touch, each an option the plugin doesn't set or a change that leaves its behavior as it is, except three deliberate fixes: Reset also resets the speed the animation reads, so a sequence played after Reset runs at the Normal speed the switch shows; and a state with no transitions out shows "None" under "Transition Probabilities" in its read-only dialog, in place of "To : 100%", though the drawing view's dialog doesn't change; and Clear Output also unchooses the chosen output, so a cleared sequence no longer stays highlighted in the graph. Its compiled CSS is unchanged, and a headless check in CODAP 3.1.2 shows the plugin unchanged (MARK-12's R11 list).
- **R42.** The build, both `tsc` checks and the three lint commands are clean.
- **R43.** README: the Markov Interactive section says the runtime is the student workspace, and points to `LOGGED-EVENTS.md`.

## Technical Notes

### Where the code is

- `src/interactive/input/`: `tokenizer.ts` (`tokenize`, `tokensToValues`, `rowText`, `textForRow`, `textChange`, `commitsOnTyping`) and `table-edits.ts` (`editRow`, `insertRow`, `deleteRow`).
- `src/interactive/workspace/`: `workspace.tsx` (the input text and the `committed` `{ text, tokens }`, commits, presses, selection, pane state, following), `ap-host.ts` (`useApHost`), `workspace-config.ts`, `pane.tsx`, `divider.tsx`, `pane-sizes.ts` (every layout number, set as CSS custom properties so no size is written twice), `use-measured-size.ts`, `input-pane.tsx`, `text-input.tsx`, `input-table.tsx`, `commit.ts`, `inspect-pane.tsx`, `inspect-rows.ts`, `highlights.ts`, `scroll-to-lit.ts`, `graph-pane.tsx`, `generator-pane.tsx`, `setting-switch.tsx`, `use-latest.ts`.
- `src/components/`: `graph.tsx` split into `graph-draw.ts`, `graph-highlight.ts` and `graph-geometry.ts`; `log-events.ts`; `markov-panel.scss` (the generator, output and state dialog styles as mixins that `app.scss` and `workspace.scss` both include). `src/hooks/use-markov-tool.tsx` gains transition selection, `selection`, `selectState`, `selectTransition`, `clearSelection` and the unmount cleanup.
- `src/interactive/parse-state.ts`: the parser `readAuthoredState` and `readSavedInput` share.
- The configuration's output for every mode and input view is written out in `workspace-config.test.ts`.

### The graph

- **The graph's height.** The plugin's SVG is `calc(100vh - 20px)` tall. In the Activity Player the frame is sized to the reported height, so a viewport-sized graph grows the frame without end (a throwaway sent 167 height messages in 3 s, up to 81,028 px). The workspace's stylesheet sets the SVG's height to 100% of its pane.
- **The cost of a commit** at 20,000 characters (3,950 tokens, 714 states) was 2.1 s on MARK-14's code: the layout ran twice per change, once for a redraw of the old graph whose states were already pinned. Skipping the ticks when every state is pinned took it to 1.1 s; laying out only the new states (the old ones pinned, alpha 0.3 for 30 ticks) to 0.46 to 0.59 s. `drawGraph` stops the simulation's own timer and sets the states' and labels' positions itself after the layout. In the workspace the input table and the label sizing also count: every table row rendering again at each commit, and each label laying the page out once for each font size it tries (about ten per label), put a production commit at 0.49 to 0.76 s. Table rows are memoized, so a commit renders only the rows it changes, and the labels are measured together, each in its own element, so each step lays the page out once for all of them, with the same sizes as before.
- **Following.** `onUserZoom` fires for a gesture whose transform changed from the one at the zoom's start by a scale change or more than 4 px, not from the pointer's `clientX`, which a `TouchEvent` lacks. With `onBackgroundClick` set, the zoom's `clickDistance` is 4, so a tap that moves a little still clears.
- **Redraws.** The draw effect reads the selection and its setter through refs, so a selection restyles the graph rather than rebuilding it (a rebuild is 377 ms at 700 states). `animating` stays in its dependencies, since in the plugin's Drawing view only the rebuild clears a selection's fading for Play and Step. `GraphPane` keeps every callback it hands `Graph` stable through `useLatest`.
- **Resize refits.** A resize while following fits on `pointerup` and again when the graph measures its new size, armed only when the graph has not yet measured the resize's last move.

### The Input pane

- **Commit decisions** come from a diff of the old and new text (`textChange`), since Cypress's `type` sends input events with an empty `inputType`. Two exceptions: an `insertText` event's `data` is taken as the typed character, since the diff can't tell "c" typed over a selected "cat" from a deletion; and a paste or drop (`insertFromPaste`, `insertFromPasteAsQuotation`, `insertFromDrop`) commits at once, since pasting "bat" over "cat" looks to the diff like typing "b". Characters are counted as code points, so an emoji is one. While an input method composes, nothing commits; `compositionend` decides from the text the composition started with, by the same rules, so a single composed character waits for what ends its word, as a typed letter does.
- **Presses.** A blur during a press on the Graph or Inspect body commits after the press's `mouseup` (through a `setTimeout(0)`), since a commit under the press redraws what was pressed and loses the click. Presses are noted with primary-button `mousedown`/`mouseup` captured on the window (d3-drag stops `mouseup` there), also ended by `pointercancel`, `dragend` and `contextmenu`. A blur clears the pending deletion timer.
- **A commit whose values equal the last** skips `dataChanged` and `InputCommitted`, but still updates `committed` and saves, so a text-only edit ("Cat" to "cat" under `lowercase`) is kept.
- **Highlighting the text box**: a `textarea` can't style part of its text, so a backdrop behind a transparent `textarea` renders the same text with `mark`s, both scrolling with a scrollbar so their wrap widths agree.
- **Table edits**: a break's span runs to the next word; an inserted or edited word gets a space wherever it would run into another; a word alone on its line goes with the line break after it; a dropped `[` that an edit would let pair becomes `(`. A seeded random round trip (lone brackets included) checks the edits against the tokenizer.
- **50,000 characters**: an Activity Player answer has about 450 KB of a Firestore document; 50,000 characters is at most about 150 KB as JSON, leaving room for MARK-17.

### Layout

- `[hidden]` loses to the panes' `display: flex`, so `.markov-workspace [hidden] { display: none !important; }`.
- Dividers are absolutely positioned on the edge of the pane before them, centered on the gap; no pane takes a stacking context, so the next pane's divider can rise above it. `useMeasuredSize` reads the element's size at first layout until the resize observer's first report.
- A divider move that leaves it within half a pixel of where it was drawn restores the stored sizes and logs nothing, so fitted widths in a narrow row don't overwrite the student's.
- The generator's controls column uses `line-height: 1.2`, with 5 px gaps between its groups and 4 px inside a group, under `.markov-workspace`, so its default controls are 172 px in Lato. With the 20 px heading row and the 5 px below it they fill the 197 px inside a 235 px generator exactly, with the "none" and "space" delimiters; "other" scrolls by 26 px.

### Tests

- DevTools input in the fake page's frame (`Input.dispatchMouseEvent`, `Input.dispatchTouchEvent`, `cy.press`) leaves the Cypress run unable to exit, so presses, taps, Tab, drags and pinches are dispatched as synthetic events in the frame (`pressEvents`, `pressTab`, `dragDivider`, `dragEvents`, `pinch` in `cypress/support/workspace.ts`). The click goes to the common ancestor of the `mousedown` and `mouseup` targets, so a redraw mid-press loses it as a real one does. Enter or Space activating a button can't be sent this way.
- `@types/node` 24 is a dev dependency: the 18 that Jest's packages bring clashes with TypeScript 6's lib.
- The import-boundary test runs ESLint through `spawnSync`, since ESLint's API loads its config with a dynamic `import()` that Jest refuses.
- `stateLabels`, `loggedEvents` and similar Cypress helpers are retrying queries (`invoke`, not `then`), which would read once and race renders.

### For MARK-16 and MARK-17

- Inspect's Count and "2 of 3" assume counts; Draw mode's weights are not counts, so MARK-16 decides what its Inspect shows. MARK-16 also gives `Pane` its no-collapse option and checks Draw mode's nine-tool toolbar in two columns (below a 366 px row).
- Words added in the table are written as prose; with "Order matters" off MARK-16 writes them one per line.
- Each mode keeping its own work means one core state per mode, which the hook allows.
- MARK-17 saves the pane sizes, the linked split, the case switch's value and the graph's positions (handed back as nodes with `x` and `y`).
- The demo page keeps a runtime's interactive state across authoring changes, as the Activity Player keeps a student's, except that a changed starting text clears it, so the workspace restarts from the new text. In the Activity Player saved input still comes before the starting text.

## Out of Scope

- The probabilities toggle, "Order matters" and its switch, the bag of words, Draw mode and the Data/Draw switch (MARK-16).
- Saving outputs, layout (open panes and pane sizes), selection and generator settings; the read-only report view; the history scrubber (MARK-17).
- Send to CODAP and Download tables (MARK-18); the dashboard summary (MARK-19).
- Any change a CODAP user can see, including the ELA module's documents, apart from R41's three fixes (the Reset speed, the dialog of a state with no transitions, and Clear Output unchoosing the chosen output).
- Choosing tokens in the text box by clicking them: the text box is for editing.
- Starting the input table from an uploaded CSV (MARK-23).

## Decisions

### Whose story extracts the core's state from `MarkovTool`?
**Context**: the workspace needs the core's state with its own layout (R3).
**Options considered**:
- A) MARK-15 extracts a hook from `MarkovTool`.
- B) MARK-14 does it while it moves `App`.

**Decision**: B (Doug). MARK-14 already moved every line involved and had the tests that guard it, so the code moved once; MARK-15 adds transition selection.

---

### Does `InputCommitted` log the student's text?
**Context**: researchers may want what students typed, but a commit happens at every space and the text can be 50,000 characters.
**Options considered**:
- A) Counts only.
- B) The full text on each commit.
- C) The text on leaving the text box, counts otherwise.

**Decision**: A (Doug). The saved interactive state holds the text, and MARK-17's answer history keeps each version.

---

### Can students resize the panes?
**Context**: fixed sizes left a student who needs a bigger graph or longer output only the collapse buttons.
**Options considered**:
- A) Fixed sizes.
- B) Draggable dividers with per-pane minimums; a drag stops at a minimum.
- C) B, with a drag past a minimum collapsing the pane.

**Decision**: B (Doug, R13a). C would suddenly hide a pane mid-drag. A flat 50 px minimum leaves almost no graph beside the 40 px toolbar.

---

### The divider's grab band covers the panes' padding, not 24 px
**Context**: WCAG 2.5.8 asks for 24 px targets; a 24 px band would need extra padding beside each divider, leaving gaps beside the headers.
**Decision**: an 18 px band over the gap, borders and 4 px of each pane's padding (13 px for the row divider, clear of the generator's header), Doug's choice. The shortfall from 2.5.8 is recorded in R13a.

---

### Starting sizes and minimums
**Decision**: Input 280 px, Inspect 260 px, the graph the rest; the row 315 px and the generator 235 px, 614 px in all with the workspace's own row and the panes' 8 px gap around its edges, to fit a Chromebook screen (Rebecca left the height to us; Doug kept the Chromebook budget). The generator's minimum is 235 px: 220 px gave its controls the same 5 px padding as the other panes (Doug), and Rebecca's "Controls" heading needs 15 px more, which the row gives up, so the workspace's total height stays the same.

---

### The student-view mockup answers (Rebecca, 2026-11-02)
**Decision**:
- A collapsed pane is a 32 px strip with its title running down it; a collapsed graph's space goes to Input and Inspect in proportion, and the Graph pane collapses in Data mode (questions 2, 22).
- Every graph control in one toolbar: Select, Fit, Recenter, Zoom In and Zoom Out; no Reset or Back to Main Menu (question 5).
- The table: a delete button per row, Enter to add, an empty end row to append; no reordering (question 6).
- Text from a table is prose while every graph is a Markov chain (question 7).
- Highlight colors: the graph's green for a choice, its blue and orange on Transitions rows, pink for an output; Clear highlight in the workspace's own row (questions 8, 9).
- Outputs alternate very light blue and cream (question 11).
- The linked split starts at 40% text box, with a divider (question 12).
- The generator's controls are a column on the left, collapsing to the left (question 23).
- The text box shows what was typed; students get a "Case sensitive" switch the author can hide, with a read-only label in its place (question 31, follow-up F).
- Stacked, a pane collapses to its header and the panes below move up (question 32).
- Clicking a word in the text box places the cursor and chooses nothing (question 33).
- A Data mode with nothing to show says "No data was provided for this activity.", and the authoring form refuses the setup (question 34, R21a).

---

### Commits on separators, with a pause for deletions
**Context**: committing on any deletion would make "ca" and "c" states while backspacing through "cat".
**Decision**: deletions commit after a one-second pause; typing commits on separators. Detection is a text diff rather than `inputType`, because Cypress's `type` sends an empty `inputType`; an `insertText` event's `data` overrides the diff for a letter typed over a selection.

---

### Each table is one Tab stop
**Context**: at the 50,000-character limit the input table had about 7,900 stops and Inspect about 714.
**Decision**: roving `tabIndex`, Up and Down between rows; a table row is chosen by focus, an Inspect row with Enter or Space.

---

### A Delete button pressed as a row is left acts on the press
**Context**: leaving a row commits its edit at the press, which can move the rows before any click. A press that ends off the button, or a Ctrl+click on a Mac, therefore still deletes the row, where a normal button would do nothing. With no row being edited, a press that ends without a click does nothing.
**Decision**: keep it (Doug). It needs a student mid-edit to change their mind during the press, and the row can be retyped. Acting on the click instead would mean holding the row's commit until the press ends, reworking the press handling for a rare case.

---

### Table rows stay chosen while focused, and scrolling skips the source pane
**Decision**: clicking into a chosen row to edit it would otherwise unchoose it, and scrolling the pane the click came from would move the row under the pointer.

---

### The workspace clears a dropped selection, not the core
**Context**: in the plugin, a dataset edit that removes the selected state leaves every state faded.
**Decision**: clearing it in the core would change the plugin (R41), so the workspace clears its own, through a setter that logs nothing.

---

### Only the public selection functions log
**Decision**: the core's internal clears (an output selection clearing a state, Reset) would log a `SelectionCleared` the student never asked for. A call that leaves the selection as it was logs nothing. `ClearVia` gains `"table"` for focusing an empty row.

---

### Saving at each commit relies on the library's debounce
**Decision**: `setInteractiveState` is a trailing 2-second debounce in lara-interactive-api, so steady typing posts once per pause, which MARK-17's history needs.

---

### `keepPositions` pins every placed state
**Context**: a commit that only changes counts builds new nodes, all placed but none pinned, and fell through to a full layout (0.7 s, every state moving).
**Decision**: placed states are always pinned first, so such a commit runs no ticks.

---

### Arrows and loops are selectable only through new opt-in props
**Decision**: loops take `pointer-events: none` outside the delete tool and routed clicks to `onNodeClick`; with `onEdgeSelect` set they take clicks and choose the transition. The plugin passes none of the new props.

---

### A state with no transitions says None in its dialog
**Decision**: the read-only dialog showed "To : 100%" for a state with no transitions out (the only state, or the last word of a text), because the rounding added a row to an empty list. Rebecca asked for "None" under the heading, fixed in the shared code so the plugin gets it too. It is keyed on the state's transitions rather than the percentages, which are empty on every dialog's first render. The drawing view leaves the section out for fewer than two transitions, as it did.

---

### The Reset speed fix in the plugin
**Decision**: Reset now also resets the speed the animation reads, not only the switch, so a sequence after Reset runs at the Normal speed shown. It is one of three deliberate behavior changes in the CODAP plugin (R41).

---

### Cypress input is dispatched in the frame
**Context**: DevTools mouse, touch and key input in the fake page's frame passes the spec and then never ends the run, which would hang CI.
**Decision**: every press, tap, Tab, drag and pinch is a synthetic event sequence in the frame, matching the order a browser sends; Enter or Space activation of an Inspect row is tested by clicking the focused row.

---

### The standalone Jest test stubs only `Graph` and `ResizeObserver`
**Decision**: Jest can't load `d3`; `nanoid` is reached only through `drawing.tsx`, which the workspace doesn't import, and jsdom has no `ResizeObserver`.

---

### Measured sizes at first layout
**Decision**: the resize observer's first report can come late (Cypress's frame showed it), so the row and the linked split are measured at first layout, and a divider moved before the report has the room it lays out with.

---

### Gaps found at the cross-reference stage
**Decision** (Doug): the table's edits respect the 50,000-character limit; the linked split is mockup question 12; the shared state parser is named in R32.
