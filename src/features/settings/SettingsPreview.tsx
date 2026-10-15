import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Product, Campaign } from "../../domain/models";
import type { WorkspaceSettings } from "./settings.schema";
import { workspaceSettingsSchema } from "./settings.schema";
import { campaignDefaults, defaultCampaignType } from "./campaign-defaults";
import { CoverPage, ProductPage, StoresPage } from "../brochure/Brochure";
import { resolveBrochureFormat } from "../brochure/brochureFormat";
import { splitPages } from "../brochure/campaignPages";
import { productCategoryPath } from "./categoryHierarchy";
import { Modal } from "../brochure/Modals";
import type { CSSProperties, ReactNode } from "react";

const illustrativePhoto = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="310" viewBox="0 0 480 310"><rect x="30" y="25" width="420" height="245" rx="12" fill="#17283e"/><rect x="42" y="37" width="396" height="219" rx="5" fill="#55afd0"/><path d="M42 210L180 80L295 200L370 95L438 185V256H42Z" fill="#2174a4"/><path d="M170 280H310L330 297H150Z" fill="#394957"/></svg>')}`;

/** An in-memory illustration only. Preview prices/products are never saved. */
export function settingsPreviewCampaign(
  settings: WorkspaceSettings,
  catalog: Product[] = [],
  categoryPath = "",
): Campaign {
  const images = catalog.filter((product) =>
    Boolean(product.image || product.localImage || product.imageUrl),
  );
  const matching = images.filter((product) => {
    const path = productCategoryPath(product).toLocaleLowerCase();
    return (
      path === categoryPath.toLocaleLowerCase() ||
      path.startsWith(`${categoryPath.toLocaleLowerCase()} > `)
    );
  });
  const tvs = images.filter((product) => /TV/i.test(product.name));
  const samples = categoryPath ? matching : tvs.length ? tvs : images;
  const type = defaultCampaignType(settings);
  const products = Array.from({ length: 9 }, (_, index): Product => {
    const source = samples[index % Math.max(1, samples.length)];
    return {
      code: `PREVIEW-${index + 1}`,
      name: source?.name || "TV LED · Sample product",
      brand: source?.brand || "NEPTUN",
      category: source?.category || categoryPath.split(" > ")[0] || "TV",
      subcategory:
        source?.subcategory || categoryPath.split(" > ").at(-1) || "TV",
      categoryPath: source?.categoryPath || categoryPath,
      image:
        source?.image ||
        source?.localImage ||
        source?.imageUrl ||
        illustrativePhoto,
      regular:
        categoryPath && Number(source?.regular) > 0
          ? Number(source?.regular)
          : 399,
      sale:
        categoryPath && Number(source?.regular) > 0
          ? Math.round(Number(source?.regular) * 0.75 * 100) / 100
          : 299,
      warranty: source?.warranty || "24 muaj",
      ...(categoryPath && source?.specs && Object.keys(source.specs).length
        ? { specs: source.specs }
        : {
            brochureDetails: categoryPath
              ? ["Editable details", "Sample feature"]
              : ["Google TV", "4K UHD", "Wi-Fi"],
          }),
    };
  });
  return {
    ...campaignDefaults(settings),
    id: "settings-preview",
    name: "Brochure preview",
    type: type.name,
    tagline: type.tagline,
    startDate: "2026-10-01",
    endDate: "2026-10-15",
    products,
    coverProductCodes: products.slice(0, 3).map((product) => product.code),
    theme: "blue",
    pages: {},
  };
}

export function SettingsPreview({
  draft,
  initial,
  tab,
  products = [],
  categoryPath = "",
  pageRequest,
}: {
  pageRequest?: { page: "cover" | "products" | "stores"; revision: number };
  draft: WorkspaceSettings;
  initial: WorkspaceSettings;
  tab: string;
  products?: Product[];
  categoryPath?: string;
}) {
  const [comparison, setComparison] = useState("draft");
  const [page, setPage] = useState("cover");
  const [enlarged, setEnlarged] = useState(false);
  const [lastValid, setLastValid] = useState(initial);
  const parsed = workspaceSettingsSchema.safeParse(draft);
  useEffect(() => {
    const next = workspaceSettingsSchema.safeParse(draft);
    if (next.success) setLastValid(next.data);
  }, [draft]);
  useEffect(() => {
    setPage(
      tab === "stores"
        ? "stores"
        : ["offers", "formats", "categories", "brands", "products"].includes(
              tab,
            )
          ? "products"
          : "cover",
    );
  }, [tab]);
  useEffect(() => {
    if (pageRequest) {
      setPage(pageRequest.page);
      setComparison("draft");
    }
  }, [pageRequest]);
  const settings =
    comparison === "saved" ? initial : parsed.success ? draft : lastValid;
  const campaign = settingsPreviewCampaign(settings, products, categoryPath);
  const format = resolveBrochureFormat(campaign);
  const content =
    page === "cover" ? (
      <CoverPage campaign={campaign} settings={settings} />
    ) : page === "stores" ? (
      <StoresPage campaign={campaign} settings={settings} />
    ) : (
      <ProductPage
        campaign={campaign}
        settings={settings}
        page={splitPages(campaign)[0]!}
      />
    );
  return (
    <aside className="ns-live-preview" aria-label="Settings preview">
      <div className="ns-preview-heading">
        <span className="ns-kicker">LIVE BROCHURE PREVIEW</span>
        <h2>See your changes</h2>
        <p>Same proportions as the selected download format.</p>
      </div>
      {!parsed.success && comparison === "draft" && (
        <p role="status" className="ns-preview-note">
          Complete the settings field to update the preview. Your draft is kept.
        </p>
      )}
      <div
        className="ns-preview-switch"
        role="group"
        aria-label="Compare settings"
      >
        <button
          type="button"
          aria-pressed={comparison === "saved"}
          onClick={() => setComparison("saved")}
        >
          Saved defaults
        </button>
        <button
          type="button"
          aria-pressed={comparison === "draft"}
          onClick={() => setComparison("draft")}
        >
          Your changes
        </button>
      </div>
      <div className="ns-preview-pages" role="group" aria-label="Preview page">
        {["cover", "products", "stores"].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={page === value}
            onClick={() => setPage(value)}
          >
            {value === "cover"
              ? "Cover"
              : value === "products"
                ? "Product page"
                : "Stores page"}
          </button>
        ))}
      </div>
      <div className="ns-preview-paper-slot">
        <PreviewPaper ratio={format.ratio} aspectRatio={format.aspectRatio}>
          {content}
        </PreviewPaper>
      </div>
      <button
        className="ns-preview-enlarge"
        type="button"
        onClick={() => setEnlarged(true)}
      >
        Enlarge preview ↗
      </button>
      <details className="ns-preview-note">
        <summary>Preview information</summary>
        <p className="ns-preview-note">
          Sample products and prices illustrate the design. Saving defaults
          applies to new campaigns; existing brochures keep their settings.
        </p>
      </details>
      {enlarged && (
        <Modal
          wide
          title="Brochure preview"
          kicker={comparison === "saved" ? "Saved defaults" : "Your changes"}
          onClose={() => setEnlarged(false)}
        >
          <div className="ns-enlarged-preview">
            <PreviewPaper ratio={format.ratio} aspectRatio={format.aspectRatio}>
              {content}
            </PreviewPaper>
          </div>
        </Modal>
      )}
    </aside>
  );
}

function PreviewPaper({
  children,
  ratio,
  aspectRatio,
}: {
  children: ReactNode;
  ratio: number;
  aspectRatio: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () =>
      setWidth(
        Math.max(
          1,
          element.getBoundingClientRect().width || element.clientWidth || 300,
        ),
      );
    measure();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={host}
      className="ns-preview-page"
      style={{ aspectRatio, "--ns-preview-ratio": ratio } as CSSProperties}
    >
      <div
        className="ns-preview-canvas"
        style={{
          width: 760,
          height: 760 / ratio,
          transform: `scale(${width / 760})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
