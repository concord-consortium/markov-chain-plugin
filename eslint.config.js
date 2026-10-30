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
