import { ColorField } from "./ColorField";
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Artwork } from "../../domain/models";
import { t } from "./i18n";
import { EditorIcon } from "./EditorIcon";
import {
  normalizeTextFontFamily,
  textFontCss,
  textFontOptions,
} from "./textFonts";
import "../../styles/page-text-toolbar.css";
import "../../styles/black-friday-fonts.css";

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
// Text is stored relative to the canonical 1080px brochure canvas. Show familiar
// pixel sizes without changing existing saved text or its responsive scaling.
const pixels = (size = 4) => Math.round(size * 10.8 * 10) / 10;
const sizes = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 54, 60, 72, 96, 120, 144,
  192, 240, 288,
];
type Panel = "font" | "size" | "spacing" | "alignment" | null;

export function PageTextToolbar({
  artwork,
  textRef,
  onChange,
  beforeFormat,
  onRemove,
  preferredFonts = [],
  extraControls,
}: {
  artwork: Artwork;
  textRef: React.RefObject<HTMLElement | null>;
  onChange: (changes: Partial<Artwork>) => void;
  beforeFormat: () => void;
  onRemove: () => void;
  preferredFonts?: readonly string[];
  extraControls?: React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [anchor, setAnchor] = useState({ left: 8, top: 8, ready: false });
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(String(pixels(artwork.fontSize)));
  useEffect(
    () => setSize(String(pixels(artwork.fontSize))),
    [artwork.fontSize],
  );
  const font = normalizeTextFontFamily(artwork.fontFamily || "SkolaSans");
  const fonts = textFontOptions(font, preferredFonts).filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const toggle = (next: Panel) => {
    setPanel((value) => (value === next ? null : next));
    setQuery("");
  };
  const chooseFont = (value: string) => {
    onChange({ fontFamily: normalizeTextFontFamily(value) });
    setPanel(null);
  };
  const chooseSize = (value: number) => {
    const next = clamp(value, 5.4, 324);
    setSize(String(Math.round(next * 10) / 10));
    onChange({ fontSize: Math.round((next / 10.8) * 10000) / 10000 });
  };
  const commitSize = () => {
    const value = Number(size.replace(",", "."));
    if (Number.isFinite(value) && value > 0) chooseSize(value);
    else setSize(String(pixels(artwork.fontSize)));
  };
  useLayoutEffect(() => {
    const update = () => {
      if (!textRef.current || !host.current) return;
      const text = textRef.current.getBoundingClientRect();
      const toolbar = host.current.getBoundingClientRect();
      const height =
        toolbar.height +
        (panelRef.current
          ? panelRef.current.getBoundingClientRect().height + 6
          : 0);
      const left = clamp(
        text.left,
        8,
        Math.max(8, window.innerWidth - toolbar.width - 8),
      );
      const below = text.bottom + 10;
      const top =
        below + height <= window.innerHeight - 8
          ? below
          : clamp(
              text.top - height - 36,
              8,
              Math.max(8, window.innerHeight - height - 8),
            );
      setAnchor((value) =>
        value.ready && value.left === left && value.top === top
          ? value
          : { left, top, ready: true },
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    if (textRef.current) observer?.observe(textRef.current);
    if (host.current) observer?.observe(host.current);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [artwork, textRef, panel, query]);
  useEffect(() => {
    if (panel === "font") searchRef.current?.focus();
  }, [panel]);
  const chevron = <EditorIcon name="chevron-down" />;
  return createPortal(
    <div
      ref={host}
      className="page-text-floating-toolbar"
      role="toolbar"
      aria-label={t("Text formatting")}
      data-export-hide="true"
      data-page-text-toolbar="true"
      style={{
        left: anchor.left,
        top: anchor.top,
        visibility: anchor.ready ? "visible" : "hidden",
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        beforeFormat();
        if ((event.target as Element).closest("button")) event.preventDefault();
      }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          setPanel(null);
        }
      }}
    >
      <div className="page-text-toolbar-row">
        <button
          type="button"
          role="combobox"
          className="page-text-font-picker"
          aria-label={t("Font")}
          aria-haspopup="listbox"
          aria-controls={panel === "font" ? `${id}-fonts` : undefined}
          aria-expanded={panel === "font"}
          title={t("Font")}
          onClick={() => toggle("font")}
        >
          <span>{font}</span>
          {chevron}
        </button>
        <div className="page-text-size-picker" title={`${t("Text size")} (px)`}>
          <input
            type="text"
            role="combobox"
            inputMode="decimal"
            aria-label={t("Text size")}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={panel === "size" ? `${id}-sizes` : undefined}
            aria-expanded={panel === "size"}
            value={size}
            onChange={(event) => setSize(event.target.value)}
            onBlur={commitSize}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitSize();
                setPanel(null);
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setPanel("size");
              }
            }}
          />
          <button
            type="button"
            aria-label={t("Choose text size")}
            aria-expanded={panel === "size"}
            onClick={() => toggle("size")}
          >
            {chevron}
          </button>
        </div>
        <span className="page-text-tool-divider" />
        <button
          type="button"
          aria-label={t("Bold")}
          title={t("Bold")}
          aria-pressed={(artwork.fontWeight ?? 700) >= 600}
          onClick={() =>
            onChange({
              fontWeight: (artwork.fontWeight ?? 700) >= 600 ? 400 : 700,
            })
          }
        >
          <b>B</b>
        </button>
        <button
          type="button"
          aria-label={t("Italic")}
          title={t("Italic")}
          aria-pressed={artwork.fontStyle === "italic"}
          onClick={() =>
            onChange({
              fontStyle: artwork.fontStyle === "italic" ? "normal" : "italic",
            })
          }
        >
          <i>I</i>
        </button>
        <ColorField
          compact
          label={t("Text color")}
          value={artwork.color || "#1c4075"}
          onChange={(color) => onChange({ color })}
        />
        <button
          type="button"
          className="page-text-spacing-trigger"
          aria-label={t("Text spacing")}
          title={t("Text spacing")}
          aria-expanded={panel === "spacing"}
          onClick={() => toggle("spacing")}
        >
          <span>A↔</span>
        </button>
        <button
          type="button"
          aria-label={t("Text alignment")}
          title={t("Text alignment")}
          aria-expanded={panel === "alignment"}
          onClick={() => toggle("alignment")}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M3 4h14M3 8h10M3 12h14M3 16h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
        </button>
        {extraControls}
        <span className="page-text-tool-divider" />
        <button
          type="button"
          className="page-text-delete"
          aria-label={t("Delete text")}
          title={t("Delete text")}
          onClick={onRemove}
        >
          <EditorIcon name="trash" />
        </button>
      </div>
      {panel && (
        <div
          ref={panelRef}
          className={`page-text-popover page-text-${panel}-popover`}
        >
          {panel === "font" && (
            <>
              <input
                ref={searchRef}
                type="search"
                aria-label={t("Search or type a font")}
                placeholder={t("Search or type a font")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && query.trim()) {
                    event.preventDefault();
                    chooseFont(fonts[0]?.family || query);
                  }
                }}
              />
              <div
                role="listbox"
                id={`${id}-fonts`}
                aria-label={t("Font")}
                className="page-text-font-list"
              >
                {fonts.map((option, index) => (
                  <React.Fragment key={option.family}>
                    {option.group !== fonts[index - 1]?.group && (
                      <small>{t(option.group)}</small>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={font === option.family}
                      style={{ fontFamily: textFontCss(option.family) }}
                      onClick={() => chooseFont(option.family)}
                    >
                      <span>{option.label}</span>
                      {font === option.family && <span>✓</span>}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              {query.trim() &&
                !fonts.some(
                  (option) =>
                    option.family.toLowerCase() === query.trim().toLowerCase(),
                ) && (
                  <button
                    type="button"
                    className="page-text-custom-font"
                    onClick={() => chooseFont(query)}
                  >
                    {t("Use font")}: {query.trim().slice(0, 80)}
                  </button>
                )}
              <small className="page-text-font-note">
                {t("Other fonts use the fonts installed on your device.")}
              </small>
            </>
          )}
          {panel === "size" && (
            <div
              role="listbox"
              id={`${id}-sizes`}
              aria-label={t("Text size")}
              className="page-text-size-list"
            >
              {sizes.map((value) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={
                    Math.abs(pixels(artwork.fontSize) - value) < 0.05
                  }
                  key={value}
                  onClick={() => {
                    chooseSize(value);
                    setPanel(null);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          {panel === "spacing" && (
            <div className="page-text-spacing-fields">
              <label>
                <span>{t("Character spacing")}</span>
                <input
                  type="number"
                  min="-.1"
                  max="1"
                  step=".01"
                  aria-label={t("Character spacing")}
                  value={artwork.letterSpacing ?? 0}
                  onChange={(event) =>
                    onChange({
                      letterSpacing: clamp(
                        Number(event.target.value) || 0,
                        -0.1,
                        1,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>{t("Line height")}</span>
                <input
                  type="number"
                  min=".7"
                  max="3"
                  step=".05"
                  aria-label={t("Line height")}
                  value={artwork.lineHeight ?? 1.1}
                  onChange={(event) =>
                    onChange({
                      lineHeight: clamp(
                        Number(event.target.value) || 1.1,
                        0.7,
                        3,
                      ),
                    })
                  }
                />
              </label>
            </div>
          )}
          {panel === "alignment" && (
            <div
              className="page-text-alignment-options"
              role="group"
              aria-label={t("Text alignment")}
            >
              {(["left", "center", "right", "justify"] as const).map(
                (align) => (
                  <button
                    type="button"
                    key={align}
                    aria-pressed={(artwork.textAlign || "left") === align}
                    onClick={() => {
                      onChange({ textAlign: align });
                      setPanel(null);
                    }}
                  >
                    {t(
                      align === "left"
                        ? "Left"
                        : align === "center"
                          ? "Center"
                          : align === "right"
                            ? "Right"
                            : "Justify",
                    )}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
