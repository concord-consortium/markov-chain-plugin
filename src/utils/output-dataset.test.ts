import { createSequenceOutput, guaranteeOutputDatasetAndCaseTable } from "./output-dataset";

// replies captured from CODAP 3.1.2
const dataContextList = { success: true, values: [
  { name: "Sequence Data", guid: 667035179064476, title: "Output Sequences", id: 667035179064476 }
] };
const componentList = { success: true, values: [
  { hidden: false, id: 3, name: "index", title: "Markov Chain", type: "game" },
  { hidden: false, id: 399498427788315, name: "Sequence Data", title: "Output Sequences", type: "caseTable" }
] };
const itemSearch = { success: true, values: [0, 4, 4, 1, 2, 3, "abc"].map((n, i) => (
  { id: i, values: { State: "i", "Sequence number": n } }
)) };

const mockCODAP = (datasetExists: boolean, rejectComponentList = false, itemSearchReply: unknown = itemSearch) =>
  jest.fn(async (request: any) => {
    switch (request.resource) {
      case "dataContextList": return datasetExists ? dataContextList : { success: true, values: [] };
      case "componentList":
        if (rejectComponentList) {
          throw new Error("handleResponse: CODAP request timed out");
        }
        return componentList;
      case "dataContext[Sequence Data].itemSearch[*]": return itemSearchReply;
      default: return { success: true, values: {} };
    }
  });

const created = (sendRequest: jest.Mock) =>
  sendRequest.mock.calls.map(([request]) => request).filter(r => r.action === "create").map(r => r.resource);

describe("guaranteeOutputDatasetAndCaseTable", () => {
  afterEach(() => jest.restoreAllMocks());

  it("creates the dataset only when it is missing, and always requests the table", async () => {
    const existing = mockCODAP(true);
    await guaranteeOutputDatasetAndCaseTable(existing);
    expect(created(existing)).toEqual(["component"]);

    const missing = mockCODAP(false);
    await guaranteeOutputDatasetAndCaseTable(missing);
    expect(created(missing)).toEqual(["dataContext", "component"]);
  });

  it("still requests the table when the component list can't be read", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const sendRequest = mockCODAP(true, true);
    await guaranteeOutputDatasetAndCaseTable(sendRequest);
    expect(created(sendRequest)).toEqual(["component"]);
  });
});

describe("createSequenceOutput", () => {
  const sequenceNumbers = (sendRequest: jest.Mock) => sendRequest.mock.calls.map(([request]) => request)
    .filter(r => r.resource === "dataContext[Sequence Data].item")
    .map(r => r.values[0]["Sequence number"]);

  it("continues after the highest sequence number already in the dataset", async () => {
    const sendRequest = mockCODAP(true);
    const output = createSequenceOutput(sendRequest);
    await output(["i", "love"]);
    await output(["class"]);
    expect(sequenceNumbers(sendRequest)).toEqual([5, 6]);
  });

  it("gives overlapping outputs their own sequence numbers", async () => {
    const sendRequest = mockCODAP(true);
    const output = createSequenceOutput(sendRequest);
    await Promise.all([output(["i", "love"]), output(["class"])]);
    expect(sequenceNumbers(sendRequest)).toEqual([5, 6]);
  });

  it("continues after the highest sequence number in a very large dataset", async () => {
    const items = Array.from({ length: 500000 }, (_, i) => ({ id: i, values: { State: "i", "Sequence number": i } }));
    const sendRequest = mockCODAP(true, false, { success: true, values: items });
    const output = createSequenceOutput(sendRequest);
    await output(["i"]);
    expect(sequenceNumbers(sendRequest)).toEqual([500000]);
  });

  it("starts at 0 when the existing numbers can't be read", async () => {
    const sendRequest = mockCODAP(true, false, { success: false, values: { error: "DataContext not found" } });
    const output = createSequenceOutput(sendRequest);
    await output(["i"]);
    await output(["love"]);
    expect(sequenceNumbers(sendRequest)).toEqual([0, 1]);
  });

  it("starts at 0 when there is no dataset", async () => {
    const sendRequest = mockCODAP(false);
    const output = createSequenceOutput(sendRequest);
    await output(["i"]);
    await output(["love"]);
    expect(sequenceNumbers(sendRequest)).toEqual([0, 1]);
  });
});
