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

export function safeRichHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(String(html || ""), {
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
    ALLOWED_ATTR: ["href", "target", "rel", "style", "src", "alt", "class"],
  });
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
  });
  const button = (
    label: string,
    action: React.MouseEventHandler<HTMLButtonElement>,
    active = false,
  ) => (
    <button
      type="button"
      className={active ? "active" : ""}
      onClick={action}
      aria-label={label}
    >
      {label}
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
        aria-label="Edit formatted post text"
      >
        <header>
          <div>
            <small>POST COPY</small>
            <h2>Write your message</h2>
            <p>
              Format the heading or supporting copy, and add an image if needed.
            </p>
          </div>
          <button
            type="button"
            className="social-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div
          className="social-rich-toolbar"
          role="toolbar"
          aria-label="Text formatting"
        >
          {button(
            "H1",
            () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
            editor?.isActive("heading", { level: 1 }),
          )}
          {button(
            "H2",
            () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            editor?.isActive("heading", { level: 2 }),
          )}
          {button(
            "B",
            () => editor?.chain().focus().toggleBold().run(),
            editor?.isActive("bold"),
          )}
          {button(
            "I",
            () => editor?.chain().focus().toggleItalic().run(),
            editor?.isActive("italic"),
          )}
          {button(
            "U",
            () => editor?.chain().focus().toggleUnderline().run(),
            editor?.isActive("underline"),
          )}
          {button(
            "• List",
            () => editor?.chain().focus().toggleBulletList().run(),
            editor?.isActive("bulletList"),
          )}
          {button(
            "1. List",
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
          <label className="social-rich-color" title="Text color">
            A
            <input
              type="color"
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
              Add link
            </button>
            <button
              type="button"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Remove
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
            Clear
          </button>
          <span />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => onSave(safeRichHtml(editor?.getHTML() || ""))}
          >
            Apply to post
          </button>
        </footer>
      </section>
    </div>
  );
}
