import { useState } from 'react'
import SectionHeader from '../components/SectionHeader'
import OutcomeBadge from '../components/OutcomeBadge'
import ScoreCard from '../components/ScoreCard'
import { api, pollAnalysis } from '../lib/api'
import { Conversation, AnalysisStatus } from '../types'

type IngestMode = 'text' | 'screenshot' | 'file' | null

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [ingestMode, setIngestMode] = useState<IngestMode>(null)
  const [loading, setLoading] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Text ingest form
  const [textTitle, setTextTitle] = useState('')
  const [textParticipants, setTextParticipants] = useState('Person A, Person B')
  const [textContent, setTextContent] = useState('')

  const handleTextAnalyze = async () => {
    if (!textContent.trim()) return
    setLoading(true); setError(''); setAnalysisStatus('Submitting...')
    try {
      const participants = textParticipants.split(',').map(s => s.trim()).filter(Boolean)
      const result = await api.analyzeText({
        title: textTitle || 'Untitled Conversation',
        raw_text: textContent,
        participants,
      })
      setAnalysisStatus('Analyzing...')
      const analysis = await pollAnalysis(result.conversation_id, setAnalysisStatus)
      setAnalysisStatus('Complete')
      // Reload conversation list
      const data = await api.listConversations()
      setConversations(data.conversations)
      setIngestMode(null)
      setTextContent(''); setTextTitle(''); setTextParticipants('Person A, Person B')
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'screenshot' | 'pdf' | 'audio') => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(''); setAnalysisStatus('Uploading...')
    try {
      const upload = await api.uploadFile(file, type)
      setAnalysisStatus('Processing...')
      const analysis = await pollAnalysis(upload.upload_id, setAnalysisStatus)
      setAnalysisStatus('Complete')
      const data = await api.listConversations()
      setConversations(data.conversations)
      setIngestMode(null)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Conversations"
        subtitle="Ingest and analyze communication threads."
        action={
          <div className="flex gap-2">
            <button onClick={() => setIngestMode('text')}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
              + PASTE TEXT
            </button>
            <button onClick={() => setIngestMode('screenshot')}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: 'rgba(45,212,191,0.1)', color: '#5eead4', border: '1px solid rgba(45,212,191,0.25)' }}>
              + SCREENSHOT
            </button>
            <button onClick={() => setIngestMode('file')}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: '#0e0c1a', color: '#6b7280', border: '1px solid #1e1a2e' }}>
              + FILE
            </button>
          </div>
        }
      />

      {/* Ingest panels */}
      {ingestMode === 'text' && (
        <div className="mb-6 rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Paste Conversation</h3>
            <button onClick={() => setIngestMode(null)} className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>
          <div className="flex flex-col gap-3">
            <input value={textTitle} onChange={e => setTextTitle(e.target.value)}
              placeholder="Conversation title (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
            <input value={textParticipants} onChange={e => setTextParticipants(e.target.value)}
              placeholder="Participants (comma separated)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
            <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
              placeholder="Paste the conversation here. Format: Name: message or just paste the thread as-is."
              rows={10}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none font-mono"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0', lineHeight: 1.6 }} />
            <div className="flex items-center justify-between">
              <p className="text-[10px]" style={{ color: '#374151' }}>
                Black Box will normalize, analyze, and score this conversation using GPT-4.5.
              </p>
              <button onClick={handleTextAnalyze} disabled={loading || !textContent.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: '#8b5cf6', color: 'white' }}>
                {loading ? analysisStatus || 'Analyzing...' : 'Analyze →'}
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          </div>
        </div>
      )}

      {ingestMode === 'screenshot' && (
        <div className="mb-6 rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid rgba(45,212,191,0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Upload Screenshot</h3>
            <button onClick={() => setIngestMode(null)} className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>
          <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-10 transition-all"
            style={{ border: '2px dashed #1e1a2e', background: '#070510' }}>
            <span className="text-3xl mb-2">🖼</span>
            <span className="text-sm" style={{ color: '#6b7280' }}>Click to upload screenshot</span>
            <span className="text-xs mt-1" style={{ color: '#374151' }}>PNG, JPG, WEBP supported</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => handleFileUpload(e, 'screenshot')} disabled={loading} />
          </label>
          {loading && <p className="text-xs mt-2 text-center" style={{ color: '#8b5cf6' }}>{analysisStatus}</p>}
          {error && <p className="text-xs mt-2 text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}

      {ingestMode === 'file' && (
        <div className="mb-6 rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Upload File</h3>
            <button onClick={() => setIngestMode(null)} className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-8 transition-all hover:border-purple-500/30"
              style={{ border: '1px dashed #1e1a2e', background: '#070510' }}>
              <span className="text-2xl mb-1">📄</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>PDF / Document</span>
              <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => handleFileUpload(e, 'pdf')} disabled={loading} />
            </label>
            <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-8 transition-all hover:border-teal-500/30"
              style={{ border: '1px dashed #1e1a2e', background: '#070510' }}>
              <span className="text-2xl mb-1">🎵</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>Audio Recording</span>
              <input type="file" accept="audio/*" className="hidden"
                onChange={e => handleFileUpload(e, 'audio')} disabled={loading} />
            </label>
          </div>
          {loading && <p className="text-xs mt-3 text-center" style={{ color: '#8b5cf6' }}>{analysisStatus}</p>}
          {error && <p className="text-xs mt-2 text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}

      {/* Conversation list */}
      {conversations.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
          <div className="text-4xl mb-3">💬</div>
          <h3 className="text-sm font-medium text-white mb-1">No conversations yet</h3>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Paste a text thread or upload a screenshot to begin your first analysis.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} onClick={() => setSelected(c)}
              className="rounded-xl p-4 cursor-pointer transition-all hover:border-purple-500/30"
              style={{ background: '#0e0c1a', border: selected?.id === c.id ? '1px solid #8b5cf6' : '1px solid #1e1a2e' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{c.title}</span>
                {c.analysis && <OutcomeBadge outcome={c.analysis.outcome} />}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px]" style={{ color: '#6b7280' }}>{c.source_type.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[10px]" style={{ color: '#6b7280' }}>{c.participants.map(p => p.name).join(', ')}</span>
                <span className="text-[10px]" style={{ color: '#374151' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                {c.analysis && (
                  <span className="text-[10px] font-medium" style={{ color: '#8b5cf6' }}>
                    Quality: {c.analysis.quality_score}/100
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected conversation detail */}
      {selected?.analysis && (
        <div className="mt-6 rounded-xl p-5" style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">{selected.title}</h3>
            <OutcomeBadge outcome={selected.analysis.outcome} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <ScoreCard label="Quality"       score={selected.analysis.quality_score}       color="#8b5cf6" size="sm" />
            <ScoreCard label="Escalation"    score={selected.analysis.escalation_score}    color="#f87171" size="sm" />
            <ScoreCard label="Validation"    score={selected.analysis.validation_score}    color="#2dd4bf" size="sm" />
            <ScoreCard label="Collaboration" score={selected.analysis.collaboration_score} color="#34d399" size="sm" />
            <ScoreCard label="Topic Drift"   score={selected.analysis.topic_drift_score}   color="#fb923c" size="sm" />
            <ScoreCard label="Resolution"    score={Math.round(selected.analysis.resolution_probability * 100)} color="#60a5fa" size="sm" />
          </div>
          {selected.analysis.coaching_recommendations.length > 0 && (
            <div className="rounded-lg p-4" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <h4 className="text-[10px] tracking-[0.15em] mb-2" style={{ color: '#8b5cf6' }}>COACHING RECOMMENDATIONS</h4>
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
    </div>
  )
}
