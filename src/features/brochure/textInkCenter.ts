/** Center visible glyphs where the font's ascender/descender box is asymmetric.
 * Modern browsers trim the inline text box natively; older renderers use the
 * same font's measured ink and baseline metrics instead of a fixed pixel nudge. */
export function centerTextInk(
  element: HTMLElement,
  enabled = true,
  preferNativeTrim = true,
) {
  if (
    !enabled ||
    (preferNativeTrim &&
      typeof CSS !== "undefined" &&
      CSS.supports?.("text-box-trim", "trim-both") &&
      CSS.supports?.("text-box-edge", "cap alphabetic"))
  ) {
    element.style.removeProperty("--glyph-center-offset");
    return;
  }
  const style = getComputedStyle(element);
  let text = element.textContent?.replace(/\s+/g, " ").trim() || "";
  if (!text) return;
  if (style.textTransform === "uppercase") text = text.toLocaleUpperCase();
  if (style.textTransform === "lowercase") text = text.toLocaleLowerCase();
  const canvas = element.ownerDocument.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metric = context.measureText(text);
  const values = [
    metric.actualBoundingBoxAscent,
    metric.actualBoundingBoxDescent,
    metric.fontBoundingBoxAscent,
    metric.fontBoundingBoxDescent,
  ];
  if (!values.every(Number.isFinite)) return;
  const offset = (values[0]! - values[1]! - values[2]! + values[3]!) / 2;
  element.style.setProperty(
    "--glyph-center-offset",
    `${Math.round(offset * 100) / 100}px`,
  );
}
