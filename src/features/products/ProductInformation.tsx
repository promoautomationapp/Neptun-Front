import { useId, useState } from "react";
import { t } from "../brochure/i18n";

export function ProductInformation({
  description,
  specs,
}: {
  description?: string;
  specs: Array<[string, string]>;
}) {
  const [tab, setTab] = useState<"overview" | "specs">("overview");
  const id = useId();
  return (
    <section className="np-product-info">
      <div
        className="np-product-tabs"
        role="tablist"
        aria-label={t("Product information")}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "overview"
              : event.key === "End"
                ? "specs"
                : tab === "overview"
                  ? "specs"
                  : "overview";
          setTab(next);
          document.getElementById(`${id}-${next}-tab`)?.focus();
        }}
      >
        <button
          type="button"
          id={`${id}-overview-tab`}
          role="tab"
          aria-selected={tab === "overview"}
          tabIndex={tab === "overview" ? 0 : -1}
          aria-controls={`${id}-overview-panel`}
          onClick={() => setTab("overview")}
        >
          {t("Overview")}
        </button>
        <button
          type="button"
          id={`${id}-specs-tab`}
          role="tab"
          aria-selected={tab === "specs"}
          tabIndex={tab === "specs" ? 0 : -1}
          aria-controls={`${id}-specs-panel`}
          onClick={() => setTab("specs")}
        >
          {t("Specifications")} <span>{specs.length}</span>
        </button>
      </div>
      {tab === "overview" ? (
        <div
          role="tabpanel"
          id={`${id}-overview-panel`}
          aria-labelledby={`${id}-overview-tab`}
          tabIndex={0}
        >
          <p className="np-product-description">
            {description || t("No description in the catalog.")}
          </p>
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${id}-specs-panel`}
          aria-labelledby={`${id}-specs-tab`}
          tabIndex={0}
        >
          {specs.length ? (
            <dl className="np-product-specs">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="np-product-overview-note">
              {t("No specifications in the catalog.")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
