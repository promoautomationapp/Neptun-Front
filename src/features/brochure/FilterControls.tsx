import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { matchesSearch } from "./searchText";
import { getLanguage, t } from "./i18n";

export interface FilterOption<Value extends string | number = string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

export interface FilterSelectProps<Value extends string | number = string> {
  label: string;
  value: Value;
  options: readonly FilterOption<Value>[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  id?: string;
  hideLabel?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export interface FilterDateProps {
  label: string;
  value: string | undefined;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}

function useDismiss(
  open: boolean,
  close: () => void,
  root: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        !root.current?.contains(event.target)
      )
        close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, close, root]);
}

export function FilterSelect<Value extends string | number>({
  label, value, options, onChange, disabled = false, id, hideLabel = false,
  "aria-labelledby": labelledby, "aria-describedby": describedby,
}: FilterSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState<React.CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value) || options[0];
  const visible = options.filter(option => matchesSearch(option.label, query));
  function close() { setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !popover.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => { if (disabled) close(); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const upward = below < 240 && above > below;
      setPlacement({ position: "fixed", left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: upward ? undefined : rect.bottom + 5, bottom: upward ? window.innerHeight - rect.top + 5 : undefined, width, maxHeight: Math.max(120, Math.min(340, upward ? above : below)) });
    };
    place(); window.addEventListener("resize", place); document.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); document.removeEventListener("scroll", place, true); };
  }, [open]);
  function onKeys(event: React.KeyboardEvent<HTMLElement>) {
    const input = event.target instanceof HTMLInputElement;
    if (event.key === "Tab") { close(); return; }
    if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault(); setQuery(""); setOpen(true); return;
    }
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)") || [])];
    if (input && event.key === "Enter") { event.preventDefault(); buttons[0]?.click(); return; }
    if (!["ArrowDown", "ArrowUp", ...(!input ? ["Home", "End"] : [])].includes(event.key)) return;
    event.preventDefault();
    const index = buttons.findIndex(button => button === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : index < 0 ? (event.key === "ArrowDown" ? 0 : buttons.length - 1) : event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
  return <div className={`cs-filter-control ${open ? "is-open" : ""}`} ref={root}>
    {!hideLabel && <span className="cs-filter-label">{label}</span>}
    <button ref={trigger} id={id} type="button" className="cs-filter-trigger" aria-label={labelledby ? undefined : label} aria-labelledby={labelledby} aria-describedby={describedby} aria-haspopup="listbox" aria-expanded={open} disabled={disabled}
      onClick={() => { setQuery(""); setOpen(current => !current); }} onKeyDown={onKeys}>
      <span>{selected?.label}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    {open && !disabled && createPortal(<div className="cs-filter-options cs-searchable-options" ref={popover} style={placement} onKeyDown={onKeys}>
      <div className="cs-filter-option-search"><input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={`${t("Search")} ${label}`} placeholder={t("Search options…")} /></div>
      <div role="listbox" aria-label={label} ref={list}>
        {visible.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} onClick={() => { onChange(option.value); close(); trigger.current?.focus(); }}><span>{option.label}</span>{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
        {!visible.length && <p className="cs-filter-no-results">{t("No matches found")}</p>}
      </div>
    </div>, document.body)}
  </div>;
}

function parseDate(value: string | undefined): Date | null {
  const [year, month, day] = (value || "").split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const sqMonths = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
];
const sqWeekdays = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"];

export function FilterDate({
  label,
  value,
  min,
  max,
  onChange,
}: FilterDateProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = parseDate(value) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), root);
  useEffect(() => {
    const selected = parseDate(value);
    if (selected)
      setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [value]);

  const albanian = getLanguage() === "sq";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const displayDate = (date: Date) =>
    albanian
      ? `${date.getDate()} ${sqMonths[date.getMonth()]} ${date.getFullYear()}`
      : formatter.format(date);
  const monthName = albanian
    ? `${sqMonths[month.getMonth()]} ${month.getFullYear()}`
    : new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(month);
  const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  });
  const weekdays = albanian
    ? sqWeekdays
    : Array.from({ length: 7 }, (_, index) =>
        weekdayFormatter.format(new Date(2024, 0, 1 + index)),
      );
  const offset = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const currentKey = dateKey(new Date());
  const selectedDate = parseDate(value);

  function changeMonth(amount: number) {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }
  function choose(key: string) {
    onChange(key);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className={`cs-filter-control cs-filter-date ${open ? "is-open" : ""}`}
      ref={root}
    >
      <span className="cs-filter-label">{label}</span>
      <button
        ref={trigger}
        type="button"
        className={`cs-filter-trigger ${value ? "has-value" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          {selectedDate ? displayDate(selectedDate) : t("Choose date")}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="5" width="14" height="12" rx="2" />
          <path d="M6 3v4m8-4v4M3 9h14" />
        </svg>
      </button>
      {open && (
        <div className="cs-calendar" role="dialog" aria-label={label}>
          <div className="cs-calendar-head">
            <strong>{monthName}</strong>
            <div>
              <button
                type="button"
                aria-label={t("Previous month")}
                onClick={() => changeMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={t("Next month")}
                onClick={() => changeMonth(1)}
              >
                ›
              </button>
            </div>
          </div>
          <div className="cs-calendar-grid">
            {weekdays.map((day, index) => (
              <span key={index} className="cs-calendar-weekday">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const key = dateKey(
                new Date(month.getFullYear(), month.getMonth(), index + 1),
              );
              return (
                <button
                  key={key}
                  type="button"
                  className={`${key === value ? "selected" : ""} ${key === currentKey ? "today" : ""}`}
                  disabled={Boolean((min && key < min) || (max && key > max))}
                  aria-label={displayDate(
                    new Date(month.getFullYear(), month.getMonth(), index + 1),
                  )}
                  aria-pressed={key === value}
                  onClick={() => choose(key)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="cs-calendar-footer">
            <button type="button" onClick={() => choose("")}>
              {t("Clear date")}
            </button>
            <button
              type="button"
              disabled={Boolean(
                (min && currentKey < min) || (max && currentKey > max),
              )}
              onClick={() => choose(currentKey)}
            >
              {t("Today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
