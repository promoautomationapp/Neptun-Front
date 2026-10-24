import type React from "react";

export function inlineText(
  value: string,
  label: string,
  save?: (value: string) => void,
): React.HTMLAttributes<HTMLElement> {
  if (!save) return {};
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: "textbox",
    "aria-label": label,
    onPointerDown: (event) => event.stopPropagation(),
    onClick: (event) => event.stopPropagation(),
    onBlur: (event) => {
      const next = event.currentTarget.textContent || "";
      if (next !== value) save(next);
    },
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.currentTarget.textContent = value;
        event.currentTarget.blur();
      }
    },
    onPaste: (event) => {
      event.preventDefault();
      document.execCommand(
        "insertText",
        false,
        event.clipboardData.getData("text/plain").replace(/\n/g, " "),
      );
    },
  };
}
