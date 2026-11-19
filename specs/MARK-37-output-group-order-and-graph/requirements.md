# Output Groups: Order in the Header and a New Group When the Chain Changes

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Two more fixes to the output list's groups, from Rebecca's retest of MARK-37: a group's header says how order was set whichever way it was set, and a new group starts when the Markov chain changed since the last group's run, so a header always describes every output under it.

## Project Owner Overview

Each run of the generator adds its output under a dark gray header that lists the settings it was made with. Rebecca found two ways that header misleads. It says "Orderless" when "Order matters" was off and says nothing about order when it was on, so a reader can't tell an absent mark from a forgotten one. And changing the input text between runs adds the new outputs under the old header, so outputs made from two different texts look like one batch.

After this change, a Data mode header says "Order matters" either way, and editing the text (or anything else that changes the chain: the Case sensitive switch, a drawing edit, new CODAP data) starts a new group with its own header on the next run. Moving states around a drawing, or committing the same text again, does not.

## Background

The first MARK-37 pass (closed spec `specs/MARK-37-sequence-output-labeling-bug.md`) put a starting state that leaves the graph back to "(any)". Rebecca confirmed it works (Jira comment 43571) and named two more causes of what she first saw:

1. "It only says 'Orderless' or nothing, which seems odd." `SequenceOutputHeader` (`src/components/sequence-output.tsx`) shows "Orderless" collapsed and "Order matters: No" expanded when `group.orderMatters === false`, and nothing otherwise. MARK-16 R15 chose this, and kept the CODAP plugin's headers unchanged.
2. "There is not a new divider if the input text changes between runs." `generateNewSequence` (`src/hooks/use-markov-tool.tsx`) starts a group only when the delimiter, Max Length, starting state id or `orderMatters` differs from the last group's. The graph is not compared, so a Play after a text edit appends to the old group.

Where `orderMatters` comes from: the AP interactive's Data mode host passes the "Order matters" switch (`true` or `false`); its Draw mode host and the CODAP plugin pass nothing, so their groups record `undefined`, and order matters there (`MarkovHost.orderMatters` in `src/components/host.ts`).

What changes the graph: Data mode input edits and the Case sensitive switch (both rebuild it with `graphFromValues`), CODAP dataset values (`onDataChanged`), drawing edits (`src/components/drawing.tsx`), Create From Text, a saved drawing loaded (`onSetGraph`), Reset and Back To Main Menu. Three leave the chain as it was: dragging a state in a drawing (a new graph object with one state moved), Auto-Arrange (which moves the states inside the same graph object), and committing text whose states and transitions come out the same. A re-run of `graphFromValues` on the same values builds a new object with equal content.

Saved work: the AP interactive saves each mode's groups (`encodeOutputs` in `src/interactive/saved-outputs.ts`, via `build-state.ts`) and restores them (`decodeOutputs`, `restoredMode` in `restore-work.ts`). `readInteractiveState` keeps fields it doesn't know, and `isSavedGroup` ignores extra fields, so a new optional group field needs no version bump and older builds load it. The CODAP plugin saves no groups (`src/utils/plugin-state.ts`).

## Requirements

### The header

- **R1. A Data mode header states the order setting both ways.** A group with `orderMatters === false` reads as it does now: "Orderless" collapsed and "Order matters: No" expanded. A group with `orderMatters === true` shows its own mark in the same place: "Ordered" collapsed and "Order matters: Yes" expanded.
- **R2. A group that records no order setting.** Draw mode's groups and the CODAP plugin's (`orderMatters` undefined) say nothing about order, as now.

### When a group starts

- **R3. A changed chain starts a new group.** Play or Step starts a new group when the chain differs from the one the last group was generated from, in addition to the existing checks (delimiter, Max Length, starting state, order). The chain is the states (id, label, count) and the transitions (from, to, value); state positions are not part of it.
- **R4. An unchanged chain keeps the group.** Moving a state or Auto-Arrange in a drawing, saving a state's dialog with no change, committing text that gives the same states and transitions, and turning Case sensitive on or off on text with no capital letters, keep adding to the last group.
- **R5. Every source of change.** R3 holds however the chain changed: input edits, Case sensitive, CODAP dataset values, adding, deleting, renaming or editing a state or transition in a drawing, Create From Text, a saved drawing loaded, and new data or a new drawing after Back To Main Menu (which empties the graph but keeps the groups). Reset and Clear Output already empty the output, so the next group is new anyway.
- **R6. A running sequence is not split.** A sequence that is playing, stepping or paused when the chain changes finishes in its own group; R3 applies to the next sequence.
- **R7. Past groups are unchanged.** Groups already in the output keep their sequences and headers.

### Saved work

- **R8. Saved groups remember their chain.** The AP interactive saves, with each group, what it needs to compare the chain at the next Play after reopening, so reopening and playing with no change continues the last group, and reopening after a saved text change starts a new one.
- **R9. Work saved before this change.** A saved group with no record of its chain starts a new group at the next Play after reopening.
- **R10. The saved size.** What R8 adds to each group is a short value of at most seven characters, whatever the chain's size, so it does not count noticeably against the 140 KB output limit (`maxOutputBytes`).

### Both hosts

- **R11. The CODAP plugin.** R3 to R7 apply there too (the shared hook): new CODAP data or a drawing edit between runs starts a new group with the same header the old one had. The plugin saves no groups, so R8 and R9 don't apply. Its headers are unchanged (R2).
- **R12. No new log event.** Starting a group logs nothing new; `SequencePlayed` and `SequenceStepped` are unchanged.

### Tests

- **R13. Tests.** Jest on `useMarkovTool`: a changed input and a changed drawing (an added state, a renamed state, a changed transition value) each start a new group; a drag and the same values sent again keep the group; a sequence running when the input changes stays in its group; a restored group with a matching record continues, and one with none or a different one does not. Jest on `saved-outputs`: the record survives encode and decode, and a group with none or a malformed one still loads. Jest on `SequenceOutput`: both headers, collapsed and expanded, and R2's case. Cypress: a text edit between Plays, and a Case sensitive change on text with a capital letter, each start a new group, while a Case sensitive change on text with none doesn't; a reopened state continues its group, or not after a saved text change; the test that checks "Orderless" headers checks the ordered header too.

## Technical Notes

- Group check: `generateNewSequence` in `src/hooks/use-markov-tool.tsx`; a group's sequences come from `currentAnimatedSequenceGroup`, so a running sequence never re-checks (R6).
- Header: `SequenceOutputHeader` in `src/components/sequence-output.tsx`; "Order matters" is `orderMattersLabel` in `src/interactive/authored-state.ts`, and `yesNo` there gives Yes and No. `sequence-output.tsx` is shared by both hosts. No lint rule stops it importing from `src/interactive` (the boundary in `eslint.config.js` only keeps CODAP code out of the tool), but no shared component does today, so the header's "Order matters" text should come from one place both read rather than a second copy.
- Graphs: `chainsToGraph` and `graphFromValues` in `src/utils/chain-graph.ts` give nodes and edges in first-appearance order with ids equal to labels; drawing states get `nanoid` ids, so a deleted and re-added state is a different state.
- Saved groups: `SavedOutputs.groups` in `src/interactive/saved-outputs.ts`; `isSavedGroup` validates the known fields.
- The saved record is part of the interactive state researchers export; it identifies a chain only by comparison and means nothing read on its own.
- Other readers of groups, which this doesn't change: the teacher summary (`report-summary.ts`, which counts sequences across matching groups), the Outputs table (`tables/table-data.ts`) and a saved output selection (`restoredSelection`).
- Checked by throwaway Jest runs: two Plays with different values between them land in one group today; `dataChanged` with the same values builds a new, equal graph; text with no capitals gives the same chain under both Case sensitive settings, and one capital makes it differ; a saved group with an extra field decodes.
- Case sensitive in Data mode: `lowercase` lowercases every state; `asTyped` keeps it (`src/interactive/input/tokenizer.ts`). Text with no capitals gives the same chain both ways.

## Out of Scope

- Showing in a header what chain it came from (the text, a version, Case sensitive). A new group after a text change can have the same header as the one above it; the divider is the change.
- Regrouping outputs already generated or already saved.
- Changing what a header says about the start, Max Length or delimiter.
- The teacher summary's lines.

## Open Questions

### RESOLVED: Judgment call: Does "changed" mean the graph object or the chain it holds?
**Context**: The prompt says "when the graph changed". Every graph edit, including a drag, makes a new object.
**Options considered**:
- A) Compare the chain's content (states and transitions, not positions).
- B) Compare the graph object.

**Decision**: A. A throwaway Jest run showed `dataChanged` with the same values builds a new graph object, and a drawing drag replaces the graph to move one state, so comparing objects would start groups whose outputs came from the same chain. The same run confirmed the bug: "ababa" and "yxyxy" landed in one group.

### RESOLVED: Low confidence: What does a collapsed ordered header say?
**Context**: R1. Collapsed headers are slash-separated values (`the / 5 / " " / Orderless`); the expanded one has labeled lines, where "Order matters: Yes" matches the read-only label MARK-16 R9a uses.
**Options considered**:
- A) "Ordered" collapsed, "Order matters: Yes" expanded.
- B) "Order matters: Yes" / "Order matters: No" in both, dropping "Orderless".
- C) Another word Rebecca prefers.

**Decision**: A (Doug, stage 8). "Ordered" pairs with the "Orderless" students already see.

### RESOLVED: Low confidence: Do Draw mode's and the CODAP plugin's headers state order?
**Context**: R2. Neither has an order setting; order always matters there. MARK-16 R15 kept the CODAP plugin's headers unchanged, and the teacher summary leaves the order line out for a drawing. The interactive's Outputs table, though, already has an order column that says Yes for every Draw mode output (`tables/table-data.ts`).
**Options considered**:
- A) No: only a group that records a setting (Data mode) states it; Draw mode and the CODAP plugin stay as they are.
- B) Yes: a group with no setting shows the ordered mark, in every host.
- C) Draw mode yes, the CODAP plugin no.

**Decision**: A (Doug, stage 8). Neither has an order setting, so there is nothing to state, and the ELA module's headers stay as they are.

### RESOLVED: Saved work from before this change: continue the last group or start a new one?
**Context**: R9. A saved group with no chain record can't be compared.
**Options considered**:
- A) Start a new group at the next Play.
- B) Continue it, as before the change.

**Decision**: A. A group that can't be compared might hold another chain's outputs, and a header must describe everything under it. The cost is one extra divider, once, on work saved by the unreleased 0.6.0 test builds.

## Self-Review

Roles: Senior Engineer, QA Engineer, Product Manager, Student, Education Researcher, WCAG Accessibility Expert. Each finding was checked against the code before it was written down.

#### RESOLVED: Back To Main Menu was missing from R5
`handleReturnToMainMenu` empties the graph and keeps the groups, so new data or a drawing after it must start a group. Added to R5, with Reset and Clear Output noted as already emptying the output.

#### RESOLVED: R4's Case sensitive case was imprecise
`tokenize` lowercases every state under `lowercase`, so the chain is unchanged only when the text has no capital letters. R4 and R13 now say so.

#### RESOLVED: The saved record reaches researcher exports
The interactive state is exported as is; Technical Notes now say the record means nothing read on its own.

### Round 1

#### RESOLVED: Background said Auto-Arrange rebuilds the graph object
`handleAutoArrangeEnd` (`src/components/drawing.tsx`) moves the states inside the graph it was given and returns it; only a drag makes a new object. Background corrected; R4 is unaffected because the key ignores positions.

### Round 2

#### RESOLVED: R10 called the saved key fixed-length
The key is a base-36 number below 4294967291, so it runs from one to seven characters. R10 now says "at most seven characters"; what matters is that it doesn't grow with the chain.
