import { FileUpload } from "../../components/FileUpload";
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
  return (
    <div className="studio-image-upload">
      {value && <img src={value} alt="Uploaded preview" />}
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <FileUpload
        accept="image/*"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) return onFile(file);
        }}
      >
        {value ? "Replace" : "Upload"}
      </FileUpload>
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
