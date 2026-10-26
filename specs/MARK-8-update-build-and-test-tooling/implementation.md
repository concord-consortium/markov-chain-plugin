# Implementation Plan: Update the Markov plugin's build and test tooling

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-8
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Eleven small commits. The first four change code and config only, and each works on master's package versions. The next six change only `package.json` and `package-lock.json` (one tool group each), except that the TypeScript commit carries the one `tsconfig.json` line TypeScript 6 cannot build without. One code commit comes last, right after the package bump that makes it necessary. This keeps every dependency and lockfile change apart from code changes, so each lockfile diff reads against one commit's purpose, and every commit builds and runs the Cypress spec.

Work on Node 24 (`nvm use` once `.nvmrc` exists). Install with `CYPRESS_INSTALL_BINARY=0` to skip the binary download, except where `cypress run` is being checked. Use `npm install` / `npm uninstall` with the exact specifiers below, so each lockfile diff is limited to that group; do not delete and regenerate `package-lock.json`. The lockfile stays at `lockfileVersion` 2.

Commit subjects follow the repo's `<type>: <summary> [<KEY>]` form (for example `fix: Markov outputs are not highlighting correctly [MARK-1]`), in this order:

1. `chore: pin Node 24 with .nvmrc [MARK-8]`
2. `ci: update checkout and setup-node, read Node from .nvmrc [MARK-8]`
3. `build: move the dev server to the server option [MARK-8]`
4. `build: prepare tsconfig and Jest for TypeScript 6 and scss [MARK-8]`
5. `build(deps): remove unused devDependencies [MARK-8]`
6. `build(deps): update Cypress to 16 [MARK-8]`
7. `build(deps): update TypeScript to 6.0 [MARK-8]`
8. `build(deps): update Jest to 30 [MARK-8]`
9. `build(deps): update webpack, webpack-cli and webpack-dev-server [MARK-8]`
10. `build(deps): update loaders and build plugins [MARK-8]`
11. `build: update SVGR options for svgo 3 [MARK-8]`

After every commit, the check is: `npm ci && npm run build` passes with 21 `no-console` warnings, `npx tsc --noEmit -p .` passes, and `npx cypress run` compiles and runs the spec to its existing failure. From the Jest config commit on, a throwaway component test (below) passes too. The replay of this whole sequence, with the results per commit, is under Verification.

---

### Pin Node 24

**Summary**: Adds `.nvmrc` so local work and CI use one Node version (R1), and says so in the README (R22).

**Files affected**:
- `.nvmrc` (new): `24`
- `README.md`: Initial steps

**Estimated diff size**: ~4 lines

```diff
 1. Clone this repo and `cd` into it
-2. Run `npm install` to pull dependencies
-3. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement
+2. Run `nvm use` to switch to the Node version in `.nvmrc` (or install that version another way)
+3. Run `npm install` to pull dependencies
+4. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement
```

---

### Update the GitHub Actions and read Node from `.nvmrc`

**Summary**: Moves both live jobs in `ci.yml` to `actions/checkout@v7` and `actions/setup-node@v7`, which run on `node24`, and has `setup-node` read `.nvmrc` with npm caching (R2, R21). The commented-out Jest and Cypress jobs are left as they are; MARK-10 and MARK-11 replace them.

**Files affected**:
- `.github/workflows/ci.yml`: the `only_build` and `s3-deploy` jobs

**Estimated diff size**: ~12 lines

In each of the two jobs:

```diff
-      - uses: actions/checkout@v2
-      - uses: actions/setup-node@v2
+      - uses: actions/checkout@v7
+      - uses: actions/setup-node@v7
+        with:
+          node-version-file: .nvmrc
+          cache: npm
```

`s3-deploy-action@v1` and `release.yml` are unchanged.

---

### Move the dev server to the `server` option

**Summary**: Replaces the `devServer.https` key, which webpack-dev-server 5 and 6 reject, with `devServer.server`, and moves `npm start` to `--server-type http` (R11). Removes `start:secure:no-certs` and its README steps (R12). webpack-dev-server 4.11, master's version, already supports both, so this works before the bump (checked: `--server-type http` serves HTTP and the default serves HTTPS with the `~/.localhost-ssl` files).

**Files affected**:
- `webpack.config.js`: `devServer`
- `package.json`: `scripts.start`, remove `scripts["start:secure:no-certs"]`
- `README.md`: remove the "Alternately, you can run secure without certificates in Chrome" block (four lines)

**Estimated diff size**: ~20 lines

```diff
     devServer: {
       static: 'dist',
       hot: true,
-      https: {
-        key: path.resolve(os.homedir(), '.localhost-ssl/localhost.key'),
-        cert: path.resolve(os.homedir(), '.localhost-ssl/localhost.pem'),
-      },
+      server: {
+        type: 'https',
+        options: {
+          key: path.resolve(os.homedir(), '.localhost-ssl/localhost.key'),
+          cert: path.resolve(os.homedir(), '.localhost-ssl/localhost.pem'),
+        },
+      },
       allowedHosts: 'all',
     },
```

```diff
-    "start": "webpack serve --no-https",
+    "start": "webpack serve --server-type http",
     "start:secure": "webpack serve",
-    "start:secure:no-certs": "webpack serve --no-https-request-cert",
```

---

### Prepare the TypeScript and Jest config

**Summary**: The config changes TypeScript 6 and component tests need that already work on TypeScript 4.8 (R4, R7): removes the unused `outDir` from `tsconfig.json`, declares `*.scss` modules, and maps `.scss` in the Jest `moduleNameMapper`. After this commit a test that imports a component runs; on master it fails with `SyntaxError: Unexpected token '.'` on the first `.scss` import.

**Files affected**:
- `tsconfig.json`: remove `"outDir": "./dist/"`
- `src/global.d.ts`: add `declare module "*.scss";`
- `package.json`: `jest.moduleNameMapper`

**Estimated diff size**: ~4 lines

```diff
-      "\\.(css|less|sass)$": "identity-obj-proxy"
+      "\\.(css|less|sass|scss)$": "identity-obj-proxy"
```

---

### Remove unused devDependencies

**Summary**: Dependency-only commit (R16, R17).

```bash
npm uninstall @testing-library/react-hooks @cypress/webpack-preprocessor file-loader script-loader wait-on ts-node istanbul-lib-coverage
```

**Files affected**: `package.json`, `package-lock.json`

---

### Update Cypress to 16

**Summary**: Dependency-only commit (R9). It comes before TypeScript 6 because Cypress 10 bundles its own spec preprocessor, which compiles specs with the project's TypeScript and fails under 6.0 (`TS5053: Option 'sourceMap' cannot be specified with option 'inlineSourceMap'`); Cypress 16 runs the spec on both TypeScript 4.8 and 6.0. Install without `CYPRESS_INSTALL_BINARY=0` (or run `npx cypress install` after) so `cypress run` can be checked.

```bash
npm install -D cypress@^16.2.0 @cypress/code-coverage@^4.0.3
```

**Files affected**: `package.json`, `package-lock.json`

---

### Update TypeScript to 6.0

**Summary**: Dependency commit (R3), plus the one config line TypeScript 6 cannot build without: `moduleResolution` `node` is an error in TypeScript 6.0 (TS5107), and its replacement `bundler` does not exist in TypeScript 4.8 (TS6046), so the line cannot move in an earlier or later commit without leaving one that fails. The commit message says so.

```bash
npm install -D typescript@~6.0.3 ts-loader@^9.6.2
```

```diff
-    "moduleResolution": "node",
+    "moduleResolution": "bundler",
```

**Files affected**: `package.json`, `package-lock.json`, `tsconfig.json` (one line)

---

### Update Jest to 30

**Summary**: Dependency-only commit (R6). `@testing-library/jest-dom` is pinned to 6.9.1, the newest without a peer on `@testing-library/dom` 10.

```bash
npm install -D jest@^30.5.2 jest-environment-jsdom@^30.5.2 ts-jest@^29.4.15 @types/jest@^30.0.0 @testing-library/jest-dom@6.9.1
```

**Files affected**: `package.json`, `package-lock.json`

---

### Update webpack, webpack-cli and webpack-dev-server

**Summary**: Dependency-only commit (R10). webpack-cli 7 requires webpack `^5.101.0`, so the three move together.

```bash
npm install -D webpack@^5.112.2 webpack-cli@^7.2.3 webpack-dev-server@^6.1.0
```

**Files affected**: `package.json`, `package-lock.json`

---

### Update the loaders and build plugins

**Summary**: Dependency-only commit (R13). After it the build passes but svgo 3 prints "You are trying to configure cleanupIDs which is not part of preset-default" (and the same for `prefixIds`) for every SVG; the next commit fixes that.

```bash
npm install -D css-loader@^7.1.5 style-loader@^4.0.0 postcss-loader@^8.2.1 sass-loader@^17.0.1 sass@^1.106.1 mini-css-extract-plugin@^2.10.2 html-webpack-plugin@^5.6.8 @svgr/webpack@^8.1.0 autoprefixer@^10.6.1 caniuse-lite@latest cross-env@^10.1.0
```

**Files affected**: `package.json`, `package-lock.json`

---

### Update the SVGR options for svgo 3

**Summary**: Renames `cleanupIDs` to `cleanupIds` and drops the `prefixIds` override with its two comment lines (R14). The build is then free of svgo warnings. Output does not change: no SVG references its own IDs, and IDs are stripped before and after.

**Files affected**:
- `webpack.config.js`: the `@svgr/webpack` `svgoConfig`

**Estimated diff size**: ~5 lines

```diff
                           // don't minify "id"s (i.e. turn randomly-generated unique ids into "a", "b", ...)
-                          // https://github.com/svg/svgo/blob/master/plugins/cleanupIDs.js
-                          cleanupIDs: { minify: false },
+                          // https://github.com/svg/svgo/blob/master/plugins/cleanupIds.js
+                          cleanupIds: { minify: false },
                           // leave <line>s, <rect>s and <circle>s alone
                           // https://github.com/svg/svgo/blob/master/plugins/convertShapeToPath.js
                           convertShapeToPath: false,
-                          // leave "class"es and "id"s alone
-                          // https://github.com/svg/svgo/blob/master/plugins/prefixIds.js
-                          prefixIds: false,
```

The `cleanupIDs.js` link moves to `cleanupIds.js` because svgo has renamed the file.

---

### Final checks (no commit)

Run R23 and R24 on the branch head, from a clean `npm ci` on Node 24:

- `npm run build` (21 `no-console` warnings, no svgo warnings, no "caniuse-lite is outdated"), `npm run lint`, `npx tsc --noEmit -p .`.
- The throwaway component test below, under `npx jest`. Delete it afterwards.
- `npm run build:top-test`: `top-test/index-top.html` loads `specific/release/assets/...`. Delete `top-test/`.
- `CODE_COVERAGE=true npx webpack --mode development`: the bundle contains `__coverage__`.
- `npm start`, then `npx cypress run`: the spec runs and fails on its "Hello World" expectation or the CODAP request timeout, as on master. If port 8080 is taken, use `npm start -- --port 8091` and `npx cypress run --config baseUrl=http://localhost:8091`.
- `npm run start:secure` serves HTTPS.
- The CODAP check in R24.
- After the push: CI's build job passes (R25).

Throwaway component test, `src/tmp/probe.test.tsx` (not committed):

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { ToolbarButton } from "../components/toolbar";

describe("probe", () => {
  it("renders with RTL 12 and jest-dom matchers, importing a component that imports scss and svg", () => {
    render(<div data-testid="x">hi</div>);
    expect(screen.getByTestId("x")).toHaveTextContent("hi");
    expect(ToolbarButton).toBeDefined();
  });
});
```

## Verification

The whole sequence was replayed in a scratch git repo from master (v0.5.0), on Node 24.14 and npm 11.9, running the steps above as written (README edits aside). After each commit: a clean `npm ci`, `npm run build`, `npx tsc --noEmit -p .`, `npx jest` with the throwaway test, and `npx cypress run` against a static page (the spec runs and fails on its own assertion, as on master).

| Commit | `npm ci` | build | `no-console` warnings | svgo warnings | `tsc` | throwaway test | `cypress run` | files, lines |
|---|---|---|---|---|---|---|---|---|
| Pin Node 24 | pass | pass | 21 | 0 | pass | fails (`.scss` not mapped, as on master) | runs (10.8) | 1, +1 |
| GitHub Actions | pass | pass | 21 | 0 | pass | fails, as above | runs (10.8) | 1, +10 -4 (see note) |
| Dev server option | pass | pass | 21 | 0 | pass | fails, as above | runs (10.8) | 2, +7 -5 |
| TypeScript and Jest config | pass | pass | 21 | 0 | pass | pass | runs (10.8) | 3, +2 -2 |
| Remove unused devDependencies | pass | pass | 21 | 0 | pass | pass | runs (10.8) | 2, -556 |
| Cypress 16 | pass | pass | 21 | 0 | pass | pass | runs (16.2) | 2, +4278 -2919 |
| TypeScript 6.0 | pass | pass | 21 | 0 | pass | pass | runs (16.2) | 3, +60 -43 |
| Jest 30 | pass | pass | 21 | 0 | pass | pass | runs (16.2) | 2, +5383 -3066 |
| webpack | pass | pass | 21 | 0 | pass | pass | runs (16.2) | 2, +3837 -2559 |
| Loaders and build plugins | pass | pass | 21 | 38 | pass | pass | runs (16.2) | 2, +917 -849 |
| SVGR options | pass | pass | 21 | 0 | pass | pass | runs (16.2) | 1, +2 -5 (see note) |

The replay's GitHub Actions commit also rewrote the three `@v2` references inside the commented-out jobs (+13 -7); the step above leaves them, which gives +10 -4. The replay's SVGR commit left the `cleanupIDs.js` comment link unchanged (+1 -4); with the link fix the step gives +2 -5. The large line counts are `package-lock.json`; the `package.json` part of each dependency commit is the handful of lines its command names. The lockfile stayed at `lockfileVersion` 2 throughout. `npm audit` on the last commit reports 11 vulnerabilities, none critical (65, 7 critical, on master); requirements.md's Technical Notes say where they come from.

Checked separately on the same package set: `cypress run` launches Cypress 16 and runs the spec to its existing failure; `--server-type http` and the default HTTPS mode serve on webpack-dev-server 6 (and on 4.11, before the bump); `build:top-test` prefixes assets with `specific/release/`; the `CODE_COVERAGE=true` bundle contains `__coverage__`; the plugin works in CODAP at `codap.concord.org/app` and `codap3.concord.org`.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: the TypeScript commit carries one `tsconfig.json` line
**Options considered**:
- A) Keep every dependency commit free of code, and put `moduleResolution: "bundler"` in the commit before or after the TypeScript bump.
- B) Put that one line in the TypeScript bump commit and say why in its message.

**Decision**: B. TypeScript 4.8 rejects `bundler` (TS6046) and TypeScript 6.0 rejects `node` (TS5107), so A leaves one commit that does not build. Everything else that TypeScript 6 needs moves in the earlier config commit, which works on 4.8.

### RESOLVED: Judgment call: the SVGR option fix comes after the svgr bump, not before
**Options considered**:
- A) Rename `cleanupIDs` before the bump, with the other config commits.
- B) Rename it right after the bump that makes svgo print the warning.

**Decision**: B. svgo 2.8 prints nothing for an override name it does not know, so before the bump there is no way to see that the new name is honored. After the bump, the warning count going from 38 to 0 shows it.

### RESOLVED: Judgment call: bump each tool group with targeted `npm install`, not a regenerated lockfile
**Options considered**:
- A) Delete `package-lock.json` and `node_modules` and reinstall once, moving every transitive dependency to current.
- B) One `npm install` per group, so each lockfile diff belongs to the group its commit names.

**Decision**: B. A reviewer can match each lockfile diff to one commit's purpose, and a problem can be bisected to a group. Transitive dependencies of packages this story does not touch (lint, React) stay where they are, which is what MARK-9 and MARK-12 start from.

## Self-Review

### Commit reviewer

#### RESOLVED: The plan named the steps but not the commit messages or their order
A newer reviewer reading eleven commits needs each subject to say which group it is. The repo's history uses `<type>: <summary> [<KEY>]`. The subjects are now listed in order at the top of the plan.

#### RESOLVED: The replay's CI commit did not match the step as written
The replay changed every `@v2` in `ci.yml`, including three inside the commented-out jobs, while the step leaves those alone for MARK-10 and MARK-11. The live-job change is the same either way; the Verification table now gives the step's own count and says where the replay differed.

### Operator

#### RESOLVED: The SVGR comment link is dead today
Checked on GitHub: `plugins/cleanupIDs.js` returns 404 in svgo's repo and `plugins/cleanupIds.js` exists, so the link fix in the SVGR step is needed, not cosmetic. The other links in that block (`convertShapeToPath.js`, `prefixIds.js`, `removeUnknownsAndDefaults.js`) still resolve or leave with the removed override.

### Commit reviewer (second pass)

#### RESOLVED: The SVGR step's diff and table row omitted the link fix the step asks for
The diff block showed the `cleanupIDs.js` link as unchanged context while the prose said to change it, and the table row came from the replay, which did not change it. Measured on the replay's files: the step with the link fix is +2 -5. The diff block now shows the link change, and the table and its note give the step's count.

### Second pass

Roles: Maureen E. Zitouni as a newer developer reading the commits one at a time, and a supply-chain reviewer. Each item was confirmed in a scratch replay of the reordered sequence.

#### RESOLVED: Maureen E. Zitouni: `cypress run` broke for five commits in the middle of the stack
With Cypress last, every commit from TypeScript 6.0 through the SVGR options ran Cypress 10.8, whose bundled spec preprocessor fails on the project's tsconfig under TypeScript 6 (`TS5053`), so the spec never compiled there. Cypress 16 runs on TypeScript 4.8 too, so its commit now comes straight after the removals. The replay checks `cypress run` at every commit; the spec compiles and runs at all eleven.

#### RESOLVED: Maureen E. Zitouni: "as the reviewer asked" and "(stages 1 and 4)" point at a process the reader never saw
The opening paragraph now gives the reason for separate dependency commits (each lockfile diff reads against one purpose), and the stage reference in Verification is dropped.

#### RESOLVED: Supply-chain reviewer: `istanbul-lib-coverage` moved from the loaders commit to the removal commit
It is a dependency of `@cypress/code-coverage` and nothing in the repo uses it directly (requirements.md, R17). The Verification table is remeasured with it removed.
