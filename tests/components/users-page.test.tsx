import { selectSetting } from "../helpers/settings-sections";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UsersPage } from "../../src/features/users/UsersPage";
import type { User } from "../../src/features/auth/auth.api";
import { userSchema } from "../../src/features/auth/auth.api";
import { defaultWorkspaceAccess } from "../../src/features/auth/workspaceAccess";
import { setLanguage } from "../../src/features/brochure/i18n";

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
    access: defaultWorkspaceAccess(),
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

it("saves simple custom switches and searched category branches, then can reset to usual role access", async () => {
  setLanguage("en");
  const api = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/products/facets"))
      return response({
        categories: ["IT"],
        brands: [],
        sourceCategories: [],
        paths: [
          {
            category: "IT",
            subcategory: "Computers",
            brand: "",
            categoryPath: "IT > Computers > Laptops",
          },
        ],
      });
    if (init?.method === "PATCH")
      return response({ user: { ...staff, ...JSON.parse(String(init.body)) } });
    return response({ users: [staff], emailConfigured: true });
  });
  vi.stubGlobal("fetch", api);
  const view = render(<UsersPage currentUser={admin} />);
  fireEvent.click(await view.findByRole("button", { name: "Edit" }));
  expect(
    api.mock.calls.some(([input]) => String(input).includes("facets")),
  ).toBe(false);
  const details = view.container.querySelector(
    "details.na-access-editor",
  ) as HTMLDetailsElement;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  fireEvent.click(view.getByRole("radio", { name: "Custom access" }));
  fireEvent.click(view.getByRole("switch", { name: "Delete brochures" }));
  fireEvent.click(view.getByRole("switch", { name: "View social posts" }));
  fireEvent.click(view.getByRole("radio", { name: "Selected branches" }));
  expect(
    (view.getByRole("button", { name: "Save user" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    await view.findByRole("button", { name: "Add category branch" }),
  );
  fireEvent.change(
    view.getByRole("searchbox", {
      name: "Search categories or subcategories…",
    }),
    { target: { value: "laptop" } },
  );
  fireEvent.click(
    view.getByRole("button", { name: "IT > Computers > Laptops" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Save user" }));
  await waitFor(() =>
    expect(view.queryByRole("button", { name: "Save user" })).toBeNull(),
  );
  const patches = () =>
    api.mock.calls.filter(([, init]) => init?.method === "PATCH");
  expect(JSON.parse(String(patches()[0]?.[1]?.body)).access).toEqual({
    ...defaultWorkspaceAccess(),
    mode: "custom",
    canDisableBrochures: false,
    canViewSocialPosts: false,
    catalogCategoryPaths: ["IT > Computers > Laptops"],
  });
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  const reopened = view.container.querySelector(
    "details.na-access-editor",
  ) as HTMLDetailsElement;
  reopened.open = true;
  fireEvent(reopened, new Event("toggle"));
  fireEvent.click(
    view.getByRole("radio", { name: "Usual access for this role" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Save user" }));
  await waitFor(() => expect(patches()).toHaveLength(2));
  expect(JSON.parse(String(patches()[1]?.[1]?.body)).access).toEqual(
    defaultWorkspaceAccess(),
  );
});

it("restores a verified disabled colleague while email delivery is unavailable", async () => {
  const api = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PATCH"
      ? response({ user: { ...staff, emailVerified: true } })
      : response({
          users: [{ ...staff, status: "disabled", emailVerified: true }],
          emailConfigured: false,
        }),
  );
  vi.stubGlobal("fetch", api);
  const view = render(<UsersPage currentUser={admin} />);
  const button = await view.findByRole("button", { name: "Restore access" });
  expect((button as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(button);
  await view.findByText("User access restored.");
  expect(
    JSON.parse(
      String(
        api.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body,
      ),
    ),
  ).toEqual({ status: "active" });
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
  ).toEqual({
    name: "Updated Staff",
    role: "pm",
    access: defaultWorkspaceAccess(),
  });
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
  setLanguage("en");
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
  const dialog = await view.findByRole("dialog", {
    name: "Cancel invitation?",
  });
  expect(dialog.textContent).toContain("staff@example.test");
  expect(api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(
    false,
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Cancel invitation" }),
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

it("keeps a colleague active when the in-app access confirmation is cancelled", async () => {
  setLanguage("en");
  const native = vi.fn();
  vi.stubGlobal("confirm", native);
  const api = vi.fn(async () =>
    response({ users: [staff], emailConfigured: true }),
  );
  vi.stubGlobal("fetch", api);
  const view = render(<UsersPage currentUser={admin} />);
  fireEvent.click(await view.findByRole("button", { name: "Disable" }));
  const dialog = await view.findByRole("dialog", {
    name: "Disable user access?",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep access" }));
  await waitFor(() =>
    expect(
      view.queryByRole("dialog", { name: "Disable user access?" }),
    ).toBeNull(),
  );
  expect(api.mock.calls).toHaveLength(1);
  expect(native).not.toHaveBeenCalled();
  expect(view.getByText("Team Staff")).toBeTruthy();
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
