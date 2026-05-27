import { useEffect, useMemo, useState } from 'react'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import {
  BLOCK_LABELS,
  DEFAULT_THEME,
  FONT_OPTIONS,
  MERGE_FIELDS,
  STARTER_TEMPLATES,
  createBlock,
  duplicateBlock,
  renderEmailHtml,
  reorderBlocks,
} from '../../lib/marketingEmailDesign'
import { BLOCK_PALETTE_STYLES } from '../../lib/marketingUiConstants'
import MarketingBlockEditor from './MarketingBlockEditor'

const PALETTE = [
  { type: 'header', label: 'Heading', hint: 'Brand bar' },
  { type: 'hero', label: 'Hero', hint: 'Headline' },
  { type: 'text', label: 'Paragraph', hint: 'Body text' },
  { type: 'image', label: 'Image', hint: 'Banner' },
  { type: 'button', label: 'Button', hint: 'CTA' },
  { type: 'divider', label: 'Divider', hint: 'Line' },
  { type: 'spacer', label: 'Spacer', hint: 'Space' },
  { type: 'social', label: 'Social', hint: 'Icons' },
  { type: 'form', label: 'Form', hint: 'Capture' },
  { type: 'footer', label: 'Footer', hint: 'Legal' },
]

const BUILDER_TABS = [
  { id: 'blocks', label: 'Blocks' },
  { id: 'styles', label: 'Styles' },
  { id: 'presets', label: 'Presets' },
]

const FOLLOW_UP_STARTER = {
  subject: 'Following up, {{firstName}}',
  blocks: [
    {
      id: 'hero1',
      type: 'hero',
      heading: 'Just checking in',
      subtext: 'Hi {{firstName}} — wanted to follow up with {{companyName}}.',
    },
    {
      id: 't1',
      type: 'text',
      content:
        'I wanted to see if you had a chance to review my last note.\n\nHappy to answer any questions or find a time that works for a quick call.',
    },
    { id: 'b1', type: 'button', label: 'Reply or book time', url: 'https://connectintel.net', align: 'center' },
    { id: 'f1', type: 'footer' },
  ],
}

function DraggableBlockCard({
  block,
  index,
  total,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onChange,
  marketingForms,
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`bg-white border rounded-xl p-3 transition-colors ${
        isDragging ? 'opacity-50 border-gray-300' : 'border-gray-200'
      } ${isDropTarget ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none shrink-0"
            title="Drag to reorder"
            aria-hidden
          >
            ⠿
          </span>
          <span className="text-xs font-semibold text-gray-900 truncate">
            {BLOCK_LABELS[block.type] || block.type}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
            className="text-[10px] px-2 py-1 border border-gray-200 rounded disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
            className="text-[10px] px-2 py-1 border border-gray-200 rounded disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            className="text-[10px] px-2 py-1 border border-gray-200 rounded"
            title="Duplicate block"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-[10px] px-2 py-1 border border-red-100 text-red-700 rounded"
          >
            Remove
          </button>
        </div>
      </div>
      <MarketingBlockEditor block={block} onChange={onChange} marketingForms={marketingForms} />
    </div>
  )
}

export default function MarketingTemplateBuilder({
  value,
  onChange,
  onSave,
  onCancel,
  busy,
  templates = [],
  onEdit,
  onDelete,
  embedded = false,
  fillHeight = false,
  showNameField = true,
  showSavedTemplates = true,
  title,
  subtitle,
  starterOptions,
  marketingForms = [],
}) {
  const [previewMode, setPreviewMode] = useState('desktop')
  const [sideTab, setSideTab] = useState('blocks')
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const [paletteDragType, setPaletteDragType] = useState(null)

  const blockCount = value.blocks?.length || 0
  useEffect(() => {
    if (selectedBlockIndex >= blockCount && blockCount > 0) {
      setSelectedBlockIndex(blockCount - 1)
    }
  }, [blockCount, selectedBlockIndex])

  const previewHtml = useMemo(
    () => renderEmailHtml(value.blocks || [], value.design || DEFAULT_THEME, { previewText: value.previewText }),
    [value.blocks, value.design, value.previewText]
  )

  const moveBlock = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= (value.blocks || []).length) return
    onChange({ ...value, blocks: reorderBlocks(value.blocks || [], index, next) })
  }

  const updateBlock = (index, block) => {
    const blocks = [...(value.blocks || [])]
    blocks[index] = block
    onChange({ ...value, blocks })
  }

  const removeBlock = (index) => {
    onChange({ ...value, blocks: (value.blocks || []).filter((_, i) => i !== index) })
  }

  const duplicateBlockAt = (index) => {
    const blocks = [...(value.blocks || [])]
    blocks.splice(index + 1, 0, duplicateBlock(blocks[index]))
    onChange({ ...value, blocks })
  }

  const addBlock = (type) => {
    const blocks = [...(value.blocks || []), createBlock(type)]
    onChange({ ...value, blocks })
    setSelectedBlockIndex(blocks.length - 1)
  }

  const handlePaletteDragStart = (e, type) => {
    setPaletteDragType(type)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-ci-block-type', type)
  }

  const handleCanvasDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = paletteDragType ? 'copy' : 'move'
  }

  const handleCanvasDrop = (e) => {
    e.preventDefault()
    const type = paletteDragType || e.dataTransfer.getData('application/x-ci-block-type')
    if (type) {
      addBlock(type)
      setPaletteDragType(null)
    }
  }

  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropIndex !== index) setDropIndex(index)
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(from) || from === index) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }
    onChange({ ...value, blocks: reorderBlocks(value.blocks || [], from, index) })
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const loadStarter = (starterId) => {
    const starter =
      starterOptions?.find((s) => s.id === starterId) || STARTER_TEMPLATES.find((s) => s.id === starterId)
    if (!starter) return
    onChange({
      ...value,
      name: showNameField ? value.name || starter.name : value.name,
      subject: starter.subject,
      blocks: starter.blocks.map((b) => ({ ...b, id: createBlock(b.type).id })),
      design: { ...(starter.design || DEFAULT_THEME) },
    })
  }

  const isEditing = Boolean(value.id)
  const starters = starterOptions?.length ? starterOptions : STARTER_TEMPLATES
  const headerTitle = title || (isEditing ? 'Edit template' : embedded ? 'Email content' : 'Visual email builder')
  const headerSubtitle =
    subtitle ||
    (embedded
      ? 'Build with blocks — drag to reorder, duplicate, and preview live.'
      : 'Drag blocks to reorder — use Insert icon inside text blocks for inline icons.')

  const builderShellClass = fillHeight
    ? 'flex-1 min-h-[min(680px,calc(100vh-9.5rem))] h-full'
    : 'min-h-[560px] max-h-[calc(100vh-10rem)]'

  return (
    <div
      className={`${embedded ? (fillHeight ? 'flex flex-col flex-1 min-h-0 h-full' : '') : 'max-w-[1400px] mx-auto'} ${fillHeight ? '' : 'space-y-4'}`}
    >
      {(!embedded || onSave || onCancel) && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${
            fillHeight ? 'shrink-0 px-1 pb-2' : ''
          }`}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{headerTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{headerSubtitle}</p>
          </div>
          {(onSave || onCancel) && (
            <div className="flex flex-wrap gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs font-semibold px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {isEditing ? 'Cancel edit' : 'Clear & start over'}
                </button>
              )}
              {onSave && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSave}
                  className="text-xs font-semibold px-3 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-50 hover:bg-slate-800"
                >
                  {busy ? 'Saving…' : isEditing ? 'Update template' : 'Save template'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={`bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col ${builderShellClass}`}
      >
        {fillHeight && embedded && title && !onSave && (
          <p className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-slate-700 border-b border-gray-100 bg-slate-50/90">
            {headerTitle}
          </p>
        )}
        <div className="shrink-0 px-3 py-2 border-b border-gray-100 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {showNameField && (
              <input
                value={value.name || ''}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                placeholder="Template name"
                className="flex-1 min-w-[140px] text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
            )}
            <input
              value={value.subject || ''}
              onChange={(e) => onChange({ ...value, subject: e.target.value })}
              placeholder="Subject — {{firstName}}, your update"
              className="flex-[2] min-w-[200px] text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
            <div className="flex gap-1 items-center">
              {['desktop', 'mobile'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-md font-semibold capitalize ${
                    previewMode === mode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <input
            value={value.previewText || ''}
            onChange={(e) => onChange({ ...value, previewText: e.target.value })}
            placeholder="Inbox preview text (optional)"
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5"
          />
        </div>

        <div className="flex flex-1 min-h-0">
          <aside className="w-56 shrink-0 border-r border-gray-100 bg-white flex flex-col min-h-0">
            <div className="shrink-0 flex border-b border-gray-100">
              {BUILDER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSideTab(tab.id)}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide border-b-2 -mb-px ${
                    sideTab === tab.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="shrink-0 px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-50">
              {sideTab === 'blocks' && 'Drag to add content to your email'}
              {sideTab === 'styles' && 'Theme colors and fonts'}
              {sideTab === 'presets' && 'Start from a full layout'}
            </p>
            <div className="flex-1 overflow-y-auto p-2">
              {sideTab === 'blocks' && (
                <>
                  <p className="text-[10px] text-gray-400 mb-2 px-1">Drag or click to add</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PALETTE.map((item) => {
                      const style = BLOCK_PALETTE_STYLES[item.type] || BLOCK_PALETTE_STYLES.text
                      return (
                        <button
                          key={item.type}
                          type="button"
                          draggable
                          onDragStart={(e) => handlePaletteDragStart(e, item.type)}
                          onDragEnd={() => setPaletteDragType(null)}
                          onClick={() => addBlock(item.type)}
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border ${style.border} ${style.bg} hover:brightness-[0.97] text-center min-h-[72px] marketing-block-card`}
                        >
                          <span className={`text-lg leading-none ${style.text}`}>
                            {style.icon}
                          </span>
                          <span className={`text-[9px] font-semibold leading-tight ${style.text}`}>
                            {item.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">Merge fields</p>
                    <div className="flex flex-wrap gap-1">
                      {MERGE_FIELDS.map((f) => (
                        <span key={f.token} className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                          {f.token}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {sideTab === 'styles' && (
                <div className="space-y-3 text-xs">
                  <label className="block text-gray-600">
                    Font
                    <select
                      value={FONT_OPTIONS.find((f) => f.stack === value.design?.fontFamily)?.id || 'arial'}
                      onChange={(e) => {
                        const font = FONT_OPTIONS.find((f) => f.id === e.target.value)
                        onChange({
                          ...value,
                          design: {
                            ...DEFAULT_THEME,
                            ...value.design,
                            fontFamily: font?.stack || DEFAULT_THEME.fontFamily,
                          },
                        })
                      }}
                      className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-gray-600">
                    Brand color
                    <input
                      type="color"
                      value={value.design?.primaryColor || DEFAULT_THEME.primaryColor}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          design: { ...DEFAULT_THEME, ...value.design, primaryColor: e.target.value },
                        })
                      }
                      className="mt-1 h-9 w-full rounded border border-gray-200"
                    />
                  </label>
                  <label className="block text-gray-600">
                    Page background
                    <input
                      type="color"
                      value={value.design?.backgroundColor || DEFAULT_THEME.backgroundColor}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          design: { ...DEFAULT_THEME, ...value.design, backgroundColor: e.target.value },
                        })
                      }
                      className="mt-1 h-9 w-full rounded border border-gray-200"
                    />
                  </label>
                  <label className="block text-gray-600">
                    Content background
                    <input
                      type="color"
                      value={value.design?.contentBackground || DEFAULT_THEME.contentBackground}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          design: { ...DEFAULT_THEME, ...value.design, contentBackground: e.target.value },
                        })
                      }
                      className="mt-1 h-9 w-full rounded border border-gray-200"
                    />
                  </label>
                </div>
              )}
              {sideTab === 'presets' && (
                <div className="space-y-1.5">
                  {starters.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => loadStarter(s.id)}
                      className="w-full text-left px-2.5 py-2 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="block text-xs font-semibold text-gray-900">{s.name}</span>
                      <span className="block text-[10px] text-gray-400 truncate">{s.subject}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main
            className="flex-1 min-w-0 flex flex-col min-h-0 marketing-builder-canvas"
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            <div className="flex-1 overflow-y-auto p-4 flex justify-center">
              <iframe
                title="Email canvas"
                srcDoc={previewHtml}
                className="bg-white shadow-lg rounded-sm border border-gray-200"
                style={{
                  width: previewMode === 'mobile' ? 320 : Math.min(value.design?.contentWidth || 600, 640),
                  minHeight: 520,
                  height: 520,
                  border: 'none',
                }}
              />
            </div>
          </main>

          <aside className="w-[min(100%,320px)] sm:w-80 shrink-0 border-l border-gray-100 bg-white flex flex-col min-h-0">
            <p className="shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 border-b border-gray-50">
              Edit block
            </p>
            <div className="shrink-0 p-2 border-b border-gray-50 flex gap-1 overflow-x-auto no-scrollbar">
              {!value.blocks?.length ? (
                <p className="text-[10px] text-gray-400 px-1 py-1">Add blocks from the left panel</p>
              ) : (
                value.blocks.map((block, index) => {
                  const style = BLOCK_PALETTE_STYLES[block.type] || BLOCK_PALETTE_STYLES.text
                  const selected = selectedBlockIndex === index
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => setSelectedBlockIndex(index)}
                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold marketing-block-card ${
                        selected
                          ? `marketing-block-selected ${style.border} ${style.bg} ${style.text}`
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}
                    >
                      <span>{style.icon}</span>
                      <span>{BLOCK_LABELS[block.type] || block.type}</span>
                    </button>
                  )
                })
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 min-h-0 overscroll-contain">
              {!value.blocks?.length ? (
                <p className="text-xs text-gray-400 text-center py-8 px-2 leading-relaxed">
                  Drop blocks on the preview or click a colored tile on the left. Presets load a full layout instantly.
                </p>
              ) : (
                <DraggableBlockCard
                  block={value.blocks[selectedBlockIndex] || value.blocks[0]}
                  index={selectedBlockIndex}
                  total={value.blocks.length}
                  isDragging={dragIndex === selectedBlockIndex}
                  isDropTarget={dropIndex === selectedBlockIndex && dragIndex !== selectedBlockIndex}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onMoveUp={(i) => {
                    moveBlock(i, -1)
                    setSelectedBlockIndex(Math.max(0, i - 1))
                  }}
                  onMoveDown={(i) => {
                    moveBlock(i, 1)
                    setSelectedBlockIndex(Math.min(value.blocks.length - 1, i + 1))
                  }}
                  onDuplicate={duplicateBlockAt}
                  onRemove={(i) => {
                    removeBlock(i)
                    setSelectedBlockIndex(Math.max(0, i - 1))
                  }}
                  onChange={(next) => updateBlock(selectedBlockIndex, next)}
                  marketingForms={marketingForms}
                />
              )}
            </div>
          </aside>
        </div>
      </div>

      {showSavedTemplates && templates.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Saved templates</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {templates.map((t) => (
              <div key={t.id} className="border border-gray-100 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 truncate">{t.name}</p>
                  {t.createdByName && (
                    <MarketingCreatorBadge name={t.createdByName} isOwn={t.isOwn} className="shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {t.blocks?.length ? `${t.blocks.length} blocks · designed` : 'Plain text'}
                </p>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => onEdit?.(t)} className="text-xs font-semibold underline">
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(t.id)}
                    className="text-xs font-semibold text-red-700 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export { FOLLOW_UP_STARTER }
