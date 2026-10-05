import { describe, expect, test } from "vitest";
import { resolveNpmInvocation } from "./build-package-runtime.mjs";

describe("desktop package npm invocation", () => {
  test("runs npm's JavaScript CLI through Node instead of spawning npm.cmd", () => {
    expect(
      resolveNpmInvocation(
        {
          npm_execpath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
          npm_node_execpath: "C:\\Program Files\\nodejs\\node.exe",
        },
        "C:\\fallback\\node.exe",
      ),
    ).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      argsPrefix: ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js"],
    });
  });

  test("falls back to the current Node executable when npm_node_execpath is absent", () => {
    expect(
      resolveNpmInvocation(
        { npm_execpath: "/usr/local/lib/node_modules/npm/bin/npm-cli.js" },
        "/usr/local/bin/node",
      ),
    ).toEqual({
      command: "/usr/local/bin/node",
      argsPrefix: ["/usr/local/lib/node_modules/npm/bin/npm-cli.js"],
    });
  });

  test("fails clearly when invoked outside npm", () => {
    expect(() => resolveNpmInvocation({}, "/usr/bin/node")).toThrow(/npm_execpath is missing/);
  });
});
