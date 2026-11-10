import { expect, it } from "vitest";
import {
  DEFAULT_TEXT_FONT,
  normalizeTextFontFamily,
  TEXT_FONTS,
  textFontCss,
  textFontOptions,
  preferredTextFonts,
  BLACK_FRIDAY_TEXT_FONTS,
} from "../../src/features/brochure/textFonts";

it("offers the actual supplied brochure families before app and installed-font suggestions", () => {
  expect(TEXT_FONTS.slice(0, 4).map((font) => font.family)).toEqual([
    "SkolaSans",
    "TSTAR",
    "TSTAR Headline",
    "Cera Pro",
  ]);
  expect(
    TEXT_FONTS.find((font) => font.family === "SkolaSans")?.weights,
  ).toEqual([300, 400, 500, 700, 900]);
  expect(
    TEXT_FONTS.find((font) => font.family === "Cera Pro")?.weights,
  ).toEqual([400, 700, 900]);
  expect(TEXT_FONTS.find((font) => font.family === "Georgia")?.source).toBe(
    "system",
  );
});

it("puts every supplied Black Friday family first while preserving other design order", () => {
  const preferred = preferredTextFonts("neptun-black-friday");
  expect(preferred).toEqual(BLACK_FRIDAY_TEXT_FONTS);
  expect(
    textFontOptions("Arial", preferred)
      .slice(0, preferred.length)
      .map((font) => font.family),
  ).toEqual([...preferred]);
  expect(preferredTextFonts("neptun-current")).toEqual([]);
  expect(textFontOptions("Arial", preferredTextFonts("neptun-current"))).toBe(
    TEXT_FONTS,
  );
  for (const family of preferred)
    expect(TEXT_FONTS.find((font) => font.family === family)?.source).toBe(
      "bundled",
    );
});

it("uses canonical bundled names and accepts a user's installed font name", () => {
  expect(normalizeTextFontFamily(' "tstar headline" ')).toBe("TSTAR Headline");
  expect(normalizeTextFontFamily("My   Custom Font")).toBe("My Custom Font");
  expect(normalizeTextFontFamily("Shkronja ÇË 2026")).toBe("Shkronja ÇË 2026");
  expect(textFontOptions("My Custom Font").at(-1)).toMatchObject({
    family: "My Custom Font",
    group: "Custom font",
    source: "custom",
  });
  expect(textFontOptions("arial")).toBe(TEXT_FONTS);
});

it("keeps sensible fallbacks and quotes multiword families safely", () => {
  expect(textFontCss("TSTAR Headline")).toBe(
    '"TSTAR Headline", Arial, sans-serif',
  );
  expect(textFontCss("Georgia")).toBe('"Georgia", serif');
  expect(textFontCss("Menlo")).toBe('"Menlo", monospace');
  expect(textFontCss("sans-serif")).toBe("sans-serif");
  expect(textFontCss("My Custom Font")).toBe(
    '"My Custom Font", Arial, sans-serif',
  );
});

it.each([
  "",
  null,
  "Arial; color:red",
  "url(https://example.com/font)",
  "Arial, serif",
  "<style>",
  "a".repeat(121),
])("rejects invalid family input %s", (value) => {
  expect(normalizeTextFontFamily(value)).toBe(DEFAULT_TEXT_FONT);
});
