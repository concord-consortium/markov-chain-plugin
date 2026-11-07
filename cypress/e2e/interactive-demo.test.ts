const frameBody = (title: string) =>
  cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body").should("not.be.empty").then(body => cy.wrap(body));

// its() re-queries, so this keeps reading the frame after the runtime restarts and reloads it
const frameText = (title: string) => cy.get(`iframe[title="${title}"]`).its("0.contentDocument.body.innerText");

// the width the running interactive lays out in, which a scrollbar in its frame would narrow
const runtimeFrameWidth = () => {
  frameBody("Interactive").find(".markov-workspace");
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

// opens the page and waits for a save that holds no input, so the runtime's text still follows the authoring form
const visitAndSave = () => {
  let saved = false;
  cy.visit("/demo.html", {
    onBeforeLoad: win => win.addEventListener("message", event => {
      saved ||= messageOf(event.data)?.type === "interactiveState";
    })
  });
  frameBody("Interactive").find(".workspace-body:not([hidden]) .probabilities-toggle").click();
  cy.wrap(null, { timeout: 5000 }).should(() => expect(saved).to.equal(true));
};

// the workspace's panes in a document, by their titles
const panesIn = (doc: Document) => [...doc.querySelectorAll(".markov-workspace section.pane > .pane-header h2")]
  .map(title => title.textContent);

// the graph's states in the running interactive; its() re-queries, so this keeps reading the frame after the runtime
// restarts and reloads it
const runtimeStatesShould = (expected: string[]) => cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument")
  .should(doc => expect([...doc.querySelectorAll("g.node text")].map(text => text.textContent).sort())
    .to.deep.equal(expected));

describe("the interactive's demo page", () => {
  it("shows the runtime at a full-width item's width in the Standard layout", () => {
    cy.visit("/demo.html");
    cy.get("input[value=\"1100\"]").should("be.checked");
    runtimeFrameWidth().should("equal", 1044);
  });

  it("scrolls each column on its own, with the authoring form at LARA's authoring column's width", () => {
    // short enough that both columns are taller than the window
    cy.viewport(1400, 400);
    cy.visit("/demo.html");
    frameBody("Authoring").find("#startingText");
    cy.get("iframe[title=\"Authoring\"]").invoke("outerWidth").should("equal", 435);
    // taller than the window once the form has reported its height
    cy.get(".demo-authoring").should(column => expect(column[0].scrollHeight).to.be.greaterThan(column[0].clientHeight))
      .scrollTo("bottom");
    cy.get(".demo-authoring").should(column => expect(column[0].scrollWidth).to.equal(column[0].clientWidth));
    cy.get(".demo-authoring").invoke("scrollTop").should("be.greaterThan", 0);
    cy.get(".demo-runtime").should(column => expect(column[0].scrollHeight).to.be.greaterThan(column[0].clientHeight))
      .scrollTo("bottom");
    cy.get(".demo-runtime").invoke("scrollTop").should("be.greaterThan", 0);
    cy.document().should(doc => expect(doc.documentElement.scrollHeight).to.equal(doc.documentElement.clientHeight));
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

  it("restarts the runtime with each authoring change, saving nothing with nothing done", () => {
    const savedStates: unknown[] = [];
    cy.visit("/demo.html", {
      onBeforeLoad: win => win.addEventListener("message", event => {
        const message = messageOf(event.data);
        if (message?.type === "interactiveState") {
          savedStates.push(message.content);
        }
      })
    });
    // the demo's own text has no capital letter
    frameBody("Authoring").find("#startingText").clear().type("The cat. the cat");
    runtimeStatesShould([".", "cat", "the"]);
    frameBody("Authoring").find("#capitalization").select("asTyped");
    runtimeStatesShould([".", "The", "cat", "the"]);
    // past the library's 2 second pause
    cy.wait(2500);
    cy.wrap(savedStates).should("have.length", 0);
  });

  it("shows an authoring change after a student's save", () => {
    visitAndSave();
    frameBody("Authoring").find("#startingMode").select("draw");
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").should((doc: Document) => {
      const shown = doc.querySelector(".workspace-body:not([hidden]) .mode-switch input:checked");
      expect(shown?.closest("label")?.textContent).to.contain("Draw");
    });
  });

  describe("with words typed in the running interactive", () => {
    const textBoxIn = (doc: Document) => doc.querySelector<HTMLTextAreaElement>("textarea[aria-label='Your text']");
    const runtimeTextShould = (expected: string) => cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument")
      .should((doc: Document) => expect(textBoxIn(doc)?.value).to.equal(expected));

    beforeEach(() => {
      const savedTexts: unknown[] = [];
      cy.visit("/demo.html", {
        onBeforeLoad: win => win.addEventListener("message", event => {
          const message = messageOf(event.data);
          if (message?.type === "interactiveState" && message.content?.input) {
            savedTexts.push(message.content.input.text);
          }
        })
      });
      frameBody("Interactive").find("textarea[aria-label='Your text']").type(" dog ");
      // the library posts a state 2 seconds after the last save
      cy.wrap(savedTexts, { timeout: 5000 }).should(texts =>
        expect(texts[texts.length - 1]).to.equal("the cat sat on the mat. the cat ran. dog "));
    });

    it("starts the runtime over from a changed starting text", () => {
      frameBody("Authoring").find("#startingText").clear().type("a new start");
      runtimeTextShould("a new start");
      runtimeStatesShould(["a", "new", "start"]);
    });

    it("starts the runtime over when the old runtime saves as its restart begins", () => {
      const restartDelay = 500;
      cy.window().then(win => {
        const frame = win.document.querySelector<HTMLIFrameElement>("iframe[title=\"Interactive\"]")!;
        const lateSave = JSON.stringify({ type: "interactiveState", content: {
          version: 1, input: { text: "the old input" } } });
        const setTimeoutOf = win.setTimeout;
        // the save lands as the restart's timer ends, ahead of the render that disconnects the old runtime
        cy.stub(win, "setTimeout").callsFake((run: () => void, delay?: number) => setTimeoutOf(() => {
          run();
          if (delay === restartDelay) {
            win.dispatchEvent(new MessageEvent("message", {
              data: lateSave, origin: win.location.origin, source: frame.contentWindow
            }));
          }
        }, delay));
      });
      frameBody("Authoring").find("#startingText").clear().type("a new start");
      runtimeTextShould("a new start");
      runtimeStatesShould(["a", "new", "start"]);
    });

    it("keeps what was typed when another setting changes", () => {
      frameBody("Authoring").find("#capitalization").select("asTyped");
      cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument")
        .should(doc => expect(doc.querySelector(".setting-switch [role='switch']")?.getAttribute("aria-checked"))
          .to.equal("true"));
      runtimeTextShould("the cat sat on the mat. the cat ran. dog ");
    });
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
    });
    cy.get("#demo-standalone-warning").should("be.visible")
      .and("have.text", "Standalone link to use outside Activity Player:");
    cy.get(".demo-standalone button").should("have.text", "Copy");
    standaloneLink().should("have.text", "Open").and("have.attr", "target", "_blank");
    cy.get(".demo-standalone-long").should("not.exist");
  });

  it("copies the link, and says so for 2 seconds", () => {
    cy.visit("/demo.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").as("writeText").resolves());
    // the result shows on a real animation frame, and only the 2 seconds are faked
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.get(".demo-standalone button").click();
    standaloneLink().invoke("attr", "href").then(link => cy.get("@writeText").should("have.been.calledOnceWith", link));
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.get(".demo-standalone [role=status]").should("have.text", "Standalone link copied");
    cy.tick(1900);
    cy.get(".demo-standalone button").should("have.text", "Copied");
    cy.tick(100);
    cy.get(".demo-standalone button").should("have.text", "Copy");
    cy.get(".demo-standalone [role=status]").should("have.text", "");
  });

  it("announces a second copy that repeats the first", () => {
    cy.visit("/demo.html");
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
    cy.wrap(announced).should("deep.equal", ["Standalone link copied", "", "Standalone link copied"]);
  });

  it("says when the link couldn't be copied", () => {
    cy.visit("/demo.html");
    cy.window().then(win => cy.stub(win.navigator.clipboard, "writeText").rejects(new Error("denied")));
    cy.clock(0, ["setTimeout", "clearTimeout"]);
    cy.get(".demo-standalone button").click();
    cy.get(".demo-standalone button").should("have.text", "Copy failed");
    cy.get(".demo-standalone [role=status]").should("have.text", "The standalone link couldn't be copied");
    cy.tick(2000);
    cy.get(".demo-standalone button").should("have.text", "Copy");
  });

  it("says the link couldn't be copied where the browser has no clipboard", () => {
    cy.visit("/demo.html", {
      onBeforeLoad: win => Object.defineProperty(win.navigator, "clipboard", { value: undefined })
    });
    cy.get(".demo-standalone button").click();
    cy.get(".demo-standalone button").should("have.text", "Copy failed");
  });

  it("says when the link is long", () => {
    cy.visit("/demo.html");
    // val() sets the text without the form noticing, and the typed letter makes the form save all of it
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(1000)).type("b");
    standaloneLink().invoke("attr", "href").its("length").should("be.greaterThan", 2000);
    cy.get(".demo-standalone-long").should("contain.text", "longer than 2,000 characters");
    cy.get(".demo-standalone button").should("be.enabled");
  });

  it("offers no link the deployed site would refuse", () => {
    cy.visit("/demo.html");
    frameBody("Authoring").find("#startingText").invoke("val", "a ".repeat(4100)).type("b");
    cy.get(".demo-standalone-long").should("contain.text", "too long to open")
      .and("contain.text", "over 8,192 characters");
    cy.get(".demo-standalone button").should("be.disabled");
    standaloneLink().should("have.attr", "aria-disabled", "true");
    standaloneLink().should("not.have.attr", "href");
  });

  // Electron's window.open gives Cypress no window; the CI job runs Chrome
  it("opens its link standalone with the panes the runtime shows", { browser: "chrome" }, () => {
    cy.visit("/demo.html");
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
        .should("contain", "the settings come from this page's link");
      cy.get<Window>("@standalone").its("document").should(doc => {
        expect(panesIn(doc)).to.deep.equal(hosted);
      });
      cy.get<Window>("@standalone").then(standalone => {
        standalone.close();
      });
    });
  });

  it("shows the report item's full answer, of the authored page and then of a save", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "The student has saved work in the interactive.")
      .and("contain", "Data: 11 words, 7 states");
    cy.get<HTMLIFrameElement>("iframe[title='Report item']").should(([frame]) => {
      expect(frame.contentDocument?.documentElement.scrollHeight).to.equal(frame.clientHeight);
    });
    frameBody("Interactive").find("textarea[aria-label='Your text']").type(" the dog").blur({ force: true });
    frameText("Report item").should("contain", "Data: 13 words, 8 states");
  });

  it("summarizes the authored page as it changes, before any save", () => {
    cy.visit("/demo.html");
    frameText("Report item").should("contain", "Data: 11 words, 7 states");
    frameBody("Authoring").find("#startingText").clear().type("a b");
    frameText("Report item").should("contain", "Data: 2 words, 2 states");
  });

  it("summarizes a save with the authored state it was made under", () => {
    visitAndSave();
    frameBody("Authoring").find("#startingText").clear().type("a b");
    cy.get("iframe[title=\"Interactive\"]").its("0.contentDocument").should((doc: Document) => {
      expect(doc.querySelector<HTMLTextAreaElement>("textarea[aria-label='Your text']")?.value).to.equal("a b");
    });
    frameText("Report item").should("contain", "Data: 11 words, 7 states");
  });

  it("shows the teacher's view of the runtime's last save, starting it again with each", () => {
    cy.visit("/demo.html");
    cy.get("iframe[title=\"Teacher's view\"]").should("not.exist");
    const typeInRuntime = (text: string) =>
      frameBody("Interactive").find("textarea[aria-label='Your text']").type(text).blur({ force: true });
    const teachersText = (expected: string) =>
      cy.get("iframe[title=\"Teacher's view\"]").its("0.contentDocument").should((doc: Document) => {
        expect(doc.querySelector<HTMLTextAreaElement>("textarea[aria-label='Your text']")?.value).to.equal(expected);
      });
    typeInRuntime(" dog");
    teachersText("the cat sat on the mat. the cat ran. dog");
    frameText("Teacher's view").should("contain", "This is a student's saved work. It can't be changed here.");
    typeInRuntime(" fox");
    teachersText("the cat sat on the mat. the cat ran. dog fox");
  });

  it("starts the teacher's view under the authored state of the save, at the page width chosen", () => {
    cy.visit("/demo.html?width=960");
    frameBody("Authoring").find("#startingText").clear().type("a new start");
    runtimeStatesShould(["a", "new", "start"]);
    frameBody("Interactive").find(".workspace-body:not([hidden]) .probabilities-toggle").click();
    cy.get("iframe[title=\"Teacher's view\"]").its("0.contentDocument").should((doc: Document) => {
      expect(doc.querySelector<HTMLTextAreaElement>("textarea[aria-label='Your text']")?.value).to.equal("a new start");
      expect(doc.documentElement.clientWidth).to.equal(904);
    });
  });
});
