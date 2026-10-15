import type { Product } from "../../domain/models";
import { t } from "./i18n";
import "../../styles/missing-catalog-notice.css";

export interface ProductImageSearchState {
  status: "searching" | "found" | "not_found" | "failed";
  requestKey?: string;
  requestId?: string;
  sourceUrl?: string;
  imageUrl?: string;
  matchedName?: string;
  message?: string;
}
export interface MissingCatalogProduct extends Omit<
  Partial<Product>,
  "imageSearch"
> {
  catalogMissing?: boolean;
  missingCatalogCodes?: string[];
  imageSearch?: ProductImageSearchState;
}
export interface MissingCatalogNoticeProps {
  product: MissingCatalogProduct;
  variant?: "editor" | "badge" | "placeholder";
  onFindImage?: () => void | Promise<void>;
  canResumeSearch?: boolean;
  onUploadImage?: () => void;
  onOpenEditor?: () => void;
  className?: string;
}

export function missingCatalogCodes(product: MissingCatalogProduct): string[] {
  const members = product.bundleProducts || [];
  const codes =
    product.missingCatalogCodes ??
    (members.length
      ? members.flatMap((member) => missingCatalogCodes(member))
      : product.catalogMissing && product.code
        ? [String(product.code)]
        : []);
  return [...new Set(codes.filter(Boolean))];
}
export function productPhotoSource(
  product: Pick<Partial<Product>, "image" | "localImage" | "imageUrl">,
): string {
  return product.image || product.localImage || product.imageUrl || "";
}
export function imageSearchState(product: MissingCatalogProduct) {
  return product.imageSearch;
}

export function MissingCatalogNotice({
  product,
  variant = "editor",
  onFindImage,
  canResumeSearch = false,
  onUploadImage,
  onOpenEditor,
  className = "",
}: MissingCatalogNoticeProps) {
  const codes = missingCatalogCodes(product);
  const missing = Boolean(product.catalogMissing || codes.length);
  const hasPhoto = Boolean(
    productPhotoSource(product) ||
    product.bundleProducts?.some((member) => productPhotoSource(member)),
  );
  const search = imageSearchState(product);
  if (!missing && hasPhoto && !search) return null;
  const searching = search?.status === "searching";
  const incomplete = Boolean(product.excelSource?.placeholderName && product.excelSource.placeholderName === product.name);
  const heading = t(incomplete ? "Incomplete Excel row" : missing ? "Not in catalog" : "Image missing");
  const status = t(
    incomplete ? "Add the product name or model, then search for its photo. You can upload an image now." : searching
      ? "Searching for the exact product photo…"
      : search?.status === "found"
        ? "Exact product photo found"
        : search?.status === "not_found"
          ? "No exact product photo found"
          : search?.status === "failed"
            ? "Image search could not be completed"
            : "Upload a photo or search for this product's exact image.",
  );
  if (variant === "badge") {
    const content = (
      <>
        {heading}
        {codes.length > 0 && <span> · {codes.join(", ")}</span>}
      </>
    );
    return onOpenEditor ? (
      <button
        type="button"
        className={`missing-catalog-badge ${className}`}
        data-export-hide="true"
        onClick={(event) => {
          event.stopPropagation();
          onOpenEditor();
        }}
        title={t("Open image editor")}
      >
        {content}
      </button>
    ) : (
      <span
        className={`missing-catalog-badge ${className}`}
        data-export-hide="true"
        role="status"
      >
        {content}
      </span>
    );
  }
  const sourceUrl =
    search?.sourceUrl && /^https?:\/\//i.test(search.sourceUrl)
      ? search.sourceUrl
      : "";
  return (
    <aside
      className={`missing-catalog-notice missing-catalog-${variant} ${className}`}
      data-export-hide="true"
      data-image-search-status={search?.status || "idle"}
      aria-label={heading}
    >
      <div className="missing-catalog-copy">
        <strong>
          {heading}
          {codes.length > 0 && <span> · {codes.join(", ")}</span>}
        </strong>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {search?.status === "found" && search.matchedName && (
          <small>{search.matchedName}</small>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            {t("Photo source")}
          </a>
        )}
        {search?.message && <small>{search.message}</small>}
      </div>
      {(onFindImage || onUploadImage || onOpenEditor) && (
        <div className="missing-catalog-actions">
          {onFindImage && !incomplete && (
            <button
              type="button"
              disabled={searching && !canResumeSearch}
              onClick={(event) => {
                event.stopPropagation();
                void onFindImage();
              }}
            >
              {t(
                searching
                  ? canResumeSearch
                    ? "Resume search"
                    : "Searching…"
                  : search
                    ? "Search again"
                    : "Find exact photo",
              )}
            </button>
          )}
          {(onUploadImage || onOpenEditor) && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                (onUploadImage || onOpenEditor)?.();
              }}
            >
              {t("Upload own image")}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
