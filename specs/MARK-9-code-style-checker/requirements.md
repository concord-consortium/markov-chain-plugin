# Update the Markov Plugin's Code Style Checker

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-9
**Repo**: https://github.com/concord-consortium/markov-chain-plugin
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Move the plugin's linter from ESLint 8 to ESLint 9, converting its three legacy config files to the flat config format, and fix what the updated checker flags, without changing which rules the team enforces. ESLint 9 is the newest major the plugin's React lint rules run on; npm marks it deprecated, and the flat config is what keeps the later move to ESLint 10 small.

## Project Owner Overview

The plugin's code style checker (ESLint) is on a 2022 version, and its configuration uses a format newer versions no longer read. This story moves it to ESLint 9, the newest version the React lint rules the plugin relies on can run with, and fixes the handful of code issues the newer checker finds. ESLint 9 is itself now marked deprecated on npm, so it is a step rather than the end: the new configuration format is the hard part of reaching ESLint 10, and doing it now keeps that later move small. Nothing a student, teacher or researcher sees changes.

The story is optional and small (2 points). It lands right after the build and test tooling update (MARK-8) and before the test stories (MARK-10, MARK-11), because its style fixes touch many files and would otherwise conflict with them.

## Background

The repo lints with ESLint 8.23 through three legacy config files: `.eslintrc.js` (the rules every command uses), `.eslintrc.build.js` (extends it for the production build: `no-console`, `no-debugger`, unused `eslint-disable` comments), and `.eslintrc.style.js` (extends it with three spacing rules). `package.json` runs them through `lint`, `lint:fix`, `lint:build`, `lint:style` and `lint:style:fix`, and `npm run build` runs `lint:build` before webpack. `webpack.config.js` also lints during every webpack build through `eslint-webpack-plugin`, using the default config.

ESLint 9 reads only the flat config format (`eslint.config.js`), so the three files have to be converted, and every plugin has to move to a version that supports flat config.

Measured on MARK-8's implemented branch (which carries MARK-6's and MARK-20's code), with ESLint 8.23.1 and typescript-eslint 5.37, before any change. MARK-8 leaves every ESLint package and the three `.eslintrc` files as they are on master.

| Command | Result |
|---|---|
| `npm run lint` | clean |
| `npm run lint:build` | 21 warnings, all `no-console` (`console.log` on CODAP errors in `utils/codap-helper.ts`, `utils/output-dataset.ts` and `utils/attribute-values.ts`) |
| `npm run lint:style` | 380 errors: 318 `object-curly-spacing`, 62 `react/jsx-curly-spacing`, across 25 files, all auto-fixable |
| `npx tsc --noEmit` | clean (TypeScript 6.0.3) |
| `npm test` | 32 tests pass in 6 suites (MARK-20's) |
| `npm run build` | passes; its only warnings are `lint:build`'s 21 |

On master the same commands gave 21 `no-console` warnings (in `utils/codap-helper.ts` and `hooks/use-codap.ts`), 212 style errors in 14 files, and no tests. MARK-20 moved some of the CODAP code into new modules and added the first tests.

CI (`.github/workflows/ci.yml`) runs `npm run build`, so it runs `lint:build` but never `lint:style`. That is why the style errors have built up.

### Where this sits in the stack

The stack is MARK-6 (deploy and release), MARK-20 (plugin bug fixes), MARK-8 (build and test tooling), then MARK-9, MARK-10 (unit tests), MARK-11 (rendering tests in CI) and MARK-12 (React and runtime libraries). This branch sits on MARK-8's implemented branch.

Doug's split between the two (stream channel, #1191): **every ESLint package and the ESLint config belong to MARK-9**, typescript-eslint included. MARK-8 leaves them exactly as they are on master. MARK-8 owns the Node version (22 or later, in `.nvmrc` and CI; its spec picks 24), the TypeScript version, webpack and its CLI, Jest, Cypress and GitHub Actions. So MARK-9 starts from master's ESLint packages and config on top of MARK-8's Node and TypeScript.

## Requirements

### Target versions

- ESLint moves to the latest 9.x (9.39.5 when measured), not 10. See the resolved question on ESLint 10 below.
- Each ESLint package ends on a version that supports ESLint 9 and flat config:

  | Package | Now | Target (measured 2026-10-26) | Note |
  |---|---|---|---|
  | `eslint` | 8.23 | 9.39.x | |
  | `@eslint/js` | (new) | 9.x | `eslint:recommended` now lives here |
  | `typescript-eslint` | (new) | 8.x | replaces `@typescript-eslint/eslint-plugin` 5 |
  | `@typescript-eslint/parser` | 5.37 | 8.x, same version as `typescript-eslint` | stays a direct dependency because the `import/parsers` setting names it |
  | `@stylistic/eslint-plugin` | (new) | 5.x | home of `semi`, which typescript-eslint 8 removed |
  | `globals` | (new) | 17.x | replaces the `env` settings |
  | `@eslint-community/eslint-plugin-eslint-comments` | (new) | 4.x | replaces the unmaintained `eslint-plugin-eslint-comments` 3.2 |
  | `eslint-plugin-import` | 2.26 | 2.32.x | |
  | `eslint-import-resolver-typescript` | 3.5 | 4.x | |
  | `eslint-plugin-react` | 7.31 | 7.37.x | |
  | `eslint-plugin-react-hooks` | 4.6 | 7.x | only its two classic rules are enabled, see below |
  | `eslint-plugin-jest` | 26.9 | 29.x | |
  | `eslint-plugin-testing-library` | 5.6 | 7.x | |
  | `eslint-plugin-cypress` | 2.12 | 6.x | 7.x requires ESLint 10 |
  | `eslint-webpack-plugin` | 3.2 | 6.x | flat config is its default |

- These packages are removed, because nothing they provide is used:
  - `eslint-plugin-json`: its rules run only through its processor on `.json` files, and no lint script and no webpack lint includes `.json`, so `plugin:json/recommended` enforces nothing today.
  - `eslint-config-react` and `eslint-plugin-chai-friendly`: listed in `devDependencies` but referenced by no config.
- TypeScript is 6.0.x, as MARK-8 pins it (`~6.0.3`), and must stay below 6.1. typescript-eslint 8.72.1 declares `typescript >=4.8.4 <6.1.0`, and with TypeScript 7.0.2 (npm's `latest`) it refuses to run: "typescript-eslint does not support TS 7.0". TypeScript is MARK-8's to choose, so this is a constraint on MARK-8 (stream channel, #1194). Measured: master's typescript-eslint 5 runs with TypeScript 6.0.3 and gives the same `lint:build` result as master, so MARK-8 can move TypeScript to 6.0.x without touching ESLint.
- Node is 24, as MARK-8 pins it in `.nvmrc` (stream channel, #1200; Doug's floor is 22). ESLint 9.39 needs `^18.18.0 || ^20.9.0 || >=21.1.0`. The measurements here used Node 22.17.1, and the finished plan was rerun on Node 24.14.0 with the same results, and again on MARK-8's implemented branch.

### Config files

- `.eslintrc.js`, `.eslintrc.build.js` and `.eslintrc.style.js` are replaced by `eslint.config.js`, `eslint.config.build.js` and `eslint.config.style.js`, and the old files are deleted.
- The build and style configs import the base config and append their own rules, as the old files extended `./.eslintrc.js`.
- The files are CommonJS (`require`, `module.exports`), like `webpack.config.js`, since `package.json` has no `"type": "module"`.
- Every package the config names, in a `require` or in a setting such as `import/parsers` or `import/resolver`, is a direct `devDependency`, not something reached through npm's hoisting.
- `dist/` stays ignored.

### Same rules enforced

The done condition is "the same rules enforced". It means:

- **Every rule the repo sets explicitly keeps its severity and options.** Where a rule has moved, it moves with its options:
  - `@typescript-eslint/semi` becomes `@stylistic/semi` (typescript-eslint 8 removed its formatting rules).
  - `eslint-comments/*` becomes `@eslint-community/eslint-comments/*`.
  - `@typescript-eslint/prefer-optional-chain` stays at `warn`. In typescript-eslint 8 it needs type information, so the TypeScript files under `src/` are linted with type information (`parserOptions.projectService`). Measured cost: the whole lint run takes 6 to 12 seconds. The Cypress files are outside `tsconfig.json`, so they lose this rule; it flags nothing there today.
  - `no-unused-expressions` with `allowShortCircuit: true`: typescript-eslint 8's recommended set adds `@typescript-eslint/no-unused-expressions` with default options, which would enforce a stricter copy of the repo's rule. The base rule is turned off and the typescript-eslint rule gets the repo's options, the same pattern the config already uses for `no-shadow` and `no-unused-vars`.
  - `@typescript-eslint/no-unused-vars` keeps `caughtErrors: "none"`, which was the default in typescript-eslint 5 and is no longer the default in 8. Without it, `catch (ex)` in `utils/codap-interface.ts:150` becomes a new warning.
  - `@typescript-eslint/no-empty-interface` is off in the repo. typescript-eslint 8 deprecates it, and its `recommended` set adds `no-empty-object-type`, which flags empty interfaces by default. That rule gets `allowInterfaces: "always"`, so empty interfaces stay allowed and the `{}` type stays banned, as `ban-types` did.
  - Unused `eslint-disable` comments are reported only by the build config, at `warn`, as now. ESLint 9 reports them everywhere by default, so the base config sets `linterOptions.reportUnusedDisableDirectives: "off"` and the build config sets it to `"warn"`. This replaces `eslint-comments/no-unused-disable`, which the plugin deprecated in 4.7.0 in favor of this option and which reports nothing under flat config (measured).
  - `eslint-plugin-react-hooks` 7's `recommended` preset adds about 15 React Compiler rules. Only `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn) are enabled, which is what version 4's `recommended` turned on.
  - The core formatting rules the repo sets (`quotes`, `jsx-quotes`, `max-len`, `eol-last`, `no-tabs`, `no-whitespace-before-property`, and the style config's `array-bracket-spacing` and `object-curly-spacing`) stay as core rules. They are deprecated but still run in ESLint 9 and 10. Only `semi` moves to `@stylistic`, because typescript-eslint 8 removed it.
- **The overrides keep their scope and rules:** Jest and Testing Library rules for `src/**/*.test.*`, Cypress rules for `cypress/**` (with `cypress/no-unnecessary-waiting` off), Node globals for the ESLint config files and `webpack.config.js`, and single quotes in `webpack.config.js`.
- **The shared presets follow their current versions.** `eslint:recommended`, typescript-eslint `recommended`, `import` `recommended` and `typescript`, `react` `recommended`, `eslint-comments` `recommended`, `jest` `recommended`, `testing-library` `react` and `cypress` `recommended` are used as their current versions define them, not pinned to the 2022 rule lists. The measured drift for a `.tsx` file in `src/`:
  - added: `no-constant-binary-expression`, `no-empty-static-block`, `no-unused-private-class-members`, `no-loss-of-precision` (core, replacing the typescript-eslint copy), `valid-typeof`, `@typescript-eslint/no-duplicate-enum-values`, `no-empty-object-type`, `no-unsafe-declaration-merging`, `no-unsafe-function-type`, `no-wrapper-object-types`
  - removed: `@typescript-eslint/ban-types` (split into the three `no-*-type` rules above), `no-empty-function`, `no-inferrable-types`, `no-non-null-assertion` and `adjacent-overload-signatures` (moved to typescript-eslint's `strict` or `stylistic` sets), `no-extra-semi` (removed from typescript-eslint), `no-var-requires` (deprecated in favor of `no-require-imports`), and the core `no-class-assign`, `no-with`, `no-inner-declarations` and `no-mixed-spaces-and-tabs` (now checked by TypeScript or deprecated)
  - changed options: `no-cond-assign` and `radix` now carry their default option explicitly; behavior unchanged
  - test files also move from Jest 26's and Testing Library 5's rule lists to Jest 29's and Testing Library 7's. `await-async-query`, `no-await-sync-query` and `no-render-in-setup` become `await-async-queries`, `no-await-sync-queries` and `no-render-in-lifecycle`; `await-async-events`, `no-await-sync-events`, `no-manual-cleanup`, `no-global-regexp-flag-in-query` and `jest/no-alias-methods` are added; `jest/no-jest-import` and `testing-library/no-wait-for-empty-callback` are dropped; and `testing-library/no-debugging-utils` goes from error to warn. MARK-20's six test files lint clean under the new lists (measured).
  - Cypress files gain `cypress/unsafe-to-chain-command`.

### Scripts and the webpack lint

- `lint`, `lint:fix`, `lint:build`, `lint:style` and `lint:style:fix` lint the same globs as now (`./src/**/*.{js,jsx,ts,tsx}` and `./cypress/**/*.{js,jsx,ts,tsx}`), with `-c` pointing at the new build and style files.
- `lint:style:fix` gains the `--fix` flag it is missing today (it currently only repeats `lint:style`).
- `eslint-webpack-plugin` 6 picks up `eslint.config.js` with its current options (`extensions: ['ts', 'tsx', 'js', 'jsx']`). Measured: it reads the flat config and fails the webpack build on a lint error.
- `npm run build` still runs `lint:build` and then webpack.

### Fix what the checker flags

After the move, every lint command finishes with no errors and no warnings:

- `npm run lint`: fix the one `no-constant-binary-expression` error (`allowDragging={true && !animating}` in `components/dataset.tsx:96` becomes `allowDragging={!animating}`), and the three `prefer-optional-chain` warnings in `components/app.tsx` (lines 206, 398, 499). typescript-eslint 8's version of that rule finds them; version 5's did not. Each rewrite keeps the behavior: `delimiter` is a `string` and `group` a `SequenceGroup`, so comparing them with `undefined` gives the same result as the `!x ||` guard it replaces.
- `npm run lint:build`: the 21 `no-console` warnings are all CODAP error reports through `console.log`. They become `console.error`, which the build config allows. MARK-20's two tests that silence an expected report (`utils/output-dataset.test.ts`, `utils/attribute-values.test.ts`) spy on `console.error` instead of `console.log`, or the report prints when those suites run on their own or with `--verbose`. The stale `eslint-disable-next-line @typescript-eslint/no-non-null-assertion` in `components/graph.tsx:148` is deleted, since that rule is no longer enabled and the build config reports the comment as unused.
- `npm run lint:style`: the 380 spacing errors are fixed with `lint:style:fix`. The fixes push four lines over the 120-character `max-len`, so those are wrapped by hand: `components/drawing/probability-selector.tsx:197`, `components/drawing/state-editor.test.ts:5` and `:21`, and `components/graph-utils.test.ts:23`.
- None of these fixes changes behavior. `tsc --noEmit`, `npm run build` and the 32 tests pass after them.

These counts are measured on MARK-8's implemented branch. If the base moves again, they are re-measured, and anything new is fixed the same way.

### Review shape

The reviewer is new to the repo, so the change is split so that the generated parts can be skimmed: dependency and lockfile changes, config and script changes, auto-fixed style changes, and hand fixes are separate commits.

Measured: every code fix except deleting the stale `eslint-disable` comment in `graph.tsx` is also clean under the old ESLint 8 configs. So the fixes can land before the move, and the dependency commit is the only one after which lint, and with it `npm run build`, fails (ESLint 9 cannot read the old configs). The config commit right after it makes both pass again.

### Done when

- `npm run lint`, `npm run lint:build` and `npm run lint:style` run on ESLint 9 and report no errors and no warnings.
- `npm run build` passes, including its webpack lint.
- In CODAP, generating sequences and clicking an output to highlight it work as before. The three rewritten conditions in `components/app.tsx` are the story's only logic changes, and MARK-20's unit tests do not reach `app.tsx`.
- The rule set matches the old one as described under "Same rules enforced", checked by comparing `--print-config` output for a `src` component, a `src` test file and a Cypress file under each of the three configs. `--print-config` accepts a path that does not exist (checked on both ESLint 8 and 9), such as `src/x.test.tsx`.

## Technical Notes

- Verified in a throwaway copy of the repo (since deleted) with Node 22.17.1: ESLint 9.39.5 plus the target packages install with no peer conflicts once the old ESLint packages are uninstalled first. Installing over the old lockfile without uninstalling fails on the old typescript-eslint 5 peers.
- ESLint 10 (10.13.0) installs only with `--legacy-peer-deps`, and then `eslint-plugin-react` 7.37.5 crashes on the first file (`contextOrFilename.getFilename is not a function`, and `sourceCode.isSpaceBetweenTokens is not a function` with a pinned React version). Its latest release is from April 2025. ESLint 9 is on npm's `maintenance` tag and was last patched 2026-07-10, but npm marks 9.39.5 deprecated ("This version is no longer supported"), and `npm install` and `npm ci` print that warning (see the Maintenance Engineer item under Self-Review).
- The picked versions also keep the later move to ESLint 10 small: every target except `eslint`, `@eslint/js` and `eslint-plugin-react` already declares ESLint 10 support (`eslint-plugin-import` 2.32 does not declare it either and was not reached in the crash test).
- Typed linting is scoped to `src/**/*.{ts,tsx}`. `tsconfig.json` includes only `./src/**/*`, so the Cypress files have no project to type-check against.
- The current rule baseline for each config and file type was captured with `eslint --print-config` before the change, which is how the drift above was measured. ESLint 9's `--print-config` writes out every rule's default options (for example `no-sequences` gains `{"allowInParentheses":true}`) where ESLint 8 printed none, so the comparison has to read those as unchanged. With that allowance, the only changes to explicitly set rules are the intended ones above: `caughtErrors: "none"`, the `no-unused-expressions` and `no-empty-interface` moves, `no-unused-disable` becoming a linter option in the build config, and `prefer-optional-chain` leaving the Cypress files.
- VS Code: `.vscode/settings.json` sets nothing ESLint-specific, and the ESLint extension finds `eslint.config.js` on its own.

- Verified the same way: after all the fixes, the three ESLint 9 configs exit 0 with no output, `tsc --noEmit` passes, and the production webpack build compiles. On MARK-8's implemented branch the source changes come to 26 files, +211 / -205, nearly all of it the whitespace auto-fix.

## Out of Scope

- ESLint 10. It is a follow-up once `eslint-plugin-react` declares ESLint 10 support (noted for Doug by the stream orchestrator, #1223). Measured today, it would need `@eslint/compat`'s `fixupPluginRules` around `eslint-plugin-react`, npm `overrides` for the peer ranges of `eslint-plugin-react` and `eslint-plugin-import`, and one more fix (`no-useless-assignment`, `utils/codap-helper.ts:217`).
- Running `lint:style` in CI, or folding the style rules into the base config.
- Moving the deprecated core formatting rules to `@stylistic` beyond `semi`.
- Turning on typescript-eslint's `strict` or `stylistic` presets, or the React Compiler rules from `eslint-plugin-react-hooks`.
- Linting `.json` files.
- Node, TypeScript, webpack, Jest and Cypress versions, and GitHub Actions (MARK-8).
- Changing what the CODAP error reports say, or adding logging (user story 7).

## Open Questions

### RESOLVED: Judgment call: ESLint 9 or ESLint 10?
**Context**: The user story asks for ESLint's current major version, which is 10 (10.13.0). The technical details and the done condition say 9.
**Options considered**:
- A) ESLint 9.39.x, with every other package on a version that also supports 10 where one exists
- B) ESLint 10 with `--legacy-peer-deps` overrides
- C) ESLint 10, replacing `eslint-plugin-react` with `@eslint-react/eslint-plugin`

**Decision**: A. B was measured: `eslint-plugin-react` crashes on ESLint 10. (Wrapping it in `@eslint/compat`'s `fixupPluginRules` avoids the crash; see the Maintenance Engineer item under Self-Review.) C changes the rule set, against "the same rules enforced".

### RESOLVED: Judgment call: keep `prefer-optional-chain` by adding typed linting, or drop it?
**Context**: typescript-eslint 8 made the rule type-aware. Without type information it throws, so the lint run fails rather than skipping the rule.
**Options considered**:
- A) Lint `src/**/*.{ts,tsx}` with `projectService` and keep the rule at `warn`
- B) Drop the rule

**Decision**: A. The repo set this rule on purpose, and the measured cost is small (the full run takes 6 to 12 seconds). It finds three spots version 5 missed, which are fixed.

### RESOLVED: Judgment call: pin the 2022 preset rule lists, or follow the current presets?
**Context**: "The same rules enforced" could mean the full effective rule list, including what the presets turned on in 2022.
**Options considered**:
- A) Keep every explicit rule; let the presets be their current versions, and record the drift
- B) Re-add each rule the presets dropped and turn off each one they added

**Decision**: A. The presets are maintained lists, and their changes track the language and the plugins (for example `ban-types` split into three rules). B would hand-maintain about 25 rules against upstream. The new preset rules flag one line, which is fixed.

### RESOLVED: Judgment call: fix the 21 `no-console` warnings?
**Context**: They predate this story and are warnings, not errors, so `npm run build` passes with them.
**Options considered**:
- A) Change the `console.log` calls on CODAP errors to `console.error`
- B) Leave them

**Decision**: A, because the story's scope is to update the checker and fix what it flags. They are all error reports, so `console.error` is the right level, and the change does not alter what is reported.

### RESOLVED: Low confidence: will MARK-8 leave TypeScript at 6.0.x or below?
**Context**: typescript-eslint 8 supports TypeScript below 6.1, and refuses TypeScript 7.0 (measured). If MARK-8 moved to TypeScript 7, MARK-9 could not be done as written.
**Options considered**:
- A) MARK-8 caps TypeScript at 6.0.x (or 5.9.x); MARK-9 proceeds as written
- B) MARK-8 moves to TypeScript 7; MARK-9 waits for a typescript-eslint release that supports it

**Decision**: A. MARK-8's requirements pin `typescript` `~6.0.3` (its R3), for the same reason plus `ts-jest`'s `<7`. Its R4 also changes `tsconfig.json` (`moduleResolution: "bundler"`, no `outDir`) and adds a `*.scss` declaration to `src/global.d.ts`. Re-verified with TypeScript 6.0.3 and those changes: `tsc --noEmit` passes, all three ESLint 9 configs are clean after the fixes, and the typed `prefer-optional-chain` rule still finds the same three spots on master's `app.tsx`.

### RESOLVED: Is the manual CODAP check part of the done condition?
**Context**: Cross-reference found the plan's manual check in CODAP with no requirement behind it. Jira's done condition covers only the lint commands.
**Options considered**:
- A) Keep it, and add generating sequences and highlighting an output in CODAP to the done condition
- B) Drop it, and rely on lint, `tsc --noEmit` and the production build

**Decision**: A (Doug, through the stream orchestrator, #1202). The three rewritten conditions in `app.tsx` are the only logic changes in the story, and there are no tests until MARK-10.

## Self-Review

Roles: Senior Engineer, QA Engineer, Code Reviewer (new to the repo), DevOps Engineer, and in the second round Maintenance Engineer. Only findings confirmed in the scratch copy are recorded.

### Senior Engineer

#### RESOLVED: `@typescript-eslint/parser` would be reached only through hoisting
The `import/parsers` setting (the repo's own, and the one in `eslint-plugin-import`'s `typescript` config) loads `@typescript-eslint/parser` by name from `eslint-module-utils`. With only the `typescript-eslint` meta package declared, that worked from a clean `npm ci`. It broke with "Cannot find module '@typescript-eslint/parser'" on every import after an unrelated `npm install --no-save` rearranged `node_modules`. Fixed in place: the parser stays a direct `devDependency`, and a requirement says every package the config names is declared.

#### RESOLVED: the build config did not report unused `eslint-disable` comments
Running the plan's config, the build config stayed silent on both a fresh unused directive and the stale `graph.tsx` one, where ESLint 8's build config warns. `@eslint-community/eslint-comments/no-unused-disable` is deprecated since 4.7.0 and works by patching `Linter#verify`, which has no effect under flat config. Fixed in place: the build config sets ESLint's own `linterOptions.reportUnusedDisableDirectives: "warn"` and the rule is dropped. Measured: base and style configs silent, build config warns on both, all lint commands still clean, and the rule comparison changes only by this swap.

### QA Engineer

#### RESOLVED: the rule comparison needs a test file that does not exist
The done condition compares `--print-config` for a `src` test file, and there are none until MARK-10. Checked: both ESLint 8 and 9 print the config for a path that does not exist. Fixed in place in the done condition.

#### RESOLVED: the recorded drift did not match a rerun of the comparison
Rerunning `--print-config` on all three configs showed drift the spec did not list: the Cypress files lose the explicitly set `prefer-optional-chain` (no project to type-check against), and the test-file list missed `jest/no-alias-methods`, `await-async-events`, `no-await-sync-events`, two dropped rules and `no-debugging-utils` moving to warn. `no-var-requires` is deprecated in typescript-eslint 8, not removed. Fixed in place in "Same rules enforced" and the Technical Notes.

### Code Reviewer

#### RESOLVED: a dependency-only commit leaves lint broken
Splitting dependencies from config means one commit where ESLint 9 is installed and only the old configs exist. Measured which fixes are valid under ESLint 8, so the fixes can land first as green commits, and the broken window is exactly one commit. Recorded under "Review shape"; the order itself is the implementation spec's.

### Maintenance Engineer

#### RESOLVED: ESLint 9 is itself out of support
npm marks `eslint@9.39.5` deprecated ("This version is no longer supported"), and `npm ci` prints that warning. ESLint 10.0.0 shipped 2026-02-06 and 9.x was last patched 2026-07-10. That contradicted the Overview's "stays on supported versions" and is new evidence on the resolved ESLint 9 or 10 question. Measured in a scratch copy: ESLint 10.13.0 with `eslint-plugin-cypress` 7 runs the plan's config once `eslint-plugin-react` is wrapped with `@eslint/compat`'s `fixupPluginRules` (its rules fire normally), and adds one error (`no-useless-assignment`, `utils/codap-helper.ts:217`). But `npm ci` then fails on the `eslint-plugin-react` and `eslint-plugin-import` peer ranges, so it also needs `--legacy-peer-deps` or `package.json` `overrides`.
- A) Keep ESLint 9, as Jira's done condition says, and reword both overviews to say flat config is what makes the later move to 10 small.
- B) Move to ESLint 10 now: `fixupPluginRules`, peer `overrides`, and the extra fix.
- C) A, plus a follow-up story for ESLint 10 once `eslint-plugin-react` supports it.

**Decision**: C (Doug, through the stream orchestrator, #1223). No compatibility shim or overrides in a 2-point optional story whose reviewer is new to the repo. Both overviews now say ESLint 9 is the newest major `eslint-plugin-react` runs on and that npm marks it deprecated, and ESLint 10 is listed under Out of Scope as the follow-up.

### Senior Engineer (third round)

#### RESOLVED: Background described the branch as cut from master
It now sits on MARK-8's branch, which so far holds only MARK-8's spec. Fixed in place in "Where this sits in the stack".
