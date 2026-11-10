import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Gradient, PageAppearance } from "../../domain/models";
import {
  BACKGROUND_PRESETS,
  validBackgroundColor,
  validBackgroundGradient,
} from "./pageBackground";
import { ColorField } from "./ColorField";
import { EditorIcon } from "./EditorIcon";
import { PriceDesignChoices } from "./PriceDesignChoices";
import { SCREEN_LABEL_COLOR_PRESETS } from "./screenLabelColors";
import { GRADIENT_DIRECTIONS } from "./gradientDirections";
import { t } from "./i18n";
import "../../styles/background-canvas-controls.css";

export interface BackgroundValues {
  backgroundColor?: string;
  backgroundGradient?: Gradient | null;
  backgroundImage?: string;
}
export interface BackgroundCanvasControlsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  pageKey: string;
  enabled: boolean;
  color?: string;
  gradient?: Gradient | null;
  image?: string;
  orangePriceVariant?: "default" | "black-friday";
  appearance: {
    textColor: string;
    brandColor: string;
    screenLabelColor: string;
    priceStyle: "current" | "card";
  };
  onBackgroundChange: (values: BackgroundValues, scope: "page" | "all") => void;
  onAppearanceChange: (changes: PageAppearance, scope: "page" | "all") => void;
  onChangeDesign: () => void;
}

/** Canvas wrappers may cover the entire paper. Restrict the shortcut to their
 * empty space, leaving product, artwork, text and existing edit interactions alone. */
export function isBackgroundCanvasTarget(
  target: EventTarget | null,
  container: HTMLElement,
): boolean {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (
    !element ||
    !container.contains(element) ||
    !element.closest(".brochure-page")
  )
    return false;
  if (
    element.closest(
      "button,input,textarea,select,a,[role=button],[contenteditable=true],.brochure-product,.cover-product-frame,.brochure-floating-artwork,.product-detail-block,.product-artwork-item,.brochure-brand-mark,.store-spot,.compact-stores-footer,.brochure-footer-payment,.cover-element:not(.cover-element-gradient),.cover-editable-element:not(.cover-element-gradient),.stores-editable-element,[data-export-hide]",
    )
  )
    return false;
  if (element.closest(".cover-element-gradient")) return true;
  return ["DIV", "SECTION", "MAIN", "ARTICLE"].includes(element.tagName);
}

type Panel = "color" | "gradient" | "appearance" | "price" | null;
type ColorKey = "textColor" | "brandColor" | "screenLabelColor";
type OpenState = {
  x: number;
  y: number;
  menu: boolean;
  panel: Panel;
  scope: "page" | "all";
};
const clamp = (value: number, max: number) =>
  Math.max(8, Math.min(value, Math.max(8, max)));

export function BackgroundCanvasControls({
  containerRef,
  pageKey,
  enabled,
  color,
  gradient,
  image,
  orangePriceVariant = "default",
  appearance,
  onBackgroundChange,
  onAppearanceChange,
  onChangeDesign,
}: BackgroundCanvasControlsProps) {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<OpenState | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, ready: false });
  const [editingColor, setEditingColor] = useState<ColorKey | null>(null);
  const [gradientStop, setGradientStop] = useState<"from" | "to">("from");
  const selected = validBackgroundColor(color) || "#1c4075";
  const activeGradient = validBackgroundGradient(gradient) || {
    from: selected,
    to: "#86b3de",
    angle: 135,
  };
  const callbacks = useRef({
    onBackgroundChange,
    onAppearanceChange,
    onChangeDesign,
  });
  callbacks.current = {
    onBackgroundChange,
    onAppearanceChange,
    onChangeDesign,
  };

  useEffect(() => {
    setOpen(null);
    setEditingColor(null);
  }, [pageKey, enabled]);
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    const reveal = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        !isBackgroundCanvasTarget(event.target, container)
      )
        return;
      if (event.type === "click" && event.button !== 0) return;
      if (event.type === "contextmenu") event.preventDefault();
      setEditingColor(null);
      setOpen({
        x: event.clientX,
        y: event.clientY + 10,
        menu: event.type === "contextmenu",
        panel: null,
        scope: "page",
      });
    };
    const keyboardMenu = (event: KeyboardEvent) => {
      if (!(
        event.key === "ContextMenu" ||
        (event.key === "F10" && event.shiftKey)
      ))
        return;
      if (
        !isBackgroundCanvasTarget(event.target, container) &&
        event.target !== container
      )
        return;
      event.preventDefault();
      const page = container.querySelector(".brochure-page") || container;
      const bounds = page.getBoundingClientRect();
      setOpen({
        x: bounds.left + 24,
        y: bounds.top + 24,
        menu: true,
        panel: null,
        scope: "page",
      });
    };
    container.addEventListener("click", reveal);
    container.addEventListener("contextmenu", reveal);
    container.addEventListener("keydown", keyboardMenu);
    return () => {
      container.removeEventListener("click", reveal);
      container.removeEventListener("contextmenu", reveal);
      container.removeEventListener("keydown", keyboardMenu);
    };
  }, [containerRef, enabled, pageKey]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (
        host.current?.contains(event.target as Node) ||
        element?.closest(".studio-color-popover,.ns-searchable-panel")
      )
        return;
      setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = host.current?.getBoundingClientRect();
      if (!rect) return;
      const left = clamp(open.x, window.innerWidth - rect.width - 8);
      const top = clamp(open.y, window.innerHeight - rect.height - 8);
      setPosition((value) =>
        value.ready && value.left === left && value.top === top
          ? value
          : { left, top, ready: true },
      );
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(place);
    if (host.current) observer?.observe(host.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, editingColor]);
  useEffect(() => {
    if (open?.menu)
      host.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
  }, [open?.menu]);
  if (!enabled || !open) return null;
  const scope = open.scope;
  const chooseColor = (value: string) =>
    callbacks.current.onBackgroundChange(
      { backgroundColor: value, backgroundGradient: null, backgroundImage: "" },
      scope,
    );
  const chooseGradient = (value: Gradient) =>
    callbacks.current.onBackgroundChange(
      { backgroundColor: "", backgroundGradient: value, backgroundImage: "" },
      scope,
    );
  const panel = (value: Panel, nextScope = scope) =>
    setOpen((current) =>
      current
        ? {
            ...current,
            menu: false,
            panel:
              current.panel === value && current.scope === nextScope
                ? null
                : value,
            scope: nextScope,
          }
        : current,
    );
  const appearanceColor = (
    key: "textColor" | "brandColor" | "screenLabelColor",
    value: string,
  ) => callbacks.current.onAppearanceChange({ [key]: value }, scope);
  const fill = image
    ? `url(${JSON.stringify(image)}) center / cover`
    : gradient
      ? `linear-gradient(${activeGradient.angle}deg,${activeGradient.from},${activeGradient.to})`
      : selected;
  const colorOptions = [
    {
      key: "textColor" as const,
      label: "Text color",
      hint: "Product names and details",
      sample: "Aa",
    },
    {
      key: "brandColor" as const,
      label: "Logo color",
      hint: "Product brand logos",
      sample: "N",
    },
    {
      key: "screenLabelColor" as const,
      label: "Screen label color",
      hint: "Inch labels and arrows",
      sample: "6.7″",
    },
  ];
  const editorLabel =
    colorOptions.find((option) => option.key === editingColor)?.label ||
    "Text color";
  const heading =
    open.panel === "price"
      ? "Price design"
      : open.panel === "appearance"
        ? "Text & logos"
        : "Page background";
  return createPortal(
    <div
      ref={host}
      className="cs-background-canvas-controls"
      data-export-hide="true"
      data-background-canvas-controls="true"
      style={{
        left: position.left,
        top: position.top,
        visibility: position.ready ? "visible" : "hidden",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {open.menu ? (
        <div
          className="cs-background-context-menu"
          role="menu"
          aria-label={t("Page background actions")}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const items = [
              ...(host.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ) || []),
            ];
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (index +
                      (event.key === "ArrowUp" ? -1 : 1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }}
        >
          <button
            type="button"
            role="menuitem"
            aria-label={t("Change background of this page")}
            onClick={() => panel("color", "page")}
          >
            <span className="cs-background-context-icon" aria-hidden="true">
              <EditorIcon name="page" />
              <i style={{ background: fill }} />
            </span>
            <span>
              <strong>{t("Change background of this page")}</strong>
              <small>{t("Only the selected page")}</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label={t("Change background of all pages")}
            onClick={() => panel("color", "all")}
          >
            <span className="cs-background-context-icon" aria-hidden="true">
              <EditorIcon name="pages" />
            </span>
            <span>
              <strong>{t("Change background of all pages")}</strong>
              <small>{t("Use the same background throughout")}</small>
            </span>
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            aria-label={t("Change brochure design")}
            onClick={() => {
              setOpen(null);
              callbacks.current.onChangeDesign();
            }}
          >
            <span className="cs-background-context-icon" aria-hidden="true">
              <EditorIcon name="layout" />
            </span>
            <span>
              <strong>{t("Change brochure design")}</strong>
              <small>{t("Choose another default layout")}</small>
            </span>
          </button>
        </div>
      ) : (
        <>
          <div
            className="cs-background-canvas-toolbar"
            role="toolbar"
            aria-label={t("Page background")}
          >
            <button
              type="button"
              aria-label={t("Background color")}
              aria-expanded={
                open.panel === "color" || open.panel === "gradient"
              }
              onClick={() => panel("color")}
            >
              <i
                className="cs-background-menu-swatch"
                style={{ background: fill }}
              />
              <span>{t("Background")}</span>
            </button>
            <button
              type="button"
              aria-label={t("Text & logos")}
              aria-expanded={open.panel === "appearance"}
              onClick={() => panel("appearance")}
            >
              <EditorIcon name="palette" />
              <span>{t("Colors")}</span>
            </button>
            <button
              type="button"
              aria-label={t("Price design")}
              aria-expanded={open.panel === "price"}
              onClick={() => panel("price")}
            >
              <EditorIcon name="price" />
              <span>{t("Price design")}</span>
            </button>
            <span className="cs-background-toolbar-divider" />
            <button
              type="button"
              className="cs-background-scope-toggle"
              aria-label={t("Apply to all pages")}
              aria-pressed={scope === "all"}
              title={t(
                scope === "all"
                  ? "Changes all pages"
                  : "Changes this page only",
              )}
              onClick={() =>
                setOpen((current) =>
                  current
                    ? {
                        ...current,
                        scope: current.scope === "all" ? "page" : "all",
                      }
                    : current,
                )
              }
            >
              <EditorIcon name="pages" />
              <span>{t("All pages")}</span>
            </button>
            <button
              type="button"
              className="cs-background-close"
              aria-label={t("Close background controls")}
              onClick={() => setOpen(null)}
            >
              <EditorIcon name="close" />
            </button>
          </div>
          {open.panel && (
            <section
              className="cs-background-canvas-panel"
              aria-label={t(heading)}
            >
              <div className="cs-background-panel-head">
                <strong>{t(heading)}</strong>
                <small>
                  {t(
                    scope === "all"
                      ? "Changes all pages"
                      : "Changes this page only",
                  )}
                </small>
              </div>
              {(open.panel === "color" || open.panel === "gradient") && (
                <div
                  className="cs-background-fill-tabs"
                  role="tablist"
                  aria-label={t("Background fill")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={open.panel === "color"}
                    onClick={() =>
                      setOpen((current) =>
                        current ? { ...current, panel: "color" } : null,
                      )
                    }
                  >
                    <span
                      className="cs-background-menu-swatch"
                      style={{ background: selected }}
                    />
                    {t("Solid color")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={open.panel === "gradient"}
                    onClick={() =>
                      setOpen((current) =>
                        current ? { ...current, panel: "gradient" } : null,
                      )
                    }
                  >
                    <span className="cs-background-gradient-icon" />
                    {t("Gradient")}
                  </button>
                </div>
              )}
              {open.panel === "color" && (
                <>
                  <ColorField
                    inline
                    label={t("Background color")}
                    presetsLabel={t("Page background presets")}
                    colors={BACKGROUND_PRESETS.map((preset) => preset.color)}
                    value={selected}
                    onChange={chooseColor}
                  />
                  <p className="cs-background-automatic-note">
                    {t("Text, logos and screen labels adapt automatically.")}
                  </p>
                </>
              )}
              {open.panel === "gradient" && (
                <>
                  <div
                    className="cs-background-gradient-sample"
                    style={{
                      background: `linear-gradient(${activeGradient.angle}deg,${activeGradient.from},${activeGradient.to})`,
                    }}
                  />
                  <div
                    className="cs-background-gradient-stops"
                    role="group"
                    aria-label={t("Gradient colors")}
                  >
                    {(["from", "to"] as const).map((stop) => (
                      <button
                        type="button"
                        key={stop}
                        aria-pressed={gradientStop === stop}
                        onClick={() => setGradientStop(stop)}
                      >
                        <i style={{ background: activeGradient[stop] }} />
                        <span>
                          {t(stop === "from" ? "From" : "To")}
                          <small>{activeGradient[stop].toUpperCase()}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <ColorField
                    inline
                    label={t(
                      gradientStop === "from"
                        ? "Gradient start"
                        : "Gradient end",
                    )}
                    value={activeGradient[gradientStop]}
                    colors={[]}
                    onChange={(value) =>
                      chooseGradient({
                        ...activeGradient,
                        [gradientStop]: value,
                      })
                    }
                  />
                  <div
                    className="cs-background-canvas-directions"
                    role="group"
                    aria-label={t("Gradient direction")}
                  >
                    {GRADIENT_DIRECTIONS.map((direction) => (
                      <button
                        type="button"
                        key={direction.angle}
                        aria-label={t(direction.label)}
                        aria-pressed={activeGradient.angle === direction.angle}
                        title={t(direction.label)}
                        onClick={() =>
                          chooseGradient({
                            ...activeGradient,
                            angle: direction.angle,
                          })
                        }
                      >
                        {direction.icon}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cs-background-gradient-apply"
                    onClick={() => chooseGradient(activeGradient)}
                  >
                    {t("Apply gradient")}
                  </button>
                </>
              )}
              {open.panel === "appearance" && (
                <>
                  <p className="cs-background-automatic-note">
                    {t("Readable colors are selected for this background.")}
                  </p>
                  <div className="cs-background-color-rows">
                    {colorOptions.map((option) => (
                      <button
                        type="button"
                        key={option.key}
                        aria-label={t(option.label)}
                        aria-expanded={editingColor === option.key}
                        onClick={() =>
                          setEditingColor((current) =>
                            current === option.key ? null : option.key,
                          )
                        }
                      >
                        <span
                          className="cs-background-color-example"
                          style={{
                            background: fill,
                            color: appearance[option.key],
                          }}
                        >
                          {option.sample}
                        </span>
                        <span>
                          <strong>{t(option.label)}</strong>
                          <small>{t(option.hint)}</small>
                        </span>
                        <i
                          style={{ backgroundColor: appearance[option.key] }}
                        />
                        <EditorIcon name="chevron-down" />
                      </button>
                    ))}
                  </div>
                  {editingColor && (
                    <div className="cs-background-inline-color">
                      <div className="cs-background-color-editor-head">
                        <strong>{t(editorLabel)}</strong>
                        <button
                          type="button"
                          onClick={() => setEditingColor(null)}
                        >
                          {t("Done")}
                        </button>
                      </div>
                      {editingColor === "screenLabelColor" && (
                        <div
                          className="cs-screen-label-color-presets"
                          role="group"
                          aria-label={t("Screen label color")}
                        >
                          {SCREEN_LABEL_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.color}
                              type="button"
                              aria-label={t(preset.name)}
                              aria-pressed={
                                appearance.screenLabelColor === preset.color
                              }
                              onClick={() =>
                                appearanceColor(
                                  "screenLabelColor",
                                  preset.color,
                                )
                              }
                            >
                              <span
                                style={{
                                  background: preset.background,
                                  color: preset.color,
                                }}
                              >
                                6.7″ ↴
                              </span>
                              {t(
                                preset.color === "#ffffff" ? "White" : "Black",
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      <ColorField
                        key={editingColor}
                        inline
                        label={t(editorLabel)}
                        value={appearance[editingColor]}
                        onChange={(value) =>
                          appearanceColor(editingColor, value)
                        }
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className="cs-background-auto-reset"
                    onClick={() =>
                      callbacks.current.onAppearanceChange(
                        {
                          textColor: undefined,
                          brandColor: undefined,
                          screenLabelColor: undefined,
                        },
                        scope,
                      )
                    }
                  >
                    {t("Use automatic colors")}
                  </button>
                </>
              )}
              {open.panel === "price" && (
                <>
                  <PriceDesignChoices
                    value={appearance.priceStyle}
                    orangeVariant={orangePriceVariant}
                    onChange={(priceStyle) =>
                      callbacks.current.onAppearanceChange(
                        { priceStyle },
                        scope,
                      )
                    }
                  />
                  <p className="cs-background-automatic-note">
                    {t(
                      "Choose a default price design. Product prices stay the same.",
                    )}
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
