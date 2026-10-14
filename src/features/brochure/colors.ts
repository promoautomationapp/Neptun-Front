import type {Product}from '../../domain/models';
import { normalize } from "./utils";

const COLORS = [
  { name: "Black", hex: "#1b222b", pattern: /\b(?:e zeze|i zi|black)\b/ },
  { name: "White", hex: "#ffffff", pattern: /\b(?:e bardhe|i bardhe|white)\b/ },
  { name: "Gray", hex: "#9098a0", pattern: /\b(?:hiri|gri|grey|gray)\b/ },
  { name: "Silver", hex: "#c4c9cf", pattern: /\b(?:e argjendte|argjend|silver)\b/ },
  { name: "Red", hex: "#d7443d", pattern: /\b(?:e kuqe|i kuq|red)\b/ },
  { name: "Blue", hex: "#2d70b4", pattern: /\b(?:e kalter|e kaltert|blu|blue)\b/ },
  { name: "Green", hex: "#3b9964", pattern: /\b(?:e gjelber|green)\b/ },
  { name: "Yellow", hex: "#efca49", pattern: /\b(?:e verdhe|yellow)\b/ },
  { name: "Pink", hex: "#e98da9", pattern: /\b(?:roze|pink)\b/ },
  { name: "Purple", hex: "#855ab6", pattern: /\b(?:vjollce|purple|violet)\b/ },
  { name: "Orange", hex: "#ee9442", pattern: /\b(?:portokall(?:i|te)?|orange)\b/ },
  { name: "Brown", hex: "#8c5b40", pattern: /\b(?:kafe|brown)\b/ },
  { name: "Gold", hex: "#c9a34d", pattern: /\b(?:e arte|gold)\b/ },
  { name: "Beige", hex: "#dcc9ad", pattern: /\b(?:bezhe|beige)\b/ },
];

export function productColors(product: Product) {
  if (Array.isArray(product.brochureVariants) && product.brochureVariants.length) {
    return [...new Map(product.brochureVariants.filter((variant) => variant.color?.hex).map((variant) => [variant.color?.name ?? "", variant.color])).values()].filter((color):color is {name:string;hex:string}=>Boolean(color));
  }
  const specValues = Object.entries(product.specs || {})
    .filter(([key]) => /ngjyr|colou?r/i.test(key))
    .map(([, value]) => String(value));
  const description = String(product.description || "")
    .replace(/<\s*br\s*\/?\s*>|<\s*\/div\s*>/gi, "\n")
    .replace(/&euml;/gi, "ë")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/<[^>]*>/g, " ");
  const descriptionValues = description
    .split("\n")
    .map((line) =>
      line.match(/\b(?:ngjyra|ngjyrat|colou?r)\s*:\s*(.+)$/i)?.[1],
    )
    .filter(Boolean);
  const source = normalize([...specValues, ...descriptionValues].join(" / "));
  if (!source) return [];
  return COLORS.filter((color) => color.pattern.test(source)).slice(0, 5);
}
