import {
  FIELD_TYPES,
  createEmptyField,
  normalizeFields,
  normalizeFormTheme,
} from '../../../../lib/marketingFormSchema.js'

function FieldRow({ field, index, total, onChange, onRemove, onMove }) {
  const set = (patch) => onChange({ ...field, ...patch })
  const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase text-gray-500">
          {FIELD_TYPES.find((t) => t.id === field.type)?.label || field.type}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="text-[10px] px-1.5 py-0.5 border rounded disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className="text-[10px] px-1.5 py-0.5 border rounded disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-[10px] px-1.5 py-0.5 border border-red-100 text-red-700 rounded"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-[10px] text-gray-500 sm:col-span-2">
          Field type
          <select
            value={field.type}
            onChange={(e) => onChange({ ...createEmptyField(e.target.value), id: field.id })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {field.type !== 'section' && (
          <>
            <label className="text-[10px] text-gray-500">
              Label
              <input
                value={field.label}
                onChange={(e) => set({ label: e.target.value })}
                className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              />
            </label>
            <label className="text-[10px] text-gray-500 flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(e) => set({ required: e.target.checked })}
              />
              Required
            </label>
            <label className="text-[10px] text-gray-500 sm:col-span-2">
              Placeholder
              <input
                value={field.placeholder || ''}
                onChange={(e) => set({ placeholder: e.target.value })}
                className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              />
            </label>
          </>
        )}
        {field.type === 'section' && (
          <label className="text-[10px] text-gray-500 sm:col-span-2">
            Section title
            <input
              value={field.label}
              onChange={(e) => set({ label: e.target.value })}
              className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            />
          </label>
        )}
        {needsOptions && (
          <label className="text-[10px] text-gray-500 sm:col-span-2">
            Choices (one per line)
            <textarea
              value={(field.options || []).join('\n')}
              onChange={(e) => set({ options: e.target.value.split('\n') })}
              rows={3}
              className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-mono"
            />
          </label>
        )}
        <label className="text-[10px] text-gray-500 sm:col-span-2">
          Help text (optional)
          <input
            value={field.helpText || ''}
            onChange={(e) => set({ helpText: e.target.value })}
            className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          />
        </label>
      </div>
    </div>
  )
}

export default function MarketingFormBuilder({ value, onChange }) {
  const fields = normalizeFields(value.fields)
  const theme = normalizeFormTheme(value.theme)

  const setFields = (next) => onChange({ ...value, fields: next })
  const setTheme = (patch) => onChange({ ...value, theme: { ...theme, ...patch } })

  const moveField = (index, dir) => {
    const next = index + dir
    if (next < 0 || next >= fields.length) return
    const copy = [...fields]
    const [item] = copy.splice(index, 1)
    copy.splice(next, 0, item)
    setFields(copy)
  }

  const updateField = (index, field) => {
    const copy = [...fields]
    copy[index] = field
    setFields(copy)
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-[10px] text-gray-500">
          Accent color
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(e) => setTheme({ primaryColor: e.target.value })}
            className="mt-0.5 block h-8 w-full rounded border border-gray-200"
          />
        </label>
        <label className="text-[10px] text-gray-500">
          Page background
          <input
            type="color"
            value={theme.pageBackground}
            onChange={(e) => setTheme({ pageBackground: e.target.value })}
            className="mt-0.5 block h-8 w-full rounded border border-gray-200"
          />
        </label>
        <label className="text-[10px] text-gray-500">
          Card background
          <input
            type="color"
            value={theme.cardBackground}
            onChange={(e) => setTheme({ cardBackground: e.target.value })}
            className="mt-0.5 block h-8 w-full rounded border border-gray-200"
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-900">Questions ({fields.length})</p>
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return
              setFields([...fields, createEmptyField(e.target.value)])
              e.target.value = ''
            }}
          >
            <option value="">+ Add field</option>
            {FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {fields.map((field, index) => (
          <FieldRow
            key={field.id}
            field={field}
            index={index}
            total={fields.length}
            onChange={(f) => updateField(index, f)}
            onRemove={(i) => setFields(fields.filter((_, idx) => idx !== i))}
            onMove={moveField}
          />
        ))}
      </div>
    </div>
  )
}
