import { defineConfig } from 'cypress'

export default defineConfig({
  video: false,
  // Cypress rewrites "framebusting" checks such as window.parent === window, which iframe-phone uses
  // to find CODAP, so the plugin would never connect to the fake CODAP page
  modifyObstructiveCode: false,
  defaultCommandTimeout: 8000,
  expose: {
    coverage: false,
  },
  e2e: {
    setupNodeEvents(on, config) {
      return require("@cypress/code-coverage/task")(on, config);
    },
    baseUrl: 'http://localhost:8080',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}',
  },
})
