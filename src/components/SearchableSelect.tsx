import React, {
  Children,
  Fragment,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { t } from "../features/brochure/i18n";
import { matchesSearch } from "../features/brochure/searchText";
import "./searchable-select.css";

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
  group: string;
}
type OptionProps = {
  children?: React.ReactNode;
  value?: string | number;
  label?: string;
  disabled?: boolean;
  selected?: boolean;
};
function textOf(children: React.ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<OptionProps>(child)
        ? textOf(child.props.children)
        : String(child ?? ""),
    )
    .join("");
}
function choicesFrom(
  children: React.ReactNode,
  group = "",
  disabled = false,
): Choice[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment)
      return choicesFrom(child.props.children, group, disabled);
    if (child.type === "optgroup")
      return choicesFrom(
        child.props.children,
        child.props.label || "",
        disabled || Boolean(child.props.disabled),
      );
    if (child.type !== "option") return [];
    const label = child.props.label || textOf(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        group,
        disabled: disabled || Boolean(child.props.disabled),
      },
    ];
  });
}

/** A custom searchable control retaining native form and change-event semantics. */
export function SearchableSelect({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  multiple,
  className = "",
  style,
  id,
  name,
  required,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const nativeProps = { ...props };
  delete nativeProps["aria-label"];
  delete nativeProps["aria-labelledby"];
  delete nativeProps["aria-describedby"];
  const [localValue, setLocalValue] = useState<string | readonly string[]>(
    () =>
      (defaultValue as string | readonly string[] | undefined) ??
      choicesFrom(children)[0]?.value ??
      "",
  );
  const initialValue = useRef(localValue);
  const current = value ?? localValue;
  const selected = Array.isArray(current)
    ? current.map(String)
    : [String(current)];
  const choices = choicesFrom(children);
  const selectedLabels = choices
    .filter((choice) => selected.includes(choice.value))
    .map((choice) => choice.label);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<React.CSSProperties>({});
  const [fieldsetDisabled, setFieldsetDisabled] = useState(false);
  const [implicitLabel, setImplicitLabel] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = `select-${useId().replaceAll(":", "")}`;
  const available = choices.filter((choice) =>
    matchesSearch(`${choice.group} ${choice.label}`, query),
  );
  const isDisabled = () =>
    Boolean(disabled || trigger.current?.matches(":disabled"));

  useLayoutEffect(() => {
    const form = native.current?.form;
    if (!form) return;
    const reset = (event: Event) =>
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        setOpen(false);
        setQuery("");
        if (value === undefined) setLocalValue(initialValue.current);
        else if (native.current) {
          const retained = Array.isArray(value)
            ? value.map(String)
            : [String(value)];
          for (const option of native.current.options)
            option.selected = retained.includes(option.value);
        }
      });
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [value]);

  useLayoutEffect(() => {
    if (props["aria-label"] || props["aria-labelledby"]) return;
    const label = trigger.current?.closest("label")?.cloneNode(true) as
      HTMLLabelElement | undefined;
    label?.querySelector(".ns-searchable-select")?.remove();
    setImplicitLabel(label?.textContent?.trim() || "");
  }, [children, props["aria-label"], props["aria-labelledby"]]);

  useLayoutEffect(() => {
    const fieldsets = [] as HTMLFieldSetElement[];
    let parent = trigger.current?.parentElement;
    while (parent) {
      if (parent instanceof HTMLFieldSetElement) fieldsets.push(parent);
      parent = parent.parentElement;
    }
    const update = () => {
      const blocked = Boolean(trigger.current?.matches(":disabled"));
      setFieldsetDisabled(blocked);
      if (blocked) setOpen(false);
    };
    const observer = new MutationObserver(update);
    fieldsets.forEach((fieldset) =>
      observer.observe(fieldset, {
        attributes: true,
        attributeFilter: ["disabled"],
      }),
    );
    update();
    return () => observer.disconnect();
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 250), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const flip = below < 230 && above > below;
      const height = Math.min(360, Math.max(120, flip ? above : below));
      setPosition({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(flip
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        maxHeight: height,
      });
    };
    const pointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const focus = requestAnimationFrame(() => search.current?.focus());
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", escape, true);
    return () => {
      cancelAnimationFrame(focus);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  function choose(choice: Choice) {
    if (choice.disabled || isDisabled() || !native.current) return;
    const next = multiple
      ? selected.includes(choice.value)
        ? selected.filter((item) => item !== choice.value)
        : [...selected, choice.value]
      : choice.value;
    if (multiple)
      for (const option of native.current.options)
        option.selected = (next as string[]).includes(option.value);
    else native.current.value = next as string;
    if (value === undefined) setLocalValue(next);
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    if (!multiple) {
      setOpen(false);
      trigger.current?.focus();
    }
  }
  function keys(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (["ArrowDown", "ArrowUp", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        if (!isDisabled()) {
          setQuery("");
          setOpen(true);
        }
      }
      return;
    }
    if (event.key === "Enter" && event.target === search.current) {
      event.preventDefault();
      event.stopPropagation();
      const first = available.find((choice) => !choice.disabled);
      if (first) choose(first);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (
      (event.key === "Home" || event.key === "End") &&
      event.target === search.current
    )
      return;
    event.preventDefault();
    const buttons = [
      ...(panel.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not(:disabled)',
      ) ?? []),
    ];
    if (!buttons.length) return;
    const index = buttons.findIndex(
      (button) => button === document.activeElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : index < 0
            ? event.key === "ArrowUp"
              ? buttons.length - 1
              : 0
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length;
    buttons[next]?.focus();
  }
  return (
    <div className={`ns-searchable-select ${className}`} style={style}>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        className="ns-searchable-trigger"
        aria-label={props["aria-label"] || implicitLabel || undefined}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required}
        aria-disabled={disabled || fieldsetDisabled}
        disabled={disabled}
        title={props.title}
        onKeyDown={keys}
        onClick={() => {
          if (!isDisabled()) {
            setQuery("");
            setOpen((current) => !current);
          }
        }}
      >
        <span>{selectedLabels.join(", ") || t("Choose an option")}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7 5 5 5-5" />
        </svg>
      </button>
      <select
        {...nativeProps}
        ref={native}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        value={current}
        disabled={disabled}
        multiple={multiple}
        required={required}
        onChange={(event) => onChange?.(event)}
      >
        {children}
      </select>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="ns-searchable-panel"
            style={position}
            onKeyDown={keys}
          >
            <input
              ref={search}
              type="search"
              className="ns-searchable-search"
              aria-label={t("Search options")}
              placeholder={t("Search options…")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div
              id={listId}
              role="listbox"
              aria-label={props["aria-label"] || implicitLabel || undefined}
              aria-labelledby={props["aria-labelledby"]}
              aria-multiselectable={multiple || undefined}
              className="ns-searchable-options"
            >
              {available.map((choice, index) => (
                <React.Fragment
                  key={`${choice.group}-${choice.value}-${index}`}
                >
                  {choice.group &&
                    available[index - 1]?.group !== choice.group && (
                      <div className="ns-searchable-group" role="presentation">
                        {choice.group}
                      </div>
                    )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected.includes(choice.value)}
                    disabled={choice.disabled}
                    onClick={() => choose(choice)}
                  >
                    <span>{choice.label}</span>
                    {selected.includes(choice.value) && (
                      <span aria-hidden="true">✓</span>
                    )}
                  </button>
                </React.Fragment>
              ))}
              {!available.length && (
                <p role="status">{t("No matches found")}</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
