import React, { useId } from "react";
import type {
  ScreenAnnotationPlacement,
  ScreenAnnotationType,
} from "./screenAnnotationGeometry";
import "../../styles/screen-size-annotation.css";

export interface ScreenSizeAnnotationProps extends React.HTMLAttributes<HTMLSpanElement> {
  inches?: number | string | null;
  type?: ScreenAnnotationType;
  guideLengths?: Pick<
    ScreenAnnotationPlacement,
    "horizontalLength" | "verticalLength"
  >;
}

export function ScreenSizeAnnotation({
  inches,
  type = "other",
  className = "",
  style,
  guideLengths = {},
  children,
  ...props
}: ScreenSizeAnnotationProps) {
  const id = useId().replace(/:/g, "");
  if (!inches) return null;
  return (
    <span
      className={`screen-size-annotation screen-size-${type} ${className}`}
      style={style}
      {...props}
      aria-label={`${inches} inch screen`}
    >
      {type === "television" || type === "phone" ? (
        <svg viewBox="0 0 89.0579646228 89.0579646228" aria-hidden="true">
          <defs>
            {/* Source triangle u741a4: feather 9→100%, midpoint 87%, angle −136.1°. */}
            <linearGradient
              id={`${id}-fade`}
              gradientUnits="userSpaceOnUse"
              x1="89.4375603272"
              y1="-.7183343825"
              x2="43.3155090799"
              y2="43.6659072629"
            >
              <stop offset=".09" stopColor="#fff" />
              <stop offset=".318" stopColor="#fff" stopOpacity=".999" />
              <stop offset=".545" stopColor="#fff" stopOpacity=".968" />
              <stop offset=".773" stopColor="#fff" stopOpacity=".761" />
              <stop offset=".8817" stopColor="#fff" stopOpacity=".5" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask
              id={`${id}-corner`}
              maskUnits="userSpaceOnUse"
              x="-2"
              y="-2"
              width="93.0579646228"
              height="93.0579646228"
            >
              <rect
                x="-2"
                y="-2"
                width="93.0579646228"
                height="93.0579646228"
                fill={`url(#${id}-fade)`}
              />
            </mask>
          </defs>
          <g mask={`url(#${id}-corner)`}>
            <path d="M0 0H89.0579646228V89.0579646228Z" fill="#fff" />
            {/* Native ThinThick stroke: .795pt thin / .795pt white gap / 1.590pt thick. */}
            <path
              d="M0 -.7950385348H89.8530031576V89.0579646228"
              fill="none"
              stroke="#243a6a"
              strokeWidth="1.5900770695"
            />
            <path
              d="M0 .3975192674H88.6604453554V89.0579646228"
              fill="none"
              stroke="#fff"
              strokeWidth=".7950385348"
            />
            <path
              d="M0 1.1925578022H87.8654068206V89.0579646228"
              fill="none"
              stroke="#243a6a"
              strokeWidth=".7950385348"
            />
          </g>
          <text
            x="53.9218715547"
            y="32.0116815921"
            transform="rotate(53 53.9218715547 32.0116815921)"
            textAnchor="middle"
            fill="#243a6a"
            fontFamily="TSTAR Headline,TSTAR,Arial,sans-serif"
            fontWeight="400"
            fontSize={String(inches).length > 2 ? "24.5" : "29.4412936119"}
            xmlSpace="preserve"
          >
            {inches}”{" "}
          </text>
        </svg>
      ) : (
        <svg viewBox="0 0 67.1693479534 34.9477117807" aria-hidden="true">
          {/* Original tablet annotation geometry from Spread_u147010, group u1bd5be. */}
          <g fill="currentColor" fontFamily="SkolaSans,Arial,sans-serif">
            <text
              x="0"
              y="17.7387065136"
              fontSize="23.6516086847"
              fontWeight="900"
            >
              {inches}”
            </text>
            <text
              x="2.3729060484"
              y="28.7886316164"
              fontSize="11.4132152250"
              fontWeight="700"
            >
              INCH
            </text>
          </g>
          <g
            transform={`translate(-4.2905642875 25.7483815485) scale(${guideLengths.horizontalLength ?? 1} 1) translate(4.2905642875 -25.7483815485)`}
          >
            <path
              d="M-4.2905642875 25.7483815485H-57.9177933405"
              fill="none"
              stroke="currentColor"
              strokeWidth=".7848084172"
            />
            <path
              d="M-60.1129562585 25.7483815485L-56.2468581931 27.8622495821V23.6345135149Z"
              fill="currentColor"
            />
          </g>
          <g
            transform={`translate(33.3868950515 30.1451137381) scale(1 ${guideLengths.verticalLength ?? 1}) translate(-33.3868950515 -30.1451137381)`}
          >
            <path
              d="M33.3868950515 30.1451137381V84.5082917263"
              fill="none"
              stroke="currentColor"
              strokeWidth=".7848084172"
            />
            <path
              d="M33.3868950515 86.3450966779L35.6189878103 82.6837698432H31.1548022927Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.1370806913"
            />
          </g>
        </svg>
      )}
      {children}
    </span>
  );
}
