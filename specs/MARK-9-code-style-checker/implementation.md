# Implementation Plan: Update the Markov Plugin's Code Style Checker

**Jira**: https://concord-consortium.atlassian.net/browse/MARK-9
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Before starting

- The branch sits on MARK-8's implemented branch, which carries MARK-6's and MARK-20's code. MARK-8 pins Node 24 in `.nvmrc`. Use it for every command here (`nvm use`). The plan was verified on Node 22.17.1 and again on 24.14.0.
- The counts below were measured on MARK-8's implemented branch: `lint` clean, `lint:build` 21 `no-console` warnings, `lint:style` 380 errors in 25 files, `tsc` clean, `npm test` 32 tests passing. MARK-8 leaves every ESLint package and the three `.eslintrc` files as they are on master. If the base moves again, re-measure (`npm ci`, then the three lint commands) and fix any extra findings in the same steps below, by the same rules.
- Confirm `npx tsc -v` is 6.0.x (MARK-8 pins `~6.0.3`; typescript-eslint 8 declares support below 6.1 and refuses to run on 7.0). Every step below was rerun on MARK-8's implemented branch (TypeScript 6.0.3, Jest 30) with the results given here.

## Implementation Plan

The four steps are the four commits, in this order. The order is chosen so the review can skim the generated parts. The hand fixes come first and are small. The auto-fix is whitespace only. The dependency commit is the only one after which lint, and with it `npm run build`, fails, and the config commit right after it makes both pass again. Every step was run end to end in a scratch copy of the repo.

### Fix the code the updated checker flags

**Summary**: The hand-written code changes, made while still on ESLint 8. Each is clean under the old configs (measured), so this commit passes `lint` and `lint:build`. `lint:style` still shows its 380 existing spacing errors, which the next commit fixes.

**Files affected**:
- `src/components/dataset.tsx`: `allowDragging={true && !animating}` becomes `allowDragging={!animating}` (ESLint 9's `no-constant-binary-expression`)
- `src/components/app.tsx`: three optional chains (typescript-eslint 8's `prefer-optional-chain`)
- `src/components/drawing/probability-selector.tsx`: wrap one JSX line that the next commit's spacing would push to 121 characters
- `src/components/drawing/state-editor.test.ts` (two lines), `src/components/graph-utils.test.ts` (one line): wrap array literals that the next commit's spacing would push to 121 and 122 characters
- `src/utils/codap-helper.ts`, `src/utils/output-dataset.ts`, `src/utils/attribute-values.ts`: 21 `console.log` calls on CODAP errors become `console.error` (`no-console` in the build config)
- `src/utils/output-dataset.test.ts`, `src/utils/attribute-values.test.ts`: the `jest.spyOn(console, "log")` that silences an expected error report becomes `jest.spyOn(console, "error")`, or the report prints when those suites run on their own or with `--verbose`

**Estimated diff size**: 10 files, +39 / -32 (measured)

`src/components/app.tsx`, in `generateNewSequence` (line 206):

```tsx
// before
      if (!currentAnimatedSequenceGroup.current ||
        (currentAnimatedSequenceGroup.current.delimiter !== delimiter) ||
// after
      if ((currentAnimatedSequenceGroup.current?.delimiter !== delimiter) ||
```

In `toggleHighlightOutput` (line 398):

```tsx
// before
    if (!highlightOutput || (highlightOutput.group !== group) || (highlightOutput.sequence !== sequence)) {
// after
    if ((highlightOutput?.group !== group) || (highlightOutput.sequence !== sequence)) {
```

In the output list's `clsx` call (line 499):

```tsx
// before
                            highlightOutput && highlightOutput.group === group && highlightOutput.sequence === s
// after
                            highlightOutput?.group === group && highlightOutput.sequence === s
```

Each keeps the behavior. `delimiter` is a `string` and `group` a `SequenceGroup`, so when the left side is `undefined` the `!==` comparison is `true`, as the removed `!x ||` guard was. TypeScript narrows the right-hand operands the same way (`tsc --noEmit` passes). The `highlighted` value can now be `false` where it was `undefined`, and `clsx` treats both as off.

`src/components/drawing/probability-selector.tsx` (line 197), written in the file's current spacing so the next commit's auto-fix handles the braces:

```tsx
// before
          <div key={i} style={{color: isDrawingMode ? getDistinctColor(i) : "#000"}}>To {edgeLabels[i]}: {p}%</div>
// after
          <div key={i} style={{color: isDrawingMode ? getDistinctColor(i) : "#000"}}>
            To {edgeLabels[i]}: {p}%
          </div>
```

The rendered text is unchanged: JSX drops the line break and indentation around `To ... %`.

The three test lines are wrapped the same way, the array on its own line between the brackets:

```ts
// before
    const edges = [{from: "a", to: "b", value: 1}, {from: "a", to: "c", value: 1}, {from: "a", to: "d", value: 1}];
// after
    const edges = [
      {from: "a", to: "b", value: 1}, {from: "a", to: "c", value: 1}, {from: "a", to: "d", value: 1}
    ];
```

`console.log` to `console.error`: every non-comment `console.log` in the three files. Leave the commented-out `// console.log(...)` lines alone. A sed that does exactly this (measured: it leaves 0 live `console.log` calls in any of them, and touches no comment):

```bash
sed -i -E 's/^(\s+)console\.log\(/\1console.error(/; s/(catch\(\(?[a-z]*\)? => )console\.log\(/\1console.error(/' \
  src/utils/codap-helper.ts src/utils/output-dataset.ts src/utils/attribute-values.ts
sed -i 's/jest.spyOn(console, "log")/jest.spyOn(console, "error")/' \
  src/utils/output-dataset.test.ts src/utils/attribute-values.test.ts
```

Check before committing: `npx tsc --noEmit`, `npm run lint` (clean), `npm run lint:build` (clean, where the base has 21 warnings), and `npm test` (32 pass). Then run `npx jest --verbose` and check that no `console.error` block prints. A plain `npm test` hides console output (measured), so it cannot show a missed spy; `--verbose` shows the output of both changed tests.

---

### Apply the style config's auto-fixes

**Summary**: The 380 `object-curly-spacing` and `react/jsx-curly-spacing` errors, fixed by ESLint itself and nothing else, so the reviewer can confirm the commit is whitespace only with `git show -w --format= <sha>` (empty output; plain `git show -w` still prints the commit header and message).

**Files affected**: 25 files under `src/components`, `src/hooks` and `src/utils`, MARK-20's tests and modules included (the list `lint:style` prints on the base)

**Estimated diff size**: 25 files, ±177 lines (measured), whitespace only

```bash
npx eslint -c .eslintrc.style.js --fix "./src/**/*.{js,jsx,ts,tsx}" "./cypress/**/*.{js,jsx,ts,tsx}"
```

Run ESLint directly: the current `lint:style:fix` script is missing `--fix`, which the config step corrects. Check: `npm run lint:style` reports nothing, and `git diff -w` is empty.

---

### Move the ESLint packages to ESLint 9

**Summary**: Only `package.json` `devDependencies` and `package-lock.json`, produced by two npm commands, so the reviewer reads the commands rather than the lockfile. Lint does not run after this commit alone (ESLint 9 cannot read `.eslintrc.js`), so `npm run build` and `npm start` fail too, through `lint:build` and the webpack lint (`[eslint] Could not find config file.`). `tsc` and `npm test` still pass. The next commit restores all of it. The commit message says so.

**Files affected**:
- `package.json`: `devDependencies` only
- `package-lock.json`: generated

**Estimated diff size**: `package.json` +15 / -15 (measured); the lockfile is generated

Uninstall first. Installing over the old lockfile without this fails on typescript-eslint 5's ESLint 8 peer range (measured):

```bash
npm uninstall eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-config-react eslint-plugin-chai-friendly eslint-plugin-cypress eslint-plugin-eslint-comments \
  eslint-plugin-import eslint-plugin-jest eslint-plugin-json eslint-plugin-react eslint-plugin-react-hooks \
  eslint-plugin-testing-library eslint-webpack-plugin eslint-import-resolver-typescript
```

Then install the targets. The majors are written out so a later run gives the same majors. `eslint-plugin-cypress` is held at 6 because 7 requires ESLint 10:

```bash
npm install --save-dev eslint@9 @eslint/js@9 typescript-eslint@8 @typescript-eslint/parser@8 \
  @stylistic/eslint-plugin@5 globals@17 @eslint-community/eslint-plugin-eslint-comments@4 \
  eslint-plugin-import@2 eslint-import-resolver-typescript@4 eslint-plugin-react@7 eslint-plugin-react-hooks@7 \
  eslint-plugin-jest@29 eslint-plugin-testing-library@7 eslint-plugin-cypress@6 eslint-webpack-plugin@6
```

Measured result on 2026-10-26, and the same on MARK-8's implemented branch on 2026-10-27: `eslint` 9.39.5, `@eslint/js` 9.39.5, `typescript-eslint` and `@typescript-eslint/parser` 8.72.1 (one copy, deduped), `@stylistic/eslint-plugin` 5.10.0, `globals` 17.13.0, `@eslint-community/eslint-plugin-eslint-comments` 4.8.1, `eslint-plugin-import` 2.32.0, `eslint-import-resolver-typescript` 4.4.5, `eslint-plugin-react` 7.37.5, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-jest` 29.17.0, `eslint-plugin-testing-library` 7.16.2, `eslint-plugin-cypress` 6.4.4, `eslint-webpack-plugin` 6.0.0. No peer warnings, but npm prints `npm warn deprecated eslint@9.39.5: This version is no longer supported` here and on every `npm ci` (requirements, Self-Review). `npm` writes caret ranges (`^9.39.5`), as the rest of `package.json` uses. Beyond the ESLint packages, the lockfile changes only the shared helpers the plugins depend on (for example `es-abstract`, `espree`, `ajv` 6); no Babel, Jest, TypeScript or webpack package moves (measured). The lockfile stays at version 2.

Run both commands on the rebased branch's lockfile. If a later rebase conflicts in `package-lock.json`, take the base's lockfile and rerun the two commands rather than hand-merging.

---

### Convert the ESLint config to flat config

**Summary**: The three new config files, the deleted old ones, the scripts pointing at them, and the one source line the new build config would otherwise report. After this commit every lint command and `npm run build` pass.

**Files affected**:
- `eslint.config.js`, `eslint.config.build.js`, `eslint.config.style.js`: new
- `.eslintrc.js`, `.eslintrc.build.js`, `.eslintrc.style.js`: deleted
- `package.json`: the `lint:build`, `lint:style` and `lint:style:fix` scripts
- `src/components/graph.tsx`: delete the `eslint-disable-next-line @typescript-eslint/no-non-null-assertion` comment (line 148), which the build config now reports as unused because typescript-eslint 8's `recommended` no longer enables that rule
- `webpack.config.js`: unchanged. `eslint-webpack-plugin` 6 reads `eslint.config.js` by default (measured: it fails the build on a lint error and passes when clean)

**Estimated diff size**: 8 files, +206 / -164 (measured: three new config files, three deleted, three script lines, one source line; `git show --stat` reports 7 files, +201 / -159, because it pairs `.eslintrc.build.js` with `eslint.config.build.js` as a rename)

`eslint.config.js` (the order of the shared presets matters: the repo's block comes after them so its rules win):

```js
const js = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const comments = require("@eslint-community/eslint-plugin-eslint-comments/configs");
const importPlugin = require("eslint-plugin-import");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const jest = require("eslint-plugin-jest");
const testingLibrary = require("eslint-plugin-testing-library");
const cypress = require("eslint-plugin-cypress");
const stylistic = require("@stylistic/eslint-plugin");
const globals = require("globals");

module.exports = defineConfig(
  {
    ignores: ["dist/"]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  comments.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  react.configs.flat.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off"  // eslint.config.build.js reports them
    },
    plugins: {
      "react-hooks": reactHooks,
      "@stylistic": stylistic
    },
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2015
      }
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "."
        }
      },
      react: {
        pragma: "React",
        version: "detect"
      }
    },
    rules: {
      "@stylistic/semi": ["warn", "always"],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-confusing-non-null-assertion": "error",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "always" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-shadow": ["error", { builtinGlobals: false, hoist: "all", allow: [] }],
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "curly": ["error", "multi-line", "consistent"],
      "dot-notation": "error",
      "eol-last": "warn",
      "eqeqeq": ["error", "smart"],
      "import/no-cycle": "warn",
      "import/no-extraneous-dependencies": "warn",
      "import/no-useless-path-segments": "warn",
      "jsx-quotes": ["error", "prefer-double"],
      "max-len": ["warn", { code: 120, ignoreUrls: true }],
      "no-bitwise": "error",
      "no-debugger": "off",
      "no-duplicate-imports": "error",
      "no-sequences": "error",
      "no-shadow": "off", // superseded by @typescript-eslint/no-shadow
      "no-tabs": "error",
      "no-unneeded-ternary": "error",
      "no-unused-expressions": "off", // superseded by @typescript-eslint/no-unused-expressions
      "no-unused-vars": "off",  // superseded by @typescript-eslint/no-unused-vars
      "no-useless-call": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "no-whitespace-before-property": "error",
      "object-shorthand": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "prefer-object-spread": "error",
      "prefer-regex-literals": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "quotes": ["error", "double", { allowTemplateLiterals: true, avoidEscape: true }],
      "radix": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react/jsx-closing-tag-location": "error",
      "react/jsx-handler-names": "off",
      "react/jsx-no-useless-fragment": "error",
      "react/no-access-state-in-setstate": "error",
      "react/no-danger": "error",
      "react/no-unsafe": ["off", { checkAliases: true }],
      "react/no-unused-state": "error",
      "react/prop-types": "off",
      "semi": "off" // superseded by @stylistic/semi
    }
  },
  { // prefer-optional-chain needs type information; tsconfig.json covers only src
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      "@typescript-eslint/prefer-optional-chain": "warn"
    }
  },
  { // rules specific to Jest tests
    files: ["src/**/*.test.*"],
    plugins: {
      ...jest.configs["flat/recommended"].plugins,
      ...testingLibrary.configs["flat/react"].plugins
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      ...jest.configs["flat/recommended"].rules,
      ...testingLibrary.configs["flat/react"].rules,
      "@typescript-eslint/no-non-null-assertion": "off",
      // require() can be useful in mocking
      "@typescript-eslint/no-require-imports": "off",
      "jest/no-done-callback": "off"
    }
  },
  { // rules specific to Cypress tests
    files: ["cypress/**"],
    plugins: cypress.configs.recommended.plugins,
    languageOptions: {
      globals: {
        ...globals.node,
        ...cypress.configs.recommended.languageOptions.globals
      }
    },
    rules: {
      ...cypress.configs.recommended.rules,
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-require-imports": "off",
      "cypress/no-unnecessary-waiting": "off"
    }
  },
  { // eslint and webpack configs
    files: ["eslint.config*.js", "**/webpack.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  { // webpack configs
    files: ["**/webpack.config.js"],
    rules: {
      "quotes": ["error", "single", { allowTemplateLiterals: true, avoidEscape: true }]
    }
  }
);
```

Differences from `.eslintrc.js`, each a requirement:
- `@typescript-eslint/no-var-requires` is gone from every override: typescript-eslint 8 deprecated it in favor of `no-require-imports`, which the overrides already turn off.
- `eslint-comments/no-unused-disable` becomes ESLint's `linterOptions.reportUnusedDisableDirectives`, off in the base config and `warn` in the build config. The plugin's rule is deprecated and reports nothing under flat config (measured).
- `no-unused-expressions` moves to the typescript-eslint rule with the same option.
- `@typescript-eslint/no-empty-object-type` gets `allowInterfaces: "always"`. It replaces `no-empty-interface`, which the repo turns off, and by default it flags `interface Foo {}` and `interface Foo extends Bar {}`. It still flags the `{}` type, as `ban-types` did.
- `caughtErrors: "none"` is written out because typescript-eslint 8 changed its default.
- `@typescript-eslint/prefer-optional-chain` is set only in the typed block, since outside it the rule cannot run, so the Cypress files no longer get it.
- `defineConfig` comes from ESLint itself (`eslint/config`); typescript-eslint 8 deprecates its own `tseslint.config()` in its favor.
- The `.eslintrc*.js` override becomes `eslint.config*.js`, and the `json` plugin and `plugin:json/recommended` are dropped.

`eslint.config.build.js`:

```js
// build/production configuration extends default/development configuration
const base = require("./eslint.config.js");

module.exports = [
  ...base,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn"
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error"
    }
  }
];
```

`eslint.config.style.js`:

```js
const base = require("./eslint.config.js");

module.exports = [
  ...base,
  {
    rules: {
      "array-bracket-spacing": ["error", "never"],
      "object-curly-spacing": ["error", "always"],
      "react/jsx-curly-spacing": ["error", { when: "never", children: { when: "always" } }]
    }
  }
];
```

`package.json` scripts (only these three lines change; `lint` and `lint:fix` already use the default config file):

```json
    "lint:build": "eslint -c eslint.config.build.js \"./src/**/*.{js,jsx,ts,tsx}\" \"./cypress/**/*.{js,jsx,ts,tsx}\"",
    "lint:style": "eslint -c eslint.config.style.js \"./src/**/*.{js,jsx,ts,tsx}\" \"./cypress/**/*.{js,jsx,ts,tsx}\"",
    "lint:style:fix": "eslint -c eslint.config.style.js --fix \"./src/**/*.{js,jsx,ts,tsx}\" \"./cypress/**/*.{js,jsx,ts,tsx}\"",
```

Check before committing:
- `npm run lint`, `npm run lint:build`, `npm run lint:style`: each exits 0 with no output (measured in the scratch copy)
- `npx eslint eslint.config.js eslint.config.build.js eslint.config.style.js webpack.config.js`: clean
- `npx tsc --noEmit` and `npm run build`: pass
- The rule comparison below

## Verification

Throwaway, not committed: the rule comparison from the requirements' done condition. Before the dependency step, save the old effective rules; after the config step, save the new ones; compare.

```bash
# before (ESLint 8), for each FILE and each CONFIG in .eslintrc.js .eslintrc.build.js .eslintrc.style.js
npx eslint -c $CONFIG --print-config $FILE > old/$(echo $FILE | tr / _)$CONFIG.json
# after (ESLint 9), with eslint.config.js eslint.config.build.js eslint.config.style.js
```

Use `FILE` = `src/components/app.tsx`, `src/x.test.tsx` (a path that does not exist, which `--print-config` accepts), and `cypress/e2e/workspace.test.ts`. Compare rule names, severities and options. Rename `@stylistic/semi` to `@typescript-eslint/semi` and `@eslint-community/eslint-comments/` to `eslint-comments/` before comparing, and treat options that ESLint 9 only fills in with their defaults as unchanged. Expected result: the drift the requirements list, and on explicitly set rules only `caughtErrors`, the `no-unused-expressions` move, `no-empty-object-type` with `allowInterfaces: "always"`, `prefer-optional-chain` absent for the Cypress file, and the build config's `no-unused-disable` replaced by `linterOptions.reportUnusedDisableDirectives: 1`. Then restore the deleted `graph.tsx` comment for a moment: `eslint -c eslint.config.build.js src/components/graph.tsx` warns on it and `eslint src/components/graph.tsx` does not. Measured with this procedure in the scratch copy. Note: sorting keys with `JSON.stringify(obj, Object.keys(obj).sort())` drops nested option keys and hides option changes. Sort by iterating keys instead.

The three config files above were copied out of this document verbatim and run in the scratch copy: all three lint commands, `lint:style:fix`, the config-file lint, `npm run build` and the rule comparison passed. A throwaway `*.test.tsx` that imports `@testing-library/react` also lints as expected: Jest globals resolve, and the typed `prefer-optional-chain` rule runs in test files. That is the shape MARK-10's tests will have. MARK-20's six test files and new modules lint clean under all three new configs, and the 32 tests pass after every step.

Manual (a requirement): `npm start`, load the plugin in CODAP, generate sequences, and click an output to highlight it, then click it again to clear the highlight. That exercises all three rewritten conditions in `app.tsx`: a new sequence group in `generateNewSequence`, and both branches of `toggleHighlightOutput` and the `highlighted` class.

## Open Questions

### RESOLVED: Judgment call: hand fixes before the move, or after it?
**Options considered**:
- A) Hand fixes and auto-fixes first, on ESLint 8; then dependencies; then config
- B) Dependencies, config, then fixes on ESLint 9

**Decision**: A. Measured: all but one fix (the `graph.tsx` comment) are clean under ESLint 8, so lint is broken after exactly one commit (dependencies). B leaves it broken across three. The auto-fix output is identical on ESLint 8 and 9 (the end states match file for file).

### RESOLVED: Judgment call: declare `@typescript-eslint/parser` next to `typescript-eslint`?
**Options considered**:
- A) Declare it, same major, and bump the two together
- B) Rely on npm hoisting it from `typescript-eslint`

**Decision**: A. The `import/parsers` setting loads it by name, and B broke once `node_modules` was rearranged (requirements, Self-Review). npm dedupes the two to one copy (measured). They are two entries that must agree, so they are installed by one command and should be bumped together.

### RESOLVED: Judgment call: CommonJS config files, or `eslint.config.mjs`?
**Options considered**:
- A) `eslint.config.js` in CommonJS, like `webpack.config.js`
- B) `.mjs` files with `import`

**Decision**: A. It matches the repo's other config files and Jira's file names, and every plugin here ships a CommonJS entry (measured: all `require` cleanly).

## Self-Review

Roles: Commit Reviewer (are the steps independent, and does each leave the repo in the state it claims), Test Writer (MARK-10 writes the first tests on this config), Operator (CI and the dev server), Reviewer New to the Repo, in the second round Config Maintainer and Stack Integrator, and in the third and fourth rounds Senior Engineer, Commit Reviewer, Newer Developer and Test Writer, rerunning the whole plan on Node 24.14.0 with TypeScript 6.0.3 and MARK-8's `tsconfig.json` and `global.d.ts` changes. Only findings confirmed by running the plan are recorded.

### Commit Reviewer

#### RESOLVED: the config step's size was underestimated
It said about 230 lines; the measured files are 200 new lines and 160 deleted, about 365 with the scripts. Fixed in place. Still well under the 500-line guideline, and most of it is a rule list moved from one file to another.

#### RESOLVED: the config in this document differed from the one verified
While writing this plan, the Jest and Cypress blocks were tidied (only `plugins` and `rules` spread from the presets) and `no-var-requires` was dropped. Re-verified by extracting the code blocks from this file and rerunning everything: same rule comparison, same clean results. Recorded under Verification.

### Config Maintainer

#### RESOLVED: the base config used a deprecated helper
typescript-eslint 8.72.1 marks `tseslint.config()` `@deprecated` in favor of ESLint's `defineConfig()`, available from `eslint/config` since ESLint 9.22. Fixed in place in `eslint.config.js`. Measured: `--print-config` output is byte-identical for all nine file and config pairs, and every lint command stays clean.

### Stack Integrator

#### RESOLVED: "MARK-8 should not change `src/`" was wrong
MARK-8's plan adds `declare module "*.scss";` to `src/global.d.ts`. Replayed MARK-8's dev server, `tsconfig.json`, `global.d.ts`, unused-package, TypeScript 6.0.3 and webpack 5.112 / webpack-cli 7 / webpack-dev-server 6 changes in a scratch copy: the baseline counts held (lint clean, 21 `no-console`, 212 style errors), and the whole plan then ran clean, including `npm start` linting on rebuild. Wording fixed in place under "Before starting".

### Commit Reviewer (third round)

#### RESOLVED: `globals` was the one install target without a major
The step says the majors are written out so a later run gives the same majors, but `globals` had none. Fixed in place: `globals@17` (17.13.0 measured), and the requirements table says 17.x.

#### RESOLVED: the dependency step's `package.json` size was off
It said about 25 lines; the measured diff is +15 / -15. Fixed in place.

### Newer Developer

#### RESOLVED: `git show -w <sha>` is never empty
Checked on the auto-fix commit: `git show -w` prints the commit header and message even when the whitespace-ignoring diff is empty, so the stated check could not pass. Fixed in place: `git show -w --format= <sha>`, which printed nothing.

### Stack Integrator (restack onto MARK-8's implemented branch)

#### RESOLVED: MARK-20's code moved the baseline
Rerun on MARK-8's implemented branch. The `no-console` warnings moved into `utils/output-dataset.ts` and `utils/attribute-values.ts`, and the style errors grew from 212 to 380. Fixed in place: the sed covers the new files, and the auto-fix counts are remeasured.

#### RESOLVED: two tests silenced `console.log`
`output-dataset.test.ts` and `attribute-values.test.ts` spy on `console.log` to hide an expected error report, which after the switch prints as `console.error`. Fixed in place: the spies move to `console.error` in the hand-fix step.

#### RESOLVED: three test lines go over `max-len` after the auto-fix
Measured: the auto-fix pushes two lines in `state-editor.test.ts` and one in `graph-utils.test.ts` to 121 and 122 characters. Fixed in place: they are wrapped in the hand-fix step, as `probability-selector.tsx` is.

### Fourth round (on MARK-8's implemented branch)

#### RESOLVED: empty interfaces came back as errors
typescript-eslint 8's `recommended` adds `no-empty-object-type`, which flags the empty interfaces the repo allows with `no-empty-interface: "off"`. Measured with a probe file. Fixed in place: `allowInterfaces: "always"`, so only the `{}` type is flagged, as before.

#### RESOLVED: the console-spy check covered one of the two tests
A plain `npm test` hides console output, piped or in a terminal. Fixed in place: the check uses `npx jest --verbose`, which showed both blocks with the spies put back on `console.log`.

#### RESOLVED: the config step's file count and the dependency step's warning
The config step touches 8 files (git reports 7 by pairing a rename), and after the dependency commit `npm run build` and `npm start` fail as well as lint. Both fixed in place.
