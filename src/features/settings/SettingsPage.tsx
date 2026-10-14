import { useEffect, useState } from "react";
import { loadSettings, persistSettings } from "./settings.api";
import type { SettingsSnapshot } from "./settings.api";
import { resolveSettings } from "./settings.schema";
import type { WorkspaceSettings } from "./settings.schema";
import { SettingsEditor } from "./SettingsEditor";
import type { Product } from "../../domain/models";
import { catalogFacets } from "../products/products.api";
import type { CategoryFacet } from "./OffersTab";
export function SettingsPage({
  onSaved,
  onDirtyChange,
  onBusyChange,
  previewProducts,
}: {
  onSaved?: (settings: WorkspaceSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  previewProducts?: Product[];
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [facets, setFacets] = useState<CategoryFacet[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [facetsError, setFacetsError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void loadSettings()
      .then((value) => {
        if (active)
          setSnapshot({ ...value, settings: resolveSettings(value.settings) });
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load Settings.",
          );
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    let active = true;
    void catalogFacets()
      .then((value) => {
        if (active) {
          setFacets(value.paths);
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
  }, [reload, previewProducts]);
  if (error)
    return (
      <div className="ns-settings">
        <p role="alert">{error}</p>
        <button type="button" onClick={() => setReload((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  if (!snapshot?.settings)
    return (
      <div className="ns-settings" role="status">
        Loading Settings…
      </div>
    );
  return (
    <SettingsEditor
      previewProducts={previewProducts}
      initial={snapshot.settings}
      onDirtyChange={onDirtyChange}
      onBusyChange={onBusyChange}
      facets={facets}
      brands={brands}
      facetsError={facetsError}
      onReload={() => setReload((value) => value + 1)}
      onSave={async (settings) => {
        const saved = await persistSettings(settings, snapshot.version);
        const value = resolveSettings(saved.settings);
        setSnapshot({ ...saved, settings: value });
        onSaved?.(value);
        return value;
      }}
    />
  );
}
