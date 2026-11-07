const drawing = {
  nodes: [{ id: "n1", label: "<b>Hot</b>", value: 1 }, { id: "n2", label: "Cold", value: 1 }],
  edges: [{ from: "n1", to: "n2", value: 1 }],
};

describe("the interactive's report item", () => {
  beforeEach(() => {
    cy.startInteractive({
      mode: "reportItem", interactiveState: { version: 1, input: { text: "the cat sat" } },
      authoredState: { startingText: "authored" },
    });
    cy.interactiveMessages("reportItemClientReady").should("deep.equal", [{ compactAnswerReportItemsAvailable: true }]);
    cy.interactiveMessages("height").should("have.length.greaterThan", 0);
  });

  it("answers a full answer with the summary of the state in the request, and only the new tab link", () => {
    cy.requestReportItemAnswer("fullAnswer").then(answer => {
      expect(answer).to.include({ version: "2.1.0", platformUserId: "student1", itemsType: "fullAnswer" });
      expect(answer.items).to.have.length(2);
      expect(answer.items[0]).to.deep.equal({ type: "links", hideViewInline: true });
      expect(answer.items[1].html).to.contain("The student has saved work in the interactive.");
      expect(answer.items[1].html).to.contain("Data: 3 words, 3 states");
    });
  });

  it("answers each request from its own state, as a scrubber step does", () => {
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1, input: { text: "the cat" } })
      .then(answer => expect(answer.items[1].html).to.contain("Data: 2 words, 2 states"));
    const draw = { drawing, generator: { startingState: "n1" } };
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1, mode: "draw", draw }).then(answer => {
      expect(answer.items[1].html).to.contain("Drawing: 2 states, 1 arrow");
      expect(answer.items[1].html).to.contain("start &lt;b&gt;Hot&lt;/b&gt;");
    });
  });

  it("reads the authored state in the request", () => {
    cy.requestReportItemAnswer("fullAnswer", "student1", { version: 1 })
      .then(answer => expect(answer.items[1].html).to.contain("Data: 1 word, 1 state"));
  });

  it("answers a compact answer with no items, for the student the request names", () => {
    cy.requestReportItemAnswer("compactAnswer", "student2")
      .should("deep.include", { platformUserId: "student2", itemsType: "compactAnswer", items: [] });
  });
});
