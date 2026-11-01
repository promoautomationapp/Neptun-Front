import { expect, it } from "vitest";
import { safeRichHtml } from "../../src/features/social/RichTextModal";

function sanitized(html: string) {
  const root = document.createElement("div");
  root.innerHTML = safeRichHtml(html);
  return root;
}

it("prevents stored post copy from using platform classes, page overlays or external CSS requests", () => {
  const root = sanitized(
    '<p class="cs-modal-backdrop" style="position:fixed;inset:0;z-index:2147483647;background-image:url(https://attacker.invalid/track);color:#123456;text-align:center">Offer copy</p>',
  );
  const paragraph = root.querySelector("p")!;
  expect(paragraph.getAttribute("class")).toBeNull();
  expect(paragraph.style.position).toBe("");
  expect(paragraph.style.inset).toBe("");
  expect(paragraph.style.zIndex).toBe("");
  expect(paragraph.style.backgroundImage).toBe("");
  expect(paragraph.style.color).toBe("rgb(18, 52, 86)");
  expect(paragraph.style.textAlign).toBe("center");
});

it("preserves editor formatting and uploaded images while discarding script, handler and executable URL input", () => {
  const root = sanitized(
    '<h1 style="text-align:right;color:rgb(255, 0, 0)">Title</h1><p><strong>Bold</strong> <em>Italic</em><u>Underline</u></p><ul><li>Item</li></ul><img src="data:image/png;base64,AA==" alt="Upload" onerror="alert(1)"><script>alert(2)</script><svg onload="alert(3)"></svg><a href="javascript:alert(4)">Bad link</a>',
  );
  expect(root.querySelector("h1")?.style.textAlign).toBe("right");
  expect(root.querySelector("h1")?.style.color).toBe("rgb(255, 0, 0)");
  expect(root.querySelectorAll("strong,em,u,li")).toHaveLength(4);
  expect(root.querySelector("img")?.getAttribute("src")).toBe(
    "data:image/png;base64,AA==",
  );
  expect(root.querySelector("img")?.getAttribute("alt")).toBe("Upload");
  expect(root.querySelector("script,svg,[onerror],[onload]")).toBeNull();
  expect(root.querySelector("a")?.getAttribute("href")).toBeNull();
});

it("isolates a link opened in another tab and does not target named application windows", () => {
  const root = sanitized(
    '<a href="https://example.test/offer" target="_blank" rel="opener">Offer</a><a href="https://example.test/other" target="neptun">Other</a>',
  );
  const links = root.querySelectorAll("a");
  expect(links[0]!.rel).toContain("noopener");
  expect(links[0]!.rel).toContain("noreferrer");
  expect(links[0]!.rel).not.toMatch(/(?:^|\s)opener(?:\s|$)/);
  expect(links[1]!.getAttribute("target")).toBeNull();
});
