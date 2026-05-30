import { useCallback, useEffect, useRef, useState } from 'react'
import { FONT_SIZE_OPTIONS, POPULAR_ICONS, iconifyUrl } from '../../lib/marketingEmailTokens'
import {
  applyInlineStyleToSelection,
  getPopularIconMeta,
  insertIconAtCursor,
  isRichHtml,
  plainTextToEditorHtml,
  sanitizeRichHtml,
} from '../../lib/marketingRichText'

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  minHeight = 100,
  singleLine = false,
}) {
  const editorRef = useRef(null)
  const isInternalChange = useRef(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [fmtSize, setFmtSize] = useState(15)
  const [fmtColor, setFmtColor] = useState('#374151')
  const [iconColor, setIconColor] = useState('#374151')
  const [iconSize, setIconSize] = useState(20)
  const [showIcons, setShowIcons] = useState(false)

  const getHtmlFromValue = useCallback(() => {
    return isRichHtml(value) ? value : plainTextToEditorHtml(value)
  }, [value])

  useEffect(() => {
    const el = editorRef.current
    if (!el || isInternalChange.current) return
    if (document.activeElement === el) return

    const html = getHtmlFromValue()
    if (el.innerHTML !== html) {
      el.innerHTML = html
    }
  }, [value, getHtmlFromValue])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    isInternalChange.current = true
    onChange(sanitizeRichHtml(el.innerHTML))
    requestAnimationFrame(() => {
      isInternalChange.current = false
    })
  }, [onChange])

  const updateSelectionState = useCallback(() => {
    const sel = window.getSelection()
    const el = editorRef.current
    if (!sel?.rangeCount || !el) {
      setHasSelection(false)
      return
    }
    const range = sel.getRangeAt(0)
    setHasSelection(!range.collapsed && el.contains(range.commonAncestorContainer))
  }, [])

  const applyFormat = () => {
    if (applyInlineStyleToSelection(editorRef.current, { fontSize: fmtSize, color: fmtColor })) {
      emitChange()
    }
  }

  const applyBold = () => {
    if (applyInlineStyleToSelection(editorRef.current, { fontWeight: 'bold' })) {
      emitChange()
    }
  }

  const addIcon = (iconId) => {
    if (insertIconAtCursor(editorRef.current, iconId, iconSize, iconColor)) {
      emitChange()
      setShowIcons(false)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emitChange()
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={() => setShowIcons((v) => !v)}
          className={`text-[10px] font-semibold px-2 py-1 rounded border ${
            showIcons ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 bg-white'
          }`}
        >
          Insert icon
        </button>
        <button
          type="button"
          onClick={applyBold}
          disabled={!hasSelection}
          className="text-[10px] font-bold px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40"
          title="Bold selection"
        >
          B
        </button>
        {hasSelection && (
          <>
            <select
              value={fmtSize}
              onChange={(e) => setFmtSize(Number(e.target.value))}
              className="text-[10px] border border-gray-200 rounded px-1.5 py-1 bg-white"
              title="Font size for selection"
            >
              {FONT_SIZE_OPTIONS.filter((s) => s >= 11 && s <= 36).map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
            <input
              type="color"
              value={fmtColor}
              onChange={(e) => setFmtColor(e.target.value)}
              className="h-7 w-9 rounded border border-gray-200"
              title="Color for selection"
            />
            <button
              type="button"
              onClick={applyFormat}
              className="text-[10px] font-semibold px-2 py-1 rounded bg-[#FF773D] text-[#242424]"
            >
              Apply to selection
            </button>
          </>
        )}
        {!hasSelection && (
          <span className="text-[10px] text-gray-400">Select text to change size or color</span>
        )}
      </div>

      {showIcons && (
        <div className="rounded-lg border border-gray-200 p-2 space-y-2 bg-white">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 max-h-28 overflow-y-auto">
            {POPULAR_ICONS.map((icon) => (
              <button
                key={icon.id}
                type="button"
                title={icon.label}
                onClick={() => addIcon(icon.id)}
                className="p-1.5 rounded border border-gray-100 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center"
              >
                <img
                  src={iconifyUrl(icon.iconify, { size: 18, color: iconColor })}
                  alt=""
                  width={18}
                  height={18}
                />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-gray-500">
              Icon color
              <input
                type="color"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                className="mt-0.5 block h-7 w-full rounded border border-gray-200"
              />
            </label>
            <label className="text-[10px] text-gray-500">
              Icon size
              <select
                value={iconSize}
                onChange={(e) => setIconSize(Number(e.target.value))}
                className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1"
              >
                {[16, 18, 20, 24, 28].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!singleLine}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onMouseUp={updateSelectionState}
        onKeyUp={updateSelectionState}
        onPaste={handlePaste}
        className={`rich-text-editor w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-[#FF773D]/40 focus:border-[#FF773D] empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 ${
          singleLine ? 'min-h-[40px] whitespace-nowrap overflow-x-auto' : ''
        }`}
        style={{ minHeight: singleLine ? 40 : minHeight }}
      />
    </div>
  )
}

export function RichTextEditorPreviewIcon({ iconId, size, color }) {
  const meta = getPopularIconMeta(iconId)
  return (
    <img
      src={iconifyUrl(meta.iconify, { size, color })}
      alt={meta.label}
      width={size}
      height={size}
      className="inline-block align-middle"
    />
  )
}
