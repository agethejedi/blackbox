import { useState } from 'react'
import { NavItem } from './types'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Conversations from './pages/Conversations'
import CoachMode from './pages/CoachMode'
import FourHorsemen from './pages/FourHorsemen'
import RepairIndex from './pages/RepairIndex'
import SmartHistory from './pages/SmartHistory'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')

  const renderPage = () => {
    switch (activeNav) {
      case 'dashboard':     return <Dashboard onNavigate={setActiveNav} />
      case 'conversations': return <Conversations />
      case 'horsemen':      return <FourHorsemen />
      case 'repair':        return <RepairIndex />
      case 'history':       return <SmartHistory />
      case 'coach':         return <CoachMode />
      case 'quality':       return <PlaceholderPage title="Conversation Quality" icon="📊" description="Detailed quality scoring across all conversations — coming in next build." />
      case 'drift':         return <PlaceholderPage title="Topic Drift" icon="🌀" description="Track how conversations shift topics and lose focus." />
      case 'loops':         return <PlaceholderPage title="Loops" icon="🔁" description="Identify recurring unresolved patterns across conversations." />
      case 'reports':       return <PlaceholderPage title="Reports" icon="📋" description="Generate and export relationship intelligence reports." />
      case 'settings':      return <PlaceholderPage title="Settings" icon="⚙️" description="Privacy, data management, and configuration." />
      default:              return <Dashboard onNavigate={setActiveNav} />
    }
  }

  return (
    <div className="flex h-screen bg-bb-bg overflow-hidden">
      <Sidebar activeNav={activeNav} onNavigate={setActiveNav} />
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  )
}
