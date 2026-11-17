# Sequence Output Labeling Bug

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

When the starting state a student chose disappears from the graph, the Starting State list shows "(any)" but the generator still remembers the old state. The next outputs then land under the old state's header, with no new separator. The fix puts the starting state back to "(any)" as soon as its state leaves the graph, so the list, the generator and the output headers always agree.

## Project Owner Overview

Rebecca found that after running sequences from "the" and then choosing "(any)", the next output appeared under the "the" header instead of under a new "(any)" separator. The output list is how a student reads which settings produced which sequences, so a header that names the wrong starting state misleads the student, the teacher reading the work, and anyone studying it.

The change is small and visible only in this situation: once the chosen starting state is no longer in the graph, the generator treats it as "(any)", and the next sequence starts a new "(any)" group. Outputs already generated keep their headers, as Rebecca asked when this bug was first found during the plugin review.

## Background

The output list starts a new group, with its dark gray header bar, whenever a sequence is generated with settings that differ from the last group's: starting state, Max Length, delimiter, or whether order matters (`generateNewSequence` in `src/hooks/use-markov-tool.tsx`). The comparison uses the starting state's id as the hook holds it.

The Starting State select is a controlled `<select>` whose value is that id (`src/components/generator.tsx`). When the id no longer matches any option, the browser shows the first option, "(any)", while the hook keeps the old id. Nothing clears it. Generation looks the id up in the graph, finds nothing, and starts anywhere; the group comparison sees the same id and appends to the old group, whose header still names the old state. Choosing "(any)" in the select at that point changes nothing, because it is already the selected option and the browser fires no change event.

This is bug 12 from the MARK-7 review ("A deleted starting state stays selected though the select box shows '(any)'"), which MARK-20 deferred. Rebecca's ruling then still applies: a fix affects future Plays only, and past outputs and their headers stay as they were.

Verified on master (after MARK-28):

- **Direct switch works.** In the Activity Player interactive (`interactive.html`), starting at "the", playing four times, choosing "(any)" and playing again gives two groups, `the` (4) and `(any)` (1). Step gives the same. The hook test in Jest gives the same.
- **A start that leaves the graph reproduces the report.** With the text `The cat saw a dog. The dog saw a cat.`, Case sensitive off, start "the", two Plays; then Case sensitive on (the state becomes "The"): the select shows "(any)", and three more Plays append to the `the` group, starting at "saw", "cat" and "saw". Throwaway hook tests show the same when the input's words change (`dataChanged`) and when a drawing's starting state is deleted, and that the old id comes back to life in the select if the word returns.
- **Rebecca's run matches.** Asked, she recalled switching Case sensitive on and off a few times with both "The" and "the" in the text. That path reproduces: with Case sensitive on, start "The", two Plays, then Case sensitive off (the state merges into "the"); the select shows "(any)", and the next Play lands in the `The` group, starting at "dog".

Ways a starting state can leave the graph today: editing the Data mode text or table, the Case sensitive switch, deleting a state in a drawing (Draw mode and the CODAP plugin's drawing mode), typing in the CODAP plugin drawing's Create From Text box (which rebuilds the graph from its text on every keystroke), new values for the dropped attribute in the CODAP plugin's dataset mode, and Back To Main Menu (which empties the graph). Reset already sets the starting state back to "(any)". Reopening saved work in the interactive already drops a start that isn't in the restored graph (`restoredMode` in `src/interactive/workspace/restore-work.ts`), and the dashboard summary already reads a gone start as "(any)" (`src/interactive/report-summary.ts`).

## Requirements

- **R1. A gone start becomes "(any)".** When the graph no longer contains the chosen starting state, the generator's starting state becomes "(any)" (`""`), so the select's value, the generator and the saved work all agree with what the select shows. This holds however the state left: input edits, the Case sensitive switch, deleting the state in a drawing, Create From Text, new dataset values in the CODAP plugin, and Back To Main Menu.
- **R2. The next sequence starts a new "(any)" group.** After R1, the next Play or Step generates from any state, and, when the last group had a starting state, starts a new group with an "(any)" header. With the report's steps (start at "the", play, take "the" out of the graph, play), the output shows a `the` group and then an `(any)` group.
- **R3. Past outputs are unchanged.** Groups already in the output, their sequences and their headers stay as they were, including the gone state's label in their header (Rebecca, on bug 12).
- **R4. The start does not come back.** If a state with the gone start's id returns to the graph later (the word is typed again, Case sensitive is turned back off), the starting state stays "(any)" until the student chooses again.
- **R5. A renamed start is kept.** Renaming the starting state in a drawing keeps its id, so it stays the starting state, as today.
- **R6. A running sequence is not affected.** If the start leaves the graph while a sequence plays, steps or is paused, that sequence finishes in its own group; R2 applies to the next one. The select is disabled while a sequence runs, as today. The interactive's Data mode input is read-only while a sequence runs (`inputReadOnly` in `data-workspace.tsx`), so there this arises only between sequences.
- **R7. No new log event.** Clearing a gone start logs nothing, as clearing a gone selection logs nothing (`useClearGoneSelection`). `GeneratorSettingChanged` stays the record of a student's own choice, and the next `SequencePlayed` or `SequenceStepped` already reports `startingState: ""`.
- **R8. Both hosts.** The fix lives in the shared tool, so the CODAP plugin and both modes of the Activity Player interactive get it.
- **R9. Tests.** Jest tests on `useMarkovTool`. Each of these fails without the fix: a start taken out by new input values leaves `startingState` at `""`, and the next Play starts a second group, after the old one, whose `startingNode` is undefined; a deleted drawing state does the same; Back To Main Menu leaves `startingState` at `""`; a sequence stepped while its start leaves the graph finishes in its own group with its start, and the next Play starts the "(any)" group (R6); the start stays `""` when the word returns; the test for R7 asserts `startingState` became `""` before asserting no `GeneratorSettingChanged` was logged, so it cannot pass with nothing cleared, and it also catches a fix that logs the clear. One guard test catches an over-eager fix rather than a missing one, so it first asserts the case it guards is real: a renamed drawing start keeps its id after the rename (R5).
- **R10. Visible change.** Yes, only in the situation above, in every host including the ELA module's drawing documents (deleting the starting state now starts an "(any)" group on the next Play). Rebecca reported the bug and set the past-outputs rule, so this is the change she asked for.
- **R11. A tool started with a start its graph lacks starts at "(any)".** `MarkovToolStart` is held to R1 too: a `generator.startingState` that `start.graph` doesn't contain (or given with no graph) is not kept, and a Jest test covers both cases. The interactive already filters it in `restoredMode`, so no host changes; the existing test "starts from generator settings, and takes the default of any left out" gives its start a graph that contains `a`, since it otherwise starts with an empty graph and a start that isn't in it.
- **R12. Prose the fix invalidates.** The closed MARK-19 spec's notes that describe a kept gone start, and a heading it leaves wrong, as current behavior say instead that this holds only for work saved before this fix.

## Technical Notes

- `src/hooks/use-markov-tool.tsx`: `startingState` state, `handleChangeStartingState`, `generateNewSequence` (group comparison, `startingNode` lookup), `startingLabel` (already logs `""` for a gone start), Reset (`setStartingState(defaultStartingState)`), Back To Main Menu (empties the graph, leaves the start).
- `src/components/generator.tsx`: the controlled select; option `""` is "(any)".
- `src/components/sequence-output.tsx`: a header reads `group.startingNode?.label ?? "(any)"`.
- `src/interactive/workspace/use-mode-body.ts`: `useClearGoneSelection` is the existing pattern for clearing a choice whose state left the graph.
- `src/interactive/workspace/build-state.ts` saves `generatorProps.startingState`; `restore-work.ts` drops a gone start on reopen; `report-summary.ts` already treats it as "(any)". After R1 the next save carries `""`. A save made in the same commit as the change that removed the state can still carry the gone id; that is harmless, since `restoredMode` reopens a gone id as "(any)".
- Existing test "logs no starting state for a play whose starting state the input has taken out" (`src/hooks/use-markov-tool.test.tsx`) can no longer fail after the fix, since the start is `""` before its Play, so the implementation step deletes it.

## Out of Scope

- Bug 12b: a renamed starting state's header keeping its old label in past groups (dropped by Rebecca).
- Rewriting or regrouping outputs already generated.
- MARK-22 (the CODAP plugin following a dropped column after Back To Main Menu).
- Any other change to when a new output group starts.

## Open Questions

### RESOLVED: Judgment call: clear the gone start, or derive it as "(any)" while it is gone?
**Context**: The start could be cleared to `""` when its state leaves, or kept and read as "(any)" only while it is missing, so it reappears if the state returns.
**Options considered**:
- A) Clear it when its state leaves the graph.
- B) Keep the id and treat it as "(any)" while missing.

**Decision**: A. The select already shows "(any)", and a start that silently comes back when a word is retyped would surprise a student just as the current bug does. Clearing also matches how a gone selection is cleared and how reopening saved work drops a gone start. (R1, R4)

### RESOLVED: Judgment call: does Back To Main Menu clear the start?
**Context**: Back To Main Menu empties the graph, so under R1 it clears the start; today the old id survives and comes back if the next document has a state with that id. The MARK-20 notes held bug 12 partly for this.
**Options considered**:
- A) Yes, as any other gone start.
- B) Special-case it to keep the start.

**Decision**: A. The dialog says any changes will be lost, and the next document is a fresh start; keeping a start from another document is the bug's own behavior.

### RESOLVED: Judgment call: log the automatic clear?
**Context**: Researchers read `GeneratorSettingChanged` for the starting state.
**Options considered**:
- A) Log nothing.
- B) Log `GeneratorSettingChanged` with value `""`.

**Decision**: A. The event's documented meaning is a student's change (`LOGGED-EVENTS.md`), the gone selection's clear logs nothing, and every Play and Step already logs the start it used. (R7)

### RESOLVED: Low confidence: did Rebecca's run involve the start leaving the graph?
**Context**: Her steps say she set the start to "(any)" directly; on master that path splits the groups correctly. The only reproduction found needs the start to have left the graph first, which then makes choosing "(any)" a no-op. If another path exists (normal speed, Draw mode, the CODAP plugin, the build she tested), R1 may not cover it.
**Options considered**:
- A) Check the remaining paths before planning; if one reproduces without a gone start, add it to the requirements.
- B) Ask Rebecca for the exact steps and build.

**Decision**: A, checked. In the interactive on master, with a start that stays in the graph, the direct switch to "(any)" splits the groups at normal speed with the choice made by keyboard, at fast speed, and with Step; the shared hook does the same in Jest, and the CODAP plugin and Draw mode run that same hook. No path reproduces the report without the start leaving the graph, so R1 covers it. The group logic has been unchanged since 2023, so the build she tested makes no difference. Rebecca's recollection (Case sensitive switched with "The" and "the" in the text) is that path, reproduced above.

## Self-Review

Roles: Senior Engineer, QA Engineer, Student, Teacher, Education Researcher, WCAG Accessibility Expert. Claims checked against the code and in the interactive on master: the hook stays mounted through Back To Main Menu (`useMarkovTool` runs before `MarkovTool`'s early returns), so a start can outlive it today; choosing "(any)" by keyboard while the start is stale fires no change event and the next Play appends to the old group; reopening saved work starts the tool with the restored graph, so no momentarily empty graph clears a restored start.

### QA Engineer

#### RESOLVED: Two of R9's tests pass without the fix
The rename test and the no-log test both pass on master, so "each failing without the fix" was wrong, and a no-log test that never checks a clear happened passes even when nothing is cleared. R9 now names them as guard tests and makes the R7 test assert the clear before asserting the absent log.

### Student

#### RESOLVED: Should a start that the Case sensitive switch merges follow its state?
Turning Case sensitive off merges "The" into "the", which is how Rebecca hit this bug. Under R1 the start becomes "(any)"; a student who chose "The" might expect it to become "the". This is the only path where the gone state has an obvious successor (turning the switch on never removes a lowercase word that is still typed that way).
- A) Clear to "(any)" like every other gone start (R1 as written).
- B) Turning Case sensitive off moves a start to its lowercase state; every other gone start clears.

**Decision**: A. The switch only recommits the text under the new rule (`handleCaseChange` in `data-workspace.tsx`), and a state chosen in Inspect that the switch removes is cleared by `useClearGoneSelection`, not moved to its lowercase twin; the start should behave the same. Mapping would also need Data-mode knowledge in the shared hook, for one direction of one switch. A student sees "(any)" in the list and can choose "the" again.

### Senior Engineer (second pass)

#### RESOLVED: The list of ways a start leaves the graph missed Create From Text
The CODAP plugin's drawing mode has a Create From Text box (`AddText`), and `handleTextChange` in `drawing.tsx` replaces the whole graph with `wordsToGraph` on every keystroke whose words differ. A throwaway test through `MarkovTool` with the planned effect confirmed it: with start "sat" from "the cat sat", one backspace and the "t" typed again leave the select at "(any)" with "sat" back in the graph. R1's wording already covers it ("however the state left"), so the fix is the same; the Background list and R1's examples now name it. Losing the start when its own word is edited there, even for a keystroke, is R4 as decided, not a new case. (The interactive's Draw mode toolbar leaves this tool out, so it is CODAP-only.)

### QA Engineer (second pass)

#### RESOLVED: An over-careful fix that skips an empty graph passed every planned test
A throwaway mutant of the planned effect with `graph.nodes.length > 0 &&` added to its condition, a plausible guard against clearing during a momentarily empty graph, passed all 48 tests in the file. It would leave Back To Main Menu (R1, and its judgment call) and a start given with no graph (R11) unfixed. R9 now names a Back To Main Menu test, and R11's test covers the no-graph start; both fail on that mutant and on master, and pass with the planned effect.

### Spec Coherence Reviewer (fourth pass)

#### RESOLVED: R9 counted the R7 test as a guard, so its count disagreed with the implementation's
R9 listed five tests that fail without the fix and called the R7 test one of two guard tests that "catch an over-eager fix rather than a missing one". The R7 test asserts the clear before the absent log, so it fails without the fix: with the step's tests applied and the hook left as on master, seven tests fail, the R7 test among them, which is what the implementation's table and Summary say. R9 now lists the R7 test with the failing ones and names the rename test as the one guard.

### Spec Length Reviewer (fourth pass)

#### RESOLVED: Technical Notes carried a record of the prototype run
The "Verified by a throwaway prototype" note recorded how the plan was checked, not anything the next engineer acts on: R11 already names the start test that changes, and the implementation's Summary states the counts the step must reach. It is deleted. The Background's reproduction steps stay, since they are how to see the bug.

### Markdown Reader (fifth pass)

#### RESOLVED: A blank line split R12 from the rest of the Requirements list
A blank line sat between R11 and R12, which makes the whole list loose in CommonMark, so every requirement rendered as a spaced paragraph unlike the other lists in the file. The blank line is deleted.
