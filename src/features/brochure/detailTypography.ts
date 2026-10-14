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

// Separate typography, never facts: an imported label/value pair keeps its
// original wording and separator, including a colon or a manual line break.
export function detailTypography(
  text: unknown,
  { label, imported = false }: DetailTypographyOptions = {},
): DetailTypography {
  const source = String(text);
  if (imported) {
    const pair = source.match(
      /^([^:\r\n]+:|[^:\r\n]+(?=\r?\n))([\t \r\n]+|(?=\S))([\s\S]+)$/,
    );
    const [, pairLabel, separator, value] = pair ?? [];
    if (
      pairLabel !== undefined &&
      separator !== undefined &&
      value !== undefined &&
      scalar.test(value.trim())
    ) {
      return { label: pairLabel, separator, value, kind: "number" };
    }
  } else if (label && scalar.test(source.trim())) {
    return { label, separator: "\n", value: source, kind: "number" };
  }
  const content = source.trim();
  const kind =
    scalar.test(content) || measurement.test(content)
      ? "metric"
      : content.length > 24 || content.split(/\s+/).length > 4
        ? "copy-long"
        : "copy";
  return { value: source, kind };
}
