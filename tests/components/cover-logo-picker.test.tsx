import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoverLogoPicker } from "../../src/features/brochure/CoverLogoPicker";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { setLanguage } from "../../src/features/brochure/i18n";
import { readImage } from "../../src/features/brochure/utils";
import type * as BrochureUtils from "../../src/features/brochure/utils";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { logoRuleDefaults } from "../../src/features/settings/logoLibraryData";

vi.mock("../../src/features/brochure/utils", async (original) => ({
  ...(await original<typeof BrochureUtils>()),
  readImage: vi.fn(),
}));
beforeEach(() => {
  setLanguage("en");
  vi.mocked(readImage).mockResolvedValue("/api/assets/uploaded-cover-logo");
});
afterEach(cleanup);

it("previews saved logos without uploading and applies only the chosen source", () => {
  const settings = resolveSettings(null);
  settings.logoLibrary = [
    { id: "saved", name: "Saved Neptun", url: "/saved.svg" },
  ];
  settings.hiddenBuiltinLogos = [logoRuleDefaults[0]!.id];
  const select = vi.fn(),
    close = vi.fn();
  const view = render(
    <CoverLogoPicker
      settings={settings}
      currentSource="/current.svg"
      onSelect={select}
      onClose={close}
    />,
  );
  expect(
    view.queryByRole("button", {
      name: `Select logo: ${logoRuleDefaults[0]!.name}`,
    }),
  ).toBeNull();
  const selected = view.getByRole("button", {
    name: "Select logo: Saved Neptun",
  });
  fireEvent.click(selected);
  expect(selected.getAttribute("aria-pressed")).toBe("true");
  expect(
    view
      .getAllByAltText("Selected logo")
      .map((image) => image.getAttribute("src")),
  ).toEqual(["/saved.svg", "/saved.svg"]);
  expect(select).not.toHaveBeenCalled();
  expect(readImage).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use this logo" }));
  expect(select).toHaveBeenCalledWith("/saved.svg");
  expect(close).toHaveBeenCalledOnce();
});

it("validates uploads, previews an uploaded logo, then applies it", async () => {
  const select = vi.fn();
  const view = render(
    <React.StrictMode>
      <CoverLogoPicker onSelect={select} onClose={vi.fn()} />
    </React.StrictMode>,
  );
  const input = view.getByLabelText("Upload logo");
  fireEvent.change(input, {
    target: {
      files: [new File(["text"], "notes.txt", { type: "text/plain" })],
    },
  });
  expect(await view.findByRole("alert")).toBeTruthy();
  expect(readImage).not.toHaveBeenCalled();
  const oversized = new File(["image"], "large.png", { type: "image/png" });
  Object.defineProperty(oversized, "size", { value: 12 * 1024 * 1024 + 1 });
  fireEvent.change(input, { target: { files: [oversized] } });
  expect(readImage).not.toHaveBeenCalled();
  const logo = new File(["image"], "new-logo.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [logo] } });
  await waitFor(() =>
    expect(
      view.getAllByAltText("Selected logo")[0]?.getAttribute("src"),
    ).toContain("/api/assets/uploaded-cover-logo"),
  );
  expect(readImage).toHaveBeenCalledExactlyOnceWith(logo);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use this logo" }));
  expect(select).toHaveBeenCalledWith("/api/assets/uploaded-cover-logo");
});

it("keeps the original logo on cancel and handles upload failure without applying", async () => {
  vi.mocked(readImage).mockRejectedValue(new Error("Offline"));
  const select = vi.fn(),
    close = vi.fn();
  const view = render(
    <CoverLogoPicker
      currentSource="/current.svg"
      onSelect={select}
      onClose={close}
    />,
  );
  fireEvent.change(view.getByLabelText("Upload logo"), {
    target: {
      files: [new File(["image"], "new-logo.png", { type: "image/png" })],
    },
  });
  expect(await view.findByRole("alert")).toHaveProperty(
    "textContent",
    "Could not read this image.",
  );
  expect(view.getAllByAltText("Selected logo")[0]?.getAttribute("src")).toBe(
    "/current.svg",
  );
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  expect(select).not.toHaveBeenCalled();
});

it("opens the chooser on Neptun double-click while retaining direct file replacement on drop", () => {
  const choose = vi.fn(),
    replace = vi.fn();
  const view = render(
    <CoverPage
      campaign={{
        id: "cover-logo",
        name: "Autumn offers",
        products: [],
        coverLogoSource: "/neptun.svg",
      }}
      onChooseCoverLogo={choose}
      onReplaceCoverLogo={replace}
    />,
  );
  const logo = view.container.querySelector(".cover-element-logo")!;
  fireEvent.doubleClick(logo);
  expect(choose).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();
  const file = new File(["new"], "neptun.png", { type: "image/png" });
  fireEvent.drop(logo, { dataTransfer: { files: [file], types: ["Files"] } });
  expect(replace).toHaveBeenCalledWith(file);
});
