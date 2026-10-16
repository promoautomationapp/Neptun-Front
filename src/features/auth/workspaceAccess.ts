import { z } from "zod";
export const workspaceAccessSchema = z.object({
  mode: z.enum(["default", "custom"]),
  canDisableBrochures: z.boolean(),
  canViewSocialPosts: z.boolean(),
  canViewCatalog: z.boolean(),
  catalogCategoryPaths: z
    .array(z.string().min(1).max(1000))
    .max(100)
    .nullable(),
});
export type WorkspaceAccess = z.infer<typeof workspaceAccessSchema>;
export function defaultWorkspaceAccess(): WorkspaceAccess {
  return {
    mode: "default",
    canDisableBrochures: true,
    canViewSocialPosts: true,
    canViewCatalog: true,
    catalogCategoryPaths: null,
  };
}
export function effectiveWorkspaceAccess(user: {
  role: string;
  access?: WorkspaceAccess | null;
}): WorkspaceAccess {
  return user.role === "admin" ||
    user.role === "superadmin" ||
    !user.access ||
    user.access.mode === "default"
    ? defaultWorkspaceAccess()
    : user.access;
}
export function catalogPathAllowed(
  path: string,
  access: WorkspaceAccess,
  includeAncestors = false,
) {
  if (!access.canViewCatalog) return false;
  if (access.catalogCategoryPaths === null) return true;
  const canonical = (value: string) =>
    value
      .normalize("NFC")
      .toLocaleLowerCase()
      .split(/\s*(?:>|›)\s*/)
      .map((part) => part.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .join(" > ");
  const normalized = canonical(path);
  return access.catalogCategoryPaths.some(
    (branch) =>
      normalized === canonical(branch) ||
      normalized.startsWith(canonical(branch) + " > ") ||
      (includeAncestors && canonical(branch).startsWith(normalized + " > ")),
  );
}
