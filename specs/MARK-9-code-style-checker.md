# Update the Markov Plugin's Code Style Checker

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-9

**Status**: **Closed**

## Overview

Move the plugin's linter from ESLint 8 to ESLint 9, converting its three legacy config files to the flat config format, and fix what the updated checker flags, without changing which rules the team enforces. ESLint 9 is the newest major the plugin's React lint rules run on; npm marks it deprecated, and the flat config is what keeps the later move to ESLint 10 small. Nothing a student, teacher or researcher sees changes.

The branch sits on MARK-8's (build and test tooling), which sits on MARK-20's and MARK-6's. Every ESLint package and the ESLint config belong to this story; MARK-8 owns Node (24), TypeScript (`~6.0.3`), webpack, Jest, Cypress and GitHub Actions.

## Requirements

### Target versions

- ESLint moves to the latest 9.x (9.39.5 when measured), not 10.
- Each ESLint package ends on a version that supports ESLint 9 and flat config:

  | Package | Before | After | Note |
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
  | `eslint-plugin-react-hooks` | 4.6 | 7.x | only its two classic rules are enabled |
  | `eslint-plugin-jest` | 26.9 | 29.x | |
  | `eslint-plugin-testing-library` | 5.6 | 7.x | |
  | `eslint-plugin-cypress` | 2.12 | 6.x | 7.x requires ESLint 10 |
  | `eslint-webpack-plugin` | 3.2 | 6.x | flat config is its default |

- `eslint-plugin-json`, `eslint-config-react` and `eslint-plugin-chai-friendly` are removed: none of them enforced anything (no lint command includes `.json`, and the other two were referenced by no config).
- TypeScript stays below 6.1: typescript-eslint 8 declares `typescript >=4.8.4 <6.1.0` and refuses to run on TypeScript 7.0. This is a constraint on MARK-8, which pins `~6.0.3`.

### Config files

- `eslint.config.js`, `eslint.config.build.js` and `eslint.config.style.js` replace `.eslintrc.js`, `.eslintrc.build.js` and `.eslintrc.style.js`, which are deleted.
- The build and style configs import the base config and append their own rules.
- The files are CommonJS, like `webpack.config.js`.
- Every package the config names, in a `require` or in a setting such as `import/parsers` or `import/resolver`, is a direct `devDependency`.
- `dist/` stays ignored.

### Same rules enforced

- Every rule the repo sets explicitly keeps its severity and options. Where a rule has moved, it moves with its options:
  - `@typescript-eslint/semi` becomes `@stylistic/semi`, and `eslint-comments/*` becomes `@eslint-community/eslint-comments/*`.
  - `@typescript-eslint/prefer-optional-chain` stays at `warn`. It needs type information in typescript-eslint 8, so `src/**/*.{ts,tsx}` is linted with `parserOptions.projectService`. The Cypress files are outside `tsconfig.json` and lose the rule; it flagged nothing there.
  - `no-unused-expressions` (`allowShortCircuit: true`) moves to `@typescript-eslint/no-unused-expressions` with the same option, and the core rule is turned off.
  - `@typescript-eslint/no-unused-vars` writes out `caughtErrors: "none"`, the typescript-eslint 5 default that 8 changed.
  - `@typescript-eslint/no-empty-object-type` gets `allowInterfaces: "always"`, so empty interfaces stay allowed (as `no-empty-interface: "off"` allowed them) and the `{}` type stays banned (as `ban-types` banned it).
  - Unused `eslint-disable` comments are reported only by the build config, at `warn`, through ESLint's `linterOptions.reportUnusedDisableDirectives` (`"off"` in the base config). This replaces `eslint-comments/no-unused-disable`, which is deprecated and reports nothing under flat config.
  - Only `react-hooks/rules-of-hooks` (error) and `react-hooks/exhaustive-deps` (warn) are enabled, as in version 4's `recommended`, not version 7's React Compiler rules.
  - The deprecated core formatting rules the repo sets (`quotes`, `jsx-quotes`, `max-len`, `eol-last`, `no-tabs`, `no-whitespace-before-property`, `array-bracket-spacing`, `object-curly-spacing`) stay as core rules.
- The overrides keep their scope and rules: Jest and Testing Library for `src/**/*.test.*`, Cypress for `cypress/**` (with `cypress/no-unnecessary-waiting` off), Node globals for the ESLint configs and `webpack.config.js`, and single quotes in `webpack.config.js`.
- The shared presets follow their current versions rather than the 2022 rule lists. The measured drift:
  - added: `no-constant-binary-expression`, `no-empty-static-block`, `no-unused-private-class-members`, core `no-loss-of-precision` (replacing the typescript-eslint copy), `valid-typeof`, `@typescript-eslint/no-duplicate-enum-values`, `no-empty-object-type`, `no-unsafe-declaration-merging`, `no-unsafe-function-type`, `no-wrapper-object-types`
  - removed: `@typescript-eslint/ban-types` (split into the three `no-*-type` rules), `no-empty-function`, `no-inferrable-types`, `no-non-null-assertion`, `adjacent-overload-signatures`, `no-extra-semi`, `no-var-requires`, and the core `no-class-assign`, `no-with`, `no-inner-declarations`, `no-mixed-spaces-and-tabs`
  - test files move to Jest 29's and Testing Library 7's lists: `await-async-query`, `no-await-sync-query` and `no-render-in-setup` become `await-async-queries`, `no-await-sync-queries` and `no-render-in-lifecycle`; `await-async-events`, `no-await-sync-events`, `no-manual-cleanup`, `no-global-regexp-flag-in-query` and `jest/no-alias-methods` are added; `jest/no-jest-import` and `testing-library/no-wait-for-empty-callback` are dropped; `testing-library/no-debugging-utils` goes from error to warn
  - Cypress files gain `cypress/unsafe-to-chain-command`

### Scripts and the webpack lint

- The five lint scripts lint the same globs as before, with `-c` pointing at the new build and style files.
- `lint:style:fix` gains the `--fix` flag it was missing.
- `eslint-webpack-plugin` 6 reads `eslint.config.js` with its existing options and fails the webpack build on a lint error. `npm run build` still runs `lint:build` and then webpack.

### Fix what the checker flags

- `npm run lint`: `allowDragging={true && !animating}` in `components/dataset.tsx` becomes `allowDragging={!animating}`, and three guards in `components/app.tsx` become optional chains with the same behavior.
- `npm run lint:build`: the 21 `console.log` calls on CODAP errors (`utils/codap-helper.ts`, `utils/output-dataset.ts`, `utils/attribute-values.ts`) become `console.error`, and the two tests that silence an expected report spy on `console.error`. The stale `no-non-null-assertion` disable comment in `components/graph.tsx` is deleted.
- `npm run lint:style`: the 380 spacing errors are auto-fixed, and four lines the fix would push past 120 characters are wrapped by hand first.
- None of the fixes changes behavior.

### Review shape

- Four commits, so the reviewer can skim the generated parts: hand fixes (valid on ESLint 8), the whitespace-only auto-fix, dependencies and lockfile, then config and scripts. The dependency commit is the only one after which lint and `npm run build` fail.

### Done when

- `npm run lint`, `npm run lint:build` and `npm run lint:style` run on ESLint 9 with no errors and no warnings.
- `npm run build` passes, including its webpack lint.
- In CODAP, generating sequences and clicking an output to highlight and clear it work as before. The `app.tsx` conditions are the story's only logic changes, and no unit test reaches `app.tsx`.
- The rule set matches the old one as described above, checked by comparing `--print-config` for a `src` component, a `src` test file (a nonexistent path such as `src/x.test.tsx` works) and a Cypress file under each of the three configs.

## Technical Notes

- The old ESLint packages must be uninstalled before the new ones are installed; installing over the old lockfile fails on typescript-eslint 5's ESLint 8 peer range. If a later rebase conflicts in `package-lock.json`, take the base's lockfile and rerun the uninstall and install commands from the source spec.
- npm prints `npm warn deprecated eslint@9.39.5: This version is no longer supported` on every `npm install` and `npm ci`.
- Every target except `eslint`, `@eslint/js`, `eslint-plugin-react` and `eslint-plugin-import` already declares ESLint 10 support.
- ESLint 9's `--print-config` writes out every rule's default options where ESLint 8 printed none, so a comparison has to treat those as unchanged. Sorting keys with `JSON.stringify(obj, Object.keys(obj).sort())` drops nested option keys and hides changes.
- `npx jest --verbose` shows console output from passing tests; a plain `npm test` hides it, so it cannot show a missed console spy.
- VS Code's ESLint extension finds `eslint.config.js` on its own; `.vscode/settings.json` needs no change.

## Out of Scope

- ESLint 10, a follow-up once `eslint-plugin-react` declares support. Today it would need `@eslint/compat`'s `fixupPluginRules` around `eslint-plugin-react`, npm `overrides` for the peer ranges of `eslint-plugin-react` and `eslint-plugin-import`, and one more fix (`no-useless-assignment` in `utils/codap-helper.ts`).
- Running `lint:style` in CI, or folding the style rules into the base config.
- Moving the deprecated core formatting rules to `@stylistic` beyond `semi`.
- typescript-eslint's `strict` or `stylistic` presets, and the React Compiler rules.
- Linting `.json` files.
- Node, TypeScript, webpack, Jest and Cypress versions, and GitHub Actions (MARK-8).
- Changing what the CODAP error reports say, or adding logging.

## Decisions

### Requirements decisions

### ESLint 9 or ESLint 10?
**Context**: The user story asks for ESLint's current major, which is 10; the Jira details and done condition say 9. npm marks ESLint 9 deprecated.
**Options considered**:
- A) ESLint 9.39.x, with every other package on a version that also supports 10 where one exists
- B) ESLint 10 now, with `fixupPluginRules`, peer `overrides` and the extra fix
- C) A, plus a follow-up story for ESLint 10 once `eslint-plugin-react` supports it

**Decision**: C (Doug, #1223). `eslint-plugin-react` 7.37.5, its latest release, crashes on ESLint 10 without a shim. No compatibility shim or overrides in a 2-point optional story whose reviewer is new to the repo; the flat config is the hard part of reaching 10.

---

### Keep `prefer-optional-chain` by adding typed linting, or drop it?
**Context**: typescript-eslint 8 made the rule type-aware; without type information the lint run fails.
**Options considered**:
- A) Lint `src/**/*.{ts,tsx}` with `projectService` and keep the rule at `warn`
- B) Drop the rule

**Decision**: A. The repo set the rule on purpose, the cost is a few seconds per lint run, and it found three spots version 5 missed.

---

### Pin the 2022 preset rule lists, or follow the current presets?
**Context**: "The same rules enforced" could mean the full effective rule list, including what the presets turned on in 2022.
**Options considered**:
- A) Keep every explicit rule, let the presets be their current versions, and record the drift
- B) Re-add each rule the presets dropped and turn off each one they added

**Decision**: A. The presets track the language and plugins (for example `ban-types` split into three rules); B would hand-maintain about 25 rules. Where a preset rule replaces one the repo had turned off (`no-empty-object-type` for `no-empty-interface`), it gets the repo's behavior.

---

### Fix the 21 `no-console` warnings?
**Context**: They predate the story and are warnings, so `npm run build` passed with them.
**Options considered**:
- A) Change the `console.log` calls on CODAP errors to `console.error`
- B) Leave them

**Decision**: A. Fixing what the checker flags is the story's scope, they are all error reports, and the change does not alter what is reported.

---

### Will MARK-8 leave TypeScript at 6.0.x or below?
**Context**: typescript-eslint 8 refuses TypeScript 7.0, so MARK-9 could not be done as written if MARK-8 moved to 7.
**Options considered**:
- A) MARK-8 caps TypeScript at 6.0.x; MARK-9 proceeds as written
- B) MARK-8 moves to TypeScript 7; MARK-9 waits for typescript-eslint support

**Decision**: A. MARK-8 pins `~6.0.3` for the same reason plus `ts-jest`'s `<7`.

---

### Is the manual CODAP check part of the done condition?
**Context**: Jira's done condition covers only the lint commands.
**Options considered**:
- A) Keep it: generate sequences and highlight an output in CODAP
- B) Drop it and rely on lint, `tsc` and the build

**Decision**: A (Doug, #1202). The three rewritten conditions in `app.tsx` are the only logic changes, and no unit test reaches them.

---

### Declare `@typescript-eslint/parser` directly?
**Context**: The `import/parsers` setting loads the parser by name. With only `typescript-eslint` declared, it worked from a clean `npm ci` but broke with "Cannot find module" once an unrelated install rearranged `node_modules`.
**Options considered**:
- A) Declare it at the same major as `typescript-eslint` and bump the two together
- B) Rely on npm hoisting it from `typescript-eslint`

**Decision**: A. npm dedupes the two to one copy, and the requirement that every package the config names is declared covers it.

---

### How to report unused `eslint-disable` comments?
**Context**: `@eslint-community/eslint-comments/no-unused-disable` is deprecated and silently reports nothing under flat config, where ESLint 8's build config warned.
**Options considered**:
- A) ESLint's own `linterOptions.reportUnusedDisableDirectives`, `"off"` in the base config and `"warn"` in the build config
- B) Keep the plugin rule

**Decision**: A. It is the plugin's documented replacement, and only the build config reports, as before.

---

### Implementation decisions

### Hand fixes before the move, or after it?
**Context**: Splitting dependencies from config means one commit where ESLint 9 is installed with only the old configs.
**Options considered**:
- A) Hand fixes and auto-fix first, on ESLint 8; then dependencies; then config
- B) Dependencies, config, then fixes on ESLint 9

**Decision**: A. All but one fix (the `graph.tsx` comment) are clean under ESLint 8, so lint is broken after exactly one commit; B leaves it broken across three. The auto-fix output is identical on ESLint 8 and 9.

---

### CommonJS config files, or `eslint.config.mjs`?
**Context**: `package.json` has no `"type": "module"`.
**Options considered**:
- A) `eslint.config.js` in CommonJS, like `webpack.config.js`
- B) `.mjs` files with `import`

**Decision**: A. It matches the repo's other config files and Jira's file names, and every plugin ships a CommonJS entry.

---

### `defineConfig` or `tseslint.config()`?
**Context**: typescript-eslint 8.72 marks its own `tseslint.config()` deprecated.
**Options considered**:
- A) ESLint's `defineConfig` from `eslint/config`
- B) `tseslint.config()`

**Decision**: A. The effective config is byte-identical for every file and config pair.

---

### Wrap the long lines before the auto-fix
**Context**: The auto-fix adds spaces inside braces, which pushes `probability-selector.tsx:197` and three test array literals to 121 and 122 characters.
**Decision**: Wrap them in the hand-fix commit, written in the files' existing spacing, so the auto-fix commit stays pure ESLint output and passes `max-len` as it lands.
