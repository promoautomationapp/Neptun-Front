import React from "react";
import type { Product } from "../../domain/models";
import { isAirConditioner } from "./productArtwork";
import { isAppleProduct, isMobilePhone } from "./productTypes";
import { detailTypography } from "./detailTypography";
import { phoneMemoryAmounts } from "./mobileDetails";
import { detailEnergyClasses } from "./conditionerDetails";
import { normalizedDetail } from "./detailFacts";

type DetailReference = "blue" | "red" | "legacy";

interface FittedDetailValueProps {
  text: React.ReactNode;
  className?: string;
  fitKey?: string;
}

export interface DetailContentProps {
  product: Partial<Product>;
  label: string;
  value: unknown;
  imported?: boolean;
  layout?: "strip" | "left";
  reference?: DetailReference;
}

export function FittedDetailValue({
  text,
  className = "",
  fitKey,
}: FittedDetailValueProps) {
  const ref = React.useRef<HTMLElement>(null);
  React.useLayoutEffect(() => {
    const value = ref.current;
    const block = value?.parentElement;
    if (!block) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !block.clientWidth || !block.clientHeight) return;
      value.style.removeProperty("font-size");
      const base = parseFloat(getComputedStyle(value).fontSize);
      const style = getComputedStyle(block);
      const padding =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const label = [...block.children].find(
        (item): item is HTMLElement =>
          item instanceof HTMLElement && item.tagName === "SMALL",
      );
      const labelStyle = label && getComputedStyle(label);
      const labelHeight =
        label && labelStyle
          ? label.offsetHeight +
            parseFloat(labelStyle.marginTop) +
            parseFloat(labelStyle.marginBottom)
          : 0;
      const available = block.clientHeight - padding - labelHeight - (parseFloat(style.rowGap) || 0);
      if (!(available > 0 && base > 0)) return;
      const fits = () =>
        value.scrollHeight <= available + 0.5 &&
        value.scrollWidth <= value.clientWidth + 1;
      if (fits()) return;
      let low = base * 0.3,
        high = base;
      for (let i = 0; i < 12; i++) {
        const size = (low + high) / 2;
        value.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
      }
      value.style.fontSize = `${low}px`;
    };
    fit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : undefined;
    observer?.observe(block);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [text, className, fitKey]);
  return (
    <b ref={ref} className={`detail-fitted-value ${className}`}>
      {text}
    </b>
  );
}

export function DetailContent({
  product,
  label,
  value,
  imported = false,
  layout,
  reference,
}: DetailContentProps) {
  const source = String(value);
  // Power is a value-only box in the supplied strip reference. Recognize only
  // that explicit label/unit pair; unrelated imported wording stays intact.
  const text = source.replace(
    /^(?:Fuqia|Power)\s*:?\s*(?=\d+(?:[.,]\d+)?\s*W\b)/i,
    "",
  );
  const phone = isMobilePhone(product) && !isAppleProduct(product);
  const cameraText = (camera: string) =>
    `${/^(?:Front|Selfie)\b/i.test(camera) ? "" : "Kamera: "}${camera.replace(/[,;]?\s*\bFront\s*:?\s*/i, "\nFront: ").trim()}`;
  if (layout === "strip" && imported && phone) {
    const suppliedMemory = text.match(
      /^(Memor(?:j[aeëe]*|i[aeëe]*)|Memory|Storage|RAM)(?:\s*:\s*|\s+)([\s\S]+)$/i,
    );
    if (suppliedMemory?.[1] && suppliedMemory[2]) {
      const amounts = phoneMemoryAmounts(suppliedMemory[2], suppliedMemory[1]);
      const memoryText =
        amounts.storage && amounts.ram
          ? `${amounts.storage}\n${amounts.ram}`
          : suppliedMemory[2];
      return (
        <FittedDetailValue
          className="detail-mobile-strip detail-copy"
          text={memoryText}
          fitKey={`${reference}:${layout}`}
        />
      );
    }
  }
  if (layout === "left" && !imported && phone) {
    const leftText = /sistemi|operating\s*system|^os$/i.test(label)
      ? text
      : /kamera|camera/i.test(label)
        ? cameraText(text)
        : /bater|battery/i.test(label)
          ? `Bateria\n${text}`
          : text;
    const long = leftText.trim().length > 24;
    return (
      <FittedDetailValue
        className={`detail-mobile-reference detail-${long ? "copy-long" : "copy"}`}
        text={leftText}
        fitKey={reference}
      />
    );
  }
  if (layout === "strip" && !imported && phone) {
    const os = /sistemi|operating\s*system|^os$/i.test(label)
      ? text.replace(/^(Android|iOS)\s+(?=\d)/i, "$1\n")
      : null;
    const camera = /kamera|camera/i.test(label) ? cameraText(text) : null;
    const memory = /memor|memory|storage|ram/i.test(label)
      ? phoneMemoryAmounts(text, label)
      : null;
    const memoryText =
      memory?.storage && memory.ram
        ? `${memory.storage}\n${memory.ram}`
        : memory?.storage || memory?.ram;
    const battery = /bater|battery/i.test(label) ? `Bateria:\n${text}` : null;
    const phoneText = os || camera || memoryText || battery;
    if (phoneText)
      return (
        <FittedDetailValue
          className={`detail-mobile-strip detail-${phoneText.length > 36 ? "copy-long" : "copy"}`}
          text={phoneText}
          fitKey={`${reference}:${layout}`}
        />
      );
  }
  if (isAirConditioner(product)) {
    const temperatureText = text.replace(
      /^(?:Temperatura|Niveli\s+operativ|Operating\s+(?:temperature|range))\s*:\s*/i,
      "",
    );
    const temperature = temperatureText.match(
      /^([+−–-]?\d+(?:[.,]\d+)?)\s*°\s*C\s*(?:deri|to|[-–/])\s*([+−–-]?\d+(?:[.,]\d+)?)\s*°\s*C$/i,
    );
    if (temperature)
      return (
        <FittedDetailValue
          className="detail-temperature"
          text={
            <>
              <span className="detail-temperature-low">{temperature[1]}°C</span>
              <small className="detail-temperature-to">DERI</small>
              <span className="detail-temperature-high">
                {temperature[2]}°C
              </span>
            </>
          }
          fitKey={`${reference}:${layout}`}
        />
      );
    const energyText = text.replace(
      /^(?:Klasa\s+(?:e\s+)?energjis[ëe]|Energy\s*(?:class|rating))\s*:\s*/i,
      "",
    );
    const energy = detailEnergyClasses(energyText);
    if (
      energy.length &&
      /^\s*[A-G](?:\s*\+){0,3}(?:\s*[/\n ]\s*[A-G](?:\s*\+){0,3})*\s*$/i.test(
        energyText,
      )
    )
      return (
        <FittedDetailValue
          className={`detail-energy ${reference === "blue" || layout === "left" ? "detail-energy-inline" : "detail-energy-stacked"}`}
          text={energy.map((item, index) => (
            <React.Fragment key={`${item}:${index}`}>
              {index > 0 && (reference === "blue" || layout === "left") && (
                <span>/</span>
              )}
              <em>{item}</em>
            </React.Fragment>
          ))}
          fitKey={`${reference}:${layout}`}
        />
      );
    if (/\bBTU\b/i.test(`${label} ${text}`))
      return (
        <FittedDetailValue
          className="detail-btu"
          text={
            <>
              {text
                .replace(/^(?:BTU|Kapaciteti)\s*:\s*/i, "")
                .replace(/\s*BTU\s*/i, "")}
              <span>BTU</span>
            </>
          }
          fitKey={`${reference}:${layout}`}
        />
      );
    if (/^(?:gas|gaz)$/i.test(label))
      return (
        <>
          <FittedDetailValue
            className="detail-gas-label"
            text={
              <>
                GAS
                <br />
                EKOLOGJIK
              </>
            }
            fitKey={reference}
          />
          <small>{text}</small>
        </>
      );
    if (/qarkullim|air\s*flow|airflow/i.test(label))
      return (
        <>
          <small className="detail-strip-label">QARKULLIMI I AJRIT:</small>
          <FittedDetailValue
            className="detail-airflow detail-copy"
            text={text}
            fitKey={`${reference}:${layout}`}
          />
        </>
      );
  }
  if (
    !imported &&
    layout === "strip" &&
    /teknolog|technology/i.test(normalizedDetail(label))
  )
    return (
      <>
        <small className="detail-strip-label">{label}</small>
        <FittedDetailValue
          className="detail-copy"
          text={text}
          fitKey={`${reference}:${layout}`}
        />
      </>
    );
  if (layout === "strip" || layout === "left") {
    const detail = detailTypography(text, { label, imported });
    return (
      <>
        {detail.label && (
          <small className="detail-strip-label">{detail.label}</small>
        )}
        {detail.separator}
        <FittedDetailValue
          className={`detail-${detail.kind}`}
          text={detail.value}
          fitKey={`${reference}:${layout}`}
        />
      </>
    );
  }
  return (
    <>
      <FittedDetailValue text={text} />
      {!imported && <small>{label}</small>}
    </>
  );
}
