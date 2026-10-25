import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("uses in-app modals throughout the platform instead of native browser dialogs", () => {
  const root = join(process.cwd(), "src");
  const violations: string[] = [];
  function inspect(directory: string) {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) inspect(path);
      else if (/\.[jt]sx?$/.test(item.name)) {
        const source = ts.createSourceFile(
          path,
          readFileSync(path, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const name = ts.isIdentifier(callee)
              ? callee.text
              : ts.isPropertyAccessExpression(callee) &&
                  ["window", "globalThis", "self"].includes(
                    callee.expression.getText(source),
                  )
                ? callee.name.text
                : "";
            const nativeDialog = ["alert", "confirm", "prompt"].includes(name);
            const unloadPrompt =
              name === "addEventListener" &&
              node.arguments[0] &&
              ts.isStringLiteral(node.arguments[0]) &&
              node.arguments[0].text === "beforeunload";
            if (nativeDialog || unloadPrompt) {
              const line =
                source.getLineAndCharacterOfPosition(node.getStart(source))
                  .line + 1;
              violations.push(`${relative(root, path)}:${line}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  inspect(root);
  expect(violations).toEqual([]);
});
