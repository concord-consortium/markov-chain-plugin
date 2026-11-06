import { readSavedInput } from "./interactive-state";

describe("readSavedInput", () => {
  it("reads no saved input from nothing, an empty state, or the version alone", () => {
    expect(readSavedInput(null)).toBeUndefined();
    expect(readSavedInput(undefined)).toBeUndefined();
    expect(readSavedInput({})).toBeUndefined();
    expect(readSavedInput({ version: 1 })).toBeUndefined();
  });

  it("reads no saved input from a malformed state", () => {
    expect(readSavedInput("{not json")).toBeUndefined();
    expect(readSavedInput({ version: 1, input: "the cat" })).toBeUndefined();
    expect(readSavedInput({ version: 1, input: { text: 3 } })).toBeUndefined();
  });

  it("reads the saved text from an object or a JSON string", () => {
    expect(readSavedInput({ version: 1, input: { text: "the cat" } })).toBe("the cat");
    expect(readSavedInput(JSON.stringify({ version: 1, input: { text: "the cat" } }))).toBe("the cat");
    expect(readSavedInput({ version: 1, input: { text: "" } })).toBe("");
  });
});
