import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { apiFetch } from "../../src/api/client";
import { confirmDialog, promptDialog } from "../../src/components/dialogs";
import { mountWorkspace } from "../../src/features/classic/workspace";

vi.mock("../../src/api/client", () => ({
  apiFetch: vi.fn(async () => new Response(JSON.stringify({ campaigns: [] }))),
}));
vi.mock("../../src/components/dialogs", () => ({
  confirmDialog: vi.fn(),
  promptDialog: vi.fn(),
}));

type ClassicFixture = ReturnType<typeof campaign>;
const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

function campaign(id: string) {
  return {
    id,
    name: id === "first" ? "First campaign" : "Second campaign",
    template: "classic",
    month: 1,
    updated: "2026-01-01T00:00:00Z",
    dates: "",
    category: "TV",
    products: [
      {
        id: "same-product-id",
        code: "TV-1",
        name: `TV ${id}`,
        brand: "BEKO",
        specs: "4K",
        regular: 499,
        price: 399,
        warranty: 2,
        months: 12,
        category: "TV",
        included: true,
        approved: false,
      },
    ],
  };
}

function request<T>(result: T) {
  const pending: { result: T; onsuccess: (() => void) | null } = {
    result,
    onsuccess: null,
  };
  queueMicrotask(() => pending.onsuccess?.());
  return pending;
}

async function settle() {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
}

async function fixture(language: "en" | "sq" = "en") {
  const stored = new Map(
    [campaign("first"), campaign("second")].map((item) => [item.id, item]),
  );
  const database = {
    transaction: () => {
      const transaction: {
        oncomplete: (() => void) | null;
        objectStore: () => {
          getAll: () => ReturnType<typeof request<ClassicFixture[]>>;
          put: (value: ClassicFixture) => void;
        };
      } = {
        oncomplete: null,
        objectStore: () => ({
          getAll: () => request(structuredClone([...stored.values()])),
          put: (value) => {
            stored.set(value.id, structuredClone(value));
            queueMicrotask(() => transaction.oncomplete?.());
          },
        }),
      };
      return transaction;
    },
  };
  vi.stubGlobal("indexedDB", { open: () => request(database) });
  vi.stubGlobal("XLSX", {});
  vi.stubGlobal("neptunLanguage", { get: () => language });
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  document.body.innerHTML = `<section id="studio"></section><div class="studio-top"><b></b><span></span></div><div id="save-indicator"></div><div id="workspace"></div><div id="library"></div><div class="studio-foot"><span id="status"></span><span></span></div><section id="workflow"><button id="workflow-toggle"></button><div id="workflow-panel"></div><span id="workflow-kicker"></span><span id="workflow-title"></span><span id="workflow-copy"></span><span id="workflow-metric"></span><button id="workflow-open"></button></section>`;
  mountWorkspace();
  await settle();
  return stored;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  vi.clearAllMocks();
  sessionStorage.removeItem("neptun-shared-token");
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  const addListener = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    (type, listener, options) => {
      if (listener) listeners.push([type, listener]);
      addListener(type, listener, options);
    },
  );
});
afterEach(async () => {
  await settle();
  for (const [type, listener] of listeners.splice(0))
    window.removeEventListener(type, listener);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalScrollIntoView)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoView,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  vi.unstubAllGlobals();
  sessionStorage.removeItem("neptun-shared-token");
  document.body.replaceChildren();
});

it.each([false, true])(
  "removes the selected product only after the app confirmation accepts (%s)",
  async (accepted) => {
    const stored = await fixture();
    vi.mocked(confirmDialog).mockResolvedValueOnce(accepted);
    fireEvent.click(document.querySelector('[data-open="first"]')!);
    fireEvent.click(document.querySelector('[data-remove="same-product-id"]')!);
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Remove product",
        message: "Remove TV first from this campaign?",
        confirmLabel: "Remove",
        cancelLabel: "Keep product",
        danger: true,
      }),
    );
    await settle();
    expect(document.querySelectorAll("[data-remove]")).toHaveLength(
      accepted ? 0 : 1,
    );
    expect(stored.get("first")!.products).toHaveLength(accepted ? 0 : 1);
  },
);

it("does not remove a matching product in another campaign opened while confirmation is pending", async () => {
  const stored = await fixture();
  let resolveConfirmation!: (value: boolean) => void;
  vi.mocked(confirmDialog).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveConfirmation = resolve;
    }),
  );
  fireEvent.click(document.querySelector('[data-open="first"]')!);
  fireEvent.click(document.querySelector('[data-remove="same-product-id"]')!);
  fireEvent.click(document.querySelector('[data-open="second"]')!);
  resolveConfirmation(true);
  await settle();
  expect(document.querySelector(".studio-top b")!.textContent).toBe(
    "Second campaign",
  );
  expect(document.querySelectorAll("[data-remove]")).toHaveLength(1);
  expect(stored.get("first")!.products).toHaveLength(1);
  expect(stored.get("second")!.products).toHaveLength(1);
});

it("uses a masked app prompt with Albanian labels and makes no connection on cancellation", async () => {
  await fixture("sq");
  vi.mocked(promptDialog).mockResolvedValueOnce(null);
  fireEvent.click(document.getElementById("shared-workspace")!);
  await settle();
  expect(promptDialog).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Lidh hapësirën e përbashkët",
      label: "Kodi i qasjes në hapësirën e përbashkët",
      sensitive: true,
      confirmLabel: "Lidh",
      cancelLabel: "Anulo",
    }),
  );
  expect(apiFetch).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("neptun-shared-token")).toBeNull();
});

it("retains the shared connection flow and trims the accepted access code", async () => {
  await fixture();
  vi.mocked(promptDialog).mockResolvedValueOnce("  example-code  ");
  fireEvent.click(document.getElementById("shared-workspace")!);
  await settle();
  expect(apiFetch).toHaveBeenCalledWith("/api/campaigns", {
    headers: { Authorization: "Bearer example-code" },
  });
  expect(sessionStorage.getItem("neptun-shared-token")).toBe("example-code");
});
