import React from "react";
import type { Box } from "../../domain/models";
import type { BlackFridayFrame } from "./blackFridayDesign";
import { textFontCss } from "./textFonts";

export interface SourceDetail extends Box {
  id: string;
  text: string;
  pointSize: number;
  fontSize?: number;
  characterRuns?: {
    text: string;
    color: string;
    fontFamily: string;
    fontWeight: number;
    fontStyle: string;
    fontSize: number;
  }[];
  fontFamily: string;
  fontWeight: number;
  uppercase?: boolean;
  imageUrl?: string | null;
  fill?: string;
  warranty?: boolean;
  runs?: SourceDetail[];
}
export function blackFridayDetail(
  frame: BlackFridayFrame | undefined,
  index: number,
  warranty = false,
) {
  const details = frame?.detailRects;
  return warranty
    ? details?.find((detail) => detail.warranty)
    : details?.filter((detail) => !detail.warranty)[index];
}
export function blackFridayDetailStyle(
  frame: BlackFridayFrame | undefined,
  detail: SourceDetail | undefined,
): React.CSSProperties | undefined {
  if (!frame?.specs || !detail) return undefined;
  const parent = frame.specs;
  return {
    position: "absolute",
    left: `${((detail.x - parent.x) / parent.width) * 100}%`,
    top: `${((detail.y - parent.y) / parent.height) * 100}%`,
    width: `${(detail.width / parent.width) * 100}%`,
    height: `${(detail.height / parent.height) * 100}%`,
    maxWidth: "none",
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    fontFamily: textFontCss(detail.fontFamily),
    fontSize: `${(detail.pointSize / 841.88976) * 100}cqw`,
    fontWeight: detail.fontWeight,
  };
}
const sourceText = (value: string) =>
  value.replace(/\\n/g, "\n").replace(/\n[ \t]+/g, "\n");
const sameText = (a: string, b: string) =>
  sourceText(a).replace(/\s/g, "").toLowerCase() ===
  sourceText(b).replace(/\s/g, "").toLowerCase();

export function BlackFridayDetailContent({
  detail,
  text,
}: {
  detail: SourceDetail;
  text: string;
}) {
  return (
    <span
      className="bf-source-detail-value"
      style={{
        fontFamily: textFontCss(detail.fontFamily),
        fontSize: `${(detail.pointSize / 841.88976) * 100}cqw`,
        fontWeight: detail.fontWeight,
        textTransform: detail.uppercase ? "uppercase" : "none",
      }}
    >
      {detail.imageUrl && <img src={detail.imageUrl} alt="" />}
      {detail.characterRuns?.length && sameText(detail.text, text)
        ? detail.characterRuns.map((run, index) => (
            <em
              key={index}
              className="bf-source-detail-run"
              style={{
                color: /^#(?:ffffff|000000)$/i.test(run.color)
                  ? "inherit"
                  : run.color,
                fontFamily: textFontCss(run.fontFamily),
                fontWeight: run.fontWeight,
                fontStyle: /italic/i.test(run.fontStyle) ? "italic" : "normal",
                fontSize: `${detail.fontSize ? run.fontSize / detail.fontSize : 1}em`,
              }}
            >
              {sourceText(run.text)}
            </em>
          ))
        : sourceText(text)}
    </span>
  );
}
