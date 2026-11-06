/**
 * @jest-environment node
 */
/// <reference types="node" />
import { spawnSync } from "child_process";
import path from "path";

// ESLint's API loads its config with a dynamic import(), which Jest refuses, so the test runs the command line
describe("the interactive's import boundary", () => {
  it.each([
    "src/interactive/runtime.tsx", "src/interactive/workspace/workspace.tsx", "src/components/graph.tsx",
    "src/hooks/use-markov-tool.tsx",
  ])("refuses the CODAP host and the CODAP utilities in %s", file => {
    const root = path.join(__dirname, "../..");
    const input = [
      "import { useCODAP } from \"../codap/use-codap\";",
      "import { a } from \"../utils/codap-interface\";",
      "import { b } from \"../utils/codap-helper\";",
      "import { codapRequest } from \"../utils/codap-request\";",
      "import { c } from \"../utils/output-dataset\";",
      "import { d } from \"../utils/attribute-values\";",
    ].join("\n");
    const result = spawnSync(path.join(root, "node_modules/.bin/eslint"),
      ["--stdin", "--stdin-filename", file, "--format", "json"],
      { cwd: root, input, encoding: "utf8" });
    const [report] = JSON.parse(result.stdout);
    const refused = report.messages.filter((message: { ruleId: string }) => message.ruleId === "no-restricted-imports");
    expect(refused.map((message: { line: number }) => message.line)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
