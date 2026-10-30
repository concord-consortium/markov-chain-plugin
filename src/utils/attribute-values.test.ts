import { getAttributeValues, graphFromValues, toStateLabel } from "./attribute-values";

const reply = (values: unknown[]) => ({
  success: true,
  values: values.map((value, i) => ({ id: i, values: { word: value } }))
});

describe("getAttributeValues and graphFromValues", () => {
  afterEach(() => jest.restoreAllMocks());

  it("turns missing values into chain breaks and other values into strings", async () => {
    const sendRequest = jest.fn().mockResolvedValue(reply(["a", undefined, "b", null, "", 3, "a", 3]));
    const values = await getAttributeValues(sendRequest, "Words", "Cases", "word");
    expect(values).toEqual(["a", "", "b", "", "", "3", "a", "3"]);

    const { nodes, edges } = graphFromValues(values ?? []);
    expect(nodes).toEqual([
      { id: "a", label: "a", value: 2 },
      { id: "b", label: "b", value: 1 },
      { id: "3", label: "3", value: 2 },
    ]);
    expect(edges).toEqual([
      { from: "3", to: "a", value: 1 },
      { from: "a", to: "3", value: 1 },
    ]);
  });

  it("resolves to undefined when the request is rejected", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const sendRequest = jest.fn().mockRejectedValue("handleResponse: CODAP request timed out");
    await expect(getAttributeValues(sendRequest, "Words", "Cases", "word")).resolves.toBeUndefined();
  });

  it("gives no values for a failed reply", async () => {
    const sendRequest = jest.fn().mockResolvedValue({ success: false });
    await expect(getAttributeValues(sendRequest, "Words", "Cases", "word")).resolves.toEqual([]);
  });
});

describe("graphFromValues", () => {
  it("counts back-to-back repeats as a self-loop and adds repeated transitions together", () => {
    expect(graphFromValues(["a", "a", "b", "a", "b"])).toEqual({
      nodes: [{ id: "a", label: "a", value: 3 }, { id: "b", label: "b", value: 2 }],
      edges: [
        { from: "a", to: "a", value: 1 },
        { from: "a", to: "b", value: 2 },
        { from: "b", to: "a", value: 1 },
      ],
    });
  });

  it("keeps 0, false and whitespace-only values as states", () => {
    // today's behavior, not a requirement: a whitespace-only value becomes a blank state
    const values = [0, false, " "].map(toStateLabel);
    expect(values).toEqual(["0", "false", " "]);
    expect(graphFromValues(values).edges).toEqual([
      { from: "0", to: "false", value: 1 },
      { from: "false", to: " ", value: 1 },
    ]);
  });
});
