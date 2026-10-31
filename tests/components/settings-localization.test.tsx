import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  Field,
  Toggle,
  SettingsGroup,
  AssetPicker,
} from "../../src/features/settings/components";
import { setLanguage, t } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("translates settings helpers and their accessible labels while retaining user names and values", () => {
  setLanguage("sq");
  const view = render(
    <>
      <Field label="Cover" hint="Comments">
        <input defaultValue="Samsung custom product" />
      </Field>
      <Toggle label="Comments" checked onChange={vi.fn()} />
      <SettingsGroup title="Brochure preview">
        <span>Saved data</span>
      </SettingsGroup>
      <AssetPicker
        label="Cover"
        value=""
        emptyLabel="All categories"
        defaultHint="Comments"
        library={[
          {
            id: "user-logo",
            name: "My custom Samsung logo",
            url: "/api/assets/user-logo",
          },
        ]}
        onChange={vi.fn()}
        onUpload={vi.fn()}
      />
    </>,
  );
  expect(t("Cover")).not.toBe("Cover");
  expect(
    (view.getByRole("textbox", { name: t("Cover") }) as HTMLInputElement).value,
  ).toBe("Samsung custom product");
  expect(view.getByRole("checkbox", { name: t("Comments") })).toBeTruthy();
  expect(
    view.getByText(t("Brochure preview"), { selector: "summary" }),
  ).toBeTruthy();
  expect(view.getByRole("combobox", { name: t("Cover") })).toBeTruthy();
  expect(
    view.container.querySelector('option[value="/api/assets/user-logo"]')
      ?.textContent,
  ).toBe("My custom Samsung logo");
  expect(view.getByLabelText(`${t("Upload")} ${t("Cover")}`)).toBeTruthy();
});
