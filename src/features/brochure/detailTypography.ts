const scalar = /^[\d\s.,+−–-]+$/;
const measurement =
  /^[+−–-]?\d+(?:[.,]\d+)?\s*(?:kg|l|w|hz|gb|tb|btu|°\s*c|h)$/i;

export type DetailTypographyKind = "number" | "metric" | "copy-long" | "copy";

interface DetailTypographyOptions {
  label?: string;
  imported?: boolean;
}

export interface DetailTypography {
  label?: string;
  separator?: string;
  value: string;
  kind: DetailTypographyKind;
}

// This is display typography only. Saved source text stays in the editor; a
// colon's label is omitted from the compact tile so its actual value has room.
export function detailTypography(text: unknown, { label, imported = false }: DetailTypographyOptions = {}): DetailTypography {
  const source = String(text);
  const colonPair = imported && source.match(/^([^:\r\n]+):[\t \r\n]*([\s\S]+)$/);
  const colonValue = colonPair && /\p{L}/u.test(colonPair[1]!) && !/^\s*https?\s*$/i.test(colonPair[1]!)
    ? colonPair[2]!.trim() : "";
  if (colonValue) {
    const kind = scalar.test(colonValue) ? "number"
      : measurement.test(colonValue) ? "metric"
      : colonValue.length > 24 || colonValue.split(/\s+/).length > 4 ? "copy-long" : "copy";
    return { value: colonValue, kind };
  }
  if (imported) {
    const pair = source.match(/^([^:\r\n]+(?=\r?\n))([\t \r\n]+)([\s\S]+)$/);
    if (pair && scalar.test(pair[3]!.trim())) {
      return { label: pair[1], separator: pair[2], value: pair[3]!, kind: "number" };
    }
  } else if (label && scalar.test(source.trim())) {
    const normalizedLabel = String(label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const displayLabel = /program/.test(normalizedLabel) ? "PROGRAME:" : label;
    return { label: displayLabel, separator: "\n", value: source, kind: "number" };
  }
  const content = source.trim();
  const kind = scalar.test(content) || measurement.test(content) ? "metric"
    : content.length > 24 || content.split(/\s+/).length > 4 ? "copy-long" : "copy";
  return { value: source, kind };
}
