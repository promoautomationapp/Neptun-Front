import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "../../styles/action-menu-portal.css";

/** Native keyboard disclosure with dismissal shared by the editor action menus. */
export function ActionMenu({
  label,
  children,
  className = "",
  portal = false,
  portalClassName = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  portal?: boolean;
  portalClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const close = useCallback(() => {
    ref.current?.removeAttribute("open");
    setOpen(false);
  }, []);
  useLayoutEffect(() => {
    if (!open || !portal) return;
    const place = () => {
      const trigger = ref.current
        ?.querySelector("summary")
        ?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(310, window.innerWidth - 24);
      const below = window.innerHeight - trigger.bottom - 18;
      const above = trigger.top - 18;
      const flip = below < 230 && above > below;
      setPosition({
        position: "fixed",
        width,
        left: Math.max(
          12,
          Math.min(trigger.left, window.innerWidth - width - 12),
        ),
        ...(flip
          ? { bottom: window.innerHeight - trigger.top + 6 }
          : { top: trigger.bottom + 6 }),
        maxHeight: Math.max(80, Math.min(440, flip ? above : below)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    panel.current
      ?.querySelector<HTMLElement>(
        "button:not(:disabled), input, summary, a[href]",
      )
      ?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, portal]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, close]);
  const content = (
    <div
      ref={panel}
      className={
        portal ? `cs-action-menu-portal ${portalClassName}` : undefined
      }
      hidden={portal && !open}
      style={portal ? position : undefined}
      data-export-hide="true"
      onPointerDown={portal ? (event) => event.stopPropagation() : undefined}
      onClick={(event) => {
        if ((event.target as Element).closest("button:not(:disabled), a[href]"))
          close();
        if (portal) event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
  return (
    <details
      ref={ref}
      className={`cs-brochure-actions-menu ${className}`}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-expanded={open}>
        {label}
        <svg
          className="cs-action-menu-chevron"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </summary>
      {portal && mounted ? createPortal(content, document.body) : content}
    </details>
  );
}
