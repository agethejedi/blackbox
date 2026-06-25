type Env = {
  DB: D1Database;
  BLACKBOX_KV: KVNamespace;
  UPLOADS: R2Bucket;
  OPENAI_API_KEY: string;
  ADMIN_INIT_TOKEN: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token'
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const response = await context.next();
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
