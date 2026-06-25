import { ConflictOutcome } from '../types'
const CONFIG: Record<ConflictOutcome, { label: string; color: string; bg: string }> = {
  resolved:   { label: 'Resolved',   color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  unresolved: { label: 'Unresolved', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  escalated:  { label: 'Escalated',  color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  deferred:   { label: 'Deferred',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}
export default function OutcomeBadge({ outcome }: { outcome: ConflictOutcome }) {
  const c = CONFIG[outcome]
  return (
    <span className="text-[10px] tracking-[0.1em] px-2 py-0.5 rounded-full font-medium"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.color}44` }}>
      {c.label}
    </span>
  )
}
