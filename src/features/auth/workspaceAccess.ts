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
export function catalogPathAllowed(path: string, access: WorkspaceAccess) {
  if (!access.canViewCatalog) return false;
  if (access.catalogCategoryPaths === null) return true;
  const normalized = path.toLocaleLowerCase().trim();
  return access.catalogCategoryPaths.some(
    (branch) =>
      normalized === branch.toLocaleLowerCase().trim() ||
      normalized.startsWith(branch.toLocaleLowerCase().trim() + " > "),
  );
}
