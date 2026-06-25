import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import OutcomeBadge from '../components/OutcomeBadge'
import { api } from '../lib/api'
import { SearchResult } from '../types'

const EXAMPLE_QUERIES = [
  'Show conversations about budget',
  'Find unresolved conflicts',
  'Show every time trust was mentioned',
  'Which topics escalate most often?',
]

export default function SmartHistory() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (q?: string) => {
    const searchQuery = q || query
    if (!searchQuery.trim()) return
    setLoading(true); setSearched(true)
    try {
      const data = await api.search(searchQuery)
      setResults(data.results)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader
        title="Smart History"
        subtitle="Search your relationship memory by keyword, topic, theme, person, or outcome."
      />

      {/* Search bar */}
      <div className="mb-6 flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search conversations, topics, themes, outcomes..."
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: '#0e0c1a', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
        <button onClick={() => handleSearch()} disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: '#8b5cf6', color: 'white' }}>
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {/* Example queries */}
      {!searched && (
        <div className="mb-6">
          <p className="text-[10px] tracking-[0.15em] mb-3" style={{ color: '#374151' }}>EXAMPLE QUERIES</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map(q => (
              <button key={q} onClick={() => { setQuery(q); handleSearch(q); }}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: '#0e0c1a', border: '1px solid #1e1a2e', color: '#94a3b8' }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="text-sm font-medium text-white mb-1">No results found</h3>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Try a different search term, or analyze more conversations to build your history.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] tracking-[0.15em]" style={{ color: '#6b7280' }}>
            {results.length} RESULT{results.length !== 1 ? 'S' : ''} FOR "{query}"
          </p>
          {results.map(r => (
            <div key={r.conversation_id} className="rounded-xl p-4" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{r.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: '#374151' }}>{r.date}</span>
                  <OutcomeBadge outcome={r.outcome} />
                </div>
              </div>
              <p className="text-xs leading-relaxed mb-2" style={{ color: '#94a3b8' }}>{r.excerpt}</p>
              {r.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.topics.map(t => (
                    <span key={t} className="text-[9px] tracking-[0.08em] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
