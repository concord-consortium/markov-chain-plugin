# Output Groups: Order in the Header and a New Group When the Chain Changes

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37

**Status**: **Closed**

**Follows**: [MARK-37-sequence-output-labeling-bug](MARK-37-sequence-output-labeling-bug.md), the first MARK-37 fix.

## Overview

Two more fixes to the output list's groups, from Rebecca's retest of MARK-37: a Data mode group's header says how order was set whichever way it was set, and a new group starts when the Markov chain changed since the last group's run, so a header always describes every output under it.

Rebecca confirmed the first fix (Jira comment 43571) and named two more causes of what she first saw: "It only says 'Orderless' or nothing, which seems odd", and "there is not a new divider if the input text changes between runs". The header showed an order mark only when "Order matters" was off (MARK-16 R15), and `generateNewSequence` compared the delimiter, Max Length, starting state and order, but not the graph.

## Requirements

### The header

- **R1. A Data mode header states the order setting both ways.** `orderMatters === false` reads "Orderless" collapsed and "Order matters: No" expanded; `orderMatters === true` reads "Ordered" and "Order matters: Yes".
- **R2. A group that records no order setting.** Draw mode's groups and the CODAP plugin's (`orderMatters` undefined) say nothing about order, as before.

### When a group starts

- **R3. A changed chain starts a new group.** Play or Step starts a new group when the chain differs from the one the last group was generated from, in addition to the delimiter, Max Length, starting state and order. The chain is the states (id, label, count) and the transitions (from, to, value); state positions are not part of it.
- **R4. An unchanged chain keeps the group.** Moving a state or Auto-Arrange in a drawing, saving a state's dialog with no change, committing text that gives the same states and transitions, and turning Case sensitive on or off on text with no capital letters, keep adding to the last group.
- **R5. Every source of change.** Input edits, Case sensitive, CODAP dataset values, adding, deleting, renaming or editing a state or transition in a drawing, Create From Text, a saved drawing loaded, and new data or a new drawing after Back To Main Menu (which empties the graph but keeps the groups). Reset and Clear Output already empty the output.
- **R6. A running sequence is not split.** A sequence playing, stepping or paused when the chain changes finishes in its own group; R3 applies to the next sequence.
- **R7. Past groups are unchanged.** Groups already in the output keep their sequences and headers.

### Saved work

- **R8. Saved groups remember their chain.** The AP interactive saves a key with each group, so reopening and playing with no change continues the last group, and reopening after a saved text change starts a new one.
- **R9. Work saved before this change.** A saved group with no key starts a new group at the next Play after reopening.
- **R10. The saved size.** The key is at most seven characters whatever the chain's size, 16 to 22 bytes per group as the Activity Player stores it.

### Both hosts

- **R11. The CODAP plugin.** R3 to R7 apply there too, through the shared hook: new CODAP data or a drawing edit between runs starts a new group with the same header the old one had. The plugin saves no groups, so R8 and R9 don't apply. Its headers are unchanged (R2).
- **R12. No new log event.** Starting a group logs nothing new; `SequencePlayed` and `SequenceStepped` are unchanged.

### Tests

- **R13. Tests.** Jest on `chainKey` (order, positions and a state editor's no-change Save don't change it; a label, a count, a transition's value or an added transition do), on `useMarkovTool` (a changed input or drawing starts a group, a drag or the same values don't, a changed start alone does, a running sequence keeps its group, a restored group continues only with a matching key), on `statesKey`'s pinned values, on saved outputs (the key survives encode and decode; a malformed one is dropped, not the group) and on `SequenceOutput` (both headers, collapsed and expanded, and none without a setting). Cypress: a text edit between Plays, and Case sensitive on text with a capital, each start a group, while Case sensitive on text with none doesn't; a reopened state continues its group, or not after a saved text change; the ordered header.

## Technical Notes

- **The key:** `chainKey` in `src/utils/chain-graph.ts` hashes each state's `[id, label, value]` and each transition's `[from, to, value]` as sorted JSON entries, with values rounded to 9 decimal places, using `shortHash` (`src/utils/short-hash.ts`), the hash `statesKey` also uses for saved positions.
- **The group check:** `generateNewSequence` in `src/hooks/use-markov-tool.tsx` compares `chainKey(graph)` with the last group's `chain`. A running sequence's group comes from `currentAnimatedSequenceGroup`, so it never re-checks (R6). A group with no `chain` never matches (R9).
- **Saved groups:** `SequenceGroup.chain` is saved by `encodeOutputs` and read by `decodeOutputs` (`src/interactive/saved-outputs.ts`), which drops a key that isn't a string and keeps the group. `readInteractiveState` keeps fields it doesn't know, so the field needed no version bump.
- **The header:** `SequenceOutputHeader` in `src/components/sequence-output.tsx`. `yesNo` and `orderMattersLabel` live in `src/components/setting-labels.ts`, shared by the header, the interactive's switch and summary, and the Outputs table's column.
- **Where `orderMatters` comes from:** the AP interactive's Data mode host passes the switch; its Draw mode host and the CODAP plugin pass nothing (`MarkovHost.orderMatters`).
- **Drift in the state editor:** its Save rebuilds arrow values through percentages (`applyStatePercentages`), which can move a value in the last bit or leave about 4e-16 where 0 was; the 9-decimal rounding absorbs both.
- **Unchanged readers of groups:** the teacher summary (`report-summary.ts`) and the Outputs table (`tables/table-data.ts`) count or number outputs across groups, so extra groups change neither. The saved key means nothing read on its own in a researcher's export.

## Out of Scope

- Showing in a header what chain it came from. A new group after a text change can have the same header as the one above it; the divider is the change.
- Regrouping outputs already generated or already saved.
- Changing what a header says about the start, Max Length or delimiter.
- The teacher summary's lines.

## Decisions

### Does "changed" mean the graph object or the chain it holds?
**Decision**: The chain's content. The same values sent again build a new graph object, and a drawing drag replaces the graph to move one state, so comparing objects would split groups whose outputs came from the same chain.

### What does a collapsed ordered header say?
**Decision**: "Ordered" (Doug), paired with the "Orderless" students already see; expanded, "Order matters: Yes", matching the interactive's read-only label.

### Do Draw mode's and the CODAP plugin's headers state order?
**Decision**: No (Doug). Neither has an order setting, and the ELA module's headers stay as they are. The Outputs table still says Yes for Draw mode outputs.

### Save the key, or treat every reopened group as changed?
**Decision**: Save it. A divider on every reopen would look like the bug in reverse, and readers of the saved state ignore unknown fields.

### Work saved before the key existed: continue its last group or start a new one?
**Decision**: Start a new one. An uncomparable group might hold another chain's outputs; the cost is one extra divider, once, on work from the unreleased 0.6.0 test builds.

### A new hash, or the existing one?
**Decision**: Move `statesKey`'s hash to `shortHash` and use it for both, with its values pinned in a test so saved `positionsKey`s keep matching.

### Where does the header's "Order matters" text come from?
**Decision**: A shared `src/components/setting-labels.ts`, rather than the shared header importing the interactive's authored state or keeping a second copy.

### How are values rounded in the key?
**Decision**: To 9 decimal places (Doug). A state editor's no-change Save drifts values; rounding to 12 significant digits missed drift near 0 (297 of 12645 whole-number cases), while 9 decimal places missed none of those or of 200000 random slider cases.
