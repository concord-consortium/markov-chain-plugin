# Update the Markov plugin's build and test tooling

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-8

**Status**: **Closed**

## Overview

Bring the plugin's build and test tooling (TypeScript, Jest, Cypress, webpack and its loaders, the GitHub Actions it runs in CI) up to current versions and pin the Node version, so the build keeps working and the unit and rendering tests that follow are written once on current tooling. The plugin's behavior does not change. ESLint and its plugins are left to MARK-9, and React with the other runtime libraries to MARK-12.

The branch sits on MARK-20's (the plugin bug fixes), which sits on MARK-6's. Neither changes a package, the lockfile or the build, TypeScript or Jest config; MARK-20 adds the repo's first Jest tests (32, in plain TypeScript modules), and every MARK-8 commit is checked against them.

## Requirements

### Node

- R1. A `.nvmrc` at the repo root pins Node 24 (the current LTS line, supported until April 2028). Every updated tool supports it; the binding minimums are `webpack-dev-server` 6 (`>= 22.15.0`), `sass-loader` 17 (`>= 22.11.0`) and `cypress` 16 (`^22 || ^24 || >=26`).
- R2. CI reads the Node version from `.nvmrc` rather than repeating it.

### TypeScript

- R3. `typescript` is on 6.0 (`~6.0.3`).
- R4. `tsconfig.json` changes only as TypeScript 6 requires: `moduleResolution` moves from the deprecated `node` (an error in 6.0) to `bundler`, and the unused `outDir` is removed (with it set, TypeScript 6 requires `rootDir`, and `ts-jest` warns about files outside it). `src/global.d.ts` declares `*.scss` modules, since TypeScript 6 checks side-effect imports.
- R5. `npx tsc --noEmit -p .` passes.

### Jest

- R6. `jest` and `jest-environment-jsdom` are on 30, `ts-jest` on 29, `@types/jest` on 30, and `@testing-library/jest-dom` on the newest 6.x that does not require `@testing-library/dom` 10 (6.9.1, pinned exactly).
- R7. The Jest `moduleNameMapper` maps `.scss` imports to `identity-obj-proxy`, so a test that imports a component that imports `.scss` runs. Components that reach `nanoid` or `d3` (`App`, `Drawing`, `Graph`) still fail to load under Jest because both packages ship only ES modules; MARK-10 picks the fix (Technical Notes).
- R8. A test that renders with React Testing Library 12 and uses a `jest-dom` matcher passes (verified with a throwaway test that is not committed; MARK-10 adds the real tests).

### Cypress

- R9. `cypress` is on 16 and `@cypress/code-coverage` on 4 (4.0.3). `cypress run` loads `cypress.config.ts` and runs the existing spec, which still fails for its own reason (it expects "Hello World"; MARK-11 replaces it).

### webpack and the dev server

- R10. `webpack` is on the latest 5.x, `webpack-cli` on 7, `webpack-dev-server` on 6.
- R11. `devServer` uses the `server` option in place of `https`, with the same `~/.localhost-ssl` certificate files. `npm start` serves over HTTP and `npm run start:secure` over HTTPS.
- R12. `start:secure:no-certs` is removed, with the README section that documents it, because it does not work without certificate files and does the same as `start:secure` with them.
- R13. The loaders and plugins move to their current majors: `css-loader` 7, `style-loader` 4, `postcss-loader` 8, `sass-loader` 17 (17.0.1), `sass` 1.x latest, `mini-css-extract-plugin` and `html-webpack-plugin` latest within their majors, `@svgr/webpack` 8, `ts-loader` 9 latest, `autoprefixer` and `caniuse-lite` latest, `cross-env` 10.
- R14. The SVGR `svgo` options are updated for svgo 3: `cleanupIDs` is renamed `cleanupIds` (svgo 3 ignores the old name and warns for every SVG), and the `prefixIds` override, which is not part of `preset-default` in svgo 3, is dropped. The build prints no svgo warnings, and the SVG output is unchanged.
- R15. `CODE_COVERAGE=true` builds still instrument the bundle (`window.__coverage__` is present).

### Packages removed

- R16. `@testing-library/react-hooks` is removed (deprecated, unused).
- R17. Other devDependencies that nothing in the repo uses are removed rather than updated: `@cypress/webpack-preprocessor`, `file-loader`, `script-loader`, `wait-on`, `ts-node` and `istanbul-lib-coverage` (`@cypress/code-coverage` still installs it as its own dependency). Unused lint packages (`eslint-config-react`, `eslint-plugin-chai-friendly`) are left for MARK-9.

### What does not change

- R18. ESLint, every lint package and the lint config stay as they are: `eslint`, `@typescript-eslint/*`, `eslint-webpack-plugin`, `eslint-import-resolver-typescript`, all `eslint-plugin-*` and `eslint-config-*`, and the three `.eslintrc*.js` files.
- R19. React, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@types/d3` and every runtime dependency stay as they are (MARK-12).
- R20. The plugin's behavior and appearance do not change. Built output may differ only in ways that do not change what the browser renders: CSS vendor prefixes (newer `caniuse-lite` data), how Sass orders declarations that follow nested rules, and `index.html` minified harder by `html-webpack-plugin` 5.6 (unquoted attributes, no `<html>` tag; `index-top.html` still prefixes every asset with `DEPLOY_PATH`).

### CI

- R21. Both jobs in `.github/workflows/ci.yml` use `actions/checkout@v7` and `actions/setup-node@v7`, with `node-version-file: .nvmrc` and npm caching. `release.yml` and `s3-deploy-action@v1` are unchanged.

### README

- R22. The README's Development section says the Node version comes from `.nvmrc` (`nvm use`), and drops the `start:secure:no-certs` steps. The Deployment and release text is MARK-6's and is not changed here.

### Done when

- R23. On Node 24, from a clean `npm ci`, at every MARK-8 commit and on the head: `npm run build` passes with the same 21 `no-console` warnings as the base and no new warnings; `npm run lint` passes; `npx tsc --noEmit -p .` passes; `npm test` passes all of MARK-20's Jest tests. On the head also: a throwaway component test passes under Jest; `cypress run` launches and runs the spec; `npm run build:top-test` writes an `index-top.html` whose asset URLs carry the `DEPLOY_PATH` prefix; `npm start` and `npm run start:secure` serve the plugin.
- R24. The plugin, served by `npm start`, loads and works in CODAP (`https://codap.concord.org/app/?di=http://localhost:8080/`, which is v3): choosing Drawing mode, building a chain from text, drawing the graph, and generating a sequence, with no console errors.
- R25. CI's build and deploy jobs pass on the first push, on the new action versions, and the branch build at `https://models-resources.concord.org/markov-chain-plugin/branch/build-and-test-tooling/index.html` loads. *(Checked at the first push; the branch had not been pushed when the spec was closed.)*

## Technical Notes

- Files touched: `package.json`, `package-lock.json`, `tsconfig.json`, `src/global.d.ts`, `webpack.config.js`, `.github/workflows/ci.yml`, `README.md`, and a new `.nvmrc`.
- The work is eleven commits. The first four change code and config only, and each works on the base's package versions: pin Node 24; update the GitHub Actions; move the dev server to the `server` option; prepare the TypeScript and Jest config. Six dependency-only commits follow, one tool group each: remove unused devDependencies, Cypress 16, TypeScript 6.0, Jest 30, webpack, the loaders and build plugins. The SVGR options commit comes last. Each group is installed with a targeted `npm install`, never a regenerated lockfile, which stays at `lockfileVersion` 2.
- The TypeScript commit also carries the `moduleResolution: "bundler"` line, because TypeScript 4.8 rejects `bundler` (TS6046) and TypeScript 6.0 rejects `node` (TS5107).
- Cypress 16 comes before TypeScript 6 because Cypress 10's bundled spec preprocessor fails to compile specs under TypeScript 6 (`TS5053`), while Cypress 16 runs them on both 4.8 and 6.0.
- The loaders commit leaves 38 svgo warnings ("You are trying to configure cleanupIDs which is not part of preset-default", and the same for `prefixIds`); the SVGR options commit clears them.
- Port 8080 is the dev server's default and is often taken by another local dev server; checks used other ports. `cypress.config.ts` hardcodes `baseUrl: http://localhost:8080`, which MARK-11 can revisit.
- `nanoid` 4 and `d3` 7 are ES-module-only, and Jest runs tests as CommonJS, so importing `App`, `Drawing` or `Graph` in a test fails with "Must use import to load ES Module". Two fixes were checked on the updated tooling, and both load `App` and `Graph`: a `transformIgnorePatterns` that lets `ts-jest` (the `js-with-ts` preset, with `allowJs`) compile `nanoid`, `d3`, `d3-*`, `internmap`, `delaunator` and `robust-predicates`; or running Jest with `NODE_OPTIONS=--experimental-vm-modules`, which on Node 24.9 and later lets Jest 30 `require()` ES modules natively. Which fits depends on how MARK-10 structures its tests.
- `npm audit` (2026-10-27) reports 65 vulnerabilities on the base (7 critical; the same as master) and 11 after this work (none critical). Of the 11, `nanoid` is a runtime dependency (MARK-12), and the rest are transitive dependencies of the lint packages (MARK-9), `@testing-library/react` 12 (MARK-12) and `npm-run-all`. `npm audit fix --package-lock-only` would clear all but `nanoid`, but it also moves lint and React Testing Library transitives, which are left for MARK-9 and MARK-12.
- `npm run lint:style` fails on the base with 380 errors (212 on master, the rest in MARK-20's files); that is MARK-9's.
- The commented-out Jest and Cypress jobs in `ci.yml` stay commented out; MARK-10 and MARK-11 replace them.
- The later split of the UI into components shared with an Activity Player interactive is not designed for here.

## Out of Scope

- ESLint 9 and the flat config, and any lint rule change (MARK-9).
- React 18 or 19, `@testing-library/react` 13 or later, and runtime libraries (MARK-12). `@testing-library/jest-dom` 7 needs `@testing-library/dom` 10, which arrives with React Testing Library 16 in MARK-12; 6.9.1 works on either side of that change, and 7 is left for a later update.
- Adding Jest or Cypress jobs to CI, replacing the template Cypress spec, and `doc/cypress-coverage.md` (MARK-10, MARK-11).
- The deploy pipeline, `s3-deploy-action`, `release.yml`, and the README's deployment and release sections (MARK-6).
- Replacing unmaintained but working packages that are already at their latest versions (`npm-run-all`, `clean-webpack-plugin`, `@jsdevtools/coverage-istanbul-loader`).

## Decisions

### Requirements decisions

### Do the ESLint plugins move within ESLint 8 here, or does MARK-9 take the whole lint toolchain?
**Context**: Jira once said to update the ESLint plugins within ESLint 8. Nothing here needs it: lint runs clean with TypeScript 6 on typescript-eslint 5.37, and typescript-eslint 8 removes `@typescript-eslint/semi`, which `.eslintrc.js` uses.
**Options considered**:
- A) Leave every lint package and the lint config to MARK-9.
- B) Move the lint packages within ESLint 8 here, with the config change for the removed `semi` rule.
- C) Move only the plugins that need no config change.

**Decision**: A, Doug's decision on the stream channel (#1191). MARK-8 owns the Node pin (22 or later); MARK-9's condition that TypeScript stays at 6.0.x or below is met by R3.

---

### TypeScript 6.0 rather than 7.0 or 5.9
**Context**: "Current" TypeScript is 7.0, but not every tool accepts it.
**Options considered**:
- A) 7.0, the current release.
- B) 6.0, the newest the rest of the toolchain accepts.
- C) 5.9, the last 5.x, which avoids the TypeScript 6 config changes.

**Decision**: B. `ts-jest` 29 requires `<7` and typescript-eslint 8 requires `<6.1.0`. 6.0 needs only the small config changes in R4, and it reports what 7.0 will remove, so the later move to 7.0 is smaller.

---

### `moduleResolution` `bundler` rather than `node` with `ignoreDeprecations`
**Context**: TypeScript 6 accepts the deprecated `node` resolution with `"ignoreDeprecations": "6.0"`; TypeScript 7 removes it. `iframe-phone` 1.4.0 fails under `bundler` with TS7016 (its `exports` map has no `types` condition); 1.3.1, the installed version, resolves under both.
**Options considered**:
- A) `bundler`, which matches how webpack resolves modules and still works in TypeScript 7.
- B) `node` with `"ignoreDeprecations": "6.0"`, which lets MARK-12 take `iframe-phone` 1.4.0 now.

**Decision**: A. B only defers the change to TypeScript 7. Under A, MARK-12 keeps `iframe-phone` on 1.3.1 until a release with a `types` condition exists, which MARK-12 accepted (#1195).

---

### Node 24 rather than Node 22
**Context**: Concord's other repos pin Node 22 in CI.
**Options considered**:
- A) Node 22.
- B) Node 24, the current LTS line.

**Decision**: B. Node 22's support ends April 2027, and every updated tool supports 24.

---

### Remove unused devDependencies instead of updating them
**Context**: Jira named only `@testing-library/react-hooks`; six more devDependencies are unused.
**Options considered**:
- A) Remove only `@testing-library/react-hooks` and update the other unused packages.
- B) Remove every unused non-lint devDependency (R17).

**Decision**: B. Updating a package nothing uses is verification work with nothing to verify. Each removal was checked: nothing imports or configures it, and the build, Jest and `cypress run` behave the same without it. `istanbul-lib-coverage` was added to the list in review, since `@cypress/code-coverage` installs it itself.

---

### Do the newer loaders change the built output?
**Context**: css-loader, sass-loader, postcss-loader and svgr each move a major version or more, with no rendering tests to lean on.
**Decision**: Checked by diffing the built CSS: the only differences are dropped `-webkit-` prefixes and one rule in `add-text.scss` that Sass splits around a nested block without changing which declarations apply. SVG IDs are stripped before and after. The `index.html` minification difference was added to R20 in review. The CODAP check in R24 is the remaining guard.

---

### Do the four additions beyond Jira's list stay in MARK-8?
**Context**: Removing five more unused devDependencies (R17), removing `start:secure:no-certs` (R12), mapping `.scss` in Jest (R7) and npm caching in CI (R21) are not in Jira's list.
**Options considered**:
- A) Keep all four.
- B) Keep only the Jest `.scss` mapping.
- C) Drop all four.

**Decision**: A (stream channel #1204). The Jest mapping belongs with the test tooling, the two removals take code away, and the caching is two lines in a file this work already changes.

---

### What the done condition requires of CI
**Context**: The deploy job needs the repo's AWS secrets and `s3-deploy-action`, both MARK-6's. MARK-6's first push later showed both jobs and the secrets working on the old action versions.
**Decision**: R25 requires both CI jobs to pass and the branch build to load on the first push; with the pipeline proven by MARK-6, a failure there is MARK-8's.

---

### How far the Jest `.scss` mapping goes
**Context**: With `.scss` mapped, `App`, `Drawing` and `Graph` still fail to load under Jest because `nanoid` and `d3` are ES-module-only.
**Decision**: R7 says so, and Technical Notes records the two checked fixes. Choosing one is left to MARK-10, which decides how the tests are structured, so the scope agreed in #1204 does not grow.

---

### Restacking onto MARK-20
**Context**: The bug-fix story (MARK-20) was placed under MARK-8 and added the repo's first Jest tests, on Jest 28.
**Decision**: MARK-20 kept to tests that import only new plain modules and changed no package or config, so MARK-8's plan stood. The baseline was re-measured on MARK-20, and R23 and the per-commit check now require lint and all of MARK-20's tests at every MARK-8 commit. A replay of all eleven commits over MARK-20 passed every check.

---

### Implementation decisions

### The TypeScript commit carries one `tsconfig.json` line
**Options considered**:
- A) Keep every dependency commit free of code, and put `moduleResolution: "bundler"` in the commit before or after the TypeScript bump.
- B) Put that one line in the TypeScript bump commit and say why in its message.

**Decision**: B. TypeScript 4.8 rejects `bundler` and TypeScript 6.0 rejects `node`, so A leaves one commit that does not build. Everything else TypeScript 6 needs moves in the earlier config commit, which works on 4.8.

---

### The SVGR option fix comes after the svgr bump, not before
**Options considered**:
- A) Rename `cleanupIDs` before the bump, with the other config commits.
- B) Rename it right after the bump that makes svgo print the warning.

**Decision**: B. svgo 2.8 prints nothing for an override name it does not know, so before the bump there is no way to see that the new name is honored. After it, the warning count going from 38 to 0 shows it.

---

### Bump each tool group with a targeted `npm install`, not a regenerated lockfile
**Options considered**:
- A) Delete `package-lock.json` and `node_modules` and reinstall once.
- B) One `npm install` per group, so each lockfile diff belongs to the group its commit names.

**Decision**: B. A reviewer can match each lockfile diff to one commit's purpose, and a problem can be bisected to a group. Transitive dependencies of the lint and React packages stay where MARK-9 and MARK-12 expect them.

---

### Cypress 16 moves ahead of TypeScript 6
**Context**: With Cypress last, every commit from TypeScript 6.0 through the SVGR options ran Cypress 10.8, whose bundled spec preprocessor fails under TypeScript 6 (`TS5053`).
**Decision**: Cypress 16, which runs on TypeScript 4.8 too, comes straight after the removals, so `cypress run` compiles and runs the spec at every commit.

---

### `@testing-library/jest-dom` is pinned exactly
**Context**: npm saves `@6.9.1` as `^6.9.1`, which lets 6.10 (with its peer on `@testing-library/dom` 10) in on a later update.
**Decision**: The Jest step installs it with `--save-exact`, so `package.json` records `6.9.1`.

---

### `@cypress/code-coverage` and `sass-loader` are held at the verified versions
**Context**: On 2026-10-27, `@cypress/code-coverage@^4.0.3` resolved to 4.1.1 and `sass-loader@^17.0.1` to 17.1.0, both published that day, after the replays had verified 4.0.3 and 17.0.1.
**Decision**: Both are installed at the verified versions (4.0.3 and 17.0.1); `package.json` records `^4.0.3` and `^17.0.1`, so a later update can take the newer releases.
