import { expect, it } from "vitest";
import {
  formatColorInput,
  parseColorInput,
} from "../../src/features/brochure/parseColorInput";
import {
  colorLuminance,
  colorContrast,
  readableForeground,
} from "../../src/features/brochure/backgroundContrast";
import {
  pageBackgroundContrastColor,
  validBackgroundColor,
  validBackgroundGradient,
} from "../../src/features/brochure/pageBackground";
import {
  imageBackgroundSignature,
  normalizeImageBackgroundContext,
} from "../../src/features/brochure/imagePreparationContext";

it("accepts short/full hex with optional alpha and normalizes opaque hex", () => {
  for (const [input, hex] of [
    ["#abc", "#aabbcc"],
    ["AbCd", "#aabbccdd"],
    ["#11223344", "#11223344"],
    ["112233ff", "#112233"],
    ["transparent", "#00000000"],
  ])
    expect(parseColorInput(input!)!.hex).toBe(hex);
  expect(parseColorInput("#ff000080")!.rgba).toEqual({
    r: 255,
    g: 0,
    b: 0,
    a: 128 / 255,
  });
});

it("parses RGB/RGBA comma, space, slash and percentage forms with bounded channels", () => {
  for (const input of [
    "rgb(255, 0, 128)",
    "RGB(100% 0% 50%)",
    "rgba(255 0 128 / 1)",
    "rgb(300 -10 128)",
  ])
    expect(parseColorInput(input)!.hex).toBe("#ff0080");
  expect(parseColorInput("rgba(255, 0, 128, .5)")!.hex).toBe("#ff008080");
  expect(parseColorInput("rgb(100% 0% 50% / 25%)")!.hex).toBe("#ff008040");
});

it("parses HSL/HSLA including wrapping hues and angle units", () => {
  for (const input of [
    "hsl(360, 100%, 50%)",
    "hsla(0 100% 50% / 100%)",
    "hsl(1turn 100% 50%)",
    "hsl(400grad 100% 50%)",
  ])
    expect(parseColorInput(input)!.hex).toBe("#ff0000");
  expect(parseColorInput("hsla(120, 100%, 50%, 0.5)")!.hex).toBe("#00ff0080");
  expect(parseColorInput("hsl(-120 100% 50%)")!.hex).toBe("#0000ff");
  expect(parseColorInput(`hsl(${Math.PI}rad 100% 50%)`)!.hex).toBe("#00ffff");
});

it("rejects incomplete, malformed and CSS-injection input", () => {
  for (const input of [
    "",
    "#12",
    "#12345",
    "#1234567",
    "#123456789",
    "#ggg",
    "red",
    "rgb(1,2)",
    "rgb(1 2)",
    "rgb(1, 2 3)",
    "rgba(1,2,3,)",
    "rgb(1 2 3 /)",
    "rgb(1 2 3 / .5 / .5)",
    "hsl(0 20% nope)",
    "hsl(1e308turn 10% 50%)",
    "rgba(1 2 3 / NaN)",
    "url(https://evil.test)",
    "#000;position:fixed",
    "var(--color)",
  ])
    expect(parseColorInput(input), input).toBeNull();
});

it("keeps the same canonical color when changing the input display format", () => {
  for (const hex of [
    "#ffffff",
    "#000000",
    "#1680a8",
    "#1c4075",
    "#ffab0080",
    "#12345601",
    "#001122fe",
  ]) {
    expect(formatColorInput(hex, "hex")).toBe(hex.toUpperCase());
    for (const format of ["rgb", "hsl"] as const)
      expect(
        parseColorInput(formatColorInput(hex, format))!.hex,
        `${hex} ${format}`,
      ).toBe(hex);
  }
});

it("keeps translucent page colors and selects contrast for their actual appearance on white paper", () => {
  expect(validBackgroundColor("#1680A880")).toBe("#1680a880");
  expect(
    validBackgroundGradient({ from: "#00000000", to: "#ffffff", angle: 90 }),
  ).toEqual({ from: "#00000000", to: "#ffffff", angle: 90 });
  expect(colorLuminance("#00000000")).toBe(1);
  expect(readableForeground("#00000000")).not.toBe("#ffffff");
  expect(
    colorContrast(readableForeground("#00000080"), "#00000080"),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    pageBackgroundContrastColor(
      {
        products: [],
        coverBackgroundGradient: {
          from: "#00000000",
          to: "#ffffff",
          angle: 90,
        },
      },
      "cover",
    ),
  ).toBe("#ffffff");
});

it("retains existing opaque preparation fingerprints and shares alpha canonicalization with the backend", () => {
  expect(imageBackgroundSignature({ kind: "solid", color: "#AABBCC" })).toBe(
    "bg-v1:435e04da",
  );
  expect(
    imageBackgroundSignature({
      kind: "gradient",
      gradient: { from: "#1c4075", to: "#86b3de", angle: 135 },
    }),
  ).toBe("bg-v1:8a615a46");
  expect(
    imageBackgroundSignature({
      kind: "image",
      color: "#1c4075",
      image: "/photo.png",
    }),
  ).toBe("bg-v1:2f712579");
  expect(imageBackgroundSignature({ kind: "solid", color: "#aabbccff" })).toBe(
    "bg-v1:435e04da",
  );
  expect(
    normalizeImageBackgroundContext({ kind: "solid", color: "#00000080" }),
  ).toEqual({ kind: "solid", color: "#7f7f7f" });
  expect(imageBackgroundSignature({ kind: "solid", color: "#00000000" })).toBe(
    imageBackgroundSignature({ kind: "solid", color: "#ffffff" }),
  );
});
