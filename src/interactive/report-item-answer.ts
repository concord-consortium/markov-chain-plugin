import type { IReportItemAnswerItem } from "@concord-consortium/lara-interactive-api";
import { reportSummaryHtml } from "./report-summary";

// The grid draws its own answered icon and reads only a score from a compact answer, so a compact answer has no items.
// hideViewInline leaves "Open in new tab" as the only link; the summary is what changes as the scrubber moves.
export const reportItemAnswerItems = (itemsType: "fullAnswer" | "compactAnswer", interactiveState: unknown,
  authoredState: unknown): IReportItemAnswerItem[] =>
  itemsType === "compactAnswer"
    ? []
    : [
      { type: "links", hideViewInline: true },
      { type: "html", html: reportSummaryHtml(interactiveState, authoredState) },
    ];
