import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  within,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActionMenu } from "../../src/features/brochure/ActionMenu";
import { BrochurePreview } from "../../src/features/brochure/BrochurePreview";
import { BrochureFooter } from "../../src/features/brochure/Brochure";
import { PhotoPreparationProgress } from "../../src/features/brochure/PhotoPreparationProgress";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { splitPages } from "../../src/features/brochure/campaignPages";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("dismisses action menus outside, on Escape and after an action", () => {
  const action = vi.fn();
  const view = render(
    <>
      <ActionMenu label="More actions">
        <button onClick={action}>Print</button>
      </ActionMenu>
      <button>Outside</button>
    </>,
  );
  const menu = view.container.querySelector("details")!;
  const open = () => {
    menu.open = true;
    fireEvent(menu, new Event("toggle"));
  };
  open();
  fireEvent.pointerDown(view.getByRole("button", { name: "Outside" }));
  expect(menu.open).toBe(false);
  open();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(menu.open).toBe(false);
  expect(document.activeElement).toBe(menu.querySelector("summary"));
  open();
  fireEvent.click(view.getByRole("button", { name: "Print" }));
  expect(menu.open).toBe(false);
  expect(action).toHaveBeenCalledOnce();
});

it("browses the full brochure with thumbnails and keyboard arrows, and exports the current page", () => {
  const onExport = vi.fn(),
    close = vi.fn();
  const campaign: Campaign = {
    id: "browse",
    name: "Offers",
    includeStoresPage: false,
    products: [
      { code: "one", name: "Cover offer", brochurePage: 1 },
      { code: "two", name: "Page offer", brochurePage: 2 },
      { code: "three", name: "Last offer", brochurePage: 3 },
    ],
  };
  function Preview() {
    const [selected, select] = React.useState(-1);
    return (
      <BrochurePreview
        campaign={campaign}
        settings={resolveSettings(null)}
        selected={selected}
        onSelect={select}
        onClose={close}
        onExport={onExport}
      />
    );
  }
  const view = render(<Preview />);
  const dialog = view.getByRole("dialog", { name: "Brochure preview" });
  const thumbs = within(
    view.getByRole("navigation", { name: "Brochure pages" }),
  );
  expect(thumbs.getAllByRole("button")).toHaveLength(3);
  expect(thumbs.queryByRole("button", { name: "Stores & details" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  expect(
    thumbs.getByRole("button", { name: "Page 2" }).getAttribute("aria-current"),
  ).toBe("page");
  fireEvent.keyDown(dialog, { key: "End" });
  expect(
    (view.getByRole("button", { name: "Next page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(thumbs.getByRole("button", { name: "Cover" }));
  expect(
    (view.getByRole("button", { name: "Previous page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: /Download brochure/ }),
  );
  expect(onExport).toHaveBeenCalledWith(1);
  expect(close).toHaveBeenCalledOnce();
});

it("edits both footer texts and defaults to a 3px inset and closer payment text", () => {
  const onTextChange = vi.fn();
  const campaign: Campaign = {
    id: "footer",
    name: "Offers",
    products: [],
    startDate: "2026-10-24",
    endDate: "2026-10-31",
  };
  const view = render(
    <BrochureFooter campaign={campaign} onTextChange={onTextChange} />,
  );
  const frame = view.container.querySelector<HTMLElement>(
    ".brochure-footer-element",
  )!;
  expect(parseFloat(frame.style.top)).toBeCloseTo(100 - 4 - 3 / 13.5);
  expect(
    view.container.querySelector<HTMLElement>(".brochure-offer-footer")!.style
      .gridTemplateColumns,
  ).toBe("34% 1fr 20%");
  const dates = view.getByRole("textbox", { name: "Brochure dates text" });
  dates.textContent = "Custom offer dates";
  fireEvent.blur(dates);
  const payment = view.getByRole("textbox", { name: "Footer payment text" });
  payment.textContent = "6 installments";
  fireEvent.blur(payment);
  expect(onTextChange.mock.calls).toEqual([
    ["dateText", "Custom offer dates"],
    ["paymentText", "6 installments"],
  ]);
  expect(campaignDefaults(resolveSettings(null)).showFooterPageNumber).toBe(
    false,
  );
  expect(
    splitPages({
      ...campaign,
      products: [{ code: "one", name: "Offer", brochurePage: 2 }],
    })[0]!.showFooterPageNumber,
  ).toBe(false);
});

it("hides successful preparation after four seconds and keeps failures actionable", () => {
  vi.useFakeTimers();
  const campaign: Campaign = { id: "photos", name: "Offers", products: [] };
  const view = render(
    <PhotoPreparationProgress
      items={[{ key: "one", code: "one", name: "TV", state: "ready" }]}
      campaign={campaign}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  expect(view.getByText("Product photos are ready")).toBeTruthy();
  act(() => vi.advanceTimersByTime(4100));
  expect(view.queryByText("Product photos are ready")).toBeNull();
  view.rerender(
    <PhotoPreparationProgress
      items={[{ key: "one", code: "one", name: "TV", state: "failed" }]}
      campaign={campaign}
      onRetry={vi.fn()}
      onEdit={vi.fn()}
    />,
  );
  act(() => vi.advanceTimersByTime(5000));
  expect(
    view.getByRole("button", { name: "Retry failed photos" }),
  ).toBeTruthy();
});
