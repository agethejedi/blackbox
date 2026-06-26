// POST /api/transcribe — upload audio to R2 then transcribe with AssemblyAI diarization
// GET  /api/transcribe?job_id=xxx — poll transcription status

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "Content-Type": "application/json", ...CORS }
})

// ── Upload audio to R2, then submit to AssemblyAI ──────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context

  if (!env.ASSEMBLYAI_API_KEY) return json({ error: "ASSEMBLYAI_API_KEY not configured" }, 503)
  if (!env.BLACKBOX_AUDIO)     return json({ error: "BLACKBOX_AUDIO R2 bucket not configured" }, 503)
  if (!env.DB)                 return json({ error: "DB not configured" }, 503)

  const formData = await request.formData()
  const audioFile = formData.get("audio")
  const title     = formData.get("title") || "Recorded Conversation"
  const durationSec = parseInt(formData.get("duration_sec") || "0", 10)

  if (!audioFile) return json({ error: "audio file required" }, 400)

  // 1. Store in R2
  const fileId  = crypto.randomUUID()
  const ext     = audioFile.type.includes("ogg") ? "ogg"
                : audioFile.type.includes("mp4") ? "mp4"
                : audioFile.type.includes("wav") ? "wav"
                : "webm"
  const r2Key   = `recordings/${fileId}.${ext}`

  await env.BLACKBOX_AUDIO.put(r2Key, audioFile.stream(), {
    httpMetadata: { contentType: audioFile.type },
  })

  // 2. Generate a temporary public URL for AssemblyAI to fetch
  // We use AssemblyAI's upload endpoint to avoid needing a public R2 URL
  const audioBuffer = await audioFile.arrayBuffer()
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      "authorization": env.ASSEMBLYAI_API_KEY,
      "content-type": "application/octet-stream",
    },
    body: audioBuffer,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return json({ error: "AssemblyAI upload failed", detail: err }, 502)
  }

  const { upload_url } = await uploadRes.json()

  // 3. Submit transcription job with speaker diarization
  const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      "authorization": env.ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,        // Full diarization — who said what
      speakers_expected: 2,        // Optimise for 2-person conversations; adjustable
      punctuate: true,
      format_text: true,
    }),
  })

  if (!transcriptRes.ok) {
    const err = await transcriptRes.text()
    return json({ error: "AssemblyAI transcription submit failed", detail: err }, 502)
  }

  const { id: jobId } = await transcriptRes.json()

  // 4. Create a pending conversation record in D1
  const convId = crypto.randomUUID()
  const now    = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO conversations
     (id, title, source_type, uploaded_by, created_at, attachment_key, status)
     VALUES (?, ?, 'audio', 'user', ?, ?, 'processing')`
  ).bind(convId, title, now, r2Key).run()

  // Store the AssemblyAI job ID in KV for polling
  if (env.BLACKBOX_KV) {
    await env.BLACKBOX_KV.put(
      `transcribe:${jobId}`,
      JSON.stringify({ convId, title, r2Key, durationSec }),
      { expirationTtl: 3600 } // 1 hour TTL
    )
  }

  return json({ ok: true, job_id: jobId, conversation_id: convId, status: "processing" })
}

// ── Poll transcription status ──────────────────────────────────────────────
export async function onRequestGet(context) {
  const { request, env } = context
  if (!env.ASSEMBLYAI_API_KEY) return json({ error: "ASSEMBLYAI_API_KEY not configured" }, 503)

  const url   = new URL(request.url)
  const jobId = url.searchParams.get("job_id")
  if (!jobId) return json({ error: "job_id required" }, 400)

  const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
    headers: { "authorization": env.ASSEMBLYAI_API_KEY },
  })

  if (!pollRes.ok) return json({ error: "AssemblyAI poll failed" }, 502)

  const transcript = await pollRes.json()

  if (transcript.status === "error") {
    return json({ status: "failed", error: transcript.error })
  }

  if (transcript.status !== "completed") {
    return json({ status: transcript.status }) // queued | processing
  }

  // Completed — format utterances with speaker labels
  const utterances = (transcript.utterances || []).map(u => ({
    speaker: `Speaker ${u.speaker}`,
    text: u.text,
    start_ms: u.start,
    end_ms: u.end,
    confidence: u.confidence,
  }))

  // Build a readable transcript for display and analysis
  const formattedTranscript = utterances
    .map(u => `${u.speaker}: ${u.text}`)
    .join("\n")

  // Look up conversation ID from KV
  let convId = null
  if (env.BLACKBOX_KV) {
    const stored = await env.BLACKBOX_KV.get(`transcribe:${jobId}`, "json")
    convId = stored?.convId || null

    // Update conversation with transcript
    if (convId && env.DB) {
      await env.DB.prepare(
        "UPDATE conversations SET raw_text = ?, status = 'transcribed' WHERE id = ?"
      ).bind(formattedTranscript, convId).run()
    }
  }

  return json({
    status: "completed",
    conversation_id: convId,
    transcript: formattedTranscript,
    utterances,
    speaker_count: new Set(utterances.map(u => u.speaker)).size,
    word_count: transcript.words?.length || 0,
    audio_duration_ms: transcript.audio_duration,
  })
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
