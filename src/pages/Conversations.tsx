import { useState, useRef, useEffect, useCallback } from 'react'
import SectionHeader from '../components/SectionHeader'
import OutcomeBadge from '../components/OutcomeBadge'
import ScoreCard from '../components/ScoreCard'
import { api, pollAnalysis } from '../lib/api'
import { Conversation } from '../types'

type IngestMode = 'text' | 'screenshot' | 'file' | 'record' | null

// ── Recording timer display ────────────────────────────────────────────────
function RecordingTimer({ seconds, limit = 1500 }: { seconds: number; limit?: number }) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const pct  = Math.min((seconds / limit) * 100, 100)
  const warn = seconds > limit * 0.8
  const color = seconds > limit * 0.9 ? '#f87171' : warn ? '#fb923c' : '#2dd4bf'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-3xl font-mono tabular-nums font-light"
        style={{ color, textShadow: `0 0 12px ${color}88` }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: '#1e1a2e' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      {warn && (
        <p className="text-[9px] tracking-[0.15em]" style={{ color }}>
          {seconds > limit * 0.9 ? 'APPROACHING LIMIT' : 'OVER 80% — CONSIDER WRAPPING UP'}
        </p>
      )}
    </div>
  )
}

// ── Speaker verification step ──────────────────────────────────────────────
interface SpeakerVerifyProps {
  utterances: Array<{ speaker: string; text: string }>
  speakerCount: number
  onConfirm: (mapping: Record<string, string>) => void
  onCancel: () => void
}

function SpeakerVerify({ utterances, speakerCount, onConfirm, onCancel }: SpeakerVerifyProps) {
  const speakers = Array.from(new Set(utterances.map(u => u.speaker)))
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(speakers.map(s => [s, s]))
  )

  // Show first utterance per speaker as a preview
  const previews = speakers.reduce((acc, speaker) => {
    const first = utterances.find(u => u.speaker === speaker)
    acc[speaker] = first?.text?.slice(0, 80) || ''
    return acc
  }, {} as Record<string, string>)

  return (
    <div className="rounded-xl p-5 animate-fade-in"
      style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white">Verify Speakers</h3>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            Black Box detected {speakerCount} speaker{speakerCount !== 1 ? 's' : ''}. Name them or leave as-is.
          </p>
        </div>
        <button onClick={onCancel} className="text-xs" style={{ color: '#6b7280' }}>✕</button>
      </div>

      <div className="space-y-3 mb-5">
        {speakers.map(speaker => (
          <div key={speaker} className="rounded-lg p-3" style={{ background: '#070510', border: '1px solid #1e1a2e' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#8b5cf6' }} />
              <input
                value={names[speaker]}
                onChange={e => setNames(n => ({ ...n, [speaker]: e.target.value }))}
                placeholder={speaker}
                className="flex-1 rounded px-2 py-1 text-xs outline-none"
                style={{ background: 'rgba(200,196,240,0.06)', border: '1px solid #1e1a2e', color: '#e2e8f0' }}
              />
            </div>
            {previews[speaker] && (
              <p className="text-xs pl-5 italic" style={{ color: '#374151' }}>
                "{previews[speaker]}{previews[speaker].length >= 80 ? '…' : ''}"
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg transition-all"
          style={{ background: '#0e0c1a', border: '1px solid #1e1a2e', color: '#6b7280' }}>
          Cancel
        </button>
        <button onClick={() => onConfirm(names)}
          className="px-4 py-1.5 text-xs rounded-lg font-medium transition-all"
          style={{ background: '#8b5cf6', color: 'white' }}>
          Confirm & Analyze →
        </button>
      </div>
    </div>
  )
}

// ── Main Conversations page ────────────────────────────────────────────────
export default function Conversations() {
  const [conversations, setConversations]   = useState<Conversation[]>([])
  const [selected, setSelected]             = useState<Conversation | null>(null)
  const [ingestMode, setIngestMode]         = useState<IngestMode>(null)
  const [loading, setLoading]               = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [error, setError]                   = useState('')

  // Text ingest
  const [textTitle, setTextTitle]               = useState('')
  const [textParticipants, setTextParticipants] = useState('Person A, Person B')
  const [textContent, setTextContent]           = useState('')

  // Recording state
  const [isRecording, setIsRecording]           = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingTitle, setRecordingTitle]     = useState('')
  const [transcribeStatus, setTranscribeStatus] = useState('')
  const [pendingUtterances, setPendingUtterances] = useState<Array<{ speaker: string; text: string }> | null>(null)
  const [pendingSpeakerCount, setPendingSpeakerCount] = useState(0)
  const [pendingTranscript, setPendingTranscript] = useState('')
  const [pendingConvId, setPendingConvId]         = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  const RECORDING_LIMIT_SEC = 1500 // 25 minutes

  // Load conversations on mount
  useEffect(() => {
    api.listConversations().then(d => setConversations(d.conversations)).catch(() => {})
  }, [])

  // ── Recording controls ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.start(1000) // collect chunks every second
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= RECORDING_LIMIT_SEC) {
            stopRecording()
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch (err: any) {
      setError(`Microphone access denied: ${err.message}. Check browser permissions.`)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)

    // Wait for final chunk then process
    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm'
      })
      await processRecording(audioBlob)
    }
  }, [recordingTitle, recordingSeconds])

  const processRecording = async (audioBlob: Blob) => {
    setLoading(true)
    setTranscribeStatus('Uploading audio…')
    try {
      const form = new FormData()
      form.append('audio', audioBlob, `recording.${audioBlob.type.includes('ogg') ? 'ogg' : 'webm'}`)
      form.append('title', recordingTitle || 'Recorded Conversation')
      form.append('duration_sec', String(recordingSeconds))

      const res  = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const { job_id, conversation_id } = data
      setTranscribeStatus('Transcribing with speaker detection…')
      setPendingConvId(conversation_id)

      // Poll AssemblyAI
      let result: any = null
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const poll = await fetch(`/api/transcribe?job_id=${job_id}`)
        const pollData = await poll.json()

        if (pollData.status === 'completed') { result = pollData; break }
        if (pollData.status === 'failed') throw new Error(pollData.error || 'Transcription failed')
        setTranscribeStatus(`Transcribing… (${pollData.status})`)
      }

      if (!result) throw new Error('Transcription timed out')

      setTranscribeStatus('Transcription complete — verify speakers')
      setPendingUtterances(result.utterances)
      setPendingSpeakerCount(result.speaker_count)
      setPendingTranscript(result.transcript)

    } catch (err: any) {
      setError(err.message || 'Recording processing failed')
      setTranscribeStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleSpeakerConfirm = async (nameMapping: Record<string, string>) => {
    if (!pendingTranscript) return
    setLoading(true)
    setTranscribeStatus('Analyzing conversation…')
    setPendingUtterances(null)

    // Apply name mapping to transcript
    let namedTranscript = pendingTranscript
    Object.entries(nameMapping).forEach(([original, name]) => {
      namedTranscript = namedTranscript.replaceAll(original + ':', name + ':')
    })

    const participants = Object.values(nameMapping).filter(Boolean)

    try {
      const result = await api.analyzeText({
        title: recordingTitle || 'Recorded Conversation',
        raw_text: namedTranscript,
        participants,
      })
      setTranscribeStatus('Analyzing…')
      await pollAnalysis(result.conversation_id, setTranscribeStatus)
      const data = await api.listConversations()
      setConversations(data.conversations)
      setIngestMode(null)
      setRecordingTitle('')
      setRecordingSeconds(0)
      setTranscribeStatus('')
      setPendingTranscript('')
      setPendingConvId(null)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
      setTranscribeStatus('')
    } finally {
      setLoading(false)
    }
  }

  // ── Text analysis ────────────────────────────────────────────────────────
  const handleTextAnalyze = async () => {
    if (!textContent.trim()) return
    setLoading(true); setError(''); setAnalysisStatus('Submitting…')
    try {
      const participants = textParticipants.split(',').map(s => s.trim()).filter(Boolean)
      const result = await api.analyzeText({
        title: textTitle || 'Untitled Conversation',
        raw_text: textContent,
        participants,
      })
      setAnalysisStatus('Analyzing…')
      await pollAnalysis(result.conversation_id, setAnalysisStatus)
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
    setLoading(true); setError(''); setAnalysisStatus('Uploading…')
    try {
      const upload = await api.uploadFile(file, type)
      setAnalysisStatus('Processing…')
      await pollAnalysis(upload.upload_id, setAnalysisStatus)
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
        subtitle="Ingest, record, and analyze communication threads."
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setIngestMode('text')}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
              + PASTE TEXT
            </button>
            <button onClick={() => { setIngestMode('record'); setError('') }}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.35)', boxShadow: ingestMode === 'record' ? '0 0 12px rgba(45,212,191,0.25)' : 'none' }}>
              🎙 RECORD
            </button>
            <button onClick={() => setIngestMode('screenshot')}
              className="px-3 py-1.5 rounded-lg text-[11px] tracking-[0.1em] font-medium transition-all"
              style={{ background: 'rgba(45,212,191,0.06)', color: '#5eead4', border: '1px solid rgba(45,212,191,0.2)' }}>
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

      {/* ── Record panel ───────────────────────────────────────────────── */}
      {ingestMode === 'record' && (
        <div className="mb-6 rounded-xl p-5 animate-fade-in"
          style={{ background: '#0e0c1a', border: '1px solid rgba(45,212,191,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Record Conversation</h3>
            <button onClick={() => { setIngestMode(null); if (isRecording) stopRecording() }}
              className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>

          {/* Title input */}
          {!isRecording && !loading && !pendingUtterances && (
            <input value={recordingTitle} onChange={e => setRecordingTitle(e.target.value)}
              placeholder="Conversation title (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-4"
              style={{ background: '#070510', border: '1px solid #1e1a2e', color: '#e2e8f0' }} />
          )}

          {/* Speaker verification */}
          {pendingUtterances && (
            <SpeakerVerify
              utterances={pendingUtterances}
              speakerCount={pendingSpeakerCount}
              onConfirm={handleSpeakerConfirm}
              onCancel={() => { setPendingUtterances(null); setTranscribeStatus(''); setLoading(false) }}
            />
          )}

          {/* Recording controls */}
          {!pendingUtterances && (
            <div className="flex flex-col items-center gap-5 py-4">
              {isRecording && <RecordingTimer seconds={recordingSeconds} limit={RECORDING_LIMIT_SEC} />}

              {(loading || transcribeStatus) && !isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                  <p className="text-xs" style={{ color: '#2dd4bf' }}>{transcribeStatus}</p>
                </div>
              )}

              {!loading && !isRecording && !transcribeStatus && (
                <p className="text-xs text-center max-w-xs" style={{ color: '#6b7280' }}>
                  Black Box will record the conversation, transcribe it with speaker detection, and ask you to verify who's who before running analysis.
                </p>
              )}

              {!loading && (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: isRecording ? 'rgba(248,113,113,0.15)' : 'rgba(45,212,191,0.12)',
                    border: isRecording ? '2px solid #f87171' : '2px solid #2dd4bf',
                    boxShadow: isRecording ? '0 0 24px rgba(248,113,113,0.4)' : '0 0 20px rgba(45,212,191,0.3)',
                  }}>
                  {isRecording
                    ? <div className="w-6 h-6 rounded-sm" style={{ background: '#f87171' }} />
                    : <div className="w-5 h-5 rounded-full" style={{ background: '#2dd4bf' }} />
                  }
                </button>
              )}

              <p className="text-[9px] tracking-[0.15em]" style={{ color: '#374151' }}>
                {isRecording ? 'TAP TO STOP' : loading ? '' : 'TAP TO START RECORDING'}
              </p>
            </div>
          )}

          {error && <p className="text-xs mt-3 text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}

      {/* ── Text paste panel ───────────────────────────────────────────── */}
      {ingestMode === 'text' && (
        <div className="mb-6 rounded-xl p-5"
          style={{ background: '#0e0c1a', border: '1px solid rgba(139,92,246,0.3)' }}>
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
                {loading ? analysisStatus || 'Analyzing…' : 'Analyze →'}
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          </div>
        </div>
      )}

      {/* ── Screenshot panel ───────────────────────────────────────────── */}
      {ingestMode === 'screenshot' && (
        <div className="mb-6 rounded-xl p-5"
          style={{ background: '#0e0c1a', border: '1px solid rgba(45,212,191,0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Upload Screenshot</h3>
            <button onClick={() => setIngestMode(null)} className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>
          <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-10"
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

      {/* ── File upload panel ──────────────────────────────────────────── */}
      {ingestMode === 'file' && (
        <div className="mb-6 rounded-xl p-5"
          style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Upload File</h3>
            <button onClick={() => setIngestMode(null)} className="text-xs" style={{ color: '#6b7280' }}>✕ Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-8"
              style={{ border: '1px dashed #1e1a2e', background: '#070510' }}>
              <span className="text-2xl mb-1">📄</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>PDF / Document</span>
              <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => handleFileUpload(e, 'pdf')} disabled={loading} />
            </label>
            <label className="flex flex-col items-center justify-center rounded-lg cursor-pointer py-8"
              style={{ border: '1px dashed #1e1a2e', background: '#070510' }}>
              <span className="text-2xl mb-1">🎵</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>Pre-recorded Audio</span>
              <input type="file" accept="audio/*" className="hidden"
                onChange={e => handleFileUpload(e, 'audio')} disabled={loading} />
            </label>
          </div>
          {loading && <p className="text-xs mt-3 text-center" style={{ color: '#8b5cf6' }}>{analysisStatus}</p>}
          {error && <p className="text-xs mt-2 text-center" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}

      {/* ── Conversation list ──────────────────────────────────────────── */}
      {conversations.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: '#0e0c1a', border: '1px solid #1e1a2e' }}>
          <div className="text-4xl mb-3">💬</div>
          <h3 className="text-sm font-medium text-white mb-1">No conversations yet</h3>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            Record a live conversation, paste a text thread, or upload a screenshot to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => (
            <div key={c.id} onClick={() => setSelected(c)}
              className="rounded-xl p-4 cursor-pointer transition-all hover:border-purple-500/30"
              style={{ background: '#0e0c1a', border: selected?.id === c.id ? '1px solid #8b5cf6' : '1px solid #1e1a2e' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#6b7280' }}>
                    {c.source_type === 'audio' ? '🎙' : c.source_type === 'screenshot' ? '🖼' : c.source_type === 'text_paste' ? '📝' : '📄'}
                  </span>
                  <span className="text-sm font-medium text-white">{c.title}</span>
                </div>
                {c.analysis && <OutcomeBadge outcome={c.analysis.outcome} />}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px]" style={{ color: '#6b7280' }}>{c.source_type.replace('_', ' ').toUpperCase()}</span>
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

      {/* ── Selected conversation detail ───────────────────────────────── */}
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
