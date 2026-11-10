import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./studio-controls.css";
import { t } from "./i18n";
import { parseColorInput, formatColorInput } from "./parseColorInput";
import { hexToHsv, hsvToHex, isHexColor, type HsvColor } from "./colorSpace";

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
export interface ColorFieldProps {
  value?: string;
  onChange: (color: string) => void;
  label?: string;
  colors?: string[];
  inline?: boolean;
  presetsLabel?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A single in-app surface, without another native picker window. */
export function ColorField({
  value,
  onChange,
  label = "Color",
  colors = DEFAULT_COLORS,
  inline = false,
  presetsLabel,
  compact = false,
  disabled = false,
  className = "",
}: ColorFieldProps) {
  const selected = value && isHexColor(value) ? value.toLowerCase() : "#205184";
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(selected);
  const [hsv, setHsv] = useState(() => hexToHsv(selected));
  const [alpha, setAlpha] = useState(
    () => parseColorInput(selected)?.rgba.a ?? 1,
  );
  const [format, setFormat] = useState<"hex" | "rgb" | "hsl">("hex");
  const [placement, setPlacement] = useState({ left: 8, top: 8, width: 264 });
  const root = useRef<HTMLDivElement>(null),
    popover = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const drag = useRef<number | null>(null);
  const id = useId();
  useEffect(() => {
    if (emitted.current !== selected) {
      setTyped(formatColorInput(selected, format));
      setAlpha(parseColorInput(selected)?.rgba.a ?? 1);
      setHsv((previous) => {
        const next = hexToHsv(selected);
        return { ...next, h: next.s === 0 ? previous.h : next.h };
      });
    }
    emitted.current = null;
  }, [selected, format]);
  const choose = (next: HsvColor, opacity = alpha) => {
    if (disabled) return;
    const color =
      hsvToHex(next) +
      (opacity < 1
        ? Math.round(opacity * 255)
            .toString(16)
            .padStart(2, "0")
        : "");
    setHsv(next);
    setAlpha(opacity);
    setTyped(formatColorInput(color, format));
    emitted.current = color;
    onChange(color);
  };
  const chooseHex = (color: string) => {
    if (disabled) return;
    setHsv(hexToHsv(color));
    setAlpha(parseColorInput(color)?.rgba.a ?? 1);
    setTyped(formatColorInput(color, format));
    emitted.current = color.toLowerCase();
    onChange(color);
  };
  useEffect(() => {
    if (!open || inline) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !popover.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      event.preventDefault();
      setOpen(false);
      root.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, inline]);
  useLayoutEffect(() => {
    if (!open || inline) return;
    const place = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(0, Math.min(264, window.innerWidth - 16));
      const height = popover.current?.getBoundingClientRect().height || 282;
      const below = rect.bottom + 6;
      const preferred =
        window.innerHeight - below >= height ? below : rect.top - height - 6;
      setPlacement({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(preferred, window.innerHeight - height - 8)),
        width,
      });
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (popover.current) observer?.observe(popover.current);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open, inline]);
  const updateArea = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    choose({
      h: hsv.h,
      s: Math.max(
        0,
        Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      v: Math.max(
        0,
        Math.min(
          100,
          100 - ((event.clientY - bounds.top) / bounds.height) * 100,
        ),
      ),
    });
  };
  const picker = (
    <div
      className="studio-color-editor"
      role="group"
      aria-label={`${label} ${t("color picker")}`}
    >
      {colors.length > 0 && (
        <div
          className="studio-color-swatches"
          role="group"
          aria-label={presetsLabel || `${label} ${t("presets")}`}
        >
          {[...new Set(colors)].map((color) => (
            <button
              type="button"
              key={color}
              title={color.toUpperCase()}
              aria-label={color}
              aria-pressed={selected === color.toLowerCase()}
              style={{ backgroundColor: color }}
              onClick={() => chooseHex(color)}
            >
              {selected === color.toLowerCase() && (
                <span
                  aria-hidden="true"
                  style={{
                    color:
                      hexToHsv(color).v > 65 && hexToHsv(color).s < 45
                        ? "#14344f"
                        : "#fff",
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div
        className="studio-color-area"
        role="slider"
        tabIndex={0}
        aria-label={`${label} ${t("saturation and brightness")}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s)}
        aria-valuetext={`${t("Saturation")} ${Math.round(hsv.s)}%, ${t("Brightness")} ${Math.round(hsv.v)}%`}
        aria-describedby={`${id}-help`}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag.current = event.pointerId;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          updateArea(event);
        }}
        onPointerMove={(event) => {
          if (drag.current === event.pointerId) updateArea(event);
        }}
        onPointerUp={(event) => {
          if (drag.current === event.pointerId) {
            updateArea(event);
            drag.current = null;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 1;
          const next = { ...hsv };
          if (event.key === "ArrowLeft") next.s -= step;
          else if (event.key === "ArrowRight") next.s += step;
          else if (event.key === "ArrowUp") next.v += step;
          else if (event.key === "ArrowDown") next.v -= step;
          else return;
          event.preventDefault();
          choose({
            ...next,
            s: Math.max(0, Math.min(100, next.s)),
            v: Math.max(0, Math.min(100, next.v)),
          });
        }}
      >
        <i style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
      </div>
      <span id={`${id}-help`} className="studio-color-sr-only">
        {t("Use left and right for saturation, up and down for brightness.")}
      </span>
      <label className="studio-color-hue">
        <span className="studio-color-sr-only">{t("Hue")}</span>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.h)}
          aria-label={`${label} ${t("hue")}`}
          style={
            {
              "--color-hue-thumb": `hsl(${hsv.h} 100% 50%)`,
            } as React.CSSProperties
          }
          onChange={(event) =>
            choose({ ...hsv, h: Number(event.target.value) })
          }
        />
      </label>
      <label className="studio-color-opacity">
        <span>{t("Opacity")}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(alpha * 100)}
          aria-label={`${label} ${t("opacity")}`}
          style={
            { "--color-opacity-ink": hsvToHex(hsv) } as React.CSSProperties
          }
          onChange={(event) => choose(hsv, Number(event.target.value) / 100)}
        />
        <output>{Math.round(alpha * 100)}%</output>
      </label>
      <div className="studio-color-value-row">
        <i style={{ backgroundColor: hsvToHex(hsv), opacity: alpha }} />
        <label>
          <select
            aria-label={`${label} ${t("color format")}`}
            value={format}
            onChange={(event) => {
              const next = event.target.value as "hex" | "rgb" | "hsl";
              setFormat(next);
              setTyped(formatColorInput(selected, next));
            }}
          >
            <option value="hex">HEX</option>
            <option value="rgb">RGBA</option>
            <option value="hsl">HSLA</option>
          </select>
          <input
            className="studio-color-hex"
            aria-label={`${label} ${format === "hex" ? t("hex code") : format === "rgb" ? "RGBA" : "HSLA"}`}
            value={format === "hex" ? typed.toUpperCase() : typed}
            maxLength={80}
            spellCheck={false}
            aria-invalid={Boolean(typed) && !parseColorInput(typed)}
            onChange={(event) => {
              const raw = event.target.value;
              setTyped(raw);
              const parsed = parseColorInput(raw);
              if (parsed) {
                setHsv(hexToHsv(parsed.hex));
                setAlpha(parsed.rgba.a);
                emitted.current = parsed.hex;
                onChange(parsed.hex);
              }
            }}
            onBlur={() => {
              setTyped(
                formatColorInput(
                  parseColorInput(typed)?.hex || selected,
                  format,
                ),
              );
            }}
          />
        </label>
      </div>
    </div>
  );
  return (
    <div
      className={`studio-color-field${inline ? " inline" : ""}${compact ? " compact" : ""} ${className}`.trim()}
      ref={root}
    >
      {inline ? (
        picker
      ) : (
        <>
          <button
            type="button"
            className="studio-color-trigger"
            disabled={disabled}
            aria-label={`${label}: ${value}`}
            aria-expanded={open}
            aria-controls={open ? `${id}-picker` : undefined}
            onClick={() => setOpen(!open)}
          >
            <i style={{ backgroundColor: selected }} />
            <span>{selected.toUpperCase()}</span>
            <b aria-hidden="true">⌄</b>
          </button>
          {open &&
            !disabled &&
            createPortal(
              <div
                id={`${id}-picker`}
                className="studio-color-popover"
                ref={popover}
                style={placement}
                role="dialog"
                aria-label={`${label} ${t("color picker")}`}
                data-export-hide="true"
              >
                <div className="studio-color-popover-heading">
                  <strong>{label}</strong>
                  <button
                    type="button"
                    aria-label={t("Close color picker")}
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </div>
                {picker}
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
}
