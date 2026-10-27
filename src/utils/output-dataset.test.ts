import { guaranteeOutputDatasetAndCaseTable } from "./output-dataset";

// replies captured from CODAP 3.1.2
const dataContextList = {success: true, values: [
  {name: "Sequence Data", guid: 667035179064476, title: "Output Sequences", id: 667035179064476}
]};
const componentList = {success: true, values: [
  {hidden: false, id: 3, name: "index", title: "Markov Chain", type: "game"},
  {hidden: false, id: 399498427788315, name: "Sequence Data", title: "Output Sequences", type: "caseTable"}
]};

const mockCODAP = (datasetExists: boolean, rejectComponentList = false) => jest.fn(async (request: any) => {
  switch (request.resource) {
    case "dataContextList": return datasetExists ? dataContextList : {success: true, values: []};
    case "componentList":
      if (rejectComponentList) {
        throw new Error("handleResponse: CODAP request timed out");
      }
      return componentList;
    default: return {success: true, values: {}};
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
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    const sendRequest = mockCODAP(true, true);
    await guaranteeOutputDatasetAndCaseTable(sendRequest);
    expect(created(sendRequest)).toEqual(["component"]);
  });
});
