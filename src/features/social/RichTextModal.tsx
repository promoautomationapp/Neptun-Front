import { CloseButton } from "../../components/CloseButton";
import React, { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import DOMPurify from "dompurify";
import { readImage } from "../brochure/utils";
import { t } from "../brochure/i18n";

export function safeRichHtml(html: string | null | undefined): string {
  const fragment = DOMPurify.sanitize(String(html || ""), {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: [
      "p",
      "h1",
      "h2",
      "h3",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "br",
      "a",
      "span",
      "img",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style", "src", "alt"],
  });
  // Tiptap exposes color and alignment here. Untrusted CSS/classes must not
  // turn shared post copy into application chrome or an external CSS request.
  for (const element of fragment.querySelectorAll<HTMLElement>("[style]")) {
    const color = element.style.color;
    const align = element.style.textAlign;
    element.removeAttribute("style");
    if (color) element.style.color = color;
    if (["left", "right", "center", "justify", "start", "end"].includes(align))
      element.style.textAlign = align;
  }
  for (const link of fragment.querySelectorAll("a")) {
    if (link.getAttribute("target") === "_blank")
      link.setAttribute("rel", "noopener noreferrer");
    else {
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }
  }
  const host = document.createElement("div");
  host.append(fragment);
  return host.innerHTML;
}

export interface RichTextModalProps {
  html?: string;
  onSave: (html: string) => void;
  onClose: () => void;
}

export function RichTextModal({ html, onSave, onClose }: RichTextModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ allowBase64: true }),
    ],
    content: safeRichHtml(html),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": t("Post text"),
        "aria-multiline": "true",
      },
    },
  });
  const button = (
    label: string,
    action: React.MouseEventHandler<HTMLButtonElement>,
    active = false,
    accessibleLabel = label,
  ) => (
    <button
      type="button"
      className={active ? "active" : ""}
      onClick={action}
      aria-label={t(accessibleLabel)}
      title={t(accessibleLabel)}
    >
      {t(label)}
    </button>
  );
  return (
    <div
      className="social-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="social-rich-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("Edit formatted post text")}
      >
        <header>
          <div>
            <small>{t("POST TEXT")}</small>
            <h2>{t("Write your message")}</h2>
            <p>
              {t(
                "Format the heading or supporting copy, and add an image if needed.",
              )}
            </p>
          </div>
          <CloseButton
            className="social-modal-close"
            aria-label={t("Close")}
            onClick={onClose}
          />
        </header>
        <div
          className="social-rich-toolbar"
          role="toolbar"
          aria-label={t("Text formatting")}
        >
          {button(
            "H1",
            () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
            editor?.isActive("heading", { level: 1 }),
            "Heading 1",
          )}
          {button(
            "H2",
            () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            editor?.isActive("heading", { level: 2 }),
            "Heading 2",
          )}
          {button(
            "B",
            () => editor?.chain().focus().toggleBold().run(),
            editor?.isActive("bold"),
            "Bold",
          )}
          {button(
            "I",
            () => editor?.chain().focus().toggleItalic().run(),
            editor?.isActive("italic"),
            "Italic",
          )}
          {button(
            "U",
            () => editor?.chain().focus().toggleUnderline().run(),
            editor?.isActive("underline"),
            "Underline",
          )}
          {button(
            "Bullet list",
            () => editor?.chain().focus().toggleBulletList().run(),
            editor?.isActive("bulletList"),
          )}
          {button(
            "Numbered list",
            () => editor?.chain().focus().toggleOrderedList().run(),
            editor?.isActive("orderedList"),
          )}
          {button("Left", () =>
            editor?.chain().focus().setTextAlign("left").run(),
          )}
          {button("Center", () =>
            editor?.chain().focus().setTextAlign("center").run(),
          )}
          {button("Right", () =>
            editor?.chain().focus().setTextAlign("right").run(),
          )}
          <label className="social-rich-color" title={t("Text color")}>
            A
            <input
              type="color"
              aria-label={t("Text color")}
              defaultValue="#ffffff"
              onInput={(event) =>
                editor
                  ?.chain()
                  .focus()
                  .setColor(event.currentTarget.value)
                  .run()
              }
            />
          </label>
          {button(
            "Link",
            () => setLinkOpen((open) => !open),
            editor?.isActive("link"),
          )}
          {button("Image", () => fileRef.current?.click())}
          <input
            hidden
            ref={fileRef}
            type="file"
            aria-label={t("Upload image")}
            accept="image/png,image/jpeg,image/webp"
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (file)
                editor
                  ?.chain()
                  .focus()
                  .setImage({ src: await readImage(file), alt: file.name })
                  .run();
              input.value = "";
            }}
          />
          {button("Undo", () => editor?.chain().focus().undo().run())}
          {button("Redo", () => editor?.chain().focus().redo().run())}
        </div>
        {linkOpen && (
          <div className="social-link-form">
            <input
              type="url"
              aria-label={t("Link address")}
              autoFocus
              placeholder="https://example.com"
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (/^https:\/\//i.test(linkValue)) {
                  editor?.chain().focus().setLink({ href: linkValue }).run();
                  setLinkOpen(false);
                  setLinkValue("");
                }
              }}
            >
              {t("Add link")}
            </button>
            <button
              type="button"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              {t("Remove link")}
            </button>
          </div>
        )}
        <EditorContent editor={editor} className="social-rich-editor" />
        <footer>
          <button
            type="button"
            onClick={() => {
              editor?.commands.clearContent();
            }}
          >
            {t("Clear text")}
          </button>
          <span />
          <button type="button" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => onSave(safeRichHtml(editor?.getHTML() || ""))}
          >
            {t("Apply to post")}
          </button>
        </footer>
      </section>
    </div>
  );
}
