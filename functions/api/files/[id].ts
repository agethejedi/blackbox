import { Env, json } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = String(params.id);
  const row: any = await env.DB.prepare('SELECT * FROM uploaded_files WHERE id=?').bind(id).first();
  if (!row) return json({ error: 'Not found' }, 404);
  return json({ file: row });
};
