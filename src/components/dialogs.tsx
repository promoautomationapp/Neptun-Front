import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { t } from "../features/brochure/i18n";
import { CloseIcon } from "./CloseIcon";
import "./dialogs.css";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
export interface PromptDialogOptions extends Omit<
  ConfirmDialogOptions,
  "danger"
> {
  label?: string;
  initialValue?: string;
  sensitive?: boolean;
}
type Result = boolean | string | null;
type DialogRequest = {
  kind: "confirm" | "prompt";
  options: ConfirmDialogOptions & PromptDialogOptions;
  resolve: (result: Result) => void;
};
const requests: DialogRequest[] = [];
let active: DialogRequest | undefined;
let dialogNumber = 0;

function showNext() {
  if (active || !requests.length) return;
  const request = requests.shift()!;
  active = request;
  const host = document.createElement("div");
  host.className = "np-dialog-host";
  document.body.append(host);
  const root = createRoot(host, {
    identifierPrefix: `app-dialog-${++dialogNumber}-`,
  });
  let closing = false;
  const complete = (result: Result) => {
    if (closing) return;
    closing = true;
    // Finish the event before removing its React root. Cleanup restores the
    // page before the caller acts or the next queued request receives focus.
    queueMicrotask(() => {
      root.unmount();
      host.remove();
      active = undefined;
      request.resolve(result);
      queueMicrotask(showNext);
    });
  };
  root.render(<AppDialog request={request} onComplete={complete} />);
}

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    requests.push({
      kind: "confirm",
      options,
      resolve: (result) => resolve(result === true),
    });
    showNext();
  });
}

export function promptDialog(
  options: PromptDialogOptions,
): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    requests.push({
      kind: "prompt",
      options,
      resolve: (result) => resolve(typeof result === "string" ? result : null),
    });
    showNext();
  });
}

function AppDialog({
  request,
  onComplete,
}: {
  request: DialogRequest;
  onComplete: (result: Result) => void;
}) {
  const { options, kind } = request;
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(options.initialValue || "");
  const cancelResult = kind === "confirm" ? false : null;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const host = element.parentElement;
    const siblings = [...document.body.children].filter(
      (node) => node !== host,
    );
    const inert = siblings.map(
      (node) => [node, node.getAttribute("inert")] as const,
    );
    siblings.forEach((node) => node.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    if (typeof element.showModal === "function") element.showModal();
    else element.setAttribute("open", "");
    const focusInitial = () => {
      const target =
        kind === "prompt"
          ? input.current
          : options.danger
            ? cancel.current
            : confirm.current;
      target?.focus({ preventScroll: true });
    };
    focusInitial();
    input.current?.select();
    const focusables = () => [
      ...element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onComplete(cancelResult);
      } else if (event.key === "Tab") {
        const fields = focusables();
        const first = fields[0],
          last = fields.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !element.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!element.contains(event.target as Node)) focusInitial();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus, true);
      if (typeof element.close === "function" && element.open) element.close();
      inert.forEach(([node, value]) =>
        value === null
          ? node.removeAttribute("inert")
          : node.setAttribute("inert", value),
      );
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]"))
        previousFocus.focus({ preventScroll: true });
    };
  }, [cancelResult, kind, onComplete, options.danger]);
  return (
    <dialog
      ref={dialog}
      className={`np-app-dialog${options.danger ? " danger" : ""}`}
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault();
        onComplete(cancelResult);
      }}
      onClose={() => onComplete(cancelResult)}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onComplete(cancelResult);
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onComplete(kind === "confirm" ? true : value);
        }}
      >
        <header>
          <span className="np-dialog-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {kind === "prompt" ? (
                <path d="m4 16 11-11 4 4L8 20H4Z M13 7l4 4" />
              ) : options.danger ? (
                <>
                  <path d="M3 6h18M8 6V3h8v3m3 0-1 15H6L5 6m5 4v7m4-7v7" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12 3 3 5-6" />
                </>
              )}
            </svg>
          </span>
          <h2 id={`${id}-title`}>{options.title}</h2>
          <button
            type="button"
            className="np-dialog-close"
            aria-label={t("Close")}
            onClick={() => onComplete(cancelResult)}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="np-dialog-body">
          <p id={`${id}-message`}>{options.message}</p>
          {kind === "prompt" && (
            <label htmlFor={`${id}-input`}>
              {options.label || options.title}
              <input
                id={`${id}-input`}
                ref={input}
                type={options.sensitive ? "password" : "text"}
                value={value}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          )}
        </div>
        <footer>
          <button
            ref={cancel}
            type="button"
            className="np-dialog-cancel"
            onClick={() => onComplete(cancelResult)}
          >
            {options.cancelLabel || t("Cancel")}
          </button>
          <button ref={confirm} type="submit" className="np-dialog-confirm">
            {options.confirmLabel || t("Continue")}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
