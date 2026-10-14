import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface StudioSelectOption<Value extends string | number = string> {
  value: Value;
  label: string;
  detail?: string;
  group?: string;
}

export interface StudioSelectProps<Value extends string | number = string> {
  value: Value | undefined;
  options: readonly StudioSelectOption<Value>[];
  onChange: (value: Value) => void;
  label: string;
  searchable?: boolean;
  disabled?: boolean;
}

interface StudioSelectPlacement {
  left: number;
  top: number;
  width: number;
}

export function StudioSelect<Value extends string | number>({
  value,
  options,
  onChange,
  label,
  searchable = false,
  disabled = false,
}: StudioSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState<StudioSelectPlacement | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const selected = options.find((item) => item.value === value) || options[0];
  const visible = options.filter((item) =>
    `${item.label} ${item.detail || ""} ${item.group || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        (!root.current?.contains(event.target) &&
          !popover.current?.contains(event.target))
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
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
      const width = Math.min(
        window.innerWidth - 16,
        Math.max(rect.width, Math.min(340, window.innerWidth - 16)),
      );
      const height = Math.min(
        340,
        options.length * 58 + (searchable || options.length > 7 ? 52 : 0) + 14,
      );
      setPlacement({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top:
          window.innerHeight - rect.bottom < height && rect.top > height
            ? rect.top - height - 6
            : rect.bottom + 5,
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
  }, [open, options.length, searchable]);
  return (
    <div className="studio-select" ref={root}>
      <button
        type="button"
        className="studio-select-trigger"
        aria-label={`${label}: ${selected?.label || ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
      >
        <span>
          <strong>{selected?.label || "Choose"}</strong>
          {selected?.detail && <small>{selected.detail}</small>}
        </span>
        <b aria-hidden="true">⌄</b>
      </button>
      {open &&
        !disabled &&
        placement &&
        createPortal(
          <div
            className="studio-select-popover"
            ref={popover}
            style={{ ...placement }}
          >
            {(searchable || options.length > 7) && (
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
              />
            )}
            <div
              className="studio-select-options"
              role="listbox"
              aria-label={label}
            >
              {visible.map((item) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === item.value}
                  key={item.value}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <span>
                    {item.group && <em>{item.group}</em>}
                    <strong>{item.label}</strong>
                    {item.detail && <small>{item.detail}</small>}
                  </span>
                  <b aria-hidden="true">{value === item.value ? "✓" : ""}</b>
                </button>
              ))}
              {!visible.length && <p>No matches found</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
