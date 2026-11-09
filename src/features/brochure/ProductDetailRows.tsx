import type { Product } from "../../domain/models";
import { useRef, useState, type PointerEvent } from "react";
import { SearchableSelect } from "../../components/SearchableSelect";
import {
  catalogDetailFacts,
  normalizedDetail,
  savedDetailEntries,
  type DetailEntry,
} from "./detailFacts";
import { EditorIcon } from "./EditorIcon";
import { t } from "./i18n";
import { isIphoneIosDetail } from "./optionalProductDetails";
import { isWarrantyDetail } from "./warranty";

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
  const sourceRows: DetailEntry[] = supplied
    ? savedDetailEntries(product) || []
    : entries.map(([key, text]) => [key, `${key}: ${text}`]);
  const rows: DetailEntry[] =
    product.warranty &&
    !sourceRows.some(([key, text]) => isWarrantyDetail(key, text))
      ? [...sourceRows, ["__warranty", product.warranty]]
      : sourceRows;
  const [editing, setEditing] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const sourceDraft = useRef<{ id: string; text: string } | null>(null);
  const selectingSource = useRef<{ id: string; text: string } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const pointerDrag = useRef<{
    key: string;
    target: string;
    id: number;
  } | null>(null);
  const nativeDrag = useRef<string | null>(null);
  const dragType = "application/x-brochure-detail-row";
  const serialize = (next: DetailEntry[]) =>
    next.map(([key, text]) => ({ key, text }));
  const save = (next: DetailEntry[], changes: Partial<Product> = {}) => {
    const warranty = next.find(([key, text]) => isWarrantyDetail(key, text));
    onChange({
      brochureDetails: serialize(next),
      autoSpecsDisabled: true,
      ...(warranty ? { warranty: warranty[1] } : {}),
      ...changes,
    });
  };
  const sourceFacts = catalogDetailFacts(product).map(({ key, value }) => {
    const id = JSON.stringify([normalizedDetail(key), normalizedDetail(value)]);
    return {
      id,
      key,
      value,
      text:
        product.brochureSourceDetailEdits?.[id] ??
        (key ? `${key}: ${value}` : value),
    };
  });
  const available = sourceFacts.filter(
    ({ id, key, value, text: displayedText }, index, facts) => {
      if (!value) return false;
      const text = normalizedDetail(value),
        full = normalizedDetail(`${key}: ${value}`),
        edited = normalizedDetail(displayedText);
      return (
        !rows.some(
          ([rowKey, rowText]) =>
            normalizedDetail(rowText) === text ||
            normalizedDetail(rowText) === full ||
            normalizedDetail(rowText) === edited ||
            normalizedDetail(`${rowKey}: ${rowText}`) === full,
        ) && !facts.slice(0, index).some((fact) => fact.id === id)
      );
    },
  );
  const startSourceEdit = (id: string, text: string) => {
    sourceDraft.current = { id, text };
    setEditingSource({ id, text });
  };
  const finishSourceEdit = (commit: boolean) => {
    const draft = sourceDraft.current;
    if (!draft) return;
    sourceDraft.current = null;
    setEditingSource(null);
    if (commit && draft.text.trim())
      onChange({
        brochureSourceDetailEdits: {
          ...product.brochureSourceDetailEdits,
          [draft.id]: draft.text.trim(),
        },
      });
  };
  const reorder = (key: string, target: string) => {
    const index = rows.findIndex(([rowKey]) => rowKey === key);
    const destination = rows.findIndex(([rowKey]) => rowKey === target);
    if (index < 0 || destination < 0 || index === destination) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(destination, 0, moved!);
    save(next);
    setAnnouncement(`${t("Detail moved to position")} ${destination + 1}`);
  };
  const move = (index: number, delta: number) => {
    if (!rows[index] || !rows[index + delta]) return;
    reorder(rows[index]![0], rows[index + delta]![0]);
  };
  const stopDrag = () => {
    pointerDrag.current = null;
    nativeDrag.current = null;
    setDragged(null);
    setDropTarget(null);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerDrag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    event.preventDefault();
    const cards = [
      ...(list.current?.querySelectorAll<HTMLElement>(
        "[data-detail-editor-key]",
      ) || []),
    ];
    const target = cards.find((card) => {
      const rect = card.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    if (target?.dataset.detailEditorKey) {
      gesture.target = target.dataset.detailEditorKey;
      setDropTarget(gesture.target);
    }
    // Keep a long list reachable while dragging with a finger.
    const scroll = list.current?.closest<HTMLElement>(".cs-modal-body");
    const bounds = scroll?.getBoundingClientRect();
    if (scroll && bounds) {
      if (event.clientY < bounds.top + 36) scroll.scrollTop -= 16;
      else if (event.clientY > bounds.bottom - 36) scroll.scrollTop += 16;
    }
  };
  return (
    <section
      className="cs-detail-rows"
      aria-label={t("Details shown in brochure")}
    >
      <div className="cs-detail-rows-heading">
        <h4>{t("Details shown in brochure")}</h4>
        <p>{t("Choose what to show. Drag rows to reorder.")}</p>
      </div>
      <div className="cs-detail-row-list" ref={list}>
        {rows.map(([key, text], index) => (
          <div
            className={`cs-detail-row-card ${dragged === key ? "is-dragging" : ""} ${dropTarget === key && dragged !== key ? "is-drop-target" : ""}`}
            data-detail-editor-key={key}
            key={key}
            onDragOver={(event) => {
              if (
                !nativeDrag.current ||
                !event.dataTransfer.types.includes(dragType)
              )
                return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(key);
            }}
            onDrop={(event) => {
              const source = nativeDrag.current;
              if (!source || event.dataTransfer.getData(dragType) !== source)
                return;
              event.preventDefault();
              reorder(source, key);
              stopDrag();
            }}
          >
            <div className="cs-detail-row-heading">
              <button
                type="button"
                className="cs-detail-row-grip"
                draggable
                aria-label={`${t("Drag to reorder detail")} ${index + 1}`}
                title={t("Drag to reorder. Use arrow keys to move.")}
                onDragStart={(event) => {
                  nativeDrag.current = key;
                  event.dataTransfer.setData(dragType, key);
                  event.dataTransfer.effectAllowed = "move";
                  setDragged(key);
                }}
                onDragEnd={stopDrag}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    move(index, event.key === "ArrowUp" ? -1 : 1);
                  }
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.focus();
                  pointerDrag.current = {
                    key,
                    target: key,
                    id: event.pointerId,
                  };
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  setDragged(key);
                }}
                onPointerMove={pointerMove}
                onPointerUp={(event) => {
                  const gesture = pointerDrag.current;
                  if (!gesture || gesture.id !== event.pointerId) return;
                  event.preventDefault();
                  reorder(gesture.key, gesture.target);
                  stopDrag();
                }}
                onPointerCancel={stopDrag}
                onLostPointerCapture={() => {
                  if (pointerDrag.current) stopDrag();
                }}
              >
                <EditorIcon name="drag" />
              </button>
              <label className="cs-detail-row-visible">
                <input
                  type="checkbox"
                  aria-label={
                    isIphoneIosDetail(product, key, text)
                      ? t("Show iOS version in brochure")
                      : `${t("Show detail in brochure")} ${index + 1}`
                  }
                  checked={
                    isWarrantyDetail(key, text)
                      ? product.hideWarranty !== true
                      : isIphoneIosDetail(product, key, text)
                        ? product.detailBlockPlacements?.[key]?.hidden === false
                        : product.detailBlockPlacements?.[key]?.hidden !== true
                  }
                  onChange={(event) =>
                    onChange({
                      brochureDetails: serialize(rows),
                      autoSpecsDisabled: true,
                      ...(isWarrantyDetail(key, text)
                        ? { hideWarranty: !event.target.checked }
                        : {}),
                      detailBlockPlacements: {
                        ...product.detailBlockPlacements,
                        [key]: {
                          ...product.detailBlockPlacements?.[key],
                          hidden: !event.target.checked,
                        },
                        ...(isWarrantyDetail(key, text)
                          ? {
                              __warranty: {
                                ...product.detailBlockPlacements?.__warranty,
                                hidden: !event.target.checked,
                              },
                            }
                          : {}),
                      },
                    })
                  }
                />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </label>
              <button
                type="button"
                className="cs-detail-row-preview"
                title={text}
                onClick={() => setEditing(editing === key ? null : key)}
                tabIndex={-1}
              >
                {text.replace(/\s*\n\s*/g, " · ") || t("New detail")}
              </button>
              <div>
                <button
                  type="button"
                  className="cs-detail-row-edit"
                  aria-label={`${t("Edit text")} ${index + 1}`}
                  title={t("Edit text and appearance")}
                  aria-expanded={editing === key}
                  onClick={() => setEditing(editing === key ? null : key)}
                >
                  <EditorIcon name="edit" />
                </button>
                <button
                  type="button"
                  className="cs-detail-row-remove"
                  aria-label={`${t("Remove detail")} ${key}`}
                  onClick={() => {
                    if (isWarrantyDetail(key, text))
                      onChange({
                        hideWarranty: true,
                        detailBlockPlacements: {
                          ...product.detailBlockPlacements,
                          [key]: {
                            ...product.detailBlockPlacements?.[key],
                            hidden: true,
                          },
                        },
                      });
                    else save(rows.filter((_, i) => i !== index));
                  }}
                >
                  <EditorIcon name="trash" />
                </button>
              </div>
            </div>
            {editing === key && (
              <div className="cs-detail-row-expanded">
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
                <div className="cs-detail-row-reorder-buttons">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`${t("Move up")} ${index + 1}`}
                  >
                    <EditorIcon name="chevron-up" />
                    {t("Move up")}
                  </button>
                  <button
                    type="button"
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`${t("Move down")} ${index + 1}`}
                  >
                    <EditorIcon name="chevron-down" />
                    {t("Move down")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <span
        className="cs-detail-row-announcement"
        role="status"
        aria-live="polite"
      >
        {announcement}
      </span>
      {available.length > 0 && (
        <details className="cs-detail-source-options">
          <summary>
            {t("Available source details")} <span>{available.length}</span>
          </summary>
          {available.map(({ id, text }, index) => (
            <div className="cs-detail-source-row" key={id}>
              <input
                type="checkbox"
                checked={false}
                aria-label={text}
                onPointerDown={() => {
                  selectingSource.current =
                    sourceDraft.current?.id === id
                      ? { ...sourceDraft.current }
                      : null;
                }}
                onChange={() => {
                  const draft =
                    sourceDraft.current?.id === id
                      ? sourceDraft.current
                      : selectingSource.current?.id === id
                        ? selectingSource.current
                        : null;
                  const selectedText = draft?.text.trim() || text;
                  const sourceKey = `source-${index}-${crypto.randomUUID()}`;
                  save(
                    [...rows, [sourceKey, selectedText]],
                    draft
                      ? {
                          brochureSourceDetailEdits: {
                            ...product.brochureSourceDetailEdits,
                            [id]: selectedText,
                          },
                        }
                      : {},
                  );
                  sourceDraft.current = null;
                  selectingSource.current = null;
                  setEditingSource(null);
                }}
              />
              {editingSource?.id === id ? (
                <input
                  className="cs-detail-source-text"
                  autoFocus
                  aria-label={`${t("Edit source detail")} ${index + 1}`}
                  value={editingSource.text}
                  onChange={(event) => {
                    const draft = { id, text: event.target.value };
                    sourceDraft.current = draft;
                    setEditingSource(draft);
                  }}
                  onBlur={() => finishSourceEdit(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      finishSourceEdit(true);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      finishSourceEdit(false);
                    }
                  }}
                />
              ) : (
                <span title={text}>{text}</span>
              )}
              <button
                type="button"
                className="cs-detail-source-edit"
                aria-label={`${t("Edit source detail")} ${index + 1}`}
                title={t("Edit text")}
                onClick={() => startSourceEdit(id, text)}
              >
                <EditorIcon name="edit" />
              </button>
            </div>
          ))}
        </details>
      )}
      <button
        type="button"
        className="cs-button secondary"
        onClick={() => {
          const key = `detail-${crypto.randomUUID()}`;
          save([...rows, [key, ""]]);
          setEditing(key);
        }}
      >
        <EditorIcon name="plus" />
        {t("Add detail block")}
      </button>
    </section>
  );
}
