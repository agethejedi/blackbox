import SectionHeader from '../components/SectionHeader'
import ScoreCard from '../components/ScoreCard'

const REPAIR_BEHAVIORS = [
  { label: 'Validation',        icon: '✓', color: '#34d399', desc: 'Acknowledging the other person\'s feelings as understandable.' },
  { label: 'Accountability',    icon: '⚖', color: '#2dd4bf', desc: 'Taking responsibility for one\'s own role in the conflict.' },
  { label: 'Appreciation',      icon: '♡', color: '#f472b6', desc: 'Expressing genuine gratitude or admiration.' },
  { label: 'Compromise',        icon: '⇄', color: '#a78bfa', desc: 'Offering to meet in the middle or adjust position.' },
  { label: 'Reconnection',      icon: '◎', color: '#60a5fa', desc: 'Gestures that re-establish warmth and connection.' },
  { label: 'De-escalation',     icon: '↓', color: '#fb923c', desc: 'Actively reducing tension — humor, softening tone, breaks.' },
  { label: 'Softened Startup',  icon: '~', color: '#8b5cf6', desc: 'Beginning difficult conversations gently rather than with blame.' },
]

export default function RepairIndex() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Repair Index"
        subtitle="Track positive repair behaviors — the actions that de-escalate conflict and rebuild connection."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <ScoreCard label="Resilience Score"   score={0} color="#8b5cf6" size="lg" />
        <ScoreCard label="Repair Attempts"    score={0} max={20} color="#2dd4bf" />
        <ScoreCard label="Successful Repairs" score={0} max={20} color="#34d399" />
        <ScoreCard label="Recovery Time"      score={0} max={60} color="#fb923c" />
      </div>
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-4 tracking-[0.1em]" style={{ color: '#6b7280' }}>REPAIR BEHAVIORS TRACKED</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPAIR_BEHAVIORS.map(b => (
            <div key={b.label} className="rounded-xl p-4 flex gap-3" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <span className="text-xl w-6 text-center flex-shrink-0" style={{ color: b.color }}>{b.icon}</span>
              <div>
                <div className="text-sm font-medium mb-1" style={{ color: b.color }}>{b.label}</div>
                <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-8 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
        <div className="text-3xl mb-3">🔧</div>
        <h3 className="text-sm font-medium text-white mb-1">No repair data yet</h3>
        <p className="text-xs" style={{ color: '#6b7280' }}>Analyze a conversation to see repair attempts, success rates, and resilience scoring.</p>
      </div>
    </div>
  )
}
