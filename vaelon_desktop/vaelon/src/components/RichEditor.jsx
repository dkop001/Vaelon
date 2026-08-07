import React, { forwardRef, useImperativeHandle, useCallback, useState, useEffect, useRef } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { Bold, Italic, Code, Heading1, Heading2, Heading3, List, ListOrdered, Quote } from "lucide-react";

// ─── Slash Command Extension ─────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { label: "Heading 1",       icon: "H1", action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "Heading 2",       icon: "H2", action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Heading 3",       icon: "H3", action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Bullet List",     icon: "•",  action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { label: "Numbered List",   icon: "1.", action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { label: "Blockquote",      icon: "❝",  action: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { label: "Code Block",      icon: "</>",action: (editor) => editor.chain().focus().toggleCodeBlock().run() },
];

const ToolbarButton = ({ onClick, active, children, title }) => (
  <button
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    style={{
      width: "28px",
      height: "28px",
      minWidth: "28px",
      minHeight: "28px",
      borderRadius: "var(--radius-sm)",
      border: active ? "1px solid var(--accent-primary)" : "1px solid transparent",
      backgroundColor: active ? "hsla(262,80%,60%,0.15)" : "transparent",
      color: active ? "var(--accent-primary)" : "var(--text-secondary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "var(--transition)",
      fontSize: "0.7rem",
      fontWeight: 700,
    }}
    className="hover-bg"
  >
    {children}
  </button>
);

const RichEditor = forwardRef(({ content, onChange, placeholder }, ref) => {
  const [slashMenu, setSlashMenu] = useState({ visible: false, index: 0 });
  const slashMenuRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write something… type / for commands",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (onChange) onChange(text);

      // Detect slash at start of a line
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 1),
        from,
        "\n"
      );
      if (textBefore === "/") {
        setSlashMenu({ visible: true, index: 0 });
      } else if (slashMenu.visible) {
        setSlashMenu((s) => ({ ...s, visible: false }));
      }
    },
    editorProps: {
      attributes: { class: "rich-editor-content" },
      handleKeyDown: (view, event) => {
        if (slashMenu.visible) {
          if (event.key === "ArrowDown") {
            setSlashMenu((s) => ({ ...s, index: (s.index + 1) % SLASH_COMMANDS.length }));
            return true;
          }
          if (event.key === "ArrowUp") {
            setSlashMenu((s) => ({ ...s, index: (s.index - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length }));
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            return true; // handled by menu click
          }
          if (event.key === "Escape") {
            setSlashMenu((s) => ({ ...s, visible: false }));
            return true;
          }
        }
        return false;
      },
    },
  });

  const getPlainText = useCallback(() => editor?.getText() || "", [editor]);
  useImperativeHandle(ref, () => ({ getPlainText }), [getPlainText]);

  // Close slash menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashMenu((s) => ({ ...s, visible: false }));
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const applySlashCommand = (cmd) => {
    if (!editor) return;
    // Delete the slash character first
    editor.chain().focus().deleteRange({
      from: editor.state.selection.from - 1,
      to: editor.state.selection.from,
    }).run();
    cmd.action(editor);
    setSlashMenu({ visible: false, index: 0 });
  };

  if (!editor) return null;

  return (
    <div
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        overflow: "visible",
        marginBottom: "1.25rem",
        position: "relative",
      }}
    >
      {/* Static toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
          padding: "0.5rem 0.625rem",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          flexWrap: "wrap",
        }}
      >
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <Code size={13} />
        </ToolbarButton>

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 0.2rem" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 size={13} />
        </ToolbarButton>

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 0.2rem" }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote size={13} />
        </ToolbarButton>

        <div style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-tertiary)", paddingRight: "0.25rem", whiteSpace: "nowrap" }}>
          Type <kbd style={{ padding: "0.1rem 0.3rem", borderRadius: "3px", border: "1px solid var(--border-color)", fontSize: "0.65rem", fontFamily: "monospace" }}>/</kbd> for blocks
        </div>
      </div>

      {/* Floating BubbleMenu for text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: "top" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.15rem",
            padding: "0.35rem",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold size={13} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic size={13} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Code">
            <Code size={13} />
          </ToolbarButton>
          <div style={{ width: "1px", height: "14px", backgroundColor: "var(--border-color)", margin: "0 0.15rem" }} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="H2">
            <span style={{ fontSize: "0.65rem", fontWeight: 800 }}>H2</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
            <Quote size={11} />
          </ToolbarButton>
        </div>
      </BubbleMenu>

      {/* Slash command dropdown */}
      {slashMenu.visible && (
        <div
          ref={slashMenuRef}
          style={{
            position: "absolute",
            left: "1rem",
            zIndex: 100,
            width: "210px",
            padding: "0.375rem",
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {SLASH_COMMANDS.map((cmd, i) => (
            <button
              key={cmd.label}
              onMouseDown={(e) => { e.preventDefault(); applySlashCommand(cmd); }}
              style={{
                width: "100%",
                minHeight: "36px",
                padding: "0.4rem 0.625rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                backgroundColor: i === slashMenu.index ? "hsla(262,80%,60%,0.1)" : "transparent",
                border: i === slashMenu.index ? "1px solid hsla(262,80%,60%,0.2)" : "1px solid transparent",
              }}
            >
              <span style={{
                width: "24px",
                height: "24px",
                minWidth: "24px",
                borderRadius: "4px",
                backgroundColor: "hsla(262,80%,60%,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 800,
                color: "var(--accent-primary)",
                fontFamily: "monospace",
              }}>
                {cmd.icon}
              </span>
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      <EditorContent
        editor={editor}
        style={{
          padding: "0.875rem 1rem",
          minHeight: "120px",
          maxHeight: typeof window !== "undefined" && window.innerWidth < 640 ? "250px" : "400px",
          overflowY: "auto",
          fontSize: "0.9375rem",
          lineHeight: "1.7",
          color: "var(--text-primary)",
        }}
      />

      <style>{`
        .rich-editor-content {
          outline: none;
          min-height: 80px;
        }
        .rich-editor-content p {
          margin-bottom: 0.5rem;
        }
        .rich-editor-content h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          font-family: var(--font-heading);
        }
        .rich-editor-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.625rem;
          font-family: var(--font-heading);
        }
        .rich-editor-content h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          font-family: var(--font-heading);
        }
        .rich-editor-content ul,
        .rich-editor-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .rich-editor-content li {
          margin-bottom: 0.25rem;
        }
        .rich-editor-content blockquote {
          border-left: 3px solid var(--accent-primary);
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: var(--text-secondary);
          font-style: italic;
        }
        .rich-editor-content code {
          background-color: var(--bg-tertiary);
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-size: 0.85em;
          font-family: monospace;
        }
        .rich-editor-content pre {
          background-color: var(--bg-tertiary);
          padding: 1rem;
          border-radius: var(--radius-sm);
          overflow-x: auto;
          margin-bottom: 0.5rem;
        }
        .rich-editor-content pre code {
          background: none;
          padding: 0;
        }
        .rich-editor-content hr {
          border: none;
          border-top: 1px solid var(--border-color);
          margin: 1rem 0;
        }
        .rich-editor-content p.is-editor-empty:first-child::before {
          color: var(--text-tertiary);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        /* BubbleMenu tippy styles */
        .tippy-box { background: none !important; box-shadow: none !important; }
      `}</style>
    </div>
  );
});

RichEditor.displayName = "RichEditor";
export default RichEditor;
