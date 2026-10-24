import React from "react";

export function EditorIcon({
  name,
}: {
  name: "edit" | "image" | "screen" | "move" | "drag" | "trash";
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
      {name === "edit" ? (
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
