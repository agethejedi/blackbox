import { Env, json } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = String(params.id);
  const conversation = await env.DB.prepare('SELECT * FROM conversations WHERE id=?').bind(id).first();
  if (!conversation) return json({ error: 'Not found' }, 404);
  const messages = await env.DB.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY position ASC').bind(id).all();
  const analyses = await env.DB.prepare('SELECT * FROM analysis_runs WHERE conversation_id=? ORDER BY created_at DESC LIMIT 10').bind(id).all();
  return json({ conversation, messages: messages.results || [], analyses: analyses.results || [] });
};
