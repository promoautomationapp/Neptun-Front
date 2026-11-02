export const workspaceSections = [
  "campaigns",
  "catalog",
  "social",
  "stores",
  "users",
  "activity",
  "insights",
  "profile",
  "editor",
] as const;
export type WorkspaceSection = (typeof workspaceSections)[number];
export interface WorkspaceRoute {
  section: WorkspaceSection | "not-found";
  campaignId: string | null;
  postId: string | null;
  pageIndex: number;
  editorTab: "brochure" | "products";
  commentId: string | null;
}
const empty: WorkspaceRoute = {
  section: "campaigns",
  campaignId: null,
  postId: null,
  pageIndex: 0,
  editorTab: "brochure",
  commentId: null,
};
const identifier = (value: string | null) =>
  value && /^[a-z0-9][a-z0-9._:-]{0,149}$/i.test(value) ? value : null;

/** Navigation contains identifiers only. Access is always checked by the API. */
export function readWorkspaceRoute(
  location: Pick<Location, "pathname" | "search">,
): WorkspaceRoute {
  const params = new URLSearchParams(location.search);
  const campaignId = identifier(params.get("campaign"));
  const postId = identifier(params.get("post"));
  const requested = params.get("section") || "campaigns";
  const invalid =
    location.pathname !== "/" ||
    !workspaceSections.includes(requested as WorkspaceSection) ||
    (params.has("campaign") && !campaignId) ||
    (params.has("post") && !postId) ||
    Boolean(campaignId && postId) ||
    (requested === "editor" && !campaignId);
  if (invalid) return { ...empty, section: "not-found" };
  const page = Number(params.get("page") || 0);
  return {
    section: campaignId
      ? "editor"
      : postId
        ? "social"
        : (requested as WorkspaceSection),
    campaignId,
    postId,
    pageIndex: Number.isInteger(page) && page >= 0 && page <= 200 ? page : 0,
    editorTab: params.get("tab") === "products" ? "products" : "brochure",
    commentId: identifier(params.get("comment")),
  };
}

export function workspaceRouteUrl(
  route: WorkspaceRoute,
  location: Pick<Location, "pathname" | "search" | "hash">,
) {
  if (route.section === "not-found")
    return location.pathname + location.search + location.hash;
  const params = new URLSearchParams(location.search);
  for (const key of ["section", "campaign", "post", "page", "tab", "comment"])
    params.delete(key);
  if (route.section !== "stores") {
    params.delete("settingsArea");
    params.delete("settingsTab");
  }
  if (route.section === "editor" && route.campaignId) {
    params.set("campaign", route.campaignId);
    if (route.pageIndex) params.set("page", String(route.pageIndex));
    params.set("tab", route.editorTab);
    if (route.commentId) params.set("comment", route.commentId);
  } else if (route.section === "social" && route.postId) {
    params.set("post", route.postId);
    if (route.commentId) params.set("comment", route.commentId);
  } else if (route.section !== "campaigns")
    params.set("section", route.section);
  const search = params.toString();
  return `/${search ? `?${search}` : ""}${location.hash}`;
}

export function sameWorkspaceRoute(a: WorkspaceRoute, b: WorkspaceRoute) {
  return (Object.keys(empty) as (keyof WorkspaceRoute)[]).every(
    (key) => a[key] === b[key],
  );
}
