const frameBody = (title: string) =>
  cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body));

// its() re-queries, so this keeps reading the frame after the runtime restarts and reloads it
const frameText = (title: string) => cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body.innerText");

// the width the running interactive lays out in, which a scrollbar in its frame would narrow
const runtimeFrameWidth = () => {
  frameBody("Interactive").find(".runtime-placeholder");
  return cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument.documentElement.clientWidth");
};

// the Open button, whose href is the standalone link
const standaloneLink = () => cy.get(".demo-standalone a");

// iframe-phone posts an object, or its JSON where a browser can only post text
const messageOf = (data: unknown) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
};

// each setting the runtime's placeholder lists in a document, as [label, value] pairs
const listedIn = (doc: Document) => [...doc.querySelectorAll(".runtime-placeholder dt")]
  .map(term => [term.textContent, term.nextElementSibling?.textContent]);

describe("the interactive's demo page", () => {
  it("shows the runtime at a full-width item's width in the Standard layout", () => {
    cy.visit("/demo.html");
    cy.get("input[value=\"1100\"]").should("be.checked");
    runtimeFrameWidth().should("equal", 1044);
  });

  it("opens at the width its link names, and puts a chosen width in the link", () => {
    cy.visit("/demo.html?width=960");
    cy.get("input[value=\"960\"]").should("be.checked");
    runtimeFrameWidth().should("equal", 904);
    cy.contains("label", "Responsive").click();
    cy.location("search").should("equal", "?width=responsive");
    cy.get(".demo-runtime-frame").invoke("width").then(areaWidth => {
      runtimeFrameWidth().should("equal", areaWidth);
    });
  });

  it("restarts the runtime with each authoring change, keeping its interactive state", () => {
    const savedStates: unknown[] = [];
    cy.visit("/demo.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        const message = messageOf(event.data);
        if (message?.type === "interactiveState") {
          savedStates.push(message.content);
        }
      })
    });
    frameText("Interactive").should("contain", "are the same word");
    // the first runtime saves a state, after the library's 2 second pause
    cy.wrap(savedStates, { timeout: 5000 }).should("have.length", 1);
    frameBody("Authoring").find("#capitalization").select("asTyped");
    frameText("Interactive").should("contain", "are different words").and("not.contain", "are the same word");
    // started with that state, the restarted runtime has nothing to save
    cy.wait(2500);
    cy.wrap(savedStates).should("deep.equal", [{ version: 1 }]);
  });

  it("links to the interactive standalone with the settings that differ from the defaults", () => {
    cy.visit("/demo.html?width=960");
    cy.title().should("equal", "Demo and Standalone Authoring");
    cy.get("h1").should("have.text", "Demo and Standalone Authoring");
    cy.location("origin").then(origin => {
      const startingText = "startingText=the+cat+sat+on+the+mat.+the+cat+ran.";
      standaloneLink().should("have.attr", "href", `${origin}/interactive.html?${startingText}`);
      frameBody("Authoring").find("#capitalization").select("asTyped");
      standaloneLink().should("have.attr", "href", `${origin}/interactive.html?capitalization=asTyped&${startingText}`);
    });
    cy.get("header .demo-standalone").find("button, a").should("have.length", 2).each(control => {
      expect(control).to.have.attr("aria-describedby", "demo-standalone-warning");
      expect(control.attr("title")).to.contain("Use this link only outside the Activity Player");
    });
    cy.get("#demo-standalone-warning").should("contain.text", "Use this link only outside the Activity Player");
    cy.get(".demo-standalone button").should("have.text", "Copy standalone link");
    standaloneLink().should("have.text", "Open standalone link").and("have.attr", "target", "_blank");
    cy.get(".demo-standalone-long").should("not.exist");
  });

  it("copies the link, and says so for 2 seconds", () => {
    cy.visit("/demo.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").as("writeText").resolves());
    cy.clock();
    cy.get(".demo-standalone button").click();
    standaloneLink().invoke("attr", "href").then(link => cy.get("@writeText").should("have.been.calledOnceWith", link));
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.tick(1900);
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.tick(100);
    cy.get(".demo-standalone button").should("have.text", "Copy standalone link");
  });

  it("says when the link is long", () => {
    cy.visit("/demo.html");
    // val() sets the text without the form noticing, and the typed letter makes the form save all of it
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(1000)).type("b");
    standaloneLink().invoke("attr", "href").its("length").should("be.greaterThan", 2000);
    cy.get(".demo-standalone-long").should("contain.text", "longer than 2,000 characters");
  });

  // Electron's window.open gives Cypress no window; the CI job runs Chrome
  it("opens its link standalone with the settings the runtime lists", { browser: "chrome" }, () => {
    cy.visit("/demo.html");
    frameBody("Authoring").find("#usableModes").select("Data");
    frameBody("Authoring").find("#pane-inspect").uncheck();
    frameBody("Authoring").find("#capitalization").select("asTyped");
    frameText("Interactive").should("contain", "are different words");
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").then(runtime => {
      const hosted = listedIn(runtime);
      // a window of its own, not in a frame, as a link from a collection page opens it
      standaloneLink().invoke("attr", "href").then(link => {
        cy.window().then(win => win.open(String(link))).as("standalone");
      });
      cy.get<Window>("@standalone").its("document.body.innerText").should("contain", "coming soon")
        .and("contain", "the settings come from this page's link");
      cy.get<Window>("@standalone").then(standalone => {
        expect(listedIn(standalone.document)).to.deep.equal(hosted);
        standalone.close();
      });
    });
  });

  it("shows the report item's full answer", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "This student opened the Markov interactive.");
  });
});
