import type {Campaign}from '../../domain/models';
export const DEFAULT_BROCHURE_FORMAT = "neptun1080x1350";
export const CANONICAL_BROCHURE_RATIO = 1080 / 1350;
const CANONICAL_BROCHURE_ASPECT = "1080 / 1350";
const PRINT_DPI = 300;
export type BrochureFormat=ReturnType<typeof digitalFormat>|ReturnType<typeof paperFormat>;
export type FormatInput=string|{brochureFormat?:unknown;width?:number;height?:number;id?:string}|null|undefined;
const defaultFormat=digitalFormat(DEFAULT_BROCHURE_FORMAT,'NEPTUN · 1080 × 1350 (4:5)',1080,1350);

function digitalFormat(id: string, label: string, width: number, height: number) {
  return Object.freeze({ id, label, width, height, ratio: width / height, aspectRatio: `${width} / ${height}`, paperMm: null, dpi: null });
}

function paperFormat(id: string, label: string, widthMm: number, heightMm: number) {
  return Object.freeze({
    id,
    label,
    width: Math.round(widthMm / 25.4 * PRINT_DPI),
    height: Math.round(heightMm / 25.4 * PRINT_DPI),
    ratio: widthMm / heightMm,
    aspectRatio: `${widthMm} / ${heightMm}`,
    paperMm: Object.freeze({ width: widthMm, height: heightMm }),
    dpi: PRINT_DPI,
  });
}

export const BROCHURE_FORMATS = Object.freeze([
  digitalFormat(DEFAULT_BROCHURE_FORMAT, "NEPTUN · 1080 × 1350 (4:5)", 1080, 1350),
  digitalFormat("square1080", "Square · 1080 × 1080 (1:1)", 1080, 1080),
  digitalFormat("landscape1920x1080", "Landscape · 1920 × 1080 (16:9)", 1920, 1080),
  digitalFormat("portrait1080x1440", "Portrait · 1080 × 1440 (3:4)", 1080, 1440),
  digitalFormat("story1080x1920", "Story · 1080 × 1920 (9:16)", 1080, 1920),
  paperFormat("a4", "A4 · 210 × 297 mm", 210, 297),
  paperFormat("a3", "A3 · 297 × 420 mm", 297, 420),
  paperFormat("a5", "A5 · 148 × 210 mm", 148, 210),
  paperFormat("letter", "Letter · 8.5 × 11 in", 215.9, 279.4),
  paperFormat("a4Landscape", "A4 landscape · 297 × 210 mm", 297, 210),
  paperFormat("a3Landscape", "A3 landscape · 420 × 297 mm", 420, 297),
]);

const aliases:Record<string,string> = {
  "4:5": DEFAULT_BROCHURE_FORMAT,
  "1080x1350": DEFAULT_BROCHURE_FORMAT,
  "1:1": "square1080",
  square: "square1080",
  "16:9": "landscape1920x1080",
  "3:4": "portrait1080x1440",
  "9:16": "story1080x1920",
  "us-letter": "letter",
};

export function resolveBrochureFormat(value:FormatInput):BrochureFormat {
  const requested = typeof value === "string" ? value : value?.brochureFormat ?? (Number.isFinite(value?.width) && Number.isFinite(value?.height) ? value?.id : "");
  const id = typeof requested === "string" ? requested.trim().toLowerCase() : "";
  const canonical = (Object.hasOwn(aliases,id) ? aliases[id] ?? id : id).toLowerCase();
  return BROCHURE_FORMATS.find((format) => format.id.toLowerCase() === canonical) || defaultFormat;
}

export function brochureExportGeometry(value:FormatInput, previewWidth = 794) {
  const format = resolveBrochureFormat(value);
  const renderWidth = Number.isFinite(previewWidth) && previewWidth > 0 ? previewWidth : 794;
  const pdfWidthMm = format.paperMm?.width ?? 210;
  const pdfHeightMm = format.paperMm?.height ?? pdfWidthMm / format.ratio;
  return {
    format,
    width: format.width,
    height: format.height,
    aspectRatio: format.aspectRatio,
    previewWidth: renderWidth,
    previewHeight: renderWidth / format.ratio,
    pixelRatio: 1,
    canvasWidth: format.width,
    canvasHeight: format.height,
    pdfWidthMm,
    pdfHeightMm,
    orientation: pdfWidthMm > pdfHeightMm ? "landscape" as const : "portrait" as const,
  };
}

/** Fit one complete reference page without changing its internal proportions. */
export function brochureFormatContentGeometry(value:FormatInput, frameWidth = 794) {
  const format = resolveBrochureFormat(value);
  const width = Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 794;
  const height = width / format.ratio;
  const widthFraction = Math.min(1, CANONICAL_BROCHURE_RATIO / format.ratio);
  const contentWidth = width * widthFraction;
  const contentHeight = contentWidth / CANONICAL_BROCHURE_RATIO;
  return {
    width,
    height,
    contentWidth,
    contentHeight,
    widthFraction,
    left: (width - contentWidth) / 2,
    top: (height - contentHeight) / 2,
  };
}

export function brochureFormatFrameStyle(campaign: Partial<Campaign>) {
  const format = resolveBrochureFormat(campaign);
  const { widthFraction } = brochureFormatContentGeometry(format);
  return {
    "--brochure-page-aspect": format.aspectRatio,
    "--brochure-format-content-width": `${Number((widthFraction * 100).toFixed(12))}%`,
  };
}

/** Existing page callers stay canonical; the enclosing frame selects output size. */
export function brochureFormatStyle(_value?:unknown) {
  return { "--brochure-page-aspect": CANONICAL_BROCHURE_ASPECT };
}
