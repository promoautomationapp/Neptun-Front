import { confirmDialog, promptDialog } from "../../components/dialogs";
import { apiFetch as fetch } from "../../api/client";
import type { SpreadsheetWorkbook } from "../../shared/spreadsheet";

interface ClassicProduct {
  [field: string]: string | number | boolean | null | undefined;
  id: string;
  code: string;
  name: string;
  brand: string;
  specs: string;
  regular: number | null;
  price: number | null;
  warranty: string | number;
  months: number;
  category: string;
  included: boolean;
  approved: boolean;
  image?: string;
  imagePath?: string;
  imageSource?: string;
  imageTreatment?: string;
  catalogCode?: string;
  cloudImagePath?: string;
  photoMatch?: string;
}

interface ImportSummary {
  rows: number;
  duplicateCodes: number;
  photosFound: number;
  photosMissing: number;
  priceIssues: number;
  nameIssues?: number;
  codeIssues?: number;
  matching: boolean;
  matchingUnavailable: boolean;
  importedAt: string;
}

interface ClassicCampaign {
  id: string;
  name: string;
  template: string;
  month: number;
  updated: string;
  dates: string;
  category: string;
  products: ClassicProduct[];
  importSummary?: ImportSummary | null;
}

interface PendingImport {
  name: string;
  wb: SpreadsheetWorkbook;
  sheet: string;
  header: number;
  rows?: unknown[][];
}

interface TextSuggestion {
  id: string;
  productId: string;
  field: "name" | "specs";
  before: string;
  after: string;
  name: string;
}
type PdfBytes = Uint8Array<ArrayBuffer>;
interface PdfStreamObject {
  head: PdfBytes;
  data: PdfBytes;
  tail: PdfBytes;
}
type PdfObject = PdfBytes | PdfStreamObject;

interface PhotoMatch {
  imagePath: string;
  title?: string;
  code?: string;
  page?: string;
  brand?: string;
  warranty?: string | number;
  specs?: string;
  regularPrice?: number;
  matchMethod?: string;
}

declare global {
  interface Window {
    NEPTUN_API_BASE?: string;
  }
}

function isClassicCampaign(value: unknown): value is ClassicCampaign {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "products" in value &&
    Array.isArray(value.products)
  );
}

export function mountWorkspace() {
  "use strict";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const resetInitialScroll = () => {
    if (location.hash) {
      try {
        history.replaceState(history.state, "", location.href.split("#")[0]);
      } catch {
        /* Optional browser state must not interrupt the interface. */
      }
    }
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.style.scrollBehavior = "";
    });
  };
  window.addEventListener("pageshow", resetInitialScroll);
  window.addEventListener("load", resetInitialScroll, { once: true });
  setTimeout(resetInitialScroll, 250);
  const $ = <T extends HTMLElement = HTMLElement>(s: string): T => {
      const element = document.querySelector<T>(s);
      if (!element) throw new Error(`Missing workspace element: ${s}`);
      return element;
    },
    findIn = <T extends HTMLElement = HTMLElement>(
      root: ParentNode,
      selector: string,
    ): T => {
      const element = root.querySelector<T>(selector);
      if (!element) throw new Error(`Missing workspace element: ${selector}`);
      return element;
    },
    esc = (v: unknown) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c] ?? c,
      );
  const uid = () =>
      crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2),
    clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)),
    money = (n: string | number | null) =>
      n !== null && n !== "" && Number.isFinite(+n)
        ? (+n).toLocaleString("en-IE", { maximumFractionDigits: 2 })
        : "—";
  let db: IDBDatabase | null = null,
    library: ClassicCampaign[] = [],
    current: ClassicCampaign | null = null,
    stage = 0,
    query = "",
    pending: PendingImport | null = null,
    monthFilter = "all",
    saveChain: Promise<void> = Promise.resolve(),
    brochureFormat = "a4",
    aiChecked = false,
    builderSaveTimer: ReturnType<typeof setTimeout> | null = null,
    cloudSyncTimer: ReturnType<typeof setTimeout> | null = null,
    cloudSyncBusy = false,
    backgroundBatchBusy = false;
  const aiIgnored = new Set<string>();
  function activeCampaign(): ClassicCampaign {
    if (!current) throw new Error("No active campaign is open.");
    return current;
  }
  const brochureTemplateCovers: Record<string, string> = {
    bg: "assets/c590b49cbc05.jpg",
    mujore: "assets/718964929a5f.jpg",
  };
  const pendingCloudSyncs = new Set<string>();
  const photoTimers = new Map<string, ReturnType<typeof setTimeout>>(),
    photoRequests = new Map<string, AbortController>();
  const spreadsheet = (() => {
    const reader = window.XLSX;
    if (!reader) throw new Error("Spreadsheet reader is unavailable.");
    return reader;
  })();
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  const canvasContext = (
    canvas: HTMLCanvasElement,
  ): CanvasRenderingContext2D => {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Canvas drawing is unavailable in this browser.");
    return context;
  };
  const imageData = (dataUrl: string): string => {
    const payload = dataUrl.split(",")[1];
    if (!payload) throw new Error("The exported image is empty.");
    return payload;
  };
  const root = $("#workspace"),
    fields = {
      code: "Product code *",
      name: "Product name *",
      brand: "Brand",
      specs: "Specifications",
      regular: "Regular price *",
      price: "Campaign price *",
      warranty: "Warranty (years)",
      months: "Installments (months)",
      category: "Category",
    };
  const aliases: Record<string, string[]> = {
    code: ["code", "productcode", "sku", "kodi", "material", "artikulli"],
    name: [
      "name",
      "product",
      "productname",
      "description",
      "emertimi",
      "përshkrimi",
      "pershkrimi",
    ],
    brand: ["brand", "marka"],
    specs: ["specs", "specifications", "specifikat", "karakteristikat"],
    regular: [
      "regular",
      "regularprice",
      "retailprice",
      "retailpricebeforepromo",
      "rrp",
      "cmimiirregullt",
      "çmimiirregullt",
    ],
    price: [
      "price",
      "campaignprice",
      "promoprice",
      "promo",
      "cmimipromo",
      "çmimipromo",
    ],
    warranty: [
      "warranty",
      "warrantyyears",
      "vitete garancionit",
      "vitetegarancionit",
      "garancion",
      "garancia",
    ],
    months: [
      "months",
      "installments",
      "installmentsmonths",
      "nrofinstallments",
      "këste",
      "keste",
    ],
    category: ["category", "kategoria"],
  };
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  function monthFromText(value: string) {
    const source = String(value || "").toLocaleLowerCase();
    const aliases = [
      ["january", "janar"],
      ["february", "shkurt"],
      ["march", "mars"],
      ["april", "prill"],
      ["may", "maj"],
      ["june", "qershor"],
      ["july", "korrik"],
      ["august", "gusht"],
      ["september", "shtator"],
      ["october", "tetor"],
      ["november", "nëntor", "nentor"],
      ["december", "dhjetor"],
    ];
    return (
      aliases.findIndex((group) =>
        group.some((name) =>
          new RegExp(`(^|[^a-zëç])${name}([^a-zëç]|$)`, "i").test(source),
        ),
      ) + 1
    );
  }
  function campaignMonth(c: ClassicCampaign) {
    const value = Number(c.month);
    return value >= 1 && value <= 12
      ? value
      : monthFromText(`${c.name || ""} ${c.dates || ""}`);
  }
  function note(msg: string, error = false) {
    $("#status").textContent = msg;
    $("#status").style.color = error ? "#b12828" : "";
  }
  function sharedToken() {
    try {
      return sessionStorage.getItem("neptun-shared-token") || "";
    } catch {
      return "";
    }
  }
  function sharedHeaders(token = sharedToken()): HeadersInit {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  function queueCloudSync(id: string) {
    if (!sharedToken()) return;
    pendingCloudSyncs.add(id);
    if (cloudSyncTimer !== null) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(flushCloudSyncQueue, 1200);
  }
  async function flushCloudSyncQueue() {
    if (cloudSyncBusy || backgroundBatchBusy) {
      cloudSyncTimer = setTimeout(flushCloudSyncQueue, 1200);
      return;
    }
    const ids = [...pendingCloudSyncs];
    pendingCloudSyncs.clear();
    for (const id of ids) await syncCloudCampaign(id);
  }
  function saveLocalSnapshot(campaign: ClassicCampaign): Promise<void> {
    const database = db;
    if (!database) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction("campaigns", "readwrite");
      tx.objectStore("campaigns").put(clone(campaign));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function webpDataUrl(source: string) {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const item = new Image();
      item.onload = () => resolve(item);
      item.onerror = () =>
        reject(Error("Could not prepare an image for team storage."));
      item.src = source;
    });
    const scale = Math.min(
        1,
        1200 / Math.max(image.naturalWidth, image.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable for image storage.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.88);
  }
  async function syncCloudCampaign(id: string) {
    if (!sharedToken() || cloudSyncBusy || backgroundBatchBusy) return;
    const source =
      library.find((c) => c.id === id) ?? (current?.id === id ? current : null);
    if (!source) return;
    const campaign = clone(source);
    cloudSyncBusy = true;
    try {
      const newImages = campaign.products.filter(
        (product) => product.image && !product.cloudImagePath,
      );
      let imageIndex = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, newImages.length) }, async () => {
          while (imageIndex < newImages.length) {
            const product = newImages[imageIndex++];
            if (!product?.image) continue;
            const image = await webpDataUrl(product.image);
            const response = await fetch("/api/campaign-assets", {
              method: "POST",
              headers: {
                ...sharedHeaders(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                campaignId: campaign.id,
                productId: product.id,
                image,
              }),
            });
            if (!response.ok)
              throw Error("A campaign image could not be shared");
            const result: { path: string } = await response.json();
            product.cloudImagePath = result.path;
            const live = library
              .find((c) => c.id === id)
              ?.products.find((p) => p.id === product.id);
            if (live) live.cloudImagePath = result.path;
            if (current?.id === id) {
              const active = current?.products.find((p) => p.id === product.id);
              if (active) active.cloudImagePath = result.path;
            }
          }
        }),
      );
      const latest = clone(
        current?.id === id
          ? current
          : (library.find((c) => c.id === id) ?? campaign),
      );
      for (const product of latest.products) {
        const uploaded = campaign.products.find((p) => p.id === product.id);
        if (uploaded?.cloudImagePath)
          product.cloudImagePath = uploaded.cloudImagePath;
      }
      await saveLocalSnapshot(latest);
      library = library.filter((c) => c.id !== id).concat(clone(latest));
      const payload = clone(latest);
      payload.products.forEach((p) => {
        delete p.image;
      });
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { ...sharedHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ campaign: payload }),
      });
      if (!response.ok) throw Error("Campaign details could not be shared");
      if (current?.id === id) note("Saved here and shared with the team.");
    } catch {
      if (current?.id === id)
        note(
          "Saved on this browser, but team sync failed. Check the shared workspace connection.",
          true,
        );
    } finally {
      cloudSyncBusy = false;
    }
  }
  async function connectSharedWorkspace(
    token = sharedToken(),
    automatic = false,
  ) {
    if (token && !automatic) {
      try {
        sessionStorage.removeItem("neptun-shared-token");
      } catch {
        /* Optional browser state must not interrupt the interface. */
      }
      token = "";
    }
    if (!token) {
      const albanian = window.neptunLanguage?.get() === "sq";
      token =
        (
          await promptDialog({
            title: albanian
              ? "Lidh hapësirën e përbashkët"
              : "Connect shared workspace",
            message: albanian
              ? "Vendosni kodin e qasjes nga administratori i platformës. Fushatat do të ndahen me kolegët që përdorin të njëjtin kod."
              : "Enter the shared workspace access code from your platform administrator. Campaigns will be shared with teammates using the same code.",
            label: albanian
              ? "Kodi i qasjes në hapësirën e përbashkët"
              : "Shared workspace access code",
            confirmLabel: albanian ? "Lidh" : "Connect",
            cancelLabel: albanian ? "Anulo" : "Cancel",
            sensitive: true,
          })
        )?.trim() ?? "";
      if (!token) return;
    }
    try {
      note("Connecting to shared campaign storage…");
      const response = await fetch("/api/campaigns", {
        headers: sharedHeaders(token),
      });
      if (response.status === 401)
        throw Error("That shared workspace access code was not accepted.");
      if (!response.ok)
        throw Error(
          "Shared storage is not configured yet. Set it up in the Vercel deployment first.",
        );
      const data: unknown = await response.json(),
        remote =
          data &&
          typeof data === "object" &&
          "campaigns" in data &&
          Array.isArray(data.campaigns)
            ? data.campaigns.filter(isClassicCampaign)
            : [],
        merged = new Map<string, ClassicCampaign>(
          library.map((c) => [c.id, clone(c)]),
        ),
        upload: ClassicCampaign[] = [];
      for (const source of remote) {
        if (
          !source ||
          typeof source.id !== "string" ||
          !Array.isArray(source.products)
        )
          continue;
        const local = merged.get(source.id);
        if (
          local &&
          Date.parse(local.updated) > Date.parse(source.updated || "")
        ) {
          upload.push(local);
          continue;
        }
        const campaign = clone(source);
        campaign.products.forEach((product) => delete product.image);
        const imageProducts = campaign.products.filter(
          (product) => product.cloudImagePath,
        );
        let imageIndex = 0;
        await Promise.all(
          Array.from(
            { length: Math.min(5, imageProducts.length) },
            async () => {
              while (imageIndex < imageProducts.length) {
                const product = imageProducts[imageIndex++];
                if (!product?.cloudImagePath) continue;
                try {
                  const asset = await fetch(
                    `/api/campaign-assets?path=${encodeURIComponent(product.cloudImagePath)}`,
                    { headers: sharedHeaders(token) },
                  );
                  if (asset.ok) {
                    const blob = await asset.blob();
                    product.image = await readImage(
                      new File(
                        [blob],
                        product.cloudImagePath.split("/").pop() ||
                          "product-image",
                        { type: blob.type },
                      ),
                    );
                  }
                } catch {
                  /* Optional browser state must not interrupt the interface. */
                }
              }
            },
          ),
        );
        merged.set(campaign.id, campaign);
      }
      const remoteIds = new Set(remote.map((c) => c?.id));
      for (const local of library)
        if (!remoteIds.has(local.id)) upload.push(local);
      try {
        sessionStorage.setItem("neptun-shared-token", token);
      } catch {
        /* Optional browser state must not interrupt the interface. */
      }
      library = [...merged.values()];
      if (current?.id && merged.has(activeCampaign().id))
        current = clone(merged.get(activeCampaign().id) ?? null);
      for (const campaign of library) await saveLocalSnapshot(campaign);
      render();
      note(
        `Team workspace connected · ${remote.length} shared campaign${remote.length === 1 ? "" : "s"} loaded.`,
      );
      for (const campaign of upload) queueCloudSync(campaign.id);
    } catch (error) {
      if (automatic) {
        try {
          sessionStorage.removeItem("neptun-shared-token");
        } catch {
          /* Optional browser state must not interrupt the interface. */
        }
      }
      note(
        error instanceof Error
          ? error.message
          : "Could not connect to the shared workspace.",
        true,
      );
    }
  }
  function download(name: string, body: BlobPart, type: string) {
    const u = URL.createObjectURL(new Blob([body], { type })),
      a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 15000);
  }
  function filename(s: string) {
    return s.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "Neptun brochure";
  }
  function persist(campaign = current) {
    if (!campaign) return Promise.resolve();
    campaign.updated = new Date().toISOString();
    const snapshot = clone(campaign);
    library = library.filter((c) => c.id !== snapshot.id).concat(snapshot);
    if (current === campaign) note("Saving…");
    saveChain = saveChain
      .catch(() => {})
      .then(
        () =>
          new Promise<void>((resolve, reject) => {
            const database = db;
            if (!database) return reject(Error("Storage unavailable"));
            const t = database.transaction("campaigns", "readwrite");
            t.objectStore("campaigns").put(snapshot);
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
          }),
      )
      .then(() => {
        if (current?.id === snapshot.id)
          note(
            "Saved on this browser · " +
              new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
          );
        if (!backgroundBatchBusy) queueCloudSync(snapshot.id);
      })
      .catch(() => {
        note(
          "Could not save on this browser. Download a backup now to keep your work.",
          true,
        );
      });
    return saveChain;
  }
  function saveBuilder(immediate = false) {
    if (builderSaveTimer !== null) clearTimeout(builderSaveTimer);
    builderSaveTimer = null;
    const campaign = current;
    if (immediate) return persist(campaign);
    builderSaveTimer = setTimeout(() => {
      builderSaveTimer = null;
      persist(campaign);
    }, 300);
  }
  function fresh(
    name: string,
    products: Partial<ClassicProduct>[] = [],
    month?: number,
  ): ClassicCampaign {
    return {
      id: uid(),
      name,
      template: "classic",
      month: Number(month) || monthFromText(name) || new Date().getMonth() + 1,
      updated: new Date().toISOString(),
      dates: "",
      category: "OFERTA",
      products: products.map((p) => ({
        ...p,
        id: uid(),
        code: p.code ?? "",
        name: p.name ?? "",
        brand: p.brand ?? "",
        specs: p.specs ?? "",
        regular: p.regular ?? null,
        price: p.price ?? null,
        included: true,
        approved: !!p.image,
        months: Number(p.months) || 0,
        warranty: p.warranty ?? "",
        category: p.category || "",
      })),
    };
  }
  const workflowSteps = [
    {
      key: "PRODUCTS",
      title: "Build your product list",
      copy: "Add products here or import an existing spreadsheet. Prices and savings update while you work.",
      metric: () =>
        current
          ? `${activeCampaign().products.length} products in the selected campaign`
          : "Choose or create a campaign to continue",
    },
    {
      key: "IMAGES",
      title: "Match and approve product images",
      copy: "Find Neptun photos by product code or name, or upload your own. Check the model before approving each image.",
      metric: () =>
        `${current?.products.filter((p) => p.included && (!p.image || !p.approved)).length || 0} images need review`,
    },
    {
      key: "DETAILS",
      title: "Check the details and prices",
      copy: "Confirm product names, specifications, campaign prices, warranties and installments before the brochure is made.",
      metric: () =>
        `${current?.products.filter((p) => p.included && issues(p).length).length || 0} products need review`,
    },
    {
      key: "BROCHURE",
      title: "Preview and download the brochure",
      copy: "Review the finished pages, choose a format, and download the current campaign when its details are ready.",
      metric: () =>
        `${current?.products.filter((p) => p.included).length || 0} products · ${current ? pageCount(activeCampaign().products, activeCampaign().template || "classic") : 0} pages`,
    },
  ];
  function updateWorkflow(n: number) {
    const step = workflowSteps[n];
    if (!step) return;
    document
      .querySelectorAll<HTMLElement>("[data-workflow-stage]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.workflowStage) === n),
        ),
      );
    $("#workflow-kicker").textContent = `STEP 0${n + 1} · ${step.key}`;
    $("#workflow-title").textContent = step.title;
    $("#workflow-copy").textContent = step.copy;
    $("#workflow-metric").textContent = step.metric();
    $("#workflow-open").innerHTML =
      `${["Open product list", "Review product images", "Check product details", "Preview the brochure"][n]} <span>→</span>`;
    $("#workflow-open").setAttribute(
      "aria-label",
      `${step.title}: open workspace step`,
    );
  }
  function setWorkflowOpen(open: boolean) {
    const section = $("#workflow"),
      panel = $("#workflow-panel"),
      button = $("#workflow-toggle");
    section.classList.toggle("is-collapsed", !open);
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  function go(n: number) {
    stage = n;
    document
      .querySelectorAll<HTMLElement>("[data-stage]")
      .forEach((b) =>
        b.setAttribute("aria-selected", String(Number(b.dataset.stage) === n)),
      );
    updateWorkflow(n);
    render();
  }
  function render() {
    updateWorkflow(stage);
    renderLibrary();
    $(".studio-top b").textContent = current
      ? activeCampaign().name
      : "Choose or create a brochure";
    $(".studio-top span").textContent = sharedToken()
      ? "Neptun template · campaigns are connected to your team workspace"
      : "Neptun template · saved locally on this browser with downloadable backups";
    $("#save-indicator").textContent = sharedToken()
      ? "Team workspace connected"
      : "Local workspace";
    $(".studio-foot>span:last-child").textContent = current
      ? `${activeCampaign().products.length} products`
      : "";
    if (!current) {
      root.innerHTML =
        '<div class="empty"><h3>Your next brochure starts here.</h3><p>Create a campaign above, then add products here or upload a spreadsheet.</p></div>';
      return;
    }
    if (stage === 0) renderProducts();
    if (stage === 1) renderImages();
    if (stage === 2) renderDetails();
    if (stage === 3) renderPreview();
  }
  function renderLibrary() {
    const host = $("#library"),
      saved = library
        .slice()
        .sort((a, b) => b.updated.localeCompare(a.updated)),
      seen = new Set(),
      ordered = saved.filter((c) => {
        const key = [
          c.name.toLocaleLowerCase(),
          c.dates || "",
          c.products.map((p) => `${p.code}:${p.price}`).join("|"),
        ].join("::");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
      reviewCount = ordered.filter(
        (c) =>
          !c.products.length ||
          c.products.some((p) => p.included && issues(p).length),
      ).length,
      counts = monthNames.map(
        (_, i) => ordered.filter((c) => campaignMonth(c) === i + 1).length,
      );
    host.innerHTML = `<div class="library-head"><div><div class="eyebrow">NEPTUN KOSOVO · CAMPAIGN ARCHIVE</div><h2 id="campaigns-heading">Previous campaigns</h2><p><span class="library-count">${ordered.length}</span> saved campaigns · open one to continue working. Connect a team workspace to share across devices.</p></div><div class="library-actions"><button class="secondary" id="shared-workspace">${sharedToken() ? "Disconnect team workspace" : "Connect team workspace"}</button><button class="primary" id="new-campaign">+ New campaign</button><label class="secondary file-button">Restore backup<input id="restore" type="file" accept=".json"></label></div></div><div class="month-filter" role="group" aria-label="Filter campaigns by month"><button type="button" class="${monthFilter === "all" ? "active" : ""}" data-month-filter="all" aria-pressed="${monthFilter === "all"}">All months</button>${monthNames.map((name, i) => `<button type="button" class="${monthFilter === String(i + 1) ? "active" : ""}" data-month-filter="${i + 1}" aria-pressed="${monthFilter === String(i + 1)}">${name}<span>${counts[i]}</span></button>`).join("")}</div><div class="library-tools"><label class="library-search-wrap"><span class="sr-only">Search campaigns</span><input class="library-search" id="library-search" type="search" placeholder="Search campaigns" autocomplete="off"><span aria-hidden="true">⌕</span></label><div class="library-filters" role="group" aria-label="Filter campaigns"><button type="button" class="active" data-library-filter="all" aria-pressed="true">All <span>${ordered.length}</span></button><button type="button" data-library-filter="review" aria-pressed="false">Needs review <span>${reviewCount}</span></button><button type="button" data-library-filter="ready" aria-pressed="false">Ready <span>${ordered.length - reviewCount}</span></button></div><label class="sort-control">Sort<select id="library-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label></div><div class="library-grid">${
      ordered
        .map((c) => {
          const needsReview =
            !c.products.length ||
            c.products.some((p) => p.included && issues(p).length);
          const status = needsReview ? "review" : "ready";
          const searchText =
              `${c.name} ${c.dates || ""} ${monthNames[campaignMonth(c) - 1] || ""}`.toLowerCase(),
            month = campaignMonth(c);
          return `<button class="campaign-card ${current?.id === c.id ? "active" : ""}" data-open="${esc(c.id)}" data-status="${status}" data-month="${month || 0}" data-name="${esc(searchText)}" data-updated="${esc(c.updated)}" aria-label="Open campaign ${esc(c.name)}"><span class="campaign-card-top"><span class="campaign-label">NEPTUN · CAMPAIGN</span><span class="campaign-status ${status}">${!c.products.length ? "Add products" : needsReview ? "Needs review" : "Ready"}</span></span><strong>${esc(c.name)}</strong><span class="campaign-meta"><b class="campaign-month-label">${monthNames[month - 1] || "Month not set"}</b><i>·</i> ${c.products.filter((p) => p.included).length} products <i>·</i> ${pageCount(c.products, c.template || "classic")} pages</span><span class="campaign-meta">Updated ${new Date(c.updated).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}${c.dates ? ` <i>·</i> ${esc(c.dates)}` : ""}</span><span class="campaign-open">${current?.id === c.id ? "Currently open" : "Open campaign"} <b>→</b></span></button>`;
        })
        .join("") ||
      '<div class="empty library-empty"><h3>No campaigns yet</h3><p>Create a campaign or restore a saved backup to get started.</p></div>'
    }<p class="library-no-results" hidden>No campaigns match this search. Try another name or filter.</p></div>${current ? `<details class="campaign-settings"><summary>Campaign settings and backup</summary><div class="campaign-settings-fields"><label>Campaign name<input id="campaign-name" value="${esc(activeCampaign().name)}" maxlength="100"></label><label>Campaign month<select id="campaign-month"><option value="0" ${campaignMonth(activeCampaign()) === 0 ? "selected" : ""}>Choose month</option>${monthNames.map((name, i) => `<option value="${i + 1}" ${campaignMonth(activeCampaign()) === i + 1 ? "selected" : ""}>${name}</option>`).join("")}</select></label><label>Offer dates / subtitle<input id="campaign-dates" value="${esc(activeCampaign().dates)}" placeholder="1–31 March 2027" maxlength="150"></label><label>Default category<input id="campaign-category" value="${esc(activeCampaign().category)}" maxlength="60"></label><button class="secondary" id="duplicate">Duplicate campaign</button><button class="secondary" id="backup">Download backup</button></div></details>` : ""}`;
    const applyLibraryView = () => {
      const q = $<HTMLInputElement>("#library-search")
          .value.trim()
          .toLocaleLowerCase(),
        filter =
          host.querySelector<HTMLElement>("[data-library-filter].active")
            ?.dataset.libraryFilter || "all",
        sort = $<HTMLSelectElement>("#library-sort").value;
      const cards = [...host.querySelectorAll<HTMLElement>(".campaign-card")];
      cards
        .sort((a, b) =>
          sort === "name"
            ? findIn(a, "strong").textContent.localeCompare(
                findIn(b, "strong").textContent,
              )
            : sort === "oldest"
              ? Number(a.dataset.date) - Number(b.dataset.date)
              : Number(b.dataset.date) - Number(a.dataset.date),
        )
        .forEach((card) =>
          findIn(host, ".library-grid").insertBefore(
            card,
            findIn(host, ".library-no-results"),
          ),
        );
      let visible = 0;
      cards.forEach((card) => {
        const show =
          (!q || (card.dataset.name ?? "").includes(q)) &&
          (filter === "all" || card.dataset.status === filter) &&
          (monthFilter === "all" || card.dataset.month === monthFilter);
        card.hidden = !show;
        if (show) visible++;
      });
      const empty = findIn(host, ".library-no-results");
      empty.textContent = visible
        ? ""
        : monthFilter === "all"
          ? "No campaigns match this search. Try another name or filter."
          : "No campaigns in this month. Choose another month or create one.";
      empty.hidden = visible > 0 || cards.length === 0;
    };
    host.querySelectorAll<HTMLElement>(".campaign-card").forEach((b) => {
      b.dataset.date = String(Date.parse(b.dataset.updated ?? "") || 0);
      b.onclick = () => {
        current = clone(library.find((c) => c.id === b.dataset.open) ?? null);
        if (!current) return;
        pending = null;
        query = "";
        monthFilter = "all";
        go(0);
        $("#studio").scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
    $("#library-search").oninput = applyLibraryView;
    $("#library-sort").onchange = applyLibraryView;
    host.querySelectorAll<HTMLElement>("[data-library-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          host
            .querySelectorAll<HTMLElement>("[data-library-filter]")
            .forEach((x) => {
              x.classList.toggle("active", x === b);
              x.setAttribute("aria-pressed", String(x === b));
            });
          applyLibraryView();
        }),
    );
    host.querySelectorAll<HTMLElement>("[data-month-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          monthFilter = b.dataset.monthFilter ?? "all";
          host
            .querySelectorAll<HTMLElement>("[data-month-filter]")
            .forEach((x) => {
              x.classList.toggle("active", x === b);
              x.setAttribute("aria-pressed", String(x === b));
            });
          applyLibraryView();
        }),
    );
    $("#new-campaign").onclick = () => {
      current = fresh("New campaign");
      pending = null;
      query = "";
      monthFilter = "all";
      persist();
      go(0);
      $("#studio").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    $("#shared-workspace").onclick = () => {
      if (sharedToken()) {
        try {
          sessionStorage.removeItem("neptun-shared-token");
        } catch {
          /* Optional browser state must not interrupt the interface. */
        }
        renderLibrary();
        $(".studio-top span").textContent =
          "Neptun template · saved locally on this browser with downloadable backups";
        $("#save-indicator").textContent = "Local workspace";
        note(
          "Shared workspace disconnected. Campaigns remain saved in this browser.",
        );
      } else connectSharedWorkspace("", false);
    };
    $("#restore").onchange = restore;
    if (current) {
      for (const [id, key] of [
        ["campaign-name", "name"],
        ["campaign-dates", "dates"],
        ["campaign-category", "category"],
      ])
        $<HTMLInputElement>("#" + id).oninput = (e) => {
          const input = e.currentTarget;
          if (!(input instanceof HTMLInputElement)) return;
          const value =
            input.value.trim() || (key === "name" ? "Untitled campaign" : "");
          if (key === "name" || key === "dates" || key === "category")
            activeCampaign()[key] = value;
          persist();
          $(".studio-top b").textContent = activeCampaign().name;
          const card = document.querySelector<HTMLElement>(
            ".campaign-card.active strong",
          );
          if (card) card.textContent = activeCampaign().name;
        };
      $<HTMLSelectElement>("#campaign-month").onchange = (e) => {
        const select = e.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        activeCampaign().month = Number(select.value);
        persist();
        renderLibrary();
      };
      $("#duplicate").onclick = () => {
        current = clone(activeCampaign());
        activeCampaign().id = uid();
        activeCampaign().name += " — copy";
        persist();
        render();
      };
      $("#backup").onclick = () =>
        download(
          filename(activeCampaign().name) + ".neptun.json",
          JSON.stringify({
            format: "neptun-brochure",
            version: 1,
            campaign: current,
          }),
          "application/json",
        );
    }
  }
  function restore(e: Event) {
    const input = e.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 80000000)
      return note("Backup is too large (maximum 80 MB).", true);
    file
      .text()
      .then((text: string) => {
        const b: unknown = JSON.parse(text);
        if (
          !b ||
          typeof b !== "object" ||
          !("format" in b) ||
          b.format !== "neptun-brochure" ||
          !("version" in b) ||
          b.version !== 1 ||
          !("campaign" in b) ||
          !isClassicCampaign(b.campaign) ||
          b.campaign.products.length > 2000
        )
          throw Error("Choose a Neptun brochure backup.");
        const c = b.campaign;
        current = fresh(
          String(c.name || "Restored brochure"),
          c.products.map((p) => ({
            code: String(p.code || ""),
            name: String(p.name || ""),
            brand: String(p.brand || ""),
            specs: String(p.specs || ""),
            regular: number(p.regular),
            price: number(p.price),
            months: number(p.months) || 0,
            warranty: p.warranty ?? "",
            category: String(p.category || ""),
            catalogCode: String(p.catalogCode || ""),
            cloudImagePath: String(p.cloudImagePath || ""),
            photoMatch: String(p.photoMatch || ""),
            image:
              typeof p.image === "string" &&
              /^data:image\/(png|jpeg|webp);base64,/.test(p.image)
                ? p.image
                : undefined,
            imagePath: typeof p.imagePath === "string" ? p.imagePath : "",
            imageSource: typeof p.imageSource === "string" ? p.imageSource : "",
            imageTreatment: ["original", "demo", "ai"].includes(
              p.imageTreatment ?? "",
            )
              ? p.imageTreatment
              : "original",
          })),
          c.month,
        );
        activeCampaign().dates = String(c.dates || "");
        activeCampaign().category = String(c.category || "OFERTA");
        activeCampaign().products.forEach((p, i) => {
          p.included = c.products[i]?.included !== false;
          p.approved = !!p.image && c.products[i]?.approved === true;
        });
        pending = null;
        persist();
        go(0);
      })
      .catch((err: { message: string }) =>
        note("Backup could not be restored: " + err.message, true),
      );
  }
  function number(v: unknown) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    let s = String(v ?? "").replace(/[€\s]/g, "");
    if (!s) return null;
    if (s.includes(",") && s.includes("."))
      s =
        s.lastIndexOf(",") > s.lastIndexOf(".")
          ? s.replace(/\./g, "").replace(",", ".")
          : s.replace(/,/g, "");
    else if (s.includes(",")) s = s.replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  const valid = <Product extends Pick<ClassicProduct, "regular" | "price">>(
    p: Product,
  ): p is Product & { regular: number; price: number } =>
    typeof p.regular === "number" &&
    Number.isFinite(p.regular) &&
    typeof p.price === "number" &&
    Number.isFinite(p.price) &&
    p.price > 0 &&
    p.regular >= p.price;
  function issues(p: ClassicProduct) {
    return [
      !p.code && "Missing code",
      !p.name && "Missing name",
      !valid(p) && "Check prices",
      !p.image && "Missing image",
      p.image && !p.approved && "Approve image",
    ].filter(Boolean);
  }
  function priorCatalogCode(code: string) {
    const found = new Set(
      library
        .flatMap((c) => c.products || [])
        .filter(
          (p) =>
            String(p.code || "").trim() === String(code || "").trim() &&
            p.catalogCode,
        )
        .map((p) => String(p.catalogCode).trim()),
    );
    return found.size === 1 ? [...found][0] : "";
  }
  function refreshImportSummary(campaign: ClassicCampaign | null) {
    const report = campaign?.importSummary;
    if (!report) return;
    const included = campaign.products.filter((p) => p.included);
    report.photosFound = included.filter((p) => p.image).length;
    report.photosMissing = included.filter((p) => !p.image).length;
    report.priceIssues = included.filter((p) => !valid(p)).length;
    report.nameIssues = included.filter(
      (p) => !String(p.name || "").trim(),
    ).length;
    report.codeIssues = included.filter(
      (p) => !String(p.code || "").trim(),
    ).length;
  }
  function renderImportSummary() {
    const report = current?.importSummary;
    if (!report) return "";
    refreshImportSummary(current);
    const nameIssues = (report.nameIssues ?? 0) + (report.codeIssues ?? 0);
    return `<section class="import-summary" aria-live="polite"><div class="import-summary-head"><div><span class="eyebrow">SPREADSHEET IMPORT CHECK</span><h3>${report.matching ? "Matching product photos…" : "Import check · " + report.rows + " products"}</h3><p>${report.matching ? "Checking exact Neptun catalog codes learned from previous selections, then exact product names." : report.photosMissing ? "Review the items below before making the brochure." : "Import complete. Review and approve each image before export."}</p></div><button type="button" class="photo-close" data-dismiss-import>Hide</button></div><div class="import-summary-stats"><span><b>${report.photosFound || 0}</b> photos found</span><span class="${report.photosMissing ? "needs-attention" : ""}"><b>${report.photosMissing || 0}</b> photos missing</span><span class="${report.priceIssues ? "needs-attention" : ""}"><b>${report.priceIssues || 0}</b> price checks</span>${report.duplicateCodes ? `<span class="needs-attention"><b>${report.duplicateCodes}</b> repeated codes</span>` : ""}${nameIssues ? `<span class="needs-attention"><b>${nameIssues}</b> missing name/code</span>` : ""}</div><div class="import-summary-actions"><button type="button" class="secondary" data-import-step="1">Review photos</button><button type="button" class="secondary" data-import-step="2">Check details and prices</button></div></section>`;
  }
  function pageCount(products: ClassicProduct[], template = "classic") {
    const n = products.filter((p) => p.included).length;
    return n ? Math.ceil(n / (template === "mujore" ? 6 : 4)) + 1 : 0;
  }
  function renderProducts() {
    const upload = `<label class="secondary file-button">Upload Excel or CSV<input id="upload-sheet" type="file" accept=".xlsx,.xls,.csv"></label>`;
    const heading = `<div class="toolbar"><div><h3>Build your product list</h3><p>Add products and prices here. Product photos are suggested from Neptun Kosovo as you type a code or name.</p></div>${upload}</div>${pending ? '<div id="mapping"></div>' : ""}`;
    const actions = `<div class="builder-toolbar"><div><strong id="builder-summary"></strong><span>Product codes stay in the workspace and do not appear in the brochure.</span></div><div class="builder-actions"><button class="secondary" id="download-products" type="button" ${activeCampaign().products.length ? "" : "disabled"}>Download spreadsheet</button><button class="primary" id="add-product" type="button">+ Add product</button></div></div>`;
    const table = activeCampaign().products.length
      ? `<div class="table-wrap builder-scroll"><table class="builder-table"><thead><tr><th>Use</th><th>Product code</th><th>Product name</th><th>Retail price (€)</th><th>Campaign price (€)</th><th>You save</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div>`
      : `<div class="builder-empty"><h4>No products yet</h4><p>Add your first product to build the campaign here. You can also upload an existing Excel or CSV file.</p></div>`;
    root.innerHTML =
      heading +
      renderImportSummary() +
      `
<section class="product-builder" aria-label="Product list builder">${actions}${activeCampaign().products.length ? `<label class="builder-search-label">Search products<input id="search" class="search" type="search" placeholder="Search code or product" value="${esc(query)}"></label>` : ""}${table}<div class="builder-next"><span>More fields such as brand, specifications, warranty and installments are in each product’s Details.</span><button class="secondary" id="builder-next" type="button" ${activeCampaign().products.length ? "" : "disabled"}>Continue to images →</button></div></section><p class="local-note">Importing a file creates a separate campaign, so the product list you build here stays saved.</p>`;
    $("#upload-sheet").onchange = uploadSheet;
    root
      .querySelector<HTMLElement>("[data-dismiss-import]")
      ?.addEventListener("click", () => {
        activeCampaign().importSummary = null;
        persist();
        renderProducts();
      });
    root
      .querySelectorAll<HTMLElement>("[data-import-step]")
      .forEach(
        (button) =>
          (button.onclick = () => go(Number(button.dataset.importStep))),
      );
    $("#add-product").onclick = addProduct;
    $("#download-products").onclick = downloadProductSpreadsheet;
    $("#builder-next").onclick = () => go(1);
    if (root.querySelector("#search"))
      $<HTMLInputElement>("#search").oninput = (e) => {
        const input = e.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        query = input.value;
        productRows();
      };
    if (activeCampaign().products.length) productRows();
    else updateBuilderSummary();
    if (pending) renderMapping();
  }
  function addProduct() {
    if (activeCampaign().products.length >= 2000)
      return note("A campaign can contain up to 2,000 products.", true);
    const p = {
      id: uid(),
      code: "",
      name: "",
      brand: "",
      specs: "",
      regular: null,
      price: null,
      warranty: "",
      months: 12,
      category: "",
      included: true,
      approved: false,
    };
    activeCampaign().products.push(p);
    query = "";
    persist();
    renderProducts();
    const input = root.querySelector<HTMLElement>(
      `[data-product="${CSS.escape(p.id)}"][data-field="code"]`,
    );
    input?.focus();
  }
  function builderSavings(p: { regular: number | null; price: number | null }) {
    if (!valid(p))
      return {
        amount: "—",
        percent: "—",
        message:
          p.regular != null || p.price != null ? "Check prices" : "Add prices",
      };
    return {
      amount: `${money(valid(p) ? p.regular - p.price : null)} €`,
      percent: `${(((p.regular - p.price) / p.regular) * 100).toLocaleString("en-IE", { maximumFractionDigits: 1 })}%`,
      message: "",
    };
  }
  function updateBuilderSummary() {
    const summary = $("#builder-summary");
    if (!summary) return;
    const count = activeCampaign().products.length,
      incomplete = activeCampaign().products.filter(
        (p) =>
          !String(p.code || "").trim() ||
          !String(p.name || "").trim() ||
          !valid(p),
      ).length;
    summary.textContent = `${count} ${count === 1 ? "product" : "products"} · ${incomplete} to complete`;
  }
  function builderRow(p: ClassicProduct) {
    const saving = builderSavings(p),
      field = (key: string, label: string, type = "text") =>
        `<label class="sr-only" for="builder-${key}-${p.id}">${label} for ${esc(p.name || p.code || "new product")}</label><input id="builder-${key}-${p.id}" data-product="${esc(p.id)}" data-field="${key}" type="${type}" ${type === "number" ? 'min="0" step="0.01" inputmode="decimal"' : ""} value="${esc(p[key] ?? "")}" placeholder="${esc(label)}" aria-label="${esc(label)}">`;
    return `<tr data-builder-row="${esc(p.id)}"><td><input type="checkbox" data-include="${esc(p.id)}" aria-label="Include ${esc(p.code || p.name || "new product")}" ${p.included ? "checked" : ""}></td><td>${field("code", "Product code")}</td><td><div class="builder-name-photo"><span class="builder-photo-thumb" data-photo-thumb="${esc(p.id)}">${p.image ? `<img src="${esc(p.image)}" alt="Photo for ${esc(p.name)}">` : '<span aria-hidden="true">▧</span>'}</span>${field("name", "Product name")}</div><button class="builder-photo-find" type="button" data-photo-find="${esc(p.id)}">${p.image ? "Change photo" : "Find photo on Neptun"}</button></td><td>${field("regular", "Retail price", "number")}</td><td>${field("price", "Campaign price", "number")}</td><td class="builder-savings"><strong data-save-amount>${saving.amount}</strong><span data-save-percent>${saving.percent}</span><small data-save-message>${saving.message}</small></td><td><div class="builder-row-actions"><button class="secondary" type="button" data-expand="${esc(p.id)}" aria-expanded="false">Details</button><button class="builder-remove" type="button" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name || p.code || "new product")}">Remove</button></div></td></tr><tr class="builder-detail-row" data-builder-detail="${esc(p.id)}" hidden><td colspan="7"><div class="builder-detail-grid"><label>Brand<input data-product="${esc(p.id)}" data-field="brand" value="${esc(p.brand || "")}"></label><label>Specifications<textarea data-product="${esc(p.id)}" data-field="specs" rows="2">${esc(p.specs || "")}</textarea></label><label>Warranty (years)<input data-product="${esc(p.id)}" data-field="warranty" type="number" min="0" step="1" value="${esc(p.warranty ?? "")}"></label><label>Installments (months)<input data-product="${esc(p.id)}" data-field="months" type="number" min="0" step="1" value="${esc(p.months ?? "")}"></label><label>Category<input data-product="${esc(p.id)}" data-field="category" value="${esc(p.category || "")}"></label></div></td></tr><tr class="photo-results-row" data-photo-results="${esc(p.id)}" hidden><td colspan="7"><div class="photo-results-content" aria-live="polite"></div></td></tr>`;
  }
  function productRows() {
    const tbody = $("#rows");
    if (!tbody) return;
    const visible = activeCampaign().products.filter((p) =>
      (p.code + " " + p.name + " " + (p.brand || ""))
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
    tbody.innerHTML =
      visible.map(builderRow).join("") ||
      '<tr><td colspan="7">No products match this search.</td></tr>';
    updateBuilderSummary();
    tbody
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "[data-product]",
      )
      .forEach(
        (input) =>
          (input.oninput = () => {
            const p = activeCampaign().products.find(
                (p) => p.id === input.dataset.product,
              ),
              key = input.dataset.field;
            if (!p || !key) return;
            const before = p[key];
            p[key] = ["regular", "price", "warranty", "months"].includes(key)
              ? number(input.value)
              : input.value;
            if ((key === "code" || key === "name") && before !== p[key]) {
              p.approved = false;
              schedulePhotoLookup(p.id);
            }
            const row = tbody.querySelector<HTMLElement>(
                `[data-builder-row="${CSS.escape(p.id)}"]`,
              ),
              saving = builderSavings(p);
            if (!row) return;
            findIn(row, "[data-save-amount]").textContent = saving.amount;
            findIn(row, "[data-save-percent]").textContent = saving.percent;
            findIn(row, "[data-save-message]").textContent = saving.message;
            updateBuilderSummary();
            saveBuilder();
          }),
      );
    tbody
      .querySelectorAll<HTMLElement>("[data-product]")
      .forEach((input) => (input.onchange = () => saveBuilder(true)));
    tbody.querySelectorAll<HTMLInputElement>("[data-include]").forEach(
      (b) =>
        (b.onchange = () => {
          const p = activeCampaign().products.find(
            (p) => p.id === b.dataset.include,
          );
          if (!p) return;
          p.included = b.checked;
          persist();
        }),
    );
    tbody.querySelectorAll<HTMLElement>("[data-expand]").forEach(
      (b) =>
        (b.onclick = () => {
          const row = tbody.querySelector<HTMLElement>(
            `[data-builder-detail="${CSS.escape(b.dataset.expand ?? "")}"]`,
          );
          if (!row) return;
          row.hidden = !row.hidden;
          b.setAttribute("aria-expanded", String(!row.hidden));
        }),
    );
    tbody
      .querySelectorAll<HTMLElement>("[data-photo-find]")
      .forEach(
        (b) => (b.onclick = () => lookupPhoto(b.dataset.photoFind ?? "")),
      );
    tbody.querySelectorAll<HTMLElement>("[data-remove]").forEach(
      (b) =>
        (b.onclick = async () => {
          const campaign = activeCampaign();
          const p = campaign.products.find((p) => p.id === b.dataset.remove);
          if (!p) return;
          const campaignId = campaign.id;
          const productId = p.id;
          const albanian = window.neptunLanguage?.get() === "sq";
          const label =
            p.name || p.code || (albanian ? "këtë produkt" : "this product");
          const accepted = await confirmDialog({
            title: albanian ? "Hiq produktin" : "Remove product",
            message: albanian
              ? `Ta hiqni ${label} nga kjo fushatë?`
              : `Remove ${label} from this campaign?`,
            confirmLabel: albanian ? "Hiq" : "Remove",
            cancelLabel: albanian ? "Mbaje produktin" : "Keep product",
            danger: true,
          });
          // Another campaign may have opened while the asynchronous dialog was shown.
          if (!accepted || current?.id !== campaignId) return;
          current.products = current.products.filter((x) => x.id !== productId);
          persist();
          renderProducts();
        }),
    );
  }
  function photoApiRoot() {
    if (window.NEPTUN_API_BASE)
      return String(window.NEPTUN_API_BASE).replace(/\/$/, "");
    if (
      location.protocol === "file:" ||
      ((location.hostname === "127.0.0.1" ||
        location.hostname === "localhost") &&
        ["8765", "8766"].includes(location.port))
    )
      return "http://127.0.0.1:8767";
    return "";
  }
  function photoResultsHost(id: string) {
    return root.querySelector<HTMLElement>(
      `[data-photo-results="${CSS.escape(id)}"]`,
    );
  }
  function showPhotoMessage(id: string, message: string) {
    const row = photoResultsHost(id);
    if (!row) return;
    row.hidden = false;
    findIn(row, ".photo-results-content").innerHTML =
      `<p class="photo-results-message">${esc(message)}</p>`;
  }
  function schedulePhotoLookup(id: string) {
    clearTimeout(photoTimers.get(id));
    photoRequests.get(id)?.abort();
    const previous = photoResultsHost(id);
    if (previous) previous.hidden = true;
    const p = current?.products.find((x) => x.id === id);
    if (!p) return;
    const term =
      String(p.code || "").trim().length >= 5
        ? p.code
        : String(p.name || "").trim();
    if (term.length < 4) return;
    photoTimers.set(
      id,
      setTimeout(() => lookupPhoto(id), 650),
    );
  }
  async function searchNeptun(
    term: string,
    signal: AbortSignal,
  ): Promise<PhotoMatch[]> {
    const response = await fetch(
      `${photoApiRoot()}/api/neptun-search?q=${encodeURIComponent(term)}`,
      { signal },
    );
    if (!response.ok) throw Error("Neptun search is unavailable");
    const data: { matches?: PhotoMatch[] } = await response.json();
    return Array.isArray(data.matches)
      ? data.matches.filter((match) => typeof match?.imagePath === "string")
      : [];
  }
  async function matchImportedPhotos(
    campaignId: string,
    duplicates = 0,
    triggerButton?: HTMLButtonElement,
  ) {
    const campaign = current;
    if (!campaign || campaign.id !== campaignId) return;
    const imported = campaign.products.length;
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.textContent = "Searching Neptun…";
    }
    try {
      note(`Matching missing photos for ${imported} products…`);
      const response = await fetch(`${photoApiRoot()}/api/neptun-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: campaign.products.map((p) => ({
            name: p.name,
            campaignCode: p.code,
            catalogCode: p.catalogCode || priorCatalogCode(p.code),
          })),
        }),
      });
      if (!response.ok) throw Error("Photo matching is unavailable");
      const result: {
        configured?: boolean;
        matches?: Array<{ index: number; product?: PhotoMatch }>;
      } = await response.json();
      if (current?.id !== campaignId) return;
      if (!result.configured) {
        if (campaign.importSummary) {
          campaign.importSummary.matching = false;
          campaign.importSummary.matchingUnavailable = true;
          refreshImportSummary(campaign);
          await persist(campaign);
          render();
        }
        note(
          `${imported} products imported and included. No confirmed Neptun code mapping is saved yet. Use Find photo on Neptun for the first match; future campaigns can reuse that mapping.`,
          true,
        );
        return;
      }
      const matches = Array.isArray(result.matches) ? result.matches : [];
      let attached = 0,
        failed = 0;
      for (let start = 0; start < matches.length; start += 4) {
        if (current?.id !== campaignId) return;
        const batch = matches.slice(start, start + 4);
        const settled = await Promise.allSettled(
          batch.map(async (entry) => {
            const product = campaign.products[Number(entry.index)],
              match = entry.product;
            if (!product || product.image || !match?.imagePath) return false;
            const imageResponse = await fetch(
              `${photoApiRoot()}/api/neptun-image?path=${encodeURIComponent(match.imagePath)}`,
            );
            if (!imageResponse.ok) throw Error("Image unavailable");
            const blob = await imageResponse.blob(),
              image = await readImage(
                new File(
                  [blob],
                  match.imagePath.split("/").pop() || "product-image",
                  {
                    type: blob.type,
                  },
                ),
              );
            if (current?.id !== campaignId) return false;
            product.image = image;
            product.imagePath = match.imagePath;
            product.imageSource = match.page || "";
            product.catalogCode = String(match.code || "");
            product.imageTreatment = "original";
            product.photoMatch = match.matchMethod || "exact-name";
            product.approved = false;
            return true;
          }),
        );
        for (const item of settled) {
          if (item.status === "fulfilled" && item.value) attached++;
          else if (item.status === "rejected") failed++;
        }
        await persist(campaign);
      }
      if (current?.id !== campaignId) return;
      if (campaign.importSummary) {
        campaign.importSummary.matching = false;
        campaign.importSummary.matchingUnavailable = false;
        refreshImportSummary(campaign);
        await persist(campaign);
      }
      const exactTotal = campaign.products.filter(
        (p) =>
          p.image &&
          (p.catalogCode ||
            p.photoMatch === "exact-name" ||
            p.photoMatch === "catalog-code"),
      ).length;
      const missing = campaign.products.filter(
        (p) => p.included && !p.image,
      ).length;
      render();
      const suffix = duplicates
        ? `; ${duplicates} repeated campaign codes kept as separate rows`
        : "";
      note(
        `${imported} products imported and included${suffix}. Added ${attached} exact photo${attached === 1 ? "" : "s"}; ${exactTotal} exact-match photos are now attached. ${missing} products still need a photo${failed ? ` (${failed} photo${failed === 1 ? "" : "s"} could not load)` : ""}. Review every image before approving.`,
      );
    } catch {
      if (current?.id === campaignId) {
        if (campaign.importSummary) {
          campaign.importSummary.matching = false;
          campaign.importSummary.matchingUnavailable = true;
          refreshImportSummary(campaign);
          await persist(campaign);
          render();
        }
        note(
          `${imported} products imported and included, but photo matching could not connect. Check that the local Neptun preview is running, then retry here.`,
          true,
        );
      }
    } finally {
      if (triggerButton?.isConnected) {
        triggerButton.disabled = false;
        triggerButton.textContent = "Find missing Neptun photos";
      }
    }
  }
  async function lookupPhoto(id: string) {
    clearTimeout(photoTimers.get(id));
    const p = current?.products.find((x) => x.id === id);
    if (!p) return;
    const code = String(p.code || "").trim(),
      name = String(p.name || "").trim(),
      term = code.length >= 5 ? code : name;
    if (term.length < 4)
      return showPhotoMessage(
        id,
        "Enter a product code or at least four letters of the product name.",
      );
    photoRequests.get(id)?.abort();
    const controller = new AbortController();
    photoRequests.set(id, controller);
    const campaignId = activeCampaign().id;
    showPhotoMessage(id, "Searching Neptun Kosovo…");
    try {
      let matches = await searchNeptun(term, controller.signal);
      if (
        code.length >= 5 &&
        name.length >= 4 &&
        !matches.some((match) => String(match.code || "").trim() === code)
      ) {
        const nameMatches = await searchNeptun(name, controller.signal);
        if (nameMatches.length) matches = nameMatches;
      }
      if (controller.signal.aborted || current?.id !== campaignId) return;
      const row = photoResultsHost(id);
      if (!row) return;
      row.hidden = false;
      const host = findIn(row, ".photo-results-content");
      host.innerHTML = matches.length
        ? `<div class="photo-results-head"><strong>Photos from Neptun Kosovo</strong><span>Check the code and model before choosing.</span><button type="button" class="photo-close" data-photo-close>Close</button></div><div class="photo-candidates">${matches.map((match, i) => `<article class="photo-candidate"><img src="${esc(photoApiRoot())}/api/neptun-image?path=${encodeURIComponent(match.imagePath)}" alt="${esc(match.title)}" loading="lazy"><div><strong>${esc(match.title)}</strong><span>Code: ${esc(match.code || "—")}${code && match.code === code ? " · Exact code match" : ""}</span><a href="${esc(match.page)}" target="_blank" rel="noopener noreferrer">View on Neptun ↗</a></div><button type="button" class="secondary" data-photo-choice="${i}">Use this product</button></article>`).join("")}</div>`
        : '<p class="photo-results-message">No matching product photo found on Neptun. Check the code or use Upload image in the Images step.</p>';
      host
        .querySelector<HTMLElement>("[data-photo-close]")
        ?.addEventListener("click", () => {
          row.hidden = true;
        });
      host
        .querySelectorAll<HTMLElement>("[data-photo-choice]")
        .forEach(
          (button) =>
            (button.onclick = () =>
              useSuggestedProduct(
                id,
                matches[Number(button.dataset.photoChoice)],
                button instanceof HTMLButtonElement ? button : null,
              )),
        );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      showPhotoMessage(
        id,
        "Product photo search could not connect. Check that the React app server is running, or upload an image manually.",
      );
    } finally {
      if (photoRequests.get(id) === controller) photoRequests.delete(id);
    }
  }
  function cutoutPanel(id: string, original: string, title: string) {
    const row = photoResultsHost(id);
    if (!row) return null;
    row.hidden = false;
    findIn(row, ".photo-results-content").innerHTML =
      `<div class="cutout-head"><div><strong><span>Selected:</span> ${esc(title)}</strong><span>Product code, name and available details were added to the row.</span></div><button type="button" class="photo-close" data-photo-close>Close</button></div><div class="cutout-comparison"><div><b>Original Neptun photo</b><div class="cutout-image"><img src="${esc(original)}" alt="Original ${esc(title)}"></div></div><div><b>Background removal</b><div class="cutout-image checker cutout-preview" data-cutout-preview><span>Preparing cutout…</span></div></div></div><p class="cutout-status" data-cutout-status>Checking the AI background-removal connection…</p><div class="cutout-actions" data-cutout-actions></div>`;
    findIn(row, "[data-photo-close]").onclick = () => {
      row.hidden = true;
    };
    return row;
  }
  async function useSuggestedProduct(
    id: string,
    match: PhotoMatch | undefined,
    button: HTMLButtonElement | null,
  ) {
    if (!match?.imagePath || !button) return;
    const p = current?.products.find((x) => x.id === id);
    if (!p) return;
    const campaignId = activeCampaign().id;
    button.disabled = true;
    button.textContent = "Selecting product…";
    try {
      const response = await fetch(
        `${photoApiRoot()}/api/neptun-image?path=${encodeURIComponent(match.imagePath)}`,
      );
      if (!response.ok) throw Error("Product image could not be loaded");
      const blob = await response.blob();
      const original = await readImage(
        new File([blob], match.imagePath.split("/").pop() || "product-image", {
          type: blob.type,
        }),
      );
      if (current?.id !== campaignId) return;
      p.catalogCode = String(match.code || "");
      p.name = match.title || p.name;
      if (!p.brand) p.brand = match.brand || "";
      if (!p.warranty) p.warranty = match.warranty || "";
      if (!p.specs) p.specs = match.specs || "";
      if (
        p.regular == null &&
        typeof match.regularPrice === "number" &&
        Number.isFinite(match.regularPrice) &&
        match.regularPrice > 0
      )
        p.regular = match.regularPrice;
      p.image = original;
      p.imagePath = match.imagePath;
      p.imageSource = match.page;
      p.cloudImagePath = "";
      p.imageTreatment = "original";
      p.photoMatch = "manual";
      p.approved = false;
      await persist();
      query = "";
      renderProducts();
      updateWorkflow(0);
      const panel = cutoutPanel(id, original, p.name);
      if (panel) await prepareCutout(id, original, match.imagePath, campaignId);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Use this product";
      showPhotoMessage(
        id,
        "Could not select this product. Try another match or upload a photo manually.",
      );
      note(
        error instanceof Error
          ? error.message
          : "Could not select this product.",
        true,
      );
    }
  }
  async function prepareCutout(
    id: string,
    original: string,
    imagePath: string,
    campaignId: string,
  ) {
    const row = photoResultsHost(id);
    if (!row) return;
    const status = findIn(row, "[data-cutout-status]"),
      preview = findIn(row, "[data-cutout-preview]"),
      actions = findIn(row, "[data-cutout-actions]");
    let cutout: string | null = null,
      mode = "demo",
      serviceError = false;
    try {
      const response = await fetch(`${photoApiRoot()}/api/remove-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath }),
      });
      if (response.ok) {
        const data: { image?: string } = await response.json();
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(data.image || ""))
          throw Error("Invalid AI image");
        cutout = data.image ?? null;
        mode = "ai";
      } else if (response.status !== 501) serviceError = true;
    } catch {
      serviceError = true;
    }
    if (!cutout) {
      status.textContent = serviceError
        ? "AI service unavailable. Creating a demo cutout from the light background…"
        : "AI backend not connected. Creating a demo cutout from the light background…";
      try {
        cutout = await window.neptunDemoCutout(original);
      } catch (error) {
        status.textContent =
          (error instanceof Error ? error.message : "Demo cutout failed.") +
          " The original image is saved for review.";
        preview.innerHTML = "<span>Demo cutout unavailable</span>";
        actions.innerHTML =
          '<button type="button" class="secondary" data-keep-original>Keep original photo</button>';
        findIn(actions, "[data-keep-original]").onclick = () => {
          row.hidden = true;
          note("Original product photo kept. Review it in Images.");
        };
        return;
      }
    }
    if (
      current?.id !== campaignId ||
      !activeCampaign().products.some((p) => p.id === id)
    )
      return;
    preview.innerHTML = `<img src="${esc(cutout)}" alt="Background removed preview">`;
    status.textContent =
      mode === "ai"
        ? "AI background removal complete. Check the edges before using this cutout."
        : "Demo cutout preview. Connect your AI backend for production-quality removal; check the edges before using it.";
    actions.innerHTML =
      '<button type="button" class="primary" data-use-cutout>Use cutout</button><button type="button" class="secondary" data-keep-original>Keep original photo</button>';
    findIn(actions, "[data-use-cutout]").onclick = async () => {
      const p = current?.products.find((x) => x.id === id);
      if (!p) return;
      const button = findIn<HTMLButtonElement>(actions, "[data-use-cutout]");
      button.disabled = true;
      button.textContent = "Saving cutout…";
      try {
        const blob = await (await fetch(cutout)).blob();
        p.image = await readImage(
          new File([blob], `${p.code || "product"}-cutout.png`, {
            type: blob.type,
          }),
        );
        p.imageTreatment = mode;
        p.approved = false;
        await persist();
        renderProducts();
        note(
          `${mode === "ai" ? "AI" : "Demo"} cutout saved for ${p.name}. Review and approve it in Images.`,
        );
      } catch {
        button.disabled = false;
        button.textContent = "Use cutout";
        status.textContent =
          "Could not save the cutout. Keep the original photo or try again.";
      }
    };
    findIn(actions, "[data-keep-original]").onclick = () => {
      row.hidden = true;
      note("Original product photo kept. Review and approve it in Images.");
    };
  }
  function downloadProductSpreadsheet() {
    if (!current?.products.length) return;
    const headers = [
      "Product code",
      "Product name",
      "Brand",
      "Specifications",
      "Retail price",
      "Campaign price",
      "Savings %",
      "Warranty (years)",
      "Installments (months)",
      "Category",
    ];
    const rows = [
      headers,
      ...activeCampaign().products.map((p) => [
        p.code,
        p.name,
        p.brand || "",
        p.specs || "",
        p.regular ?? "",
        p.price ?? "",
        valid(p) ? (p.regular - p.price) / p.regular : "",
        p.warranty ?? "",
        p.months ?? "",
        p.category || "",
      ]),
    ];
    const sheet = spreadsheet.utils.aoa_to_sheet(rows);
    Object.assign(sheet, {
      "!cols": [
        { wch: 17 },
        { wch: 34 },
        { wch: 18 },
        { wch: 55 },
        { wch: 18 },
        { wch: 20 },
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
      ],
    });
    for (let i = 2; i <= rows.length; i++) {
      const savings = rows[i - 1]?.[6];
      Object.assign(sheet, {
        ["G" + i]: {
          t: "n",
          v: savings === "" ? undefined : savings,
          f: `IF(OR(E${i}="",F${i}="",E${i}<=0,F${i}<=0,F${i}>E${i}),"",(E${i}-F${i})/E${i})`,
          z: "0.0%",
        },
      });
    }
    const book = spreadsheet.utils.book_new();
    spreadsheet.utils.book_append_sheet(book, sheet, "Products");
    download(
      filename(activeCampaign().name) + "-products.xlsx",
      spreadsheet.write(book, { bookType: "xlsx", type: "array" }),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    note(
      `Downloaded ${activeCampaign().products.length} products as an editable spreadsheet.`,
    );
  }
  async function uploadSheet(e: Event) {
    const input = e.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 20000000)
      return note("Choose a spreadsheet under 20 MB.", true);
    try {
      note("Reading spreadsheet…");
      const wb = spreadsheet.read(await f.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames.includes("Total Neptun")
        ? "Total Neptun"
        : wb.SheetNames[0];
      if (!sheetName) throw Error("The spreadsheet has no worksheet.");
      const importData: PendingImport = {
        name: f.name.replace(/\.[^.]+$/, ""),
        wb,
        sheet: sheetName,
        header: 1,
      };
      pending = importData;
      const rows = spreadsheet.utils.sheet_to_json(
        wb.Sheets[importData.sheet],
        {
          header: 1,
          defval: "",
          raw: false,
        },
      );
      let best = -1;
      rows.slice(0, 50).forEach((r, i) => {
        const score = r.reduce<number>(
          (s, x) =>
            s + (Object.values(aliases).flat().includes(normal(x)) ? 1 : 0),
          0,
        );
        if (score > best) {
          best = score;
          importData.header = i + 1;
        }
      });
      if (importData.sheet === "Total Neptun") importData.header = 11;
      renderProducts();
      note("Choose the columns and review the import.");
    } catch (err) {
      note(
        "Could not read this spreadsheet: " +
          (err instanceof Error ? err.message : String(err)),
        true,
      );
    }
  }
  function normal(v: unknown) {
    return String(v)
      .toLowerCase()
      .replace(/[^a-zëç0-9]/g, "");
  }
  function renderMapping() {
    const importData = pending;
    if (!importData) return;
    const rows = spreadsheet.utils.sheet_to_json(
        importData.wb.Sheets[importData.sheet],
        {
          header: 1,
          defval: "",
          raw: false,
        },
      ),
      heads = rows[importData.header - 1] || [];
    importData.rows = rows;
    $("#mapping").innerHTML =
      `<div class="import-panel"><h3>Match your columns</h3><div class="edit-grid"><label>Worksheet<select id="sheet-choice">${importData.wb.SheetNames.map((s) => `<option ${s === importData.sheet ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label><label>Header row<input id="header-row" type="number" min="1" max="${rows.length}" value="${importData.header}"></label></div><div class="mapping-grid">${Object.entries(
        fields,
      )
        .map(([key, label]) => {
          let guessed = heads.findIndex((h) =>
            (aliases[key] ?? []).includes(normal(h)),
          );
          if (importData.sheet === "Total Neptun" && importData.header === 11)
            guessed =
              (
                {
                  code: 2,
                  name: 3,
                  specs: 4,
                  brand: 7,
                  warranty: 9,
                  regular: 17,
                  price: 18,
                  months: 29,
                } as Record<string, number>
              )[key] ?? -1;
          return `<label>${label}<select data-map="${key}"><option value="-1">Not mapped</option>${heads.map((h, i) => `<option value="${i}" ${guessed === i ? "selected" : ""}>${spreadsheet.utils.encode_col(i)} — ${esc(h || "(empty heading)")}</option>`).join("")}</select></label>`;
        })
        .join(
          "",
        )}</div><p>First rows below the selected header:</p><div class="table-wrap"><table><tbody>${rows
        .slice(importData.header, importData.header + 3)
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join(
          "",
        )}</tbody></table></div><p id="import-error" role="alert"></p><button id="import-confirm" class="primary">Create brochure from this spreadsheet</button><button id="import-cancel" class="secondary">Cancel</button></div>`;
    $<HTMLSelectElement>("#sheet-choice").onchange = (e) => {
      const select = e.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      importData.sheet = select.value;
      importData.header = 1;
      renderMapping();
    };
    $<HTMLInputElement>("#header-row").onchange = (e) => {
      const input = e.currentTarget;
      if (!(input instanceof HTMLInputElement)) return;
      importData.header = Math.max(
        1,
        Math.min(rows.length, Number(input.value) || 1),
      );
      renderMapping();
    };
    $("#import-cancel").onclick = () => {
      pending = null;
      renderProducts();
    };
    $("#import-confirm").onclick = () => {
      const map: Record<string, number> = {};
      root
        .querySelectorAll<HTMLSelectElement>("[data-map]")
        .forEach((select) => {
          const key = select.dataset.map;
          if (key) map[key] = Number(select.value);
        });
      if (["code", "name", "regular", "price"].some((k) => (map[k] ?? -1) < 0))
        return ($("#import-error").textContent =
          "Map all four required fields first.");
      const mapped = Object.values(map).filter((x) => x >= 0);
      if (new Set(mapped).size !== mapped.length)
        return ($("#import-error").textContent =
          "Each mapped field must use a different column.");
      const products: Partial<ClassicProduct>[] = [],
        seen = new Set<string>();
      let duplicates = 0;
      for (const r of rows.slice(importData.header)) {
        if (!r.some((x) => String(x).trim())) continue;
        const p: Partial<ClassicProduct> = {};
        for (const k of Object.keys(fields))
          p[k] = (map[k] ?? -1) < 0 ? "" : String(r[map[k] ?? -1] ?? "");
        p.code = String(p.code).trim();
        p.name = String(p.name).trim();
        if (!p.code && !p.name) continue;
        if (seen.has(p.code) && p.code) duplicates++;
        seen.add(p.code);
        p.regular = number(p.regular);
        p.price = number(p.price);
        p.months = number(p.months) || 0;
        p.warranty = number(p.warranty) ?? "";
        products.push(p);
      }
      if (!products.length || products.length > 2000)
        return ($("#import-error").textContent =
          "Choose a sheet with 1–2,000 product rows.");
      current = fresh(importData.name, products);
      activeCampaign().importSummary = {
        rows: products.length,
        duplicateCodes: duplicates,
        photosFound: 0,
        photosMissing: activeCampaign().products.filter((p) => p.included)
          .length,
        priceIssues: activeCampaign().products.filter((p) => !valid(p)).length,
        matching: true,
        matchingUnavailable: false,
        importedAt: new Date().toISOString(),
      };
      for (const p of activeCampaign().products) {
        const known = library
          .flatMap((c) => c.products)
          .find((x) => x.code === p.code && x.image && x.approved);
        p.catalogCode = p.catalogCode || priorCatalogCode(p.code);
        if (known) {
          p.image = known.image;
          p.imageTreatment = known.imageTreatment || "original";
          p.imagePath = known.imagePath || "";
          p.imageSource = known.imageSource || "";
          p.cloudImagePath = known.cloudImagePath || "";
          p.photoMatch = known.photoMatch || "crosswalk";
          p.approved = false;
        }
      }
      pending = null;
      persist();
      render();
      matchImportedPhotos(activeCampaign().id, duplicates);
    };
  }
  function renderImages() {
    root.innerHTML = `<div class="toolbar"><div><h3>Product images</h3><p>Use photos found from Neptun in the Product list, or upload PNG, JPEG or WebP images here.</p></div><button id="match-neptun-photos" class="secondary" type="button" ${activeCampaign().products.some((p) => p.included && !p.image) ? "" : "disabled"}>Find missing Neptun photos</button><button id="batch-background" class="secondary" type="button" ${activeCampaign().products.some((p) => p.included && p.image && p.imageTreatment !== "ai") ? "" : "disabled"}>Remove backgrounds in batch</button><label class="primary file-button">Add images by code<input id="batch-images" type="file" accept="image/png,image/jpeg,image/webp" multiple></label></div><p class="local-note">For bulk upload, name each file with its product code, for example 84066697.png. Use Find photo on Neptun in Product list to search the live product catalog, or upload images here. Batch cleanup uses your connected AI service; it never marks results approved automatically. Review every image before approving it.</p><p id="background-progress" class="batch-progress" aria-live="polite"></p><div class="image-grid">${activeCampaign()
      .products.filter((p) => p.included)
      .map(
        (p) =>
          `<article class="image-editor"><div class="image-box checker">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : "<span>No image</span>"}</div><h3>${esc(p.name)}</h3><p>${esc(p.code)}</p>${p.imageTreatment === "ai" ? '<span class="image-treatment">AI cutout · review edges</span>' : p.imageTreatment === "demo" ? '<span class="image-treatment">Demo cutout · review edges</span>' : ""}<label class="secondary file-button">${p.image ? "Replace" : "Upload"} image<input data-image="${p.id}" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="approval"><input type="checkbox" data-approve="${p.id}" ${p.approved ? "checked" : ""} ${!p.image ? "disabled" : ""}> Approved for brochure</label></article>`,
      )
      .join("")}</div>`;
    const matchButton = $<HTMLButtonElement>("#match-neptun-photos");
    if (matchButton)
      matchButton.onclick = () =>
        matchImportedPhotos(activeCampaign().id, 0, matchButton);
    const batchButton = $<HTMLButtonElement>("#batch-background");
    if (batchButton)
      batchButton.onclick = () => removeBackgroundBatch(batchButton);
    root.querySelectorAll<HTMLInputElement>("[data-image]").forEach(
      (input) =>
        (input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            const p = activeCampaign().products.find(
              (p) => p.id === input.dataset.image,
            );
            if (!p) return;
            p.image = await readImage(file);
            p.cloudImagePath = "";
            p.imageTreatment = "original";
            p.imagePath = "";
            p.imageSource = "";
            p.cloudImagePath = "";
            p.approved = false;
            refreshImportSummary(current);
            persist();
            renderImages();
          } catch (e) {
            note(errorMessage(e), true);
          }
        }),
    );
    root.querySelectorAll<HTMLInputElement>("[data-approve]").forEach(
      (b) =>
        (b.onchange = () => {
          const product = activeCampaign().products.find(
            (p) => p.id === b.dataset.approve,
          );
          if (!product) return;
          product.approved = b.checked;
          persist();
        }),
    );
    $<HTMLInputElement>("#batch-images").onchange = async (e) => {
      const input = e.currentTarget;
      if (!(input instanceof HTMLInputElement) || !input.files) return;
      let count = 0,
        unmatched = 0;
      try {
        for (const f of input.files) {
          const code = f.name.replace(/\.[^.]+$/, "");
          const ps = activeCampaign().products.filter((p) => p.code === code);
          if (!ps.length) {
            unmatched++;
            continue;
          }
          const image = await readImage(f);
          ps.forEach((p) => {
            p.image = image;
            p.cloudImagePath = "";
            p.imageTreatment = "original";
            p.imagePath = "";
            p.imageSource = "";
            p.approved = false;
          });
          count += ps.length;
        }
        await persist();
        renderImages();
        note(
          `${count} products received images; ${unmatched} files had no matching code. Review and approve each image.`,
        );
      } catch (err) {
        note(errorMessage(err), true);
      }
    };
  }
  async function removeBackgroundBatch(button: { disabled: boolean }) {
    const campaignId = current?.id,
      products =
        current?.products.filter(
          (p) => p.included && p.image && p.imageTreatment !== "ai",
        ) || [];
    if (!products.length) return;
    button.disabled = true;
    backgroundBatchBusy = true;
    let next = 0,
      done = 0,
      failed = 0,
      serviceMissing = false;
    const status = $("#background-progress");
    if (status)
      status.textContent = `Starting AI cleanup for ${products.length} photos…`;
    const worker = async () => {
      while (next < products.length && !serviceMissing) {
        const product = products[next++];
        if (!product?.image) continue;
        if (current?.id !== campaignId) return;
        try {
          const image = await webpDataUrl(product.image);
          const response = await fetch(
            `${photoApiRoot()}/api/remove-background`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image }),
            },
          );
          if (response.status === 501) {
            serviceMissing = true;
            throw Error(
              "AI background removal is not connected. Configure your AI service before starting a batch.",
            );
          }
          if (!response.ok) throw Error("AI could not process this image");
          const data = await response.json();
          if (!/^data:image\/(png|jpeg|webp);base64,/.test(data.image || ""))
            throw Error("AI returned an invalid image");
          const blob = await (await fetch(data.image)).blob();
          product.image = await readImage(
            new File(
              [blob],
              `${product.code || product.id}-cutout.${blob.type.split("/")[1] || "png"}`,
              { type: blob.type },
            ),
          );
          product.cloudImagePath = "";
          product.imageTreatment = "ai";
          product.approved = false;
          done++;
        } catch {
          failed++;
          if (serviceMissing) break;
        }
        if (status)
          status.textContent = `AI cleanup · ${done + failed} of ${products.length} checked`;
        await persist(current);
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(2, products.length) }, worker),
      );
    } finally {
      backgroundBatchBusy = false;
    }
    if (current?.id === campaignId) {
      await persist(current);
      renderImages();
      note(
        serviceMissing
          ? "AI background removal is not connected. No demo images were substituted."
          : `AI cleanup finished: ${done} processed, ${failed} need retry. Review every result and approve only the good ones.`,
        serviceMissing || failed > 0,
      );
    }
  }
  function readImage(f: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
        f.size > 15000000
      )
        return reject(Error("Use PNG, JPEG or WebP images under 15 MB."));
      const url = URL.createObjectURL(f),
        img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          reject(Error("This image could not be processed."));
          return;
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(Error("This image could not be opened."));
      };
      img.src = url;
    });
  }
  function aiTextSuggestions(products: ClassicProduct[]): TextSuggestion[] {
    const spellingRules: Array<[RegExp, string]> = [
      [/\bjetegjatesia\b/gi, "jetëgjatësia"],
      [/\bmotorrit\b/gi, "motorit"],
      [/\bderi\s+ne\b/gi, "deri në"],
      [/\bore\b/gi, "orë"],
    ];
    const fixCase = (match: string, replacement: string): string =>
      match === match.toUpperCase()
        ? replacement.toUpperCase()
        : match.charAt(0) === match.charAt(0).toUpperCase()
          ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
          : replacement;
    const out: TextSuggestion[] = [];
    for (const p of products) {
      for (const field of ["name", "specs"] as const) {
        const before = String(p[field] ?? "");
        let after = before;
        for (const [pattern, replacement] of spellingRules)
          after = after.replace(pattern, (match) =>
            fixCase(match, replacement),
          );
        after = after
          .replace(/\s+([,.;:])/g, "$1")
          .replace(/([,;])(?=\S)/g, "$1 ")
          .replace(/\s{2,}/g, " ")
          .trim();
        if (after !== before)
          out.push({
            id: `${p.id}:${field}`,
            productId: p.id,
            field,
            before,
            after,
            name: `${p.brand || ""} ${p.name || ""}`.trim(),
          });
      }
    }
    return out;
  }
  function renderAiSuggestions(products: ClassicProduct[]) {
    const host = $("#ai-suggestions");
    const suggestions = aiTextSuggestions(products).filter(
      (s) => !aiIgnored.has(s.id),
    );
    host.innerHTML = `<div class="ai-demo-banner"><span class="ai-spark">✦</span><div><b>AI text check · demo</b><span>These sample suggestions run in this file. Connect your AI service later for context-aware corrections.</span></div><button class="ai-accept-all" ${suggestions.length ? "" : "disabled"}>Accept all suggestions</button></div>${suggestions.length ? `<div class="ai-suggestion-list">${suggestions.map((s) => `<article class="ai-suggestion" data-ai-card="${esc(s.id)}"><div class="ai-suggestion-copy"><span>${esc(s.field === "name" ? "Product name" : "Specifications")} · ${esc(s.name)}</span><del>${esc(s.before)}</del><b>${esc(s.after)}</b></div><div class="ai-suggestion-actions"><button class="secondary" data-ai-ignore="${esc(s.id)}">Keep original</button><button class="primary" data-ai-apply="${esc(s.id)}">Accept fix</button></div></article>`).join("")}</div>` : '<p class="ai-empty">No sample text fixes found. You can still edit any product manually below.</p>'}`;
    host
      .querySelectorAll<HTMLElement>("[data-ai-apply]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            applyAiSuggestions(
              b.dataset.aiApply ? [b.dataset.aiApply] : [],
              products,
            )),
      );
    host.querySelectorAll<HTMLElement>("[data-ai-ignore]").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.aiIgnore) aiIgnored.add(b.dataset.aiIgnore);
          renderAiSuggestions(products);
        }),
    );
    host
      .querySelector<HTMLElement>(".ai-accept-all")
      ?.addEventListener("click", () =>
        applyAiSuggestions(
          suggestions.map((s) => s.id),
          products,
        ),
      );
  }
  function applyAiSuggestions(ids: string[], products: ClassicProduct[]) {
    const byId = new Map(aiTextSuggestions(products).map((s) => [s.id, s]));
    let count = 0;
    for (const id of ids) {
      const s = byId.get(id),
        p = s && activeCampaign().products.find((x) => x.id === s.productId);
      if (p && s) {
        p[s.field] = s.after;
        count++;
      }
    }
    persist();
    note(
      `Applied ${count} text ${count === 1 ? "correction" : "corrections"}. Review the updated wording before downloading.`,
    );
    renderDetails();
  }
  function renderDetails() {
    const products = activeCampaign().products.filter((p) => p.included);
    const priceRow = (p: ClassicProduct) =>
      `<tr data-price-row="${p.id}"><td><strong>${esc(p.brand)} ${esc(p.name)}</strong><small>${esc(p.specs)}</small></td><td><label class="sr-only" for="regular-${p.id}">Regular price for ${esc(p.name)}</label><input id="regular-${p.id}" data-edit="${p.id}" data-field="regular" type="number" min="0" step="0.01" value="${esc(p.regular ?? "")}" inputmode="decimal"></td><td><label class="sr-only" for="campaign-${p.id}">Campaign price for ${esc(p.name)}</label><input id="campaign-${p.id}" data-edit="${p.id}" data-field="price" type="number" min="0" step="0.01" value="${esc(p.price ?? "")}" inputmode="decimal"></td><td><label class="sr-only" for="months-${p.id}">Installments in months for ${esc(p.name)}</label><input id="months-${p.id}" data-edit="${p.id}" data-field="months" type="number" min="0" step="1" value="${esc(p.months ?? 0)}" inputmode="numeric"></td><td class="price-math"><b data-savings>${valid(p) ? money(valid(p) ? p.regular - p.price : null) + " €" : "Check price"}</b><small data-monthly>${valid(p) && p.months > 0 ? money(Math.round((p.price / p.months) * 100) / 100) + " € / month" : "Optional"}</small></td></tr>`;
    root.innerHTML = `<div class="toolbar"><div><h3>Prices and product text</h3><p>Prices update as you type and save automatically. Product codes stay in your workspace, but are hidden from brochure pages.</p></div><div class="export-actions"><button class="secondary" id="tidy-text">Clean spacing in all text</button><button class="primary" id="preview-next">Preview brochure →</button></div></div><section class="price-review"><div class="price-review-head"><div><h3>Quick price check</h3><p>Edit prices right here—no need to open each product. Savings and monthly amounts calculate automatically.</p></div><span>${products.length} products</span></div><div class="table-wrap"><table class="price-review-table"><thead><tr><th>Product</th><th>Regular price (€)</th><th>Campaign price (€)</th><th>Months (optional)</th><th>Savings / monthly estimate</th></tr></thead><tbody>${products.map(priceRow).join("")}</tbody></table></div></section><section class="text-review"><div class="price-review-head"><div><h3>Spelling and product text</h3><p>Run the AI text check to review suggested spelling and formatting fixes before accepting them.</p></div><div class="ai-review-tools"><span>Review one at a time</span><button class="primary" id="run-ai-check">✦ Run AI text check</button></div></div><div class="spell-help"><b>AI text check · demo</b><span>This sample works in the HTML without an AI service. It offers cautious Albanian spelling and formatting suggestions for you to review. Connect an AI backend later for context-aware corrections. Product codes and model numbers are protected.</span></div><div id="ai-suggestions">${aiChecked ? "" : ""}</div><div class="detail-list">${products
      .map(
        (p) =>
          `<details class="detail-card"><summary><span class="detail-product">${esc(p.brand)} ${esc(p.name)}</span><span class="detail-state">${issues(p).some((x) => x === "Missing name") ? "Needs name" : "Edit text"} →</span></summary><div class="edit-grid">${(
            [
              ["name", "Product name"],
              ["brand", "Brand"],
              ["specs", "Specifications"],
              ["warranty", "Warranty (years)"],
              ["category", "Category"],
            ] satisfies Array<[string, string]>
          )
            .map(
              ([k, label]) =>
                `<label>${label}<${k === "specs" ? "textarea" : "input"} data-edit="${p.id}" data-field="${k}" ${["name", "specs"].includes(k) ? 'spellcheck="true" lang="sq"' : 'spellcheck="false"'} ${k === "specs" ? "" : `value="${esc(p[k])}"`} ${k === "warranty" ? 'type="number" min="0" step="1"' : ""}>${k === "specs" ? esc(p[k]) + "</textarea>" : ""}</label>`,
            )
            .join("")}</div></details>`,
      )
      .join("")}</div></section>`;
    if (aiChecked) renderAiSuggestions(products);
    $("#preview-next").onclick = () => go(3);
    $("#run-ai-check").onclick = () => {
      aiChecked = true;
      aiIgnored.clear();
      renderAiSuggestions(products);
    };
    $("#tidy-text").onclick = () => {
      let changed = 0;
      for (const p of activeCampaign().products) {
        for (const k of ["name", "brand", "specs"]) {
          const old = String(p[k] ?? ""),
            clean = old
              .replace(/\s+/g, " ")
              .trim()
              .replace(/\s+([,.;:])/g, "$1")
              .replace(/([,;])(?=\S)/g, "$1 ");
          if (clean !== old) {
            p[k] = clean;
            changed++;
          }
        }
      }
      persist();
      note(
        `Cleaned spacing in ${changed} text fields. Review spelling suggestions before publishing.`,
      );
      renderDetails();
    };
    root
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-edit]")
      .forEach(
        (input) =>
          (input.oninput = () => {
            const p = activeCampaign().products.find(
                (p) => p.id === input.dataset.edit,
              ),
              k = input.dataset.field;
            if (!p || !k) return;
            p[k] = ["regular", "price", "months", "warranty"].includes(k)
              ? number(input.value)
              : input.value;
            persist();
            const row = root.querySelector<HTMLElement>(
              `[data-price-row="${CSS.escape(p.id)}"]`,
            );
            if (row) {
              findIn(row, "[data-savings]").textContent = valid(p)
                ? money(valid(p) ? p.regular - p.price : null) + " €"
                : "Check prices";
              findIn(row, "[data-monthly]").textContent =
                valid(p) && p.months > 0
                  ? money(Math.round((p.price / p.months) * 100) / 100) +
                    " € / month"
                  : "Optional";
            }
            const copy = root.querySelector<HTMLElement>(
              `.detail-card [data-edit="${CSS.escape(p.id)}"][data-field="name"]`,
            );
            const summary = copy
              ?.closest("details")
              ?.querySelector<HTMLElement>("summary .detail-product");
            if (summary)
              summary.textContent = `${p.brand || ""} ${p.name || ""}`.trim();
          }),
      );
  }
  function tile(p: ClassicProduct) {
    return `<article class="brochure-tile">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : '<div class="missing-image">Image needed</div>'}<div class="specs">${String(
      p.specs,
    )
      .split(/[,;\n]/)
      .filter(Boolean)
      .slice(0, 3)
      .map((t) => `<span>${esc(t.trim())}</span>`)
      .join(
        "",
      )}</div><div class="tile-details"><div class="model-details"><b class="product-brand">${esc(p.brand)}</b><h3>${esc(p.name)}</h3><p>${p.warranty !== "" && p.warranty != null ? `${esc(p.warranty)} ${+p.warranty === 1 ? "VIT" : "VITE"} GARANCION` : ""}</p></div><div class="offer-details">${valid(p) ? `<span class="saving"><span>KURSENI</span><b>${money(valid(p) ? p.regular - p.price : null)}€</b></span><div class="old-price">Çmimi i rregullt: ${money(p.regular)} €</div><div class="price-tag"><div><span>Çmimi <i>haPPy</i></span><strong>${money(p.price)} €</strong></div>${p.months > 0 ? `<small>${p.months} x muaj: ${money(Math.round((p.price / p.months) * 100) / 100)} €</small>` : ""}</div>` : '<div class="notice">Check price</div>'}</div></div></article>`;
  }
  function pages() {
    const list = activeCampaign().products.filter((p) => p.included),
      template = activeCampaign().template || "classic",
      perPage = template === "mujore" ? 6 : 4,
      coverSrc = brochureTemplateCovers[template] || "assets/245bb00c3568.png";
    let html = list.length
      ? `<section class="brochure campaign-page cover-page cover-${template}"><img class="cover-page-image" src="${coverSrc}" alt="${esc(template === "classic" ? "Neptun brochure cover" : template === "bg" ? "Broshura BG cover" : "Broshura Mujore cover")}"></section>`
      : "";
    for (let i = 0; i < list.length; i += perPage) {
      const chunk = list.slice(i, i + perPage),
        cats = [...new Set(chunk.map((p) => p.category).filter(Boolean))];
      html += `<section class="brochure campaign-page template-${template}"><div class="brochure-head"><span>${esc(cats.length === 1 ? cats[0] : activeCampaign().category || "OFERTA")}</span><img src="assets/200c636dd054.png" alt="Blini online dhe në dyqan"></div><div class="page-campaign"><b>${esc(activeCampaign().name)}</b><span>${esc(activeCampaign().dates)}</span></div><div class="tiles">${chunk.map(tile).join("")}</div><div class="brochure-footer"><div><img src="assets/381662507fc2.png" alt="NEPTUN"></div><span></span><b>${i / perPage + 2}</b></div></section>`;
    }
    return html;
  }

  async function downloadTemplatePdf() {
    const selected = activeCampaign().products.filter((p) => p.included);
    if (!selected.length) return;
    const template = activeCampaign().template || "bg",
      button = $<HTMLButtonElement>("#download-pdf");
    button.disabled = true;
    const old = button.textContent,
      social = brochureFormat === "social",
      a3 = brochureFormat === "a3",
      W = social ? 1080 : 1240,
      H = social ? 1350 : 1754,
      scale = 2,
      perPage = template === "mujore" ? 6 : 4,
      pagesRef: number[] = [],
      objects: Array<PdfObject | null> = [null],
      enc = new TextEncoder(),
      mediaW = social ? 595 : a3 ? 841.89 : 595,
      mediaH = social ? 743.75 : a3 ? 1190.55 : 842,
      coverPath = brochureTemplateCovers[template],
      cache = new Map<string, Promise<HTMLImageElement>>();
    const loadImage = (src: string) => {
      const cached = cache.get(src);
      if (cached) return cached;
      const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () =>
          reject(Error("A brochure image could not be loaded."));
        im.src = src;
      });
      cache.set(src, promise);
      return promise;
    };
    function rounded(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | number[],
      color: string,
    ) {
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    }
    function setFont(
      c: CanvasRenderingContext2D,
      size: number,
      weight = "400",
      family = "Skola",
    ) {
      c.font = `${weight} ${size}px "${family}",Arial,sans-serif`;
    }
    function write(
      c: CanvasRenderingContext2D,
      value: unknown,
      x: number,
      y: number,
      size: number,
      color = "#fff",
      weight = "400",
      family = "Skola",
      align: CanvasTextAlign = "left",
      maxWidth?: number,
    ) {
      c.fillStyle = color;
      setFont(c, size, weight, family);
      c.textAlign = align;
      c.fillText(String(value ?? ""), x, y, maxWidth);
    }
    function wrapped(
      c: CanvasRenderingContext2D,
      value: unknown,
      x: number,
      y: number,
      maxWidth: number,
      size: number,
      color: string,
      weight = "400",
      family = "Skola",
      maxLines = 2,
    ) {
      const words = String(value ?? "").split(/\s+/),
        lines = [];
      let line = "";
      setFont(c, size, weight, family);
      for (const word of words) {
        const next = line ? line + " " + word : word;
        if (c.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      lines
        .slice(0, maxLines)
        .forEach((part, index) =>
          write(
            c,
            part,
            x,
            y + index * size * 1.2,
            size,
            color,
            weight,
            family,
            "left",
            maxWidth,
          ),
        );
      return Math.min(lines.length, maxLines);
    }
    function contain(
      c: CanvasRenderingContext2D,
      image: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number,
    ) {
      const ratio = Math.min(w / image.width, h / image.height),
        dw = image.width * ratio,
        dh = image.height * ratio;
      c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
    async function drawProductPage(
      c: CanvasRenderingContext2D,
      group: ClassicProduct[],
      pageIndex: number,
      online: HTMLImageElement,
      logo: HTMLImageElement,
    ) {
      const monthly = template === "mujore";
      c.fillStyle = monthly ? "#07549a" : "#e3e3e3";
      c.fillRect(0, 0, W, H);
      const headerH = monthly ? 92 : 70;
      if (monthly) {
        const gradient = c.createLinearGradient(0, 0, W, headerH);
        gradient.addColorStop(0, "#06447f");
        gradient.addColorStop(1, "#1682ba");
        c.fillStyle = gradient;
        c.fillRect(0, 0, W, headerH);
        write(
          c,
          "NEPTUN KOSOVO  ·  BROSHURË MUJORE",
          40,
          36,
          18,
          "#fff",
          "700",
          "Cera",
        );
        write(
          c,
          activeCampaign().category || "OFERTA",
          40,
          67,
          30,
          "#fff",
          "700",
          "Cera",
        );
        contain(c, online, W - 185, 100, 142, 84);
      } else {
        c.fillStyle = "#0084be";
        c.fillRect(0, 0, W, 70);
        rounded(c, 0, 12, W * 0.48, 48, [0, 22, 22, 0], "#0084be");
        const categories = [
          ...new Set(group.map((p) => p.category).filter(Boolean)),
        ];
        write(
          c,
          categories.length === 1
            ? categories[0]
            : activeCampaign().category || "OFERTA",
          38,
          45,
          27,
          "#fff",
          "700",
        );
        contain(c, online, W - 150, 83, 105, 75);
      }
      write(
        c,
        activeCampaign().name,
        42,
        monthly ? 130 : 132,
        monthly ? 25 : 20,
        monthly ? "#fff" : "#143958",
        "700",
        "Cera",
      );
      if (activeCampaign().dates)
        write(
          c,
          activeCampaign().dates,
          42,
          monthly ? 160 : 160,
          monthly ? 18 : 17,
          monthly ? "#eaf4ff" : "#475b69",
        );
      const columns = monthly ? 3 : 2,
        rows = Math.ceil(group.length / columns),
        margin = monthly ? 32 : 38,
        gapX = monthly ? 18 : 32,
        gapY = monthly ? 22 : 25,
        footerSpace = monthly ? 105 : 90,
        top = monthly ? 205 : 205,
        cardW = (W - margin * 2 - gapX * (columns - 1)) / columns,
        cardH = (H - top - footerSpace - gapY * (rows - 1)) / rows,
        photoH = monthly
          ? Math.min(265, cardH * 0.4)
          : Math.min(300, cardH * 0.45);
      for (let i = 0; i < group.length; i++) {
        const p = group[i];
        if (!p) continue;
        const col = i % columns,
          row = Math.floor(i / columns),
          x = margin + col * (cardW + gapX),
          y = top + row * (cardH + gapY),
          pad = monthly ? 12 : 15;
        rounded(
          c,
          x,
          y,
          cardW,
          cardH,
          monthly ? 10 : 4,
          monthly ? "#0d62a7" : "#eeeeee",
        );
        rounded(c, x + pad, y + pad, cardW - pad * 2, photoH, 6, "#fff");
        if (p.image)
          contain(
            c,
            await loadImage(p.image),
            x + pad + 8,
            y + pad + 8,
            cardW - pad * 2 - 16,
            photoH - 16,
          );
        else {
          write(
            c,
            "IMAGE NEEDED",
            x + cardW / 2,
            y + pad + photoH / 2,
            16,
            monthly ? "#637c8e" : "#667986",
            "500",
            "Skola",
            "center",
          );
        }
        const textColor = monthly ? "#fff" : "#29333b",
          muted = monthly ? "#d9ecf9" : "#4c5d69",
          afterPhoto = y + pad + photoH + 14,
          specs = String(p.specs || "")
            .split(/[,;\n]/)
            .map((a) => a.trim())
            .filter(Boolean)
            .slice(0, 3),
          specHeight = monthly ? 35 : 42,
          specGap = 5,
          specW = (cardW - pad * 2 - specGap * 2) / 3;
        for (let j = 0; j < specs.length; j++) {
          const sx = x + pad + j * (specW + specGap);
          rounded(
            c,
            sx,
            afterPhoto,
            specW,
            specHeight,
            3,
            monthly ? "#fff" : "#fff",
          );
          if (!monthly) {
            c.strokeStyle = "#00386d";
            c.lineWidth = 1;
            c.stroke();
          }
          wrapped(
            c,
            specs[j],
            sx + 5,
            afterPhoto + 15,
            specW - 10,
            monthly ? 10 : 11,
            monthly ? "#174c77" : "#344554",
            "300",
            "Skola",
            2,
          );
        }
        const brandY = afterPhoto + specHeight + (monthly ? 20 : 29);
        write(
          c,
          p.brand || "",
          x + pad,
          brandY,
          monthly ? 20 : 25,
          monthly ? "#fff" : "#333",
          "900",
        );
        const titleY = brandY + (monthly ? 24 : 28),
          nameLines = wrapped(
            c,
            p.name,
            x + pad,
            titleY,
            cardW - pad * 2,
            monthly ? 15 : 17,
            textColor,
            "500",
            "Skola",
            2,
          );
        const warrantyY = titleY + nameLines * (monthly ? 18 : 20) + 14;
        if (p.warranty !== "" && p.warranty != null)
          write(
            c,
            `${p.warranty} ${+p.warranty === 1 ? "VIT" : "VITE"} GARANCION`,
            x + pad,
            warrantyY,
            monthly ? 11 : 13,
            muted,
            "400",
          );
        const priceY = y + cardH - (monthly ? 118 : 130),
          priceX = monthly ? x + pad : x + cardW * 0.56,
          priceW = monthly ? cardW - pad * 2 : cardW * 0.4;
        if (valid(p)) {
          if (monthly) {
            const badgeR = 40,
              bx = x + cardW - pad - badgeR,
              by = y + pad + badgeR;
            c.beginPath();
            c.fillStyle = "#e9322b";
            c.arc(bx, by, badgeR, 0, Math.PI * 2);
            c.fill();
            write(c, "SAVE", bx, by - 6, 11, "#fff", "400", "Skola", "center");
            write(
              c,
              `${money((+p.regular || 0) - (+p.price || 0))}€`,
              bx,
              by + 17,
              18,
              "#fff",
              "900",
              "Skola",
              "center",
            );
            write(
              c,
              `${money(+p.regular || 0)} €`,
              priceX + priceW,
              priceY + 15,
              15,
              "#d6e4ed",
              "400",
              "Skola",
              "right",
            );
            c.strokeStyle = "#fff";
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(priceX + priceW - 58, priceY + 9);
            c.lineTo(priceX + priceW, priceY + 9);
            c.stroke();
            rounded(c, priceX, priceY + 24, priceW, 79, 7, "#ed382c");
            write(
              c,
              "ÇMIMI haPPy",
              priceX + 10,
              priceY + 44,
              12,
              "#fff",
              "400",
              "Cera",
            );
            write(
              c,
              `${money(p.price)} €`,
              priceX + 10,
              priceY + 78,
              29,
              "#fff",
              "900",
              "Skola",
            );
            if (+p.months > 0)
              write(
                c,
                `${p.months} x muaj: ${money(Math.round((+p.price / +p.months) * 100) / 100)} €`,
                priceX + priceW - 8,
                priceY + 98,
                11,
                "#fff",
                "400",
                "Skola",
                "right",
              );
          } else {
            rounded(
              c,
              priceX + priceW * 0.24,
              priceY - 72,
              priceW * 0.76,
              62,
              2,
              "#00386d",
            );
            write(
              c,
              "KURSENI",
              priceX + priceW * 0.32,
              priceY - 49,
              12,
              "#fff",
              "400",
            );
            write(
              c,
              `${money((+p.regular || 0) - (+p.price || 0))}€`,
              priceX + priceW * 0.32,
              priceY - 23,
              24,
              "#fff",
              "900",
            );
            c.fillStyle = "#ededed";
            c.fillRect(priceX, priceY - 3, priceW, 27);
            write(
              c,
              `Çmimi i rregullt: ${money(+p.regular || 0)} €`,
              priceX + priceW / 2,
              priceY + 15,
              11,
              "#263746",
              "400",
              "Skola",
              "center",
              priceW - 8,
            );
            rounded(
              c,
              priceX,
              priceY + 27,
              priceW,
              77,
              [0, 0, 13, 13],
              "#00386d",
            );
            write(
              c,
              "Çmimi haPPy",
              priceX + 10,
              priceY + 48,
              12,
              "#fff",
              "400",
              "Cera",
            );
            write(
              c,
              `${money(p.price)} €`,
              priceX + 10,
              priceY + 80,
              26,
              "#fff",
              "900",
            );
            if (+p.months > 0)
              write(
                c,
                `${p.months} x muaj: ${money(Math.round((+p.price / +p.months) * 100) / 100)} €`,
                priceX + priceW - 8,
                priceY + 98,
                10,
                "#fff",
                "400",
                "Skola",
                "right",
              );
          }
        } else {
          rounded(c, priceX, priceY, priceW, 55, 4, "#fff4d9");
          write(
            c,
            "CHECK PRICE",
            priceX + priceW / 2,
            priceY + 34,
            15,
            "#8a6817",
            "700",
            "Skola",
            "center",
          );
        }
      }
      const footerY = H - 80;
      if (monthly) {
        contain(c, logo, 30, footerY, 160, 45);
        write(
          c,
          activeCampaign().dates || activeCampaign().name,
          W - 32,
          footerY + 32,
          14,
          "#fff",
          "500",
          "Skola",
          "right",
          W - 230,
        );
        write(
          c,
          String(pageIndex + 1),
          W - 35,
          H - 16,
          18,
          "#fff",
          "400",
          "Skola",
          "right",
        );
      } else {
        c.fillStyle = "#00386d";
        c.fillRect(0, footerY, 220, 77);
        contain(c, logo, 14, footerY + 12, 190, 49);
        c.fillStyle = "#00386d";
        c.fillRect(243, footerY + 37, W - 330, 2);
        write(
          c,
          String(pageIndex + 1),
          W - 35,
          footerY + 59,
          25,
          "#00386d",
          "400",
          "Skola",
          "right",
        );
      }
    }
    try {
      await document.fonts.ready;
      const online = await loadImage("assets/200c636dd054.png"),
        logo = await loadImage("assets/381662507fc2.png"),
        cover = await loadImage(coverPath ?? "assets/245bb00c3568.png");
      for (
        let pageIndex = 0;
        pageIndex <= Math.ceil(selected.length / perPage);
        pageIndex++
      ) {
        const isCover = pageIndex === 0,
          group = isCover
            ? []
            : selected.slice((pageIndex - 1) * perPage, pageIndex * perPage);
        button.textContent = `Preparing page ${pageIndex + 1} of ${Math.ceil(selected.length / perPage) + 1}…`;
        await new Promise((resolve) => setTimeout(resolve, 0));
        const canvas = document.createElement("canvas");
        canvas.width = W * scale;
        canvas.height = H * scale;
        const c = canvasContext(canvas);
        c.scale(scale, scale);
        if (isCover) {
          const factor = Math.max(W / cover.width, H / cover.height),
            dw = cover.width * factor,
            dh = cover.height * factor;
          c.drawImage(cover, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else await drawProductPage(c, group, pageIndex, online, logo);
        const raw = atob(imageData(canvas.toDataURL("image/jpeg", 0.96))),
          data = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
        const pageNum: number = 3 + pagesRef.length * 3,
          imageNum = pageNum + 2,
          content = enc.encode(
            `q\n${mediaW} 0 0 ${mediaH} 0 0 cm\n/Im0 Do\nQ\n`,
          );
        objects[pageNum] = enc.encode(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mediaW} ${mediaH}] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${pageNum + 1} 0 R >>`,
        );
        objects[pageNum + 1] = enc.encode(
          `<< /Length ${content.length} >>\nstream\n${new TextDecoder().decode(content)}endstream`,
        );
        objects[imageNum] = {
          head: enc.encode(
            `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
          ),
          data,
          tail: enc.encode("\nendstream"),
        };
        pagesRef.push(pageNum);
      }
      objects[1] = enc.encode("<< /Type /Catalog /Pages 2 0 R >>");
      objects[2] = enc.encode(
        `<< /Type /Pages /Kids [${pagesRef.map((n) => `${n} 0 R`).join(" ")}] /Count ${pagesRef.length} >>`,
      );
      const parts = [enc.encode("%PDF-1.4\n%Neptun\n")],
        offsets = [0];
      let length = parts.reduce((sum, part) => sum + part.length, 0);
      for (let i = 1; i < objects.length; i++) {
        offsets[i] = length;
        const prefix = enc.encode(`${i} 0 obj\n`),
          object = objects[i],
          chunks = [prefix];
        if (!object) throw new Error("A PDF object is missing.");
        if ("head" in object)
          chunks.push(object.head, object.data, object.tail);
        else chunks.push(object, enc.encode("\nendobj\n"));
        if ("head" in object) chunks.push(enc.encode("\nendobj\n"));
        for (const part of chunks) {
          parts.push(part);
          length += part.length;
        }
      }
      const xref = length;
      let table = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i++)
        table += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
      parts.push(
        enc.encode(
          `${table}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
        ),
      );
      const url = URL.createObjectURL(
          new Blob(parts, { type: "application/pdf" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = filename(activeCampaign().name) + "-" + template + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      note(
        `Downloaded ${pagesRef.length}-page ${template === "bg" ? "Broshura BG" : "Broshura Mujore"} ${social ? "social" : a3 ? "A3" : "A4"} PDF.`,
      );
    } catch (error) {
      note("PDF could not be created: " + errorMessage(error), true);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }
  async function downloadPdf() {
    if ((activeCampaign().template || "classic") !== "classic")
      return downloadTemplatePdf();
    const selected = activeCampaign().products.filter((p) => p.included);
    if (!selected.length) return;
    const button = $<HTMLButtonElement>("#download-pdf");
    button.disabled = true;
    const old = button.textContent;
    const social = brochureFormat === "social",
      a3 = brochureFormat === "a3",
      W = social ? 1080 : a3 ? 1754 : 1240,
      H = social ? 1350 : a3 ? 2480 : 1754,
      scale = Math.min(W / 1240, H / 1754),
      rasterScale = 2,
      enc = new TextEncoder(),
      objects: Array<PdfObject | null> = [null],
      pagesRef: number[] = [];
    const asset = (sel: string): HTMLImageElement => $<HTMLImageElement>(sel);
    const images = new Map<string, Promise<HTMLImageElement>>();
    const loadImage = (src: string) => {
      const cached = images.get(src);
      if (cached) return cached;
      const promise = new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () =>
          reject(Error("Could not read a product or Neptun brand image."));
        im.src = src;
      });
      images.set(src, promise);
      return promise;
    };
    function round(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | number[],
      color: string,
    ) {
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    }
    function text(
      c: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
      size: number,
      color = "#202b34",
      weight = "400",
      font = "Skola",
    ) {
      c.fillStyle = color;
      c.font = `${weight} ${size}px "${font}",Arial,sans-serif`;
      c.fillText(String(value ?? ""), x, y);
    }
    function wrap(
      c: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
      max: number,
      size: number,
      color = "#222",
      weight = "400",
      font = "Skola",
      maxLines = 3,
    ) {
      c.fillStyle = color;
      c.font = `${weight} ${size}px "${font}",Arial,sans-serif`;
      let line = "";
      const lines: string[] = [];
      for (const word of String(value ?? "").split(/\s+/)) {
        const next = line ? line + " " + word : word;
        if (c.measureText(next).width > max && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      lines
        .slice(0, maxLines)
        .forEach((l, i) => c.fillText(l, x, y + i * size * 1.25));
      return Math.min(lines.length, maxLines);
    }
    function centeredWrap(
      c: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
      w: number,
      h: number,
      size: number,
      color = "#344554",
      weight = "300",
      font = "Skola",
      maxLines = 2,
    ) {
      c.fillStyle = color;
      c.font = `${weight} ${size}px "${font}",Arial,sans-serif`;
      let line = "";
      let lines: string[] = [];
      for (const word of String(value ?? "").split(/\s+/)) {
        const next = line ? line + " " + word : word;
        if (c.measureText(next).width > w && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      lines = lines.slice(0, maxLines);
      const lineHeight = size * 1.25,
        startY = y + (h - lines.length * lineHeight) / 2 + size,
        prior = c.textAlign;
      c.textAlign = "center";
      lines.forEach((part, i) =>
        c.fillText(part, x + w / 2, startY + i * lineHeight),
      );
      c.textAlign = prior;
    }
    function contain(
      c: CanvasRenderingContext2D,
      img: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number,
    ) {
      const scale = Math.min(w / img.width, h / img.height),
        iw = img.width * scale,
        ih = img.height * scale;
      c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
    try {
      await document.fonts.ready;
      const online = await loadImage(asset(".brochure-head img").src),
        logo = await loadImage(asset(".brochure-footer img").src),
        coverPage = await loadImage(asset(".cover-page-image").src);
      for (let start = -4; start < selected.length; start += 4) {
        const cover = start < 0;
        button.textContent = `Preparing page ${pagesRef.length + 1} of ${Math.ceil(selected.length / 4) + 1}…`;
        await new Promise((r) => setTimeout(r, 0));
        const group = cover ? [] : selected.slice(start, start + 4),
          canvas = document.createElement("canvas");
        canvas.width = W * rasterScale;
        canvas.height = H * rasterScale;
        const c = canvasContext(canvas);
        c.scale(rasterScale, rasterScale);
        if ((social || a3) && !cover) {
          c.save();
          c.translate((W - 1240 * scale) / 2, (H - 1754 * scale) / 2);
          c.scale(scale, scale);
        }
        if (cover) {
          const coverScale = Math.max(
              W / coverPage.width,
              H / coverPage.height,
            ),
            coverW = coverPage.width * coverScale,
            coverH = coverPage.height * coverScale;
          c.drawImage(
            coverPage,
            (W - coverW) / 2,
            (H - coverH) / 2,
            coverW,
            coverH,
          );
        } else {
          c.fillStyle = "#e3e3e3";
          c.fillRect(0, 0, W, H);
          round(c, 0, 0, W, 70, 0, "#0084be");
          const cats = [
            ...new Set(group.map((p) => p.category).filter(Boolean)),
          ];
          text(
            c,
            cats.length === 1
              ? (cats[0] ?? "OFERTA")
              : activeCampaign().category || "OFERTA",
            38,
            46,
            27,
            "#fff",
            "700",
          );
          contain(c, online, W - 150, 84, 105, 75);
          text(c, activeCampaign().name, 50, 132, 20, "#143958", "700", "Cera");
          if (activeCampaign().dates)
            text(c, activeCampaign().dates, 50, 160, 17, "#475b69");
          const y0 = 205,
            gapX = 32,
            gapY = 25,
            cardW = 563,
            cardH = 686;
          for (let j = 0; j < group.length; j++) {
            const p = group[j];
            if (!p) continue;
            const col = j % 2,
              row = Math.floor(j / 2),
              x = 38 + col * (cardW + gapX),
              y = y0 + row * (cardH + gapY);
            round(c, x, y, cardW, cardH, 8, "#f8f8f8");
            if (p.image) {
              const im = await loadImage(p.image);
              contain(c, im, x + 35, y + 25, cardW - 70, 310);
            } else {
              round(c, x + 35, y + 25, cardW - 70, 310, 5, "#eeeeee");
              c.strokeStyle = "#9aafbd";
              c.setLineDash([10, 8]);
              c.strokeRect(x + 35, y + 25, cardW - 70, 310);
              c.setLineDash([]);
              text(
                c,
                "IMAGE NEEDED",
                x + cardW / 2 - 65,
                y + 190,
                21,
                "#667986",
                "500",
              );
            }
            const specs = String(p.specs || "")
              .split(/[,;\n]/)
              .map((a) => a.trim())
              .filter(Boolean)
              .slice(0, 3);
            const specY = y + 350,
              specGap = 8,
              specW = (cardW - 40 - 2 * specGap) / 3;
            specs.forEach((sp, k) => {
              round(
                c,
                x + 20 + k * (specW + specGap),
                specY,
                specW,
                59,
                5,
                "#fff",
              );
              c.strokeStyle = "#00386d";
              c.lineWidth = 1.5;
              c.stroke();
              centeredWrap(
                c,
                sp,
                x + 20 + k * (specW + specGap),
                specY,
                specW,
                59,
                15,
                "#344554",
                "300",
                "Skola",
                2,
              );
            });
            text(c, p.brand || "", x + 23, y + 448, 29, "#363636", "900");
            wrap(
              c,
              p.name,
              x + 23,
              y + 482,
              cardW - 46,
              19,
              "#313131",
              "500",
              "Skola",
              2,
            );
            if (p.warranty !== "" && p.warranty != null)
              text(
                c,
                `${p.warranty} ${+p.warranty === 1 ? "VIT" : "VITE"} GARANCION`,
                x + 23,
                y + 532,
                15,
              );
            const bx = x + 330,
              by = y + 432,
              bw = cardW - 350;
            round(c, bx + 55, by, bw - 55, 67, 3, "#00386d");
            text(c, "KURSENI", bx + 68, by + 21, 14, "#fff", "400");
            text(
              c,
              `${money(valid(p) ? p.regular - p.price : null)}€`,
              bx + 68,
              by + 51,
              30,
              "#fff",
              "900",
            );
            c.fillStyle = "#ededed";
            c.fillRect(bx, by + 67, bw, 34);
            text(
              c,
              `Çmimi i rregullt: ${money(p.regular)} €`,
              bx + 8,
              by + 89,
              14,
            );
            c.save();
            c.shadowColor = "rgba(0,0,0,.24)";
            c.shadowBlur = 13;
            c.shadowOffsetX = 4;
            c.shadowOffsetY = 7;
            round(c, bx, by + 101, bw, 92, [0, 0, 16, 16], "#00386d");
            c.restore();
            text(
              c,
              "Çmimi haPPy",
              bx + 12,
              by + 126,
              14,
              "#fff",
              "400",
              "Cera",
            );
            wrap(
              c,
              `${money(p.price)} €`,
              bx + 12,
              by + 163,
              bw - 24,
              38,
              "#fff",
              "900",
              "Skola",
              1,
            );
            if (valid(p) && p.months > 0)
              text(
                c,
                `${p.months} x muaj: ${money(Math.round((p.price / p.months) * 100) / 100)} €`,
                bx + 12,
                by + 184,
                14,
                "#fff",
              );
          }
          const fy = 1640;
          c.fillStyle = "#00386d";
          c.fillRect(0, fy, 220, 77);
          contain(c, logo, 14, fy + 12, 190, 49);
          c.fillRect(243, fy + 37, W - 330, 2);
          text(
            c,
            String(Math.floor(start / 4) + 2),
            W - 65,
            fy + 59,
            25,
            "#00386d",
            "400",
          );
        }
        if ((social || a3) && !cover) c.restore();
        const jpeg = canvas.toDataURL("image/jpeg", 0.96),
          raw = atob(imageData(jpeg)),
          data = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
        const pageNum: number = 3 + pagesRef.length * 3,
          imageNum = pageNum + 2,
          pageW = a3 ? 841.89 : 595,
          pageH = social ? 743.75 : a3 ? 1190.55 : 842,
          content = enc.encode(`q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`);
        objects[pageNum] = enc.encode(
          `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${pageNum + 1} 0 R >>`,
        );
        objects[pageNum + 1] = enc.encode(
          `<< /Length ${content.length} >>\nstream\n${new TextDecoder().decode(content)}endstream`,
        );
        objects[imageNum] = {
          head: enc.encode(
            `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
          ),
          data,
          tail: enc.encode("\nendstream"),
        };
        pagesRef.push(pageNum);
        note(
          `Prepared page ${pagesRef.length} of ${Math.ceil(selected.length / 4) + 1}…`,
        );
      }
      objects[1] = enc.encode("<< /Type /Catalog /Pages 2 0 R >>");
      objects[2] = enc.encode(
        `<< /Type /Pages /Kids [${pagesRef.map((n) => `${n} 0 R`).join(" ")}] /Count ${pagesRef.length} >>`,
      );
      const parts = [enc.encode("%PDF-1.4\n%Neptun\n")],
        offsets = [0];
      let length = parts.reduce((sum, part) => sum + part.length, 0);
      for (let i = 1; i < objects.length; i++) {
        offsets[i] = length;
        const prefix = enc.encode(`${i} 0 obj\n`),
          o = objects[i],
          chunks = [prefix];
        if (!o) throw new Error("A PDF object is missing.");
        if ("head" in o) chunks.push(o.head, o.data, o.tail);
        else chunks.push(o, enc.encode("\nendobj\n"));
        if ("head" in o) chunks.push(enc.encode("\nendobj\n"));
        for (const part of chunks) {
          parts.push(part);
          length += part.length;
        }
      }
      const xref = length;
      let table = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
      for (let i = 1; i < objects.length; i++)
        table += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
      const tail = enc.encode(
        `${table}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
      );
      parts.push(tail);
      const blob = new Blob(parts, { type: "application/pdf" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = filename(activeCampaign().name) + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      note(
        `Downloaded ${pagesRef.length}-page ${social ? "1080 × 1350 social" : a3 ? "A3" : "A4"} ${selected.some((p) => issues(p).length) ? "draft " : ""}PDF.`,
      );
    } catch (err) {
      note("PDF could not be created: " + errorMessage(err), true);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function renderPreview() {
    const list = activeCampaign().products.filter((p) => p.included),
      blocked = list.filter((p) => issues(p).length),
      template = activeCampaign().template || "classic",
      templateName =
        template === "bg"
          ? "Broshura BG"
          : template === "mujore"
            ? "Broshura Mujore"
            : "Current Neptun template";
    root.innerHTML = `<div class="toolbar"><div><h3>Your brochure preview</h3><p>${list.length} products · ${pageCount(list, template)} pages · ${blocked.length} products need review</p></div><div class="export-actions"><label class="format-picker">Brochure design<select id="brochure-template" aria-label="Choose brochure design"><option value="classic" ${template === "classic" ? "selected" : ""}>Current Neptun template</option><option value="bg" ${template === "bg" ? "selected" : ""}>Broshura BG</option><option value="mujore" ${template === "mujore" ? "selected" : ""}>Broshura Mujore</option></select></label><label class="format-picker">Export size<select id="brochure-format"><option value="a4" ${brochureFormat === "a4" ? "selected" : ""}>A4 · print</option><option value="a3" ${brochureFormat === "a3" ? "selected" : ""}>A3 · print</option><option value="social" ${brochureFormat === "social" ? "selected" : ""}>1080 × 1350 px · social</option><option value="web" ${brochureFormat === "web" ? "selected" : ""}>Responsive · web</option></select></label><button class="primary" id="download-pdf" ${!list.length ? "disabled" : ""}>Download ${brochureFormat === "social" ? "social" : brochureFormat === "web" ? "web" : brochureFormat.toUpperCase()} ${blocked.length ? "draft " : ""}PDF</button><button class="secondary" id="print" ${!list.length ? "disabled" : ""}>Print ${brochureFormat === "social" ? "social size" : brochureFormat.toUpperCase()}</button><button class="secondary" id="download-html" ${!list.length ? "disabled" : ""}>Download ${brochureFormat === "web" ? "web" : brochureFormat === "social" ? "social" : brochureFormat.toUpperCase()} ${blocked.length ? "draft " : ""}brochure</button></div></div>${blocked.length ? '<div class="notice">Preview includes unfinished products. Before downloading, add and approve images and correct missing names, codes or invalid prices. Exclude unwanted products in Product list.</div>' : ""}<p class="local-note" id="format-note"></p><div id="print-page" class="format-${brochureFormat} template-${template}">${pages() || '<div class="empty">Include products to preview a brochure.</div>'}</div>`;
    const updateNote = () => {
      $("#format-note").textContent =
        `${templateName} · ${brochureFormat === "a4" ? "A4 portrait" : brochureFormat === "a3" ? "A3 portrait" : brochureFormat === "social" ? "1080 × 1350 px · 4:5 portrait pages" : "Responsive web edition"}. ${template === "mujore" ? "Uses the monthly flyer design with six products per inside page." : template === "bg" ? "Uses the Broshura BG cover and four-product inside pages." : "The current Neptun brochure design remains unchanged."} Installment values are estimates; confirm financing terms before publishing.`;
    };
    updateNote();
    $<HTMLSelectElement>("#brochure-template").onchange = (e) => {
      const select = e.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      activeCampaign().template = select.value;
      brochureFormat =
        select.value === "bg"
          ? "social"
          : select.value === "mujore"
            ? "a3"
            : "a4";
      persist();
      renderPreview();
    };
    $<HTMLSelectElement>("#brochure-format").onchange = (e) => {
      const select = e.currentTarget;
      if (!(select instanceof HTMLSelectElement)) return;
      brochureFormat = select.value;
      renderPreview();
    };
    $("#download-pdf").onclick = downloadPdf;
    $("#print").onclick = () => {
      document.title = activeCampaign().name;
      const style =
        $("#format-print-style") ||
        document.head.appendChild(
          Object.assign(document.createElement("style"), {
            id: "format-print-style",
          }),
        );
      style.textContent =
        brochureFormat === "social"
          ? "@media print{@page{size:8.26in 10.33in;margin:0}}"
          : `@media print{@page{size:${brochureFormat === "a3" ? "A3" : "A4"} portrait;margin:10mm}}`;
      window.print();
    };
    $("#download-html").onclick = async () => {
      try {
        let css = $("#embedded-styles")?.textContent;
        if (!css) css = await (await fetch("/styles.css")).text();
        const inlineAsset = async (path: string | URL | Request) => {
          const response = await fetch(path);
          if (!response.ok) throw Error("Could not package a brochure image.");
          const blob = await response.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("The brochure image could not be encoded."));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        };
        const assets = new Map<string, string>(),
          getAsset = async (path: string): Promise<string> => {
            if (!assets.has(path)) assets.set(path, await inlineAsset(path));
            const image = assets.get(path);
            if (!image) throw new Error("A brochure asset is missing.");
            return image;
          };
        for (const match of [
          ...css.matchAll(/url\(["']?(assets\/[^)"']+)["']?\)/g),
        ])
          css = css.replaceAll(
            match[0],
            `url("${await getAsset(match[1] ?? "")}")`,
          );
        let brochureMarkup = pages();
        for (const image of root.querySelectorAll<HTMLElement>(
          "#print-page img",
        )) {
          const src = image.getAttribute("src");
          if (src && src.startsWith("assets/"))
            brochureMarkup = brochureMarkup.replaceAll(
              src,
              await getAsset(src),
            );
        }
        const webStyle =
          brochureFormat === "web"
            ? ".campaign-page{max-width:1000px;width:100%;margin:0 auto 28px;break-after:auto;page-break-after:auto}.campaign-page .tiles{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.campaign-page .brochure-tile>img{height:190px}.campaign-page .brochure-tile h3{font-size:15px}.campaign-page .specs{font-size:11px}"
            : brochureFormat === "social"
              ? ".campaign-page{max-width:540px;aspect-ratio:4/5;overflow:hidden;padding:18px}.campaign-page .brochure-head{font-size:18px}.campaign-page .tiles{gap:14px;margin-top:16px}.campaign-page .brochure-tile>img{height:115px}.campaign-page .brochure-tile h3{font-size:11px}.campaign-page .campaign-footer{margin-top:auto}"
              : "";
        const paper = brochureFormat === "a3" ? "A3 portrait" : "A4 portrait",
          html = `<!doctype html><html lang="sq"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(activeCampaign().name)} · ${templateName}</title><style>${css}</style><style>body{background:#fff}.campaign-page{margin:20px auto}body>main{padding:0}${webStyle}@media print{@page{size:${brochureFormat === "social" ? "8.26in 10.33in" : paper};margin:${brochureFormat === "social" ? "0" : "10mm"}}body>main,main>section.campaign-page{display:block!important}.campaign-page{margin:0}}</style><body><main id="print-page" class="format-${brochureFormat} template-${template}">${brochureMarkup}</main></body></html>`;
        download(
          filename(activeCampaign().name) +
            "-" +
            template +
            "-" +
            brochureFormat +
            ".html",
          html,
          "text/html",
        );
      } catch {
        note(
          "Open the single-file presentation to download an offline brochure.",
          true,
        );
      }
    };
  }
  async function init() {
    try {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("neptun-brochures-v1", 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore("campaigns", { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db = database;
      library = await new Promise<ClassicCampaign[]>((resolve, reject) => {
        const r = database
          .transaction("campaigns")
          .objectStore("campaigns")
          .getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const demo = library.filter(
        (c) => c.name === "Neptun example — September",
      );
      if (demo.length) {
        await new Promise((resolve, reject) => {
          const t = database.transaction("campaigns", "readwrite"),
            store = t.objectStore("campaigns");
          demo.forEach((c) => store.delete(c.id));
          t.oncomplete = resolve;
          t.onerror = () => reject(t.error);
        });
        library = library.filter((c) => !demo.some((d) => d.id === c.id));
      }
    } catch {
      note(
        "Browser storage is unavailable. Download backups before closing.",
        true,
      );
    }
    current = null;
    document
      .querySelectorAll<HTMLElement>("[data-stage]")
      .forEach((b) => (b.onclick = () => go(Number(b.dataset.stage ?? 0))));
    $("#workflow-toggle").onclick = () =>
      setWorkflowOpen(
        $("#workflow-toggle").getAttribute("aria-expanded") !== "true",
      );
    document
      .querySelectorAll<HTMLElement>('a[href="#workflow"]')
      .forEach((a) => a.addEventListener("click", () => setWorkflowOpen(true)));
    document.querySelectorAll<HTMLElement>("[data-workflow-stage]").forEach(
      (b) =>
        (b.onclick = () => {
          go(Number(b.dataset.workflowStage ?? 0));
          setWorkflowOpen(false);
          $("#studio").scrollIntoView({ behavior: "smooth", block: "start" });
        }),
    );
    $("#workflow-open").onclick = () => {
      setWorkflowOpen(false);
      $("#studio").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    go(0);
    if (sharedToken()) await connectSharedWorkspace(sharedToken(), true);
  }
  init().finally(() => {
    resetInitialScroll();
    setTimeout(resetInitialScroll, 120);
  });
}
