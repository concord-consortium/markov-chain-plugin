import React from "react";
import { createRoot } from "react-dom/client";
import {
  inIframe, IReportItemInitInteractive, sendReportItemAnswer, useInitMessage, useReportItem
} from "@concord-consortium/lara-interactive-api";
import { MarkovAuthoredState } from "./authored-state";
import { MarkovInteractiveState } from "./interactive-state";
import { reportItemAnswerItems } from "./report-item-answer";
import { useFrameHeight } from "./use-frame-height";

import "./interactive.scss";

// The class dashboard's report item: one frame answers for every student in the class.
const ReportItem = () => {
  const initMessage = useInitMessage<IReportItemInitInteractive<MarkovInteractiveState, MarkovAuthoredState>>();
  const ref = useFrameHeight();

  useReportItem<MarkovInteractiveState, MarkovAuthoredState>({
    metadata: { compactAnswerReportItemsAvailable: true },
    handler: ({ platformUserId, version, itemsType }) => {
      sendReportItemAnswer({ version, platformUserId, itemsType, items: reportItemAnswerItems(itemsType) });
    }
  });

  return (
    <div className="markov-interactive" ref={ref}>
      { !initMessage && <div className="loading">Loading...</div> }
    </div>
  );
};

// Opened directly, outside the class dashboard, it has no student to answer for.
const StandaloneReportItem = () => (
  <div className="markov-interactive">
    <p className="standalone-note">
      This is the Markov interactive&apos;s report item. It shows a student&apos;s answer in the class dashboard.
    </p>
  </div>
);

const root = createRoot(document.getElementById("app") as HTMLElement);
root.render(inIframe() ? <ReportItem /> : <StandaloneReportItem />);
