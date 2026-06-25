import SectionHeader from '../components/SectionHeader'
import ScoreCard from '../components/ScoreCard'

const HORSEMEN = [
  { key: 'criticism',     label: 'Criticism',     color: '#f87171', antidote: 'Gentle startup — use "I" statements, describe the behavior not the person.' },
  { key: 'defensiveness', label: 'Defensiveness', color: '#fb923c', antidote: 'Accept responsibility — even partial. Acknowledge the other person\'s point before responding.' },
  { key: 'contempt',      label: 'Contempt',      color: '#a78bfa', antidote: 'Build culture of appreciation — describe your own feelings and needs, not their faults.' },
  { key: 'stonewalling',  label: 'Stonewalling',  color: '#60a5fa', antidote: 'Physiological self-soothing — take a 20-minute break and return when calm.' },
]

export default function FourHorsemen() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Four Horsemen"
        subtitle="Track the four communication patterns most predictive of relationship distress — identified by Dr. John Gottman."
      />

      {/* Score overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {HORSEMEN.map(h => (
          <ScoreCard key={h.key} label={h.label} score={0} color={h.color} trend="stable" />
        ))}
      </div>

      {/* Antidotes */}
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-4 tracking-[0.1em]" style={{ color: '#6b7280' }}>ANTIDOTES</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HORSEMEN.map(h => (
            <div key={h.key} className="rounded-xl p-4" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                <span className="text-sm font-medium" style={{ color: h.color }}>{h.label}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{h.antidote}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div className="rounded-xl p-8 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
        <div className="text-3xl mb-3">⚡</div>
        <h3 className="text-sm font-medium text-white mb-1">No data yet</h3>
        <p className="text-xs" style={{ color: '#6b7280' }}>
          Analyze a conversation to see Horsemen patterns, speaker breakdown, and evidence excerpts.
        </p>
      </div>
    </div>
  )
}
