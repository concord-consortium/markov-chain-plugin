# Graph Views in the AP Interactive: Probabilities, Bag of Words and Drawing Mode

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-16

**Status**: **Closed**

## Overview

Add three ways of looking at the chain to the AP interactive's workspace: a probabilities toggle that labels the graph's arrows, an "Order matters" switch that turns the Markov chain into a weighted bag of words ("Orderless" to students), and Draw mode, where students draw their own chain. When the author offers both modes, a Data/Draw switch moves between them, and each mode keeps its own work.

The author decides, in MARK-13's authoring, whether students see each switch and where each starts. Saving that work between visits is MARK-17's. The CODAP plugin, and the ELA module that uses it, do not change, apart from R30's two fixes.

The requirements draw on Rebecca's doc, "Markov Tech Specs (AP)", her Slack reply of 2026-10-27 on switching modes, and her answers of 2026-11-02 to the student-view layout page, with Doug's decisions where those left something open.

## Requirements

### The probabilities toggle

- **R1.** **The toggle.** The workspace shows a "Show probabilities" toggle when the author makes it available and the current mode has a Graph pane, since its labels are drawn on the graph (MARK-15's R10: `showToggle` in that mode's configuration). So it shows in Draw mode, whose Graph pane is always present, and in Data mode only when the author includes the Graph pane, which only a Data-only interactive can leave out. It starts on or off as the author set it (`probabilities.startsOn`); without the toggle, probabilities stay on or off as set. It is a button that reports its state (`aria-pressed`) and works from the keyboard. It sits in the Graph pane's header, between the title and the collapse button, in both modes, and is hidden while the pane is collapsed.
- **R2.** **One setting for the workspace.** The toggle's state is shared by both modes: a student who turns probabilities on in Data mode finds them on in Draw mode.
- **R3.** **What a label says.** A probability label shows a transition's probability as a whole percent ("67%"), rounded as Inspect's Probability column is (MARK-15's R22). A transition's probability is its value over the total value of the transitions leaving its state, loops included: counts in Data mode, the slider's weights in Draw mode. With "Order matters" off, the probability of moving to a state is that state's count over the count of every word (R10).
- **R3a.** **Notes on the graph.** A one-line note runs along the bottom of the Graph pane, in both modes, only while it applies: "Percents are rounded, so they may not add up to 100%" while the graph shows labels and throughout a generated sequence, whose labels come and go with each step, and "Only arrows out of the chosen word are drawn" while "Order matters" is off and a state is chosen, other than while a sequence is generated, when the graph draws the generator's arrows instead and the chosen state's arrows are not drawn (mockup questions 16 and 17). When both apply, both show, one line each. The notes take no clicks, sit clear of the toolbar, and are read out by screen readers when they appear.
- **R4.** **(A) A chosen state's outgoing probabilities.** With probabilities on and a state chosen (MARK-15's R24), each arrow leaving it, its loop included, is labeled.
- **R5.** **(B) Arrow widths.** The toggle leaves widths as MARK-20 draws them: by each state's own probabilities, always (mockup question 20). Rebecca may later ask for equal widths while probabilities are off, so the width rule sits behind one option of the shared graph, and that change is one line in the workspace.
- **R6.** **(C) Candidate lines while generating.** With probabilities on, while a sequence plays or steps, each dashed candidate line from the current state (the step where every possible next state is shown, today's `highlightAllNextNodes`) is labeled; an arrow of no value in a drawing can't be taken, so it is no candidate: it isn't dashed and has no label. When the step chooses the next state, the candidates' labels go, as the dashed lines do, and the chosen transition is labeled: with "Order matters" on, its probability from the state it leaves; with it off, the chosen word's share of all the words, which is all a bag of words' pick depends on (Rebecca). The plugin labels it too.
- **R7.** **(D) A chosen output's path.** With probabilities on and an output chosen, each step of its path is labeled at full strength, and each other arrow leaving a state on the path, before the path's last state, is labeled faded. A state that appears more than once in the path has every step taken from it labeled at full strength. A step whose transition is not in the current graph (the input changed after the output was generated, or the output was generated with "Order matters" set the other way) has no arrow and no label. In the bag of words only the path's steps are labeled, with no faded labels: every state's outgoing percents are the same list there (R3), so faded labels would repeat it once per path state, up to every state each, and choosing a state (R4) already shows it. Rebecca may revisit this default.
- **R8.** **How labels look.** A label sits on its arrow (a loop's on the loop), the two labels of a two-way pair never overlap (D labels both directions of a path like `a b a`), each stays legible over other arrows and states, a faded label in #767676 so it still meets 4.5:1 contrast on white, moves with its arrow when a state is dragged, and takes no clicks. With probabilities off, nothing on the graph is labeled. Labels are drawn only where R4, R6 and R7 put them, so a large graph draws at most one state's outgoing labels, or one output's path and the states along it.

### "Order matters"

- **R9.** **The switch.** In Data mode the workspace shows an "Order matters" switch when the author shows it (`orderMatters.showSwitch`), starting on or off as the author set it (`orderMatters.startsOn`); without the switch, order matters or not as set. It shows "Yes" or "No" beside it (follow-up C), reports its state (`role="switch"` with `aria-checked`) and works from the keyboard. It is MARK-15's `SettingSwitch`, the component its "Case sensitive" switch uses (MARK-15's R16a), so the two read alike. Draw mode has no switch: a drawing is always a Markov chain. It sits at the top of the Input pane; with no Input pane, in `.controls-row`; with the Input pane collapsed, it is hidden with the pane (mockup questions 3 and 14).
  - **Beside "Case sensitive".** The two switches sit together, "Order matters" first, in one group that wraps: about 331 px side by side, so they take one line each at the Input pane's 280 px start and share a line once it is dragged wider. A single switch is about 151 px (166 at 16 px), more than the Input pane's 160 px minimum leaves inside it, so a switch's name wraps there rather than spilling past the pane, as MARK-15's `SettingSwitch` does (its R16a). With no Input pane the group sits in `.controls-row`; stacked, the Input pane takes the workspace's full width, so they share a line wherever it is wider than about 331 px.
- **R9a.** **The read-only label.** When the author hides the switch, Data mode's `.controls-row` shows a read-only label saying how order is set: "Order matters: Yes" when order matters, "Order matters: No" when it doesn't (mockup question 30, follow-up B). It is MARK-15's `SettingLabel`, and sits beside the read-only "Case sensitive" label when that switch is hidden too, "Order matters" first. Draw mode shows no label.
- **R10.** **The bag of words.** With "Order matters" off, the states and their counts are the same as with it on (the same tokens and capitalization; a break in the input changes nothing). Generating picks every next state from all the states, the current one included, with probability proportional to its count, whatever the current state is. "(any)" as the starting state picks by count, as it does today. A sequence always runs to its Max Length, since every state has a next state.
- **R10a.** **Words added in the table.** In the linked and table-only views, a word added in the table is written into the text on a line of its own while "Order matters" is off, so a list built in the table reads as a list (mockup question 7); with order on, it is written as prose, as MARK-15's R20 says. A single line break is not a break in the chain, so the list is the same input as the prose, and deleting a listed word leaves no blank line between the words (the first word's line break stays, which changes no row or state).
- **R10b.** **The interactive's layout.** In the interactive, a graph laid out whole (a starting text, or a text more than half of whose words are new) puts its words in rows in the order they first appear, back and forth across the Graph pane like a CRT's scan line: the rows are chosen so the layout's width to height comes nearest the pane's, and every row but the last spreads to the full width, so each starts under where the one before ended. Each word sits off its place by a normal offset across and down, each direction seeded by the word alone through its own hash (standard deviation 11 px, clipped at 22 px), so the same text always gets the same layout, the rows read as loose rather than ruled, and with order off the columns don't line up (Doug, after Rebecca's hand-placed pictures). Each word's room in the layout includes its largest offset, so whatever the offsets, two words in a row are at least 40 px apart and two rows at least 30 px. "Order matters" on and off give every word the same place, and switching moves none. Words added to a laid-out graph are placed as before. The plugin keeps its force layout.
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
- **R18.** **Drawing tools.** The Graph pane's toolbar has Select, Add State, Add Transition, Delete, Fit View, Recenter View, Zoom In, Zoom Out and Reset (which, after the existing confirmation, clears the drawing and Draw mode's outputs and puts its generator settings back to their defaults, as the CODAP plugin's Reset does, the Delimiter select returning to space with the delimiter; Data mode's work is untouched), in that order. Create From Text is left out, and Zoom In and Zoom Out move from the graph's corner into the toolbar, as in Data mode, so every adjustment is in one place (mockup question 21; MARK-15's R29). There is no Back to Main Menu. These nine tools rely on MARK-15's R29 rules, with one more column: at the starting row height they sit in two columns, and below a 222 px row, where Data mode's five tools go to two, in three, every tool still visible. Double-clicking a state in the Select tool opens the state editor (its label and the probability slider), as in the CODAP plugin's drawing view; like Data mode's state dialog, it covers the whole interactive while open. Every state in a drawing has its own name, since Inspect, the generator's starting state, the graph and the log all name states by label: a new state takes the first "State n", counting from one past the number of states, that no other state has, and the editor won't save an empty name or one another state has, saying why. The editor works without a mouse in Draw mode: each of the slider's handles is a slider a screen reader names and reads as its probability, the arrow keys move it 1% (10% with Shift), a finger or pen drags it as a mouse does, and the name field is labeled. The slider looks as it does today. The CODAP plugin keeps its naming and editor as they are, apart from R30's fix to the selector's thumbs.
- **R19.** **Placing what is drawn.** A state added with a click is centered where the student clicked, and the tool's icon follows the pointer, wherever the Graph pane sits on the page. *(Checked with throwaway code: today's drawing view places a state 148 px right of the click once its graph is not at the plugin's own (50, 10).)* In the CODAP plugin both stay where they are today.
- **R20.** **Inspect in Draw mode.** A drawing has no counts: its states all start at 1 and its slider sets weights. The States tab lists the states without a Count column; the Transitions tab lists each transition and its Probability as a whole percent ("67%"), with no Count column and no "2 of 3". Both sort as in Data mode, on the columns present.
- **R21.** **Choosing in Draw mode.** In the Select tool, a state or transition is chosen from the graph or Inspect, and an output from the output, with what lights up in the graph and Inspect as MARK-15's R25 says; there is no input to light up. The other tools keep their clicks for drawing, as today. Escape, a click on the graph's background in the Select tool and the Clear highlight button clear the choice, as in Data mode (MARK-15's R27); pressing a toolbar button leaves it as it is. Escape also returns to the Select tool, as in the CODAP plugin, and the toolbar shows Select pressed, reporting which tool is pressed to screen readers. With the state editor open, Escape closes the editor and leaves the choice, as Data mode's Escape closes its dialog first.
- **R22.** **Probabilities in Draw mode.** R4, R6 and R7 apply to a drawing, with R3's weights.

### The Data/Draw switch

- **R23.** **The switch.** With both modes available (`modeSwitch`), the workspace shows two radio buttons, "Data" and "Draw" (MARK-13's mode labels), at the left of `.controls-row`, the current mode chosen (mockup questions 13 and 15). They are a labeled group, operable from the keyboard. The interactive opens in the author's starting mode.
- **R24.** **Each mode keeps its own work.** Switching modes hides one mode's workspace and shows the other's, and changes nothing in either. Each mode keeps, while the interactive is open: its graph and where its states are; its chosen state, transition or output; its Inspect tab and sort; which of its panes are open, and its pane sizes (MARK-15's R13a: the widths the Input|Graph and Graph|Inspect dividers set, the row height the row divider sets, and in Data mode the linked text box and table's split), held per mode in the workspace, ready for MARK-17 to save; its generator settings and outputs; and, in Data mode, its input and "Order matters"; in Draw mode, its tool. Switching needs no confirmation. The graph's zoom and pan may be refit when its mode is shown again, as a reopened Graph pane is, which sets the view following the graph again (MARK-15's R13a and R29c).
- **R25.** **While generating** in the current mode, the switch cannot be changed, since the hidden mode's generation would keep running unseen.
- **R26.** **Between visits.** This story saves nothing new: reopening the interactive shows the starting mode, the saved input (MARK-15's R31) and a blank drawing. MARK-17 saves both modes' work and the layout.

### Logging

- **R27.** New events, added to the typed list and to `LOGGED-EVENTS.md` (MARK-15's R35):
  - `ProbabilitiesToggled` with `on`;
  - `OrderMattersToggled` with `on`;
  - `ModeSwitched` with `mode`.
- **R28.** **Every event says which mode it came from:** each logged event's data gains `mode` (`useData` or `draw`, MARK-13's mode ids), so the shared core's events (a play, a selection) from the two modes can be told apart.
- **R29.** The generator's events (`SequencePlayed`, `SequenceStepped`, `SequencePaused`, `SequenceResumed`, `SequenceCanceled`, `SequenceGenerated`) gain `orderMatters` in their settings. MARK-15's drawing-view events (`StateAdded`, `TransitionAdded`, `StateDeleted`, `TransitionDeleted`, `StateEdited`, `GraphReset`) are now reached in the AP interactive, from Draw mode. `TextToGraph` (Create From Text) is reached nowhere once R18 leaves the tool out: the CODAP plugin still has the tool, but its host's `log` does nothing (MARK-15's R4). So the event is deleted from the typed list, `LOGGED-EVENTS.md` and `drawing.tsx`'s call, and the plugin's Create From Text works as before.

### The CODAP plugin and the shared code

- **R30.** Everything this story adds to the shared core (the graph's labels and its bag-of-words drawing, the arrow-width option, count-only generation, the output group's flag, the drawing view's tool list, toolbar zoom, pressed tool, click placement, Escape closing its editor, unique state names and the editor's keyboard and touch input) is off or absent in the CODAP plugin, which behaves and draws exactly as before, apart from two deliberate fixes (Reset also puts the Delimiter select back to space, R18; the probability selector's thumbs stay on their states when it renders again, as typing in the state editor's name field makes it do): every existing plugin test, Jest and Cypress, passes unchanged, apart from the Jest test of the `TextToGraph` call R29 deletes and the two hook tests whose expected generator settings gain R29's `orderMatters: true`.
- **R31.** MARK-14's and MARK-15's code is used as built (PR #89 and PR #90). What this story adds to them, and what would change in them, is listed under "Changes to MARK-14 and MARK-15".

### Verification

- **R32.** Jest, with expected values written out: which arrows carry which labels and at what strength for A, C and D, in a Markov chain, a bag of words and a drawing, including a self-loop, a state repeated in a path, and a step missing from the graph (R3 to R7); count-only generation, with `Math.random` stubbed as `generate-sequence.test.ts` does, picking by count from every state and never ending early (R10); a word added in the table as a line of its own (R10a; MARK-15's `deleteRow` tests already cover deleting a word alone on its line); which notes apply (R3a); both arrow-width rules (R5); the toolbar's column count for nine tools at each flip (R18); Inspect's Draw-mode rows (R20); and the log list (R27). The configuration's switches (R1, R9, R23) are MARK-15's `workspaceConfig` fields, which its tests already cover for every mode and setting, and this story doesn't change them.
- **R33.** Cypress, on MARK-13's fake Activity Player page: each of A, C and D appearing with probabilities on and not with them off; the toggle hidden and probabilities fixed as authored, hidden in Data mode alone without a Graph pane, and shown in Draw mode; the toggle in the Graph pane's header between its title and collapse button in both modes, and gone while that pane is collapsed, keeping its setting (with both modes offered, the authored state keeps the Graph pane on); each note showing only while it applies; "Order matters" off showing no arrows until a state is chosen, then only its outgoing arrows, the Transitions tab's explanation, a generated sequence of Max Length from an input whose Markov chain ends sooner ("a b" from "a"), its group's "Orderless" header, and a word added in the table written on a line of its own, and deleted leaving no blank line; turning order off clearing a chosen transition without `SelectionCleared` and keeping a chosen output; the switch disabled while playing; the switch's Yes or No following it, and the read-only label with the switch hidden; the two switches together inside the Input pane at its 160 px minimum, and in `.controls-row` with no Input pane, "Order matters" first; at 700 px wide, MARK-16's widest row staying inside the workspace, and going onto a second line where it doesn't fit, which fails without MARK-15's wrap rule; drawing a state where clicked, a transition, and editing its probabilities; a new state's name skipping one in use, and the editor refusing an empty or taken name; a slider handle moved by the arrow keys and by a touch drag in an editor that covers the interactive; a background click clearing a chosen state in Draw mode, and a chosen output kept through Zoom In and Fit View; Draw mode's own toolbar with all nine tools inside the Graph pane, in two columns at the starting row height and three with the row at its minimum, its zoom buttons zooming the drawing and no zoom buttons in the graph's corner; a divider moved in one mode leaving the other mode's sizes as they were; switching modes both ways with the input, the drawing, the outputs and a chosen state kept in each; and the log messages for the toggle, the switch and a mode change, each carrying `mode`.
- **R33a.** With MARK-15's 20,000-character starting text and "Order matters" off, the time from clicking a state, with probabilities on, to its arrows and labels being drawn is measured in headless Chrome and recorded in the PR (not a CI assertion, which would be flaky), as MARK-15's R29b is.
- **R34.** The build, both `tsc` checks and the three lint commands are clean, and a headless check in CODAP 3.1.2 shows the plugin unchanged apart from R30's deliberate fixes (MARK-12's R11 list). *(Done with headless Playwright, the branch's build beside master's and MARK-15's; the results are in the PR.)*

## Technical Notes

### Where the code is

- `src/interactive/workspace/workspace.tsx` is the shell: the mode, one host and tool per mode, the probabilities and "Order matters" state, `stacked`, and `ArrowMarkers`. `data-workspace.tsx` and `draw-workspace.tsx` are the bodies, both always mounted, the hidden one `hidden`, so each mode keeps its work (R24).
- Both bodies share `use-pane-layout.tsx`, `workspace-panes.tsx`, `controls-row.tsx` and `use-mode-body.ts`. `ap-host.ts` makes one host per mode and adds `mode` to each logged event.
- `src/components/graph-labels.ts` decides which arrows and labels are drawn, as pure functions (`probabilityLabels`, `bagOutgoing`, `bagArrows`). `graph-overlay.ts` draws them: `drawOverlay` rebuilds on a highlight change, as the highlight effect's last pass, since `unhighlightNonOutput` sets the opacity of every `line` in the SVG; `moveOverlay` repositions on a tick, where a rebuild of 700 arrows and labels costs about 11 ms against 4.
- `src/components/scan-line-layout.ts` places R10b's rows, given each state's radius and the view's width to height; `Graph` uses it with `scanLine` and `keepPositions` where it would otherwise lay the whole graph out, and waits for its own size when it lays the rows out, holding a fit until the graph is drawn; a graph already placed is built while hidden, so its positions are still saved.
- `src/components/drawing/state-labels.ts` holds `nextStateLabel` and `labelProblem`. `src/hooks/use-zoom-request.ts` is the toolbar zoom both graph views share.

### Plugin neutrality

Everything new in shared code sits behind a prop or host field the plugin doesn't pass: `tools` on `Drawing` (which turns on `keepOutputOnRedraw` and `centerOffOrigin`), `probabilityLabels`, `arrowWidths` and `orderMatters` on `Graph`, `onUserZoom`, `accessibleEditor`, `uniqueLabels`, `closeEditorOnEscape`, and `orderMatters` and `stopAtNoValue` on the host.

### The bag of words

- The core keeps the chain's graph. A complete graph of 700 states has 490,000 edges, which `stateEdgeWeights`, `graphSignature` and the draw effect would each walk, and which Inspect and the selection would treat as real transitions. So `Graph` draws no transitions with order off, and the overlay draws only R11's arrows.
- `highlightSelected` fades by `graph.edges`, the chain's, which would fade every state the chosen state has no chain arrow to, so `graph-highlight.ts` counts every state as connected when `orderMatters` is false: with order off it fades no state or label.
- The animation looks up a step in `graph.edges`, which a bag-of-words step is usually not in, so the hook supplies the step.
- `bagOutgoing` returns nothing for an id not in `nodes`, so a chosen output whose state left the input labels no step from it.

### Two mounted graphs

- Fixed ids resolve to the first copy in the document, the Data body's, which is the hidden one while Draw mode shows. `url(#arrow)` finds that copy, which in a hidden body draws nothing, so one set of arrowheads renders ahead of the bodies; the plugin's Cypress tests need its marker ids, so the ids aren't prefixed. The speed toggle's id comes from `useId`.
- `Drawing`'s window listeners (Escape, the rubber band's `mousemove`) return inside a `[hidden]` element.
- A hidden `Graph` gets a zero size, so showing a body fits its graph and the view follows again; each body measures its own row, and a hidden body's zero width never changes the stored sizes.
- Each body has its own copy of the mode switch, so the shown body's checked radio takes focus after a change, or Chrome moves focus to the page's body.

### The drawing view

- A click is placed from the SVG's bounding box, which in the plugin is exactly the (50, 10) the old code subtracted. `.dragIcon` is `position: fixed` for the same reason.
- A drawing's values are weights, not counts: `addNode` and `addEdge` give 1, and the slider rescales a state's outgoing values. A state whose arrows all have no value shares evenly in Draw mode's editor, ends a sequence (`stopAtNoValue`), and sorts as 0 in Inspect.
- `keepOutputOnRedraw`: a tool press redraws the graph, and only the highlight effect draws a chosen output. `centerOffOrigin`: the graph's fit moves a graph half way to the view's center, which a layout around the origin hides, and a drawing sits wherever the student clicked.
- `onEdgeSelect` and `onBackgroundClick` reach `Graph` only in the Select tool, so the other tools keep their clicks for drawing.
- `handleDimensionChange` keeps its identity, or each render re-sends the last size and spends the fit after a resize.
- `NodeModal` and the toolbar: Draw mode's state editor is `position: fixed` over the interactive, since `.pane-body` would otherwise contain it. `Toolbar` keeps its own pressed tool unless given `selectedTool`, so `Drawing` passes it with `tools`.

### Layout

- Every layout number lives in `pane-sizes.ts`. `toolbarColumns` returns the fewest columns that fit: nine tools take two columns at the starting row and three below a 222 px row, at which Data mode's five tools go to two. A stacked toolbar is fitted to the starting row (`drawnRowHeight`).
- `.controls-row`'s widest case fits inside the 700 px above the stacking width. With MARK-18's two buttons it wraps in its widest cases and adds a line's height.
- A label's offset is its box's reach along the arrow's normal (8 to 17 px), so a two-way pair can't overlap however short the arrows: the pair's midpoints are only 4 to 17 px apart.

### Tests

- Cypress: scope queries to `.workspace-body:not([hidden])` in tests with both modes. MARK-15's `start` helper defaults to Data mode alone, since the hidden body duplicates what its tests click, and its expected logs carry `mode`.
- The state editor's slider thumbs appear one effect after it opens, so wait for one before pressing Tab.
- `Graph` and the overlay's d3 drawing have no Jest coverage, since Jest can't load d3; Cypress covers them.
- Any lint warning puts webpack's overlay over the page, and every Cypress test then fails with "covered by another element".

### For MARK-17

Saved work must hold, per mode, what R24 lists (the drawing with its positions and weights, every Data-mode state's position, each mode's outputs, chosen item, Inspect tab and sort, open panes and pane sizes, Data mode's linked split, generator settings), plus the current mode, "Order matters", the probabilities toggle and MARK-15's "Case sensitive" value. MARK-15's `{ version: 1, input: { text } }` takes these as new fields, inside the roughly 300 KB it leaves beside the input. Data-mode positions must all be saved, not only moved ones: where a state sits depends on the order states were placed in, including whether order mattered then, so a fresh layout would not reopen as left.

## Out of Scope

- Saving either mode's work, the mode, or the switches' states between visits (MARK-17).
- A "copy into drawing" from Data mode, author control over drawing tools, typed percentages or counts in the state editor (Rebecca's answers to question 3).
- Order matters in Draw mode.
- Any change a CODAP user can see, including the ELA module's documents, apart from R30's two fixes.

## Decisions

### Student-view mockup questions

Rebecca answered the layout page's questions on 2026-11-02, with Doug's decisions where her answers left something open; "default" means the question's default is built.

7. **Words added in the table:** one per line with "Order matters" off, as prose with it on (R10a).
13. **The probabilities toggle in Draw mode:** in the Graph pane's header, as in Data mode (R1). The mode is named "Data", not "Use data" (R23).
14. **"Order matters" without the Input pane:** default, `.controls-row` with no Input pane, hidden with a collapsed one (R9).
15. **The Data/Draw switch:** default, radio buttons at the top left (R23).
16. **Probability labels:** default, whole percents, with the rounding note along the bottom of the Graph pane (R3, R3a).
17. **The bag of words' arrows:** default, drawn as a chosen state's outgoing arrows are, with the note that only arrows out of the chosen word are drawn (R11, R3a).
18. **Marking an orderless output:** "Orderless" in the collapsed header, "Order matters: No" expanded (R15).
19. **Faded labels:** faded as the arrows are, but in a gray that meets WCAG's 4.5:1 text contrast (#767676) rather than the arrows' 35% opacity, which gives about 2.4:1 (R8). A default Rebecca may revisit.
20. **The toggle and arrow widths:** default, widths always follow the probabilities; Rebecca may change this to equal widths while probabilities are off, a one-line change (R5).
21. **Create From Text in Draw mode:** left out, and Zoom In and Zoom Out join the toolbar (R18).
30. **"Order matters" when students can't change it:** a read-only label, "Order matters: No" when order is off and "Order matters: Yes" when on (R9a, follow-up B). The switch students can change shows Yes or No beside it too (R9, follow-up C).

---

### What does the probabilities toggle do to arrow widths (view B)?
**Context**: The Jira text's B predates MARK-20, which made per-state widths the only widths, in both apps.
**Options considered**:
- A) B is done: widths are always per-state, and the toggle only adds labels.
- B) Off draws every arrow at one width, on draws per-state widths.
- C) The toggle switches between the old widths and per-state widths.

**Decision**: A, Rebecca's answer, which she may revisit toward B. Doug: the width rule is one option of the shared graph, so B is a one-line change in the workspace.

---

### Does Draw mode keep Create From Text?
**Context**: Rebecca split the modes because drawing and text together let students change probabilities in ways the input doesn't support.
**Decision**: Left out, Rebecca's answer to question 21, which also moves Zoom In and Zoom Out into the toolbar. `TextToGraph` is then logged nowhere and is deleted.

---

### Should D's arrows follow its labels?
**Context**: Today's output highlight fades arrows by whether both ends are on the path.
**Options considered**:
- A) Labels only; arrows stay as they are.
- B) In the workspace, fade arrows by the path's steps too.

**Decision**: A. The animation effect colors only the path's actual steps pink, so an untaken arrow between two path states is already gray beside them, and a faded label agrees with it.

---

### Should a mode switch be blocked while generating?
**Options considered**:
- A) Blocked while playing, paused or stepping.
- B) Allowed: switching pauses the current mode's generation.

**Decision**: A. The animation runs on the hook's own interval, which a hidden mode's hook keeps running, and the input is read-only while generating already.

---

### How does each mode keep its own work?
**Options considered**:
- A) One `useMarkovTool` per mode, both mounted, the hidden one hidden.
- B) One tool whose state is saved and restored on each switch.

**Decision**: A. B needs every piece of the hook's state exposed and settable; A needs nothing from MARK-14 and keeps the positions and view state in the mounted components. The shell calls both hooks, since the mode switch and the probabilities toggle read the current mode's tool and host.

---

### Where does count-only generation live?
**Options considered**:
- A) In the shared generator, chosen by the host's "Order matters".
- B) The workspace hands the core a bag-of-words graph with every transition.

**Decision**: A. B is 490,000 transitions for MARK-15's largest input.

---

### One probabilities toggle, or one per mode?
**Decision**: One for the workspace. The author sets one toggle and one starting value, and a student who turns probabilities on expects them on after switching.

---

### Where are labels and bag arrows drawn?
**Options considered**:
- A) An overlay layer rebuilt by the highlight effect and moved by `tick`.
- B) Drawn with the graph, one hidden label per arrow.

**Decision**: A. B can't hold a bag of words' arrows, which exist only for the chosen state, and would add about 2,000 labels to every redraw at MARK-15's largest input.

---

### What does a chosen output label in the bag of words?
**Context**: Every state's outgoing percents are the same list there, so R7's faded labels would repeat it per path state: up to 2,800 arrows and labels at Max Length 5, about 51 ms a rebuild.
**Decision**: Only the path's steps (`stepsOnly`), Doug's decision, confirmed by Rebecca.

---

### How do faded labels look?
**Context**: At the arrows' 0.35 opacity a label is about 2.4:1 on white, below WCAG 1.4.3's 4.5:1.
**Decision**: #767676 (4.54:1), with full-strength labels black and the faded arrows at 0.35. Doug's decision, confirmed by Rebecca.

---

### Why do bag-of-words arrows keep pointer events?
**Context**: With `pointer-events: none`, a click on an arrow reached the background and cleared the choice, against R12.
**Decision**: They catch clicks with no handler.

---

### What does Escape do with Draw mode's state editor open?
**Decision**: It closes the editor and leaves the choice, as Data mode's dialog does, through `closeEditorOnEscape`, which the plugin doesn't pass.

---

### Can Draw mode's states share a label?
**Context**: Inspect, the starting state, the graph and the log all name states by label; the plugin's naming gave "State 1, State 3, State 3" after a delete, and an empty label logged as "(any)".
**Decision**: No, with `uniqueLabels`, which only the Draw body passes (Doug). Ids in the log would change a contract MARK-19 reads and leave students the duplicates.

---

### Does Draw mode's slider work without a mouse?
**Decision**: Yes, with `accessibleEditor`: keyboard and pointer sliders that look as they did (Doug). Its keys step percentages directly rather than through `movePairedPercentage`, whose rounding could refuse a step at the pair's end, and its drag listens on the window, since a thumb past 90% remounts.

---

### Why does R10a leave the first word's line break?
**Context**: Removing the line break before a word turns "a\n\nb c" without `b` into "a\n c", losing the break, and MARK-15's test pins `deleteRow`.
**Decision**: `deleteRow` stays as it is. The leading line break changes no row or state.

---

### Should Draw mode's Reset return the Delimiter select?
**Context**: The shared Reset put the delimiter back to a space but left the select showing "none" or "other", so the control disagreed with the generator.
**Decision**: Fixed in the shared hook, in both apps (Doug): a plain bug with a one-line fix, recorded as R30's deliberate fix.

---

### Should the plugin's probability selector stop swapping its thumbs?
**Context**: It reversed memoized `offsets` in place, so with three or more transitions a render that didn't rebuild them, as typing in the name field makes, swapped the thumbs.
**Decision**: Fixed for both apps (Doug): always reversing a copy is less code than keeping the old path for the plugin.

---

### Known limits left as they are (Doug)

- With both switches showing, at the 50,000-character limit, a press on a bottom row's delete can miss, because the refusal message moves the row; a second press works. Reserving the line would cost every student about 20 px of table. One MARK-15 test hides the "Order matters" switch for this.
- A fit within 150 ms of a wheel zoom reads as the student's zoom, so following stops, since d3-zoom's wheel gesture stays open that long. MARK-15's Fit View does this too, and a test waits it out.
- A large input in the hidden Data body slows Draw updates, about 45 ms against 16. Both bodies re-render with the shell; stopping that would mean stabilizing the shell's props.
