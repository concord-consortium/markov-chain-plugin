# Cypress Code Coverage

Code coverage of the Cypress tests is off by default. More information about the libraries involved is at https://github.com/cypress-io/code-coverage.

## How it is wired

- **Instrumenting the code.** When the `CODE_COVERAGE` environment variable is set, `webpack.config.js` adds a rule that runs `@jsdevtools/coverage-istanbul-loader` on `.ts`, `.tsx`, `.js` and `.jsx` files outside `node_modules`, with `enforce: 'post'` so it runs after `ts-loader`. To check it: run `CODE_COVERAGE=true npm start`, open the plugin, and look for `window.__coverage__` in the browser console.
- **Collecting it.** `cypress/support/e2e.js` imports `@cypress/code-coverage/support`, which reads `window.__coverage__` after each test and sends it to Cypress's node process with `cy.task`.
- **Saving it.** `cypress.config.ts` registers `@cypress/code-coverage/task` in `setupNodeEvents`. It merges what each test sends into `.nyc_output/out.json` and, when the tests finish, has nyc write the report.
- **The report.** The `nyc` section of `package.json` writes it to `coverage-cypress/`, apart from the Jest coverage in `coverage/`, and extends `@istanbuljs/nyc-config-typescript` so nyc reads the TypeScript source maps.

## Turning it on

`cypress.config.ts` sets `expose: { coverage: false }`. `@cypress/code-coverage` 4 reads `Cypress.expose("coverage")`, so `env` and `--env` have no effect on it. To collect coverage, run `CODE_COVERAGE=true npm start`, then `npm run test:coverage:cypress:open` (which passes `--expose coverage=true`), or `npx cypress run --expose coverage=true`. With coverage on, each test logs extra `task` commands as the support module talks to the task.

## What it measures

The support module reads `window.__coverage__` from Cypress's application window. The tests load the plugin inside the fake CODAP page's iframe, so that window is the fake page's: the report measures only the fake page. Every other source file in the repo, the specs and the plugin's own code among them, is listed with no statements counted, because the `nyc` section sets `all: true`.
