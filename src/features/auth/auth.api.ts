import { z } from "zod";
import { request } from "../../api/client";

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().default(""),
  role: z.enum(["staff", "pm", "admin", "superadmin"]),
  organizationId: z.uuid(),
  permissions: z.enum(["admin", "editor", "reviewer"]),
  mustChangePassword: z.boolean(),
  isSupport: z.boolean().default(false),
  reviewRole: z.enum(["staff", "pm"]).optional(),
});
export type User = z.infer<typeof userSchema>;
const sessionSchema = z.object({
  configured: z.boolean(),
  user: userSchema.nullable(),
});
export const getSession = () => request("/api/team/session", sessionSchema);
export const login = (email: string, password: string) =>
  request("/api/team/login", z.object({ user: userSchema }), {
    method: "POST",
    body: { email, password },
  });
export const logout = () =>
  request("/api/team/logout", z.object({ signedOut: z.boolean() }), {
    method: "POST",
  });
export const changePassword = (currentPassword: string, password: string) =>
  request(
    "/api/team/change-password",
    z.object({
      changed: z.boolean(),
      signInRequired: z.boolean(),
      notificationEmail: z.enum(["sent", "queued", "unavailable"]).optional(),
    }),
    { method: "POST", body: { currentPassword, password } },
  );

export function canManageUsers(user: Pick<User, "role" | "permissions">) {
  return user.role === "admin" || user.role === "superadmin";
}
export function roleLabel(role: User["role"]) {
  return {
    staff: "Staff",
    pm: "PM",
    admin: "Admin",
    superadmin: "Support superadmin",
  }[role];
}
