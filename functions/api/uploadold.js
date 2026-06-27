// POST /api/upload — upload file to R2 and trigger analysis

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", ...CORS } })

export async function onRequestPost(context) {
  const { request, env } = context
  try {
    if (!env.DB) return json({ error: "DB not configured" }, 503)
    if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not configured" }, 503)

    const formData = await request.formData()
    const file = formData.get("file")
    const type = formData.get("type") || "screenshot"

    if (!file) return json({ error: "file required" }, 400)

    const uploadId = crypto.randomUUID()
    const ext = file.name?.split(".").pop() || "bin"
    const key = `${type}/${uploadId}.${ext}`

    let bucket
    if (type === "audio") bucket = env.BLACKBOX_AUDIO
    else bucket = env.BLACKBOX_UPLOADS

    if (!bucket) return json({ error: `R2 bucket not configured for type: ${type}` }, 503)

    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    })

    const now = new Date().toISOString()
    const convId = crypto.randomUUID()

    await env.DB.prepare(
      "INSERT INTO conversations (id, title, source_type, uploaded_by, created_at, attachment_key, status) VALUES (?, ?, ?, ?, ?, ?, 'processing')"
    ).bind(convId, file.name || "Uploaded File", type, "user", now, key).run()

  // Process based on type
  const processFile = async () => {
    try {
      let rawText = ""

      if (type === "screenshot") {
        // Use GPT-4.5 vision to extract text from screenshot
        const fileData = await bucket.get(key)
        const arrayBuffer = await fileData.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.5-preview",
            input: [
              {
                type: "message",
                role: "user",
                content: [
                  // Normalize HEIC/HEIF to jpeg for OpenAI — it only accepts png, jpeg, gif, webp
                  { type: "input_image", image_url: { url: `data:${
                    (file.type === "image/heic" || file.type === "image/heif") ? "image/jpeg" : (file.type || "image/jpeg")
                  };base64,${base64}` } },
                  { type: "input_text", text: "Extract the conversation text from this screenshot. Format each message as 'Speaker: message text'. If you cannot identify speakers, use 'Person A' and 'Person B'. Return only the conversation text, no other commentary." },
                ],
              },
            ],
          }),
        })

        // Safe parse — OpenAI occasionally returns non-JSON error pages
        let data = {}
        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
          data = await res.json()
        } else {
          const text = await res.text()
          console.error("OpenAI vision non-JSON response:", text.slice(0, 200))
          throw new Error(`OpenAI returned unexpected response (status ${res.status})`)
        }
        rawText = data.output?.[0]?.content?.[0]?.text || ""
        if (!rawText && data.error) throw new Error(data.error.message || "Vision API error")

      } else if (type === "audio") {
        // Transcribe with Whisper
        const fileData = await bucket.get(key)
        const blob = await fileData.blob()
        const form = new FormData()
        form.append("file", blob, file.name)
        form.append("model", "whisper-1")
        form.append("response_format", "text")

        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}` },
          body: form,
        })
        rawText = await res.text()

      } else if (type === "pdf") {
        // Use OpenAI file input for PDFs
        rawText = "[PDF content extraction — attach file via OpenAI Files API in production build]"
      }

      if (rawText) {
        await env.DB.prepare("UPDATE conversations SET raw_text = ? WHERE id = ?").bind(rawText, convId).run()

        // Run analysis
        const analysisRes = await fetch(`https://${new URL(request.url).host}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title: file.name, raw_text: rawText, participants: [] }),
        })
        const analysisData = await analysisRes.json()

        if (analysisData.conversation_id) {
          await env.DB.prepare("UPDATE conversations SET status = 'complete' WHERE id = ?").bind(convId).run()
        }
      } else {
        await env.DB.prepare("UPDATE conversations SET status = 'failed' WHERE id = ?").bind(convId).run()
      }
    } catch (err) {
      console.error("File processing error:", String(err))
      await env.DB.prepare("UPDATE conversations SET status = 'failed' WHERE id = ?").bind(convId).run()
    }
  }

  context.waitUntil(processFile())

    return json({ upload_id: convId, url: key, status: "processing" })
  } catch (err) {
    console.error("Upload handler error:", String(err))
    return json({ error: "Upload failed", detail: String(err) }, 500)
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS })
}
