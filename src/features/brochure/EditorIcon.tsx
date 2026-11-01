import React from "react";

export function EditorIcon({
  name,
}: {
  name:
    | "edit"
    | "image"
    | "layers"
    | "screen"
    | "move"
    | "drag"
    | "trash"
    | "chevron-up"
    | "chevron-down"
    | "plus";
}) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "layers" ? (
        <path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" />
      ) : name === "chevron-up" ? (
        <path d="m6 15 6-6 6 6" />
      ) : name === "chevron-down" ? (
        <path d="m6 9 6 6 6-6" />
      ) : name === "plus" ? (
        <path d="M12 5v14M5 12h14" />
      ) : name === "edit" ? (
        <>
          <path d="m4 16 11-11 4 4L8 20H4Z M13 7l4 4" />
        </>
      ) : name === "image" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m3 17 5-5 4 4 4-6 5 7" />
        </>
      ) : name === "screen" ? (
        <>
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M8 22h8m-4-4v4" />
        </>
      ) : name === "move" ? (
        <>
          <path d="M12 2v20M2 12h20M8 6l4-4 4 4M6 8l-4 4 4 4m12-8 4 4-4 4M8 18l4 4 4-4" />
        </>
      ) : name === "trash" ? (
        <>
          <path d="M3 6h18M8 6V3h8v3m3 0-1 15H6L5 6m5 4v7m4-7v7" />
        </>
      ) : (
        <>
          <circle cx="9" cy="5" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="19" r="1" />
        </>
      )}
    </svg>
  );
}
