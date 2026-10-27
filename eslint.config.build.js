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
