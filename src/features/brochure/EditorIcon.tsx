import React from "react";

export function EditorIcon({
  name,
}: {
  name:
    | "edit"
    | "page"
    | "pages"
    | "palette"
    | "layout"
    | "price"
    | "check"
    | "close"
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
      {name === "page" ? (
        <>
          <path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z" />
          <path d="M14 2v7h7M7 14h10M7 18h6" />
        </>
      ) : name === "pages" ? (
        <>
          <rect x="7" y="3" width="14" height="17" rx="2" />
          <path d="M3 7v13a3 3 0 0 0 3 3h11M11 8h6m-6 4h6m-6 4h4" />
        </>
      ) : name === "palette" ? (
        <>
          <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
          <circle cx="7" cy="10" r=".8" />
          <circle cx="10" cy="7" r=".8" />
          <circle cx="15" cy="7" r=".8" />
          <circle cx="17" cy="11" r=".8" />
        </>
      ) : name === "layout" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M11 9v12" />
        </>
      ) : name === "price" ? (
        <>
          <path d="M3 3h8l10 10-8 8L3 11Z" />
          <circle cx="7.5" cy="7.5" r="1" />
          <path d="m11 13 4 4m-1-7 4 4" />
        </>
      ) : name === "check" ? (
        <path d="m5 12 4 4L19 6" />
      ) : name === "close" ? (
        <path d="m6 6 12 12M6 18 18 6" />
      ) : name === "layers" ? (
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
