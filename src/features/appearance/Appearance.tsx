import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { t } from "../brochure/i18n";
import "./appearance.css";
import "./dark-mode.css";

export type AppearanceMode = "light" | "dark";
const LAST_APPEARANCE = "neptun.appearance.last";
export const appearanceKey = (userId?: string) =>
  `neptun.appearance.${userId || "guest"}`;
export function readAppearance(key: string): AppearanceMode {
  try {
    return localStorage.getItem(key) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
const AppearanceContext = createContext<{
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}>({ mode: "light", setMode: () => {} });

/** Personal display preference; artwork and workspace defaults are never modified. */
export function AppearanceProvider({
  userId,
  loading = false,
  children,
}: {
  userId?: string;
  loading?: boolean;
  children: ReactNode;
}) {
  const key = loading ? LAST_APPEARANCE : appearanceKey(userId);
  const [choice, setChoice] = useState(() => ({
    key,
    mode: readAppearance(key),
  }));
  const mode = choice.key === key ? choice.mode : readAppearance(key);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null)
        setChoice({ key, mode: readAppearance(key) });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key]);
  const value = useMemo(
    () => ({
      mode,
      setMode(next: AppearanceMode) {
        if (next !== "light" && next !== "dark") return;
        setChoice({ key, mode: next });
        try {
          localStorage.setItem(key, next);
          localStorage.setItem(LAST_APPEARANCE, next);
        } catch {
          /* The current choice still works when browser storage is unavailable. */
        }
      },
    }),
    [key, mode],
  );
  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

function AppearanceIcon({ mode }: { mode: AppearanceMode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === "dark" ? (
        <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      )}
    </svg>
  );
}
export function AppearanceToggle() {
  const { mode, setMode } = useContext(AppearanceContext);
  const next = mode === "light" ? "dark" : "light";
  const label = t(
    next === "dark" ? "Switch to dark mode" : "Switch to light mode",
  );
  return (
    <button
      type="button"
      className="np-appearance-toggle"
      aria-label={label}
      title={label}
      onClick={() => setMode(next)}
    >
      <AppearanceIcon mode={next} />
      <span>{t(next === "dark" ? "Dark mode" : "Light mode")}</span>
    </button>
  );
}
export function AppearanceSettings() {
  const { mode, setMode } = useContext(AppearanceContext);
  return (
    <section className="na-edit-card np-appearance-settings">
      <h2>{t("Appearance")}</h2>
      <p>{t("Choose how your workspace looks. Light mode is the default.")}</p>
      <div
        className="np-appearance-choices"
        role="radiogroup"
        aria-label={t("Appearance")}
      >
        {(["light", "dark"] as const).map((option) => (
          <button
            type="button"
            role="radio"
            aria-checked={mode === option}
            className={`np-appearance-choice ${option}`}
            key={option}
            onClick={() => setMode(option)}
          >
            <span className="np-appearance-sample" aria-hidden="true">
              <i />
              <span>
                <b />
                <b />
                <b />
              </span>
            </span>
            <span>
              <AppearanceIcon mode={option} />
              <strong>
                {t(option === "light" ? "Light (default)" : "Dark")}
              </strong>
              <span aria-hidden="true">{mode === option ? "✓" : ""}</span>
            </span>
          </button>
        ))}
      </div>
      <small>
        {t(
          "Saved for your account on this device. Brochures, social posts and downloads keep their original colours.",
        )}
      </small>
    </section>
  );
}
