# The AP Interactive's Workspace, with Linked Text, Table and Inspect Panel

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-15
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Replace the AP interactive's runtime placeholder with the student's workspace: an Input pane (text, table, or both, linked), the graph, an Inspect pane with the states and transitions, and the sequence generator with its output below. Everything a student clicks lights up in every pane that shows it. The workspace runs MARK-14's shared Markov components through an Activity Player host, which saves the student's input and logs their interactions.

## Project Owner Overview

MARK-13 gave the AP interactive its authoring form and a placeholder that lists the settings. This story is the first one students can use: they type or table their words, and the graph, the counts and the probabilities update together. Clicking a word in the table, a state or arrow in the graph, or a row in the Inspect pane lights up the same thing everywhere, including the words in the text box; clicking a generated output lights up its path, its rows and its words in pink.

Every authored setting decides what loads and what starts open, and this spec says exactly how, so the student-view mockups Rebecca reviews and the stories after this one (MARK-16's probabilities, bag of words and Draw mode; MARK-17's saved work; MARK-18's Send to CODAP) slot into the same workspace without rework. The CODAP plugin, and the ELA module that uses it, do not change.

## Background

- **MARK-13** (PR #88) built the interactive: `src/interactive/`, its authored state (`authored-state.ts`, read by `readAuthoredState`), the runtime placeholder (`runtime.tsx`), report mode, the standalone page, the report item and the demo page. Its runtime saves `{ version: 1 }` as the interactive state when it opens with none (`interactive-state.ts`).
- **MARK-14** (PR #89, merged; spec `specs/MARK-14-shared-components.md`) is the shared core this spec builds on: `MarkovTool` takes a `MarkovHost` prop (`viewMode`, `setViewMode`, `markDirty`, `outputSequence`), with `loadState` and `dragging` as its own layout props, and exposes a `MarkovToolHandle` ref (`getGraph`, `loadDrawing`, `dataChanged`); `Generator` and `SequenceOutput` are components that take their values and handlers as props (`GeneratorProps` and `SequenceOutputProps`, exported); the core's state, effects and handlers live in a hook, `useMarkovTool(host)`, returning a `MarkovToolApi` that any layout can place (MARK-14's R1a), with the handle's functions in it too, as one object that keeps its identity for the hook's lifetime; `chainsToGraph` and `graphFromValues` (`src/utils/chain-graph.ts`) count states and transitions, an empty value breaking the chain. MARK-14 leaves the AP's modes to MARK-15: its `ViewMode` is the CODAP plugin's two modes and the saved document's field. The names this spec uses were checked against MARK-14's code.
- **Rebecca's doc**, "Markov Tech Specs (AP)": "Refactor the two modes"; "New elements as result of refactor" (layout, Inspect Graph pane, input linking, dynamic linking, output box); question 1 and follow-up A (tokens and brackets); "Where we landed" (capitalization an author setting, a blank line breaks the chain in text and table). Her two layout images predate the split into the AP interactive and are reference only: there is no table dropdown (the table is built in), in linked mode the text box sits above the table (Rebecca, 2026-10-29), and Draw mode has no Input pane.
- **The later stories** this one leaves room for: MARK-16 (the probabilities toggle, "Order matters" and its switch, Draw mode and the Data/Draw switch), MARK-17 (saving everything a student sees, the report view and the history scrubber), MARK-18 (Send to CODAP and Download tables), MARK-19 (the dashboard summary).

## Requirements

### The workspace and its host

- **R1.** In `runtime` mode the interactive shows the workspace in place of MARK-13's placeholder. `report` mode keeps MARK-13's placeholder and note (R13 of MARK-13) until MARK-17 builds the read-only view.
- **R2.** The workspace runs the shared core's tool state, the generator, the output and the graph, through an AP host that implements MARK-14's `MarkovHost`:
  - Data mode reaches the core as its `"dataset"` view mode, since in both the graph is rebuilt from a list of values with an empty value as a break, and probabilities are read-only. `setViewMode` does nothing, since the workspace has no mode menu and no Back to Main Menu.
  - The workspace hands the core each committed input as values through the core's `dataChanged` (R18), so the core never sees text or rows.
  - `markDirty` does nothing: the core calls it only in its drawing view and on choosing a mode, and the workspace saves when the input commits (R31).
  - `outputSequence` resolves at once and sends nothing (MARK-18 adds the data saved for CODAP).
  - Every host function keeps its identity across renders, as MARK-14's `MarkovHost` comment requires.
  - The workspace has no loading state: it renders only once the init message has arrived, carrying both states (MARK-13's hosted app shows "Loading..." until then), and the standalone page has its settings at once. `loadState` and `dragging` are `MarkovTool`'s layout props in MARK-14, which the workspace doesn't render.
- **R3.** The shared core's state (the graph, the selection, generation and its animation, the output's sequence groups, the generator's settings) is usable without `MarkovTool`'s CODAP layout, so the workspace lays out the same graph, generator and output in its own panes. The CODAP plugin keeps its layout and behavior exactly: MARK-14's tests, and every other existing plugin test, pass unchanged.
- **R4.** `MarkovHost` gains `log(event, data)`, called by the shared core at each interaction R33 lists. The CODAP host's `log` does nothing, so the CODAP plugin sends CODAP nothing new. The AP host's `log` calls the library's `log`. The standalone page's does nothing.
- **R5.** Opened standalone (MARK-13's R14), the interactive shows the workspace with its URL's settings and MARK-13's note that nothing is saved; it saves and logs nothing and makes no library call. Inside a host the URL is still ignored.

### Loading from the authored settings

- **R6.** One pure function maps an authored state (as `readAuthoredState` reads it) and a mode to the workspace's configuration: which panes are present and which start open, what the Input pane holds, the tokenizer's starting capitalization and whether students get the "Case sensitive" switch (R16a), and the controls later stories render (the Data/Draw switch, the "Order matters" switch and its starting value, the probabilities toggle and its starting value, Send to CODAP and Download tables). The workspace renders from it, and the component inventory below is its output, so the two cannot disagree.
- **R7.** **Modes.** The workspace opens in `startingMode` (MARK-13's R10 already makes it an available mode). In this story, Draw mode shows a short message that it arrives in a later version in place of the workspace; MARK-16 builds it, and its Data/Draw switch (shown only with both modes). The configuration for Draw mode is complete here: no Input pane, the Graph pane always present and open, and Inspect and the generator as authored.
- **R8.** **Panes in Data mode.** Input, Graph, Inspect and the Sequence generator each appear only when `available`, and start open or collapsed as `startsOpen` says. A collapsed pane keeps its contents and state (the input, the graph's layout, the selected tab and sort, the generator's settings and the outputs) and shows them unchanged when reopened.
- **R9.** **Input view (Data mode).** `text`: the text box only. `table`: the table only. `textAndTable`: the text box above the table, linked (R20). The Input pane's view never changes at runtime.
- **R10.** **Settings that belong to later stories** are in the configuration but not rendered here: the "Order matters" switch and its starting value (MARK-16; until then every graph is a Markov chain), the probabilities toggle and its starting value (MARK-16; shown only where the Graph pane is present, since its labels are drawn on the graph), Send to CODAP and Download tables (MARK-18).

### Layout

- **R11.** The Input, Graph and Inspect panes sit side by side, in that order, with the Sequence generator below them across the full width. A pane that is not present takes no space, and the panes that remain share the row:
  - The graph is the pane that stretches. When the Graph pane is collapsed, or not present (the author turned it off, which MARK-13 allows only without Draw), Input and Inspect share the row in proportion to their widths, so the row is never left with empty space: Rebecca's example is 25-50-25 becoming 50-0-50, and 25-25-50 becoming 33-0-67 (mockup questions 2 and 22). One of them open alone takes the row.
  - When none of Input, Graph and Inspect is present, the row isn't drawn and the Sequence generator sits at the top of the workspace.
- **R12.** Each pane has a header with its title (Input, Graph, Inspect, Sequence Generator) and a button that collapses and reopens it, which says which it will do, reports `aria-expanded`, and works from the keyboard. Draw mode's Graph pane is the exception: it is always open (R7), so it has no collapse button (MARK-16 builds Draw mode, and with it this exception). The generator's controls (starting state, length, delimiter, speed, Play and Step) sit in a column on the left of the output, as Rebecca's doc lays them out, and collapse on their own, so the output can take the generator's full width (mockup question 23).
- **R13.** The workspace is laid out for a full-width Activity Player item (1,044 px in the Standard layout, 904 px in iPad Friendly, MARK-13's R18). Below 700 px of the workspace's own width the side-by-side panes stack, so a narrower placement has no sideways scrolling. The workspace's own row of controls above the panes (Clear highlight and the case control here; MARK-16 and MARK-18 add theirs) wraps onto another line when its controls don't fit, rather than running past the workspace's edge; the wrapped line adds to the workspace's height. Nothing in the workspace is sized from the viewport: the frame is sized to the reported height (MARK-13's `useFrameHeight`), so the panes have set heights (R13a) and the graph fills its pane.
- **R13a.** **Resizing panes.** Students resize the panes by dragging dividers: one between Input and Graph, one between Graph and Inspect, and one between the row of panes and the Sequence generator.
  - Dragging a divider moves space between the two panes beside it, and the workspace's total width and height stay the same. The panes start at the default sizes (mockup question 1): Input 280 px, Inspect 260 px, the graph the rest, the row 330 px tall, the generator 210 px tall with its output scrolling. With the workspace's own row of controls above them, the workspace is about 580 px tall, so it fits a Chromebook's 1366 by 768 screen below the browser's toolbars and the Activity Player's header. The generator starts at its minimum, so the divider above it first moves only up, giving the output more room.
  - Each pane has a minimum: Input 160 px wide, Graph 200 px, Inspect 220 px; the row 200 px tall, the generator 210 px tall (its header and its column of controls, beside the output: measured at 173 px with the default delimiter, 199 px with "other" and its text field). The controls column scrolls when it is taller than the generator's body, which only the "other" delimiter makes it at the minimum. A divider stops when either pane beside it reaches its minimum; dragging never collapses a pane, which stays the collapse button's job (R12).
  - A divider shows only between two open panes: not beside a collapsed strip, not between Input and Inspect when the Graph pane is collapsed or not present (they share the row as R11 says), not above a collapsed or absent generator, not below a row whose panes are all collapsed, and not below 700 px, where the panes stack (R13).
  - When the workspace is narrower than the chosen widths allow, Input and Inspect give up width, down to their minimums, so the graph keeps its own; the chosen widths come back when there is room again.
  - Each divider is a focusable separator that reports its position and range to a screen reader; the arrow keys move it 10 px. It works with a mouse, a pen and touch, and can be grabbed anywhere in a band at least 24 px across, wider than the grip it shows, so a finger can find it on a touchscreen. A pane keeps the part of that band over its edge clear of its controls, so grabbing a divider never presses a button or a scrollbar.
  - In the linked view (`textAndTable`) a fourth divider sits between the text box and the table, starting the text box at 40% of the Input pane's height (mockup question 12). It moves space between the two, each keeping at least 60 px, and it shows wherever the Input pane is open in that view, stacked or not.
  - A collapsed pane reopens at the size it had, and the graph is fitted when its pane reopens. When a drag or a keyboard move ends, the graph is fitted if the view is following the graph (R29c), and otherwise keeps the student's view.
  - The sizes are workspace state beside which panes are open, ready for MARK-17 to save; this story saves none (R31).
- **R13b.** **Font.** The interactive's pages (the workspace hosted and standalone, the report placeholder and the authoring form) use Lato, as the Activity Player and Concord's question interactives do, so the workspace reads as part of the page around it: Google Fonts' Lato stylesheet (weights 400 and 700) and `'Lato', arial, helvetica, sans-serif` on the body, so a network that blocks Google Fonts falls back to Arial. A state's label in the graph is sized by measuring it in the page's font, so labels are fitted in Lato without a change to the graph. The CODAP plugin keeps its font.
- **R14.** Outputs in the generator's output alternate between very light background colors, sequence by sequence, so it is clear where one ends and the next begins; a highlighted output keeps the output highlight. The CODAP plugin's output is unchanged.

### The tokenizer

- **R15.** One tokenizer turns the input into states, and the text box and the table both use it:
  - Text splits at whitespace, and each of `. , ? ! : ;` is a token of its own.
  - `" ( ) { } _ + = | \ / < >` separate tokens and are dropped, as the plugin's text does today.
  - Square brackets keep a token whole: `[No!]` and `[ice cream]` are one token each (`No!`, `ice cream`), with the space inside trimmed at the ends. A bracket runs from `[` to the next `]` on the same line with no other `[` between; any other `[` or `]` is dropped like the other separators (`[a [b] c]` gives `a`, `b`, `c`), and `[]` gives nothing.
  - A blank line (two or more line breaks with only whitespace between them) breaks the chain: no transition joins the token before it to the token after it. Several blank lines in a row are one break, and blank lines before the first token or after the last break nothing.
  - Each token keeps where it is in the text (its start and end, a bracketed token's brackets included), so the text box can highlight it (R26) and a table edit can replace it (R20).
- **R16.** **Capitalization.** With `lowercase` ("The" and "the" are the same word, the default) a token's state is its text lowercased, as the plugin lowercases text today; with `asTyped` (case sensitive) it is the text as typed. The text box and the table always show what the student typed; only the graph, Inspect and the generator's states use the lowercased form.
- **R16a.** **Students choose case sensitivity** (mockup question 31, follow-up F). MARK-13's authored state gains one setting, whether students see a "Case sensitive" switch (on by default); its existing capitalization setting, still defaulting to `lowercase`, becomes the switch's starting value, so students start at "Case sensitive: No"; the form labels it as case sensitive Yes or No. Neither changes what a saved value means, so the authored state's version stays 1, and an activity saved before the new setting shows the switch.
  - In Data mode, with the switch shown, a "Case sensitive" switch with Yes or No beside it sits beside the "Order matters" switch (MARK-16): at the top of the Input pane, or in the workspace's own row when there is no Input pane, and hidden with a collapsed Input pane, as MARK-16's R9 places that switch. When the author hides the switch, the workspace's own row shows a read-only "Case sensitive: Yes" or "Case sensitive: No" label, as MARK-16's R9a does for order. Draw mode shows neither, since it has no input. The switch's name wraps onto a second line where the space is narrower than the switch (about 151 px in Lato at 14 px), so it stays inside an Input pane at its 160 px minimum.
  - The switch and the label are one shared component pair that MARK-15 builds and MARK-16's "Order matters" switch and label use, so the two read alike.
  - Changing the switch re-reads the input with the new rule and hands the core the new values, as a commit does: the graph keeps the places of states that still exist and lays out the new ones (R29a); Inspect's rows follow, keeping the tab and sort (R23); a chosen state or transition that no longer exists is cleared, as after any commit (R28); the text box and the table don't change; the outputs already generated stay as they were, as after an edit to the input. The switch can't be used while a sequence is being generated, when the input is read-only (R21). It logs `CaseSensitivityChanged` (R34).
- **R17.** **A table row** is one token as typed, trimmed at the ends: it is never split (`No!` stays one state). Brackets are removed from a row, since a row can't hold a bracketed token. A row that is empty or only whitespace is a break.

### The Input pane

- **R18.** **Commits.** The graph, Inspect and the linked table update when the input commits, not on every keystroke: in the text box when the student types whitespace, one of `. , ? ! : ;` or `]`, inserts several characters at once (a paste or drop) or removes several (a cut, or deleting a selection), or leaves the text box, and, after deleting characters one at a time, when the student stops for one second (so a deletion commits a second later). A word being typed never commits until it is finished: a pause mid-word commits nothing; in the table when a row loses focus or a row is added or deleted. Each commit hands the core the tokens' states in order, with an empty value for each break (R2).
- **R19.** **The table** lists the tokens one per row, a break as an empty row. A student can edit a row, add a row below the one they are in (Enter), delete a row (a button on each row), and add a row at the end. Two empty rows in a row become one when the second commits, as two blank lines are one break.
- **R20.** **Linked text and table** (`textAndTable`): the text is the one source of the input, and the table is its tokens.
  - Typing in the text box updates the table at each commit (R18).
  - Editing a row changes that token's text in the text box when the row loses focus, and leaves the rest of the text as the student typed it. A row's text that the tokenizer would split, or that has a character the text drops (R15), is written into the text in brackets (`[No!]`, `[ice cream]`, `[a+b]`). Adding a row inserts its token after the row above, separated by a space (none before `. , ? ! : ;`); deleting one removes its token and one space beside it; an empty row is written as a blank line.
- **R21.** **Starting input.** The input starts as the student's saved text (R31), or else the authored starting text. When the author turns the Input pane off in Data mode, the graph is built once from the starting text and students explore it without editing it; nothing about the input is saved. If there is no starting text either (the authoring form refuses that setup, R21a, so this covers an activity saved before it), the Graph pane says "No data was provided for this activity." in place of its prompt to type (mockup question 34). In table-only mode the starting text fills the table through the tokenizer, a blank line becoming an empty row. While a sequence is being generated (playing, paused or stepping), the text box and the table are read-only.

### The Inspect pane

- **R22.** Two tabs, States and Transitions, in the ARIA tabs pattern (arrow keys move between them).
  - **States:** State and Count.
  - **Transitions:** Transition (`the → cat`), Count, and Probability as "2 of 3 = 67%": the transition's count of its state's outgoing total, rounded to a whole percent.
  - Both start sorted alphabetically (Transitions by the first state, then the second), the same comparison the generator's starting-state list uses. Clicking a column's header sorts by it, ascending, and again descending; the header reports `aria-sort`. Every sortable header shows that it can be sorted: ▲ or ▼ on the sorted column and ↕ on the others, as Rebecca's doc draws them. Equal values keep alphabetical order.
  - With no input it says there are no states yet.
- **R23.** The tables follow every commit, and keep the student's tab and sort.

### Linked highlighting

- **R24.** **One selection** for the whole workspace: a state, a transition, an output, or nothing. Choosing one replaces the last.
  - **A state** is chosen by clicking it in the graph, clicking its row in Inspect States, or focusing a row of the input table (by clicking or tabbing into it). A row chooses its committed token's state; focusing an empty row clears the selection.
  - **A transition** is chosen by clicking its arrow in the graph or its row in Inspect Transitions.
  - **An output** is chosen by clicking it in the output, as today.
  - The text box is not a source: clicking in it places the cursor to edit.
  - Every source but the graph works from the keyboard: an Inspect row is chosen with Enter or Space, and a table row by focusing it. Each table is one stop in the Tab order, and Up and Down move between its rows, so a long input doesn't put thousands of stops before the generator. A chosen Inspect row reports it to a screen reader (`aria-pressed`).
- **R25.** **What lights up.**
  - A state: in the graph, as a selected state is today (its arrows in and out colored, the rest faded); its Inspect States row; the Inspect Transitions rows into and out of it; and every table row and every word in the text box that is that state.
  - A transition: its arrow and its two states in the graph, the rest faded; its Inspect Transitions row and its two Inspect States rows; and every place in the table and the text where the first state is followed directly by the second, with no break between.
  - An output, in pink as the graph shows it today: its path in the graph; the Inspect States rows of its states and the Inspect Transitions rows of its steps; and every table row and word that is one of its states.
  - In each pane other than the one the choice was made in, the first highlighted row or word scrolls into view if it is out of view.
- **R26.** The text box shows highlights behind the student's text while it stays an ordinary, editable text box (typing, selection, undo, scrolling and screen readers behave as a text box does).
- **R27.** **Unclicking.** Clicking the chosen thing again clears it, as clicking a selected state or output does today (a table row is the exception: it stays chosen while it has focus, since clicking into it is how it is edited); so do clicking the graph's background, pressing Escape in the workspace, and a Clear highlight button shown while something is chosen.
- **R28.** While a sequence plays or steps, nothing can be chosen, as in the plugin today, and the generator's own highlighting shows in the graph. A commit that removes the chosen state or transition clears the selection.

### The graph and the generator

- **R29.** The Graph pane shows the graph as the plugin's dataset mode does (auto-arranged, dragging, zoom, double-click for a state's read-only probabilities), with a toolbar of Select, Fit, Recenter, Zoom In and Zoom Out (mockup question 5: every graph control in the one toolbar). The zoom buttons the plugin draws in the graph's corner aren't drawn in the workspace; the toolbar's zoom buttons use the same icons and steps. Reset and Back to Main Menu are left out: the Activity Player's "Clear and start over" resets a student's work, and there is no main menu. With no input the pane says to type or table some words. In the workspace the toolbar's buttons sit 4 px apart rather than the plugin's 10 px, so more tools fit in one column. When a shorter row leaves the Graph pane less height than its toolbar needs, the toolbar's buttons go into two columns, so every tool stays visible: Data mode's five tools do below a 218 px row. While the panes are stacked (R13) each is the starting row's height, so the column count follows that height, not a row height the student dragged before the workspace narrowed: a stored 200 px row would otherwise put five tools in two columns inside a 304 px body. The other toolbar buttons, their icons and their order are unchanged, and the plugin's toolbar and its zoom buttons are unchanged.
- **R29a.** **The graph keeps still while the input grows.** When a commit changes the graph, the states already drawn stay where they are and only new states are placed, so the graph doesn't rearrange at every word; the first graph, and a graph whose states are mostly new (more than half, as after a paste that replaces the text), is laid out whole. A new state starts beside a state already drawn that leads to it, so it appears next to the word it follows rather than at the center. This is an option of the shared `Graph` that the workspace turns on; the CODAP plugin's graph lays out as it does today. With the option on, a state that arrives with an x and a y is also treated as placed and keeps them, so a graph restored with saved positions isn't laid out again. MARK-17 supplies those saved positions; MARK-15 saves none, and its Data-mode states arrive without positions.
- **R29c.** **The view follows the graph until the student takes it.** After a commit the graph is fitted to its pane, so a growing graph stays in view, until the student zooms or pans (the mouse wheel, a drag of the background, or the toolbar's Zoom In and Zoom Out). From then on commits leave the view where the student put it. The toolbar's Fit fits the graph and returns to following; so does a commit laid out whole (R29a), since the old view no longer means anything. The workspace's fits animate over 250 ms, so the view glides as the graph grows. The CODAP plugin fits after every change, instantly, as it does today.
- **R29b.** **Speed with a large input.** With a 20,000-character input (MARK-13's longest starting text: about 4,000 tokens and 700 states), a commit that adds a word redraws the graph in under 600 ms in headless Chrome, measured as in Technical Notes and recorded in the PR (not a CI assertion, which would be flaky). The shared `Graph` stops laying out again a graph it has already laid out, which changes no position the plugin draws.
- **R30.** The Sequence generator pane holds MARK-14's `Generator` and `SequenceOutput` with the plugin's behavior: Play, Pause, Resume, Step, Cancel, Clear Output, both speeds, and output highlighting. They, and the state dialog, look as they do in the plugin: their styles, today nested under the plugin's own layout, are shared with the workspace without changing the plugin's compiled CSS.

### Saved state

- **R31.** The interactive state gains the student's input: `{ version: 1, input: { text } }`, the text the table and the graph are rebuilt from (the table-only view keeps its rows as text the same way). It is handed to the library's `setInteractiveState` at each commit that changes it, and read back when the interactive opens. The library posts a state 2 seconds after the last call, so a student typing steadily is saved when they pause, not at every word, as MARK-17's "never on every keystroke" asks. MARK-13's `{ version: 1 }` with no input still reads as no saved input, so the authored starting text fills it, and the interactive still saves `{ version: 1 }` when it opens with no state, so the class dashboard shows the student. Everything else a student sees (outputs, layout, selection, generator settings, and the "Case sensitive" switch's value, R16a) is MARK-17's: until it saves that value, a reopened workspace starts from the author's.
- **R32.** Reading an interactive state never fails, as reading the authored state never does: a missing, `{}`, JSON-string or malformed state, or an `input.text` that isn't a string, reads as no saved input. The input takes up to 50,000 characters, in the text box and through the table's edits: a row edit that would pass the limit is refused, with a note that the input is at its limit (Technical Notes). The interactive state's reader and `readAuthoredState` parse their input (an object or a JSON string) with one shared function, so the two can't drift.

### Logging

- **R33.** The interactions logged, with their data, are listed in a new `LOGGED-EVENTS.md`, which MARK-16 to MARK-19 extend. The shared core logs:
  - **Generator:** `SequencePlayed`, `SequenceStepped` (each step), `SequencePaused`, `SequenceResumed` and `SequenceCanceled`, each with the generator's settings (`startingState`, `maxLength`, `delimiter`, `fast`); `SequenceGenerated` with the sequence's states and the settings; `GeneratorSettingChanged` with `setting` and `value` (a text field's when it loses focus with a changed value, not each keystroke); `OutputCleared`; `OutputSelected` with the output's states.
  - **Graph:** `StateSelected` and `TransitionSelected`, with the state or the transition's two states and `source` (`graph`, `inspect` or `table`); `SelectionCleared` with `via` (`toggle`, `background`, `escape`, `button` or `table`, the last for focusing an empty table row), for any kind of selection; `StateDialogOpened`; `StateMoved` (a drag that moves it, in either view).
  - **Drawing view** (logged by the core now, reached in the AP with MARK-16's Draw mode): `StateAdded`, `TransitionAdded`, `StateDeleted`, `TransitionDeleted`, `StateEdited` (its label and probabilities), `TextToGraph` (Create From Text, with its word count), `GraphReset`.
  - Fit, Recenter, zoom and tool changes are not logged.
- **R34.** The workspace logs: `InputCommitted` with the view (`text` or `table`), the number of tokens and of states, and how the commit happened (R18); `TableRowAdded`, `TableRowDeleted`; `PaneOpened` and `PaneClosed` with the pane (the generator's controls are `generatorControls`); `PaneResized` with the divider (`input`, `inspect`, `rows` or `inputSplit`) and the resulting sizes, once per drag, and once when a divider the arrow keys moved loses focus (R13a); `InspectTabChosen` with the tab; `InspectSorted` with the tab, column and direction; `CaseSensitivityChanged` with `caseSensitive` (true or false) and the number of states after it (R16a).
- **R35.** Event names come from one typed list, so a call can't log a name outside it, and a Jest test fails if that list and the events in `LOGGED-EVENTS.md` differ in either direction.

### Cleanups moved from MARK-14

- **R21a.** **Authoring refuses a setup with nothing to work with** (mockup question 34; the follow-up recorded on MARK-13). The authoring form shows an error, and doesn't send the setup to the Activity Player, while either holds: Data mode is usable, the Input pane is off and the starting text is empty or only whitespace; or every pane (Input, Graph, Inspect and the Sequence generator) is off. The error names what to change and says the change isn't saved until then, since the Activity Player stores the last setup the form sent. With both modes, Draw mode keeps the Graph pane on, so only the first case can arise.
- **R36.** `registerObservers` and its call are deleted. Of `codap-helper.ts`'s exports only `initializePlugin`, which the CODAP host calls, stays; the unused exports (`getCaseValues`, whose unchecked `.success` MARK-20 fixed in its siblings, among them) and the CODAP host's commented-out imports of them go. CODAP is sent the same requests as before.
- **R37.** `graph.tsx` is split into modules by concern (the component, the drawing of the graph, its highlighting, and the edge geometry), with no change in what it draws or how it responds, so MARK-11's and MARK-12's Cypress tests pass unchanged. Its unused `mode` prop goes, with the argument each caller passes. The drag handlers (`dragStart`, `dragging`, `dragEnd`) and the `d3.drag()` call are typed with `d3.D3DragEvent` and the node type in place of `any`, as Ethan McElroy asked in MARK-14's review.
- **R38.** The interactive's code may import the shared core (`src/components/`, `src/hooks/`, the shared utilities), but never the CODAP host or the CODAP utilities, enforced by extending MARK-14's lint boundary to `src/interactive/` (Ethan McElroy's review of MARK-14: today a file there can import `use-codap` with no error), and by adding `codap-request`, the one CODAP utility the boundary's list leaves out. A Jest test lints a CODAP import in an interactive file and fails without the rule. This replaces MARK-13's rule that the interactive imports none of the plugin's code.
- **R38a.** The shared core stops what it started when it unmounts: the generator's animation interval and the loop that waits for the graph's size before moving an older drawing's origin to the center. The CODAP host never unmounts the core, so the plugin behaves as before; the AP workspace can (the standalone page, a mode switch, the frame closing). A Jest test fails if either cleanup is deleted. Maureen E. Zitouni raised this in MARK-14's review.
- **R38b.** Tests cover the generator's delimiter controls (choosing none, space or other, the other field shown only for other, and its text used to join the output) and committing Max Length when the field loses focus, each failing if the line it guards is removed. Maureen E. Zitouni noted in MARK-14's review that no test covered them. The generator's behavior is unchanged.

### Verification

- **R39.** Jest covers the pure parts, with expected values written out in the tests: the tokenizer (every rule in R15 to R17, token positions, each capitalization), the table's edits written back into the text (R20), which states the graph treats as placed, when it lays out whole, and where a new state starts (R29a), the dividers' limits and the narrow-workspace fit (R13a), the toolbar's height and the row height at which Data mode's five tools go to two columns, one row height below the flip and one at it, and one column while stacked with a stored 200 px row (R29), the authoring check's two cases and its passes (R21a), the configuration function for every combination of modes, starting mode and input view and each pane setting (R6 to R10), the case switch's settings read from an authored state, new and old (R16a), the Inspect rows and their sorting (R22), what each selection lights up (R25), reading the interactive state (R32), and the log list (R35).
- **R40.** Cypress, on MARK-13's fake Activity Player page: typing commits on a space and not mid-word, even after a pause; a deletion commits after the pause; linked editing both ways, brackets included; the table-only and text-only views; each kind of selection lighting up the graph, Inspect, the table and the text, and each way of unclicking; an output's pink path, rows and words; a pane collapsing and reopening unchanged; each divider dragged and stopped at its minimum, moved with the arrow keys, and the reported height unchanged by the row divider (R13a); the view following the graph until the student zooms, and again after Fit (R29c); the generator's default controls fitting its 210 px minimum (R13a); the toolbar's measured height matching the height the workspace computes for it, its zoom buttons zooming the graph, and its five buttons in a 200 px row sitting in two columns inside the Graph pane (R29); Input and Inspect filling the row in proportion while the Graph pane is collapsed (R11); the Graph pane's "No data was provided for this activity." with no Input pane and no starting text (R21); the saved input coming back on reopen; the log messages for a play, a selection and a commit; and the reported height staying steady (no growth loop); Lato loaded and used for the workspace's text (R13b); the "Case sensitive" switch rebuilding Inspect's states without changing the text, its read-only label when hidden, the switch staying inside an Input pane at its 160 px minimum, and the authoring form's new setting (R16a); the workspace's own row set to wrap at 700 px (R13); the authoring form's error, and no setup sent, for each case R21a refuses. MARK-13's runtime and demo tests that read the placeholder's settings list now check the workspace (its panes and views for the settings); report-mode tests are unchanged. MARK-13's standalone Jest test now renders the workspace, so it stubs `Graph`, as MARK-14's core tests do, since Jest here can't load `d3`, and `ResizeObserver`, which jsdom lacks.
- **R41.** Every existing plugin test, Jest and Cypress, passes unchanged, apart from one line of setup: MARK-14's recording test host in `markov-tool.test.tsx` gains `log: jest.fn()`, since R4's `log` is required and a host without it doesn't type-check; no test body or assertion changes; the CODAP plugin's production build differs from MARK-14's only in the code the plugin-side changes touch (the cleanups, the `graph.tsx` split, the graph's new options, transition selection in the core's hook, and logging), each either an option the plugin doesn't set or a change that leaves its behavior as it is, and its compiled CSS is unchanged (R30's shared styles compile to the same rules), and a headless check in CODAP 3.1.2 shows the plugin unchanged (MARK-12's R11 list).
- **R42.** The build, both `tsc` checks and the three lint commands are clean.
- **R43.** README: the Markov Interactive section says the runtime is the student workspace, and points to `LOGGED-EVENTS.md`.

## Technical Notes

- **The core's state outside `MarkovTool`.** A ref handle lets a host call into the core, but not lay out the graph, generator and output elsewhere or read the selection. R3 needs the state as a hook both layouts call: MARK-14's R1a provides it, `useMarkovTool(host)` in `src/hooks/use-markov-tool.tsx`, returning a `MarkovToolApi` (Resolved Questions), and MARK-15 adds transition selection to it.
- **The graph's height.** The plugin's SVG is `calc(100vh - 20px)` tall. In the Activity Player the frame is sized to the reported height, so a graph sized from the viewport would grow the frame, which grows the viewport, without end. The workspace gives the graph its pane's height (R13). *(Checked with throwaway code: a `calc(100vh - 20px)` block in the runtime, on the fake Activity Player page, sent 167 height messages in 3 seconds, from 20 px to 81,028 px.)*
- **The cost of a commit** (measured in headless Chrome on MARK-11's fake-CODAP page, whose dataset mode builds the graph from values exactly as the workspace will: 3,950 tokens and 714 states from 20,000 characters of English prose, one value added):
  - Today a one-value change takes 2.1 s from the values arriving to the graph drawn. A CPU profile put 0.8 s of it in the force layout's many-body force.
  - The layout runs twice per change. `Graph`'s draw effect depends on `highlightSelected`, which depends on `graph`, so a new graph first redraws the old one, laying it out again although its states are pinned where they are, and then draws the new one. Skipping the layout when every state is already pinned took the change to about 1.1 s.
  - Laying out only the new states (the old ones pinned, the layout started at alpha 0.3 for 30 ticks) took it to 0.46 to 0.59 s, of which the layout is about 80 ms and the font sizing about 100 ms. R29a and R29b come from this.
  - Tokenizing the 20,000 characters takes about 3 ms, and counting states and transitions about 45 ms in the plugin's current `graphFromValues` (MARK-14's map-based `chainsToGraph` replaces it).
- **Clicks on the graph.** Arrows respond to clicks only in the drawing view's delete tool today, and background clicks reach `onClick` only without auto-arrange. Selecting arrows and clearing on the background are new, opt-in props on `Graph`, so the plugin's graph is unchanged.
- **Highlighting the text box.** A `textarea` can't style part of its text. The usual way is a layer behind a transparent `textarea` with the same text, font, padding and wrapping, the highlighted tokens wrapped in `mark`, scrolled with the text box.
- **50,000 characters.** The Activity Player keeps a student's answer in a Firestore document limited to 1 MB, and for legacy reasons stores the answer in it in two forms, so an interactive state has about 450 KB. 50,000 characters is at most about 150 KB as JSON, leaving about 300 KB for MARK-17's outputs and layout. The authored starting text is limited to 20,000 (MARK-13).
- **For MARK-16.** Inspect's Count and "2 of 3" assume counts, which Data mode's edge values are; Draw mode's slider sets weights that are not counts, so MARK-16 decides what Draw mode's Inspect shows. MARK-16 also gives `Pane` its no-collapse option for Draw mode's Graph pane (R12), and checks Draw mode's own toolbar in two columns (R29), since with Rebecca's answer to mockup question 21 (Create From Text out, Zoom In and Zoom Out in) Draw mode has nine tools, which need two columns below a 362 px row, the starting 330 px row included; MARK-15 tests the two-column rules with Data mode's five tools. Words added in the table are written into the text as prose (R20), since every graph is a Markov chain until MARK-16; Rebecca asked (mockup question 7) that with "Order matters" off they be written one per line, as a list, which MARK-16 adds with the switch. Each mode keeping its own work (MARK-16) means one core state per mode, which the hook in R3 allows.
- **The demo page** keeps a runtime's interactive state across authoring changes (MARK-13's R16), as the Activity Player keeps a student's. Once the runtime has saved input, a changed starting text no longer shows there, as it wouldn't for a student who had started.
- **Event names** follow the PascalCase used by the other Concord interactives' `LOGGED-EVENTS.md` (hurricane-model, wildfire-model).

## Out of Scope

- The probabilities toggle, "Order matters" and its switch, the bag of words, Draw mode and the Data/Draw switch (MARK-16).
- Saving outputs, layout (which panes are open and R13a's pane sizes), selection and generator settings; the read-only report view; the history scrubber (MARK-17).
- Send to CODAP and Download tables (MARK-18); the dashboard summary (MARK-19).
- Any change a CODAP user can see, including the ELA module's documents.
- Choosing tokens in the text box by clicking them (R24): the text box is for editing.

## The student-view mockup questions

Rebecca answered the layout page's questions on 2026-11-02. This story's are below; "default" means the question's default is built. Questions 13 to 21, 24 to 30, 35 and 36 belong to MARK-16 to MARK-19.

1. **Starting pane sizes.** Default: Input 280 px, Inspect 260 px, the graph the rest (the widest, as she asked); the row 330 px tall and the generator 210 px, about 580 px in all, to fit a Chromebook screen without scrolling (R13a). She left the height to us; Doug kept the Chromebook budget, and the generator's minimum rose from 200 to 210 px once its controls were measured.
2. **A collapsed pane.** A 32 px strip with its title running down it, and the panes that stay open fill the row: the graph widens as by default, and a collapsed graph's space goes to Input and Inspect in proportion (R11).
3. **Where the "Order matters" switch sits:** default, the top of the Input pane (MARK-16 renders it).
4. **Where the probabilities toggle sits:** default, the workspace's own row, not shown with no Graph pane (R10).
5. **The graph tools in Data mode:** Select, Fit, Recenter, Zoom In and Zoom Out in one toolbar; no Reset or Back to Main Menu (R29).
6. **The table's controls:** default, a delete button on each row, Enter to add a row, an empty row at the end to append (R19). No reordering. Starting the table from an uploaded CSV, which she asked about, is MARK-23.
7. **Text from a table:** as prose while every graph is a Markov chain (R20); one word per line with "Order matters" off, which MARK-16 adds.
8. **Highlight colors:** default, the graph's green for a chosen state or transition with Inspect's Transitions rows in its blue and orange, and pink for an output (R25).
9. **The Clear highlight button:** default, the workspace's own row while something is chosen (R27).
10. **Send to CODAP and Download tables:** default, the right end of the workspace's own row (MARK-18).
11. **The output's alternating colors:** default, very light blue and cream (R14).
12. **The Input pane's split in linked mode:** 40% text box and 60% table to start, with a divider students can drag (R13a).
22. **Whether the Graph pane collapses in Data mode:** it does, and Input and Inspect widen in proportion to fill the row (R11).
23. **Where the generator's controls sit:** default, a column on the left of the output, collapsing to the left (R12).
31. **Whether the text box shows lowercase:** default, the text box shows what the student typed (R16). Her follow-up (F) lets students choose: a "Case sensitive" switch the author can hide, with a read-only label in its place (R16a).
32. **What collapsing does when the panes stack:** default, a pane collapses to its header and the panes below move up (R13).
33. **Clicking a word in the text box:** default, it places the cursor and chooses nothing (R24). Lighting up the word being typed, which she floated, is left for later.
34. **A Data mode with nothing to show:** default, "No data was provided for this activity." (R21), and the authoring form refuses to save the setup (R21a).

## Component inventory

What the workspace shows for each combination of usable modes, starting mode and input view, with every other setting at its default (every pane available and open, the probabilities toggle available and off, the "Order matters" switch shown and on, the "Case sensitive" switch shown and starting at No, the send buttons not available). It is the output of R6's configuration function, run as throwaway code from the implementation spec's definition. **(16)** marks what MARK-16 renders in the slot this story leaves, **(18)** MARK-18's.

**The panes in every configuration.** Input (Data mode only), Graph, Inspect and Sequence Generator, each with a header and a collapse button (Draw mode's Graph pane has none, R12), and a draggable divider between each two open neighbors (R13a).
- **Graph pane:** the graph, a toolbar of Select, Fit, Recenter, Zoom In and Zoom Out, double-click for a state's probabilities.
- **Inspect pane:** States and Transitions tabs, each a sortable table.
- **Sequence Generator pane:** the controls (Starting State, Max Length, Delimiter, Speed, Play or Pause or Resume, Step), which collapse on their own; the output (sequence groups with alternating colors, Clear Output, Cancel).
- **The workspace's own row:** Clear highlight, while something is chosen; the read-only "Case sensitive" label, in Data mode with the switch hidden, and the switch itself with no Input pane; the probabilities toggle **(16)**, where the Graph pane is present; the Data/Draw switch **(16)**, with both modes; Send to CODAP and Download tables **(18)**, when available.

| Usable modes | Opens in | Input view | Input pane | Graph | Inspect | Generator | Data/Draw switch (16) | "Order matters" switch (16) | "Case sensitive" switch |
|---|---|---|---|---|---|---|---|---|---|
| Data | Data | Table only | open: the table | open | open | open | no | yes | yes |
| Data | Data | Text only | open: the text box | open | open | open | no | yes | yes |
| Data | Data | Linked table and text | open: the text box above the table | open | open | open | no | yes | yes |
| Draw | Draw (16) | (none) | not present | open, always; drawing tools and the probability slider (16) | open | open | no | no | no |
| Both | Data | Table only | open: the table | open | open | open | yes | yes | yes |
| Both | Data | Text only | open: the text box | open | open | open | yes | yes | yes |
| Both | Data | Linked table and text | open: the text box above the table | open | open | open | yes | yes | yes |
| Both | Draw (16) | (none) | not present | open, always (16) | open | open | yes | no | no |

**What the other settings change**, in any row above:
- A pane made unavailable is not present, and the others share its space; Graph can be unavailable only without Draw (MARK-13's R5), and without it Input and Inspect share the row in proportion (R11). With no Input, Graph or Inspect, the generator stands alone at the top. With no Input pane in Data mode, the graph comes from the starting text alone (R21).
- A pane that doesn't "Open at the start" starts collapsed. The Graph pane's setting applies in Data mode only: Draw mode opens its graph whatever it says (checked: a Draw configuration with the Graph pane's setting off still opens it).
- The probabilities toggle **(16)** shows in the workspace's own row when available and the Graph pane is present, starting on or off as set; without it, probabilities stay as set.
- The "Order matters" switch **(16)** shows in Data mode when the author shows it, starting on or off as set; without it, the graph is a Markov chain or a bag of words as set.
- Capitalization's starting value changes no component: it decides whether "The" and "the" start as one state. With the switch hidden, Data mode shows the read-only label in the workspace's own row in its place (R16a).
- The starting text fills the Input pane, and the table through the tokenizer.

## Resolved Questions

### RESOLVED: Whose story extracts the core's state from `MarkovTool`?
**Context**: MARK-14's spec keeps the tool's state inside `MarkovTool` with the CODAP layout (Technical Notes). The workspace needs the same state with its own layout (R3).
**Options considered**:
- A) MARK-15 extracts a hook from `MarkovTool` (the CODAP layout then calls it), with MARK-14's tests passing unchanged.
- B) MARK-14 does it while it moves `App`, before MARK-15 starts; MARK-15's step shrinks to using it.

**Decision**: B, Doug's decision. MARK-14 is already moving every line involved and has the tests that guard it, so the code moves once. MARK-14's spec takes the hook in its own story; MARK-15 adds transition selection to it (implementation step 4).

### RESOLVED: Does `InputCommitted` log the student's text?
**Context**: Researchers may want what students typed, but a commit happens at every space, and the text can be 50,000 characters.
**Options considered**:
- A) Counts only (R34 as written).
- B) The full text on each commit.
- C) The text when the text box loses focus, counts on the other commits.

**Decision**: A, Doug's decision. The saved interactive state already holds the text, and MARK-17's answer history keeps each saved version.

### RESOLVED: Can students resize the panes?

**Context**: R11 and R13 fixed the panes' sizes, so a student who needs a bigger graph or a longer output had only the collapse buttons.

**Options considered**:
- A) Fixed sizes, set from Rebecca's mockups.
- B) Draggable dividers between the panes and above the generator, within the workspace's size, with per-pane minimums; a drag stops at a minimum.
- C) B, with a drag past a minimum collapsing the pane.

**Decision**: B, Doug's decision (R13a). C was rejected as surprising: a continuous drag would suddenly hide a pane. A flat 50 px minimum was rejected because it leaves almost no graph beside the Graph pane's 40 px toolbar. MARK-17 saves the sizes.

## Self-Review

### QA Engineer

#### RESOLVED: A deletion committed mid-word
The Jira text commits on a space or end punctuation; the first draft also committed on any deletion, so backspacing through "cat" would briefly make states "ca" and "c". R18 now leaves deletions to a one-second pause, and typing to separators.

#### RESOLVED: MARK-13's standalone Jest test can't load the workspace
`standalone.test.tsx` renders `App`, which will now import `graph.tsx`. Checked with a throwaway test: Jest fails to load `graph.tsx` ("ESM syntax ... could not be executed as CommonJS"). R40 now says the test stubs `Graph`.

### Accessibility

#### RESOLVED: Linked highlighting was mouse-only
The graph is SVG with mouse handlers only, and R24 named clicks. R24 now makes Inspect rows choosable with Enter or Space and table rows by focus, with the chosen Inspect row reported to a screen reader.

### Senior Engineer

#### RESOLVED: Clicking a table row to edit it would unchoose it
R27's "click the chosen thing again" would clear a row's selection as the student clicks into it to type. A table row now stays chosen while it has focus, and focusing an empty row clears the selection.

#### RESOLVED: Scrolling the pane the student is clicking in
Scrolling the first highlighted row into view in the pane the click came from would move the row under the pointer. R25 now scrolls only the other panes.

### Researcher

#### RESOLVED: The log list had overlapping and per-keystroke events
`OutputUnselected` duplicated `SelectionCleared`, and `GeneratorSettingChanged` would have logged the length and delimiter fields at each keystroke (the generator's `onDelimiterChange` fires per keystroke). One clearing event now covers every kind of selection, and text fields log on losing focus. `StateMoved` needs the graph's drag callback, which the dataset view doesn't pass today; R33 now says either view.

#### RESOLVED: "Fails if an event isn't listed" had no mechanism
R35 now takes the names from one typed list, so a call can't use another name, and checks that list against `LOGGED-EVENTS.md` both ways.

### Forward Compatibility

#### RESOLVED: Saving at each commit would fill MARK-17's history
A commit happens at every space, and with "Save Answer History" on the Activity Player keeps a full copy per save. Checked in lara-interactive-api's `api.ts`: `setInteractiveState` is a trailing 2-second debounce, so steady typing posts once per pause. R31 now says so.

#### RESOLVED: Inspect's counts don't hold in Draw mode, and each mode keeps its own work
Recorded in Technical Notes for MARK-16: Draw mode's weights aren't counts, and MARK-16 runs one core state per mode, which the hook allows.

### Implementation assumptions checked before the implementation spec

#### RESOLVED: A large starting text would freeze the workspace at every word
Rebecca's module starts with a large bag of words, and R18 commits at every space. Measured (Technical Notes, "The cost of a commit"): 2.1 s per one-word change at 20,000 characters, half of it a second, redundant layout. R29a and R29b now ask for the graph to keep its states still and redraw in under 600 ms, which throwaway changes to `graph.tsx` reached.

#### RESOLVED: A viewport-sized graph grows the Activity Player's frame without end
Confirmed with a throwaway on the fake Activity Player page (Technical Notes, "The graph's height"); R13 already gives the graph its pane's height.

### Cross-reference (stage 8)

#### RESOLVED: Three gaps between the two specs
Every requirement has a step, and every step a requirement, apart from three, each settled by Doug: R32's limit had no step for the table's edits (step 9 now refuses an edit past it); step 9 fixed the linked text box and table at 40/60, a layout detail the mockup questions didn't list (now question 12: 40/60 to start, with a divider); and step 6 shared MARK-13's private `parse` with no requirement naming it (R32 now does).
