import type { BrochureImportWarning, Product } from "../../domain/models";
import { brochureImportNotices } from "./brochureImportWarnings";
import { t } from "./i18n";
import "./brochure-import-notices.css";

/** Import guidance stays available without covering the brochure canvas. */
export function BrochureImportNotices({
  warnings = [],
  products,
}: {
  warnings?: readonly (BrochureImportWarning | string)[];
  products?: readonly Product[];
}) {
  const notes = brochureImportNotices(warnings, products);
  if (!notes.length) return null;
  return (
    <details className="cs-import-notices">
      <summary>
        {t("Import notes")} <span>{notes.length}</span>
      </summary>
      <div className="cs-import-notices-body">
        {notes.map((note, index) => (
          <article
            key={`${note.position}-${note.row}-${index}`}
            data-severity={note.severity}
          >
            <strong>
              {note.noticeKind === "shared-order"
                ? t("Shared Excel order")
                : note.noticeKind === "set-position-conflict"
                  ? t("Check Set positions in Excel")
                  : t("Import note")}
              {note.position ? ` · ${note.position}` : ""}
            </strong>
            {note.noticeKind === "shared-order" ? (
              <>
                <p>
                  {t(
                    "These offers share a brochure position. They were kept as separate cards in Excel row order.",
                  )}
                </p>
                {note.offers.length > 0 && (
                  <p className="cs-import-notice-products">
                    {note.offers
                      .map(
                        (offer) =>
                          `${offer.name || offer.code}${offer.name ? ` (${offer.code})` : ""}`,
                      )
                      .join(" · ")}
                  </p>
                )}
                <p>
                  {note.page !== undefined && note.order !== undefined && (
                    <>
                      {t("Excel position")} {note.position} = {t("page")}{" "}
                      {note.page}, {t("order")} {note.order}.{" "}
                    </>
                  )}
                  {t(
                    "Keep this if intended. To change the order, give each offer a different Brochure position in Excel, or move the cards in the brochure.",
                  )}
                </p>
              </>
            ) : note.noticeKind === "set-position-conflict" ? (
              <>
                {note.name && (
                  <p>
                    {note.name} ({note.code})
                  </p>
                )}
                <p>
                  {t(
                    "The rows of this Set have different brochure positions. The first position was used.",
                  )}
                </p>
                <p>
                  {t(
                    "Give every row in the Set the same Brochure position in Excel to keep its products together.",
                  )}
                </p>
              </>
            ) : (
              <p>{t(note.message)}</p>
            )}
            {!!note.relatedRows?.length && (
              <small>
                {t("Excel rows")}: {note.relatedRows.join(", ")}
              </small>
            )}
          </article>
        ))}
      </div>
    </details>
  );
}
