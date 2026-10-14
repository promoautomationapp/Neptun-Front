import {
  visibleContact,
  visibleStoreLines,
} from "../settings/brochure-display";
import React from "react";
import type { Campaign, Settings, Store } from "../../domain/models";
import { storePageEntries } from "./storesDesign";
import type { StoreEntry } from "./storesDesign";
import { compactStoresFooterHeight } from "./storesSelection";
import { StoresElement } from "./StoresElement";
import type { StoresElementProps } from "./StoresElement";
import "../../styles/compact-stores-footer.css";

const footerPlacement = {
  disclaimer: { x: 4, y: 0, width: 92, height: 24 },
  brand: { x: 4.1, y: 32, width: 10.8, height: 63 },
  stores: { x: 16, y: 29.5, width: 68, height: 65.5 },
  service: { x: 84.6, y: 32, width: 11.5, height: 63 },
};

type StoreContentField = keyof Pick<
  Store,
  "city" | "name" | "address" | "phone"
>;
type StoreContentChange = (
  key: string | number,
  field: StoreContentField,
  value: string,
) => void;
type ContactContentChange = (field: string, value: string) => void;
export interface CompactStoresFooterProps {
  campaign?: Partial<Campaign>;
  settings?: Partial<Settings>;
  sources?: { neptun?: string; balfin?: string; service?: string };
  onChange?: StoresElementProps["onChange"];
  onHide?: StoresElementProps["onHide"];
  onHideStore?: (key: string | number) => void;
  onStoreChange?: StoreContentChange;
  onContactChange?: ContactContentChange;
}
interface FooterCSSProperties extends React.CSSProperties {
  "--compact-footer-height": string;
  "--compact-footer-type-scale": number;
}

function storeColumns(entries: StoreEntry[]) {
  let next = 0;
  return Array.from({ length: 5 }, (_, index) => {
    const count =
      Math.floor(entries.length / 5) + Number(index < entries.length % 5);
    const column = entries.slice(next, next + count);
    next += count;
    return column;
  });
}

function editableText(
  value: string | undefined,
  save: ((text: string) => void) | undefined,
  label: string,
): React.HTMLAttributes<HTMLElement> {
  return {
    contentEditable: Boolean(save),
    suppressContentEditableWarning: true,
    "aria-label": save ? label : undefined,
    onBlur: save
      ? (event) => {
          const text = (event.currentTarget.textContent || "").trim();
          if (text !== String(value || "")) save(text);
        }
      : undefined,
    onKeyDown: save
      ? (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }
      : undefined,
  };
}

function FooterStore({
  entry,
  contact,
  campaign,
  onStoreChange,
  onContactChange,
}: {
  entry: StoreEntry;
  contact: Record<string, string>;
  campaign: Partial<Campaign>;
  onStoreChange?: StoreContentChange;
  onContactChange?: ContactContentChange;
}) {
  if (entry.online) {
    const save = (field: string) =>
      onContactChange && ((value: string) => onContactChange(field, value));
    return (
      <div
        className="compact-footer-store compact-footer-online"
        data-store-key="online"
      >
        {campaign.storeFields?.city !== false && <strong>NEPTUN ONLINE</strong>}
        {campaign.storeFields?.address !== false && contact.onlineEmail && (
          <span
            {...editableText(
              contact.onlineEmail,
              save("onlineEmail"),
              "Online email",
            )}
          >
            {contact.onlineEmail}
          </span>
        )}
        {campaign.storeFields?.phone !== false && contact.onlinePhone && (
          <span>
            Tel:{" "}
            <span
              className="compact-footer-inline-text"
              {...editableText(
                contact.onlinePhone,
                save("onlinePhone"),
                "Online phone",
              )}
            >
              {contact.onlinePhone}
            </span>
          </span>
        )}
      </div>
    );
  }
  const { city, name, address, phone } = visibleStoreLines(
    campaign,
    entry.store,
  );
  const save = (field: StoreContentField) =>
    onStoreChange &&
    ((value: string) => onStoreChange(entry.key, field, value));
  return (
    <div className="compact-footer-store" data-store-key={entry.key}>
      <strong>
        NEPTUN{" "}
        <span
          className="compact-footer-inline-text"
          {...editableText(city, save("city"), "Store city")}
        >
          {city}
        </span>
        {name && (
          <>
            {" "}
            ·{" "}
            <span
              className="compact-footer-inline-text"
              {...editableText(name, save("name"), "Store name")}
            >
              {name}
            </span>
          </>
        )}
      </strong>
      {address && (
        <span {...editableText(address, save("address"), "Store address")}>
          {address}
        </span>
      )}
      {phone && (
        <span>
          Tel:{" "}
          <span
            className="compact-footer-inline-text"
            {...editableText(phone, save("phone"), "Store phone")}
          >
            {phone}
          </span>
        </span>
      )}
    </div>
  );
}

export function CompactStoresFooter({
  campaign = {},
  settings = {},
  sources = {},
  onChange,
  onHide,
  onHideStore,
  onStoreChange,
  onContactChange,
}: CompactStoresFooterProps) {
  const stores = campaign.storesSnapshot?.stores || settings.stores || [];
  const contact = visibleContact(
    campaign,
    campaign.storesSnapshot?.contact || settings.contact || {},
  );
  const entries = storePageEntries(campaign, stores);
  const columns = storeColumns(entries);
  const height = compactStoresFooterHeight(campaign);
  const longestColumn = Math.max(1, ...columns.map((column) => column.length));
  const typeScale = Math.min(1, height / 18) * Math.min(1, 4 / longestColumn);
  const membership =
    contact.membershipDisclaimer ||
    "*Çmimet haPPy vlejnë vetëm për anëtarët e programit haPPy";
  const discountDisclaimer =
    contact.discountDisclaimer ||
    "Zbritjet me përqindje aplikohen vetëm për produktet me çmime të rregullta të cilat shiten në dyqane dhe online.";
  const phones = String(contact.servicePhones || "")
    .split(/\s*(?:·|;|\n)\s*/)
    .filter(Boolean);
  const elementProps: Pick<
    StoresElementProps,
    "campaign" | "scope" | "onChange" | "onHide"
  > = { campaign, scope: "footer", onChange, onHide };
  const saveContact = (field: string) =>
    onContactChange && ((text: string) => onContactChange(field, text));
  const footerStyle: FooterCSSProperties = {
    "--compact-footer-height": `${height}%`,
    "--compact-footer-type-scale": typeScale,
  };

  return (
    <div
      className="compact-stores-footer stores-element-canvas"
      style={footerStyle}
      aria-label="Dyqanet NEPTUN dhe informacioni i fushatës"
    >
      <div className="compact-stores-footer-white" aria-hidden="true" />
      <StoresElement
        {...elementProps}
        kind="disclaimer"
        defaultPlacement={footerPlacement.disclaimer}
        className="compact-footer-disclaimer"
      >
        {campaign.contactVisibility?.membershipDisclaimer !== false && (
          <strong
            className="compact-footer-membership"
            {...editableText(
              membership,
              saveContact("membershipDisclaimer"),
              "Membership terms",
            )}
          >
            {membership}
          </strong>
        )}
        {contact.disclaimer && (
          <p
            {...editableText(
              contact.disclaimer,
              saveContact("disclaimer"),
              "Brochure disclaimer",
            )}
          >
            {contact.disclaimer}
          </p>
        )}
        {campaign.contactVisibility?.discountDisclaimer !== false && (
          <p
            className="compact-footer-discount-disclaimer"
            {...editableText(
              discountDisclaimer,
              saveContact("discountDisclaimer"),
              "Discount terms",
            )}
          >
            {discountDisclaimer}
          </p>
        )}
      </StoresElement>
      <StoresElement
        {...elementProps}
        kind="brand"
        defaultPlacement={footerPlacement.brand}
        className="compact-footer-brand"
      >
        {sources.neptun ? (
          <img
            className="compact-footer-neptun"
            src={sources.neptun}
            alt="NEPTUN"
            draggable={false}
          />
        ) : (
          <strong className="compact-footer-neptun-fallback">NEPTUN</strong>
        )}
        {campaign.contactVisibility?.group !== false &&
          (sources.balfin ? (
            <img
              className="compact-footer-balfin"
              src={sources.balfin}
              alt="Part of BALFIN Group"
              draggable={false}
            />
          ) : (
            <span className="compact-footer-balfin-fallback">
              Part of <b>BALFIN</b>
              <small>GROUP</small>
            </span>
          ))}
      </StoresElement>
      <StoresElement
        {...elementProps}
        kind="stores"
        defaultPlacement={footerPlacement.stores}
        className="compact-footer-stores"
      >
        <div className="compact-footer-stores-canvas stores-element-canvas">
          {columns.flatMap((column, columnIndex) =>
            column.map((entry, rowIndex) => (
              <StoresElement
                {...elementProps}
                kind={`store-${entry.key}`}
                key={entry.key}
                onHide={onHideStore ? () => onHideStore(entry.key) : undefined}
                defaultPlacement={{
                  x: columnIndex * 20,
                  y: (rowIndex * 100) / longestColumn,
                  width: 18.2,
                  height: 100 / longestColumn - 2.5,
                }}
                className="compact-footer-store-wrapper"
              >
                <FooterStore
                  campaign={campaign}
                  entry={entry}
                  contact={contact}
                  onStoreChange={onStoreChange}
                  onContactChange={onContactChange}
                />
              </StoresElement>
            )),
          )}
        </div>
      </StoresElement>
      <StoresElement
        {...elementProps}
        kind="service"
        defaultPlacement={footerPlacement.service}
        className="compact-footer-service"
      >
        {sources.service ? (
          <img
            className="compact-footer-service-logo"
            src={sources.service}
            alt="Elektro-Servis Kosova"
            draggable={false}
          />
        ) : (
          <strong className="compact-footer-service-fallback">
            ELEKTRO-SERVIS <small>KOSOVA</small>
          </strong>
        )}
        <strong className="compact-footer-service-title">
          Elektroservis
          <br />
          Kosova SHPK
        </strong>
        {contact.serviceAddress && (
          <span
            {...editableText(
              contact.serviceAddress,
              saveContact("serviceAddress"),
              "Service address",
            )}
          >
            {contact.serviceAddress}
          </span>
        )}
        {phones.map((phone, index) => (
          <span key={index}>
            T{" "}
            <span
              className="compact-footer-inline-text"
              {...editableText(
                phone,
                onContactChange &&
                  ((text) =>
                    onContactChange(
                      "servicePhones",
                      phones
                        .map((current, currentIndex) =>
                          currentIndex === index ? text : current,
                        )
                        .join(" · "),
                    )),
                "Service phone",
              )}
            >
              {phone}
            </span>
          </span>
        ))}
      </StoresElement>
    </div>
  );
}
