import { DemoObjectStorage, FirebaseObjectStorage, StoredObject } from "@concord-consortium/object-storage";
import { Node, SequenceGroup } from "../../type";
import { buildTable, outputsTableFull, storedBytes, TableData } from "./table-data";
import { connectTableSender, saveTimeout } from "./table-sender";

const demoConfig = { version: 1, type: "demo" };

const states: TableData = {
  word: "States", cols: ["State"], colTypes: ["categorical"], rows: [["rain"], ["sun"]],
};
const transitions: TableData = {
  word: "Transitions", cols: ["From", "To", "Probability"], colTypes: ["categorical", "categorical", "numeric"],
  rows: [["rain", "sun", 1]],
};

describe("connectTableSender", () => {
  let add: jest.SpyInstance;

  beforeEach(() => {
    add = jest.spyOn(DemoObjectStorage.prototype, "add");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const sentObject = async () => {
    await connectTableSender(demoConfig).send("Drawing1", [states, transitions]);
    expect(add).toHaveBeenCalledTimes(1);
    return add.mock.calls[0][0] as StoredObject;
  };

  it("names the object for the snapshot, as a multi-value snapshot", async () => {
    const { metadata } = await sentObject();
    expect(metadata).toMatchObject({
      name: "Drawing1", description: "Drawing1", subType: "multi-value-snapshot", type: "untyped",
    });
  });

  it("writes each table under its lowercase word, named with its word", async () => {
    const { metadata, data } = await sentObject();
    expect(metadata.items).toEqual({
      states: { type: "dataTable", name: "States", cols: ["State"] },
      transitions: { type: "dataTable", name: "Transitions", cols: ["From", "To", "Probability"] },
      tables: { type: "object", name: "Tables", keys: ["tables"] },
    });
    expect(data).toMatchObject({
      states: { rows: [["rain"], ["sun"]] },
      transitions: { rows: [["rain", "sun", 1]] },
    });
  });

  it("lists the tables in order, with each one's column types", async () => {
    const { data } = await sentObject();
    expect(data.tables).toEqual({
      tables: [
        { id: "states", colTypes: ["categorical"] },
        { id: "transitions", colTypes: ["categorical", "categorical", "numeric"] },
      ],
    });
  });

  it("keeps the order it is given", async () => {
    await connectTableSender(demoConfig).send("Data1", [transitions, states]);
    const { data } = add.mock.calls[0][0] as StoredObject;
    expect(data.tables.tables.map(({ id }: { id: string }) => id)).toEqual(["transitions", "states"]);
  });

  it("makes a new object for each send", async () => {
    const sender = connectTableSender(demoConfig);
    await sender.send("Data1", [states]);
    await sender.send("Data1", [states]);
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls[0][0].id).not.toEqual(add.mock.calls[1][0].id);
  });

  it("rejects when the library refuses the config", async () => {
    await expect(connectTableSender({ version: 2, type: "demo" }).send("Data1", [states])).rejects.toThrow();
    expect(add).not.toHaveBeenCalled();
  });

  // Jest fails a test on an unhandled rejection, which is what the wait gives a chance to happen
  it("leaves a refused config unreported until a send asks", async () => {
    connectTableSender({ version: 2, type: "demo" });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(add).not.toHaveBeenCalled();
  });

  it("rejects when the write fails", async () => {
    add.mockRejectedValue(new Error("refused"));
    await expect(connectTableSender(demoConfig).send("Data1", [states])).rejects.toThrow("refused");
  });

  it("leaves no timer running once the write finishes", async () => {
    jest.useFakeTimers();
    await connectTableSender(demoConfig).send("Data1", [states]);
    expect(add).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects at the timeout when the write never finishes, and not before", async () => {
    jest.useFakeTimers();
    add.mockReturnValue(new Promise(() => undefined));
    const settled = jest.fn();
    connectTableSender(demoConfig).send("Data1", [states]).catch(settled);
    await jest.advanceTimersByTimeAsync(saveTimeout - 1);
    expect(settled).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(settled.mock.calls[0][0]).toEqual(new Error("save timed out"));
  });
});

describe("an Outputs table at the size limit, as Firestore would store it", () => {
  const firestoreLimit = 1048576;
  const word = (id: number): Node => ({ id: `${id}`, label: "abcde", value: 1 });
  const groupOf = (count: number): SequenceGroup[] => [{
    startingState: "", startingNode: undefined, delimiter: " ", lengthLimit: 20,
    sequences: Array.from({ length: count }, () => Array.from({ length: 20 }, (_, index) => word(index))),
  }];
  // the fewest outputs that reach the limit, which is where generating stops
  const fullCount = () => {
    let [low, high] = [1, 20000];
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      [low, high] = outputsTableFull(groupOf(middle)) ? [low, middle] : [middle + 1, high];
    }
    return low;
  };
  const long = "x".repeat(200);
  const config = {
    version: 1, type: "firebase", app: {}, root: long, questionId: long,
    user: {
      type: "authenticated", jwt: "", contextId: long, platformId: long, platformUserId: long, resourceLinkId: long,
    },
  };
  // Firestore's documented sizes: a string or a field name is its UTF-8 bytes plus 1, a timestamp is 8, and a
  // document is 32 more than its fields, plus 16 more than its path's segments
  const utf8 = (text: string) => new Blob([text]).size + 1;
  const documentBytes = (path: string, fields: Record<string, unknown>) => 32 + 16 +
    path.split("/").reduce((sum, segment) => sum + utf8(segment), 0) +
    Object.entries(fields).reduce((sum, [name, value]) =>
      sum + utf8(name) + (typeof value === "string" ? utf8(value) : 8), 0);

  it("stores the rows as exactly the bytes the limit counts, in a document that fits", async () => {
    const outputs = buildTable("Outputs", {
      mode: "useData", tokens: [], graph: { nodes: [], edges: [] }, sequenceGroups: groupOf(fullCount()),
    });
    const add = jest.spyOn(DemoObjectStorage.prototype, "add");
    await connectTableSender(demoConfig).send("Data1", [outputs]);
    const { id, data } = add.mock.calls[0][0] as StoredObject;
    add.mockRestore();
    const itemData = JSON.stringify(data.outputs);
    expect(new Blob([itemData]).size).toBe(storedBytes(outputs));

    const storage = FirebaseObjectStorage.prototype as unknown as {
      createDocument: (contents: object) => Record<string, unknown>;
      getItemDataPath: (objectId: string, itemId: string) => string;
    };
    const fields = storage.createDocument.call({ config }, { objectId: id, itemId: "outputs", itemData });
    const room = firestoreLimit - documentBytes(storage.getItemDataPath.call({ config }, id, "outputs"), fields);
    expect(room).toBeGreaterThan(45000);
  });
});
