import React, { useRef } from "react";
import "./studio-controls.css";

export function ImageUploadButton({
  label,
  value,
  onFile,
  onRemove,
  hint,
}: {
  label: string;
  value?: string;
  onFile: (file: File) => void | Promise<void>;
  onRemove?: () => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="studio-image-upload">
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      {value && <img src={value} alt="Uploaded preview" />}
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <button type="button" onClick={() => input.current?.click()}>
        {value ? "↻ Replace" : "↑ Upload"}
      </button>
      {value && onRemove && (
        <button
          type="button"
          className="remove"
          onClick={onRemove}
          aria-label={`Remove ${label.toLowerCase()}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
