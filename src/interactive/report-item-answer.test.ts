import { reportItemAnswerItems } from "./report-item-answer";

describe("reportItemAnswerItems", () => {
  it("answers a full answer with a link to its own page, and the placeholder html in the tall and wide blocks", () => {
    expect(reportItemAnswerItems("fullAnswer")).toEqual([{ type: "links", hideViewInline: true }, {
      type: "html",
      html: "<div class=\"tall\"><p>This student opened the Markov interactive.</p>" +
        "<p>A summary of their work comes in a later version.</p></div>" +
        "<div class=\"wide\"><p>This student opened the Markov interactive. " +
        "A summary of their work comes in a later version.</p></div>"
    }]);
  });

  it("answers a compact answer with no items", () => {
    expect(reportItemAnswerItems("compactAnswer")).toEqual([]);
  });
});
