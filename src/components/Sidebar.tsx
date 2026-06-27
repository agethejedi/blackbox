import { NavItem } from '../types'

interface NavEntry { id: NavItem; label: string; icon: string; }

const NAV_ITEMS: NavEntry[] = [
  { id: 'dashboard',     label: 'Dashboard',            icon: '⬡' },
  { id: 'conversations', label: 'Conversations',         icon: '💬' },
  { id: 'collections',   label: 'Collections',           icon: '📁' },
  { id: 'quality',       label: 'Conversation Quality',  icon: '📊' },
  { id: 'horsemen',      label: 'Four Horsemen',         icon: '⚡' },
  { id: 'repair',        label: 'Repair Index',          icon: '🔧' },
  { id: 'drift',         label: 'Topic Drift',           icon: '🌀' },
  { id: 'loops',         label: 'Loops',                 icon: '🔁' },
  { id: 'history',       label: 'Smart History',         icon: '🔍' },
  { id: 'coach',         label: 'Coach Mode',            icon: '🎯' },
  { id: 'reports',       label: 'Reports',               icon: '📋' },
  { id: 'settings',      label: 'Settings',              icon: '⚙️' },
]

interface Props {
  activeNav: NavItem
  onNavigate: (nav: NavItem) => void
}

export default function Sidebar({ activeNav, onNavigate }: Props) {
  return (
    <aside className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{ background: '#0a0818', borderColor: '#1e1a2e' }}>

      {/* Wordmark */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#1e1a2e' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #2dd4bf)', color: '#070510' }}>
            BB
          </div>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.2em] text-white">BLACK BOX</div>
            <div className="text-[8px] tracking-[0.15em] mt-0.5" style={{ color: '#6b7280' }}>
              RELATIONSHIP INTEL
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(item => {
          const isActive = activeNav === item.id
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-left transition-all duration-150"
              style={{
                background: isActive ? 'rgba(139,92,246,0.15)' : 'transparent',
                borderLeft: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                color: isActive ? '#c4b5fd' : '#6b7280',
              }}>
              <span className="text-sm w-4 text-center flex-shrink-0">{item.icon}</span>
              <span className="text-[11px] tracking-[0.08em] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#1e1a2e' }}>
        <div className="text-[8px] tracking-[0.15em]" style={{ color: '#374151' }}>
          JARVIS SUBAGENT · v1.0
        </div>
      </div>
    </aside>
  )
}
