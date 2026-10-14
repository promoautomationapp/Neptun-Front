import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { t } from "./i18n";
import "../../styles/page-settings-tabs.css";
const sections = [
  ["appearance", "Background & cover", "◧"],
  ["images", "Images & layers", "▧"],
  ["logos", "Logos & artwork", "N"],
  ["prices", "Prices & savings", "€"],
  ["layout", "Format & layout", "▦"],
  ["review", "Comments", "☷"],
] as const;
const SettingsSection = createContext("appearance");
export function PageSettingsTabs({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState("appearance");
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <SettingsSection.Provider value={selected}>
      <div
        className="cs-settings-section-tabs"
        role="tablist"
        aria-label={t("Brochure settings sections")}
      >
        {sections.map(([key, label, icon], index) => (
          <button
            key={key}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-${key}`}
            aria-selected={selected === key}
            aria-controls={`${id}-panel`}
            tabIndex={selected === key ? 0 : -1}
            onClick={() => setSelected(key)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % sections.length
                  : event.key === "ArrowLeft"
                    ? (index + sections.length - 1) % sections.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? sections.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                setSelected(sections[next]![0]);
                buttons.current[next]?.focus();
              }
            }}
          >
            <span
              aria-hidden="true"
              className={`cs-settings-tab-illustration ${key}`}
            >
              {icon}
            </span>
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
      <p className="cs-settings-scope-note">
        {t(
          "Changes here apply to this brochure. The preview updates as you edit.",
        )}
      </p>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${selected}`}
        tabIndex={0}
      >
        {children}
      </div>
    </SettingsSection.Provider>
  );
}
export function PageSettingsGroup({
  title,
  category = "layout",
  children,
}: {
  title: string;
  category?: string;
  children: ReactNode;
}) {
  const selected = useContext(SettingsSection);
  if (selected !== category) return null;
  return (
    <details className="cs-page-settings-group" open>
      <summary>{title}</summary>
      <div className="cs-page-settings-content">{children}</div>
    </details>
  );
}
