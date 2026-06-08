import { useCallback, useMemo, useRef, useState } from 'react'

const NODE_TYPES = [
  { type: 'trigger', label: 'Trigger', color: '#0ea5e9' },
  { type: 'condition', label: 'Condition', color: '#8b5cf6' },
  { type: 'delay', label: 'Delay', color: '#f59e0b' },
  { type: 'action', label: 'Action', color: '#22c55e' },
]

const DEFAULT_GRAPH = {
  nodes: [
    { id: 'start', type: 'trigger', label: 'Contact added', x: 80, y: 120, config: { type: 'contact_added' } },
    { id: 'delay1', type: 'delay', label: 'Wait 0 days', x: 280, y: 120, config: { delayDays: 0 } },
    { id: 'send1', type: 'action', label: 'Send email', x: 480, y: 120, config: { action: 'send_email' } },
  ],
  edges: [
    { from: 'start', to: 'delay1' },
    { from: 'delay1', to: 'send1' },
  ],
}

function snapId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

const CRM_ACTIONS = [
  { id: 'add_task', label: 'Create task' },
  { id: 'add_note', label: 'Add note' },
  { id: 'set_status', label: 'Set status' },
]

export default function AutomationCanvas({
  graph,
  onChange,
  campaigns = [],
  triggerType = 'contact_added',
  campaignId = '',
  delayDays = 0,
  mode = 'marketing',
  pipelineStages = [],
}) {
  const initial = graph?.nodes?.length ? graph : DEFAULT_GRAPH
  const [localGraph, setLocalGraph] = useState(initial)
  const [dragId, setDragId] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)

  const sync = useCallback(
    (next) => {
      setLocalGraph(next)
      onChange?.(next)
    },
    [onChange]
  )

  const nodes = localGraph.nodes || []
  const edges = localGraph.edges || []

  const onMouseDown = (e, node) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setDragId(node.id)
    setOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y })
  }

  const onMouseMove = (e) => {
    if (!dragId) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(20, e.clientX - rect.left - offset.x)
    const y = Math.max(20, e.clientY - rect.top - offset.y)
    sync({
      ...localGraph,
      nodes: nodes.map((n) => (n.id === dragId ? { ...n, x, y } : n)),
    })
  }

  const onMouseUp = () => setDragId(null)

  const addNode = (type) => {
    const meta = NODE_TYPES.find((t) => t.type === type)
    const id = snapId(type)
    const node = {
      id,
      type,
      label: meta?.label || type,
      x: 120 + nodes.length * 40,
      y: 220,
      config:
        type === 'delay'
          ? { delayDays }
          : type === 'action'
            ? mode === 'crm'
              ? { action: 'add_task', title: 'Follow up', dueDays: 1 }
              : { action: 'send_email', campaignId }
            : type === 'trigger'
              ? { type: triggerType }
              : { type: 'lead_stage', value: 'new' },
    }
    const last = nodes[nodes.length - 1]
    const newEdges = last ? [...edges, { from: last.id, to: id }] : edges
    sync({ nodes: [...nodes, node], edges: newEdges })
  }

  const edgePaths = useMemo(() => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
    return edges
      .map((edge) => {
        const a = byId[edge.from]
        const b = byId[edge.to]
        if (!a || !b) return null
        const x1 = a.x + 90
        const y1 = a.y + 24
        const x2 = b.x
        const y2 = b.y + 24
        return { key: `${edge.from}-${edge.to}`, d: `M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`, branch: edge.branch }
      })
      .filter(Boolean)
  }, [nodes, edges])

  return (
    <div className="automation-canvas-wrap">
      <div className="automation-canvas-toolbar">
        {NODE_TYPES.map((t) => (
          <button key={t.type} type="button" className="ci-btn ci-btn-secondary !text-xs" onClick={() => addNode(t.type)}>
            + {t.label}
          </button>
        ))}
      </div>
      <div
        ref={canvasRef}
        className="automation-canvas"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg className="automation-canvas-svg" width="100%" height="100%">
          {edgePaths.map((p) => (
            <path key={p.key} d={p.d} fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrow)" />
          ))}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
        {nodes.map((node) => {
          const meta = NODE_TYPES.find((t) => t.type === node.type)
          return (
            <div
              key={node.id}
              className="automation-canvas-node"
              style={{ left: node.x, top: node.y, borderColor: meta?.color || '#cbd5e1' }}
              onMouseDown={(e) => onMouseDown(e, node)}
            >
              <span className="automation-canvas-node-type">{node.type}</span>
              <span className="automation-canvas-node-label">{node.label}</span>
              {node.type === 'action' && mode === 'crm' && (
                <>
                  <select
                    className="automation-canvas-node-select"
                    value={node.config?.action || 'add_task'}
                    onChange={(e) => {
                      sync({
                        ...localGraph,
                        nodes: nodes.map((n) =>
                          n.id === node.id ? { ...n, config: { ...n.config, action: e.target.value } } : n
                        ),
                      })
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {CRM_ACTIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  {(node.config?.action === 'add_task' || !node.config?.action) && (
                    <input
                      className="automation-canvas-node-input"
                      placeholder="Task title"
                      value={node.config?.title || ''}
                      onChange={(e) => {
                        sync({
                          ...localGraph,
                          nodes: nodes.map((n) =>
                            n.id === node.id ? { ...n, config: { ...n.config, title: e.target.value } } : n
                          ),
                        })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {node.config?.action === 'set_status' && (
                    <select
                      className="automation-canvas-node-select"
                      value={node.config?.status || 'follow_up'}
                      onChange={(e) => {
                        sync({
                          ...localGraph,
                          nodes: nodes.map((n) =>
                            n.id === node.id ? { ...n, config: { ...n.config, status: e.target.value } } : n
                          ),
                        })
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {pipelineStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
              {node.type === 'action' && mode !== 'crm' && (
                <select
                  className="automation-canvas-node-select"
                  value={node.config?.campaignId || campaignId || ''}
                  onChange={(e) => {
                    sync({
                      ...localGraph,
                      nodes: nodes.map((n) =>
                        n.id === node.id
                          ? { ...n, config: { ...n.config, campaignId: e.target.value } }
                          : n
                      ),
                    })
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {node.type === 'delay' && (
                <input
                  type="number"
                  min={0}
                  max={30}
                  className="automation-canvas-node-input"
                  value={node.config?.delayDays ?? 0}
                  onChange={(e) => {
                    const days = Number(e.target.value) || 0
                    sync({
                      ...localGraph,
                      nodes: nodes.map((n) =>
                        n.id === node.id
                          ? { ...n, label: `Wait ${days}d`, config: { ...n.config, delayDays: days } }
                          : n
                      ),
                    })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
