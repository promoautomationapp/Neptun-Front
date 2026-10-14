import { z } from "zod";
import { request } from "./client";

export const managedUserSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: z.enum(["staff", "pm", "admin", "superadmin"]),
  status: z.enum(["active", "invited", "disabled"]),
  isSupport: z.boolean(),
  emailVerified: z.boolean().default(false),
  invitedAt: z.string().nullable().optional(),
  lastLoginAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type EditableRole = "staff" | "pm" | "admin";
const userResult = z.object({ user: managedUserSchema });
export const listUsers = (signal?: AbortSignal) =>
  request(
    "/api/team/users",
    z.object({
      users: z.array(managedUserSchema),
      emailConfigured: z.boolean(),
    }),
    { signal },
  );
export const inviteUser = (input: {
  email: string;
  name: string;
  role: EditableRole;
}) =>
  request("/api/team/users/invite", userResult, {
    method: "POST",
    body: input,
  });
export const updateUser = (
  id: string,
  input: { name?: string; role?: EditableRole; status?: "active" | "disabled" },
) =>
  request(`/api/team/users/${encodeURIComponent(id)}`, userResult, {
    method: "PATCH",
    body: input,
  });
export const resendInvitation = (id: string) =>
  request(
    `/api/team/users/${encodeURIComponent(id)}/resend-invite`,
    userResult,
    { method: "POST" },
  );

export const accountTokenSchema = z.object({
  purpose: z.enum(["invite", "password-reset"]),
  email: z.email(),
  name: z.string(),
  expiresAt: z.string(),
  codeSent: z.boolean(),
});
export const getAccountToken = (token: string, signal?: AbortSignal) =>
  request(
    `/api/team/account-token?token=${encodeURIComponent(token)}`,
    accountTokenSchema,
    { signal },
  );
export const acceptInvitation = (token: string, password: string) =>
  request("/api/team/accept-invitation", z.object({ codeSent: z.boolean() }), {
    method: "POST",
    body: { token, password },
  });
export const verifyInvitation = (token: string, code: string) =>
  request(
    "/api/team/verify-invitation",
    z.object({ activated: z.boolean(), signInRequired: z.boolean() }),
    { method: "POST", body: { token, code } },
  );
export const forgotPassword = (email: string) =>
  request("/api/team/forgot-password", z.object({ message: z.string() }), {
    method: "POST",
    body: { email },
  });
export const requestInvitationCode = (token: string) =>
  request(
    "/api/team/request-invitation-code",
    z.object({ codeSent: z.boolean() }),
    { method: "POST", body: { token } },
  );
export const requestResetCode = (token: string) =>
  request("/api/team/request-reset-code", z.object({ codeSent: z.boolean() }), {
    method: "POST",
    body: { token },
  });
export const resetPassword = (token: string, code: string, password: string) =>
  request(
    "/api/team/reset-password",
    z.object({ changed: z.boolean(), signInRequired: z.boolean() }),
    { method: "POST", body: { token, code, password } },
  );
