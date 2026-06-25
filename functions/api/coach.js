// POST /api/coach — analyze a draft response

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

const COACH_PROMPT = `You are Black Box Coach — an expert communication coach.
Analyze the draft message and return ONLY a valid JSON object:
{
  "risk_score": <0-100>,
  "risk_level": "<low|medium|high>",
  "concerns": ["<concern1>", "<concern2>"],
  "tone_analysis": "<brief tone description>",
  "validation_gaps": ["<gap1>"],
  "defensive_language": ["<phrase1>"],
  "accusations": ["<phrase1>"],
  "topic_drift_risk": <0-100>,
  "suggested_rewrite": "<improved version of the message>",
  "what_they_may_hear": "<how the recipient might interpret this>",
  "what_to_avoid": ["<thing1>", "<thing2>"],
  "suggested_next_action": "<specific actionable recommendation>"
}

Guidelines:
- risk_score: 0=very safe, 100=highly likely to escalate
- Do NOT determine who is right
- suggested_rewrite should preserve the core intent but improve delivery
- Be specific about what_they_may_hear — this is the most valuable insight
- what_to_avoid should be concrete phrases or behaviors, not vague advice`

export async function onRequestPost(context) {
  const { request, env } = context
  if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

  let body
  try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

  const { draft, context: convContext } = body
  if (!draft) return json({ error: "draft required" }, 400)

  const input = convContext
    ? `${COACH_PROMPT}\n\nConversation context:\n${convContext}\n\nDraft to analyze:\n${draft}`
    : `${COACH_PROMPT}\n\nDraft to analyze:\n${draft}`

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.5-preview", input }),
  })

  const data = await res.json()
  const text = data.output?.[0]?.content?.[0]?.text || "{}"

  let report = {}
  try { report = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim()) }
  catch { return json({ error: "Failed to parse coaching report" }, 500) }

  return json({ report })
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
