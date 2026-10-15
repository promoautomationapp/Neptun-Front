import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarAccount } from "../../src/features/studio/SidebarAccount";
import { setLanguage } from "../../src/features/brochure/i18n";
beforeEach(() => setLanguage("en"));
afterEach(() => cleanup());
it("separates the signed-in identity, profile and sign-out actions without exposing the email as a long label", () => {
  const profile = vi.fn();
  const view = render(
    <SidebarAccount
      user={{
        name: "Neptun administrator",
        email: "admin@neptun-ks.com",
        role: "admin",
      }}
      onProfile={profile}
      onSignOut={vi.fn()}
    />,
  );
  expect(view.getByText("Neptun administrator")).toBeTruthy();
  expect(view.getByText("Admin")).toBeTruthy();
  expect(view.queryByText("admin@neptun-ks.com")).toBeNull();
  expect(view.queryByText("Support superadmin")).toBeNull();
  expect(view.queryByText("promoautomationapp@gmail.com")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Open profile & security" }),
  );
  expect(profile).toHaveBeenCalledOnce();
  expect(view.getByRole("button", { name: "Sign out" })).toBeTruthy();
});
it("shows the support role only for the account that is signed in", () => {
  const view = render(
    <SidebarAccount
      user={{
        name: "Promo Automation superadmin",
        email: "promoautomationapp@gmail.com",
        role: "superadmin",
      }}
      onProfile={vi.fn()}
      onSignOut={vi.fn()}
    />,
  );
  expect(view.getByText("Support superadmin")).toBeTruthy();
  expect(view.getAllByText("Promo Automation")).toHaveLength(2);
  expect(view.queryByText("promoautomationapp@gmail.com")).toBeNull();
});
it("prevents duplicate sign-outs and restores the action after a failed request", async () => {
  let reject: (reason: Error) => void = () => {};
  const logout = vi.fn(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const view = render(
    <SidebarAccount
      user={{ name: "Staff", email: "staff@example.test", role: "staff" }}
      onProfile={vi.fn()}
      onSignOut={logout}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Sign out" }));
  expect(
    (view.getByRole("button", { name: "Signing out…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Signing out…" }));
  expect(logout).toHaveBeenCalledOnce();
  reject(new Error("offline"));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("Please try again"),
  );
  expect(
    (view.getByRole("button", { name: "Sign out" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
