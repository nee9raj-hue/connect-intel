import { useEffect, useMemo, useState } from 'react'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import {
  BLOCK_LABELS,
  DEFAULT_THEME,
  FONT_OPTIONS,
  MERGE_FIELDS,
  STARTER_TEMPLATES,
  attachDefaultMarketingForm,
  createBlock,
  duplicateBlock,
  PREVIEW_LEAD,
  renderEmailCanvasHtml,
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

const STUDIO_RAIL = [
  { id: 'blocks', label: 'Blocks', icon: '⊞' },
  { id: 'styles', label: 'Styles', icon: '◐' },
  { id: 'presets', label: 'Layouts', icon: '☰' },
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
      className={`ci-card p-3 transition-colors ${
        isDragging ? 'opacity-50' : ''
      } ${isDropTarget ? 'ring-2 ring-[#0d9488] ring-offset-2' : ''}`}
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)

  const blockCount = value.blocks?.length || 0
  useEffect(() => {
    if (selectedBlockIndex >= blockCount && blockCount > 0) {
      setSelectedBlockIndex(blockCount - 1)
    }
  }, [blockCount, selectedBlockIndex])

  const previewHtml = useMemo(
    () =>
      renderEmailHtml(value.blocks || [], value.design || DEFAULT_THEME, {
        previewText: value.previewText,
        lead: PREVIEW_LEAD,
      }),
    [value.blocks, value.design, value.previewText]
  )

  const canvasHtml = useMemo(
    () =>
      renderEmailCanvasHtml(value.blocks || [], value.design || DEFAULT_THEME, {
        previewText: value.previewText,
        selectedBlockIndex,
      }),
    [value.blocks, value.design, value.previewText, selectedBlockIndex]
  )

  const selectCanvasBlock = (index) => {
    if (Number.isNaN(index) || index < 0) return
    setSelectedBlockIndex(index)
    setInspectorOpen(true)
  }

  const handleCanvasBlockPointer = (e) => {
    const hit = e.target.closest('[data-ci-block-index]')
    if (!hit) return
    e.preventDefault()
    e.stopPropagation()
    selectCanvasBlock(Number(hit.getAttribute('data-ci-block-index')))
  }

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
    let block = createBlock(type)
    if (type === 'form') {
      block = attachDefaultMarketingForm(block, marketingForms)
    }
    const blocks = [...(value.blocks || []), block]
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

  const pageScroll = fillHeight
  const studio = fillHeight

  const sideTabHint =
    sideTab === 'blocks'
      ? 'Drag or click blocks to add content'
      : sideTab === 'styles'
        ? 'Fonts and brand colors'
        : 'Start from a full email layout'

  const panelContent = (
    <>
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
    </>
  )

  const inspector = (
    <>
      <div className="shrink-0 p-2.5 border-b border-slate-200/80 flex gap-1.5 overflow-x-auto no-scrollbar bg-white">
        {!value.blocks?.length ? (
          <p className="text-[10px] text-slate-400 px-1 py-1">Add blocks from the left</p>
        ) : (
          value.blocks.map((block, index) => {
            const style = BLOCK_PALETTE_STYLES[block.type] || BLOCK_PALETTE_STYLES.text
            const selected = selectedBlockIndex === index
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setSelectedBlockIndex(index)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold marketing-block-card ${
                  selected
                    ? `marketing-block-selected ${style.border} ${style.bg} ${style.text}`
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>{style.icon}</span>
                <span>{BLOCK_LABELS[block.type] || block.type}</span>
              </button>
            )
          })
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 min-h-0 overscroll-contain">
        {!value.blocks?.length ? (
          <p className="text-xs text-slate-500 text-center py-10 px-3 leading-relaxed">
            Pick a block from the left, or load a layout preset to get started quickly.
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
    </>
  )

  const emailWidth = Math.min(value.design?.contentWidth || 600, 640)

  const canvas = (
    <main
      className="marketing-studio-canvas relative"
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <div className="marketing-studio-canvas-top">
        <span className="marketing-studio-canvas-label">
          Click any section in the email to edit it
        </span>
        {studio ? blockChipStrip : null}
      </div>
      <div className="marketing-studio-canvas-inner">
        <div
          className={`marketing-email-frame-wrap ${previewMode === 'mobile' ? 'is-mobile' : ''}`}
          style={previewMode === 'desktop' ? { maxWidth: emailWidth } : undefined}
        >
          <div
            className="marketing-canvas-html marketing-canvas-html--interactive bg-white shadow-xl rounded-lg border border-slate-200/80 overflow-hidden"
            role="document"
            aria-label="Email canvas"
            onPointerDown={handleCanvasBlockPointer}
            dangerouslySetInnerHTML={{ __html: canvasHtml }}
            style={!pageScroll ? { minHeight: 560 } : undefined}
          />
        </div>
      </div>
    </main>
  )

  const studioBody = (
    <div className="marketing-studio-body">
      <nav className="marketing-studio-rail" aria-label="Builder tools">
        {STUDIO_RAIL.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            onClick={() => setSideTab(tab.id)}
            className={`marketing-studio-rail-btn ${sideTab === tab.id ? 'is-active' : ''}`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
        <div className="marketing-studio-rail-footer hidden sm:flex">
          <button
            type="button"
            title={panelOpen ? 'Hide blocks panel' : 'Show blocks panel'}
            onClick={() => setPanelOpen((v) => !v)}
            className={`marketing-studio-rail-toggle ${panelOpen ? '' : 'is-off'}`}
          >
            ◧
          </button>
          <button
            type="button"
            title={inspectorOpen ? 'Hide block editor' : 'Show block editor'}
            onClick={() => setInspectorOpen((v) => !v)}
            className={`marketing-studio-rail-toggle ${inspectorOpen ? '' : 'is-off'}`}
          >
            ◨
          </button>
        </div>
      </nav>
      <aside
        className={`marketing-studio-panel hidden sm:flex ${panelOpen ? '' : 'is-collapsed'}`}
      >
        <div className="marketing-studio-panel-head">
          <h3>{STUDIO_RAIL.find((t) => t.id === sideTab)?.label}</h3>
          <p>{sideTabHint}</p>
        </div>
        <div className="marketing-studio-panel-scroll">{panelContent}</div>
      </aside>
      {canvas}
      <aside
        className={`marketing-studio-inspector flex flex-col min-h-0 ${
          inspectorOpen ? '' : 'is-collapsed'
        }`}
      >
        <button
          type="button"
          className="marketing-studio-inspector-head w-full text-left hover:bg-slate-50"
          onClick={() => setInspectorOpen((v) => !v)}
          title={inspectorOpen ? 'Collapse editor' : 'Expand editor'}
        >
          {inspectorOpen ? 'Edit block ▾' : 'Edit ▸'}
        </button>
        <div className="marketing-studio-inspector-body flex flex-col flex-1 min-h-0">
          {inspector}
        </div>
      </aside>
    </div>
  )

  const toolbar = (
    <div className="marketing-studio-toolbar space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{headerTitle}</h2>
          {!embedded && (
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">{headerSubtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {['desktop', 'mobile'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                className={`ci-btn !py-1 !px-2.5 !text-[10px] capitalize !rounded-md !border-0 ${
                  previewMode === mode
                    ? '!bg-white !text-[#0f766e] shadow-sm'
                    : '!bg-transparent !text-slate-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button type="button" className="ci-btn ci-btn-secondary" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
          {onCancel && (
            <button type="button" className="ci-btn ci-btn-secondary" onClick={onCancel}>
              {isEditing ? 'Cancel' : 'Clear'}
            </button>
          )}
          {onSave && (
            <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={onSave}>
              {busy ? 'Saving…' : isEditing ? 'Save template' : 'Save template'}
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {showNameField && (
          <input
            value={value.name || ''}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Template name"
            className="ci-input flex-1 min-w-[140px]"
          />
        )}
        <input
          value={value.subject || ''}
          onChange={(e) => onChange({ ...value, subject: e.target.value })}
          placeholder="Subject line — {{firstName}}, your update"
          className="ci-input flex-[2] min-w-[200px]"
        />
        <input
          value={value.previewText || ''}
          onChange={(e) => onChange({ ...value, previewText: e.target.value })}
          placeholder="Inbox preview text (optional)"
          className="ci-input flex-1 min-w-[180px]"
        />
      </div>
      <div className="flex gap-1.5 sm:hidden overflow-x-auto no-scrollbar">
        {STUDIO_RAIL.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSideTab(tab.id)}
            className={`ci-btn !py-1 !text-[10px] shrink-0 ${
              sideTab === tab.id ? 'ci-btn-accent' : 'ci-btn-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sm:hidden marketing-studio-panel-scroll max-h-[200px] border border-slate-200 rounded-lg bg-white">
        {panelContent}
      </div>
    </div>
  )

  return (
    <div
      className={
        embedded && fillHeight
          ? 'marketing-builder-root max-w-none w-full'
          : 'max-w-[1400px] mx-auto space-y-4'
      }
    >
      {!studio && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{headerTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{headerSubtitle}</p>
          </div>
          {(onSave || onCancel) && (
            <div className="flex gap-2">
              {onCancel && (
                <button type="button" className="ci-btn ci-btn-secondary" onClick={onCancel}>
                  Clear
                </button>
              )}
              {onSave && (
                <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={onSave}>
                  Save
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={
          studio
            ? 'marketing-studio marketing-studio--page'
            : 'ci-card min-h-[560px] flex flex-col'
        }
      >
        {studio ? (
          <>
            {toolbar}
            {studioBody}
          </>
        ) : (
          <>
            <div className="p-3 border-b border-slate-100 space-y-2">{toolbar}</div>
            {studioBody}
          </>
        )}
      </div>

      {previewOpen && (
        <div className="marketing-preview-modal" role="dialog" aria-modal="true" aria-label="Email preview">
          <div className="marketing-preview-dialog">
            <header>
              <div>
                <p className="text-sm font-semibold text-slate-900">Preview</p>
                <p className="text-xs text-slate-500 mt-0.5">{value.subject || 'No subject'}</p>
              </div>
              <button type="button" className="ci-btn ci-btn-secondary" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </header>
            <main>
              <iframe
                title="Full preview"
                srcDoc={previewHtml}
                className="bg-white shadow-lg rounded-lg border border-slate-200"
                style={{
                  width: previewMode === 'mobile' ? 320 : Math.min(value.design?.contentWidth || 600, 640),
                  minHeight: 520,
                  height: 520,
                  border: 'none',
                }}
              />
            </main>
          </div>
        </div>
      )}

      {showSavedTemplates && templates.length > 0 && (
        <section className="ci-card p-4 mt-3 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Your saved templates</h3>
          <div className="marketing-template-grid">
            {templates.map((t) => (
              <div key={t.id} className="marketing-template-tile">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 truncate text-sm">{t.name}</p>
                  {t.createdByName && (
                    <MarketingCreatorBadge name={t.createdByName} isOwn={t.isOwn} className="shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{t.subject}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {t.blocks?.length ? `${t.blocks.length} blocks` : 'Plain text'}
                </p>
                <div className="flex gap-2 mt-3">
                  <button type="button" className="ci-btn ci-btn-secondary !py-1 !text-[10px]" onClick={() => onEdit?.(t)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ci-btn ci-btn-secondary !py-1 !text-[10px] !text-red-700 !border-red-100"
                    onClick={() => onDelete?.(t.id)}
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
