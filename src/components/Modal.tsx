import React, { useEffect } from "react";
import { t } from "../features/brochure/i18n";
import { CloseIcon } from "./CloseIcon";

export function Modal({
  title,
  kicker,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const backdrop = React.useRef<HTMLDivElement>(null);
  const content = React.Children.toArray(children);
  const last = content.at(-1);
  const footer =
    React.isValidElement<{ className?: string }>(last) &&
    /(?:^|\s)cs-(?:modal|export)-actions(?:\s|$)/.test(
      last.props.className || "",
    )
      ? content.pop()
      : null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        event.key === "Escape" &&
        [...document.querySelectorAll(".cs-modal-backdrop")].at(-1) ===
          backdrop.current
      )
        onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      ref={backdrop}
      className="cs-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`cs-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="cs-modal-head">
          <div>
            <span className="cs-eyebrow">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="cs-icon-button"
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="cs-modal-body">{content}</div>
        {footer && <div className="cs-modal-footer">{footer}</div>}
      </section>
    </div>
  );
}
