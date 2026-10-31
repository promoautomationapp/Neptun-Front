import { useSyncExternalStore } from "react";
import { AppearanceToggle } from "../appearance/Appearance";
import { getLanguage, setLanguage, t } from "../brochure/i18n";

const languageEvent = "neptun-auth-language";
const subscribe = (refresh: () => void) => {
  window.addEventListener(languageEvent, refresh);
  return () => window.removeEventListener(languageEvent, refresh);
};
export function useAuthLanguage() {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
export function AuthPreferences() {
  const language = useAuthLanguage();
  return (
    <div className="na-auth-preferences">
      <div
        className="cs-language-switch"
        role="group"
        aria-label={t("Language")}
      >
        {(["sq", "en"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={language === value ? "active" : ""}
            aria-pressed={language === value}
            aria-label={value === "sq" ? "Shqip" : "English"}
            onClick={() => {
              setLanguage(value);
              window.dispatchEvent(new Event(languageEvent));
            }}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      <AppearanceToggle />
    </div>
  );
}
