import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
} from "react";
import type { ReactNode } from "react";
import { resolveAsset, uploadImage } from "../../api/client";
import type { LogoAsset } from "./settings.schema";
export const SettingsPreviewContext = createContext<
  (page: "cover" | "products" | "stores") => void
>(() => {});
export const UploadStateContext = createContext<(busy: boolean) => void>(
  () => {},
);

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{
    id?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }>(children)
    ? cloneElement(children, {
        id: children.props.id ?? `${id}-control`,
        "aria-labelledby": children.props["aria-labelledby"] ?? `${id}-label`,
        ...(hint
          ? {
              "aria-describedby":
                children.props["aria-describedby"] ?? `${id}-hint`,
            }
          : {}),
      })
    : children;
  return (
    <label
      className="ns-field"
      htmlFor={
        isValidElement<{ id?: string }>(children)
          ? (children.props.id ?? `${id}-control`)
          : undefined
      }
    >
      <span id={`${id}-label`}>{label}</span>
      {control}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="ns-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function OrderButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className="ns-order">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
    </div>
  );
}
export function AssetPicker({
  label,
  value,
  onChange,
  library,
  onUpload,
  defaultImage = "",
  emptyLabel = "Use current artwork",
  defaultHint = "Current built-in icon",
}: {
  label: string;
  value: string;
  onChange: (source: string) => void;
  library: LogoAsset[];
  onUpload: (asset: LogoAsset) => void;
  defaultImage?: string;
  emptyLabel?: string;
  defaultHint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const reportBusy = useContext(UploadStateContext);
  const known = library.some((item) => item.url === value);
  return (
    <div className="ns-asset-picker">
      <Field label={label}>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{emptyLabel}</option>
          {value && !known && <option value={value}>Selected artwork</option>}
          {library.map((item) => (
            <option key={item.id} value={item.url}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      {(value || defaultImage) && (
        <img
          className="ns-artwork-preview"
          src={resolveAsset(value || defaultImage)}
          alt={`${label} preview`}
        />
      )}
      {!value && !defaultImage && <small>{defaultHint}</small>}
      <label htmlFor={id} className="ns-upload">
        {busy ? "Uploading…" : "Upload new image"}
      </label>
      <input
        id={id}
        className="ns-file"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={busy}
        aria-label={`Upload ${label}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 12 * 1024 * 1024) {
            setError("Choose an image smaller than 12 MB.");
            return;
          }
          setBusy(true);
          reportBusy(true);
          setError("");
          void uploadImage(file)
            .then((url) => {
              onUpload({ id: crypto.randomUUID(), name: file.name, url });
              onChange(url);
            })
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not upload the image.",
              ),
            )
            .finally(() => {
              setBusy(false);
              reportBusy(false);
            });
        }}
      />
      <small>
        PNG, JPEG, WebP or GIF, up to 12 MB. Uploading selects it as the
        default; Save settings applies the choice.
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** Native disclosure keeps advanced options out of the way and keyboard accessible. */
export function SettingsGroup({
  title,
  children,
  className = "",
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className={`ns-settings-group ${className}`}
      open={defaultOpen || undefined}
    >
      <summary>{title}</summary>
      <fieldset className="ns-settings-group-body">{children}</fieldset>
    </details>
  );
}
