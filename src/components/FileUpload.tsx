import { useRef, useState } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  RefObject,
} from "react";
import { t } from "../features/brochure/i18n";
import "./file-upload.css";

type FileUploadProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children" | "onChange" | "className"
> & {
  children: ReactNode;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  busy?: boolean;
  busyLabel?: string;
};

/** A keyboard-accessible trigger; the native file control never occupies layout space. */
export function FileUpload({
  children,
  onChange,
  inputRef,
  className = "",
  busy = false,
  busyLabel,
  disabled,
  ...inputProps
}: FileUploadProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const input = inputRef || localRef;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const waiting = busy || working;
  return (
    <span className={`np-upload-control ${className}`}>
      <input
        {...inputProps}
        ref={input}
        type="file"
        hidden
        disabled={disabled || waiting}
        onChange={async (event) => {
          const element = event.currentTarget;
          if (!element.files?.length) return;
          setError("");
          try {
            const result = onChange(event);
            if (result) {
              setWorking(true);
              await result;
            }
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : t("Could not upload the file. Please try again."),
            );
          } finally {
            element.value = "";
            setWorking(false);
          }
        }}
      />
      <button
        type="button"
        className="np-upload-button"
        disabled={disabled || waiting}
        aria-busy={waiting}
        onClick={() => input.current?.click()}
      >
        {waiting ? (
          <span className="np-upload-spinner" aria-hidden="true" />
        ) : (
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
            <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
          </svg>
        )}
        <span>{waiting ? busyLabel || t("Uploading…") : children}</span>
      </button>
      {error && (
        <small className="np-upload-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
