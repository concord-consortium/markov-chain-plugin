import type { ObjectStorageConfig } from "@concord-consortium/object-storage";
import { TableData } from "./table-data";

export const saveTimeout = 30000;

export interface TableSender {
  send: (name: string, tables: TableData[]) => Promise<void>;
}

// The library and Firebase are a chunk of their own, loaded only where Send to CODAP shows. The client starts with the
// workspace: it signs in as it is created, and the token in the config is freshest then.
export const connectTableSender = (config: unknown): TableSender => {
  const connecting = import("@concord-consortium/object-storage").then(library => ({
    library, storage: library.createObjectStorage(config as ObjectStorageConfig),
  }));
  connecting.catch(() => undefined);

  const write = async (name: string, tables: TableData[]) => {
    const { library, storage } = await connecting;
    const snapshot = new library.StoredObject({ name, description: name, subType: "multi-value-snapshot" });
    const ids = tables.map(table => table.word.toLowerCase());
    tables.forEach((table, index) =>
      snapshot.addDataTable({ id: ids[index], name: table.word, cols: table.cols, rows: table.rows }));
    snapshot.addObject({
      id: "tables", name: "Tables",
      data: { tables: tables.map(({ colTypes }, index) => ({ id: ids[index], colTypes })) },
    });
    await storage.add(snapshot);
  };

  return {
    send: (name, tables) => {
      const writing = write(name, tables);
      writing.catch(() => undefined);
      let timer: number | undefined;
      const timedOut = new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(() => reject(new Error("save timed out")), saveTimeout);
      });
      return Promise.race([writing, timedOut]).finally(() => window.clearTimeout(timer));
    }
  };
};
