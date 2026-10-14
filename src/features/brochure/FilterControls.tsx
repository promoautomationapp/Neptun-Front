import React, { useEffect, useRef, useState } from "react";
import { getLanguage, t } from "./i18n";

export interface FilterOption<Value extends string | number = string> {
  value: Value;
  label: string;
}

export interface FilterSelectProps<Value extends string | number = string> {
  label: string;
  value: Value;
  options: readonly FilterOption<Value>[];
  onChange: (value: Value) => void;
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
  label,
  value,
  options,
  onChange,
}: FilterSelectProps<Value>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), root);
  const selected =
    options.find((option) => option.value === value) || options[0];

  function onKeys(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        requestAnimationFrame(() =>
          list.current
            ?.querySelector<HTMLButtonElement>("[aria-selected='true']")
            ?.focus(),
        );
      } else {
        const buttons = [
          ...(list.current?.querySelectorAll<HTMLButtonElement>(
            "[role='option']",
          ) || []),
        ];
        const index = buttons.findIndex(
          (button) => button === document.activeElement,
        );
        buttons[
          (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length
        ]?.focus();
      }
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const buttons = [
        ...(list.current?.querySelectorAll<HTMLButtonElement>(
          "[role='option']",
        ) || []),
      ];
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
    }
  }

  return (
    <div className={`cs-filter-control ${open ? "is-open" : ""}`} ref={root}>
      <span className="cs-filter-label">{label}</span>
      <button
        ref={trigger}
        type="button"
        className="cs-filter-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeys}
      >
        <span>{selected?.label}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="cs-filter-options"
          role="listbox"
          aria-label={label}
          ref={list}
          onKeyDown={onKeys}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
