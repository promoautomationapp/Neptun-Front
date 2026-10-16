import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AppearanceProvider,
  AppearanceSettings,
  AppearanceToggle,
  appearanceKey,
} from "../../src/features/appearance/Appearance";
import { setLanguage } from "../../src/features/brochure/i18n";
beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
});
const controls = (
  <>
    <AppearanceToggle />
    <AppearanceSettings />
  </>
);
it("defaults to light until a person chooses dark, regardless of the device's colour preference", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  const view = render(
    <AppearanceProvider userId="staff">{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(
    view
      .getByRole("radio", { name: "Light (default)" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Switch to dark mode" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem(appearanceKey("staff"))).toBe("dark");
  expect(
    view.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(view.getByRole("radio", { name: "Light (default)" }));
  expect(
    view.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeTruthy();
  vi.unstubAllGlobals();
});
it("remembers the choice across reloads and keeps different users' choices separate", () => {
  const view = render(
    <AppearanceProvider userId="staff">{controls}</AppearanceProvider>,
  );
  fireEvent.click(view.getByRole("radio", { name: "Dark" }));
  view.unmount();
  const next = render(
    <AppearanceProvider userId="staff">{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  next.rerender(
    <AppearanceProvider userId="pm">{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  next.rerender(
    <AppearanceProvider userId="staff">{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  next.rerender(<AppearanceProvider>{controls}</AppearanceProvider>);
  expect(document.documentElement.dataset.theme).toBe("light");
});
it("uses the last explicit choice only while checking the session, and syncs the same account across tabs", () => {
  localStorage.setItem("neptun.appearance.last", "dark");
  const view = render(
    <AppearanceProvider loading>{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  view.rerender(
    <AppearanceProvider userId="new-user">{controls}</AppearanceProvider>,
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  localStorage.setItem(appearanceKey("new-user"), "dark");
  fireEvent(
    window,
    new StorageEvent("storage", {
      key: appearanceKey("new-user"),
      newValue: "dark",
    }),
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
});
it("keeps the switch usable in memory when storage is blocked and sends no requests", () => {
  const api = vi.fn();
  vi.stubGlobal("fetch", api);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage unavailable");
  });
  const view = render(
    <AppearanceProvider userId="staff">{controls}</AppearanceProvider>,
  );
  fireEvent.click(view.getByRole("radio", { name: "Dark" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(api).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
