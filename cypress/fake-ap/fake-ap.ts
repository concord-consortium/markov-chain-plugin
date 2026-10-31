// A stand-in for LARA and the Activity Player that the Cypress tests load the Markov Interactive into. It starts
// the interactive in a mode with an authored and interactive state, as LARA's authoring dialog, the Activity
// Player and the class dashboard do, and keeps every message the interactive sends. The development server
// serves it as fake-ap.html; production builds leave it out.
import { ParentEndpoint } from "iframe-phone";
import { initInteractiveMessage } from "../../src/interactive/host-messages";

// "unknown" stands for a mode the interactive doesn't support, as a newer host could send
export type InteractiveMode = "authoring" | "runtime" | "report" | "reportItem" | "unknown";

export type StartOptions = {
  mode: InteractiveMode;
  authoredState?: unknown;
  interactiveState?: unknown;
  // LARA's authoring column is about 435px wide
  width?: number;
  // a query string on the interactive's URL, as an author could paste a standalone link into LARA
  search?: string;
};

export type InteractiveMessage = { type: string, content: unknown };

export type ItemsType = "fullAnswer" | "compactAnswer";

const messageTypes = [
  "supportedFeatures", "authoredState", "interactiveState", "height", "reportItemClientReady", "reportItemAnswer"
];

let options: StartOptions = { mode: "runtime" };
let iframe: HTMLIFrameElement | undefined;
let phone: ParentEndpoint | undefined;
let awaitingAnswer: ((answer: any) => void) | undefined;
const messages: InteractiveMessage[] = [];
const errors: string[] = [];

const initMessage = () => options.mode === "reportItem"
  ? { version: 1, mode: "reportItem", hostFeatures: {}, interactiveItemId: "interactive_1", view: "singleAnswer",
    users: { student1: { hasAnswer: true } } }
  : { ...initInteractiveMessage("runtime", options.authoredState, options.interactiveState), mode: options.mode };

const start = (startOptions: StartOptions) => {
  phone?.disconnect();
  iframe?.remove();
  options = startOptions;
  messages.length = 0;

  iframe = document.createElement("iframe");
  iframe.id = "interactive";
  iframe.width = String(startOptions.width ?? 435);
  const page = startOptions.mode === "reportItem" ? "report-item.html" : "interactive.html";
  iframe.src = page + (startOptions.search ?? "");
  document.body.appendChild(iframe);
  // Cypress fails a test only on errors in its own window, so errors in the interactive's frame are kept for the
  // tests. The frame's first window is reused when it loads the same-origin page, so these see its startup too.
  const interactiveWindow = iframe.contentWindow;
  interactiveWindow?.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
  interactiveWindow?.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));

  const endpoint = new ParentEndpoint(iframe, window.location.origin,
    () => endpoint.post("initInteractive", initMessage()));
  phone = endpoint;
  messageTypes.forEach(type => endpoint.addListener(type, (content: unknown) => {
    messages.push({ type, content });
    // the host sizes the frame to the interactive's height, as LARA and the Activity Player do
    if (type === "height") {
      iframe?.setAttribute("height", String(content));
    }
    if (type === "reportItemAnswer") {
      awaitingAnswer?.(content);
      awaitingAnswer = undefined;
    }
  }));
};

// asks the report item for a student's answer, as the class dashboard does, and resolves with the answer
const requestReportItemAnswer = (itemsType: ItemsType, platformUserId = "student1") => new Promise<any>(resolve => {
  awaitingAnswer = resolve;
  // the dashboard sends no requestId, and the library's listener answers only a request without one
  phone?.post("getReportItemAnswer", {
    version: "2.1.0", platformUserId, itemsType,
    interactiveState: options.interactiveState ?? null, authoredState: options.authoredState ?? null
  });
});

const fakeAp = {
  messages,
  errors,
  start,
  requestReportItemAnswer,
};

export type FakeAp = typeof fakeAp;

(window as any).fakeAp = fakeAp;
