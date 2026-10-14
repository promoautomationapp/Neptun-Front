import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { it, expect } from "vitest";
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name))
      : [resolve(directory, entry.name)],
  );
it("mount effects, print and export handlers cannot reach AI commands", () => {
  const sourceFiles = files(resolve("src")).filter((file) =>
    /\.tsx?$/.test(file),
  );
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const functions = new Map<string, ts.Node>();
    const aliases = new Set(["requestAi", "startCampaignAiReview"]);
    const roots: ts.Node[] = [];
    const collect = (node: ts.Node): void => {
      if (
        ts.isImportSpecifier(node) &&
        ["requestAi", "startCampaignAiReview"].includes(
          node.propertyName?.text ?? node.name.text,
        )
      )
        aliases.add(node.name.text);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        if (
          ts.isIdentifier(node.initializer) &&
          aliases.has(node.initializer.text)
        )
          aliases.add(node.name.text);
        if (
          ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)
        )
          functions.set(node.name.text, node.initializer);
      }
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.set(node.name.text, node);
        if (
          /^(?:exportPost|exportBrochure|printCampaign|goToBrochure)$/.test(
            node.name.text,
          )
        )
          roots.push(node);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "useEffect" &&
        node.arguments[0]
      )
        roots.push(node.arguments[0]);
      ts.forEachChild(node, collect);
    };
    collect(source);
    const walk = (node: ts.Node, seen: Set<string>): void => {
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression)
          ? node.expression.text
          : "";
        expect(aliases.has(name), `${file}: read flow calls ${name}`).toBe(
          false,
        );
        if (["fetch", "request", "apiFetch"].includes(name)) {
          const path = node.arguments[0];
          if (
            path &&
            ts.isStringLiteral(path) &&
            /\/api\/ai(?:-|\/jobs)/.test(path.text)
          )
            expect(
              node.getText(source),
              `${file}: AI write from read flow`,
            ).not.toMatch(/method\s*:\s*['"]POST['"]/);
        }
        if (name && !seen.has(name)) {
          const body = functions.get(name);
          if (body) {
            seen.add(name);
            walk(body, seen);
          }
        }
      }
      ts.forEachChild(node, (child) => walk(child, seen));
    };
    for (const root of roots) walk(root, new Set());
  }
});
