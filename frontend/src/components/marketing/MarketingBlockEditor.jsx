import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  IMAGE_PRESETS,
  SOCIAL_NETWORKS,
} from '../../lib/marketingEmailTokens'
import {
  applyFormBlockUrl,
  normalizeGoogleFormUrl,
  resolveGoogleFormUrl,
} from '../../../../lib/marketingFormSchema.js'
import RichTextEditor from './RichTextEditor'

function AlignSelect({ value, onChange }) {
  return (
    <select
      value={value || 'left'}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1"
    >
      <option value="left">Align left</option>
      <option value="center">Align center</option>
      <option value="right">Align right</option>
    </select>
  )
}

function TypographyRow({ block, onChange, fields = ['fontSize', 'color', 'fontFamily', 'fontWeight'] }) {
  const set = (patch) => onChange({ ...block, ...patch })
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
      {fields.includes('fontFamily') && (
        <label className="text-[10px] text-gray-500">
          Block font
          <select
            value={block.fontFamily || ''}
            onChange={(e) => set({ fontFamily: e.target.value || undefined })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="">Default</option>
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {fields.includes('fontSize') && (
        <label className="text-[10px] text-gray-500">
          Default size
          <select
            value={block.fontSize || 15}
            onChange={(e) => set({ fontSize: Number(e.target.value) })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            {FONT_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
      )}
      {fields.includes('color') && (
        <label className="text-[10px] text-gray-500">
          Default color
          <input
            type="color"
            value={block.color || '#374151'}
            onChange={(e) => set({ color: e.target.value })}
            className="mt-0.5 block h-8 w-full rounded border border-gray-200"
          />
        </label>
      )}
      {fields.includes('fontWeight') && (
        <label className="text-[10px] text-gray-500">
          Weight
          <select
            value={block.fontWeight || 'normal'}
            onChange={(e) => set({ fontWeight: e.target.value })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="normal">Regular</option>
            <option value="bold">Bold</option>
          </select>
        </label>
      )}
    </div>
  )
}

export default function MarketingBlockEditor({ block, onChange, marketingForms = [] }) {
  const set = (patch) => onChange({ ...block, ...patch })

  if (block.type === 'header') {
    return (
      <div className="space-y-2">
        <RichTextEditor
          value={block.text || ''}
          onChange={(text) => set({ text })}
          placeholder="Brand name"
          singleLine
          minHeight={44}
        />
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
        <TypographyRow block={block} onChange={onChange} />
      </div>
    )
  }

  if (block.type === 'hero') {
    return (
      <div className="space-y-2">
        <label className="text-[10px] text-gray-500 uppercase tracking-wide">Headline</label>
        <RichTextEditor
          value={block.heading || ''}
          onChange={(heading) => set({ heading })}
          placeholder="Headline"
          minHeight={48}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            Headline size
            <select
              value={block.headingSize || 28}
              onChange={(e) => set({ headingSize: Number(e.target.value) })}
              className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
            >
              {FONT_SIZE_OPTIONS.filter((s) => s >= 18).map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-gray-500">
            Headline color
            <input
              type="color"
              value={block.headingColor || '#111827'}
              onChange={(e) => set({ headingColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
        </div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wide">Subtext</label>
        <RichTextEditor
          value={block.subtext || ''}
          onChange={(subtext) => set({ subtext })}
          placeholder="Subtext"
          minHeight={56}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            Subtext size
            <select
              value={block.subtextSize || 16}
              onChange={(e) => set({ subtextSize: Number(e.target.value) })}
              className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
            >
              {FONT_SIZE_OPTIONS.filter((s) => s >= 12 && s <= 24).map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-gray-500">
            Subtext color
            <input
              type="color"
              value={block.subtextColor || '#6b7280'}
              onChange={(e) => set({ subtextColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
        </div>
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
        <TypographyRow block={block} onChange={onChange} fields={['fontFamily']} />
      </div>
    )
  }

  if (block.type === 'text') {
    return (
      <div className="space-y-2">
        <RichTextEditor
          value={block.content || ''}
          onChange={(content) => set({ content })}
          placeholder="Write your message — select text to change size or color, or insert icons inline"
          minHeight={120}
        />
        <TypographyRow block={block} onChange={onChange} />
      </div>
    )
  }

  if (block.type === 'image') {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Stock images</p>
        <div className="grid grid-cols-3 gap-1.5">
          {IMAGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => set({ url: preset.url, alt: preset.label })}
              className="text-left rounded-lg border border-gray-100 overflow-hidden hover:border-gray-300"
            >
              <img src={preset.url} alt="" className="w-full h-14 object-cover" />
              <span className="block text-[9px] px-1 py-0.5 truncate text-gray-600">{preset.label}</span>
            </button>
          ))}
        </div>
        <input
          value={block.url || ''}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="Image URL (paste your own)"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <input
          value={block.alt || ''}
          onChange={(e) => set({ alt: e.target.value })}
          placeholder="Alt text"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <input
          value={block.link || ''}
          onChange={(e) => set({ link: e.target.value })}
          placeholder="Optional link URL when clicked"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <label className="text-[10px] text-gray-500 block">
          Width ({block.width || 100}%)
          <input
            type="range"
            min={30}
            max={100}
            value={block.width || 100}
            onChange={(e) => set({ width: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={!!block.rounded} onChange={(e) => set({ rounded: e.target.checked })} />
          Rounded corners
        </label>
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
      </div>
    )
  }

  if (block.type === 'icon') {
    return (
      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        Standalone icon blocks are deprecated. Use <strong>Insert icon</strong> inside Text, Hero, Header, or Footer
        blocks instead.
      </p>
    )
  }

  if (block.type === 'social') {
    const links = block.links || []
    const toggleNetwork = (network) => {
      const exists = links.find((l) => l.network === network)
      if (exists) {
        set({ links: links.filter((l) => l.network !== network) })
      } else {
        set({ links: [...links, { network, url: `https://${network}.com` }] })
      }
    }
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Social networks</p>
        <div className="flex flex-wrap gap-1.5">
          {SOCIAL_NETWORKS.map((net) => {
            const active = links.some((l) => l.network === net.id)
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => toggleNetwork(net.id)}
                className={`text-[10px] px-2 py-1 rounded-full border ${
                  active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600'
                }`}
              >
                {net.label}
              </button>
            )
          })}
        </div>
        {links.map((link, i) => (
          <div key={link.network} className="flex gap-2 items-center">
            <span className="text-xs text-gray-500 w-16 shrink-0">{link.network}</span>
            <input
              value={link.url || ''}
              onChange={(e) => {
                const next = [...links]
                next[i] = { ...next[i], url: e.target.value }
                set({ links: next })
              }}
              placeholder="Profile URL"
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
            />
          </div>
        ))}
        <label className="text-[10px] text-gray-500">
          Icon size (px)
          <input
            type="number"
            min={20}
            max={48}
            value={block.iconSize || 28}
            onChange={(e) => set({ iconSize: Number(e.target.value) })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          />
        </label>
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
      </div>
    )
  }

  if (block.type === 'button') {
    return (
      <div className="space-y-2">
        <input
          value={block.label || ''}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="Button label"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <input
          value={block.url || ''}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="Button URL"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            Button color
            <input
              type="color"
              value={block.buttonColor || '#111827'}
              onChange={(e) => set({ buttonColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
          <label className="text-[10px] text-gray-500">
            Text color
            <input
              type="color"
              value={block.buttonTextColor || '#ffffff'}
              onChange={(e) => set({ buttonTextColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
        </div>
        <TypographyRow block={block} onChange={onChange} fields={['fontSize', 'fontFamily']} />
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
      </div>
    )
  }

  if (block.type === 'form') {
    const pickNativeForm = (formId) => {
      const f = marketingForms.find((row) => row.id === formId)
      if (!f) return
      const next = applyFormBlockUrl(
        {
          ...block,
          formSource: 'native',
          formId: f.id,
          formSlug: f.slug,
          title: block.title || f.title || f.name,
          description: block.description || f.description || '',
          buttonLabel: block.buttonLabel || 'Open form',
        },
        { appBase: typeof window !== 'undefined' ? window.location.origin : undefined }
      )
      set(next)
    }
    return (
      <div className="space-y-2">
        <label className="text-[10px] text-gray-500 block">
          Form type
          <select
            value={block.formSource || 'native'}
            onChange={(e) => set({ formSource: e.target.value, googleUrl: '', formId: '', formSlug: '' })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="native">Connect Intel form</option>
            <option value="google">Google Form</option>
          </select>
        </label>
        {block.formSource === 'google' ? (
          <>
            <input
              value={block.googleUrl || block.url || ''}
              onChange={(e) => {
                const raw = e.target.value.trim()
                const resolved = resolveGoogleFormUrl(raw) || normalizeGoogleFormUrl(raw) || raw
                set({
                  formSource: 'google',
                  formId: '',
                  formSlug: '',
                  googleUrl: resolved,
                  url: resolved || undefined,
                })
              }}
              placeholder="https://docs.google.com/forms/… or https://forms.gle/…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Recipients open the form in their browser (same card layout as Connect Intel forms).
            </p>
          </>
        ) : (
          <select
            value={block.formId || ''}
            onChange={(e) => pickNativeForm(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="">Select a form…</option>
            {marketingForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <input
          value={block.title || ''}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Card title in email"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <textarea
          value={block.description || ''}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Short description under the title"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <input
          value={block.buttonLabel || ''}
          onChange={(e) => set({ buttonLabel: e.target.value })}
          placeholder="Button label (e.g. Fill out form)"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-500">
            Button color
            <input
              type="color"
              value={block.buttonColor || '#111827'}
              onChange={(e) => set({ buttonColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
          <label className="text-[10px] text-gray-500">
            Text color
            <input
              type="color"
              value={block.buttonTextColor || '#ffffff'}
              onChange={(e) => set({ buttonTextColor: e.target.value })}
              className="mt-0.5 block h-8 w-full rounded border border-gray-200"
            />
          </label>
        </div>
        <AlignSelect value={block.align} onChange={(align) => set({ align })} />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Email clients cannot show live forms inside the message. Recipients tap the button to open your form in the
          browser — same as Google Forms in newsletters.
        </p>
      </div>
    )
  }

  if (block.type === 'spacer') {
    return (
      <label className="flex items-center gap-2 text-xs text-gray-600">
        Height (px)
        <input
          type="number"
          min={8}
          max={80}
          value={block.height || 16}
          onChange={(e) => set({ height: Number(e.target.value) })}
          className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1"
        />
      </label>
    )
  }

  if (block.type === 'footer') {
    return (
      <div className="space-y-2">
        <RichTextEditor
          value={block.text || ''}
          onChange={(text) => set({ text })}
          placeholder="Footer note (optional)"
          minHeight={56}
        />
        <TypographyRow block={block} onChange={onChange} />
      </div>
    )
  }

  return <p className="text-xs text-gray-400">No settings for this block.</p>
}
