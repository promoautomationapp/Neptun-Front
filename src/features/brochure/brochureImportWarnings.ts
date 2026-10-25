import type { BrochureImportWarning, Product } from "../../domain/models";
import { parseBrochurePosition } from "./brochureImport";

export type ImportNoticeKind =
  "shared-order" | "set-position-conflict" | "other";
export interface BrochureImportNotice extends BrochureImportWarning {
  noticeKind: ImportNoticeKind;
  severity: "info" | "warning";
  page?: number;
  order?: number;
  offers: Array<Pick<Product, "code" | "name">>;
}

/** Older saved imports contain English messages rather than a structured kind. */
export function importNoticeKind(
  warning: BrochureImportWarning,
): ImportNoticeKind {
  if (warning.kind) return warning.kind;
  if (
    /different products (?:share this order|have the same order)/i.test(
      warning.message,
    )
  )
    return "shared-order";
  if (/Set rows have different brochure positions/i.test(warning.message))
    return "set-position-conflict";
  return "other";
}

/** Validate historical import notes against current offers without rewriting the document. */
export function brochureImportNotices(
  warnings: readonly (BrochureImportWarning | string)[] = [],
  products?: readonly Product[],
): BrochureImportNotice[] {
  const notes = new Map<string, BrochureImportNotice>();
  warnings.forEach((source, index) => {
    const warning =
      typeof source === "string"
        ? { row: 0, code: "", name: "", message: source }
        : source;
    const noticeKind = importNoticeKind(warning);
    const position = parseBrochurePosition(warning.position);
    let offers = (warning.relatedCodes || [warning.code])
      .filter(Boolean)
      .map((code) => ({
        code,
        name: code === warning.code ? warning.name : "",
      }));
    if (noticeKind === "shared-order" && products !== undefined) {
      if (!position) return;
      const current = products.filter(
        (product) =>
          Number(product.brochurePage) === position.page &&
          Number(product.brochureOrder) === position.order,
      );
      // Reordering, moving or removing an offer resolves the old sorting tie.
      // In particular, a warning saved for 1.1 must not follow a product to page 2.
      if (current.length < 2) return;
      offers = current.map(({ code, name }) => ({ code, name }));
    } else if (
      products !== undefined &&
      warning.code &&
      !products.some((product) => product.code === warning.code)
    )
      return;
    const note: BrochureImportNotice = {
      ...warning,
      noticeKind,
      severity:
        noticeKind === "shared-order" ? "info" : warning.severity || "warning",
      ...(position ? { page: position.page, order: position.order } : {}),
      offers,
    };
    const key =
      noticeKind === "shared-order"
        ? `shared:${warning.position}`
        : `${noticeKind}:${warning.position}:${warning.row}:${index}`;
    notes.set(key, note);
  });
  return [...notes.values()];
}
