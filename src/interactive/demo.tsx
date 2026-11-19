import React, { useCallback, useEffect, useRef, useState } from "react";
import { ParentEndpoint } from "iframe-phone";
import { readAuthoredState } from "./authored-state";
import { interactiveStateVersion, readInteractiveState } from "./interactive-state";
import { demoWidths, DemoWidthId, readDemoWidth } from "./demo-widths";
import { HostedMode, initInteractiveMessage } from "./host-messages";
import { newTabNote } from "./page/external-link";
import { PageFooter } from "./page/page-footer";
import { PageHeader } from "./page/page-header";
import { authoringSubtitle, demoPageTitle, PageId } from "./page/page-links";
import { reportSummaryHtml } from "./report-summary";
import { isLinkTooLong, longLinkLength, maxLinkPathLength, searchFromAuthoredState } from "./url-settings";

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
  // interactive.html, from the page's folder
  src: string;
  // whether the host offers object storage, which the Send to CODAP button needs
  objectStorage: boolean;
  title: string;
  mode: HostedMode;
  authoredState: unknown;
  // the state to start with authoredState, and the authoredState a message's frame was started with
  getInteractiveState?: (authoredState: unknown) => unknown;
  onMessage: (type: "authoredState" | "interactiveState", content: unknown, authoredState: unknown) => void;
  // the width the page width choice gives, or, left out, the width the page's styles give
  width?: number | string;
}

// interactive.html in a frame, started in a mode as LARA or the Activity Player starts it, and sized to the height
// it reports; a new authoredState restarts it
const HostedFrame = ({ src, objectStorage, title, mode, authoredState, getInteractiveState, onMessage, width }:
  HostedFrameProps) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) {
      return;
    }
    iframe.src = src;
    const endpoint = new ParentEndpoint(iframe, window.location.origin, () => {
      const interactiveState = getInteractiveState?.(authoredState);
      endpoint.post("initInteractive", initInteractiveMessage(mode, authoredState, interactiveState, objectStorage));
    });
    endpoint.addListener("height", (content: unknown) => setHeight(Number(content)));
    endpoint.addListener("authoredState", (content: unknown) => onMessage("authoredState", content, authoredState));
    endpoint.addListener("interactiveState",
      (content: unknown) => onMessage("interactiveState", content, authoredState));
    return () => endpoint.disconnect();
  }, [src, objectStorage, mode, authoredState, getInteractiveState, onMessage]);

  return <iframe ref={ref} title={title} className={`hosted-frame ${mode}`} style={{ width, height }} />;
};

// where each form of the page finds the interactive it frames
const interactivePaths: Record<PageId, string> = {
  markov: "interactive.html",
  "next-text-probability": "../interactive.html",
};

// the link group's label; the page's users don't know the Activity Player, so nothing here names it
const linkLabel = "Link to the interactive with these settings:";
// the page the link opens saves no work and doesn't report its height to a host, so an activity needs interactive.html
const linkNote =
  "This link opens the interactive on its own and doesn't save work. In an activity, use interactive.html.";
const linkDescription = "demo-standalone-warning demo-standalone-note";

// what a link of this length warns, in a few words beside the label and in full for a screen reader
const linkWarning = (tooLong: boolean, length: number) => {
  if (tooLong) {
    return { refused: true, words: "Too long to open: shorten the starting text",
      sentence: "This link is too long to open: the deployed site refuses links over " +
        `${maxLinkPathLength.toLocaleString("en-US")} characters. Shorten the starting text to make one.` };
  }
  if (length > longLinkLength) {
    return { refused: false, words: "Long link: some sites may cut it short",
      sentence: `This link is longer than ${longLinkLength.toLocaleString("en-US")} characters, mostly its starting ` +
        "text, and some sites and email programs cut long links short." };
  }
};

// The Next Text Probability page with the authoring form's settings, for a collection page or any page outside the
// Activity Player. The page is beside this one, so the link names the same branch or version.
const StandaloneLink = ({ authoredState }: { authoredState: unknown }) => {
  const url = new URL(`index.html${searchFromAuthoredState(readAuthoredState(authoredState))}`,
    window.location.href);
  const link = url.href;
  const tooLong = isLinkTooLong(url.pathname, url.search);
  const warning = linkWarning(tooLong, link.length);
  const [copyResult, setCopyResult] = useState<{ copied: boolean }>();

  useEffect(() => {
    if (copyResult === undefined) {
      return;
    }
    const timeout = window.setTimeout(() => setCopyResult(undefined), copyResultDuration);
    return () => window.clearTimeout(timeout);
  }, [copyResult]);

  // emptied first and shown a frame later, so a repeated result is announced again
  const showCopyResult = (copied: boolean) => window.requestAnimationFrame(() => setCopyResult({ copied }));

  // outside a secure context navigator.clipboard is undefined, and the first then makes that a rejection
  const copy = () => {
    setCopyResult(undefined);
    Promise.resolve().then(() => navigator.clipboard.writeText(link))
      .then(() => showCopyResult(true), () => showCopyResult(false));
  };

  // screen readers may not announce the focused button's new text, so the status says it too. A warning appears
  // while the author types in the authoring frame, so its live region announces it there.
  return (
    <div className="demo-standalone" role="group" aria-label="Link to the interactive">
      { warning && (
        <p className={`demo-standalone-long${warning.refused ? " demo-standalone-refused" : ""}`} aria-hidden="true">
          { warning.words }
        </p>
      ) }
      <p id="demo-standalone-warning" className="demo-standalone-warning">{ linkLabel }</p>
      <button type="button" onClick={copy} disabled={tooLong} aria-describedby={linkDescription}>
        { copyResult === undefined ? "Copy" : copyResult.copied ? "Copied" : "Copy failed" }
      </button>
      <a href={tooLong ? undefined : link} aria-disabled={tooLong || undefined} target="_blank"
        rel="noopener noreferrer" aria-describedby={linkDescription}>
        Open<span className="demo-visually-hidden">{ newTabNote }</span>
      </a>
      <span role="status" className="demo-visually-hidden">
        { copyResult && (copyResult.copied ? "Link copied" : "The link couldn't be copied") }
      </span>
      <span aria-live="polite" className="demo-visually-hidden demo-standalone-long-sentence">
        { warning?.sentence }
      </span>
    </div>
  );
};

export const Demo = ({ page = "markov" }: { page?: PageId }) => {
  const nextText = page === "next-text-probability";
  const interactiveSrc = interactivePaths[page];
  const [authoredState, setAuthoredState] = useState<unknown>(initialAuthoredState);
  const [runtimeAuthoredState, setRuntimeAuthoredState] = useState<unknown>(initialAuthoredState);
  const [widthId, setWidthId] = useState<DemoWidthId>(() => readDemoWidth(window.location.search));
  // kept across the runtime's restarts, as the Activity Player keeps a student's state, for the starting text it was
  // saved under: saved input comes before the starting text, so a new one would otherwise never show here. A restart
  // keeps only that input, since the whole state's panes, switches and mode would win over the authoring form.
  const savedRef = useRef<{ startingText: string, state: unknown }>(undefined);
  // the state and authored state the teacher's view and the report item show; each save starts the view again, as a
  // scrubber step does
  const [report, setReport] = useState<{ saves: number, state: unknown, authoredState: unknown }>();

  useEffect(() => {
    const timeout = window.setTimeout(() => setRuntimeAuthoredState(authoredState), restartDelay);
    return () => window.clearTimeout(timeout);
  }, [authoredState]);

  const getInteractiveState = useCallback((runtimeState: unknown) => {
    const saved = savedRef.current;
    return saved?.startingText === readAuthoredState(runtimeState).startingText
      ? { version: interactiveStateVersion, input: readInteractiveState(saved.state).input }
      : undefined;
  }, []);
  const handleMessage = useCallback((type: "authoredState" | "interactiveState", content: unknown,
    frameState: unknown) => {
    if (type === "authoredState") {
      setAuthoredState(content);
    } else {
      savedRef.current = { startingText: readAuthoredState(frameState).startingText, state: content };
      setReport(previous => ({ saves: (previous?.saves ?? 0) + 1, state: content, authoredState: frameState }));
    }
  }, []);
  const getReportState = useCallback(() => report?.state, [report]);

  const selectWidth = (id: DemoWidthId) => {
    setWidthId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("width", id);
    window.history.replaceState(null, "", url);
  };

  // the page width choice, the teacher's view and the report item are the Activity Player's, so only the demo page
  // shows them; the Next Text Probability page previews the interactive at its full width
  const apViews = !nextText;
  const frameWidth = apViews ? demoWidths.find(w => w.id === widthId)?.frameWidth : undefined;
  // the page its link opens is never hosted, so has no object storage; its preview has none either, to match
  const objectStorage = !nextText;
  // the page's main landmark, between its header and footer
  const Columns = nextText ? "main" : "div";

  return (
    <div className="demo">
      { nextText
        ? (
          <PageHeader subtitle={authoringSubtitle}>
            <StandaloneLink authoredState={authoredState} />
          </PageHeader>
        )
        : (
          <header className="demo-header">
            <h1>{ demoPageTitle }</h1>
          </header>
        ) }
      <Columns className="demo-columns">
        <section className="demo-authoring" aria-labelledby="demo-authoring-heading">
          <h2 id="demo-authoring-heading">Authoring</h2>
          <HostedFrame src={interactiveSrc} objectStorage={objectStorage} title="Authoring" mode="authoring"
            authoredState={initialAuthoredState} onMessage={handleMessage} />
        </section>
        <section className="demo-runtime" aria-labelledby="demo-runtime-heading">
          <div className="demo-runtime-header">
            <h2 id="demo-runtime-heading">Interactive</h2>
            { nextText && <p id="demo-standalone-note" className="demo-standalone-note">{ linkNote }</p> }
            { apViews && (
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
            ) }
          </div>
          <div className="demo-runtime-frame">
            <HostedFrame src={interactiveSrc} objectStorage={objectStorage} title="Interactive" mode="runtime"
              authoredState={runtimeAuthoredState} getInteractiveState={getInteractiveState} onMessage={handleMessage}
              width={frameWidth ?? "100%"} />
          </div>
          { apViews && report && (
            <>
              <h2>Teacher&apos;s view</h2>
              <div className="demo-runtime-frame">
                <HostedFrame src={interactiveSrc} objectStorage={objectStorage} title="Teacher's view" mode="report"
                  key={report.saves} authoredState={report.authoredState} getInteractiveState={getReportState}
                  onMessage={handleMessage} width={frameWidth ?? "100%"} />
              </div>
            </>
          ) }
          { apViews && (
            <>
              <h2>Report item, full answer</h2>
              <iframe title="Report item" className="demo-report-item"
                srcDoc={reportItemDocument(reportSummaryHtml(report?.state,
                  report?.authoredState ?? runtimeAuthoredState))}
              />
            </>
          ) }
        </section>
      </Columns>
      { nextText && <PageFooter /> }
    </div>
  );
};
