import React from "react";
import type { Product } from "../../domain/models";
import geometry from "./priceCardGeometry.json";
import {
  artworkInstallment,
  artworkPrice,
  artworkSaving,
  fittedArtworkFont,
  fittedPriceFont,
  priceRuns,
} from "./priceCardModel";

interface PriceTextPart {
  bounds: readonly number[];
  pointSize: number;
  baseline: number;
}

interface PriceTextProps {
  value: Product["sale"] | Product["regular"];
  part: PriceTextPart;
  sale?: boolean;
}

export interface ReferencePriceCardProps {
  product: Product;
  installments?: number | string;
  savingMode?: string;
  onEditSavings?: (product: Product) => void;
  showRegular?: boolean;
  showSaving?: boolean;
  savingStyle?: React.CSSProperties;
  showInstallments?: boolean;
  logo?: string;
}

function bound(bounds: readonly number[], index: number) {
  const value = bounds[index];
  if (value === undefined)
    throw new Error(`Missing price reference bound ${index}.`);
  return value;
}

const center = (bounds: readonly number[]) =>
  (bound(bounds, 0) + bound(bounds, 2)) / 2;
const width = (bounds: readonly number[]) =>
  bound(bounds, 2) - bound(bounds, 0);

function PriceText({ value, part, sale = false }: PriceTextProps) {
  const prefix = sale ? "" : "Çmimi i rregullt: ";
  const runs = priceRuns(value, sale);
  const fontSize = fittedPriceFont(
    runs,
    part.pointSize,
    width(part.bounds),
    sale ? "black" : "bold",
    prefix,
  );
  return (
    <text
      className={
        sale ? "reference-offer-price-text" : "reference-regular-price-text"
      }
      x={sale ? part.bounds[0] : center(part.bounds)}
      y={part.baseline}
      textAnchor={sale ? "start" : "middle"}
      fontSize={fontSize}
      fontWeight={sale ? 900 : 700}
      fill={sale ? "#fff" : "#000"}
    >
      {prefix}
      {runs.map((run, index) => (
        <tspan
          key={index}
          fontSize={
            run.superscript ? fontSize * geometry.superscript.scale : fontSize
          }
          dy={
            run.superscript
              ? -fontSize * geometry.superscript.baselineRise
              : index > 0 && runs[index - 1]?.superscript
                ? fontSize * geometry.superscript.baselineRise
                : 0
          }
        >
          {run.text}
        </tspan>
      ))}
    </text>
  );
}

export function ReferencePriceCard({
  product,
  installments = 12,
  savingMode = "amount",
  onEditSavings,
  showRegular = true,
  showSaving = true,
  savingStyle,
  showInstallments = true,
  logo = "",
}: ReferencePriceCardProps) {
  const source = artworkPrice(product.sale).cents
    ? artworkPrice(product.regular).cents
      ? geometry.decimal
      : geometry.fiftyPercent
    : geometry.iphone;
  const { parts } = source;
  const saving = artworkSaving(product.regular, product.sale, savingMode);
  const monthly = artworkInstallment(product.sale, installments);
  const shadowId = `price-shadow-${React.useId().replace(/:/g, "")}`;
  const label = `${showRegular ? `Çmimi i rregullt: ${artworkPrice(product.regular).text} €. ` : ""}Çmimi haPPy: ${artworkPrice(product.sale).text} €. ${monthly}`;
  const tab = parts.savingTab.bounds;
  return (
    <>
      {showSaving && saving && (
        <span
          className="reference-saving-tab"
          style={{
            ...savingStyle,
            left: `${(bound(tab, 0) / source.width) * 100}%`,
            width: `${(width(tab) / source.width) * 100}%`,
            aspectRatio: `${width(tab)} / ${-bound(tab, 1)}`,
          }}
          role={onEditSavings ? "button" : "img"}
          tabIndex={onEditSavings ? 0 : undefined}
          aria-label={
            savingMode === "percentage"
              ? `Zbritje ${saving.text.slice(0, -1)} për qind`
              : `Kurseni ${saving.text.slice(0, -1)} euro`
          }
          onClick={
            onEditSavings
              ? (event) => {
                  event.stopPropagation();
                  onEditSavings(product);
                }
              : undefined
          }
          onKeyDown={
            onEditSavings
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditSavings(product);
                  }
                }
              : undefined
          }
        >
          <svg
            viewBox={`${tab[0]} ${tab[1]} ${width(tab)} ${-bound(tab, 1)}`}
            aria-hidden="true"
          >
            <path
              d={parts.savingTab.path}
              fill="var(--brochure-price-blue, #243a6a)"
            />
            <text
              x={center(parts.savingLabel.bounds)}
              y={parts.savingLabel.baseline}
              textAnchor="middle"
              fill="#fff"
              fontWeight={700}
              fontSize={fittedArtworkFont(
                saving.label,
                parts.savingLabel.pointSize,
                width(tab) - 7,
                "bold",
              )}
            >
              {saving.label}
            </text>
            <text
              x={center(parts.savingNumber.bounds)}
              y={parts.savingNumber.baseline}
              textAnchor="middle"
              fill="#fff"
              fontWeight={700}
              fontSize={fittedArtworkFont(
                saving.text,
                parts.savingNumber.pointSize,
                width(tab) - 3,
                "bold",
              )}
            >
              {saving.text}
            </text>
          </svg>
        </span>
      )}
      <svg
        className="reference-price-svg"
        viewBox={`0 0 ${source.width} ${source.height}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <filter
            id={shadowId}
            x="-20%"
            y="-40%"
            width="150%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx={geometry.shadow.x}
              dy={geometry.shadow.y}
              stdDeviation={geometry.shadow.size / 2}
              floodColor="#000"
              floodOpacity={geometry.shadow.opacity}
            />
          </filter>
        </defs>
        <g filter={`url(#${shadowId})`}>
          <path
            d={parts.band.path}
            fill="var(--brochure-price-blue-band, #e7eae9)"
          />
          <path
            d={parts.body.path}
            fill="var(--brochure-price-blue, #243a6a)"
          />
        </g>
        {showRegular && (
          <PriceText value={product.regular} part={parts.regular} />
        )}
        <text
          x={center(parts.priceLabel.bounds)}
          y={parts.priceLabel.baseline}
          fontSize={parts.priceLabel.pointSize}
          fontWeight={700}
          fill="#fff"
          textAnchor="middle"
        >
          Çmimi
        </text>
        {logo ? (
          <image
            href={logo}
            x={parts.happy.x}
            y={parts.happy.y}
            width={parts.happy.width}
            height={parts.happy.height}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <g
            transform={`translate(${parts.happy.x} ${parts.happy.y})`}
            fill="#fff"
            fillRule="evenodd"
          >
            {parts.happy.paths.map((path, index) => (
              <path key={index} d={path} />
            ))}
          </g>
        )}
        <path d={parts.colon.path} fill="#fff" fillRule="evenodd" />
        <PriceText value={product.sale} part={parts.sale} sale />
        {showInstallments && (
          <text
            x={center(parts.installment.bounds)}
            y={parts.installment.baseline}
            fontSize={fittedArtworkFont(
              monthly,
              parts.installment.pointSize,
              width(parts.installment.bounds),
              "bold",
            )}
            fontWeight={700}
            fill="#fff"
            textAnchor="middle"
          >
            {monthly}
          </text>
        )}
      </svg>
    </>
  );
}
