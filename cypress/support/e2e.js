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

// errors thrown in the plugin's frame don't reach Cypress, so each test checks the ones the fake CODAP page kept
afterEach(() => {
  cy.window().then(win => {
    if (win.fakeCodap) {
      expect(win.fakeCodap.errors, "errors in the plugin").to.deep.equal([]);
    }
  });
});
