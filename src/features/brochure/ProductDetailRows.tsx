import type { Product } from "../../domain/models";
import { SearchableSelect } from "../../components/SearchableSelect";
import { savedDetailEntries, type DetailEntry } from "./detailFacts";
import { EditorIcon } from "./EditorIcon";
import { t } from "./i18n";

type Change = (
  field: keyof Product | Partial<Product>,
  value?: Product[keyof Product],
) => void;

export function ProductDetailRows({
  product,
  entries,
  onChange,
}: {
  product: Product;
  entries: DetailEntry[];
  onChange: Change;
}) {
  const supplied = Array.isArray(product.brochureDetails);
  const rows = supplied ? savedDetailEntries(product) || [] : entries;
  const save = (next: DetailEntry[]) =>
    onChange(
      supplied ? "brochureDetails" : "specs",
      supplied
        ? next.map(([key, text]) => ({ key, text }))
        : Object.fromEntries(next),
    );
  const move = (index: number, delta: number) => {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    save(next);
  };
  return (
    <section
      className="cs-detail-rows"
      aria-label={t("Details shown in brochure")}
    >
      <div className="cs-detail-rows-heading">
        <h4>{t("Details shown in brochure")}</h4>
        <p>
          {t(
            "Edit each block separately. Use the arrows to change their order.",
          )}
        </p>
      </div>
      {rows.map(([key, text], index) => (
        <div
          className="cs-detail-row-card"
          data-detail-editor-key={key}
          key={supplied ? key : index}
        >
          <div className="cs-detail-row-heading">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <button
                type="button"
                aria-label={`${t("Move up")} ${index + 1}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <EditorIcon name="chevron-up" />
              </button>
              <button
                type="button"
                aria-label={`${t("Move down")} ${index + 1}`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <EditorIcon name="chevron-down" />
              </button>
              <button
                type="button"
                className="cs-detail-row-remove"
                aria-label={`${t("Remove detail")} ${key}`}
                onClick={() => save(rows.filter((_, i) => i !== index))}
              >
                <EditorIcon name="trash" />
              </button>
            </div>
          </div>
          {!supplied && (
            <label>
              <span>{t("Detail label")}</span>
              <input
                aria-label={`${t("Detail label")} ${index + 1}`}
                value={key}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = [event.target.value, text];
                  save(next);
                }}
              />
            </label>
          )}
          <label>
            <span>{t("Detail text")}</span>
            <textarea
              aria-label={`${t("Detail value")} ${index + 1}`}
              rows={Math.min(5, Math.max(2, text.split("\n").length))}
              value={text}
              onChange={(event) => {
                const next = [...rows];
                next[index] = [key, event.target.value];
                save(next);
              }}
            />
          </label>
          <label className="cs-detail-row-style">
            <span>{t("Block appearance")}</span>
            <SearchableSelect
              aria-label={`${t("Block appearance")} ${index + 1}`}
              value={
                typeof product.detailBlockStyles?.[key] === "string"
                  ? product.detailBlockStyles[key]
                  : "auto"
              }
              onChange={(event) =>
                onChange("detailBlockStyles", {
                  ...product.detailBlockStyles,
                  [key]: event.target.value,
                })
              }
            >
              <option value="auto">{t("Automatic")}</option>
              <option value="filled">{t("White block")}</option>
              <option value="outline">{t("Outlined block")}</option>
            </SearchableSelect>
          </label>
        </div>
      ))}
      <button
        type="button"
        className="cs-button secondary"
        onClick={() =>
          save([
            ...rows,
            [
              supplied
                ? `detail-${crypto.randomUUID()}`
                : `${t("New detail")} ${rows.length + 1}`,
              "",
            ],
          ])
        }
      >
        <EditorIcon name="plus" />
        {t("Add detail block")}
      </button>
    </section>
  );
}
