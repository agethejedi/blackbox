import { NavItem } from '../types'
import ScoreCard from '../components/ScoreCard'
import SectionHeader from '../components/SectionHeader'

interface Props { onNavigate: (nav: NavItem) => void }

const QUICK_ACTIONS = [
  { label: 'Paste Conversation', icon: '📝', nav: 'conversations' as NavItem },
  { label: 'Upload Screenshot',  icon: '🖼', nav: 'conversations' as NavItem },
  { label: 'Coach a Response',   icon: '🎯', nav: 'coach' as NavItem },
  { label: 'Search History',     icon: '🔍', nav: 'history' as NavItem },
]

export default function Dashboard({ onNavigate }: Props) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Black Box"
        subtitle="Relationship communication intelligence — pattern analysis, coaching, and history."
      />

      {/* Status banner */}
      <div className="mb-6 rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
        <div className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: '#8b5cf6' }} />
        <span className="text-sm" style={{ color: '#c4b5fd' }}>
          System ready. No conversations analyzed yet — paste a thread or upload a screenshot to begin.
        </span>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => onNavigate(a.nav)}
            className="rounded-xl p-4 text-left transition-all duration-150 hover:border-purple-500/40"
            style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
            <div className="text-2xl mb-2">{a.icon}</div>
            <div className="text-[11px] font-medium text-white">{a.label}</div>
          </button>
        ))}
      </div>

      {/* Score overview — empty state */}
      <div className="mb-6">
        <h2 className="text-sm font-medium mb-3 tracking-[0.1em]" style={{ color: '#6b7280' }}>
          RELATIONSHIP OVERVIEW
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <ScoreCard label="Quality"       score={0} color="#8b5cf6" />
          <ScoreCard label="Escalation"    score={0} color="#f87171" />
          <ScoreCard label="Validation"    score={0} color="#2dd4bf" />
          <ScoreCard label="Collaboration" score={0} color="#34d399" />
          <ScoreCard label="Topic Drift"   score={0} color="#fb923c" />
          <ScoreCard label="Resolution"    score={0} color="#60a5fa" />
        </div>
        <p className="text-[10px] mt-2 tracking-[0.1em]" style={{ color: '#374151' }}>
          Scores will populate after your first analysis run.
        </p>
      </div>

      {/* Four Horsemen preview */}
      <div className="rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
        <h2 className="text-sm font-medium mb-4 tracking-[0.1em]" style={{ color: '#6b7280' }}>
          FOUR HORSEMEN SNAPSHOT
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Criticism', 'Defensiveness', 'Contempt', 'Stonewalling'].map(h => (
            <div key={h} className="text-center">
              <div className="text-2xl font-light mb-1" style={{ color: '#f87171' }}>—</div>
              <div className="text-[10px] tracking-[0.1em]" style={{ color: '#6b7280' }}>{h.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-4 text-center" style={{ color: '#374151' }}>
          Analyze a conversation to see Horsemen scores.
        </p>
      </div>
    </div>
  )
}
