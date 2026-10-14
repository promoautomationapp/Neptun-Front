import { CategoryDefaultsTab } from "./CategoryDefaultsTab";
import { BrandsTab } from "./BrandsTab";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { workspaceSettingsSchema } from "./settings.schema";
import type { WorkspaceSettings } from "./settings.schema";
import { DesignTab, FormatsTab } from "./DesignTab";
import { LogosTab } from "./LogosTab";
import { StoresTab } from "./StoresTab";
import { OffersTab } from "./OffersTab";
import type { CategoryFacet } from "./OffersTab";
import { CampaignTypesTab } from "./CampaignTypesTab";
import { UploadStateContext } from "./components";
import "./settings.css";
import { SettingsPreview } from "./SettingsPreview";
import { ImagesTab } from "./ImagesTab";
import type { Product } from "../../domain/models";
const tabs = [
  { id: "design", label: "Cover & colors" },
  { id: "images", label: "Background images" },
  { id: "logos", label: "Logos & icons" },
  { id: "brands", label: "Brands" },
  { id: "stores", label: "Stores & contacts" },
  { id: "offers", label: "Prices & savings" },
  { id: "categories", label: "Category defaults" },
  { id: "formats", label: "Format & layout" },
  { id: "types", label: "Campaign types" },
] as const;
type TabId = (typeof tabs)[number]["id"];
export interface SettingsTabProps {
  draft: WorkspaceSettings;
  update: (change: (next: WorkspaceSettings) => void) => void;
}
export function SettingsEditor({
  initial,
  onSave,
  onReload,
  facets = [],
  facetsError,
  brands = [],
  onDirtyChange,
  onBusyChange,
  previewProducts = [],
}: {
  initial: WorkspaceSettings;
  onSave: (value: WorkspaceSettings) => Promise<WorkspaceSettings>;
  onReload?: () => void;
  facets?: CategoryFacet[];
  facetsError?: string;
  brands?: string[];
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  previewProducts?: Product[];
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [tab, setTab] = useState<TabId>("design");
  const [previewCategory, setPreviewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const rootId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(saving || uploads > 0);
  }, [saving, uploads, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange?.(false);
      onBusyChange?.(false);
    },
    [onDirtyChange, onBusyChange],
  );
  useEffect(() => {
    setDraft(structuredClone(initial));
    setBaseline(JSON.stringify(initial));
    setError("");
  }, [initial]);
  useEffect(() => {
    if (!dirty && !saving && uploads === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saving, uploads]);
  const update = useCallback((change: (next: WorkspaceSettings) => void) => {
    setDraft((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
    setMessage("");
  }, []);
  const uploadState = useCallback(
    (busy: boolean) =>
      setUploads((count) => Math.max(0, count + (busy ? 1 : -1))),
    [],
  );
  async function save() {
    const parsed = workspaceSettingsSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) => `${issue.path.join(" › ")}: ${issue.message}`)
          .join(" "),
      );
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await onSave(parsed.data);
      setDraft(structuredClone(saved));
      setBaseline(JSON.stringify(saved));
      setMessage("Settings saved. New brochures will use these defaults.");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save settings. Your changes are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  const props = { draft, update };
  return (
    <div className="ns-settings">
      <header>
        <div>
          <span className="ns-kicker">NEPTUN · WORKSPACE</span>
          <h1>Settings</h1>
          <p>
            Choose the starting defaults for new brochures. Every brochure can
            be edited separately.
          </p>
        </div>
        <div className="ns-save-actions">
          <span role="status">
            {saving
              ? "Saving…"
              : uploads
                ? "Uploading artwork…"
                : dirty
                  ? "Unsaved changes"
                  : "All changes saved"}
          </span>
          <button
            className="cs-button primary"
            type="button"
            disabled={!dirty || saving || uploads > 0}
            onClick={() => {
              void save();
            }}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {dirty && (
            <button
              type="button"
              disabled={saving || uploads > 0}
              onClick={() => {
                setDraft(structuredClone(initial));
                setBaseline(JSON.stringify(initial));
                setError("");
                setMessage("Changes discarded.");
              }}
            >
              Discard changes
            </button>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="ns-error">
          <p>{error}</p>
          {onReload && (
            <button
              type="button"
              disabled={saving || uploads > 0}
              onClick={onReload}
            >
              Reload saved settings and discard this draft
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="ns-success">
          {message}
        </p>
      )}
      <div role="tablist" aria-label="Settings sections" className="ns-tabs">
        {tabs.map((item, index) => (
          <button
            type="button"
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${rootId}-${item.id}`}
            key={item.id}
            disabled={saving || uploads > 0}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`${rootId}-panel`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                const selected = tabs[next];
                if (selected) {
                  setTab(selected.id);
                  tabRefs.current[next]?.focus();
                }
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="ns-settings-workspace">
        <div
          role="tabpanel"
          id={`${rootId}-panel`}
          aria-labelledby={`${rootId}-${tab}`}
          tabIndex={0}
        >
          <UploadStateContext.Provider value={uploadState}>
            <fieldset
              className="ns-tab-content"
              disabled={saving || uploads > 0}
            >
              {tab === "design" && <DesignTab {...props} />}
              {tab === "images" && <ImagesTab {...props} />}
              {tab === "logos" && <LogosTab {...props} brands={brands} />}
              {tab === "brands" && <BrandsTab {...props} brands={brands} />}
              {tab === "stores" && <StoresTab {...props} />}
              {tab === "offers" && (
                <OffersTab
                  {...props}
                  facets={facets}
                  facetsError={facetsError}
                />
              )}
              {tab === "categories" && (
                <CategoryDefaultsTab
                  {...props}
                  facets={facets}
                  facetsError={facetsError}
                  onPreviewCategory={setPreviewCategory}
                />
              )}
              {tab === "formats" && <FormatsTab {...props} />}
              {tab === "types" && <CampaignTypesTab {...props} />}
            </fieldset>
          </UploadStateContext.Provider>
        </div>
        <SettingsPreview
          draft={draft}
          initial={initial}
          tab={tab}
          products={previewProducts}
          categoryPath={tab === "categories" ? previewCategory : ""}
        />
      </div>
    </div>
  );
}
