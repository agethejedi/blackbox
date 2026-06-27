// POST /api/reanalyze — re-run analysis on an existing conversation, versioned

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "Content-Type": "application/json", ...CORS }
})

const ANALYSIS_PROMPT = `You are Black Box, a relationship communication intelligence system.
Analyze the following conversation and return ONLY a valid JSON object:
{
  "quality_score": <0-100>,
  "escalation_score": <0-100>,
  "validation_score": <0-100>,
  "collaboration_score": <0-100>,
  "topic_drift_score": <0-100>,
  "resolution_probability": <0.0-1.0>,
  "outcome": "<resolved|unresolved|escalated|deferred>",
  "topics": ["<topic1>"],
  "themes": ["<theme1>"],
  "coaching_recommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "horsemen": {
    "criticism": <0-100>, "defensiveness": <0-100>,
    "contempt": <0-100>, "stonewalling": <0-100>,
    "overall": <0-100>, "trend": "<rising|falling|stable>",
    "speaker_breakdown": {}, "examples": []
  },
  "repair": {
    "validation_attempts": <number>, "accountability_attempts": <number>,
    "compromise_attempts": <number>, "appreciation_attempts": <number>,
    "successful_repairs": <number>, "failed_repairs": <number>,
    "recovery_time_minutes": <number>, "resilience_score": <0-100>
  }
}
Do NOT determine who is right. Identify patterns only.`

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

  const { conversation_id } = body
  if (!conversation_id) return json({ error: "conversation_id required" }, 400)

  try {
    // Fetch conversation
    const conv = await env.DB.prepare(
      "SELECT * FROM conversations WHERE id = ?"
    ).bind(conversation_id).first()
    if (!conv) return json({ error: "Conversation not found" }, 404)

    if (!conv.raw_text) {
      return json({ error: "No transcript available for this conversation. Complete transcription first." }, 400)
    }

    // Get current version count
    const latest = await env.DB.prepare(
      "SELECT MAX(version) as max_version FROM analysis_runs WHERE conversation_id = ?"
    ).bind(conversation_id).first()

    // analysis_runs may not have version column yet — handle gracefully
    let nextVersion = 2
    try {
      nextVersion = (latest?.max_version || 1) + 1
    } catch {}

    // Run analysis with GPT-4.5
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.5-preview",
        input: `${ANALYSIS_PROMPT}\n\nConversation to analyze:\n${conv.raw_text}`
      })
    })

    const data = await res.json()
    const text = data.output?.[0]?.content?.[0]?.text || "{}"
    let analysis = {}
    try { analysis = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) } catch {}

    const analysisId = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO analysis_runs (
        id, conversation_id, quality_score, escalation_score, validation_score,
        collaboration_score, topic_drift_score, resolution_probability,
        outcome, topics, themes, coaching_recommendations,
        horsemen_data, repair_data, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?)
    `).bind(
      analysisId, conversation_id,
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

    // Update conversation to point to latest analysis
    await env.DB.prepare(
      "UPDATE conversations SET analysis_id = ?, status = 'complete', updated_at = ? WHERE id = ?"
    ).bind(analysisId, now, conversation_id).run()

    return json({
      ok: true,
      analysis_id: analysisId,
      version: nextVersion,
      conversation_id,
      analysis: {
        id: analysisId,
        quality_score: analysis.quality_score || 0,
        escalation_score: analysis.escalation_score || 0,
        outcome: analysis.outcome || "unresolved",
        coaching_recommendations: analysis.coaching_recommendations || [],
      }
    })
  } catch (err) {
    return json({ error: "Re-analysis failed", detail: String(err) }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
