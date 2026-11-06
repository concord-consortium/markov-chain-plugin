import { DemoObjectStorage, StoredObject } from "@concord-consortium/object-storage";
import { TableData } from "./table-data";
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
