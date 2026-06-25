import { Env, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json({ results: [] });
  const like = `%${q}%`;
  const rows = await env.DB.prepare(`
    SELECT m.conversation_id, c.title, m.speaker, m.body, m.position, c.created_at
    FROM messages m JOIN conversations c ON c.id = m.conversation_id
    WHERE m.body LIKE ? OR m.speaker LIKE ? OR c.title LIKE ?
    ORDER BY c.created_at DESC, m.position ASC
    LIMIT 100
  `).bind(like, like, like).all();
  return json({ query: q, results: rows.results || [] });
};
