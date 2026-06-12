import { useMemo, useState } from 'react'
import { DEFAULT_THEME, FONT_OPTIONS, MERGE_FIELDS } from '../../lib/marketingEmailDesign'
import { BLOCK_PALETTE_STYLES } from '../../lib/marketingUiConstants'
import { GripIcon } from '../ui/icons'

const PALETTE = [
  { type: 'header', label: 'Heading' },
  { type: 'hero', label: 'Hero' },
  { type: 'text', label: 'Paragraph' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Button' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Spacer' },
  { type: 'social', label: 'Social' },
  { type: 'form', label: 'Form' },
  { type: 'footer', label: 'Footer' },
]

const STYLE_SECTIONS = [
  { id: 'background', label: 'Background' },
  { id: 'text', label: 'Text' },
  { id: 'link', label: 'Link' },
  { id: 'button', label: 'Button' },
  { id: 'divider', label: 'Divider' },
  { id: 'image', label: 'Image' },
  { id: 'logo', label: 'Logo' },
]

function mergeDesign(design) {
  return { ...DEFAULT_THEME, ...design }
}

function McField({ label, children }) {
  return (
    <label className="mc-mc-style-field">
      <span className="mc-mc-style-field__label">{label}</span>
      {children}
    </label>
  )
}

function McAccordion({ id, label, open, onToggle, children }) {
  return (
    <div className={`mc-mc-style-acc${open ? ' is-open' : ''}`}>
      <button type="button" className="mc-mc-style-acc__head" onClick={() => onToggle(id)}>
        <span>{label}</span>
        <span className="mc-mc-style-acc__chev" aria-hidden />
      </button>
      {open ? <div className="mc-mc-style-acc__body">{children}</div> : null}
    </div>
  )
}

function DeviceToggle({ checked, onChange }) {
  return (
    <label className="mc-mc-device-toggle">
      <span>Same styles for desktop and mobile</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`mc-mc-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="mc-mc-switch__knob" />
      </button>
    </label>
  )
}

function AlignGroup({ value, onChange }) {
  return (
    <div className="mc-mc-seg-group" role="group" aria-label="Alignment">
      {['left', 'center', 'right'].map((a) => (
        <button
          key={a}
          type="button"
          className={`mc-mc-seg-btn${value === a ? ' is-active' : ''}`}
          onClick={() => onChange(a)}
          title={a}
        >
          {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
        </button>
      ))}
    </div>
  )
}

function groupSections(blocks = []) {
  const footerIdx = blocks.findIndex((b) => b.type === 'footer')
  const headerEnd = blocks.findIndex((b) => !['header', 'hero', 'image'].includes(b.type))
  const hEnd = headerEnd === -1 ? Math.min(1, blocks.length) : headerEnd
  const fStart = footerIdx >= 0 ? footerIdx : blocks.length
  return [
    { id: 'header', label: 'Header', start: 0, end: hEnd },
    { id: 'body', label: 'Body', start: hEnd, end: fStart },
    { id: 'footer', label: 'Footer', start: fStart, end: blocks.length },
  ]
}

export function mailchimpPanelMeta(sideTab) {
  switch (sideTab) {
    case 'blocks':
      return { title: 'Content blocks', hint: 'Drag to add content to your email.' }
    case 'presets':
      return {
        title: 'Email Sections',
        hint: 'Create and edit your email structure, or insert pre-built sections.',
      }
    case 'styles':
      return { title: 'Email styles', hint: 'Edit the look of your entire email.' }
    case 'optimize':
      return { title: '', hint: '' }
    default:
      return { title: '', hint: '' }
  }
}

export function MailchimpBlocksPanel({ onAddBlock }) {
  return (
    <div className="mc-mc-block-grid">
      {PALETTE.map((item) => {
        const style = BLOCK_PALETTE_STYLES[item.type] || BLOCK_PALETTE_STYLES.text
        return (
          <button
            key={item.type}
            type="button"
            className="mc-mc-block-tile"
            onClick={() => onAddBlock(item.type)}
          >
            <span className="mc-mc-block-tile__icon">{style.icon}</span>
            <span className="mc-mc-block-tile__label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function MailchimpSectionsPanel({
  blocks,
  onSelectBlock,
  onAddSection,
  starters,
  starterPreview,
  onLoadStarter,
}) {
  const [tab, setTab] = useState('manage')
  const sections = useMemo(() => groupSections(blocks), [blocks])

  return (
    <>
      <nav className="mc-mc-sections-tabs">
        <button
          type="button"
          className={`mc-mc-sections-tabs__btn${tab === 'manage' ? ' is-active' : ''}`}
          onClick={() => setTab('manage')}
        >
          Manage
        </button>
        <button
          type="button"
          className={`mc-mc-sections-tabs__btn${tab === 'library' ? ' is-active' : ''}`}
          onClick={() => setTab('library')}
        >
          Library
        </button>
      </nav>
      {tab === 'manage' ? (
        <>
          <ul className="mc-mc-sections-list">
            {sections.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  className="mc-mc-sections-list__item"
                  onClick={() => onSelectBlock(sec.start)}
                >
                  <GripIcon className="mc-mc-sections-list__grip" />
                  <span>{sec.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="mc-mc-sections-add" onClick={onAddSection}>
            + Add blank section
          </button>
        </>
      ) : (
        <div className="mc-mc-sections-library">
          {starters.map((s) => (
            <button
              key={s.id}
              type="button"
              className="mc-mc-sections-library__card"
              onClick={() => onLoadStarter(s.id)}
            >
              <span className="mc-mc-sections-library__thumb">
                <iframe title={s.name} srcDoc={starterPreview(s)} tabIndex={-1} />
              </span>
              <span className="mc-mc-sections-library__name">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function MailchimpStylesPanel({ design, patchDesign }) {
  const [open, setOpen] = useState('background')
  const d = mergeDesign(design)
  const unified = d.unifiedDeviceStyles !== false

  const toggle = (id) => setOpen((prev) => (prev === id ? '' : id))

  return (
    <div className="mc-mc-styles">
      {STYLE_SECTIONS.map((sec) => (
        <McAccordion key={sec.id} id={sec.id} label={sec.label} open={open === sec.id} onToggle={toggle}>
          {sec.id === 'background' && (
            <>
              <McField label="Content color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.contentBackground}
                    onChange={(e) => patchDesign({ contentBackground: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.contentBackground}
                    onChange={(e) => patchDesign({ contentBackground: e.target.value })}
                  />
                </div>
              </McField>
              <McField label="Background color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.backgroundColor}
                    onChange={(e) => patchDesign({ backgroundColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.backgroundColor}
                    onChange={(e) => patchDesign({ backgroundColor: e.target.value })}
                  />
                </div>
              </McField>
              <p className="mc-mc-style-note">Background image upload coming soon.</p>
              <div className="mc-mc-style-subhead">Mobile padding</div>
              <div className="mc-mc-padding-grid">
                <McField label="Padding left">
                  <input
                    type="number"
                    className="mc-mc-input"
                    value={d.mobilePaddingLeft ?? 16}
                    onChange={(e) => patchDesign({ mobilePaddingLeft: Number(e.target.value) })}
                  />
                </McField>
                <McField label="Padding right">
                  <input
                    type="number"
                    className="mc-mc-input"
                    value={d.mobilePaddingRight ?? 16}
                    onChange={(e) => patchDesign({ mobilePaddingRight: Number(e.target.value) })}
                  />
                </McField>
              </div>
            </>
          )}
          {sec.id === 'text' && (
            <>
              <div className="mc-mc-type-row">
                {['P', 'H1', 'H2', 'H3', 'H4'].map((t) => (
                  <button key={t} type="button" className={`mc-mc-type-btn${t === 'P' ? ' is-active' : ''}`}>
                    {t}
                  </button>
                ))}
              </div>
              <McField label="Font family">
                <select
                  className="mc-mc-input"
                  value={FONT_OPTIONS.find((f) => f.stack === d.fontFamily)?.id || 'arial'}
                  onChange={(e) => {
                    const font = FONT_OPTIONS.find((f) => f.id === e.target.value)
                    patchDesign({ fontFamily: font?.stack || DEFAULT_THEME.fontFamily })
                  }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </McField>
              <McField label="Letter spacing">
                <input
                  type="number"
                  className="mc-mc-input"
                  value={d.letterSpacing ?? 0}
                  onChange={(e) => patchDesign({ letterSpacing: Number(e.target.value) })}
                />
              </McField>
              <McField label="Alignment">
                <AlignGroup value={d.textAlign || 'left'} onChange={(v) => patchDesign({ textAlign: v })} />
              </McField>
              <McField label="Text color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.textColor || '#000000'}
                    onChange={(e) => patchDesign({ textColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.textColor || '#000000'}
                    onChange={(e) => patchDesign({ textColor: e.target.value })}
                  />
                </div>
              </McField>
              <DeviceToggle checked={unified} onChange={(v) => patchDesign({ unifiedDeviceStyles: v })} />
              <McField label="Font size">
                <input
                  type="number"
                  className="mc-mc-input"
                  value={d.baseFontSize ?? 16}
                  onChange={(e) => patchDesign({ baseFontSize: Number(e.target.value) })}
                />
              </McField>
              <McField label="Line height">
                <select
                  className="mc-mc-input"
                  value={String(d.lineHeight ?? 1.5)}
                  onChange={(e) => patchDesign({ lineHeight: Number(e.target.value) })}
                >
                  <option value="1.2">1.2</option>
                  <option value="1.5">1.5</option>
                  <option value="1.75">1.75</option>
                  <option value="2">2</option>
                </select>
              </McField>
            </>
          )}
          {sec.id === 'link' && (
            <>
              <McField label="Color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.linkColor || '#000000'}
                    onChange={(e) => patchDesign({ linkColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.linkColor || '#000000'}
                    onChange={(e) => patchDesign({ linkColor: e.target.value })}
                  />
                </div>
              </McField>
              <div className="mc-mc-style-subhead">Style</div>
              <div className="mc-mc-seg-group">
                {['B', 'I', 'U'].map((s) => (
                  <button key={s} type="button" className="mc-mc-seg-btn">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {sec.id === 'button' && (
            <>
              <McField label="Shape">
                <div className="mc-mc-seg-group">
                  {[
                    { id: 'square', label: 'Square' },
                    { id: 'round', label: 'Round' },
                    { id: 'pill', label: 'Pill' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`mc-mc-seg-btn mc-mc-seg-btn--wide${d.buttonShape === s.id ? ' is-active' : ''}`}
                      onClick={() => patchDesign({ buttonShape: s.id })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </McField>
              <McField label="Button color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.buttonColor || d.primaryColor}
                    onChange={(e) => patchDesign({ buttonColor: e.target.value, primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.buttonColor || d.primaryColor}
                    onChange={(e) => patchDesign({ buttonColor: e.target.value, primaryColor: e.target.value })}
                  />
                </div>
              </McField>
              <McField label="Text color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.buttonTextColor || '#ffffff'}
                    onChange={(e) => patchDesign({ buttonTextColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.buttonTextColor || '#ffffff'}
                    onChange={(e) => patchDesign({ buttonTextColor: e.target.value })}
                  />
                </div>
              </McField>
              <McField label="Border">
                <select
                  className="mc-mc-input"
                  value={d.buttonBorderStyle || 'solid'}
                  onChange={(e) => patchDesign({ buttonBorderStyle: e.target.value })}
                >
                  <option value="solid">Solid</option>
                  <option value="none">None</option>
                </select>
              </McField>
              <DeviceToggle checked={unified} onChange={(v) => patchDesign({ unifiedDeviceStyles: v })} />
              <McField label="Size">
                <div className="mc-mc-seg-group">
                  {['small', 'medium', 'large'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`mc-mc-seg-btn mc-mc-seg-btn--wide${(d.buttonSize || 'medium') === s ? ' is-active' : ''}`}
                      onClick={() => patchDesign({ buttonSize: s })}
                    >
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </McField>
              <McField label="Alignment">
                <AlignGroup
                  value={d.buttonAlign || 'center'}
                  onChange={(v) => patchDesign({ buttonAlign: v })}
                />
              </McField>
            </>
          )}
          {sec.id === 'divider' && (
            <>
              <McField label="Style">
                <select className="mc-mc-input" defaultValue="solid">
                  <option value="solid">Solid</option>
                </select>
              </McField>
              <McField label="Color">
                <div className="mc-mc-color-row">
                  <input
                    type="color"
                    value={d.dividerColor || '#000000'}
                    onChange={(e) => patchDesign({ dividerColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="mc-mc-input"
                    value={d.dividerColor || '#000000'}
                    onChange={(e) => patchDesign({ dividerColor: e.target.value })}
                  />
                </div>
              </McField>
              <DeviceToggle checked={unified} onChange={(v) => patchDesign({ unifiedDeviceStyles: v })} />
              <McField label="Thickness">
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={d.dividerThickness ?? 2}
                  onChange={(e) => patchDesign({ dividerThickness: Number(e.target.value) })}
                  className="mc-mc-range"
                />
                <span className="mc-mc-range-val">{d.dividerThickness ?? 2}px</span>
              </McField>
            </>
          )}
          {sec.id === 'image' && (
            <>
              <McField label="Rounded corners">
                <input
                  type="number"
                  className="mc-mc-input"
                  value={d.imageBorderRadius ?? 0}
                  onChange={(e) => patchDesign({ imageBorderRadius: Number(e.target.value) })}
                />
              </McField>
              <McField label="Border">
                <select className="mc-mc-input" defaultValue="none">
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                </select>
              </McField>
              <DeviceToggle checked={unified} onChange={(v) => patchDesign({ unifiedDeviceStyles: v })} />
              <McField label="Alignment">
                <AlignGroup
                  value={d.imageAlign || 'center'}
                  onChange={(v) => patchDesign({ imageAlign: v })}
                />
              </McField>
            </>
          )}
          {sec.id === 'logo' && (
            <>
              <DeviceToggle checked={unified} onChange={(v) => patchDesign({ unifiedDeviceStyles: v })} />
              <McField label="Alignment">
                <AlignGroup value={d.logoAlign || 'center'} onChange={(v) => patchDesign({ logoAlign: v })} />
              </McField>
            </>
          )}
        </McAccordion>
      ))}
    </div>
  )
}

function scanEmailContent(blocks, subject) {
  const text = JSON.stringify(blocks || []) + (subject || '')
  const linkCount =
    (text.match(/https?:\/\//gi) || []).length +
    (blocks || []).filter((b) => b.type === 'button' && b.url).length
  const mergeCount = MERGE_FIELDS.reduce(
    (n, f) => n + (text.split(f.token).length - 1),
    0
  )
  let errors = 0
  if (!subject?.trim()) errors += 1
  if (!blocks?.length) errors += 1
  for (const b of blocks || []) {
    if (b.type === 'button' && b.label && !b.url) errors += 1
  }
  return { errors, linkCount, mergeCount }
}

export function MailchimpOptimizePanel({ blocks, subject }) {
  const stats = useMemo(() => scanEmailContent(blocks, subject), [blocks, subject])
  const [linksOn, setLinksOn] = useState(true)
  const [mergeOn, setMergeOn] = useState(true)

  return (
    <div className="mc-mc-optimize">
      <span className="mc-mc-optimize__badge">New</span>
      <h3 className="mc-mc-optimize__title">Help improve your click rates with these tips</h3>
      <p className="mc-mc-optimize__sub">
        Use these email best practices to make your content more engaging. They are based on trends
        across top-performing emails.
      </p>
      <div className="mc-mc-optimize__checks">
        <div className="mc-mc-optimize__row">
          <span>Errors</span>
          <strong>{stats.errors}</strong>
        </div>
        <div className="mc-mc-optimize__row">
          <span>Links [{stats.linkCount}]</span>
          <button
            type="button"
            role="switch"
            aria-checked={linksOn}
            className={`mc-mc-switch${linksOn ? ' is-on' : ''}`}
            onClick={() => setLinksOn((v) => !v)}
          >
            <span className="mc-mc-switch__knob" />
          </button>
        </div>
        <div className="mc-mc-optimize__row">
          <span>Merge Tags [{stats.mergeCount}]</span>
          <button
            type="button"
            role="switch"
            aria-checked={mergeOn}
            className={`mc-mc-switch${mergeOn ? ' is-on' : ''}`}
            onClick={() => setMergeOn((v) => !v)}
          >
            <span className="mc-mc-switch__knob" />
          </button>
        </div>
      </div>
      {stats.errors > 0 ? (
        <ul className="mc-mc-optimize__tips">
          {!subject?.trim() && <li>Add a subject line in the campaign checklist.</li>}
          {!blocks?.length && <li>Add at least one content block to your email.</li>}
        </ul>
      ) : (
        <p className="mc-mc-optimize__ok">Looking good — no critical issues found.</p>
      )}
    </div>
  )
}
