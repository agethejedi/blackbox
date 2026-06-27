import { useState, useEffect } from 'react'
import SectionHeader from '../components/SectionHeader'
import OutcomeBadge from '../components/OutcomeBadge'
import ScoreCard from '../components/ScoreCard'

interface Collection {
  id: string
  name: string
  description?: string
  member_count: number
  quality_score_avg?: number
  escalation_trend?: string
  dominant_outcome?: string
  analysis_version?: number
  created_at: string
  updated_at: string
}

interface CollectionDetail {
  id: string
  name: string
  description?: string
  members: Array<{
    conversation_id: string
    title: string
    source_type: string
    created_at: string
    quality_score?: number
    outcome?: string
  }>
  analysis?: {
    quality_score_avg: number
    escalation_score_avg: number
    validation_score_avg: number
    collaboration_score_avg: number
    escalation_trend: string
    dominant_outcome: string
    recurring_themes: string[]
    recurring_topics: string[]
    horsemen_aggregate: any
    repair_aggregate: any
    coaching_recommendations: string[]
    conversation_count: number
    date_range_start: string
    date_range_end: string
    pattern_summary?: string
    version: number
  }
}

const TREND_COLORS: Record<string, string> = {
  improving: '#34d399', worsening: '#f87171',
  stable: '#94a3b8', fluctuating: '#fb923c'
}

const SOURCE_ICONS: Record<string, string> = {
  audio: '🎙', screenshot: '🖼', text_paste: '📝', pdf: '📄', note: '📋'
}

export default function Collections() {
  const [collections, setCollections]     = useState<Collection[]>([])
  const [selected, setSelected]           = useState<CollectionDetail | null>(null)
  const [loading, setLoading]             = useState(false)
  const [creating, setCreating]           = useState(false)
  const [newName, setNewName]             = useState('')
  const [newDesc, setNewDesc]             = useState('')
  const [error, setError]                 = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const loadCollections = async () => {
    try {
      const res = await fetch('/api/collections')
      const data = await res.json()
      setCollections(data.collections || [])
    } catch {}
  }

  const loadCollection = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/collections?id=${id}`)
      const data = await res.json()
      setSelected(data.collection)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCollections() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined })
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setNewName(''); setNewDesc(''); setCreating(false)
      await loadCollections()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (collectionId: string, conversationId: string) => {
    try {
      await fetch('/api/collections?action=remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_id: collectionId, conversation_id: conversationId })
      })
      await loadCollection(collectionId)
      await loadCollections()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this collection? Conversations will not be deleted.')) return
    try {
      await fetch(`/api/collections?id=${id}`, { method: 'DELETE' })
      setSelected(null)
      await loadCollections()
    } catch {}
  }

  const trendIcon = (trend?: string) => {
    if (trend === 'improving') return '↑'
    if (trend === 'worsening') return '↓'
    if (trend === 'fluctuating') return '↕'
    return '→'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Collections"
        subtitle="Group related conversations for cross-session pattern analysis."
        action={
          <button onClick={() => setCreating(true)}
            className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
            + NEW COLLECTION
          </button>
        }
      />

      {/* Create collection form */}
      {creating && (
        <div className="mb-6 rounded-xl p-5 animate-fade-in"
          style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">New Collection</h3>
            <button onClick={() => setCreating(false)} className="text-xs" style={{ color: '#6b7280' }}>✕</button>
          </div>
          <div className="flex flex-col gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Collection name (e.g. 'Work Situation', 'Q1 2026')"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs rounded-lg"
                style={{ background: '#0e0c1a', border: '1px solid #1e1a2e', color: '#6b7280' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!newName.trim() || loading}
                className="px-4 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40"
                style={{ background: '#8b5cf6', color: 'white' }}>
                Create
              </button>
            </div>
          </div>
          {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection list */}
        <div className="lg:col-span-1 space-y-2">
          {collections.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="text-3xl mb-3">📁</div>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                No collections yet. Create one and add conversations to see cross-session patterns.
              </p>
            </div>
          ) : (
            collections.map(c => (
              <div key={c.id} onClick={() => loadCollection(c.id)}
                className="rounded-xl p-4 cursor-pointer transition-all"
                style={{
                  background: '#0e0c1a',
                  border: selected?.id === c.id ? '1px solid #8b5cf6' : '1px solid #1e1a2e'
                }}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">{c.name}</h3>
                  {c.escalation_trend && (
                    <span className="text-sm font-bold ml-2"
                      style={{ color: TREND_COLORS[c.escalation_trend] || '#94a3b8' }}>
                      {trendIcon(c.escalation_trend)}
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="text-xs mb-2" style={{ color: '#6b7280' }}>{c.description}</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[10px]" style={{ color: '#374151' }}>
                    {c.member_count} conversation{c.member_count !== 1 ? 's' : ''}
                  </span>
                  {c.quality_score_avg != null && (
                    <span className="text-[10px] font-medium" style={{ color: '#8b5cf6' }}>
                      Avg Quality: {Math.round(c.quality_score_avg)}
                    </span>
                  )}
                  {c.dominant_outcome && (
                    <OutcomeBadge outcome={c.dominant_outcome as any} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Collection detail */}
        <div className="lg:col-span-2">
          {!selected && !loading && (
            <div className="rounded-xl p-10 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="text-3xl mb-3">📊</div>
              <p className="text-sm font-medium text-white mb-1">Select a collection</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                View aggregate analysis, trends, and cross-conversation patterns.
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-xl p-10 flex items-center justify-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          )}

          {selected && !loading && (
            <div className="space-y-4 animate-fade-in">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                  {selected.description && (
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{selected.description}</p>
                  )}
                </div>
                <button onClick={() => handleDelete(selected.id)}
                  className="text-[10px] px-2 py-1 rounded transition-all"
                  style={{ color: 'rgba(248,113,133,0.5)', border: '1px solid rgba(248,113,133,0.2)' }}>
                  Delete
                </button>
              </div>

              {/* Aggregate scores */}
              {selected.analysis && (
                <div className="rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs tracking-[0.15em]" style={{ color: '#6b7280' }}>
                      AGGREGATE ANALYSIS — v{selected.analysis.version} · {selected.analysis.conversation_count} conversations
                    </h3>
                    {selected.analysis.escalation_trend && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          color: TREND_COLORS[selected.analysis.escalation_trend],
                          background: `${TREND_COLORS[selected.analysis.escalation_trend]}15`,
                          border: `1px solid ${TREND_COLORS[selected.analysis.escalation_trend]}44`
                        }}>
                        {selected.analysis.escalation_trend.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <ScoreCard label="Avg Quality"    score={Math.round(selected.analysis.quality_score_avg)}      color="#8b5cf6" size="sm" />
                    <ScoreCard label="Avg Escalation" score={Math.round(selected.analysis.escalation_score_avg)}   color="#f87171" size="sm" />
                    <ScoreCard label="Avg Validation" score={Math.round(selected.analysis.validation_score_avg)}   color="#2dd4bf" size="sm" />
                  </div>

                  {selected.analysis.recurring_themes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] tracking-[0.12em] mb-2" style={{ color: '#6b7280' }}>RECURRING THEMES</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.analysis.recurring_themes.map(t => (
                          <span key={t} className="text-[9px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.analysis.coaching_recommendations.length > 0 && (
                    <div className="rounded-lg p-4"
                      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                      <p className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#8b5cf6' }}>CROSS-SESSION RECOMMENDATIONS</p>
                      <ul className="space-y-1.5">
                        {selected.analysis.coaching_recommendations.map((r, i) => (
                          <li key={i} className="text-xs flex gap-2" style={{ color: '#c4b5fd' }}>
                            <span style={{ color: '#6b7280' }}>·</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!selected.analysis && (
                <div className="rounded-xl p-5 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    Add conversations to trigger automatic analysis.
                  </p>
                </div>
              )}

              {/* Member list */}
              <div className="rounded-xl p-4" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
                <h3 className="text-xs tracking-[0.15em] mb-3" style={{ color: '#6b7280' }}>
                  CONVERSATIONS ({selected.members.length})
                </h3>
                {selected.members.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#374151' }}>
                    No conversations yet. Add them from the Conversations page.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selected.members.map(m => (
                      <div key={m.conversation_id}
                        className="flex items-center justify-between rounded-lg p-3"
                        style={{ background: '#070510', border: '1px solid #1e1a2e' }}>
                        <div className="flex items-center gap-2">
                          <span>{SOURCE_ICONS[m.source_type] || '💬'}</span>
                          <div>
                            <p className="text-xs font-medium text-white">{m.title}</p>
                            <p className="text-[10px]" style={{ color: '#374151' }}>
                              {new Date(m.created_at).toLocaleDateString()}
                              {m.quality_score != null && ` · Quality: ${m.quality_score}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(selected.id, m.conversation_id)}
                          className="text-[10px] px-2 py-0.5 rounded transition-all"
                          style={{ color: 'rgba(248,113,133,0.5)', border: '1px solid rgba(248,113,133,0.15)' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
