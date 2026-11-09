import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Gradient, PageAppearance } from "../../domain/models";
import {
  BACKGROUND_PRESETS,
  validBackgroundColor,
  validBackgroundGradient,
} from "./pageBackground";
import { ColorField } from "./ColorField";
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

type Panel = "color" | "gradient" | "appearance" | null;
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
  appearance,
  onBackgroundChange,
  onAppearanceChange,
  onChangeDesign,
}: BackgroundCanvasControlsProps) {
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<OpenState | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, ready: false });
  const [advanced, setAdvanced] = useState(false);
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
    setAdvanced(false);
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
      setAdvanced(false);
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
  }, [open, advanced]);
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
            onClick={() => panel("color", "page")}
          >
            <span
              className="cs-background-menu-swatch"
              style={{ background: fill }}
            />
            {t("Change background of this page")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => panel("color", "all")}
          >
            <span aria-hidden="true">▧</span>
            {t("Change background of all pages")}
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(null);
              callbacks.current.onChangeDesign();
            }}
          >
            <span aria-hidden="true">▦</span>
            {t("Change brochure design")}
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
              title={t("Background color")}
              aria-expanded={open.panel === "color"}
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
              aria-label={t("Gradient")}
              title={t("Gradient")}
              aria-expanded={open.panel === "gradient"}
              onClick={() => panel("gradient")}
            >
              <i className="cs-background-gradient-icon" />
              <span>{t("Gradient")}</span>
            </button>
            <button
              type="button"
              aria-label={t("Text & logos")}
              title={t("Text & logos")}
              aria-expanded={open.panel === "appearance"}
              onClick={() => panel("appearance")}
            >
              <b>Aa</b>
              <span>{t("Appearance")}</span>
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
              <span aria-hidden="true">▧</span>
              <span>{t("All pages")}</span>
            </button>
            <button
              type="button"
              className="cs-background-close"
              aria-label={t("Close background controls")}
              onClick={() => setOpen(null)}
            >
              ×
            </button>
          </div>
          {open.panel && (
            <section
              className="cs-background-canvas-panel"
              aria-label={t(
                open.panel === "appearance"
                  ? "Page appearance"
                  : open.panel === "gradient"
                    ? "Gradient"
                    : "Background color",
              )}
            >
              <div className="cs-background-panel-head">
                <strong>
                  {t(
                    open.panel === "appearance"
                      ? "Page appearance"
                      : open.panel === "gradient"
                        ? "Gradient"
                        : "Background color",
                  )}
                </strong>
                <small>
                  {t(
                    scope === "all"
                      ? "Changes all pages"
                      : "Changes this page only",
                  )}
                </small>
              </div>
              {open.panel === "color" && (
                <>
                  <div
                    className="cs-background-canvas-swatches"
                    role="group"
                    aria-label={t("Page background presets")}
                  >
                    {BACKGROUND_PRESETS.map((preset) => (
                      <button
                        type="button"
                        key={preset.color}
                        style={{ background: preset.color }}
                        aria-label={`${t(preset.label)} ${preset.color}`}
                        aria-pressed={
                          !image &&
                          !gradient &&
                          preset.color.toLowerCase() === selected.toLowerCase()
                        }
                        title={t(preset.label)}
                        onClick={() => chooseColor(preset.color)}
                      />
                    ))}
                  </div>
                  <ColorField
                    label={t("Background color")}
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
                  <div className="cs-background-gradient-fields">
                    <label>
                      <span>{t("From")}</span>
                      <ColorField
                        label={t("Gradient start")}
                        value={activeGradient.from}
                        onChange={(value) =>
                          chooseGradient({ ...activeGradient, from: value })
                        }
                      />
                    </label>
                    <label>
                      <span>{t("To")}</span>
                      <ColorField
                        label={t("Gradient end")}
                        value={activeGradient.to}
                        onChange={(value) =>
                          chooseGradient({ ...activeGradient, to: value })
                        }
                      />
                    </label>
                  </div>
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
                  <div className="cs-background-appearance-summary">
                    {(
                      [
                        ["textColor", "Text"],
                        ["brandColor", "Logos"],
                        ["screenLabelColor", "Screen labels"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        title={t("Advanced colors")}
                        onClick={() => setAdvanced(true)}
                      >
                        <i style={{ background: appearance[key] }} />
                        <span>{t(label)}</span>
                        <small>{appearance[key].toUpperCase()}</small>
                      </button>
                    ))}
                  </div>
                  <div
                    className="cs-background-price-choices"
                    role="group"
                    aria-label={t("Price design")}
                  >
                    {(["current", "card"] as const).map((style) => (
                      <button
                        type="button"
                        key={style}
                        aria-pressed={appearance.priceStyle === style}
                        aria-label={t(
                          style === "current"
                            ? "Red haPPy offer"
                            : "Blue price card",
                        )}
                        onClick={() =>
                          callbacks.current.onAppearanceChange(
                            { priceStyle: style },
                            scope,
                          )
                        }
                      >
                        <span className={`cs-background-price-mini ${style}`}>
                          <del>399€</del>
                          <b>299€</b>
                          <small>12×24.9€</small>
                        </span>
                        <span>
                          {t(
                            style === "current"
                              ? "Red haPPy offer"
                              : "Blue price card",
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
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
                        title={t(preset.name)}
                        aria-pressed={
                          appearance.screenLabelColor === preset.color
                        }
                        onClick={() =>
                          appearanceColor("screenLabelColor", preset.color)
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
                        {t(preset.color === "#ffffff" ? "White" : "Black")}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cs-background-advanced-toggle"
                    aria-expanded={advanced}
                    onClick={() => setAdvanced((value) => !value)}
                  >
                    {t("Advanced colors")}{" "}
                    <span aria-hidden="true">{advanced ? "⌃" : "⌄"}</span>
                  </button>
                  {advanced && (
                    <div className="cs-background-advanced-colors">
                      {(
                        [
                          ["textColor", "Text color"],
                          ["brandColor", "Logo color"],
                          ["screenLabelColor", "Screen label color"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          <span>{t(label)}</span>
                          <ColorField
                            label={t(label)}
                            value={appearance[key]}
                            onChange={(value) => appearanceColor(key, value)}
                          />
                        </label>
                      ))}
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
                          priceStyle: "auto",
                        },
                        scope,
                      )
                    }
                  >
                    {t("Use automatic colors")}
                  </button>
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
