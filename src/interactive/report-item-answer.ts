import type { IReportItemAnswerItem } from "@concord-consortium/lara-interactive-api";

export const placeholderReportHtml =
  "<div class=\"tall\"><p>This student opened the Markov interactive.</p>" +
  "<p>A summary of their work comes in a later version.</p></div>" +
  "<div class=\"wide\"><p>This student opened the Markov interactive. " +
  "A summary of their work comes in a later version.</p></div>";

// The grid draws its own answered icon and reads only a score from a compact answer, so a compact answer has no items.
// A full answer's links item is what makes the dashboard offer "Open in new tab", the student's answer on a page of
// its own with the answer history; "View Work" would only repeat the placeholder inline, so it is hidden.
export const reportItemAnswerItems = (itemsType: "fullAnswer" | "compactAnswer"): IReportItemAnswerItem[] =>
  itemsType === "compactAnswer"
    ? []
    : [{ type: "links", hideViewInline: true }, { type: "html", html: placeholderReportHtml }];
