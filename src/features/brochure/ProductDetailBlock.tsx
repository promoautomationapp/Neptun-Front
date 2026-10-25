import { EditorIcon } from "./EditorIcon";
import {
  CornerHandles,
  resizeFromCorner,
  type ResizeCorner,
} from "./resizeCorners";
import React from "react";
import { createPortal } from "react-dom";
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
  corner?: ResizeCorner;
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
  const {
    draggable,
    onDragStart,
    onDragEnd,
    onFocus,
    onKeyDown,
    tabIndex,
    ...blockProps
  } = spanProps;
  const saved = product.detailBlockPlacements?.[detailKey];
  const detailStyle = product.detailBlockStyles?.[detailKey];
  const defaultFilled = className.split(/\s+/).includes("detail-filled");
  const filled =
    detailStyle === "filled" || (detailStyle !== "outline" && defaultFilled);
  const visualClassName = className
    .split(/\s+/)
    .filter((name) => name !== "detail-filled")
    .join(" ");
  const [placement, setPlacement] = React.useState(() =>
    detailBlockPlacement(saved),
  );
  const [dragging, setDragging] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [selected, setSelected] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuAbove, setMenuAbove] = React.useState(false);
  const [toolbarPosition, setToolbarPosition] = React.useState({
    left: 8,
    top: 8,
  });
  const toolsRef = React.useRef<HTMLDivElement>(null);
  const moreRef = React.useRef<HTMLButtonElement>(null);
  const [draftText, setDraftText] = React.useState(editText);
  const gesture = React.useRef<DetailGesture | null>(null);
  const blockRef = React.useRef<HTMLSpanElement>(null);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = React.useRef(false);
  React.useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );
  const productRef = React.useRef(product);
  productRef.current = product;
  React.useEffect(
    () => setPlacement(detailBlockPlacement(saved)),
    [saved, detailKey],
  );
  const editable = Boolean(onChange || onRemove || onEdit || onSaveText);
  const toolsId = React.useId();
  React.useEffect(() => {
    if (!editable) return;
    const selectTarget = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        blockRef.current?.contains(target) ||
        toolsRef.current?.contains(target)
      ) {
        setSelected(true);
      } else {
        setSelected(false);
        setMenuOpen(false);
        setEditing(false);
        if (clickTimer.current) clearTimeout(clickTimer.current);
      }
    };
    document.addEventListener("pointerdown", selectTarget, true);
    document.addEventListener("focusin", selectTarget, true);
    return () => {
      document.removeEventListener("pointerdown", selectTarget, true);
      document.removeEventListener("focusin", selectTarget, true);
    };
  }, [editable]);
  React.useLayoutEffect(() => {
    if (!selected) return;
    const position = () => {
      const rect = blockRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = toolsRef.current?.offsetWidth || 176;
      const top = rect.top >= 56 ? rect.top - 46 : rect.bottom + 12;
      setToolbarPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top,
      });
      const menuHeight =
        toolsRef.current?.querySelector<HTMLElement>(".detail-context-menu")
          ?.offsetHeight || 132;
      setMenuAbove(top + 48 + menuHeight > window.innerHeight - 8);
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [selected, editing, placement, menuOpen]);

  function editDetail() {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    setMenuOpen(false);
    if (editing) {
      blockRef.current
        ?.querySelector<HTMLInputElement>(".detail-block-inline-editor input")
        ?.focus();
      return;
    }
    if (onSaveText) {
      setDraftText(editText);
      setEditing(true);
    } else onEdit?.(detailKey);
  }
  function removeDetail() {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    setMenuOpen(false);
    onRemove?.(detailKey);
  }

  function saveText() {
    const value = draftText.trim();
    if (value) onSaveText?.(value);
    setEditing(false);
  }
  function toggleFill(event: React.MouseEvent<HTMLSpanElement>) {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (onEdit && !(event.target as Element).closest("button,input")) {
      event.stopPropagation();
      onEdit(detailKey);
      return;
    }
    if (!onChange || (event.target as HTMLElement).closest("button,input"))
      return;
    event.preventDefault();
    event.stopPropagation();
    onChange("detailBlockStyles", {
      ...(productRef.current.detailBlockStyles || {}),
      [String(detailKey)]: filled ? "outline" : "filled",
    });
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
    setSelected(true);
    setMenuOpen(false);
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
    if (pageRect.width <= 0 || parent.width <= 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = {
      kind,
      corner: (event.currentTarget.dataset.resizeCorner ||
        "bottom-right") as ResizeCorner,
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
    moved.current = true;
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
    if (action.kind === "move" && !action.changed && Math.hypot(dx, dy) < 3)
      return;
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
        : (() => {
            const frame = {
              x: (action.original.x * action.pageWidth) / action.parentWidth,
              y: (action.original.y * action.pageWidth) / action.parentWidth,
              width: action.baseWidth,
              height:
                (action.baseHeight * action.pageWidth) / action.parentWidth,
            };
            const next = resizeFromCorner(
              frame,
              (dx / action.parentWidth) * 100,
              (dy / action.parentWidth) * 100,
              action.corner,
              {
                minWidth: 5,
                minHeight: (0.5 * action.pageWidth) / action.parentWidth,
                maxWidth: 150,
                maxHeight: (100 * action.pageWidth) / action.parentWidth,
              },
            );
            return {
              ...action.original,
              x: (next.x * action.parentWidth) / action.pageWidth,
              y: (next.y * action.parentWidth) / action.pageWidth,
              width: next.width,
              height: (next.height * action.parentWidth) / action.pageWidth,
            };
          })();
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
    blockRef.current
      ?.closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
    moved.current = Boolean(action.changed);
    if (action.changed) commit(action.next);
    else setPlacement(action.original);
  }
  function cancel(event: { stopPropagation: () => void }) {
    if (!gesture.current) return;
    event.stopPropagation();
    setPlacement(gesture.current.original);
    gesture.current = null;
    setDragging(false);
    blockRef.current
      ?.closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
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
        if (!parent || parent.width <= 0) return;
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
        if (!page || page.getBoundingClientRect().width <= 0) return;
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
      className={`product-detail-block ${editable ? "editable" : ""} ${dragging ? "moving" : ""} ${selected ? "detail-selected" : ""} ${filled ? "detail-filled detail-style-filled" : detailStyle === "outline" ? "detail-style-outline" : ""} ${visualClassName}`}
      style={{ ...style, ...detailBlockStyle(placement) }}
      data-detail-key={String(detailKey)}
      tabIndex={editable ? (tabIndex ?? 0) : tabIndex}
      role={editable ? "group" : blockProps.role}
      aria-label={editable ? label : blockProps["aria-label"]}
      onFocus={(event) => {
        if (editable) setSelected(true);
        onFocus?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          !editable ||
          event.target !== event.currentTarget
        )
          return;
        if (event.key === "Tab" && !event.shiftKey && selected) {
          const firstTool =
            toolsRef.current?.querySelector<HTMLButtonElement>("button");
          if (firstTool) {
            event.preventDefault();
            event.stopPropagation();
            firstTool.focus();
          }
        } else if (
          (event.key === "F10" && event.shiftKey) ||
          event.key === "ContextMenu"
        ) {
          event.preventDefault();
          event.stopPropagation();
          setMenuOpen(true);
          moreRef.current?.focus();
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          setSelected(true);
          editDetail();
        } else if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          setSelected(true);
        } else if (event.key === "Escape") {
          event.stopPropagation();
          setSelected(false);
          setMenuOpen(false);
        }
      }}
      onDoubleClick={toggleFill}
      onClick={(event) => {
        if (
          (event.target as Element).closest(
            "button,input,textarea,.product-detail-block-tools",
          )
        )
          return;
        if (moved.current) {
          moved.current = false;
          return;
        }
        if (editable) {
          event.stopPropagation();
          setSelected(true);
        }
        if (onSaveText) {
          if (clickTimer.current) clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(() => {
            setDraftText(editText);
            setEditing(true);
          }, 220);
        }
      }}
      onPointerDown={
        onChange
          ? (event) => {
              if (
                !(event.target as Element).closest(
                  "button,input,textarea,select,.product-detail-block-tools",
                )
              )
                begin(event, "move");
            }
          : undefined
      }
      onPointerMove={onChange ? move : undefined}
      onPointerUp={onChange ? end : undefined}
      onPointerCancel={onChange ? cancel : undefined}
      onLostPointerCapture={onChange ? cancel : undefined}
    >
      {children}
      {editable &&
        selected &&
        createPortal(
          <div
            ref={toolsRef}
            className="product-detail-context-tools"
            data-menu-above={menuAbove ? "true" : undefined}
            role="toolbar"
            aria-label={label}
            data-export-hide="true"
            style={toolbarPosition}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (clickTimer.current) clearTimeout(clickTimer.current);
            }}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              const buttons = Array.from(
                toolsRef.current?.querySelectorAll<HTMLButtonElement>(
                  "button",
                ) || [],
              );
              const current = buttons.indexOf(
                event.target as HTMLButtonElement,
              );
              if (event.key === "Tab" && event.shiftKey && current === 0) {
                event.preventDefault();
                blockRef.current?.focus();
              } else if (
                event.key === "Tab" &&
                !event.shiftKey &&
                current === buttons.length - 1
              ) {
                const corner =
                  blockRef.current?.querySelector<HTMLButtonElement>(
                    ".resize-corner",
                  );
                if (corner) {
                  event.preventDefault();
                  corner.focus();
                }
              } else if (event.key === "Escape") {
                event.preventDefault();
                if (menuOpen) {
                  setMenuOpen(false);
                  moreRef.current?.focus();
                } else {
                  blockRef.current?.focus();
                  setSelected(false);
                }
              }
            }}
          >
            {(onEdit || onSaveText) && (
              <button
                type="button"
                className="detail-context-edit"
                title={t("Edit this detail")}
                aria-label={`${t("Edit this detail")} ${label}`}
                onClick={editDetail}
              >
                <EditorIcon name="edit" /> <span>{t("Edit")}</span>
              </button>
            )}
            {onChange && (
              <button
                type="button"
                className="detail-context-move"
                title={t("Drag to move detail block")}
                aria-label={`${t("Move")} ${label}`}
                {...handleProps("move")}
              >
                <EditorIcon name="move" />
              </button>
            )}
            {(onChange || onRemove || (draggable && onDragStart)) && (
              <button
                ref={moreRef}
                type="button"
                className="detail-context-more"
                title={t("More actions")}
                aria-label={t("More actions")}
                aria-expanded={menuOpen}
                aria-controls={toolsId}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
            )}
            {menuOpen && (
              <div id={toolsId} className="detail-context-menu">
                {onChange && (
                  <button
                    type="button"
                    title={t("Change block background")}
                    aria-pressed={filled}
                    onClick={() => {
                      onChange("detailBlockStyles", {
                        ...productRef.current.detailBlockStyles,
                        [String(detailKey)]: filled ? "outline" : "filled",
                      });
                      setMenuOpen(false);
                    }}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path d="m12 3 9 9-9 9-9-9Z" />
                      <path d="M3 12h18" />
                    </svg>
                    <span>{t("Change block background")}</span>
                  </button>
                )}
                {draggable && onDragStart && (
                  <button
                    type="button"
                    draggable
                    className="detail-context-reorder"
                    title={t("Drag to reorder details")}
                    aria-label={`${t("Reorder")} ${label}`}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      onDragStart(
                        event as unknown as React.DragEvent<HTMLSpanElement>,
                      );
                    }}
                    onDragEnd={(event) => {
                      event.stopPropagation();
                      onDragEnd?.(
                        event as unknown as React.DragEvent<HTMLSpanElement>,
                      );
                      setMenuOpen(false);
                    }}
                  >
                    <EditorIcon name="drag" />
                    <span>{t("Drag to reorder details")}</span>
                  </button>
                )}
                {onRemove && (
                  <button
                    type="button"
                    className="detail-context-remove"
                    title={t("Remove detail block")}
                    aria-label={`${t("Remove detail block")}: ${String(detailKey)}`}
                    onClick={removeDetail}
                  >
                    <EditorIcon name="trash" />
                    <span>{t("Remove detail block")}</span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
      {onChange && selected && !editing && (
        <CornerHandles
          label={label}
          className="detail-block-resize"
          onKeyDown={(event) => keyboard(event, "resize")}
          onStart={(event) => begin(event, "resize")}
        />
      )}
      {editing && selected && (
        <span
          className="detail-block-inline-editor"
          data-export-hide="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            value={draftText}
            aria-label={t("Edit this detail")}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveText();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setEditing(false);
              }
            }}
          />
          <button
            type="button"
            onClick={saveText}
            aria-label={t("Save detail")}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={t("Cancel")}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}
