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
function settingsNavigation() {
  const params = new URLSearchParams(window.location.search);
  const group =
    areas.find((item) => item.id === params.get("settingsArea")) || areas[1]!;
  const requestedTab = params.get("settingsTab");
  return {
    area: group.id,
    tab: (group.tabs as readonly string[]).includes(requestedTab || "")
      ? (requestedTab as TabId)
      : (group.tabs[0] as TabId),
  };
}
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
  designScope,
  externalBusy = false,
}: {
  initial: WorkspaceSettings;
  externalBusy?: boolean;
  designScope?: { name: string; changed?: boolean; onCancel: () => void };
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
  const [captureOnSave, setCaptureOnSave] = useState(true);
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
  const [initialNavigation] = useState(() =>
    designScope
      ? { area: "cover" as SettingsArea, tab: "design" as TabId }
      : settingsNavigation(),
  );
  const [tab, setTab] = useState<TabId>(initialNavigation.tab);
  const [area, setArea] = useState<SettingsArea>(initialNavigation.area);
  useEffect(() => {
    if (designScope) return;
    const restore = () => {
      const next = settingsNavigation();
      setArea(next.area);
      setTab(next.tab);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [Boolean(designScope)]);
  useEffect(() => {
    if (designScope) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "stores") return;
    params.set("settingsArea", area);
    params.set("settingsTab", tab);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params}${window.location.hash}`,
    );
    window.dispatchEvent(new Event("neptun:workspace-url-changed"));
  }, [area, tab, Boolean(designScope)]);
  const visibleAreas = designScope
    ? areas.filter((group) => group.id !== "presets")
    : areas;
  const visibleTabs = tabs.filter(
    (item) =>
      (!designScope || (item.id !== "presets" && item.id !== "types")) &&
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
  const lastSaved = useRef<{
    key: string | undefined;
    snapshot: string;
  } | null>(null);
  const rootId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dirty =
    JSON.stringify(draft) !== baseline || Boolean(designScope?.changed);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(externalBusy || saving || uploads > 0);
  }, [externalBusy, saving, uploads, onBusyChange]);
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
    setCaptureOnSave(true);
    setBaseline(initialSnapshot);
    setDraftBinding({
      key: draftKey,
      version: draftVersion,
      initial: initialSnapshot,
    });
    setError("");
    setMessage(
      recovered.restored
        ? t("Unsaved settings restored on this browser.")
        : lastSaved.current &&
            lastSaved.current.key === draftKey &&
            lastSaved.current.snapshot === initialSnapshot
          ? "Settings saved. New brochures will use these defaults."
          : "",
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
    setCaptureOnSave(true);
    setDraft((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
    setMessage("");
  }, []);
  // Library edits already contain their own complete design snapshot. They must
  // not be recaptured from unrelated workspace store/contact defaults on save.
  const updateLibrary = useCallback(
    (change: (next: WorkspaceSettings) => void) => {
      setDraft((current) => {
        const next = structuredClone(current);
        change(next);
        return next;
      });
      setCaptureOnSave(false);
      setMessage("");
    },
    [],
  );
  const uploadState = useCallback(
    (busy: boolean) =>
      setUploads((count) => Math.max(0, count + (busy ? 1 : -1))),
    [],
  );
  async function save() {
    if (externalBusy) return;
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
    if (selected && captureOnSave) {
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
      lastSaved.current = {
        key: savingDraftKey,
        snapshot: JSON.stringify(saved),
      };
      setDraft(structuredClone(saved));
      setBaseline(JSON.stringify(saved));
      setCaptureOnSave(false);
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
  const saveActions = (
    <div className="ns-save-actions">
      <span role="status">
        {t(
          saving
            ? "Saving…"
            : uploads
              ? "Uploading artwork…"
              : dirty
                ? "Unsaved changes"
                : "All changes saved",
        )}
      </span>
      <button
        className="cs-button primary"
        type="button"
        disabled={!dirty || externalBusy || saving || uploads > 0}
        onClick={() => {
          void save();
        }}
      >
        {t(saving ? "Saving…" : designScope ? "Save design" : "Save settings")}
      </button>
      {designScope ? (
        <button
          type="button"
          disabled={externalBusy || saving || uploads > 0}
          onClick={designScope.onCancel}
        >
          {t("Cancel")}
        </button>
      ) : (
        dirty && (
          <button
            type="button"
            disabled={externalBusy || saving || uploads > 0}
            onClick={() => {
              clearSettingsDraft(draftKey);
              setDraft(structuredClone(initial));
              setBaseline(JSON.stringify(initial));
              setError("");
              setMessage("Changes discarded.");
            }}
          >
            {t("Discard changes")}
          </button>
        )
      )}
    </div>
  );
  const navigation = (
    <>
      <div
        role="tablist"
        aria-label={t("Settings page areas")}
        className="ns-page-areas"
      >
        {visibleAreas.map((group) => (
          <button
            key={group.id}
            role="tab"
            type="button"
            aria-selected={area === group.id}
            disabled={externalBusy || saving || uploads > 0}
            onClick={() => {
              setArea(group.id);
              setTab(
                group.id === "workspace" && designScope
                  ? "formats"
                  : (group.tabs[0] as TabId),
              );
              previewPage(
                group.id === "inside"
                  ? "products"
                  : group.id === "stores" || group.id === "footer"
                    ? "stores"
                    : "cover",
              );
            }}
          >
            {t(
              group.id === "workspace" && designScope
                ? "Format & layout"
                : group.label,
            )}
          </button>
        ))}
      </div>
      <div
        role="tablist"
        aria-label={t("Settings sections")}
        className="ns-tabs"
      >
        {visibleTabs.map((item, index) => (
          <button
            type="button"
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`${rootId}-${item.id}`}
            key={item.id}
            disabled={externalBusy || saving || uploads > 0}
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
            {t(
              item.id === "design" && area !== "cover"
                ? "Page colors"
                : item.label,
            )}
          </button>
        ))}
      </div>
    </>
  );
  const settingsPanel = (
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
            disabled={externalBusy || saving || uploads > 0}
          >
            {tab === "presets" && (
              <BrochurePresetsTab
                {...props}
                update={updateLibrary}
                selectedId={selectedPresetId}
                facets={facets}
                facetsError={facetsError}
                brands={brands}
                previewProducts={previewProducts}
                onSelect={(id) => {
                  setSelectedPresetId(id);
                  setCaptureOnSave(false);
                }}
              />
            )}
            {tab === "design" && <DesignTab {...props} />}
            {tab === "images" && <ImagesTab {...props} />}
            {tab === "logos" && <LogosTab {...props} brands={brands} />}
            {tab === "brands" && <BrandsTab {...props} brands={brands} />}
            {tab === "stores" && <StoresTab {...props} />}
            {tab === "offers" && (
              <OffersTab {...props} facets={facets} facetsError={facetsError} />
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
  );
  return (
    <div className={`ns-settings ${designScope ? "ns-preset-settings" : ""}`}>
      {!designScope && (
        <header>
          {!designScope && (
            <div>
              <span className="ns-kicker">NEPTUN · WORKSPACE</span>
              <h1>{t("Settings")}</h1>
              <p>
                {t(
                  "Choose the starting defaults for new brochures. Every brochure can be edited separately.",
                )}
              </p>
            </div>
          )}
          {saveActions}
        </header>
      )}
      {error && (
        <div role="alert" className="ns-error">
          <p>{t(error)}</p>
          {onReload && (
            <button
              type="button"
              disabled={externalBusy || saving || uploads > 0}
              onClick={() => {
                clearSettingsDraft(draftKey);
                onReload();
              }}
            >
              {t("Reload saved settings and discard this draft")}
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="ns-success">
          {t(message)}
        </p>
      )}
      {!designScope && navigation}
      <div className="ns-settings-workspace">
        {designScope ? (
          <div className="ns-preset-controls">
            {navigation}
            {settingsPanel}
          </div>
        ) : (
          settingsPanel
        )}
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
      {designScope && <div className="ns-preset-savebar">{saveActions}</div>}
    </div>
  );
}
