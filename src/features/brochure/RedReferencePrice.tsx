import React from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Product } from "../../domain/models";
import geometry from "./redPriceGeometry.json";
import {
  artworkPrice,
  artworkSaving,
  fittedArtworkFont,
} from "./priceCardModel";
import {
  fittedRedRuns,
  fittedRedText,
  redInstallmentRuns,
  redPriceRuns,
  redReferenceRunSize,
  redSvgRuns,
} from "./redPriceModel";
import type { RedPriceRun } from "./redPriceModel";
import "../../styles/red-reference-price.css";

const { parts } = geometry;
const width = parts.saleBand.width;
const height = parts.installmentBand.y + parts.installmentBand.height;
const blue = "#1c4075";

interface AmountFrame {
  x: number;
  width: number;
  baseline: number;
}

interface AmountProps {
  runs: readonly RedPriceRun[];
  frame: AmountFrame;
  className?: string;
}

export interface RedReferencePriceProps {
  product: Product;
  installments?: number | string;
  showRegular?: boolean;
  showInstallments?: boolean;
  logo?: string;
}

export interface RedReferenceSavingsProps {
  product: Product;
  savingMode?: string;
  className?: string;
  onEditSavings?: (product: Product) => void;
  style?: CSSProperties;
  children?: ReactNode;
}

function savingBaseline(index: number) {
  const baseline = parts.saving.centerBaselines[index];
  if (!baseline) throw new Error(`Missing red savings baseline ${index}.`);
  return baseline;
}

function Amount({ runs, frame, className }: AmountProps) {
  const fitted = redSvgRuns(fittedRedRuns(runs, frame.width));
  return (
    <text
      className={className}
      x={frame.x + frame.width}
      y={frame.baseline}
      textAnchor="end"
      fontFamily="TSTAR"
      fontWeight={700}
    >
      {fitted.map((run, index) => (
        <tspan
          key={index}
          fontSize={run.size}
          letterSpacing={
            index === fitted.length - 1 ? 0 : run.tracking * run.size
          }
          dy={-(run.rise || 0) + (fitted[index - 1]?.rise || 0)}
        >
          {run.text}
        </tspan>
      ))}
    </text>
  );
}

export function RedReferencePrice({
  product,
  installments = 12,
  showRegular = true,
  showInstallments = true,
  logo = "",
}: RedReferencePriceProps) {
  const id = React.useId().replace(/:/g, "");
  const saleRuns = redPriceRuns(
    product.sale,
    redReferenceRunSize(parts.sale.runs, 0),
    redReferenceRunSize(parts.sale.runs, 1),
    -0.09,
  );
  // The source has a narrow space before the euro on the sale, but none on the old price.
  const saleEuroRun = saleRuns.at(-1);
  if (saleEuroRun) saleEuroRun.text = " €";
  const regularRuns = redPriceRuns(
    product.regular,
    redReferenceRunSize(parts.old.runs, 0),
    redReferenceRunSize(parts.old.runs, 0),
    0.01,
  );
  const label = `Çmimi haPPy: ${artworkPrice(product.sale).text} €`;
  const gradientEnd = [172, 173, 176];
  const gradientPower = Math.log(0.5) / Math.log(0.818681001663208);
  return (
    <svg
      className="red-reference-price-svg"
      viewBox={`0 0 ${width} ${showInstallments ? height : parts.saleBand.height}`}
      role="img"
      aria-label={`${showRegular ? `Çmimi i rregullt: ${artworkPrice(product.regular).text} €. ` : ""}${label}${showInstallments ? `. KËSTI ${installments}x${(Number(product.sale) / Number(installments)).toFixed(1)} €` : ""}`}
    >
      <defs>
        <linearGradient id={`red-old-${id}`} x1="0" x2="1" y1="0" y2="0">
          {Array.from({ length: 11 }, (_, index) => {
            const progress = (index / 10) ** gradientPower;
            return (
              <stop
                key={index}
                offset={`${index * 10}%`}
                stopColor={`rgb(${gradientEnd.map((end) => Math.round(255 + (end - 255) * progress)).join(" ")})`}
              />
            );
          })}
        </linearGradient>
        <linearGradient id={`red-month-${id}`} x1="0" x2="1" y1="0" y2="0">
          {[
            "#01a2dd",
            "#0097d2",
            "#008cc7",
            "#0083be",
            "#0079b4",
            "#0071ab",
            "#0069a3",
            "#00619b",
            "#005992",
            "#00508a",
            "#004981",
          ].map((color, index) => (
            <stop key={color} offset={`${index * 10}%`} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      {showRegular && (
        <g fill={blue}>
          <path d={parts.oldBand.path} fill={`url(#red-old-${id})`} />
          <Amount runs={regularRuns} frame={parts.old} />
          <path
            d={parts.oldStrike.openPath}
            fill="none"
            stroke={blue}
            strokeWidth={parts.oldStrike.strokeWidth}
            strokeLinecap="round"
          />
        </g>
      )}
      <path d={parts.saleBand.path} fill="var(--brochure-price-red, #ef4023)" />
      <text
        className="red-price-label"
        x={parts.priceLabel.x + parts.priceLabel.width / 2}
        y={parts.priceLabel.baseline}
        textAnchor="middle"
        fontFamily="SkolaSans"
        fontWeight={700}
        fontSize={fittedArtworkFont(
          "ÇMIMI",
          redReferenceRunSize(parts.priceLabel.runs, 0),
          parts.priceLabel.width,
          "bold",
        )}
        fill="#fff"
      >
        ÇMIMI
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
      <g fill="#fff">
        <Amount runs={saleRuns} frame={parts.sale} />
      </g>
      {showInstallments && (
        <g fill="#fff">
          <rect
            data-offer-price-divider="true"
            x="0"
            y={parts.saleBand.height}
            width={width}
            height={parts.installmentBand.y - parts.saleBand.height}
          />
          <path d={parts.installmentBand.path} fill={`url(#red-month-${id})`} />
          <Amount
            runs={redInstallmentRuns(product.sale, installments)}
            frame={parts.installment}
          />
          <text
            className="red-installment-label"
            x={parts.installmentLabel.x}
            y={parts.installmentLabel.baseline}
            fontFamily="SkolaSans"
            fontWeight={900}
            fontSize={redReferenceRunSize(parts.installmentLabel.runs, 0)}
          >
            KËSTI
          </text>
        </g>
      )}
    </svg>
  );
}

export function RedReferenceSavings({
  product,
  savingMode = "amount",
  className = "",
  onEditSavings,
  style,
  children,
}: RedReferenceSavingsProps) {
  const saving = artworkSaving(product.regular, product.sale, savingMode);
  if (!saving) return null;
  const circle = parts.savingCircle;
  const labelBaseline = savingBaseline(0);
  const amountBaseline = savingBaseline(1);
  const labelSize = fittedRedText(
    saving.label,
    redReferenceRunSize(parts.saving.runs, 0),
    circle.width - 8,
    "bold",
    -0.06,
  );
  const amountSize = fittedRedText(
    saving.text,
    redReferenceRunSize(parts.saving.runs, 2),
    circle.width - 7,
    "bold",
    -0.06,
  );
  return (
    <span
      className={`red-reference-saving ${className}`}
      style={style}
      role={onEditSavings ? "button" : "img"}
      tabIndex={onEditSavings ? 0 : undefined}
      aria-label={`${saving.label} ${saving.text}`}
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
        viewBox={`${circle.x - 0.7} ${circle.y - 0.7} ${circle.width + 1.4} ${circle.height + 1.4}`}
        aria-hidden="true"
      >
        <path d={circle.path} fill="#fff" />
        <g
          fill="var(--brochure-price-saving, #ef4023)"
          fontFamily="TSTAR"
          textAnchor="middle"
        >
          <text
            x={labelBaseline[0]}
            y={labelBaseline[1]}
            fontSize={labelSize}
            fontWeight={700}
            letterSpacing={labelSize * -0.06}
            transform={`rotate(-1 ${labelBaseline.join(" ")})`}
          >
            {saving.label}
          </text>
          <text
            x={amountBaseline[0]}
            y={amountBaseline[1]}
            fontSize={amountSize}
            fontWeight={700}
            letterSpacing={amountSize * -0.06}
            transform={`rotate(-1 ${amountBaseline.join(" ")})`}
          >
            {saving.text}
          </text>
        </g>
      </svg>
      {children}
    </span>
  );
}
