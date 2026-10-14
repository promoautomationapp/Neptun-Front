import { expect, it } from "vitest";
import {
  backgroundReadability,
  colorContrast,
  readableForeground,
} from "../../src/features/brochure/backgroundContrast";
import { largeBundlePanelColors } from "../../src/features/brochure/largeBundleLayout";
import {
  pageBackgroundReadability,
  pageBackgroundFill,
  pageBackgroundContrastColor,
} from "../../src/features/brochure/pageBackground";
import { storesPageIsLight } from "../../src/features/brochure/storesDesign";

it("keeps readable ink for arbitrary solid page and darker set panel colors", () => {
  for (let red = 0; red <= 255; red += 17)
    for (let green = 0; green <= 255; green += 17)
      for (let blue = 0; blue <= 255; blue += 17) {
        const color =
          "#" +
          [red, green, blue]
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
        expect(
          colorContrast(readableForeground(color), color),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          colorContrast(
            backgroundReadability({ kind: "solid", color }).energyInk,
            color,
          ),
        ).toBeGreaterThanOrEqual(4.5);
        const panel = largeBundlePanelColors(color);
        expect(
          colorContrast(panel.foreground, panel.background),
        ).toBeGreaterThanOrEqual(4.5);
        for (const offset of [1, 3, 5])
          expect(
            parseInt(panel.background.slice(offset, offset + 2), 16),
          ).toBeLessThanOrEqual(parseInt(color.slice(offset, offset + 2), 16));
      }
});

it("preserves blue/gray ink and adds local text surfaces only when a gradient or photo needs them", () => {
  expect(
    backgroundReadability({ kind: "solid", color: "#1c4075" }),
  ).toMatchObject({ foreground: "#ffffff", needsSurface: false, light: false });
  expect(
    backgroundReadability({ kind: "solid", color: "#e4e4e4" }),
  ).toMatchObject({ foreground: "#1c4075", needsSurface: false, light: true });
  expect(
    backgroundReadability({
      kind: "gradient",
      gradient: { from: "#000000", to: "#ffffff", angle: 90 },
    }).needsSurface,
  ).toBe(true);
  expect(
    backgroundReadability({
      kind: "gradient",
      gradient: { from: "#251032", to: "#17304a", angle: 90 },
    }).needsSurface,
  ).toBe(false);
  for (const color of ["#ff6600", "#88aa55", "#ffffff", "#000000"]) {
    const result = backgroundReadability({
      kind: "image",
      color,
      image: "/photo.svg",
    });
    expect(result.needsSurface).toBe(true);
    expect(
      colorContrast(result.foreground, result.textSurface),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

it("uses page-specific overrides for all page kinds and keeps backgrounds unchanged", () => {
  const campaign = {
    theme: "blue",
    coverBackgroundColor: "#994422",
    productBackgroundColor: "#225533",
    storesBackgroundColor: "#e7cd7b",
    products: [],
  };
  for (const kind of ["cover", "product", "stores"])
    expect(pageBackgroundReadability(campaign, kind).needsSurface).toBe(false);
  const page = {
    backgroundGradient: { from: "#36012a", to: "#fde7ac", angle: 135 },
  };
  expect(pageBackgroundFill(campaign, "product", page)).toBe(
    "linear-gradient(135deg, #36012a, #fde7ac)",
  );
  expect(pageBackgroundContrastColor(campaign, "product", page)).toBe(
    "#9a746b",
  );
  expect(
    pageBackgroundReadability(campaign, "product", page).needsSurface,
  ).toBe(true);
  expect(storesPageIsLight(campaign)).toBe(true);
  expect(
    storesPageIsLight({ ...campaign, storesBackgroundColor: "#4a1649" }),
  ).toBe(false);
});
