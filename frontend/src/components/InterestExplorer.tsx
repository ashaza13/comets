import { useState, useMemo, useCallback } from 'react'
import { INTEREST_TREE, getNodeAtPath, getBreadcrumbLabels, type InterestNode } from '../data/interests'

export interface SelectedInterest {
  id: string
  label: string
  path: string[]
  depth: number
}

const MIN_SELECTIONS = 3
const CX = 240
const CY = 160
const RING_RADIUS = 128
const NODE_R = 31

function getRadialPositions(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      x: CX + RING_RADIUS * Math.cos(angle),
      y: CY + RING_RADIUS * Math.sin(angle),
    }
  })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

interface Props {
  onComplete: (interests: SelectedInterest[]) => void
}

export function InterestExplorer({ onComplete }: Props) {
  const [path, setPath]         = useState<string[]>([])
  const [selected, setSelected] = useState<SelectedInterest[]>([])
  const [hovered, setHovered]   = useState<string | null>(null)
  const [visible, setVisible]   = useState(true)

  const currentNode = useMemo(
    () => (path.length === 0 ? INTEREST_TREE : getNodeAtPath(INTEREST_TREE, path)),
    [path],
  )
  const children  = currentNode?.children ?? []
  const positions = useMemo(() => getRadialPositions(children.length), [children.length])
  const breadcrumb = getBreadcrumbLabels(path, INTEREST_TREE)

  const transition = useCallback((cb: () => void) => {
    setVisible(false)
    setTimeout(() => { cb(); setVisible(true) }, 210)
  }, [])

  const drillInto = useCallback(
    (child: InterestNode) => {
      if (!child.children?.length) return
      transition(() => setPath((p) => [...p, child.id]))
    },
    [transition],
  )

  const goBack = useCallback(() => {
    transition(() => setPath((p) => p.slice(0, -1)))
  }, [transition])

  const toggleSelect = useCallback(
    (child: InterestNode, e: React.MouseEvent) => {
      e.stopPropagation()
      const interestPath = [...path, child.id]
      const key = interestPath.join('/')
      setSelected((prev) => {
        if (prev.find((s) => s.path.join('/') === key)) {
          return prev.filter((s) => s.path.join('/') !== key)
        }
        return [
          ...prev,
          { id: child.id, label: child.label, path: interestPath, depth: interestPath.length },
        ]
      })
    },
    [path],
  )

  const deselect = useCallback((key: string) => {
    setSelected((prev) => prev.filter((s) => s.path.join('/') !== key))
  }, [])

  return (
    <div className="interest-explorer">
      {/* Header */}
      <div className="ie-header">
        {path.length > 0 ? (
          <button className="ie-back" onClick={goBack}>← back</button>
        ) : (
          <span className="ie-eyebrow">your interests</span>
        )}
        <span className="ie-breadcrumb">
          {breadcrumb.length === 0 ? 'explore interests' : breadcrumb.join(' › ')}
        </span>
      </div>

      {/* Graph */}
      <div className={`ie-graph-wrap${visible ? ' ie-graph-wrap--visible' : ''}`}>
        <svg className="ie-svg" viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">
          {/* Connector lines */}
          {positions.map((pos, i) => (
            <line
              key={`${children[i].id}-line`}
              x1={CX} y1={CY}
              x2={pos.x} y2={pos.y}
              stroke="rgba(96,96,238,0.10)"
              strokeWidth="1"
            />
          ))}

          {/* Center node */}
          {path.length > 0 && currentNode ? (
            <g>
              <circle cx={CX} cy={CY} r={38} fill="rgba(96,96,238,0.15)" stroke="rgba(96,96,238,0.55)" strokeWidth="1.5" />
              <text x={CX} y={CY + 4} textAnchor="middle" fill="#9090dd" fontSize="9.5" fontFamily="var(--mono)">
                {truncate(currentNode.label, 13)}
              </text>
            </g>
          ) : (
            <g>
              <circle cx={CX} cy={CY} r={28} fill="none" stroke="rgba(96,96,238,0.18)" strokeWidth="1" strokeDasharray="4 3" />
              <text x={CX} y={CY + 4} textAnchor="middle" fill="rgba(96,96,238,0.35)" fontSize="8.5" fontFamily="var(--mono)">
                browse
              </text>
            </g>
          )}

          {/* Child nodes */}
          {children.map((child, i) => {
            const pos        = positions[i]
            const key        = [...path, child.id].join('/')
            const isSelected = selected.some((s) => s.path.join('/') === key)
            const isHovered  = hovered === child.id
            const hasKids    = !!child.children?.length

            const fillColor   = isSelected
              ? 'rgba(96,96,238,0.28)'
              : isHovered ? 'rgba(40,40,72,0.95)' : 'rgba(16,16,36,0.92)'
            const strokeColor = isSelected
              ? '#6060ee'
              : isHovered ? 'rgba(96,96,238,0.65)' : 'rgba(96,96,238,0.28)'
            const textColor   = isSelected ? '#b0b0f0' : isHovered ? '#d0d0f8' : '#7070aa'

            return (
              <g
                key={child.id}
                style={{ cursor: 'pointer' }}
                onClick={hasKids ? () => drillInto(child) : (e) => toggleSelect(child, e as React.MouseEvent)}
                onMouseEnter={() => setHovered(child.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={pos.x} cy={pos.y} r={NODE_R}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 1.5 : 1}
                />

                {/* Label */}
                <text
                  x={pos.x} y={pos.y + (hasKids ? 0 : 4)}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize="8.5"
                  fontFamily="var(--mono)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {truncate(child.label, 11)}
                </text>

                {/* Drill hint */}
                {hasKids && (
                  <text
                    x={pos.x} y={pos.y + 12}
                    textAnchor="middle"
                    fill={isHovered ? 'rgba(96,96,238,0.85)' : 'rgba(96,96,238,0.35)'}
                    fontSize="7"
                    fontFamily="var(--mono)"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    explore ›
                  </text>
                )}

                {/* Select badge for non-leaf nodes */}
                {hasKids && (
                  <g onClick={(e) => toggleSelect(child, e as React.MouseEvent)}>
                    <circle
                      cx={pos.x + NODE_R - 4} cy={pos.y - NODE_R + 4}
                      r={9}
                      fill={isSelected ? '#6060ee' : 'rgba(20,20,42,0.95)'}
                      stroke={isSelected ? '#6060ee' : 'rgba(96,96,238,0.45)'}
                      strokeWidth="1"
                    />
                    <text
                      x={pos.x + NODE_R - 4} y={pos.y - NODE_R + 8}
                      textAnchor="middle"
                      fill={isSelected ? '#fff' : 'rgba(96,96,238,0.7)'}
                      fontSize="11"
                      fontFamily="var(--mono)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {isSelected ? '✓' : '+'}
                    </text>
                  </g>
                )}

                {/* Leaf selected indicator */}
                {!hasKids && isSelected && (
                  <text
                    x={pos.x + NODE_R - 4} y={pos.y - NODE_R + 9}
                    textAnchor="middle"
                    fill="#6060ee"
                    fontSize="11"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ✓
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Interaction legend */}
      <div className="ie-legend">
        <span>click node to explore ›</span>
        <span className="ie-legend-sep">·</span>
        <span>+ to select</span>
      </div>

      {/* Selected chips */}
      <div className="ie-chips">
        {selected.length === 0 ? (
          <span className="ie-chips-empty">select at least {MIN_SELECTIONS} interests to continue</span>
        ) : (
          selected.map((s) => {
            const key = s.path.join('/')
            return (
              <span key={key} className="ie-chip">
                <span className="ie-chip-depth">{'·'.repeat(s.depth)}</span>
                {s.label}
                <button className="ie-chip-remove" onClick={() => deselect(key)}>×</button>
              </span>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="ie-footer">
        <span
          className="ie-count"
          style={{ color: selected.length >= MIN_SELECTIONS ? '#6bff9e' : 'var(--text-dim)' }}
        >
          {selected.length} / {MIN_SELECTIONS}
        </span>
        <button
          className="intro-cta"
          disabled={selected.length < MIN_SELECTIONS}
          onClick={() => onComplete(selected)}
        >
          continue →
        </button>
      </div>
    </div>
  )
}
