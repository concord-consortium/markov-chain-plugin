describe("Labels", () => {
  it("truncates a long label only once its font is down to the minimum", () => {
    cy.fixture("ela/9nsC6KpuDstv2N9eGndM.json").then(state => {
      cy.startPlugin({ savedState: state });
      cy.plugin().find("g.node text").should("have.length", state.nodes.length).then(texts => {
        const truncated = texts.toArray().filter(text => text.textContent!.endsWith("..."));
        expect(truncated.map(text => text.textContent)).to.include("appreci...");
        truncated.forEach(text => {
          expect(Number(text.getAttribute("font-size"))).to.be.within(9.0001, 10);
        });
      });
    });
  });

  it("draws an HTML-like value as text, and numbers as their digits", () => {
    const html = "<img src=x onerror=\"window.parent.labelScriptRan = true\">";
    cy.startPlugin({
      attribute: "Word",
      dataset: { name: "Words", collection: "Cases", attributes: { Word: [html, 10, "b", 2, html] } }
    });
    cy.plugin().find("g.node text").should("have.length", 4);
    cy.plugin().find("g.node text").first().invoke("text").should(text => {
      expect(text.endsWith("...")).to.equal(true);
      expect(html.startsWith(text.slice(0, -3))).to.equal(true);
    });
    // an injected image's onerror runs only once its request fails, which takes a few hundred ms at most
    cy.wait(1000);
    cy.window().its("labelScriptRan").should("be.undefined");
    cy.plugin().find("select").first().find("option").then(options => {
      expect(options.toArray().map(o => o.textContent)).to.deep.equal(["(any)", html, "2", "10", "b"]);
    });
  });
});
