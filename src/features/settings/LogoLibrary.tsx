import { t } from "../brochure/i18n";
import { FileUpload } from "../../components/FileUpload";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useContext, useState } from "react";
import { resolveAsset, uploadImage } from "../../api/client";
import {
  Field,
  SettingsGroup,
  Toggle,
  UploadStateContext,
  SettingsPreviewContext,
} from "./components";
import { logoRuleDefaults } from "./logoLibraryData";
import type { SettingsTabProps } from "./SettingsEditor";
import type { LogoAsset } from "./settings.schema";

export function LogoLibrary({ draft, update }: SettingsTabProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preview = useContext(SettingsPreviewContext);
  const reportBusy = useContext(UploadStateContext);
  const choices = [
    ...logoRuleDefaults.filter(
      (item) => !draft.hiddenBuiltinLogos.includes(item.id),
    ),
    ...draft.logoLibrary,
  ];
  const unique = [...new Map(choices.map((item) => [item.url, item])).values()];
  const selected = (url: string) =>
    draft.brochure.coverLogoSource === url ||
    draft.brandAssets.neptun === url ||
    draft.logoRules.some((rule) => rule.image === url);
  async function upload(file: File | undefined, replace?: LogoAsset) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setError("Choose an image smaller than 12 MB.");
      return;
    }
    setBusy(true);
    reportBusy(true);
    setError("");
    try {
      const url = await uploadImage(file);
      update((next) => {
        const existing =
          replace && next.logoLibrary.find((item) => item.id === replace.id);
        if (existing) {
          existing.url = url;
        } else
          next.logoLibrary.push({
            id: crypto.randomUUID(),
            name: replace?.name || file.name,
            url,
          });
        if (replace) {
          if (replace.id.startsWith("builtin-"))
            next.hiddenBuiltinLogos = [
              ...new Set([...next.hiddenBuiltinLogos, replace.id]),
            ];
          if (next.brochure.coverLogoSource === replace.url) {
            next.brochure.coverLogoSource = url;
            next.brochure.coverLogoStyle = "custom";
          }
          for (const key of Object.keys(next.brandAssets))
            if (next.brandAssets[key] === replace.url)
              next.brandAssets[key] = url;
          next.logoRules = next.logoRules.map((rule) =>
            rule.image === replace.url ? { ...rule, image: url } : rule,
          );
        }
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not upload the logo.",
      );
    } finally {
      setBusy(false);
      reportBusy(false);
    }
  }
  return (
    <>
      <h3>{t("Your logo library")}</h3>
      <p>
        {t(
          "Choose the cover or page default below. Previews show each logo on light and dark backgrounds. Replacing a logo changes future brochures; saved brochures keep their images.",
        )}
      </p>
      <FileUpload
        aria-label={t("Add logo to library")}
        accept="image/png,image/jpeg,image/webp,image/gif"
        busy={busy}
        onChange={(event) => upload(event.target.files?.[0])}
      >
        {t("Add logo")}
      </FileUpload>
      {error && <p role="alert">{t(error)}</p>}
      <div className="ns-logo-library">
        {unique.map((item) => (
          <article className="ns-logo-card" key={item.id}>
            <div className="ns-logo-samples">
              <span>
                <img
                  src={resolveAsset(item.url)}
                  alt={`${item.name} ${t("on light")}`}
                />
              </span>
              <span>
                <img
                  src={resolveAsset(item.url)}
                  alt={`${item.name} ${t("on dark")}`}
                />
              </span>
            </div>
            {item.id.startsWith("builtin-") ? (
              <strong>{item.name}</strong>
            ) : (
              <Field label={`${t("Logo name:")} ${item.name}`}>
                <input
                  value={item.name}
                  onChange={(event) =>
                    update((next) => {
                      const logo = next.logoLibrary.find(
                        (logo) => logo.id === item.id,
                      );
                      if (logo) logo.name = event.target.value;
                    })
                  }
                />
              </Field>
            )}
            <small>
              {t(
                draft.brochure.coverLogoSource === item.url
                  ? "Cover default"
                  : "",
              )}
              {t(
                draft.brandAssets.neptun === item.url
                  ? ` · ${t("Page default")}`
                  : "",
              )}
            </small>
            <div className="ns-logo-actions">
              <button
                type="button"
                disabled={draft.brochure.coverLogoSource === item.url}
                onClick={() => {
                  update((next) => {
                    next.brochure.coverLogoSource = item.url;
                    next.brochure.coverLogoStyle =
                      item.id === "builtin-framed"
                        ? "framed"
                        : item.id === "builtin-cover"
                          ? "original"
                          : "custom";
                  });
                  preview("cover");
                }}
              >
                {t("Use for covers")}
              </button>
              <button
                type="button"
                disabled={draft.brandAssets.neptun === item.url}
                onClick={() => {
                  update((next) => {
                    next.brandAssets.neptun = item.url;
                  });
                  preview("products");
                }}
              >
                {t("Use inside pages")}
              </button>
              <FileUpload
                aria-label={`${t("Replace")} ${item.name}`}
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void upload(file, item);
                }}
              >
                {t("Replace")}
              </FileUpload>
              <button
                type="button"
                disabled={selected(item.url)}
                title={t(
                  selected(item.url)
                    ? "Choose another default or remove its color rule first."
                    : "",
                )}
                aria-label={`${t("Remove")} ${item.name} ${t("from logo choices")}`}
                onClick={() =>
                  update((next) => {
                    if (item.id.startsWith("builtin-"))
                      next.hiddenBuiltinLogos = [
                        ...new Set([...next.hiddenBuiltinLogos, item.id]),
                      ];
                    else
                      next.logoLibrary = next.logoLibrary.filter(
                        (logo) => logo.id !== item.id,
                      );
                  })
                }
              >
                {t("Remove choice")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {draft.hiddenBuiltinLogos.length > 0 && (
        <button
          type="button"
          onClick={() =>
            update((next) => {
              next.hiddenBuiltinLogos = [];
            })
          }
        >
          {t("Restore original logo choices")}
        </button>
      )}
      <SettingsGroup title={t("Choose logos for background colors")}>
        <p>
          {t(
            "A matching color uses its assigned logo. Otherwise, a light or dark background rule is used. Without a rule, your chosen default stays in place.",
          )}
        </p>
        {draft.logoRules.map((rule, index) => (
          <div className="ns-logo-rule" key={rule.id}>
            <Toggle
              label={`${t("Use logo rule")} ${index + 1}`}
              checked={rule.enabled}
              onChange={(enabled) =>
                update((next) => {
                  next.logoRules[index]!.enabled = enabled;
                })
              }
            />
            <div className="ns-grid">
              <Field label={`${t("Logo rule")} ${index + 1} ${t("pages")}`}>
                <SearchableSelect
                  value={rule.target}
                  onChange={(event) =>
                    update((next) => {
                      next.logoRules[index]!.target = event.target
                        .value as typeof rule.target;
                    })
                  }
                >
                  <option value="both">{t("Cover and inside pages")}</option>
                  <option value="cover">{t("Cover only")}</option>
                  <option value="pages">
                    {t("Inside product pages only")}
                  </option>
                  <option value="stores">{t("Stores page only")}</option>
                  <option value="footer">{t("Stores footer only")}</option>
                </SearchableSelect>
              </Field>
              <Field
                label={`${t("Logo rule")} ${index + 1} ${t("background")}`}
              >
                <SearchableSelect
                  value={rule.background}
                  onChange={(event) =>
                    update((next) => {
                      next.logoRules[index]!.background = event.target
                        .value as typeof rule.background;
                      if (
                        event.target.value === "color" &&
                        !next.logoRules[index]!.color
                      )
                        next.logoRules[index]!.color = "#1c4075";
                    })
                  }
                >
                  <option value="dark">{t("Dark backgrounds")}</option>
                  <option value="light">{t("Light backgrounds")}</option>
                  <option value="color">{t("A specific color")}</option>
                </SearchableSelect>
              </Field>
              {rule.background === "color" && (
                <Field label={`${t("Logo rule")} ${index + 1} ${t("color")}`}>
                  <input
                    type="color"
                    value={rule.color || "#1c4075"}
                    onChange={(event) =>
                      update((next) => {
                        next.logoRules[index]!.color = event.target.value;
                      })
                    }
                  />
                </Field>
              )}
              <Field label={`${t("Logo rule")} ${index + 1} ${t("image")}`}>
                <SearchableSelect
                  value={rule.image}
                  onChange={(event) =>
                    update((next) => {
                      next.logoRules[index]!.image = event.target.value;
                    })
                  }
                >
                  {!unique.some((item) => item.url === rule.image) && (
                    <option value={rule.image}>{t("Saved logo")}</option>
                  )}
                  {unique.map((item) => (
                    <option key={item.id} value={item.url}>
                      {item.name}
                    </option>
                  ))}
                </SearchableSelect>
              </Field>
            </div>
            <img
              className="ns-artwork-preview"
              style={{
                background:
                  rule.background === "color"
                    ? rule.color
                    : rule.background === "light"
                      ? "#ffffff"
                      : "#1c4075",
                padding: 12,
              }}
              src={resolveAsset(rule.image)}
              alt={`${t("Logo rule")} ${index + 1} ${t("preview")}`}
            />
            <button
              type="button"
              aria-label={`${t("Remove logo rule")} ${index + 1}`}
              onClick={() =>
                update((next) => {
                  next.logoRules.splice(index, 1);
                })
              }
            >
              {t("Remove rule")}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={draft.logoRules.length >= 50 || !unique.length}
          onClick={() =>
            update((next) => {
              next.logoRules.push({
                id: crypto.randomUUID(),
                target: "both",
                background: "dark",
                color: "",
                image: next.brochure.coverLogoSource || unique[0]!.url,
                enabled: true,
              });
            })
          }
        >
          {t("+ Add color rule")}
        </button>
      </SettingsGroup>
    </>
  );
}
