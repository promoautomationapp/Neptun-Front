import type { Gradient } from "../../domain/models";
import type { CSSProperties } from "react";
import { parseColorInput } from "./parseColorInput";

export type BackgroundContext =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; gradient: Gradient }
  | { kind: "image"; color: string; image: string };

export function colorLuminance(color: string): number {
  const parsed = parseColorInput(color);
  if (!parsed) return 0;
  const { r, g, b, a } = parsed.rgba;
  // Transparent brochure paint is viewed/exported on white paper.
  const channel = (component: number) => {
    const value = (component * a + 255 * (1 - a)) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722;
}

export function colorContrast(foreground: string, background: string): number {
  const a = colorLuminance(foreground);
  const b = colorLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Keep Neptun's navy or white ink where readable, and use black for middle tones. */
export function readableForeground(background: string): string {
  const colors = ["#ffffff", "#1c4075", "#000000"];
  const ranked = [...colors].sort(
    (a, b) => colorContrast(b, background) - colorContrast(a, background),
  );
  const brand = colors
    .slice(0, 2)
    .sort(
      (a, b) => colorContrast(b, background) - colorContrast(a, background),
    )[0]!;
  return colorContrast(brand, background) >= 4.5 ? brand : ranked[0]!;
}

export function blendBackgroundColors(
  from: string,
  to: string,
  amount: number,
): string {
  const first = parseColorInput(from)?.rgba;
  const last = parseColorInput(to)?.rgba;
  if (!first || !last) return "#ffffff";
  const alpha = first.a + (last.a - first.a) * amount;
  return (
    "#" +
    (["r", "g", "b"] as const)
      .map((key) => {
        const a = first[key] * first.a;
        const b = last[key] * last.a;
        return Math.round(a + (b - a) * amount + 255 * (1 - alpha))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

export interface BackgroundReadability {
  foreground: string;
  light: boolean;
  needsSurface: boolean;
  textSurface: string;
  brandFilter: string;
  energyInk: string;
}

/** No image processing: photos and mixed gradients get a small surface behind text only. */
export function backgroundReadability(
  context: BackgroundContext,
): BackgroundReadability {
  const samples =
    context.kind === "gradient"
      ? [0, 0.25, 0.5, 0.75, 1].map((amount) =>
          blendBackgroundColors(
            context.gradient.from,
            context.gradient.to,
            amount,
          ),
        )
      : [context.color];
  const foreground = readableForeground(
    samples[Math.floor(samples.length / 2)]!,
  );
  const needsSurface =
    context.kind === "image" ||
    samples.some((sample) => colorContrast(foreground, sample) < 4.5);
  const light = foreground !== "#ffffff";
  const textSurface = light ? "#ffffff" : "#1c4075";
  const energyBackgrounds = needsSurface ? [textSurface] : samples;
  const energyInk =
    foreground === "#ffffff" &&
    energyBackgrounds.every((color) => colorContrast("#8cd4e7", color) >= 4.5)
      ? "#8cd4e7"
      : foreground;
  return {
    foreground,
    light,
    needsSurface,
    textSurface,
    brandFilter: light ? "brightness(0)" : "brightness(0) invert(1)",
    energyInk,
  };
}

export function backgroundReadabilityStyle(
  readability: BackgroundReadability,
  baseColor?: string,
): CSSProperties & Record<`--${string}`, string> {
  return {
    color: readability.foreground,
    "--brochure-foreground": readability.foreground,
    "--brochure-text-surface": readability.textSurface,
    "--brochure-brand-filter": readability.brandFilter,
    "--brochure-disclaimer-surface": readability.needsSurface
      ? readability.textSurface
      : baseColor || readability.textSurface,
    "--brochure-energy-ink": readability.energyInk,
  };
}
