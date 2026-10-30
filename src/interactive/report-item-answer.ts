import type { IReportItemAnswerItem } from "@concord-consortium/lara-interactive-api";

// The grid draws its own answered icon and reads only a score from a compact answer, so a compact answer has no items.
export const placeholderReportHtml =
  "<div class=\"tall\"><p>This student opened the Markov interactive.</p>" +
  "<p>A summary of their work comes in a later version.</p></div>" +
  "<div class=\"wide\"><p>This student opened the Markov interactive. " +
  "A summary of their work comes in a later version.</p></div>";

export const reportItemAnswerItems = (itemsType: "fullAnswer" | "compactAnswer"): IReportItemAnswerItem[] =>
  itemsType === "compactAnswer" ? [] : [{ type: "html", html: placeholderReportHtml }];
