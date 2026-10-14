import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./studio-controls.css";

const DEFAULT_COLORS = [
  "#205184",
  "#e9ebed",
  "#0c1932",
  "#fffaf1",
  "#137ab5",
  "#f34734",
  "#383237",
  "#ffffff",
];
const validHex = (value: string) => /^#[\da-f]{6}$/i.test(value);

export interface ColorFieldProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
  colors?: string[];
}
interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
}

export function ColorField({
  value,
  onChange,
  label = "Color",
  colors = DEFAULT_COLORS,
}: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value || "#205184");
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => setTyped(value || "#205184"), [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !popover.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: { key: string }) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(260, window.innerWidth - 16);
      setPlacement({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top:
          window.innerHeight - rect.bottom < 190 && rect.top > 190
            ? rect.top - 190
            : rect.bottom + 6,
        width,
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <div className="studio-color-field" ref={root}>
      <button
        type="button"
        className="studio-color-trigger"
        aria-label={`${label}: ${value}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <i style={{ backgroundColor: value }} />
        <span>{(value || "").toUpperCase()}</span>
        <b aria-hidden="true">⌄</b>
      </button>
      {open &&
        placement &&
        createPortal(
          <div className="studio-color-popover" ref={popover} style={{ ...placement }}>
            <div
              className="studio-color-swatches"
              role="group"
              aria-label={`${label} presets`}
            >
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={
                    value?.toLowerCase() === color.toLowerCase()
                      ? "selected"
                      : ""
                  }
                  style={{ backgroundColor: color }}
                  aria-label={color}
                  aria-pressed={value?.toLowerCase() === color.toLowerCase()}
                  onClick={() => onChange(color)}
                />
              ))}
            </div>
            <div className="studio-color-custom">
              <span>Pick any color</span>
              <input
                type="color"
                aria-label={`Pick ${label.toLowerCase()}`}
                value={value && validHex(value) ? value : "#205184"}
                onChange={(event) => onChange(event.target.value)}
              />
            </div>
            <input
              className="studio-color-hex"
              aria-label={`${label} hex code`}
              value={typed}
              maxLength={7}
              onChange={(event) => {
                const next = event.target.value.startsWith("#")
                  ? event.target.value
                  : `#${event.target.value}`;
                setTyped(next);
                if (validHex(next)) onChange(next);
              }}
              onBlur={() => {
                if (!validHex(typed)) setTyped(value || "#205184");
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
