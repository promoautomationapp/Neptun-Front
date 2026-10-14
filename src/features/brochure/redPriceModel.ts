import metrics from "./tstarFontMetrics.json" with { type: "json" };
import geometry from "./redPriceGeometry.json" with { type: "json" };
import glyphInk from "./tstarGlyphInk.json" with { type: "json" };
import { artworkPrice } from "./priceCardModel";

export type RedFontWeight = keyof typeof metrics;

export interface RedPriceRun {
  text: string;
  size: number;
  tracking: number;
  rise?: number;
}

interface RedFontMetrics {
  advances: Record<string, number>;
}

interface RedGeometryRun {
  effectiveSize: number;
}

const fontMetrics: Record<RedFontWeight, RedFontMetrics> = metrics;
const fontInk: Partial<Record<RedFontWeight, Record<string, number[] | null>>> =
  glyphInk;

export function redReferenceRunSize(
  runs: readonly RedGeometryRun[],
  index: number,
) {
  const run = runs[index];
  if (!run) throw new Error(`Missing red reference geometry run ${index}.`);
  return run.effectiveSize;
}

export function redTextWidth(
  text: string,
  size: number,
  weight: RedFontWeight = "bold",
  tracking = 0,
) {
  const advances = fontMetrics[weight].advances;
  return (
    [...text].reduce(
      (total, letter) => total + (advances[letter] ?? 0.6) * size,
      0,
    ) +
    Math.max(0, [...text].length - 1) * tracking * size
  );
}

export function redPriceRuns(
  value: unknown,
  size: number,
  euroSize = size,
  tracking = 0,
): RedPriceRun[] {
  const amount = artworkPrice(value);
  return [
    { text: amount.whole + (amount.cents ? "." : ""), size, tracking },
    ...(amount.cents
      ? [
          {
            text: amount.cents,
            size: size * 0.583,
            rise: size * 0.333,
            tracking,
          },
        ]
      : []),
    { text: "€", size: euroSize, tracking },
  ];
}

export function redInstallmentRuns(
  sale: unknown,
  installments: number | string = 12,
): RedPriceRun[] {
  const count = Math.min(
    60,
    Math.max(1, Number.parseInt(String(installments), 10) || 12),
  );
  const [whole, decimal] = (Number(sale) / count).toFixed(1).split(".");
  if (decimal === undefined) throw new Error("Invalid red installment amount.");
  const prefixSize = redReferenceRunSize(geometry.parts.installment.runs, 0);
  const priceSize = redReferenceRunSize(geometry.parts.installment.runs, 1);
  return [
    { text: `${count}x`, size: prefixSize, tracking: -0.07 },
    { text: `${whole}.`, size: priceSize, tracking: -0.07 },
    {
      text: decimal,
      size: priceSize * 0.583,
      rise: priceSize * 0.333,
      tracking: -0.07,
    },
    { text: "€", size: priceSize, tracking: -0.07 },
  ];
}

export function fittedRedRuns(
  runs: readonly RedPriceRun[],
  width: number,
): RedPriceRun[] {
  const natural = runs.reduce(
    (total, run, index) =>
      total +
      redTextWidth(run.text, run.size, "bold", run.tracking) +
      (index < runs.length - 1 ? (run.tracking || 0) * run.size : 0),
    0,
  );
  const scale = Math.min(1, width / Math.max(1, natural));
  return runs.map((run) => ({
    ...run,
    size: run.size * scale,
    rise: (run.rise || 0) * scale,
  }));
}

export function fittedRedText(
  text: string,
  size: number,
  width: number,
  weight?: RedFontWeight,
  tracking?: number,
) {
  return (
    size *
    Math.min(1, width / Math.max(1, redTextWidth(text, size, weight, tracking)))
  );
}

// SVG includes trailing letter spacing in an end-anchored text chunk. The
// source's negative spacing would otherwise push the final euro ink outside
// its advance box. Preserve every interior gap and remove only that last gap.
export function redSvgRuns(runs: readonly RedPriceRun[]): RedPriceRun[] {
  const last = runs.at(-1);
  if (!last) return [];
  const characters = [...last.text];
  return [
    ...runs.slice(0, -1),
    ...(characters.length > 1
      ? [{ ...last, text: characters.slice(0, -1).join("") }]
      : []),
    { ...last, text: characters.at(-1) || "", tracking: 0 },
  ];
}

export function redRunInkBounds(
  runs: readonly RedPriceRun[],
  weight: RedFontWeight = "bold",
) {
  const glyphs = runs.flatMap((run) =>
    [...run.text].map((character) => ({ ...run, character })),
  );
  let advance = 0;
  let left = Infinity;
  let right = -Infinity;
  glyphs.forEach((run, index) => {
    const bounds = fontInk[weight]?.[run.character];
    if (bounds) {
      const [glyphLeft, glyphRight] = bounds;
      if (glyphLeft !== undefined && glyphRight !== undefined) {
        left = Math.min(left, advance + glyphLeft * run.size);
        right = Math.max(right, advance + glyphRight * run.size);
      }
    }
    advance += (fontMetrics[weight].advances[run.character] ?? 0.6) * run.size;
    if (index < glyphs.length - 1) advance += (run.tracking || 0) * run.size;
  });
  return {
    left: Number.isFinite(left) ? left : 0,
    right: Number.isFinite(right) ? right : 0,
    advance,
  };
}
