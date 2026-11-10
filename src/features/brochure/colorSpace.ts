export interface HsvColor {
  h: number;
  s: number;
  v: number;
}
export const isHexColor = (value: string) =>
  /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value);
export function hexToHsv(hex: string): HsvColor {
  const [r, g, b] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  ) as [number, number, number];
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const hue =
    d === 0
      ? 0
      : max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  return {
    h: (hue * 60 + 360) % 360,
    s: max ? (d / max) * 100 : 0,
    v: max * 100,
  };
}
export function hsvToHex({ h, s, v }: HsvColor): string {
  const saturation = Math.max(0, Math.min(100, s)) / 100;
  const value = Math.max(0, Math.min(100, v)) / 100;
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(
      255 * value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))),
    )
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}
