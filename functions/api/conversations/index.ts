import { Env, json, requireJson, uid, nowIso, openaiResponses, extractOutputText } from '../_shared';

type CreateBody = { title?: string; source_type?: string; text: string };

async function normalizeMessages(env: Env, text: string) {
  const prompt = `Normalize the conversation into JSON only. Return an array named messages. Each item: speaker, body, timestamp|null. Preserve wording. If speaker is unknown use Unknown.\n\nConversation:\n${text}`;
  const ai = await openaiResponses(env, {
    model: 'gpt-5.5',
    input: prompt,
    text: { format: { type: 'json_object' } }
  });
  try {
    const parsed = JSON.parse(extractOutputText(ai));
    if (Array.isArray(parsed.messages)) return parsed.messages;
  } catch {}
  return text.split(/\n+/).filter(Boolean).map((line) => ({ speaker: 'Unknown', body: line, timestamp: null }));
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count FROM conversations c ORDER BY created_at DESC LIMIT 100`).all();
  return json({ conversations: rows.results || [] });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await requireJson<CreateBody>(request);
    if (!body.text?.trim()) return json({ error: 'text is required' }, 400);
    const conversationId = uid('conv');
    const title = body.title || `Conversation ${new Date().toLocaleString()}`;
    const sourceType = body.source_type || 'pasted_text';
    await env.DB.prepare('INSERT INTO conversations (id,title,source_type,created_at,updated_at) VALUES (?,?,?,?,?)')
      .bind(conversationId, title, sourceType, nowIso(), nowIso()).run();
    const messages = await normalizeMessages(env, body.text);
    let pos = 0;
    for (const msg of messages) {
      await env.DB.prepare('INSERT INTO messages (id,conversation_id,speaker,body,timestamp,position,confidence) VALUES (?,?,?,?,?,?,?)')
        .bind(uid('msg'), conversationId, msg.speaker || 'Unknown', msg.body || '', msg.timestamp || null, pos++, 0.85).run();
    }
    return json({ ok: true, conversation_id: conversationId, message_count: pos }, 201);
  } catch (err: any) {
    return json({ error: err.message || 'Failed to create conversation' }, 500);
  }
};
