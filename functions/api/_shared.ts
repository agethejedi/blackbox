export type Env = {
  DB: D1Database;
  BLACKBOX_KV: KVNamespace;
  UPLOADS: R2Bucket;
  OPENAI_API_KEY: string;
  ADMIN_INIT_TOKEN: string;
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function requireJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Expected application/json');
  return request.json() as Promise<T>;
}

export function uid(prefix = 'bb') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function nowIso() { return new Date().toISOString(); }

export async function openaiResponses(env: Env, body: Record<string, unknown>) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${text}`);
  return JSON.parse(text);
}

export function extractOutputText(response: any): string {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks: string[] = [];
  for (const item of response.output || []) {
    for (const c of item.content || []) {
      if (c.type === 'output_text' && typeof c.text === 'string') chunks.push(c.text);
    }
  }
  return chunks.join('\n');
}

export async function readConversationText(env: Env, conversationId: string) {
  const rows = await env.DB.prepare('SELECT speaker, body, timestamp FROM messages WHERE conversation_id = ? ORDER BY position ASC')
    .bind(conversationId).all();
  return (rows.results || []).map((r: any) => `${r.speaker || 'Unknown'}: ${r.body}`).join('\n');
}
