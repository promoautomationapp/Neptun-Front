import { useEffect, useRef, useState } from "react";
import { loadSettings, persistSettings } from "./settings.api";
import type { SettingsSnapshot } from "./settings.api";
import { resolveSettings } from "./settings.schema";
import type { WorkspaceSettings } from "./settings.schema";
import { SettingsEditor } from "./SettingsEditor";
import type { Product } from "../../domain/models";
import { catalogFacets } from "../products/products.api";
import type { CategoryFacet } from "./OffersTab";
import { t } from "../brochure/i18n";
export function SettingsPage({
  initialSnapshot,
  draftKey,
  onSnapshotChange,
  onSaved,
  onDirtyChange,
  onBusyChange,
  previewProducts,
  canViewCatalog = true,
}: {
  initialSnapshot?: SettingsSnapshot | null;
  draftKey?: string;
  onSnapshotChange?: (snapshot: SettingsSnapshot) => void;
  onSaved?: (settings: WorkspaceSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  previewProducts?: Product[];
  canViewCatalog?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(() =>
    initialSnapshot
      ? {
          ...initialSnapshot,
          settings: resolveSettings(initialSnapshot.settings),
        }
      : null,
  );
  const latestSnapshot = useRef(snapshot);
  const pendingRead = useRef<Promise<SettingsSnapshot> | null>(null);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [facets, setFacets] = useState<CategoryFacet[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [facetsError, setFacetsError] = useState("");
  const seed = reload === 0 ? initialSnapshot : null;
  useEffect(() => {
    // The workspace already loaded these versioned defaults. Opening Settings
    // must not wait for a duplicate request, including when bootstrap finishes late.
    if (seed) {
      setError("");
      const next = latestSnapshot.current ?? {
        ...seed,
        settings: resolveSettings(seed.settings),
      };
      latestSnapshot.current = next;
      setSnapshot(next);
      setReloading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setError("");
    setReloading(true);
    const read = loadSettings(controller.signal).then((value) => {
      const next = { ...value, settings: resolveSettings(value.settings) };
      if (active) {
        // Keep the optimistic version current before React commits the new editor.
        latestSnapshot.current = next;
        setSnapshot(next);
        onSnapshotChange?.(next);
      }
      return next;
    });
    pendingRead.current = read;
    void read
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load Settings.",
          );
      })
      .finally(() => {
        if (pendingRead.current === read) pendingRead.current = null;
        if (active) setReloading(false);
      });
    return () => {
      active = false;
      controller.abort();
      if (pendingRead.current === read) pendingRead.current = null;
    };
  }, [reload, seed, onSnapshotChange]);
  useEffect(() => {
    if (!canViewCatalog) {
      setFacets([]);
      setBrands([]);
      setFacetsError("");
      return;
    }
    let active = true;
    void catalogFacets()
      .then((value) => {
        if (active) {
          setFacets([
            ...value.paths,
            ...(value.sourceCategories || []).map((category) => ({
              category: category.path[0] || category.name,
              subcategory:
                category.path.length > 1 ? category.path.at(-1)! : "",
              categoryPath: category.categoryPath,
            })),
          ]);
          setBrands(value.brands);
          setFacetsError("");
        }
      })
      .catch(() => {
        if (active) setFacetsError("Could not load product categories.");
      });
    return () => {
      active = false;
    };
  }, [reload, previewProducts, canViewCatalog]);
  if (error)
    return (
      <div className="ns-settings">
        <p role="alert">{t(error)}</p>
        <button type="button" onClick={() => setReload((value) => value + 1)}>
          {t("Try again")}
        </button>
      </div>
    );
  if (!snapshot?.settings)
    return (
      <div className="ns-settings" role="status">
        {t("Loading Settings…")}
      </div>
    );
  return (
    <SettingsEditor
      previewProducts={previewProducts}
      initial={snapshot.settings}
      draftKey={draftKey}
      draftVersion={snapshot.version}
      externalBusy={reloading}
      onDirtyChange={onDirtyChange}
      onBusyChange={onBusyChange}
      facets={facets}
      brands={brands}
      facetsError={facetsError}
      onReload={() => setReload((value) => value + 1)}
      onSave={async (settings) => {
        const pending = pendingRead.current;
        // An explicitly requested reload discards the previous draft. A queued
        // save therefore uses that refreshed data instead of replaying stale fields.
        const loaded = pending ? await pending : null;
        const base = loaded || latestSnapshot.current || snapshot;
        const saved = await persistSettings(
          loaded ? resolveSettings(loaded.settings) : settings,
          base.version,
        );
        const value = resolveSettings(saved.settings);
        latestSnapshot.current = { ...saved, settings: value };
        setSnapshot(latestSnapshot.current);
        onSnapshotChange?.({ ...saved, settings: value });
        onSaved?.(value);
        return value;
      }}
    />
  );
}
