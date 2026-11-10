import type { Artwork } from "../../domain/models";
import type { BrochurePreset } from "./brochurePresets";
import { isBlackFridayBrochure } from "./blackFridayDesign";

export type BlackFridayPersonChoice = {
  mode: "keep" | "replace" | "none";
  image?: string;
};

const personSources = new Set([
  "forex.png",
  "tv2.png",
  "rrobalarese.png",
  "frigorifer.png",
  "gaming.png",
  "shporet.png",
  "0v4a0793 copy.png",
  "chatgpt image nov 18, 2025, 02_11_04 pm3.png",
]);

export function blackFridayCompositePerson(artwork: Artwork) {
  return (
    blackFridayPersonSource(artwork)
      ?.toLowerCase()
      .endsWith("chatgpt image nov 18, 2025, 02_11_04 pm3.png") === true
  );
}

export function blackFridayPersonSource(artwork: Artwork): string | null {
  const record = artwork as Artwork & {
    source?: string;
    referenceSource?: string;
    referenceRole?: string;
  };
  const source = record.referenceSource || record.source || "";
  const name = source.split(/[\\/]/).at(-1)?.trim().toLowerCase() || "";
  return personSources.has(name) ? source : null;
}

/** Swap only the supplied person layers. All placements and unrelated art stay intact. */
export function withBlackFridayPerson(
  preset: BrochurePreset,
  choice: BlackFridayPersonChoice,
): BrochurePreset {
  const result = structuredClone(preset);
  if (!isBlackFridayBrochure({ ...preset.design, brochurePresetId: preset.id }))
    return result;
  const pages = result.design.pageArtworks;
  if (!pages) return result;
  for (const [key, artworks] of Object.entries(pages)) {
    pages[key] = artworks.flatMap((artwork) => {
      const referenceSource = blackFridayPersonSource(artwork);
      if (!referenceSource) return [artwork];
      if (choice.mode === "none") return [];
      return [
        {
          ...artwork,
          referenceSource,
          referenceRole: "person" as const,
          ...(choice.mode === "replace" && choice.image
            ? { image: choice.image }
            : {}),
        },
      ];
    });
  }
  return result;
}
