import { selectSetting } from "../helpers/settings-sections";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UsersPage } from "../../src/features/users/UsersPage";
import type { User } from "../../src/features/auth/auth.api";
import { userSchema } from "../../src/features/auth/auth.api";

const admin: User = {
  id: "admin",
  email: "admin@example.test",
  name: "Neptun Admin",
  role: "admin",
  permissions: "admin",
  organizationId: "e951c95a-9e9a-48b2-986a-67c3c8a1d916",
  mustChangePassword: false,
  isSupport: false,
};
const staff = {
  id: "staff",
  email: "staff@example.test",
  name: "Team Staff",
  role: "staff",
  status: "active",
  isSupport: false,
  lastLoginAt: null,
};
const support = {
  id: "support",
  email: "support@example.test",
  name: "Platform Support",
  role: "superadmin",
  status: "active",
  isSupport: true,
  lastLoginAt: null,
};
function response(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("hides support accounts from Neptun admins and invites new staff by default", async () => {
  const api = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST")
      return response({
        user: {
          ...staff,
          id: "new",
          email: "new@example.test",
          name: "New Staff",
          status: "invited",
        },
      });
    return response({ users: [staff, support], emailConfigured: true });
  });
  vi.stubGlobal("fetch", api);
  const view = render(<UsersPage currentUser={admin} />);
  await view.findByText("Team Staff");
  expect(view.queryByText("Platform Support")).toBeNull();
  expect(view.queryByText("support@example.test")).toBeNull();
  expect(view.queryByText(/Support superadmin/)).toBeNull();
  expect(view.getByText("Administrators")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "＋ Invite a user" }));
  expect(
    view.getByRole("combobox", { name: "Invitation role" }).textContent,
  ).toContain("Staff");
  fireEvent.change(view.getByLabelText("Full name"), {
    target: { value: "New Staff" },
  });
  fireEvent.change(view.getByLabelText("Work email"), {
    target: { value: "new@example.test" },
  });
  fireEvent.click(view.getByRole("button", { name: "Send invitation" }));
  await view.findByText("new@example.test");
  expect(view.getByText(/Invitation queued for email delivery/)).toBeTruthy();
  const post = api.mock.calls.find(([, init]) => init?.method === "POST");
  expect(String(post?.[0])).toContain("/api/team/users/invite");
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    email: "new@example.test",
    name: "New Staff",
    role: "staff",
  });
  expect(view.queryByLabelText(/password/i)).toBeNull();
});

it("does not request admin data for staff", () => {
  const api = vi.fn();
  vi.stubGlobal("fetch", api);
  const view = render(
    <UsersPage
      currentUser={{ ...admin, role: "staff", permissions: "editor" }}
    />,
  );
  expect(view.getByText(/Only admins/)).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
});

it("keeps invite actions unavailable when email delivery is not configured", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ users: [staff], emailConfigured: false })),
  );
  const view = render(<UsersPage currentUser={admin} />);
  await view.findByText(/New invitations are unavailable/);
  expect(
    view.getByText(/they do not need another email verification/),
  ).toBeTruthy();
  expect(
    (
      view.getByRole("button", {
        name: "＋ Invite a user",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (view.getByRole("button", { name: "Edit" }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

it("edits a colleague through the backend and uses its confirmed result", async () => {
  const api = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH"
      ? response({ user: { ...staff, name: "Updated Staff", role: "pm" } })
      : response({ users: [staff], emailConfigured: true }),
  );
  vi.stubGlobal("fetch", api);
  const membersChanged = vi.fn();
  const view = render(
    <UsersPage currentUser={admin} onMembersChanged={membersChanged} />,
  );
  fireEvent.click(await view.findByRole("button", { name: "Edit" }));
  fireEvent.change(view.getByLabelText("Full name"), {
    target: { value: "Updated Staff" },
  });
  selectSetting(view, "User role", "pm");
  fireEvent.click(view.getByRole("button", { name: "Save user" }));
  await waitFor(() => expect(membersChanged).toHaveBeenCalledTimes(1));
  expect(view.getByText("Updated Staff")).toBeTruthy();
  expect(
    JSON.parse(
      String(
        api.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body,
      ),
    ),
  ).toEqual({ name: "Updated Staff", role: "pm" });
});

it("accepts real admin and support session roles without losing their display metadata", () => {
  expect(userSchema.parse(admin).role).toBe("admin");
  expect(
    userSchema.parse({ ...admin, role: "superadmin", isSupport: true })
      .isSupport,
  ).toBe(true);
});

it("offers a new invitation, rather than restoring unverified cancelled accounts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      response({
        users: [{ ...staff, status: "disabled", emailVerified: false }],
        emailConfigured: true,
      }),
    ),
  );
  const view = render(<UsersPage currentUser={admin} />);
  expect(
    await view.findByRole("button", { name: "Invite again" }),
  ).toBeTruthy();
  expect(view.queryByRole("button", { name: "Restore access" })).toBeNull();
});

it("cancels an invitation through the backend instead of deleting the user", async () => {
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const api = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH"
      ? response({
          user: { ...staff, status: "disabled", emailVerified: false },
        })
      : response({
          users: [{ ...staff, status: "invited", emailVerified: false }],
          emailConfigured: true,
        }),
  );
  vi.stubGlobal("fetch", api);
  const view = render(<UsersPage currentUser={admin} />);
  fireEvent.click(
    await view.findByRole("button", { name: "Cancel invitation" }),
  );
  await view.findByText("Invitation cancelled.");
  expect(
    JSON.parse(
      String(
        api.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body,
      ),
    ),
  ).toEqual({ status: "disabled" });
  expect(api.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(
    false,
  );
});

it("explains that changing a pending role needs a new invitation", async () => {
  const pending = { ...staff, status: "invited", emailVerified: false };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "PATCH"
        ? response({ user: { ...pending, role: "pm" } })
        : response({ users: [pending], emailConfigured: true }),
    ),
  );
  const view = render(<UsersPage currentUser={admin} />);
  fireEvent.click(await view.findByRole("button", { name: "Edit" }));
  selectSetting(view, "User role", "pm");
  fireEvent.click(view.getByRole("button", { name: "Save user" }));
  await view.findByText(/The previous invitation expired; use Resend invite/);
  expect(view.getByRole("button", { name: "Resend invite" })).toBeTruthy();
});

it("lets Promo superadmins view protected support accounts and invite every Neptun role", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      response({ users: [staff, support], emailConfigured: true }),
    ),
  );
  const view = render(
    <UsersPage
      currentUser={{
        ...admin,
        id: "support",
        role: "superadmin",
        isSupport: true,
      }}
    />,
  );
  const row = (await view.findByText("Platform Support")).closest("tr");
  expect(row?.querySelector("button")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "＋ Invite a user" }));
  fireEvent.click(view.getByRole("combobox", { name: "Invitation role" }));
  const choices = view
    .getAllByRole("option")
    .map((option) => option.textContent?.replace("✓", ""));
  expect(choices).toEqual(["Staff", "PM", "Admin"]);
  expect(
    view.getByText(/Existing users do not repeat this process/),
  ).toBeTruthy();
});
