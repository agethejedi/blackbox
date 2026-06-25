import { Env, json } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const schemaInitializedAt = await env.BLACKBOX_KV.get('schema_initialized_at');
  return json({ ok: true, service: 'Project Black Box API', schema_initialized_at: schemaInitializedAt });
};
