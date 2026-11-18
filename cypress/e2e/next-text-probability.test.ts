import { frameBody, messageOf } from "../support/demo-page";

const year = new Date().getFullYear();

// the Open button, whose href is the standalone link
const standaloneLink = () => cy.get(".demo-standalone a");

// the workspace's panes in a document, by their titles
const panesIn = (doc: Document) => [...doc.querySelectorAll(".markov-workspace section.pane > .pane-header h2")]
  .map(title => title.textContent);

const openAndCloseAbout = () => {
  cy.contains("footer button", "About").focus();
  cy.focused().click();
  cy.get("dialog").should("be.visible").and("have.focus")
    .and("contain.text", "Next Text Probability is free, open-source software.")
    .should($dialog => expect($dialog[0].matches(":modal")).to.equal(true));
  cy.get("dialog").trigger("keydown", { key: "Escape" });
  cy.get("dialog").should("not.exist");
  cy.focused().should("have.text", "About");
};

describe("the Next Text Probability pages", () => {
  it("shows the interactive with its header, footer and About", () => {
    cy.visit("/next-text-probability/index.html");
    cy.title().should("equal", "Next Text Probability");
    cy.get("header h1").should("have.text", "Next Text Probability");
    cy.get("main").contains("h2", "Graph").should("be.visible");
    cy.get("footer").should("contain.text", `© ${year} The Concord Consortium, Inc.`)
      .find("svg[aria-hidden='true']").should("be.visible");
    cy.get("footer").should("have.css", "border-top-width", "1px")
      .and("have.css", "border-top-color", "rgb(199, 199, 199)");
    openAndCloseAbout();
  });

  it("authors the interactive with its header, footer and About", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.title().should("equal", "Next Text Probability | Authoring");
    cy.get("h1").should("have.text", "Next Text Probability | Authoring").and("have.css", "font-size", "18px");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    ["Authoring", "Interactive"].forEach(title => frameBody(title).find("footer, h1").should("not.exist"));
    cy.get("footer").should("contain.text", `© ${year} The Concord Consortium, Inc.`)
      .find("a").should("have.attr", "href", "https://concord.org/terms-of-use/");
    cy.get("footer svg").should("not.exist");
    cy.get("footer").should("have.css", "border-top-width", "1px")
      .and("have.css", "border-top-color", "rgb(199, 199, 199)");
    cy.get("main").should("have.class", "demo-columns");
    cy.get("body").should("not.contain.text", "Activity Player");
    cy.contains("footer button", "About").click();
    // the demo page's own heading styles stay off the dialog's title
    cy.get("dialog h2").should("have.css", "margin-top", "0px");
    cy.get("dialog").trigger("keydown", { key: "Escape" });
    openAndCloseAbout();
  });

  it("previews the interactive at full width, with none of the Activity Player's views", () => {
    let saved = false;
    cy.visit("/next-text-probability/authoring.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        saved ||= messageOf(event.data)?.type === "interactiveState";
      })
    });
    cy.get(".demo-widths").should("not.exist");
    cy.get("iframe[title='Report item']").should("not.exist");
    cy.get("iframe[title='Interactive']").invoke("outerWidth")
      .then(width => cy.get(".demo-runtime-frame").invoke("width").should("be.closeTo", width, 2));
    frameBody("Interactive").find(".workspace-body:not([hidden]) .probabilities-toggle").click();
    cy.wrap(null, { timeout: 5000 }).should(() => expect(saved).to.equal(true));
    cy.contains("h2", "Teacher's view").should("not.exist");
    cy.get("iframe[title=\"Teacher's view\"]").should("not.exist");
  });

  it("previews no Send to CODAP button, which the page its link opens can't show", () => {
    cy.visit("/next-text-probability/authoring.html");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    // marks the preview's document, so the check below waits for the one the new settings load
    cy.get("iframe[title='Interactive']").its("0.contentWindow")
      .then(win => { (win as Window & { stale?: boolean }).stale = true; });
    frameBody("Authoring").find("#button-sendToCodap").check();
    cy.get(".demo-standalone a").should("have.attr", "href").and("contain", "buttons.sendToCodap.available=true");
    cy.get("iframe[title='Interactive']").its("0.contentWindow.stale").should("not.exist");
    frameBody("Interactive").contains("h2", "Graph").should("be.visible");
    frameBody("Interactive").should("not.contain.text", "Send to CODAP");
  });
});

describe("the authoring page's standalone link", () => {
  it("links to the Next Text Probability page with the settings that differ from the defaults", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.location("origin").then(origin => {
      const startingText = "startingText=the+cat+sat+on+the+mat.+the+cat+ran.";
      standaloneLink().should("have.attr", "href", `${origin}/next-text-probability/index.html?${startingText}`);
      frameBody("Authoring").find("#capitalization").select("asTyped");
      standaloneLink().should("have.attr", "href",
        `${origin}/next-text-probability/index.html?capitalization=asTyped&${startingText}`);
    });
    cy.get("header .demo-standalone").find("button, a").should("have.length", 2).each(control => {
      expect(control).to.have.attr("aria-describedby", "demo-standalone-warning");
    });
    cy.get("#demo-standalone-warning").should("be.visible")
      .and("have.text", "Link to the interactive with these settings:");
    cy.get(".demo-standalone button").should("have.text", "Copy");
    standaloneLink().should("have.text", "Open (opens in a new tab)").and("have.attr", "target", "_blank");
    cy.get(".demo-standalone-long").should("not.exist");
  });

  it("copies the link, and says so for 2 seconds", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").as("writeText").resolves());
    // the result shows on a real animation frame, and only the 2 seconds are faked
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.get(".demo-standalone button").click();
    standaloneLink().invoke("attr", "href")
      .then(link => cy.get("@writeText").should("have.been.calledOnceWith", link));
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.get(".demo-standalone [role=status]").should("have.text", "Link copied");
    cy.tick(1900);
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.tick(100);
    cy.get(".demo-standalone button").should("have.text", "Copy");
    cy.get(".demo-standalone [role=status]").should("have.text", "");
  });

  it("announces a second copy that repeats the first", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").resolves());
    // each text the status shows in a rendered frame, in order: a screen reader sees only what a frame shows
    const announced: string[] = [];
    cy.window().then(win => {
      const sample = () => {
        const text = win.document.querySelector(".demo-standalone [role=status]")?.textContent ?? "";
        if (text !== (announced[announced.length - 1] ?? "")) {
          announced.push(text);
        }
        win.requestAnimationFrame(sample);
      };
      win.requestAnimationFrame(sample);
    });
    cy.get(".demo-standalone button").click();
    cy.get(".demo-standalone button").should("have.text", "Copied").click();
    cy.wrap(announced).should("deep.equal", ["Link copied", "", "Link copied"]);
  });

  it("says when the link couldn't be copied", () => {
    cy.visit("/next-text-probability/authoring.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").rejects(new Error("denied")));
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.get(".demo-standalone button").click();
    cy.get(".demo-standalone button").should("have.text", "Copy failed");
    cy.get(".demo-standalone [role=status]").should("have.text", "The link couldn't be copied");
    cy.tick(2000);
    cy.get(".demo-standalone button").should("have.text", "Copy");
  });

  it("says the link couldn't be copied where the browser has no clipboard", () => {
    cy.visit("/next-text-probability/authoring.html", {
      onBeforeLoad: win => Object.defineProperty(win.navigator, "clipboard", { value: undefined })
    });
    cy.get(".demo-standalone button").click();
    cy.get(".demo-standalone button").should("have.text", "Copy failed");
  });

  it("says when the link is long, in a header that keeps its height", () => {
    // narrow enough that the header's title would otherwise wrap
    cy.viewport(800, 660);
    cy.visit("/next-text-probability/authoring.html");
    // val() sets the text without the form noticing, and the typed letter makes the form save all of it
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(1000)).type("b");
    standaloneLink().invoke("attr", "href").its("length").should("be.greaterThan", 2000);
    cy.get(".demo-standalone-long-words").should("be.visible")
      .and("have.text", "Long link: some sites may cut it short").and("have.attr", "aria-hidden", "true");
    cy.get(".demo-standalone-long .demo-visually-hidden").should("contain.text", "longer than 2,000 characters");
    cy.get(".demo-standalone button").should("be.enabled");
    cy.get("header").invoke("outerHeight").should("equal", 44);
  });

  it("leaves a warning's words out of a narrow header, telling only a screen reader", () => {
    cy.viewport(700, 660);
    cy.visit("/next-text-probability/authoring.html");
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(1000)).type("b");
    cy.get(".demo-standalone-long .demo-visually-hidden").should("contain.text", "longer than 2,000 characters");
    cy.get(".demo-standalone-long-words").should("not.be.visible");
    cy.get("header").invoke("outerHeight").should("equal", 44);
  });

  it("offers no link the deployed site would refuse", () => {
    cy.viewport(800, 660);
    cy.visit("/next-text-probability/authoring.html");
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(4100)).type("b");
    cy.get(".demo-standalone-long-words").should("be.visible")
      .and("have.text", "Too long to open: shorten the starting text");
    cy.get(".demo-standalone-long .demo-visually-hidden").should("contain.text", "too long to open")
      .and("contain.text", "over 8,192 characters");
    cy.get("header").invoke("outerHeight").should("equal", 44);
    cy.get(".demo-standalone button").should("be.disabled");
    standaloneLink().should("have.attr", "aria-disabled", "true");
    standaloneLink().should("not.have.attr", "href");
  });

  // Electron's window.open gives Cypress no window; the CI job runs Chrome
  it("opens its link standalone with the panes the runtime shows", { browser: "chrome" }, () => {
    cy.visit("/next-text-probability/authoring.html");
    frameBody("Authoring").find("#usableModes").select("Data");
    frameBody("Authoring").find("#pane-inspect").uncheck();
    frameBody("Authoring").find("#pane-graph").uncheck();
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument")
      .should(doc => expect(panesIn(doc)).to.deep.equal(["Input", "Sequence Generator"]));
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").then(runtime => {
      const hosted = panesIn(runtime);
      // a window of its own, not in a frame, as a link from a collection page opens it
      standaloneLink().invoke("attr", "href").then(link => {
        cy.window().then(win => win.open(String(link))).as("standalone");
      });
      cy.get<Window>("@standalone").its("document.body.innerText")
        .should("contain", "Sequence Generator").and("not.contain", "Activity Player");
      cy.get<Window>("@standalone").its("document").should(doc => {
        expect(panesIn(doc)).to.deep.equal(hosted);
      });
      cy.get<Window>("@standalone").then(standalone => {
        standalone.close();
      });
    });
  });
});
