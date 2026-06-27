// /api/collections — CRUD for conversation collections
// GET    /api/collections              — list all collections with member counts
// GET    /api/collections?id=xxx       — get one collection with members + latest analysis
// POST   /api/collections              — create collection { name, description }
// POST   /api/collections?action=add  — add conversation to collection { collection_id, conversation_id }
// POST   /api/collections?action=remove — remove conversation { collection_id, conversation_id }
// DELETE /api/collections?id=xxx       — delete collection

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), {
  status: s, headers: { "Content-Type": "application/json", ...CORS }
})

const COLLECTION_ANALYSIS_PROMPT = `You are Black Box, analyzing a collection of related conversations as a unified relationship pattern.

You will receive multiple conversations from different sources (text, audio, screenshots) that are part of the same ongoing relationship situation.

Analyze them together and return ONLY a valid JSON object:
{
  "quality_score_avg": <0-100, weighted average>,
  "escalation_score_avg": <0-100>,
  "validation_score_avg": <0-100>,
  "collaboration_score_avg": <0-100>,
  "topic_drift_score_avg": <0-100>,
  "resolution_probability_avg": <0.0-1.0>,
  "escalation_trend": "<improving|worsening|stable|fluctuating>",
  "dominant_outcome": "<resolved|unresolved|escalated|deferred>",
  "recurring_themes": ["<theme1>", "<theme2>"],
  "recurring_topics": ["<topic1>", "<topic2>"],
  "horsemen_aggregate": {
    "criticism": <0-100>, "defensiveness": <0-100>,
    "contempt": <0-100>, "stonewalling": <0-100>,
    "trend": "<rising|falling|stable>"
  },
  "repair_aggregate": {
    "total_repair_attempts": <number>,
    "successful_repairs": <number>,
    "resilience_score": <0-100>
  },
  "coaching_recommendations": [
    "<cross-conversation recommendation 1>",
    "<cross-conversation recommendation 2>",
    "<cross-conversation recommendation 3>"
  ],
  "pattern_summary": "<2-3 sentence summary of the overall communication pattern across all conversations>"
}

Focus on cross-conversation patterns — things that repeat, escalate, or improve across multiple interactions.
Do NOT determine who is right. Identify patterns only.`

async function runCollectionAnalysis(env, collectionId, conversations, version) {
  try {
    // Build combined transcript for GPT-4.5
    const combined = conversations.map((c, i) => {
      const date = c.created_at?.slice(0, 10) || `Conversation ${i + 1}`
      const type = c.source_type?.replace('_', ' ') || 'text'
      return `--- CONVERSATION ${i + 1} [${date}] [${type}] ---\n${c.raw_text || '[No transcript available]'}`
    }).join('\n\n')

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.5-preview",
        input: `${COLLECTION_ANALYSIS_PROMPT}\n\nCollection of ${conversations.length} conversations:\n\n${combined}`
      })
    })

    const data = await res.json()
    const text = data.output?.[0]?.content?.[0]?.text || "{}"
    let analysis = {}
    try { analysis = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) } catch {}

    const analysisId = crypto.randomUUID()
    const now = new Date().toISOString()
    const dates = conversations.map(c => c.created_at).filter(Boolean).sort()

    await env.DB.prepare(`
      INSERT INTO collection_analysis_runs (
        id, collection_id, version,
        quality_score_avg, escalation_score_avg, validation_score_avg,
        collaboration_score_avg, topic_drift_score_avg, resolution_probability_avg,
        escalation_trend, dominant_outcome, recurring_themes, recurring_topics,
        horsemen_aggregate, repair_aggregate, coaching_recommendations,
        conversation_count, date_range_start, date_range_end, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete')
    `).bind(
      analysisId, collectionId, version,
      analysis.quality_score_avg || 0,
      analysis.escalation_score_avg || 0,
      analysis.validation_score_avg || 0,
      analysis.collaboration_score_avg || 0,
      analysis.topic_drift_score_avg || 0,
      analysis.resolution_probability_avg || 0,
      analysis.escalation_trend || 'stable',
      analysis.dominant_outcome || 'unresolved',
      JSON.stringify(analysis.recurring_themes || []),
      JSON.stringify(analysis.recurring_topics || []),
      JSON.stringify(analysis.horsemen_aggregate || {}),
      JSON.stringify(analysis.repair_aggregate || {}),
      JSON.stringify(analysis.coaching_recommendations || []),
      conversations.length,
      dates[0] || now,
      dates[dates.length - 1] || now,
      now
    ).run()

    // Update collection updated_at
    await env.DB.prepare("UPDATE collections SET updated_at = ? WHERE id = ?")
      .bind(now, collectionId).run()

    return { ok: true, analysis_id: analysisId, version }
  } catch (err) {
    console.error("Collection analysis error:", String(err))
    return { ok: false, error: String(err) }
  }
}

export async function onRequestGet(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  const url = new URL(request.url)
  const id  = url.searchParams.get("id")

  try {
    if (id) {
      // Single collection with members and latest analysis
      const collection = await env.DB.prepare(
        "SELECT * FROM collections WHERE id = ?"
      ).bind(id).first()
      if (!collection) return json({ error: "Not found" }, 404)

      const [members, analysis] = await Promise.all([
        env.DB.prepare(`
          SELECT cm.*, c.title, c.source_type, c.created_at, c.status,
                 ar.quality_score, ar.outcome
          FROM collection_members cm
          JOIN conversations c ON cm.conversation_id = c.id
          LEFT JOIN analysis_runs ar ON c.id = ar.conversation_id
          WHERE cm.collection_id = ?
          ORDER BY c.created_at ASC
        `).bind(id).all(),
        env.DB.prepare(`
          SELECT * FROM collection_analysis_runs
          WHERE collection_id = ?
          ORDER BY version DESC LIMIT 1
        `).bind(id).first().catch(() => null)
      ])

      return json({
        collection: {
          ...collection,
          members: members.results || [],
          analysis: analysis ? {
            ...analysis,
            recurring_themes: JSON.parse(analysis.recurring_themes || "[]"),
            recurring_topics: JSON.parse(analysis.recurring_topics || "[]"),
            horsemen_aggregate: JSON.parse(analysis.horsemen_aggregate || "{}"),
            repair_aggregate: JSON.parse(analysis.repair_aggregate || "{}"),
            coaching_recommendations: JSON.parse(analysis.coaching_recommendations || "[]"),
          } : null
        }
      })
    }

    // List all collections with member counts and latest scores
    let result
    try {
      result = await env.DB.prepare(`
        SELECT c.*,
          COUNT(cm.id) as member_count,
          car.quality_score_avg,
          car.escalation_trend,
          car.dominant_outcome,
          car.version as analysis_version
        FROM collections c
        LEFT JOIN collection_members cm ON c.id = cm.collection_id
        LEFT JOIN collection_analysis_runs car ON c.id = car.collection_id
          AND car.version = (
            SELECT MAX(version) FROM collection_analysis_runs WHERE collection_id = c.id
          )
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `).all()
    } catch (err) {
      // collection_analysis_runs table may not exist yet — fall back to simpler query
      result = await env.DB.prepare(`
        SELECT c.*, COUNT(cm.id) as member_count
        FROM collections c
        LEFT JOIN collection_members cm ON c.id = cm.collection_id
        GROUP BY c.id
        ORDER BY c.updated_at DESC
      `).all()
    }

    return json({ collections: result.results || [] })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

  const url    = new URL(request.url)
  const action = url.searchParams.get("action")

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

  try {
    // ── Add conversation to collection ──────────────────────────────────────
    if (action === "add") {
      const { collection_id, conversation_id } = body
      if (!collection_id || !conversation_id) {
        return json({ error: "collection_id and conversation_id required" }, 400)
      }

      // Check conversation not already in a collection
      const existing = await env.DB.prepare(
        "SELECT collection_id FROM collection_members WHERE conversation_id = ?"
      ).bind(conversation_id).first()

      if (existing) {
        if (existing.collection_id === collection_id) {
          return json({ error: "Conversation already in this collection" }, 409)
        }
        return json({
          error: "Conversation already belongs to another collection",
          current_collection: existing.collection_id
        }, 409)
      }

      // Add member
      const memberId = crypto.randomUUID()
      await env.DB.prepare(
        "INSERT INTO collection_members (id, collection_id, conversation_id) VALUES (?, ?, ?)"
      ).bind(memberId, collection_id, conversation_id).run()

      // Get version for new analysis
      const latestAnalysis = await env.DB.prepare(
        "SELECT MAX(version) as max_version FROM collection_analysis_runs WHERE collection_id = ?"
      ).bind(collection_id).first()
      const nextVersion = (latestAnalysis?.max_version || 0) + 1

      // Fetch all conversations in collection for analysis
      const members = await env.DB.prepare(`
        SELECT c.raw_text, c.source_type, c.created_at
        FROM collection_members cm
        JOIN conversations c ON cm.conversation_id = c.id
        WHERE cm.collection_id = ? AND c.raw_text IS NOT NULL
      `).bind(collection_id).all()

      const conversations = members.results || []

      // Trigger collection analysis automatically
      if (conversations.length > 0) {
        context.waitUntil(runCollectionAnalysis(env, collection_id, conversations, nextVersion))
      }

      return json({ ok: true, member_id: memberId, analysis_triggered: conversations.length > 0 })
    }

    // ── Remove conversation from collection ─────────────────────────────────
    if (action === "remove") {
      const { collection_id, conversation_id } = body
      if (!collection_id || !conversation_id) {
        return json({ error: "collection_id and conversation_id required" }, 400)
      }

      await env.DB.prepare(
        "DELETE FROM collection_members WHERE collection_id = ? AND conversation_id = ?"
      ).bind(collection_id, conversation_id).run()

      // Re-analyze remaining conversations
      const members = await env.DB.prepare(`
        SELECT c.raw_text, c.source_type, c.created_at
        FROM collection_members cm
        JOIN conversations c ON cm.conversation_id = c.id
        WHERE cm.collection_id = ? AND c.raw_text IS NOT NULL
      `).bind(collection_id).all()

      const conversations = members.results || []
      if (conversations.length > 0) {
        const latestAnalysis = await env.DB.prepare(
          "SELECT MAX(version) as max_version FROM collection_analysis_runs WHERE collection_id = ?"
        ).bind(collection_id).first()
        const nextVersion = (latestAnalysis?.max_version || 0) + 1
        context.waitUntil(runCollectionAnalysis(env, collection_id, conversations, nextVersion))
      }

      return json({ ok: true })
    }

    // ── Create collection ────────────────────────────────────────────────────
    const { name, description } = body
    if (!name) return json({ error: "name required" }, 400)

    const id  = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.prepare(
      "INSERT INTO collections (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, name, description || null, now, now).run()

    return json({ ok: true, id, name })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  const url = new URL(request.url)
  const id  = url.searchParams.get("id")
  if (!id) return json({ error: "id required" }, 400)

  try {
    await env.DB.prepare("DELETE FROM collection_members WHERE collection_id = ?").bind(id).run()
    await env.DB.prepare("DELETE FROM collection_analysis_runs WHERE collection_id = ?").bind(id).run()
    await env.DB.prepare("DELETE FROM collections WHERE id = ?").bind(id).run()
    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
