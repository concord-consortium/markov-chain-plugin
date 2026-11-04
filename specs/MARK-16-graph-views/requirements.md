# Graph Views in the AP Interactive: Probabilities, Bag of Words and Drawing Mode

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-16
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Add three ways of looking at the chain to the AP interactive's workspace: a probabilities toggle that labels the graph's arrows, an "Order matters" switch that turns the Markov chain into a weighted bag of words, and Draw mode, where students draw their own chain. When the author offers both modes, a Data/Draw switch moves between them, and each mode keeps its own work.

## Project Owner Overview

MARK-15 gives students the Data mode workspace: they type or table their words and see the graph, the counts and the probabilities together. This story adds the views that let them reason about how the model picks each next word. With probabilities on, the graph labels the arrows leaving a chosen word, the dashed candidate lines while a sequence is generated, and the path of a chosen output, with the paths not taken shown faded. With "Order matters" off, every word can follow every other, more often the more it appears in the input, so students can compare a bag of words (shown to students as "Orderless") with a Markov chain on the same text. Draw mode lets students build a chain by hand, with the slider for setting probabilities they know from the CODAP plugin.

The author decides, in MARK-13's authoring, whether students see each switch and where each starts. A student with both modes can switch back and forth without losing anything in either. Saving that work between visits is MARK-17's. The CODAP plugin, and the ELA module that uses it, do not change.

## Background

- **MARK-13** (PR #88) saves the settings this story reads (`src/interactive/authored-state.ts`): `modes` and `startingMode` ("Usable mode(s)" and "Starting mode"), `orderMatters.startsOn` and `orderMatters.showSwitch`, and `buttons.probabilities` (`available`, "Show probabilities toggle", and `startsOn`, "Probabilities shown at the start"; the form's help: without the toggle, probabilities stay shown or hidden as set).
- **MARK-14** (PR #89, closed spec `specs/MARK-14-shared-components.md`) built the shared core: `MarkovHost` (`viewMode`, `setViewMode`, `markDirty`, `outputSequence`), whose functions must keep their identity across renders; `useMarkovTool(host)`, which takes only the host and returns a `MarkovToolApi` (`handle`, one object for the hook's lifetime, `graph`, `graphEmpty`, `animating`, `graphHighlights`, `setSelectedNodeId`, `generatorProps`, `outputProps`, `view`); `Generator` and `SequenceOutput` with their exported props; `SequenceGroup` in `src/type.ts`; `chainsToGraph` and `graphFromValues`.
- **MARK-15** (PR #90, closed spec `specs/MARK-15-ap-workspace.md`) built the workspace this story extends. `Workspace` reads the starting mode's configuration and renders `DataWorkspace`, or in Draw mode a message (R7). `DataWorkspace` calls the AP host (`useApHost(hosted)`, Data mode as the core's `"dataset"` view) and `useMarkovTool` itself, and renders `.controls-row` (the case switch or its label, and Clear highlight), the panes with their dividers, and the state dialog. The rest this story uses: `log` on `MarkovHost` with the typed event list and `LOGGED-EVENTS.md` (R33 to R35); the selection (`selection`, `selectState`, `selectTransition`, `clearSelection`, R24 to R28); the Graph pane's options (`keepPositions`, `selectedEdge`, `onEdgeSelect`, `onBackgroundClick`, `zoomButtons`, `zoomRequest`, `onUserZoom`, `fitTransitionMs`), with the view following the graph until the student zooms or pans (R29c); `SettingSwitch` and `SettingLabel`; the Inspect pane (R22); the saved input `{ version: 1, input: { text } }` (R31); and `workspaceConfig(state, mode)` (R6), whose `modeSwitch`, `orderMatters` and `probabilities` fields are this story's (R10). Its notes for MARK-16 leave Draw mode's Inspect, `Pane`'s no-collapse option and Draw mode's toolbar to this story.
- **MARK-20** already draws every arrow's width as its probability among its own state's outgoing arrows, in both apps (`stateEdgeWeights` in `src/components/graph-utils.ts`: 2 px to 4.5 px, loops included, arrowheads scaled to their lines). Rebecca chose this ("Option B with scaled heads", Slack, 2026-10-27), and it is what the Jira text calls view B.
- **Rebecca's doc**, "Markov Tech Specs (AP)": "Toggle for displaying probabilities" (A to D); "Order Matters: Y/N" (a bag of words: the Inspect States table with counts, the Transitions table replaced by an explanation); question 2 (the bag of words' graph hides every arrow except the chosen state's outgoing ones); question 3 (Draw mode: every panel except Input, the current slider, no starting from data, all tools on). Her layout images predate the split into the AP interactive and are reference only. Her answers of 2026-11-02 to the student-view layout page settle this story's mockup questions (below), with Doug's decisions where her answers left something open.
- **Switching modes**: Rebecca's Slack reply of 2026-10-27, as the Jira text records it: a switch between the modes at the top of the workspace, shown only with both modes; the interactive opens in the author's starting mode; each mode keeps its own work, so switching loses nothing and needs no confirmation. MARK-17 saves both modes' work.

## Requirements

### The probabilities toggle

- **R1.** **The toggle.** The workspace shows a "Show probabilities" toggle when the author makes it available and the current mode has a Graph pane, since its labels are drawn on the graph (MARK-15's R10: `showToggle` in that mode's configuration). So it shows in Draw mode, whose Graph pane is always present, and in Data mode only when the author includes the Graph pane. It starts on or off as the author set it (`probabilities.startsOn`); without the toggle, probabilities stay on or off as set. It is a button that reports its state (`aria-pressed`) and works from the keyboard. It sits in `.controls-row` in both modes, so it doesn't move when the mode changes (mockup question 13).
- **R2.** **One setting for the workspace.** The toggle's state is shared by both modes: a student who turns probabilities on in Data mode finds them on in Draw mode.
- **R3.** **What a label says.** A probability label shows a transition's probability as a whole percent ("67%"), rounded as Inspect's Probability column is (MARK-15's R22). A transition's probability is its value over the total value of the transitions leaving its state, loops included: counts in Data mode, the slider's weights in Draw mode. With "Order matters" off, the probability of moving to a state is that state's count over the count of every token (R10).
- **R3a.** **Notes on the graph.** A one-line note runs along the bottom of the Graph pane, in both modes, only while it applies: "Percents are rounded, so they may not add up to 100%" while probabilities are shown, and "Only arrows out of the chosen word are drawn" while "Order matters" is off and a state is chosen, other than while a sequence is generated, when the graph draws the generator's arrows instead and the chosen state's arrows are not drawn (mockup questions 16 and 17). When both apply, both show, one line each. The notes take no clicks, sit clear of the toolbar, and are read out by screen readers when they appear.
- **R4.** **(A) A chosen state's outgoing probabilities.** With probabilities on and a state chosen (MARK-15's R24), each arrow leaving it, its loop included, is labeled.
- **R5.** **(B) Arrow widths.** The toggle leaves widths as MARK-20 draws them: by each state's own probabilities, always (mockup question 20). Rebecca may later ask for equal widths while probabilities are off, so the width rule sits behind one option of the shared graph, and that change is one line in the workspace.
- **R6.** **(C) Candidate lines while generating.** With probabilities on, while a sequence plays or steps, each dashed candidate line from the current state (the step where every possible next state is shown, today's `highlightAllNextNodes`) is labeled. When the step chooses the next state, the labels go, as the dashed lines do.
- **R7.** **(D) A chosen output's path.** With probabilities on and an output chosen, each step of its path is labeled at full strength, and each other arrow leaving a state on the path, before the path's last state, is labeled faded. A state that appears more than once in the path has every step taken from it labeled at full strength. A step whose transition is not in the current graph (the input changed after the output was generated, or the output was generated with "Order matters" set the other way) has no arrow and no label. In the bag of words only the path's steps are labeled, with no faded labels: every state's outgoing percents are the same list there (R3), so faded labels would repeat it once per path state, up to every state each, and choosing a state (R4) already shows it. Rebecca may revisit this default.
- **R8.** **How labels look.** A label sits on its arrow (a loop's on the loop), the two labels of a two-way pair never overlap (D labels both directions of a path like `a b a`), each stays legible over other arrows and states, a faded label in #767676 so it still meets 4.5:1 contrast on white, moves with its arrow when a state is dragged, and takes no clicks. With probabilities off, nothing on the graph is labeled. Labels are drawn only where R4, R6 and R7 put them, so a large graph draws at most one state's outgoing labels, or one output's path and the states along it.

### "Order matters"

- **R9.** **The switch.** In Data mode the workspace shows an "Order matters" switch when the author shows it (`orderMatters.showSwitch`), starting on or off as the author set it (`orderMatters.startsOn`); without the switch, order matters or not as set. It shows "Yes" or "No" beside it (follow-up C), reports its state (`role="switch"` with `aria-checked`) and works from the keyboard. It is MARK-15's `SettingSwitch`, the component its "Case sensitive" switch uses (MARK-15's R16a), so the two read alike. Draw mode has no switch: a drawing is always a Markov chain. It sits at the top of the Input pane; with no Input pane, in `.controls-row`; with the Input pane collapsed, it is hidden with the pane (mockup questions 3 and 14).
  - **Beside "Case sensitive".** The two switches sit together, "Order matters" first, in one group that wraps: about 315 px side by side (measured headless in Lato at 14 px), so they take one line each at the Input pane's 280 px start and share a line once it is dragged wider. A single switch is about 151 px (166 at 16 px), more than the Input pane's 160 px minimum leaves inside it, so a switch's name wraps there rather than spilling past the pane, as MARK-15's `SettingSwitch` does (its R16a). With no Input pane the group sits in `.controls-row`; stacked, the Input pane takes the workspace's full width, so they share a line wherever it is wider than about 315 px.
- **R9a.** **The read-only label.** When the author hides the switch, Data mode's `.controls-row` shows a read-only label saying how order is set: "Order matters: Yes" when order matters, "Order matters: No" when it doesn't (mockup question 30, follow-up B). It is MARK-15's `SettingLabel`, and sits beside the read-only "Case sensitive" label when that switch is hidden too, "Order matters" first. Draw mode shows no label.
- **R10.** **The bag of words.** With "Order matters" off, the states and their counts are the same as with it on (the same tokens and capitalization; a break in the input changes nothing). Generating picks every next state from all the states, the current one included, with probability proportional to its count, whatever the current state is. "(any)" as the starting state picks by count, as it does today. A sequence always runs to its Max Length, since every state has a next state.
- **R10a.** **Words added in the table.** In the linked and table-only views, a word added in the table is written into the text on a line of its own while "Order matters" is off, so a list built in the table reads as a list (mockup question 7); with order on, it is written as prose, as MARK-15's R20 says. A single line break is not a break in the chain, so the list is the same input as the prose, and deleting a listed word leaves no blank line.
- **R11.** **The bag of words' graph.** States are drawn as with order on (sized by count). No arrow is drawn except:
  - from a chosen state, an arrow to every state (a loop to itself), with widths from R3's probabilities, as MARK-20 draws them;
  - while generating, the dashed candidate lines from the current state to every state, and then the chosen step, as R6 describes for a Markov chain;
  - for a chosen output, the steps of its path (R7).
  Arrows into a chosen state are never drawn. Switching "Order matters" either way leaves every state where it is: every state is already drawn, so MARK-15's R29a counts it as placed and keeps it still.
- **R12.** **Choosing in the bag of words.** States are chosen as in MARK-15 (graph, Inspect States, the table); transitions cannot be chosen, and clicking an arrow does nothing. A transition chosen when the switch turns off is cleared, without a `SelectionCleared` event (the `OrderMattersToggled` event says why); a chosen state or output stays chosen.
- **R13.** **Inspect in the bag of words.** The States tab is unchanged (state and count). The Transitions tab shows, in place of its table: "All states are connected to all other states. States that appear multiple times in the input data have higher probabilities of being selected." The tab keeps its place, so a student on it sees the table come back when order is turned on again, with its sort kept.
- **R14.** **The state dialog.** With "Order matters" off, double-clicking a state does not open the read-only probability dialog: every state's probabilities are the states' counts, which Inspect States and R4's labels already show.
- **R15.** **Outputs.** Each output group records whether order mattered when it was generated; changing the switch starts a new group, as changing a generator setting does today, and a group generated with order off says so in its header: "Orderless" in the collapsed header and "Order matters: No" in the expanded one (mockup question 18). The CODAP plugin's groups and headers are unchanged.
- **R16.** **While generating** (playing, paused or stepping), the switch cannot be changed, as the input is read-only then (MARK-15's R21).

### Draw mode

- **R17.** **The Draw workspace.** Draw mode replaces MARK-15's R7 message with the workspace for a drawing: no Input pane; the Graph pane, always present and open, with no collapse button (MARK-15's R12, which leaves `Pane`'s no-collapse option to this story), with the shared drawing view; Inspect and the Sequence generator as the author set them (MARK-15's configuration for Draw mode). The drawing starts blank.
- **R18.** **Drawing tools.** The Graph pane's toolbar has Select, Add State, Add Transition, Delete, Fit View, Recenter View, Zoom In, Zoom Out and Reset (which, after the existing confirmation, clears the drawing and Draw mode's outputs and puts its generator settings back to their defaults, as the CODAP plugin's Reset does; Data mode's work is untouched), in that order. Create From Text is left out, and Zoom In and Zoom Out move from the graph's corner into the toolbar, as in Data mode, so every adjustment is in one place (mockup question 21; MARK-15's R29). There is no Back to Main Menu. These nine tools rely on MARK-15's R29 rules, with one more column: at the starting row height they sit in two columns, and below a 222 px row, where Data mode's five tools go to two, in three, every tool still visible. Double-clicking a state in the Select tool opens the state editor (its label and the probability slider), as in the CODAP plugin's drawing view; like Data mode's state dialog, it covers the whole interactive while open. Every state in a drawing has its own name, since Inspect, the generator's starting state, the graph and the log all name states by label: a new state takes the first "State n" no other state has, and the editor won't save an empty name or one another state has, saying why. The editor works without a mouse in Draw mode: each of the slider's handles is a slider a screen reader names and reads as its probability, the arrow keys move it 1% (10% with Shift), a finger or pen drags it as a mouse does, and the name field is labeled. The slider looks as it does today. The CODAP plugin keeps its naming and editor as they are.
- **R19.** **Placing what is drawn.** A state added with a click is centered where the student clicked, and the tool's icon follows the pointer, wherever the Graph pane sits on the page. *(Checked with throwaway code: today's drawing view places a state 148 px right of the click once its graph is not at the plugin's own (50, 10).)* In the CODAP plugin both stay where they are today.
- **R20.** **Inspect in Draw mode.** A drawing has no counts: its states all start at 1 and its slider sets weights. The States tab lists the states without a Count column; the Transitions tab lists each transition and its Probability as a whole percent ("67%"), with no Count column and no "2 of 3". Both sort as in Data mode, on the columns present.
- **R21.** **Choosing in Draw mode.** In the Select tool, a state or transition is chosen from the graph or Inspect, and an output from the output, with what lights up in the graph and Inspect as MARK-15's R25 says; there is no input to light up. The other tools keep their clicks for drawing, as today. Escape, a click on the graph's background in the Select tool and the Clear highlight button clear the choice, as in Data mode (MARK-15's R27); pressing a toolbar button leaves it as it is. Escape also returns to the Select tool, as in the CODAP plugin, and the toolbar shows Select pressed, reporting which tool is pressed to screen readers. With the state editor open, Escape closes the editor and leaves the choice, as Data mode's Escape closes its dialog first.
- **R22.** **Probabilities in Draw mode.** R4, R6 and R7 apply to a drawing, with R3's weights.

### The Data/Draw switch

- **R23.** **The switch.** With both modes available (`modeSwitch`), the workspace shows two radio buttons, "Data" and "Draw" (MARK-13's mode labels), at the left of `.controls-row`, the current mode chosen (mockup questions 13 and 15). They are a labeled group, operable from the keyboard. The interactive opens in the author's starting mode.
- **R24.** **Each mode keeps its own work.** Switching modes hides one mode's workspace and shows the other's, and changes nothing in either. Each mode keeps, while the interactive is open: its graph and where its states are; its chosen state, transition or output; its Inspect tab and sort; which of its panes are open, and its pane sizes (MARK-15's R13a: the widths the Input|Graph and Graph|Inspect dividers set, the row height the row divider sets, and in Data mode the linked text box and table's split), held per mode in the workspace, ready for MARK-17 to save; its generator settings and outputs; and, in Data mode, its input and "Order matters"; in Draw mode, its tool. Switching needs no confirmation. The graph's zoom and pan may be refit when its mode is shown again, as a reopened Graph pane is, which sets the view following the graph again (MARK-15's R13a and R29c).
- **R25.** **While generating** in the current mode, the switch cannot be changed (R16's reason: the hidden mode's generation would keep running unseen).
- **R26.** **Between visits.** This story saves nothing new: reopening the interactive shows the starting mode, the saved input (MARK-15's R31) and a blank drawing. MARK-17 saves both modes' work and the layout.

### Logging

- **R27.** New events, added to the typed list and to `LOGGED-EVENTS.md` (MARK-15's R35):
  - `ProbabilitiesToggled` with `on`;
  - `OrderMattersToggled` with `on`;
  - `ModeSwitched` with `mode`.
- **R28.** **Every event says which mode it came from:** each logged event's data gains `mode` (`useData` or `draw`, MARK-13's mode ids), so the shared core's events (a play, a selection) from the two modes can be told apart.
- **R29.** The generator's events (`SequencePlayed`, `SequenceStepped`, `SequencePaused`, `SequenceResumed`, `SequenceCanceled`, `SequenceGenerated`) gain `orderMatters` in their settings. MARK-15's drawing-view events (`StateAdded`, `TransitionAdded`, `StateDeleted`, `TransitionDeleted`, `StateEdited`, `GraphReset`) are now reached in the AP interactive, from Draw mode. `TextToGraph` (Create From Text) is reached nowhere once R18 leaves the tool out: the CODAP plugin still has the tool, but its host's `log` does nothing (MARK-15's R4). So the event is deleted from the typed list, `LOGGED-EVENTS.md` and `drawing.tsx`'s call, and the plugin's Create From Text works as before.

### The CODAP plugin and the shared code

- **R30.** Everything this story adds to the shared core (the graph's labels and its bag-of-words drawing, the arrow-width option, count-only generation, the output group's flag, the drawing view's tool list, toolbar zoom, pressed tool, click placement, Escape closing its editor, unique state names and the editor's keyboard and touch input) is off or absent in the CODAP plugin, which behaves and draws exactly as before: every existing plugin test, Jest and Cypress, passes unchanged, apart from the Jest test of the `TextToGraph` call R29 deletes and the two hook tests whose expected generator settings gain R29's `orderMatters: true`.
- **R31.** MARK-14's and MARK-15's code is used as built (PR #89 and PR #90). What this story adds to them, and what would change in them, is listed under "Changes to MARK-14 and MARK-15".

### Verification

- **R32.** Jest, with expected values written out: which arrows carry which labels and at what strength for A, C and D, in a Markov chain, a bag of words and a drawing, including a self-loop, a state repeated in a path, and a step missing from the graph (R3 to R7); count-only generation, with `Math.random` stubbed as `generate-sequence.test.ts` does, picking by count from every state and never ending early (R10); a word added in the table as a line of its own (R10a; MARK-15's `deleteRow` tests already cover deleting a word alone on its line); which notes apply (R3a); both arrow-width rules (R5); the toolbar's column count for nine tools at each flip (R18); Inspect's Draw-mode rows (R20); and the log list (R27). The configuration's switches (R1, R9, R23) are MARK-15's `workspaceConfig` fields, which its tests already cover for every mode and setting, and this story doesn't change them.
- **R33.** Cypress, on MARK-13's fake Activity Player page: each of A, C and D appearing with probabilities on and not with them off; the toggle hidden and probabilities fixed as authored, and hidden in Data mode without a Graph pane while shown in Draw mode; each note showing only while it applies; "Order matters" off showing no arrows until a state is chosen, then only its outgoing arrows, the Transitions tab's explanation, a generated sequence of Max Length from an input whose Markov chain ends sooner ("a b" from "a"), its group's "Orderless" header, and a word added in the table written on a line of its own, and deleted leaving no blank line; turning order off clearing a chosen transition without `SelectionCleared` and keeping a chosen output; the switch disabled while playing; the switch's Yes or No following it, and the read-only label with the switch hidden; the two switches together inside the Input pane at its 160 px minimum, and in `.controls-row` with no Input pane, "Order matters" first; at 700 px wide, MARK-16's widest row (about 720 px) going onto a second line inside the workspace, which fails without MARK-15's wrap rule; drawing a state where clicked, a transition, and editing its probabilities; a new state's name skipping one in use, and the editor refusing an empty or taken name; a slider handle moved by the arrow keys and by a touch drag in an editor that covers the interactive; a background click clearing a chosen state in Draw mode, and a chosen output kept through Zoom In and Fit View; Draw mode's own toolbar with all nine tools inside the Graph pane, in two columns at the starting row height and three with the row at its minimum, its zoom buttons zooming the drawing and no zoom buttons in the graph's corner; a divider moved in one mode leaving the other mode's sizes as they were; switching modes both ways with the input, the drawing, the outputs and a chosen state kept in each; and the log messages for the toggle, the switch and a mode change, each carrying `mode`.
- **R33a.** With MARK-15's 20,000-character starting text and "Order matters" off, the time from clicking a state, with probabilities on, to its arrows and labels being drawn is measured in headless Chrome and recorded in the PR (not a CI assertion, which would be flaky), as MARK-15's R29b is.
- **R34.** The build, both `tsc` checks and the three lint commands are clean, and a headless check in CODAP 3.1.2 shows the plugin unchanged (MARK-12's R11 list).

## Technical Notes

- **The graph today.** `Graph` (`src/components/graph.tsx`; split by MARK-15's R37 into `graph-draw.ts`, `graph-highlight.ts` and `graph-geometry.ts`) draws every edge of `graph.edges` once per graph change, and recolors on each highlight change: `highlightSelected` (a chosen state: incoming arrows blue, outgoing orange, the rest faded to 35%), the animation effect (`highlightNode`, `highlightEdge`, `highlightAllNextNodes` draws the current state's outgoing arrows dashed pink, `highlightLoopOnNode`) and `unhighlightNonOutput` (fades every arrow not between two of the output's states; it compares states, not the path's steps, so an arrow between two path states that the path did not take stays at full strength). It has no edge labels. Every highlight input the labels need is already in MARK-14's `graphHighlights` (`selectedNodeId`, `highlightNode`, `highlightAllNextNodes`, `highlightEdge`, `highlightOutputNodes`).
- **Count-only generation.** `generateSequence` (`src/utils/generate-sequence.ts`) already has `chooseRandomNode`, which picks a state by count; "(any)" uses it. The bag of words uses it at every step. The animation looks up the chosen step's edge in `graph.edges` (`animateCurrentSequenceIndex`), which in a bag of words is usually not there, so the hook supplies that step itself.
- **Why the bag of words is not a graph of every transition.** A complete graph of 700 states (MARK-15's 20,000-character case) has 490,000 edges, which `stateEdgeWeights`, `graphSignature` and the draw effect each walk; and the core, Inspect and the selection would treat them as real transitions. The core keeps the chain's graph, and only the arrows R11 lists are drawn.
- **Two modes, two tool states.** MARK-14's hook holds one graph, one selection, one generation and one set of outputs. Each mode keeps its own work (R24) by calling `useMarkovTool` once per mode, each with its own host, and keeping both modes' panes mounted, the hidden one `hidden`, as MARK-15's collapsed panes are. The hook has no module-level state beyond constants, so two calls are independent. A hidden graph gets a zero size from its `ResizeObserver`; on showing it again the Graph pane fits it, as MARK-15 does for a reopened Graph pane.
- **The drawing view's click placement.** `Drawing`'s `translateToGraphPoint` subtracts fixed offsets (50 px, 10 px) that are where the plugin's layout puts the graph, and `DragIcon` positions itself from `clientX`/`clientY` in an absolutely positioned box. In the plugin the SVG's own top-left is exactly (50, 10) (measured), so placing from the SVG's bounding box gives the plugin the same positions.
- **Where a label can sit.** A two-way pair's arrows are each moved 10 degrees around their states' outlines (`calculateEdges`), so they run close together. *(Measured with throwaway code on that geometry, states 150 px apart: the two midpoints are 4 to 17 px apart, and the points a third of the way along each arrow 19 to 43 px apart, the closest for a horizontal pair of large states.)* A label at the midpoint would sit on its partner's, and a third of the way along is still too close for a horizontal pair, so each label is moved off its own line, away from its partner.
- **Layout.** Every layout number (pane minimums and starting sizes, the gap, the pane header, the collapsed strip, the stacking width, the toolbar's button and spacing) lives once in MARK-15's `pane-sizes.ts`; this spec names those constants and restates none. Draw mode adds no height: the controls (the mode switch, the probabilities toggle, "Order matters" when there is no Input pane, and its read-only label when the switch is hidden) sit in `.controls-row`. Measured headless in Lato at 14 px, with plain buttons, the row with MARK-15's and MARK-16's controls fits one line at 904 px in every combination; its widest case, both switches in the row with Clear highlight, is about 720 px, which is past the 700 px just above MARK-15's stacking width. Adding MARK-18's two buttons, both read-only labels with Clear highlight come to about 920 px and both switches in the row about 995 px, past 904, so the row wraps, as MARK-15's `.controls-row` does (its R13), adding a line's height in those cases; the frame follows the reported height. Otherwise the Chromebook budget behind MARK-15's R13a holds in both modes. The generator's controls column is MARK-15's (R12, question 23); MARK-16 adds no control to it, only the output header's "Orderless", which wraps within the output if the column is narrow. R3a's notes overlay the bottom of the Graph pane's body, so they add no height either; in a narrow Graph pane a note wraps rather than being cut off. Probability labels are SVG text in the body's font, Lato in the interactive (MARK-15's R13b), as the states' labels are. Below MARK-15's stacking width each mode's panes stack as MARK-15's do, with no dividers; Draw mode's Graph pane keeps its no-collapse rule there, and since a stacked toolbar is fitted to the starting row height (MARK-15's `drawnRowHeight`: a 292 px body), its nine tools take two columns whatever row height is stored.
- **The toolbar's columns.** MARK-15's `toolbarHeight` gives Draw mode's nine tools 328 px in one column, 184 in two and 112 in three. The Graph pane's body is the row height less 38 px (`graphBodyHeight`: the 26 px header, two 1 px borders and 5 px of padding above and below), so they need two columns below a 366 px row, which the row never reaches (it is at most `workspaceHeight` less the generator's minimum, 330), and three below 222, the row at which Data mode's five tools, also 184 px in their one column, go to two; the 200 px minimum leaves 162. MARK-15's `toolbarColumns` returns 1 or 2, so it gains a third column (below, "Changes to MARK-14 and MARK-15"). Three columns are 112 px wide, inside the graph's 200 px minimum width.
- **The drawing view's tools** are a constant in `drawing.tsx` (`select`, `addNode`, `addEdge`, `addText`, `delete`, `fitView`, `recenter`, `reset`, `home`), the CODAP plugin's list; it stays the plugin's, since MARK-15 adds Zoom In and Zoom Out to `toolbar.tsx`'s `allTools` and the plugin's drawing view keeps its corner zoom buttons.
- **Draw mode's values.** `addNode` gives a state `value: 1` and `addEdge` a transition `value: 1`; the state editor's slider rescales a state's outgoing values to percentages of their total (`applyStatePercentages`). So a drawing's values are weights: R3's probabilities hold, and counts don't.
- **The host's identity rule** (MARK-14) applies to each mode's host: `log`, `markDirty` and `outputSequence` keep their identity when "Order matters" changes, since the animation keeps the callbacks it started with.

## Changes to MARK-14 and MARK-15

Both stories are built (PR #89 and PR #90). This is what MARK-16 changes in their code, in its own steps.

**MARK-14: no change needed** (PR #89 stays as it is). Two calls of `useMarkovTool` hold two modes' work. Everything else MARK-16 needs from the core is additive and made in MARK-16's own steps: whether order matters reaches the hook through the host (an optional field beside `viewMode`, which the host already holds, so the hook still takes only the host); count-only generation joins `generateSequence`; `SequenceGroup` gains an optional flag and its header the wording; the drawing view gains a tool list, toolbar zoom, a toolbar that shows its tool after Escape, click placement from its SVG, and, behind props only Draw mode passes, Escape closing its state editor, unique state names and an editor that works by keyboard, touch and pen.

**MARK-15.** What MARK-16 changes in MARK-15's code:
1. **The workspace's shape.** `Workspace` becomes a shell that holds the current mode, a configuration, host and tool per mode, the shared probabilities and "Order matters" state, and the `stacked` measurement. `DataWorkspace` moves to its own file and receives its tool and host as props in place of its own `useApHost` and `useMarkovTool` calls; a `DrawWorkspace` sits beside it. Each body keeps rendering its own `.controls-row`, with the shell's controls (the Data/Draw switch and the probabilities toggle) first, so the case switch, its label, Clear highlight and Escape stay where MARK-15 put them, each acting on that body's tool.
2. **Panes.** `DataWorkspace`'s pane state (which panes are open, the pane sizes, the generator's controls column) and the resize and following logic beside it move into a hook both bodies call, so each mode keeps its own (R24) and the code lives once; the linked split, which only Data mode has, stays in `DataWorkspace`. `Pane` gains the no-collapse option MARK-15's R12 leaves to MARK-16, used by Draw mode's Graph pane.
3. **The AP host.** `useApHost(hosted)` returns one host with `viewMode: "dataset"`. MARK-16 makes one per mode (`"drawing"` for Draw), carrying "Order matters" and adding `mode` to each logged event. Both stories ship in 0.6.0, so the log's shape changes before any release.
4. **A third toolbar column.** `toolbarHeight`'s `columns` and `toolbarColumns`' result widen from `1 | 2` to any number, `toolbarColumns` returning the fewest that fit, and `GraphPane` sets the count on `.graph-pane-content` for the grid in place of its `two-columns` class. The height argument stays `graphBodyHeight(top)`, with `top` the drawn row height (`drawnRowHeight`), so while stacked the count follows the starting row. Data mode's five tools still go to two columns below a 222 px row.
5. **Toolbar zoom in the drawing view.** `GraphPane`'s `zoomRequest` state, and its `zoom` that also tells the workspace the student took the view (R29c), move into a small shared hook that the drawing view uses too, so the two keep one zoom step (`zoomInStep` and `zoomOutStep`), and Draw mode's zooms stop its view following the graph as Data mode's do.
6. **`TextToGraph` goes** from the typed list, `LOGGED-EVENTS.md`, `drawing.tsx`'s Create From Text handler and the Jest test that asserts the call (R29).
7. **The table's edits.** `insertRow` gains the list layout (R10a). `deleteRow` is unchanged: it already deletes a word alone on its line with its line break.
8. **The Input pane's switches.** `InputPane`'s `caseSwitch` prop becomes `switches`, the "Order matters" and "Case sensitive" switches in one wrapping group (R9).

**For MARK-17 (flag only):** saved work must hold, per mode, what R24 lists (the drawing with its positions and weights, every Data-mode state's position, each mode's outputs, chosen item, Inspect tab and sort, open panes and pane sizes, Data mode's linked split, generator settings), plus the current mode, "Order matters" and the probabilities toggle. MARK-15's "Case sensitive" value (its R16a) is saved beside Data mode's "Order matters" value. MARK-15's `{ version: 1, input: { text } }` takes these as new fields, inside the roughly 300 KB MARK-15 leaves beside the input (an interactive state has about 450 KB). A drawing's states and transitions, and the second mode's outputs, come out of that same room. Data-mode positions must all be saved, not only moved ones: where a state sits depends on the order states were placed in, including whether order mattered then, so a fresh layout of the input would not reopen as left; MARK-15's R29a keeps a state that arrives with a position where it is. Draw mode needs nothing more, since its view doesn't lay out with `keepPositions` and its states carry their positions.

## The student-view mockup questions

Rebecca answered the layout page's questions on 2026-11-02, with Doug's decisions where her answers left something open. This story's are 7 and 13 to 21 and 30; "default" means the question's default is built.

7. **Words added in the table:** one per line with "Order matters" off, as prose with it on (R10a).
13. **The probabilities toggle in Draw mode:** default, `.controls-row` as in Data mode (R1). The mode is named "Data", not "Use data" (R23).
14. **"Order matters" without the Input pane:** default, `.controls-row` with no Input pane, hidden with a collapsed one (R9).
15. **The Data/Draw switch:** default, radio buttons at the top left (R23).
16. **Probability labels:** default, whole percents, with the rounding note along the bottom of the Graph pane (R3, R3a).
17. **The bag of words' arrows:** default, drawn as a chosen state's outgoing arrows are, with the note that only arrows out of the chosen word are drawn (R11, R3a).
18. **Marking an orderless output:** "Orderless" in the collapsed header, "Order matters: No" expanded (R15).
19. **Faded labels:** faded as the arrows are, but in a gray that meets WCAG's 4.5:1 text contrast (#767676) rather than the arrows' 35% opacity, which gives about 2.4:1 (R8). A default Rebecca may revisit.
20. **The toggle and arrow widths:** default, widths always follow the probabilities; Rebecca may change this to equal widths while probabilities are off, a one-line change (R5).
21. **Create From Text in Draw mode:** left out, and Zoom In and Zoom Out join the toolbar (R18).
30. **"Order matters" when students can't change it:** a read-only label, "Order matters: No" when order is off and "Order matters: Yes" when on (R9a, follow-up B). The switch students can change shows Yes or No beside it too (R9, follow-up C).

## Out of Scope

- Saving either mode's work, the mode, or the switches' states between visits (MARK-17).
- A "copy into drawing" from Data mode, author control over drawing tools, typed percentages or counts in the state editor (Rebecca's answers to question 3).
- Order matters in Draw mode.
- Any change a CODAP user can see, including the ELA module's documents.

## Open Questions

### RESOLVED: What does the probabilities toggle do to arrow widths (view B)?
**Context**: The Jira text's B ("arrow widths as each state's outgoing probabilities instead of the share of all transitions") predates MARK-20, which made per-state widths the only widths, in both apps, at Rebecca's choice.
**Options considered**:
- A) B is done: widths are always per-state, and the toggle only adds labels (A, C, D).
- B) The toggle switches widths too: off draws every arrow at one width, on draws per-state widths.
- C) The toggle switches between the old widths (share of all transitions) and per-state widths.

**Decision**: A, Rebecca's answer to mockup question 20, which she may revisit toward B. Doug's decision: the width rule is one option of the shared graph, so B is a one-line change in the workspace (R5).

### RESOLVED: Does Draw mode keep Create From Text?
**Context**: Her doc's reason for splitting the modes is that drawing and text together let students change probabilities in ways the input data doesn't support.
**Options considered**:
- A) Keep it: all tools on, as her answer to question 3 had it.
- B) Leave it out of the AP's Draw mode.

**Decision**: B, Rebecca's answer to mockup question 21, which also moves Zoom In and Zoom Out into the toolbar (R18). `TextToGraph` is then logged nowhere and is deleted (R29).

### RESOLVED: Low confidence: should D's arrows follow its labels?
**Context**: R7 labels the path's steps at full strength and the other arrows from its states faded, but today's output highlight fades arrows by whether both ends are on the path, so an arrow between two path states that the path didn't take is drawn at full strength with a faded label.
**Options considered**:
- A) Labels only; arrows stay as today.
- B) In the workspace, fade arrows by the path's steps too, so arrow and label agree; the plugin unchanged.

**Decision**: A. Checked in `graph.tsx`: the animation effect colors only the path's actual steps pink (`highlightOutputEdges`, built from consecutive output states), so an untaken arrow between two path states is already gray beside the pink steps; a faded label on it agrees with its color. B would change MARK-15's R25 (an output's pink path in the graph) for no gain a student would see.

### RESOLVED: Low confidence: should a mode switch be blocked while generating?
**Context**: R25 blocks it, so the hidden mode never animates unseen.
**Options considered**:
- A) Blocked while playing, paused or stepping (R25).
- B) Allowed: switching pauses the current mode's generation.

**Decision**: A. The animation runs on the hook's own `window.setInterval`, which a hidden mode's hook keeps running, so B needs the workspace to pause the hidden tool and resume it later; MARK-15 already makes the input read-only while generating (R21), and the switch follows the same rule. A paused sequence also blocks the switch, since resuming it is still pending; Cancel or finishing frees it.

### RESOLVED: Judgment call: how does each mode keep its own work?
**Options considered**:
- A) One `useMarkovTool` per mode, both mounted, the hidden one hidden.
- B) One tool whose state is saved and restored on each switch.

**Decision**: A. B needs every piece of the hook's state (outputs, generator settings, highlights, the animation's refs) exposed and settable, which MARK-14's `MarkovToolApi` doesn't offer; A needs nothing from MARK-14 and keeps graph positions and view state that live in the mounted components.

### RESOLVED: Judgment call: where does count-only generation live?
**Options considered**:
- A) In the shared generator, chosen by the host's "Order matters"; the core keeps the chain's graph, and the graph draws R11's arrows.
- B) The workspace hands the core a bag-of-words graph with every transition.

**Decision**: A. B is 490,000 transitions for MARK-15's largest input (Technical Notes), and Inspect and the selection would treat them as real.

### RESOLVED: Judgment call: one probabilities toggle, or one per mode?
**Options considered**:
- A) One for the workspace (R2).
- B) One per mode, with the rest of each mode's view.

**Decision**: A. The author sets one toggle and one starting value, and a student who turns probabilities on expects them on after switching; "Order matters" is Data mode's alone, so it stays per mode by nature.

## Self-Review

### Senior Engineer

#### RESOLVED: R11 said states are placed without regard to transitions
With order on, the graph lays out with its transitions (`forceLink` in the draw effect), so the claim was false for a graph first drawn as a Markov chain. What holds is that switching moves nothing, because MARK-15's `keepPositions` pins every placed state; R11 now says that.

#### RESOLVED: Draw mode's Reset was assumed to clear the drawing
Checked: Reset sets an empty graph and then restores `graphToRestore(viewMode, initialGraph, ...)`, which for a drawing is `initialGraph`; the AP's Draw mode never loads one, so Reset leaves the drawing blank, as R18 says.

#### RESOLVED: A hidden mode's graph view
A hidden `Graph` sees a zero size and MARK-15 refits a Graph pane when it reopens, so a student's zoom and pan may not survive a switch, though the states' places do. R24 now says so rather than promising the view is kept.

### QA Engineer

#### RESOLVED: "A seeded random source" doesn't exist
`generateSequence` calls `Math.random` directly, and its tests stub it with `jest.spyOn`. R32 now says the same.

#### RESOLVED: The Max Length check couldn't fail
With the default Max Length of 5, a Markov chain from most inputs also gives five states, so a bag-of-words sequence of five proves nothing. R33 now uses an input whose chain ends sooner.

### Implementation assumptions checked before the implementation spec

#### RESOLVED: Count-only generation from the existing generator
Checked with throwaway code over `graphFromValues`: picking every step as `chooseRandomNode` does matched the counts within 2% over 20,000 draws (the 3 of 5, 1 of 5, 1 of 5 of "the cat the mat the"), and on "a b" ran to Max Length where `generateSequence` stops after two states. R10 stands.

#### RESOLVED: Labels at an arrow's midpoint collide in a two-way pair
Measured (Technical Notes, "Where a label can sit"): D labels both directions of a path like `a b a`, and their midpoints are 4 to 17 px apart. R8 now requires the pair's labels not to overlap.

### Education Researcher

#### RESOLVED: Clearing a transition on switching was unlogged or double-logged
R12 clears a chosen transition when order is turned off. MARK-15 logs `SelectionCleared` only for a student's own clearing; R12 now says this clear logs nothing beyond `OrderMattersToggled`.
