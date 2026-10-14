import React from "react";
import type { Product } from "../../domain/models";
import { t } from "./i18n";
import {
  detailBlockPlacement,
  detailBlockStyle,
  updateDetailBlockPlacements,
} from "./detailBlockPlacement";
import "../../styles/product-detail-block.css";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type DetailPlacement = ReturnType<typeof detailBlockPlacement>;
type DetailGestureKind = "move" | "resize";
interface DetailGesture {
  kind: DetailGestureKind;
  startX: number;
  startY: number;
  original: DetailPlacement;
  next: DetailPlacement;
  pageWidth: number;
  parentWidth: number;
  baseWidth: number;
  baseHeight: number;
  limits: { left: number; right: number; top: number; bottom: number };
  changed?: boolean;
}
export interface ProductDetailBlockProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  "onChange"
> {
  product: Product;
  detailKey: string | number;
  onChange?: (
    field: "detailBlockPlacements" | "detailBlockStyles",
    value: Product["detailBlockPlacements"] | Product["detailBlockStyles"],
  ) => void;
  onRemove?: (key: string | number) => void;
  onEdit?: (key: string | number) => void;
  onSaveText?: (text: string) => void;
  editText?: string;
}

export function ProductDetailBlock({
  product,
  detailKey,
  children,
  className = "",
  onChange,
  onRemove,
  onEdit,
  onSaveText,
  editText = "",
  style,
  ...spanProps
}: ProductDetailBlockProps) {
  const { draggable, onDragStart, onDragEnd, ...blockProps } = spanProps;
  const saved = product.detailBlockPlacements?.[detailKey];
  const detailStyle = product.detailBlockStyles?.[detailKey];
  const defaultFilled = className.split(/\s+/).includes("detail-filled");
  const filled = detailStyle === "filled" || (detailStyle !== "outline" && defaultFilled);
  const visualClassName = className.split(/\s+/).filter((name) => name !== "detail-filled").join(" ");
  const [placement, setPlacement] = React.useState(() =>
    detailBlockPlacement(saved),
  );
  const [dragging, setDragging] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draftText, setDraftText] = React.useState(editText);
  const gesture = React.useRef<DetailGesture | null>(null);
  const blockRef = React.useRef<HTMLSpanElement>(null);
  const productRef = React.useRef(product);
  productRef.current = product;
  React.useEffect(
    () => setPlacement(detailBlockPlacement(saved)),
    [saved, detailKey],
  );
  const editable = Boolean(onChange || onRemove || onEdit || onSaveText);

  function saveText() {
    const value = draftText.trim();
    if (value) onSaveText?.(value);
    setEditing(false);
  }
  function toggleFill(event: React.MouseEvent<HTMLSpanElement>) {
    if (!onChange || (event.target as HTMLElement).closest("button,input")) return;
    event.preventDefault();
    event.stopPropagation();
    onChange("detailBlockStyles", { ...(productRef.current.detailBlockStyles || {}), [String(detailKey)]: filled ? "outline" : "filled" });
  }

  function commit(next: DetailPlacement) {
    setPlacement(next);
    onChange?.(
      "detailBlockPlacements",
      updateDetailBlockPlacements(productRef.current, detailKey, next),
    );
  }
  function begin(
    event: React.PointerEvent<HTMLElement>,
    kind: DetailGestureKind,
  ) {
    if (!onChange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const block = blockRef.current;
    if (!block) return;
    const page = block.closest(".brochure-page, .social-canvas");
    const card =
      block.closest(".brochure-product, .social-offer, .social-product") ||
      page;
    if (!page || !card || !block.parentElement) return;
    const pageRect = page.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const rect = block.getBoundingClientRect();
    const parent = block.parentElement.getBoundingClientRect();
    gesture.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      original: placement,
      next: placement,
      pageWidth: pageRect.width,
      parentWidth: parent.width,
      baseWidth: placement.width ?? (rect.width / parent.width) * 100,
      baseHeight: placement.height ?? (rect.height / pageRect.width) * 100,
      limits: {
        left:
          placement.x + ((cardRect.left - rect.left) / pageRect.width) * 100,
        right:
          placement.x + ((cardRect.right - rect.right) / pageRect.width) * 100,
        top: placement.y + ((cardRect.top - rect.top) / pageRect.width) * 100,
        bottom:
          placement.y +
          ((cardRect.bottom - rect.bottom) / pageRect.width) * 100,
      },
    };
    setDragging(true);
    block.closest(".cs-page-preview")?.classList.add("dragging-guides");
  }
  function move(event: {
    preventDefault: () => void;
    stopPropagation: () => void;
    clientX: number;
    clientY: number;
  }) {
    const action = gesture.current;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - action.startX;
    const dy = event.clientY - action.startY;
    if (action.kind === "move" && !action.changed && Math.hypot(dx, dy) < 3) return;
    action.next =
      action.kind === "move"
        ? {
            ...action.original,
            x: clamp(
              action.original.x + (dx / action.pageWidth) * 100,
              action.limits.left,
              action.limits.right,
            ),
            y: clamp(
              action.original.y + (dy / action.pageWidth) * 100,
              action.limits.top,
              action.limits.bottom,
            ),
          }
        : {
            ...action.original,
            width: clamp(
              action.baseWidth + (dx / action.parentWidth) * 100,
              5,
              150,
            ),
            height: clamp(
              action.baseHeight + (dy / action.pageWidth) * 100,
              0.5,
              100,
            ),
          };
    action.changed = Math.hypot(dx, dy) > 2;
    setPlacement(action.next);
  }
  function end(event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) {
    const action = gesture.current;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = null;
    setDragging(false);
    blockRef.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
    if (action.changed) commit(action.next);
    else setPlacement(action.original);
  }
  function cancel(event: { stopPropagation: () => void }) {
    if (!gesture.current) return;
    event.stopPropagation();
    setPlacement(gesture.current.original);
    gesture.current = null;
    setDragging(false);
    blockRef.current?.closest(".cs-page-preview")?.classList.remove("dragging-guides");
  }
  function keyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    kind: DetailGestureKind,
  ) {
    if (
      !onChange ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const block = blockRef.current;
    if (!block) return;
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    if (kind === "resize") {
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        const parent = block.parentElement?.getBoundingClientRect();
        if (!parent) return;
        const baseWidth =
          placement.width ??
          (block.getBoundingClientRect().width / parent.width) * 100;
        commit({
          ...placement,
          width: clamp(
            baseWidth + direction * (event.shiftKey ? 10 : 2),
            5,
            150,
          ),
        });
      } else {
        const page = block.closest(".brochure-page, .social-canvas");
        if (!page) return;
        const baseHeight =
          placement.height ??
          (block.getBoundingClientRect().height /
            page.getBoundingClientRect().width) *
            100;
        commit({
          ...placement,
          height: clamp(
            baseHeight + direction * (event.shiftKey ? 1 : 0.25),
            0.5,
            100,
          ),
        });
      }
    } else {
      const axis = ["ArrowLeft", "ArrowRight"].includes(event.key) ? "x" : "y";
      commit({
        ...placement,
        [axis]: placement[axis] + direction * (event.shiftKey ? 1 : 0.25),
      });
    }
  }
  const label = `${t("Detail block")}: ${String(detailKey)}`;
  const handleProps = (
    kind: DetailGestureKind,
  ): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
    onPointerDown: (event) => begin(event, kind),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onKeyDown: (event) => keyboard(event, kind),
    onClick: (event) => event.stopPropagation(),
  });
  return (
    <span
      {...blockProps}
      ref={blockRef}
      className={`product-detail-block ${editable ? "editable" : ""} ${dragging ? "moving" : ""} ${filled ? "detail-filled detail-style-filled" : detailStyle === "outline" ? "detail-style-outline" : ""} ${visualClassName}`}
      style={{ ...style, ...detailBlockStyle(placement) }}
      data-detail-key={String(detailKey)}
      onDoubleClick={toggleFill}
      onPointerDown={onChange ? (event) => { if (!(event.target as Element).closest("button,input,textarea,select,.product-detail-block-tools")) begin(event, "move"); } : undefined}
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {children}
      {editable && (
        <i
          className="product-detail-block-tools"
          data-export-hide="true"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {draggable && onDragStart && (
            <button type="button" draggable className="detail-block-reorder" title={t("Drag to reorder details")} aria-label={`${t("Reorder")} ${label}`} onDragStart={(event) => { event.stopPropagation(); onDragStart(event as unknown as React.DragEvent<HTMLSpanElement>); }} onDragEnd={(event) => { event.stopPropagation(); onDragEnd?.(event as unknown as React.DragEvent<HTMLSpanElement>); }}>⠿</button>
          )}
          {onChange && (
            <button
              type="button"
              className="detail-block-move"
              title={t("Drag to move detail block")}
              aria-label={`${t("Move")} ${label}`}
              {...handleProps("move")}
            >
              ✥
            </button>
          )}
          {(onEdit || onSaveText) && (
            <button
              type="button"
              className="detail-block-edit"
              title={t("Edit this detail")}
              aria-label={`${t("Edit this detail")} ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                if (onSaveText) { setDraftText(editText); setEditing(true); }
                else onEdit?.(detailKey);
              }}
            >
              ✎
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="detail-block-remove"
              title={t("Remove detail block")}
              aria-label={`${t("Remove detail block")}: ${String(detailKey)}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove(detailKey);
              }}
            >
              ×
            </button>
          )}
          {onChange && (
            <button
              type="button"
              className="detail-block-resize"
              title={t("Drag to resize detail block")}
              aria-label={`${t("Resize")} ${label}`}
              {...handleProps("resize")}
            >
              ↘
            </button>
          )}
        </i>
      )}
      {editing && <span className="detail-block-inline-editor" data-export-hide="true" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <input autoFocus value={draftText} aria-label={t("Edit this detail")} onChange={(event) => setDraftText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveText(); } else if (event.key === "Escape") { event.preventDefault(); setEditing(false); } }} />
        <button type="button" onClick={saveText} aria-label={t("Save detail")}>✓</button>
        <button type="button" onClick={() => setEditing(false)} aria-label={t("Cancel")}>×</button>
      </span>}
    </span>
  );
}
