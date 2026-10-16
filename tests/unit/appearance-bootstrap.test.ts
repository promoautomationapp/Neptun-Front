import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
const source = readFileSync(resolve("public/appearance.js"), "utf8");
it("restores only an explicit dark preference before the application paints", () => {
  for (const [stored, expected] of [
    ["dark", "dark"],
    ["light", "light"],
    [null, "light"],
    ["system", "light"],
  ]) {
    const document = { documentElement: { dataset: { theme: "" } } };
    runInNewContext(source, {
      document,
      localStorage: { getItem: () => stored },
    });
    expect(document.documentElement.dataset.theme).toBe(expected);
  }
});
it("falls back to light when browser storage cannot be read", () => {
  const document = { documentElement: { dataset: { theme: "" } } };
  runInNewContext(source, {
    document,
    localStorage: {
      getItem: () => {
        throw new Error("Unavailable");
      },
    },
  });
  expect(document.documentElement.dataset.theme).toBe("light");
});
