import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrochurePageNavigator } from "../../src/features/brochure/BrochurePageNavigator";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const campaign: Campaign = {
  id: "navigation",
  name: "Offers",
  includeStoresPage: false,
  products: [
    {
      code: "phone",
      name: "Phone",
      image: "/api/assets/phone.png",
      sale: 299,
      regular: 399,
    },
  ],
};
const pages = [{ index: 0, products: campaign.products }];
function fixture(selected = -1) {
  const select = vi.fn(),
    drop = vi.fn(),
    over = vi.fn();
  const view = render(
    <BrochurePageNavigator
      campaign={campaign}
      pages={pages}
      selected={selected}
      onSelect={select}
      draggingCode="phone"
      overPage={null}
      onOverPage={over}
      onDropPage={drop}
    />,
  );
  return { ...view, select, drop, over };
}
it("shows compact page images, a selected page, and an explicit excluded stores page", () => {
  const view = fixture();
  const nav = within(view.getByRole("navigation", { name: "Brochure pages" }));
  expect(
    nav.getByRole("button", { name: "Cover" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(
    nav
      .getByRole("button", { name: "Page 2" })
      .querySelector("img")
      ?.getAttribute("src"),
  ).toContain("/api/assets/phone.png");
  expect(
    nav.getByRole("button", { name: "Stores & details · Not included" }),
  ).toBeTruthy();
  expect(
    view
      .getByRole("button", { name: "Previous page" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Next page" }));
  expect(view.select).toHaveBeenLastCalledWith(0);
});
it("supports keyboard navigation and product drops while keeping stores out of product drop targets", () => {
  const view = fixture(0);
  const nav = view.getByRole("navigation", { name: "Brochure pages" });
  fireEvent.keyDown(nav, { key: "Home" });
  expect(view.select).toHaveBeenLastCalledWith(-1);
  fireEvent.keyDown(nav, { key: "End" });
  expect(view.select).toHaveBeenLastCalledWith(1);
  const cover = within(nav).getByRole("button", { name: "Cover" });
  fireEvent.dragOver(cover);
  expect(view.over).toHaveBeenLastCalledWith(-1);
  fireEvent.drop(cover);
  expect(view.drop).toHaveBeenCalledWith(-1, expect.anything());
  view.drop.mockClear();
  fireEvent.drop(
    within(nav).getByRole("button", {
      name: "Stores & details · Not included",
    }),
  );
  expect(view.drop).not.toHaveBeenCalled();
});
