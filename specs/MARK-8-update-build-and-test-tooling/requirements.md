# Update the Markov plugin's build and test tooling

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-8
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Bring the plugin's build and test tooling (TypeScript, Jest, Cypress, webpack and its loaders, the GitHub Actions it runs in CI) up to current versions and pin the Node version, so the build keeps working and the unit and rendering tests that follow are written once on current tooling. The plugin's behavior does not change.

## Project Owner Overview

The plugin's development tools were last updated in 2022. Nothing is visibly broken yet, but the gap keeps growing, CI runs on GitHub Action versions GitHub has deprecated, and the next stories in this stream (unit tests in MARK-10, rendering tests in MARK-11) would otherwise be written on 2022 tooling and then migrated. This story updates those tools in one place, with no change to what students and teachers see.

It deliberately leaves two neighboring areas alone: the code style checker (ESLint and its plugins), which MARK-9 updates, and React with the other libraries the plugin ships, which MARK-12 updates.

## Background

MARK-8 is the base of a stack in this repo: MARK-8, then MARK-9 (code style checker), MARK-10 (unit tests), MARK-11 (rendering tests in CI) and MARK-12 (React and runtime libraries). Scope comes from the Jira story and section D1 of the stream's `dev-stories.md`, checked here against master at v0.5.0.

What the repo has today (versions installed by `npm ci` from the committed lockfile):

| Area | Packages (installed) | Latest on npm, 2026-10-26 |
|---|---|---|
| TypeScript | `typescript` 4.8.3, `ts-loader` 9.3.1 | 7.0.2 (6.0.3 is the last 6.x), 9.6.2 |
| Jest | `jest` 28.1.3, `ts-jest` 28.0.8, `jest-environment-jsdom` 28.1.3, `@types/jest` 28.1.8, `@testing-library/jest-dom` 5.16.5 | 30.5.2, 29.4.15, 30.5.2, 30.0.0, 7.0.1 (6.10.0 last 6.x) |
| Cypress | `cypress` 10.8.0, `@cypress/code-coverage` 3.10.0 | 16.2.0, 4.0.3 |
| webpack | `webpack` 5.74.0, `webpack-cli` 4.10.0, `webpack-dev-server` 4.11.0 | 5.112.2, 7.2.3, 6.1.0 |
| Loaders and plugins | `css-loader` 6, `style-loader` 3, `postcss-loader` 7, `sass-loader` 13, `sass` 1.54, `@svgr/webpack` 6, `html-webpack-plugin` 5.5, `mini-css-extract-plugin` 2.6 | 7, 4, 8, 17, 1.106, 8, 5.6, 2.10 |
| Lint (MARK-9) | `eslint` 8.23, `@typescript-eslint/*` 5.37, `eslint-webpack-plugin` 3.2, plugins | ESLint 10, typescript-eslint 8.72 |
| React (MARK-12) | `react` 17, `@testing-library/react` 12.1.5, `@types/react` 17 | |

Measured on master with Node 22 (`npm ci`, then each command):

- `npm run build` passes (it runs `lint:build`, then webpack) with 21 `no-console` warnings.
- `npm run lint` passes with no problems. `npx tsc --noEmit -p .` passes.
- `npm run lint:style` **fails on master** with 212 `object-curly-spacing` and similar errors. That is pre-existing and belongs to MARK-9.
- `npm test` exits 1 because there are no tests. A throwaway test that imports a component fails on master too, because the Jest `moduleNameMapper` maps `.css|less|sass` but not `.scss`, which every component imports.
- `npm run start:secure:no-certs` fails on master without `~/.localhost-ssl` certificate files (`PEM routines::no start line`), because the webpack config always names those files; with the files present it behaves the same as `start:secure`.
- The one Cypress spec is a template leftover that fails (MARK-11 replaces it).
- The GitHub repo has no Actions runs on record, so the first push of this branch is also the first evidence CI works.

Corrections to the Jira and D1 technical details, found by checking them against the repo and npm:

- **"webpack-dev-server 5 drops `--no-https`"**: true, and current is 6. The change is wider than the `start` scripts: the `devServer.https` key in `webpack.config.js` is rejected outright by dev-server 5 and 6 (`options has an unknown property 'https'`), so the config moves to `devServer.server`, and `start` becomes `--server-type http`.
- **`@testing-library/react` 12**: listed with the tooling, but 13 and later require React 18, so it moves with React in MARK-12. `@testing-library/jest-dom` 6.10 and 7 also declare a peer on `@testing-library/dom` 10, which React Testing Library 12 does not use.
- **"`s3-deploy-action@v1` already runs on `node20`"**: true (v1.3.0, `using: 'node20'`). Node 20 reached end of life in April 2026, so it is not "current", but the action is not ours to change; MARK-6 owns the deploy pipeline and the first push shows whether it still runs.
- **TypeScript**: "current" cannot mean 7.0. `ts-jest` 29 accepts `typescript >=4.3 <7` and typescript-eslint 8 accepts `<6.1.0`, so 6.0 is the newest TypeScript the rest of the toolchain accepts.

## Requirements

### Node

- R1. A `.nvmrc` at the repo root pins Node 24 (the current LTS line, supported until April 2028). Every updated tool supports it; the binding minimums are `webpack-dev-server` 6 (`>= 22.15.0`), `sass-loader` 17 (`>= 22.11.0`) and `cypress` 16 (`^22 || ^24 || >=26`).
- R2. CI reads the Node version from `.nvmrc` rather than repeating it.

### TypeScript

- R3. `typescript` is on 6.0 (`~6.0.3`).
- R4. `tsconfig.json` changes only as TypeScript 6 requires: `moduleResolution` moves from the deprecated `node` (an error in 6.0) to `bundler`, and the unused `outDir` is removed (with it set, TypeScript 6 requires `rootDir`, and `ts-jest` warns about files outside it). `src/global.d.ts` declares `*.scss` modules, since TypeScript 6 checks side-effect imports.
- R5. `npx tsc --noEmit -p .` passes.

### Jest

- R6. `jest` and `jest-environment-jsdom` are on 30, `ts-jest` on 29, `@types/jest` on 30, and `@testing-library/jest-dom` on the newest 6.x that does not require `@testing-library/dom` 10.
- R7. The Jest `moduleNameMapper` maps `.scss` imports to `identity-obj-proxy`, so a test that imports a component that imports `.scss` runs. Components that reach `nanoid` or `d3` (`App`, `Drawing`, `Graph`) still fail to load under Jest, as on master, because both packages ship only ES modules; MARK-10 picks the fix (Technical Notes).
- R8. A test that renders with React Testing Library 12 and uses a `jest-dom` matcher passes (verified with a throwaway test that is not committed; MARK-10 adds the real tests).

### Cypress

- R9. `cypress` is on 16 and `@cypress/code-coverage` on 4. `cypress run` loads `cypress.config.ts` and runs the existing spec, which still fails for its own reason (it expects "Hello World"; MARK-11 replaces it).

### webpack and the dev server

- R10. `webpack` is on the latest 5.x, `webpack-cli` on 7, `webpack-dev-server` on 6.
- R11. `devServer` uses the `server` option in place of `https`, with the same `~/.localhost-ssl` certificate files. `npm start` serves over HTTP and `npm run start:secure` over HTTPS, as today.
- R12. `start:secure:no-certs` is removed, with the README section that documents it, because it does not work on master without certificate files and does the same as `start:secure` with them.
- R13. The loaders and plugins move to their current majors: `css-loader` 7, `style-loader` 4, `postcss-loader` 8, `sass-loader` 17, `sass` 1.x latest, `mini-css-extract-plugin` and `html-webpack-plugin` latest within their majors, `@svgr/webpack` 8, `ts-loader` 9 latest, `autoprefixer` and `caniuse-lite` latest, `cross-env` 10.
- R14. The SVGR `svgo` options are updated for svgo 3, so that they still say what they do: `cleanupIDs` is renamed `cleanupIds` (svgo 3 ignores the old name and prints a warning for every SVG it processes), and the `prefixIds` override, which is not part of `preset-default` in svgo 3, is dropped. The build prints no svgo warnings. No SVG under `src/assets` references its own IDs (`url(#…)` or `href="#…"`), and IDs are stripped from the bundle on master as well, so the rename changes no output.
- R15. `CODE_COVERAGE=true` builds still instrument the bundle (`window.__coverage__` is present).

### Packages removed

- R16. `@testing-library/react-hooks` is removed (deprecated, unused).
- R17. Other devDependencies that nothing in the repo uses are removed rather than updated: `@cypress/webpack-preprocessor` (the Cypress config does not use it, and `@cypress/code-coverage` 4 brings its own), `file-loader` and `script-loader` (no rule uses them), `wait-on` (no script uses it), `ts-node` (Cypress 10 and 16 load the TypeScript config without it) and `istanbul-lib-coverage` (nothing imports it; `@cypress/code-coverage` depends on it directly, so it stays installed). Unused lint packages (`eslint-config-react`, `eslint-plugin-chai-friendly`) are left for MARK-9.

### What does not change

- R18. ESLint, every lint package and the lint config stay as they are: `eslint`, `@typescript-eslint/*`, `eslint-webpack-plugin`, `eslint-import-resolver-typescript`, all `eslint-plugin-*` and `eslint-config-*`, and the three `.eslintrc*.js` files (Doug's split, stream channel #1191).
- R19. React, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@types/d3` and every runtime dependency stay as they are (MARK-12).
- R20. The plugin's behavior and appearance do not change. Built output may differ only in ways that do not change what the browser renders: CSS vendor prefixes (from the newer `caniuse-lite` data), how Sass orders declarations that follow nested rules, and `index.html` minified harder by `html-webpack-plugin` 5.6 (unquoted attributes, no `<html>` tag; `index-top.html` still prefixes every asset with `DEPLOY_PATH`).

### CI

- R21. Both jobs in `.github/workflows/ci.yml` use `actions/checkout@v7` and `actions/setup-node@v7`, with `node-version-file: .nvmrc` and npm caching. `release.yml` uses no actions and is unchanged. `s3-deploy-action@v1` is unchanged.

### README

- R22. The README's Development section says the Node version comes from `.nvmrc` (`nvm use`), and drops the `start:secure:no-certs` steps. The Deployment and release text is left to MARK-6.

### Done when

- R23. On Node 24, from a clean `npm ci`: `npm run build` passes with the same 21 `no-console` warnings as master and no new warnings; `npm run lint` passes; `npx tsc --noEmit -p .` passes; a throwaway component test passes under Jest; `cypress run` launches and runs the spec; `npm run build:top-test` writes an `index-top.html` whose asset URLs carry the `DEPLOY_PATH` prefix; `npm start` and `npm run start:secure` serve the plugin.
- R24. The plugin, served by `npm start`, loads and works in CODAP (`https://codap.concord.org/app/?di=http://localhost:8080/`, which is v3): choosing Drawing mode, building a chain from text, drawing the graph, and generating a sequence, with no console errors. CODAP v2's `releases/latest` URL now redirects to the same v3 app; if MARK-5 finds that classes still run a v2 build, the same check is repeated there.
- R25. CI's build job passes on the first push, on the new action versions. The deploy job runs too; if it fails on AWS credentials or the deploy action rather than on the build, that is recorded for MARK-6, which owns the deploy pipeline and the secrets, and does not block MARK-8.

## Technical Notes

- Files touched: `package.json`, `package-lock.json`, `tsconfig.json`, `src/global.d.ts`, `webpack.config.js`, `.github/workflows/ci.yml`, `README.md`, and a new `.nvmrc`.
- Port 8080 is the dev server's default and is often taken by another local dev server; checks here used `--port 8091`. `cypress.config.ts` hardcodes `baseUrl: http://localhost:8080`, which MARK-11 can revisit.
- `npm ci` and `npm install` keep the lockfile at `lockfileVersion` 2 (checked with npm 11.9 on Node 24).
- `nanoid` 4 and `d3` 7 are ES-module-only, and Jest runs tests as CommonJS, so importing `App`, `Drawing` or `Graph` in a test fails with "Must use import to load ES Module". Two fixes were checked on the updated tooling, and both load `App` and `Graph`: a `transformIgnorePatterns` that lets `ts-jest` (the `js-with-ts` preset, with `allowJs`) compile `nanoid`, `d3`, `d3-*`, `internmap`, `delaunator` and `robust-predicates`; or running Jest with `NODE_OPTIONS=--experimental-vm-modules`, which on Node 24.9 and later lets Jest 30 `require()` ES modules natively (with an `ExperimentalWarning`). Which one fits depends on how MARK-10 structures its tests, so it is MARK-10's choice.
- `npm audit` (2026-10-27) reports 65 vulnerabilities on master (7 critical) and 11 after this story (none critical). Of the 11, `nanoid` is a runtime dependency (MARK-12), and the rest are transitive dependencies of the lint packages (MARK-9), `@testing-library/react` 12 (MARK-12) and `npm-run-all`; only the `ajv` 8.11 copies also reach a package updated here (`mini-css-extract-plugin`), and they are build-time schema validation with no untrusted input. `npm audit fix --package-lock-only` clears all but `nanoid`, but it also moves lint and React Testing Library transitives, which the targeted installs leave for MARK-9 and MARK-12.
- The commented-out Jest and Cypress jobs in `ci.yml` stay commented out; MARK-10 and MARK-11 replace them.
- The later split of the UI into components shared with an Activity Player interactive is not designed for here; nothing in this story ties the build to the CODAP plugin more tightly than it is today.

## Out of Scope

- ESLint 9 and the flat config, and any lint rule change (MARK-9). `npm run lint:style` failing on master stays as it is.
- React 18 or 19, `@testing-library/react` 13 or later, and runtime libraries (MARK-12). `@testing-library/jest-dom` 7 is not taken here or in MARK-12 (#1199): it needs `@testing-library/dom` 10, which arrives with React Testing Library 16 in MARK-12, and 6.9.1 has no peer on `@testing-library/dom`, so it works on either side of that change. It is left for a later update.
- Adding Jest or Cypress jobs to CI, replacing the template Cypress spec, and `doc/cypress-coverage.md` (MARK-10, MARK-11).
- The deploy pipeline, `s3-deploy-action`, `release.yml`, and the README's deployment and release sections (MARK-6).
- Replacing unmaintained but working packages that are already at their latest versions (`npm-run-all`, `clean-webpack-plugin`, `@jsdevtools/coverage-istanbul-loader`).

## Open Questions

### RESOLVED: Do the ESLint plugins move within ESLint 8 here, or does MARK-9 take the whole lint toolchain?
**Context**: Jira and D1 said "Update the ESLint plugins only within versions that still support ESLint 8," since updated to match #1191. Nothing in this story needs it: lint runs clean with TypeScript 6 on typescript-eslint 5.37. The plugin versions that still support ESLint 8 (typescript-eslint 8, eslint-plugin-jest 29, eslint-plugin-testing-library 7) are the ones MARK-9 moves to anyway, and typescript-eslint 8 removes `@typescript-eslint/semi`, which `.eslintrc.js` uses.
**Options considered**:
- A) Leave every lint package and the lint config to MARK-9.
- B) Move the lint packages within ESLint 8 here, including typescript-eslint 8 and the config change for the removed `semi` rule.
- C) Move only the plugins that need no config change.

**Decision**: A, Doug's decision on the stream channel (#1191): every ESLint package and the ESLint config belong to MARK-9, typescript-eslint and `eslint-webpack-plugin` included, and MARK-8 owns the Node pin (22 or later). Jira and D1 now say MARK-8 changes no ESLint package or configuration. MARK-9's condition (#1194), that TypeScript stays at 6.0.x or below, is met by R3.

### RESOLVED: Judgment call: TypeScript 6.0 rather than 7.0 or 5.9
**Options considered**:
- A) 7.0, the current release.
- B) 6.0, the newest the rest of the toolchain accepts.
- C) 5.9, the last 5.x, which avoids the TypeScript 6 config changes.

**Decision**: B. `ts-jest` 29 requires `<7` and typescript-eslint 8 requires `<6.1.0`, so 7.0 cannot be used yet. 6.0 needs only the three small config changes in R4, all verified, and it is the release that reports what 7.0 will remove, so the move to 7.0 later is smaller.

### RESOLVED: Judgment call: `moduleResolution` `bundler` rather than keeping `node` with `ignoreDeprecations`
**Context**: TypeScript 6 accepts the deprecated `node` resolution with `"ignoreDeprecations": "6.0"`; TypeScript 7 removes it. MARK-12 measured (#1195), and this was rechecked here, that `iframe-phone` 1.4.0 fails under `bundler` with TS7016, because its new `exports` map has no `types` condition; under `node` with `ignoreDeprecations` it type-checks. 1.3.1, the installed version, resolves under both.
**Options considered**:
- A) `bundler`, which matches how webpack resolves modules and still works in TypeScript 7.
- B) `node` with `"ignoreDeprecations": "6.0"`, which lets MARK-12 take `iframe-phone` 1.4.0 now.

**Decision**: A. B only defers the change: the move to TypeScript 7 has to leave `node` resolution and hits the same `iframe-phone` packaging problem then. Under A, MARK-12 keeps `iframe-phone` on 1.3.1 until a release with a `types` condition exists, which MARK-12 said works for it (#1195).

### RESOLVED: Judgment call: Node 24 rather than Node 22
**Options considered**:
- A) Node 22, which Concord's other repos (collaborative-learning, researcher-dashboard) pin in CI today.
- B) Node 24, the current LTS line.

**Decision**: B. Node 22's support ends April 2027, a few months away, and every updated tool supports 24. Build, lint, Jest and the coverage build were run on Node 24.14 and pass.

### RESOLVED: Judgment call: remove unused devDependencies instead of updating them
**Options considered**:
- A) Remove only `@testing-library/react-hooks`, as Jira says, and update the rest of the unused packages too.
- B) Remove every unused non-lint devDependency (R17).

**Decision**: B. Updating a package nothing uses is verification work with nothing to verify. Each removal was checked: no file in the repo imports or configures it, and the build, Jest and `cypress run` behave the same without it.

### RESOLVED: Low confidence: whether the newer loaders change the built output
**Context**: css-loader, sass-loader, postcss-loader and svgr each move a major version or more, with no rendering tests to lean on.

**Decision**: Checked by diffing the built CSS between master and the updated tooling. The only differences are dropped `-webkit-` prefixes (newer `caniuse-lite` data) and one rule in `add-text.scss` that Sass now splits around a nested block without changing which declarations apply. SVG IDs are stripped from the bundle both before and after (R14). The CODAP check in R24 is the remaining guard.

### RESOLVED: Do the four additions beyond Jira's list stay in MARK-8?
**Context**: Four requirements are not in Jira's list: removing five more unused devDependencies (R17), removing `start:secure:no-certs` (R12), mapping `.scss` in Jest (R7) and npm caching in CI (R21).
**Options considered**:
- A) Keep all four.
- B) Keep only the Jest `.scss` mapping.
- C) Drop all four.

**Decision**: A (stream channel #1204). The Jest mapping belongs with the test tooling and saves MARK-10 a fix, the two removals take code away, and the caching is two lines in a file this story already changes.

## Self-Review

Roles: DevOps engineer, QA engineer, senior engineer, product manager, and a first-time reviewer of this repo (Maureen E. Zitouni). Each item was checked against the repo or a scratch install before it was written here.

### DevOps Engineer

#### RESOLVED: The done condition made MARK-8 depend on deploy secrets it does not own
R25 required the deploy job to publish the branch build, but that job needs the repo's AWS secrets, unused for over a year, and `s3-deploy-action`, both MARK-6's. R25 now requires the build job to pass and records a deploy failure that is not a build failure for MARK-6.

### QA Engineer

#### RESOLVED: The CODAP check did not say which CODAP, or how the plugin is loaded
R24 said "works in CODAP" while MARK-5, which finds out whether classes use v2 or v3, has not reported. R24 now names the URL and the steps. Checked with Playwright: the updated build loads in `codap.concord.org/app` and `codap3.concord.org`, builds a chain from text, draws it and animates a generated sequence, with no console errors. The v2 address `releases/latest` redirects to v3, so R24 repeats the check on v2 only if MARK-5 finds a v2 build in use.

#### RESOLVED: The release build path was not in the done condition
`build:top-test` is the local stand-in for the `index-top.html` the deploy relies on, and it runs through `cross-env`, which moves from 7 to 10. Checked in the scratch install: it builds, and every asset URL carries `specific/release/`. Added to R23.

### Senior Engineer

#### RESOLVED: R20 missed one output difference
The built `index.html` is minified harder by `html-webpack-plugin` 5.6 (unquoted attributes, no `<html>` element). Browsers parse both the same way. R20 now lists it.

### Product Manager

#### RESOLVED: Background quoted a Jira line that Jira no longer contains
Jira and D1 now say MARK-8 changes no ESLint package or configuration, and that ESLint, typescript-eslint and the plugins are MARK-9's (checked in the MARK-8 description). The Background correction of the old ESLint 8 line is removed, and the lint-ownership entry's Context now says that line was there and has been updated to match #1191.

### First-time reviewer

#### RESOLVED: Ownership of `@testing-library/jest-dom` 7 was unclear
Out of Scope said MARK-12 takes it while MARK-12 had said (#1192) that `jest-dom` is MARK-8's. MARK-12 then declined it (#1199). Out of Scope now says 6.9.1 works before and after MARK-12's React Testing Library 16, and 7 is left for a later update.

### Second pass

Roles: test writer (the MARK-10 consumer of the Jest config), supply-chain reviewer, and Maureen E. Zitouni as a newer developer reading the commits one at a time. Each item was confirmed in a scratch replay of the full commit sequence before it was written here.

#### RESOLVED: Test writer: R7 promised more than the mapping delivers
A test that imports `App`, `Drawing` or `Graph` fails under Jest 30 with "Must use import to load ES Module" on `nanoid`, and `d3` fails the same way. R7 now names those components, and Technical Notes records the two fixes that were checked (`transformIgnorePatterns`, or `--experimental-vm-modules` on Node 24.9 and later). Picking one is left to MARK-10, which decides how the tests are structured, so the scope agreed in #1204 does not grow.

#### RESOLVED: Supply-chain reviewer: the spec did not say what the update does to `npm audit`
Measured on master and on the replay's last commit: 65 vulnerabilities (7 critical) before, 11 (none critical) after, all owned by MARK-9, MARK-12 or out-of-scope packages. Recorded in Technical Notes, with why `npm audit fix` is not run here.

#### RESOLVED: Supply-chain reviewer: `istanbul-lib-coverage` was updated although nothing uses it
Nothing in the repo imports or configures it, and `@cypress/code-coverage` 3 and 4 both list it as their own dependency. By R17's rule it is removed, not updated: R13 drops it and R17 lists it. Build, Jest and `cypress run` pass at every commit without it.

#### RESOLVED: Maureen E. Zitouni: process words a later reader cannot resolve
The Self-Review referred to "stage 4" and named a reviewer by a short form. Both now read without the speccing process: the stage reference is dropped and the reviewer is named in full.
