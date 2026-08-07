import { forwardRef, useImperativeHandle, useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

// ─── Slash Commands ────────────────────────────────────────────────────────────
interface SlashCommand {
  label: string;
  icon: string;
  desc: string;
  action: (editor: Editor) => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { label: 'Heading 1',     icon: 'H1',  desc: 'Large section header',    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',     icon: 'H2',  desc: 'Medium section header',   action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',     icon: 'H3',  desc: 'Small section header',    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List',   icon: '•',   desc: 'Simple bullet list',      action: (e) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List', icon: '1.',  desc: 'Ordered numbered list',   action: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Blockquote',    icon: '❝',   desc: 'Highlight a key thought', action: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code Block',    icon: '</>', desc: 'Monospace code block',    action: (e) => e.chain().focus().toggleCodeBlock().run() },
];

// ─── Toolbar button ────────────────────────────────────────────────────────────
interface ToolbarBtnProps {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarBtn = ({ onClick, active, title, children }: ToolbarBtnProps) => (
  <button
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={`toolbar-btn ${active ? 'active' : ''}`}
    type="button"
    aria-pressed={active}
  >
    {children}
  </button>
);

// ─── Bubble menu wrapper ───────────────────────────────────────────────────────
function BubbleBar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return (
    <BubbleMenu editor={editor}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: 4,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
      }}>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 12 }}>B</strong>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <em style={{ fontFamily: 'Georgia, serif', fontSize: 12 }}>I</em>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{'<>'}</code>
        </ToolbarBtn>
        <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <span style={{ fontSize: 10, fontWeight: 700 }}>H1</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <span style={{ fontSize: 10, fontWeight: 700 }}>H2</span>
        </ToolbarBtn>
        <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <span style={{ fontSize: 12 }}>❝</span>
        </ToolbarBtn>
      </div>
    </BubbleMenu>
  );
}

// ─── Public API exposed via ref ────────────────────────────────────────────────
export interface RichEditorHandle {
  getHTML: () => string;
  getPlainText: () => string;
}

interface RichEditorProps {
  content: string;
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
}

// ─── RichEditor ────────────────────────────────────────────────────────────────
const RichEditor = forwardRef<RichEditorHandle, RichEditorProps>(({ content, onChange, placeholder }, ref) => {
  const [slashMenu, setSlashMenu] = useState({ visible: false, index: 0 });
  const slashMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something… type / for commands',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      if (onChange) onChange(editor.getHTML(), text);

      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from, '\n');
      if (textBefore === '/') {
        setSlashMenu({ visible: true, index: 0 });
      } else if (slashMenu.visible && textBefore !== '/') {
        setSlashMenu(s => ({ ...s, visible: false }));
      }
    },
    editorProps: {
      attributes: { class: 'rich-editor-content' },
      handleKeyDown: (_view, event) => {
        if (slashMenu.visible) {
          if (event.key === 'ArrowDown') {
            setSlashMenu(s => ({ ...s, index: (s.index + 1) % SLASH_COMMANDS.length }));
            return true;
          }
          if (event.key === 'ArrowUp') {
            setSlashMenu(s => ({ ...s, index: (s.index - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length }));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            applySlashCommand(SLASH_COMMANDS[slashMenu.index]);
            return true;
          }
          if (event.key === 'Escape') {
            setSlashMenu(s => ({ ...s, visible: false }));
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync content when switching notes
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const getPlainText = useCallback(() => editor?.getText() || '', [editor]);
  const getHTML = useCallback(() => editor?.getHTML() || '', [editor]);
  useImperativeHandle(ref, () => ({ getPlainText, getHTML }), [getPlainText, getHTML]);

  // Close slash menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenu(s => ({ ...s, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const applySlashCommand = useCallback((cmd: SlashCommand) => {
    if (!editor) return;
    editor.chain().focus().deleteRange({
      from: editor.state.selection.from - 1,
      to: editor.state.selection.from,
    }).run();
    cmd.action(editor);
    setSlashMenu({ visible: false, index: 0 });
  }, [editor]);

  if (!editor) return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[100, 75, 88, 60].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${w}%`, borderRadius: 6 }} />
      ))}
    </div>
  );

  return (
    <div className="rich-editor-wrapper">
      {/* Static toolbar */}
      <div className="rich-editor-toolbar">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
          <strong style={{ fontSize: 12, fontFamily: 'var(--font-sans)' }}>B</strong>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
          <em style={{ fontSize: 12, fontFamily: 'Georgia, serif' }}>I</em>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{'<>'}</code>
        </ToolbarBtn>

        <div className="toolbar-sep" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <span style={{ fontSize: 10, fontWeight: 800 }}>H1</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <span style={{ fontSize: 10, fontWeight: 700 }}>H2</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <span style={{ fontSize: 10, fontWeight: 600 }}>H3</span>
        </ToolbarBtn>

        <div className="toolbar-sep" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <span style={{ fontSize: 11 }}>• List</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <span style={{ fontSize: 11 }}>1. List</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <span style={{ fontSize: 13 }}>❝</span>
        </ToolbarBtn>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--tx-disabled)', fontSize: 11 }}>
          Type
          <kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-overlay)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>/</kbd>
          for blocks
        </div>
      </div>

      {/* Bubble menu */}
      <BubbleBar editor={editor} />

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Slash command menu */}
      {slashMenu.visible && (
        <div ref={slashMenuRef} className="slash-menu" role="listbox" aria-label="Block type menu">
          <div style={{ padding: '4px 10px 2px', fontSize: 9, fontWeight: 600, color: 'var(--tx-disabled)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Block type
          </div>
          {SLASH_COMMANDS.map((cmd, i) => (
            <button
              key={cmd.label}
              onMouseDown={(e) => { e.preventDefault(); applySlashCommand(cmd); }}
              className={`slash-menu-item ${i === slashMenu.index ? 'active' : ''}`}
              type="button"
              role="option"
              aria-selected={i === slashMenu.index}
            >
              <span className="slash-menu-icon">{cmd.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{cmd.label}</div>
                <div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>{cmd.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

RichEditor.displayName = 'RichEditor';
export default RichEditor;
