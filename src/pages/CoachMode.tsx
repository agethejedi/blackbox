import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import { api } from '../lib/api'
import { CoachReport } from '../types'

const RISK_COLORS = { low: '#34d399', medium: '#fb923c', high: '#f87171' }

export default function CoachMode() {
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState('')
  const [report, setReport] = useState<CoachReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCoach = async () => {
    if (!draft.trim()) return
    setLoading(true); setError(''); setReport(null)
    try {
      const data = await api.coach(draft, context)
      setReport(data.report)
    } catch (err: any) {
      setError(err.message || 'Coaching failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader
        title="Coach Mode"
        subtitle="Paste a draft response before sending. Black Box will analyze risk, tone, and suggest a better approach."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] tracking-[0.15em] mb-2" style={{ color: '#6b7280' }}>
              CONTEXT (optional — recent conversation thread)
            </label>
            <textarea value={context} onChange={e => setContext(e.target.value)}
              rows={4} placeholder="Paste recent conversation context here..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none font-mono"
              style={{ background: '#0e0c1a', border: '1px solid #1e1a2e', color: '#94a3b8', lineHeight: 1.6 }} />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.15em] mb-2" style={{ color: '#6b7280' }}>
              YOUR DRAFT RESPONSE
            </label>
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              rows={8} placeholder="Type or paste your draft response before sending..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)', color: '#e2e8f0', lineHeight: 1.7 }} />
          </div>
          <button onClick={handleCoach} disabled={loading || !draft.trim()}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: '#8b5cf6', color: 'white' }}>
            {loading ? 'Analyzing...' : '🎯 Analyze Response'}
          </button>
          {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
        </div>

        {/* Report */}
        <div>
          {!report && !loading && (
            <div className="rounded-xl p-8 text-center h-full flex flex-col items-center justify-center"
              style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-sm font-medium text-white mb-1">Coaching report will appear here</h3>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Enter your draft and click Analyze to get risk scoring, tone analysis, and suggested rewrites.
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-xl p-8 text-center h-full flex flex-col items-center justify-center"
              style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
              <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-3" />
              <p className="text-sm" style={{ color: '#8b5cf6' }}>Analyzing with GPT-4.5...</p>
            </div>
          )}

          {report && (
            <div className="space-y-4 animate-fade-in">
              {/* Risk score */}
              <div className="rounded-xl p-4" style={{ background: '#0e0c1a', border: `1px solid ${RISK_COLORS[report.risk_level]}44` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] tracking-[0.15em]" style={{ color: '#6b7280' }}>RISK ASSESSMENT</span>
                  <span className="text-sm font-bold px-3 py-0.5 rounded-full"
                    style={{ color: RISK_COLORS[report.risk_level], background: `${RISK_COLORS[report.risk_level]}15`, border: `1px solid ${RISK_COLORS[report.risk_level]}44` }}>
                    {report.risk_level.toUpperCase()} — {report.risk_score}/100
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{report.tone_analysis}</p>
              </div>

              {/* Concerns */}
              {report.concerns.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
                  <h4 className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#f87171' }}>CONCERNS</h4>
                  <ul className="space-y-1">
                    {report.concerns.map((c, i) => (
                      <li key={i} className="text-xs flex gap-2" style={{ color: '#fca5a5' }}>
                        <span style={{ color: '#6b7280' }}>·</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What they may hear */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <h4 className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#f87171' }}>WHAT THEY MAY HEAR</h4>
                <p className="text-xs leading-relaxed italic" style={{ color: '#fca5a5' }}>{report.what_they_may_hear}</p>
              </div>

              {/* Suggested rewrite */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <h4 className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#34d399' }}>SUGGESTED REWRITE</h4>
                <p className="text-sm leading-relaxed" style={{ color: '#6ee7b7' }}>{report.suggested_rewrite}</p>
              </div>

              {/* Next action */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <h4 className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#8b5cf6' }}>SUGGESTED NEXT ACTION</h4>
                <p className="text-xs leading-relaxed" style={{ color: '#c4b5fd' }}>{report.suggested_next_action}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
