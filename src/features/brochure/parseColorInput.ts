export interface ParsedColorInput {
  /** Lowercase six-digit hex, or eight digits when alpha is not fully opaque. */
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

const clamp = (value: number, maximum: number) =>
  Math.max(0, Math.min(maximum, value));
const byte = (value: number) => Math.round(clamp(value, 255));
const hexByte = (value: number) => byte(value).toString(16).padStart(2, "0");

function canonical(r: number, g: number, b: number, a = 1): ParsedColorInput {
  const alpha = byte(a * 255);
  const rgba = { r: byte(r), g: byte(g), b: byte(b), a: alpha / 255 };
  return {
    hex: `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${alpha === 255 ? "" : hexByte(alpha)}`,
    rgba,
  };
}

function number(value: string): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function scaled(value: string, maximum: number): number | null {
  const percentage = value.endsWith("%");
  const parsed = number(percentage ? value.slice(0, -1) : value);
  return parsed === null
    ? null
    : clamp(percentage ? (parsed / 100) * maximum : parsed, maximum);
}

function components(
  value: string,
): { channels: string[]; alpha?: string } | null {
  if (value.includes(",")) {
    if (value.includes("/")) return null;
    const parts = value.split(",").map((part) => part.trim());
    return parts.length === 3 || parts.length === 4
      ? { channels: parts.slice(0, 3), alpha: parts[3] }
      : null;
  }
  const parts = value.split("/");
  if (parts.length > 2) return null;
  const channels = parts[0]!.trim().split(/\s+/);
  const alpha = parts[1]?.trim();
  return channels.length === 3 && alpha !== "" ? { channels, alpha } : null;
}

function hue(value: string): number | null {
  const match = value.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)?$/i,
  );
  if (!match) return null;
  const angle = number(match[1]!);
  if (angle === null) return null;
  const multiplier = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[
    match[2]?.toLowerCase() || "deg"
  ];
  const degrees = angle * (multiplier ?? 1);
  if (!Number.isFinite(degrees)) return null;
  return ((degrees % 360) + 360) % 360;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const saturation = s / 100,
    lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

/** Parse color notation as data, never as CSS. Invalid/incomplete text stays in
 * the input without changing the saved color or accepting URLs/style fragments. */
export function parseColorInput(value: string): ParsedColorInput | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (input.toLowerCase() === "transparent") return canonical(0, 0, 0, 0);
  const hex = input.match(
    /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i,
  )?.[1];
  if (hex) {
    const expanded =
      hex.length <= 4 ? [...hex].map((part) => part.repeat(2)).join("") : hex;
    const [r, g, b, alpha] = [0, 2, 4, 6].map((offset) =>
      parseInt(expanded.slice(offset, offset + 2), 16),
    );
    return canonical(r!, g!, b!, expanded.length === 8 ? alpha! / 255 : 1);
  }
  const fn = input.match(/^(rgba?|hsla?)\(([^()]*)\)$/i);
  if (!fn) return null;
  const parts = components(fn[2]!.trim());
  if (!parts) return null;
  const alpha = parts.alpha === undefined ? 1 : scaled(parts.alpha, 1);
  if (alpha === null) return null;
  if (/^rgb/i.test(fn[1]!)) {
    const [r, g, b] = parts.channels.map((part) => scaled(part, 255));
    return r === null || g === null || b === null
      ? null
      : canonical(r!, g!, b!, alpha);
  }
  const h = hue(parts.channels[0]!);
  const s = scaled(parts.channels[1]!, 100),
    l = scaled(parts.channels[2]!, 100);
  return h === null || s === null || l === null
    ? null
    : canonical(...hslToRgb(h, s, l), alpha);
}

const rounded = (value: number, precision = 3) =>
  Number(value.toFixed(precision));

/** Always expose alpha in the editable RGB/HSL formats, including opaque 1. */
export function formatColorInput(
  hex: string,
  format: "hex" | "rgb" | "hsl",
): string {
  const parsed = parseColorInput(hex);
  if (!parsed) return hex;
  if (format === "hex") return parsed.hex.toUpperCase();
  const { r, g, b, a } = parsed.rgba;
  const alpha = rounded(a, 3);
  if (format === "rgb") return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const maximum = Math.max(red!, green!, blue!),
    minimum = Math.min(red!, green!, blue!);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation =
    difference === 0 ? 0 : difference / (1 - Math.abs(2 * lightness - 1));
  const angle =
    difference === 0
      ? 0
      : maximum === red
        ? ((green! - blue!) / difference) % 6
        : maximum === green
          ? (blue! - red!) / difference + 2
          : (red! - green!) / difference + 4;
  const h = (angle * 60 + 360) % 360;
  return `hsla(${rounded(h)}, ${rounded(saturation * 100)}%, ${rounded(lightness * 100)}%, ${alpha})`;
}
