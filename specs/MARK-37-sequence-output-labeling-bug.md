# Sequence Output Labeling Bug

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37

**Status**: **Closed**

**Followed by**: [MARK-37-output-group-order-and-graph](MARK-37-output-group-order-and-graph/), which states order in every Data mode header and starts a new group when the chain changes.

## Overview

When the starting state a student chose leaves the graph, the generator puts its starting state back to "(any)", so the Starting State list, the generator and the output headings agree, and the next sequence starts a new "(any)" group.

Rebecca reported that after running sequences from "the" and then choosing "(any)", the next output appeared under the "the" heading with no new separator. Choosing "(any)" directly always worked. The bug needed the start to leave the graph first: in her case, switching Case sensitive with both "The" and "the" in the text. The Starting State select then fell back to showing "(any)" while `useMarkovTool` kept the old id, so choosing "(any)" fired no change event, and later sequences started anywhere but joined the old state's group. This was bug 12 from the MARK-7 review, which MARK-20 deferred.

## Requirements

- **R1. A gone start becomes "(any)".** When the graph no longer contains the chosen starting state, the generator's starting state becomes "(any)" (`""`), so the select's value, the generator and the saved work all agree with what the select shows. This holds however the state left: input edits, the Case sensitive switch, deleting the state in a drawing, Create From Text, new dataset values in the CODAP plugin, and Back To Main Menu.
- **R2. The next sequence starts a new "(any)" group.** After R1, the next Play or Step generates from any state, and, when the last group had a starting state, starts a new group with an "(any)" heading.
- **R3. Past outputs are unchanged.** Groups already in the output, their sequences and their headings stay as they were, including the gone state's label in their heading (Rebecca, on bug 12).
- **R4. The start does not come back.** If a state with the gone start's id returns to the graph later (the word is typed again, Case sensitive is turned back off), the starting state stays "(any)" until the student chooses again.
- **R5. A renamed start is kept.** Renaming the starting state in a drawing keeps its id, so it stays the starting state.
- **R6. A running sequence is not affected.** If the start leaves the graph while a sequence plays, steps or is paused, that sequence finishes in its own group; R2 applies to the next one. The select is disabled while a sequence runs, and the interactive's Data mode input is read-only then, so there this arises only between sequences.
- **R7. No new log event.** Clearing a gone start logs nothing, as clearing a gone selection logs nothing (`useClearGoneSelection`). `GeneratorSettingChanged` stays the record of a student's own choice, and the next `SequencePlayed` or `SequenceStepped` reports `startingState: ""`.
- **R8. Both hosts.** The fix lives in the shared tool, so the CODAP plugin and both modes of the Activity Player interactive get it.
- **R9. Tests.** Jest tests on `useMarkovTool`. Seven fail without the fix: a start taken out by new input values, a deleted drawing state, Back To Main Menu, a sequence stepped while its start leaves (R6), the start staying `""` when the word returns, the R7 test (which asserts the clear before the absent log, and also catches a fix that logs it), and a start missing from its starting graph (R11). One guard test catches an over-eager fix: a renamed drawing start keeps its id (R5).
- **R10. Visible change.** Yes, only in the situation above, in every host including the ELA module's drawing documents (deleting the starting state starts an "(any)" group on the next Play). Rebecca reported the bug and set the past-outputs rule.
- **R11. A tool started with a start its graph lacks starts at "(any)".** A `MarkovToolStart` whose `generator.startingState` isn't in `start.graph` (or that has no graph) doesn't keep it. The interactive already filters it in `restoredMode`, so no host changes.
- **R12. Prose the fix invalidates.** The closed MARK-19 spec's notes that described a kept gone start, and a heading it left wrong, as current behavior say instead that this holds only for work saved before MARK-37.

## Technical Notes

- The fix is a `useLayoutEffect` on `[graph, startingState]` in `src/hooks/use-markov-tool.tsx` that calls `setStartingState("")` when the graph lacks the start. It reads the graph state, so every source of graph change (`onDataChanged`, `onSetGraph`, the drawing's `setGraph` calls, Reset, Back To Main Menu, a `MarkovToolStart`) is covered, and it runs before any click can reach Play.
- New output groups start in `generateNewSequence` when the starting state id, Max Length, delimiter or order differs from the last group's. A heading reads `group.startingNode?.label ?? "(any)"` (`src/components/sequence-output.tsx`).
- The Starting State select (`src/components/generator.tsx`) is controlled by the id; option `""` is "(any)". A browser shows the first option for a value no option has.
- Saved work: `build-state.ts` saves `generatorProps.startingState`. A save made in the same commit as the change that removed the state can still carry the gone id; `restoredMode` reopens a gone id as "(any)", and the dashboard summary reads it the same way, so that is harmless.
- A running sequence's group, sequences and logged start come from `currentAnimatedSequenceGroup`, `prevSequences` and `startingLabelRef`, not `startingState`.

## Out of Scope

- Bug 12b: a renamed starting state's heading keeping its old label in past groups (dropped by Rebecca).
- Rewriting or regrouping outputs already generated.
- MARK-22 (the CODAP plugin following a dropped column after Back To Main Menu).
- Any other change to when a new output group starts (taken up by the follow-up spec above).

## Decisions

### Clear a gone start, or read it as "(any)" only while it is missing?
**Decision**: Clear it. A start that silently comes back when a word is retyped would surprise a student as the bug did, and clearing matches how a gone selection is cleared and how reopening saved work drops a gone start.

### Does Back To Main Menu clear the start?
**Decision**: Yes, like any gone start. The dialog says any changes will be lost, and keeping a start from another document is the bug's own behavior.

### Log the automatic clear?
**Decision**: No. `GeneratorSettingChanged` means a student's change (`LOGGED-EVENTS.md`), a gone selection's clear logs nothing, and every Play and Step already logs the start it used.

### Did Rebecca's run involve the start leaving the graph?
**Decision**: Yes. A direct switch to "(any)" splits the groups at both speeds, with Step and by keyboard; only a start that has left the graph reproduces the report. Asked, Rebecca recalled switching Case sensitive with "The" and "the" in the text, which is that path.

### Should a start that the Case sensitive switch merges follow its state?
**Decision**: No, it clears to "(any)" like every other gone start, rather than turning Case sensitive off moving "The" to "the". A state chosen in Inspect that the switch removes is cleared, not moved, and mapping would put Data-mode knowledge in the shared hook for one direction of one switch.

### One effect in the hook, a clear at each place the graph changes, or a start derived during render?
**Decision**: One layout effect. A clear per path misses any future path that changes the graph, and a derived start comes back when its state returns, which R4 rules out. The effect matches `useClearGoneSelection`.

### One commit, or a failing test first?
**Decision**: One commit with the fix and its tests, rather than a red commit between them; the tests that fail without the fix were checked by removing it.

### Add a test for a sequence running when its start leaves?
**Decision**: Yes (Doug, stage 8). R6 had only reasoning behind it; the test steps a sequence, removes its start, finishes it in its own group, and checks the next Play starts the "(any)" group.

### Guard against an effect that skips an empty graph?
**Decision**: Yes. A plausible `graph.nodes.length > 0` guard passed every first-draft test while leaving Back To Main Menu and a start given with no graph unfixed, so both have tests that fail on it.

### Keep the existing test for logging no start after the input takes it out?
**Decision**: Delete it. With the clear, the start is already `""` at its Play, so it can no longer fail; the new tests guard the clear.

### Correct the closed MARK-19 spec?
**Decision**: Yes, in the same commit. Three of its notes described the kept start and its wrong heading as current behavior; they now hold only for work saved before MARK-37, which the dashboard's filter still has to handle.
