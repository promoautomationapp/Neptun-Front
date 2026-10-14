import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrochureGridPicker } from "../../src/features/brochure/BrochureGridPicker";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(cleanup);
it("offers a clearly named two-products-per-row choice for any group", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(<BrochureGridPicker value="grid6" onChange={change} />);
  fireEvent.click(view.getByRole("button", { name: /Two products per row/ }));
  expect(change).toHaveBeenCalledWith("duo4");
});
it("shows legacy two-column choices as the selected two-per-row option", () => {
  setLanguage("en");
  const view = render(<BrochureGridPicker value="grid4" onChange={vi.fn()} />);
  expect(
    view
      .getByRole("button", { name: /Two products per row/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});
