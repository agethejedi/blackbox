// POST /api/search — semantic search across conversation history

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.DB) return json({ error: "DB not configured" }, 503)
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }
  const { query, filters = {} } = body
  if (!query) return json({ error: "query required" }, 400)

  // Get all conversations with analysis for semantic matching
  const result = await env.DB.prepare(
    "SELECT c.id, c.title, c.created_at, c.raw_text, a.outcome, a.topics, a.themes, a.quality_score FROM conversations c LEFT JOIN analysis_runs a ON c.id = a.conversation_id WHERE c.status = 'complete' ORDER BY c.created_at DESC LIMIT 20"
  ).all()

  const conversations = result.results || []
  if (!conversations.length) return json({ results: [] })

  // Use GPT-4.5 to find relevant conversations
  const summaries = conversations.map((c, i) =>
    `[${i}] ID: ${c.id}\nTitle: ${c.title}\nTopics: ${c.topics || "[]"}\nThemes: ${c.themes || "[]"}\nOutcome: ${c.outcome || "unknown"}\nExcerpt: ${(c.raw_text || "").slice(0, 200)}`
  ).join("\n\n---\n\n")

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.5-preview",
      input: `Given this search query: "${query}"\n\nFind the most relevant conversations from this list and return a JSON array of results:\n[{"index": <number>, "relevance": <0-1>, "excerpt": "<why this matches>"}]\n\nConversations:\n${summaries}\n\nReturn ONLY the JSON array, no other text.`,
    }),
  })

  const data = await res.json()
  const text = data.output?.[0]?.content?.[0]?.text || "[]"

  let matches = []
  try { matches = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) }
  catch { matches = [] }

  const results = matches
    .filter(m => m.relevance > 0.3)
    .sort((a, b) => b.relevance - a.relevance)
    .map(m => {
      const c = conversations[m.index]
      if (!c) return null
      return {
        conversation_id: c.id,
        title: c.title,
        excerpt: m.excerpt,
        relevance: m.relevance,
        date: c.created_at?.slice(0, 10) || "",
        outcome: c.outcome || "unresolved",
        topics: JSON.parse(c.topics || "[]"),
      }
    })
    .filter(Boolean)

  return json({ results })
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
