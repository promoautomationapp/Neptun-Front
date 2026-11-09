export type TextFontGroup =
  | "Brand fonts"
  | "App fonts"
  | "Sans serif"
  | "Serif"
  | "Monospace"
  | "Display and script"
  | "System fonts"
  | "Custom font";

type GenericFamily =
  "sans-serif" | "serif" | "monospace" | "cursive" | "fantasy" | "system-ui";

export interface TextFontOption {
  family: string;
  label: string;
  group: TextFontGroup;
  /** App fonts use existing app styles. Other suggestions require a device-installed font. */
  source: "bundled" | "app" | "system" | "custom";
  fallback: GenericFamily;
  weights?: readonly number[];
}

export const DEFAULT_TEXT_FONT = "SkolaSans";

function systemFonts(
  group: TextFontGroup,
  fallback: GenericFamily,
  families: readonly string[],
): TextFontOption[] {
  return families.map((family) => ({
    family,
    label: family,
    group,
    source: "system",
    fallback,
  }));
}

/** Suggestions never fetch fonts; a typed family also works when installed on the device. */
export const TEXT_FONTS: readonly TextFontOption[] = [
  {
    family: "SkolaSans",
    label: "SkolaSans",
    group: "Brand fonts",
    source: "bundled",
    fallback: "sans-serif",
    weights: [300, 400, 500, 700, 900],
  },
  {
    family: "TSTAR",
    label: "TSTAR",
    group: "Brand fonts",
    source: "bundled",
    fallback: "sans-serif",
    weights: [400, 700],
  },
  {
    family: "TSTAR Headline",
    label: "TSTAR Headline",
    group: "Brand fonts",
    source: "bundled",
    fallback: "sans-serif",
    weights: [400],
  },
  {
    family: "Cera Pro",
    label: "Cera Pro",
    group: "Brand fonts",
    source: "bundled",
    fallback: "sans-serif",
    weights: [700],
  },
  {
    family: "DM Sans",
    label: "DM Sans",
    group: "App fonts",
    source: "app",
    fallback: "sans-serif",
    weights: [400, 500, 600, 700, 800],
  },
  {
    family: "Manrope",
    label: "Manrope",
    group: "App fonts",
    source: "app",
    fallback: "sans-serif",
    weights: [400, 500, 600, 700, 800],
  },
  ...systemFonts("Sans serif", "sans-serif", [
    "Arial",
    "Arial Black",
    "Arial Narrow",
    "Helvetica",
    "Helvetica Neue",
    "Aptos",
    "Aptos Display",
    "Calibri",
    "Candara",
    "Segoe UI",
    "Segoe UI Variable",
    "Tahoma",
    "Trebuchet MS",
    "Verdana",
    "Gill Sans",
    "Gill Sans MT",
    "Optima",
    "Lucida Grande",
    "Lucida Sans Unicode",
    "Century Gothic",
    "Futura",
    "Avenir",
    "Avenir Next",
    "Roboto",
    "Open Sans",
    "Noto Sans",
    "Liberation Sans",
    "DejaVu Sans",
    "Ubuntu",
    "Inter",
  ]),
  ...systemFonts("Serif", "serif", [
    "Georgia",
    "Times New Roman",
    "Times",
    "Cambria",
    "Constantia",
    "Garamond",
    "Baskerville",
    "Baskerville Old Face",
    "Palatino",
    "Palatino Linotype",
    "Book Antiqua",
    "Bookman Old Style",
    "Didot",
    "Bodoni MT",
    "Rockwell",
    "Noto Serif",
    "Liberation Serif",
    "DejaVu Serif",
  ]),
  ...systemFonts("Monospace", "monospace", [
    "Courier New",
    "Courier",
    "Consolas",
    "Menlo",
    "Monaco",
    "Cascadia Code",
    "Lucida Console",
    "SFMono-Regular",
    "Roboto Mono",
    "Liberation Mono",
    "DejaVu Sans Mono",
  ]),
  ...systemFonts("Display and script", "cursive", [
    "Comic Sans MS",
    "Brush Script MT",
    "Segoe Print",
    "Segoe Script",
    "Apple Chancery",
    "Snell Roundhand",
  ]),
  ...systemFonts("Display and script", "fantasy", ["Copperplate", "Papyrus"]),
  ...systemFonts("Display and script", "sans-serif", [
    "Impact",
    "Franklin Gothic Medium",
  ]),
  ...systemFonts("System fonts", "system-ui", ["system-ui"]),
  ...systemFonts("System fonts", "sans-serif", ["sans-serif"]),
  ...systemFonts("System fonts", "serif", ["serif"]),
  ...systemFonts("System fonts", "monospace", ["monospace"]),
  ...systemFonts("System fonts", "cursive", ["cursive"]),
  ...systemFonts("System fonts", "fantasy", ["fantasy"]),
];

const optionsByFamily = new Map(
  TEXT_FONTS.map((font) => [font.family.toLowerCase(), font]),
);
const genericFamilies = new Set<GenericFamily>([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

/** Accept one font family, not a CSS declaration or an external font URL. */
export function normalizeTextFontFamily(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_TEXT_FONT;
  const family = value
    .trim()
    .replace(/^(['"])(.*)\1$/u, "$2")
    .replace(/\s+/gu, " ");
  if (
    !family ||
    family.length > 120 ||
    !/^[\p{L}\p{M}\p{N} ._'’&+-]+$/u.test(family)
  )
    return DEFAULT_TEXT_FONT;
  return optionsByFamily.get(family.toLowerCase())?.family || family;
}

/** Keeps the current custom choice visible in an editable font selector. */
export function textFontOptions(current?: string): readonly TextFontOption[] {
  const family = normalizeTextFontFamily(current);
  return optionsByFamily.has(family.toLowerCase())
    ? TEXT_FONTS
    : [
        ...TEXT_FONTS,
        {
          family,
          label: family,
          group: "Custom font",
          source: "custom",
          fallback: "sans-serif",
        },
      ];
}

/** CSS-string quoting preserves spaces/non-Latin names without permitting a font stack injection. */
export function textFontCss(value: unknown): string {
  const family = normalizeTextFontFamily(value);
  if (genericFamilies.has(family as GenericFamily)) return family;
  const fallback =
    optionsByFamily.get(family.toLowerCase())?.fallback || "sans-serif";
  return `${JSON.stringify(family)}, ${fallback === "sans-serif" ? "Arial, " : ""}${fallback}`;
}
