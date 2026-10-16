import { useEffect, useId, useState } from "react";
import { CategoryTreeSelect } from "../brochure/CategoryTreeSelect";
import { catalogFacets } from "../products/products.api";
import { categoryNodes, categorySegments } from "../settings/categoryHierarchy";
import {
  defaultWorkspaceAccess,
  type WorkspaceAccess,
} from "../auth/workspaceAccess";
import type { EditableRole } from "../../api/users";
import "./workspace-access.css";

const MAX_BRANCHES = 100;
const canonicalPath = (path: string) => categorySegments(path).join(" > ");
const pathKey = (path: string) => canonicalPath(path).toLocaleLowerCase();

/** Selecting a parent replaces its children; a child already covered by a parent adds nothing. */
export function addAccessBranch(
  paths: readonly string[],
  path: string,
): string[] {
  const next = canonicalPath(path);
  if (!next) return [...paths];
  const key = pathKey(next);
  if (
    paths.some(
      (current) =>
        key === pathKey(current) || key.startsWith(`${pathKey(current)} > `),
    )
  )
    return [...paths];
  return [
    ...paths.filter((current) => !pathKey(current).startsWith(`${key} > `)),
    next,
  ];
}

export function workspaceAccessError(access: WorkspaceAccess): string {
  if (access.mode !== "custom" || !access.canViewCatalog) return "";
  if (access.catalogCategoryPaths?.length === 0)
    return "Choose at least one category branch, or allow all categories.";
  if ((access.catalogCategoryPaths?.length || 0) > MAX_BRANCHES)
    return `Choose up to ${MAX_BRANCHES} category branches.`;
  return "";
}

export function WorkspaceAccessEditor({
  role,
  value,
  onChange,
  disabled = false,
}: {
  role: EditableRole;
  value: WorkspaceAccess;
  onChange: (access: WorkspaceAccess) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectionNotice, setSelectionNotice] = useState("");
  const custom = value.mode === "custom";
  const needsCategories =
    role !== "admin" &&
    open &&
    custom &&
    value.canViewCatalog &&
    value.catalogCategoryPaths !== null;
  useEffect(() => {
    if (!needsCategories || paths !== null) return;
    const controller = new AbortController();
    setLoadError("");
    void catalogFacets(controller.signal)
      .then((facets) => {
        if (controller.signal.aborted) return;
        setPaths(
          categoryNodes(
            facets.paths,
            facets.sourceCategories.map((item) => item.categoryPath),
          ).map((node) => node.path),
        );
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Could not load category branches.",
          );
      });
    return () => controller.abort();
  }, [needsCategories, paths, revision]);

  if (role === "admin")
    return (
      <p className="na-access-admin">
        Admins have full workspace access, including all catalog categories.
      </p>
    );

  const selected = value.catalogCategoryPaths;
  const validation = workspaceAccessError(value);
  function update(patch: Partial<WorkspaceAccess>) {
    if (!disabled) onChange({ ...value, ...patch });
  }
  function addBranch(path: string) {
    if (disabled) return;
    const next = addAccessBranch(selected || [], path);
    if (next.length > MAX_BRANCHES) {
      setSelectionNotice(`Choose up to ${MAX_BRANCHES} category branches.`);
      return;
    }
    setSelectionNotice("");
    update({ catalogCategoryPaths: next });
  }
  return (
    <details
      className="na-access-editor"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>Workspace access</strong>
          <small>
            {custom ? "Custom access" : "Usual access for this role"}
          </small>
        </span>
        <span className="na-access-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="na-access-body">
        <div
          className="na-access-segments"
          role="radiogroup"
          aria-label="Workspace access mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!custom}
            disabled={disabled}
            onClick={() => onChange(defaultWorkspaceAccess())}
          >
            Usual access for this role
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            disabled={disabled}
            onClick={() => update({ mode: "custom" })}
          >
            Custom access
          </button>
        </div>
        <p className="na-access-help">
          {custom
            ? "Choose what this colleague can use in the workspace."
            : "Staff and PMs can use the catalog, social posts, and disable brochures. Their role still determines editing and review actions."}
        </p>
        {custom && (
          <>
            <div className="na-access-permissions">
              {(
                [
                  [
                    "canDisableBrochures",
                    "Disable brochures",
                    "Allow this person to disable a brochure without deleting its work.",
                  ],
                  [
                    "canViewSocialPosts",
                    "View social posts",
                    "Show the social posts area and its existing content.",
                  ],
                  [
                    "canViewCatalog",
                    "View product catalog",
                    "Allow searching and choosing products from the catalog.",
                  ],
                ] as const
              ).map(([key, label, description]) => (
                <div className="na-access-permission" key={key}>
                  <div>
                    <label id={`${id}-${key}`} htmlFor={`${id}-${key}-switch`}>
                      {label}
                    </label>
                    <small id={`${id}-${key}-help`}>{description}</small>
                  </div>
                  <button
                    id={`${id}-${key}-switch`}
                    className="na-access-switch"
                    type="button"
                    role="switch"
                    aria-labelledby={`${id}-${key}`}
                    aria-describedby={`${id}-${key}-help`}
                    aria-checked={value[key]}
                    disabled={disabled}
                    onClick={() =>
                      update({
                        [key]: !value[key],
                        ...(key === "canViewCatalog" &&
                        value[key] &&
                        selected?.length === 0
                          ? { catalogCategoryPaths: null }
                          : {}),
                      })
                    }
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
            {value.canViewCatalog && (
              <section
                className="na-access-categories"
                aria-labelledby={`${id}-categories`}
              >
                <h3 id={`${id}-categories`}>Catalog categories</h3>
                <div
                  className="na-access-segments"
                  role="radiogroup"
                  aria-label="Catalog category scope"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected === null}
                    disabled={disabled}
                    onClick={() => update({ catalogCategoryPaths: null })}
                  >
                    All categories
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected !== null}
                    disabled={disabled}
                    onClick={() =>
                      update({ catalogCategoryPaths: selected || [] })
                    }
                  >
                    Selected branches
                  </button>
                </div>
                {selected !== null && (
                  <>
                    <p className="na-access-help">
                      A branch includes every category below it. Choose up to{" "}
                      {MAX_BRANCHES} branches.
                    </p>
                    {selected.length > 0 && (
                      <ul
                        className="na-access-branches"
                        aria-label="Allowed category branches"
                      >
                        {selected.map((path) => (
                          <li key={path}>
                            <span>{path}</span>
                            <button
                              type="button"
                              disabled={disabled}
                              aria-label={`Remove category branch: ${path}`}
                              onClick={() =>
                                update({
                                  catalogCategoryPaths: selected.filter(
                                    (current) => current !== path,
                                  ),
                                })
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {paths === null ? (
                      loadError ? (
                        <div className="na-access-load-error" role="status">
                          <span>Category branches could not be loaded.</span>
                          <button
                            type="button"
                            className="cs-button"
                            disabled={disabled}
                            onClick={() =>
                              setRevision((current) => current + 1)
                            }
                          >
                            Retry categories
                          </button>
                        </div>
                      ) : (
                        <p className="na-access-help" role="status">
                          Loading category branches…
                        </p>
                      )
                    ) : paths.length ? (
                      !disabled && (
                        <CategoryTreeSelect
                          catalog={[]}
                          sourcePaths={paths}
                          category=""
                          subcategory=""
                          categoryPath=""
                          onChange={() => {}}
                          onPathChange={addBranch}
                          label="Add category branch"
                          placeholder="Choose a branch…"
                          includeAll={false}
                          showCounts={false}
                        />
                      )
                    ) : (
                      <p className="na-access-help" role="status">
                        No category branches are available yet. You can allow
                        all categories or turn off catalog access.
                      </p>
                    )}
                    {validation && (
                      <p className="na-access-validation" role="status">
                        {validation}
                      </p>
                    )}
                    {selectionNotice && (
                      <p className="na-access-validation" role="status">
                        {selectionNotice}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}
        <p className="na-access-shared-note">
          These controls affect the catalog and workspace tools. Existing shared
          campaigns and brochures remain visible.
        </p>
      </div>
    </details>
  );
}
