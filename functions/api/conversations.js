// GET  /api/conversations      — list all conversations
// GET  /api/conversations/:id  — get one with full analysis
// DELETE /api/conversations/:id

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

export async function onRequestGet(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  const url = new URL(request.url)
  const parts = url.pathname.split("/").filter(Boolean)
  const convId = parts.length > 2 ? parts[parts.length - 1] : null

  if (convId) {
    const conv = await env.DB.prepare("SELECT * FROM conversations WHERE id = ?").bind(convId).first()
    if (!conv) return json({ error: "Not found" }, 404)

    const [messages, analysis, participants] = await Promise.all([
      env.DB.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence").bind(convId).all(),
      env.DB.prepare("SELECT * FROM analysis_runs WHERE conversation_id = ? LIMIT 1").bind(convId).first(),
      env.DB.prepare("SELECT * FROM participants WHERE conversation_id = ?").bind(convId).all(),
    ])

    return json({
      conversation: {
        ...conv,
        messages: messages.results || [],
        participants: participants.results || [],
        analysis: analysis ? {
          ...analysis,
          topics: JSON.parse(analysis.topics || "[]"),
          themes: JSON.parse(analysis.themes || "[]"),
          coaching_recommendations: JSON.parse(analysis.coaching_recommendations || "[]"),
          horsemen: JSON.parse(analysis.horsemen_data || "{}"),
          repair: JSON.parse(analysis.repair_data || "{}"),
        } : null,
      }
    })
  }

  // List all
  const result = await env.DB.prepare(
    "SELECT c.*, a.quality_score, a.outcome FROM conversations c LEFT JOIN analysis_runs a ON c.id = a.conversation_id ORDER BY c.created_at DESC LIMIT 50"
  ).all()

  return json({ conversations: result.results || [] })
}

export async function onRequestDelete(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)

  const url = new URL(request.url)
  const parts = url.pathname.split("/").filter(Boolean)
  const convId = parts[parts.length - 1]

  await Promise.all([
    env.DB.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(convId).run(),
    env.DB.prepare("DELETE FROM analysis_runs WHERE conversation_id = ?").bind(convId).run(),
    env.DB.prepare("DELETE FROM participants WHERE conversation_id = ?").bind(convId).run(),
    env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(convId).run(),
  ])

  return json({ ok: true })
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
