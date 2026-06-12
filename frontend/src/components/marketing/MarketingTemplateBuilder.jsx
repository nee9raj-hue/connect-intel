import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useIsMobile from '../../hooks/useIsMobile'
import useMarketingBuilderHistory from '../../hooks/useMarketingBuilderHistory'
import { isEditableTarget, isModKey } from '../../lib/keyboardShortcuts'
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
import { BRAND_LOGO_MARK_LIGHT, BRAND_LOGO_MARK_CLASS } from '../../lib/brandAssets'
import {
  BlocksIcon,
  DesktopIcon,
  EyeIcon,
  PencilIcon,
  LayoutTemplateIcon,
  MobileDeviceIcon,
  PanelLeftIcon,
  PanelRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripIcon,
  MailIcon,
  RedoIcon,
  SaveIcon,
  SwatchIcon,
  UndoIcon,
} from '../ui/icons'

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
  { id: 'blocks', label: 'Blocks', icon: BlocksIcon },
  { id: 'styles', label: 'Styles', icon: SwatchIcon },
  { id: 'presets', label: 'Layouts', icon: LayoutTemplateIcon },
]

const MAILCHIMP_RAIL = [
  { id: 'blocks', label: 'Blocks', icon: BlocksIcon },
  { id: 'presets', label: 'Sections', icon: LayoutTemplateIcon },
  { id: 'styles', label: 'Styles', icon: SwatchIcon },
]

const IMMERSIVE_RAIL_WIDTH = 216
const IMMERSIVE_RAIL_POS_KEY = 'ci_marketing_rail_pos'

function loadImmersiveRailPos() {
  try {
    const raw = localStorage.getItem(IMMERSIVE_RAIL_POS_KEY)
    if (!raw) return null
    const pos = JSON.parse(raw)
    if (typeof pos?.x === 'number' && typeof pos?.y === 'number') return pos
  } catch {
    // ignore
  }
  return null
}

function saveImmersiveRailPos(pos) {
  try {
    localStorage.setItem(IMMERSIVE_RAIL_POS_KEY, JSON.stringify(pos))
  } catch {
    // ignore
  }
}

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
      } ${isDropTarget ? 'ring-2 ring-[#FF773D] ring-offset-2' : ''}`}
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
            className="text-xs px-2 py-1 border border-gray-200 rounded disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
            className="text-xs px-2 py-1 border border-gray-200 rounded disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            className="text-xs px-2 py-1 border border-gray-200 rounded"
            title="Duplicate block"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs px-2 py-1 border border-red-100 text-red-700 rounded"
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
  compactMode = false,
  studioMode = false,
  immersive = false,
  historyResetKey = '',
  onBack,
  backLabel,
  onSaveDraft,
  onSaveAsTemplate,
  onSend,
  onTestSend,
  draftDisabled = false,
  sendDisabled = false,
  showNameField = true,
  showSavedTemplates = true,
  title,
  subtitle,
  starterOptions,
  marketingForms = [],
}) {
  const isMobile = useIsMobile()
  const isCompact = compactMode || (embedded && !fillHeight && isMobile && !studioMode)
  const isStudio = studioMode && !isCompact
  const isImmersive = isStudio && immersive
  const isMailchimpEditor = isImmersive && Boolean(onBack)
  const isStudioLayout = isCompact || isStudio
  const [previewMode, setPreviewMode] = useState('mobile')
  const [sideTab, setSideTab] = useState('blocks')
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropIndex, setDropIndex] = useState(null)
  const [paletteDragType, setPaletteDragType] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [studioPanel, setStudioPanel] = useState(null)
  const compactCanvasScrollRef = useRef(null)
  const desktopCanvasScrollRef = useRef(null)
  const canvasHostRef = useRef(null)
  const immersiveCanvasRef = useRef(null)
  const immersiveRailRef = useRef(null)
  const railDragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const [railPos, setRailPos] = useState(() => loadImmersiveRailPos() ?? { x: -1, y: 20 })

  const { applyChange, undo, redo, canUndo, canRedo } = useMarketingBuilderHistory(
    value,
    onChange,
    isStudioLayout,
    historyResetKey || value.id || 'draft'
  )

  const blockCount = value.blocks?.length || 0
  useEffect(() => {
    if (selectedBlockIndex >= blockCount && blockCount > 0) {
      setSelectedBlockIndex(blockCount - 1)
    }
  }, [blockCount, selectedBlockIndex])

  useEffect(() => {
    if (!isCompact || !blockCount) return
    const el = compactCanvasScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [blockCount, isCompact])

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

  const syncCanvasHost = useCallback(
    (node) => {
      canvasHostRef.current = node
      if (node) node.innerHTML = canvasHtml
    },
    [canvasHtml]
  )

  const openBlockEditor = (index) => {
    if (Number.isNaN(index) || index < 0) return
    setSelectedBlockIndex(index)
    setInspectorOpen(true)
    setStudioPanel('edit')
  }

  const selectCanvasBlock = (index) => {
    if (Number.isNaN(index) || index < 0) return
    if (isStudioLayout) {
      openBlockEditor(index)
      return
    }
    setSelectedBlockIndex(index)
    setInspectorOpen(true)
  }

  useEffect(() => {
    if (isImmersive) return
    const el = canvasHostRef.current
    if (el) el.innerHTML = canvasHtml
  }, [canvasHtml, isImmersive])

  const handleCanvasAreaClick = (e) => {
    const hit = e.target.closest?.('[data-ci-block-index]')
    if (!hit) return
    e.preventDefault()
    e.stopPropagation()
    const index = Number(hit.getAttribute('data-ci-block-index'))
    if (Number.isNaN(index) || index < 0) return
    openBlockEditor(index)
  }

  const handleCanvasAreaMove = (e) => {
    const host = canvasHostRef.current
    if (!host) return
    host.querySelectorAll('.is-canvas-hover').forEach((row) => row.classList.remove('is-canvas-hover'))
    const hit = e.target.closest?.('[data-ci-block-index]')
    if (hit && host.contains(hit)) hit.classList.add('is-canvas-hover')
  }

  const handleCanvasAreaLeave = () => {
    canvasHostRef.current
      ?.querySelectorAll('.is-canvas-hover')
      .forEach((row) => row.classList.remove('is-canvas-hover'))
  }

  const handleImmersiveCanvasWheel = useCallback(
    (e) => {
      if (!isImmersive) return
      const scroller = immersiveCanvasRef.current?.querySelector('.marketing-immersive-canvas-inner')
      if (!scroller) return
      if (e.defaultPrevented) return

      const deltaY = e.deltaY || 0
      const deltaX = e.deltaX || 0
      if (!deltaY && !deltaX) return

      const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      if (maxScrollTop <= 0) return

      if (deltaY) {
        const nextTop = Math.max(0, Math.min(maxScrollTop, scroller.scrollTop + deltaY))
        if (nextTop !== scroller.scrollTop) {
          e.preventDefault()
          scroller.scrollTop = nextTop
        }
      }
    },
    [isImmersive]
  )

  const openStudioPanel = (tab) => {
    setSideTab(tab)
    setStudioPanel(tab)
  }

  const closeStudioPanel = () => setStudioPanel(null)

  useEffect(() => {
    if (!isImmersive) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (previewOpen) {
          setPreviewOpen(false)
          return
        }
        if (studioPanel) setStudioPanel(null)
        return
      }

      if (!isModKey(e) || isEditableTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isImmersive, previewOpen, studioPanel, undo, redo])

  const moveBlockCompact = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= (value.blocks || []).length) return
    applyChange({ ...value, blocks: reorderBlocks(value.blocks || [], index, next) })
    setSelectedBlockIndex(next)
  }

  const addBlockAtEnd = (type) => {
    let block = createBlock(type)
    if (type === 'form') {
      block = attachDefaultMarketingForm(block, marketingForms)
    }
    const blocks = [...(value.blocks || []), block]
    applyChange({ ...value, blocks })
    const newIndex = blocks.length - 1
    setSelectedBlockIndex(newIndex)
    setStudioPanel(null)
  }

  const moveBlock = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= (value.blocks || []).length) return
    applyChange({ ...value, blocks: reorderBlocks(value.blocks || [], index, next) })
  }

  const updateBlock = (index, block) => {
    const blocks = [...(value.blocks || [])]
    blocks[index] = block
    applyChange({ ...value, blocks })
  }

  const removeBlock = (index) => {
    applyChange({ ...value, blocks: (value.blocks || []).filter((_, i) => i !== index) })
  }

  const duplicateBlockAt = (index) => {
    const blocks = [...(value.blocks || [])]
    blocks.splice(index + 1, 0, duplicateBlock(blocks[index]))
    applyChange({ ...value, blocks })
  }

  const addBlock = (type) => {
    if (isStudioLayout) {
      addBlockAtEnd(type)
      return
    }
    let block = createBlock(type)
    if (type === 'form') {
      block = attachDefaultMarketingForm(block, marketingForms)
    }
    const blocks = [...(value.blocks || []), block]
    applyChange({ ...value, blocks })
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
    applyChange({ ...value, blocks: reorderBlocks(value.blocks || [], from, index) })
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
    applyChange({
      ...value,
      name: showNameField ? value.name || starter.name : value.name,
      subject: starter.subject,
      blocks: starter.blocks.map((b) => ({ ...b, id: createBlock(b.type).id })),
      design: { ...(starter.design || DEFAULT_THEME) },
    })
    if (isStudioLayout) setStudioPanel(null)
  }

  const isEditing = Boolean(value.id)
  const starters = starterOptions?.length ? starterOptions : STARTER_TEMPLATES
  const headerTitle = title || (isEditing ? 'Edit template' : embedded ? 'Email content' : 'Visual email builder')
  const headerSubtitle = subtitle || ''

  const pageScroll = fillHeight
  const studio = fillHeight

  const blockChipStrip =
    value.blocks?.length > 0 ? (
      <div className="marketing-canvas-block-bar">
        {value.blocks.map((block, index) => (
          <button
            key={block.id}
            type="button"
            onClick={() =>
              isStudioLayout ? openBlockEditor(index) : setSelectedBlockIndex(index)
            }
            className={`marketing-canvas-block-chip ${selectedBlockIndex === index ? 'is-active' : ''}`}
          >
            <span>{index + 1}</span>
            <span>{BLOCK_LABELS[block.type] || block.type}</span>
          </button>
        ))}
      </div>
    ) : null

  const selectedBlock = value.blocks?.[selectedBlockIndex]
  const selectedBlockLabel = selectedBlock
    ? BLOCK_LABELS[selectedBlock.type] || selectedBlock.type
    : null

  const compactBlockEditor = selectedBlock ? (
    <div className="marketing-compact-block-editor">
      <MarketingBlockEditor
        block={selectedBlock}
        onChange={(next) => updateBlock(selectedBlockIndex, next)}
        marketingForms={marketingForms}
      />
      <div className="marketing-compact-block-actions">
        <button
          type="button"
          disabled={selectedBlockIndex === 0}
          onClick={() => moveBlockCompact(selectedBlockIndex, -1)}
          className="marketing-compact-icon-btn"
          aria-label="Move block up"
        >
          ↑ Up
        </button>
        <button
          type="button"
          disabled={selectedBlockIndex >= (value.blocks?.length || 0) - 1}
          onClick={() => moveBlockCompact(selectedBlockIndex, 1)}
          className="marketing-compact-icon-btn"
          aria-label="Move block down"
        >
          ↓ Down
        </button>
        <button
          type="button"
          onClick={() => duplicateBlockAt(selectedBlockIndex)}
          className="marketing-compact-icon-btn"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={() => {
            removeBlock(selectedBlockIndex)
            setSelectedBlockIndex(Math.max(0, selectedBlockIndex - 1))
            if ((value.blocks?.length || 0) <= 1) closeStudioPanel()
          }}
          className="marketing-compact-icon-btn marketing-compact-icon-btn--danger"
        >
          Remove
        </button>
      </div>
    </div>
  ) : null

  const starterPreview = (starter) =>
    renderEmailHtml(starter.blocks || [], starter.design || DEFAULT_THEME, {
      previewText: starter.previewText || '',
      lead: PREVIEW_LEAD,
    })

  const panelContent = (
    <>
      {sideTab === 'blocks' && (
        <>
          {showNameField && (
            <input
              value={value.name || ''}
              onChange={(e) => applyChange({ ...value, name: e.target.value })}
              placeholder="Template name"
              className="ci-input w-full mb-2"
            />
          )}
          {!isMailchimpEditor && (
            <div className="marketing-panel-caption">
              {isImmersive
                ? 'Adds to the bottom of your email — click any section on the canvas to edit it'
                : isStudioLayout
                  ? 'Click a block — it is added to the bottom of your email'
                  : 'Drag or click to add'}
            </div>
          )}
          <div className={isMailchimpEditor ? 'mc-mc-block-grid' : 'grid grid-cols-2 gap-2'}>
            {PALETTE.map((item) => {
              const style = BLOCK_PALETTE_STYLES[item.type] || BLOCK_PALETTE_STYLES.text
              return (
                <button
                  key={item.type}
                  type="button"
                  draggable={!isStudioLayout}
                  onDragStart={isStudioLayout ? undefined : (e) => handlePaletteDragStart(e, item.type)}
                  onDragEnd={isStudioLayout ? undefined : () => setPaletteDragType(null)}
                  onClick={() => (isStudioLayout ? addBlockAtEnd(item.type) : addBlock(item.type))}
                  className={
                    isMailchimpEditor
                      ? 'mc-mc-block-tile'
                      : `marketing-palette-tile ${style.border} ${style.bg} ${style.text}`
                  }
                >
                  <span className={isMailchimpEditor ? 'mc-mc-block-tile__icon' : 'marketing-palette-glyph'}>
                    {style.icon}
                  </span>
                  <span className={isMailchimpEditor ? 'mc-mc-block-tile__label' : 'marketing-palette-label'}>
                    {item.label}
                  </span>
                  {!isMailchimpEditor && (
                    <span className="marketing-palette-hint">{item.hint}</span>
                  )}
                </button>
              )
            })}
          </div>
          {!isMailchimpEditor && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
              Personalization
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_FIELDS.map((field) => (
                <span key={field.token} className="marketing-token-pill">
                  {field.token}
                </span>
              ))}
            </div>
          </div>
          )}
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
                        applyChange({
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
                        applyChange({
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
                        applyChange({
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
                        applyChange({
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
                <div className="space-y-3">
                  <div className="marketing-panel-caption">Start from a full layout</div>
                  {starters.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        loadStarter(s.id)
                        if (isStudioLayout) closeStudioPanel()
                      }}
                      className="marketing-layout-card"
                    >
                      <span className="marketing-layout-thumb">
                        <iframe title={s.name} srcDoc={starterPreview(s)} tabIndex={-1} />
                      </span>
                      <span className="block text-xs font-semibold text-slate-900">{s.name}</span>
                      <span className="block text-xs text-slate-500 truncate">{s.subject}</span>
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
          <p className="text-xs text-slate-400 px-1 py-1">Add blocks from the left</p>
        ) : (
          value.blocks.map((block, index) => {
            const style = BLOCK_PALETTE_STYLES[block.type] || BLOCK_PALETTE_STYLES.text
            const selected = selectedBlockIndex === index
            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setSelectedBlockIndex(index)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold marketing-block-card ${
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

  const previewModal =
    previewOpen &&
    createPortal(
      <div
        className="marketing-preview-modal marketing-preview-modal--top"
        role="dialog"
        aria-modal="true"
        aria-label="Email preview"
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreviewOpen(false)
        }}
      >
        <div className="marketing-preview-dialog" onClick={(e) => e.stopPropagation()}>
          <header>
            <div>
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <p className="text-xs text-slate-500 mt-0.5">{value.subject || 'No subject'}</p>
            </div>
            <button
              type="button"
              className="crm-modal-close"
              aria-label="Close preview"
              onClick={() => setPreviewOpen(false)}
            >
              ×
            </button>
          </header>
          <main>
            <iframe
              title="Full preview"
              srcDoc={previewHtml}
              className="bg-white shadow-lg rounded-lg border border-slate-200"
              style={{
                width: previewMode === 'mobile' ? 320 : Math.min(value.design?.contentWidth || 600, 640),
                minHeight: 420,
                height: 'min(70dvh, 520px)',
                border: 'none',
              }}
            />
          </main>
        </div>
      </div>,
      document.body
    )

  const canvas = (
    <main
      className={`marketing-studio-canvas relative ${isCompact ? 'marketing-studio-canvas--compact' : ''}`}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      {!isCompact && !isImmersive && (
      <div className="marketing-studio-canvas-top">
        <span className="marketing-studio-canvas-label">
          Click any section in the email to edit it
        </span>
        {studio ? blockChipStrip : null}
      </div>
      )}
      <div
        className="marketing-studio-canvas-inner"
        ref={
          isCompact
            ? compactCanvasScrollRef
            : isStudio
              ? desktopCanvasScrollRef
              : undefined
        }
        onClick={isStudioLayout && !isImmersive ? handleCanvasAreaClick : undefined}
        onMouseMove={isStudioLayout && !isImmersive ? handleCanvasAreaMove : undefined}
        onMouseLeave={isStudioLayout && !isImmersive ? handleCanvasAreaLeave : undefined}
      >
        <div
          className={`marketing-email-frame-wrap ${previewMode === 'mobile' ? 'is-mobile' : ''}`}
          style={previewMode === 'desktop' ? { maxWidth: emailWidth } : undefined}
        >
          <div
            ref={isImmersive ? syncCanvasHost : canvasHostRef}
            className={`marketing-canvas-html marketing-canvas-html--interactive bg-white shadow-xl rounded-lg border border-slate-200/80 ${
              isStudio ? 'marketing-canvas-html--studio-white' : ''
            }`}
            role="document"
            aria-label="Email canvas — click a section to edit"
            style={!pageScroll && !isCompact ? { minHeight: 560 } : undefined}
            {...(!isImmersive && canvasHtml
              ? { dangerouslySetInnerHTML: { __html: canvasHtml } }
              : {})}
          />
        </div>
      </div>
    </main>
  )

  const studioBody = (
    <>
      <p className="marketing-studio-mobile-pan-hint md:hidden" aria-hidden>
        Swipe right for blocks, email preview, and block editor — each step is full screen.
      </p>
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
            <tab.icon className="h-4 w-4" />
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
            <PanelLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={inspectorOpen ? 'Hide block editor' : 'Show block editor'}
            onClick={() => setInspectorOpen((v) => !v)}
            className={`marketing-studio-rail-toggle ${inspectorOpen ? '' : 'is-off'}`}
          >
            <PanelRightIcon className="h-4 w-4" />
          </button>
        </div>
      </nav>
      <aside
        className={`marketing-studio-panel hidden sm:flex ${panelOpen ? '' : 'is-collapsed'}`}
      >
        <div className="marketing-studio-panel-head">
          <h3>{STUDIO_RAIL.find((t) => t.id === sideTab)?.label}</h3>
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
          {inspectorOpen ? 'Edit block ▾' : 'Edit'}
        </button>
        <div className="marketing-studio-inspector-body flex flex-col flex-1 min-h-0">
          {inspector}
        </div>
      </aside>
    </div>
    </>
  )

  const toolbar = (
      <div className="marketing-studio-toolbar space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{headerTitle}</h2>
          {!embedded && headerSubtitle ? (
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{headerSubtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {['desktop', 'mobile'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPreviewMode(mode)}
                className={`ci-btn !py-1 !px-2.5 !text-xs capitalize !rounded-md !border-0 ${
                  previewMode === mode
                    ? '!bg-white !text-[#0f766e] shadow-sm'
                    : '!bg-transparent !text-slate-500'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {mode === 'desktop' ? (
                    <DesktopIcon className="h-3.5 w-3.5" />
                  ) : (
                    <MobileDeviceIcon className="h-3.5 w-3.5" />
                  )}
                  {mode}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="ci-btn ci-btn-secondary" onClick={() => setPreviewOpen(true)}>
            <EyeIcon className="h-3.5 w-3.5" />
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="marketing-toolbar-status">
          {isEditing ? 'Editing template' : embedded ? 'Campaign content' : 'Template draft'}
        </span>
        <span className="text-xs text-slate-500">
          Click the email canvas to edit blocks, or switch to Layouts for full sections.
        </span>
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
            className={`ci-btn !py-1 !text-xs shrink-0 ${
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

  const studioPanelTitle =
    studioPanel === 'edit'
      ? `Edit ${BLOCK_LABELS[value.blocks?.[selectedBlockIndex]?.type] || 'block'}`
      : STUDIO_RAIL.find((t) => t.id === studioPanel)?.label || 'Tools'

  const studioPanelSubtitle =
    studioPanel === 'edit' && selectedBlockLabel
      ? `Section ${selectedBlockIndex + 1} of ${value.blocks?.length || 0}`
      : null

  const studioPanelFooter = (
    <footer className="marketing-studio-compact-drawer-footer">
      <button type="button" className="crm-btn crm-btn-primary w-full" onClick={closeStudioPanel}>
        {studioPanel === 'blocks' ? 'Done — back to canvas' : 'OK — back to canvas'}
      </button>
    </footer>
  )

  const studioPanelBody =
    studioPanel === 'edit' ? compactBlockEditor : studioPanel ? panelContent : null

  if (isCompact) {
    const drawerTitle = studioPanelTitle

    return (
      <div className="marketing-studio-compact">
        <div className="marketing-studio-compact-subject">
          <input
            value={value.subject || ''}
            onChange={(e) => applyChange({ ...value, subject: e.target.value })}
            placeholder="Subject — {{firstName}}, quick update"
            className="ci-input w-full !text-sm"
          />
        </div>

        <nav className="marketing-studio-compact-nav" aria-label="Email builder tools">
          {STUDIO_RAIL.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`marketing-studio-compact-nav-btn ${
                studioPanel === tab.id ? 'is-active' : ''
              }`}
              onClick={() => openStudioPanel(tab.id)}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="marketing-studio-compact-nav-btn"
            onClick={() => setPreviewOpen(true)}
          >
            <EyeIcon className="h-4 w-4" />
            <span>Preview</span>
          </button>
        </nav>

        {blockChipStrip ? (
          <div className="marketing-studio-compact-chips">{blockChipStrip}</div>
        ) : null}

        {value.blocks?.length > 0 && (
          <div className="marketing-studio-compact-reorder" aria-label="Reorder selected block">
            <span className="marketing-studio-compact-reorder-label">
              {selectedBlockLabel
                ? `${selectedBlockLabel} · #${selectedBlockIndex + 1} of ${value.blocks.length}`
                : `Block #${selectedBlockIndex + 1} of ${value.blocks.length}`}
            </span>
            <div className="marketing-studio-compact-reorder-btns">
              <button
                type="button"
                className="marketing-compact-icon-btn"
                disabled={selectedBlockIndex === 0}
                aria-label="Move up"
                onClick={() => moveBlockCompact(selectedBlockIndex, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="marketing-compact-icon-btn"
                disabled={selectedBlockIndex >= value.blocks.length - 1}
                aria-label="Move down"
                onClick={() => moveBlockCompact(selectedBlockIndex, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="marketing-compact-icon-btn marketing-compact-icon-btn--accent"
                onClick={() => openBlockEditor(selectedBlockIndex)}
              >
                Edit
              </button>
            </div>
          </div>
        )}

        <div className="marketing-studio-compact-canvas-wrap">{canvas}</div>

        <p className="marketing-studio-compact-hint">
          Tap Blocks to add at the bottom · tap a section or chip to edit · ↑↓ to reorder
        </p>

        {studioPanel && (
          <>
            <div
              className="marketing-studio-compact-backdrop"
              role="presentation"
              onClick={closeStudioPanel}
            />
            <div className="marketing-studio-compact-drawer" role="dialog" aria-label={drawerTitle}>
              <header className="marketing-studio-compact-drawer-head">
                <h3>{drawerTitle}</h3>
                <button
                  type="button"
                  className="crm-modal-close"
                  aria-label="Close panel"
                  onClick={closeStudioPanel}
                >
                  ×
                </button>
              </header>
              <div
                className={`marketing-studio-compact-drawer-body ${
                  studioPanel === 'edit' ? 'marketing-studio-compact-drawer-body--edit' : ''
                }`}
              >
                {studioPanelBody}
              </div>
              {studioPanelFooter}
            </div>
          </>
        )}

        {previewModal}
      </div>
    )
  }

  const clampRailPosition = (x, y, box = immersiveCanvasRef.current, railEl = immersiveRailRef.current) => {
    if (!box) return { x, y }
    const railW = railEl?.offsetWidth || IMMERSIVE_RAIL_WIDTH
    const railH = railEl?.offsetHeight || 420
    const maxX = Math.max(8, box.clientWidth - railW - 8)
    const maxY = Math.max(8, box.clientHeight - railH - 8)
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(8, y)),
    }
  }

  useLayoutEffect(() => {
    if (!isImmersive) return
    const box = immersiveCanvasRef.current
    if (!box) return
    setRailPos((pos) => {
      if (pos.x >= 0) return clampRailPosition(pos.x, pos.y, box)
      return clampRailPosition(box.clientWidth - IMMERSIVE_RAIL_WIDTH - 12, 20, box)
    })
  }, [isImmersive])

  useEffect(() => {
    if (!isImmersive) return undefined
    const onResize = () => {
      const box = immersiveCanvasRef.current
      if (!box) return
      setRailPos((pos) => clampRailPosition(pos.x, pos.y, box))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isImmersive])

  const onRailGripDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    railDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: railPos.x,
      origY: railPos.y,
    }
  }

  const onRailGripMove = (e) => {
    if (!railDragRef.current.active) return
    const dx = e.clientX - railDragRef.current.startX
    const dy = e.clientY - railDragRef.current.startY
    setRailPos(clampRailPosition(railDragRef.current.origX + dx, railDragRef.current.origY + dy))
  }

  const onRailGripUp = (e) => {
    if (!railDragRef.current.active) return
    railDragRef.current.active = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setRailPos((pos) => {
      const next = clampRailPosition(pos.x, pos.y)
      saveImmersiveRailPos(next)
      return next
    })
  }

  const immersiveRightRail = (
    <aside
      ref={immersiveRailRef}
      className="marketing-immersive-rail marketing-immersive-rail--floating"
      style={{ left: railPos.x >= 0 ? railPos.x : undefined, top: railPos.y }}
      aria-label="Email builder tools"
    >
      <div
        className="marketing-immersive-rail__grip"
        onPointerDown={onRailGripDown}
        onPointerMove={onRailGripMove}
        onPointerUp={onRailGripUp}
        onPointerCancel={onRailGripUp}
        aria-label="Drag builder menu"
        title="Drag to move menu"
      >
        <GripIcon className="h-4 w-4 shrink-0" />
        <span className="marketing-immersive-rail__grip-label">Drag menu</span>
      </div>
      <div className="marketing-immersive-rail__view">
        <p className="marketing-immersive-rail__heading">Canvas view</p>
        <div className="marketing-immersive-rail__view-btns" role="group" aria-label="Desktop or mobile canvas width">
          <button
            type="button"
            className={`marketing-immersive-rail__view-btn ${previewMode === 'desktop' ? 'is-active' : ''}`}
            onClick={() => setPreviewMode('desktop')}
          >
            <DesktopIcon className="h-4 w-4 shrink-0" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            className={`marketing-immersive-rail__view-btn ${previewMode === 'mobile' ? 'is-active' : ''}`}
            onClick={() => setPreviewMode('mobile')}
          >
            <MobileDeviceIcon className="h-4 w-4 shrink-0" />
            <span>Mobile</span>
          </button>
        </div>
      </div>
      <div className="marketing-immersive-rail__sections">
        <p className="marketing-immersive-rail__heading">Sections on canvas</p>
        <div className="marketing-immersive-rail__list" role="list">
          {(value.blocks || []).map((block, index) => (
            <button
              key={block.id || `block-${index}`}
              type="button"
              role="listitem"
              className={`marketing-immersive-section-btn ${
                selectedBlockIndex === index ? 'is-active' : ''
              }`}
              onClick={() => openBlockEditor(index)}
            >
              <span className="marketing-immersive-section-btn__n">{index + 1}</span>
              <span className="marketing-immersive-section-btn__label">
                {BLOCK_LABELS[block.type] || block.type}
              </span>
            </button>
          ))}
          {!blockCount ? (
            <p className="marketing-immersive-rail__empty">
              No sections yet. Use <strong>Blocks</strong> below to add content.
            </p>
          ) : null}
        </div>
      </div>
      <div className="marketing-immersive-rail__tools">
        <p className="marketing-immersive-rail__heading">Tools</p>
        {onBack ? (
          <button type="button" className="marketing-immersive-rail__tool" onClick={onBack}>
            <ChevronLeftIcon className="h-4 w-4 shrink-0" />
            <span>Back to setup</span>
          </button>
        ) : null}
        <button
          type="button"
          className={`marketing-immersive-rail__tool ${studioPanel === 'edit' ? 'is-active' : ''}`}
          disabled={!blockCount}
          onClick={() => {
            const idx =
              selectedBlockIndex >= 0 && selectedBlockIndex < blockCount ? selectedBlockIndex : 0
            openBlockEditor(idx)
          }}
        >
          <PencilIcon className="h-4 w-4 shrink-0" />
          <span>{selectedBlockLabel ? `Edit ${selectedBlockLabel}` : 'Edit block'}</span>
        </button>
        {STUDIO_RAIL.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`marketing-immersive-rail__tool ${studioPanel === tab.id ? 'is-active' : ''}`}
            onClick={() => openStudioPanel(tab.id)}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
        <button type="button" className="marketing-immersive-rail__tool" onClick={undo} disabled={!canUndo}>
          <UndoIcon className="h-4 w-4 shrink-0" />
          <span>Undo</span>
        </button>
        <button type="button" className="marketing-immersive-rail__tool" onClick={redo} disabled={!canRedo}>
          <RedoIcon className="h-4 w-4 shrink-0" />
          <span>Redo</span>
        </button>
        <button type="button" className="marketing-immersive-rail__tool" onClick={() => setPreviewOpen(true)}>
          <EyeIcon className="h-4 w-4 shrink-0" />
          <span>Preview</span>
        </button>
        {(onSaveDraft || onSave) && (
          <button
            type="button"
            className="marketing-immersive-rail__tool"
            disabled={busy || draftDisabled}
            onClick={() => void (onSaveDraft ? onSaveDraft() : onSave?.())}
          >
            <SaveIcon className="h-4 w-4 shrink-0" />
            <span>{onSave ? 'Save template' : 'Save draft'}</span>
          </button>
        )}
        {onSaveAsTemplate ? (
          <button
            type="button"
            className="marketing-immersive-rail__tool"
            disabled={busy}
            onClick={() => void onSaveAsTemplate()}
          >
            <LayoutTemplateIcon className="h-4 w-4 shrink-0" />
            <span>Save as template</span>
          </button>
        ) : null}
        {onSend ? (
          <button
            type="button"
            className="marketing-immersive-rail__tool marketing-immersive-rail__tool--accent"
            disabled={busy || sendDisabled}
            onClick={() => void onSend()}
          >
            <MailIcon className="h-4 w-4 shrink-0" />
            <span>Send campaign</span>
          </button>
        ) : null}
      </div>
    </aside>
  )

  const closeImmersive = onBack || onCancel
  const closeImmersiveLabel =
    backLabel || (onBack ? 'Back to campaign' : onCancel ? 'Close editor' : '')

  const handleSaveAndExit = async () => {
    if (onSaveDraft && !draftDisabled) {
      try {
        await onSaveDraft()
      } catch {
        // still exit — draft may have saved locally
      }
    }
    closeImmersive?.()
  }

  const mailchimpPanelTitle =
    sideTab === 'blocks' ? 'Content blocks' : MAILCHIMP_RAIL.find((t) => t.id === sideTab)?.label || ''

  const mailchimpStudioPopup =
    studioPanel &&
    createPortal(
      <div
        className="marketing-studio-popup-overlay"
        role="presentation"
        onClick={closeStudioPanel}
      >
        <div
          className="marketing-studio-popup"
          role="dialog"
          aria-label={studioPanelTitle}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="marketing-studio-popup-head">
            <div>
              <h3>{studioPanelTitle}</h3>
              {studioPanelSubtitle ? (
                <p className="marketing-studio-popup-sub">{studioPanelSubtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="crm-modal-close"
              aria-label="Close (Esc)"
              onClick={closeStudioPanel}
            >
              ×
            </button>
          </header>
          <div
            className={`marketing-studio-popup-body ${
              studioPanel === 'edit' ? 'marketing-studio-popup-body--edit' : ''
            }`}
          >
            {studioPanelBody}
          </div>
          {studioPanelFooter}
        </div>
      </div>,
      document.body
    )

  if (isMailchimpEditor) {
    return (
      <div className="mc-mc-editor">
        <header className="mc-mc-editor__header">
          <div className="mc-mc-editor__brand">
            <img
              src={BRAND_LOGO_MARK_LIGHT}
              alt=""
              className={`mc-mc-editor__logo ${BRAND_LOGO_MARK_CLASS}`}
            />
            <span className="mc-mc-editor__title">{title || value.name || 'Untitled'}</span>
          </div>
          <div className="mc-mc-editor__actions">
            <span className="mc-mc-editor__saved">Changes saved</span>
            {onTestSend ? (
              <button
                type="button"
                className="mc-mc-editor__btn-outline"
                disabled={busy}
                onClick={() => void onTestSend()}
              >
                Send test
              </button>
            ) : null}
            <button
              type="button"
              className="mc-mc-editor__save-exit"
              disabled={busy}
              onClick={() => void handleSaveAndExit()}
            >
              <span>Save and exit</span>
              <ChevronRightIcon className="mc-mc-editor__save-caret" aria-hidden />
            </button>
          </div>
        </header>

        <div className="mc-mc-editor__workspace">
          <aside className="mc-mc-editor__sidebar">
            <nav className="mc-mc-editor__tabs" aria-label="Editor tools">
              {MAILCHIMP_RAIL.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.label}
                  className={`mc-mc-editor__tab${sideTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setSideTab(tab.id)}
                >
                  <tab.icon className="mc-mc-editor__tab-icon" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <div className="mc-mc-editor__panel">
              <h2 className="mc-mc-editor__panel-title">{mailchimpPanelTitle}</h2>
              {sideTab === 'blocks' ? (
                <p className="mc-mc-editor__panel-hint">Drag to add content to your email.</p>
              ) : null}
              <div className="mc-mc-editor__panel-scroll">{panelContent}</div>
            </div>
          </aside>

          <div className="mc-mc-editor__main">
            <div className="mc-mc-editor__canvas-bar">
              <div className="mc-mc-editor__view-toggle" role="group" aria-label="Desktop or mobile">
                <button
                  type="button"
                  className={`mc-mc-editor__view-btn${previewMode === 'desktop' ? ' is-active' : ''}`}
                  onClick={() => setPreviewMode('desktop')}
                  title="Desktop"
                >
                  <DesktopIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`mc-mc-editor__view-btn${previewMode === 'mobile' ? ' is-active' : ''}`}
                  onClick={() => setPreviewMode('mobile')}
                  title="Mobile"
                >
                  <MobileDeviceIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mc-mc-editor__canvas-tools">
                <button
                  type="button"
                  className="mc-mc-editor__tool-btn"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo"
                >
                  <UndoIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="mc-mc-editor__tool-btn"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo"
                >
                  <RedoIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="mc-mc-editor__preview-btn"
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="mc-mc-editor__canvas-scroll" ref={immersiveCanvasRef}>
              <div className="mc-mc-practice-banner" role="note">
                <span className="mc-mc-practice-banner__tag">Note</span>
                <span>
                  This is a practice email. Follow the tips below to learn how the builder works.
                </span>
              </div>
              <div
                className="mc-mc-editor__canvas-area"
                onClick={handleCanvasAreaClick}
                onMouseMove={handleCanvasAreaMove}
                onMouseLeave={handleCanvasAreaLeave}
                onWheel={handleImmersiveCanvasWheel}
              >
                <div className="mc-mc-editor__canvas-inner">{canvas}</div>
              </div>
            </div>
          </div>
        </div>

        {mailchimpStudioPopup}
        {previewModal}
        <button type="button" className="mc-feedback-tab" tabIndex={-1} aria-hidden>
          Feedback
        </button>
      </div>
    )
  }

  if (isImmersive) {
    return (
      <div className="marketing-immersive-studio flex flex-col flex-1 min-h-0 w-full bg-white">
        {closeImmersive ? (
          <header className="marketing-immersive-topbar">
            <button type="button" className="marketing-immersive-topbar__close" onClick={closeImmersive}>
              <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{closeImmersiveLabel}</span>
            </button>
            <span className="marketing-immersive-topbar__title">Email editor</span>
          </header>
        ) : null}
        <div className="marketing-immersive-canvas" ref={immersiveCanvasRef}>
          <div
            className="marketing-immersive-canvas-main"
            onClick={handleCanvasAreaClick}
            onMouseMove={handleCanvasAreaMove}
            onMouseLeave={handleCanvasAreaLeave}
            onWheel={handleImmersiveCanvasWheel}
          >
            <p className="marketing-immersive-canvas-hint" aria-hidden>
              Hover a section to highlight · click to edit
            </p>
            <div className="marketing-immersive-canvas-inner">{canvas}</div>
          </div>
          {immersiveRightRail}
        </div>

        {mailchimpStudioPopup}
        {previewModal}
      </div>
    )
  }

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
            {headerSubtitle ? (
              <p className="text-xs text-gray-500 mt-0.5">{headerSubtitle}</p>
            ) : null}
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

      {previewModal}

      {showSavedTemplates && templates.length > 0 && (
        <section className="ci-card p-4 mt-3 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Your saved templates</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reuse layouts quickly the same way teams browse templates in Mailchimp.
              </p>
            </div>
            <span className="crm-toolbar-count">{templates.length} saved</span>
          </div>
          <div className="marketing-template-grid">
            {templates.map((t) => (
              <div key={t.id} className="marketing-template-tile">
                <div className="marketing-template-preview">
                  <iframe
                    title={`${t.name} preview`}
                    srcDoc={renderEmailHtml(t.blocks || [], t.design || DEFAULT_THEME, {
                      previewText: t.previewText || '',
                      lead: PREVIEW_LEAD,
                    })}
                    tabIndex={-1}
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 truncate text-sm">{t.name}</p>
                  {t.createdByName && (
                    <MarketingCreatorBadge name={t.createdByName} isOwn={t.isOwn} className="shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{t.subject}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t.blocks?.length ? `${t.blocks.length} blocks` : 'Plain text'}
                </p>
                <div className="flex gap-2 mt-3">
                  <button type="button" className="ci-btn ci-btn-secondary !py-1 !text-xs" onClick={() => onEdit?.(t)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ci-btn ci-btn-secondary !py-1 !text-xs !text-red-700 !border-red-100"
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
