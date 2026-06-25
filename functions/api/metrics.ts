import { Env, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const analyses = await env.DB.prepare('SELECT * FROM analysis_runs ORDER BY created_at DESC LIMIT 50').all();
  const horsemen = await env.DB.prepare('SELECT * FROM horsemen_scores ORDER BY created_at DESC LIMIT 200').all();
  const repair = await env.DB.prepare('SELECT * FROM repair_scores ORDER BY created_at DESC LIMIT 200').all();
  const topics = await env.DB.prepare('SELECT name, theme, COUNT(*) as count FROM topics GROUP BY name, theme ORDER BY count DESC LIMIT 50').all();
  return json({ analyses: analyses.results || [], horsemen: horsemen.results || [], repair: repair.results || [], topics: topics.results || [] });
};
