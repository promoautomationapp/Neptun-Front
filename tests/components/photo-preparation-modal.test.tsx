import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhotoPreparationModal } from "../../src/features/brochure/PhotoPreparationModal";
import type { PhotoProgressItem } from "../../src/features/brochure/PhotoPreparationProgress";
import type { Campaign } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";

const campaign: Campaign = {
  id: "preparation-modal",
  name: "New offers",
  products: [
    { code: "one", name: "Television", image: "/uncut-source.png" },
    {
      code: "two",
      name: "Phone",
      imageSearch: {
        status: "searching",
        requestKey: "phone",
        requestId: "search-phone",
      },
    },
  ],
};
const items: PhotoProgressItem[] = [
  { key: "ready", code: "ready", name: "Prepared product", state: "ready" },
  { key: "queue", code: "queue", name: "Queued product", state: "queued" },
  {
    key: "retry",
    code: "retry",
    name: "Retry product",
    state: "retrying",
    retryAttempt: 2,
    retryLimit: 3,
  },
  { key: "save", code: "save", name: "Saved product", state: "saving" },
];
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});
const dialogMethods = ["showModal", "close"] as const;
const originalMethods = dialogMethods.map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
    ] as const,
);
beforeEach(() => {
  setLanguage("en");
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: close,
  });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of originalMethods) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.body.style.overflow = "";
  setLanguage("sq");
});

it("blocks dismissal while AI work and searches run, with real saving/retry progress and no brochure artwork", () => {
  const retry = vi.fn(),
    returnToProducts = vi.fn();
  const view = render(
    <PhotoPreparationModal
      campaign={campaign}
      items={items}
      busy
      onRetry={retry}
      onReturnToProducts={returnToProducts}
    />,
  );
  const dialog = view.getByRole("dialog", {
    name: "Retrying some product photos…",
  });
  expect(dialog.parentElement).toBe(document.body);
  expect(showModal).toHaveBeenCalledOnce();
  expect(document.body.style.overflow).toBe("hidden");
  expect(view.getByText("20%")).toBeTruthy();
  const progress = view.getByRole("progressbar") as HTMLProgressElement;
  expect(progress.value).toBe(1);
  expect(progress.max).toBe(5);
  expect(
    view.getByText(/1 \/ 5 ready · 1 waiting · 1 Searching for product photos/),
  ).toBeTruthy();
  expect(view.getByText("Retrying photo · 2/3")).toBeTruthy();
  expect(view.getByText("Saving photo…")).toBeTruthy();
  expect(view.getByText("Searching for the exact product photo…")).toBeTruthy();
  expect(within(dialog).queryAllByRole("button")).toHaveLength(0);
  expect(
    dialog.querySelector("img,.brochure-page,.cs-preview-paper"),
  ).toBeNull();
  const cancel = new Event("cancel", { bubbles: true, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.mouseDown(dialog);
  fireEvent.click(dialog);
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(retry).not.toHaveBeenCalled();
  expect(returnToProducts).not.toHaveBeenCalled();
});

it("keeps failed/original photos out of ready totals and exposes retry, close and manual repair after work settles", () => {
  const retry = vi.fn(),
    returnToProducts = vi.fn();
  const view = render(
    <PhotoPreparationModal
      campaign={{ ...campaign, products: [campaign.products[0]!] }}
      items={[
        items[0]!,
        { key: "original", code: "one", name: "Television", state: "original" },
      ]}
      busy={false}
      error="The photo could not be prepared."
      onRetry={retry}
      onReturnToProducts={returnToProducts}
    />,
  );
  const dialog = view.getByRole("dialog", {
    name: "Photo preparation needs attention",
  });
  expect(view.getByText("50%")).toBeTruthy();
  expect(
    view.getByText("Original photo — background removal incomplete"),
  ).toBeTruthy();
  expect(view.getByRole("alert").textContent).toBe(
    "The photo could not be prepared.",
  );
  expect(view.queryByText("Product photos are ready")).toBeNull();
  expect(view.getByRole("button", { name: "Close" })).toBeTruthy();
  const cancel = new Event("cancel", { bubbles: true, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(returnToProducts).toHaveBeenCalledOnce();
  returnToProducts.mockClear();
  fireEvent.click(view.getByRole("button", { name: "Retry failed photos" }));
  expect(retry).toHaveBeenCalledOnce();
  fireEvent.click(view.getByRole("button", { name: "Close" }));
  expect(returnToProducts).toHaveBeenCalledOnce();
  fireEvent.click(
    view.getByRole("button", { name: "Close and upload photos" }),
  );
  expect(returnToProducts).toHaveBeenCalledTimes(2);
});

it("reveals dismissal after a missing-photo search finishes and lets Escape return to manual upload", () => {
  const retry = vi.fn(),
    returnToProducts = vi.fn();
  const props = {
    campaign,
    items: [],
    onRetry: retry,
    onReturnToProducts: returnToProducts,
  };
  const view = render(<PhotoPreparationModal {...props} busy />);
  const pending = view.getByRole("dialog", {
    name: "Preparing product photos…",
  });
  expect(view.queryByRole("button", { name: "Close" })).toBeNull();
  expect(
    view.queryByRole("button", { name: "Close and upload photos" }),
  ).toBeNull();
  fireEvent.keyDown(pending, { key: "Escape" });
  expect(returnToProducts).not.toHaveBeenCalled();

  const missing: Campaign = {
    ...campaign,
    products: [
      {
        ...campaign.products[1]!,
        imageSearch: {
          status: "not_found",
          requestKey: "phone",
          requestId: "search-phone",
          message: "No exact photo",
        },
      },
    ],
  };
  view.rerender(
    <PhotoPreparationModal {...props} campaign={missing} busy={false} />,
  );
  const settled = view.getByRole("dialog", {
    name: "Photo preparation needs attention",
  });
  expect(view.getByText("Exact product photo not found")).toBeTruthy();
  expect(
    view.getByText(
      "Processing has finished. You can retry the unfinished photos or close this window and upload them manually in Products & prices.",
    ),
  ).toBeTruthy();
  expect(view.getByRole("button", { name: "Close" })).toBeTruthy();
  expect(
    view.getByRole("button", { name: "Close and upload photos" }),
  ).toBeTruthy();
  fireEvent.keyDown(settled, { key: "Escape" });
  expect(returnToProducts).toHaveBeenCalledOnce();
  expect(retry).not.toHaveBeenCalled();
});

it("stays indeterminate before work is known and restores focus and scrolling when the parent releases it", () => {
  const trigger = document.createElement("button");
  trigger.textContent = "Create brochure";
  document.body.append(trigger);
  trigger.focus();
  document.body.style.overflow = "auto";
  const view = render(
    <PhotoPreparationModal
      campaign={{ ...campaign, products: [] }}
      items={[]}
      busy
      onRetry={vi.fn()}
      onReturnToProducts={vi.fn()}
    />,
  );
  expect(
    (view.getByRole("progressbar") as HTMLProgressElement).hasAttribute(
      "value",
    ),
  ).toBe(false);
  expect(view.getByText("Starting photo preparation…")).toBeTruthy();
  view.unmount();
  expect(document.body.style.overflow).toBe("auto");
  expect(document.activeElement).toBe(trigger);
  expect(close).toHaveBeenCalledOnce();
  trigger.remove();
});
