import { Env, json } from '../_shared';

const schema = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, display_name TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, voice_enrolled INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, source_type TEXT NOT NULL, summary TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, speaker TEXT, body TEXT NOT NULL, timestamp TEXT, position INTEGER NOT NULL, confidence REAL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(conversation_id) REFERENCES conversations(id));
CREATE TABLE IF NOT EXISTS uploaded_files (id TEXT PRIMARY KEY, conversation_id TEXT, r2_key TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT, size_bytes INTEGER, extracted_text TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(conversation_id) REFERENCES conversations(id));
CREATE TABLE IF NOT EXISTS analysis_runs (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, conversation_quality INTEGER, escalation_score INTEGER, validation_score INTEGER, collaboration_score INTEGER, topic_drift_score INTEGER, resolution_probability INTEGER, outcome TEXT, report_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(conversation_id) REFERENCES conversations(id));
CREATE TABLE IF NOT EXISTS horsemen_scores (id TEXT PRIMARY KEY, analysis_run_id TEXT NOT NULL, conversation_id TEXT NOT NULL, speaker TEXT, criticism INTEGER, defensiveness INTEGER, contempt INTEGER, stonewalling INTEGER, evidence_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id));
CREATE TABLE IF NOT EXISTS repair_scores (id TEXT PRIMARY KEY, analysis_run_id TEXT NOT NULL, conversation_id TEXT NOT NULL, speaker TEXT, validation INTEGER, accountability INTEGER, appreciation INTEGER, compromise INTEGER, reconnection INTEGER, repair_attempts INTEGER, successful_repairs INTEGER, evidence_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id));
CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, name TEXT NOT NULL, theme TEXT, first_message_position INTEGER, last_message_position INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(conversation_id) REFERENCES conversations(id));
CREATE TABLE IF NOT EXISTS coaching_reports (id TEXT PRIMARY KEY, draft_text TEXT NOT NULL, risk_score INTEGER, report_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_analysis_conversation ON analysis_runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);
CREATE INDEX IF NOT EXISTS idx_files_conversation ON uploaded_files(conversation_id);
`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = request.headers.get('x-admin-token');
  if (!env.ADMIN_INIT_TOKEN || token !== env.ADMIN_INIT_TOKEN) return json({ error: 'Unauthorized' }, 401);
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) await env.DB.prepare(stmt).run();
  await env.BLACKBOX_KV.put('schema_initialized_at', new Date().toISOString());
  return json({ ok: true, statements: statements.length });
};
