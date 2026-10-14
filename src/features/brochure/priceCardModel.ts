export type FontWeight="regular"|"bold"|"black";
interface FontMetrics{advances:Record<string,number>;kerning?:Record<string,number>}
export interface PriceRun{text:string;superscript?:boolean}
import fontMetrics from "./priceCardFontMetrics.json" with { type: "json" };

// Prices in the supplied InDesign artwork use decimal dots and no thousands separators.
export function artworkPrice(value:unknown) {
  const cents = Math.round((Number(value) + Number.EPSILON) * 100);
  const whole = String(Math.floor(cents / 100));
  const fraction = cents % 100;
  return { whole, cents: fraction ? String(fraction).padStart(2, "0") : "", text: fraction ? `${whole}.${String(fraction).padStart(2, "0")}` : whole };
}

export function artworkInstallment(sale:unknown, installments:number|string = 12) {
  const count = Math.min(60, Math.max(1, Number.parseInt(String(installments), 10) || 12));
  return `${count} x muaj: ${(Number(sale) / count).toFixed(1)} €`;
}

export function artworkSaving(regular:unknown, sale:unknown, mode = "amount") {
  if (!(Number(sale) > 0 && Number(regular) > Number(sale))) return null;
  return mode === "percentage"
    ? { label: "ZBRITJE", text: `${Math.round((1 - Number(sale) / Number(regular)) * 100)}%` }
    : { label: "KURSENI", text: `${artworkPrice(Number(regular) - Number(sale)).text}€` };
}

// Advances come from the original OTF files, so long prices fit before export or font loading.
export function artworkTextWidth(text: string, fontSize: number, weight:FontWeight = "regular") {
  const { advances, kerning }:FontMetrics = fontMetrics[weight];
  return [...text].reduce((width, character, index) => width + ((advances[character] ?? 0.6) + (kerning?.[text.slice(index, index + 2)] || 0)) * fontSize, 0);
}

export function fittedArtworkFont(text: string, fontSize: number, width: number, weight: FontWeight = "regular") {
  return Math.min(fontSize, fontSize * width / Math.max(1, artworkTextWidth(text, fontSize, weight)));
}

export function priceRuns(value:unknown, sale = false) {
  const price = artworkPrice(value);
  return price.cents
    ? [{ text: `${price.whole}.` }, { text: `${price.cents}${sale ? " " : ""}`, superscript: true }, { text: sale ? "€" : " €" }]
    : [{ text: `${price.whole} €` }];
}

export function fittedPriceFont(runs:PriceRun[], fontSize:number, width:number, weight:FontWeight, prefix = "") {
  const naturalWidth = artworkTextWidth(prefix, fontSize, weight) + runs.reduce((total, run) => total + artworkTextWidth(run.text, fontSize * (run.superscript ? 0.583 : 1), weight), 0);
  return naturalWidth <= width + 0.01 ? fontSize : fontSize * width / Math.max(1, naturalWidth);
}
