import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BrochureImportNotices } from "../../src/features/brochure/BrochureImportNotices";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { BrochureImportWarning, Product } from "../../src/domain/models";
afterEach(cleanup);
const warning: BrochureImportWarning = {
  position: "1.1",
  row: 13,
  code: "PHONE",
  name: "A37 GREEN",
  message: "Check brochure position 1.1: different products share this order.",
};
const products: Product[] = [
  { code: "TV", name: "TV offer", brochurePage: 1, brochureOrder: 1 },
  { code: "PHONE", name: "A37 GREEN", brochurePage: 1, brochureOrder: 1 },
];

it("keeps valid shared-order information collapsed and explains its optional fix without an alert", () => {
  setLanguage("en");
  const view = render(
    <BrochureImportNotices warnings={[warning]} products={products} />,
  );
  const details = view.container.querySelector("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(view.getByText("Import notes"));
  expect(details.open).toBe(true);
  expect(
    view.getByText(
      "These offers share a brochure position. They were kept as separate cards in Excel row order.",
    ),
  ).toBeTruthy();
  expect(
    view.getByText(/Keep this if intended. To change the order/),
  ).toBeTruthy();
  expect(details.textContent).toContain(
    "Excel position 1.1 = page 1, order 1.",
  );
  expect(view.queryByRole("alert")).toBeNull();
  expect(view.container.querySelector("[data-severity=info]")).toBeTruthy();
  expect(details.textContent).not.toContain("⚠");
});

it("does not render the historical A37 note after the phone has moved to another page", () => {
  setLanguage("en");
  const view = render(
    <BrochureImportNotices
      warnings={[warning]}
      products={[
        products[0]!,
        { ...products[1]!, brochurePage: 2, brochureOrder: undefined },
      ]}
    />,
  );
  expect(view.container.childElementCount).toBe(0);
});
