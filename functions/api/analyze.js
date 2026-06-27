// POST /api/analyze — ingest text and run GPT-4.5 analysis
// GET  /api/analyze/:id — check analysis status

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

const ANALYSIS_PROMPT = `You are Black Box, a relationship communication intelligence system.
Analyze the following conversation and return ONLY a valid JSON object with this exact structure:
{
  "quality_score": <0-100>,
  "escalation_score": <0-100>,
  "validation_score": <0-100>,
  "collaboration_score": <0-100>,
  "topic_drift_score": <0-100>,
  "resolution_probability": <0.0-1.0>,
  "outcome": "<resolved|unresolved|escalated|deferred>",
  "topics": ["<topic1>", "<topic2>"],
  "themes": ["<theme1>", "<theme2>"],
  "coaching_recommendations": ["<recommendation1>", "<recommendation2>", "<recommendation3>"],
  "horsemen": {
    "criticism": <0-100>,
    "defensiveness": <0-100>,
    "contempt": <0-100>,
    "stonewalling": <0-100>,
    "overall": <0-100>,
    "trend": "<rising|falling|stable>",
    "speaker_breakdown": {},
    "examples": []
  },
  "repair": {
    "validation_attempts": <number>,
    "accountability_attempts": <number>,
    "compromise_attempts": <number>,
    "appreciation_attempts": <number>,
    "successful_repairs": <number>,
    "failed_repairs": <number>,
    "recovery_time_minutes": <number>,
    "resilience_score": <0-100>
  }
}

Guidelines:
- quality_score: overall communication health (100=excellent, 0=severely dysfunctional)
- escalation_score: how much tension increased through the conversation (higher = worse)
- validation_score: how well each party acknowledged the other's feelings
- collaboration_score: how much they worked toward resolution together
- topic_drift_score: how much the conversation strayed from the core issue
- resolution_probability: likelihood this type of conversation leads to resolution (0-1)
- Do NOT determine who is right. Identify patterns only.
- Coaching recommendations should be specific and actionable.`;

async function normalizeConversation(rawText, participants, openaiKey) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      input: `Normalize this conversation into a JSON array of messages. Each message: {"speaker": "name", "content": "text", "sequence": number}. Known participants: ${participants.join(", ")}. If speakers are unclear, label them "Person A" and "Person B". Return ONLY the JSON array.\n\nConversation:\n${rawText}`,
    }),
  })
  const data = await res.json()
  const text = data.output?.[0]?.content?.[0]?.text || "[]"
  try { return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) }
  catch { return [] }
}

async function analyzeConversation(rawText, openaiKey) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      input: `${ANALYSIS_PROMPT}\n\nConversation to analyze:\n${rawText}`,
    }),
  })
  const data = await res.json()
  const text = data.output?.[0]?.content?.[0]?.text || "{}"
  try { return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) }
  catch { return null }
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

  const { type, title, raw_text, participants = [] } = body
  if (!raw_text) return json({ error: "raw_text required" }, 400)

  // Create conversation record
  const convId = crypto.randomUUID()
  const now = new Date().toISOString()
  await env.DB.prepare(
    "INSERT INTO conversations (id, title, source_type, uploaded_by, created_at, raw_text, status) VALUES (?, ?, ?, ?, ?, ?, 'processing')"
  ).bind(convId, title || "Untitled", type || "text_paste", "user", now, raw_text).run()

  // Store participants
  const colors = ["#8b5cf6", "#2dd4bf", "#f472b6", "#fb923c", "#60a5fa"]
  for (let i = 0; i < participants.length; i++) {
    const pid = crypto.randomUUID()
    await env.DB.prepare(
      "INSERT INTO participants (id, conversation_id, name, label, color) VALUES (?, ?, ?, ?, ?)"
    ).bind(pid, convId, participants[i], `P${i+1}`, colors[i % colors.length]).run()
  }

  // Run analysis (async in background via waitUntil)
  const runAnalysis = async () => {
    try {
      const [messages, analysis] = await Promise.all([
        normalizeConversation(raw_text, participants, env.OPENAI_API_KEY),
        analyzeConversation(raw_text, env.OPENAI_API_KEY),
      ])

      if (!analysis) throw new Error("Analysis returned null")

      // Store messages
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        await env.DB.prepare(
          "INSERT INTO messages (id, conversation_id, speaker_label, content, sequence) VALUES (?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), convId, m.speaker || "Unknown", m.content || "", i).run()
      }

      // Store analysis
      const analysisId = crypto.randomUUID()
      await env.DB.prepare(`
        INSERT INTO analysis_runs (
          id, conversation_id, quality_score, escalation_score, validation_score,
          collaboration_score, topic_drift_score, resolution_probability,
          outcome, topics, themes, coaching_recommendations,
          horsemen_data, repair_data, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?)
      `).bind(
        analysisId, convId,
        analysis.quality_score || 0, analysis.escalation_score || 0,
        analysis.validation_score || 0, analysis.collaboration_score || 0,
        analysis.topic_drift_score || 0, analysis.resolution_probability || 0,
        analysis.outcome || "unresolved",
        JSON.stringify(analysis.topics || []),
        JSON.stringify(analysis.themes || []),
        JSON.stringify(analysis.coaching_recommendations || []),
        JSON.stringify(analysis.horsemen || {}),
        JSON.stringify(analysis.repair || {}),
        now
      ).run()

      await env.DB.prepare("UPDATE conversations SET status = 'complete', analysis_id = ? WHERE id = ?")
        .bind(analysisId, convId).run()

    } catch (err) {
      console.error("Analysis error:", String(err))
      await env.DB.prepare("UPDATE conversations SET status = 'failed' WHERE id = ?").bind(convId).run()
    }
  }

  context.waitUntil(runAnalysis())

  return json({ conversation_id: convId, status: "processing" })
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)

  // Accept both ?id=uuid (preferred) and path segment /analyze/uuid (legacy)
  const convId = url.searchParams.get("id") ||
    (() => { const parts = url.pathname.split("/").filter(Boolean); const last = parts[parts.length - 1]; return last !== "analyze" ? last : null })()

  if (!convId) return json({ error: "conversation_id required" }, 400)
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  try {
    const conv = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(convId).first()
    if (!conv) return json({ error: "Not found" }, 404)

    if (conv.status !== "complete") return json({ status: conv.status || "processing" })

    const analysis = await env.DB.prepare("SELECT * FROM analysis_runs WHERE conversation_id = ?").bind(convId).first()
    if (!analysis) return json({ status: "processing" })

    return json({
      status: "complete",
      analysis: {
        id: analysis.id,
        conversation_id: convId,
        quality_score: analysis.quality_score,
        escalation_score: analysis.escalation_score,
        validation_score: analysis.validation_score,
        collaboration_score: analysis.collaboration_score,
        topic_drift_score: analysis.topic_drift_score,
        resolution_probability: analysis.resolution_probability,
        outcome: analysis.outcome,
        topics: JSON.parse(analysis.topics || "[]"),
        themes: JSON.parse(analysis.themes || "[]"),
        coaching_recommendations: JSON.parse(analysis.coaching_recommendations || "[]"),
        horsemen: JSON.parse(analysis.horsemen_data || "{}"),
        repair: JSON.parse(analysis.repair_data || "{}"),
        created_at: analysis.created_at,
        status: "complete",
      }
    })
  } catch (err) {
    return json({ error: "Poll failed", detail: String(err) }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
