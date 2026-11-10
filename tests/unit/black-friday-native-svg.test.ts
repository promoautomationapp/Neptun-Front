import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps LG's source inner cutouts in the same compound even-odd paint path", () => {
  const svg = readFileSync(
    resolve(
      process.cwd(),
      "public/brochure-presets/black-friday/brands/p01-01.svg",
    ),
    "utf8",
  );
  const compound = svg.match(/<path d="([^"]+)"[^>]+fill-rule="evenodd"/);
  expect(compound).toBeTruthy();
  expect(compound![1]!.match(/M/g)?.length).toBeGreaterThanOrEqual(4);
  expect(compound![1]).toContain("Z");
});

it("exports native brand and annotation SVG paths using valid PDF-to-SVG commands", () => {
  for (const kind of ["brands", "artwork"]) {
    const dir = resolve(
      process.cwd(),
      `public/brochure-presets/black-friday/${kind}/`,
    );
    for (const file of readdirSync(dir).filter((name) =>
      name.endsWith(".svg"),
    )) {
      const svg = readFileSync(resolve(dir, file), "utf8");
      for (const match of svg.matchAll(/<path d="([^"]+)"/g))
        expect(
          match[1]!
            .match(/[a-z]/gi)
            ?.every((command) => ["M", "L", "C", "Z"].includes(command)),
        ).toBe(true);
    }
  }
});
