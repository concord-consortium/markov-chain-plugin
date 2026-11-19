# Implementation Plan: Output Groups: Order in the Header and a New Group When the Chain Changes

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-37
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

### Start a new output group when the chain changes

**Summary**: Each group records a short key of the chain it was generated from; Play and Step start a new group when the current chain's key differs, and the AP interactive saves the key with each group (R3 to R12).

**Files affected**:
- `src/utils/short-hash.ts` (new): the hash `statesKey` uses today, moved so the shared tool can use it too.
- `src/interactive/interactive-state.ts`: `statesKey` calls `shortHash`; saved `positionsKey` values are unchanged because the hash is the same.
- `src/utils/chain-graph.ts`: `chainKey`.
- `src/type.ts`: `SequenceGroup.chain`.
- `src/hooks/use-markov-tool.tsx`: the group check in `generateNewSequence`.
- `src/interactive/saved-outputs.ts`: save and read `chain`.
- Tests: `src/utils/chain-graph.test.ts`, `src/hooks/use-markov-tool.test.tsx`, `src/interactive/saved-outputs.test.ts`, `src/interactive/interactive-state.test.ts`, `cypress/e2e/interactive-workspace.test.ts`, `cypress/e2e/interactive-saved-work.test.ts`.

**Estimated diff size**: ~220 lines, two thirds of them tests.

`src/utils/short-hash.ts`:

```ts
// a short hash of a text, which tells it from another text without storing either
export const shortHash = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 1000003 + text.charCodeAt(i)) % 4294967291;
  }
  return hash.toString(36);
};
```

`interactive-state.ts` keeps its comment and becomes `export const statesKey = (ids: string[]) => shortHash(JSON.stringify(ids));`. The products stay below 2^53, so the moved hash gives the same values.

`src/utils/chain-graph.ts`:

```ts
// a state editor's Save rebuilds arrow values through percentages, which can move them in the last bit or leave a
// tiny value where 0 was
const keyValue = (value: number) => +value.toFixed(9);

// The chain a graph holds, as a short key: its states and transitions in any order, without the states' positions,
// which a drawing changes when it is rearranged
export const chainKey = ({ nodes, edges }: GraphData) => shortHash(JSON.stringify([
  nodes.map(({ id, label, value }) => JSON.stringify([id, label, keyValue(value)])).sort(),
  edges.map(({ from, to, value }) => JSON.stringify([from, to, keyValue(value)])).sort(),
]));
```

Each entry is sorted as its own JSON text, so a comma inside a label can't make two different entries sort as equal.

`src/type.ts`, in `SequenceGroup`:

```ts
  // chainKey of the graph the group was generated from; absent from work saved before groups kept it
  chain?: string;
```

`generateNewSequence` computes `const chain = chainKey(graph);` beside `startingNode`, adds `|| (currentAnimatedSequenceGroup.current.chain !== chain)` to the group check, and puts `chain` in the new group. A restored group with no `chain` never equals a string, so it starts a new group (R9) with no special case. `graph` is already in the callback's dependencies.

`src/interactive/saved-outputs.ts`: `SavedOutputs.groups` gains `chain?: string`; `encodeOutputs` writes `chain: group.chain`; `decodeOutputs` reads `chain: typeof saved.chain === "string" ? saved.chain : undefined`, so a malformed key drops the key, not the group. `isSavedGroup` is unchanged. A key costs 16 to 22 bytes per group as the Activity Player stores it (R10).

Tests that fail without the change:

- `chain-graph.test.ts`, `chainKey`: equal for the same values built twice, for nodes and edges in another order, for a state moved (`x`, `y`), and for transition values put through `applyStatePercentages` with the percentages `NodeModal` opens with (three arrows of 1, arrows of 1 and 2, and three arrows of 1 with the last moved to 0 and saved twice); different for a changed label, a state's count, a transition's value, and an added transition.
- `use-markov-tool.test.tsx`, new `describe("useMarkovTool's output groups")`, playing to the end with fake timers as the bag-of-words tests do:
  - new values between two Plays give two groups, each with its own sequences (fails today: one group);
  - the same values sent again give one group (catches comparing graph objects);
  - a drawing (`renderHook` with `start.graph` and `view.setGraph`): a state moved gives one group; a state added, a state renamed and a transition's value changed each give two (`it.each`);
  - the same values with only the starting state changed give two groups (the starting-state tests in `useMarkovTool's starting state` also change the graph, so they no longer guard that comparison);
  - a sequence stepped once, then new values, then stepped to its end, stays in its group, and the next Play starts a second group (R6);
  - started with `sequenceGroups` whose last group's `chain` is `chainKey(start.graph)`, a Play continues it; with no `chain`, or another key, it starts a second group (R8, R9).
- `interactive-state.test.ts`: `statesKey(["a", "b"])` is `"49ye2p"` and `statesKey(["the", "cat", "sat", "on", "a", "mat"])` is `"1xd1l84"`, the values the hash gives today. The existing `statesKey` tests only compare keys with each other, so without these a changed hash would pass while orphaning every saved `positionsKey`.
- `saved-outputs.test.ts`: `chain` survives `encodeOutputs`, JSON and `decodeOutputs`; a group whose `chain` is a number still decodes, with no `chain`.

Cypress (`interactive-workspace.test.ts`, beside the "Orderless" tests):

- typing a word after a Play and playing again gives two headers;
- "The cat saw the dog" with Case sensitive on, Play, Case sensitive off, Play gives two headers; "the cat saw the dog" the same way gives one.

Cypress (`interactive-saved-work.test.ts`): a saved Data mode state with one group whose `chain` matches its text reopens and, after a Play, still shows one header; the same state with different saved text shows two.

---

### Say "Order matters" in a Data mode group's header both ways

**Summary**: A group that records an order setting shows it whichever way it was set (R1, R2). "Ordered" collapsed, and Draw mode and the CODAP plugin unchanged (Doug, stage 8).

**Files affected**:
- `src/components/setting-labels.ts` (new): `yesNo` and `orderMattersLabel`, moved from `src/interactive/authored-state.ts` so the shared header uses the same text.
- `src/interactive/authored-state.ts`, `report-summary.ts`, `workspace/setting-switch.tsx`, `workspace/data-workspace.tsx`, `tables/table-data.ts`: import them from there; the Outputs table's "Order matters" column title in `table-data.ts` becomes `orderMattersLabel`.
- `src/components/sequence-output.tsx`: the header.
- Tests: `src/components/sequence-output.test.tsx`, `cypress/e2e/interactive-workspace.test.ts`.

**Estimated diff size**: ~60 lines.

`SequenceOutputHeader`:

```tsx
  // only Data mode records an order setting; a drawing and the CODAP plugin are always ordered
  const ordered = group.orderMatters;
  ...
        { ordered !== undefined && <div>{ `${orderMattersLabel}: ${yesNo(ordered)}` }</div> }
  ...
      { ordered !== undefined && <><span>/</span><span>{ ordered ? "Ordered" : "Orderless" }</span></> }
```

Tests:

- `sequence-output.test.tsx`: the existing "marks a group generated without order" test becomes three groups (`false`, `true`, undefined): "Orderless" and "Ordered" once each collapsed, then expanded "Order matters: No" and "Order matters: Yes", and the undefined group showing neither.
- `interactive-workspace.test.ts`: "generates by count once turned off" checks the first header contains "Ordered" in place of not containing "Orderless".

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: A new hash or the existing one?
**Context**: `statesKey` already hashes state ids for saved positions.
**Options considered**:
- A) Move its hash to `src/utils/short-hash.ts` and use it for both.
- B) A second hash beside `chainKey`.

**Decision**: A. One hash, and moving it keeps every saved `positionsKey`.

### RESOLVED: Judgment call: Where does the header's "Order matters" text come from?
**Context**: The header hardcodes "Order matters: No" today, a second copy of `orderMattersLabel`, which lives in the interactive's authored state.
**Options considered**:
- A) Move `orderMattersLabel` and `yesNo` to `src/components/setting-labels.ts`.
- B) Import them into the shared header from `src/interactive/authored-state.ts`.

**Decision**: A. No shared component imports the interactive today, and the move is five import lines.

### RESOLVED: Judgment call: Save the chain, or treat every reopened group as changed?
**Context**: R8. Not saving needs no format change but adds a divider after every reopen.
**Options considered**:
- A) Save a short key with each group.
- B) Save nothing; a reopened tool starts a new group on its first Play.

**Decision**: A. A divider on every reopen would look like the bug in reverse, and readers of the saved state ignore unknown fields.

## Self-Review

Roles: Senior Engineer, Commit Reviewer, Test Writer, Operator. Each finding was checked against the code, or against the change made as throwaway code, before it was written down.

#### RESOLVED: Nothing pins `statesKey`'s values
`interactive-state.test.ts` compares keys with each other only, so moving the hash could change saved `positionsKey`s unnoticed. The step adds two pinned values, computed with today's hash.

#### RESOLVED: Existing tests and the group check
The group check was made for real as throwaway code: all 803 Jest tests still pass, so no existing Jest test relies on outputs from two chains sharing a group.

### Round 1

#### RESOLVED: The starting-state comparison loses its only test
The three Jest tests that split a group on the starting state (`use-markov-tool.test.tsx`, `useMarkovTool's starting state`) all change the graph between Plays, so with the chain check they pass with the starting-state comparison deleted, and no Cypress test counts headers after a start change. The group tests gain a same-values, new-start case.

#### RESOLVED: The Outputs table spells "Order matters" a second time
`outputsTable` in `tables/table-data.ts` hardcodes the column title beside `yesNo`, which this step already re-imports there. It now uses `orderMattersLabel`.

### Round 2

#### RESOLVED: A state's dialog saved with no change starts a new group
`NodeModal`'s Save rebuilds each arrow's value as `sum * (value / sum * 100) / 100` (`applyStatePercentages`), which drifts in the last bit: a state with three arrows of 1 saves them as 0.9999999999999999, and arrows of 1 and 2 as 0.9999999999999999 and 1.9999999999999998, so `chainKey` changes and the next Play adds a divider over an identical header (checked with a throwaway Jest test; two arrows of 1 save exactly). A second Save doesn't drift further. `chainKey` rounds each value to 9 decimal places (see Round 3), which maps every drifted value back for counts up to 20 (Doug); R4 and the `chainKey` tests cover it.

### Round 3

#### RESOLVED: The key's saved cost was overstated
`savedBytes` measures a one-character key at 16 bytes and a seven-character one at 22, not about 25; the step now says 16 to 22.

#### RESOLVED: Rounding to 12 significant digits misses drift around an arrow of 0
Three arrows of 1, the last thumb dragged so the last arrow gets 0, Save, then a no-change Save: the last arrow comes back as 4.263256414560601e-16, which `toPrecision(12)` keeps, so the next Play adds a divider over an identical header (throwaway Jest on `movePairedPercentage` and `applyStatePercentages`). Integer arrows summing to 20 or less, up to four of them, fail 297 of 12645 cases, all with a last arrow of 0, and random slider values fail 31 of 200000 no-change Saves. `keyValue` now rounds to 9 decimal places (`toFixed(9)`), which failed none of either set (Doug), and the `chainKey` tests add the zero-arrow case.
