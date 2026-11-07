import { graphNotes, outgoingOnlyNote, roundingNote } from "./graph-notes";

const quiet = { labelsShown: false, orderMatters: true, stateChosen: false, animating: false };

describe("graphNotes", () => {
  it("shows no note while none applies", () => {
    expect(graphNotes(quiet)).toEqual([]);
  });

  it("notes the rounding while labels show", () => {
    expect(graphNotes({ ...quiet, labelsShown: true })).toEqual([roundingNote]);
  });

  it("notes the arrows drawn with order off and a state chosen", () => {
    expect(graphNotes({ ...quiet, orderMatters: false, stateChosen: true })).toEqual([outgoingOnlyNote]);
  });

  it("shows both, the rounding first", () => {
    expect(graphNotes({ labelsShown: true, orderMatters: false, stateChosen: true, animating: false }))
      .toEqual([roundingNote, outgoingOnlyNote]);
  });

  it("needs both order off and a state chosen for the arrows' note", () => {
    expect(graphNotes({ ...quiet, orderMatters: false })).toEqual([]);
    expect(graphNotes({ ...quiet, stateChosen: true })).toEqual([]);
  });

  it("drops the arrows' note while a sequence generates, and keeps the rounding's", () => {
    expect(graphNotes({ labelsShown: true, orderMatters: false, stateChosen: true, animating: true }))
      .toEqual([roundingNote]);
  });
});
