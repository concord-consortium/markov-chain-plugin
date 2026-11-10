import { reportItemAnswerItems } from "./report-item-answer";
import { reportSummaryHtml } from "./report-summary";

describe("reportItemAnswerItems", () => {
  const state = { version: 1, orderMatters: false };
  const authored = { startingText: "the cat" };

  it("answers a full answer with only the new tab link, and the summary of both states it is given", () => {
    expect(reportItemAnswerItems("fullAnswer", state, authored)).toEqual([
      { type: "links", hideViewInline: true }, { type: "html", html: reportSummaryHtml(state, authored) }
    ]);
  });

  it("answers a compact answer with no items", () => {
    expect(reportItemAnswerItems("compactAnswer", state, authored)).toEqual([]);
  });
});
