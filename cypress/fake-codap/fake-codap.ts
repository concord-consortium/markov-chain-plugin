// A stand-in for CODAP that the Cypress tests load the plugin into. It answers the plugin's requests with
// replies shaped like CODAP 3.1.2's and sends the notifications CODAP sends, through the same iframe-phone
// protocol CODAP uses. The development server serves it as fake-codap.html; production builds leave it out.
import { IframePhoneRpcEndpoint, ParentEndpoint } from "iframe-phone";

export type CodapRequest = { action: string, resource: string, values?: any };

export type FakeDataset = { name: string, collection: string, attributes: Record<string, unknown[]> };

export type StartOptions = {
  savedState?: unknown;
  dataset?: FakeDataset;
  holdInit?: boolean;
  width?: number;
  height?: number;
  query?: string;
};

export type CasesOperation = "createCases" | "updateCases" | "deleteCases";

const outputDatasetName = "Sequence Data";

const defaultDataset = (): FakeDataset => ({
  name: "Words",
  collection: "Cases",
  attributes: {
    Word: ["the", "cat", "sat", "on", "the", "mat"],
    Letter: ["a", "b", "a", "c"]
  }
});

let options: StartOptions = {};
let dataset = defaultDataset();
let iframe: HTMLIFrameElement | undefined;
let rpc: IframePhoneRpcEndpoint | undefined;
let heldInit: (() => void) | undefined;
const requests: CodapRequest[] = [];
const errors: string[] = [];
const items: Record<string, unknown>[] = [];

const caseFormulaSearchReply = () => {
  const caseCount = Math.max(0, ...Object.values(dataset.attributes).map(values => values.length));
  const cases = [];
  for (let i = 0; i < caseCount; i++) {
    const values: Record<string, unknown> = {};
    Object.entries(dataset.attributes).forEach(([name, attributeValues]) => { values[name] = attributeValues[i]; });
    cases.push({ id: i + 1, values });
  }
  return { success: true, values: cases };
};

const reply = (request: CodapRequest) => {
  const { action, resource, values } = request;

  if (resource === "interactiveFrame") {
    return action === "get" ? { success: true, values: { savedState: options.savedState } } : { success: true };
  }
  const casesResource = `dataContext[${dataset.name}].collection[${dataset.collection}].caseFormulaSearch[true]`;
  if (action === "get" && resource === casesResource) {
    return caseFormulaSearchReply();
  }
  if (action === "get" && resource === "dataContextList") {
    const list = [{ name: dataset.name, title: dataset.name, id: 1, guid: 1 }];
    if (items.length > 0) {
      list.push({ name: outputDatasetName, title: "Output Sequences", id: 2, guid: 2 });
    }
    return { success: true, values: list };
  }
  if (action === "create" && resource === "dataContext") {
    return { success: true, values: { id: 2, name: values?.name, title: values?.title } };
  }
  if (action === "get" && resource === "componentList") {
    return { success: true, values: [] };
  }
  if (action === "create" && resource === "component") {
    return { success: true, values: { id: 3, title: values?.title, type: values?.type } };
  }
  if (action === "create" && resource === `dataContext[${outputDatasetName}].item`) {
    items.push(...values);
    return { success: true, values: { caseIDs: [], itemIDs: [] } };
  }
  if (action === "get" && resource === `dataContext[${outputDatasetName}].itemSearch[*]`) {
    return items.length > 0
      ? { success: true, values: items.map((item, i) => ({ id: i + 1, values: item })) }
      : { success: false, values: { error: "DataContext not found" } };
  }
  return { success: false, values: { error: `fake CODAP does not handle ${action} ${resource}` } };
};

const handleRequest = (request: CodapRequest | CodapRequest[], callback: (response: unknown) => void) => {
  requests.push(...(Array.isArray(request) ? request : [request]));
  const respond = () => callback(Array.isArray(request) ? request.map(reply) : reply(request));
  // the plugin's init asks for interactiveFrame, and the plugin shows "Loading ..." until it gets the reply
  const isInit = Array.isArray(request) && request.some(r => r.action === "get" && r.resource === "interactiveFrame");
  if (isInit && options.holdInit) {
    heldInit = respond;
  } else {
    respond();
  }
};

const call = (request: CodapRequest) =>
  new Promise<any>(resolve => rpc?.call(request as any, response => resolve(response)));

const start = (startOptions: StartOptions = {}) => {
  rpc?.disconnect();
  iframe?.remove();
  options = startOptions;
  dataset = startOptions.dataset ?? dataset;
  heldInit = undefined;
  requests.length = 0;

  iframe = document.createElement("iframe");
  iframe.id = "plugin";
  iframe.width = String(startOptions.width ?? 600);
  iframe.height = String(startOptions.height ?? 420);
  iframe.src = `index.html${startOptions.query ? `?${startOptions.query}` : ""}`;
  // Cypress fails a test only on errors in its own window, so errors in the plugin's frame are kept for the tests
  iframe.addEventListener("load", () => {
    const pluginWindow = iframe?.contentWindow;
    pluginWindow?.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
    pluginWindow?.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));
  });
  document.body.appendChild(iframe);

  const origin = window.location.origin;
  rpc = new IframePhoneRpcEndpoint(handleRequest as any, "data-interactive", iframe, origin,
    new ParentEndpoint(iframe, origin));
};

const fakeCodap = {
  requests,
  errors,
  items,
  start,
  restart: (savedState: unknown) => start({ ...options, savedState, holdInit: false }),
  releaseInit: () => heldInit?.(),
  dataset: () => dataset,
  setAttributeValues: (name: string, values: unknown[]) => { dataset.attributes[name] = values; },
  renameAttribute: (from: string, to: string) => {
    dataset.attributes[to] = dataset.attributes[from];
    delete dataset.attributes[from];
  },
  dropAttribute: async (name: string) => {
    const drop = { context: { name: dataset.name }, collection: { name: dataset.collection }, attribute: { name } };
    for (const operation of ["dragstart", "drop", "dragend"]) {
      await call({ action: "notify", resource: "dragDrop[attribute]", values: { operation, ...drop } });
    }
  },
  notifyCases: (operation: CasesOperation) =>
    call({ action: "notify", resource: `dataContextChangeNotice[${dataset.name}]`, values: { operation } }),
  getInteractiveState: () => call({ action: "get", resource: "interactiveState" }),
  resize: (width: number, height: number) => {
    iframe?.setAttribute("width", String(width));
    iframe?.setAttribute("height", String(height));
  }
};

export type FakeCodap = typeof fakeCodap;

(window as any).fakeCodap = fakeCodap;
