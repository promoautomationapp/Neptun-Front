import React from "react";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { CreateCampaign } from "../../src/features/brochure/Modals";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("imports a real CSV before creation and preserves setup when returning from import", async () => {
  setLanguage("en");
  const context: { XLSX?: Window["XLSX"] } & Pick<
    typeof globalThis,
    "ArrayBuffer" | "Uint8Array"
  > = { ArrayBuffer, Uint8Array };
  runInNewContext(
    readFileSync(`${process.cwd()}/public/vendor/xlsx.js`, "utf8"),
    context,
  );
  vi.stubGlobal("XLSX", context.XLSX);
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      catalog={[
        {
          code: "12345",
          name: "TV LED 65ABC",
          subcategory: "TV",
          regular: 999,
          image: "/tv.png",
        },
      ]}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(view.getByLabelText("Campaign name"), {
    target: { value: "Uploaded TVs" },
  });
  const bytes = new TextEncoder().encode("Code,Sale price\n12345,799\n");
  const csv = new Uint8Array(new ArrayBuffer(bytes.length));
  csv.set(bytes);
  const parsed = context.XLSX!.read(csv.buffer, { type: "array" });
  expect(
    context.XLSX!.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]!], {
      header: 1,
      raw: false,
    }),
  ).toEqual([
    ["Code", "Sale price"],
    ["12345", "799"],
  ]);
  const file = new File([csv], "tvs.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => csv.buffer });
  const input = view.container.querySelector<HTMLInputElement>(
    'input[type="file"][accept=".csv,.xlsx,.xls"]',
  );
  if (!input) throw new Error("Campaign setup must show its file input.");
  expect(view.getByRole("dialog", { name: "Create a campaign" })).toBeTruthy();
  expect(input.compareDocumentPosition(view.getByRole("group", { name: "Campaign duration" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(input, { target: { files: [file] } });
  const add = await waitFor(() =>
    view.getByRole("button", { name: /^Add 1 product/ }),
  );
  fireEvent.click(add);
  expect(view.getByDisplayValue("Uploaded TVs")).toBeTruthy();
  expect(view.getByText("1 product ready")).toBeTruthy();
  fireEvent.click(view.getByText("Customize design (optional)"));
  const message = view.getByLabelText("Cover message");
  expect((message as HTMLInputElement).value).toBe("");
  expect(
    (
      view.getByRole("checkbox", {
        name: "Show UUU / hajde! section",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Uploaded TVs",
      tagline: "",
      showCoverMessage: false,
      showCoverBand: false,
      products: [
        expect.objectContaining({
          code: "12345",
          sale: "799",
          image: "/tv.png",
        }),
      ],
    }),
  );
});

it("lets users opt into UUU and add a custom cover message", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByText("Customize design (optional)"));
  fireEvent.change(view.getByLabelText("Cover message"), {
    target: { value: "My message" },
  });
  fireEvent.click(
    view.getByRole("checkbox", { name: "Show UUU / hajde! section" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      tagline: "My message",
      showCoverMessage: true,
      showCoverBand: true,
    }),
  );
});
