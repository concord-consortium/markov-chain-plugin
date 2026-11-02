// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// add code coverage support
import "@cypress/code-coverage/support";
import "./commands";
import "./fake-ap-commands";

// errors thrown in a frame don't reach Cypress, so each test checks the ones the fake CODAP or Activity Player
// page kept, and the requests the fake CODAP page had no reply for, which would otherwise pass unnoticed
afterEach(() => {
  cy.window().then(win => {
    if (win.fakeCodap) {
      expect(win.fakeCodap.errors, "errors in the plugin").to.deep.equal([]);
      expect(win.fakeCodap.unhandled, "requests the fake CODAP page does not handle").to.deep.equal([]);
    }
    if (win.fakeAp) {
      expect(win.fakeAp.errors, "errors in the interactive").to.deep.equal([]);
    }
  });
});
