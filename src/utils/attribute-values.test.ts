import { getAttributeValues, graphFromValues } from "./attribute-values";

const reply = (values: unknown[]) => ({
  success: true,
  values: values.map((value, i) => ({id: i, values: {word: value}}))
});

describe("getAttributeValues and graphFromValues", () => {
  it("turns missing values into chain breaks and other values into strings", async () => {
    const sendRequest = jest.fn().mockResolvedValue(reply(["a", undefined, "b", null, "", 3, "a", 3]));
    const values = await getAttributeValues(sendRequest, "Words", "Cases", "word");
    expect(values).toEqual(["a", "", "b", "", "", "3", "a", "3"]);

    const {nodes, edges} = graphFromValues(values ?? []);
    expect(nodes).toEqual([
      {id: "a", label: "a", value: 2},
      {id: "b", label: "b", value: 1},
      {id: "3", label: "3", value: 2},
    ]);
    expect(edges).toEqual([
      {from: "3", to: "a", value: 1},
      {from: "a", to: "3", value: 1},
    ]);
  });

  it("resolves to undefined when the request is rejected", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const sendRequest = jest.fn().mockRejectedValue("handleResponse: CODAP request timed out");
    await expect(getAttributeValues(sendRequest, "Words", "Cases", "word")).resolves.toBeUndefined();
    log.mockRestore();
  });

  it("gives no values for a failed reply", async () => {
    const sendRequest = jest.fn().mockResolvedValue({success: false});
    await expect(getAttributeValues(sendRequest, "Words", "Cases", "word")).resolves.toEqual([]);
  });
});
