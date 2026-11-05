import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  BrochurePagination,
  revealPageThumbnail,
} from "../../src/features/brochure/BrochurePagination";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(["horizontal", "vertical"] as const)(
  "reveals a selected thumbnail by moving only its %s strip",
  (orientation) => {
    const ancestor = document.createElement("section");
    const strip = document.createElement("nav");
    const active = document.createElement("button");
    active.setAttribute("aria-current", "page");
    strip.append(active);
    ancestor.append(strip);
    document.body.append(ancestor);
    const horizontal = orientation === "horizontal";
    Object.defineProperties(strip, {
      clientWidth: { value: 200 },
      scrollWidth: { value: horizontal ? 800 : 200 },
      clientHeight: { value: 100 },
      scrollHeight: { value: horizontal ? 100 : 800 },
    });
    strip.scrollLeft = 25;
    strip.scrollTop = 35;
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 30, 200, 100),
    );
    vi.spyOn(active, "getBoundingClientRect").mockReturnValue(
      horizontal ? new DOMRect(350, 40, 60, 60) : new DOMRect(30, 300, 60, 60),
    );
    const scrollStrip = vi.fn();
    strip.scrollTo = scrollStrip;
    ancestor.scrollTo = vi.fn();
    active.scrollIntoView = vi.fn();
    const scrollWindow = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => {});

    revealPageThumbnail(strip);

    expect(scrollStrip).toHaveBeenCalledOnce();
    const target = scrollStrip.mock.calls[0]![0] as ScrollToOptions;
    if (horizontal) {
      expect(target.left).toBeGreaterThan(strip.scrollLeft);
      expect(target.top).toBe(strip.scrollTop);
    } else {
      expect(target.top).toBeGreaterThan(strip.scrollTop);
      expect(target.left).toBe(strip.scrollLeft);
    }
    expect(ancestor.scrollTo).not.toHaveBeenCalled();
    expect(active.scrollIntoView).not.toHaveBeenCalled();
    expect(scrollWindow).not.toHaveBeenCalled();
    ancestor.remove();
  },
);

it("skips excluded stores with arrows while allowing them through the explicit page picker", () => {
  const pages = [
    { index: -1, label: "Cover" },
    { index: 0, label: "Page 2" },
    { index: 1, label: "Stores & details", excluded: true },
  ];
  const select = vi.fn();
  const view = render(
    <BrochurePagination pages={pages} selected={0} onSelect={select} />,
  );
  const picker = view.getByRole("combobox", { name: "Go to page" });
  expect(
    within(picker).getByRole("option", {
      name: "Stores & details · Not included",
    }),
  ).toBeTruthy();
  expect(view.getByRole("button", { name: "Next page" })).toHaveProperty(
    "disabled",
    true,
  );
  fireEvent.click(view.getByRole("button", { name: "Previous page" }));
  expect(select).toHaveBeenLastCalledWith(-1);
  fireEvent.change(picker, { target: { value: "1" } });
  expect(select).toHaveBeenLastCalledWith(1);
  view.rerender(
    <BrochurePagination pages={pages} selected={1} onSelect={select} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Previous page" }));
  expect(select).toHaveBeenLastCalledWith(0);
  expect(view.getByRole("button", { name: "Next page" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("keeps its page navigation accessible and excluded from artwork exports", () => {
  const select = vi.fn();
  const view = render(
    <BrochurePagination
      pages={[
        { index: -1, label: "Cover" },
        { index: 0, label: "Page 2" },
      ]}
      selected={-1}
      onSelect={select}
    />,
  );
  const navigation = view.getByRole("navigation", { name: "Page navigation" });
  expect(navigation.getAttribute("data-export-hide")).toBe("true");
  expect(navigation.getAttribute("aria-label")).toBe("Page navigation");
  const picker = within(navigation).getByRole("combobox", {
    name: "Go to page",
  });
  expect((picker as HTMLSelectElement).value).toBe("-1");
  expect(navigation.textContent).toContain("Cover");
  fireEvent.click(
    within(navigation).getByRole("button", { name: "Next page" }),
  );
  expect(select).toHaveBeenCalledWith(0);
});
