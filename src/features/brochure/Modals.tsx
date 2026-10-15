import type {
  Product,
  Settings,
  Campaign,
  Gradient,
  BrochureImportWarning,
} from "../../domain/models";
import { getLanguage, t } from "./i18n";
import { MissingCatalogNotice } from "./MissingCatalogNotice";
import { hasRegularPrice } from "./missingCatalog";
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FilterDate, FilterSelect } from "./FilterControls";
import { CategoryTreeSelect } from "./CategoryTreeSelect";
import type { ImportTable, ImportSheet } from "./importAnalysis";
import type { ImportRow } from "./importRowGroups";
import type { BrochureImportColumns } from "./brochureImport";
import type { ProductEditingProps } from "./Brochure";
import { analyzeImportRows, selectImportTable } from "./importAnalysis";
import { analyzeBrochureRows, inferBrochureColumns } from "./brochureImport";
import { discount, money, validSale } from "./Brochure";
import { normalize, readImage } from "./utils";
import {
  campaignDefaults,
  defaultCampaignType,
  visibleCampaignTypes,
} from "../settings/campaign-defaults";
import { resolveSettings } from "../settings/settings.schema";
import { ProductArtworkControls } from "./ProductArtworkControls";
import { BundleOfferControls } from "./BundleOfferControls";
import { savedDetailEntries } from "./detailFacts";
import { isMobilePhone, mobileDetailEntries } from "./mobileDetails";
import { conditionerDetailEntries } from "./conditionerDetails";
import { isAirConditioner } from "./productArtwork";
import { isAppleProduct } from "./priceDesign";
import { ProductLayoutControls } from "./ProductLayoutControls";
import { displaySpecs } from "./tvSpecs";
import { warrantyText } from "./warranty";
import { OfferStyleControls } from "./OfferStyleControls";
import { savingModeFor } from "./offerStyles";
import { ImageUploadButton } from "./ImageUploadButton";
import { searchProducts } from "./productSearch";
import { BackgroundPicker } from "./BackgroundPicker";
import { BrochureGridPicker } from "./BrochureGridPicker";
import { BrochureFormatPicker } from "./BrochureFormatPicker";
import { brochureFormatSelection } from "./brochureFormat";
import { lightBackground, pageBackgroundContrastColor } from "./pageBackground";

function spreadsheetColumn(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export function Button({
  children,
  tone = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string }) {
  return (
    <button className={`cs-button ${tone}`} type="button" {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="cs-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ProductImage({
  product,
  preferRemote = false,
}: {
  product: Partial<Product>;
  preferRemote?: boolean;
}) {
  const sources = [
    ...new Set(
      [
        preferRemote && product.imageUrl,
        product.image,
        product.localImage,
        !preferRemote && product.imageUrl,
      ].filter(
        (value): value is string => typeof value === "string" && Boolean(value),
      ),
    ),
  ];
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(
    () => setSourceIndex(0),
    [product.image, product.imageUrl, product.localImage, preferRemote],
  );
  return sources[sourceIndex] ? (
    <img
      src={sources[sourceIndex]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  ) : (
    <span className="cs-product-placeholder">{t("NO IMAGE")}</span>
  );
}
export function Modal({
  title,
  kicker,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const backdrop = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape" && [...document.querySelectorAll(".cs-modal-backdrop")].at(-1) === backdrop.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      ref={backdrop}
      className="cs-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`cs-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="cs-modal-head">
          <div>
            <span className="cs-eyebrow">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="cs-icon-button"
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function CreateCampaign({
  settings,
  catalog = [],
  onCreate,
  onClose,
}: {
  settings: Settings;
  catalog?: Product[];
  onCreate: (campaign: Campaign) => void;
  onClose: () => void;
}) {
  const [initialSettings] = useState(() => resolveSettings(settings));
  const initialType = defaultCampaignType(initialSettings);
  const typeOptions = visibleCampaignTypes(initialSettings);
  const [type, setType] = useState(initialType.name);
  const [name, setName] = useState(
    `${t(initialType.name)} ${new Date().getFullYear()}`,
  );
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateMode, setDateMode] = useState("range");
  const [backgroundColor, setBackgroundColor] = useState(
    initialSettings.brochure.productBackground.color,
  );
  const [backgroundGradient, setBackgroundGradient] = useState<Gradient | null>(
    initialSettings.brochure.productBackground.gradient,
  );
  const [backgroundImage, setBackgroundImage] = useState(
    initialSettings.brochure.productBackground.image,
  );
  const [backgroundEdited, setBackgroundEdited] = useState(false);
  const [layout, setLayout] = useState<string>(initialSettings.brochure.layout);
  const [autoProductLayout, setAutoProductLayout] = useState(initialSettings.brochure.automaticProductLayout);
  const [brochureFormat, setBrochureFormat] = useState<string>(
    initialSettings.brochure.format,
  );
  const [tagline, setTagline] = useState(initialSettings.brochure.showCoverMessage ? initialType.tagline : "");
  const [taglineEdited, setTaglineEdited] = useState(false);
  const [showCoverBand, setShowCoverBand] = useState(initialSettings.brochure.showCoverBand);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | undefined>(undefined);
  const [importedProducts, setImportedProducts] = useState<Product[]>([]);
  const [importMetadata, setImportMetadata] =
    useState<Parameters<ImportSalesProps["onApply"]>[2]>(null);
  const [coverImage, setCoverImage] = useState("");
  const [error, setError] = useState("");
  const theme = lightBackground(
    pageBackgroundContrastColor(
      {
        productBackgroundColor: backgroundColor,
        productBackgroundGradient: backgroundGradient,
      },
      "product",
    ),
  )
    ? "light"
    : "blue";
  function chooseBackgroundColor(value: string) {
    setBackgroundEdited(true);
    setBackgroundColor(value);
    setBackgroundGradient(null);
    setBackgroundImage("");
  }
  function chooseBackgroundGradient(value: Gradient | null) {
    setBackgroundEdited(true);
    setBackgroundGradient(value);
    setBackgroundImage("");
  }
  function chooseBackgroundImage(value: string) {
    setBackgroundEdited(true);
    setBackgroundImage(value);
    setBackgroundGradient(null);
  }
  function chooseType(value: string) {
    setType(value);
    if (!taglineEdited) setTagline(initialSettings.brochure.showCoverMessage ? typeOptions.find(item => item.name === value)?.tagline || "" : "");

    if (value !== "Other") setName(`${t(value)} ${new Date().getFullYear()}`);
  }
  function create() {
    const finalEndDate = dateMode === "single" ? startDate : endDate;
    if (!name.trim() || !startDate || !finalEndDate)
      return setError(t("Add a campaign name and both dates."));
    if (finalEndDate < startDate)
      return setError(t("End date must be on or after the start date."));
    onCreate({
      ...campaignDefaults(initialSettings),
      id: crypto.randomUUID(),
      name: name.trim(),
      type: type === "Other" ? "Custom campaign" : type,
      tagline,
      startDate,
      endDate: finalEndDate,
      status: "in_progress",
      theme,
      layout,
      autoProductLayout,
      ...brochureFormatSelection(brochureFormat, initialSettings.customFormats),
      productBackgroundColor: backgroundGradient ? "" : backgroundColor,
      productBackgroundGradient: backgroundGradient,
      productBackgroundImage: backgroundImage,
      coverImage: "",
      showCoverBand,
      showCoverMessage: Boolean(tagline.trim()),
      ...(coverImage ? { coverBackgroundImage: coverImage } : {}),
      products: importedProducts,
      ...(importMetadata?.brochureImport
        ? {
            coverProductCodes: importedProducts
              .filter((product) => product.brochurePage === 1)
              .map((product) => String(product.code)),
            brochureImportWarnings: importMetadata.warnings,
          }
        : {}),
      pages: {},
      storesSnapshot: structuredClone(initialSettings),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  if (importOpen)
    return (
      <ImportSales
        catalog={catalog}
        initialFile={importFile}
        onApply={(products, _skipped, metadata) => {
          setImportedProducts(products);
          setImportMetadata(metadata);
          setImportOpen(false);
        }}
        onClose={() => setImportOpen(false)}
      />
    );
  return (
    <Modal
      title={t("Create a campaign")}
      kicker={t("01 / CAMPAIGN SETUP")}
      onClose={onClose}
      wide
    >
      <div className="cs-create-grid cs-create-simple">
        <div className="cs-create-fields">
          <div className="cs-campaign-type-picker">
            <FilterSelect
              label={t("Campaign type")}
              value={type}
              onChange={chooseType}
              options={[
                ...typeOptions.map((item) => ({
                  value: item.name,
                  label: t(item.name),
                })),
                ...(!typeOptions.some(
                  (item) => item.name === "Custom campaign",
                ) &&
                (!initialSettings.defaultCampaignTypeId || !typeOptions.length)
                  ? [{ value: "Custom campaign", label: t("Custom campaign") }]
                  : []),
              ]}
            />
          </div>
          <Field label={t("Campaign name")}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("Your campaign name")}
            />
          </Field>
          <section
            className="cs-create-products"
            aria-label={t("Campaign products")}
          >
            <div>
              <strong>{t("Products")}</strong>
              <small>
                {importedProducts.length
                  ? `${importedProducts.length} ${t(importedProducts.length === 1 ? "product ready" : "products ready")}`
                  : t("Upload an Excel or CSV file to build your brochure.")}
              </small>
            </div>
            <label className="cs-upload-button cs-create-products-upload">
              {t(
                importedProducts.length
                  ? "Replace products"
                  : "Upload products",
              )}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                aria-label={t(
                  importedProducts.length
                    ? "Replace products"
                    : "Upload products",
                )}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) {
                    setImportFile(file);
                    setImportOpen(true);
                  }
                }}
              />
            </label>
            {importedProducts.length > 0 && (
              <button
                type="button"
                className="cs-create-products-clear"
                onClick={() => {
                  setImportedProducts([]);
                  setImportMetadata(null);
                }}
              >
                {t("Remove")}
              </button>
            )}
          </section>
          <div
            className="cs-date-mode"
            role="group"
            aria-label={t("Campaign duration")}
          >
            <button
              type="button"
              className={dateMode === "single" ? "active" : ""}
              aria-pressed={dateMode === "single"}
              onClick={() => setDateMode("single")}
            >
              {t("One day")}
            </button>
            <button
              type="button"
              className={dateMode === "range" ? "active" : ""}
              aria-pressed={dateMode === "range"}
              onClick={() => {
                setDateMode("range");
                if (endDate < startDate) setEndDate(startDate);
              }}
            >
              {t("Date range")}
            </button>
          </div>
          <div
            className={dateMode === "single" ? "cs-one-date" : "cs-two-fields"}
          >
            <FilterDate
              label={t(dateMode === "single" ? "Campaign date" : "Start date")}
              value={startDate}
              onChange={(value: string) => {
                setStartDate(value);
                if (dateMode === "range" && endDate < value) setEndDate(value);
              }}
            />
            {dateMode === "range" && (
              <FilterDate
                label={t("End date")}
                value={endDate}
                min={startDate || undefined}
                onChange={setEndDate}
              />
            )}
          </div>
          <BrochureFormatPicker
            value={brochureFormat}
            customFormats={initialSettings.customFormats}
            onChange={setBrochureFormat}
          />

          <details className="cs-create-options">
            <summary>
              <span className="cs-create-settings-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                  <circle cx="8" cy="6" r="2" fill="#edf5fa" />
                  <circle cx="16" cy="12" r="2" fill="#edf5fa" />
                  <circle cx="10" cy="18" r="2" fill="#edf5fa" />
                </svg>
              </span>
              <span>
                {t("Customize design (optional)")}
                <small>{t("Colors, cover and layout")}</small>
              </span>
              <span className="cs-create-settings-chevron" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div>
              <label className="cs-create-cover-band">
                <input
                  type="checkbox"
                  checked={showCoverBand}
                  onChange={(event) => setShowCoverBand(event.target.checked)}
                />
                <span>{t("Show UUU / hajde! section")}</span>
              </label>
              <Field label={t("Cover message")}>
                <input
                  value={tagline}
                  onChange={(event) => {
                    setTaglineEdited(true);
                    setTagline(event.target.value);
                  }}
                  placeholder={t("A short message for the cover")}
                />
              </Field>
              <ImageUploadButton
                label={t("Cover artwork")}
                hint={t(
                  "Each campaign has its own cover image. PNG or JPG recommended.",
                )}
                value={coverImage}
                onFile={async (file: File) =>
                  setCoverImage(await readImage(file))
                }
                onRemove={() => setCoverImage("")}
              />
              {coverImage && (
                <div className="cs-cover-thumb">
                  <img src={coverImage} alt="Campaign cover preview" />
                  <button type="button" onClick={() => setCoverImage("")}>
                    {t("Remove image")}
                  </button>
                </div>
              )}
            </div>
            <div className="cs-create-design">
              <span className="cs-label">{t("BROCHURE DIRECTION")}</span>
              <h3>{t("Choose a foundation.")}</h3>
              <p>
                {t(
                  "Every page keeps the NEPTUN identity, offer price system and campaign dates.",
                )}
              </p>
              <p className="cs-muted">
                {t("Inside pages background")} ·{" "}
                {t(
                  "The cover keeps its own background. Change it separately in cover settings.",
                )}
              </p>
              <BackgroundPicker
                compact
                color={backgroundColor}
                defaultColor="#245b89"
                gradient={backgroundGradient}
                image={backgroundImage}
                onChange={chooseBackgroundColor}
                onGradientChange={chooseBackgroundGradient}
                onImageChange={chooseBackgroundImage}
                scopeLabel="Default product pages"
              />
              <span className="cs-label">{t("Grid")}</span>
              <BrochureGridPicker
                value={layout}
                onChange={(value) => {
                  setLayout(value);
                  setAutoProductLayout(false);
                }}
              />
              {autoProductLayout && (
                <p className="cs-control-help">
                  {t("MacBooks use two products per row by default.")}
                </p>
              )}
              <p className="cs-create-design-reminder">
                {t(
                  "Background and grid can be changed later. Run AI again after changing the background.",
                )}
              </p>
            </div>
          </details>
        </div>
      </div>
      {error && <p className="cs-error">{error}</p>}
      <div className="cs-modal-actions">
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button tone="primary" onClick={create}>
          {t("Create campaign →")}
        </Button>
      </div>
    </Modal>
  );
}

function ImportPriceRow({
  product,
  higher = false,
}: {
  product: Product;
  higher?: boolean;
}) {
  const percent = higher
    ? Math.round((Number(product.sale) / Number(product.regular) - 1) * 100)
    : discount(product.regular, product.sale);
  return (
    <article className="cs-import-price-row">
      <div className="cs-import-price-image">
        <ProductImage product={product} />
      </div>
      <div className="cs-import-price-product">
        <strong>{product.name}</strong>
        <MissingCatalogNotice product={product} variant="badge" />
        <small>
          {product.brand && <span>{product.brand}</span>}
          <span>
            {t("Code")}: {product.code}
          </span>
        </small>
      </div>
      <div className="cs-import-price-values">
        <div>
          <span>{t("Regular price")}</span>
          {hasRegularPrice(product) ? (
            <del>{money(product.regular)} €</del>
          ) : (
            <span>—</span>
          )}
        </div>
        <div>
          <span>{t("New sale price")}</span>
          <strong>{money(product.sale)} €</strong>
        </div>
        {hasRegularPrice(product) && percent > 0 && (
          <em className={higher ? "higher" : ""}>
            {higher ? "+" : "−"}
            {percent}%
          </em>
        )}
      </div>
    </article>
  );
}

export interface ImportSalesProps {
  catalog: Product[];
  initialFile?: File;
  onApply: (
    products: Product[],
    skipped?: number,
    metadata?: {
      brochureImport: boolean;
      warnings: BrochureImportWarning[];
    } | null,
  ) => void;
  onClose: () => void;
}

export function ImportSales({
  catalog,
  initialFile,
  onApply,
  onClose,
}: ImportSalesProps) {
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<
    Array<ImportSheet & { startColumn: number }>
  >([]);
  const [sheetName, setSheetName] = useState("");
  const [headerIndex, setHeaderIndex] = useState(-1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<readonly ImportRow[]>([]);
  const [rowOffset, setRowOffset] = useState(2);
  const [codeCol, setCodeCol] = useState(0);
  const [priceCol, setPriceCol] = useState(1);
  const [brochureColumns, setBrochureColumns] = useState<
    Omit<BrochureImportColumns, "codeCol" | "priceCol">
  >({
    categoryCol: -1,
    warrantyCol: -1,
    imageCol: -1,
    positionCol: -1,
    detailsCol: -1,
    nameCol: -1,
    colorCol: -1,
    regularCol: -1,
    brandCol: -1,
    setCol: -1,
  });
  const [includeHigher, setIncludeHigher] = useState(false);
  const [includeIncomplete, setIncludeIncomplete] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeSheet = sheets.find((sheet) => sheet.name === sheetName);
  function applyTable(table: ImportTable) {
    setHeaders(table.headers);
    setRows(table.rows);
    setRowOffset(table.rowOffset);
    setSheetName(table.sheetName);
    setHeaderIndex(table.headerIndex);
    setCodeCol(table.codeCol);
    setPriceCol(table.priceCol);
    setBrochureColumns(
      inferBrochureColumns(table.headers, table.rows, [
        table.codeCol,
        table.priceCol,
      ]),
    );
    setIncludeHigher(false);
  }
  async function load(file: File | undefined) {
    if (!file) return;
    setFileName("");
    setSheets([]);
    setRows([]);
    setError("");
    setBusy(true);
    try {
      const reader = window.XLSX;
      if (!reader) throw new Error(t("Spreadsheet reader is unavailable."));
      if (file.size > 25 * 1024 * 1024)
        throw new Error(t("Choose a spreadsheet smaller than 25 MB."));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const buffer = await file.arrayBuffer();
      const workbook = reader.read(buffer, { type: "array" });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const range = sheet?.["!ref"]
          ? reader.utils.decode_range(sheet["!ref"])
          : null;
        return {
          name,
          startRow: range?.s.r ?? 0,
          startColumn: range?.s.c ?? 0,
          data: reader.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false,
            blankrows: true,
          }),
        };
      });
      const table = selectImportTable(sheets, catalog);
      if (!table)
        throw new Error(
          t("The file needs at least two columns and one product row."),
        );
      setSheets(sheets);
      applyTable(table);
      setFileName(file.name);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not read that file."),
      );
    } finally {
      setBusy(false);
    }
  }
  const initialLoad = React.useRef(load);
  initialLoad.current = load;
  const loadedInitialFile = React.useRef<File | undefined>(undefined);
  useEffect(() => {
    if (initialFile && loadedInitialFile.current !== initialFile) {
      loadedInitialFile.current = initialFile;
      void initialLoad.current(initialFile);
    }
  }, [initialFile]);
  const analysis = useMemo(
    () =>
      analyzeImportRows(
        rows,
        codeCol,
        priceCol,
        catalog,
        rowOffset,
        brochureColumns.regularCol,
        brochureColumns.setCol,
        brochureColumns,
      ),
    [rows, codeCol, priceCol, catalog, rowOffset, brochureColumns],
  );
  const brochureAnalysis = useMemo(
    () =>
      brochureColumns.positionCol >= 0
        ? analyzeBrochureRows(
            rows,
            { ...brochureColumns, codeCol, priceCol },
            catalog,
            rowOffset,
          )
        : analyzeBrochureRows(
            [],
            { ...brochureColumns, codeCol, priceCol },
            catalog,
            rowOffset,
          ),
    [rows, brochureColumns, codeCol, priceCol, catalog, rowOffset],
  );
  const isBrochureImport = Boolean(brochureAnalysis?.products.length || brochureAnalysis?.incompleteProducts.length);
  const ready = [
    ...(isBrochureImport && includeIncomplete ? brochureAnalysis.incompleteProducts : []),
    ...(isBrochureImport
      ? brochureAnalysis.products.filter(
          (product: Product) =>
            !hasRegularPrice(product) ||
            includeHigher ||
            Number(product.sale) <= Number(product.regular),
        )
      : [...analysis.discounted, ...analysis.withoutRegular]),
    ...(!isBrochureImport && includeHigher
      ? analysis.higher.map((product: Product) => ({
          ...product,
          confirmedAboveRegular: true,
        }))
      : []),
  ];
  return (
    <Modal
      title={t("Import sale prices")}
      kicker={t("MATCH PRODUCTS BY CODE")}
      onClose={onClose}
      wide
    >
      <div className="cs-import-intro">
        <div>
          <strong>{t("CSV or Excel")}</strong>
          <p>
            {t(
              "We find codes, names and sale prices. If the workbook has brochure positions, the import also builds page order and product details.",
            )}{" "}
            {t(
              "Multiple codes in one cell become one offer with a shared price.",
            )}
          </p>
        </div>
        <label className="cs-upload-button">
          {busy ? t("Reading spreadsheet…") : t("Choose file")}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              load(file);
            }}
          />
        </label>
      </div>
      {busy && (
        <p className="cs-import-loading" role="status">
          <span />
          {t("Finding product codes and sale prices…")}
        </p>
      )}
      {fileName && (
        <>
          <div className="cs-file-status">
            <b>▤</b>
            <div>
              <strong>{fileName}</strong>
              <small>
                {sheetName} · {rows.length} {t("rows")} ·{" "}
                {isBrochureImport
                  ? brochureAnalysis.products.length
                  : analysis.discounted.length +
                    analysis.withoutRegular.length}{" "}
                {t("products")} ·{" "}
                {
                  (isBrochureImport
                    ? brochureAnalysis.skipped
                    : analysis.skipped
                  ).length
                }{" "}
                {t("unmatched or invalid")} ·{" "}
                {isBrochureImport ? brochureAnalysis.ignored : analysis.ignored}{" "}
                {t("heading or empty rows ignored")}
              </small>
            </div>
          </div>
          <details
            className="cs-create-options cs-import-mapping"
            open={
              !isBrochureImport &&
              analysis.discounted.length +
                analysis.withoutRegular.length +
                analysis.higher.length +
                analysis.unchanged.length ===
                0
            }
          >
            <summary>{t("Change spreadsheet columns (optional)")}</summary>
            <div className="cs-import-source-options">
              {sheets.length > 1 && (
                <Field label={t("Spreadsheet tab")}>
                  <select
                    value={sheetName}
                    onChange={(event) => {
                      const table = selectImportTable(sheets, catalog, {
                        sheetName: event.target.value,
                      });
                      if (table) applyTable(table);
                    }}
                  >
                    {sheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={t("Header row")}>
                <select
                  value={headerIndex}
                  onChange={(event) => {
                    const table = selectImportTable(sheets, catalog, {
                      sheetName,
                      headerIndex: Number(event.target.value),
                    });
                    if (table) applyTable(table);
                  }}
                >
                  <option value={-1}>{t("No header row")}</option>
                  {(activeSheet?.data || []).slice(0, 120).map((row, index) =>
                    row?.some((cell) => String(cell ?? "").trim()) ? (
                      <option key={index} value={index}>
                        {t("Row")} {(activeSheet?.startRow || 0) + index + 1}:{" "}
                        {row
                          .filter(Boolean)
                          .slice(0, 4)
                          .map(String)
                          .join(" · ")
                          .slice(0, 80)}
                      </option>
                    ) : null,
                  )}
                </select>
              </Field>
            </div>
            <div className="cs-two-fields cs-import-columns">
              <FilterSelect
                label={t("Product code column")}
                value={codeCol}
                onChange={(value: React.SetStateAction<number>) => {
                  setCodeCol(value);
                  setIncludeHigher(false);
                }}
                options={headers.map((header, index) => ({
                  value: index,
                  label: `${spreadsheetColumn(index + (activeSheet?.startColumn || 0))} · ${header || `${t("Column")} ${index + 1}`}`,
                }))}
              />
              <FilterSelect
                label={t("New sale price column")}
                value={priceCol}
                onChange={(value: React.SetStateAction<number>) => {
                  setPriceCol(value);
                  setIncludeHigher(false);
                }}
                options={headers.map((header, index) => ({
                  value: index,
                  label: `${spreadsheetColumn(index + (activeSheet?.startColumn || 0))} · ${header || `${t("Column")} ${index + 1}`}`,
                }))}
              />
            </div>
            <Field label={t("Set column (Pulla, optional)")}>
              <select
                value={brochureColumns.setCol}
                onChange={(event) =>
                  setBrochureColumns((current) => ({
                    ...current,
                    setCol: Number(event.target.value),
                  }))
                }
              >
                <option value={-1}>{t("Not mapped")}</option>
                {headers.map((value, index) => (
                  <option key={index} value={index}>
                    {value || `${t("Column")} ${index + 1}`}
                  </option>
                ))}
              </select>
              <small>
                {t(
                  "Consecutive rows marked Set become one offer with one shared price.",
                )}
              </small>
            </Field>
            {rows.length > 0 && (
              <div className="cs-import-brochure-fields">
                <strong>{t("Brochure columns")}</strong>
                <p>
                  {t(
                    "Page 1 is the cover. Products with the same position and model become one card with color choices.",
                  )}
                </p>
                {(
                  [
                    ["positionCol", t("Brochure position")],
                    ["nameCol", t("Product name")],
                    ["detailsCol", t("Product details")],
                    ["regularCol", t("Regular price")],
                    ["brandCol", t("Brand")],
                    ["categoryCol", t("Category")],
                    ["warrantyCol", t("Warranty")],
                    ["imageCol", t("Product image")],
                    ["colorCol", t("Color (optional)")],
                  ] satisfies Array<[keyof BrochureImportColumns, string]>
                ).map(([field, label]) => (
                  <Field key={field} label={label}>
                    <select
                      value={brochureColumns[field]}
                      onChange={(event) =>
                        setBrochureColumns((current) => ({
                          ...current,
                          [field]: Number(event.target.value),
                        }))
                      }
                    >
                      <option value={-1}>{t("Not mapped")}</option>
                      {headers.map((value, index) => (
                        <option key={index} value={index}>
                          {spreadsheetColumn(
                            index + (activeSheet?.startColumn || 0),
                          )}{" "}
                          · {value}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
          </details>
          {isBrochureImport && (
            <div className="cs-import-brochure-summary" role="status">
              <strong>
                {brochureAnalysis.products.length} {t("brochure products")}
              </strong>
              <span>
                {brochureAnalysis.matchedRows} {t("source rows")} ·{" "}
                {
                  brochureAnalysis.products.filter(
                    (product: Product) =>
                      !product.image ||
                      product.bundleProducts?.some(
                        (member) =>
                          !member.image &&
                          !member.localImage &&
                          !member.imageUrl,
                      ),
                  ).length
                }{" "}
                {t("need a photo")}
              </span>
            </div>
          )}
          {isBrochureImport &&
            brochureAnalysis.products.some(
              (product: Product) =>
                hasRegularPrice(product) &&
                Number(product.sale) > Number(product.regular),
            ) && (
              <label className="cs-import-confirm-higher">
                <input
                  type="checkbox"
                  checked={includeHigher}
                  onChange={(event) => setIncludeHigher(event.target.checked)}
                />
                <span>
                  {t("Include products priced above regular after review")}
                </span>
              </label>
            )}
          {isBrochureImport && brochureAnalysis.warnings.length > 0 && (
            <div className="cs-import-position-warnings">
              <strong>{t("Check these shared positions")}</strong>
              {brochureAnalysis.warnings.map((warning) => (
                <p key={`${warning.position}-${warning.row}`}>
                  {warning.position} · {warning.name} ({warning.code}) —{" "}
                  {warning.message ||
                    t(
                      "Different products have the same order. Both will be shown in sequence.",
                    )}
                </p>
              ))}
            </div>
          )}
          {ready.some((product: Product) => product.catalogMissing) && (
            <p className="cs-import-missing-info" role="status">
              {t(
                "Products missing from the catalog will be added with the Excel details and prices. We will look for an exact product photo; you can upload your own anytime.",
              )}
            </p>
          )}
          {isBrochureImport && brochureAnalysis.incompleteProducts.length > 0 && (
            <div className="cs-import-missing-info" role="status">
              <strong>{brochureAnalysis.incompleteProducts.length} {t("incomplete Excel rows")}</strong>
              <p>{t("These rows are missing a product code/name or a sale price in the file. Keep them as editable drafts with the Excel details. Add the missing name and price, then upload a photo or search for the exact model.")}</p>
              <label><input type="checkbox" checked={includeIncomplete} onChange={(event) => setIncludeIncomplete(event.target.checked)} /> {t("Keep incomplete rows for editing")}</label>
              <details><summary>{t("View incomplete rows")}</summary>{brochureAnalysis.incompleteProducts.map((product) => <p key={product.code}>{t("Row")} {product.excelSource?.row} · {product.name === product.excelSource?.placeholderName ? t("Missing product code and name in Excel") : product.name}{!(Number(product.sale) > 0) ? ` · ${t("Missing sale price in Excel")}` : ""}</p>)}</details>
            </div>
          )}
          {analysis.discounted.length +
            analysis.withoutRegular.length +
            analysis.higher.length +
            analysis.unchanged.length ===
            0 &&
            !isBrochureImport && (
              <p className="cs-import-no-match" role="alert">
                {t(
                  "No catalog products matched these columns. Try another tab, header row, or code and sale-price columns.",
                )}
              </p>
            )}
          <div className="cs-import-results">
            <div className="cs-result-title">
              <h3>
                {t(
                  isBrochureImport
                    ? "Brochure products"
                    : "Matched price changes",
                )}
              </h3>
              <span>
                {isBrochureImport
                  ? ready.length
                  : analysis.discounted.length +
                    analysis.withoutRegular.length +
                    analysis.higher.length}{" "}
                {t(
                  analysis.discounted.length + analysis.higher.length === 1
                    ? "product"
                    : "products",
                )}
              </span>
            </div>
            {!isBrochureImport && analysis.discounted.length > 0 && (
              <div className="cs-import-group-label">
                {t("Lower than regular")} · {analysis.discounted.length}
              </div>
            )}
            <div className="cs-result-list">
              {(isBrochureImport
                ? ready
                : [...analysis.discounted, ...analysis.withoutRegular]
              )
                .slice(0, 100)
                .map((product: Product) => (
                  <div key={product.code} className="cs-import-brochure-row">
                    {isBrochureImport && product.brochurePage && (
                      <span className="cs-import-position">
                        {product.brochurePage}.{product.brochureOrder}
                      </span>
                    )}
                    <ImportPriceRow product={product} />
                    {isBrochureImport &&
                      (product.brochureVariants?.length ?? 0) > 1 && (
                        <small>
                          {product.brochureVariants?.length ?? 0} {t("colors")}
                        </small>
                      )}
                  </div>
                ))}
            </div>
            {!isBrochureImport && analysis.higher.length > 0 && (
              <div className="cs-import-higher">
                <div className="cs-result-title">
                  <h3>{t("Prices above regular")}</h3>
                  <span>
                    {analysis.higher.length} {t("need confirmation")}
                  </span>
                </div>
                <p>
                  {t(
                    "These new prices exceed the catalog price. Review them before including them in the campaign.",
                  )}
                </p>
                <div className="cs-result-list">
                  {analysis.higher.slice(0, 50).map((product: Product) => (
                    <ImportPriceRow
                      key={product.code}
                      product={product}
                      higher
                    />
                  ))}
                </div>
                <label className="cs-import-confirm-higher">
                  <input
                    type="checkbox"
                    checked={includeHigher}
                    onChange={(event) => setIncludeHigher(event.target.checked)}
                  />
                  <span>
                    {t(
                      "I confirm these higher prices and want to import them.",
                    )}
                  </span>
                </label>
              </div>
            )}
            {analysis.discounted.length > 100 || analysis.higher.length > 50 ? (
              <p className="cs-import-preview-limit">
                {t(
                  "Preview shortened. All matched products will still be imported.",
                )}
              </p>
            ) : null}
            {!isBrochureImport && analysis.unchanged.length > 0 && (
              <p className="cs-import-unchanged">
                {analysis.unchanged.length}{" "}
                {t(
                  analysis.unchanged.length === 1
                    ? "matched product has the same price as the catalog and will not be added."
                    : "matched products have the same price as the catalog and will not be added.",
                )}
              </p>
            )}
            {(isBrochureImport ? brochureAnalysis.skipped : analysis.skipped)
              .length > 0 && (
              <details className="cs-skipped" open>
                <summary>
                  {
                    (isBrochureImport
                      ? brochureAnalysis.skipped
                      : analysis.skipped
                    ).length
                  }{" "}
                  {t(
                    analysis.skipped.length === 1
                      ? "unmatched or invalid row — other products can still be imported"
                      : "unmatched or invalid rows — other products can still be imported",
                  )}
                </summary>
                <div>
                  {(isBrochureImport
                    ? brochureAnalysis.skipped
                    : analysis.skipped
                  )
                    .slice(0, 30)
                    .map((row) => (
                      <p key={row.row}>
                        {t("Row")} {row.row} · {row.code}: {t(row.reason)}
                      </p>
                    ))}
                  {(isBrochureImport
                    ? brochureAnalysis.skipped
                    : analysis.skipped
                  ).length > 30 && (
                    <p>
                      {t("And")}{" "}
                      {(isBrochureImport
                        ? brochureAnalysis.skipped
                        : analysis.skipped
                      ).length - 30}{" "}
                      {t("more.")}
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </>
      )}
      {error && <p className="cs-error">{error}</p>}
      <div className="cs-modal-actions">
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          tone="primary"
          disabled={!ready.length}
          onClick={() =>
            onApply(
              ready,
              isBrochureImport
                ? brochureAnalysis.skipped.length
                : analysis.skipped.length +
                    analysis.unchanged.length +
                    (includeHigher ? 0 : analysis.higher.length),
              isBrochureImport
                ? { brochureImport: true, warnings: brochureAnalysis.warnings }
                : null,
            )
          }
        >
          {t("Add")} {ready.length}{" "}
          {t(ready.length === 1 ? "product" : "products")} →
        </Button>
      </div>
    </Modal>
  );
}

function PickerResult({
  product,
  selectedProduct,
  existing,
  onToggle,
  onPrice,
}: {
  product: Product;
  selectedProduct?: Product;
  existing: boolean;
  onToggle: (product: Product) => void;
  onPrice: (code: string, sale: string) => void;
}) {
  return (
    <div
      className={`cs-picker-result-wrap ${selectedProduct ? "selected" : ""}`}
    >
      <button
        className="cs-picker-result"
        type="button"
        disabled={existing || !(Number(product.regular) > 0)}
        onClick={() => onToggle(product)}
      >
        <div className="cs-mini-image">
          <ProductImage product={product} preferRemote />
        </div>
        <div>
          <strong>{product.name}</strong>
          <small>
            {product.brand} · {product.code}
          </small>
          <span>{product.subcategory}</span>
        </div>
        <b>{money(product.regular)} €</b>
        <i>{existing ? t("Added") : selectedProduct ? "✓" : "+"}</i>
      </button>
      {selectedProduct && (
        <div className="cs-picker-inline-price">
          <label>
            {t("New sale price")}{" "}
            <input
              type="number"
              min="0.01"
              max={product.regular ?? undefined}
              step="0.01"
              inputMode="decimal"
              placeholder={t("Enter price")}
              value={selectedProduct.sale}
              onChange={(event) => onPrice(product.code, event.target.value)}
            />
          </label>
          <span>
            {t("Regular")} {money(product.regular)} €
          </span>
          <strong className={validSale(selectedProduct) ? "valid" : ""}>
            {validSale(selectedProduct)
              ? `−${discount(selectedProduct.regular, selectedProduct.sale)}% · ${t("Save")} ${money(Number(selectedProduct.regular) - Number(selectedProduct.sale))} €`
              : selectedProduct.sale
                ? t("Price must be below regular")
                : t("Discount appears here")}
          </strong>
        </div>
      )}
    </div>
  );
}

export function ManualPicker({
  catalog,
  existing,
  onApply,
  onClose,
}: {
  catalog: Product[];
  existing: Product[];
  onApply: (products: Product[]) => void;
  onClose: () => void;
}) {
  const [codeSearch, setCodeSearch] = useState("");
  const [detailSearch, setDetailSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [visibleCount, setVisibleCount] = useState(60);
  const delayedCode = useDeferredValue(codeSearch);
  const delayedDetails = useDeferredValue(detailSearch);
  const brands = useMemo(
    () =>
      [
        ...new Set(
          catalog
            .filter(
              (p: Product) =>
                (!category || p.category === category) &&
                (!subcategory || p.subcategory === subcategory),
            )
            .map((p) => p.brand)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [catalog, category, subcategory],
  );
  const matches = useMemo(
    () =>
      searchProducts(
        catalog.filter(
          (p: Product) =>
            (!delayedCode ||
              normalize(p.code)
                .replace(/\s/g, "")
                .includes(normalize(delayedCode).replace(/\s/g, ""))) &&
            (!category || p.category === category) &&
            (!subcategory || p.subcategory === subcategory) &&
            (!brand || p.brand === brand),
        ),
        delayedDetails,
      ),
    [catalog, delayedCode, delayedDetails, category, subcategory, brand],
  );
  const visibleMatches = matches.slice(0, visibleCount);
  const existingCodes = useMemo(
    () => new Set(existing.map((p) => p.code)),
    [existing],
  );
  const selectedList = Object.values(selected);
  function toggle(product: Product) {
    setSelected((current) => {
      const copy = { ...current };
      if (copy[product.code]) delete copy[product.code];
      else copy[product.code] = { ...product, sale: "", source: "manual" };
      return copy;
    });
  }
  function setPrice(code: string, sale: string) {
    setSelected((current) => {
      const product = current[code];
      return product ? { ...current, [code]: { ...product, sale } } : current;
    });
  }
  const ready = selectedList.filter(validSale);
  return (
    <Modal
      title={t("Select products")}
      kicker={t("MANUAL SELECTION")}
      onClose={onClose}
      wide
    >
      <div className="cs-picker-layout">
        <div className="cs-picker-search">
          <div className="cs-search-pair">
            <Field label={t("Search by code")}>
              <input
                autoFocus
                type="search"
                value={codeSearch}
                onChange={(event) => {
                  setCodeSearch(event.target.value);
                  setVisibleCount(60);
                }}
                placeholder={t("Type any part of a code…")}
              />
            </Field>
            <Field label={t("Search name, brand or details")}>
              <input
                type="search"
                value={detailSearch}
                onChange={(event) => {
                  setDetailSearch(event.target.value);
                  setVisibleCount(60);
                }}
                placeholder={t("Find products instantly…")}
              />
            </Field>
          </div>
          <div className="cs-manual-filter-row">
            <CategoryTreeSelect
              catalog={catalog}
              category={category}
              subcategory={subcategory}
              onChange={(
                nextCategory: React.SetStateAction<string>,
                nextSubcategory: React.SetStateAction<string>,
              ) => {
                setCategory(nextCategory);
                setSubcategory(nextSubcategory);
                setBrand("");
                setVisibleCount(60);
              }}
            />
            <FilterSelect
              label={t("Brand")}
              value={brand}
              onChange={(value: React.SetStateAction<string>) => {
                setBrand(value);
                setVisibleCount(60);
              }}
              options={[
                { value: "", label: t("All brands") },
                ...brands.map((value) => ({ value, label: value })),
              ]}
            />
          </div>
          <div className="cs-picker-count">
            {visibleMatches.length} {t("of")} {matches.length}{" "}
            {t("products shown")}
          </div>
          <div className="cs-picker-results">
            {visibleMatches.map((product: Product) => (
              <PickerResult
                key={product.code}
                product={product}
                selectedProduct={selected[product.code]}
                existing={existingCodes.has(product.code)}
                onToggle={toggle}
                onPrice={setPrice}
              />
            ))}
            {matches.length === 0 && (
              <div className="cs-empty-mini">
                {t("No matching products. Try another code or filter.")}
              </div>
            )}
            {matches.length > visibleCount && (
              <div className="cs-picker-more">
                <Button onClick={() => setVisibleCount((value) => value + 60)}>
                  {t("Show more products")} ↓
                </Button>
              </div>
            )}
          </div>
        </div>
        <aside className="cs-picker-selected">
          <div className="cs-result-title">
            <h3>{t("Selected")}</h3>
            <span>
              {selectedList.length} {t("products")}
            </span>
          </div>
          <p>
            {t(
              "Enter a sale price for each item. The discount updates immediately.",
            )}
          </p>
          {selectedList.length === 0 && (
            <div className="cs-empty-mini">
              {t("Choose products from the left to prepare their prices.")}
            </div>
          )}
          <div className="cs-selected-list">
            {selectedList.map((product: Product) => (
              <div className="cs-selected-item" key={product.code}>
                <div className="cs-selected-title">
                  <span>
                    {product.brand} · {product.code}
                    <strong>{product.name}</strong>
                  </span>
                  <button
                    type="button"
                    aria-label={`${t("Unselect")} ${product.name}`}
                    onClick={() => toggle(product)}
                  >
                    ×
                  </button>
                </div>
                <div className="cs-selected-prices">
                  <span>
                    {t("Regular")} <b>{money(product.regular)} €</b>
                  </span>
                  <label>
                    {t("Sale price")}
                    <input
                      type="number"
                      min="0.01"
                      max={product.regular ?? undefined}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={product.sale}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [product.code]: {
                            ...product,
                            ...current[product.code],
                            sale: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <b
                    className={
                      validSale(product)
                        ? "cs-discount-valid"
                        : "cs-discount-empty"
                    }
                  >
                    {validSale(product)
                      ? `−${discount(product.regular, product.sale)}%`
                      : "—"}
                  </b>
                </div>
                {product.sale && !validSale(product) && (
                  <small className="cs-error">
                    {t("Sale price must be below regular price.")}
                  </small>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="cs-modal-actions">
        <span className="cs-modal-note">
          {ready.length} {t("priced and ready")}
        </span>
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          tone="primary"
          disabled={!ready.length}
          onClick={() => onApply(ready)}
        >
          {t("Add")} {ready.length} {t("products")} →
        </Button>
      </div>
    </Modal>
  );
}

export function Details({
  product,
  campaign,
  onAppearanceChange,
  onProductChange,
  onImageEdit,
  onClose,
}: {
  product: Product;
  campaign?: Campaign;
  onAppearanceChange?: (
    field: "offerStyle" | "priceStyle" | "savingMode",
    value: string,
  ) => void;
  onProductChange?: (
    field: keyof Product | Partial<Product>,
    value?: Product[keyof Product],
  ) => void;
  onImageEdit?: () => void;
  onClose: () => void;
}) {
  const specs = Object.entries(displaySpecs(product)).filter(
    ([, value]) => value,
  );
  const savedSpecs =
    isMobilePhone(product) && !isAppleProduct(product)
      ? mobileDetailEntries(product)
      : isAirConditioner(product)
        ? conditionerDetailEntries(product)
        : Object.entries(displaySpecs(product));
  const warranty = warrantyText(product.warranty, getLanguage());
  const selectedSavingMode = campaign
    ? savingModeFor(campaign, product)
    : "amount";
  const savedAmount = Number(product.regular) - Number(product.sale);
  const savedPercent = discount(product.regular, product.sale);
  return (
    <Modal
      title={t("Product details")}
      kicker={`${product.brand || "PRODUCT"} · ${product.code}`}
      onClose={onClose}
      wide
    >
      <div className="cs-detail-layout">
        <div className="cs-detail-image">
          <MissingCatalogNotice
            product={product}
            onUploadImage={onImageEdit || undefined}
          />
          <ProductImage product={product} preferRemote={!campaign} />
          {onImageEdit && (
            <Button onClick={onImageEdit}>{t("Change image")}</Button>
          )}
        </div>
        <div className="cs-detail-copy">
          <span className="cs-eyebrow">
            {product.category} / {product.subcategory}
          </span>
          {onProductChange ? (
            <div className="cs-detail-edit-fields">
              <Field label={t("Brand shown in brochure")}>
                <input
                  value={product.brand || ""}
                  onChange={(event) =>
                    onProductChange("brand", event.target.value)
                  }
                />
              </Field>
              <Field label={t("Product name shown in brochure")}>
                <input
                  value={product.name || ""}
                  onChange={(event) =>
                    onProductChange("name", event.target.value)
                  }
                />
              </Field>
              <Field label={t("Warranty shown in brochure")}>
                <input
                  value={product.warranty || ""}
                  onChange={(event) =>
                    onProductChange("warranty", event.target.value)
                  }
                  placeholder="2 vite"
                />
              </Field>
            </div>
          ) : (
            <h3>{product.name}</h3>
          )}
          {warranty && (
            <p className="cs-detail-warranty">
              <b>{t("Warranty")}</b> · {warranty}
            </p>
          )}
          <div className="cs-detail-prices">
            <span>
              {t("Regular price")} <b>{money(product.regular)} €</b>
            </span>
            {Number(product.sale) > 0 && (
              <>
                <span>
                  {t("Sale price")} <strong>{money(product.sale)} €</strong>
                </span>
                {validSale(product) ? (
                  <span className="cs-detail-discount">
                    {selectedSavingMode === "percentage"
                      ? t("Discount %")
                      : t("Save €")}
                    <b>
                      {selectedSavingMode === "percentage"
                        ? `${savedPercent}%`
                        : `${money(savedAmount)} €`}
                    </b>
                  </span>
                ) : hasRegularPrice(product) &&
                  Number(product.sale) > Number(product.regular) ? (
                  <span className="cs-detail-discount higher">
                    −
                    {Math.round(
                      (Number(product.sale) / Number(product.regular) - 1) *
                        100,
                    )}
                    % · {t("Above regular")}{" "}
                    {money(Number(product.sale) - Number(product.regular))} €
                    {!product.confirmedAboveRegular &&
                      ` · ${t("Needs confirmation")}`}
                  </span>
                ) : null}
              </>
            )}
          </div>
          {campaign && onAppearanceChange && (
            <div className="cs-detail-saving-picker">
              <strong>{t("Savings badge in brochure")}</strong>
              <small>
                {t(
                  "Choose how this product's saving appears on the cover and inside pages.",
                )}
              </small>
              <div role="group" aria-label={t("Savings badge in brochure")}>
                <button
                  type="button"
                  className={selectedSavingMode === "amount" ? "chosen" : ""}
                  aria-pressed={selectedSavingMode === "amount"}
                  disabled={!validSale(product)}
                  onClick={() => onAppearanceChange("savingMode", "amount")}
                >
                  <span>{t("Save €")}</span>
                  <b>{validSale(product) ? `${money(savedAmount)} €` : "—"}</b>
                </button>
                <button
                  type="button"
                  className={
                    selectedSavingMode === "percentage" ? "chosen" : ""
                  }
                  aria-pressed={selectedSavingMode === "percentage"}
                  disabled={!validSale(product)}
                  onClick={() => onAppearanceChange("savingMode", "percentage")}
                >
                  <span>{t("Discount %")}</span>
                  <b>{validSale(product) ? `${savedPercent}%` : "—"}</b>
                </button>
              </div>
            </div>
          )}
          <h4>{t("Description")}</h4>
          {onProductChange ? (
            <textarea
              className="cs-detail-description-edit"
              rows={4}
              value={product.description || ""}
              onChange={(event) =>
                onProductChange("description", event.target.value)
              }
              aria-label={t("Description")}
            />
          ) : (
            <p>{product.description || t("No description in the catalog.")}</p>
          )}
          {product.url && (
            <a
              className="cs-external-link"
              href={product.url}
              target="_blank"
              rel="noreferrer"
            >
              {t("View on neptun-ks.com ↗")}
            </a>
          )}
        </div>
      </div>
      {onProductChange && (
        <div className="cs-spec-edit">
          <details
            className="cs-detail-appearance"
            name="product-extra-settings"
          >
            <summary>{t("Position & size")}</summary>
            <ProductLayoutControls
              campaign={campaign || {}}
              product={product}
              onChange={onProductChange}
            />
          </details>
          <details
            className="cs-detail-appearance"
            name="product-extra-settings"
          >
            <summary>{t("Product images and feature badges")}</summary>
            <ProductArtworkControls
              campaign={campaign}
              product={product}
              onChange={onProductChange}
            />
          </details>
          <BundleOfferControls
            product={product}
            campaign={campaign}
            onChange={onProductChange}
          />
          <h4>{t("Details shown in brochure")}</h4>
          <p>
            {t(
              "Use white or outlined blocks. Automatic styling follows the detail content.",
            )}
          </p>
          {(Array.isArray(product.brochureDetails)
            ? savedDetailEntries(product) || []
            : savedSpecs
          )
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <label className="cs-detail-fill-choice" key={key}>
                <span>
                  {Array.isArray(product.brochureDetails) ? value : key}
                </span>
                <select
                  aria-label={`Block style: ${key}`}
                  value={
                    typeof product.detailBlockStyles?.[key] === "string"
                      ? product.detailBlockStyles[key]
                      : "auto"
                  }
                  onChange={(event) =>
                    onProductChange("detailBlockStyles", {
                      ...product.detailBlockStyles,
                      [key]: event.target.value,
                    })
                  }
                >
                  <option value="auto">{t("Automatic")}</option>
                  <option value="filled">{t("White block")}</option>
                  <option value="outline">{t("Outlined block")}</option>
                </select>
              </label>
            ))}
          {Array.isArray(product.brochureDetails) ? (
            <>
              <p>
                {t(
                  "One detail per line, in brochure order. You can also drag the details on the page to reorder them.",
                )}
              </p>
              <textarea
                rows={Math.min(
                  10,
                  Math.max(4, (product.brochureDetails?.length || 0) + 1),
                )}
                value={(savedDetailEntries(product) || [])
                  .map(([, text]) => text)
                  .join("\n")}
                onChange={(event) =>
                  onProductChange(
                    "brochureDetails",
                    event.target.value.split(/\r?\n/).map((text, index) => {
                      const saved = product.brochureDetails?.[index];
                      return saved && typeof saved === "object"
                        ? { ...saved, text }
                        : text;
                    }),
                  )
                }
                aria-label={t("Brochure details, one per line")}
              />
            </>
          ) : (
            <>
              <p>
                {t(
                  "Edit a label or value. Empty values are not shown in the brochure.",
                )}
              </p>
              {savedSpecs.map(([key, value], index) => (
                <div className="cs-spec-edit-row" key={index}>
                  <input
                    aria-label={`${t("Detail label")} ${index + 1}`}
                    value={key}
                    onChange={(event) => {
                      const next = [...savedSpecs];
                      next[index] = [event.target.value, value];
                      onProductChange("specs", Object.fromEntries(next));
                    }}
                  />
                  <input
                    aria-label={`${t("Detail value")} ${index + 1}`}
                    value={String(value)}
                    onChange={(event) =>
                      onProductChange("specs", {
                        ...Object.fromEntries(savedSpecs),
                        [key]: event.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={`${t("Remove detail")} ${key}`}
                    onClick={() => {
                      const next = Object.fromEntries(savedSpecs);
                      delete next[key];
                      onProductChange("specs", next);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button
                onClick={() =>
                  onProductChange("specs", {
                    ...Object.fromEntries(savedSpecs),
                    [`${t("New detail")} ${savedSpecs.length + 1}`]: "",
                  })
                }
              >
                {t("+ Add detail")}
              </Button>
            </>
          )}
        </div>
      )}
      {campaign && onAppearanceChange && (
        <details className="cs-detail-appearance" name="product-extra-settings">
          <summary>{t("Offer card style for this product")}</summary>
          <p>
            {t(
              "Override the campaign look for this product, or keep the campaign default.",
            )}
          </p>
          <OfferStyleControls
            inherit
            scope="product"
            styleValue={product.offerStyle || ""}
            savingValue={product.savingMode || ""}
            inheritedStyle={campaign.offerStyle || "current"}
            inheritedSaving={savingModeFor(campaign, {
              ...product,
              savingMode: "",
            })}
            savingInheritLabel="Use category or campaign default"
            showSaving={false}
            onStyleChange={(value) => onAppearanceChange("offerStyle", value)}
            onSavingChange={(value) => onAppearanceChange("savingMode", value)}
          />
        </details>
      )}
      {!onProductChange && specs.length > 0 && (
        <div className="cs-spec-table">
          <h4>{t("Specifications from catalog")}</h4>
          <div>
            {specs.map(([key, value]) => (
              <p key={key}>
                <span>{key}</span>
                <b>{String(value)}</b>
              </p>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
