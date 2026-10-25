import { t } from "../brochure/i18n";
import { BrochurePresetsTab } from "./BrochurePresetsTab";
import {
  availableBrochurePresets,
  captureEditedBrochurePreset,
} from "../brochure/brochurePresets";
import { ProductDesignTab } from "./ProductDesignTab";
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
import { UploadStateContext, SettingsPreviewContext } from "./components";
import "./settings.css";
import { SettingsPreview } from "./SettingsPreview";
import { ImagesTab } from "./ImagesTab";
import type { Product } from "../../domain/models";
const tabs = [
  { id: "presets", label: "Brochure presets" },
  { id: "design", label: "Cover & colors" },
  { id: "images", label: "Background images" },
  { id: "logos", label: "Logos & icons" },
  { id: "brands", label: "Brands" },
  { id: "stores", label: "Stores & contacts" },
  { id: "offers", label: "Prices & savings" },
  { id: "categories", label: "Category defaults" },
  { id: "products", label: "Product design" },
  { id: "formats", label: "Format & layout" },
  { id: "types", label: "Campaign types" },
] as const;
const areas = [
  { id: "presets", label: "Brochure designs", tabs: ["presets"] },
  { id: "cover", label: "Cover", tabs: ["design", "images", "logos"] },
  {
    id: "inside",
    label: "Inside pages",
    tabs: [
      "products",
      "offers",
      "categories",
      "design",
      "images",
      "logos",
      "formats",
    ],
  },
  {
    id: "stores",
    label: "Stores page",
    tabs: ["stores", "design", "images", "logos"],
  },
  { id: "footer", label: "Stores footer", tabs: ["stores", "design", "logos"] },
  {
    id: "artwork",
    label: "Reusable images",
    tabs: ["logos", "images", "brands"],
  },
  {
    id: "workspace",
    label: "Campaign types & sizes",
    tabs: ["types", "formats"],
  },
] as const;
export type SettingsArea = (typeof areas)[number]["id"];
type TabId = (typeof tabs)[number]["id"];
export interface SettingsTabProps {
  pageArea?: SettingsArea;
  draft: WorkspaceSettings;
  update: (change: (next: WorkspaceSettings) => void) => void;
}

interface SettingsDraftBinding {
  key?: string;
  version?: number;
  initial: string;
}

function recoverSettingsDraft(
  initial: WorkspaceSettings,
  key?: string,
  version?: number,
) {
  const fresh = {
    draft: structuredClone(initial),
    selectedPresetId: initial.defaultBrochurePresetId,
    restored: false,
  };
  if (!key) return fresh;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      saved?.schemaVersion !== 1 ||
      saved.baseline !== JSON.stringify(initial) ||
      saved.version !== version
    )
      return fresh;
    const parsed = workspaceSettingsSchema.safeParse(saved.draft);
    if (!parsed.success || JSON.stringify(parsed.data) === saved.baseline)
      return fresh;
    return {
      draft: parsed.data,
      selectedPresetId:
        typeof saved.selectedPresetId === "string"
          ? saved.selectedPresetId
          : parsed.data.defaultBrochurePresetId,
      restored: true,
    };
  } catch {
    // Private browsing, a full storage quota or an invalid local record must
    // never prevent editing the server's saved settings.
    return fresh;
  }
}

function clearSettingsDraft(key?: string, binding?: SettingsDraftBinding) {
  if (!key) return;
  try {
    if (binding) {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (
        saved?.baseline !== binding.initial ||
        saved.version !== binding.version
      )
        return;
    }
    sessionStorage.removeItem(key);
  } catch {
    // Local recovery is optional when browser storage is unavailable.
  }
}

export function SettingsEditor({
  initial,
  draftKey,
  draftVersion,
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
  /** A session-storage key scoped to the signed-in organization and user. */
  draftKey?: string;
  draftVersion?: number;
  onSave: (value: WorkspaceSettings) => Promise<WorkspaceSettings>;
  onReload?: () => void;
  facets?: CategoryFacet[];
  facetsError?: string;
  brands?: string[];
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  previewProducts?: Product[];
}) {
  const [recovery] = useState(() =>
    recoverSettingsDraft(initial, draftKey, draftVersion),
  );
  const [draft, setDraft] = useState(recovery.draft);
  const [selectedPresetId, setSelectedPresetId] = useState(
    recovery.selectedPresetId,
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [draftBinding, setDraftBinding] = useState<SettingsDraftBinding>(
    () => ({
      key: draftKey,
      version: draftVersion,
      initial: JSON.stringify(initial),
    }),
  );
  const currentDraftKey = useRef(draftKey);
  currentDraftKey.current = draftKey;
  const [tab, setTab] = useState<TabId>("design");
  const [area, setArea] = useState<SettingsArea>("cover");
  const visibleTabs = tabs.filter((item) =>
    (
      areas.find((group) => group.id === area)!.tabs as readonly string[]
    ).includes(item.id),
  );
  const [previewCategory, setPreviewCategory] = useState("");
  const [previewRequest, setPreviewRequest] = useState<{
    page: "cover" | "products" | "stores";
    revision: number;
  }>();
  const previewPage = useCallback(
    (page: "cover" | "products" | "stores") =>
      setPreviewRequest((current) => ({
        page,
        revision: (current?.revision || 0) + 1,
      })),
    [],
  );
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(() =>
    recovery.restored ? t("Unsaved settings restored on this browser.") : "",
  );
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
    const initialSnapshot = JSON.stringify(initial);
    if (
      draftBinding.key === draftKey &&
      draftBinding.version === draftVersion &&
      draftBinding.initial === initialSnapshot
    )
      return;
    const recovered = recoverSettingsDraft(initial, draftKey, draftVersion);
    setDraft(recovered.draft);
    setSelectedPresetId(recovered.selectedPresetId);
    setBaseline(initialSnapshot);
    setDraftBinding({
      key: draftKey,
      version: draftVersion,
      initial: initialSnapshot,
    });
    setError("");
    setMessage(
      recovered.restored ? t("Unsaved settings restored on this browser.") : "",
    );
  }, [initial, draftKey, draftVersion, draftBinding]);
  useEffect(() => {
    if (
      !draftKey ||
      draftBinding.key !== draftKey ||
      draftBinding.version !== draftVersion ||
      draftBinding.initial !== JSON.stringify(initial)
    )
      return;
    if (!dirty) {
      clearSettingsDraft(draftKey, draftBinding);
      return;
    }
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          schemaVersion: 1,
          version: draftVersion,
          baseline,
          selectedPresetId,
          draft,
        }),
      );
    } catch {
      // Uploaded artwork can exceed the browser's local storage quota. The
      // live draft and normal explicit save flow remain available.
    }
  }, [
    draft,
    selectedPresetId,
    baseline,
    dirty,
    draftKey,
    draftVersion,
    draftBinding,
    initial,
  ]);
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
    const savingDraftKey = draftKey;
    const validDraft = workspaceSettingsSchema.safeParse(draft);
    if (!validDraft.success) {
      setError(
        validDraft.error.issues
          .map((issue) => `${issue.path.join(" › ")}: ${issue.message}`)
          .join(" "),
      );
      return;
    }
    const next = structuredClone(validDraft.data);
    const selected = availableBrochurePresets(next).find(
      (preset) => preset.id === selectedPresetId,
    );
    if (selected) {
      const captured = captureEditedBrochurePreset(
        next,
        selected,
      ) as WorkspaceSettings["brochurePresets"][number];
      const index = next.brochurePresets.findIndex(
        (preset) => preset.id === selected.id,
      );
      if (index < 0) next.brochurePresets.push(captured);
      else next.brochurePresets[index] = captured;
    }
    const parsed = workspaceSettingsSchema.safeParse(next);
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
      clearSettingsDraft(savingDraftKey);
      if (currentDraftKey.current !== savingDraftKey) return;
      setDraft(structuredClone(saved));
      setBaseline(JSON.stringify(saved));
      setMessage("Settings saved. New brochures will use these defaults.");
    } catch (cause: unknown) {
      if (currentDraftKey.current !== savingDraftKey) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save settings. Your changes are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  const props = { draft, update, pageArea: area };
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
                clearSettingsDraft(draftKey);
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
              onClick={() => {
                clearSettingsDraft(draftKey);
                onReload();
              }}
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
      <div
        role="tablist"
        aria-label="Settings page areas"
        className="ns-page-areas"
      >
        {areas.map((group) => (
          <button
            key={group.id}
            role="tab"
            type="button"
            aria-selected={area === group.id}
            disabled={saving || uploads > 0}
            onClick={() => {
              setArea(group.id);
              setTab(group.tabs[0] as TabId);
              previewPage(
                group.id === "inside"
                  ? "products"
                  : group.id === "stores" || group.id === "footer"
                    ? "stores"
                    : "cover",
              );
            }}
          >
            {group.id === "presets" ? t(group.label) : group.label}
          </button>
        ))}
      </div>
      <div role="tablist" aria-label="Settings sections" className="ns-tabs">
        {visibleTabs.map((item, index) => (
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
                  ? (index + 1) % visibleTabs.length
                  : event.key === "ArrowLeft"
                    ? (index + visibleTabs.length - 1) % visibleTabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? visibleTabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                const selected = visibleTabs[next];
                if (selected) {
                  setTab(selected.id);
                  tabRefs.current[next]?.focus();
                }
              }
            }}
          >
            {item.id === "design" && area !== "cover"
              ? "Page colors"
              : item.id === "presets"
                ? t(item.label)
                : item.label}
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
            <SettingsPreviewContext.Provider value={previewPage}>
              <fieldset
                className="ns-tab-content"
                disabled={saving || uploads > 0}
              >
                {tab === "presets" && (
                  <BrochurePresetsTab
                    {...props}
                    selectedId={selectedPresetId}
                    onSelect={setSelectedPresetId}
                  />
                )}
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
                {tab === "products" && <ProductDesignTab {...props} />}
                {tab === "formats" && <FormatsTab {...props} />}
                {tab === "types" && <CampaignTypesTab {...props} />}
              </fieldset>
            </SettingsPreviewContext.Provider>
          </UploadStateContext.Provider>
        </div>
        <SettingsPreview
          pageRequest={previewRequest}
          draft={draft}
          initial={initial}
          presetId={selectedPresetId}
          tab={tab}
          products={previewProducts}
          categoryPath={tab === "categories" ? previewCategory : ""}
        />
      </div>
    </div>
  );
}
