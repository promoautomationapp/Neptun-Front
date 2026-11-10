import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import sourceManifest from "../../src/features/brochure/blackFridaySourceManifest.json";

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

it("keeps only the visible source G in all nine LG marks", () => {
  const logos = sourceManifest.products.filter(
    (product) => product.brand === "LG",
  );
  expect(logos).toHaveLength(9);
  for (const logo of logos) {
    const svg = readFileSync(
      resolve(process.cwd(), `public${logo.brandImageUrl}`),
      "utf8",
    );
    const paths = [
      ...svg.matchAll(/<path d="([^"]+)"[^>]*fill-rule="([^"]+)"/g),
    ];
    // Face symbol (compound holes), visible L, visible G. The alternate
    // even-odd G is clipped out in the PDF and must not overlay its wordmark.
    expect(paths).toHaveLength(3);
    expect(paths.map((path) => path[2])).toEqual([
      "evenodd",
      "nonzero",
      "nonzero",
    ]);
    expect(paths[0]![1]!.match(/M/g)!.length).toBeGreaterThanOrEqual(4);
    expect(paths[2]![1]).toContain("Z");
  }
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
