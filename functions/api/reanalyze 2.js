// POST /api/reanalyze — re-run analysis on an existing conversation, versioned
// Handles conversations with no raw_text by re-extracting from R2

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

async function extractTextFromScreenshot(env, attachmentKey, openaiKey) {
  const bucket = env.BLACKBOX_UPLOADS
  if (!bucket) throw new Error("BLACKBOX_UPLOADS R2 bucket not configured")
  const obj = await bucket.get(attachmentKey)
  if (!obj) throw new Error("File not found in R2: " + attachmentKey)
  const arrayBuffer = await obj.arrayBuffer()

  // Chunked base64 encoding — avoids call stack overflow on large images
  // btoa(String.fromCharCode(...largeArray)) fails on images > ~1MB
  const bytes = new Uint8Array(arrayBuffer)
  let base64 = ""
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    base64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  base64 = btoa(base64)
  const mimeType = obj.httpMetadata?.contentType || "image/jpeg"
  const safeMime = (mimeType === "image/heic" || mimeType === "image/heif") ? "image/jpeg" : mimeType
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": "Bearer " + openaiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      input: [{
        type: "message", role: "user",
        content: [
          { type: "input_image", image_url: { url: "data:" + safeMime + ";base64," + base64 } },
          { type: "input_text", text: "Extract the conversation text from this screenshot. Format each message as 'Speaker: message text'. If you cannot identify speakers, use 'Person A' and 'Person B'. Return only the conversation text, no other commentary." }
        ]
      }]
    })
  })
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) throw new Error("OpenAI returned non-JSON response (" + res.status + ")")
  const data = await res.json()
  const text = data.output?.[0]?.content?.[0]?.text || ""
  if (!text) throw new Error("OpenAI vision returned empty text")
  return text
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

  const { conversation_id } = body
  if (!conversation_id) return json({ error: "conversation_id required" }, 400)

  try {
    const conv = await env.DB.prepare(
      "SELECT * FROM conversations WHERE id = ?"
    ).bind(conversation_id).first()
    if (!conv) return json({ error: "Conversation not found" }, 404)

    let rawText = conv.raw_text || ""

    // No raw_text — attempt recovery based on source type
    if (!rawText) {
      if (conv.source_type === "screenshot" && conv.attachment_key) {
        try {
          rawText = await extractTextFromScreenshot(env, conv.attachment_key, env.OPENAI_API_KEY)
          await env.DB.prepare("UPDATE conversations SET raw_text = ?, status = 'transcribed' WHERE id = ?")
            .bind(rawText, conversation_id).run()
        } catch (err) {
          return json({
            error: "Could not extract text from screenshot",
            detail: String(err),
            suggestion: "Try re-uploading the screenshot through the + SCREENSHOT button."
          }, 422)
        }
      } else if (conv.source_type === "audio") {
        return json({
          error: "Audio transcript not available.",
          suggestion: "Re-record this conversation through the RECORD button to generate a fresh transcript."
        }, 400)
      } else {
        return json({
          error: "No content available to analyze.",
          detail: "source_type: " + conv.source_type + ", attachment_key: " + (conv.attachment_key || "none"),
          suggestion: "Re-upload the original file to regenerate content."
        }, 400)
      }
    }

    if (!rawText) return json({ error: "Text extraction returned empty content." }, 422)

    // Run GPT-4.5 analysis
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.5-preview",
        input: ANALYSIS_PROMPT + "\n\nConversation to analyze:\n" + rawText
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

    await env.DB.prepare(
      "UPDATE conversations SET analysis_id = ?, status = 'complete', updated_at = ? WHERE id = ?"
    ).bind(analysisId, now, conversation_id).run()

    return json({
      ok: true,
      analysis_id: analysisId,
      conversation_id,
      extracted_text: !conv.raw_text,
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
