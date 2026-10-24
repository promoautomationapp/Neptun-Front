import React, { useEffect } from "react";
import { t } from "./i18n";
import "../../styles/canvas-tools.css";

export type CanvasTool = "pointer" | "text" | "comment";
export interface CanvasToolsProps {
  activeTool: CanvasTool;
  onSelect: (tool: CanvasTool) => void;
  disabled?: boolean;
}
const tools = [
  { id: "pointer", label: "Pointer", caption: "Pointer", shortcut: "V" },
  { id: "text", label: "Add text anywhere", caption: "Text", shortcut: "T" },
  {
    id: "comment",
    label: "Comment anywhere",
    caption: "Comment",
    shortcut: "C",
  },
] as const;

export function CanvasTools({
  activeTool,
  onSelect,
  disabled,
}: CanvasToolsProps) {
  useEffect(() => {
    if (disabled) return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']",
        )
      )
        return;
      const tool = tools.find(
        (item) => item.shortcut.toLowerCase() === event.key.toLowerCase(),
      );
      if (!tool) return;
      event.preventDefault();
      onSelect(tool.id);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [disabled, onSelect]);
  return (
    <div
      className="cs-canvas-tools"
      role="toolbar"
      aria-label={t("Canvas tools")}
    >
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          disabled={disabled}
          aria-label={t(tool.label)}
          aria-pressed={activeTool === tool.id}
          aria-keyshortcuts={tool.shortcut}
          title={`${t(tool.label)} · ${tool.shortcut}`}
          onClick={() => onSelect(tool.id)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {tool.id === "pointer" ? (
              <path d="m5 3 14 10-7 1-3 7Z" />
            ) : tool.id === "text" ? (
              <path d="M4 6V3h16v3M12 3v18M8 21h8" />
            ) : (
              <path d="M20 11a8 8 0 0 1-8 8H7l-4 3V11a8 8 0 1 1 17 0ZM8 9h8M8 13h5" />
            )}
          </svg>
          <span>{t(tool.caption)}</span>
          <kbd aria-hidden="true">{tool.shortcut}</kbd>
        </button>
      ))}
    </div>
  );
}
