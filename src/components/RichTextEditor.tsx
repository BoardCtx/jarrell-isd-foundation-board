'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, IndentIncrease, IndentDecrease,
  Undo2, Redo2, Type, Palette, Minus,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

const fontSizes = ['1', '2', '3', '4', '5', '6', '7']
const fontSizeLabels: Record<string, string> = {
  '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px',
}

const fontFamilies = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
]

const colors = [
  '#000000', '#434343', '#666666', '#999999',
  '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#c00000', '#ff0000', '#ffc000', '#ffff00',
  '#92d050', '#00b050', '#00b0f0', '#0070c0',
  '#002060', '#7030a0', '#ffffff',
]

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '300px' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showFontSize, setShowFontSize] = useState(false)
  const [showFontFamily, setShowFontFamily] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize with value
  useEffect(() => {
    if (editorRef.current && !initialized) {
      editorRef.current.innerHTML = value || ''
      setInitialized(true)
    }
  }, [value, initialized])

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, val)
    // Notify parent of change
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const closeAllDropdowns = () => {
    setShowFontSize(false)
    setShowFontFamily(false)
    setShowColorPicker(false)
  }

  const ToolbarButton = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {children}
    </button>
  )

  const Divider = () => <div className="w-px h-5 bg-gray-200 mx-0.5" />

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        {/* Undo / Redo */}
        <ToolbarButton onClick={() => exec('undo')} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('redo')} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </ToolbarButton>

        <Divider />

        {/* Font Family */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); closeAllDropdowns(); setShowFontFamily(!showFontFamily) }}
            title="Font Family"
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1 min-w-[90px]"
          >
            <Type size={13} /> Font
          </button>
          {showFontFamily && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
              {fontFamilies.map(f => (
                <button
                  key={f.value}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100"
                  style={{ fontFamily: f.value }}
                  onClick={(e) => { e.preventDefault(); exec('fontName', f.value); setShowFontFamily(false) }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); closeAllDropdowns(); setShowFontSize(!showFontSize) }}
            title="Font Size"
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
          >
            Size
          </button>
          {showFontSize && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
              {fontSizes.map(s => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-1 text-sm hover:bg-gray-100"
                  onClick={(e) => { e.preventDefault(); exec('fontSize', s); setShowFontSize(false) }}
                >
                  {fontSizeLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Text formatting */}
        <ToolbarButton onClick={() => exec('bold')} title="Bold (Ctrl+B)">
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic (Ctrl+I)">
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline (Ctrl+U)">
          <Underline size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('strikeThrough')} title="Strikethrough">
          <Strikethrough size={15} />
        </ToolbarButton>

        {/* Text Color */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); closeAllDropdowns(); setShowColorPicker(!showColorPicker) }}
            title="Text Color"
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
          >
            <Palette size={15} />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 grid grid-cols-4 gap-1" style={{ width: '140px' }}>
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  className="w-7 h-7 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={(e) => { e.preventDefault(); exec('foreColor', c); setShowColorPicker(false) }}
                />
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet List">
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered List">
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('indent')} title="Indent">
          <IndentIncrease size={15} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('outdent')} title="Outdent">
          <IndentDecrease size={15} />
        </ToolbarButton>

        <Divider />

        {/* Horizontal Rule */}
        <ToolbarButton onClick={() => exec('insertHorizontalRule')} title="Horizontal Line">
          <Minus size={15} />
        </ToolbarButton>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={closeAllDropdowns}
        className="px-4 py-3 outline-none overflow-y-auto text-sm text-gray-800 leading-relaxed"
        style={{ minHeight }}
        data-placeholder={placeholder || 'Start typing...'}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
        [contenteditable] ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        [contenteditable] li { margin: 0.25em 0; }
        [contenteditable] hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
      `}</style>
    </div>
  )
}
