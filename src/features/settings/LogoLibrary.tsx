import { useContext, useId, useState } from "react";
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
  const reportBusy = useContext(UploadStateContext),
    uploadId = useId();
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
      <h3>Your logo library</h3>
      <p>
        Choose the cover or page default below. Previews show each logo on light
        and dark backgrounds. Replacing a logo changes future brochures; saved
        brochures keep their images.
      </p>
      <label className="ns-upload" htmlFor={uploadId}>
        {busy ? "Uploading…" : "+ Add logo"}
      </label>
      <input
        className="ns-file"
        id={uploadId}
        aria-label="Add logo to library"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload(file);
        }}
      />
      {error && <p role="alert">{error}</p>}
      <div className="ns-logo-library">
        {unique.map((item) => (
          <article className="ns-logo-card" key={item.id}>
            <div className="ns-logo-samples">
              <span>
                <img
                  src={resolveAsset(item.url)}
                  alt={`${item.name} on light`}
                />
              </span>
              <span>
                <img
                  src={resolveAsset(item.url)}
                  alt={`${item.name} on dark`}
                />
              </span>
            </div>
            {item.id.startsWith("builtin-") ? (
              <strong>{item.name}</strong>
            ) : (
              <Field label={`Logo name: ${item.name}`}>
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
              {draft.brochure.coverLogoSource === item.url
                ? "Cover default"
                : ""}
              {draft.brandAssets.neptun === item.url ? " · Page default" : ""}
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
                Use for covers
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
                Use inside pages
              </button>
              <label className="ns-upload">
                Replace
                <input
                  className="ns-file"
                  aria-label={`Replace ${item.name}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void upload(file, item);
                  }}
                />
              </label>
              <button
                type="button"
                disabled={selected(item.url)}
                title={
                  selected(item.url)
                    ? "Choose another default or remove its color rule first."
                    : ""
                }
                aria-label={`Remove ${item.name} from logo choices`}
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
                Remove choice
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
          Restore original logo choices
        </button>
      )}
      <SettingsGroup title="Choose logos for background colors">
        <p>
          A matching color uses its assigned logo. Otherwise, a light or dark
          background rule is used. Without a rule, your chosen default stays in
          place.
        </p>
        {draft.logoRules.map((rule, index) => (
          <div className="ns-logo-rule" key={rule.id}>
            <Toggle
              label={`Use logo rule ${index + 1}`}
              checked={rule.enabled}
              onChange={(enabled) =>
                update((next) => {
                  next.logoRules[index]!.enabled = enabled;
                })
              }
            />
            <div className="ns-grid">
              <Field label={`Logo rule ${index + 1} pages`}>
                <select
                  value={rule.target}
                  onChange={(event) =>
                    update((next) => {
                      next.logoRules[index]!.target = event.target
                        .value as typeof rule.target;
                    })
                  }
                >
                  <option value="both">Cover and inside pages</option>
                  <option value="cover">Cover only</option>
                  <option value="pages">Inside pages only</option>
                </select>
              </Field>
              <Field label={`Logo rule ${index + 1} background`}>
                <select
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
                  <option value="dark">Dark backgrounds</option>
                  <option value="light">Light backgrounds</option>
                  <option value="color">A specific color</option>
                </select>
              </Field>
              {rule.background === "color" && (
                <Field label={`Logo rule ${index + 1} color`}>
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
              <Field label={`Logo rule ${index + 1} image`}>
                <select
                  value={rule.image}
                  onChange={(event) =>
                    update((next) => {
                      next.logoRules[index]!.image = event.target.value;
                    })
                  }
                >
                  {!unique.some((item) => item.url === rule.image) && (
                    <option value={rule.image}>Saved logo</option>
                  )}
                  {unique.map((item) => (
                    <option key={item.id} value={item.url}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <img
              className="ns-artwork-preview"
              src={resolveAsset(rule.image)}
              alt={`Logo rule ${index + 1} preview`}
            />
            <button
              type="button"
              aria-label={`Remove logo rule ${index + 1}`}
              onClick={() =>
                update((next) => {
                  next.logoRules.splice(index, 1);
                })
              }
            >
              Remove rule
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
          + Add color rule
        </button>
      </SettingsGroup>
    </>
  );
}
