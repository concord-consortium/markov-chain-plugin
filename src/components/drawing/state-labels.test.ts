import { labelProblem, nextStateLabel } from "./state-labels";

describe("nextStateLabel", () => {
  it("counts from one past the number of states", () => {
    expect(nextStateLabel([])).toBe("State 1");
    expect(nextStateLabel(["State 1"])).toBe("State 2");
  });

  it("skips a name in use", () => {
    expect(nextStateLabel(["State 1", "State 3"])).toBe("State 4");
  });
});

describe("labelProblem", () => {
  const nodes = [{ id: "a", label: "State 1", value: 1 }, { id: "b", label: "State 2", value: 1 }];

  it("refuses an empty name", () => {
    expect(labelProblem("  ", "a", nodes)).toBe("Give the state a name.");
  });

  it("refuses another state's name, once trimmed", () => {
    expect(labelProblem(" State 2 ", "a", nodes)).toBe(`Another state is already named "State 2".`);
  });

  it("takes the state's own name and a new one", () => {
    expect(labelProblem("State 1", "a", nodes)).toBeUndefined();
    expect(labelProblem("cat", "a", nodes)).toBeUndefined();
  });
});
