import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ParentEndpoint } from "iframe-phone";
import { readAuthoredState } from "./authored-state";
import { demoWidths, DemoWidthId, readDemoWidth } from "./demo-widths";
import { HostedMode, initInteractiveMessage } from "./host-messages";
import { placeholderReportHtml } from "./report-item-answer";
import { longLinkLength, searchFromAuthoredState } from "./url-settings";

import "./interactive.scss";
import "./demo.scss";

// the runtime restarts with the authoring form's latest state once the author pauses this long
const restartDelay = 500;
const copyResultDuration = 2000;

const initialAuthoredState = readAuthoredState({ startingText: "the cat sat on the mat. the cat ran." });

// the report's own style for a wide answer, which hides the tall version
const reportItemDocument = (html: string) =>
  `<!DOCTYPE html><html><head><style>body { font-family: lato, arial, helvetica, sans-serif; margin: 0; }
  .tall { display: none; }</style></head><body>${html}</body></html>`;

interface HostedFrameProps {
  title: string;
  mode: HostedMode;
  authoredState: unknown;
  getInteractiveState?: () => unknown;
  onMessage: (type: "authoredState" | "interactiveState", content: unknown) => void;
  // the width the page width choice gives, or, left out, the width the page's styles give
  width?: number | string;
}

// interactive.html in a frame, started in a mode as LARA or the Activity Player starts it, and sized to the height
// it reports; a new authoredState restarts it
const HostedFrame = ({ title, mode, authoredState, getInteractiveState, onMessage, width }: HostedFrameProps) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) {
      return;
    }
    iframe.src = "interactive.html";
    const endpoint = new ParentEndpoint(iframe, window.location.origin, () => {
      endpoint.post("initInteractive", initInteractiveMessage(mode, authoredState, getInteractiveState?.()));
    });
    endpoint.addListener("height", (content: unknown) => setHeight(Number(content)));
    endpoint.addListener("authoredState", (content: unknown) => onMessage("authoredState", content));
    endpoint.addListener("interactiveState", (content: unknown) => onMessage("interactiveState", content));
    return () => endpoint.disconnect();
  }, [mode, authoredState, getInteractiveState, onMessage]);

  return <iframe ref={ref} title={title} className={`hosted-frame ${mode}`} style={{ width, height }} />;
};

const pageTitle = "Demo and Standalone Authoring";

const standaloneWarning = "Standalone link to use outside Activity Player:";

// The interactive opened on its own with the authoring form's settings, for a collection page or any page outside
// the Activity Player. The link is beside this page, so it names the same branch or version.
const StandaloneLink = ({ authoredState }: { authoredState: unknown }) => {
  const link = new URL(`interactive.html${searchFromAuthoredState(readAuthoredState(authoredState))}`,
    window.location.href).href;
  // a new object for each click, so each click restarts the timeout
  const [copyResult, setCopyResult] = useState<{ copied: boolean }>();

  useEffect(() => {
    if (copyResult === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => setCopyResult(undefined), copyResultDuration);
    return () => window.clearTimeout(timeout);
  }, [copyResult]);

  // outside a secure context navigator.clipboard is undefined, and the first then makes that a rejection
  const copy = () => Promise.resolve().then(() => navigator.clipboard.writeText(link)).then(
    () => setCopyResult({ copied: true }),
    () => setCopyResult({ copied: false }));

  // screen readers may not announce the focused button's new text, so the status says it too
  return (
    <div className="demo-standalone" role="group" aria-label="Standalone link">
      { link.length > longLinkLength && (
        <p className="demo-standalone-long">
          This link is longer than { longLinkLength.toLocaleString("en-US") } characters, mostly its starting text, and
          some sites and email programs cut long links short.
        </p>
      ) }
      <p id="demo-standalone-warning" className="demo-standalone-warning">{ standaloneWarning }</p>
      <button type="button" onClick={copy} aria-describedby="demo-standalone-warning">
        { copyResult === undefined ? "Copy" : copyResult.copied ? "Copied" : "Copy failed" }
      </button>
      <a href={link} target="_blank" rel="noopener noreferrer" aria-describedby="demo-standalone-warning">
        Open
      </a>
      <span role="status" className="demo-visually-hidden">
        { copyResult && (copyResult.copied ? "Standalone link copied" : "The standalone link couldn't be copied") }
      </span>
    </div>
  );
};

const Demo = () => {
  const [authoredState, setAuthoredState] = useState<unknown>(initialAuthoredState);
  const [runtimeAuthoredState, setRuntimeAuthoredState] = useState<unknown>(initialAuthoredState);
  const [widthId, setWidthId] = useState<DemoWidthId>(() => readDemoWidth(window.location.search));
  // kept across the runtime's restarts, as the Activity Player keeps a student's state
  const interactiveStateRef = useRef<unknown>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setRuntimeAuthoredState(authoredState), restartDelay);
    return () => window.clearTimeout(timeout);
  }, [authoredState]);

  const getInteractiveState = useCallback(() => interactiveStateRef.current, []);
  const handleMessage = useCallback((type: "authoredState" | "interactiveState", content: unknown) => {
    if (type === "authoredState") {
      setAuthoredState(content);
    } else {
      interactiveStateRef.current = content;
    }
  }, []);

  const selectWidth = (id: DemoWidthId) => {
    setWidthId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("width", id);
    window.history.replaceState(null, "", url);
  };

  const frameWidth = demoWidths.find(w => w.id === widthId)?.frameWidth;

  return (
    <div className="demo">
      <header className="demo-header">
        <h1>{ pageTitle }</h1>
        <StandaloneLink authoredState={authoredState} />
      </header>
      <div className="demo-columns">
        <section className="demo-authoring" aria-labelledby="demo-authoring-heading">
          <h2 id="demo-authoring-heading">Authoring</h2>
          <HostedFrame title="Authoring" mode="authoring" authoredState={initialAuthoredState}
            onMessage={handleMessage} />
        </section>
        <section className="demo-runtime" aria-labelledby="demo-runtime-heading">
          <div className="demo-runtime-header">
            <h2 id="demo-runtime-heading">Interactive</h2>
            <fieldset className="demo-widths">
              <legend>Activity Player page width</legend>
              { demoWidths.map(({ id, label }) => (
                <label key={id} className={id === widthId ? "selected" : undefined}>
                  <input type="radio" name="width" value={id} checked={id === widthId}
                    onChange={() => selectWidth(id)} />
                  { label }
                </label>
              )) }
            </fieldset>
          </div>
          <div className="demo-runtime-frame">
            <HostedFrame title="Interactive" mode="runtime" authoredState={runtimeAuthoredState}
              getInteractiveState={getInteractiveState} onMessage={handleMessage} width={frameWidth ?? "100%"} />
          </div>
          <h2>Report item, full answer</h2>
          <iframe title="Report item" className="demo-report-item" srcDoc={reportItemDocument(placeholderReportHtml)} />
        </section>
      </div>
    </div>
  );
};

document.title = pageTitle;
createRoot(document.getElementById("app") as HTMLElement).render(<Demo />);
