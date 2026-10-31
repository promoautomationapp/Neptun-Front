import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Modal } from "../../components/Modal";
import "./team-member-dialog.css";

/** Shares the app's modal layer so its portaled role/category pickers remain usable. */
export function TeamMemberDialog({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const content = Children.toArray(children);
  const last = content.at(-1);
  const footer =
    isValidElement<{ className?: string; children?: ReactNode }>(last) &&
    last.props.className?.includes("na-form-actions")
      ? content.pop()
      : null;
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    root.current
      ?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea',
      )
      ?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className="na-member-dialog"
      ref={root}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          !(event.target instanceof HTMLElement) ||
          !root.current?.contains(event.target)
        )
          return;
        const controls = [
          ...root.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
          ),
        ].filter(
          (element) =>
            !element.hidden &&
            !element.closest("[hidden]") &&
            !element.closest("details:not([open]) :not(summary)"),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <Modal
        title={title}
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="na-member-dialog-content" aria-busy={busy}>
          {description && (
            <p className="na-member-dialog-description">{description}</p>
          )}
          {content}
        </div>
        {footer && (
          <div className="cs-modal-actions na-form-actions">
            {isValidElement<{ children?: ReactNode }>(footer)
              ? footer.props.children
              : footer}
          </div>
        )}
      </Modal>
    </div>
  );
}
